# 实施计划 (Implementation Plan)

> **模块**: Fans Service / Implementation Plan  
> **版本**: 1.0  
> **状态**: 规划中  
> **预计总工时**: 22-29 小时

## 1. 概述

本文档描述粉丝服务的实施计划，包括分阶段任务、优先级、依赖关系和验收标准。

---

## 2. 实施阶段

### 2.1 阶段总览

```text
Phase 1: 基础设施 (6-8h)
├── 数据库表设计与创建
├── FansDataStore 实现
└── 基础类型定义

Phase 2: 粉丝管理 (3-4h)
├── FansManager 核心功能
├── 关注/取关操作
└── 查询接口

Phase 3: 增长引擎 (6-8h)
├── 六大涨粉渠道算法
├── 时间衰减模型
└── 事件处理集成

Phase 4: 画像系统 (4-5h)
├── ProfileGenerator 实现
├── LLM 任务集成
└── 规则生成回退

Phase 5: UI 集成 (4-5h)
├── 粉丝列表页面
├── 涨粉数据面板
├── 通知集成
└── 设置页面
```

---

## 3. Phase 1: 基础设施

**目标**: 搭建数据层基础，定义核心类型

**预计工时**: 6-8 小时

### 3.1 任务清单

| 任务 | 优先级 | 预估 | 负责 | 状态 |
| ---- | ------ | ---- | ---- | ---- |
| 定义核心类型 (types.ts) | 🔴 高 | 1h | - | 📋 待开始 |
| 创建 IndexedDB 数据库 | 🔴 高 | 2h | - | 📋 待开始 |
| 实现 FansDataStore | 🔴 高 | 3h | - | 📋 待开始 |
| 单元测试 | 🟡 中 | 1h | - | 📋 待开始 |

### 3.2 详细任务

#### 3.2.1 定义核心类型

**文件**: `src/services/fans/types.ts`

```typescript
// 需要定义的类型
export interface FollowerRelation { ... }
export interface FanProfile { ... }
export interface FollowerGainEvent { ... }
export interface AccountGrowth { ... }
export enum FollowerSource { ... }
export enum FanCategory { ... }
```

**验收标准**:
- [ ] 所有类型定义完整
- [ ] 与 data-model.md 保持一致
- [ ] 导出正确

#### 3.2.2 创建 IndexedDB 数据库

**文件**: `src/services/fans/database.ts`

```typescript
// 需要创建的表
const FANS_DB_STORES = [
  'fan_relations',
  'fan_profiles', 
  'follower_gain_events',
  'account_growth'
];
```

**验收标准**:
- [ ] 数据库初始化成功
- [ ] 所有索引创建正确
- [ ] 版本迁移逻辑正确

#### 3.2.3 实现 FansDataStore

**文件**: `src/services/fans/dataStore.ts`

```typescript
export class FansDataStore {
  // 关系操作
  async saveRelation(relation: FollowerRelation): Promise<void>;
  async queryFollowers(followeeId: string, options: QueryOptions): Promise<PaginatedResult<FollowerRelation>>;
  
  // 画像操作
  async saveProfile(profile: FanProfile): Promise<void>;
  async getProfile(accountId: string): Promise<FanProfile | null>;
  
  // 事件操作
  async saveGainEvent(event: FollowerGainEvent): Promise<void>;
  async queryGainEvents(accountId: string, options?: QueryOptions): Promise<FollowerGainEvent[]>;
  
  // 成长数据
  async getAccountGrowth(accountId: string): Promise<AccountGrowth | null>;
}
```

**验收标准**:
- [ ] 所有 CRUD 方法实现
- [ ] 分页查询正确
- [ ] 索引使用正确

---

## 4. Phase 2: 粉丝管理

**目标**: 实现粉丝关系的增删查改

**预计工时**: 3-4 小时

**依赖**: Phase 1

### 4.1 任务清单

| 任务 | 优先级 | 预估 | 依赖 | 状态 |
| ---- | ------ | ---- | ---- | ---- |
| 实现 FansManager 类 | 🔴 高 | 2h | Phase 1 | 📋 待开始 |
| 实现事件发布 | 🟡 中 | 0.5h | Fans | 📋 待开始 |
| 实现统计查询 | 🟡 中 | 1h | FansManager | 📋 待开始 |
| 与 Account Service 集成 | 🟡 中 | 0.5h | FansManager | 📋 待开始 |

### 4.2 详细任务

#### 4.2.1 实现 FansManager 类

**文件**: `src/services/fans/fansManager.ts`

```typescript
export class FansManager {
  // 核心方法
  async addFollower(followerId: string, followeeId: string, options?: AddFollowerOptions): Promise<FollowerRelation>;
  async removeFollower(followerId: string, followeeId: string): Promise<boolean>;
  async addFollowersBatch(followerIds: string[], followeeId: string, options?: AddFollowerOptions): Promise<FollowerRelation[]>;
  
  // 查询方法
  async getFollowers(accountId: string, options?: QueryOptions): Promise<PaginatedResult<FollowerRelation>>;
  async getFollowing(accountId: string, options?: QueryOptions): Promise<PaginatedResult<FollowerRelation>>;
  async isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  async isMutualFollowing(accountId1: string, accountId2: string): Promise<boolean>;
  
  // 统计
  async getStats(accountId: string): Promise<RelationshipStats>;
}
```

**验收标准**:
- [ ] 关注/取关正确处理
- [ ] 互粉状态自动更新
- [ ] 批量操作性能良好
- [ ] 事件正确发布

---

## 5. Phase 3: 增长引擎

**目标**: 实现六大涨粉渠道的算法

**预计工时**: 6-8 小时

**依赖**: Phase 2

### 5.1 任务清单

| 任务 | 优先级 | 预估 | 依赖 | 状态 |
| ---- | ------ | ---- | ---- | ---- |
| 实现 GrowthEngine 核心 | 🔴 高 | 1h | Phase 2 | 📋 待开始 |
| 内容曝光算法 | 🔴 高 | 1h | GrowthEngine | 📋 待开始 |
| 热搜流量算法 | 🟡 中 | 1h | GrowthEngine | 📋 待开始 |
| 互动转化算法 | 🟡 中 | 1h | GrowthEngine | 📋 待开始 |
| 转发扩散算法 | 🟡 中 | 0.5h | GrowthEngine | 📋 待开始 |
| 大V导流算法 | 🟡 中 | 1h | GrowthEngine | 📋 待开始 |
| 平台推荐算法 | 🟡 中 | 0.5h | GrowthEngine | 📋 待开始 |
| 时间衰减模型 | 🟡 中 | 0.5h | - | 📋 待开始 |
| 与微博 Store 集成 | 🔴 高 | 1.5h | 所有算法 | 📋 待开始 |

### 5.2 详细任务

#### 5.2.1 实现 GrowthEngine 核心

**文件**: `src/services/fans/growthEngine.ts`

```typescript
export class GrowthEngine {
  private config: GrowthEngineConfig;
  
  // 事件处理
  async processPostPublish(post: UniversalPost): Promise<FollowerGainEvent | null>;
  async processInteraction(interaction: SocialInteraction, targetPost: UniversalPost): Promise<FollowerGainEvent | null>;
  async processRepost(originalPost: UniversalPost, reposter: SocialAccount): Promise<FollowerGainEvent | null>;
  async processBigVInteraction(targetAccountId: string, bigV: SocialAccount, type: string): Promise<FollowerGainEvent | null>;
}
```

#### 5.2.2 与微博 Store 集成

**修改文件**: `src/apps/weibo/stores/feedStore.ts`

```typescript
// 在 publishPost 方法中添加
async function publishPost(post: UniversalPost) {
  // ... 现有逻辑 ...
  
  // 新增：计算涨粉
  const gainEvent = await growthEngine.processPostPublish(post);
  if (gainEvent) {
    await handleGainEvent(gainEvent);
  }
}
```

**验收标准**:
- [ ] 发布博文触发涨粉计算
- [ ] 热搜参与触发涨粉计算
- [ ] 被大V互动触发涨粉计算
- [ ] 涨粉事件正确保存

---

## 6. Phase 4: 画像系统

**目标**: 实现粉丝画像的 LLM 生成和规则生成

**预计工时**: 4-5 小时

**依赖**: Phase 3

### 6.1 任务清单

| 任务 | 优先级 | 预估 | 依赖 | 状态 |
| ---- | ------ | ---- | ---- | ---- |
| 实现 ProfileGenerator | 🔴 高 | 2h | Phase 3 | 📋 待开始 |
| 注册 LLM 任务 | 🟡 中 | 1h | ProfileGenerator | 📋 待开始 |
| 实现规则生成 | 🟡 中 | 1h | ProfileGenerator | 📋 待开始 |
| 混合生成策略 | 🟢 低 | 1h | 规则生成 | 📋 待开始 |

### 6.2 详细任务

#### 6.2.1 实现 ProfileGenerator

**文件**: `src/services/fans/profileGenerator.ts`

```typescript
export class ProfileGenerator {
  async generateProfile(context: SourceContext, options?: GenerateOptions): Promise<FanProfile>;
  async generateProfiles(context: SourceContext, count: number, options?: GenerateOptions): Promise<FanProfile[]>;
  generateProfileByRule(context: SourceContext): FanProfile;
}
```

#### 6.2.2 注册 LLM 任务

**文件**: `src/services/fans/llmTasks.ts`

```typescript
// 注册到 LLM Task Service
export function registerFansLLMTasks(): void {
  llmTaskStore.registerTask(PROFILE_GENERATE_TASK);
  llmTaskStore.registerTask(PROFILE_BATCH_TASK);
  llmTaskStore.registerTask(FOLLOWER_STORY_TASK);
  llmTaskStore.registerTask(MILESTONE_CELEBRATION_TASK);
}
```

**验收标准**:
- [ ] LLM 生成画像正确
- [ ] 批量生成优化调用次数
- [ ] 规则生成作为回退
- [ ] 生成的账号在 Account Service 中创建

---

## 7. Phase 5: UI 集成

**目标**: 在微博 App 中集成粉丝服务 UI

**预计工时**: 4-5 小时

**依赖**: Phase 4

### 7.1 任务清单

| 任务 | 优先级 | 预估 | 依赖 | 状态 |
| ---- | ------ | ---- | ---- | ---- |
| 粉丝列表页面 | 🔴 高 | 1.5h | Phase 4 | 📋 待开始 |
| 涨粉数据面板 | 🟡 中 | 1.5h | 粉丝列表 | 📋 待开始 |
| 涨粉通知集成 | 🟡 中 | 0.5h | 涨粉面板 | 📋 待开始 |
| 设置页面 | 🟢 低 | 0.5h | - | 📋 待开始 |

### 7.2 详细任务

#### 7.2.1 粉丝列表页面

**文件**: `src/apps/weibo/pages/FollowersPage.vue`

功能：
- 显示粉丝列表（头像、昵称、关注时间）
- 互粉标识
- 粉丝分类筛选
- 下拉刷新、上拉加载

#### 7.2.2 涨粉数据面板

**文件**: `src/apps/weibo/components/FollowerGrowthPanel.vue`

功能：
- 当前粉丝数 + 今日增长
- 涨粉来源分布图
- 最近涨粉事件列表
- 里程碑展示

#### 7.2.3 涨粉通知集成

**修改文件**: `src/apps/weibo/stores/notificationStore.ts`

```typescript
// 监听涨粉事件
eventBus.on('fans:gain', (event: FollowerGainEvent) => {
  if (event.followerGain >= 10) {
    notificationStore.push({
      type: 'follower_gain',
      title: `+${event.followerGain} 新粉丝`,
      body: event.story || `来自${getSourceLabel(event.source)}`
    });
  }
});
```

**验收标准**:
- [ ] 粉丝列表显示正确
- [ ] 涨粉数据面板数据准确
- [ ] 涨粉通知正常推送
- [ ] UI 响应流畅

---

## 8. 验收标准总览

### 8.1 功能验收

| 功能 | 验收标准 |
| ---- | -------- |
| 粉丝管理 | 关注/取关/查询功能正常 |
| 涨粉计算 | 发布博文后正确计算涨粉 |
| 画像生成 | LLM/规则生成画像正确 |
| 数据持久化 | 重启后数据不丢失 |
| UI 展示 | 粉丝列表、涨粉面板正常显示 |

### 8.2 性能验收

| 指标 | 目标 |
| ---- | ---- |
| 粉丝列表加载 | < 500ms (20条) |
| 涨粉计算 | < 100ms |
| 画像生成 (规则) | < 50ms |
| 画像生成 (LLM) | < 5s |
| 数据库查询 | < 200ms |

### 8.3 兼容性验收

- [ ] 与现有微博 App 功能兼容
- [ ] 与 Account Service 正确集成
- [ ] 与 LLM Task Service 正确集成
- [ ] 与通知系统正确集成

---

## 9. 风险与应对

### 9.1 已识别风险

| 风险 | 影响 | 概率 | 应对措施 |
| ---- | ---- | ---- | -------- |
| LLM 调用成本高 | 中 | 高 | 使用规则生成回退 |
| 数据库性能问题 | 高 | 中 | 优化索引、分页查询 |
| 与现有代码冲突 | 中 | 低 | 渐进式集成 |
| 涨粉算法不合理 | 中 | 中 | 参数可配置、A/B 测试 |

### 9.2 应对策略

1. **LLM 成本控制**
   - 仅大涨粉事件使用 LLM
   - 批量生成减少调用次数
   - 规则生成作为回退

2. **性能优化**
   - 使用复合索引
   - 分页查询
   - 缓存热数据

3. **渐进式集成**
   - 先实现独立服务
   - 再逐步集成到微博
   - 最后推广到其他 App

---

## 10. 里程碑

| 里程碑 | 完成标准 | 目标日期 |
| ------ | -------- | -------- |
| M1: 基础设施就绪 | Phase 1 完成 | - |
| M2: 粉丝管理可用 | Phase 2 完成 | - |
| M3: 涨粉引擎可用 | Phase 3 完成 | - |
| M4: 画像系统可用 | Phase 4 完成 | - |
| M5: 微博集成完成 | Phase 5 完成 | - |
| M6: 服务稳定运行 | 无重大 bug | - |

---

## 11. 参考文档

- [粉丝服务概述](./README.md)
- [增长引擎](./growth-engine.md)
- [粉丝管理模块](./fans-management.md)
- [画像系统](./profile-system.md)
- [数据模型详解](./data-model.md)
- [LLM 任务定义](./llm-tasks.md)
