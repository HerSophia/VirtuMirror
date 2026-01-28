/**
 * PromptChainService 单元测试
 * 测试提示词链的 CRUD 操作
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PromptChainService, promptChainService } from '../promptChainService'
import type { PromptChain, ChainStep } from '@/types/promptChain'

// Mock IndexedDB (Dexie)
vi.mock('../../database', () => {
  const chains: Map<string, PromptChain> = new Map()
  const history: Map<string, unknown> = new Map()

  return {
    db: {
      promptChains: {
        toArray: vi.fn(() => Promise.resolve(Array.from(chains.values()))),
        get: vi.fn((id: string) => Promise.resolve(chains.get(id))),
        add: vi.fn((chain: PromptChain) => {
          chains.set(chain.id, chain)
          return Promise.resolve(chain.id)
        }),
        put: vi.fn((chain: PromptChain) => {
          chains.set(chain.id, chain)
          return Promise.resolve(chain.id)
        }),
        delete: vi.fn((id: string) => {
          chains.delete(id)
          return Promise.resolve()
        }),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
        clear: vi.fn(() => {
          chains.clear()
          return Promise.resolve()
        }),
      },
      chainExecutionHistory: {
        add: vi.fn((h: unknown) => {
          history.set((h as { executionId: string }).executionId, h)
          return Promise.resolve()
        }),
        get: vi.fn((id: string) => Promise.resolve(history.get(id))),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            reverse: vi.fn(() => ({
              limit: vi.fn(() => ({
                toArray: vi.fn(() => Promise.resolve([])),
              })),
            })),
          })),
          below: vi.fn(() => ({
            delete: vi.fn(() => Promise.resolve(0)),
          })),
        })),
      },
      // 暴露内部 Map 以便测试清理
      _chains: chains,
      _history: history,
    },
  }
})

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
})

describe('PromptChainService', () => {
  let service: PromptChainService

  beforeEach(async () => {
    service = PromptChainService.getInstance()
    // 清理 App 链
    service.unregisterAppChains('test-app')
    service.unregisterAppChains('my-app')
  })

  afterEach(() => {
    service.unregisterAppChains('test-app')
    service.unregisterAppChains('my-app')
  })

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = PromptChainService.getInstance()
      const instance2 = PromptChainService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('App 链注册', () => {
    it('应该注册 App 链', () => {
      service.registerAppChains('test-app', [
        {
          name: '测试链',
          description: '描述',
          executionMode: 'multi-step',
          inputs: [],
          steps: [],
          outputs: {},
          version: '1.0.0',
          enabled: true,
        },
      ])

      const chains = service.getAppChains('test-app')
      expect(chains.length).toBe(1)
      expect(chains[0].name).toBe('测试链')
      expect(chains[0].source).toBe('app')
      expect(chains[0].appId).toBe('test-app')
    })

    it('应该注销 App 链', () => {
      service.registerAppChains('test-app', [
        {
          name: '链1',
          description: '',
          executionMode: 'multi-step',
          inputs: [],
          steps: [],
          outputs: {},
          version: '1.0.0',
          enabled: true,
        },
      ])

      expect(service.getAppChains('test-app').length).toBe(1)

      service.unregisterAppChains('test-app')

      expect(service.getAppChains('test-app').length).toBe(0)
    })

    it('应该获取所有 App 链', () => {
      service.registerAppChains('app-1', [
        {
          name: '链A',
          description: '',
          executionMode: 'multi-step',
          inputs: [],
          steps: [],
          outputs: {},
          version: '1.0.0',
          enabled: true,
        },
      ])

      service.registerAppChains('app-2', [
        {
          name: '链B',
          description: '',
          executionMode: 'multi-step',
          inputs: [],
          steps: [],
          outputs: {},
          version: '1.0.0',
          enabled: true,
        },
      ])

      const allChains = service.getAllAppChains()
      expect(allChains.length).toBe(2)

      // 清理
      service.unregisterAppChains('app-1')
      service.unregisterAppChains('app-2')
    })

    it('应该获取已注册的 App ID 列表', () => {
      service.registerAppChains('app-x', [
        {
          name: '链',
          description: '',
          executionMode: 'multi-step',
          inputs: [],
          steps: [],
          outputs: {},
          version: '1.0.0',
          enabled: true,
        },
      ])

      const ids = service.getRegisteredAppIds()
      expect(ids).toContain('app-x')

      service.unregisterAppChains('app-x')
    })
  })

  describe('createChain', () => {
    it('应该创建新链', async () => {
      const chain = await service.createChain({
        name: '新建链',
        description: '测试描述',
        executionMode: 'multi-step',
        inputs: [],
        steps: [],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      expect(chain.id).toMatch(/^chain\./)
      expect(chain.name).toBe('新建链')
      expect(chain.createdAt).toBeDefined()
      expect(chain.updatedAt).toBeDefined()
    })
  })

  describe('getChainById', () => {
    it('应该能获取 App 链', async () => {
      service.registerAppChains('test-app', [
        {
          name: 'App链',
          description: '',
          executionMode: 'multi-step',
          inputs: [],
          steps: [],
          outputs: {},
          version: '1.0.0',
          enabled: true,
        },
      ])

      const chains = service.getAppChains('test-app')
      const chainId = chains[0].id

      const retrieved = await service.getChainById(chainId)
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('App链')
    })
  })

  describe('updateChain', () => {
    it('应该更新链', async () => {
      const chain = await service.createChain({
        name: '原名称',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      const updated = await service.updateChain(chain.id, {
        name: '新名称',
        description: '新描述',
      })

      expect(updated).toBe(true)

      const retrieved = await service.getChainById(chain.id)
      expect(retrieved?.name).toBe('新名称')
      expect(retrieved?.description).toBe('新描述')
    })

    it('应该对不存在的链返回 false', async () => {
      const updated = await service.updateChain('non-existent', { name: 'test' })
      expect(updated).toBe(false)
    })
  })

  describe('deleteChain', () => {
    it('应该删除用户链', async () => {
      const chain = await service.createChain({
        name: '待删除',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      const deleted = await service.deleteChain(chain.id)
      expect(deleted).toBe(true)
    })

    it('应该不能删除内置链', async () => {
      const chain = await service.createChain({
        name: '内置链',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [],
        outputs: {},
        source: 'builtin',
        version: '1.0.0',
        enabled: true,
      })

      const deleted = await service.deleteChain(chain.id)
      expect(deleted).toBe(false)
    })
  })

  describe('duplicateChain', () => {
    it('应该复制链', async () => {
      const original = await service.createChain({
        name: '原始链',
        description: '描述',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'prompt',
            inputMapping: {},
            outputKey: 'result',
          },
        ],
        outputs: { final: 'result' },
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      const copy = await service.duplicateChain(original.id)

      expect(copy).not.toBeNull()
      expect(copy?.name).toBe('原始链 (副本)')
      expect(copy?.id).not.toBe(original.id)
      expect(copy?.steps.length).toBe(1)
      expect(copy?.source).toBe('user')
    })

    it('对不存在的链应该返回 null', async () => {
      const copy = await service.duplicateChain('non-existent')
      expect(copy).toBeNull()
    })
  })

  describe('toggleChain', () => {
    it('应该切换启用状态', async () => {
      const chain = await service.createChain({
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      await service.toggleChain(chain.id)
      let retrieved = await service.getChainById(chain.id)
      expect(retrieved?.enabled).toBe(false)

      await service.toggleChain(chain.id)
      retrieved = await service.getChainById(chain.id)
      expect(retrieved?.enabled).toBe(true)
    })
  })

  describe('步骤管理', () => {
    it('应该添加步骤', async () => {
      const chain = await service.createChain({
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      const newStep: ChainStep = {
        id: 'new-step',
        name: '新步骤',
        type: 'prompt',
        inputMapping: {},
        outputKey: 'output',
      }

      await service.addStep(chain.id, newStep)

      const retrieved = await service.getChainById(chain.id)
      expect(retrieved?.steps.length).toBe(1)
      expect(retrieved?.steps[0].name).toBe('新步骤')
    })

    it('应该在指定位置添加步骤', async () => {
      const chain = await service.createChain({
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 's1', name: '步骤1', type: 'prompt', inputMapping: {}, outputKey: 'o1' },
          { id: 's2', name: '步骤2', type: 'prompt', inputMapping: {}, outputKey: 'o2' },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      const newStep: ChainStep = {
        id: 'middle',
        name: '中间步骤',
        type: 'prompt',
        inputMapping: {},
        outputKey: 'om',
      }

      await service.addStep(chain.id, newStep, 1)

      const retrieved = await service.getChainById(chain.id)
      expect(retrieved?.steps[1].name).toBe('中间步骤')
    })

    it('应该更新步骤', async () => {
      const chain = await service.createChain({
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 's1', name: '原名称', type: 'prompt', inputMapping: {}, outputKey: 'o1' },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      await service.updateStep(chain.id, 's1', { name: '新名称' })

      const retrieved = await service.getChainById(chain.id)
      expect(retrieved?.steps[0].name).toBe('新名称')
    })

    it('应该删除步骤', async () => {
      const chain = await service.createChain({
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 's1', name: '步骤1', type: 'prompt', inputMapping: {}, outputKey: 'o1' },
          { id: 's2', name: '步骤2', type: 'prompt', inputMapping: {}, outputKey: 'o2' },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      await service.deleteStep(chain.id, 's1')

      const retrieved = await service.getChainById(chain.id)
      expect(retrieved?.steps.length).toBe(1)
      expect(retrieved?.steps[0].id).toBe('s2')
    })

    it('应该重新排序步骤', async () => {
      const chain = await service.createChain({
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 's1', name: '步骤1', type: 'prompt', inputMapping: {}, outputKey: 'o1' },
          { id: 's2', name: '步骤2', type: 'prompt', inputMapping: {}, outputKey: 'o2' },
          { id: 's3', name: '步骤3', type: 'prompt', inputMapping: {}, outputKey: 'o3' },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      await service.reorderSteps(chain.id, ['s3', 's1', 's2'])

      const retrieved = await service.getChainById(chain.id)
      expect(retrieved?.steps[0].id).toBe('s3')
      expect(retrieved?.steps[1].id).toBe('s1')
      expect(retrieved?.steps[2].id).toBe('s2')
    })
  })

  describe('validateChain', () => {
    it('应该验证有效的链', () => {
      const chain: PromptChain = {
        id: 'test',
        name: '有效链',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'prompt',
            promptId: 'some.prompt',
            inputMapping: {},
            outputKey: 'result',
          },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = service.validateChain(chain)
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('应该检测空名称', () => {
      const chain: PromptChain = {
        id: 'test',
        name: '',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          {
            id: 's1',
            name: '步骤',
            type: 'prompt',
            promptId: 'p',
            inputMapping: {},
            outputKey: 'o',
          },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
        createdAt: '',
        updatedAt: '',
      }

      const result = service.validateChain(chain)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('名称'))).toBe(true)
    })

    it('应该检测空步骤', () => {
      const chain: PromptChain = {
        id: 'test',
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
        createdAt: '',
        updatedAt: '',
      }

      const result = service.validateChain(chain)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('步骤'))).toBe(true)
    })

    it('应该检测重复的步骤 ID', () => {
      const chain: PromptChain = {
        id: 'test',
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 'dup', name: '步骤1', type: 'prompt', promptId: 'p', inputMapping: {}, outputKey: 'o1' },
          { id: 'dup', name: '步骤2', type: 'prompt', promptId: 'p', inputMapping: {}, outputKey: 'o2' },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
        createdAt: '',
        updatedAt: '',
      }

      const result = service.validateChain(chain)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('重复'))).toBe(true)
    })

    it('应该检测 Prompt 步骤缺少 promptId 或 inlineTemplate', () => {
      const chain: PromptChain = {
        id: 'test',
        name: '测试',
        description: '',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 's1', name: '步骤1', type: 'prompt', inputMapping: {}, outputKey: 'o1' },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
        createdAt: '',
        updatedAt: '',
      }

      const result = service.validateChain(chain)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('promptId') || e.includes('inlineTemplate'))).toBe(true)
    })

    it('应该检测单次模式缺少 responseMapping', () => {
      const chain: PromptChain = {
        id: 'test',
        name: '测试',
        description: '',
        executionMode: 'single-shot',
        inputs: [],
        steps: [
          { id: 's1', name: '步骤1', type: 'prompt', promptId: 'p', inputMapping: {}, outputKey: 'o1' },
        ],
        outputs: {},
        source: 'user',
        version: '1.0.0',
        enabled: true,
        createdAt: '',
        updatedAt: '',
      }

      const result = service.validateChain(chain)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('responseMapping'))).toBe(true)
    })
  })

  describe('createEmptyChain / createEmptyStep', () => {
    it('应该创建空白链模板', () => {
      const empty = service.createEmptyChain()

      expect(empty.name).toBe('新建链')
      expect(empty.steps).toEqual([])
      expect(empty.source).toBe('user')
      expect(empty.enabled).toBe(true)
    })

    it('应该创建空白步骤模板', () => {
      const step = service.createEmptyStep('prompt')

      expect(step.id).toMatch(/^step\./)
      expect(step.name).toBe('新步骤')
      expect(step.type).toBe('prompt')
    })

    it('应该创建 transform 类型的步骤', () => {
      const step = service.createEmptyStep('transform')
      expect(step.type).toBe('transform')
    })
  })

  describe('导入导出', () => {
    it('应该导出链为 JSON', async () => {
      const chain = await service.createChain({
        name: '导出测试',
        description: '描述',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 's1', name: '步骤', type: 'prompt', promptId: 'p', inputMapping: {}, outputKey: 'o' },
        ],
        outputs: { result: 'o' },
        source: 'user',
        version: '1.0.0',
        enabled: true,
      })

      const exported = await service.exportChain(chain.id)

      expect(exported).not.toBeNull()
      const parsed = JSON.parse(exported!)
      expect(parsed.name).toBe('导出测试')
      expect(parsed.source).toBe('imported')
    })

    it('应该导入有效的链 JSON', async () => {
      const json = JSON.stringify({
        name: '导入的链',
        description: '描述',
        executionMode: 'multi-step',
        inputs: [],
        steps: [
          { id: 's1', name: '步骤', type: 'prompt', promptId: 'p', inputMapping: {}, outputKey: 'o' },
        ],
        outputs: {},
        version: '1.0.0',
      })

      const imported = await service.importChain(json)

      expect(imported).not.toBeNull()
      expect(imported?.name).toBe('导入的链')
      expect(imported?.source).toBe('imported')
    })

    it('应该拒绝无效的 JSON', async () => {
      const imported = await service.importChain('not valid json')
      expect(imported).toBeNull()
    })

    it('应该拒绝格式不正确的链', async () => {
      const imported = await service.importChain(JSON.stringify({ invalid: true }))
      expect(imported).toBeNull()
    })
  })
})
