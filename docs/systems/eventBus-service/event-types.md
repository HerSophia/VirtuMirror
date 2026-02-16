# 事件总线服务 - 事件类型

> 本文档定义事件总所有预定义的系统事件类型。

## 1. 事件命名规范

### 1.1 命名格式

```text
{domain}:{entity}:{action}
```

- **domain**: 领域（如 content、interaction、session）
- **entity**: 实体（如 post、comment、user）
- **action**: 动作（如 created、updated、deleted）

### 1.2 命名示例

| 事件名 | 说明 |
| -------- | ------ |
| `content:post:created` | 帖子创建 |
| `interaction:like` | 点赞行为 |
| `session:changed` | 会话切换 |
| `llm:task:completed` | LLM 任务完成 |

---

## 2. 系统事件分类

```typescript
// 系统事件类型联合
type SystemEvent =
  // 会话相关
  | SessionEvent
  // 内容相关
  | ContentEvent
  // 互动相关
  | InteractionEvent
  // 用户相关
  | AccountEvent
  // 系统相关
  | SystemCoreEvent;
```

---

## 3. 会话相关事件

### 3.1 事件列表

| 事件名 | 说明 | 触机 |
| -------- | ------ | ---------- |
| `session:changed` | 会话切换 | 用户切换到另一个角色卡会话 |
| `session:message:new` | 新消息 | 收到新的聊天消息 |
| `session:message:updated` | 消息更新 | 消息内容被编辑 |
| `session:swipe:changed` | Swipe 切换 | 用户切换了消息的 swipe 版本 |

### 3.2 Payload 类型定义

```typescript
// 会话切换事件
interface SessionChangedEvent {
  /** 新会话 ID */
  sessionId: string;
  /** 前一个会话 ID */
  previousSessionId?: string;
  /** 角色名称 */
  characterName?: string;
}

// 新消息事件
interface SessionMessageNewEvent {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 楼层号 */
  floorId: number;
  /** 发送者 */
  sender: 'user' | 'character' | 'system';
  /** 消息内容预览 */
  preview?: string;
}

// 消息更新事件
interface SessionMessageUpdatedEvent {
  sessionId: string;
  messageId: string;
  floorId: number;
  /** 更新类型 */
  updateType: 'edit' | 'regenerate';
}

// Swipe 切换事件
interface SessionSwipeChangedEvent {
  sessionId: string;
  messageId: string;
  floorId: number;
  /** 当前 swipe 索引 */
  swipeIndex: number;
  /** 总 swipe 数量 */
  totalSwipes: number;
}
```

---

## 4. 内容相关事件

### 4.1 事件列表

| 事件名 | 说明 | 触发时机 |
| -------- | ------ | ---------- |
| `content:post:created` | 帖子创建 | 新帖子被生成或发布 |
| `content:post:updated` | 帖子更新 | 帖子内容或状态更新 |
| `content:post:deleted` | 帖子删除 | 帖子被删除 |
| `content:comment:created` | 评论创建 | 新评论生成 |
| `content:trending:updated` | 热搜更新 | 热搜榜单刷新 |
| `content:feed:refreshed` | 信息流刷新 | Feed 内容刷新 |

### 4.2 Payload 类型定义

```typescript
// 帖子创建事件
interface PostCreatedEvent {
  /** 帖子 ID */
  postId: string;
  /** 作者 ID */
  authorId: string;
  /** 平台 ID */
  platformId: string;
  /** 创建时间戳 */
  timestamp: number;
  /** 内容类型 */
  contentType?: 'text' | 'image' | 'video' | 'article';
  /** 关联话题 */
  topics?: string[];
}

// 帖子更新事件
interface PostUpdatedEvent {
  postId: string;
  platformId: string;
  /** 更新的字段 */
  updatedFields: string[];
  /** 新状态 */
  newStatus?: 'published' | 'draft' | 'hidden';
}

// 帖子删除事件
interface PostDeletedEvent {
  postId: string;
  platformId: string;
  authorId: string;
  /** 删除原因 */
  reason?: string;
}

// 评论创建事件
interface CommentCreatedEvent {
  /** 评论 ID */
  commentId: string;
  /** 所属帖子 ID */
  postId: string;
  /** 评论者 ID */
  authorId: string;
  /** 平台 ID */
  platformId: string;
  /** 是否是回复 */
  isReply: boolean;
  /** 回复的评论 ID */
  replyToCommentId?: string;
  /** 时间戳 */
  timestamp: number;
}

// 热搜更新事件
interface TrendingUpdatedEvent {
  /** 平台 ID */
  platformId: string;
  /** 热搜数量 */
  count: number;
  /** 更新时间 */
  updatedAt: number;
  /** 是否有新话题 */
  hasNewTopics: boolean;
}

// 信息流刷新事件
interface FeedRefreshedEvent {
  platformId: string;
  /** Feed 类型 */
  feedType: 'home' | 'following' | 'trending' | 'topic';
  /** 新增帖子数量 */
  newPostCount: number;
}
```

---

## 5. 互动相关事件

### 5.1 事件列表

| 事件名 | 说明 | 触发时机 |
| -------- | ------ | ---------- |
| `interaction:like` | 点赞 | 用户点赞内容 |
| `interaction:unlike` | 取消点赞 | 用户取消点赞 |
| `interaction:favorite` | 收藏 | 用户收藏内容 |
| `interaction:unfavorite` | 取消收藏 | 用户取消收藏 |
| `interaction:repost` | 转发 | 用户转发内容 |
| `interaction:follow` | 关注 | 用户关注账号 |
| `interaction:unfollow` | 取消关注 | 用户取消关注 |
| `interaction:view` | 浏览 | 内容被浏览 |

### 5.2 Payload 类型定义

```typescript
// 基础互动事件
interface BaseInteractionEvent {
  /** 内容 ID */
  contentId: string;
  /** 用户 ID */
  userId: string;
  /** 平台 ID */
  platformId: string;
  /** 时间戳 */
  timestamp: number;
}

// 点赞事件
interface LikeEvent extends BaseInteractionEvent {
  type: 'like';
}

// 取消点赞事件
interface UnlikeEvent extends BaseInteractionEvent {
  type: 'unlike';
}

// 收藏事件
interface FavoriteEvent extends BaseInteractionEvent {
  type: 'favorite';
  /** 收藏夹名称 */
  collection?: string;
}

// 取消收藏事件
interface UnfavoriteEvent extends BaseInteractionEvent {
  type: 'unfavorite';
}

// 转发事件
interface RepostEvent extends BaseInteractionEvent {
  type: 'repost';
  /** 新帖子 ID */
  newPostId: string;
  /** 转发评论 */
  comment?: string;
}

// 关注事件
interface FollowEvent {
  /** 关注者 ID */
  followerId: string;
  /** 被关注者 ID */
  followeeId: string;
  /** 平台 ID */
  platformId: string;
  /** 时间戳 */
  timestamp: number;
}

// 取消关注事件
interface UnfollowEvent {
  followerId: string;
  followeeId: string;
  platformId: string;
  timestamp: number;
}

// 浏览事件
interface ViewEvent extends BaseInteractionEvent {
  type: 'view';
  /** 浏览时长（秒） */
  duration?: number;
  /** 浏览深度（百分比） */
  scrollDepth?: number;
}
```

---

## 6. 用户/账号相关事件

### 6.1 事件列表

| 事件名 | 说明 | 触发时机 |
| -------- | ------ | ---------- |
| `account:created` | 账号创建 | 新账号注册 |
| `account:updated` | 账号更新 | 账号信息变更 |
| `account:avatar:changed` | 头像更换 | 账号头像变更 |
| `account:stats:changed` | 数据变化 | 粉丝/关注等数据变化 |

### 6.2 Payload 类型定义

```typescript
// 账号创建事件
interface AccountCreatedEvent {
  /** 账号 ID */
  accountId: string;
  /** 实体 ID */
  entityId: string;
  /** 平台 ID */
  platformId: string;
  /** 账号类型 */
  accountType: 'player' | 'npc';
  /** 用户名 */
  username: string;
}

// 账号更新事件
interface AccountUpdatedEvent {
  accountId: string;
  /** 更新的字段 */
  updatedFields: string[];
}

// 头像更换事件
interface AccountAvatarChangedEvent {
  accountId: string;
  /** 新头像 URL */
  newAvatarUrl: string;
  /** 旧头像 URL */
  oldAvatarUrl?: string;
}

// 数据变化事件
interface AccountStatsChangedEvent {
  accountId: string;
  platformId: string;
  /** 变化类型 */
  statType: 'followers' | 'following' | 'posts' | 'likes';
  /** 旧值 */
  oldValue: number;
  /** 新值 */
  newValue: number;
  /** 变化量 */
  delta: number;
}
```

---

## 7. 系统核心事件

### 7.1 事件列表

| 事件名 | 说明 | 触发时机 |
| -------- | ------ | ---------- |
| `time:tick` | 时间流逝 | 模拟时间更新 |
| `llm:task:started` | LLM 任务开始 | 任务开始执行 |
| `llm:task:completed` | LLM 任务完成 | 任务执行完成 |
| `llm:task:failed` | LLM 任务失败 | 任务执行失败 |
| `archive:extracted` | 档案提取 | 档案自动提取完成 |
| `notification:created` | 通知创建 | 新通知生成 |
| `app:ready` | 应用就绪 | App 初始化完成 |
| `app:error` | 应用错误 | App 发生错误 |

### 7.2 Payload 类型定义

```typescript
// 时间流逝事件
interface TimeTickEvent {
  /** 当前时间戳 */
  currentTime: number;
  /** 上一次时间戳 */
  previousTime: number;
  /** 时间源 */
  source: 'real | 'simulated' | 'narrative';
}

// LLM 任务开始事件
interface LLMTaskStartedEvent {
  taskId: string;
  taskType: string;
  /** 请求参数 */
  params?: Record<string, any>;
}

// LLM 任务完成事件
interface LLMTaskCompletedEvent {
  taskId: string;
  taskType: string;
  /** 执行结果 */
  result: any;
  /** 执行时长（ms） */
  duration: number;
  /** Token 使用量 */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// LLM 任务失败事件
interface LLMTaskFailedEvent {
  taskId: string;
  taskType: string;
  /** 错误信息 */
  error: string;
  /** 重试次数 */
  retryCount: number;
}

// 档案提取事件
interface ArchiveExtractedEvent {
  /** 档案 ID */
  archiveId: string;
  /** 档案类型 */
  archiveType: 'event' | 'character' | 'world' | 'dialogue';
  /** 来源会话 */
  sessionId: string;
  /** 来源楼层 */
  floorRange: [number, number];
}

// 通知创建事件
interface NotificationCreatedEvent {
  /** 通知 ID */
  notificationId: string;
  /** 通知类型 */
  type: string;
  /** 来源应用 */
  appId: string;
  /** 优先级 */
  priority: 'low' | 'normal' | 'high';
}

// 应用就绪事件
interface AppReadyEvent {
  /** 应用 ID */
  appId: string;
  /** 初始化时长（ms） */
  initDuration: number;
}

// 应用错误事件
interface AppErrorEvent {
  appId: string;
  /** 错误代码 */
  errorCode: string;
  /** 错误信息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
}
```

---

## 8. 完整事件映射

```typescript
/**
 * 完整的事件类型映射
 * 用于实现类型安全的事件发布/订阅
 */
interface EventMap {
  // 会话事件
  'session:changed': SessionChangedEvent;
  'session:message:new': SessionMessageNewEvent;
  'session:message:updated': SessionMessageUpdatedEvent;
  'session:swipe:changed': SessionSwipeChangedEvent;
  
  // 内容事件
  'content:post:created': PostCreatedEvent;
  'content:post:updated': PostUpdatedEvent;
  'content:post:deleted': PostDeletedEvent;
  'content:comment:created': CommentCreatedEvent;
  'content:trending:updated': TrendingUpdatedEvent;
  'content:feed:refreshed': FeedRefreshedEvent;
  
  // 互动事件
  'interaction:like': LikeEvent;
  'interaction:unlike': UnlikeEvent;
  'interaction:favorite': FavoriteEvent;
  'interaction:unfavorite': UnfavoriteEvent;
  'interaction:repost': RepostEvent;
  'interaction:follow': FollowEvent;
  'interaction:unfollow': UnfollowEvent;
  'interaction:view': ViewEvent;
  
  // 账号事件
  'account:created': AccountCreatedEvent;
  'account:updated': AccountUpdatedEvent;
  'account:avatar:changed': AccountAvatarChangedEvent;
  'account:stats:changed': AccountStatsChangedEvent;
  
  // 系统事件
  'time:tick': TimeTickEvent;
  'llm:task:started': LLMTaskStartedEvent;
  'llm:task:completed': LLMTaskCompletedEvent;
  'llm:task:failed': LLMTaskFailedEvent;
  'archive:extracted': ArchiveExtractedEvent;
  'notification:created': NotificationCreatedEvent;
  'app:ready': AppReadyEvent;
  'app:error': AppErrorEvent;
}

// 所有事件名称的联合类型
type EventName = keyof EventMap;
```

---

## 9. 自定义事件指南

### 9.1 定义新事件

```typescript
// 1. 定义 Payload 类型
interface MyCustomEvent {
  customField: string;
  data: any;
}

// 2. 扩展 EventMap（可选，用于类型安全）
declare module '@/services/eventBus' {
  interface EventMap {
    'my:custom:event': MyCustomEvent;
  }
}

// 3. 使用事件
eventBus.emit('my:custom:event', {
  customField: 'value',
  data: { foo: 'bar' },
});
```

### 9.2 命名建议

| 场景 | 推荐命名 | 示例 |
| ------ | ---------- | ------ |
| App 内部事件 | `{appId}:{entity}:{action}` | `weibo:post:liked` |
| 通道隔离事件 | 使用 channel API | `weiboChannel.emit('post:liked', ...)` |
| 跨服务事件 | 使用标准系统事件 | `content:post:created` |

---

## 10. 相关文档

- [API 参考](./api-reference.md) - 完整 API 文档
- [使用指南](./usage-guide.md) - 使用示例
- [README](./README.md) - 服务概述
