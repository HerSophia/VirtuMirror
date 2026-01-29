/**
 * 会话上下文服务类型定义
 *
 * 用于统一管理酒馆会话/楼层/Swipe 上下文和数据隔离
 */

// ============================================================================
// 核心上下文类型
// ============================================================================

/**
 * 会话上下文
 * 包含当前连接的酒馆会话信息
 */
export interface SessionContext {
  /** 会话 ID (UUID) - 唯一标识一个聊天文件 */
  sessionId: string
  /** 当前楼层号 (message_id) */
  messageId: number
  /** 当前 Swipe ID */
  swipeId: number
  /** 角色名称 */
  characterName: string
  /** 玩家名称 */
  playerName: string
  /** 平台标识 */
  platform: string
  /** 最后更新时间 */
  lastUpdatedAt: number
}

/**
 * 空上下文（未连接状态）
 */
export interface EmptySessionContext {
  sessionId: null
  messageId: null
  swipeId: null
  characterName: null
  playerName: null
  platform: null
  lastUpdatedAt: null
}

/**
 * 上下文状态（连接或未连接）
 */
export type SessionContextState = SessionContext | EmptySessionContext

// ============================================================================
// 来源追踪类型
// ============================================================================

/**
 * 内容来源追踪信息
 * 用于附加到 App 数据上，支持数据溯源和过滤
 */
export interface ContentSourceTracking {
  /** 所属会话 ID */
  sessionId: string
  /** 创建时的楼层号 */
  messageId: number
  /** 创建时的 Swipe ID */
  swipeId: number
  /** 创建时间戳 */
  createdAt: number
}

/**
 * 带来源追踪的数据项基类
 * App 数据应扩展此接口以支持过滤
 */
export interface TrackedContent {
  /** 来源追踪信息 */
  source?: ContentSourceTracking
}

// ============================================================================
// 过滤相关类型
// ============================================================================

/**
 * 过滤模式
 */
export type FilterMode = 'all' | 'session' | 'message' | 'swipe'

/**
 * 过滤器函数类型
 */
export type SourceFilter<T extends TrackedContent = TrackedContent> = (item: T) => boolean

/**
 * 过滤器配置
 */
export interface FilterConfig {
  /** 过滤模式 */
  mode: FilterMode
  /** 是否包含无来源数据（历史兼容） */
  includeUntracked: boolean
}

// ============================================================================
// 服务接口
// ============================================================================

/**
 * 会话上下文服务接口
 */
export interface ISessionContextService {
  // ==================== 状态访问 ====================

  /** 当前上下文（响应式） */
  readonly context: SessionContextState

  /** 是否已连接 */
  readonly isConnected: boolean

  // ==================== 上下文操作 ====================

  /**
   * 更新会话信息
   * @param sessionId 新的会话 ID
   * @param characterName 角色名称
   * @param playerName 玩家名称
   * @param platform 平台标识
   */
  updateSession(
    sessionId: string,
    characterName: string,
    playerName: string,
    platform: string
  ): void

  /**
   * 更新楼层信息
   * @param messageId 新的楼层号
   */
  updateMessage(messageId: number): void

  /**
   * 更新 Swipe 信息
   * @param swipeId 新的 Swipe ID
   */
  updateSwipe(swipeId: number): void

  /**
   * 清除上下文（断开连接时）
   */
  clearContext(): void

  // ==================== 来源追踪 ====================

  /**
   * 获取当前来源追踪信息
   * 用于写入新数据时附加来源
   */
  getCurrentSourceTracking(): ContentSourceTracking | null

  // ==================== 数据过滤 ====================

  /**
   * 构建来源过滤器
   * @param mode 过滤模式
   * @param config 额外配置
   */
  buildSourceFilter<T extends TrackedContent>(
    mode?: FilterMode,
    config?: Partial<FilterConfig>
  ): SourceFilter<T>

  /**
   * 检查数据项是否属于当前会话
   * @param item 数据项
   */
  belongsToCurrentSession<T extends TrackedContent>(item: T): boolean

  /**
   * 检查数据项是否属于当前楼层
   * @param item 数据项
   */
  belongsToCurrentMessage<T extends TrackedContent>(item: T): boolean

  /**
   * 检查数据项是否属于当前 Swipe
   * @param item 数据项
   */
  belongsToCurrentSwipe<T extends TrackedContent>(item: T): boolean
}

// ============================================================================
// 事件类型
// ============================================================================

/**
 * 会话上下文变更事件
 */
export interface SessionContextChangedEvent {
  /** 变更类型 */
  type: 'session' | 'message' | 'swipe' | 'clear'
  /** 旧上下文 */
  previousContext: SessionContextState
  /** 新上下文 */
  newContext: SessionContextState
  /** 时间戳 */
  timestamp: number
}

// ============================================================================
// 常量
// ============================================================================

/**
 * 创建空上下文
 */
export function createEmptyContext(): EmptySessionContext {
  return {
    sessionId: null,
    messageId: null,
    swipeId: null,
    characterName: null,
    playerName: null,
    platform: null,
    lastUpdatedAt: null,
  }
}

/**
 * 默认过滤器配置
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  mode: 'session',
  includeUntracked: true,
}
