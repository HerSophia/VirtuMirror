/**
 * FeedCache 信息流缓存测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { FeedCache, DEFAULT_CACHE_CONFIG } from '../FeedCache'
import type { FeedItem } from '@/types/feed'
import type { UniversalPost } from '@/types/social'

describe('FeedCache', () => {
  let cache: FeedCache

  beforeEach(() => {
    cache = new FeedCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createMockFeedItem = (id: string): FeedItem => {
    const post: UniversalPost = {
      id: `post_${id}`,
      platformId: 'weibo',
      authorId: 'author_001',
      timestamp: Date.now(),
      topicTags: [],
      stats: { likes: 100, comments: 10, shares: 5 },
      payload: { text: '测试内容' },
    }

    return {
      id: `feed_${id}`,
      post,
      score: Math.random(),
      position: 0,
      insertedAt: Date.now(),
    }
  }

  describe('generateKey 生成缓存键', () => {
    it('应该基于用户、平台和类型生成键', () => {
      const key = cache.generateKey('user_001', 'weibo', 'home')

      expect(key).toBe('user_001:weibo:home')
    })

    it('应该包含分页参数', () => {
      const key = cache.generateKey('user_001', 'weibo', 'home', {
        offset: 20,
        limit: 10,
      })

      expect(key).toContain('offset:20')
      expect(key).toContain('limit:10')
    })

    it('应该包含游标参数', () => {
      const key = cache.generateKey('user_001', 'weibo', 'home', {
        cursor: 'abc123',
      })

      expect(key).toContain('cursor:abc123')
    })
  })

  describe('set 和 get 缓存操作', () => {
    it('应该成功缓存和获取数据', () => {
      const items = [createMockFeedItem('1'), createMockFeedItem('2')]
      const key = 'test_key'

      cache.set(key, items)
      const result = cache.get(key)

      expect(result).toEqual(items)
    })

    it('获取不存在的键应该返回 undefined', () => {
      const result = cache.get('nonexistent')

      expect(result).toBeUndefined()
    })

    it('过期的缓存应该返回 undefined', () => {
      const items = [createMockFeedItem('1')]
      const key = 'expiring_key'

      cache.set(key, items, 'home')

      // 推进时间超过 TTL
      vi.advanceTimersByTime(DEFAULT_CACHE_CONFIG.defaultTTL + 1000)

      const result = cache.get(key)

      expect(result).toBeUndefined()
    })

    it('未过期的缓存应该可以获取', () => {
      const items = [createMockFeedItem('1')]
      const key = 'valid_key'

      cache.set(key, items, 'home')

      // 推进一半时间
      vi.advanceTimersByTime(DEFAULT_CACHE_CONFIG.defaultTTL / 2)

      const result = cache.get(key)

      expect(result).toEqual(items)
    })
  })

  describe('has 检查缓存存在', () => {
    it('存在的缓存应该返回 true', () => {
      cache.set('key', [createMockFeedItem('1')])

      expect(cache.has('key')).toBe(true)
    })

    it('不存在的缓存应该返回 false', () => {
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('过期的缓存应该返回 false', () => {
      cache.set('key', [createMockFeedItem('1')])

      vi.advanceTimersByTime(DEFAULT_CACHE_CONFIG.defaultTTL + 1000)

      expect(cache.has('key')).toBe(false)
    })
  })

  describe('clear 清除缓存', () => {
    it('应该清除所有缓存', () => {
      cache.set('key1', [createMockFeedItem('1')])
      cache.set('key2', [createMockFeedItem('2')])

      cache.clear()

      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(false)
      expect(cache.size).toBe(0)
    })

    it('应该重置统计信息', () => {
      cache.set('key', [createMockFeedItem('1')])
      cache.get('key') // hit
      cache.get('nonexistent') // miss

      cache.clear()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })
  })

  describe('getStats 获取统计信息', () => {
    it('应该正确统计命中和未命中', () => {
      cache.set('key', [createMockFeedItem('1')])

      cache.get('key') // hit
      cache.get('key') // hit
      cache.get('nonexistent') // miss

      const stats = cache.getStats()

      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2)
    })

    it('初始状态应该没有命中', () => {
      const stats = cache.getStats()

      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.hitRate).toBe(0)
    })

    it('应该正确报告缓存大小', () => {
      cache.set('key1', [createMockFeedItem('1')])
      cache.set('key2', [createMockFeedItem('2')])

      const stats = cache.getStats()

      expect(stats.size).toBe(2)
    })
  })

  describe('prime 预热缓存', () => {
    it('应该能够预热缓存', () => {
      const items = [createMockFeedItem('1')]

      cache.prime('primed_key', items, 'home')

      expect(cache.has('primed_key')).toBe(true)
      expect(cache.get('primed_key')).toEqual(items)
    })
  })

  describe('append 追加内容', () => {
    it('应该在现有缓存后追加内容', () => {
      const initial = [createMockFeedItem('1')]
      const additional = [createMockFeedItem('2')]

      cache.set('key', initial)
      cache.append('key', additional)

      const result = cache.get('key')

      expect(result?.length).toBe(2)
    })

    it('追加时应该去重', () => {
      const item = createMockFeedItem('1')
      cache.set('key', [item])
      cache.append('key', [item]) // 同一个 item

      const result = cache.get('key')

      expect(result?.length).toBe(1)
    })

    it('缓存不存在时应该创建新缓存', () => {
      const items = [createMockFeedItem('1')]

      cache.append('new_key', items)

      expect(cache.has('new_key')).toBe(true)
    })
  })

  describe('prepend 头部插入', () => {
    it('应该在现有缓存头部插入内容', () => {
      const initial = [createMockFeedItem('old')]
      const newItems = [createMockFeedItem('new')]

      cache.set('key', initial)
      cache.prepend('key', newItems)

      const result = cache.get('key')

      expect(result?.[0].id).toBe('feed_new')
      expect(result?.[1].id).toBe('feed_old')
    })

    it('头部插入时应该去重', () => {
      const item = createMockFeedItem('1')
      cache.set('key', [item])
      cache.prepend('key', [item])

      const result = cache.get('key')

      expect(result?.length).toBe(1)
    })
  })

  describe('TTL 配置', () => {
    it('不同类型应该使用不同的 TTL', () => {
      // 使用自定义配置来确保不同的 TTL
      const customCache = new FeedCache({
        defaultTTL: 5000,
        ttlOverrides: {
          home: 3000,
          trending: 10000,
        },
      })

      const homeItems = [createMockFeedItem('home')]
      const trendingItems = [createMockFeedItem('trending')]

      customCache.set('home_key', homeItems, 'home')
      customCache.set('trending_key', trendingItems, 'trending')

      // 推进时间超过 home TTL 但不超过 trending TTL
      vi.advanceTimersByTime(4000)

      // home 应该过期
      expect(customCache.has('home_key')).toBe(false)
      // trending 应该还存在
      expect(customCache.has('trending_key')).toBe(true)
    })
  })

  describe('自定义配置', () => {
    it('应该能够使用自定义配置', () => {
      const customCache = new FeedCache({
        maxEntries: 5,
        defaultTTL: 1000,
      })

      customCache.set('key', [createMockFeedItem('1')])

      vi.advanceTimersByTime(1001)

      expect(customCache.get('key')).toBeUndefined()
    })
  })
})
