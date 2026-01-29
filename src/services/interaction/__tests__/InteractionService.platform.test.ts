/**
 * 交互服务 - 平台扩展功能测试
 */

import { describe, it, expect, vi } from 'vitest'
import './setup'
import { interactionService } from '../InteractionService'
import type { PlatformBehavior } from '@/types/interaction'

describe('InteractionService 平台扩展功能', () => {
  const testUserId = 'user_platform_001'
  const testContentId = 'post_platform_001'

  describe('registerPlatformBehavior 注册平台行为', () => {
    it('应该成功注册平台行为', () => {
      const behavior: PlatformBehavior = {
        platformId: 'test-platform',
        name: '测试行为',
        action: 'testAction',
        description: '这是一个测试行为',
        execute: vi.fn(),
      }

      interactionService.registerPlatformBehavior(behavior)

      const registered = interactionService.getPlatformBehavior(
        'test-platform',
        'testAction'
      )
      expect(registered).toBeDefined()
      expect(registered?.name).toBe('测试行为')
    })

    it('默认不应该覆盖已存在的行为', () => {
      const behavior1: PlatformBehavior = {
        platformId: 'test-platform-2',
        name: '行为1',
        action: 'action1',
        execute: vi.fn(),
      }
      const behavior2: PlatformBehavior = {
        platformId: 'test-platform-2',
        name: '行为2',
        action: 'action1',
        execute: vi.fn(),
      }

      interactionService.registerPlatformBehavior(behavior1)
      interactionService.registerPlatformBehavior(behavior2)

      const registered = interactionService.getPlatformBehavior(
        'test-platform-2',
        'action1'
      )
      expect(registered?.name).toBe('行为1')
    })

    it('设置 override 时应该覆盖已存在的行为', () => {
      const behavior1: PlatformBehavior = {
        platformId: 'test-platform-3',
        name: '行为1',
        action: 'action1',
        execute: vi.fn(),
      }
      const behavior2: PlatformBehavior = {
        platformId: 'test-platform-3',
        name: '行为2',
        action: 'action1',
        execute: vi.fn(),
      }

      interactionService.registerPlatformBehavior(behavior1)
      interactionService.registerPlatformBehavior(behavior2, { override: true })

      const registered = interactionService.getPlatformBehavior(
        'test-platform-3',
        'action1'
      )
      expect(registered?.name).toBe('行为2')
    })
  })

  describe('getPlatformBehaviors 获取平台所有行为', () => {
    it('应该返回平台的所有行为', () => {
      const behaviors: PlatformBehavior[] = [
        {
          platformId: 'multi-behavior-platform',
          name: '行为A',
          action: 'actionA',
          execute: vi.fn(),
        },
        {
          platformId: 'multi-behavior-platform',
          name: '行为B',
          action: 'actionB',
          execute: vi.fn(),
        },
      ]

      for (const behavior of behaviors) {
        interactionService.registerPlatformBehavior(behavior)
      }

      const platformBehaviors = interactionService.getPlatformBehaviors(
        'multi-behavior-platform'
      )

      expect(platformBehaviors.length).toBe(2)
      expect(platformBehaviors.some((b) => b.name === '行为A')).toBe(true)
      expect(platformBehaviors.some((b) => b.name === '行为B')).toBe(true)
    })

    it('不存在的平台应该返回空数组', () => {
      const behaviors = interactionService.getPlatformBehaviors('nonexistent-platform')
      expect(behaviors).toEqual([])
    })
  })

  describe('executePlatformBehavior 执行平台行为', () => {
    it('应该成功执行已注册的行为', async () => {
      const executeFn = vi.fn()
      const behavior: PlatformBehavior = {
        platformId: 'exec-platform',
        name: '可执行行为',
        action: 'execAction',
        execute: executeFn,
      }

      interactionService.registerPlatformBehavior(behavior)

      await interactionService.executePlatformBehavior(
        'exec-platform',
        'execAction',
        testContentId,
        testUserId,
        { customParam: 'value' }
      )

      expect(executeFn).toHaveBeenCalledWith(
        testContentId,
        testUserId,
        { customParam: 'value' }
      )
    })

    it('执行未注册的行为应该抛出错误', async () => {
      await expect(
        interactionService.executePlatformBehavior(
          'nonexistent-platform',
          'nonexistentAction',
          testContentId,
          testUserId
        )
      ).rejects.toThrow('平台行为 nonexistent-platform:nonexistentAction 未注册')
    })
  })
})
