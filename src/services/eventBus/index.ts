/**
 * 事件总线服务模块导出
 *
 * @example
 * ```typescript
 * import { eventBus } from '@/services/eventBus'
 *
 * // 订阅事件
 * const unsubscribe = eventBus.on('content:post:created', (payload) => {
 *   console.log('新帖子:', payload.postId)
 * })
 *
 * // 发布事件
 * eventBus.emit('content:post:created', {
 *   postId: 'post_123',
 *   authorId: 'user_456',
 *   platformId: 'weibo',
 *   timestamp: Date.now(),
 * })
 *
 * // 取消订阅
 * unsubscribe()
 *
 * // 一次性监听
 * eventBus.once('session:changed', (payload) => {
 *   console.log('会话已切换:', payload.sessionId)
 * })
 *
 * // 通道隔离
 * const weiboChannel = eventBus.channel('weibo')
 * weiboChannel.on('feed:updated', (data) => {
 *   // 只接收 weibo 通道的事件
 * })
 * ```
 */

import { EventBus } from './EventBus'
import { EventChannel } from './EventChannel'
import {
  EventBusExtended,
  waitForEvent,
  collectEvents,
  throttledOn,
  debouncedOn,
} from './EventBusExtended'

// 导出类
export { EventBus, EventChannel }

// 导出扩展功能
export {
  EventBusExtended,
  waitForEvent,
  collectEvents,
  throttledOn,
  debouncedOn,
}
export type { EventRecord, EventFilter, IEventBusExtended } from './EventBusExtended'

// 导出全局单例
export const eventBus = new EventBus()

// 重新导出类型
export type {
  EventHandler,
  Unsubscribe,
  IEventBus,
  IEventChannel,
  EventMap,
  EventName,
  // 会话事件
  SessionChangedEvent,
  SessionMessageNewEvent,
  SessionMessageUpdatedEvent,
  SessionSwipeChangedEvent,
  // 内容事件
  PostCreatedEvent,
  PostUpdatedEvent,
  PostDeletedEvent,
  CommentCreatedEvent,
  TrendingUpdatedEvent,
  FeedRefreshedEvent,
  // 互动事件
  BaseInteractionEvent,
  LikeEvent,
  UnlikeEvent,
  FavoriteEvent,
  UnfavoriteEvent,
  RepostEvent,
  FollowEvent,
  UnfollowEvent,
  ViewEvent,
  // 账号事件
  AccountCreatedEvent,
  AccountUpdatedEvent,
  AccountAvatarChangedEvent,
  AccountStatsChangedEvent,
  // 系统事件
  TimeTickEvent,
  LLMTaskStartedEvent,
  LLMTaskCompletedEvent,
  LLMTaskFailedEvent,
  ArchiveExtractedEvent,
  NotificationCreatedEvent,
  AppReadyEvent,
  AppErrorEvent,
  // Scheduler 事件
  SchedulerExecutionResult,
  SchedulerTaskBaseEvent,
  SchedulerTaskStateChangedEvent,
  SchedulerTaskStartedEvent,
  SchedulerTaskResultEvent,
  SchedulerTaskCompletedEvent,
  SchedulerTaskFailedEvent,
  SchedulerTaskTimeoutEvent,
  SchedulerTaskSkippedEvent,
} from '@/types/eventBus'
