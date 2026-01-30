# 信息流服务 (Feed Service)

> **状态**: 📋 设计中  
> **版本**: v1.0  
> **优先级**: 🟡 中  
> **最后更新**: 2025-01-19

## 概述

信息流服务（Feed Service）是系统级的内容分发中心。它负责将来自不同来源的内容聚合、排序，并根据用户偏好和算法规则生成个性化的信息流。

### 核心能力

* **信息流聚合**：整合关注流、推荐流、热门流等多种信息流
* **个性化推荐**：根据用户兴趣和行为生成个性化内容
* **热门内容**：获取平台热门/趋势内容
* **算法配置**：支持按平台配置不同的推荐算法参数
* **多样性控制**：避免内容同质化，保证信息流多样性

### 设计目标

| 维度       | 说明                                        |
| ---------- | ------------------------------------------- |
| 跨平台复用 | 微博、B站、知乎等平台共享信息流服务         |
| 算法可配   | 不同平台可以配置不同的推荐算法参数          |
| 性能优化   | 支持分页加载、缓存策略、预加载              |
| 可扩展     | 支持自定义排序规则和过滤器                  |
| 解耦       | App 只调用服务接口，不直接操作排序逻辑      |

### 问题背景

当前 `TrafficEngine` 只用于热度计算，缺乏完整的信息流推荐能力：

1. **功能单一**：只计算热度，不提供完整的信息流聚合
2. **缺乏个性化**：没有基于用户兴趣的推荐机制
3. **平台耦合**：逻辑分散在各个 App 中，无法复用
4. **配置困难**：算法参数硬编码，无法按平台调整

---

## 文档导航

| 文档                                | 说明                                   |
| ----------------------------------- | -------------------------------------- |
| [架构设计](./architecture.md)       | 分层架构、核心组件、数据流             |
| [类型定义](./types.md)              | FeedItem、FeedOptions、AlgorithmConfig |
| [使用示例](./usage.md)              | 获取信息流、配置算法、自定义过滤       |
| [算法配置](./algorithm.md)          | 各平台算法参数、权重配置               |
| [系统集成](./integration.md)        | 与社交引擎、互动服务、账号服务的交互   |

---

## 快速开始

### 1. 获取个性化信息流

```typescript
import { feedService } from '@/services/feed'

// 获取用户的个性化首页信息流
const feed = await feedService.getPersonalizedFeed(userId, 'weibo', {
  limit: 20,
  offset: 0,
})

// 遍历信息流内容
for (const item of feed.items) {
  console.log(item.post.payload.text)
}
```

### 2. 获取关注流

```typescript
import { feedService } from '@/services/feed'

// 获取用户关注的人发布的内容
const followingFeed = await feedService.getFollowingFeed(userId, 'weibo', {
  limit: 20,
})
```

### 3. 获取热门内容

```typescript
import { feedService } from '@/services/feed'

// 获取平台热门内容
const trending = await feedService.getTrendingContent('weibo', {
  category: '娱乐',
  limit: 10,
})

// 获取发现页内容
const discover = await feedService.getDiscoverContent(userId, 'weibo')
```

### 4. 配置平台算法

```typescript
import { feedService } from '@/services/feed'

// 注册微博的算法配置
feedService.registerAlgorithm('weibo', {
  weights: {
    recency: 0.3,      // 时效性权重
    engagement: 0.4,   // 互动量权重
    relevance: 0.2,    // 相关性权重
    social: 0.1,       // 社交因素权重
  },
  decayHalfLife: 6,    // 热度半衰期（小时）
  diversityRules: {
    maxSameAuthor: 3,      // 同作者最多 3 条
    maxSameCategory: 5,    // 同类目最多 5 条
  },
})

// 注册 B站 的算法配置
feedService.registerAlgorithm('bilibili', {
  weights: {
    recency: 0.2,
    engagement: 0.5,   // B站更注重互动量
    relevance: 0.25,
    social: 0.05,
  },
  decayHalfLife: 12,   // 视频内容衰减更慢
})
```

### 5. 自定义过滤器

```typescript
import { feedService } from '@/services/feed'

// 添加内容过滤器
feedService.addFilter('weibo', (post) => {
  // 过滤掉广告内容
  if (post.platformData?.isAd) return false
  // 过滤掉已屏蔽的用户
  if (blockedUsers.includes(post.authorId)) return false
  return true
})
```

### 6. 刷新与预加载

```typescript
import { feedService } from '@/services/feed'

// 刷新信息流（获取最新内容）
const refreshed = await feedService.refreshFeed(userId, 'weibo')

// 预加载下一页
await feedService.preloadNextPage(userId, 'weibo', {
  currentOffset: 20,
})
```

---

## 核心概念

### 信息流类型

```typescript
type FeedType =
  | 'home'        // 首页综合流
  | 'following'   // 关注流
  | 'trending'    // 热门流
  | 'discover'    // 发现流
  | 'category'    // 分类流
  | 'topic'       // 话题流
```

### 信息流项

```typescript
interface FeedItem {
  id: string                    // 信息流项 ID
  post: UniversalPost           // 帖子内容
  reason?: FeedReason           // 推荐原因
  score: number                 // 排序分数
  position: number              // 在信息流中的位置
  insertedAt: number            // 插入时间
}

interface FeedReason {
  type: 'following' | 'trending' | 'similar' | 'recommended'
  description?: string          // 如 "因为你关注了 xxx"
  relatedEntity?: string        // 相关实体 ID
}
```

### 算法配置

```typescript
interface AlgorithmConfig {
  // 权重配置
  weights: {
    recency: number       // 时效性权重 (0-1)
    engagement: number    // 互动量权重 (0-1)
    relevance: number     // 相关性权重 (0-1)
    social: number        // 社交因素权重 (0-1)
  }
  
  // 衰减参数
  decayHalfLife: number   // 热度半衰期（小时）
  
  // 多样性控制
  diversityRules?: {
    maxSameAuthor: number       // 同作者最多几条
    maxSameCategory: number     // 同类目最多几条
    maxSameTopic: number        // 同话题最多几条
  }
  
  // 平台特定规则
  platformRules?: Record<string, unknown>
}
```

### 数据模型

```text
┌─────────────────────────────────────────────────────────────┐
│ FeedService                                                  │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ FeedCache (信息流缓存)                                 │ │
│  │ └── 用户的信息流缓存                                   │ │
│  │     userId -> FeedItem[]                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ AlgorithmRegistry (算法注册表)                         │ │
│  │ └── 各平台的算法配置                                   │ │
│  │     platformId -> AlgorithmConfig                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ FilterRegistry (过滤器注册表)                          │ │
│  │ └── 各平台的内容过滤器                                 │ │
│  │     platformId -> Filter[]                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ScoreCalculator (分数计算器)                           │ │
│  │ └── 计算内容的排序分数                                 │ │
│  │     热度、时效性、相关性、社交因素                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心 API 概览

### FeedService 主要方法

| 方法                         | 说明                 |
| ---------------------------- | -------------------- |
| **信息流获取**               |                      |
| `getPersonalizedFeed()`      | 获取个性化首页流     |
| `getFollowingFeed()`         | 获取关注流           |
| `getTrendingContent()`       | 获取热门内容         |
| `getDiscoverContent()`       | 获取发现页内容       |
| `getCategoryFeed()`          | 获取分类信息流       |
| `getTopicFeed()`             | 获取话题信息流       |
| **刷新与分页**               |                      |
| `refreshFeed()`              | 刷新信息流           |
| `loadMore()`                 | 加载更多             |
| `preloadNextPage()`          | 预加载下一页         |
| **算法配置**                 |                      |
| `registerAlgorithm()`        | 注册平台算法配置     |
| `getAlgorithmConfig()`       | 获取算法配置         |
| `updateAlgorithmWeights()`   | 更新算法权重         |
| **过滤器**                   |                      |
| `addFilter()`                | 添加内容过滤器       |
| `removeFilter()`             | 移除过滤器           |
| `clearFilters()`             | 清除所有过滤器       |
| **缓存管理**                 |                      |
| `invalidateCache()`          | 使缓存失效           |
| `clearCache()`               | 清除缓存             |
| `getCacheStats()`            | 获取缓存统计         |

---

## 与其他服务的集成

```text
┌─────────────────────────────────────────────────────────────┐
│                      FeedService                             │
│                      (信息流服务)                            │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Social      │ │ Interaction │ │ Account     │ │ Trend       │
│ Media Engine│ │ Service     │ │ Service     │ │ Service     │
│ (社交引擎)  │ │ (互动服务)  │ │ (账号服务)  │ │ (热搜服务)  │
│             │ │             │ │             │ │             │
│ 获取内容    │ │ 获取互动数  │ │ 获取关注    │ │ 获取热门    │
│ 热度计算    │ │ 用户偏好    │ │ 社交关系    │ │ 话题内容    │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    各 App (微博/B站/知乎)                   │
│                                                             │
│  首页 → feedService.getPersonalizedFeed()                   │
│  关注 → feedService.getFollowingFeed()                      │
│  热门 → feedService.getTrendingContent()                    │
└─────────────────────────────────────────────────────────────┘
```

**核心依赖**：

* **社交媒体引擎**：获取内容、计算热度
* **互动服务**：获取内容互动数据，用于排序
* **账号服务**：获取用户关注关系，用于关注流
* **热搜服务**：获取热门话题内容
* **Lazy Loader**：信息流的惰性加载和缓存

---

## 排序算法

### 综合评分公式

```typescript
score = 
  weights.recency * recencyScore +
  weights.engagement * engagementScore +
  weights.relevance * relevanceScore +
  weights.social * socialScore
```

### 各分数计算

```typescript
// 时效性分数（指数衰减）
recencyScore = Math.exp(-ageInHours / (decayHalfLife * Math.LOG2E))

// 互动量分数（对数归一化）
engagementScore = Math.log(1 + likes + comments * 2 + reposts * 3) / maxEngagement

// 相关性分数（基于标签匹配）
relevanceScore = matchedTags / totalTags

// 社交分数（是否关注、互动历史）
socialScore = isFollowing ? 0.5 : 0 + hasInteracted ? 0.5 : 0
```

### 多样性控制

```typescript
// 在排序后应用多样性规则
function applyDiversityRules(items: FeedItem[], rules: DiversityRules): FeedItem[] {
  const result: FeedItem[] = []
  const authorCount = new Map<string, number>()
  const categoryCount = new Map<string, number>()
  
  for (const item of items) {
    const authorC = authorCount.get(item.post.authorId) || 0
    const categoryC = categoryCount.get(item.post.category) || 0
    
    // 检查是否超过限制
    if (authorC >= rules.maxSameAuthor) continue
    if (categoryC >= rules.maxSameCategory) continue
    
    result.push(item)
    authorCount.set(item.post.authorId, authorC + 1)
    categoryCount.set(item.post.category, categoryC + 1)
  }
  
  return result
}
```

---

## 实施计划

| Phase   | 内容                        | 状态      | 工作量   |
| ------- | --------------------------- | --------- | -------- |
| Phase 1 | 核心接口设计                | ✅ 已完成 | 1h       |
| Phase 2 | 类型定义                    | ⏳ 待实现 | 1h       |
| Phase 3 | 核心服务实现                | ⏳ 待实现 | 4-6h     |
| Phase 4 | 算法配置系统                | ⏳ 待实现 | 2h       |
| Phase 5 | 与社交引擎集成              | ⏳ 待实现 | 2h       |
| Phase 6 | 单元测试                    | ⏳ 待实现 | 2h       |
| **总计**|                             |           | **12-14h** |

---

## 文件结构（规划）

```text
src/
├── types/
│   └── feed.ts                       # 类型定义
├── services/
│   └── feed/
│       ├── index.ts                  # 模块入口
│       ├── FeedService.ts            # 核心服务（单例）
│       ├── ScoreCalculator.ts        # 分数计算器
│       ├── DiversityController.ts    # 多样性控制
│       ├── FeedCache.ts              # 信息流缓存
│       ├── algorithms/               # 算法配置
│       │   ├── index.ts
│       │   ├── weibo.ts              # 微博算法配置
│       │   ├── bilibili.ts           # B站算法配置
│       │   └── zhihu.ts              # 知乎算法配置
│       └── __tests__/                # 单元测试
│           ├── FeedService.test.ts
│           ├── ScoreCalculator.test.ts
│           └── DiversityController.test.ts
```

---

## 参考资料

* [服务开发指南](../service-development-guide.md)
* [社交内容平台架构](../architecture/Service-for-social-media-platform.md)
* [社交媒体引擎](../social-media-engine/README.md)
* [互动服务](../interaction-service/README.md)
* [账号服务](../account-service/README.md)
* [Lazy Loader 服务](../lazy-loader-service/README.md)
