# Trending Service API 参考

> 本文档定义 Trending Service 的目标接口。

## 1. 核心接口

```typescript
export interface TrendingService {
  // 话题管理
  createFromEvent(event: WorldEvent, options?: CreateOptions): Promise<TrendingTopic[]>;
  upsertTopics(topics: TrendingTopic[]): Promise<void>;
  archiveTopic(topicId: string): Promise<void>;

  // 榜单查询
  getTrending(platformId: string, options?: TrendingQueryOptions): Promise<TrendingTopic[]>;
  getTopic(topicId: string): Promise<TrendingTopic | undefined>;

  // 惰性内容
  ensureTopicContent(topicId: string): Promise<UniversalPost[]>;
  preloadTopicContent(topicIds: string[]): Promise<void>;

  // 配置与共享
  registerPlatformConfig(platformId: string, config: TrendingConfig): void;
  getPlatformConfig(platformId: string): TrendingConfig;
  setSharePolicy(platformId: string, policy: SharePolicy): void;
  getSharedTrending(requesterAppId: string, options?: SharedTrendingOptions): Promise<TrendingTopic[]>;

  // 事件
  onTrendingUpdate(callback: (event: TrendingUpdateEvent) => void): () => void;
}
```

## 2. 方法说明

### 2.1 createFromEvent(event, options?)

将世界事件转换为一个或多个平台话题。

| 参数 | 类型 | 必需 | 说明 |
| ---- | ---- | ---- | ---- |
| `event` | `WorldEvent` | 是 | 世界事件输入 |
| `options` | `CreateOptions` | 否 | 创建策略（覆盖平台、分类、初始热度） |

返回：`Promise<TrendingTopic[]>`

### 2.2 getTrending(platformId, options?)

查询平台热搜榜，按实时热度降序返回。

| 参数 | 类型 | 必需 | 默认值 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| `platformId` | `string` | 是 | - | 平台 ID |
| `options.limit` | `number` | 否 | `20` | 返回数量 |
| `options.category` | `string` | 否 | - | 分类过滤 |
| `options.includeSponsored` | `boolean` | 否 | `false` | 是否返回广告位 |
| `options.timeRangeHours` | `number` | 否 | `72` | 查询时间窗口 |

返回：`Promise<TrendingTopic[]>`

### 2.3 ensureTopicContent(topicId)

确保话题存在关联内容；若无内容，触发惰性生成。

| 参数 | 类型 | 必需 | 说明 |
| ---- | ---- | ---- | ---- |
| `topicId` | `string` | 是 | 话题 ID |

返回：`Promise<UniversalPost[]>`

### 2.4 setSharePolicy(platformId, policy)

设置热搜共享策略。

| 参数 | 类型 | 必需 | 说明 |
| ---- | ---- | ---- | ---- |
| `platformId` | `string` | 是 | 平台 ID |
| `policy` | `SharePolicy` | 是 | 共享访问策略 |

返回：`void`

### 2.5 getSharedTrending(requesterAppId, options?)

获取对请求方可见的跨平台热搜聚合结果。

| 参数 | 类型 | 必需 | 说明 |
| ---- | ---- | ---- | ---- |
| `requesterAppId` | `string` | 是 | 调用方 App ID |
| `options.limit` | `number` | 否 | 聚合返回数量 |
| `options.excludeCategories` | `string[]` | 否 | 附加排除分类 |

返回：`Promise<TrendingTopic[]>`

## 3. 类型定义

```typescript
export interface TrendingConfig {
  maxItems: number;
  categories: string[];
  refreshInterval: number;
  hotThreshold: number;
  allowSponsored: boolean;
  decayHalfLifeHours?: number;
  platformRules?: Record<string, unknown>;
}

export interface SharePolicy {
  enabled: boolean;
  allowedConsumers: string[]; // ['*'] 代表全部
  excludeCategories?: string[];
}

export interface TrendingQueryOptions {
  limit?: number;
  category?: string;
  includeSponsored?: boolean;
  timeRangeHours?: number;
}

export interface SharedTrendingOptions {
  limit?: number;
  excludeCategories?: string[];
}

export interface CreateOptions {
  platformIds?: string[];
  categories?: string[];
  baseScore?: number;
}

export interface TrendingUpdateEvent {
  type: 'topic_created' | 'ranking_updated' | 'policy_changed';
  platformId?: string;
  topicIds?: string[];
  timestamp: number;
}
```

## 4. 兼容层映射（旧 API -> 新 API）

| 旧接口 (`TrendService`) | 新接口 (`TrendingService`) |
| ---- | ---- |
| `createTopicFromEvent(event)` | `createFromEvent(event)` |
| `getTrendingList(platformId, limit)` | `getTrending(platformId, { limit })` |
| `ensureTopicContent(topicId)` | `ensureTopicContent(topicId)` |
| `preloadTopics(topicIds)` | `preloadTopicContent(topicIds)` |

建议在迁移期保留旧方法别名，避免一次性改动过大。
