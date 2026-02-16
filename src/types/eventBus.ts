/**
 * 事件总线服务类型定义
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 事件处理函数 */
export type EventHandler<T = any> = (payload: T) => void

/** 取消订阅函数 */
export type Unsubscribe = () => void

// ============================================================================
// 事件总线接口
// ============================================================================

/** 事件总线接口 */
export interface IEventBus {
  /** 发布事件 */
  emit<T>(event: string, payload: T): void
  /** 订阅事件 */
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe
  /** 一次性订阅 */
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe
  /** 取消订阅 */
  off(event: string, handler?: EventHandler): void
  /** 获取或创建命名通道 */
  channel(name: string): IEventChannel
  /** 获取监听器数量 */
  getListenerCount(event: string): number
  /** 获取所有已注册事件 */
  getAllEvents(): string[]
  /** 清除所有监听器 */
  clear(): void
  /** 设置调试模式 */
  setDebug(enabled: boolean): void
}

/** 事件通道接口 */
export interface IEventChannel {
  /** 通道名称 */
  readonly name: string
  /** 发布事件 */
  emit<T>(event: string, payload: T): void
  /** 订阅事件 */
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe
  /** 一次性订阅 */
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe
  /** 取消订阅 */
  off(event: string, handler?: EventHandler): void
  /** 获取监听器数量 */
  getListenerCount(event: string): number
  /** 清除通道内所有监听器 */
  clear(): void
}

// ============================================================================
// 会话相关事件
// ============================================================================

/** 会话切换事件 */
export interface SessionChangedEvent {
  /** 新会话 ID */
  sessionId: string
  /** 前一个会话 ID */
  previousSessionId?: string
  /** 角色名称 */
  characterName?: string
}

/** 新消息事件 */
export interface SessionMessageNewEvent {
  /** 会话 ID */
  sessionId: string
  /** 消息 ID */
  messageId: string
  /** 楼层号 */
  floorId: number
  /** 发送者 */
  sender: 'user' | 'character' | 'system'
  /** 消息内容预览 */
  preview?: string
}

/** 消息更新事件 */
export interface SessionMessageUpdatedEvent {
  sessionId: string
  messageId: string
  floorId: number
  /** 更新类型 */
  updateType: 'edit' | 'regenerate'
}

/** Swipe 切换事件 */
export interface SessionSwipeChangedEvent {
  sessionId: string
  messageId: string
  floorId: number
  /** 当前 swipe 索引 */
  swipeIndex: number
  /** 总 swipe 数量 */
  totalSwipes: number
}

// ============================================================================
// 内容相关事件
// ============================================================================

/** 帖子创建事件 */
export interface PostCreatedEvent {
  /** 帖子 ID */
  postId: string
  /** 作者 ID */
  authorId: string
  /** 平台 ID */
  platformId: string
  /** 创建时间戳 */
  timestamp: number
  /** 内容类型 */
  contentType?: 'text' | 'image' | 'video' | 'article'
  /** 关联话题 */
  topics?: string[]
}

/** 帖子更新事件 */
export interface PostUpdatedEvent {
  postId: string
  platformId: string
  /** 更新的字段 */
  updatedFields: string[]
  /** 新状态 */
  newStatus?: 'published' | 'draft' | 'hidden'
}

/** 帖子删除事件 */
export interface PostDeletedEvent {
  postId: string
  platformId: string
  authorId: string
  /** 删除原因 */
  reason?: string
}

/** 评论创建事件 */
export interface CommentCreatedEvent {
  /** 评论 ID */
  commentId: string
  /** 所属帖子 ID */
  postId: string
  /** 评论者 ID */
  authorId: string
  /** 平台 ID */
  platformId: string
  /** 是否是回复 */
  isReply: boolean
  /** 回复的评论 ID */
  replyToCommentId?: string
  /** 时间戳 */
  timestamp: number
}

/** 热搜更新事件 */
export interface TrendingUpdatedEvent {
  /** 平台 ID */
  platformId: string
  /** 热搜数量 */
  count: number
  /** 更新时间 */
  updatedAt: number
  /** 是否有新话题 */
  hasNewTopics: boolean
}

/** 信息流刷新事件 */
export interface FeedRefreshedEvent {
  platformId: string
  /** Feed 类型 */
  feedType: 'home' | 'following' | 'trending' | 'topic'
  /** 新增帖子数量 */
  newPostCount: number
}

// ============================================================================
// 互动相关事件
// ============================================================================

/** 基础互动事件 */
export interface BaseInteractionEvent {
  /** 内容 ID */
  contentId: string
  /** 用户 ID */
  userId: string
  /** 平台 ID */
  platformId: string
  /** 时间戳 */
  timestamp: number
}

/** 点赞事件 */
export interface LikeEvent extends BaseInteractionEvent {
  type: 'like'
}

/** 取消点赞事件 */
export interface UnlikeEvent extends BaseInteractionEvent {
  type: 'unlike'
}

/** 收藏事件 */
export interface FavoriteEvent extends BaseInteractionEvent {
  type: 'favorite'
  /** 收藏夹名称 */
  collection?: string
}

/** 取消收藏事件 */
export interface UnfavoriteEvent extends BaseInteractionEvent {
  type: 'unfavorite'
}

/** 转发事件 */
export interface RepostEvent extends BaseInteractionEvent {
  type: 'repost'
  /** 新帖子 ID */
  newPostId: string
  /** 转发评论 */
  comment?: string
}

/** 关注事件 */
export interface FollowEvent {
  /** 关注者 ID */
  followerId: string
  /** 被关注者 ID */
  followeeId: string
  /** 平台 ID */
  platformId: string
  /** 时间戳 */
  timestamp: number
}

/** 取消关注事件 */
export interface UnfollowEvent {
  followerId: string
  followeeId: string
  platformId: string
  timestamp: number
}

/** 浏览事件 */
export interface ViewEvent extends BaseInteractionEvent {
  type: 'view'
  /** 浏览时长（秒） */
  duration?: number
  /** 浏览深度（百分比） */
  scrollDepth?: number
}

// ============================================================================
// 用户/账号相关事件
// ============================================================================

/** 账号创建事件 */
export interface AccountCreatedEvent {
  /** 账号 ID */
  accountId: string
  /** 实体 ID */
  entityId: string
  /** 平台 ID */
  platformId: string
  /** 账号类型 */
  accountType: 'player' | 'npc'
  /** 用户名 */
  username: string
}

/** 账号更新事件 */
export interface AccountUpdatedEvent {
  accountId: string
  /** 更新的字段 */
  updatedFields: string[]
}

/** 头像更换事件 */
export interface AccountAvatarChangedEvent {
  accountId: string
  /** 新头像 URL */
  newAvatarUrl: string
  /** 旧头像 URL */
  oldAvatarUrl?: string
}

/** 数据变化事件 */
export interface AccountStatsChangedEvent {
  accountId: string
  platformId: string
  /** 变化类型 */
  statType: 'followers' | 'following' | 'posts' | 'likes'
  /** 旧值 */
  oldValue: number
  /** 新值 */
  newValue: number
  /** 变化量 */
  delta: number
}

// ============================================================================
// 系统核心事件
// ============================================================================

/** 时间流逝事件 */
export interface TimeTickEvent {
  /** 当前时间戳 */
  currentTime: number
  /** 上一次时间戳 */
  previousTime: number
  /** 时间源 */
  source: 'real' | 'simulated' | 'narrative'
}

/** LLM 任务开始事件 */
export interface LLMTaskStartedEvent {
  taskId: string
  taskType: string
  /** 请求参数 */
  params?: Record<string, any>
}

/** LLM 任务完成事件 */
export interface LLMTaskCompletedEvent {
  taskId: string
  taskType: string
  /** 执行结果 */
  result: any
  /** 执行时长（ms） */
  duration: number
  /** Token 使用量 */
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
}

/** LLM 任务失败事件 */
export interface LLMTaskFailedEvent {
  taskId: string
  taskType: string
  /** 错误信息 */
  error: string
  /** 重试次数 */
  retryCount: number
}

/** 档案提取事件 */
export interface ArchiveExtractedEvent {
  /** 档案 ID */
  archiveId: string
  /** 档案类型 */
  archiveType: 'event' | 'character' | 'world' | 'dialogue'
  /** 来源会话 */
  sessionId: string
  /** 来源楼层 */
  floorRange: [number, number]
}

/** 通知创建事件 */
export interface NotificationCreatedEvent {
  /** 通知 ID */
  notificationId: string
  /** 通知类型 */
  type: string
  /** 来源应用 */
  appId: string
  /** 优先级 */
  priority: 'low' | 'normal' | 'high'
}

/** 应用就绪事件 */
export interface AppReadyEvent {
  /** 应用 ID */
  appId: string
  /** 初始化时长（ms） */
  initDuration: number
}

/** 应用错误事件 */
export interface AppErrorEvent {
  appId: string
  /** 错误代码 */
  errorCode: string
  /** 错误信息 */
  message: string
  /** 错误堆栈 */
  stack?: string
}

// ============================================================================
// Scheduler 事件
// ============================================================================

/** Scheduler 执行结果 */
export interface SchedulerExecutionResult {
  taskId: string
  outcome: 'success' | 'failed' | 'timeout' | 'skipped'
  success: boolean
  attempt: number
  startedAt: number
  finishedAt: number
  duration: number
  error?: string
  skipped?: boolean
  reason?: 'reentry'
}

/** Scheduler 任务基础事件 */
export interface SchedulerTaskBaseEvent {
  taskId: string
  taskName: string
  appId: string
  scheduleType: 'interval' | 'cron' | 'event'
  timestamp: number
}

/** Scheduler 任务状态变化事件 */
export interface SchedulerTaskStateChangedEvent extends SchedulerTaskBaseEvent {
  enabled: boolean
}

/** Scheduler 任务开始事件 */
export interface SchedulerTaskStartedEvent extends SchedulerTaskBaseEvent {
  attempt: number
}

/** Scheduler 任务执行结果事件 */
export interface SchedulerTaskResultEvent extends SchedulerTaskBaseEvent {
  result: SchedulerExecutionResult
}

/** Scheduler 任务完成事件 */
export interface SchedulerTaskCompletedEvent extends SchedulerTaskResultEvent {}

/** Scheduler 任务失败事件 */
export interface SchedulerTaskFailedEvent extends SchedulerTaskResultEvent {}

/** Scheduler 任务超时事件 */
export interface SchedulerTaskTimeoutEvent extends SchedulerTaskResultEvent {}

/** Scheduler 任务跳过事件 */
export interface SchedulerTaskSkippedEvent extends SchedulerTaskResultEvent {}

// ============================================================================
// Context Sharing 事件
// ============================================================================

/** 上下文发布事件 */
export interface ContextPublishedEvent {
  /** 上下文 ID */
  id: string
  /** 上下文类型 */
  type: string
}

/** 上下文更新事件 */
export interface ContextUpdatedEvent {
  /** 上下文 ID */
  id: string
}

/** 上下文取消发布事件 */
export interface ContextUnpublishedEvent {
  /** 上下文 ID */
  id: string
  /** 上下文类型 */
  type: string
}

// ============================================================================
// 事件类型映射
// ============================================================================

/**
 * 完整的事件类型映射
 * 用于实现类型安全的事件发布/订阅
 */
export interface EventMap {
  // 会话事件
  'session:changed': SessionChangedEvent
  'session:message:new': SessionMessageNewEvent
  'session:message:updated': SessionMessageUpdatedEvent
  'session:swipe:changed': SessionSwipeChangedEvent

  // 内容事件
  'content:post:created': PostCreatedEvent
  'content:post:updated': PostUpdatedEvent
  'content:post:deleted': PostDeletedEvent
  'content:comment:created': CommentCreatedEvent
  'content:trending:updated': TrendingUpdatedEvent
  'content:feed:refreshed': FeedRefreshedEvent

  // 互动事件
  'interaction:like': LikeEvent
  'interaction:unlike': UnlikeEvent
  'interaction:favorite': FavoriteEvent
  'interaction:unfavorite': UnfavoriteEvent
  'interaction:repost': RepostEvent
  'interaction:follow': FollowEvent
  'interaction:unfollow': UnfollowEvent
  'interaction:view': ViewEvent

  // 账号事件
  'account:created': AccountCreatedEvent
  'account:updated': AccountUpdatedEvent
  'account:avatar:changed': AccountAvatarChangedEvent
  'account:stats:changed': AccountStatsChangedEvent

  // 系统事件
  'time:tick': TimeTickEvent
  'llm:task:started': LLMTaskStartedEvent
  'llm:task:completed': LLMTaskCompletedEvent
  'llm:task:failed': LLMTaskFailedEvent
  'archive:extracted': ArchiveExtractedEvent
  'notification:created': NotificationCreatedEvent
  'app:ready': AppReadyEvent
  'app:error': AppErrorEvent

  // Scheduler 事件
  'scheduler:task:registered': SchedulerTaskBaseEvent
  'scheduler:task:unregistered': SchedulerTaskBaseEvent
  'scheduler:task:paused': SchedulerTaskStateChangedEvent
  'scheduler:task:resumed': SchedulerTaskStateChangedEvent
  'scheduler:task:started': SchedulerTaskStartedEvent
  'scheduler:task:completed': SchedulerTaskCompletedEvent
  'scheduler:task:failed': SchedulerTaskFailedEvent
  'scheduler:task:timeout': SchedulerTaskTimeoutEvent
  'scheduler:task:skipped': SchedulerTaskSkippedEvent

  // Context Sharing 事件
  'contextSharing:published': ContextPublishedEvent
  'contextSharing:updated': ContextUpdatedEvent
  'contextSharing:unpublished': ContextUnpublishedEvent
}

/** 所有事件名称的联合类型 */
export type EventName = keyof EventMap
