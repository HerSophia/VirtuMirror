# Feed Service 算法配置

> **版本**: v1.0  
> **最后更新**: 2025-01-19

本文档详细说明 Feed Service 的推荐算法原理和配置方法。

---

## 算法概述

Feed Service 使用**加权多因子排序算法**，综合考虑以下四个维度：

| 维度 | 英文 | 说明 |
| ---- | ---- | ---- |
| 时效性 | Recency | 内容发布时间，越新分数越高 |
| 互动量 | Engagement | 点赞、评论、转发等互动数据 |
| 相关性 | Relevance | 与用户兴趣的匹配程度 |
| 社交因素 | Social | 是否来自关注的人、互动过的账号 |

---

## 评分公式

### 总分计算

```
TotalScore = W_recency × RecencyScore
           + W_engagement × EngagementScore
           + W_relevance × RelevanceScore
           + W_social × SocialScore
```

其中 `W_recency + W_engagement + W_relevance + W_social = 1`

### 各维度分数计算

#### 1. 时效性分数 (RecencyScore)

使用**指数衰减**模型：

```typescript
RecencyScore = e^(-age / (halfLife × ln2))
```

- `age`：内容发布距今的小时数
- `halfLife`：半衰期（小时），配置项 `decayHalfLife`

**特点**：
- 新内容分数接近 1
- 经过半衰期后，分数降为 0.5
- 衰减平滑，不会突然跌落

```typescript
// 示例：halfLife = 6 小时
age = 0h  → score = 1.00
age = 3h  → score = 0.71
age = 6h  → score = 0.50
age = 12h → score = 0.25
age = 24h → score = 0.06
```

#### 2. 互动量分数 (EngagementScore)

使用**对数归一化**：

```typescript
EngagementRaw = likes + comments × 2 + reposts × 3
EngagementScore = log(1 + EngagementRaw) / log(1 + MaxEngagement)
```

- 评论权重 2：比点赞更有价值
- 转发权重 3：传播行为价值最高
- 对数处理：避免头部内容分数过高

**归一化参数**：`MaxEngagement` 通常设为平台内容的 P99 互动量。

#### 3. 相关性分数 (RelevanceScore)

基于**标签匹配**：

```typescript
RelevanceScore = MatchedTags / TotalPostTags
```

- `MatchedTags`：帖子标签与用户兴趣标签的交集数量
- `TotalPostTags`：帖子的标签总数

**冷启动处理**：用户无兴趣标签时，返回 0.5（中性分数）。

#### 4. 社交分数 (SocialScore)

```typescript
SocialScore = IsFollowing × 0.5 + HasInteracted × 0.5
```

- `IsFollowing`：用户是否关注了作者（0 或 1）
- `HasInteracted`：用户是否与作者有过互动（0 或 1）

---

## 平台配置示例

### 微博

微博是即时性社交平台，强调**时效性**。

```typescript
const weiboConfig: AlgorithmConfig = {
  weights: {
    recency: 0.35,      // 高时效性权重
    engagement: 0.30,
    relevance: 0.20,
    social: 0.15,
  },
  decayHalfLife: 4,     // 4小时半衰期，衰减快
  diversityRules: {
    maxSameAuthor: 3,
    maxSameCategory: 5,
  },
  platformRules: {
    boostVerified: 1.1,     // 认证用户加成 10%
    boostOriginal: 1.05,    // 原创内容加成 5%
    penaltyRepost: 0.9,     // 转发内容惩罚 10%
  },
}
```

### B站

B站是视频平台，内容生命周期长，强调**互动量**。

```typescript
const bilibiliConfig: AlgorithmConfig = {
  weights: {
    recency: 0.20,      // 视频时效性要求低
    engagement: 0.45,   // 高互动权重
    relevance: 0.25,
    social: 0.10,
  },
  decayHalfLife: 24,    // 24小时半衰期
  diversityRules: {
    maxSameAuthor: 2,
    maxSameCategory: 4,
  },
  platformRules: {
    considerDanmaku: true,        // 考虑弹幕密度
    considerCoinRatio: true,      // 考虑投币率
    considerCompletionRate: true, // 考虑完播率
  },
}
```

### 知乎

知乎是问答平台，强调**内容相关性**。

```typescript
const zhihuConfig: AlgorithmConfig = {
  weights: {
    recency: 0.15,      // 知识内容时效性低
    engagement: 0.25,
    relevance: 0.45,    // 高相关性权重
    social: 0.15,
  },
  decayHalfLife: 72,    // 72小时半衰期
  diversityRules: {
    maxSameAuthor: 2,
    maxSameTopic: 3,
  },
  platformRules: {
    boostExpert: 1.2,           // 领域专家加成 20%
    boostDetailedAnswer: 1.1,   // 详细回答加成 10%
    penaltyShortAnswer: 0.8,    // 简短回答惩罚 20%
  },
}
```

### 抖音

抖音是短视频平台，强调**互动量**和**完播率**。

```typescript
const douyinConfig: AlgorithmConfig = {
  weights: {
    recency: 0.25,
    engagement: 0.50,   // 极高互动权重
    relevance: 0.20,
    social: 0.05,       // 弱社交因素
  },
  decayHalfLife: 12,
  diversityRules: {
    maxSameAuthor: 2,
    maxSameCategory: 3,
    maxConsecutiveSameType: 2,
  },
  platformRules: {
    considerWatchTime: true,
    considerLoopCount: true,
    considerShareRate: true,
  },
}
```

---

## 多样性控制

### 作用

防止信息流被少数作者或话题主导，保证内容多样性。

### 规则配置

```typescript
interface DiversityRules {
  // 同一作者最多显示几条
  maxSameAuthor?: number
  
  // 同一分类最多显示几条
  maxSameCategory?: number
  
  // 同一话题最多显示几条
  maxSameTopic?: number
  
  // 连续相同类型的最大数量
  maxConsecutiveSameType?: number
}
```

### 执行逻辑

多样性规则在**排序完成后**应用：

```typescript
function applyDiversity(items: FeedItem[], rules: DiversityRules): FeedItem[] {
  const result: FeedItem[] = []
  const counters = new Map<string, Map<string, number>>()
  
  for (const item of items) {
    let skip = false
    
    // 检查各维度限制
    for (const [dimension, maxCount] of Object.entries(rules)) {
      if (!maxCount) continue
      
      const value = getDimensionValue(item, dimension)
      const count = getCount(counters, dimension, value)
      
      if (count >= maxCount) {
        skip = true
        break
      }
    }
    
    if (!skip) {
      result.push(item)
      updateCounters(counters, item)
    }
  }
  
  return result
}
```

---

## 冷启动策略

当用户没有足够的行为数据时，使用冷启动策略。

### 策略类型

```typescript
type ColdStartStrategy =
  | 'trending'    // 展示热门内容
  | 'diverse'     // 展示多样化内容
  | 'curated'     // 展示编辑精选
  | 'random'      // 随机展示
```

### 策略选择

```typescript
function selectColdStartStrategy(
  userAge: number,      // 用户注册天数
  actionCount: number,  // 用户行为数
): ColdStartStrategy {
  if (userAge < 1 && actionCount < 5) {
    // 新用户：展示热门内容建立认知
    return 'trending'
  }
  
  if (userAge < 7 && actionCount < 20) {
    // 早期用户：展示多样化内容探索兴趣
    return 'diverse'
  }
  
  // 默认：正常推荐
  return null
}
```

---

## 实时调参

### 动态权重调整

用户可以通过界面切换信息流模式：

```typescript
// 最新模式：强调时效性
const latestMode = {
  recency: 0.8,
  engagement: 0.1,
  relevance: 0.05,
  social: 0.05,
}

// 热门模式：强调互动量
const hotMode = {
  recency: 0.1,
  engagement: 0.7,
  relevance: 0.1,
  social: 0.1,
}

// 推荐模式：平衡
const recommendMode = {
  recency: 0.3,
  engagement: 0.3,
  relevance: 0.2,
  social: 0.2,
}
```

### API 调用

```typescript
// 切换到最新模式
feedService.updateAlgorithmWeights('weibo', latestMode)

// 切换到热门模式
feedService.updateAlgorithmWeights('weibo', hotMode)

// 恢复默认
feedService.updateAlgorithmWeights('weibo', recommendMode)
```

---

## 性能优化

### 分数预计算

对于不依赖用户的分数（如时效性、互动量），可以预计算并缓存：

```typescript
interface PrecomputedScore {
  postId: string
  recencyScore: number
  engagementScore: number
  computedAt: number
}

// 定期更新预计算分数
async function updatePrecomputedScores() {
  const posts = await getRecentPosts(1000)
  const now = Date.now()
  
  for (const post of posts) {
    const scores: PrecomputedScore = {
      postId: post.id,
      recencyScore: calculateRecency(post.timestamp, now),
      engagementScore: calculateEngagement(post.stats),
      computedAt: now,
    }
    await cacheScore(scores)
  }
}
```

### 分层计算

```
1. 粗排：使用预计算分数快速筛选 Top 200
2. 精排：计算完整分数（含相关性、社交）
3. 多样性：应用多样性规则
4. 返回 Top 20
```

---

## 调试与分析

### 获取分数明细

```typescript
const result = await feedService.getPersonalizedFeed(userId, 'weibo')

for (const item of result.items) {
  console.log(`
    帖子: ${item.post.id}
    总分: ${item.score}
    推荐原因: ${item.reason?.description}
  `)
}
```

### 调试模式

```typescript
// 开发环境启用详细日志
if (import.meta.env.DEV) {
  const result = await feedService.getPersonalizedFeed(userId, 'weibo')
  
  console.log('调试信息:', result.debug)
  // {
  //   algorithm: 'weighted-multi-factor',
  //   processingTime: 45,
  //   candidateCount: 500,
  //   afterFilterCount: 320,
  //   appliedFilters: ['hideAds', 'hideBlocked'],
  // }
}
```

---

## 参考

- [README](./README.md) - Feed Service 概述
- [类型定义](./types.md) - AlgorithmConfig 类型
- [架构设计](./architecture.md) - ScoreCalculator 实现
- [使用示例](./usage.md) - 配置算法示例
