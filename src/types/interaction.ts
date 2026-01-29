/**
 * 交互服务类型定义
 * @version 1.0
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 互动类型
 */
export type InteractionType =
  | 'like'       // 点赞
  | 'unlike'     // 取消点赞
  | 'favorite'   // 收藏
  | 'unfavorite' // 取消收藏
  | 'comment'    // 评论
  | 'repost'     // 转发
  | 'view'       // 浏览
  | 'share'      // 分享

/**
 * 内容类型
 */
export type ContentType = 'post' | 'comment' | 'article' | 'video'

/**
 * 平台 ID
 */
export type PlatformId = 'weibo' | 'bilibili' | 'zhihu' | string

// ============================================================================
// 互动事件
// ============================================================================

/**
 * 互动事件
 */
export interface InteractionEvent {
  /** 事件 ID */
  id: string
  /** 互动类型 */
  type: InteractionType
  /** 内容 ID */
  contentId: string
  /** 内容类型 */
  contentType: ContentType
  /** 用户 ID */
  userId: string
  /** 平台 ID */
  platformId: PlatformId
  /** 时间戳 */
  timestamp: number
  /** 额外数据 */
  metadata?: Record<string, unknown>
}

/**
 * 互动事件处理函数
 */
export type InteractionEventHandler = (event: InteractionEvent) => void

// ============================================================================
// 用户互动记录
// ============================================================================

/**
 * 用户对某内容的互动状态
 */
export interface UserInteraction {
  /** 记录 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 内容 ID */
  contentId: string
  /** 内容类型 */
  contentType: ContentType
  /** 平台 ID */
  platformId: PlatformId
  /** 是否已点赞 */
  isLiked: boolean
  /** 点赞时间 */
  likedAt?: number
  /** 是否已收藏 */
  isFavorited: boolean
  /** 收藏时间 */
  favoritedAt?: number
  /** 收藏夹 ID */
  collectionId?: string
  /** 浏览次数 */
  viewCount: number
  /** 最后浏览时间 */
  lastViewAt?: number
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

// ============================================================================
// 内容统计
// ============================================================================

/**
 * 内容互动统计
 */
export interface InteractionStats {
  /** 内容 ID */
  contentId: string
  /** 内容类型 */
  contentType: ContentType
  /** 平台 ID */
  platformId: PlatformId
  /** 点赞数 */
  likes: number
  /** 收藏数 */
  favorites: number
  /** 评论数 */
  comments: number
  /** 转发数 */
  reposts: number
  /** 浏览数 */
  views: number
  /** 分享数 */
  shares: number
  /** 最后更新时间 */
  updatedAt: number
}

// ============================================================================
// 评论
// ============================================================================

/**
 * 评论
 */
export interface Comment {
  /** 评论 ID */
  id: string
  /** 所属内容 ID */
  contentId: string
  /** 内容类型 */
  contentType: ContentType
  /** 平台 ID */
  platformId: PlatformId
  /** 作者 ID */
  authorId: string
  /** 作者名称 */
  authorName?: string
  /** 作者头像 */
  authorAvatar?: string
  /** 评论内容 */
  content: string
  /** 父评论 ID（回复） */
  parentId?: string
  /** 回复的用户 ID */
  replyToUserId?: string
  /** 回复的用户名 */
  replyToUserName?: string
  /** 点赞数 */
  likeCount: number
  /** 回复数 */
  replyCount: number
  /** 创建时间 */
  createdAt: number
  /** 是否已删除 */
  isDeleted?: boolean
}

/**
 * 创建评论参数
 */
export interface CreateCommentParams {
  /** 内容 ID */
  contentId: string
  /** 内容类型 */
  contentType?: ContentType
  /** 平台 ID */
  platformId: PlatformId
  /** 用户 ID */
  userId: string
  /** 评论内容 */
  content: string
  /** 父评论 ID */
  parentId?: string
}

// ============================================================================
// 浏览记录
// ============================================================================

/**
 * 浏览记录
 */
export interface ViewRecord {
  /** 记录 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 内容 ID */
  contentId: string
  /** 内容类型 */
  contentType: ContentType
  /** 平台 ID */
  platformId: PlatformId
  /** 浏览时间 */
  viewedAt: number
  /** 停留时长（秒） */
  duration?: number
  /** 滚动深度（0-1） */
  scrollDepth?: number
  /** 来源 */
  source?: string
}

/**
 * 浏览记录选项
 */
export interface ViewRecordOptions {
  /** 停留时长（秒） */
  duration?: number
  /** 滚动深度（0-1） */
  scrollDepth?: number
  /** 来源 */
  source?: string
}

// ============================================================================
// 收藏夹
// ============================================================================

/**
 * 收藏夹
 */
export interface FavoriteCollection {
  /** 收藏夹 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 收藏夹名称 */
  name: string
  /** 描述 */
  description?: string
  /** 是否公开 */
  isPublic: boolean
  /** 收藏数量 */
  count: number
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

// ============================================================================
// 查询选项
// ============================================================================

/**
 * 分页选项
 */
export interface PaginationOptions {
  /** 偏移量 */
  offset?: number
  /** 限制数量 */
  limit?: number
}

/**
 * 获取用户互动列表选项
 */
export interface GetUserInteractionsOptions extends PaginationOptions {
  /** 平台 ID */
  platformId?: PlatformId
  /** 内容类型 */
  contentType?: ContentType
}

/**
 * 获取评论列表选项
 */
export interface GetCommentsOptions extends PaginationOptions {
  /** 排序方式 */
  sortBy?: 'time' | 'likes'
  /** 排序顺序 */
  order?: 'asc' | 'desc'
  /** 是否包含回复 */
  includeReplies?: boolean
}

/**
 * 获取浏览历史选项
 */
export interface GetViewHistoryOptions extends PaginationOptions {
  /** 平台 ID */
  platformId?: PlatformId
  /** 内容类型 */
  contentType?: ContentType
  /** 时间范围起始 */
  startTime?: number
  /** 时间范围结束 */
  endTime?: number
}

// ============================================================================
// 平台扩展行为
// ============================================================================

/**
 * 平台扩展互动行为
 */
export interface PlatformBehavior {
  /** 平台 ID */
  platformId: PlatformId
  /** 行为名称 */
  name: string
  /** 行为标识 */
  action: string
  /** 描述 */
  description?: string
  /** 执行函数 */
  execute: (contentId: string, userId: string, params?: Record<string, unknown>) => Promise<void>
}

/**
 * 平台行为注册选项
 */
export interface RegisterPlatformBehaviorOptions {
  /** 是否覆盖已存在的行为 */
  override?: boolean
}

// ============================================================================
// 服务接口
// ============================================================================

/**
 * 交互服务接口
 */
export interface IInteractionService {
  // === 点赞相关 ===
  like(contentId: string, userId: string, options?: LikeOptions): Promise<void>
  unlike(contentId: string, userId: string, options?: LikeOptions): Promise<void>
  isLiked(contentId: string, userId: string, options?: LikeOptions): Promise<boolean>
  getUserLikes(userId: string, options?: GetUserInteractionsOptions): Promise<UserInteraction[]>

  // === 收藏相关 ===
  favorite(contentId: string, userId: string, collectionId?: string, options?: FavoriteOptions): Promise<void>
  unfavorite(contentId: string, userId: string, options?: FavoriteOptions): Promise<void>
  isFavorited(contentId: string, userId: string, options?: FavoriteOptions): Promise<boolean>
  getUserFavorites(userId: string, options?: GetUserInteractionsOptions): Promise<UserInteraction[]>
  getFavoriteCollections(userId: string): Promise<FavoriteCollection[]>

  // === 评论相关 ===
  comment(params: CreateCommentParams): Promise<Comment>
  deleteComment(commentId: string, userId: string): Promise<void>
  getComments(contentId: string, options?: GetCommentsOptions): Promise<Comment[]>
  getUserComments(userId: string, options?: GetUserInteractionsOptions): Promise<Comment[]>

  // === 转发相关 ===
  repost(contentId: string, userId: string, comment?: string, options?: RepostOptions): Promise<string>
  getReposts(contentId: string, options?: PaginationOptions): Promise<RepostRecord[]>

  // === 浏览记录 ===
  recordView(contentId: string, userId: string, options?: ViewRecordOptions & BaseInteractionOptions): Promise<void>
  getViewHistory(userId: string, options?: GetViewHistoryOptions): Promise<ViewRecord[]>
  clearViewHistory(userId: string, platformId?: PlatformId): Promise<void>

  // === 统计相关 ===
  getStats(contentId: string, platformId: PlatformId): Promise<InteractionStats>
  batchGetStats(contentIds: string[], platformId: PlatformId): Promise<Map<string, InteractionStats>>
  incrementStats(contentId: string, platformId: PlatformId, field: keyof Omit<InteractionStats, 'contentId' | 'contentType' | 'platformId' | 'updatedAt'>, delta?: number): Promise<void>

  // === 事件相关 ===
  onInteraction(handler: InteractionEventHandler): () => void
  on(type: InteractionType, handler: InteractionEventHandler): () => void
  off(type: InteractionType, handler?: InteractionEventHandler): void

  // === 平台扩展 ===
  registerPlatformBehavior(behavior: PlatformBehavior, options?: RegisterPlatformBehaviorOptions): void
  getPlatformBehavior(platformId: PlatformId, action: string): PlatformBehavior | undefined
  getPlatformBehaviors(platformId: PlatformId): PlatformBehavior[]
  executePlatformBehavior(platformId: PlatformId, action: string, contentId: string, userId: string, params?: Record<string, unknown>): Promise<void>
}

// ============================================================================
// 辅助类型
// ============================================================================

/**
 * 基础互动选项
 */
export interface BaseInteractionOptions {
  /** 平台 ID */
  platformId?: PlatformId
  /** 内容类型 */
  contentType?: ContentType
}

/**
 * 点赞选项
 */
export interface LikeOptions extends BaseInteractionOptions {}

/**
 * 收藏选项
 */
export interface FavoriteOptions extends BaseInteractionOptions {}

/**
 * 转发选项
 */
export interface RepostOptions extends BaseInteractionOptions {}

/**
 * 转发记录
 */
export interface RepostRecord {
  /** 记录 ID */
  id: string
  /** 原内容 ID */
  originalContentId: string
  /** 新帖子 ID */
  newPostId: string
  /** 用户 ID */
  userId: string
  /** 平台 ID */
  platformId: PlatformId
  /** 转发评论 */
  comment?: string
  /** 创建时间 */
  createdAt: number
}
