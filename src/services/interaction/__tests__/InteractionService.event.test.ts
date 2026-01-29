/**
 * 交互服务 - 事件订阅功能测试
 */

import { describe, it, expect, vi } from 'vitest'
import './setup'
import { interactionService } from '../InteractionService'
import type { InteractionEvent } from '@/types/interaction'

describe('InteractionService 事件订阅功能', () => {
  const testUserId = 'user_event_001'
  const testContentId = 'post_event_001'

  describe('onInteraction 订阅所有互动事件', () => {
    it('应该接收到点赞事件', async () => {
      const handler = vi.fn()
      const unsubscribe = interactionService.onInteraction(handler)

      await interactionService.like(testContentId, testUserId)

      expect(handler).toHaveBeenCalled()
      const event = handler.mock.calls[0][0] as InteractionEvent
      expect(event.type).toBe('like')
      expect(event.contentId).toBe(testContentId)
      expect(event.userId).toBe(testUserId)

      unsubscribe()
    })

    it('应该接收到收藏事件', async () => {
      const handler = vi.fn()
      const contentId = 'post_fav_event'
      const unsubscribe = interactionService.onInteraction(handler)

      await interactionService.favorite(contentId, testUserId)

      expect(handler).toHaveBeenCalled()
      const event = handler.mock.calls[0][0] as InteractionEvent
      expect(event.type).toBe('favorite')

      unsubscribe()
    })

    it('应该接收到评论事件', async () => {
      const handler = vi.fn()
      const contentId = 'post_comment_event'
      const unsubscribe = interactionService.onInteraction(handler)

      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '测试评论',
      })

      expect(handler).toHaveBeenCalled()
      const event = handler.mock.calls[0][0] as InteractionEvent
      expect(event.type).toBe('comment')

      unsubscribe()
    })
  })

  describe('on 订阅特定类型事件', () => {
    it('应该只接收到特定类型的事件', async () => {
      const likeHandler = vi.fn()
      const favoriteHandler = vi.fn()
      const contentId = 'post_specific_event'

      const unsub1 = interactionService.on('like', likeHandler)
      const unsub2 = interactionService.on('favorite', favoriteHandler)

      await interactionService.like(contentId, testUserId)

      expect(likeHandler).toHaveBeenCalled()
      expect(favoriteHandler).not.toHaveBeenCalled()

      unsub1()
      unsub2()
    })
  })

  describe('off 取消订阅', () => {
    it('应该成功取消订阅', async () => {
      const handler = vi.fn()
      const contentId = 'post_unsubscribe'

      interactionService.on('like', handler)
      interactionService.off('like', handler)

      await interactionService.like(contentId, testUserId)

      expect(handler).not.toHaveBeenCalled()
    })

    it('不指定处理函数时应该移除所有该类型的订阅', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const contentId = 'post_unsubscribe_all'

      interactionService.on('like', handler1)
      interactionService.on('like', handler2)
      interactionService.off('like')

      await interactionService.like(contentId, testUserId)

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('事件数据完整性', () => {
    it('事件应该包含完整的元数据', async () => {
      const handler = vi.fn()
      const contentId = 'post_event_metadata'
      const unsubscribe = interactionService.onInteraction(handler)

      await interactionService.like(contentId, testUserId, {
        platformId: 'bilibili',
        contentType: 'video',
      })

      const event = handler.mock.calls[0][0] as InteractionEvent

      expect(event.id).toBeDefined()
      expect(event.type).toBe('like')
      expect(event.contentId).toBe(contentId)
      expect(event.userId).toBe(testUserId)
      expect(event.platformId).toBe('bilibili')
      expect(event.contentType).toBe('video')
      expect(event.timestamp).toBeDefined()

      unsubscribe()
    })
  })
})
