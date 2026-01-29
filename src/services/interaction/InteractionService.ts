/**
 * InteractionService 核心服务类
 * 提供统一的互动行为管理：点赞、收藏、评论、转发等
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  IInteractionService,
  InteractionType,
  InteractionEvent,
  InteractionEventHandler,
  InteractionStats,
  UserInteraction,
  Comment,
  CreateCommentParams,
  ViewRecord,
  ViewRecordOptions,
  FavoriteCollection,
  PlatformBehavior,
  RegisterPlatformBehaviorOptions,
  ContentType,
  PlatformId,
  LikeOptions,
  FavoriteOptions,
  RepostOptions,
  RepostRecord,
  GetUserInteractionsOptions,
  GetCommentsOptions,
  GetViewHistoryOptions,
  PaginationOptions,
  BaseInteractionOptions,
} from '@/types/interaction'
import { loggerService } from '@/services/logger'
import { eventBus } from '@/services/eventBus'

// ============================================================================
// 常量
// ============================================================================

/** 默认平台 ID */
const DEFAULT_PLATFORM_ID: PlatformId = 'weibo'

/** 默认内容类型 */
const DEFAULT_CONTENT_TYPE: ContentType = 'post'

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 20

/** 最大浏览历史数量 */
const MAX_VIEW_HISTORY = 500

// ============================================================================
// InteractionService 实现
// ============================================================================

/**
 * 交互服务实现类
 * 单例模式，提供全局互动行为管理
 */
class InteractionServiceImpl implements IInteractionService {
  /** 日志器 */
  private logger = loggerService.child('interaction')

  /** 用户互动记录: userId -> contentId -> UserInteraction */
  private userInteractions = new Map<string, Map<string, UserInteraction>>()

  /** 内容统计: platformId:contentId -> InteractionStats */
  private contentStats = new Map<string, InteractionStats>()

  /** 评论存储: contentId -> Comment[] */
  private comments = new Map<string, Comment[]>()

  /** 浏览历史: userId -> ViewRecord[] */
  private viewHistory = new Map<string, ViewRecord[]>()

  /** 收藏夹: userId -> FavoriteCollection[] */
  private favoriteCollections = new Map<string, FavoriteCollection[]>()

  /** 转发记录: contentId -> RepostRecord[] */
  private reposts = new Map<string, RepostRecord[]>()

  /** 事件监听器: type -> Set<handler> */
  private eventListeners = new Map<InteractionType | '*', Set<InteractionEventHandler>>()

  /** 平台扩展行为: platformId:action -> PlatformBehavior */
  private platformBehaviors = new Map<string, PlatformBehavior>()

  constructor() {
    this.logger.info('InteractionService 初始化')
  }

  // ==========================================================================
  // 点赞相关
  // ==========================================================================

  async like(
    contentId: string,
    userId: string,
    options: LikeOptions = {}
  ): Promise<void> {
    const platformId = options.platformId ?? DEFAULT_PLATFORM_ID
    const contentType = options.contentType ?? DEFAULT_CONTENT_TYPE

    const interaction = this.getOrCreateUserInteraction(
      userId,
      contentId,
      contentType,
      platformId
    )

    if (interaction.isLiked) {
      this.logger.debug(`内容 ${contentId} 已被用户 ${userId} 点赞过`)
      return
    }

    interaction.isLiked = true
    interaction.likedAt = Date.now()
    interaction.updatedAt = Date.now()

    // 更新统计
    await this.incrementStats(contentId, platformId, 'likes', 1)

    // 发布事件
    this.emitEvent('like', contentId, userId, platformId, contentType)

    this.logger.debug(`用户 ${userId} 点赞内容 ${contentId}`)
  }

  async unlike(
    contentId: string,
    userId: string,
    options: LikeOptions = {}
  ): Promise<void> {
    const platformId = options.platformId ?? DEFAULT_PLATFORM_ID
    const contentType = options.contentType ?? DEFAULT_CONTENT_TYPE

    const interaction = this.getUserInteraction(userId, contentId)
    if (!interaction || !interaction.isLiked) {
      this.logger.debug(`内容 ${contentId} 未被用户 ${userId} 点赞`)
      return
    }

    interaction.isLiked = false
    interaction.likedAt = undefined
    interaction.updatedAt = Date.now()

    // 更新统计
    await this.incrementStats(contentId, platformId, 'likes', -1)

    // 发布事件
    this.emitEvent('unlike', contentId, userId, platformId, contentType)

    this.logger.debug(`用户 ${userId} 取消点赞内容 ${contentId}`)
  }

  async isLiked(
    contentId: string,
    userId: string,
    _options: LikeOptions = {}
  ): Promise<boolean> {
    const interaction = this.getUserInteraction(userId, contentId)
    return interaction?.isLiked ?? false
  }

  async getUserLikes(
    userId: string,
    options: GetUserInteractionsOptions = {}
  ): Promise<UserInteraction[]> {
    const userMap = this.userInteractions.get(userId)
    if (!userMap) return []

    let interactions = Array.from(userMap.values()).filter((i) => i.isLiked)

    // 平台过滤
    if (options.platformId) {
      interactions = interactions.filter((i) => i.platformId === options.platformId)
    }

    // 内容类型过滤
    if (options.contentType) {
      interactions = interactions.filter((i) => i.contentType === options.contentType)
    }

    // 按点赞时间排序
    interactions.sort((a, b) => (b.likedAt ?? 0) - (a.likedAt ?? 0))

    // 分页
    return this.paginate(interactions, options)
  }

  // ==========================================================================
  // 收藏相关
  // ==========================================================================

  async favorite(
    contentId: string,
    userId: string,
    collectionId?: string,
    options: FavoriteOptions = {}
  ): Promise<void> {
    const platformId = options.platformId ?? DEFAULT_PLATFORM_ID
    const contentType = options.contentType ?? DEFAULT_CONTENT_TYPE

    const interaction = this.getOrCreateUserInteraction(
      userId,
      contentId,
      contentType,
      platformId
    )

    if (interaction.isFavorited) {
      this.logger.debug(`内容 ${contentId} 已被用户 ${userId} 收藏过`)
      return
    }

    interaction.isFavorited = true
    interaction.favoritedAt = Date.now()
    interaction.collectionId = collectionId
    interaction.updatedAt = Date.now()

    // 更新收藏夹计数
    if (collectionId) {
      this.updateCollectionCount(userId, collectionId, 1)
    }

    // 更新统计
    await this.incrementStats(contentId, platformId, 'favorites', 1)

    // 发布事件
    this.emitEvent('favorite', contentId, userId, platformId, contentType, {
      collectionId,
    })

    this.logger.debug(`用户 ${userId} 收藏内容 ${contentId}`)
  }

  async unfavorite(
    contentId: string,
    userId: string,
    options: FavoriteOptions = {}
  ): Promise<void> {
    const platformId = options.platformId ?? DEFAULT_PLATFORM_ID
    const contentType = options.contentType ?? DEFAULT_CONTENT_TYPE

    const interaction = this.getUserInteraction(userId, contentId)
    if (!interaction || !interaction.isFavorited) {
      this.logger.debug(`内容 ${contentId} 未被用户 ${userId} 收藏`)
      return
    }

    const oldCollectionId = interaction.collectionId

    interaction.isFavorited = false
    interaction.favoritedAt = undefined
    interaction.collectionId = undefined
    interaction.updatedAt = Date.now()

    // 更新收藏夹计数
    if (oldCollectionId) {
      this.updateCollectionCount(userId, oldCollectionId, -1)
    }

    // 更新统计
    await this.incrementStats(contentId, platformId, 'favorites', -1)

    // 发布事件
    this.emitEvent('unfavorite', contentId, userId, platformId, contentType)

    this.logger.debug(`用户 ${userId} 取消收藏内容 ${contentId}`)
  }

  async isFavorited(
    contentId: string,
    userId: string,
    _options: FavoriteOptions = {}
  ): Promise<boolean> {
    const interaction = this.getUserInteraction(userId, contentId)
    return interaction?.isFavorited ?? false
  }

  async getUserFavorites(
    userId: string,
    options: GetUserInteractionsOptions = {}
  ): Promise<UserInteraction[]> {
    const userMap = this.userInteractions.get(userId)
    if (!userMap) return []

    let interactions = Array.from(userMap.values()).filter((i) => i.isFavorited)

    // 平台过滤
    if (options.platformId) {
      interactions = interactions.filter((i) => i.platformId === options.platformId)
    }

    // 内容类型过滤
    if (options.contentType) {
      interactions = interactions.filter((i) => i.contentType === options.contentType)
    }

    // 按收藏时间排序
    interactions.sort((a, b) => (b.favoritedAt ?? 0) - (a.favoritedAt ?? 0))

    // 分页
    return this.paginate(interactions, options)
  }

  async getFavoriteCollections(userId: string): Promise<FavoriteCollection[]> {
    return this.favoriteCollections.get(userId) ?? []
  }

  // ==========================================================================
  // 评论相关
  // ==========================================================================

  async comment(params: CreateCommentParams): Promise<Comment> {
    const {
      contentId,
      contentType = DEFAULT_CONTENT_TYPE,
      platformId,
      userId,
      content,
      parentId,
    } = params

    const newComment: Comment = {
      id: uuidv4(),
      contentId,
      contentType,
      platformId,
      authorId: userId,
      content,
      parentId,
      likeCount: 0,
      replyCount: 0,
      createdAt: Date.now(),
    }

    // 存储评论
    if (!this.comments.has(contentId)) {
      this.comments.set(contentId, [])
    }
    this.comments.get(contentId)!.push(newComment)

    // 如果是回复，更新父评论的回复数
    if (parentId) {
      const parentComment = this.findComment(contentId, parentId)
      if (parentComment) {
        parentComment.replyCount++
      }
    }

    // 更新统计
    await this.incrementStats(contentId, platformId, 'comments', 1)

    // 发布事件
    this.emitEvent('comment', contentId, userId, platformId, contentType, {
      commentId: newComment.id,
      parentId,
    })

    this.logger.debug(`用户 ${userId} 评论内容 ${contentId}`)

    return newComment
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    // 查找评论
    for (const [contentId, commentList] of this.comments) {
      const index = commentList.findIndex(
        (c) => c.id === commentId && c.authorId === userId
      )
      if (index !== -1) {
        const targetComment = commentList[index]
        targetComment.isDeleted = true

        // 如果是回复，更新父评论的回复数
        if (targetComment.parentId) {
          const parentComment = this.findComment(contentId, targetComment.parentId)
          if (parentComment) {
            parentComment.replyCount = Math.max(0, parentComment.replyCount - 1)
          }
        }

        // 更新统计
        await this.incrementStats(contentId, targetComment.platformId, 'comments', -1)

        this.logger.debug(`用户 ${userId} 删除评论 ${commentId}`)
        return
      }
    }

    this.logger.warn(`评论 ${commentId} 不存在或无权删除`)
  }

  async getComments(
    contentId: string,
    options: GetCommentsOptions = {}
  ): Promise<Comment[]> {
    const commentList = this.comments.get(contentId) ?? []

    let result = commentList.filter((c) => !c.isDeleted)

    // 是否只获取顶级评论
    if (!options.includeReplies) {
      result = result.filter((c) => !c.parentId)
    }

    // 排序
    const sortBy = options.sortBy ?? 'time'
    const order = options.order ?? 'desc'

    result.sort((a, b) => {
      const valueA = sortBy === 'likes' ? a.likeCount : a.createdAt
      const valueB = sortBy === 'likes' ? b.likeCount : b.createdAt
      return order === 'desc' ? valueB - valueA : valueA - valueB
    })

    // 分页
    return this.paginate(result, options)
  }

  async getUserComments(
    userId: string,
    options: GetUserInteractionsOptions = {}
  ): Promise<Comment[]> {
    const allComments: Comment[] = []

    for (const commentList of this.comments.values()) {
      allComments.push(
        ...commentList.filter((c) => c.authorId === userId && !c.isDeleted)
      )
    }

    // 平台过滤
    let result = allComments
    if (options.platformId) {
      result = result.filter((c) => c.platformId === options.platformId)
    }

    // 按时间排序
    result.sort((a, b) => b.createdAt - a.createdAt)

    // 分页
    return this.paginate(result, options)
  }

  // ==========================================================================
  // 转发相关
  // ==========================================================================

  async repost(
    contentId: string,
    userId: string,
    comment?: string,
    options: RepostOptions = {}
  ): Promise<string> {
    const platformId = options.platformId ?? DEFAULT_PLATFORM_ID
    const contentType = options.contentType ?? DEFAULT_CONTENT_TYPE

    const newPostId = uuidv4()

    const record: RepostRecord = {
      id: uuidv4(),
      originalContentId: contentId,
      newPostId,
      userId,
      platformId,
      comment,
      createdAt: Date.now(),
    }

    // 存储转发记录
    if (!this.reposts.has(contentId)) {
      this.reposts.set(contentId, [])
    }
    this.reposts.get(contentId)!.push(record)

    // 更新统计
    await this.incrementStats(contentId, platformId, 'reposts', 1)

    // 发布事件
    this.emitEvent('repost', contentId, userId, platformId, contentType, {
      newPostId,
      comment,
    })

    this.logger.debug(`用户 ${userId} 转发内容 ${contentId} -> ${newPostId}`)

    return newPostId
  }

  async getReposts(
    contentId: string,
    options: PaginationOptions = {}
  ): Promise<RepostRecord[]> {
    const records = this.reposts.get(contentId) ?? []
    return this.paginate(records, options)
  }

  // ==========================================================================
  // 浏览记录
  // ==========================================================================

  async recordView(
    contentId: string,
    userId: string,
    options: ViewRecordOptions & BaseInteractionOptions = {}
  ): Promise<void> {
    const platformId = options.platformId ?? DEFAULT_PLATFORM_ID
    const contentType = options.contentType ?? DEFAULT_CONTENT_TYPE

    // 获取或创建用户互动记录
    const interaction = this.getOrCreateUserInteraction(
      userId,
      contentId,
      contentType,
      platformId
    )
    interaction.viewCount++
    interaction.lastViewAt = Date.now()
    interaction.updatedAt = Date.now()

    // 获取或创建浏览历史列表
    if (!this.viewHistory.has(userId)) {
      this.viewHistory.set(userId, [])
    }

    const history = this.viewHistory.get(userId)!

    // 检查是否已存在相同内容的记录
    const existingIndex = history.findIndex((r) => r.contentId === contentId)
    if (existingIndex !== -1) {
      // 更新现有记录
      const existing = history[existingIndex]
      existing.viewedAt = Date.now()
      if (options.duration !== undefined) {
        existing.duration = (existing.duration ?? 0) + options.duration
      }
      if (options.scrollDepth !== undefined) {
        existing.scrollDepth = Math.max(existing.scrollDepth ?? 0, options.scrollDepth)
      }
      // 移动到最前面
      history.splice(existingIndex, 1)
      history.unshift(existing)
    } else {
      // 创建新记录
      const record: ViewRecord = {
        id: uuidv4(),
        userId,
        contentId,
        contentType,
        platformId,
        viewedAt: Date.now(),
        duration: options.duration,
        scrollDepth: options.scrollDepth,
        source: options.source,
      }
      history.unshift(record)

      // 限制历史记录数量
      if (history.length > MAX_VIEW_HISTORY) {
        history.splice(MAX_VIEW_HISTORY)
      }
    }

    // 更新统计
    await this.incrementStats(contentId, platformId, 'views', 1)

    // 发布事件
    this.emitEvent('view', contentId, userId, platformId, contentType, {
      duration: options.duration,
      scrollDepth: options.scrollDepth,
    })
  }

  async getViewHistory(
    userId: string,
    options: GetViewHistoryOptions = {}
  ): Promise<ViewRecord[]> {
    const history = this.viewHistory.get(userId) ?? []

    let result = [...history]

    // 平台过滤
    if (options.platformId) {
      result = result.filter((r) => r.platformId === options.platformId)
    }

    // 内容类型过滤
    if (options.contentType) {
      result = result.filter((r) => r.contentType === options.contentType)
    }

    // 时间范围过滤
    if (options.startTime !== undefined) {
      result = result.filter((r) => r.viewedAt >= options.startTime!)
    }
    if (options.endTime !== undefined) {
      result = result.filter((r) => r.viewedAt <= options.endTime!)
    }

    // 分页
    return this.paginate(result, options)
  }

  async clearViewHistory(userId: string, platformId?: PlatformId): Promise<void> {
    if (platformId) {
      // 只清除特定平台的历史
      const history = this.viewHistory.get(userId)
      if (history) {
        const filtered = history.filter((r) => r.platformId !== platformId)
        this.viewHistory.set(userId, filtered)
      }
    } else {
      // 清除所有历史
      this.viewHistory.delete(userId)
    }

    this.logger.debug(`用户 ${userId} 清除浏览历史`, { platformId })
  }

  // ==========================================================================
  // 统计相关
  // ==========================================================================

  async getStats(contentId: string, platformId: PlatformId): Promise<InteractionStats> {
    const key = this.getStatsKey(contentId, platformId)
    return (
      this.contentStats.get(key) ?? {
        contentId,
        contentType: DEFAULT_CONTENT_TYPE,
        platformId,
        likes: 0,
        favorites: 0,
        comments: 0,
        reposts: 0,
        views: 0,
        shares: 0,
        updatedAt: Date.now(),
      }
    )
  }

  async batchGetStats(
    contentIds: string[],
    platformId: PlatformId
  ): Promise<Map<string, InteractionStats>> {
    const result = new Map<string, InteractionStats>()

    for (const contentId of contentIds) {
      const stats = await this.getStats(contentId, platformId)
      result.set(contentId, stats)
    }

    return result
  }

  async incrementStats(
    contentId: string,
    platformId: PlatformId,
    field: keyof Omit<InteractionStats, 'contentId' | 'contentType' | 'platformId' | 'updatedAt'>,
    delta = 1
  ): Promise<void> {
    const key = this.getStatsKey(contentId, platformId)
    let stats = this.contentStats.get(key)

    if (!stats) {
      stats = {
        contentId,
        contentType: DEFAULT_CONTENT_TYPE,
        platformId,
        likes: 0,
        favorites: 0,
        comments: 0,
        reposts: 0,
        views: 0,
        shares: 0,
        updatedAt: Date.now(),
      }
      this.contentStats.set(key, stats)
    }

    stats[field] = Math.max(0, stats[field] + delta)
    stats.updatedAt = Date.now()
  }

  // ==========================================================================
  // 事件相关
  // ==========================================================================

  onInteraction(handler: InteractionEventHandler): () => void {
    return this.on('*' as InteractionType, handler)
  }

  on(type: InteractionType, handler: InteractionEventHandler): () => void {
    const key = type as InteractionType | '*'
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set())
    }
    this.eventListeners.get(key)!.add(handler)

    return () => {
      this.off(type, handler)
    }
  }

  off(type: InteractionType, handler?: InteractionEventHandler): void {
    const key = type as InteractionType | '*'
    if (!handler) {
      this.eventListeners.delete(key)
      return
    }

    const handlers = this.eventListeners.get(key)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventListeners.delete(key)
      }
    }
  }

  // ==========================================================================
  // 平台扩展
  // ==========================================================================

  registerPlatformBehavior(
    behavior: PlatformBehavior,
    options: RegisterPlatformBehaviorOptions = {}
  ): void {
    const key = this.getPlatformBehaviorKey(behavior.platformId, behavior.action)

    if (this.platformBehaviors.has(key) && !options.override) {
      this.logger.warn(
        `平台行为 ${behavior.platformId}:${behavior.action} 已存在，跳过注册`
      )
      return
    }

    this.platformBehaviors.set(key, behavior)
    this.logger.info(
      `注册平台行为: ${behavior.platformId}:${behavior.action} - ${behavior.name}`
    )
  }

  getPlatformBehavior(
    platformId: PlatformId,
    action: string
  ): PlatformBehavior | undefined {
    const key = this.getPlatformBehaviorKey(platformId, action)
    return this.platformBehaviors.get(key)
  }

  getPlatformBehaviors(platformId: PlatformId): PlatformBehavior[] {
    const behaviors: PlatformBehavior[] = []
    for (const [key, behavior] of this.platformBehaviors) {
      if (key.startsWith(`${platformId}:`)) {
        behaviors.push(behavior)
      }
    }
    return behaviors
  }

  async executePlatformBehavior(
    platformId: PlatformId,
    action: string,
    contentId: string,
    userId: string,
    params?: Record<string, unknown>
  ): Promise<void> {
    const behavior = this.getPlatformBehavior(platformId, action)
    if (!behavior) {
      throw new Error(`平台行为 ${platformId}:${action} 未注册`)
    }

    this.logger.debug(
      `执行平台行为: ${platformId}:${action}`,
      { contentId, userId, params }
    )

    await behavior.execute(contentId, userId, params)
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 获取或创建用户互动记录
   */
  private getOrCreateUserInteraction(
    userId: string,
    contentId: string,
    contentType: ContentType,
    platformId: PlatformId
  ): UserInteraction {
    if (!this.userInteractions.has(userId)) {
      this.userInteractions.set(userId, new Map())
    }

    const userMap = this.userInteractions.get(userId)!

    if (!userMap.has(contentId)) {
      const now = Date.now()
      userMap.set(contentId, {
        id: uuidv4(),
        userId,
        contentId,
        contentType,
        platformId,
        isLiked: false,
        isFavorited: false,
        viewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    }

    return userMap.get(contentId)!
  }

  /**
   * 获取用户互动记录
   */
  private getUserInteraction(
    userId: string,
    contentId: string
  ): UserInteraction | undefined {
    return this.userInteractions.get(userId)?.get(contentId)
  }

  /**
   * 查找评论
   */
  private findComment(contentId: string, commentId: string): Comment | undefined {
    const commentList = this.comments.get(contentId)
    return commentList?.find((c) => c.id === commentId)
  }

  /**
   * 更新收藏夹计数
   */
  private updateCollectionCount(
    userId: string,
    collectionId: string,
    delta: number
  ): void {
    const collections = this.favoriteCollections.get(userId)
    if (collections) {
      const collection = collections.find((c) => c.id === collectionId)
      if (collection) {
        collection.count = Math.max(0, collection.count + delta)
        collection.updatedAt = Date.now()
      }
    }
  }

  /**
   * 发布互动事件
   */
  private emitEvent(
    type: InteractionType,
    contentId: string,
    userId: string,
    platformId: PlatformId,
    contentType: ContentType,
    metadata?: Record<string, unknown>
  ): void {
    const event: InteractionEvent = {
      id: uuidv4(),
      type,
      contentId,
      contentType,
      userId,
      platformId,
      timestamp: Date.now(),
      metadata,
    }

    // 通知类型特定的监听器
    const typeHandlers = this.eventListeners.get(type)
    if (typeHandlers) {
      typeHandlers.forEach((handler) => {
        try {
          handler(event)
        } catch (error) {
          this.logger.error(`事件处理器错误 [${type}]:`, error)
        }
      })
    }

    // 通知全局监听器
    const globalHandlers = this.eventListeners.get('*')
    if (globalHandlers) {
      globalHandlers.forEach((handler) => {
        try {
          handler(event)
        } catch (error) {
          this.logger.error(`全局事件处理器错误:`, error)
        }
      })
    }

    // 发布到事件总线
    eventBus.emit(`interaction:${type}`, {
      contentId,
      userId,
      platformId,
      timestamp: event.timestamp,
      ...metadata,
    })
  }

  /**
   * 获取统计键
   */
  private getStatsKey(contentId: string, platformId: PlatformId): string {
    return `${platformId}:${contentId}`
  }

  /**
   * 获取平台行为键
   */
  private getPlatformBehaviorKey(platformId: PlatformId, action: string): string {
    return `${platformId}:${action}`
  }

  /**
   * 分页
   */
  private paginate<T>(items: T[], options: PaginationOptions): T[] {
    const offset = options.offset ?? 0
    const limit = options.limit ?? DEFAULT_PAGE_SIZE
    return items.slice(offset, offset + limit)
  }
}

// 创建单例实例
export const interactionService: IInteractionService = new InteractionServiceImpl()

// 便捷函数
export function useInteractionService(): IInteractionService {
  return interactionService
}
