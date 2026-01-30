/**
 * 话题内容惰性加载器
 * 使用 LazyLoader 服务封装话题内容的惰性加载逻辑
 */

import { createLazyLoader, LazyLoaderRegistry } from '../lazyLoader';
import { db } from '../database/schema';
import { ContentFactory } from './contentFactory';
import { accountService } from '../account/accountService';
import { UserPool } from '../account/userPool';
import { v4 as uuidv4 } from 'uuid';
import type { UniversalPost } from '../../types/social';
import type { PlatformAccount } from '../../types/account';
import { loggerService } from '@/services/logger';

const logger = loggerService.child('service:topicContentLoader');

/**
 * 话题内容加载结果
 */
export interface TopicContentResult {
  posts: UniversalPost[];
  generated: boolean;
}

/**
 * 为话题生成内容
 */
async function generateTopicContent(topicId: string): Promise<TopicContentResult> {
  const topic = await db.socialTopics.get(topicId);
  if (!topic || !topic.platformId) {
    return { posts: [], generated: false };
  }

  // 检查该话题下是否已有博文
  const existingPosts = await db.socialPosts
    .where('topicTags')
    .equals(topic.keyword)
    .and((p) => p.platformId === topic.platformId!)
    .toArray();

  if (existingPosts.length > 0) {
    // 已有内容，直接返回
    return { posts: existingPosts, generated: false };
  }

  // 生成初始内容 (Topic Filler)
  logger.info(`Generating content for topic: ${topic.keyword}`);

  const generatedPosts: UniversalPost[] = [];
  const generateCount = 3 + Math.floor(Math.random() * 3); // 3-5 条

  for (let i = 0; i < generateCount; i++) {
    try {
      // 使用账号系统获取或创建发帖账号
      let account: PlatformAccount | undefined;

      // 尝试获取随机的 NPC 账号
      const existingAccounts = await accountService.getAccountsByPlatform(topic.platformId);
      const npcAccounts = existingAccounts.filter((acc) => acc.scope === 'session');

      if (npcAccounts.length > 0) {
        // 随机选择一个已有账号
        account = npcAccounts[Math.floor(Math.random() * npcAccounts.length)];
      } else {
        // 创建一个新的 NPC 账号
        const userPool = UserPool.getInstance();
        const profile = userPool.generateRandomProfile({ platform: topic.platformId });

        const entity = await accountService.createEntity({
          type: 'npc',
          displayName: profile.nickname || '热心网友',
          avatar: profile.avatar,
          bio: profile.bio,
          gender: profile.gender,
          source: 'social',
          scope: 'session',
        });

        const handle = `user_${Math.random().toString(36).substr(2, 9)}`;
        account = await accountService.createPlatformAccount(entity.id, topic.platformId, {
          handle,
          nickname: profile.nickname || '热心网友',
          scope: 'session',
        });
      }

      const postData = await ContentFactory.getInstance().generatePost(
        topic.platformId,
        topic,
        account
      );

      const post: UniversalPost = {
        id: uuidv4(),
        platformId: topic.platformId,
        authorId: account.id,
        timestamp: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60), // 过去1小时内随机时间
        topicTags: [topic.keyword],
        stats: {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        },
        payload: postData,
      };

      // 保存到 DB
      await db.socialPosts.add(post);
      generatedPosts.push(post);
    } catch (err) {
      logger.error('Failed to generate post', err);
    }
  }

  return { posts: generatedPosts, generated: true };
}

/**
 * 话题内容加载器实例
 */
export const topicContentLoader = createLazyLoader<TopicContentResult>({
  loader: generateTopicContent,

  cache: {
    maxSize: 50, // 最多缓存 50 个话题
    ttl: 30 * 60 * 1000, // 缓存 30 分钟
    strategy: 'lru',
  },

  concurrency: 3, // 最多同时生成 3 个话题的内容

  onLoadStart: (topicId) => {
    logger.debug(`Loading content for topic: ${topicId}`);
  },

  onLoadEnd: (topicId, result, error) => {
    if (error) {
      logger.error(`Failed to load topic ${topicId}:`, error);
    } else if (result) {
      logger.debug(
        `Loaded ${result.posts.length} posts for topic ${topicId} (generated: ${result.generated})`
      );
    }
  },

  onCacheHit: (topicId) => {
    logger.debug(`Cache hit for topic: ${topicId}`);
  },

  onError: (topicId, error) => {
    logger.error(`Error loading topic ${topicId}:`, error);
  },
});

// 注册到全局注册表
LazyLoaderRegistry.register('topicContent', topicContentLoader);

/**
 * 预加载热门话题内容
 * 在用户浏览热搜列表时调用
 */
export async function preloadTopTopics(topicIds: string[]): Promise<void> {
  // 预加载前 3 个话题
  const topIds = topicIds.slice(0, 3);
  await topicContentLoader.preload(topIds);
}

/**
 * 预热缓存（从数据库恢复）
 */
export async function warmupTopicCache(): Promise<void> {
  // 获取最近访问的话题
  const recentTopics = await db.socialTopics.orderBy('createdAt').reverse().limit(10).toArray();

  for (const topic of recentTopics) {
    // 检查是否已有内容
    const posts = await db.socialPosts
      .where('topicTags')
      .equals(topic.keyword)
      .and((p) => p.platformId === topic.platformId!)
      .toArray();

    if (posts.length > 0) {
      // 预热缓存
      topicContentLoader.prime(topic.id, { posts, generated: false });
    }
  }
}
