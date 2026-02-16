# Social Graph Service 架构设计

> **版本**: v1.0  
> **最后更新**: 2026-02-07

## 1. 整体架构

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           应用层 (App Skins)                             │
│          Weibo / Bilibili / Zhihu / IM / Fans / Feed / ...             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Social Graph Service (Core)                         │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ RelationManager  │  │ GraphQueryEngine │  │ RecommendationEngine │  │
│  │ 关系写入与约束      │  │ 关系查询与遍历      │  │ 关注推荐            │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ StatsAggregator  │  │ PolicyGuard      │  │ SocialGraphEventBridge│ │
│  │ 关系统计聚合        │  │ 规则校验            │  │ 关系事件广播         │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┬───────────────────┐
          ▼                     ▼                     ▼                   ▼
   Account Service        Interaction Service      IndexedDB         EventBus/Logger
   (账号校验)             (互动信号)               social_relations  (事件与可观测)
                                                  relation_stats
```

## 2. 核心组件职责

### 2.1 RelationManager

- 提供 `follow/unfollow/block/mute` 写操作
- 保证关系约束（如拉黑后自动取关）
- 执行幂等写入和冲突处理

### 2.2 GraphQueryEngine

- 提供粉丝、关注、互关查询
- 提供 `isFollowing/isBlocked/isMuted` 判定
- 支持分页和按平台过滤

### 2.3 RecommendationEngine

- 计算候选关注账号
- 支持基础策略：共同关注、共同粉丝、互动相似度
- 支持策略权重配置

### 2.4 StatsAggregator

- 聚合账号关系统计数据
- 输出粉丝数、关注数、互关数、拉黑数、静音数
- 支持增量更新和重建

### 2.5 PolicyGuard

- 统一处理关系策略
- 典型规则：
  - 不能关注自己
  - 被拉黑时禁止关注
  - `block` 优先级高于 `follow`
  - 可配置是否允许跨平台关系

### 2.6 SocialGraphEventBridge

- 发布 `social:relation:*` 事件
- 供 Feed/Fans/Notification 订阅
- 与 Logger Service 联动记录关键链路

## 3. 关键数据流

### 3.1 关注流程

1. App 调用 `follow(fromId, toId, platformId)`
2. PolicyGuard 校验关系规则
3. RelationManager 写入 `follow` 边
4. StatsAggregator 更新双方统计
5. EventBridge 发布 `social:relation:followed`

### 3.2 拉黑流程

1. App 调用 `block(fromId, toId)`
2. 写入 `block` 边并标记生效
3. 自动清理互相关注边（可配置）
4. 发布 `social:relation:blocked`
5. Feed/Fans 等服务消费事件并刷新缓存

### 3.3 推荐关注流程

1. App 调用 `getRecommendedFollows(accountId)`
2. QueryEngine 拉取 1-2 跳邻居候选
3. RecommendationEngine 结合互动信号打分
4. 过滤已关注/已拉黑账号
5. 返回推荐结果及推荐理由

## 4. 存储模型

| 表 | 说明 | 核心字段 |
| ---- | ---- | ---- |
| `social_relations` | 关系边表 | `id`, `fromId`, `toId`, `platformId`, `type`, `status`, `createdAt`, `updatedAt` |
| `social_relation_stats` | 关系统计表 | `accountId`, `platformId`, `followers`, `following`, `mutualFollows`, `blocks`, `mutes`, `updatedAt` |
| `social_recommendation_cache` | 推荐缓存（可选） | `accountId`, `platformId`, `items`, `generatedAt`, `ttl` |

建议索引：

- `social_relations.[fromId+platformId+type+status]`
- `social_relations.[toId+platformId+type+status]`
- `social_relations.[fromId+toId+platformId+type]`（唯一约束）
- `social_relation_stats.[accountId+platformId]`（唯一约束）

## 5. 事件模型

| 事件 | 触发时机 | 关键字段 |
| ---- | ---- | ---- |
| `social:relation:followed` | 关注成功后 | `fromId`, `toId`, `platformId` |
| `social:relation:unfollowed` | 取消关注后 | `fromId`, `toId`, `platformId` |
| `social:relation:blocked` | 拉黑成功后 | `fromId`, `toId`, `scope` |
| `social:relation:muted` | 静音成功后 | `fromId`, `toId`, `scope` |
| `social:stats:updated` | 统计刷新后 | `accountId`, `platformId`, `stats` |

## 6. 可扩展点

- 推荐策略扩展：注册新的打分器和过滤器
- 关系策略扩展：按平台注册自定义规则
- 数据源扩展：引入 Vector Store 提升相似账号推荐
- 事件扩展：补充增长事件给 Fans Service

## 7. 非目标（v1）

- 不实现群组/社群图谱
- 不实现跨平台身份自动合并
- 不引入重型图数据库
- 不直接替代 Fans Service 的增长模拟逻辑
