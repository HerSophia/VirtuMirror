/**
 * 交互服务 - 点赞功能测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import './setup'

// 由于 InteractionService 是单例，需要动态导入以获取新实例
// 这里我们直接测试导出的 interactionService
import { interactionService } from '../InteractionService'

describe('InteractionService 点赞功能', () => {
  const testUserId = 'user_001'
  const testContentId = 'post_001'

  describe('like 点赞', () => {
    it('应该成功点赞内容', async () => {
      await interactionService.like(testContentId, testUserId)

      const isLiked = await interactionService.isLiked(testContentId, testUserId)
      expect(isLiked).toBe(true)
    })

    it('重复点赞应该被忽略', async () => {
      const contentId = 'post_duplicate_like'
      
      await interactionService.like(contentId, testUserId)
      await interactionService.like(contentId, testUserId)

      const isLiked = await interactionService.isLiked(contentId, testUserId)
      expect(isLiked).toBe(true)

      // 获取统计，点赞数应该只增加1
      const stats = await interactionService.getStats(contentId, 'weibo')
      expect(stats.likes).toBe(1)
    })

    it('应该可以指定平台和内容类型', async () => {
      const contentId = 'bilibili_video_001'

      await interactionService.like(contentId, testUserId, {
        platformId: 'bilibili',
        contentType: 'video',
      })

      const isLiked = await interactionService.isLiked(contentId, testUserId, {
        platformId: 'bilibili',
      })
      expect(isLiked).toBe(true)
    })
  })

  describe('unlike 取消点赞', () => {
    it('应该成功取消点赞', async () => {
      const contentId = 'post_unlike'

      await interactionService.like(contentId, testUserId)
      expect(await interactionService.isLiked(contentId, testUserId)).toBe(true)

      await interactionService.unlike(contentId, testUserId)
      expect(await interactionService.isLiked(contentId, testUserId)).toBe(false)
    })

    it('取消未点赞的内容不应该报错', async () => {
      const contentId = 'post_never_liked'

      await expect(
        interactionService.unlike(contentId, testUserId)
      ).resolves.not.toThrow()
    })
  })

  describe('isLiked 检查点赞状态', () => {
    it('未点赞的内容应该返回 false', async () => {
      const contentId = 'post_not_liked'

      const isLiked = await interactionService.isLiked(contentId, testUserId)
      expect(isLiked).toBe(false)
    })

    it('已点赞的内容应该返回 true', async () => {
      const contentId = 'post_is_liked'

      await interactionService.like(contentId, testUserId)

      const isLiked = await interactionService.isLiked(contentId, testUserId)
      expect(isLiked).toBe(true)
    })
  })

  describe('getUserLikes 获取用户点赞列表', () => {
    it('应该返回用户点赞的内容列表', async () => {
      const userId = 'user_get_likes'
      const contentIds = ['like_post_1', 'like_post_2', 'like_post_3']

      for (const contentId of contentIds) {
        await interactionService.like(contentId, userId)
      }

      const likes = await interactionService.getUserLikes(userId)

      expect(likes.length).toBe(3)
      expect(likes.every((l) => l.isLiked)).toBe(true)
    })

    it('应该按点赞时间倒序排列', async () => {
      const userId = 'user_likes_order'

      await interactionService.like('order_post_1', userId)
      await new Promise((r) => setTimeout(r, 10))
      await interactionService.like('order_post_2', userId)
      await new Promise((r) => setTimeout(r, 10))
      await interactionService.like('order_post_3', userId)

      const likes = await interactionService.getUserLikes(userId)

      expect(likes[0].contentId).toBe('order_post_3')
      expect(likes[1].contentId).toBe('order_post_2')
      expect(likes[2].contentId).toBe('order_post_1')
    })

    it('应该支持平台过滤', async () => {
      const userId = 'user_likes_filter'

      await interactionService.like('weibo_post_1', userId, { platformId: 'weibo' })
      await interactionService.like('bilibili_post_1', userId, { platformId: 'bilibili' })

      const weiboLikes = await interactionService.getUserLikes(userId, {
        platformId: 'weibo',
      })

      expect(weiboLikes.length).toBe(1)
      expect(weiboLikes[0].platformId).toBe('weibo')
    })

    it('应该支持分页', async () => {
      const userId = 'user_likes_pagination'

      for (let i = 1; i <= 5; i++) {
        await interactionService.like(`page_post_${i}`, userId)
      }

      const page1 = await interactionService.getUserLikes(userId, {
        offset: 0,
        limit: 2,
      })
      const page2 = await interactionService.getUserLikes(userId, {
        offset: 2,
        limit: 2,
      })

      expect(page1.length).toBe(2)
      expect(page2.length).toBe(2)
    })
  })
})
