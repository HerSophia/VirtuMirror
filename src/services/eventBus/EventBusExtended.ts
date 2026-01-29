/**
 * EventBus 扩展功能
 * 提供异步事件、历史记录、过滤器等高级功能
 */

import type { EventHandler, Unsubscribe, IEventBus, IEventChannel } from '@/types/eventBus'
import { EventBus } from './EventBus'
import { loggerService } from '@/services/logger'

// ============================================================================
// 类型定义
// ============================================================================

/** 事件记录 */
export interface EventRecord {
  /** 事件名称 */
  event: string
  /** 事件数据 */
  payload: any
  /** 时间戳 */
  timestamp: number
  /** 处理函数数量 */
  handlerCount: number
}

/** 过滤器函数 */
export type EventFilter<T = any> = (payload: T) => boolean

/** 扩展事件总线接口 */
export interface IEventBusExtended extends IEventBus {
  /** 异步发布事件，等待所有处理函数完成 */
  emitAsync<T>(event: string, payload: T): Promise<void>
  /** 带过滤器的订阅 */
  onFiltered<T>(event: string, filter: EventFilter<T>, handler: EventHandler<T>): Unsubscribe
  /** 获取事件历史 */
  getHistory(): EventRecord[]
  /** 清除历史记录 */
  clearHistory(): void
  /** 设置最大历史记录数 */
  setMaxHistory(max: number): void
  /** 启用/禁用历史记录 */
  setHistoryEnabled(enabled: boolean): void
}

// ============================================================================
// 扩展实现
// ============================================================================

/**
 * 扩展事件总线
 * 在基础 EventBus 上添加异步支持、历史记录和过滤器功能
 */
export class EventBusExtended extends EventBus implements IEventBusExtended {
  /** 事件历史记录 */
  private history: EventRecord[] = []

  /** 最大历史记录数 */
  private maxHistory = 100

  /** 是否启用历史记录 */
  private historyEnabled = false

  /** 日志器 */
  private extLogger = loggerService.child('eventBus:extended')

  /**
   * 发布事件（覆盖父类方法以支持历史记录）
   */
  emit<T>(event: string, payload: T): void {
    // 记录历史
    if (this.historyEnabled) {
      this.recordEvent(event, payload)
    }

    // 调用父类方法
    super.emit(event, payload)
  }

  /**
   * 异步发布事件
   * 等待所有处理函数完成（包括返回 Promise 的处理函数）
   * @param event 事件名称
   * @param payload 事件数据
   */
  async emitAsync<T>(event: string, payload: T): Promise<void> {
    // 记录历史
    if (this.historyEnabled) {
      this.recordEvent(event, payload)
    }

    const handlers = this.getHandlers(event)
    if (!handlers || handlers.size === 0) {
      return
    }

    const promises: Promise<void>[] = []

    handlers.forEach((handler) => {
      try {
        const result = handler(payload) as unknown
        // 如果处理函数返回 Promise，收集它
        if (result && typeof result === 'object' && 'then' in result && typeof (result as Promise<unknown>).then === 'function') {
          promises.push(
            (result as Promise<void>).catch((error: unknown) => {
              this.extLogger.error(`异步处理函数错误 [${event}]:`, error)
            })
          )
        }
      } catch (error) {
        this.extLogger.error(`处理函数错误 [${event}]:`, error)
      }
    })

    // 等待所有异步处理函数完成
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  /**
   * 带过滤器的订阅
   * 只有当 payload 满足过滤条件时才调用处理函数
   * @param event 事件名称
   * @param filter 过滤器函数
   * @param handler 事件处理函数
   */
  onFiltered<T>(
    event: string,
    filter: EventFilter<T>,
    handler: EventHandler<T>
  ): Unsubscribe {
    const wrappedHandler: EventHandler<T> = (payload) => {
      try {
        if (filter(payload)) {
          handler(payload)
        }
      } catch (error) {
        this.extLogger.error(`过滤器错误 [${event}]:`, error)
      }
    }

    return this.on(event, wrappedHandler)
  }

  /**
   * 获取事件历史
   */
  getHistory(): EventRecord[] {
    return [...this.history]
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.history = []
  }

  /**
   * 设置最大历史记录数
   * @param max 最大记录数
   */
  setMaxHistory(max: number): void {
    this.maxHistory = max
    // 裁剪现有历史
    if (this.history.length > max) {
      this.history = this.history.slice(-max)
    }
  }

  /**
   * 启用/禁用历史记录
   * @param enabled 是否启用
   */
  setHistoryEnabled(enabled: boolean): void {
    this.historyEnabled = enabled
    if (enabled) {
      this.extLogger.info('事件历史记录已启用')
    } else {
      this.extLogger.info('事件历史记录已禁用')
    }
  }

  /**
   * 清除所有（覆盖父类以同时清除历史）
   */
  clear(): void {
    super.clear()
    this.clearHistory()
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 记录事件到历史
   */
  private recordEvent<T>(event: string, payload: T): void {
    const record: EventRecord = {
      event,
      payload,
      timestamp: Date.now(),
      handlerCount: this.getListenerCount(event),
    }

    this.history.push(record)

    // 裁剪历史
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  /**
   * 获取事件处理函数集合（访问父类私有属性的变通方法）
   */
  private getHandlers(event: string): Set<EventHandler> | undefined {
    // 通过反射访问父类的 listeners
    return (this as any).listeners?.get(event)
  }
}

// ============================================================================
// 便捷工具函数
// ============================================================================

/**
 * 创建事件等待器
 * 返回一个 Promise，在事件触发时 resolve
 * @param bus 事件总线
 * @param event 事件名称
 * @param timeout 超时时间（毫秒），0 表示不超时
 */
export function waitForEvent<T>(
  bus: IEventBus,
  event: string,
  timeout = 0
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = bus.once<T>(event, (payload) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      resolve(payload)
    })

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        unsubscribe()
        reject(new Error(`等待事件 "${event}" 超时 (${timeout}ms)`))
      }, timeout)
    }
  })
}

/**
 * 创建事件收集器
 * 收集指定时间内的所有事件
 * @param bus 事件总线
 * @param event 事件名称
 * @param duration 收集时长（毫秒）
 */
export function collectEvents<T>(
  bus: IEventBus,
  event: string,
  duration: number
): Promise<T[]> {
  return new Promise((resolve) => {
    const events: T[] = []

    const unsubscribe = bus.on<T>(event, (payload) => {
      events.push(payload)
    })

    setTimeout(() => {
      unsubscribe()
      resolve(events)
    }, duration)
  })
}

/**
 * 创建事件节流器
 * 在指定时间内只触发一次
 * @param bus 事件总线
 * @param event 事件名称
 * @param handler 处理函数
 * @param wait 节流时间（毫秒）
 */
export function throttledOn<T>(
  bus: IEventBus,
  event: string,
  handler: EventHandler<T>,
  wait: number
): Unsubscribe {
  let lastCall = 0

  return bus.on<T>(event, (payload) => {
    const now = Date.now()
    if (now - lastCall >= wait) {
      lastCall = now
      handler(payload)
    }
  })
}

/**
 * 创建事件防抖器
 * 连续触发时只在最后一次触发后执行
 * @param bus 事件总线
 * @param event 事件名称
 * @param handler 处理函数
 * @param wait 防抖时间（毫秒）
 */
export function debouncedOn<T>(
  bus: IEventBus,
  event: string,
  handler: EventHandler<T>,
  wait: number
): Unsubscribe {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const unsubscribe = bus.on<T>(event, (payload) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      handler(payload)
    }, wait)
  })

  // 返回一个增强的取消函数，同时清除待执行的防抖
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    unsubscribe()
  }
}
