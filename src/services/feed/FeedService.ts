/**
 * Feed Service 核心服务
 * 信息流服务的主入口，协调各组件工作
 */

import type { UniversalPost } from '@/types/social';
import type {
  IFeedService,
  FeedType,
  FeedItem,
  FeedResult,
  FeedOptions,
  FeedEvent,
  FeedEventType,
  AlgorithmConfig,
  AlgorithmWeights,
  FeedFilter,
  BuiltinFilterType,
  CategoryFeedOptions,
  TopicFeedOptions,
  TrendingOptions,
  FeedCacheStats,
  ScoreContext,
  FeedReason,
} from '@/types/feed';
import { AlgorithmRegistry, DEFAULT_ALGORITHM_CONFIG } from './AlgorithmRegistry';
import { ScoreCalculator } from './ScoreCalculator';
import { DiversityController } from './DiversityController';
import { FilterChain } from './FilterChain';
import { FeedCache } from './FeedCache';
import { loggerService } from '@/services/logger/loggerService';
import { SystemContentProvider } from './SystemContentProvider';

/**
 * 生成 FeedItem ID
 */
function generateFeedItemId(): string {
  return `feed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Feed Service 配置
 */
export interface FeedServiceConfig {
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 默认每页数量 */
  defaultLimit?: number;
  /** 最大每页数量 */
  maxLimit?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FeedServiceConfig = {
  debug: false,
  defaultLimit: 20,
  maxLimit: 50,
};

/**
 * 内容提供者接口
 * 用于从外部获取内容
 */
export interface ContentProvider {
  /** 获取关注用户的帖子 */
  getFollowingPosts(userId: string, platformId: string, limit: number): Promise<UniversalPost[]>;
  /** 获取热门帖子 */
  getTrendingPosts(platformId: string, limit: number, category?: string): Promise<UniversalPost[]>;
  /** 获取话题帖子 */
  getTopicPosts(platformId: string, topicId: string, limit: number): Promise<UniversalPost[]>;
  /** 获取分类帖子 */
  getCategoryPosts(platformId: string, category: string, limit: number): Promise<UniversalPost[]>;
  /** 获取用户关注列表 */
  getFollowingIds(userId: string, platformId: string): Promise<string[]>;
  /** 获取用户互动过的账号列表 */
  getInteractedIds(userId: string, platformId: string): Promise<string[]>;
  /** 获取用户兴趣标签 */
  getInterestTags(userId: string, platformId: string): Promise<string[]>;
}

/**
 * Feed Service 类
 */
export class FeedService implements IFeedService {
  private algorithmRegistry: AlgorithmRegistry;
  private scoreCalculator: ScoreCalculator;
  private diversityController: DiversityController;
  private filterChain: FilterChain;
  private cache: FeedCache;
  private config: FeedServiceConfig;
  private eventListeners: Set<(event: FeedEvent) => void> = new Set();
  private contentProvider: ContentProvider | null = null;

  constructor(config: Partial<FeedServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.algorithmRegistry = new AlgorithmRegistry();
    this.scoreCalculator = new ScoreCalculator();
    this.diversityController = new DiversityController();
    this.filterChain = new FilterChain();
    this.cache = new FeedCache();
    this.contentProvider = new SystemContentProvider();
  }

  /**
   * 设置内容提供者
   */
  setContentProvider(provider: ContentProvider): void {
    this.contentProvider = provider;
  }

  // ==========================================
  // 信息流获取
  // ==========================================

  /**
   * 获取个性化首页信息流
   */
  async getPersonalizedFeed(
    userId: string,
    platformId: string,
    options: FeedOptions = {}
  ): Promise<FeedResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || this.config.defaultLimit!, this.config.maxLimit!);
    const offset = options.offset || 0;

    // 检查缓存
    if (!options.forceRefresh) {
      const cacheKey = this.cache.generateKey(userId, platformId, 'home', options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.emitEvent('feed:cacheHit', userId, platformId, 'home');
        return this.buildResult(cached, 'home', platformId, true, startTime);
      }
      this.emitEvent('feed:cacheMiss', userId, platformId, 'home');
    }

    // 获取内容
    const posts = await this.aggregateContent(userId, platformId, {
      sources: ['following', 'trending'],
      limit: limit * 2, // 获取更多以便过滤后仍有足够内容
    });

    // 处理内容
    const items = await this.processPosts(posts, userId, platformId, {
      ...options,
      limit,
      offset,
    });

    // 缓存结果
    const cacheKey = this.cache.generateKey(userId, platformId, 'home', options);
    this.cache.set(cacheKey, items, 'home');

    this.emitEvent('feed:loaded', userId, platformId, 'home', { itemCount: items.length });

    return this.buildResult(items, 'home', platformId, false, startTime);
  }

  /**
   * 获取关注流
   */
  async getFollowingFeed(
    userId: string,
    platformId: string,
    options: FeedOptions = {}
  ): Promise<FeedResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || this.config.defaultLimit!, this.config.maxLimit!);

    // 检查缓存
    if (!options.forceRefresh) {
      const cacheKey = this.cache.generateKey(userId, platformId, 'following', options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.emitEvent('feed:cacheHit', userId, platformId, 'following');
        return this.buildResult(cached, 'following', platformId, true, startTime);
      }
    }

    // 获取关注用户的帖子
    const posts = await this.getFollowingPosts(userId, platformId, limit * 2);

    // 处理内容（关注流主要按时间排序，但仍需过滤）
    const items = await this.processPosts(posts, userId, platformId, {
      ...options,
      limit,
      sortByTime: true,
    });

    // 缓存结果
    const cacheKey = this.cache.generateKey(userId, platformId, 'following', options);
    this.cache.set(cacheKey, items, 'following');

    this.emitEvent('feed:loaded', userId, platformId, 'following', { itemCount: items.length });

    return this.buildResult(items, 'following', platformId, false, startTime);
  }

  /**
   * 获取热门内容
   */
  async getTrendingContent(
    platformId: string,
    options: TrendingOptions = {}
  ): Promise<FeedResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || this.config.defaultLimit!, this.config.maxLimit!);

    // 热门内容使用匿名用户缓存
    const userId = '__trending__';

    // 检查缓存
    if (!options.forceRefresh) {
      const cacheKey = this.cache.generateKey(userId, platformId, 'trending', options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return this.buildResult(cached, 'trending', platformId, true, startTime);
      }
    }

    // 获取热门帖子
    const posts = await this.getTrendingPosts(platformId, limit * 2, options.category);

    // 处理内容（热门流按热度排序）
    const items = await this.processPosts(posts, userId, platformId, {
      ...options,
      limit,
      sortByEngagement: true,
    });

    // 添加推荐原因
    for (const item of items) {
      item.reason = { type: 'trending', description: '热门内容' };
    }

    // 缓存结果
    const cacheKey = this.cache.generateKey(userId, platformId, 'trending', options);
    this.cache.set(cacheKey, items, 'trending');

    return this.buildResult(items, 'trending', platformId, false, startTime);
  }

  /**
   * 获取发现页内容
   */
  async getDiscoverContent(
    userId: string,
    platformId: string,
    options: FeedOptions = {}
  ): Promise<FeedResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || this.config.defaultLimit!, this.config.maxLimit!);

    // 检查缓存
    if (!options.forceRefresh) {
      const cacheKey = this.cache.generateKey(userId, platformId, 'discover', options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return this.buildResult(cached, 'discover', platformId, true, startTime);
      }
    }

    // 发现页混合热门和推荐内容
    const posts = await this.aggregateContent(userId, platformId, {
      sources: ['trending'],
      limit: limit * 2,
    });

    // 处理内容
    const items = await this.processPosts(posts, userId, platformId, {
      ...options,
      limit,
    });

    // 添加推荐原因
    for (const item of items) {
      item.reason = { type: 'recommended', description: '为你推荐' };
    }

    // 缓存结果
    const cacheKey = this.cache.generateKey(userId, platformId, 'discover', options);
    this.cache.set(cacheKey, items, 'discover');

    return this.buildResult(items, 'discover', platformId, false, startTime);
  }

  /**
   * 获取分类信息流
   */
  async getCategoryFeed(
    platformId: string,
    options: CategoryFeedOptions
  ): Promise<FeedResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || this.config.defaultLimit!, this.config.maxLimit!);
    const userId = '__category__';

    // 检查缓存
    if (!options.forceRefresh) {
      const cacheKey = this.cache.generateKey(
        `${userId}_${options.category}`,
        platformId,
        'category',
        options
      );
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return this.buildResult(cached, 'category', platformId, true, startTime);
      }
    }

    // 获取分类帖子
    const posts = await this.getCategoryPosts(platformId, options.category, limit * 2);

    // 处理内容
    const items = await this.processPosts(posts, userId, platformId, {
      ...options,
      limit,
    });

    // 缓存结果
    const cacheKey = this.cache.generateKey(
      `${userId}_${options.category}`,
      platformId,
      'category',
      options
    );
    this.cache.set(cacheKey, items, 'category');

    return this.buildResult(items, 'category', platformId, false, startTime);
  }

  /**
   * 获取话题信息流
   */
  async getTopicFeed(
    platformId: string,
    options: TopicFeedOptions
  ): Promise<FeedResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || this.config.defaultLimit!, this.config.maxLimit!);
    const userId = '__topic__';
    const topicId = options.topicId || options.keyword || '';

    // 检查缓存
    if (!options.forceRefresh) {
      const cacheKey = this.cache.generateKey(
        `${userId}_${topicId}`,
        platformId,
        'topic',
        options
      );
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return this.buildResult(cached, 'topic', platformId, true, startTime);
      }
    }

    // 获取话题帖子
    const posts = await this.getTopicPosts(platformId, topicId, limit * 2);

    // 处理内容
    const items = await this.processPosts(posts, userId, platformId, {
      ...options,
      limit,
    });

    // 缓存结果
    const cacheKey = this.cache.generateKey(
      `${userId}_${topicId}`,
      platformId,
      'topic',
      options
    );
    this.cache.set(cacheKey, items, 'topic');

    return this.buildResult(items, 'topic', platformId, false, startTime);
  }

  // ==========================================
  // 刷新与分页
  // ==========================================

  /**
   * 刷新信息流
   */
  async refreshFeed(
    userId: string,
    platformId: string,
    feedType: FeedType = 'home'
  ): Promise<FeedResult> {
    // 使缓存失效
    this.cache.invalidateUser(userId, platformId);

    // 重新获取
    switch (feedType) {
      case 'home':
        return this.getPersonalizedFeed(userId, platformId, { forceRefresh: true });
      case 'following':
        return this.getFollowingFeed(userId, platformId, { forceRefresh: true });
      case 'trending':
        return this.getTrendingContent(platformId, { forceRefresh: true });
      case 'discover':
        return this.getDiscoverContent(userId, platformId, { forceRefresh: true });
      default:
        return this.getPersonalizedFeed(userId, platformId, { forceRefresh: true });
    }
  }

  /**
   * 加载更多
   */
  async loadMore(
    userId: string,
    platformId: string,
    cursor: string
  ): Promise<FeedResult> {
    // 解析游标
    const cursorData = this.parseCursor(cursor);
    if (!cursorData) {
      return this.buildEmptyResult('home', platformId);
    }

    const { feedType, offset, limit } = cursorData;

    // 根据类型获取更多内容
    switch (feedType) {
      case 'home':
        return this.getPersonalizedFeed(userId, platformId, { offset, limit });
      case 'following':
        return this.getFollowingFeed(userId, platformId, { offset, limit });
      case 'trending':
        return this.getTrendingContent(platformId, { offset, limit });
      default:
        return this.getPersonalizedFeed(userId, platformId, { offset, limit });
    }
  }

  /**
   * 预加载下一页
   */
  async preloadNextPage(
    userId: string,
    platformId: string,
    options: { currentOffset: number }
  ): Promise<void> {
    const nextOffset = options.currentOffset + (this.config.defaultLimit || 20);
    const cacheKey = this.cache.generateKey(userId, platformId, 'home', {
      offset: nextOffset,
    });

    // 如果已缓存，跳过
    if (this.cache.has(cacheKey)) {
      return;
    }

    // 后台预加载
    try {
      await this.getPersonalizedFeed(userId, platformId, {
        offset: nextOffset,
        limit: this.config.defaultLimit,
      });
    } catch (error) {
      // 预加载失败不影响体验
      loggerService.warn('FeedService', 'Preload failed:', error);
    }
  }

  // ==========================================
  // 算法配置
  // ==========================================

  /**
   * 注册平台算法配置
   */
  registerAlgorithm(platformId: string, config: AlgorithmConfig): void {
    this.algorithmRegistry.register(platformId, config);
    // 初始化该平台的内置过滤器
    this.filterChain.initBuiltinFilters(platformId);
  }

  /**
   * 获取算法配置
   */
  getAlgorithmConfig(platformId: string): AlgorithmConfig | undefined {
    if (!this.algorithmRegistry.has(platformId)) {
      return undefined;
    }
    return this.algorithmRegistry.get(platformId);
  }

  /**
   * 更新算法权重
   */
  updateAlgorithmWeights(platformId: string, weights: Partial<AlgorithmWeights>): void {
    this.algorithmRegistry.updateWeights(platformId, weights);
  }

  // ==========================================
  // 过滤器
  // ==========================================

  /**
   * 添加内容过滤器
   */
  addFilter(
    platformId: string,
    filter: FeedFilter,
    options?: { id?: string; name?: string; priority?: number }
  ): string {
    return this.filterChain.add(platformId, filter, options);
  }

  /**
   * 移除过滤器
   */
  removeFilter(platformId: string, filterId: string): boolean {
    return this.filterChain.remove(platformId, filterId);
  }

  /**
   * 清除所有过滤器
   */
  clearFilters(platformId: string): void {
    this.filterChain.clear(platformId);
  }

  /**
   * 启用/禁用预置过滤器
   */
  toggleBuiltinFilter(
    platformId: string,
    filterType: BuiltinFilterType,
    enabled: boolean
  ): void {
    this.filterChain.toggleBuiltinFilter(platformId, filterType, enabled);
  }

  // ==========================================
  // 缓存管理
  // ==========================================

  /**
   * 使缓存失效
   */
  invalidateCache(userId: string, platformId: string, feedType?: FeedType): void {
    if (feedType) {
      const cacheKey = this.cache.generateKey(userId, platformId, feedType);
      this.cache.invalidate(cacheKey);
    } else {
      this.cache.invalidateUser(userId, platformId);
    }
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): FeedCacheStats {
    return this.cache.getStats();
  }

  // ==========================================
  // 事件订阅
  // ==========================================

  /**
   * 订阅信息流事件
   */
  onFeedEvent(callback: (event: FeedEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  // ==========================================
  // 私有方法
  // ==========================================

  /**
   * 聚合内容
   */
  private async aggregateContent(
    userId: string,
    platformId: string,
    options: {
      sources: ('following' | 'trending' | 'topic' | 'category')[];
      limit: number;
    }
  ): Promise<UniversalPost[]> {
    const results: UniversalPost[] = [];

    for (const source of options.sources) {
      let posts: UniversalPost[] = [];

      switch (source) {
        case 'following':
          posts = await this.getFollowingPosts(userId, platformId, options.limit);
          break;
        case 'trending':
          posts = await this.getTrendingPosts(platformId, options.limit);
          break;
      }

      results.push(...posts);
    }

    // 去重
    const seen = new Set<string>();
    return results.filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  }

  /**
   * 处理帖子列表
   */
  private async processPosts(
    posts: UniversalPost[],
    userId: string,
    platformId: string,
    options: FeedOptions & {
      sortByTime?: boolean;
      sortByEngagement?: boolean;
    }
  ): Promise<FeedItem[]> {
    if (posts.length === 0) return [];

    const config = this.algorithmRegistry.get(platformId);
    const limit = options.limit || this.config.defaultLimit!;
    const offset = options.offset || 0;

    // 1. 应用过滤器
    const { filtered, appliedFilters } = this.filterChain.apply(platformId, posts);

    // 2. 计算分数
    const context = await this.buildScoreContext(userId, platformId);
    const scores = this.scoreCalculator.calculateBatch(filtered, config, context);

    // 3. 转换为 FeedItem
    let items: FeedItem[] = filtered.map((post, index) => {
      const scoreComponents = scores.get(post.id)!;
      return {
        id: generateFeedItemId(),
        post,
        score: scoreComponents.total,
        position: index,
        insertedAt: Date.now(),
      };
    });

    // 4. 排序
    if (options.sortByTime) {
      items.sort((a, b) => b.post.timestamp - a.post.timestamp);
    } else if (options.sortByEngagement) {
      items.sort((a, b) => {
        const aEngagement = a.post.stats.likes + a.post.stats.comments * 2 + a.post.stats.shares * 3;
        const bEngagement = b.post.stats.likes + b.post.stats.comments * 2 + b.post.stats.shares * 3;
        return bEngagement - aEngagement;
      });
    } else {
      items.sort((a, b) => b.score - a.score);
    }

    // 5. 应用多样性控制
    if (config.diversityRules) {
      items = this.diversityController.smartSort(items, config.diversityRules);
    }

    // 6. 分页
    items = items.slice(offset, offset + limit);

    // 7. 更新位置
    items.forEach((item, index) => {
      item.position = offset + index;
    });

    return items;
  }

  /**
   * 构建评分上下文
   */
  private async buildScoreContext(userId: string, platformId: string): Promise<ScoreContext> {
    let followingIds: string[] = [];
    let interactedIds: string[] = [];
    let interestTags: string[] = [];

    if (this.contentProvider) {
      [followingIds, interactedIds, interestTags] = await Promise.all([
        this.contentProvider.getFollowingIds(userId, platformId),
        this.contentProvider.getInteractedIds(userId, platformId),
        this.contentProvider.getInterestTags(userId, platformId),
      ]);
    }

    return ScoreCalculator.createContext({
      userId,
      followingIds,
      interactedIds,
      interestTags,
      now: Date.now(),
      maxEngagement: 10000,
      maxHeat: 100,
    });
  }

  /**
   * 获取关注用户的帖子
   */
  private async getFollowingPosts(
    userId: string,
    platformId: string,
    limit: number
  ): Promise<UniversalPost[]> {
    if (this.contentProvider) {
      return this.contentProvider.getFollowingPosts(userId, platformId, limit);
    }
    return [];
  }

  /**
   * 获取热门帖子
   */
  private async getTrendingPosts(
    platformId: string,
    limit: number,
    category?: string
  ): Promise<UniversalPost[]> {
    if (this.contentProvider) {
      return this.contentProvider.getTrendingPosts(platformId, limit, category);
    }
    return [];
  }

  /**
   * 获取话题帖子
   */
  private async getTopicPosts(
    platformId: string,
    topicId: string,
    limit: number
  ): Promise<UniversalPost[]> {
    if (this.contentProvider) {
      return this.contentProvider.getTopicPosts(platformId, topicId, limit);
    }
    return [];
  }

  /**
   * 获取分类帖子
   */
  private async getCategoryPosts(
    platformId: string,
    category: string,
    limit: number
  ): Promise<UniversalPost[]> {
    if (this.contentProvider) {
      return this.contentProvider.getCategoryPosts(platformId, category, limit);
    }
    return [];
  }

  /**
   * 构建结果
   */
  private buildResult(
    items: FeedItem[],
    feedType: FeedType,
    platformId: string,
    fromCache: boolean,
    startTime: number
  ): FeedResult {
    const hasMore = items.length >= (this.config.defaultLimit || 20);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore
      ? this.buildCursor(feedType, lastItem?.position || 0, this.config.defaultLimit || 20)
      : undefined;

    const result: FeedResult = {
      items,
      hasMore,
      nextCursor,
      feedType,
      platformId,
      generatedAt: Date.now(),
      fromCache,
    };

    if (this.config.debug) {
      result.debug = {
        processingTime: Date.now() - startTime,
        candidateCount: items.length,
      };
    }

    return result;
  }

  /**
   * 构建空结果
   */
  private buildEmptyResult(feedType: FeedType, platformId: string): FeedResult {
    return {
      items: [],
      hasMore: false,
      feedType,
      platformId,
      generatedAt: Date.now(),
    };
  }

  /**
   * 构建游标
   */
  private buildCursor(feedType: FeedType, offset: number, limit: number): string {
    return Buffer.from(
      JSON.stringify({ feedType, offset: offset + limit, limit })
    ).toString('base64');
  }

  /**
   * 解析游标
   */
  private parseCursor(
    cursor: string
  ): { feedType: FeedType; offset: number; limit: number } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * 发送事件
   */
  private emitEvent(
    type: FeedEventType,
    userId: string,
    platformId: string,
    feedType: FeedType,
    data?: Record<string, unknown>
  ): void {
    const event: FeedEvent = {
      type,
      userId,
      platformId,
      feedType,
      timestamp: Date.now(),
      data,
    };

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        loggerService.error('FeedService', 'Event listener error:', error);
      }
    }
  }
}

/**
 * 默认的 FeedService 实例
 */
let feedServiceInstance: FeedService | null = null;

/**
 * 获取 FeedService 单例
 */
export function getFeedService(): FeedService {
  if (!feedServiceInstance) {
    feedServiceInstance = new FeedService();
  }
  return feedServiceInstance;
}

/**
 * 重置 FeedService 单例（用于测试）
 */
export function resetFeedService(): void {
  feedServiceInstance = null;
}
