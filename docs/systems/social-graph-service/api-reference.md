# Social Graph Service API 参考

> **版本**: v1.0  
> **最后更新**: 2026-02-07

## 1. 关系写入 API

| 方法 | 参数 | 返回 | 说明 |
| ---- | ---- | ---- | ---- |
| `follow(fromId, toId, options)` | `fromId: string`, `toId: string`, `options: FollowOptions` | `Promise<void>` | 创建关注关系 |
| `unfollow(fromId, toId, platformId)` | `string, string, string` | `Promise<void>` | 取消关注 |
| `block(fromId, toId, options?)` | `string, string, BlockOptions?` | `Promise<void>` | 拉黑账号，可配置自动取关 |
| `unblock(fromId, toId, options?)` | `string, string, BlockOptions?` | `Promise<void>` | 解除拉黑 |
| `mute(fromId, toId, options?)` | `string, string, MuteOptions?` | `Promise<void>` | 静音账号 |
| `unmute(fromId, toId, options?)` | `string, string, MuteOptions?` | `Promise<void>` | 解除静音 |
| `batchFollow(fromId, toIds, options)` | `string, string[], BatchFollowOptions` | `Promise<BatchFollowResult>` | 批量关注 |

### 1.1 行为约束

- 不能关注自己，否则抛出 `SELF_FOLLOW_NOT_ALLOWED`
- `follow` 是幂等操作，已关注时直接返回
- 关系冲突优先级：`block > follow > mute`
- `block` 的默认行为：同平台自动取消双方关注

## 2. 关系查询 API

| 方法 | 参数 | 返回 | 说明 |
| ---- | ---- | ---- | ---- |
| `getFollowers(accountId, options?)` | `string, RelationQueryOptions?` | `Promise<RelationPageResult>` | 获取粉丝列表 |
| `getFollowing(accountId, options?)` | `string, RelationQueryOptions?` | `Promise<RelationPageResult>` | 获取关注列表 |
| `getMutualFollows(accountId, options?)` | `string, RelationQueryOptions?` | `Promise<GraphAccountNode[]>` | 获取互关账号 |
| `isFollowing(fromId, toId, platformId)` | `string, string, string` | `Promise<boolean>` | 是否关注 |
| `isBlocked(fromId, toId, platformId?)` | `string, string, string?` | `Promise<boolean>` | 是否拉黑 |
| `isMuted(fromId, toId, platformId?)` | `string, string, string?` | `Promise<boolean>` | 是否静音 |

### 2.1 分页说明

- 支持 `offset/limit` 和 `cursor` 两种分页方式
- `cursor` 优先于 `offset`
- 返回值 `hasMore` 表示是否还有下一页

## 3. 统计与推荐 API

| 方法 | 参数 | 返回 | 说明 |
| ---- | ---- | ---- | ---- |
| `getRelationshipStats(accountId, platformId)` | `string, string` | `Promise<RelationshipStats>` | 查询关系统计 |
| `getRecommendedFollows(accountId, options)` | `string, RecommendationOptions` | `Promise<FollowRecommendation[]>` | 获取推荐关注 |

### 3.1 推荐排序策略（v1）

推荐分数由以下维度加权组成：

```text
score =
  0.45 * mutualFollows
+ 0.25 * mutualFollowers
+ 0.20 * interactionSimilarity
+ 0.10 * recencyBoost
```

- 去除已关注、已拉黑、已静音账号
- 支持 `minScore` 作为最低推荐阈值

## 4. 事件 API

| 方法 | 参数 | 返回 | 说明 |
| ---- | ---- | ---- | ---- |
| `onRelationChange(callback)` | `(event: SocialRelationEvent) => void` | `() => void` | 订阅关系事件，返回取消订阅函数 |

### 4.1 事件契约

```typescript
interface SocialRelationEvent {
  type: SocialRelationEventType;
  fromId?: string;
  toId?: string;
  accountId?: string;
  platformId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}
```

## 5. 错误处理

| 错误码 | 场景 | 建议处理 |
| ---- | ---- | ---- |
| `SELF_FOLLOW_NOT_ALLOWED` | 关注自己 | 前端拦截并提示 |
| `RELATION_BLOCKED` | 被拉黑后尝试关注 | 显示不可关注提示 |
| `ACCOUNT_NOT_FOUND` | 账号不存在 | 刷新账号数据后重试 |
| `INVALID_PLATFORM` | 平台 ID 非法 | 检查调用上下文 |
| `BATCH_PARTIAL_FAILED` | 批量操作部分失败 | 提示失败列表并允许重试 |
