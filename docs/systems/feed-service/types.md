# Feed Service 类型定义

> **版本**: v1.0  
> **最后更新**: 2025-01-19

本文档定义了 Feed Service 使用的所有 TypeScript 类型。

---

## 核心类型

### FeedType

信息流类型枚举。

```typescript
/**
 * 信息流类型
 */
export type FeedType =
  | 'home'        // 首页综合流（个性化推荐）
  | 'following'   // 关注流（只看关注的人）
  | 'trending'    // 热门流（热度排序）
  | 'discover'    // 发现流（探索新内容）
  | 'category'    // 分类流（按分类筛选）
  | 'topic'       // 话题流（按话题筛选）
  | 'search'      // 搜索结果流
  | 'user'        // 用户主页流
```

### FeedItem

信息流中的单个项目。

```typescript
/**
 * 信息流项
 */
export interface FeedItem {
  /** 信息流项的唯一 ID */
  id: string
  
  /** 帖子内容 */
  post: UniversalPost
  
  /** 推荐原因（可选） */
  reason?: FeedReason
  
  /** 排序分数（内部使用） */
  score: number
  
  /** 在信息流中的位置（0-based） */
  position: number
  
  /** 插入到信息流的时间戳 */
  insertedAt: number
  
  /** 是否已读 */
  isRead?: boolean
  
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}
```

### FeedReason

内容出现在信息流中的原因。

```typescript
/**
 * 推荐原因
 */
export interface FeedReason {
  /** 原因类型 */
  type: FeedReasonType
  
  /** 人类可读的描述 */
  description?: string
  
  /** 相关实体 ID（如关注的用户 ID） */
  relatedEntity?: string
  
  /** 相关实体名称 */
  relatedEntityName?: string
}

/**
 * 推荐原因类型
 */
export type FeedReasonType =
  | 'following'     // 因为你关注了某人
  | 'trending'      // 热门内容
  | 'similar'       // 与你看过的内容相似
  | 'recommended'   // 算法推荐
  | 'topic'         // 来自你关注的话题
  | 'interaction'   // 你互动过的账号
  | 'new'           // 新发布的内容
  | 'sponsored'     // 推广内容
```

---

## 请求参数类型

### FeedOptions

获取信息流的通用选项。

```typescript
/**
 * 信息流请求选项
 */
export interface FeedOptions {
  /** 返回数量限制 */
  limit?: number
  
  /** 偏移量（用于分页） */
  offset?: number
  
  /** 游标（用于游标分页） */
  cursor?: string
  
  /** 排除的帖子 ID 列表 */
  excludeIds?: string[]
  
  /** 排除的作者 ID 列表 */
  excludeAuthors?: string[]
  
  /** 时间范围 */
  timeRange?: TimeRange
  
  /** 是否包含已读内容 */
  includeRead?: boolean
  
  /** 是否强制刷新（跳过缓存） */
  forceRefresh?: boolean
}

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间（时间戳） */
  start?: number
  
  /** 结束时间（时间戳） */
  end?: number
}
```

### CategoryFeedOptions

分类信息流的特定选项。

```typescript
/**
 * 分类信息流选项
 */
export interface CategoryFeedOptions extends FeedOptions {
  /** 分类名称 */
  category: string
  
  /** 子分类（可选） */
  subCategory?: string
}
```

### TopicFeedOptions

话题信息流的特定选项。

```typescript
/**
 * 话题信息流选项
 */
export interface TopicFeedOptions extends FeedOptions {
  /** 话题 ID */
  topicId?: string
  
  /** 话题关键词 */
  keyword?: string
}
```

### TrendingOptions

热门内容的请求选项。

```typescript
/**
 * 热门内容选项
 */
export interface TrendingOptions extends FeedOptions {
  /** 分类筛选 */
  category?: string
  
  /** 时间窗口（小时） */
  timeWindow?: number
  
  /** 最低互动量阈值 */
  minEngagement?: number
}
```

---

## 响应类型

### FeedResult

信息流请求的返回结果。

```typescript
/**
 * 信息流结果
 */
export interface FeedResult {
  /** 信息流项列表 */
  items: FeedItem[]
  
  /** 是否还有更多内容 */
  hasMore: boolean
  
  /** 下一页游标 */
  nextCursor?: string
  
  /** 总数量（如果可知） */
  total?: number
  
  /** 信息流类型 */
  feedType: FeedType
  
  /** 平台 ID */
  platformId: string
  
  /** 生成时间 */
  generatedAt: number
  
  /** 是否来自缓存 */
  fromCache?: boolean
  
  /** 调试信息（开发模式） */
  debug?: FeedDebugInfo
}

/**
 * 调试信息
 */
export interface FeedDebugInfo {
  /** 算法配置 */
  algorithm?: string
  
  /** 处理耗时（毫秒） */
  processingTime?: number
  
  /** 候选内容数量 */
  candidateCount?: number
  
  /** 过滤后数量 */
  afterFilterCount?: number
  
  /** 应用的过滤器 */
  appliedFilters?: string[]
}
```

---

## 算法配置类型

### AlgorithmConfig

平台算法配置。

```typescript
/**
 * 算法配置
 */
export interface AlgorithmConfig {
  /** 权重配置 */
  weights: AlgorithmWeights
  
  /** 热度衰减半衰期（小时） */
  decayHalfLife: number
  
  /** 多样性规则 */
  diversityRules?: DiversityRules
  
  /** 平台特定规则 */
  platformRules?: Record<string, unknown>
  
  /** 是否启用个性化 */
  enablePersonalization?: boolean
  
  /** 冷启动策略 */
  coldStartStrategy?: ColdStartStrategy
}

/**
 * 算法权重
 */
export interface AlgorithmWeights {
  /** 时效性权重 (0-1) */
  recency: number
  
  /** 互动量权重 (0-1) */
  engagement: number
  
  /** 相关性权重 (0-1) */
  relevance: number
  
  /** 社交因素权重 (0-1) */
  social: number
}

/**
 * 多样性规则
 */
export interface DiversityRules {
  /** 同一作者最多显示几条 */
  maxSameAuthor?: number
  
  /** 同一分类最多显示几条 */
  maxSameCategory?: number
  
  /** 同一话题最多显示几条 */
  maxSameTopic?: number
  
  /** 连续相同类型的最大数量 */
  maxConsecutiveSameType?: number
}

/**
 * 冷启动策略
 */
export type ColdStartStrategy =
  | 'trending'      // 展示热门内容
  | 'diverse'       // 展示多样化内容
  | 'curated'       // 展示编辑精选
  | 'random'        // 随机展示
```

---

## 过滤器类型

### FeedFilter

内容过滤器函数类型。

```typescript
/**
 * 信息流过滤器
 */
export type FeedFilter = (post: UniversalPost) => boolean

/**
 * 带优先级的过滤器
 */
export interface PrioritizedFilter {
  /** 过滤器 ID */
  id: string
  
  /** 过滤器名称（用于调试） */
  name: string
  
  /** 优先级（数字越小越先执行） */
  priority: number
  
  /** 过滤函数 */
  filter: FeedFilter
  
  /** 是否启用 */
  enabled: boolean
}
```

### 预置过滤器

```typescript
/**
 * 预置过滤器类型
 */
export type BuiltinFilterType =
  | 'hideAds'           // 隐藏广告
  | 'hideReposts'       // 隐藏转发
  | 'hideBlocked'       // 隐藏已屏蔽用户
  | 'hideMuted'         // 隐藏已静音用户
  | 'hideRead'          // 隐藏已读内容
  | 'onlyFollowing'     // 只看关注
  | 'onlyOriginal'      // 只看原创
  | 'onlyWithMedia'     // 只看有图/视频
```

---

## 缓存类型

### FeedCacheEntry

缓存条目。

```typescript
/**
 * 信息流缓存条目
 */
export interface FeedCacheEntry {
  /** 缓存键 */
  key: string
  
  /** 信息流项列表 */
  items: FeedItem[]
  
  /** 创建时间 */
  createdAt: number
  
  /** 过期时间 */
  expiresAt: number
  
  /** 版本号 */
  version: number
}

/**
 * 缓存配置
 */
export interface FeedCacheConfig {
  /** 最大缓存条目数 */
  maxEntries: number
  
  /** 默认 TTL（毫秒） */
  defaultTTL: number
  
  /** 各类型的 TTL 覆盖 */
  ttlOverrides?: Partial<Record<FeedType, number>>
}

/**
 * 缓存统计
 */
export interface FeedCacheStats {
  /** 缓存命中次数 */
  hits: number
  
  /** 缓存未命中次数 */
  misses: number
  
  /** 当前缓存大小 */
  size: number
  
  /** 命中率 */
  hitRate: number
}
```

---

## 分数计算类型

### ScoreComponents

分数的各个组成部分。

```typescript
/**
 * 分数组成
 */
export interface ScoreComponents {
  /** 时效性分数 (0-1) */
  recency: number
  
  /** 互动量分数 (0-1) */
  engagement: number
  
  /** 相关性分数 (0-1) */
  relevance: number
  
  /** 社交分数 (0-1) */
  social: number
  
  /** 加权后的总分 */
  total: number
}

/**
 * 分数计算上下文
 */
export interface ScoreContext {
  /** 用户 ID */
  userId: string
  
  /** 用户关注的账号列表 */
  followingIds: string[]
  
  /** 用户互动过的账号列表 */
  interactedIds: string[]
  
  /** 用户兴趣标签 */
  interestTags: string[]
  
  /** 当前时间戳 */
  now: number
  
  /** 归一化参数 */
  normalization: NormalizationParams
}

/**
 * 归一化参数
 */
export interface NormalizationParams {
  /** 最大互动量（用于归一化） */
  maxEngagement: number
  
  /** 最大热度值 */
  maxHeat: number
}
```

---

## 事件类型

### FeedEvent

信息流相关事件。

```typescript
/**
 * 信息流事件
 */
export interface FeedEvent {
  /** 事件类型 */
  type: FeedEventType
  
  /** 用户 ID */
  userId: string
  
  /** 平台 ID */
  platformId: string
  
  /** 信息流类型 */
  feedType: FeedType
  
  /** 时间戳 */
  timestamp: number
  
  /** 事件数据 */
  data?: Record<string, unknown>
}

/**
 * 信息流事件类型
 */
export type FeedEventType =
  | 'feed:loaded'       // 信息流加载完成
  | 'feed:refreshed'    // 信息流刷新
  | 'feed:loadMore'     // 加载更多
  | 'feed:itemRead'     // 内容已读
  | 'feed:itemHidden'   // 内容被隐藏
  | 'feed:cacheHit'     // 缓存命中
  | 'feed:cacheMiss'    // 缓存未命中
```

---

## 服务接口

### IFeedService

Feed Service 的完整接口定义。

```typescript
/**
 * 信息流服务接口
 */
export interface IFeedService {
  // === 信息流获取 ===
  
  /**
   * 获取个性化首页信息流
   */
  getPersonalizedFeed(
    userId: string,
    platformId: string,
    options?: FeedOptions
  ): Promise<FeedResult>
  
  /**
   * 获取关注流
   */
  getFollowingFeed(
    userId: string,
    platformId: string,
    options?: FeedOptions
  ): Promise<FeedResult>
  
  /**
   * 获取热门内容
   */
  getTrendingContent(
    platformId: string,
    options?: TrendingOptions
  ): Promise<FeedResult>
  
  /**
   * 获取发现页内容
   */
  getDiscoverContent(
    userId: string,
    platformId: string,
    options?: FeedOptions
  ): Promise<FeedResult>
  
  /**
   * 获取分类信息流
   */
  getCategoryFeed(
    platformId: string,
    options: CategoryFeedOptions
  ): Promise<FeedResult>
  
  /**
   * 获取话题信息流
   */
  getTopicFeed(
    platformId: string,
    options: TopicFeedOptions
  ): Promise<FeedResult>
  
  // === 刷新与分页 ===
  
  /**
   * 刷新信息流
   */
  refreshFeed(
    userId: string,
    platformId: string,
    feedType?: FeedType
  ): Promise<FeedResult>
  
  /**
   * 加载更多
   */
  loadMore(
    userId: string,
    platformId: string,
    cursor: string
  ): Promise<FeedResult>
  
  /**
   * 预加载下一页
   */
  preloadNextPage(
    userId: string,
    platformId: string,
    options: { currentOffset: number }
  ): Promise<void>
  
  // === 算法配置 ===
  
  /**
   * 注册平台算法配置
   */
  registerAlgorithm(
    platformId: string,
    config: AlgorithmConfig
  ): void
  
  /**
   * 获取算法配置
   */
  getAlgorithmConfig(platformId: string): AlgorithmConfig | undefined
  
  /**
   * 更新算法权重
   */
  updateAlgorithmWeights(
    platformId: string,
    weights: Partial<AlgorithmWeights>
  ): void
  
  // === 过滤器 ===
  
  /**
   * 添加内容过滤器
   */
  addFilter(
    platformId: string,
    filter: FeedFilter,
    options?: { id?: string; priority?: number }
  ): string
  
  /**
   * 移除过滤器
   */
  removeFilter(platformId: string, filterId: string): boolean
  
  /**
   * 清除所有过滤器
   */
  clearFilters(platformId: string): void
  
  /**
   * 启用/禁用预置过滤器
   */
  toggleBuiltinFilter(
    platformId: string,
    filterType: BuiltinFilterType,
    enabled: boolean
  ): void
  
  // === 缓存管理 ===
  
  /**
   * 使缓存失效
   */
  invalidateCache(
    userId: string,
    platformId: string,
    feedType?: FeedType
  ): void
  
  /**
   * 清除所有缓存
   */
  clearCache(): void
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): FeedCacheStats
  
  // === 事件订阅 ===
  
  /**
   * 订阅信息流事件
   */
  onFeedEvent(callback: (event: FeedEvent) => void): () => void
}
```

---

## 类型导出

```typescript
// src/types/feed.ts

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
  
  // 服务接口
  IFeedService,
}
```

---

## 参考

- [README](./README.md) - Feed Service 概述
- [架构设计](./architecture.md) - 服务架构
- [使用示例](./usage.md) - 代码示例
- [统一内容模型](../已完成的/social-content-types.md) - UniversalPost 类型定义
