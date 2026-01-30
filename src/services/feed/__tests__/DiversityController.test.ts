/**
 * DiversityController 多样性控制器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DiversityController, DEFAULT_DIVERSITY_RULES } from '../DiversityController'
import type { FeedItem, DiversityRules } from '@/types/feed'
import type { UniversalPost } from '@/types/social'

describe('DiversityController', () => {
  let controller: DiversityController

  beforeEach(() => {
    controller = new DiversityController()
  })

  const createMockFeedItem = (overrides: {
    id?: string
    authorId?: string
    category?: string
    topicTags?: string[]
    primaryType?: string
    score?: number
  } = {}): FeedItem => {
    const post: UniversalPost = {
      id: overrides.id || `post_${Math.random().toString(36).substr(2, 9)}`,
      platformId: 'weibo',
      authorId: overrides.authorId || 'author_001',
      timestamp: Date.now(),
      topicTags: overrides.topicTags || [],
      primaryType: overrides.primaryType as any || 'text',
      stats: { likes: 100, comments: 10, shares: 5 },
      payload: { text: '测试内容' },
      platformData: { category: overrides.category || 'general' },
    }

    return {
      id: `feed_${post.id}`,
      post,
      score: overrides.score || Math.random(),
      position: 0,
      insertedAt: Date.now(),
    }
  }

  describe('apply 应用多样性规则', () => {
    it('应该限制同一作者的内容数量', () => {
      const items = [
        createMockFeedItem({ id: '1', authorId: 'author_A', score: 0.9 }),
        createMockFeedItem({ id: '2', authorId: 'author_A', score: 0.8 }),
        createMockFeedItem({ id: '3', authorId: 'author_A', score: 0.7 }),
        createMockFeedItem({ id: '4', authorId: 'author_A', score: 0.6 }),
        createMockFeedItem({ id: '5', authorId: 'author_B', score: 0.5 }),
      ]

      const rules: DiversityRules = { maxSameAuthor: 2 }
      const result = controller.apply(items, rules)

      const authorACounts = result.filter(item => item.post.authorId === 'author_A').length
      expect(authorACounts).toBe(2)
      expect(result.length).toBe(3) // 2 from A + 1 from B
    })

    it('应该限制同一分类的内容数量', () => {
      const items = [
        createMockFeedItem({ id: '1', category: 'tech' }),
        createMockFeedItem({ id: '2', category: 'tech' }),
        createMockFeedItem({ id: '3', category: 'tech' }),
        createMockFeedItem({ id: '4', category: 'entertainment' }),
      ]

      const rules: DiversityRules = { maxSameCategory: 2 }
      const result = controller.apply(items, rules)

      const techCount = result.filter(
        item => item.post.platformData?.category === 'tech'
      ).length
      expect(techCount).toBe(2)
    })

    it('应该限制同一话题的内容数量', () => {
      const items = [
        createMockFeedItem({ id: '1', topicTags: ['热搜话题'] }),
        createMockFeedItem({ id: '2', topicTags: ['热搜话题'] }),
        createMockFeedItem({ id: '3', topicTags: ['热搜话题'] }),
        createMockFeedItem({ id: '4', topicTags: ['其他话题'] }),
      ]

      const rules: DiversityRules = { maxSameTopic: 2 }
      const result = controller.apply(items, rules)

      expect(result.length).toBe(3)
    })

    it('应该限制连续相同类型的内容数量', () => {
      const items = [
        createMockFeedItem({ id: '1', primaryType: 'video', authorId: 'a1' }),
        createMockFeedItem({ id: '2', primaryType: 'video', authorId: 'a2' }),
        createMockFeedItem({ id: '3', primaryType: 'video', authorId: 'a3' }),
        createMockFeedItem({ id: '4', primaryType: 'video', authorId: 'a4' }),
        createMockFeedItem({ id: '5', primaryType: 'text', authorId: 'a5' }),
      ]

      const rules: DiversityRules = { maxConsecutiveSameType: 2 }
      const result = controller.apply(items, rules)

      // 应该过滤掉连续超过 2 个的视频
      expect(result.length).toBeLessThan(5)
    })

    it('没有规则时应该返回所有内容', () => {
      const items = [
        createMockFeedItem({ id: '1', authorId: 'author_A' }),
        createMockFeedItem({ id: '2', authorId: 'author_A' }),
        createMockFeedItem({ id: '3', authorId: 'author_A' }),
      ]

      const result = controller.apply(items, {})

      expect(result.length).toBe(3)
    })

    it('空数组应该返回空数组', () => {
      const result = controller.apply([], DEFAULT_DIVERSITY_RULES)

      expect(result).toEqual([])
    })
  })

  describe('interleave 交错排列', () => {
    it('应该按作者交错排列内容', () => {
      const items = [
        createMockFeedItem({ id: '1', authorId: 'A' }),
        createMockFeedItem({ id: '2', authorId: 'A' }),
        createMockFeedItem({ id: '3', authorId: 'B' }),
        createMockFeedItem({ id: '4', authorId: 'B' }),
      ]

      const result = controller.interleave(items, 'author')

      // 应该是 A, B, A, B 的顺序
      expect(result[0].post.authorId).not.toBe(result[1].post.authorId)
    })

    it('应该按分类交错排列内容', () => {
      const items = [
        createMockFeedItem({ id: '1', category: 'tech', authorId: 'a1' }),
        createMockFeedItem({ id: '2', category: 'tech', authorId: 'a2' }),
        createMockFeedItem({ id: '3', category: 'entertainment', authorId: 'a3' }),
        createMockFeedItem({ id: '4', category: 'entertainment', authorId: 'a4' }),
      ]

      const result = controller.interleave(items, 'category')

      expect(result[0].post.platformData?.category).not.toBe(
        result[1].post.platformData?.category
      )
    })

    it('应该按类型交错排列内容', () => {
      const items = [
        createMockFeedItem({ id: '1', primaryType: 'video', authorId: 'a1' }),
        createMockFeedItem({ id: '2', primaryType: 'video', authorId: 'a2' }),
        createMockFeedItem({ id: '3', primaryType: 'text', authorId: 'a3' }),
        createMockFeedItem({ id: '4', primaryType: 'text', authorId: 'a4' }),
      ]

      const result = controller.interleave(items, 'type')

      expect(result[0].post.primaryType).not.toBe(result[1].post.primaryType)
    })

    it('单个分组应该保持原顺序', () => {
      const items = [
        createMockFeedItem({ id: '1', authorId: 'A' }),
        createMockFeedItem({ id: '2', authorId: 'A' }),
        createMockFeedItem({ id: '3', authorId: 'A' }),
      ]

      const result = controller.interleave(items, 'author')

      expect(result.length).toBe(3)
      // 所有内容都来自同一作者，顺序应该保持
      expect(result.every(item => item.post.authorId === 'A')).toBe(true)
    })
  })

  describe('smartSort 智能排序', () => {
    it('应该在保持分数排序的同时应用多样性规则', () => {
      const items = [
        createMockFeedItem({ id: '1', authorId: 'A', score: 0.9 }),
        createMockFeedItem({ id: '2', authorId: 'A', score: 0.8 }),
        createMockFeedItem({ id: '3', authorId: 'A', score: 0.7 }),
        createMockFeedItem({ id: '4', authorId: 'A', score: 0.6 }),
        createMockFeedItem({ id: '5', authorId: 'B', score: 0.5 }),
      ]

      const rules: DiversityRules = { maxSameAuthor: 2 }
      const result = controller.smartSort(items, rules)

      // 应该包含作者 B 的内容
      expect(result.some(item => item.post.authorId === 'B')).toBe(true)
      
      // smartSort 会尽量保持高分内容，同时尊重多样性
      // 结果应该包含所有内容（因为 smartSort 不会丢弃，只会重排）
      expect(result.length).toBe(5)
    })

    it('应该优先保留高分内容', () => {
      const items = [
        createMockFeedItem({ id: 'high', authorId: 'A', score: 0.9 }),
        createMockFeedItem({ id: 'medium', authorId: 'A', score: 0.5 }),
        createMockFeedItem({ id: 'low', authorId: 'B', score: 0.3 }),
      ]

      const rules: DiversityRules = { maxSameAuthor: 1 }
      const result = controller.smartSort(items, rules)

      // 应该保留高分的 A 而不是中分的 A
      const authorAItem = result.find(item => item.post.authorId === 'A')
      expect(authorAItem?.score).toBe(0.9)
    })

    it('单个元素应该直接返回', () => {
      const items = [createMockFeedItem({ id: '1' })]

      const result = controller.smartSort(items)

      expect(result).toEqual(items)
    })

    it('空数组应该返回空数组', () => {
      const result = controller.smartSort([])

      expect(result).toEqual([])
    })
  })
})
