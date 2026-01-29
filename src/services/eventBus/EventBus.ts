/**
 * EventBus 核心类
 * 提供事件发布/订阅功能
 */

import type { EventHandler, Unsubscribe, IEventBus, IEventChannel } from '@/types/eventBus'
import { EventChannel } from './EventChannel'
import { loggerService } from '@/services/logger'

/** 默认最大监听器数量警告阈值 */
const MAX_LISTENERS_WARNING = 100

export class EventBus implements IEventBus {
  /** 事件监听器映射: event -> Set<handler> */
  private listeners = new Map<string, Set<EventHandler>>()

  /** 命名通道缓存 */
  private channels = new Map<string, EventChannel>()

  /** 调试模式 */
  private debugMode = false

  /** 日志器 */
  private logger = loggerService.child('eventBus')

  /**
   * 发布事件
   * @param event 事件名称
   * @param payload 事件数据
   */
  emit<T>(event: string, payload: T): void {
    if (this.debugMode) {
      this.logger.debug(`emit: ${event}`, payload)
    }

    const handlers = this.listeners.get(event)
    if (!handlers || handlers.size === 0) {
      if (this.debugMode) {
        this.logger.debug(`no listeners for: ${event}`)
      }
      return
    }

    // 遍历所有处理函数
    let handledCount = 0
    handlers.forEach((handler) => {
      try {
        handler(payload)
        handledCount++
      } catch (error) {
        // 捕获错误，不影响其他处理函数
        this.logger.error(`handler error for ${event}:`, error)
      }
    })

    if (this.debugMode) {
      this.logger.debug(`handled by ${handledCount} listeners`)
    }
  }

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    const handlers = this.listeners.get(event)!
    handlers.add(handler)

    // 开发环境下检测可能的内存泄漏
    if (import.meta.env.DEV) {
      const count = handlers.size
      if (count > MAX_LISTENERS_WARNING) {
        this.logger.warn(
          `事件 "${event}" 有 ${count} 个监听器，可能存在内存泄漏`
        )
      }
    }

    // 返回取消订阅函数
    return () => {
      handlers.delete(handler)
      // 如果没有监听器了，清理 Map 条目
      if (handlers.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * 一次性订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    const wrappedHandler: EventHandler<T> = (payload) => {
      unsubscribe()
      handler(payload)
    }

    const unsubscribe = this.on(event, wrappedHandler)
    return unsubscribe
  }

  /**
   * 取消订阅
   * @param event 事件名称
   * @param handler 可选，指定要取消的处理函数；不传则取消该事件的所有订阅
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      // 取消该事件的所有订阅
      this.listeners.delete(event)
      return
    }

    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * 获取或创建命名通道
   * @param name 通道名称
   * @returns 隔离的事件通道
   */
  channel(name: string): IEventChannel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new EventChannel(name, this))
    }
    return this.channels.get(name)!
  }

  /**
   * 获取指定事件的监听器数量
   * @param event 事件名称
   */
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }

  /**
   * 获取所有已注册的事件名称
   */
  getAllEvents(): string[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * 清除所有事件监听器
   */
  clear(): void {
    this.listeners.clear()
    this.channels.clear()
  }

  /**
   * 设置调试模式
   * @param enabled 是否启用调试模式
   */
  setDebug(enabled: boolean): void {
    this.debugMode = enabled
    if (enabled) {
      this.logger.info('调试模式已启用')
    }
  }
}
