/**
 * ScoreCalculator 分数计算器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreCalculator } from '../ScoreCalculator'
import type { AlgorithmConfig, ScoreContext } from '@/types/feed'
import type { UniversalPost } from '@/types/social'

describe('ScoreCalculator', () => {
  let calculator: ScoreCalculator
  let defaultConfig: AlgorithmConfig
  let defaultContext: ScoreContext

  beforeEach(() => {
    calculator = new ScoreCalculator()

    defaultConfig = {
      weights: {
        recency: 0.25,
        engagement: 0.25,
        relevance: 0.25,
        social: 0.25,
      },
      decayHalfLife: 6,
    }

    defaultContext = ScoreCalculator.createContext({
      userId: 'user_001',
      followingIds: ['author_001', 'author_002'],
      interactedIds: ['author_003'],
      interestTags: ['科技', '游戏', '音乐'],
      now: Date.now(),
      maxEngagement: 10000,
    })
  })

  const createMockPost = (overrides: Partial<UniversalPost> = {}): UniversalPost => {
    return {
      id: 'post_001',
      platformId: 'weibo',
      authorId: 'author_001',
      timestamp: Date.now() - 3600000, // 1 小时前
      topicTags: ['科技'],
      stats: {
        likes: 100,
        comments: 20,
        shares: 5,
        views: 1000,
      },
      payload: {
        text: '测试帖子内容',
      },
      ...overrides,
    }
  }

  describe('calculate 计算分数', () => {
    it('应该返回所有分数组成部分', () => {
      const post = createMockPost()
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores).toHaveProperty('recency')
      expect(scores).toHaveProperty('engagement')
      expect(scores).toHaveProperty('relevance')
      expect(scores).toHaveProperty('social')
      expect(scores).toHaveProperty('total')
    })

    it('所有分数应该在 0-1 范围内', () => {
      const post = createMockPost()
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.recency).toBeGreaterThanOrEqual(0)
      expect(scores.recency).toBeLessThanOrEqual(1)
      expect(scores.engagement).toBeGreaterThanOrEqual(0)
      expect(scores.engagement).toBeLessThanOrEqual(1)
      expect(scores.relevance).toBeGreaterThanOrEqual(0)
      expect(scores.relevance).toBeLessThanOrEqual(1)
      expect(scores.social).toBeGreaterThanOrEqual(0)
      expect(scores.social).toBeLessThanOrEqual(1)
    })

    it('总分应该是各分数的加权和', () => {
      const post = createMockPost()
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      const expectedTotal =
        defaultConfig.weights.recency * scores.recency +
        defaultConfig.weights.engagement * scores.engagement +
        defaultConfig.weights.relevance * scores.relevance +
        defaultConfig.weights.social * scores.social

      expect(scores.total).toBeCloseTo(expectedTotal, 5)
    })
  })

  describe('时效性分数 (recency)', () => {
    it('刚发布的帖子应该有很高的时效性分数', () => {
      const post = createMockPost({ timestamp: Date.now() - 60000 }) // 1 分钟前
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.recency).toBeGreaterThan(0.9)
    })

    it('超过半衰期的帖子时效性分数应该下降', () => {
      const halfLifeMs = defaultConfig.decayHalfLife * 60 * 60 * 1000
      const post = createMockPost({ timestamp: Date.now() - halfLifeMs })
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.recency).toBeCloseTo(0.5, 1)
    })

    it('很久以前的帖子时效性分数应该很低', () => {
      const post = createMockPost({ timestamp: Date.now() - 7 * 24 * 3600000 }) // 7 天前
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.recency).toBeLessThan(0.1)
    })

    it('未来的帖子（时区问题）应该给满分', () => {
      const post = createMockPost({ timestamp: Date.now() + 3600000 }) // 1 小时后
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.recency).toBe(1)
    })
  })

  describe('互动量分数 (engagement)', () => {
    it('高互动量的帖子应该有较高的分数', () => {
      const post = createMockPost({
        stats: { likes: 5000, comments: 1000, shares: 500, views: 100000 },
      })
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.engagement).toBeGreaterThan(0.5)
    })

    it('低互动量的帖子应该有较低的分数', () => {
      const post = createMockPost({
        stats: { likes: 1, comments: 0, shares: 0, views: 10 },
      })
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.engagement).toBeLessThan(0.3)
    })

    it('零互动量的帖子分数应该接近 0', () => {
      const post = createMockPost({
        stats: { likes: 0, comments: 0, shares: 0, views: 0 },
      })
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.engagement).toBeLessThan(0.1)
    })
  })

  describe('相关性分数 (relevance)', () => {
    it('匹配用户兴趣的帖子应该有较高的相关性分数', () => {
      const post = createMockPost({ topicTags: ['科技', '游戏'] }) // 匹配 2 个标签
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.relevance).toBeGreaterThan(0.5)
    })

    it('不匹配用户兴趣的帖子相关性分数应该较低', () => {
      const post = createMockPost({ topicTags: ['体育', '娱乐'] }) // 不匹配
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.relevance).toBeLessThan(0.5)
    })

    it('没有标签的帖子应该返回较低的相关性分数', () => {
      const post = createMockPost({ topicTags: [] })
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.relevance).toBe(0.3)
    })

    it('用户没有兴趣标签时应该返回中性分数', () => {
      const context = ScoreCalculator.createContext({
        userId: 'user_001',
        interestTags: [],
      })
      const post = createMockPost({ topicTags: ['科技'] })
      const scores = calculator.calculate(post, defaultConfig, context)

      expect(scores.relevance).toBe(0.5)
    })
  })

  describe('社交分数 (social)', () => {
    it('关注的作者的帖子应该有较高的社交分数', () => {
      const post = createMockPost({ authorId: 'author_001' }) // 在 followingIds 中
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.social).toBeGreaterThanOrEqual(0.5)
    })

    it('互动过的作者的帖子应该有较高的社交分数', () => {
      const post = createMockPost({ authorId: 'author_003' }) // 在 interactedIds 中
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.social).toBeGreaterThanOrEqual(0.5)
    })

    it('既关注又互动过的作者应该有满分', () => {
      const context = ScoreCalculator.createContext({
        userId: 'user_001',
        followingIds: ['author_001'],
        interactedIds: ['author_001'],
      })
      const post = createMockPost({ authorId: 'author_001' })
      const scores = calculator.calculate(post, defaultConfig, context)

      expect(scores.social).toBe(1)
    })

    it('陌生作者的帖子社交分数应该为 0', () => {
      const post = createMockPost({ authorId: 'unknown_author' })
      const scores = calculator.calculate(post, defaultConfig, defaultContext)

      expect(scores.social).toBe(0)
    })
  })

  describe('calculateBatch 批量计算', () => {
    it('应该为所有帖子计算分数', () => {
      const posts = [
        createMockPost({ id: 'post_1' }),
        createMockPost({ id: 'post_2' }),
        createMockPost({ id: 'post_3' }),
      ]

      const results = calculator.calculateBatch(posts, defaultConfig, defaultContext)

      expect(results.size).toBe(3)
      expect(results.has('post_1')).toBe(true)
      expect(results.has('post_2')).toBe(true)
      expect(results.has('post_3')).toBe(true)
    })

    it('每个帖子的分数应该有效', () => {
      const posts = [
        createMockPost({ id: 'post_1', stats: { likes: 100, comments: 10, shares: 5 } }),
        createMockPost({ id: 'post_2', stats: { likes: 1000, comments: 100, shares: 50 } }),
      ]

      const results = calculator.calculateBatch(posts, defaultConfig, defaultContext)

      const score1 = results.get('post_1')!
      const score2 = results.get('post_2')!

      expect(score1.total).toBeGreaterThan(0)
      expect(score2.total).toBeGreaterThan(0)
      expect(score2.engagement).toBeGreaterThan(score1.engagement)
    })
  })

  describe('createContext 创建评分上下文', () => {
    it('应该使用提供的参数创建上下文', () => {
      const context = ScoreCalculator.createContext({
        userId: 'test_user',
        followingIds: ['a', 'b'],
        interactedIds: ['c'],
        interestTags: ['tag1'],
        now: 1000000,
        maxEngagement: 5000,
        maxHeat: 50,
      })

      expect(context.userId).toBe('test_user')
      expect(context.followingIds).toEqual(['a', 'b'])
      expect(context.interactedIds).toEqual(['c'])
      expect(context.interestTags).toEqual(['tag1'])
      expect(context.now).toBe(1000000)
      expect(context.normalization.maxEngagement).toBe(5000)
      expect(context.normalization.maxHeat).toBe(50)
    })

    it('应该使用默认值填充未提供的参数', () => {
      const context = ScoreCalculator.createContext({
        userId: 'test_user',
      })

      expect(context.followingIds).toEqual([])
      expect(context.interactedIds).toEqual([])
      expect(context.interestTags).toEqual([])
      expect(context.normalization.maxEngagement).toBe(10000)
      expect(context.normalization.maxHeat).toBe(100)
    })
  })
})
