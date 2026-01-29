/**
 * EventBusExtended 扩展功能测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import './setup'
import {
  EventBusExtended,
  waitForEvent,
  collectEvents,
  throttledOn,
  debouncedOn,
} from '../EventBusExtended'

describe('EventBusExtended 扩展事件总线', () => {
  let eventBus: EventBusExtended

  beforeEach(() => {
    eventBus = new EventBusExtended()
  })

  describe('emitAsync 异步发布', () => {
    it('应该等待所有异步处理函数完成', async () => {
      const order: string[] = []

      eventBus.on('async:test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        order.push('async1')
      })

      eventBus.on('async:test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        order.push('async2')
      })

      eventBus.on('async:test', () => {
        order.push('sync')
      })

      await eventBus.emitAsync('async:test', null)

      // 所有处理函数都应该完成
      expect(order).toContain('sync')
      expect(order).toContain('async1')
      expect(order).toContain('async2')
    })

    it('异步处理函数错误不应该阻止其他处理函数', async () => {
      const successHandler = vi.fn()

      eventBus.on('async:error', async () => {
        throw new Error('异步错误')
      })

      eventBus.on('async:error', successHandler)

      await eventBus.emitAsync('async:error', null)

      expect(successHandler).toHaveBeenCalled()
    })
  })

  describe('onFiltered 过滤订阅', () => {
    it('应该只在满足过滤条件时调用处理函数', () => {
      const handler = vi.fn()

      eventBus.onFiltered<{ platform: string }>(
        'filtered:test',
        (payload) => payload.platform === 'weibo',
        handler
      )

      eventBus.emit('filtered:test', { platform: 'weibo' })
      expect(handler).toHaveBeenCalledTimes(1)

      eventBus.emit('filtered:test', { platform: 'bilibili' })
      expect(handler).toHaveBeenCalledTimes(1) // 仍然是1次

      eventBus.emit('filtered:test', { platform: 'weibo' })
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('过滤器错误不应该影响事件处理', () => {
      const handler = vi.fn()

      eventBus.onFiltered(
        'filter:error',
        () => {
          throw new Error('过滤器错误')
        },
        handler
      )

      expect(() => {
        eventBus.emit('filter:error', null)
      }).not.toThrow()

      // 过滤器错误时处理函数不应该被调用
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('事件历史记录', () => {
    it('默认应该禁用历史记录', () => {
      eventBus.emit('test', 'data')
      expect(eventBus.getHistory()).toHaveLength(0)
    })

    it('启用后应该记录事件历史', () => {
      eventBus.setHistoryEnabled(true)

      eventBus.emit('event1', { data: 1 })
      eventBus.emit('event2', { data: 2 })

      const history = eventBus.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0].event).toBe('event1')
      expect(history[1].event).toBe('event2')
    })

    it('应该限制最大历史记录数', () => {
      eventBus.setHistoryEnabled(true)
      eventBus.setMaxHistory(3)

      for (let i = 0; i < 5; i++) {
        eventBus.emit(`event${i}`, i)
      }

      const history = eventBus.getHistory()
      expect(history).toHaveLength(3)
      expect(history[0].event).toBe('event2')
      expect(history[2].event).toBe('event4')
    })

    it('clearHistory 应该清除历史记录', () => {
      eventBus.setHistoryEnabled(true)
      eventBus.emit('test', 'data')

      eventBus.clearHistory()

      expect(eventBus.getHistory()).toHaveLength(0)
    })

    it('clear 应该同时清除历史记录', () => {
      eventBus.setHistoryEnabled(true)
      eventBus.emit('test', 'data')
      eventBus.on('test', () => {})

      eventBus.clear()

      expect(eventBus.getHistory()).toHaveLength(0)
      expect(eventBus.getAllEvents()).toEqual([])
    })
  })
})

describe('事件工具函数', () => {
  let eventBus: EventBusExtended

  beforeEach(() => {
    eventBus = new EventBusExtended()
  })

  describe('waitForEvent 等待事件', () => {
    it('应该在事件触发时 resolve', async () => {
      const promise = waitForEvent<{ value: number }>(eventBus, 'wait:test')

      setTimeout(() => {
        eventBus.emit('wait:test', { value: 42 })
      }, 10)

      const result = await promise
      expect(result.value).toBe(42)
    })

    it('超时时应该 reject', async () => {
      const promise = waitForEvent(eventBus, 'wait:timeout', 50)

      await expect(promise).rejects.toThrow('超时')
    })
  })

  describe('collectEvents 收集事件', () => {
    it('应该收集指定时间内的所有事件', async () => {
      const promise = collectEvents<number>(eventBus, 'collect:test', 100)

      setTimeout(() => eventBus.emit('collect:test', 1), 10)
      setTimeout(() => eventBus.emit('collect:test', 2), 30)
      setTimeout(() => eventBus.emit('collect:test', 3), 50)

      const events = await promise
      expect(events).toEqual([1, 2, 3])
    })
  })

  describe('throttledOn 节流订阅', () => {
    it('应该在节流时间内只触发一次', async () => {
      const handler = vi.fn()
      throttledOn(eventBus, 'throttle:test', handler, 50)

      // 快速连续触发
      eventBus.emit('throttle:test', 1)
      eventBus.emit('throttle:test', 2)
      eventBus.emit('throttle:test', 3)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(1)

      // 等待节流时间过后再次触发
      await new Promise((resolve) => setTimeout(resolve, 60))
      eventBus.emit('throttle:test', 4)

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenLastCalledWith(4)
    })
  })

  describe('debouncedOn 防抖订阅', () => {
    it('应该只在最后一次触发后执行', async () => {
      const handler = vi.fn()
      debouncedOn(eventBus, 'debounce:test', handler, 50)

      // 快速连续触发
      eventBus.emit('debounce:test', 1)
      eventBus.emit('debounce:test', 2)
      eventBus.emit('debounce:test', 3)

      // 等待一小段时间，处理函数不应该被调用
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(handler).not.toHaveBeenCalled()

      // 等待防抖时间过后
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(3) // 最后一个值
    })

    it('取消订阅时应该清除待执行的防抖', async () => {
      const handler = vi.fn()
      const unsubscribe = debouncedOn(eventBus, 'debounce:cancel', handler, 50)

      eventBus.emit('debounce:cancel', 1)
      unsubscribe()

      // 等待防抖时间过后
      await new Promise((resolve) => setTimeout(resolve, 60))
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
