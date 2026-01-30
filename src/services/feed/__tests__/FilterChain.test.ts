/**
 * FilterChain 过滤器链测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FilterChain } from '../FilterChain'
import type { UniversalPost } from '@/types/social'
import type { FeedFilter } from '@/types/feed'

describe('FilterChain', () => {
  let filterChain: FilterChain

  beforeEach(() => {
    filterChain = new FilterChain()
  })

  const createMockPost = (overrides: Partial<UniversalPost> = {}): UniversalPost => {
    return {
      id: 'post_001',
      platformId: 'weibo',
      authorId: 'author_001',
      timestamp: Date.now(),
      topicTags: [],
      stats: { likes: 100, comments: 10, shares: 5 },
      payload: { text: '测试内容' },
      platformData: {},
      ...overrides,
    }
  }

  describe('add 添加过滤器', () => {
    it('应该成功添加过滤器并返回 ID', () => {
      const filter: FeedFilter = (post) => post.stats.likes > 10

      const filterId = filterChain.add('weibo', filter)

      expect(filterId).toBeDefined()
      expect(typeof filterId).toBe('string')
    })

    it('应该可以指定自定义 ID', () => {
      const filter: FeedFilter = (post) => true

      const filterId = filterChain.add('weibo', filter, { id: 'my_filter' })

      expect(filterId).toBe('my_filter')
    })

    it('应该可以指定优先级', () => {
      const filter1: FeedFilter = (post) => true
      const filter2: FeedFilter = (post) => true

      filterChain.add('weibo', filter1, { id: 'low_priority', priority: 100 })
      filterChain.add('weibo', filter2, { id: 'high_priority', priority: 1 })

      const filters = filterChain.getFilters('weibo')

      expect(filters[0].id).toBe('high_priority')
      expect(filters[1].id).toBe('low_priority')
    })
  })

  describe('remove 移除过滤器', () => {
    it('应该成功移除已存在的过滤器', () => {
      const filter: FeedFilter = (post) => true
      const filterId = filterChain.add('weibo', filter)

      const removed = filterChain.remove('weibo', filterId)

      expect(removed).toBe(true)
      expect(filterChain.getFilters('weibo').length).toBe(0)
    })

    it('移除不存在的过滤器应该返回 false', () => {
      const removed = filterChain.remove('weibo', 'nonexistent')

      expect(removed).toBe(false)
    })

    it('移除不存在平台的过滤器应该返回 false', () => {
      const removed = filterChain.remove('unknown_platform', 'some_id')

      expect(removed).toBe(false)
    })
  })

  describe('toggle 启用/禁用过滤器', () => {
    it('应该能够禁用过滤器', () => {
      const filter: FeedFilter = (post) => post.stats.likes > 1000 // 会过滤大部分
      const filterId = filterChain.add('weibo', filter)

      filterChain.toggle('weibo', filterId, false)

      const posts = [createMockPost({ stats: { likes: 10, comments: 0, shares: 0 } })]
      const { filtered } = filterChain.apply('weibo', posts)

      // 禁用后不应该过滤
      expect(filtered.length).toBe(1)
    })

    it('应该能够重新启用过滤器', () => {
      const filter: FeedFilter = (post) => post.stats.likes > 1000
      const filterId = filterChain.add('weibo', filter)

      filterChain.toggle('weibo', filterId, false)
      filterChain.toggle('weibo', filterId, true)

      const posts = [createMockPost({ stats: { likes: 10, comments: 0, shares: 0 } })]
      const { filtered } = filterChain.apply('weibo', posts)

      // 重新启用后应该过滤
      expect(filtered.length).toBe(0)
    })
  })

  describe('apply 应用过滤器', () => {
    it('应该正确过滤内容', () => {
      const filter: FeedFilter = (post) => post.stats.likes >= 50

      filterChain.add('weibo', filter)

      const posts = [
        createMockPost({ id: '1', stats: { likes: 100, comments: 0, shares: 0 } }),
        createMockPost({ id: '2', stats: { likes: 30, comments: 0, shares: 0 } }),
        createMockPost({ id: '3', stats: { likes: 60, comments: 0, shares: 0 } }),
      ]

      const { filtered } = filterChain.apply('weibo', posts)

      expect(filtered.length).toBe(2)
      expect(filtered.map((p) => p.id)).toEqual(['1', '3'])
    })

    it('应该按优先级顺序应用过滤器', () => {
      const results: string[] = []

      filterChain.add(
        'weibo',
        (post) => {
          results.push('second')
          return true
        },
        { priority: 20 }
      )

      filterChain.add(
        'weibo',
        (post) => {
          results.push('first')
          return true
        },
        { priority: 10 }
      )

      filterChain.apply('weibo', [createMockPost()])

      expect(results).toEqual(['first', 'second'])
    })

    it('应该返回应用的过滤器名称', () => {
      filterChain.add('weibo', (post) => post.stats.likes > 50, {
        name: 'LikesFilter',
      })
      filterChain.add('weibo', (post) => true, {
        name: 'PassAllFilter',
      })

      const posts = [
        createMockPost({ stats: { likes: 30, comments: 0, shares: 0 } }),
      ]

      const { appliedFilters } = filterChain.apply('weibo', posts)

      expect(appliedFilters).toContain('LikesFilter')
      expect(appliedFilters).not.toContain('PassAllFilter')
    })

    it('没有过滤器时应该返回所有内容', () => {
      const posts = [
        createMockPost({ id: '1' }),
        createMockPost({ id: '2' }),
      ]

      const { filtered } = filterChain.apply('weibo', posts)

      expect(filtered.length).toBe(2)
    })

    it('不同平台的过滤器应该互不影响', () => {
      filterChain.add('weibo', (post) => false) // 过滤所有

      const posts = [createMockPost()]

      const weiboResult = filterChain.apply('weibo', posts)
      const bilibiliResult = filterChain.apply('bilibili', posts)

      expect(weiboResult.filtered.length).toBe(0)
      expect(bilibiliResult.filtered.length).toBe(1)
    })
  })

  describe('clear 清除过滤器', () => {
    it('应该清除指定平台的所有过滤器', () => {
      filterChain.add('weibo', (post) => true)
      filterChain.add('weibo', (post) => true)
      filterChain.add('bilibili', (post) => true)

      filterChain.clear('weibo')

      expect(filterChain.getFilters('weibo').length).toBe(0)
      expect(filterChain.getFilters('bilibili').length).toBe(1)
    })
  })

  describe('getFilters 获取过滤器', () => {
    it('应该返回指定平台的所有过滤器', () => {
      filterChain.add('weibo', (post) => true, { id: 'filter1' })
      filterChain.add('weibo', (post) => true, { id: 'filter2' })

      const filters = filterChain.getFilters('weibo')

      expect(filters.length).toBe(2)
    })

    it('没有过滤器时应该返回空数组', () => {
      const filters = filterChain.getFilters('unknown')

      expect(filters).toEqual([])
    })
  })

  describe('内置过滤器', () => {
    beforeEach(() => {
      filterChain.initBuiltinFilters('weibo', ['blocked_user'], ['muted_user'])
    })

    it('应该初始化内置过滤器', () => {
      // 启用广告过滤器
      filterChain.toggleBuiltinFilter('weibo', 'hideAds', true)

      const posts = [
        createMockPost({ id: '1', platformData: { isAd: true } }),
        createMockPost({ id: '2', platformData: { isAd: false } }),
      ]

      const { filtered } = filterChain.apply('weibo', posts)

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('2')
    })

    it('应该过滤已屏蔽用户的内容', () => {
      filterChain.toggleBuiltinFilter('weibo', 'hideBlocked', true)

      const posts = [
        createMockPost({ id: '1', authorId: 'blocked_user' }),
        createMockPost({ id: '2', authorId: 'normal_user' }),
      ]

      const { filtered } = filterChain.apply('weibo', posts)

      expect(filtered.length).toBe(1)
      expect(filtered[0].authorId).toBe('normal_user')
    })

    it('应该过滤转发内容', () => {
      filterChain.toggleBuiltinFilter('weibo', 'hideReposts', true)

      const posts = [
        createMockPost({
          id: '1',
          payload: {
            text: '转发内容',
            repost: {
              originalPostId: 'original_123',
              originalAuthor: { name: '原作者' },
              originalContent: { text: '原文', primaryType: 'text', timestamp: Date.now() },
            },
          },
        }),
        createMockPost({ id: '2', payload: { text: '原创内容' } }),
      ]

      const { filtered } = filterChain.apply('weibo', posts)

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('2')
    })

    it('应该只显示有媒体的内容', () => {
      filterChain.toggleBuiltinFilter('weibo', 'onlyWithMedia', true)

      const posts = [
        createMockPost({ id: '1', media: [{ id: 'img1', type: 'image', description: '图片' }] }),
        createMockPost({ id: '2', payload: { text: '纯文字' } }),
      ]

      const { filtered } = filterChain.apply('weibo', posts)

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('1')
    })

    it('应该能够检查内置过滤器是否启用', () => {
      expect(filterChain.isBuiltinFilterEnabled('weibo', 'hideAds')).toBe(false)

      filterChain.toggleBuiltinFilter('weibo', 'hideAds', true)

      expect(filterChain.isBuiltinFilterEnabled('weibo', 'hideAds')).toBe(true)
    })
  })
})
