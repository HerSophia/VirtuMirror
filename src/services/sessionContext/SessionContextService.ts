/**
 * 会话上下文服务实现
 *
 * 提供统一的酒馆会话/楼层/Swipe 上下文管理和数据隔离能力
 */

import { reactive, computed, type ComputedRef } from 'vue'
import { loggerService } from '@/services/logger'
import { eventBus } from '@/services/eventBus'
import type {
  SessionContext,
  SessionContextState,
  EmptySessionContext,
  ContentSourceTracking,
  TrackedContent,
  FilterMode,
  FilterConfig,
  SourceFilter,
  ISessionContextService,
  SessionContextChangedEvent,
} from '@/types/sessionContext'
import { createEmptyContext, DEFAULT_FILTER_CONFIG } from '@/types/sessionContext'

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 会话上下文服务
 * 单例模式，全局唯一实例
 */
export class SessionContextService implements ISessionContextService {
  /** 日志器 */
  private logger = loggerService.child('session-context')

  /** 内部响应式状态 */
  private _state: SessionContextState

  /** 是否已连接（计算属性） */
  private _isConnected: ComputedRef<boolean>

  constructor() {
    // 初始化为空上下文
    this._state = reactive(createEmptyContext()) as SessionContextState

    // 计算属性：是否已连接
    this._isConnected = computed(() => this._state.sessionId !== null)

    this.logger.info('会话上下文服务已初始化')
  }

  // ==================== 状态访问 ====================

  /**
   * 获取当前上下文（响应式）
   */
  get context(): SessionContextState {
    return this._state
  }

  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this._isConnected.value
  }

  // ==================== 上下文操作 ====================

  /**
   * 更新会话信息
   */
  updateSession(
    sessionId: string,
    characterName: string,
    playerName: string,
    platform: string
  ): void {
    const previousContext = this.cloneContext()
    const isNewSession = this._state.sessionId !== sessionId

    // 更新状态
    Object.assign(this._state, {
      sessionId,
      characterName,
      playerName,
      platform,
      // 新会话时重置楼层和 Swipe
      messageId: isNewSession ? 0 : this._state.messageId,
      swipeId: isNewSession ? 0 : this._state.swipeId,
      lastUpdatedAt: Date.now(),
    } as SessionContext)

    this.logger.info('会话已更新', {
      sessionId,
      characterName,
      isNewSession,
    })

    // 发布事件
    this.emitContextChanged('session', previousContext)
  }

  /**
   * 更新楼层信息
   */
  updateMessage(messageId: number): void {
    if (!this.isConnected) {
      this.logger.warn('未连接，无法更新楼层')
      return
    }

    const previousContext = this.cloneContext()
    const state = this._state as SessionContext

    state.messageId = messageId
    state.lastUpdatedAt = Date.now()

    this.logger.debug('楼层已更新', { messageId })

    this.emitContextChanged('message', previousContext)
  }

  /**
   * 更新 Swipe 信息
   */
  updateSwipe(swipeId: number): void {
    if (!this.isConnected) {
      this.logger.warn('未连接，无法更新 Swipe')
      return
    }

    const previousContext = this.cloneContext()
    const state = this._state as SessionContext

    state.swipeId = swipeId
    state.lastUpdatedAt = Date.now()

    this.logger.debug('Swipe 已更新', { swipeId })

    this.emitContextChanged('swipe', previousContext)
  }

  /**
   * 清除上下文（断开连接时）
   */
  clearContext(): void {
    const previousContext = this.cloneContext()

    // 重置为空上下文
    Object.assign(this._state, createEmptyContext())

    this.logger.info('上下文已清除')

    this.emitContextChanged('clear', previousContext)
  }

  // ==================== 来源追踪 ====================

  /**
   * 获取当前来源追踪信息
   */
  getCurrentSourceTracking(): ContentSourceTracking | null {
    if (!this.isConnected) {
      return null
    }

    const state = this._state as SessionContext

    return {
      sessionId: state.sessionId,
      messageId: state.messageId,
      swipeId: state.swipeId,
      createdAt: Date.now(),
    }
  }

  // ==================== 数据过滤 ====================

  /**
   * 构建来源过滤器
   */
  buildSourceFilter<T extends TrackedContent>(
    mode: FilterMode = 'session',
    config?: Partial<FilterConfig>
  ): SourceFilter<T> {
    const finalConfig: FilterConfig = {
      ...DEFAULT_FILTER_CONFIG,
      ...config,
      mode,
    }

    // 未连接时返回全通过滤器
    if (!this.isConnected) {
      return () => true
    }

    const state = this._state as SessionContext

    return (item: T): boolean => {
      // 无来源数据处理
      if (!item.source) {
        return finalConfig.includeUntracked
      }

      const source = item.source

      switch (finalConfig.mode) {
        case 'all':
          return true

        case 'session':
          return source.sessionId === state.sessionId

        case 'message':
          return (
            source.sessionId === state.sessionId &&
            source.messageId === state.messageId
          )

        case 'swipe':
          return (
            source.sessionId === state.sessionId &&
            source.messageId === state.messageId &&
            source.swipeId === state.swipeId
          )

        default:
          return true
      }
    }
  }

  /**
   * 检查数据项是否属于当前会话
   */
  belongsToCurrentSession<T extends TrackedContent>(item: T): boolean {
    if (!this.isConnected || !item.source) {
      return true // 无来源数据默认显示
    }

    const state = this._state as SessionContext
    return item.source.sessionId === state.sessionId
  }

  /**
   * 检查数据项是否属于当前楼层
   */
  belongsToCurrentMessage<T extends TrackedContent>(item: T): boolean {
    if (!this.isConnected || !item.source) {
      return true
    }

    const state = this._state as SessionContext
    return (
      item.source.sessionId === state.sessionId &&
      item.source.messageId === state.messageId
    )
  }

  /**
   * 检查数据项是否属于当前 Swipe
   */
  belongsToCurrentSwipe<T extends TrackedContent>(item: T): boolean {
    if (!this.isConnected || !item.source) {
      return true
    }

    const state = this._state as SessionContext
    return (
      item.source.sessionId === state.sessionId &&
      item.source.messageId === state.messageId &&
      item.source.swipeId === state.swipeId
    )
  }

  // ==================== 私有方法 ====================

  /**
   * 克隆当前上下文
   */
  private cloneContext(): SessionContextState {
    if (!this.isConnected) {
      return createEmptyContext()
    }

    const state = this._state as SessionContext
    return { ...state }
  }

  /**
   * 发布上下文变更事件
   */
  private emitContextChanged(
    type: SessionContextChangedEvent['type'],
    previousContext: SessionContextState
  ): void {
    const event: SessionContextChangedEvent = {
      type,
      previousContext,
      newContext: this.cloneContext(),
      timestamp: Date.now(),
    }

    eventBus.emit('session-context:changed', event)

    // 同时发布标准会话事件（兼容 eventBus 类型）
    if (type === 'session' && this.isConnected) {
      const state = this._state as SessionContext
      eventBus.emit('session:changed', {
        sessionId: state.sessionId,
        previousSessionId: (previousContext as SessionContext)?.sessionId,
        characterName: state.characterName,
      })
    }
  }
}

// ============================================================================
// 单例导出
// ============================================================================

/** 会话上下文服务单例 */
export const sessionContextService = new SessionContextService()
