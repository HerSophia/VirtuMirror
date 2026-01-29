/**
 * EventBus 集成测试
 * 模拟真实使用场景
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import './setup'
import { EventBus } from '../EventBus'
import type {
  PostCreatedEvent,
  LikeEvent,
  NotificationCreatedEvent,
  AccountStatsChangedEvent,
} from '@/types/eventBus'

describe('EventBus 集成测试', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  describe('涨粉引擎监听互动事件场景', () => {
    it('应该正确处理点赞事件并更新粉丝数据', () => {
      // 模拟涨粉引擎
      const growthEngineHandler = vi.fn()
      const statsUpdateHandler = vi.fn()

      // 订阅点赞事件
      eventBus.on<LikeEvent>('interaction:like', (payload) => {
        growthEngineHandler(payload)
        // 模拟涨粉引擎处理后发布统计更新事件
        eventBus.emit<AccountStatsChangedEvent>('account:stats:changed', {
          accountId: payload.userId,
          platformId: payload.platformId,
          statType: 'likes',
          oldValue: 100,
          newValue: 101,
          delta: 1,
        })
      })

      // 订阅统计更新事件
      eventBus.on<AccountStatsChangedEvent>('account:stats:changed', statsUpdateHandler)

      // 发布点赞事件
      const likeEvent: LikeEvent = {
        type: 'like',
        contentId: 'post_123',
        userId: 'user_456',
        platformId: 'weibo',
        timestamp: Date.now(),
      }
      eventBus.emit('interaction:like', likeEvent)

      // 验证涨粉引擎收到事件
      expect(growthEngineHandler).toHaveBeenCalledWith(likeEvent)
      // 验证统计更新事件被触发
      expect(statsUpdateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'user_456',
          statType: 'likes',
          delta: 1,
        })
      )
    })
  })

  describe('通知系统监听新评论场景', () => {
    it('应该在帖子创建后生成通知', () => {
      const notifications: NotificationCreatedEvent[] = []

      // 模拟通知服务
      eventBus.on<PostCreatedEvent>('content:post:created', (payload) => {
        // 为粉丝生成通知
        const notification: NotificationCreatedEvent = {
          notificationId: `notif_${Date.now()}`,
          type: 'new_post',
          appId: payload.platformId,
          priority: 'normal',
        }
        notifications.push(notification)
        eventBus.emit('notification:created', notification)
      })

      // 记录通知创建事件
      const notificationHandler = vi.fn()
      eventBus.on<NotificationCreatedEvent>('notification:created', notificationHandler)

      // 发布帖子创建事件
      eventBus.emit<PostCreatedEvent>('content:post:created', {
        postId: 'post_789',
        authorId: 'user_123',
        platformId: 'weibo',
        timestamp: Date.now(),
      })

      expect(notifications).toHaveLength(1)
      expect(notificationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new_post',
          appId: 'weibo',
        })
      )
    })
  })

  describe('多平台通道隔离场景', () => {
    it('微博和B站应用应该独立处理各自的事件', () => {
      const weiboChannel = eventBus.channel('weibo')
      const biliChannel = eventBus.channel('bilibili')

      const weiboFeedHandler = vi.fn()
      const biliFeedHandler = vi.fn()

      // 各平台订阅自己的 feed 更新
      weiboChannel.on('feed:updated', weiboFeedHandler)
      biliChannel.on('feed:updated', biliFeedHandler)

      // 微博更新 feed
      weiboChannel.emit('feed:updated', { count: 10, type: 'weibo' })

      expect(weiboFeedHandler).toHaveBeenCalledWith({ count: 10, type: 'weibo' })
      expect(biliFeedHandler).not.toHaveBeenCalled()

      // B站更新 feed
      biliChannel.emit('feed:updated', { count: 5, type: 'bilibili' })

      expect(biliFeedHandler).toHaveBeenCalledWith({ count: 5, type: 'bilibili' })
      expect(weiboFeedHandler).toHaveBeenCalledTimes(1) // 微博仍然只被调用一次
    })

    it('清除单个通道不应该影响其他通道', () => {
      const weiboChannel = eventBus.channel('weibo')
      const biliChannel = eventBus.channel('bilibili')

      const weiboHandler = vi.fn()
      const biliHandler = vi.fn()

      weiboChannel.on('event', weiboHandler)
      biliChannel.on('event', biliHandler)

      // 清除微博通道
      weiboChannel.clear()

      weiboChannel.emit('event', 'weibo data')
      biliChannel.emit('event', 'bili data')

      expect(weiboHandler).not.toHaveBeenCalled()
      expect(biliHandler).toHaveBeenCalledWith('bili data')
    })
  })

  describe('Vue 组件生命周期场景', () => {
    it('应该正确管理订阅的生命周期', () => {
      const handlers: (() => void)[] = []
      const eventHandler = vi.fn()

      // 模拟 onMounted
      const mountComponent = () => {
        handlers.push(eventBus.on('test:event', eventHandler))
        handlers.push(eventBus.on('test:event2', eventHandler))
      }

      // 模拟 onUnmounted
      const unmountComponent = () => {
        handlers.forEach((unsub) => unsub())
        handlers.length = 0
      }

      // 挂载组件
      mountComponent()
      expect(eventBus.getListenerCount('test:event')).toBe(1)
      expect(eventBus.getListenerCount('test:event2')).toBe(1)

      // 发送事件
      eventBus.emit('test:event', 'data1')
      expect(eventHandler).toHaveBeenCalledTimes(1)

      // 卸载组件
      unmountComponent()
      expect(eventBus.getListenerCount('test:event')).toBe(0)
      expect(eventBus.getListenerCount('test:event2')).toBe(0)

      // 卸载后事件不应该触发处理函数
      eventBus.emit('test:event', 'data2')
      expect(eventHandler).toHaveBeenCalledTimes(1) // 仍然只有1次
    })
  })

  describe('LLM 任务完成通知场景', () => {
    it('应该支持异步任务完成通知', async () => {
      const taskResults: any[] = []

      // 使用 once 等待任务完成
      const taskPromise = new Promise<void>((resolve) => {
        eventBus.once('llm:task:completed', (payload: any) => {
          taskResults.push(payload)
          resolve()
        })
      })

      // 模拟异步任务完成
      setTimeout(() => {
        eventBus.emit('llm:task:completed', {
          taskId: 'task_001',
          taskType: 'generate_post',
          result: { content: '生成的帖子内容' },
          duration: 1500,
        })
      }, 10)

      await taskPromise

      expect(taskResults).toHaveLength(1)
      expect(taskResults[0].taskId).toBe('task_001')
    })

    it('应该支持超时取消等待', async () => {
      const timeoutHandler = vi.fn()
      let taskCompleted = false

      // 设置超时
      const timeout = setTimeout(() => {
        if (!taskCompleted) {
          timeoutHandler()
        }
      }, 50)

      const cancel = eventBus.once('llm:task:completed', () => {
        taskCompleted = true
        clearTimeout(timeout)
      })

      // 在任务完成前取消
      cancel()

      // 等待一段时间
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(timeoutHandler).toHaveBeenCalled()
    })
  })

  describe('错误恢复场景', () => {
    it('单个处理函数错误不应该阻断事件链', () => {
      const results: string[] = []

      // 注册多个处理函数，其中一个会抛出错误
      eventBus.on('chain:event', () => results.push('handler1'))
      eventBus.on('chain:event', () => {
        throw new Error('处理函数错误')
      })
      eventBus.on('chain:event', () => results.push('handler3'))

      eventBus.emit('chain:event', null)

      // 所有非错误处理函数都应该执行
      expect(results).toEqual(['handler1', 'handler3'])
    })
  })
})
