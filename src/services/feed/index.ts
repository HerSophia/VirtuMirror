/**
 * Feed Service 模块入口
 *
 * 信息流服务负责将来自不同来源的内容聚合、排序，
 * 并根据用户偏好和算法规则生成个性化的信息流。
 *
 * @example
 * ```typescript
 * import { feedService, getFeedService } from '@/services/feed';
 *
 * // 获取个性化信息流
 * const feed = await feedService.getPersonalizedFeed(userId, 'weibo', {
 *   limit: 20,
 * });
 *
 * // 注册平台算法
 * feedService.registerAlgorithm('weibo', {
 *   weights: {
 *     recency: 0.3,
 *     engagement: 0.4,
 *     relevance: 0.2,
 *     social: 0.1,
 *   },
 *   decayHalfLife: 6,
 * });
 *
 * // 添加自定义过滤器
 * feedService.addFilter('weibo', (post) => {
 *   return !post.platformData?.isAd;
 * });
 * ```
 */

// 导出核心服务
export { FeedService, getFeedService, resetFeedService } from './FeedService';
export type { FeedServiceConfig, ContentProvider } from './FeedService';

// 导出组件
export { AlgorithmRegistry, algorithmRegistry, DEFAULT_ALGORITHM_CONFIG } from './AlgorithmRegistry';
export { ScoreCalculator, scoreCalculator } from './ScoreCalculator';
export { DiversityController, diversityController, DEFAULT_DIVERSITY_RULES } from './DiversityController';
export { FilterChain, filterChain } from './FilterChain';
export { FeedCache, feedCache, DEFAULT_CACHE_CONFIG } from './FeedCache';

// 导出类型（从 types/feed.ts 重新导出）
export type {
  // 核心类型
  FeedType,
  FeedItem,
  FeedReason,
  FeedReasonType,
  // 请求参数
  FeedOptions,
  TimeRange,
  CategoryFeedOptions,
  TopicFeedOptions,
  TrendingOptions,
  // 响应类型
  FeedResult,
  FeedDebugInfo,
  // 算法配置
  AlgorithmConfig,
  AlgorithmWeights,
  DiversityRules,
  ColdStartStrategy,
  // 过滤器
  FeedFilter,
  PrioritizedFilter,
  BuiltinFilterType,
  // 缓存
  FeedCacheEntry,
  FeedCacheConfig,
  FeedCacheStats,
  // 分数计算
  ScoreComponents,
  ScoreContext,
  NormalizationParams,
  // 事件
  FeedEvent,
  FeedEventType,
  // 内容来源
  ContentSource,
  ContentSourceType,
  AggregateOptions,
  // 服务接口
  IFeedService,
} from '@/types/feed';

// 便捷访问：默认实例
import { getFeedService } from './FeedService';

/**
 * 默认的 FeedService 实例
 * @example
 * ```typescript
 * import { feedService } from '@/services/feed';
 * const feed = await feedService.getPersonalizedFeed(userId, 'weibo');
 * ```
 */
export const feedService = getFeedService();
