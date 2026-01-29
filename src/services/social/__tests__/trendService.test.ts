/**
 * TrendService 单元测试
 * 测试热搜话题管理和惰性内容填充
 */

import './setup'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TrendService } from '../trendService'
import { db } from '@/services/database'
import type { WorldEvent, TrendingTopic } from '@/types/social'

// Mock 依赖
vi.mock('../contentFactory', () => ({
  ContentFactory: {
    getInstance: vi.fn(() => ({
      generatePost: vi.fn().mockResolvedValue({
        text: '测试博文内容',
        tags: ['测试'],
      }),
    })),
  },
}))

vi.mock('@/services/account/accountService', () => ({
  accountService: {
    getAccountsByPlatform: vi.fn().mockResolvedValue([]),
    createEntity: vi.fn().mockResolvedValue({
      id: 'mock-entity-id',
      type: 'npc',
      displayName: '测试用户',
    }),
    createPlatformAccount: vi.fn().mockResolvedValue({
      id: 'mock-account-id',
      entityId: 'mock-entity-id',
      platformId: 'weibo',
      handle: 'test_user',
      nickname: '测试用户',
    }),
  },
}))

vi.mock('@/services/account/userPool', () => ({
  UserPool: {
    getInstance: vi.fn(() => ({
      generateRandomProfile: vi.fn().mockReturnValue({
        nickname: '随机用户',
        bio: '测试简介',
        avatar: 'avatar.jpg',
        gender: 'unknown',
      }),
    })),
  },
}))

describe('TrendService', () => {
  let service: TrendService

  beforeEach(async () => {
    // 清理数据库
    await db.socialTopics.clear()
    await db.socialPosts.clear()

    // 获取服务实例
    service = TrendService.getInstance()
  })

  afterEach(async () => {
    await db.socialTopics.clear()
    await db.socialPosts.clear()
    vi.clearAllMocks()
  })

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = TrendService.getInstance()
      const instance2 = TrendService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('createTopicFromEvent', () => {
    it('应该从世界事件创建热搜话题', async () => {
      const event: WorldEvent = {
        id: 'event-1',
        source: 'director',
        topic: '测试事件',
        summary: '这是一个测试事件的描述',
        priority: 'normal',
        affectedPlatforms: ['weibo'],
        timestamp: Date.now(),
      }

      const topics = await service.createTopicFromEvent(event)

      expect(topics.length).toBe(1)
      expect(topics[0].keyword).toBe('#测试事件#')
      expect(topics[0].summary).toBe('这是一个测试事件的描述')
      expect(topics[0].platformId).toBe('weibo')
      expect(topics[0].isNew).toBe(true)
    })

    it('应该为多个平台创建话题', async () => {
      const event: WorldEvent = {
        id: 'event-2',
        source: 'director',
        topic: '跨平台事件',
        summary: '影响多个平台的事件',
        priority: 'breaking',
        affectedPlatforms: ['weibo', 'bilibili', 'zhihu'],
        timestamp: Date.now(),
      }

      const topics = await service.createTopicFromEvent(event)

      expect(topics.length).toBe(3)
      expect(topics.map((t) => t.platformId)).toContain('weibo')
      expect(topics.map((t) => t.platformId)).toContain('bilibili')
      expect(topics.map((t) => t.platformId)).toContain('zhihu')
    })

    it('应该为 breaking 事件设置更高的 baseScore', async () => {
      const normalEvent: WorldEvent = {
        id: 'event-normal',
        source: 'director',
        topic: '普通事件',
        summary: '普通事件描述',
        priority: 'normal',
        affectedPlatforms: ['weibo'],
        timestamp: Date.now(),
      }

      const breakingEvent: WorldEvent = {
        id: 'event-breaking',
        source: 'director',
        topic: '突发事件',
        summary: '突发事件描述',
        priority: 'breaking',
        affectedPlatforms: ['weibo'],
        timestamp: Date.now(),
      }

      const normalTopics = await service.createTopicFromEvent(normalEvent)
      const breakingTopics = await service.createTopicFromEvent(breakingEvent)

      expect(breakingTopics[0].baseScore).toBeGreaterThan(normalTopics[0].baseScore)
      expect(breakingTopics[0].isHot).toBe(true)
    })

    it('应该自动添加 # 标记', async () => {
      const event: WorldEvent = {
        id: 'event-3',
        source: 'director',
        topic: '无标记话题',
        summary: '测试',
        priority: 'normal',
        affectedPlatforms: ['weibo'],
        timestamp: Date.now(),
      }

      const topics = await service.createTopicFromEvent(event)

      expect(topics[0].keyword).toBe('#无标记话题#')
    })

    it('应该保留已有的 # 标记', async () => {
      const event: WorldEvent = {
        id: 'event-4',
        source: 'director',
        topic: '#已有标记#',
        summary: '测试',
        priority: 'normal',
        affectedPlatforms: ['weibo'],
        timestamp: Date.now(),
      }

      const topics = await service.createTopicFromEvent(event)

      expect(topics[0].keyword).toBe('#已有标记#')
    })
  })

  describe('getTrendingList', () => {
    beforeEach(async () => {
      const now = Date.now()

      // 添加测试话题
      await db.socialTopics.bulkAdd([
        {
          id: 'topic-1',
          platformId: 'weibo',
          keyword: '#热门话题1#',
          summary: '热门话题1描述',
          categories: ['general'],
          isNew: false,
          isHot: true,
          baseScore: 90,
          velocity: 0,
          createdAt: now - 1000 * 60 * 60 * 2, // 2小时前
          peakTime: now + 1000 * 60 * 60 * 4,
        },
        {
          id: 'topic-2',
          platformId: 'weibo',
          keyword: '#热门话题2#',
          summary: '热门话题2描述',
          categories: ['general'],
          isNew: true,
          isHot: false,
          baseScore: 50,
          velocity: 0,
          createdAt: now - 1000 * 60 * 30, // 30分钟前
          peakTime: now + 1000 * 60 * 60 * 6,
        },
        {
          id: 'topic-3',
          platformId: 'bilibili',
          keyword: '#B站话题#',
          summary: 'B站话题描述',
          categories: ['general'],
          isNew: false,
          isHot: false,
          baseScore: 70,
          velocity: 0,
          createdAt: now - 1000 * 60 * 60 * 1,
          peakTime: now + 1000 * 60 * 60 * 5,
        },
      ])
    })

    it('应该返回指定平台的热搜列表', async () => {
      const weiboTrends = await service.getTrendingList('weibo')

      expect(weiboTrends.length).toBe(2)
      expect(weiboTrends.every((t) => t.platformId === 'weibo')).toBe(true)
    })

    it('应该按热度排序', async () => {
      const trends = await service.getTrendingList('weibo')

      // 第一个话题应该热度更高（baseScore 90 vs 50）
      expect(trends[0].baseScore).toBeGreaterThan(trends[1].baseScore)
    })

    it('应该限制返回数量', async () => {
      const trends = await service.getTrendingList('weibo', 1)

      expect(trends.length).toBe(1)
    })

    it('应该计算实时热度', async () => {
      const trends = await service.getTrendingList('weibo')

      for (const trend of trends) {
        expect(trend.currentHeat).toBeDefined()
        expect(trend.currentHeat).toBeGreaterThan(0)
      }
    })

    it('应该更新 isNew 和 isHot 状态', async () => {
      const trends = await service.getTrendingList('weibo')

      // 高热度的前几名应该标记为 hot
      const hotTrend = trends.find((t) => t.baseScore === 90)
      expect(hotTrend?.isHot).toBe(true)

      // 1小时内创建的应该标记为 new
      const newTrend = trends.find((t) => t.baseScore === 50)
      expect(newTrend?.isNew).toBe(true)
    })
  })

  describe('ensureTopicContent', () => {
    it('应该为没有内容的话题生成博文', async () => {
      const topic: TrendingTopic = {
        id: 'topic-empty',
        platformId: 'weibo',
        keyword: '#空话题#',
        summary: '没有内容的话题',
        categories: ['general'],
        isNew: true,
        isHot: false,
        baseScore: 50,
        velocity: 0,
        createdAt: Date.now(),
        peakTime: Date.now() + 1000 * 60 * 60 * 4,
      }

      await db.socialTopics.add(topic)
      await service.ensureTopicContent(topic.id)

      // 检查是否生成了博文
      const posts = await db.socialPosts.toArray()
      expect(posts.length).toBeGreaterThan(0)
    })

    it('应该跳过已有内容的话题', async () => {
      const topic: TrendingTopic = {
        id: 'topic-with-content',
        platformId: 'weibo',
        keyword: '#有内容话题#',
        summary: '有内容的话题',
        categories: ['general'],
        isNew: true,
        isHot: false,
        baseScore: 50,
        velocity: 0,
        createdAt: Date.now(),
        peakTime: Date.now() + 1000 * 60 * 60 * 4,
      }

      await db.socialTopics.add(topic)

      // 预先添加一条博文
      await db.socialPosts.add({
        id: 'existing-post',
        platformId: 'weibo',
        authorId: 'author-1',
        timestamp: Date.now(),
        topicTags: ['#有内容话题#'],
        stats: { views: 100, likes: 10, comments: 5, shares: 2 },
        payload: { text: '已有的博文' },
      })

      await service.ensureTopicContent(topic.id)

      // 应该只有一条博文
      const posts = await db.socialPosts.toArray()
      expect(posts.length).toBe(1)
    })

    it('应该处理不存在的话题', async () => {
      // 不应该抛出错误
      await expect(
        service.ensureTopicContent('non-existent-topic')
      ).resolves.not.toThrow()
    })
  })
})
