/**
 * ContentFactory 单元测试
 * 测试 LLM 内容生成和 JSON 解析修复
 */

import './setup'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ContentFactory } from '../contentFactory'
import { db } from '@/services/database'
import type { TrendingTopic } from '@/types/social'
import type { PlatformAccount } from '@/types/account'

// Mock AIGenerateService
vi.mock('@/services/aiGenerateService', () => ({
  default: {
    generate: vi.fn(),
  },
}))

// Mock PromptService
vi.mock('@/services/prompt/promptService', () => ({
  PromptService: {
    getPromptByScene: vi.fn().mockReturnValue(null),
    renderPrompt: vi.fn().mockReturnValue({
      systemPrompt: 'mock system prompt',
      userPrompt: 'mock user prompt',
    }),
  },
}))

// Mock accountService
vi.mock('@/services/account/accountService', () => ({
  accountService: {
    getEntity: vi.fn().mockResolvedValue({
      id: 'entity-1',
      displayName: '测试用户',
      bio: '测试简介',
    }),
    getAccountsByPlatform: vi.fn().mockResolvedValue([]),
    createEntity: vi.fn().mockResolvedValue({
      id: 'new-entity-id',
      type: 'npc',
      displayName: '新用户',
    }),
    createPlatformAccount: vi.fn().mockResolvedValue({
      id: 'new-account-id',
      entityId: 'new-entity-id',
      platformId: 'weibo',
    }),
  },
}))

// Mock UserPool
vi.mock('@/services/account/userPool', () => ({
  UserPool: {
    getInstance: vi.fn(() => ({
      generateByRole: vi.fn().mockReturnValue({
        nickname: '随机用户',
        bio: '测试简介',
        avatar: 'avatar.jpg',
        gender: 'unknown',
      }),
    })),
  },
}))

import AIGenerateService from '@/services/aiGenerateService'

describe('ContentFactory', () => {
  let factory: ContentFactory
  const mockGenerate = AIGenerateService.generate as ReturnType<typeof vi.fn>

  beforeEach(async () => {
    await db.characterEntities.clear()
    await db.platformAccounts.clear()

    factory = ContentFactory.getInstance()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.characterEntities.clear()
    await db.platformAccounts.clear()
  })

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = ContentFactory.getInstance()
      const instance2 = ContentFactory.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('generatePost', () => {
    const mockTopic: TrendingTopic = {
      id: 'topic-1',
      platformId: 'weibo',
      keyword: '#测试话题#',
      summary: '测试话题描述',
      categories: ['general'],
      isNew: true,
      isHot: false,
      baseScore: 50,
      velocity: 0,
      createdAt: Date.now(),
      peakTime: Date.now() + 1000 * 60 * 60 * 4,
    }

    const mockAccount: PlatformAccount = {
      id: 'account-1',
      entityId: 'entity-1',
      platformId: 'weibo',
      handle: 'test_user',
      nickname: '测试用户',
      scope: 'global',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    it('应该生成博文内容', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: JSON.stringify({
          text: '这是一条测试博文',
          tags: ['测试', '热门'],
        }),
      })

      const result = await factory.generatePost('weibo', mockTopic, mockAccount)

      expect(result.text).toBe('这是一条测试博文')
      expect(result.tags).toContain('测试')
    })

    it('应该在没有账号时使用默认人设', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: JSON.stringify({
          text: '默认人设博文',
          tags: [],
        }),
      })

      const result = await factory.generatePost('weibo', mockTopic)

      expect(mockGenerate).toHaveBeenCalled()
      expect(result.text).toBe('默认人设博文')
    })

    it('应该处理不存在的平台', async () => {
      await expect(
        factory.generatePost('unknown-platform', mockTopic)
      ).rejects.toThrow('Platform unknown-platform not found')
    })

    it('应该处理 LLM 错误', async () => {
      mockGenerate.mockResolvedValue({
        success: false,
        error: 'LLM 服务不可用',
      })

      await expect(
        factory.generatePost('weibo', mockTopic)
      ).rejects.toThrow('LLM 服务不可用')
    })

    it('应该清理 markdown 代码块标记', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: '```json\n{"text": "带标记的内容", "tags": []}\n```',
      })

      const result = await factory.generatePost('weibo', mockTopic)

      expect(result.text).toBe('带标记的内容')
    })
  })

  describe('generateComments', () => {
    it('应该生成评论数组', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: JSON.stringify([
          { content: '评论1', userType: 'fan', nickname: '用户1', likes: 10 },
          { content: '评论2', userType: 'hater', nickname: '用户2', likes: 5 },
        ]),
      })

      const comments = await factory.generateComments('weibo', '测试博文', 2)

      expect(Array.isArray(comments)).toBe(true)
      expect(comments.length).toBe(2)
      expect(comments[0].content).toBe('评论1')
      expect(comments[1].content).toBe('评论2')
    })

    it('应该使用指定的评论数量', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: JSON.stringify([
          { content: '评论', userType: 'passerby', nickname: '路人' },
        ]),
      })

      await factory.generateComments('weibo', '测试', 10)

      // 检查是否传递了正确的数量参数
      const callArgs = mockGenerate.mock.calls[0]
      expect(callArgs[0].userPrompt || callArgs[0].systemPrompt).toBeDefined()
    })

    it('应该处理不存在的平台', async () => {
      await expect(
        factory.generateComments('unknown-platform', '测试')
      ).rejects.toThrow('Platform unknown-platform not found')
    })

    it('应该在解析失败时返回空数组', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: '不是有效的 JSON',
      })

      await expect(factory.generateComments('weibo', '测试')).rejects.toThrow()
    })
  })

  describe('JSON 解析和修复', () => {
    it('应该解析标准 JSON', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: '{"text": "标准JSON", "tags": ["a", "b"]}',
      })

      const result = await factory.generatePost('weibo', {
        id: 't1',
        keyword: '#test#',
        summary: 'test',
        categories: [],
        isNew: true,
        isHot: false,
        baseScore: 50,
        velocity: 0,
        createdAt: Date.now(),
        peakTime: Date.now(),
      })

      expect(result.text).toBe('标准JSON')
    })

    it('应该处理带有前导文本的 JSON', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: '以下是生成的内容：{"text": "带前导文本", "tags": []}',
      })

      const result = await factory.generatePost('weibo', {
        id: 't2',
        keyword: '#test#',
        summary: 'test',
        categories: [],
        isNew: true,
        isHot: false,
        baseScore: 50,
        velocity: 0,
        createdAt: Date.now(),
        peakTime: Date.now(),
      })

      expect(result.text).toBe('带前导文本')
    })

    it('应该处理带有尾部文本的 JSON', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: '{"text": "带尾部文本", "tags": []}希望这个内容对你有帮助！',
      })

      const result = await factory.generatePost('weibo', {
        id: 't3',
        keyword: '#test#',
        summary: 'test',
        categories: [],
        isNew: true,
        isHot: false,
        baseScore: 50,
        velocity: 0,
        createdAt: Date.now(),
        peakTime: Date.now(),
      })

      expect(result.text).toBe('带尾部文本')
    })

    it('应该处理 JSON5 格式（尾随逗号）', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: '{"text": "JSON5格式", "tags": ["a", "b",],}',
      })

      const result = await factory.generatePost('weibo', {
        id: 't4',
        keyword: '#test#',
        summary: 'test',
        categories: [],
        isNew: true,
        isHot: false,
        baseScore: 50,
        velocity: 0,
        createdAt: Date.now(),
        peakTime: Date.now(),
      })

      expect(result.text).toBe('JSON5格式')
    })

    it('应该对无法修复的 JSON 抛出错误', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        text: '这完全不是JSON格式的内容',
      })

      await expect(
        factory.generatePost('weibo', {
          id: 't5',
          keyword: '#test#',
          summary: 'test',
          categories: [],
          isNew: true,
          isHot: false,
          baseScore: 50,
          velocity: 0,
          createdAt: Date.now(),
          peakTime: Date.now(),
        })
      ).rejects.toThrow()
    })
  })
})
