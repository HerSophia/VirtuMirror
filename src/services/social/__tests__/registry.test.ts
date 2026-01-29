/**
 * PlatformRegistry 单元测试
 * 测试平台配置管理和提示词注册
 */

import './setup'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PlatformRegistry } from '../registry'
import { PromptService } from '@/services/prompt/promptService'
import type { PlatformConfig } from '@/types/social'

// Mock PromptService
vi.mock('@/services/prompt/promptService', () => ({
  PromptService: {
    registerAppPrompts: vi.fn(),
    getPromptByScene: vi.fn(),
    renderPrompt: vi.fn(),
  },
}))

describe('PlatformRegistry', () => {
  let registry: PlatformRegistry

  beforeEach(() => {
    // 由于 PlatformRegistry 是单例，需要在测试前获取实例
    registry = PlatformRegistry.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = PlatformRegistry.getInstance()
      const instance2 = PlatformRegistry.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('内置平台', () => {
    it('应该包含微博平台', () => {
      const weibo = registry.getPlatform('weibo')

      expect(weibo).toBeDefined()
      expect(weibo?.name).toBe('微博')
      expect(weibo?.content.hasTitle).toBe(false)
      expect(weibo?.content.mediaType).toBe('text_image')
      expect(weibo?.content.maxLength).toBe(140)
      expect(weibo?.aiSetting.slang).toContain('yyds')
      expect(weibo?.interaction.actions).toContain('like')
      expect(weibo?.interaction.commentStructure).toBe('nested')
    })

    it('应该包含 Bilibili 平台', () => {
      const bilibili = registry.getPlatform('bilibili')

      expect(bilibili).toBeDefined()
      expect(bilibili?.name).toBe('Bilibili')
      expect(bilibili?.content.hasTitle).toBe(true)
      expect(bilibili?.content.mediaType).toBe('video')
      expect(bilibili?.aiSetting.slang).toContain('三连')
      expect(bilibili?.interaction.actions).toContain('coin')
    })

    it('应该包含知乎平台', () => {
      const zhihu = registry.getPlatform('zhihu')

      expect(zhihu).toBeDefined()
      expect(zhihu?.name).toBe('知乎')
      expect(zhihu?.content.hasTitle).toBe(true)
      expect(zhihu?.content.mediaType).toBe('qa')
      expect(zhihu?.aiSetting.slang).toContain('谢邀')
      expect(zhihu?.interaction.actions).toContain('dislike')
    })

    it('应该包含小红书平台', () => {
      const redbook = registry.getPlatform('redbook')

      expect(redbook).toBeDefined()
      expect(redbook?.name).toBe('小红书')
      expect(redbook?.content.hasTitle).toBe(true)
      expect(redbook?.aiSetting.slang).toContain('种草')
    })
  })

  describe('getPlatform', () => {
    it('应该返回存在的平台配置', () => {
      const weibo = registry.getPlatform('weibo')
      expect(weibo).toBeDefined()
      expect(weibo?.id).toBe('weibo')
    })

    it('应该对不存在的平台返回 undefined', () => {
      const unknown = registry.getPlatform('unknown-platform')
      expect(unknown).toBeUndefined()
    })
  })

  describe('getAllPlatforms', () => {
    it('应该返回所有已注册的平台', () => {
      const platforms = registry.getAllPlatforms()

      expect(platforms.length).toBeGreaterThanOrEqual(4)
      expect(platforms.map((p) => p.id)).toContain('weibo')
      expect(platforms.map((p) => p.id)).toContain('bilibili')
      expect(platforms.map((p) => p.id)).toContain('zhihu')
      expect(platforms.map((p) => p.id)).toContain('redbook')
    })
  })

  describe('registerPlatform', () => {
    it('应该注册新平台', () => {
      const customPlatform: PlatformConfig = {
        id: 'custom-platform',
        name: '自定义平台',
        content: {
          hasTitle: true,
          mediaType: 'text_image',
          maxLength: 500,
        },
        aiSetting: {
          tone: 'friendly',
          roles: ['user'],
          slang: ['hello'],
          promptTemplate: 'custom.prompt',
        },
        interaction: {
          actions: ['like'],
          commentStructure: 'flat',
        },
        dmStrategy: {
          allowStranger: true,
          foldUnknown: false,
        },
      }

      registry.registerPlatform(customPlatform)

      const retrieved = registry.getPlatform('custom-platform')
      expect(retrieved).toEqual(customPlatform)
    })

    it('应该覆盖已存在的平台配置', () => {
      const updatedWeibo: PlatformConfig = {
        id: 'weibo',
        name: '微博 V2',
        content: {
          hasTitle: false,
          mediaType: 'text_image',
          maxLength: 280, // 更新了字数限制
        },
        aiSetting: {
          tone: 'casual',
          roles: ['user'],
          slang: ['新梗'],
          promptTemplate: 'weibo.v2',
        },
        interaction: {
          actions: ['like', 'repost'],
          commentStructure: 'nested',
        },
        dmStrategy: {
          allowStranger: true,
          foldUnknown: true,
        },
      }

      registry.registerPlatform(updatedWeibo)

      const weibo = registry.getPlatform('weibo')
      expect(weibo?.name).toBe('微博 V2')
      expect(weibo?.content.maxLength).toBe(280)
    })
  })

  describe('平台配置验证', () => {
    it('每个平台应该有完整的必要配置', () => {
      const platforms = registry.getAllPlatforms()

      for (const platform of platforms) {
        // 基础信息
        expect(platform.id).toBeDefined()
        expect(platform.name).toBeDefined()

        // 内容配置
        expect(platform.content).toBeDefined()
        expect(typeof platform.content.hasTitle).toBe('boolean')
        expect(platform.content.mediaType).toBeDefined()
        expect(platform.content.maxLength).toBeGreaterThan(0)

        // AI 设置
        expect(platform.aiSetting).toBeDefined()
        expect(platform.aiSetting.tone).toBeDefined()
        expect(Array.isArray(platform.aiSetting.roles)).toBe(true)
        expect(Array.isArray(platform.aiSetting.slang)).toBe(true)

        // 交互配置
        expect(platform.interaction).toBeDefined()
        expect(Array.isArray(platform.interaction.actions)).toBe(true)
        expect(platform.interaction.commentStructure).toBeDefined()

        // DM 策略
        expect(platform.dmStrategy).toBeDefined()
        expect(typeof platform.dmStrategy.allowStranger).toBe('boolean')
        expect(typeof platform.dmStrategy.foldUnknown).toBe('boolean')
      }
    })
  })
})
