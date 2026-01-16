/**
 * CommentParser - 评论解析器（分部）
 * 
 * Phase 5: 总部-分部解析器架构
 * 负责解析和保存评论数据
 * 支持 tempId 引用博文
 * 
 * @see docs/systems/social-content-types.md Section 11
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/database';
import { writeQueue } from '@/services/database/writeQueue';
import { accountService } from '@/services/account/accountService';
import type { UniversalComment } from '@/types/social';
import type {
  ContentParser,
  ParseContext,
  ValidationResult,
  PersistResult,
  CommentInput,
  CommentOutput,
} from './types';
import { getCurrentSourceTracking } from '../sourceTracking';

/**
 * 确保评论者账号存在
 */
async function ensureCommenterAccount(
  platformId: string,
  nickname: string,
  context: ParseContext
): Promise<string> {
  // 先检查缓存
  const cached = context.resolved.users.get(nickname);
  if (cached) {
    return cached;
  }
  
  // 查找现有账号
  const existingAccounts = await accountService.getAccountsByPlatform(platformId);
  const existing = existingAccounts.find(acc => acc.nickname === nickname);
  if (existing) {
    context.resolved.users.set(nickname, existing.id);
    return existing.id;
  }
  
  // 创建新账号
  try {
    const entity = await accountService.createEntity({
      type: 'npc',
      displayName: nickname,
      source: 'social',
      scope: 'session',
    });
    
    const account = await accountService.createPlatformAccount(
      entity.id,
      platformId,
      {
        handle: `user_${entity.id.slice(0, 8)}`,
        nickname,
        avatarOverride: `https://api.dicebear.com/7.x/avataaars/svg?seed=${entity.id}`,
        scope: 'session',
      }
    );
    
    context.resolved.users.set(nickname, account.id);
    return account.id;
  } catch (e) {
    // 回退到旧系统
    const accountId = uuidv4();
    await db.socialAccounts.add({
      id: accountId,
      platformId,
      nickname,
      handle: `user_${accountId.slice(0, 8)}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${accountId}`,
      origin: 'llm_generated',
      persistence: 'permanent',
      persona: { prompt: '', tone: 'casual' },
    });
    
    context.resolved.users.set(nickname, accountId);
    return accountId;
  }
}

/**
 * 解析 postId（支持 tempId 引用）
 */
function resolvePostId(postId: string | undefined, context: ParseContext): string | undefined {
  if (!postId) return undefined;
  
  // 先尝试从 resolved 中查找（tempId → realId）
  const resolved = context.resolved.posts.get(postId);
  if (resolved) {
    return resolved;
  }
  
  // 尝试作为索引查找
  const byIndex = context.resolved.posts.get(`post_${postId}`);
  if (byIndex) {
    return byIndex;
  }
  
  // 如果看起来像 UUID，直接返回
  if (postId.includes('-') && postId.length > 30) {
    return postId;
  }
  
  // 尝试作为数字索引
  const numericIndex = parseInt(postId, 10);
  if (!isNaN(numericIndex)) {
    const byNumericIndex = context.resolved.posts.get(`${numericIndex}`);
    if (byNumericIndex) {
      return byNumericIndex;
    }
  }
  
  return undefined;
}

/**
 * 评论解析器
 */
export const CommentParser: ContentParser<CommentInput | CommentInput[], CommentOutput> = {
  key: 'comments',
  aliases: ['comments', 'comment', 'replies', 'reply'],
  dependencies: ['posts'],  // 依赖博文先解析
  description: '解析评论数据（支持 tempId 引用博文）',
  
  validate(input): ValidationResult {
    const items = Array.isArray(input) ? input : [input];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (items.length === 0) {
      errors.push('评论数组为空');
    }
    
    items.forEach((item, i) => {
      const itemAny = item as any;
      if (!item.content && !itemAny.text) {
        errors.push(`comments[${i}]: 缺少评论内容`);
      }
      if (!item.postId) {
        warnings.push(`comments[${i}]: 未指定 postId，将尝试关联到第一条博文`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
  
  async transform(input, context): Promise<CommentOutput[]> {
    const items = Array.isArray(input) ? input : [input];
    const results: CommentOutput[] = [];
    
    // 如果没有博文被解析，尝试获取第一个已解析的 postId
    const firstPostId = context.resolved.posts.get('post_0') 
      || context.resolved.posts.get('0')
      || Array.from(context.resolved.posts.values())[0];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as any;
      
      // 解析 postId
      let postId = resolvePostId(item.postId, context);
      
      // 如果没有 postId，使用第一个博文
      if (!postId && firstPostId) {
        postId = firstPostId;
        context.log('warn', `comments[${i}]: 使用默认 postId: ${postId}`);
      }
      
      if (!postId) {
        context.log('warn', `comments[${i}]: 无法确定关联的博文，跳过`);
        continue;
      }
      
      // 获取评论内容
      const content = item.content || item.text || '';
      const nickname = item.nickname || item.author || item.authorName || '微博网友';
      
      // 确保评论者账号存在
      const authorId = await ensureCommenterAccount(context.platformId, nickname, context);
      
      const commentId = uuidv4();
      
      // 获取来源追踪
      const sourceTracking = getCurrentSourceTracking();
      
      const comment: CommentOutput = {
        id: commentId,
        postId,
        platformId: context.platformId,
        namespace: context.namespace,
        authorId,
        content,
        likes: item.likes || Math.floor(Math.random() * 50),
        timestamp: context.timestamp - Math.floor(Math.random() * 3600000) - i * 30000,
        isHot: item.isHot || false,
        // 来源追踪（用于会话/楼层/Swipe 绑定）
        source: sourceTracking,
      };
      
      // 记录 tempId 映射
      if (item.tempId) {
        context.resolved.comments.set(item.tempId, commentId);
      }
      
      results.push(comment);
    }
    
    return results;
  },
  
  async persist(items, context): Promise<PersistResult> {
    const ids: string[] = [];
    const errors: string[] = [];
    const namespace = context.namespace || 'weibo';
    
    // 按 postId 分组统计
    const postCommentCount = new Map<string, number>();
    
    // 通过写入队列串行化写入，确保数据一致性
    await writeQueue.enqueue('app', namespace, async () => {
      for (const comment of items) {
        try {
          await db.socialComments.add(comment);
          ids.push(comment.id);
          
          // 统计每个博文的评论数
          const count = postCommentCount.get(comment.postId) || 0;
          postCommentCount.set(comment.postId, count + 1);
        } catch (e: any) {
          errors.push(`保存失败 ${comment.id}: ${e.message}`);
        }
      }
      
      // 更新博文的评论计数
      for (const [postId, count] of postCommentCount) {
        try {
          const post = await db.socialPosts.get(postId);
          if (post) {
            await db.socialPosts.update(postId, {
              stats: {
                ...post.stats,
                comments: (post.stats.comments || 0) + count,
              },
            });
          }
        } catch (e) {
          context.log('warn', `更新博文评论计数失败: ${postId}`);
        }
      }
    });
    
    context.log('info', `保存 ${ids.length} 条评论，关联 ${postCommentCount.size} 条博文`);
    
    return {
      ids,
      count: ids.length,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
