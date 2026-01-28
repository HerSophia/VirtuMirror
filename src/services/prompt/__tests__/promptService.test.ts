/**
 * PromptService 单元测试
 * 测试提示词模板的管理功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PromptService } from '../promptService'
import type { PromptTemplate, PromptSystemConfig, AppPromptDefinition } from '@/types/prompts'

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

describe('PromptService', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 清理注册的 App 提示词
    PromptService.unregisterAppPrompts('test-app')
    PromptService.unregisterAppPrompts('my-app')
  })

  describe('getConfig / saveConfig', () => {
    it('应该返回默认配置当没有存储数据时', () => {
      const config = PromptService.getConfig()
      
      expect(config).toBeDefined()
      expect(config.templates).toBeDefined()
      expect(Array.isArray(config.templates)).toBe(true)
      expect(config.globalVariables).toBeDefined()
      expect(config._meta).toBeDefined()
    })

    it('应该包含默认的全局变量', () => {
      const config = PromptService.getConfig()
      expect(config.globalVariables.appName).toBe('小手机')
    })

    it('应该保存和加载配置', () => {
      const config = PromptService.getConfig()
      config.globalVariables.testVar = 'testValue'
      
      PromptService.saveConfig(config)
      
      const loaded = PromptService.getConfig()
      expect(loaded.globalVariables.testVar).toBe('testValue')
    })
  })

  describe('addPrompt', () => {
    it('应该添加自定义提示词', () => {
      const newPrompt = PromptService.addPrompt({
        name: '测试提示词',
        description: '这是一个测试',
        category: 'chat',
        scene: 'test.scene',
        template: '请生成 {{content}}',
        availableVariables: [
          { name: 'content', type: 'string', required: true, description: '内容' },
        ],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      expect(newPrompt.id).toMatch(/^custom\./)
      expect(newPrompt.name).toBe('测试提示词')
      expect(newPrompt.source.type).toBe('user')
      expect(newPrompt.isBuiltin).toBe(false)
      expect(newPrompt.createdAt).toBeDefined()
    })

    it('添加的提示词应该可以通过 ID 获取', () => {
      const newPrompt = PromptService.addPrompt({
        name: '测试',
        category: 'chat',
        scene: 'test.get',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const retrieved = PromptService.getPromptById(newPrompt.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('测试')
    })
  })

  describe('getPromptByScene', () => {
    it('应该按场景获取启用的提示词', () => {
      PromptService.addPrompt({
        name: '场景提示词',
        category: 'chat',
        scene: 'unique.scene',
        template: 'template content',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const prompt = PromptService.getPromptByScene('unique.scene')
      expect(prompt).toBeDefined()
      expect(prompt?.scene).toBe('unique.scene')
    })

    it('应该返回优先级最高的提示词', () => {
      PromptService.addPrompt({
        name: '低优先级',
        category: 'chat',
        scene: 'priority.test',
        template: 'low',
        availableVariables: [],
        enabled: true,
        priority: 10,
        version: '1.0.0',
      })

      PromptService.addPrompt({
        name: '高优先级',
        category: 'chat',
        scene: 'priority.test',
        template: 'high',
        availableVariables: [],
        enabled: true,
        priority: 1,
        version: '1.0.0',
      })

      const prompt = PromptService.getPromptByScene('priority.test')
      expect(prompt?.name).toBe('高优先级')
    })

    it('应该忽略禁用的提示词', () => {
      PromptService.addPrompt({
        name: '禁用的',
        category: 'chat',
        scene: 'disabled.scene',
        template: 'disabled',
        availableVariables: [],
        enabled: false,
        priority: 0,
        version: '1.0.0',
      })

      const prompt = PromptService.getPromptByScene('disabled.scene')
      expect(prompt).toBeNull()
    })

    it('应该对不存在的场景返回 null', () => {
      const prompt = PromptService.getPromptByScene('non.existent.scene')
      expect(prompt).toBeNull()
    })
  })

  describe('getPromptsByCategory', () => {
    it('应该按分类获取提示词', () => {
      PromptService.addPrompt({
        name: '聊天提示词',
        category: 'chat',
        scene: 'cat.chat',
        template: 'chat',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      PromptService.addPrompt({
        name: '邮件提示词',
        category: 'email',
        scene: 'cat.email',
        template: 'email',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const chatPrompts = PromptService.getPromptsByCategory('chat')
      expect(chatPrompts.some(p => p.scene === 'cat.chat')).toBe(true)
      expect(chatPrompts.some(p => p.scene === 'cat.email')).toBe(false)
    })
  })

  describe('renderPrompt', () => {
    it('应该替换变量', () => {
      const template: PromptTemplate = {
        id: 'test',
        name: '测试',
        category: 'chat',
        scene: 'render.test',
        template: '你好，{{name}}！请帮我{{task}}。',
        availableVariables: [
          { name: 'name', type: 'string', required: true, description: '' },
          { name: 'task', type: 'string', required: true, description: '' },
        ],
        source: { type: 'user' },
        isBuiltin: false,
        enabled: true,
        priority: 0,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const rendered = PromptService.renderPrompt(template, {
        name: 'Alice',
        task: '写一首诗',
      })

      expect(rendered.userPrompt).toBe('你好，Alice！请帮我写一首诗。')
    })

    it('应该使用默认值', () => {
      const template: PromptTemplate = {
        id: 'test',
        name: '测试',
        category: 'chat',
        scene: 'render.default',
        template: '风格：{{style}}',
        availableVariables: [
          { name: 'style', type: 'string', required: false, description: '', defaultValue: '友好' },
        ],
        source: { type: 'user' },
        isBuiltin: false,
        enabled: true,
        priority: 0,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const rendered = PromptService.renderPrompt(template, {})
      expect(rendered.userPrompt).toBe('风格：友好')
    })

    it('应该渲染 systemPrompt', () => {
      const template: PromptTemplate = {
        id: 'test',
        name: '测试',
        category: 'chat',
        scene: 'render.system',
        template: '用户请求',
        systemPrompt: '你是一个{{role}}',
        availableVariables: [
          { name: 'role', type: 'string', required: true, description: '' },
        ],
        source: { type: 'user' },
        isBuiltin: false,
        enabled: true,
        priority: 0,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const rendered = PromptService.renderPrompt(template, { role: '助手' })
      expect(rendered.systemPrompt).toBe('你是一个助手')
    })
  })

  describe('updatePrompt', () => {
    it('应该更新用户提示词', () => {
      const prompt = PromptService.addPrompt({
        name: '原名称',
        category: 'chat',
        scene: 'update.test',
        template: '原模板',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const updated = PromptService.updatePrompt(prompt.id, {
        name: '新名称',
        template: '新模板',
      })

      expect(updated).toBe(true)

      const retrieved = PromptService.getPromptById(prompt.id)
      expect(retrieved?.name).toBe('新名称')
      expect(retrieved?.template).toBe('新模板')
    })

    it('应该对不存在的 ID 返回 false', () => {
      const updated = PromptService.updatePrompt('non-existent-id', { name: 'test' })
      expect(updated).toBe(false)
    })
  })

  describe('deletePrompt', () => {
    it('应该删除用户提示词', () => {
      const prompt = PromptService.addPrompt({
        name: '待删除',
        category: 'chat',
        scene: 'delete.test',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const deleted = PromptService.deletePrompt(prompt.id)
      expect(deleted).toBe(true)

      const retrieved = PromptService.getPromptById(prompt.id)
      expect(retrieved).toBeNull()
    })

    it('应该对不存在的 ID 返回 false', () => {
      const deleted = PromptService.deletePrompt('non-existent-id')
      expect(deleted).toBe(false)
    })
  })

  describe('togglePrompt', () => {
    it('应该切换启用状态', () => {
      const prompt = PromptService.addPrompt({
        name: '测试',
        category: 'chat',
        scene: 'toggle.test',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      expect(PromptService.getPromptById(prompt.id)?.enabled).toBe(true)

      PromptService.togglePrompt(prompt.id)
      expect(PromptService.getPromptById(prompt.id)?.enabled).toBe(false)

      PromptService.togglePrompt(prompt.id)
      expect(PromptService.getPromptById(prompt.id)?.enabled).toBe(true)
    })
  })

  describe('App 提示词管理', () => {
    it('应该注册 App 提示词', () => {
      const appPrompts: AppPromptDefinition[] = [
        {
          scene: 'myapp.greeting',
          name: '问候语',
          category: 'chat',
          template: '生成问候语',
          availableVariables: [],
        },
        {
          scene: 'myapp.farewell',
          name: '告别语',
          category: 'chat',
          template: '生成告别语',
          availableVariables: [],
        },
      ]

      PromptService.registerAppPrompts('my-app', appPrompts)

      const registered = PromptService.getPromptsByApp('my-app')
      expect(registered.length).toBe(2)
      expect(registered[0].source.type).toBe('app')
      expect((registered[0].source as { type: 'app'; appId: string }).appId).toBe('my-app')
    })

    it('应该移除 App 提示词', () => {
      PromptService.registerAppPrompts('test-app', [
        {
          scene: 'test.scene',
          name: '测试',
          category: 'chat',
          template: 'test',
          availableVariables: [],
        },
      ])

      expect(PromptService.getPromptsByApp('test-app').length).toBe(1)

      PromptService.unregisterAppPrompts('test-app')

      expect(PromptService.getPromptsByApp('test-app').length).toBe(0)
    })

    it('重复注册应该覆盖旧的提示词', () => {
      PromptService.registerAppPrompts('test-app', [
        {
          scene: 'test.v1',
          name: '版本1',
          category: 'chat',
          template: 'v1',
          availableVariables: [],
        },
      ])

      PromptService.registerAppPrompts('test-app', [
        {
          scene: 'test.v2',
          name: '版本2',
          category: 'chat',
          template: 'v2',
          availableVariables: [],
        },
      ])

      const prompts = PromptService.getPromptsByApp('test-app')
      expect(prompts.length).toBe(1)
      expect(prompts[0].scene).toBe('test.v2')
    })
  })

  describe('isPromptEditable', () => {
    it('用户提示词应该完全可编辑和删除', () => {
      const prompt = PromptService.addPrompt({
        name: '用户提示词',
        category: 'chat',
        scene: 'edit.user',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const permission = PromptService.isPromptEditable(prompt)
      expect(permission.canEdit).toBe(true)
      expect(permission.editableFields).toContain('*')
      expect(permission.canDelete).toBe(true)
    })

    it('App 提示词应该只能编辑 enabled 和 priority', () => {
      PromptService.registerAppPrompts('test-app', [
        {
          scene: 'test.app',
          name: 'App 提示词',
          category: 'chat',
          template: 'test',
          availableVariables: [],
        },
      ])

      const prompts = PromptService.getPromptsByApp('test-app')
      const permission = PromptService.isPromptEditable(prompts[0])
      
      expect(permission.canEdit).toBe(true)
      expect(permission.editableFields).toContain('enabled')
      expect(permission.editableFields).toContain('priority')
      expect(permission.editableFields).not.toContain('template')
      expect(permission.canDelete).toBe(false)
    })
  })

  describe('全局变量', () => {
    it('应该设置和获取全局变量', () => {
      PromptService.setGlobalVariable('customVar', 'customValue')
      
      const variables = PromptService.getGlobalVariables()
      expect(variables.customVar).toBe('customValue')
    })
  })

  describe('导入导出', () => {
    it('应该导出配置为 JSON', () => {
      PromptService.addPrompt({
        name: '导出测试',
        category: 'chat',
        scene: 'export.test',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const exported = PromptService.exportConfig()
      expect(typeof exported).toBe('string')
      
      const parsed = JSON.parse(exported)
      expect(parsed.templates).toBeDefined()
      expect(Array.isArray(parsed.templates)).toBe(true)
    })

    it('应该导入有效的配置', () => {
      const config: PromptSystemConfig = {
        templates: [],
        globalVariables: { imported: true },
        _meta: {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
        },
      }

      const success = PromptService.importConfig(JSON.stringify(config))
      expect(success).toBe(true)

      const loaded = PromptService.getConfig()
      expect(loaded.globalVariables.imported).toBe(true)
    })

    it('应该拒绝无效的配置', () => {
      const success = PromptService.importConfig('invalid json')
      expect(success).toBe(false)
    })

    it('应该拒绝格式不正确的配置', () => {
      const success = PromptService.importConfig(JSON.stringify({ invalid: true }))
      expect(success).toBe(false)
    })
  })

  describe('searchPrompts', () => {
    it('应该按名称搜索', () => {
      PromptService.addPrompt({
        name: '问候语生成器',
        category: 'chat',
        scene: 'search.1',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      PromptService.addPrompt({
        name: '告别语生成器',
        category: 'chat',
        scene: 'search.2',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const results = PromptService.searchPrompts('问候')
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('问候语生成器')
    })

    it('应该按场景搜索', () => {
      PromptService.addPrompt({
        name: '测试',
        category: 'chat',
        scene: 'greeting.formal',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const results = PromptService.searchPrompts('greeting')
      expect(results.length).toBe(1)
    })
  })

  describe('duplicatePrompt', () => {
    it('应该复制提示词', () => {
      const original = PromptService.addPrompt({
        name: '原始提示词',
        category: 'chat',
        scene: 'dup.original',
        template: '模板内容',
        availableVariables: [],
        enabled: true,
        priority: 5,
        version: '1.0.0',
      })

      const copy = PromptService.duplicatePrompt(original.id)

      expect(copy).not.toBeNull()
      expect(copy?.name).toBe('原始提示词 (副本)')
      expect(copy?.template).toBe('模板内容')
      expect(copy?.id).not.toBe(original.id)
    })

    it('对不存在的 ID 应该返回 null', () => {
      const copy = PromptService.duplicatePrompt('non-existent')
      expect(copy).toBeNull()
    })
  })

  describe('getCategoryStats', () => {
    it('应该统计各分类的提示词数量', () => {
      PromptService.addPrompt({
        name: '聊天1',
        category: 'chat',
        scene: 'stats.chat1',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      PromptService.addPrompt({
        name: '聊天2',
        category: 'chat',
        scene: 'stats.chat2',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      PromptService.addPrompt({
        name: '邮件',
        category: 'email',
        scene: 'stats.email',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      const stats = PromptService.getCategoryStats()
      expect(stats.chat).toBe(2)
      expect(stats.email).toBe(1)
      expect(stats.all).toBe(3)
    })
  })

  describe('getSourceLabel', () => {
    it('应该返回正确的来源标签', () => {
      const userPrompt = PromptService.addPrompt({
        name: '用户',
        category: 'chat',
        scene: 'label.user',
        template: 'test',
        availableVariables: [],
        enabled: true,
        priority: 0,
        version: '1.0.0',
      })

      expect(PromptService.getSourceLabel(userPrompt)).toBe('自定义')

      PromptService.registerAppPrompts('test-app', [
        {
          scene: 'label.app',
          name: 'App',
          category: 'chat',
          template: 'test',
          availableVariables: [],
        },
      ])

      const appPrompts = PromptService.getPromptsByApp('test-app')
      expect(PromptService.getSourceLabel(appPrompts[0])).toBe('App: test-app')
    })
  })

  describe('getAppIdsWithPrompts', () => {
    it('应该返回所有注册了提示词的 App ID', () => {
      PromptService.registerAppPrompts('app-1', [
        { scene: 'a1', name: 'A1', category: 'chat', template: 't', availableVariables: [] },
      ])

      PromptService.registerAppPrompts('app-2', [
        { scene: 'a2', name: 'A2', category: 'chat', template: 't', availableVariables: [] },
      ])

      const appIds = PromptService.getAppIdsWithPrompts()
      expect(appIds).toContain('app-1')
      expect(appIds).toContain('app-2')

      // 清理
      PromptService.unregisterAppPrompts('app-1')
      PromptService.unregisterAppPrompts('app-2')
    })
  })
})
