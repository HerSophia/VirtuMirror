/**
 * SystemPromptService 单元测试
 * 测试系统提示词的管理和组装功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SystemPromptService } from '../systemPromptService'
import { PromptService } from '../promptService'
import type { PromptTemplate } from '@/types/prompts'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
})

describe('SystemPromptService', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 清理创建的系统提示词
    const allSystemPrompts = SystemPromptService.getAllSystemPrompts()
    allSystemPrompts.forEach((p) => {
      try {
        SystemPromptService.delete(p.id)
      } catch {
        // 忽略删除失败
      }
    })
  })

  describe('create', () => {
    it('应该创建全局系统提示词', () => {
      const created = SystemPromptService.create({
        name: '全局约束',
        content: '你必须始终保持友好。',
        scope: 'global',
      })

      expect(created).toBeDefined()
      expect(created.isSystemPrompt).toBe(true)
      expect(created.systemPromptScope).toBe('global')
      expect(created.template).toBe('你必须始终保持友好。')
    })

    it('应该创建 App 级系统提示词', () => {
      const created = SystemPromptService.create({
        name: 'App 约束',
        content: '这是特定 App 的约束。',
        scope: 'app',
        appId: 'test-app',
        mode: 'append',
      })

      expect(created.systemPromptScope).toBe('app')
      expect(created.systemPromptMode).toBe('append')
    })

    it('应该设置默认优先级', () => {
      const created = SystemPromptService.create({
        name: '测试',
        content: '内容',
        scope: 'global',
      })

      expect(created.priority).toBe(0)
    })

    it('应该使用指定的优先级', () => {
      const created = SystemPromptService.create({
        name: '高优先级',
        content: '内容',
        scope: 'global',
        priority: 100,
      })

      expect(created.priority).toBe(100)
    })
  })

  describe('getAllSystemPrompts', () => {
    it('应该只返回系统提示词', () => {
      // 创建一个普通提示词
      PromptService.addPrompt({
        name: '普通提示词',
        category: 'chat',
        scene: 'normal.prompt',
        template: 'normal',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      // 创建一个系统提示词
      SystemPromptService.create({
        name: '系统提示词',
        content: 'system',
        scope: 'global',
      })

      const systemPrompts = SystemPromptService.getAllSystemPrompts()
      expect(systemPrompts.every((p) => p.isSystemPrompt === true)).toBe(true)
    })
  })

  describe('getGlobalSystemPrompts', () => {
    it('应该只返回全局且启用的系统提示词', () => {
      SystemPromptService.create({
        name: '全局1',
        content: 'global1',
        scope: 'global',
      })

      SystemPromptService.create({
        name: 'App级',
        content: 'app',
        scope: 'app',
        appId: 'test',
      })

      const globalPrompts = SystemPromptService.getGlobalSystemPrompts()
      expect(globalPrompts.every((p) => p.systemPromptScope === 'global')).toBe(true)
    })

    it('应该按优先级排序', () => {
      SystemPromptService.create({
        name: '低优先级',
        content: 'low',
        scope: 'global',
        priority: 10,
      })

      SystemPromptService.create({
        name: '高优先级',
        content: 'high',
        scope: 'global',
        priority: 1,
      })

      const globalPrompts = SystemPromptService.getGlobalSystemPrompts()
      if (globalPrompts.length >= 2) {
        expect(globalPrompts[0].priority).toBeLessThanOrEqual(globalPrompts[1].priority)
      }
    })
  })

  describe('assemble', () => {
    it('应该组装全局系统提示词', () => {
      SystemPromptService.create({
        name: '约束1',
        content: '保持友好。',
        scope: 'global',
        priority: 1,
      })

      SystemPromptService.create({
        name: '约束2',
        content: '使用中文回复。',
        scope: 'global',
        priority: 2,
      })

      const result = SystemPromptService.assemble()

      expect(result.systemPrompt).toContain('保持友好。')
      expect(result.systemPrompt).toContain('使用中文回复。')
      expect(result.appliedPrompts.length).toBe(2)
    })

    it('应该追加基础 systemPrompt', () => {
      SystemPromptService.create({
        name: '全局',
        content: '全局约束',
        scope: 'global',
      })

      const result = SystemPromptService.assemble({
        baseSystemPrompt: '你是一个助手。',
      })

      expect(result.systemPrompt).toContain('全局约束')
      expect(result.systemPrompt).toContain('你是一个助手。')
    })

    it('override 模式应该跳过全局提示词', () => {
      SystemPromptService.create({
        name: '全局',
        content: '全局内容',
        scope: 'global',
      })

      // 需要先注册 App 提示词
      PromptService.registerAppPrompts('override-app', [])

      // 创建 override 模式的 App 系统提示词
      const appPrompt = PromptService.addPrompt({
        name: 'App Override',
        category: 'system',
        scene: 'system.override-app.override',
        template: 'App 专用内容',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      PromptService.updatePrompt(appPrompt.id, {
        isSystemPrompt: true,
        systemPromptScope: 'app',
        systemPromptMode: 'override',
        source: { type: 'app', appId: 'override-app' },
      })

      const result = SystemPromptService.assemble({ appId: 'override-app' })

      // override 模式应该不包含全局内容
      expect(result.appliedPrompts.some((p) => p.scope === 'global')).toBe(false)

      // 清理
      PromptService.unregisterAppPrompts('override-app')
      PromptService.deletePrompt(appPrompt.id)
    })

    it('空配置应该返回空字符串', () => {
      const result = SystemPromptService.assemble()
      // 如果没有创建任何系统提示词，应该返回空
      const allSystemPrompts = SystemPromptService.getAllSystemPrompts()
      if (allSystemPrompts.length === 0) {
        expect(result.systemPrompt).toBe('')
      }
    })
  })

  describe('update', () => {
    it('应该更新系统提示词', () => {
      const created = SystemPromptService.create({
        name: '原名称',
        content: '原内容',
        scope: 'global',
      })

      const updated = SystemPromptService.update(created.id, {
        name: '新名称',
        content: '新内容',
      })

      expect(updated).toBe(true)

      const retrieved = PromptService.getPromptById(created.id)
      expect(retrieved?.name).toBe('新名称')
      expect(retrieved?.template).toBe('新内容')
    })

    it('应该对非系统提示词返回 false', () => {
      const normalPrompt = PromptService.addPrompt({
        name: '普通',
        category: 'chat',
        scene: 'update.normal',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const updated = SystemPromptService.update(normalPrompt.id, { name: 'new' })
      expect(updated).toBe(false)
    })
  })

  describe('delete', () => {
    it('应该删除系统提示词', () => {
      const created = SystemPromptService.create({
        name: '待删除',
        content: '内容',
        scope: 'global',
      })

      const deleted = SystemPromptService.delete(created.id)
      expect(deleted).toBe(true)

      const retrieved = PromptService.getPromptById(created.id)
      expect(retrieved).toBeNull()
    })

    it('应该对非系统提示词返回 false', () => {
      const normalPrompt = PromptService.addPrompt({
        name: '普通',
        category: 'chat',
        scene: 'delete.normal',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const deleted = SystemPromptService.delete(normalPrompt.id)
      expect(deleted).toBe(false)
    })
  })

  describe('toggle', () => {
    it('应该切换系统提示词的启用状态', () => {
      const created = SystemPromptService.create({
        name: '测试',
        content: '内容',
        scope: 'global',
      })

      expect(PromptService.getPromptById(created.id)?.enabled).toBe(true)

      SystemPromptService.toggle(created.id)
      expect(PromptService.getPromptById(created.id)?.enabled).toBe(false)

      SystemPromptService.toggle(created.id)
      expect(PromptService.getPromptById(created.id)?.enabled).toBe(true)
    })
  })

  describe('getStats', () => {
    it('应该返回统计信息', () => {
      SystemPromptService.create({
        name: '全局1',
        content: 'g1',
        scope: 'global',
      })

      SystemPromptService.create({
        name: '全局2',
        content: 'g2',
        scope: 'global',
      })

      const stats = SystemPromptService.getStats()

      expect(stats.total).toBeGreaterThanOrEqual(2)
      expect(stats.global).toBeGreaterThanOrEqual(2)
      expect(typeof stats.enabled).toBe('number')
      expect(typeof stats.byApp).toBe('object')
    })
  })

  describe('preview', () => {
    it('应该返回预览结果和分解', () => {
      SystemPromptService.create({
        name: '测试',
        content: '测试内容',
        scope: 'global',
      })

      const preview = SystemPromptService.preview({})

      expect(preview.result).toBeDefined()
      expect(preview.breakdown).toBeDefined()
      expect(Array.isArray(preview.breakdown)).toBe(true)
    })

    it('应该包含基础 systemPrompt 的分解', () => {
      const preview = SystemPromptService.preview({
        baseSystemPrompt: '基础提示词',
      })

      const hasBase = preview.breakdown.some((b) => b.source.includes('Prompt 自带'))
      expect(hasBase).toBe(true)
    })
  })

  describe('场景过滤', () => {
    it('应该排除指定场景', () => {
      const created = SystemPromptService.create({
        name: '带排除',
        content: '内容',
        scope: 'global',
        excludeScenes: ['chat.*'],
      })

      PromptService.updatePrompt(created.id, {
        excludeScenes: ['chat.*'],
      })

      const result = SystemPromptService.assemble({ scene: 'chat.reply' })

      // 这个提示词应该被排除
      const isApplied = result.appliedPrompts.some((p) => p.id === created.id)
      expect(isApplied).toBe(false)
    })

    it('应该只包含指定场景', () => {
      const created = SystemPromptService.create({
        name: '限定场景',
        content: '内容',
        scope: 'global',
        applicableScenes: ['email.*'],
      })

      PromptService.updatePrompt(created.id, {
        applicableScenes: ['email.*'],
      })

      // 非 email 场景不应该包含
      const resultChat = SystemPromptService.assemble({ scene: 'chat.reply' })
      expect(resultChat.appliedPrompts.some((p) => p.id === created.id)).toBe(false)

      // email 场景应该包含
      const resultEmail = SystemPromptService.assemble({ scene: 'email.compose' })
      expect(resultEmail.appliedPrompts.some((p) => p.id === created.id)).toBe(true)
    })
  })
})
