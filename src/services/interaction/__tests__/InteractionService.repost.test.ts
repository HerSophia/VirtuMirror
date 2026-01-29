/**
 * 交互服务 - 转发功能测试
 */

import { describe, it, expect } from 'vitest'
import './setup'
import { interactionService } from '../InteractionService'

describe('InteractionService 转发功能', () => {
  const testUserId = 'user_repost_001'
  const testContentId = 'post_repost_001'

  describe('repost 转发', () => {
    it('应该成功转发内容', async () => {
      const newPostId = await interactionService.repost(
        testContentId,
        testUserId,
        '转发评论'
      )

      expect(newPostId).toBeDefined()
      expect(typeof newPostId).toBe('string')
    })

    it('应该支持不带评论的转发', async () => {
      const contentId = 'post_repost_no_comment'

      const newPostId = await interactionService.repost(contentId, testUserId)

      expect(newPostId).toBeDefined()
    })

    it('应该可以指定平台', async () => {
      const contentId = 'bilibili_repost'

      const newPostId = await interactionService.repost(
        contentId,
        testUserId,
        '转发到B站',
        { platformId: 'bilibili' }
      )

      expect(newPostId).toBeDefined()

      const stats = await interactionService.getStats(contentId, 'bilibili')
      expect(stats.reposts).toBeGreaterThan(0)
    })
  })

  describe('getReposts 获取转发列表', () => {
    it('应该返回内容的转发记录', async () => {
      const contentId = 'post_get_reposts'

      await interactionService.repost(contentId, 'user_1', '转发1')
      await interactionService.repost(contentId, 'user_2', '转发2')

      const reposts = await interactionService.getReposts(contentId)

      expect(reposts.length).toBe(2)
      expect(reposts[0].originalContentId).toBe(contentId)
    })

    it('应该支持分页', async () => {
      const contentId = 'post_reposts_pagination'

      for (let i = 1; i <= 5; i++) {
        await interactionService.repost(contentId, `user_${i}`, `转发${i}`)
      }

      const page1 = await interactionService.getReposts(contentId, {
        offset: 0,
        limit: 2,
      })
      const page2 = await interactionService.getReposts(contentId, {
        offset: 2,
        limit: 2,
      })

      expect(page1.length).toBe(2)
      expect(page2.length).toBe(2)
    })

    it('不存在转发的内容应该返回空数组', async () => {
      const reposts = await interactionService.getReposts('nonexistent_repost_content')
      expect(reposts).toEqual([])
    })
  })

  describe('转发记录数据完整性', () => {
    it('转发记录应该包含完整信息', async () => {
      const contentId = 'post_repost_complete'
      const comment = '这是转发评论'

      const newPostId = await interactionService.repost(
        contentId,
        testUserId,
        comment,
        { platformId: 'weibo' }
      )

      const reposts = await interactionService.getReposts(contentId)
      const record = reposts.find((r) => r.newPostId === newPostId)

      expect(record).toBeDefined()
      expect(record?.id).toBeDefined()
      expect(record?.originalContentId).toBe(contentId)
      expect(record?.newPostId).toBe(newPostId)
      expect(record?.userId).toBe(testUserId)
      expect(record?.platformId).toBe('weibo')
      expect(record?.comment).toBe(comment)
      expect(record?.createdAt).toBeDefined()
    })
  })
})
