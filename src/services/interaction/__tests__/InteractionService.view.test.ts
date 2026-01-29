/**
 * 交互服务 - 浏览记录功能测试
 */

import { describe, it, expect } from 'vitest'
import './setup'
import { interactionService } from '../InteractionService'

describe('InteractionService 浏览记录功能', () => {
  const testUserId = 'user_view_001'
  const testContentId = 'post_view_001'

  describe('recordView 记录浏览', () => {
    it('应该成功记录浏览', async () => {
      await interactionService.recordView(testContentId, testUserId)

      const history = await interactionService.getViewHistory(testUserId)
      expect(history.length).toBeGreaterThan(0)
      expect(history.some((v) => v.contentId === testContentId)).toBe(true)
    })

    it('应该记录浏览时长和滚动深度', async () => {
      const contentId = 'post_view_duration'

      await interactionService.recordView(contentId, testUserId, {
        duration: 30,
        scrollDepth: 0.8,
      })

      const history = await interactionService.getViewHistory(testUserId)
      const record = history.find((v) => v.contentId === contentId)

      expect(record?.duration).toBe(30)
      expect(record?.scrollDepth).toBe(0.8)
    })

    it('重复浏览应该更新记录并移到最前面', async () => {
      const contentId = 'post_view_repeat'

      await interactionService.recordView(contentId, testUserId, {
        duration: 10,
      })
      await interactionService.recordView('other_post', testUserId)
      await interactionService.recordView(contentId, testUserId, {
        duration: 20,
      })

      const history = await interactionService.getViewHistory(testUserId)
      
      // 应该在最前面
      expect(history[0].contentId).toBe(contentId)
      // 时长应该累加
      expect(history[0].duration).toBe(30)
    })

    it('应该更新浏览统计', async () => {
      const contentId = 'post_view_stats'

      await interactionService.recordView(contentId, testUserId)
      await interactionService.recordView(contentId, 'user_002')

      const stats = await interactionService.getStats(contentId, 'weibo')
      expect(stats.views).toBe(2)
    })
  })

  describe('getViewHistory 获取浏览历史', () => {
    it('应该返回用户的浏览历史', async () => {
      const userId = 'user_get_history'

      await interactionService.recordView('history_post_1', userId)
      await interactionService.recordView('history_post_2', userId)

      const history = await interactionService.getViewHistory(userId)

      expect(history.length).toBe(2)
    })

    it('应该按浏览时间倒序排列', async () => {
      const userId = 'user_history_order'

      await interactionService.recordView('order_view_1', userId)
      await new Promise((r) => setTimeout(r, 10))
      await interactionService.recordView('order_view_2', userId)

      const history = await interactionService.getViewHistory(userId)

      expect(history[0].contentId).toBe('order_view_2')
      expect(history[1].contentId).toBe('order_view_1')
    })

    it('应该支持平台过滤', async () => {
      const userId = 'user_history_filter'

      await interactionService.recordView('weibo_view_1', userId, {
        platformId: 'weibo',
      })
      await interactionService.recordView('bilibili_view_1', userId, {
        platformId: 'bilibili',
      })

      const weiboHistory = await interactionService.getViewHistory(userId, {
        platformId: 'weibo',
      })

      expect(weiboHistory.length).toBe(1)
      expect(weiboHistory[0].platformId).toBe('weibo')
    })

    it('应该支持时间范围过滤', async () => {
      const userId = 'user_history_time_range'
      const now = Date.now()

      await interactionService.recordView('time_view_1', userId)

      const history = await interactionService.getViewHistory(userId, {
        startTime: now - 1000,
        endTime: now + 1000,
      })

      expect(history.length).toBeGreaterThan(0)
    })

    it('应该支持分页', async () => {
      const userId = 'user_history_pagination'

      for (let i = 1; i <= 5; i++) {
        await interactionService.recordView(`page_view_${i}`, userId)
      }

      const page1 = await interactionService.getViewHistory(userId, {
        offset: 0,
        limit: 2,
      })
      const page2 = await interactionService.getViewHistory(userId, {
        offset: 2,
        limit: 2,
      })

      expect(page1.length).toBe(2)
      expect(page2.length).toBe(2)
    })
  })

  describe('clearViewHistory 清除浏览历史', () => {
    it('应该清除用户所有浏览历史', async () => {
      const userId = 'user_clear_all'

      await interactionService.recordView('clear_view_1', userId)
      await interactionService.recordView('clear_view_2', userId)

      await interactionService.clearViewHistory(userId)

      const history = await interactionService.getViewHistory(userId)
      expect(history.length).toBe(0)
    })

    it('应该只清除指定平台的浏览历史', async () => {
      const userId = 'user_clear_platform'

      await interactionService.recordView('weibo_clear_1', userId, {
        platformId: 'weibo',
      })
      await interactionService.recordView('bilibili_clear_1', userId, {
        platformId: 'bilibili',
      })

      await interactionService.clearViewHistory(userId, 'weibo')

      const history = await interactionService.getViewHistory(userId)
      expect(history.length).toBe(1)
      expect(history[0].platformId).toBe('bilibili')
    })
  })
})
