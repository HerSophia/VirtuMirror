/**
 * PostParser - 博文解析器（分部）
 * 
 * Phase 5: 总部-分部解析器架构
 * 负责解析和保存博文数据
 * 
 * @see docs/systems/social-content-types.md Section 11
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/database';
import { writeQueue } from '@/services/database/writeQueue';
import { accountService } from '@/services/account/accountService';
import type { UniversalPost } from '@/types/social';
import {
  transformLLMOutputToUniversalPost,
  generateRandomStats,
  validateLLMOutput,
} from '../postTransformer';
import { getCurrentSourceTracking } from '../sourceTracking';
import type {
  ContentParser,
  ParseContext,
  ValidationResult,
  PersistResult,
  PostInput,
} from './types';

/**
 * 确保作者账号存在
 */
async function ensureAuthorAccount(
  platformId: string,
  authorName: string,
  context: ParseContext
): Promise<string> {
  // 先检查缓存
  const cached = context.resolved.users.get(authorName);
  if (cached) {
    return cached;
  }
  
  // 查找现有账号
  const existingAccounts = await accountService.getAccountsByPlatform(platformId);
  const existing = existingAccounts.find(acc => acc.nickname === authorName);
  if (existing) {
    context.resolved.users.set(authorName, existing.id);
    return existing.id;
  }
  
  // 创建新账号
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
    
    context.resolved.users.set(authorName, account.id);
    return account.id;
  } catch (e) {
    // 回退到旧系统
    const accountId = uuidv4();
    await db.socialAccounts.add({
      id: accountId,
      platformId,
      nickname: authorName,
      handle: `user_${accountId.slice(0, 8)}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${accountId}`,
      origin: 'llm_generated',
      persistence: 'permanent',
      persona: { prompt: '', tone: 'casual' },
    });
    
    context.resolved.users.set(authorName, accountId);
    return accountId;
  }
}

/**
 * 博文解析器
 */
export const PostParser: ContentParser<PostInput | PostInput[], UniversalPost> = {
  key: 'posts',
  aliases: ['posts', 'post', 'weibos', 'weibo'],
  dependencies: [],  // 博文不依赖其他解析器
  description: '解析博文/微博数据',
  
  validate(input): ValidationResult {
    const items = Array.isArray(input) ? input : [input];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (items.length === 0) {
      errors.push('博文数组为空');
    }
    
    items.forEach((item, i) => {
      const validation = validateLLMOutput(item);
      if (!validation.valid) {
        errors.push(`posts[${i}]: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings?.length) {
        warnings.push(...validation.warnings.map(w => `posts[${i}]: ${w}`));
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
  
  async transform(input, context): Promise<UniversalPost[]> {
    const items = Array.isArray(input) ? input : [input];
    const results: UniversalPost[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 使用转换层处理
      const { post: postData, authorName, tempId } = transformLLMOutputToUniversalPost(
        item,
        {
          platformId: context.platformId,
          timestamp: context.timestamp - Math.floor(Math.random() * 3600000) - i * 60000,
        }
      );
      
      // 确保作者账号存在
      const authorId = await ensureAuthorAccount(context.platformId, authorName, context);
      
      // 生成真实 ID
      const postId = uuidv4();
      
      // 记录 tempId 映射（供评论解析器使用）
      if (tempId) {
        context.resolved.posts.set(tempId, postId);
      }
      // 也用索引作为 fallback 映射
      context.resolved.posts.set(`post_${i}`, postId);
      context.resolved.posts.set(`${i}`, postId);
      
      // 获取来源追踪
      const sourceTracking = getCurrentSourceTracking();
      
      // 构建完整博文
      const universalPost: UniversalPost = {
        id: postId,
        platformId: context.platformId,
        namespace: context.namespace,
        authorId,
        timestamp: postData.timestamp || context.timestamp - i * 60000,
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
      
      results.push(universalPost);
    }
    
    return results;
  },
  
  async persist(items, context): Promise<PersistResult> {
    const ids: string[] = [];
    const errors: string[] = [];
    const namespace = context.namespace || 'weibo';
    
    // 通过写入队列串行化写入，确保数据一致性
    await writeQueue.enqueue('app', namespace, async () => {
      for (const post of items) {
        try {
          await db.socialPosts.add(post);
          ids.push(post.id);
          context.log('info', `保存博文: ${post.id} (${post.primaryType})`);
        } catch (e: any) {
          errors.push(`保存失败 ${post.id}: ${e.message}`);
        }
      }
    });
    
    return {
      ids,
      count: ids.length,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
