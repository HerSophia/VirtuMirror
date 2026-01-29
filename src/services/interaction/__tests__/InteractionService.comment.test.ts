/**
 * 交互服务 - 评论功能测试
 */

import { describe, it, expect } from 'vitest'
import './setup'
import { interactionService } from '../InteractionService'

describe('InteractionService 评论功能', () => {
  const testUserId = 'user_comment_001'
  const testContentId = 'post_comment_001'

  describe('comment 发表评论', () => {
    it('应该成功发表评论', async () => {
      const comment = await interactionService.comment({
        contentId: testContentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '这是一条测试评论',
      })

      expect(comment.id).toBeDefined()
      expect(comment.contentId).toBe(testContentId)
      expect(comment.authorId).toBe(testUserId)
      expect(comment.content).toBe('这是一条测试评论')
      expect(comment.createdAt).toBeDefined()
    })

    it('应该支持回复评论', async () => {
      const contentId = 'post_with_replies'

      // 发表父评论
      const parentComment = await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '这是父评论',
      })

      // 发表回复
      const replyComment = await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_reply',
        content: '这是回复',
        parentId: parentComment.id,
      })

      expect(replyComment.parentId).toBe(parentComment.id)

      // 父评论的回复数应该增加
      const comments = await interactionService.getComments(contentId, {
        includeReplies: true,
      })
      const parent = comments.find((c) => c.id === parentComment.id)
      expect(parent?.replyCount).toBe(1)
    })

    it('应该更新内容统计', async () => {
      const contentId = 'post_comment_stats'

      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '评论1',
      })
      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_002',
        content: '评论2',
      })

      const stats = await interactionService.getStats(contentId, 'weibo')
      expect(stats.comments).toBe(2)
    })
  })

  describe('deleteComment 删除评论', () => {
    it('应该成功删除自己的评论', async () => {
      const contentId = 'post_delete_comment'

      const comment = await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '待删除的评论',
      })

      await interactionService.deleteComment(comment.id, testUserId)

      const comments = await interactionService.getComments(contentId)
      expect(comments.find((c) => c.id === comment.id)).toBeUndefined()
    })

    it('删除不存在的评论不应该报错', async () => {
      await expect(
        interactionService.deleteComment('nonexistent_comment', testUserId)
      ).resolves.not.toThrow()
    })

    it('删除回复应该更新父评论的回复数', async () => {
      const contentId = 'post_delete_reply'

      const parentComment = await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '父评论',
      })

      const reply = await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_reply',
        content: '回复',
        parentId: parentComment.id,
      })

      await interactionService.deleteComment(reply.id, 'user_reply')

      const comments = await interactionService.getComments(contentId, {
        includeReplies: true,
      })
      const parent = comments.find((c) => c.id === parentComment.id)
      expect(parent?.replyCount).toBe(0)
    })
  })

  describe('getComments 获取评论列表', () => {
    it('应该返回内容的评论列表', async () => {
      const contentId = 'post_get_comments'

      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_1',
        content: '评论1',
      })
      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_2',
        content: '评论2',
      })

      const comments = await interactionService.getComments(contentId)

      expect(comments.length).toBe(2)
    })

    it('默认应该只返回顶级评论', async () => {
      const contentId = 'post_top_level_comments'

      const parent = await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '顶级评论',
      })

      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_reply',
        content: '回复',
        parentId: parent.id,
      })

      const comments = await interactionService.getComments(contentId)

      expect(comments.length).toBe(1)
      expect(comments[0].parentId).toBeUndefined()
    })

    it('应该支持包含回复', async () => {
      const contentId = 'post_include_replies'

      const parent = await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: testUserId,
        content: '顶级评论',
      })

      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_reply',
        content: '回复',
        parentId: parent.id,
      })

      const comments = await interactionService.getComments(contentId, {
        includeReplies: true,
      })

      expect(comments.length).toBe(2)
    })

    it('应该支持按时间排序', async () => {
      const contentId = 'post_comments_sort_time'

      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_1',
        content: '第一条',
      })
      await new Promise((r) => setTimeout(r, 10))
      await interactionService.comment({
        contentId,
        platformId: 'weibo',
        userId: 'user_2',
        content: '第二条',
      })

      const descComments = await interactionService.getComments(contentId, {
        sortBy: 'time',
        order: 'desc',
      })
      expect(descComments[0].content).toBe('第二条')

      const ascComments = await interactionService.getComments(contentId, {
        sortBy: 'time',
        order: 'asc',
      })
      expect(ascComments[0].content).toBe('第一条')
    })

    it('应该支持分页', async () => {
      const contentId = 'post_comments_pagination'

      for (let i = 1; i <= 5; i++) {
        await interactionService.comment({
          contentId,
          platformId: 'weibo',
          userId: `user_${i}`,
          content: `评论${i}`,
        })
      }

      const page1 = await interactionService.getComments(contentId, {
        offset: 0,
        limit: 2,
      })
      const page2 = await interactionService.getComments(contentId, {
        offset: 2,
        limit: 2,
      })

      expect(page1.length).toBe(2)
      expect(page2.length).toBe(2)
    })
  })

  describe('getUserComments 获取用户评论列表', () => {
    it('应该返回用户发表的所有评论', async () => {
      const userId = 'user_get_my_comments'

      await interactionService.comment({
        contentId: 'post_1',
        platformId: 'weibo',
        userId,
        content: '评论1',
      })
      await interactionService.comment({
        contentId: 'post_2',
        platformId: 'weibo',
        userId,
        content: '评论2',
      })

      const comments = await interactionService.getUserComments(userId)

      expect(comments.length).toBe(2)
      expect(comments.every((c) => c.authorId === userId)).toBe(true)
    })

    it('应该支持平台过滤', async () => {
      const userId = 'user_comments_platform'

      await interactionService.comment({
        contentId: 'weibo_post',
        platformId: 'weibo',
        userId,
        content: '微博评论',
      })
      await interactionService.comment({
        contentId: 'bilibili_video',
        platformId: 'bilibili',
        userId,
        content: 'B站评论',
      })

      const weiboComments = await interactionService.getUserComments(userId, {
        platformId: 'weibo',
      })

      expect(weiboComments.length).toBe(1)
      expect(weiboComments[0].platformId).toBe('weibo')
    })
  })
})
