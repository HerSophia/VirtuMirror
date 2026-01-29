/**
 * 交互服务 - 统计功能测试
 */

import { describe, it, expect } from 'vitest'
import './setup'
import { interactionService } from '../InteractionService'

describe('InteractionService 统计功能', () => {
  describe('getStats 获取内容统计', () => {
    it('应该返回内容的互动统计', async () => {
      const contentId = 'post_stats_001'
      const platformId = 'weibo'

      // 执行一些互动
      await interactionService.like(contentId, 'user_1', { platformId })
      await interactionService.like(contentId, 'user_2', { platformId })
      await interactionService.favorite(contentId, 'user_1', undefined, { platformId })
      await interactionService.recordView(contentId, 'user_3', { platformId })

      const stats = await interactionService.getStats(contentId, platformId)

      expect(stats.contentId).toBe(contentId)
      expect(stats.platformId).toBe(platformId)
      expect(stats.likes).toBe(2)
      expect(stats.favorites).toBe(1)
      expect(stats.views).toBe(1)
    })

    it('不存在的内容应该返回零值统计', async () => {
      const stats = await interactionService.getStats(
        'nonexistent_content',
        'weibo'
      )

      expect(stats.likes).toBe(0)
      expect(stats.favorites).toBe(0)
      expect(stats.comments).toBe(0)
      expect(stats.reposts).toBe(0)
      expect(stats.views).toBe(0)
      expect(stats.shares).toBe(0)
    })
  })

  describe('batchGetStats 批量获取统计', () => {
    it('应该返回多个内容的统计', async () => {
      const contentIds = ['batch_post_1', 'batch_post_2', 'batch_post_3']
      const platformId = 'weibo'

      // 为每个内容添加一些互动
      for (const contentId of contentIds) {
        await interactionService.like(contentId, 'user_batch', { platformId })
      }

      const statsMap = await interactionService.batchGetStats(contentIds, platformId)

      expect(statsMap.size).toBe(3)
      for (const contentId of contentIds) {
        const stats = statsMap.get(contentId)
        expect(stats).toBeDefined()
        expect(stats?.likes).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('incrementStats 增加统计', () => {
    it('应该正确增加统计值', async () => {
      const contentId = 'post_increment'
      const platformId = 'weibo'

      await interactionService.incrementStats(contentId, platformId, 'likes', 5)
      await interactionService.incrementStats(contentId, platformId, 'views', 100)

      const stats = await interactionService.getStats(contentId, platformId)

      expect(stats.likes).toBe(5)
      expect(stats.views).toBe(100)
    })

    it('应该支持负数减少统计值', async () => {
      const contentId = 'post_decrement'
      const platformId = 'weibo'

      await interactionService.incrementStats(contentId, platformId, 'likes', 10)
      await interactionService.incrementStats(contentId, platformId, 'likes', -3)

      const stats = await interactionService.getStats(contentId, platformId)

      expect(stats.likes).toBe(7)
    })

    it('统计值不应该低于零', async () => {
      const contentId = 'post_no_negative'
      const platformId = 'weibo'

      await interactionService.incrementStats(contentId, platformId, 'likes', 5)
      await interactionService.incrementStats(contentId, platformId, 'likes', -10)

      const stats = await interactionService.getStats(contentId, platformId)

      expect(stats.likes).toBe(0)
    })
  })

  describe('转发统计', () => {
    it('转发应该更新统计', async () => {
      const contentId = 'post_repost_stats'
      const platformId = 'weibo'

      await interactionService.repost(contentId, 'user_1', '转发评论', { platformId })
      await interactionService.repost(contentId, 'user_2', undefined, { platformId })

      const stats = await interactionService.getStats(contentId, platformId)

      expect(stats.reposts).toBe(2)
    })
  })

  describe('评论统计', () => {
    it('评论应该更新统计', async () => {
      const contentId = 'post_comment_stats_test'
      const platformId = 'weibo'

      await interactionService.comment({
        contentId,
        platformId,
        userId: 'user_1',
        content: '评论1',
      })
      await interactionService.comment({
        contentId,
        platformId,
        userId: 'user_2',
        content: '评论2',
      })

      const stats = await interactionService.getStats(contentId, platformId)

      expect(stats.comments).toBe(2)
    })

    it('删除评论应该减少统计', async () => {
      const contentId = 'post_delete_comment_stats'
      const platformId = 'weibo'

      const comment = await interactionService.comment({
        contentId,
        platformId,
        userId: 'user_delete',
        content: '待删除评论',
      })

      await interactionService.deleteComment(comment.id, 'user_delete')

      const stats = await interactionService.getStats(contentId, platformId)

      expect(stats.comments).toBe(0)
    })
  })
})
