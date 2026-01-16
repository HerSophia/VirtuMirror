# 数据模型详解 (Data Model)

> **模块**: Fans Service / Data Model  
> **版本**: 1.0  
> **状态**: 设计阶段

## 1. 概述

本文档详细描述粉丝服务涉及的所有数据结构和数据库表设计，为服务实现提供数据层参考。

---

## 2. 核心数据结构

### 2.1 粉丝关系 (FollowerRelation)

表示账号之间的关注关系。

```typescript
interface FollowerRelation {
  // === 主键 ===
  id: string;                    // 关系 ID (UUID)
  
  // === 关系主体 ===
  followerId: string;            // 粉丝账号 ID
  followeeId: string;            // 被关注者账号 ID
  platformId: string;            // 平台 ID (weibo/bilibili/douyin)
  
  // === 时间信息 ===
  followedAt: number;            // 关注时间戳 (ms)
  unfollowedAt?: number;         // 取关时间戳 (如果已取关)
  
  // === 来源追踪 ===
  source: FollowerSource;        // 来源渠道
  sourceEventId?: string;        // 关联的涨粉事件 ID
  
  // === 状态 ===
  isActive: boolean;             // 是否有效关系
  isMutual: boolean;             // 是否互相关注
  
  // === 分类 ===
  category: FanCategory;         // 粉丝分类
  tags?: string[];               // 用户自定义标签
  
  // === 互动数据 ===
  lastInteractionAt?: number;    // 最后互动时间
  interactionCount: number;      // 累计互动次数
}
```

### 2.2 涨粉来源枚举 (FollowerSource)

```typescript
enum FollowerSource {
  // 主动涨粉渠道
  CONTENT_EXPOSURE = 'content_exposure',     // 内容曝光
  HOT_TOPIC_FLOW = 'hot_topic_flow',         // 热搜流量
  PLATFORM_RECOMMEND = 'platform_recommend', // 平台推荐
  
  // 被动涨粉渠道
  INTERACTION_CONVERT = 'interaction_convert', // 互动转化
  REPOST_SPREAD = 'repost_spread',           // 转发扩散
  BIG_V_REFERRAL = 'big_v_referral',         // 大V导流
  
  // 特殊渠道
  INITIAL_SEED = 'initial_seed',             // 初始种子粉丝
  MANUAL = 'manual',                         // 手动添加
  IMPORT = 'import'                          // 导入
}
```

### 2.3 粉丝分类枚举 (FanCategory)

```typescript
enum FanCategory {
  CORE = 'core',           // 核心粉丝 (高活跃、高互动)
  ACTIVE = 'active',       // 活跃粉丝 (定期互动)
  NORMAL = 'normal',       // 普通粉丝 (偶尔互动)
  INACTIVE = 'inactive',   // 不活跃粉丝 (长期无互动)
  ZOMBIE = 'zombie'        // 僵尸粉 (从未互动)
}
```

---

### 2.4 粉丝画像 (FanProfile)

描述粉丝的详细画像信息。

```typescript
interface FanProfile {
  // === 主键 ===
  accountId: string;             // 账号 ID (关联 Account Service)
  
  // === 基础信息 ===
  nickname: string;              // 昵称
  avatar?: string;               // 头像 URL
  bio?: string;                  // 简介 (20字以内)
  
  // === 人口统计 ===
  gender: 'male' | 'female' | 'unknown';
  ageRange: '13-17' | '18-24' | '25-34' | '35-44' | '45+';
  region?: string;               // 地区 (省/市)
  
  // === 兴趣与行为 ===
  interests: string[];           // 兴趣标签 (最多5个)
  activityLevel: 'high' | 'medium' | 'low';
  
  // === 互动风格 ===
  interactionStyle: InteractionStyle;
  
  // === 关注信息 ===
  followReason?: string;         // 为什么关注 (10字以内)
  discoveryChannel?: string;     // 从哪里发现
  
  // === 元数据 ===
  generatedAt: number;           // 生成时间
  generatedBy: 'llm' | 'rule' | 'manual';
  sourceContext?: SourceContext; // 生成时的上下文
  
  // === 版本控制 ===
  version: number;               // 画像版本号
  lastUpdatedAt: number;         // 最后更新时间
}

interface InteractionStyle {
  commentFrequency: 'often' | 'sometimes' | 'rarely';
  commentStyle: 'supportive' | 'analytical' | 'humorous' | 'questioning';
  likeFrequency: 'always' | 'often' | 'sometimes';
  shareFrequency: 'often' | 'sometimes' | 'rarely';
}

interface SourceContext {
  followeeId: string;            // 被关注者 ID
  followeeDomain: string[];      // 被关注者领域
  followeeStyle: string;         // 被关注者风格
  source: FollowerSource;        // 涨粉来源
  sourceDetail?: string;         // 详细来源信息
}
```

---

### 2.5 涨粉事件 (FollowerGainEvent)

记录每次涨粉事件的详细信息。

```typescript
interface FollowerGainEvent {
  // === 主键 ===
  id: string;                    // 事件 ID (UUID)
  
  // === 事件主体 ===
  accountId: string;             // 受益账号 ID
  platformId: string;            // 平台 ID
  timestamp: number;             // 事件时间戳
  
  // === 涨粉来源 ===
  source: FollowerSource;
  sourceDetail: {
    postId?: string;             // 相关博文 ID
    topicId?: string;            // 相关话题 ID
    interactionId?: string;      // 相关互动 ID
    referrerId?: string;         // 导流账号 ID
    recommendType?: string;      // 推荐类型
  };
  
  // === 计算过程 ===
  calculation: {
    baseGain: number;            // 基础涨粉数
    qualityMultiplier: number;   // 质量系数
    timeDecay: number;           // 时间衰减
    randomFactor: number;        // 随机因子
    formula: string;             // 使用的公式
  };
  
  // === 结果 ===
  followerGain: number;          // 净增粉丝数
  newFollowerIds: string[];      // 新粉丝账号 ID 列表
  
  // === LLM 生成内容 ===
  story?: string;                // 涨粉故事 (50字以内)
  storyGeneratedAt?: number;     // 故事生成时间
}
```

---

### 2.6 账号成长数据 (AccountGrowth)

记录账号的整体成长统计。

```typescript
interface AccountGrowth {
  // === 主键 ===
  accountId: string;
  platformId: string;
  
  // === 当前统计 ===
  currentFollowers: number;      // 当前粉丝数
  currentFollowing: number;      // 当前关注数
  
  // === 历史数据 ===
  followerHistory: DailyStats[]; // 每日统计
  
  // === 涨粉来源分布 ===
  sourceDistribution: Record<FollowerSource, number>;
  
  // === 粉丝分类分布 ===
  categoryDistribution: Record<FanCategory, number>;
  
  // === 增长指标 ===
  metrics: GrowthMetrics;
  
  // === 里程碑 ===
  milestones: Milestone[];
  
  // === 更新时间 ===
  lastUpdatedAt: number;
}

interface DailyStats {
  date: string;                  // YYYY-MM-DD
  followers: number;             // 当日粉丝总数
  dailyGain: number;             // 当日新增
  dailyLoss: number;             // 当日取关
  engagementRate: number;        // 当日互动率
}

interface GrowthMetrics {
  avgDailyGain: number;          // 日均涨粉 (过去7天)
  avgDailyLoss: number;          // 日均取关 (过去7天)
  growthRate: number;            // 增长率 (过去30天)
  engagementRate: number;        // 平均互动率
  conversionRate: number;        // 平均转化率
  retentionRate: number;         // 粉丝留存率
}

interface Milestone {
  followerCount: number;         // 里程碑粉丝数 (100/1000/10000...)
  achievedAt: number;            // 达成时间
  celebrationStory?: string;     // 庆祝文案 (LLM 生成)
  notified: boolean;             // 是否已通知
}
```

---

## 3. 数据库表设计

### 3.1 IndexedDB 数据库结构

```typescript
const FANS_DB_CONFIG = {
  name: 'fans_service',
  version: 1,
  stores: [
    {
      name: 'fan_relations',
      keyPath: 'id',
      indexes: [
        { name: 'by_followee', keyPath: 'followeeId' },
        { name: 'by_follower', keyPath: 'followerId' },
        { name: 'by_followee_time', keyPath: ['followeeId', 'followedAt'] },
        { name: 'by_followee_source', keyPath: ['followeeId', 'source'] },
        { name: 'by_followee_category', keyPath: ['followeeId', 'category'] },
        { name: 'by_pair', keyPath: ['followerId', 'followeeId'], unique: true },
        { name: 'by_platform', keyPath: 'platformId' }
      ]
    },
    {
      name: 'fan_profiles',
      keyPath: 'accountId',
      indexes: [
        { name: 'by_generated_at', keyPath: 'generatedAt' },
        { name: 'by_activity_level', keyPath: 'activityLevel' }
      ]
    },
    {
      name: 'follower_gain_events',
      keyPath: 'id',
      indexes: [
        { name: 'by_account', keyPath: 'accountId' },
        { name: 'by_account_time', keyPath: ['accountId', 'timestamp'] },
        { name: 'by_source', keyPath: 'source' },
        { name: 'by_platform', keyPath: 'platformId' }
      ]
    },
    {
      name: 'account_growth',
      keyPath: ['accountId', 'platformId'],
      indexes: [
        { name: 'by_account', keyPath: 'accountId' },
        { name: 'by_platform', keyPath: 'platformId' }
      ]
    }
  ]
};
```

### 3.2 表详细说明

#### fan_relations 表

| 字段 | 类型 | 说明 | 索引 |
| ---- | ---- | ---- | ---- |
| id | string | 主键 | ✓ (主键) |
| followerId | string | 粉丝账号 ID | ✓ |
| followeeId | string | 被关注者 ID | ✓ |
| platformId | string | 平台 ID | ✓ |
| followedAt | number | 关注时间 | ✓ (复合) |
| source | string | 来源渠道 | ✓ (复合) |
| category | string | 粉丝分类 | ✓ (复合) |
| isActive | boolean | 是否有效 | - |
| isMutual | boolean | 是否互粉 | - |
| tags | string[] | 标签 | - |
| interactionCount | number | 互动次数 | - |

#### fan_profiles 表

| 字段 | 类型 | 说明 | 索引 |
| ---- | ---- | ---- | ---- |
| accountId | string | 主键 (账号 ID) | ✓ (主键) |
| nickname | string | 昵称 | - |
| avatar | string | 头像 | - |
| bio | string | 简介 | - |
| gender | string | 性别 | - |
| ageRange | string | 年龄段 | - |
| interests | string[] | 兴趣标签 | - |
| activityLevel | string | 活跃度 | ✓ |
| interactionStyle | object | 互动风格 | - |
| generatedAt | number | 生成时间 | ✓ |
| generatedBy | string | 生成方式 | - |

#### follower_gain_events 表

| 字段 | 类型 | 说明 | 索引 |
| ---- | ---- | ---- | ---- |
| id | string | 主键 | ✓ (主键) |
| accountId | string | 账号 ID | ✓ |
| platformId | string | 平台 ID | ✓ |
| timestamp | number | 事件时间 | ✓ (复合) |
| source | string | 来源 | ✓ |
| sourceDetail | object | 来源详情 | - |
| calculation | object | 计算过程 | - |
| followerGain | number | 涨粉数 | - |
| newFollowerIds | string[] | 新粉丝列表 | - |
| story | string | 涨粉故事 | - |

#### account_growth 表

| 字段 | 类型 | 说明 | 索引 |
| ---- | ---- | ---- | ---- |
| accountId | string | 账号 ID | ✓ (复合主键) |
| platformId | string | 平台 ID | ✓ (复合主键) |
| currentFollowers | number | 当前粉丝数 | - |
| followerHistory | object[] | 历史数据 | - |
| sourceDistribution | object | 来源分布 | - |
| categoryDistribution | object | 分类分布 | - |
| metrics | object | 增长指标 | - |
| milestones | object[] | 里程碑 | - |

---

## 4. 数据访问层 (FansDataStore)

### 4.1 接口定义

```typescript
export class FansDataStore {
  private db: IDBDatabase;
  
  // ===== 关系操作 =====
  
  async saveRelation(relation: FollowerRelation): Promise<void>;
  async updateRelation(id: string, updates: Partial<FollowerRelation>): Promise<void>;
  async deleteRelation(id: string): Promise<void>;
  async findRelation(followerId: string, followeeId: string): Promise<FollowerRelation | null>;
  
  async queryFollowers(
    followeeId: string,
    options: QueryOptions
  ): Promise<PaginatedResult<FollowerRelation>>;
  
  async queryFollowing(
    followerId: string,
    options: QueryOptions
  ): Promise<PaginatedResult<FollowerRelation>>;
  
  async countFollowers(followeeId: string): Promise<number>;
  async countFollowing(followerId: string): Promise<number>;
  
  // ===== 画像操作 =====
  
  async saveProfile(profile: FanProfile): Promise<void>;
  async updateProfile(accountId: string, updates: Partial<FanProfile>): Promise<void>;
  async getProfile(accountId: string): Promise<FanProfile | null>;
  async getProfiles(accountIds: string[]): Promise<FanProfile[]>;
  
  // ===== 事件操作 =====
  
  async saveGainEvent(event: FollowerGainEvent): Promise<void>;
  async queryGainEvents(
    accountId: string,
    options?: { limit?: number; source?: FollowerSource }
  ): Promise<FollowerGainEvent[]>;
  
  // ===== 成长数据操作 =====
  
  async getAccountGrowth(accountId: string, platformId?: string): Promise<AccountGrowth | null>;
  async updateAccountGrowth(accountId: string, platformId: string, updates: Partial<AccountGrowth>): Promise<void>;
  
  // ===== 统计查询 =====
  
  async getRelationshipStats(accountId: string): Promise<RelationshipStats>;
  async aggregateBySource(accountId: string): Promise<Record<FollowerSource, number>>;
  async aggregateByCategory(accountId: string): Promise<Record<FanCategory, number>>;
}
```

### 4.2 查询优化示例

```typescript
// 使用复合索引进行高效分页查询
async queryFollowers(
  followeeId: string,
  options: QueryOptions
): Promise<PaginatedResult<FollowerRelation>> {
  const tx = this.db.transaction('fan_relations', 'readonly');
  const store = tx.objectStore('fan_relations');
  
  // 选择合适的索引
  let index: IDBIndex;
  let range: IDBKeyRange;
  
  if (options.category) {
    // 按分类查询
    index = store.index('by_followee_category');
    range = IDBKeyRange.only([followeeId, options.category]);
  } else if (options.source) {
    // 按来源查询
    index = store.index('by_followee_source');
    range = IDBKeyRange.only([followeeId, options.source]);
  } else {
    // 按时间排序
    index = store.index('by_followee_time');
    range = IDBKeyRange.bound(
      [followeeId, 0],
      [followeeId, Date.now()]
    );
  }
  
  // 执行分页查询
  const direction = options.order === 'asc' ? 'next' : 'prev';
  const results: FollowerRelation[] = [];
  let cursor = await index.openCursor(range, direction);
  let skipped = 0;
  
  while (cursor && results.length < (options.limit || 20)) {
    if (skipped >= (options.offset || 0)) {
      if (this.matchesFilter(cursor.value, options)) {
        results.push(cursor.value);
      }
    } else {
      skipped++;
    }
    cursor = await cursor.continue();
  }
  
  // 获取总数
  const total = await this.countByIndex(index, range);
  
  return {
    items: results,
    total,
    hasMore: total > (options.offset || 0) + results.length
  };
}
```

---

## 5. 数据迁移

### 5.1 版本升级策略

```typescript
const MIGRATIONS: Record<number, (db: IDBDatabase) => void> = {
  // v1 -> v2: 添加互动统计字段
  2: (db) => {
    const tx = db.transaction('fan_relations', 'readwrite');
    const store = tx.objectStore('fan_relations');
    
    store.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const record = cursor.value;
        if (record.interactionCount === undefined) {
          record.interactionCount = 0;
          cursor.update(record);
        }
        cursor.continue();
      }
    };
  },
  
  // v2 -> v3: 添加新索引
  3: (db) => {
    const store = db.transaction('fan_relations', 'readwrite')
      .objectStore('fan_relations');
    
    if (!store.indexNames.contains('by_last_interaction')) {
      store.createIndex('by_last_interaction', 'lastInteractionAt');
    }
  }
};
```

---

## 6. 数据清理策略

### 6.1 过期数据清理

```typescript
interface CleanupConfig {
  // 涨粉事件保留天数
  eventRetentionDays: number;  // 默认 90 天
  
  // 历史统计保留天数
  historyRetentionDays: number;  // 默认 365 天
  
  // 僵尸粉自动清理
  zombieCleanupEnabled: boolean;
  zombieThresholdDays: number;   // 超过多少天无互动视为僵尸粉
}

async function cleanupOldData(config: CleanupConfig): Promise<CleanupResult> {
  const now = Date.now();
  const result = { eventsDeleted: 0, historyTrimmed: 0 };
  
  // 清理过期事件
  const eventCutoff = now - config.eventRetentionDays * 24 * 60 * 60 * 1000;
  const events = await dataStore.queryOldEvents(eventCutoff);
  for (const event of events) {
    await dataStore.deleteEvent(event.id);
    result.eventsDeleted++;
  }
  
  // 裁剪历史数据
  const historyCutoff = config.historyRetentionDays;
  const growthRecords = await dataStore.getAllAccountGrowth();
  for (const record of growthRecords) {
    if (record.followerHistory.length > historyCutoff) {
      record.followerHistory = record.followerHistory.slice(-historyCutoff);
      await dataStore.updateAccountGrowth(record.accountId, record.platformId, record);
      result.historyTrimmed++;
    }
  }
  
  return result;
}
```

---

## 7. 参考文档

- [粉丝服务概述](./README.md)
- [粉丝管理模块](./fans-management.md)
- [增长引擎](./growth-engine.md)
- [画像系统](./profile-system.md)
