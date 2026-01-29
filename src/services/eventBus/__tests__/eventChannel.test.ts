/**
 * EventChannel 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import './setup'
import { EventBus } from '../EventBus'
import { EventChannel } from '../EventChannel'

describe('EventChannel 事件通道', () => {
  let eventBus: EventBus
  let channel: EventChannel

  beforeEach(() => {
    eventBus = new EventBus()
    channel = new EventChannel('testChannel', eventBus)
  })

  describe('基本属性', () => {
    it('应该有正确的通道名称', () => {
      expect(channel.name).toBe('testChannel')
    })
  })

  describe('emit/on 发布订阅', () => {
    it('事件应该添加通道前缀', () => {
      const handler = vi.fn()

      // 通过 channel 订阅
      channel.on('myEvent', handler)

      // 直接通过 eventBus 发送带前缀的事件
      eventBus.emit('testChannel:myEvent', 'payload')

      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('发布事件时应该添加通道前缀', () => {
      const handler = vi.fn()

      // 直接通过 eventBus 订阅带前缀的事件
      eventBus.on('testChannel:myEvent', handler)

      // 通过 channel 发送
      channel.emit('myEvent', 'payload')

      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('通道内的发布订阅应该正常工作', () => {
      const handler = vi.fn()

      channel.on('event', handler)
      channel.emit('event', { data: 123 })

      expect(handler).toHaveBeenCalledWith({ data: 123 })
    })
  })

  describe('once 一次性订阅', () => {
    it('处理函数应该只被调用一次', () => {
      const handler = vi.fn()

      channel.once('event', handler)
      channel.emit('event', 'first')
      channel.emit('event', 'second')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('first')
    })
  })

  describe('off 取消订阅', () => {
    it('应该移除处理函数', () => {
      const handler = vi.fn()

      channel.on('event', handler)
      channel.off('event', handler)
      channel.emit('event', 'payload')

      expect(handler).not.toHaveBeenCalled()
    })

    it('不指定处理函数时应该移除所有处理函数', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      channel.on('event', handler1)
      channel.on('event', handler2)
      channel.off('event')
      channel.emit('event', 'payload')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('getListenerCount 获取监听器数量', () => {
    it('应该返回正确的数量', () => {
      expect(channel.getListenerCount('event')).toBe(0)

      const unsub = channel.on('event', () => {})
      expect(channel.getListenerCount('event')).toBe(1)

      unsub()
      expect(channel.getListenerCount('event')).toBe(0)
    })
  })

  describe('clear 清除通道事件', () => {
    it('应该移除通道内所有事件，但不影响其他事件', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const otherHandler = vi.fn()

      channel.on('event1', handler1)
      channel.on('event2', handler2)
      eventBus.on('otherEvent', otherHandler)

      channel.clear()

      channel.emit('event1', 'payload')
      channel.emit('event2', 'payload')
      eventBus.emit('otherEvent', 'payload')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(otherHandler).toHaveBeenCalledWith('payload')
    })
  })

  describe('通道隔离', () => {
    it('不同通道的事件应该相互隔离', () => {
      const channel1 = new EventChannel('channel1', eventBus)
      const channel2 = new EventChannel('channel2', eventBus)

      const handler1 = vi.fn()
      const handler2 = vi.fn()

      channel1.on('sameEvent', handler1)
      channel2.on('sameEvent', handler2)

      channel1.emit('sameEvent', 'data1')

      expect(handler1).toHaveBeenCalledWith('data1')
      expect(handler2).not.toHaveBeenCalled()

      channel2.emit('sameEvent', 'data2')

      expect(handler2).toHaveBeenCalledWith('data2')
      expect(handler1).toHaveBeenCalledTimes(1) // 仍然只被调用一次
    })
  })
})
