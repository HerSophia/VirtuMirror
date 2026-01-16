/**
 * LLM 任务输出处理器工具函数
 * 提供博文、评论、互动数据的保存功能
 * 
 * Phase 4 重构：
 * - 使用 postTransformer 统一转换 LLM 输出
 * - 使用 accountService 管理账号（替代直接操作 db.socialAccounts）
 * 
 * 注意：processTaskOutput 函数已废弃，请使用新的 OutputHandler 接口
 * @see docs/systems/llm-task-service.md
 * @see src/apps/weibo/llmTask/weiboOutputHandlers.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/database';
import { accountService } from '@/services/account/accountService';
import { writeQueue } from '@/services/database/writeQueue';
import { useAppRuntime, tryUseAppRuntime } from '@/services/appRuntime';
import type { UniversalPost, UniversalComment } from '@/types/social';
import {
  transformLLMOutputToUniversalPost,
  transformBatchLLMOutput,
  validateLLMOutput,
  generateRandomStats,
  type TransformContext,
} from './postTransformer';
import { getCurrentSourceTracking } from './sourceTracking';

// ==================== 类型定义 ====================

export interface EngagementResult {
  success: boolean;
  comments: number;
  likes: number;
  shares: number;
  error?: string;
}

export type LogFunction = (taskId: string, level: 'info' | 'warn' | 'error', message: string) => void;

// ==================== 单条博文保存（支持多类型） ====================

export interface SinglePostResult {
  success: boolean;
  postId?: string;
  type?: string;
  error?: string;
}

/**
 * 确保作者账号存在（使用新账号系统）
 * @param platformId 平台 ID
 * @param authorName 作者昵称
 * @returns 账号 ID
 */
async function ensureAuthorAccount(
  platformId: string,
  authorName: string
): Promise<string> {
  // 1. 查找现有账号（通过 nickname 匹配）
  const existingAccounts = await accountService.getAccountsByPlatform(platformId);
  const existing = existingAccounts.find(acc => acc.nickname === authorName);
  if (existing) {
    return existing.id;
  }
  
  // 2. 创建新实体和账号
  try {
    const entity = await accountService.createEntity({
      type: 'npc',
      displayName: authorName,
      source: 'social',
      scope: 'session',
    });
    
    const account = await accountService.createPlatformAccount(
      entity.id,
      platformId,
      {
        handle: `user_${entity.id.slice(0, 8)}`,
        nickname: authorName,
        avatarOverride: `https://api.dicebear.com/7.x/avataaars/svg?seed=${entity.id}`,
        scope: 'session',
      }
    );
    
    console.log(`[OutputHandlers] 创建新账号: ${authorName} (${account.id})`);
    return account.id;
  } catch (e) {
    console.warn('[OutputHandlers] 创建账号失败，回退到旧系统:', e);
    // 回退：直接创建到旧表（兼容性）
    const accountId = uuidv4();
    await db.socialAccounts.add({
      id: accountId,
      platformId,
      nickname: authorName,
      handle: `user_${accountId.slice(0, 8)}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${accountId}`,
      origin: 'llm_generated',
      persistence: 'permanent',
      persona: {
        prompt: '',
        tone: 'casual',
      },
    });
    return accountId;
  }
}

/**
 * 将单条生成的博文保存到数据库（支持 text/poll/video 三种类型）
 * 
 * Phase 4 重构：使用 postTransformer 统一转换格式
 * 
 * @param jsonOutput LLM 输出的 JSON 字符串
 * @param taskId 任务 ID（用于日志）
 * @param addLog 日志函数
 * @returns 保存结果
 */
export async function saveSinglePostToDatabase(
  jsonOutput: string,
  taskId: string,
  addLog: LogFunction
): Promise<SinglePostResult> {
  try {
    // 1. 清理并解析 JSON
    const cleanJson = cleanJsonOutput(jsonOutput);
    const parsed = JSON.parse(cleanJson);
    
    if(!parsed || typeof parsed !== 'object') {
      return { success: false, error: '无效的 JSON 输出' };
    }
    
    // 2. 验证输出
    const validation = validateLLMOutput(parsed);
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => addLog(taskId, 'warn', w));
    }
    
    const now = Date.now();

    // 通过 AppRuntime（若存在）获取命名空间，LLM 处理可能在非组件上下文运行，因此使用 tryUseAppRuntime
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;
    
    // 3. 使用转换层处理 LLM 输出
    const context: TransformContext = {
      platformId: 'weibo',
      timestamp: now,
    };
    
    const { post: postData, authorName } = transformLLMOutputToUniversalPost(parsed, context);
    
    // 4. 确保作者账号存在
    const authorId = await ensureAuthorAccount('weibo', authorName);
    
    // 5. 获取来源追踪
    const sourceTracking = getCurrentSourceTracking();
    
    // 6. 构建完整的博文记录
    const postId = uuidv4();
    const universalPost: UniversalPost = {
      id: postId,
      platformId: 'weibo',
      namespace,
      authorId,
      timestamp: now,
      primaryType: postData.primaryType || 'text',
      contentFlags: postData.contentFlags,
      media: postData.media,
      topicTags: postData.topicTags || [],
      payload: postData.payload || { text: '' },
      stats: generateRandomStats(),
      meta: {
        source: 'llm_generated',
        visibility: 'public',
      },
      // 来源追踪（用于会话/楼层/Swipe 绑定）
      source: sourceTracking,
    };
    
    await writeQueue.enqueue('app', namespace || 'weibo', async () => {
      await db.socialPosts.add(universalPost);
    });
    
    console.log(`[OutputHandlers] 已保存博文: ${postId} (类型: ${universalPost.primaryType}) by ${authorName}`);
    
    return { success: true, postId, type: universalPost.primaryType };
  } catch (e: any) {
    console.error('[OutputHandlers] 保存博文失败:', e);
    addLog(taskId, 'error', `保存博文失败: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ==================== 批量博文保存（支持多类型） ====================

export interface BatchPostResult {
  total: number;
  text: number;
  poll: number;
  video: number;
  gallery: number;
}

/**
 * 将批量生成的博文保存到数据库（支持 text/poll/video/gallery 等类型）
 * 
 * Phase 4 重构：使用 postTransformer 统一转换格式
 * 
 * @param jsonOutput LLM 输出的 JSON 字符串
 * @param taskId 任务 ID（用于日志）
 * @param addLog 日志函数
 * @returns 保存成功的博文数量
 */
export async function saveBatchPostsToDatabase(
  jsonOutput: string, 
  taskId: string,
  addLog: LogFunction
): Promise<number> {
  try {
    // 1. 清理并解析 JSON
    const cleanJson = cleanJsonOutput(jsonOutput);
    const parsed = JSON.parse(cleanJson);
    const posts: any[] = Array.isArray(parsed) ? parsed : [parsed];
    
    if (posts.length === 0) {
      addLog(taskId, 'warn', '没有有效的博文数据');
      return 0;
    }
    
    const now = Date.now();
    const result: BatchPostResult = { total: 0, text: 0, poll: 0, video: 0, gallery: 0 };

    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;
    
    // 2. 使用转换层批量处理
    const context: TransformContext = {
      platformId: 'weibo',
      timestamp: now,
    };
    
    const transformedResults = transformBatchLLMOutput(posts, context);
    
    // 3. 保存每条博文
    for (let i = 0; i < transformedResults.length; i++) {
      const { post: postData, authorName } = transformedResults[i];
      
      // 验证
      const validation = validateLLMOutput(posts[i]);
      if (!validation.valid) {
        addLog(taskId, 'warn', `跳过第 ${i + 1} 条博文: ${validation.errors.join(', ')}`);
        continue;
      }
      
      // 确保作者账号存在
      const authorId = await ensureAuthorAccount('weibo', authorName);
      
      // 获取来源追踪
      const sourceTracking = getCurrentSourceTracking();
      
      // 构建完整的博文记录
      const postId = uuidv4();
      const universalPost: UniversalPost = {
        id: postId,
        platformId: 'weibo',
        namespace,
        authorId,
        timestamp: postData.timestamp || now - i * 60000,
        primaryType: postData.primaryType || 'text',
        contentFlags: postData.contentFlags,
        media: postData.media,
        topicTags: postData.topicTags || [],
        payload: postData.payload || { text: '' },
        stats: generateRandomStats(),
        meta: {
          source: 'llm_generated',
          visibility: 'public',
        },
        // 来源追踪（用于会话/楼层/Swipe 绑定）
        source: sourceTracking,
      };
      
      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialPosts.add(universalPost);
      });
      result.total++;
      
      // 统计类型
      switch (universalPost.primaryType) {
        case 'text': result.text++; break;
        case 'poll': result.poll++; break;
        case 'video': result.video++; break;
        case 'gallery': result.gallery++; break;
        default: result.text++;
      }
      
      console.log(`[OutputHandlers] 已保存博文: ${postId} (类型: ${universalPost.primaryType}) by ${authorName}`);
    }
    
    // 4. 输出详细统计
    const typeStats = [];
    if (result.text > 0) typeStats.push(`文字${result.text}条`);
    if (result.gallery > 0) typeStats.push(`图集${result.gallery}条`);
    if (result.poll > 0) typeStats.push(`投票${result.poll}条`);
    if (result.video > 0) typeStats.push(`视频${result.video}条`);
    if (typeStats.length > 0) {
      addLog(taskId, 'info', `博文类型统计: ${typeStats.join(', ')}`);
    }
    
    return result.total;
  } catch (e: any) {
    console.error('[OutputHandlers] 保存博文失败:', e);
    addLog(taskId, 'error', `保存博文失败: ${e.message}`);
    return 0;
  }
}

// ==================== 互动数据保存 ====================

/**
 * 将互动数据（评论、点赞、转发）保存到数据库
 * 
 * Phase 4 重构：评论者使用 ensureAuthorAccount 创建
 */
export async function saveEngagementToDatabase(
  jsonOutput: string,
  taskId: string,
  postId: string | undefined,
  addLog: LogFunction
): Promise<EngagementResult> {
  try {
    // 移除可能的 markdown 代码块
    const cleanJson = cleanJsonOutput(jsonOutput);
    const parsed = JSON.parse(cleanJson);
    
    let savedComments = 0;
    let likes = 0;
    let shares = 0;
    
    const runtime = tryUseAppRuntime();
    const namespace = runtime?.identity.dataNamespace;

    // 处理统计数据
    if (parsed.stats) {
      likes = parsed.stats.likes || 0;
      shares = parsed.stats.shares || parsed.stats.reposts || 0;
      
      // 如果有 postId，更新博文统计
      if (postId) {
        const post = await db.socialPosts.get(postId);
        if (post) {
          await writeQueue.enqueue('app', namespace || 'weibo', async () => {
            await db.socialPosts.update(postId, {
              stats: {
                views: parsed.stats.views || post.stats.views || 0,
                likes,
                comments: (parsed.comments?.length || 0) + (post.stats.comments || 0),
                shares,
              }
            });
          });
          addLog(taskId, 'info', `已更新博文 ${postId} 的统计数据`);
        }
      }
    }
    
    // 处理评论
    if (parsed.comments && Array.isArray(parsed.comments) && postId) {
      for (const comment of parsed.comments) {
        if (!comment || !comment.content) continue;
        
        // 使用新系统创建评论者账号
        const nickname = comment.nickname || '微博网友';
        const authorId = await ensureAuthorAccount('weibo', nickname);
        
        // 获取来源追踪
        const sourceTracking = getCurrentSourceTracking();
        
        // 创建评论
        const commentId = uuidv4();
        const newComment: UniversalComment = {
          id: commentId,
          postId,
          platformId: 'weibo',
          namespace,
          authorId,
          content: comment.content,
          likes: comment.likes || Math.floor(Math.random() * 50),
          timestamp: Date.now() - Math.floor(Math.random() * 3600000),
          // 来源追踪（用于会话/楼层/Swipe 绑定）
          source: sourceTracking,
        };
        
        await writeQueue.enqueue('app', namespace || 'weibo', async () => {
          await db.socialComments.add(newComment);
        });
        savedComments++;
      }
    }
    
    return { success: true, comments: savedComments, likes, shares };
  } catch (e: any) {
    console.error('[OutputHandlers] 保存互动数据失败:', e);
    return { success: false, comments: 0, likes: 0, shares: 0, error: e.message };
  }
}

// ==================== 输入预处理 ====================

/**
 * 预处理互动生成任务的输入
 * 如果提供了 postId，自动获取博文和博主信息
 * 
 * Phase 4 重构：优先使用新账号系统获取博主信息
 */
export async function preprocessEngagementInput(
  input: Record<string, any>
): Promise<Record<string, any>> {
  const postId = input.postId;
  if (!postId) {
    return input;
  }
  
  try {
    // 获取博文
    const post = await db.socialPosts.get(postId);
    if (!post) {
      console.warn(`[OutputHandlers] 未找到博文: ${postId}`);
      return input;
    }
    
    // 自动填充数据（仅填充空值）
    const enrichedInput = { ...input };
    
    // 博文内容
    if (!enrichedInput.postContent && post.payload?.text) {
      enrichedInput.postContent = post.payload.text;
    }
    
    // 尝试从新账号系统获取博主信息
    const fullProfile = await accountService.getFullProfile(post.authorId);
    
    if (fullProfile) {
      if (!enrichedInput.authorName) {
        enrichedInput.authorName = fullProfile.displayName || '未知用户';
      }
      if (!enrichedInput.authorBio) {
        enrichedInput.authorBio = fullProfile.bio || '';
      }
      // 从平台数据获取粉丝数
      if (!enrichedInput.followerCount || enrichedInput.followerCount === 100) {
        const platformData = fullProfile.account.platformData as any;
        enrichedInput.followerCount = platformData?.followers || 100;
      }
      if (!enrichedInput.accountType || enrichedInput.accountType === '普通用户') {
        const platformData = fullProfile.account.platformData as any;
        enrichedInput.accountType = platformData?.verified ? '认证用户' : '普通用户';
      }
    } else {
      // 回退到旧账号系统
      const authorAccount = await db.socialAccounts.get(post.authorId);
      if (authorAccount) {
        if (!enrichedInput.authorName) {
          enrichedInput.authorName = authorAccount.nickname || '未知用户';
        }
        if (!enrichedInput.authorBio) {
          enrichedInput.authorBio = authorAccount.persona?.prompt || '';
        }
        if (!enrichedInput.followerCount || enrichedInput.followerCount === 100) {
          const appearanceCount = authorAccount.evolution?.appearanceCount || 1;
          enrichedInput.followerCount = Math.min(10000, appearanceCount * 50);
        }
        if (!enrichedInput.accountType || enrichedInput.accountType === '普通用户') {
          enrichedInput.accountType = authorAccount.origin === 'system_preset' ? '认证用户' : '普通用户';
        }
      }
    }
    
    console.log('[OutputHandlers] 已自动填充博主信息:', {
      postId,
      authorName: enrichedInput.authorName,
      followerCount: enrichedInput.followerCount,
    });
    
    return enrichedInput;
  } catch (e) {
    console.warn('[OutputHandlers] 预处理互动输入失败:', e);
    return input;
  }
}

// ==================== 工具函数 ====================

/**
 * 清理 JSON 输出（移除 markdown 代码块）
 */
export function cleanJsonOutput(jsonOutput: string): string {
  let cleanJson = jsonOutput.trim();
  
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.slice(7);
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.slice(3);
  }
  
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.slice(0, -3);
  }
  
  return cleanJson.trim();
}
