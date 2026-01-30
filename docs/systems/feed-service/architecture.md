# Feed Service 架构设计

> **版本**: v1.0  
> **最后更新**: 2025-01-19

本文档描述 Feed Service 的分层架构、核心组件和数据流。

---

## 整体架构

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           应用层 (Apps)                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │  微博   │  │  B站    │  │  知乎   │  │  抖音   │  ...                │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                     │
└───────┼────────────┼────────────┼────────────┼──────────────────────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Feed Service                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     FeedService (核心服务)                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ FeedAggregator│ │ScoreCalculator│ │DiversityCtrl │              │ │
│  │  │  (聚合器)     │  │  (分数计算)   │  │  (多样性)    │              │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ FilterChain  │  │  FeedCache   │  │AlgorithmReg  │              │ │
│  │  │  (过滤器链)   │  │   (缓存)     │  │  (算法注册)  │              │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Social Media│ │ Interaction │ │  Account    │ │   Trend     │
│   Engine    │ │   Service   │ │  Service    │ │  Service    │
│  (内容源)    │ │  (互动数据) │ │  (关注关系) │ │  (热搜数据) │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 核心组件

### 1. FeedService

核心服务类，作为统一入口，协调各组件工作。

```typescript
export class FeedService implements IFeedService {
  private aggregator: FeedAggregator
  private scoreCalculator: ScoreCalculator
  private diversityController: DiversityController
  private filterChain: FilterChain
  private cache: FeedCache
  private algorithmRegistry: AlgorithmRegistry
  
  constructor(
    private socialEngine: SocialMediaEngine,
    private interactionService: InteractionService,
    private accountService: AccountService,
    private trendService: TrendService
  ) {
    this.aggregator = new FeedAggregator(socialEngine)
    this.scoreCalculator = new ScoreCalculator()
    this.diversityController = new DiversityController()
    this.filterChain = new FilterChain()
    this.cache = new FeedCache()
    this.algorithmRegistry = new AlgorithmRegistry()
  }
}
```

**职责**：
- 接收来自 App 的信息流请求
- 协调各组件完成内容聚合、评分、过滤、排序
- 管理缓存策略
- 触发信息流事件

---

### 2. FeedAggregator

内容聚合器，负责从各种来源收集内容。

```typescript
export class FeedAggregator {
  constructor(private socialEngine: SocialMediaEngine) {}
  
  /**
   * 聚合内容
   */
  async aggregate(
    sources: ContentSource[],
    options: AggregateOptions
  ): Promise<UniversalPost[]> {
    const results: UniversalPost[] = []
    
    for (const source of sources) {
      const posts = await this.fetchFromSource(source, options)
      results.push(...posts)
    }
    
    return results
  }
  
  /**
   * 从单个来源获取内容
   */
  private async fetchFromSource(
    source: ContentSource,
    options: AggregateOptions
  ): Promise<UniversalPost[]> {
    switch (source.type) {
      case 'following':
        return this.fetchFollowingPosts(source.userIds, options)
      case 'trending':
        return this.fetchTrendingPosts(source.platformId, options)
      case 'topic':
        return this.fetchTopicPosts(source.topicId, options)
      case 'category':
        return this.fetchCategoryPosts(source.category, options)
      default:
        return []
    }
  }
}

interface ContentSource {
  type: 'following' | 'trending' | 'topic' | 'category' | 'user'
  platformId: string
  userIds?: string[]
  topicId?: string
  category?: string
}
```

**职责**：
- 从社交引擎获取内容
- 支持多种内容来源（关注、热门、话题、分类）
- 合并去重

---

### 3. ScoreCalculator

分数计算器，根据算法配置计算内容排序分数。

```typescript
export class ScoreCalculator {
  /**
   * 计算帖子的排序分数
   */
  calculate(
    post: UniversalPost,
    config: AlgorithmConfig,
    context: ScoreContext
  ): ScoreComponents {
    const { weights, decayHalfLife } = config
    
    // 时效性分数
    const ageInHours = (context.now - post.timestamp) / (1000 * 60 * 60)
    const recency = Math.exp(-ageInHours / (decayHalfLife * Math.LOG2E))
    
    // 互动量分数
    const { likes, comments, reposts, views } = post.stats
    const engagementRaw = likes + comments * 2 + reposts * 3
    const engagement = Math.log(1 + engagementRaw) / 
                       Math.log(1 + context.normalization.maxEngagement)
    
    // 相关性分数
    const relevance = this.calculateRelevance(
      post.topicTags,
      context.interestTags
    )
    
    // 社交分数
    const social = this.calculateSocialScore(
      post.authorId,
      context.followingIds,
      context.interactedIds
    )
    
    // 加权总分
    const total = 
      weights.recency * recency +
      weights.engagement * engagement +
      weights.relevance * relevance +
      weights.social * social
    
    return { recency, engagement, relevance, social, total }
  }
  
  /**
   * 计算相关性分数
   */
  private calculateRelevance(
    postTags: string[],
    userTags: string[]
  ): number {
    if (userTags.length === 0) return 0.5 // 无偏好时返回中性分数
    
    const matchCount = postTags.filter(t => userTags.includes(t)).length
    return matchCount / Math.max(postTags.length, 1)
  }
  
  /**
   * 计算社交分数
   */
  private calculateSocialScore(
    authorId: string,
    followingIds: string[],
    interactedIds: string[]
  ): number {
    let score = 0
    if (followingIds.includes(authorId)) score += 0.5
    if (interactedIds.includes(authorId)) score += 0.5
    return score
  }
}
```

**职责**：
- 计算时效性、互动量、相关性、社交四个维度的分数
- 根据权重配置计算加权总分
- 支持自定义归一化参数

---

### 4. DiversityController

多样性控制器，避免信息流内容同质化。

```typescript
export class DiversityController {
  /**
   * 应用多样性规则
   */
  apply(
    items: FeedItem[],
    rules: DiversityRules
  ): FeedItem[] {
    const result: FeedItem[] = []
    const counters = {
      author: new Map<string, number>(),
      category: new Map<string, number>(),
      topic: new Map<string, number>(),
    }
    
    for (const item of items) {
      // 检查作者限制
      const authorCount = counters.author.get(item.post.authorId) || 0
      if (rules.maxSameAuthor && authorCount >= rules.maxSameAuthor) {
        continue
      }
      
      // 检查分类限制
      const category = item.post.platformData?.category as string
      const categoryCount = counters.category.get(category) || 0
      if (rules.maxSameCategory && categoryCount >= rules.maxSameCategory) {
        continue
      }
      
      // 检查话题限制
      for (const topic of item.post.topicTags) {
        const topicCount = counters.topic.get(topic) || 0
        if (rules.maxSameTopic && topicCount >= rules.maxSameTopic) {
          continue
        }
      }
      
      // 通过检查，加入结果
      result.push(item)
      
      // 更新计数器
      counters.author.set(item.post.authorId, authorCount + 1)
      if (category) {
        counters.category.set(category, categoryCount + 1)
      }
      for (const topic of item.post.topicTags) {
        const count = counters.topic.get(topic) || 0
        counters.topic.set(topic, count + 1)
      }
    }
    
    return result
  }
}
```

**职责**：
- 限制同一作者的内容数量
- 限制同一分类/话题的内容数量
- 避免连续相同类型内容

---

### 5. FilterChain

过滤器链，支持多个过滤器按优先级执行。

```typescript
export class FilterChain {
  private filters: Map<string, PrioritizedFilter[]> = new Map()
  
  /**
   * 添加过滤器
   */
  add(
    platformId: string,
    filter: PrioritizedFilter
  ): void {
    const list = this.filters.get(platformId) || []
    list.push(filter)
    list.sort((a, b) => a.priority - b.priority)
    this.filters.set(platformId, list)
  }
  
  /**
   * 应用过滤器链
   */
  apply(
    platformId: string,
    posts: UniversalPost[]
  ): { filtered: UniversalPost[]; appliedFilters: string[] } {
    const filters = this.filters.get(platformId) || []
    const enabledFilters = filters.filter(f => f.enabled)
    const appliedFilters: string[] = []
    
    let result = posts
    for (const filter of enabledFilters) {
      const before = result.length
      result = result.filter(filter.filter)
      if (result.length !== before) {
        appliedFilters.push(filter.name)
      }
    }
    
    return { filtered: result, appliedFilters }
  }
  
  /**
   * 移除过滤器
   */
  remove(platformId: string, filterId: string): boolean {
    const list = this.filters.get(platformId)
    if (!list) return false
    
    const index = list.findIndex(f => f.id === filterId)
    if (index === -1) return false
    
    list.splice(index, 1)
    return true
  }
}
```

**职责**：
- 管理平台级别的过滤器
- 按优先级顺序执行过滤器
- 支持动态添加/移除过滤器

---

### 6. FeedCache

信息流缓存，基于 Lazy Loader 服务实现。

```typescript
import { createLazyLoader, type LazyLoader } from '@/services/lazyLoader'

export class FeedCache {
  private loaders: Map<string, LazyLoader<FeedItem[]>> = new Map()
  private config: FeedCacheConfig
  
  constructor(config?: Partial<FeedCacheConfig>) {
    this.config = {
      maxEntries: 100,
      defaultTTL: 5 * 60 * 1000, // 5 分钟
      ...config,
    }
  }
  
  /**
   * 获取或创建加载器
   */
  getLoader(
    cacheKey: string,
    loader: () => Promise<FeedItem[]>
  ): LazyLoader<FeedItem[]> {
    if (!this.loaders.has(cacheKey)) {
      const newLoader = createLazyLoader<FeedItem[]>({
        loader: async () => loader(),
        cache: {
          maxSize: this.config.maxEntries,
          ttl: this.config.defaultTTL,
          strategy: 'lru',
        },
      })
      this.loaders.set(cacheKey, newLoader)
    }
    return this.loaders.get(cacheKey)!
  }
  
  /**
   * 生成缓存键
   */
  generateKey(
    userId: string,
    platformId: string,
    feedType: FeedType,
    options?: FeedOptions
  ): string {
    const parts = [userId, platformId, feedType]
    if (options?.offset) parts.push(`offset:${options.offset}`)
    return parts.join(':')
  }
  
  /**
   * 使缓存失效
   */
  invalidate(keyPattern: string): void {
    for (const [key, loader] of this.loaders) {
      if (key.includes(keyPattern)) {
        loader.invalidateAll()
      }
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): FeedCacheStats {
    let hits = 0, misses = 0, size = 0
    for (const loader of this.loaders.values()) {
      const stats = loader.getStats()
      hits += stats.hits
      misses += stats.misses
      size += stats.size
    }
    return {
      hits,
      misses,
      size,
      hitRate: hits / (hits + misses) || 0,
    }
  }
}
```

**职责**：
- 缓存已加载的信息流
- 支持 TTL 过期
- 提供缓存统计

---

### 7. AlgorithmRegistry

算法注册表，管理各平台的算法配置。

```typescript
export class AlgorithmRegistry {
  private configs: Map<string, AlgorithmConfig> = new Map()
  private defaultConfig: AlgorithmConfig = {
    weights: {
      recency: 0.3,
      engagement: 0.3,
      relevance: 0.2,
      social: 0.2,
    },
    decayHalfLife: 6,
  }
  
  /**
   * 注册平台算法配置
   */
  register(platformId: string, config: AlgorithmConfig): void {
    // 验证权重总和为 1
    const { recency, engagement, relevance, social } = config.weights
    const sum = recency + engagement + relevance + social
    if (Math.abs(sum - 1) > 0.001) {
      console.warn(
        `[AlgorithmRegistry] Weights sum to ${sum}, normalizing...`
      )
      config.weights = {
        recency: recency / sum,
        engagement: engagement / sum,
        relevance: relevance / sum,
        social: social / sum,
      }
    }
    
    this.configs.set(platformId, config)
  }
  
  /**
   * 获取算法配置
   */
  get(platformId: string): AlgorithmConfig {
    return this.configs.get(platformId) || this.defaultConfig
  }
  
  /**
   * 更新权重
   */
  updateWeights(
    platformId: string,
    weights: Partial<AlgorithmWeights>
  ): void {
    const config = this.get(platformId)
    config.weights = { ...config.weights, ...weights }
    this.register(platformId, config)
  }
}
```

**职责**：
- 存储各平台的算法配置
- 验证权重参数
- 提供默认配置

---

## 数据流

### 获取个性化信息流的完整流程

```text
1. App 调用 feedService.getPersonalizedFeed(userId, platformId)
                                │
                                ▼
2. 检查缓存 ──────────────────────────────────────────┐
   │                                                  │
   │ 缓存命中                                         │ 缓存未命中
   │                                                  │
   ▼                                                  ▼
3. 返回缓存                                      4. 开始聚合流程
                                                      │
                                                      ▼
                                                 5. FeedAggregator
                                                    ├── 获取关注用户发布的内容
                                                    ├── 获取热门内容
                                                    └── 获取推荐内容
                                                      │
                                                      ▼
                                                 6. FilterChain
                                                    ├── 过滤广告
                                                    ├── 过滤已屏蔽用户
                                                    └── 其他过滤器
                                                      │
                                                      ▼
                                                 7. ScoreCalculator
                                                    ├── 计算时效性分数
                                                    ├── 计算互动量分数
                                                    ├── 计算相关性分数
                                                    └── 计算社交分数
                                                      │
                                                      ▼
                                                 8. 按分数排序
                                                      │
                                                      ▼
                                                 9. DiversityController
                                                    └── 应用多样性规则
                                                      │
                                                      ▼
                                                10. 构建 FeedItem[]
                                                      │
                                                      ▼
                                                11. 写入缓存
                                                      │
                                                      ▼
                                                12. 返回 FeedResult
```

---

## 平台配置示例

### 微博

```typescript
feedService.registerAlgorithm('weibo', {
  weights: {
    recency: 0.35,      // 微博强调时效性
    engagement: 0.30,
    relevance: 0.20,
    social: 0.15,
  },
  decayHalfLife: 4,     // 4 小时半衰期（衰减快）
  diversityRules: {
    maxSameAuthor: 3,
    maxSameCategory: 5,
  },
  platformRules: {
    boostVerified: true,      // 提升认证用户
    boostOriginal: true,      // 提升原创内容
  },
})
```

### B站

```typescript
feedService.registerAlgorithm('bilibili', {
  weights: {
    recency: 0.20,      // 视频内容时效性要求低
    engagement: 0.45,   // 强调互动量（播放、弹幕、投币）
    relevance: 0.25,
    social: 0.10,
  },
  decayHalfLife: 24,    // 24 小时半衰期
  diversityRules: {
    maxSameAuthor: 2,
    maxSameCategory: 4,
  },
  platformRules: {
    considerWatchHistory: true,
    considerDanmakuDensity: true,
  },
})
```

### 知乎

```typescript
feedService.registerAlgorithm('zhihu', {
  weights: {
    recency: 0.15,      // 知识内容时效性要求低
    engagement: 0.25,
    relevance: 0.45,    // 强调内容相关性
    social: 0.15,
  },
  decayHalfLife: 72,    // 72 小时半衰期
  diversityRules: {
    maxSameAuthor: 2,
    maxSameTopic: 3,
  },
  platformRules: {
    boostExpertAnswers: true,
    considerAnswerQuality: true,
  },
})
```

---

## 与其他服务的交互

### 依赖的服务

| 服务 | 用途 |
| ---- | ---- |
| Social Media Engine | 获取内容、热度数据 |
| Interaction Service | 获取互动数据、用户偏好 |
| Account Service | 获取关注关系 |
| Trend Service | 获取热门话题 |
| Lazy Loader | 缓存管理 |
| Event Bus | 事件发布 |
| Logger | 日志记录 |

### 事件发布

```typescript
// 发布到 Event Bus 的事件
eventBus.emit('feed:loaded', {
  userId,
  platformId,
  feedType: 'home',
  itemCount: result.items.length,
  fromCache: result.fromCache,
})

eventBus.emit('feed:itemRead', {
  userId,
  platformId,
  postId: item.post.id,
})
```

---

## 性能优化

### 1. 缓存策略

- **首页缓存 5 分钟**：频繁访问，需要快速响应
- **热门缓存 10 分钟**：数据变化相对较慢
- **话题缓存 15 分钟**：话题内容更新频率低

### 2. 预加载

```typescript
// 用户滚动到底部时预加载下一页
async preloadNextPage(userId, platformId, { currentOffset }) {
  const cacheKey = this.cache.generateKey(
    userId, platformId, 'home',
    { offset: currentOffset + 20 }
  )
  
  // 后台预加载，不阻塞 UI
  this.cache.getLoader(cacheKey, () => this.loadPage(currentOffset + 20))
    .preload([cacheKey])
    .catch(() => {}) // 预加载失败不影响体验
}
```

### 3. 批量查询

```typescript
// 批量获取互动数据
const stats = await interactionService.batchGetStats(
  posts.map(p => p.id)
)

// 批量获取用户信息
const authors = await accountService.batchGetProfiles(
  [...new Set(posts.map(p => p.authorId))]
)
```

---

## 参考

- [README](./README.md) - Feed Service 概述
- [类型定义](./types.md) - TypeScript 类型
- [使用示例](./usage.md) - 代码示例
- [Lazy Loader 服务](../lazy-loader-service/README.md) - 缓存实现
