# Social Graph Service 系统集成

> **版本**: v1.0  
> **最后更新**: 2026-02-07

本文档说明 Social Graph Service 与其他系统服务的集成关系和推荐接入方式。

## 1. 依赖关系图

```text
                    ┌────────────────────────────────────┐
                    │      Social Graph Service          │
                    └────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Account Service │      │ Interaction     │      │ EventBus        │
│                 │      │ Service         │      │ + Logger        │
│ • 账号校验      │      │ • 互动信号      │      │ • 事件广播      │
│ • 账号属性      │      │ • 偏好特征      │      │ • 可观测性      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Feed Service    │      │ Fans Service    │      │ Notification    │
│ • 关注流候选    │      │ 粉丝增长联动    │      │ 新关注提醒      │
│ • 社交信号排序  │      │ 关系变更消费    │      │ 风控提醒        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## 2. 与 Account Service 集成

### 2.1 依赖职责

- 校验 `fromId/toId` 是否存在
- 获取账号基础元信息（平台归属、角色类型）
- 提供账号禁用/注销状态，防止无效关系写入

### 2.2 建议调用顺序

1. `AccountService.getPlatformAccount()` 校验账号有效
2. `SocialGraphService.follow()` 执行关系写入
3. 关系成功后触发事件给下游服务

## 3. 与 Interaction Service 集成

### 3.1 集成目标

- 将互动行为作为推荐特征
- 发现高频互动账号并提升推荐权重

### 3.2 示例

```typescript
import { interactionService } from '@/services/interaction';
import { socialGraphService } from '@/services/socialGraph';

interactionService.onInteraction(async (event) => {
  if (event.type !== 'like' && event.type !== 'comment') return;

  const recommendations = await socialGraphService.getRecommendedFollows(event.userId, {
    platformId: event.platformId,
    limit: 20,
  });

  // 可选：将结果写入推荐缓存，减少页面首次打开延迟
  // await recommendationCache.set(event.userId, recommendations)
});
```

## 4. 与 Feed Service 集成

### 4.1 集成目标

- 获取关注列表作为关注流候选
- 利用互关关系提升社交分数

### 4.2 示例

```typescript
import { feedService } from '@/services/feed';
import { SystemContentProvider } from '@/services/feed';

// FeedService 默认已经挂载 SystemContentProvider。
// 如需显式覆盖，可手动设置：
feedService.setContentProvider(new SystemContentProvider());
```

`SystemContentProvider` 在关注流场景下会调用：

- `socialGraphService.getFollowing(userId, { platformId, ... })`
- `socialGraphService.getRelationshipStats(userId, platformId)`（用于社交分数上下文）

## 4.3 事件协同（推荐）

建议 Feed 侧订阅以下事件以做缓存失效：

- `social:relation:followed`
- `social:relation:unfollowed`
- `social:relation:blocked`
- `social:relation:muted`

## 5. 与 Fans Service 集成

### 5.1 边界建议

| 维度 | Social Graph Service | Fans Service |
| ---- | ---- | ---- |
| 目标 | 维护关系边 | 模拟增长和粉丝画像 |
| 数据 | follow/block/mute | 来源、画像、增长事件 |
| 算法 | 图关系算法 | 增长算法、LLM 画像 |

### 5.2 推荐联动

- Fans Service 写入新粉丝时调用 `follow()`
- Social Graph Service 发布关系事件供 Fans Service 订阅
- Fans Service 增长事件可回写推荐权重

## 6. 与 EventBus / Logger 集成

### 6.1 建议事件命名

- `social:relation:followed`
- `social:relation:unfollowed`
- `social:relation:blocked`
- `social:relation:muted`
- `social:stats:updated`

### 6.2 日志建议

- 命名空间：`social-graph:write`, `social-graph:query`, `social-graph:recommend`
- 关键日志：关系写入、统计更新、推荐耗时、批量失败详情、关系事件回调异常

## 7. 迁移建议

### 7.1 迁移来源

- App 内部关系逻辑（微博关注逻辑）
- Account Service 中非实体职责的关系代码
- Fans Service 内部可复用的关系写入逻辑

### 7.2 迁移步骤

1. 先接入查询 API，不改写现有写路径
2. 引入关系事件并验证下游影响
3. 切换写路径到 Social Graph Service
4. 清理旧实现，保留兼容层一段时间
