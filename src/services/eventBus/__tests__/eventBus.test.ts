/**
 * EventBus 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import './setup'
import { EventBus } from '../EventBus'

describe('EventBus 事件总线', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  describe('emit/on 发布订阅', () => {
    it('应该使用正确的 payload 调用处理函数', () => {
      const handler = vi.fn()
      eventBus.on('test', handler)

      eventBus.emit('test', { data: 123 })

      expect(handler).toHaveBeenCalledWith({ data: 123 })
    })

    it('应该调用多个处理函数', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.on('test', handler1)
      eventBus.on('test', handler2)
      eventBus.emit('test', 'payload')

      expect(handler1).toHaveBeenCalledWith('payload')
      expect(handler2).toHaveBeenCalledWith('payload')
    })

    it('不同事件不应该触发处理函数', () => {
      const handler = vi.fn()
      eventBus.on('test1', handler)

      eventBus.emit('test2', 'payload')

      expect(handler).not.toHaveBeenCalled()
    })

    it('没有监听器时发布事件不应该抛出异常', () => {
      expect(() => {
        eventBus.emit('nonexistent', { data: 1 })
      }).not.toThrow()
    })

    it('取消订阅后不应该调用处理函数', () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.on('test', handler)

      unsubscribe()
      eventBus.emit('test', 'payload')

      expect(handler).not.toHaveBeenCalled()
    })

    it('应该按注册顺序调用处理函数', () => {
      const order: number[] = []
      const handler1 = vi.fn(() => order.push(1))
      const handler2 = vi.fn(() => order.push(2))
      const handler3 = vi.fn(() => order.push(3))

      eventBus.on('test', handler1)
      eventBus.on('test', handler2)
      eventBus.on('test', handler3)
      eventBus.emit('test', null)

      expect(order).toEqual([1, 2, 3])
    })
  })

  describe('once 一次性订阅', () => {
    it('处理函数应该只被调用一次', () => {
      const handler = vi.fn()
      eventBus.once('test', handler)

      eventBus.emit('test', 'first')
      eventBus.emit('test', 'second')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('first')
    })

    it('事件触发前可以手动取消订阅', () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.once('test', handler)

      unsubscribe()
      eventBus.emit('test', 'payload')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('off 取消订阅', () => {
    it('应该移除指定的处理函数', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.on('test', handler1)
      eventBus.on('test', handler2)
      eventBus.off('test', handler1)
      eventBus.emit('test', 'payload')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith('payload')
    })

    it('不指定处理函数时应该移除所有处理函数', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.on('test', handler1)
      eventBus.on('test', handler2)
      eventBus.off('test')
      eventBus.emit('test', 'payload')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('移除不存在的处理函数不应该抛出异常', () => {
      const handler = vi.fn()

      expect(() => {
        eventBus.off('nonexistent', handler)
      }).not.toThrow()
    })
  })

  describe('错误处理', () => {
    it('单个处理函数异常不应该影响其他处理函数', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('测试错误')
      })
      const normalHandler = vi.fn()

      eventBus.on('test', errorHandler)
      eventBus.on('test', normalHandler)

      eventBus.emit('test', 'payload')

      expect(errorHandler).toHaveBeenCalled()
      expect(normalHandler).toHaveBeenCalled()
    })
  })

  describe('getListenerCount 获取监听器数量', () => {
    it('应该返回正确的监听器数量', () => {
      expect(eventBus.getListenerCount('test')).toBe(0)

      const unsub1 = eventBus.on('test', () => {})
      expect(eventBus.getListenerCount('test')).toBe(1)

      const unsub2 = eventBus.on('test', () => {})
      expect(eventBus.getListenerCount('test')).toBe(2)

      unsub1()
      expect(eventBus.getListenerCount('test')).toBe(1)

      unsub2()
      expect(eventBus.getListenerCount('test')).toBe(0)
    })
  })

  describe('getAllEvents 获取所有事件', () => {
    it('应该返回所有已注册的事件名称', () => {
      eventBus.on('event1', () => {})
      eventBus.on('event2', () => {})
      eventBus.on('event3', () => {})

      const events = eventBus.getAllEvents()

      expect(events).toHaveLength(3)
      expect(events).toContain('event1')
      expect(events).toContain('event2')
      expect(events).toContain('event3')
    })

    it('没有注册事件时应该返回空数组', () => {
      expect(eventBus.getAllEvents()).toEqual([])
    })
  })

  describe('clear 清除所有监听器', () => {
    it('应该移除所有事件监听器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.on('event1', handler1)
      eventBus.on('event2', handler2)
      eventBus.clear()

      eventBus.emit('event1', 'payload')
      eventBus.emit('event2', 'payload')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(eventBus.getAllEvents()).toEqual([])
    })
  })

  describe('channel 通道隔离', () => {
    it('相同名称应该返回相同的通道实例', () => {
      const channel1 = eventBus.channel('test')
      const channel2 = eventBus.channel('test')

      expect(channel1).toBe(channel2)
    })

    it('不同名称应该返回不同的通道实例', () => {
      const channel1 = eventBus.channel('test1')
      const channel2 = eventBus.channel('test2')

      expect(channel1).not.toBe(channel2)
    })

    it('不同通道的事件应该相互隔离', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const channel1 = eventBus.channel('app1')
      const channel2 = eventBus.channel('app2')

      channel1.on('event', handler1)
      channel2.on('event', handler2)

      channel1.emit('event', 'data1')

      expect(handler1).toHaveBeenCalledWith('data1')
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('调试模式', () => {
    it('启用调试模式不应该抛出异常', () => {
      expect(() => {
        eventBus.setDebug(true)
        eventBus.emit('test', { data: 1 })
        eventBus.setDebug(false)
      }).not.toThrow()
    })
  })
})
