# Feed Service 系统集成

> **版本**: v1.0  
> **最后更新**: 2025-01-19

本文档说明 Feed Service 与其他系统服务的集成方式。

---

## 依赖关系图

```text
                    ┌─────────────────────────────────┐
                    │          Feed Service           │
                    └─────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Social Media   │    │   Interaction   │    │    Account      │
│     Engine      │    │    Service      │    │    Service      │
│                 │    │                 │    │                 │
│ • 内容获取      │    │ • 互动数据      │    │ • 关注关系      │
│ • 热度计算      │    │ • 用户偏好      │    │ • 用户画像      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Trend Service  │    │  Lazy Loader    │    │   Event Bus     │
│                 │    │                 │    │                 │
│ • 热搜数据      │    │ • 缓存管理      │    │ • 事件发布      │
│ • 话题内容      │    │ • 预加载        │    │ • 事件订阅      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Social Media Engine 集成

### 职责

Social Media Engine 是 Feed Service 的主要数据源，提供：

- 帖子内容查询
- 热度数据
- 内容生成（惰性填充）

### 集成方式

```typescript
import { SocialMediaEngine } from '@/services/social'

class FeedService {
  constructor(private socialEngine: SocialMediaEngine) {}
  
  /**
   * 从社交引擎获取帖子
   */
  private async fetchPosts(
    platformId: string,
    options: QueryOptions
  ): Promise<UniversalPost[]> {
    return this.socialEngine.queryPosts(platformId, {
      limit: options.limit,
      offset: options.offset,
      orderBy: 'timestamp',
      order: 'desc',
    })
  }
  
  /**
   * 获取帖子热度数据
   */
  private async getHeatData(
    postIds: string[]
  ): Promise<Map<string, number>> {
    const heatMap = new Map<string, number>()
    
    for (const postId of postIds) {
      const heat = await this.socialEngine.trafficEngine.getPostHeat(postId)
      heatMap.set(postId, heat)
    }
    
    return heatMap
  }
}
```

### 数据流

```text
FeedService.getPersonalizedFeed()
           │
           ▼
SocialMediaEngine.queryPosts()
           │
           ▼
 TrafficEngine.getPostHeat()
           │
           ▼
     返回帖子 + 热度数据
```

---

## Interaction Service 集成

### 职责

Interaction Service 提供用户互动数据，用于：

- 计算互动量分数
- 获取用户偏好（点赞/收藏历史）
- 判断用户与作者的互动关系

### 集成方式

```typescript
import { interactionService } from '@/services/interaction'

class ScoreCalculator {
  /**
   * 获取帖子互动数据
   */
  async getEngagementData(
    postIds: string[]
  ): Promise<Map<string, InteractionStats>> {
    return interactionService.batchGetStats(postIds)
  }
  
  /**
   * 判断用户是否与作者互动过
   */
  async hasInteracted(
    userId: string,
    authorId: string
  ): Promise<boolean> {
    const userLikes = await interactionService.getUserLikes(userId)
    const userComments = await interactionService.getUserComments(userId)
    
    // 检查是否点赞/评论过该作者的内容
    // ...
    return false
  }
  
  /**
   * 获取用户兴趣标签（基于互动历史）
   */
  async getUserInterests(userId: string): Promise<string[]> {
    const likes = await interactionService.getUserLikes(userId, { limit: 100 })
    const favorites = await interactionService.getUserFavorites(userId, { limit: 100 })
    
    // 从互动内容中提取标签
    const tags = extractTagsFromInteractions([...likes, ...favorites])
    return tags
  }
}
```

### 事件订阅

Feed Service 监听互动事件以更新推荐：

```typescript
import { interactionService } from '@/services/interaction'

class FeedService {
  constructor() {
    // 监听互动事件
    interactionService.onInteraction((event) => {
      this.handleInteractionEvent(event)
    })
  }
  
  private handleInteractionEvent(event: InteractionEvent) {
    switch (event.type) {
      case 'like':
      case 'favorite':
        // 更新用户兴趣模型
        this.updateUserInterests(event.userId, event.contentId)
        break
      case 'view':
        // 记录浏览行为
        this.recordView(event.userId, event.contentId)
        break
    }
  }
}
```

---

## Account Service 集成

### 职责

Account Service 提供用户关系数据：

- 关注列表
- 粉丝列表
- 用户画像

### 集成方式

```typescript
import { accountService } from '@/services/account'

class FeedAggregator {
  /**
   * 获取用户关注的账号列表
   */
  async getFollowingIds(
    userId: string,
    platformId: string
  ): Promise<string[]> {
    const following = await accountService.getFollowing(userId, platformId)
    return following.map(f => f.id)
  }
  
  /**
   * 获取关注者发布的内容
   */
  async fetchFollowingPosts(
    userId: string,
    platformId: string,
    options: FeedOptions
  ): Promise<UniversalPost[]> {
    const followingIds = await this.getFollowingIds(userId, platformId)
    
    if (followingIds.length === 0) {
      return []
    }
    
    return this.socialEngine.queryPosts(platformId, {
      authorIds: followingIds,
      limit: options.limit,
      offset: options.offset,
    })
  }
}

class ScoreCalculator {
  /**
   * 计算社交分数
   */
  async calculateSocialScore(
    userId: string,
    authorId: string,
    platformId: string
  ): Promise<number> {
    let score = 0
    
    // 是否关注
    const isFollowing = await accountService.isFollowing(
      userId, authorId, platformId
    )
    if (isFollowing) score += 0.5
    
    // 是否互动过
    const hasInteracted = await this.hasInteracted(userId, authorId)
    if (hasInteracted) score += 0.5
    
    return score
  }
}
```

---

## Trend Service 集成

### 职责

Trend Service 提供热搜和话题数据：

- 热搜榜单
- 话题内容
- 热门分类

### 集成方式

```typescript
import { trendService } from '@/services/social/trendService'

class FeedAggregator {
  /**
   * 获取热门话题内容
   */
  async fetchTrendingPosts(
    platformId: string,
    options: TrendingOptions
  ): Promise<UniversalPost[]> {
    // 获取热搜话题
    const trending = await trendService.getTrending(platformId, {
      limit: 10,
    })
    
    // 获取话题相关帖子
    const posts: UniversalPost[] = []
    for (const topic of trending) {
      const topicPosts = await trendService.getTopicPosts(topic.id, {
        limit: 5,
      })
      posts.push(...topicPosts)
    }
    
    return posts
  }
  
  /**
   * 获取特定话题的内容
   */
  async fetchTopicPosts(
    topicId: string,
    options: FeedOptions
  ): Promise<UniversalPost[]> {
    // 确保话题内容已生成（惰性加载）
    await trendService.ensureTopicContent(topicId)
    
    return trendService.getTopicPosts(topicId, {
      limit: options.limit,
      offset: options.offset,
    })
  }
}
```

---

## Lazy Loader 集成

### 职责

Lazy Loader 服务用于信息流的缓存管理：

- 缓存已加载的信息流
- 请求去重
- 并发控制

### 集成方式

```typescript
import { createLazyLoader, type LazyLoader } from '@/services/lazyLoader'

class FeedCache {
  private loaders: Map<string, LazyLoader<FeedItem[]>> = new Map()
  
  /**
   * 获取或创建信息流加载器
   */
  getLoader(
    userId: string,
    platformId: string,
    feedType: FeedType
  ): LazyLoader<FeedItem[]> {
    const key = `${userId}:${platformId}:${feedType}`
    
    if (!this.loaders.has(key)) {
      const loader = createLazyLoader<FeedItem[]>({
        loader: async () => {
          return this.loadFeed(userId, platformId, feedType)
        },
        cache: {
          maxSize: 100,
          ttl: 5 * 60 * 1000, // 5 分钟
          strategy: 'lru',
        },
        concurrency: 3,
      })
      
      this.loaders.set(key, loader)
    }
    
    return this.loaders.get(key)!
  }
  
  /**
   * 预加载下一页
   */
  async preloadNextPage(
    userId: string,
    platformId: string,
    currentOffset: number
  ): Promise<void> {
    const key = `${userId}:${platformId}:home:${currentOffset + 20}`
    const loader = this.getLoader(userId, platformId, 'home')
    
    await loader.preload([key])
  }
}
```

---

## Event Bus 集成

### 发布的事件

Feed Service 发布以下事件到 Event Bus：

```typescript
import { eventBus } from '@/services/eventBus'

class FeedService {
  /**
   * 信息流加载完成
   */
  private emitLoaded(result: FeedResult) {
    eventBus.emit('feed:loaded', {
      userId: result.userId,
      platformId: result.platformId,
      feedType: result.feedType,
      itemCount: result.items.length,
      fromCache: result.fromCache,
    })
  }
  
  /**
   * 信息流刷新
   */
  private emitRefreshed(userId: string, platformId: string) {
    eventBus.emit('feed:refreshed', {
      userId,
      platformId,
      timestamp: Date.now(),
    })
  }
  
  /**
   * 内容已读
   */
  markAsRead(userId: string, postId: string) {
    eventBus.emit('feed:itemRead', {
      userId,
      postId,
      timestamp: Date.now(),
    })
  }
}
```

### 订阅的事件

Feed Service 订阅以下事件：

```typescript
import { eventBus } from '@/services/eventBus'

class FeedService {
  constructor() {
    // 新帖子发布时，使相关用户的缓存失效
    eventBus.on('content:post:created', (event) => {
      this.invalidateFeedCache(event.authorId)
    })
    
    // 关注关系变化时，使关注流缓存失效
    eventBus.on('social:follow', (event) => {
      this.invalidateFollowingFeed(event.userId)
    })
    
    eventBus.on('social:unfollow', (event) => {
      this.invalidateFollowingFeed(event.userId)
    })
    
    // 热搜更新时，使热门流缓存失效
    eventBus.on('content:trending:updated', (event) => {
      this.invalidateTrendingFeed(event.platformId)
    })
  }
}
```

---

## Logger 集成

### 日志记录

```typescript
import { loggerService } from '@/services/logger'

const logger = loggerService.child('feed')

class FeedService {
  async getPersonalizedFeed(
    userId: string,
    platformId: string,
    options: FeedOptions
  ): Promise<FeedResult> {
    logger.debug('Loading personalized feed', {
      userId,
      platformId,
      options,
    })
    
    logger.time('feed:load')
    
    try {
      const result = await this.loadFeed(userId, platformId, options)
      
      const elapsed = logger.timeEnd('feed:load')
      logger.info('Feed loaded', {
        userId,
        platformId,
        itemCount: result.items.length,
        elapsed,
        fromCache: result.fromCache,
      })
      
      return result
    } catch (error) {
      logger.error('Failed to load feed', { userId, platformId, error })
      throw error
    }
  }
}
```

---

## 初始化顺序

Feed Service 需要在依赖服务初始化完成后启动：

```typescript
// src/services/index.ts

export async function initializeServices() {
  // 1. 基础服务
  await loggerService.initialize()
  await eventBus.initialize()
  
  // 2. 数据服务
  await accountService.initialize()
  await interactionService.initialize()
  
  // 3. 内容服务
  await socialMediaEngine.initialize()
  await trendService.initialize()
  
  // 4. Feed Service（依赖上述服务）
  await feedService.initialize()
  
  console.log('[Services] All services initialized')
}
```

---

## 错误处理

### 依赖服务异常

```typescript
class FeedService {
  async getPersonalizedFeed(
    userId: string,
    platformId: string,
    options: FeedOptions
  ): Promise<FeedResult> {
    try {
      // 主流程
      return await this.loadFeed(userId, platformId, options)
    } catch (error) {
      // 依赖服务异常时的降级策略
      if (error instanceof SocialEngineError) {
        logger.warn('Social engine error, falling back to cache')
        return this.loadFromCache(userId, platformId)
      }
      
      if (error instanceof InteractionServiceError) {
        logger.warn('Interaction service error, using default scores')
        return this.loadWithDefaultScores(userId, platformId, options)
      }
      
      throw error
    }
  }
  
  /**
   * 降级：从缓存加载
   */
  private async loadFromCache(
    userId: string,
    platformId: string
  ): Promise<FeedResult> {
    const cached = await this.cache.get(userId, platformId)
    if (cached) {
      return { ...cached, fromCache: true, stale: true }
    }
    throw new Error('No cached feed available')
  }
}
```

---

## 参考

- [README](./README.md) - Feed Service 概述
- [架构设计](./architecture.md) - 服务架构
- [Social Media Engine](../social-media-engine/README.md)
- [Interaction Service](../interaction-service/README.md)
- [Account Service](../account-service/README.md)
- [Lazy Loader Service](../lazy-loader-service/README.md)
- [Event Bus Service](../eventBus-service/README.md)
