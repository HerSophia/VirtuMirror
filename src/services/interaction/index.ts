/**
 * 交互服务模块导出
 *
 * @example
 * ```typescript
 * import { interactionService } from '@/services/interaction'
 *
 * // 点赞
 * await interactionService.like(contentId, userId)
 *
 * // 取消点赞
 * await interactionService.unlike(contentId, userId)
 *
 * // 检查是否已点赞
 * const isLiked = await interactionService.isLiked(contentId, userId)
 *
 * // 收藏
 * await interactionService.favorite(contentId, userId)
 *
 * // 订阅互动事件
 * const unsubscribe = interactionService.onInteraction((event) => {
 *   console.log(`[${event.type}] ${event.userId} -> ${event.contentId}`)
 * })
 *
 * // 订阅特定类型事件
 * interactionService.on('like', (event) => {
 *   console.log('新点赞:', event)
 * })
 * ```
 */

import { interactionService, useInteractionService } from './InteractionService'

// 导出服务实例
export { interactionService, useInteractionService }

// 导出类型
export type {
  // 基础类型
  InteractionType,
  ContentType,
  PlatformId,
  // 事件
  InteractionEvent,
  InteractionEventHandler,
  // 用户互动
  UserInteraction,
  // 统计
  InteractionStats,
  // 评论
  Comment,
  CreateCommentParams,
  // 浏览记录
  ViewRecord,
  ViewRecordOptions,
  // 收藏夹
  FavoriteCollection,
  // 平台扩展
  PlatformBehavior,
  RegisterPlatformBehaviorOptions,
  // 查询选项
  PaginationOptions,
  GetUserInteractionsOptions,
  GetCommentsOptions,
  GetViewHistoryOptions,
  // 操作选项
  BaseInteractionOptions,
  LikeOptions,
  FavoriteOptions,
  RepostOptions,
  RepostRecord,
  // 服务接口
  IInteractionService,
} from '@/types/interaction'
