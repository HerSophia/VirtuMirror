# 粉丝管理模块 (Fans Management)

> **模块**: Fans Service / Fans Management  
> **版本**: 1.0  
> **状态**: 设计阶段

## 1. 概述

粉丝管理模块负责处理账号之间的关注关系，包括关注/取关操作、粉丝列表查询、互粉检测等基础功能。它是粉丝服务的基础层，为增长引擎和画像系统提供数据支撑。

### 1.1 核心功能

- 关注/取关操作
- 粉丝/关注列表查询
- 互粉（互相关注）检测
- 粉丝分类与标签
- 关系变更事件通知

---

## 2. 数据模型

### 2.1 粉丝关系 (FollowerRelation)

```typescript
interface FollowerRelation {
  id: string;                    // 关系 ID
  followerId: string;            // 粉丝账号 ID
  followeeId: string;            // 被关注者账号 ID
  platformId: string;            // 平台 ID (weibo/bilibili/...)
  
  // 时间信息
  followedAt: number;            // 关注时间戳
  
  // 来源追踪
  source: FollowerSource;        // 来源渠道
  sourceEventId?: string;        // 关联的涨粉事件 ID
  
  // 状态
  isActive: boolean;             // 是否活跃粉丝
  isMutual: boolean;             // 是否互相关注
  
  // 分类标签
  tags?: string[];               // 用户自定义标签
  category?: FanCategory;        // 粉丝分类
}

// 粉丝分类
enum FanCategory {
  CORE = 'core',           // 核心粉丝（高活跃、高互动）
  ACTIVE = 'active',       // 活跃粉丝
  NORMAL = 'normal',       // 普通粉丝
  INACTIVE = 'inactive',   // 不活跃粉丝
  ZOMBIE = 'zombie'        // 僵尸粉（无互动记录）
}
```

### 2.2 关注关系统计 (RelationshipStats)

```typescript
interface RelationshipStats {
  accountId: string;
  platformId: string;
  
  // 基础统计
  followerCount: number;         // 粉丝数
  followingCount: number;        // 关注数
  mutualCount: number;           // 互粉数
  
  // 分类统计
  categoryDistribution: Record<FanCategory, number>;
  
  // 来源统计
  sourceDistribution: Record<FollowerSource, number>;
  
  // 时间统计
  todayGain: number;             // 今日新增
  todayLoss: number;             // 今日取关
  weeklyGain: number;            // 本周新增
  weeklyLoss: number;            // 本周取关
  
  lastUpdated: number;
}
```

---

## 3. 服务接口

### 3.1 FansManager 类

```typescript
export class FansManager {
  private dataStore: FansDataStore;
  private eventBus: EventBus;
  
  // ===== 关注操作 =====
  
  /**
   * 添加关注关系（某人成为某人的粉丝）
   */
  async addFollower(
    followerId: string,
    followeeId: string,
    options?: AddFollowerOptions
  ): Promise<FollowerRelation> {
    // 检查是否已存在
    const existing = await this.getRelation(followerId, followeeId);
    if (existing) {
      throw new Error('Already following');
    }
    
    // 检查是否互相关注
    const reverseRelation = await this.getRelation(followeeId, followerId);
    const isMutual = !!reverseRelation;
    
    // 创建关系
    const relation: FollowerRelation = {
      id: generateId(),
      followerId,
      followeeId,
      platformId: options?.platformId || 'default',
      followedAt: Date.now(),
      source: options?.source || FollowerSource.MANUAL,
      sourceEventId: options?.sourceEventId,
      isActive: true,
      isMutual,
      tags: options?.tags,
      category: FanCategory.NORMAL
    };
    
    await this.dataStore.saveRelation(relation);
    
    // 如果是互粉，更新对方的关系
    if (isMutual && reverseRelation) {
      await this.dataStore.updateRelation(reverseRelation.id, { isMutual: true });
    }
    
    // 发送事件
    this.eventBus.emit('fans:follower:added', {
      followerId,
      followeeId,
      relation
    });
    
    return relation;
  }
  
  /**
   * 移除关注关系（取消关注）
   */
  async removeFollower(
    followerId: string,
    followeeId: string
  ): Promise<boolean> {
    const relation = await this.getRelation(followerId, followeeId);
    if (!relation) {
      return false;
    }
    
    await this.dataStore.deleteRelation(relation.id);
    
    // 如果之前是互粉，更新对方的关系
    if (relation.isMutual) {
      const reverseRelation = await this.getRelation(followeeId, followerId);
      if (reverseRelation) {
        await this.dataStore.updateRelation(reverseRelation.id, { isMutual: false });
      }
    }
    
    // 发送事件
    this.eventBus.emit('fans:follower:removed', {
      followerId,
      followeeId,
      relationId: relation.id
    });
    
    return true;
  }
  
  /**
   * 批量添加粉丝（用于涨粉事件）
   */
  async addFollowersBatch(
    followerIds: string[],
    followeeId: string,
    options?: AddFollowerOptions
  ): Promise<FollowerRelation[]> {
    const relations: FollowerRelation[] = [];
    
    for (const followerId of followerIds) {
      try {
        const relation = await this.addFollower(followerId, followeeId, options);
        relations.push(relation);
      } catch (e) {
        // 跳过已存在的关系
        console.warn(`Skip existing follower: ${followerId}`);
      }
    }
    
    return relations;
  }
  
  // ===== 查询操作 =====
  
  /**
   * 获取粉丝列表
   */
  async getFollowers(
    accountId: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<FollowerRelation>> {
    return this.dataStore.queryFollowers(accountId, {
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      sortBy: options?.sortBy || 'followedAt',
      order: options?.order || 'desc',
      category: options?.category,
      source: options?.source,
      isActive: options?.isActive
    });
  }
  
  /**
   * 获取关注列表
   */
  async getFollowing(
    accountId: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<FollowerRelation>> {
    return this.dataStore.queryFollowing(accountId, {
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      sortBy: options?.sortBy || 'followedAt',
      order: options?.order || 'desc'
    });
  }
  
  /**
   * 获取互粉列表
   */
  async getMutualFollowers(
    accountId: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<FollowerRelation>> {
    return this.dataStore.queryFollowers(accountId, {
      ...options,
      isMutual: true
    });
  }
  
  /**
   * 检查关注关系
   */
  async isFollowing(
    followerId: string,
    followeeId: string
  ): Promise<boolean> {
    const relation = await this.getRelation(followerId, followeeId);
    return !!relation;
  }
  
  /**
   * 检查是否互相关注
   */
  async isMutualFollowing(
    accountId1: string,
    accountId2: string
  ): Promise<boolean> {
    const relation1 = await this.getRelation(accountId1, accountId2);
    const relation2 = await this.getRelation(accountId2, accountId1);
    return !!(relation1 && relation2);
  }
  
  /**
   * 获取单个关注关系
   */
  async getRelation(
    followerId: string,
    followeeId: string
  ): Promise<FollowerRelation | null> {
    return this.dataStore.findRelation(followerId, followeeId);
  }
  
  // ===== 统计查询 =====
  
  /**
   * 获取关系统计
   */
  async getStats(accountId: string): Promise<RelationshipStats> {
    return this.dataStore.getRelationshipStats(accountId);
  }
  
  /**
   * 获取粉丝数
   */
  async getFollowerCount(accountId: string): Promise<number> {
    return this.dataStore.countFollowers(accountId);
  }
  
  /**
   * 获取关注数
   */
  async getFollowingCount(accountId: string): Promise<number> {
    return this.dataStore.countFollowing(accountId);
  }
  
  // ===== 分类管理 =====
  
  /**
   * 更新粉丝分类
   */
  async updateCategory(
    relationId: string,
    category: FanCategory
  ): Promise<void> {
    await this.dataStore.updateRelation(relationId, { category });
  }
  
  /**
   * 批量更新分类（基于活跃度自动分类）
   */
  async autoClassifyFollowers(accountId: string): Promise<void> {
    const followers = await this.dataStore.queryAllFollowers(accountId);
    
    for (const relation of followers) {
      const category = await this.calculateCategory(relation);
      if (category !== relation.category) {
        await this.dataStore.updateRelation(relation.id, { category });
      }
    }
  }
  
  /**
   * 添加/移除标签
   */
  async updateTags(
    relationId: string,
    tags: string[]
  ): Promise<void> {
    await this.dataStore.updateRelation(relationId, { tags });
  }
  
  // ===== 私有方法 =====
  
  private async calculateCategory(
    relation: FollowerRelation
  ): Promise<FanCategory> {
    // 获取互动数据
    const interactions = await this.getFollowerInteractions(
      relation.followerId,
      relation.followeeId
    );
    
    const daysSinceFollow = (Date.now() - relation.followedAt) / (1000 * 60 * 60 * 24);
    const interactionRate = interactions.length / Math.max(1, daysSinceFollow);
    
    if (interactionRate >= 0.5) {
      return FanCategory.CORE;
    } else if (interactionRate >= 0.1) {
      return FanCategory.ACTIVE;
    } else if (interactions.length > 0) {
      return FanCategory.NORMAL;
    } else if (daysSinceFollow > 30) {
      return FanCategory.ZOMBIE;
    } else {
      return FanCategory.INACTIVE;
    }
  }
}
```

### 3.2 配置与选项

```typescript
interface AddFollowerOptions {
  platformId?: string;
  source?: FollowerSource;
  sourceEventId?: string;
  tags?: string[];
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'followedAt' | 'activityLevel';
  order?: 'asc' | 'desc';
  category?: FanCategory;
  source?: FollowerSource;
  isActive?: boolean;
  isMutual?: boolean;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}
```

---

## 4. 事件系统

### 4.1 事件类型

```typescript
// 粉丝管理相关事件
type FansEvent =
  | { type: 'fans:follower:added'; data: FollowerAddedEvent }
  | { type: 'fans:follower:removed'; data: FollowerRemovedEvent }
  | { type: 'fans:follower:updated'; data: FollowerUpdatedEvent }
  | { type: 'fans:batch:completed'; data: BatchCompletedEvent };

interface FollowerAddedEvent {
  followerId: string;
  followeeId: string;
  relation: FollowerRelation;
}

interface FollowerRemovedEvent {
  followerId: string;
  followeeId: string;
  relationId: string;
}

interface FollowerUpdatedEvent {
  relationId: string;
  changes: Partial<FollowerRelation>;
}

interface BatchCompletedEvent {
  followeeId: string;
  addedCount: number;
  relations: FollowerRelation[];
}
```

### 4.2 事件订阅示例

```typescript
// 监听新粉丝事件
eventBus.on('fans:follower:added', (event) => {
  console.log(`${event.followerId} 关注了 ${event.followeeId}`);
  
  // 触发通知
  notificationService.push({
    type: 'new_follower',
    title: '新粉丝',
    body: `有人关注了你`
  });
});

// 监听取关事件
eventBus.on('fans:follower:removed', (event) => {
  console.log(`${event.followerId} 取消关注了 ${event.followeeId}`);
});
```

---

## 5. 与其他模块的集成

### 5.1 与增长引擎集成

```typescript
// 增长引擎处理涨粉事件后，调用粉丝管理添加关系
async function handleGrowthEvent(event: FollowerGainEvent) {
  // 生成新粉丝账号
  const newFollowers = await profileGenerator.generateProfiles(
    event.accountId,
    event.followerGain,
    { source: event.source }
  );
  
  // 批量添加关注关系
  await fansManager.addFollowersBatch(
    newFollowers.map(f => f.accountId),
    event.accountId,
    {
      source: event.source,
      sourceEventId: event.id
    }
  );
}
```

### 5.2 与 Account Service 集成

```typescript
// 同步粉丝数到账号服务
eventBus.on('fans:follower:added', async (event) => {
  const count = await fansManager.getFollowerCount(event.followeeId);
  await accountService.updateAccountStats(event.followeeId, {
    followers: count
  });
});

eventBus.on('fans:follower:removed', async (event) => {
  const count = await fansManager.getFollowerCount(event.followeeId);
  await accountService.updateAccountStats(event.followeeId, {
    followers: count
  });
});
```

---

## 6. 数据库设计

### 6.1 IndexedDB 表结构

```typescript
// fan_relations 表
const fanRelationsSchema = {
  name: 'fan_relations',
  keyPath: 'id',
  indexes: [
    { name: 'by_followee', keyPath: 'followeeId' },
    { name: 'by_follower', keyPath: 'followerId' },
    { name: 'by_followee_source', keyPath: ['followeeId', 'source'] },
    { name: 'by_followee_category', keyPath: ['followeeId', 'category'] },
    { name: 'by_followee_time', keyPath: ['followeeId', 'followedAt'] },
    { name: 'by_pair', keyPath: ['followerId', 'followeeId'], unique: true }
  ]
};
```

### 6.2 查询优化

```typescript
// 使用复合索引进行高效查询
async function queryFollowers(
  accountId: string,
  options: QueryOptions
): Promise<FollowerRelation[]> {
  const tx = db.transaction('fan_relations', 'readonly');
  const store = tx.objectStore('fan_relations');
  
  // 使用 by_followee_time 索引进行时间排序查询
  const index = store.index('by_followee_time');
  const range = IDBKeyRange.bound(
    [accountId, 0],
    [accountId, Date.now()]
  );
  
  const results: FollowerRelation[] = [];
  let cursor = await index.openCursor(range, options.order === 'desc' ? 'prev' : 'next');
  
  let skipped = 0;
  while (cursor && results.length < options.limit) {
    if (skipped >= options.offset) {
      // 应用过滤条件
      if (matchesFilter(cursor.value, options)) {
        results.push(cursor.value);
      }
    } else {
      skipped++;
    }
    cursor = await cursor.continue();
  }
  
  return results;
}
```

---

## 7. 使用示例

### 7.1 基本用法

```typescript
const fansManager = FansManager.getInstance();

// 添加粉丝关系
await fansManager.addFollower('user_001', 'player_account', {
  source: FollowerSource.CONTENT_EXPOSURE
});

// 获取粉丝列表
const followers = await fansManager.getFollowers('player_account', {
  limit: 20,
  sortBy: 'followedAt',
  order: 'desc'
});

// 检查关注状态
const isFollowing = await fansManager.isFollowing('user_001', 'player_account');
console.log(`是否关注: ${isFollowing}`);

// 获取统计数据
const stats = await fansManager.getStats('player_account');
console.log(`粉丝数: ${stats.followerCount}, 今日新增: ${stats.todayGain}`);
```

### 7.2 在微博 App 中使用

```vue
<template>
  <div class="followers-list">
    <div class="stats">
      <span>{{ stats.followerCount }} 粉丝</span>
      <span v-if="stats.todayGain > 0" class="gain">+{{ stats.todayGain }}</span>
    </div>
    
    <div v-for="relation in followers" :key="relation.id" class="follower-item">
      <Avatar :account-id="relation.followerId" />
      <span class="name">{{ getAccountName(relation.followerId) }}</span>
      <span class="time">{{ formatTime(relation.followedAt) }}</span>
      <span v-if="relation.isMutual" class="mutual">互相关注</span>
    </div>
    
    <button v-if="hasMore" @click="loadMore">加载更多</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { FansManager } from '@/services/fans';

const fansManager = FansManager.getInstance();
const followers = ref([]);
const stats = ref({});
const hasMore = ref(true);
const offset = ref(0);

onMounted(async () => {
  stats.value = await fansManager.getStats('player_account');
  await loadFollowers();
});

async function loadFollowers() {
  const result = await fansManager.getFollowers('player_account', {
    limit: 20,
    offset: offset.value
  });
  
  followers.value.push(...result.items);
  hasMore.value = result.hasMore;
  offset.value += result.items.length;
}

function loadMore() {
  loadFollowers();
}
</script>
```

---

## 8. 参考文档

- [粉丝服务概述](./README.md)
- [增长引擎](./growth-engine.md)
- [画像系统](./profile-system.md)
- [数据模型详解](./data-model.md)
