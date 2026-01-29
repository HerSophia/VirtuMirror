/**
 * EventChannel 类
 * 提供命名通道的事件隔离
 */

import type { EventHandler, Unsubscribe, IEventChannel, IEventBus } from '@/types/eventBus'

export class EventChannel implements IEventChannel {
  /** 通道名称 */
  public readonly name: string

  /** 父事件总线引用 */
  private parent: IEventBus

  constructor(name: string, parent: IEventBus) {
    this.name = name
    this.parent = parent
  }

  /**
   * 生成带通道前缀的事件名
   * @param event 原始事件名
   * @returns 带前缀的事件名
   */
  private prefixEvent(event: string): string {
    return `${this.name}:${event}`
  }

  /**
   * 发布事件（自动添加通道前缀）
   * @param event 事件名称
   * @param payload 事件数据
   */
  emit<T>(event: string, payload: T): void {
    this.parent.emit(this.prefixEvent(event), payload)
  }

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    return this.parent.on(this.prefixEvent(event), handler)
  }

  /**
   * 一次性订阅
   * @param event 事件名称
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    return this.parent.once(this.prefixEvent(event), handler)
  }

  /**
   * 取消订阅
   * @param event 事件名称
   * @param handler 可选，指定要取消的处理函数
   */
  off(event: string, handler?: EventHandler): void {
    this.parent.off(this.prefixEvent(event), handler)
  }

  /**
   * 获取监听器数量
   * @param event 事件名称
   */
  getListenerCount(event: string): number {
    return this.parent.getListenerCount(this.prefixEvent(event))
  }

  /**
   * 清除通道内所有监听器
   */
  clear(): void {
    const prefix = `${this.name}:`
    const events = this.parent.getAllEvents()

    events.forEach((event) => {
      if (event.startsWith(prefix)) {
        this.parent.off(event)
      }
    })
  }
}
