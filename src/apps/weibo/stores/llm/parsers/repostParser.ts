/**
 * RepostParser - 转发解析器（分部）
 * 
 * Phase 5: 总部-分部解析器架构
 * 负责解析和保存转发数据
 * 实现 RepostSnapshot 扁平化设计
 * 
 * @see docs/systems/social-content-types.md Section 11
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/database';
import { writeQueue } from '@/services/database/writeQueue';
import { accountService } from '@/services/account/accountService';
import type { UniversalPost, RepostSnapshot } from '@/types/social';
import { createDefaultStats, createDefaultContentFlags } from '@/types/social';
import type {
  ContentParser,
  ParseContext,
  ValidationResult,
  PersistResult,
  RepostInput,
} from './types';

/**
 * 确保作者账号存在
 */
async function ensureAuthorAccount(
  platformId: string,
  authorName: string,
  context: ParseContext
): Promise<string> {
  const cached = context.resolved.users.get(authorName);
  if (cached) return cached;
  
  const existingAccounts = await accountService.getAccountsByPlatform(platformId);
  const existing = existingAccounts.find(acc => acc.nickname === authorName);
  if (existing) {
    context.resolved.users.set(authorName, existing.id);
    return existing.id;
  }
  
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
 * 解析原始博文 ID（支持 tempId）
 */
function resolveOriginalPostId(postId: string, context: ParseContext): string | undefined {
  // 先从 resolved 查找
  const resolved = context.resolved.posts.get(postId);
  if (resolved) return resolved;
  
  // 尝试索引形式
  const byIndex = context.resolved.posts.get(`post_${postId}`);
  if (byIndex) return byIndex;
  
  // 如果是 UUID 格式，直接返回
  if (postId.includes('-') && postId.length > 30) {
    return postId;
  }
  
  return undefined;
}

/**
 * 获取原始博文信息（用于构建快照）
 */
async function getOriginalPostSnapshot(
  originalPostId: string,
  context: ParseContext
): Promise<RepostSnapshot | undefined> {
  try {
    const originalPost = await db.socialPosts.get(originalPostId);
    if (!originalPost) {
      context.log('warn', `原始博文不存在: ${originalPostId}`);
      return undefined;
    }
    
    // 获取原作者信息
    let authorName = '未知用户';
    let authorAvatar: string | undefined;
    let verified = false;
    let verifiedType: string | undefined;
    
    const fullProfile = await accountService.getFullProfile(originalPost.authorId);
    if (fullProfile) {
      authorName = fullProfile.displayName || fullProfile.account.nickname || '未知用户';
      authorAvatar = fullProfile.account.avatarOverride;
      const platformData = fullProfile.account.platformData as any;
      verified = platformData?.verified || false;
      verifiedType = platformData?.verifiedType;
    } else {
      // 回退到旧系统
      const oldAccount = await db.socialAccounts.get(originalPost.authorId);
      if (oldAccount) {
        authorName = oldAccount.nickname || '未知用户';
        authorAvatar = oldAccount.avatar;
      }
    }
    
    return {
      originalPostId,
      originalAuthor: {
        name: authorName,
        avatar: authorAvatar,
        verified,
        verifiedType,
      },
      originalContent: {
        text: originalPost.payload?.text || '',
        primaryType: originalPost.primaryType || 'text',
        thumbnail: originalPost.media?.[0]?.description,
        timestamp: originalPost.timestamp,
      },
    };
  } catch (e) {
    context.log('error', `获取原始博文失败: ${e}`);
    return undefined;
  }
}

/**
 * 转发解析器
 */
export const RepostParser: ContentParser<RepostInput | RepostInput[], UniversalPost> = {
  key: 'reposts',
  aliases: ['reposts', 'repost', 'forwards', 'forward'],
  dependencies: ['posts'],  // 依赖博文先解析
  description: '解析转发数据（实现扁平化快照）',
  
  validate(input): ValidationResult {
    const items = Array.isArray(input) ? input : [input];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (items.length === 0) {
      errors.push('转发数组为空');
    }
    
    items.forEach((item, i) => {
      if (!item.originalPostId) {
        errors.push(`reposts[${i}]: 缺少 originalPostId`);
      }
      if (!item.payload?.text) {
        warnings.push(`reposts[${i}]: 缺少转发文案`);
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
      
      // 解析原始博文 ID
      const originalPostId = resolveOriginalPostId(item.originalPostId, context);
      if (!originalPostId) {
        context.log('warn', `reposts[${i}]: 无法解析原始博文 ID: ${item.originalPostId}`);
        continue;
      }
      
      // 获取原始博文快照
      const repostSnapshot = await getOriginalPostSnapshot(originalPostId, context);
      if (!repostSnapshot) {
        context.log('warn', `reposts[${i}]: 无法获取原始博文快照`);
        continue;
      }
      
      // 确保转发者账号存在
      const authorName = item.authorName || '微博用户';
      const authorId = await ensureAuthorAccount(context.platformId, authorName, context);
      
      const postId = uuidv4();
      
      // 构建转发博文
      const repost: UniversalPost = {
        id: postId,
        platformId: context.platformId,
        namespace: context.namespace,
        authorId,
        timestamp: context.timestamp - Math.floor(Math.random() * 1800000) - i * 30000,
        primaryType: 'repost',
        contentFlags: {
          ...createDefaultContentFlags(),
          hasText: true,
          hasRepost: true,
        },
        media: [],
        topicTags: [],
        payload: {
          text: item.payload?.text || '',
          repost: repostSnapshot,
        },
        stats: createDefaultStats(),
        meta: {
          source: 'llm_generated',
          visibility: 'public',
        },
      };
      
      // 更新原博文的转发计数
      try {
        const originalPost = await db.socialPosts.get(originalPostId);
        if (originalPost) {
          await db.socialPosts.update(originalPostId, {
            stats: {
              ...originalPost.stats,
              shares: (originalPost.stats.shares || 0) + 1,
            },
          });
        }
      } catch (e) {
        context.log('warn', `更新原博文转发计数失败: ${originalPostId}`);
      }
      
      results.push(repost);
    }
    
    return results;
  },
  
  async persist(items, context): Promise<PersistResult> {
    const ids: string[] = [];
    const errors: string[] = [];
    const namespace = context.namespace || 'weibo';
    
    // 通过写入队列串行化写入，确保数据一致性
    await writeQueue.enqueue('app', namespace, async () => {
      for (const repost of items) {
        try {
          await db.socialPosts.add(repost);
          ids.push(repost.id);
          context.log('info', `保存转发: ${repost.id}`);
        } catch (e: any) {
          errors.push(`保存失败 ${repost.id}: ${e.message}`);
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
