/**
 * 交互服务 - 收藏功能测试
 */

import { describe, it, expect } from 'vitest'
import './setup'
import { interactionService } from '../InteractionService'

describe('InteractionService 收藏功能', () => {
  const testUserId = 'user_fav_001'
  const testContentId = 'post_fav_001'

  describe('favorite 收藏', () => {
    it('应该成功收藏内容', async () => {
      await interactionService.favorite(testContentId, testUserId)

      const isFavorited = await interactionService.isFavorited(testContentId, testUserId)
      expect(isFavorited).toBe(true)
    })

    it('重复收藏应该被忽略', async () => {
      const contentId = 'post_duplicate_fav'

      await interactionService.favorite(contentId, testUserId)
      await interactionService.favorite(contentId, testUserId)

      const isFavorited = await interactionService.isFavorited(contentId, testUserId)
      expect(isFavorited).toBe(true)

      const stats = await interactionService.getStats(contentId, 'weibo')
      expect(stats.favorites).toBe(1)
    })

    it('应该可以指定收藏夹', async () => {
      const contentId = 'post_with_collection'
      const collectionId = 'tech-articles'

      await interactionService.favorite(contentId, testUserId, collectionId)

      const favorites = await interactionService.getUserFavorites(testUserId)
      const item = favorites.find((f) => f.contentId === contentId)

      expect(item).toBeDefined()
      expect(item?.collectionId).toBe(collectionId)
    })

    it('应该可以指定平台', async () => {
      const contentId = 'bilibili_fav_001'

      await interactionService.favorite(contentId, testUserId, undefined, {
        platformId: 'bilibili',
      })

      const isFavorited = await interactionService.isFavorited(contentId, testUserId)
      expect(isFavorited).toBe(true)
    })
  })

  describe('unfavorite 取消收藏', () => {
    it('应该成功取消收藏', async () => {
      const contentId = 'post_unfav'

      await interactionService.favorite(contentId, testUserId)
      expect(await interactionService.isFavorited(contentId, testUserId)).toBe(true)

      await interactionService.unfavorite(contentId, testUserId)
      expect(await interactionService.isFavorited(contentId, testUserId)).toBe(false)
    })

    it('取消未收藏的内容不应该报错', async () => {
      const contentId = 'post_never_favorited'

      await expect(
        interactionService.unfavorite(contentId, testUserId)
      ).resolves.not.toThrow()
    })
  })

  describe('isFavorited 检查收藏状态', () => {
    it('未收藏的内容应该返回 false', async () => {
      const contentId = 'post_not_favorited'

      const isFavorited = await interactionService.isFavorited(contentId, testUserId)
      expect(isFavorited).toBe(false)
    })

    it('已收藏的内容应该返回 true', async () => {
      const contentId = 'post_is_favorited'

      await interactionService.favorite(contentId, testUserId)

      const isFavorited = await interactionService.isFavorited(contentId, testUserId)
      expect(isFavorited).toBe(true)
    })
  })

  describe('getUserFavorites 获取用户收藏列表', () => {
    it('应该返回用户收藏的内容列表', async () => {
      const userId = 'user_get_favorites'
      const contentIds = ['fav_post_1', 'fav_post_2', 'fav_post_3']

      for (const contentId of contentIds) {
        await interactionService.favorite(contentId, userId)
      }

      const favorites = await interactionService.getUserFavorites(userId)

      expect(favorites.length).toBe(3)
      expect(favorites.every((f) => f.isFavorited)).toBe(true)
    })

    it('应该按收藏时间倒序排列', async () => {
      const userId = 'user_favs_order'

      await interactionService.favorite('order_fav_1', userId)
      await new Promise((r) => setTimeout(r, 10))
      await interactionService.favorite('order_fav_2', userId)
      await new Promise((r) => setTimeout(r, 10))
      await interactionService.favorite('order_fav_3', userId)

      const favorites = await interactionService.getUserFavorites(userId)

      expect(favorites[0].contentId).toBe('order_fav_3')
      expect(favorites[1].contentId).toBe('order_fav_2')
      expect(favorites[2].contentId).toBe('order_fav_1')
    })

    it('应该支持平台过滤', async () => {
      const userId = 'user_favs_filter'

      await interactionService.favorite('weibo_fav_1', userId, undefined, {
        platformId: 'weibo',
      })
      await interactionService.favorite('bilibili_fav_1', userId, undefined, {
        platformId: 'bilibili',
      })

      const weiboFavs = await interactionService.getUserFavorites(userId, {
        platformId: 'weibo',
      })

      expect(weiboFavs.length).toBe(1)
      expect(weiboFavs[0].platformId).toBe('weibo')
    })

    it('应该支持分页', async () => {
      const userId = 'user_favs_pagination'

      for (let i = 1; i <= 5; i++) {
        await interactionService.favorite(`page_fav_${i}`, userId)
      }

      const page1 = await interactionService.getUserFavorites(userId, {
        offset: 0,
        limit: 2,
      })
      const page2 = await interactionService.getUserFavorites(userId, {
        offset: 2,
        limit: 2,
      })

      expect(page1.length).toBe(2)
      expect(page2.length).toBe(2)
    })
  })
})
