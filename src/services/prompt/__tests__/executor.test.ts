/**
 * PromptChainExecutor 单元测试
 * 测试链执行引擎
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptChainExecutor } from '../chainExecutor/executor'
import type { PromptChain, ChainExecutionEvent, ChainStep } from '@/types/promptChain'

// Mock AIGenerateService
vi.mock('../../aiGenerateService', () => ({
  AIGenerateService: {
    generate: vi.fn(() =>
      Promise.resolve({
        success: true,
        text: '{"result": "generated"}',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })
    ),
  },
}))

// Mock PromptService
vi.mock('../promptService', () => ({
  PromptService: {
    getPromptByScene: vi.fn((scene: string) => {
      if (scene === 'test.prompt') {
        return {
          id: 'test.prompt',
          name: 'Test',
          template: '{{input}}',
          availableVariables: [],
        }
      }
      return null
    }),
    getPromptById: vi.fn(() => null),
    renderPrompt: vi.fn((template, variables) => ({
      userPrompt: template.template,
      systemPrompt: undefined,
    })),
  },
}))

// Mock SystemPromptService
vi.mock('../systemPromptService', () => ({
  SystemPromptService: {
    assemble: vi.fn(() => ({
      systemPrompt: '',
      appliedPrompts: [],
    })),
  },
}))

// Mock promptChainService
vi.mock('../promptChainService', () => ({
  promptChainService: {
    saveExecutionHistory: vi.fn(() => Promise.resolve()),
  },
}))

// 创建测试用的链
function createTestChain(overrides: Partial<PromptChain> = {}): PromptChain {
  return {
    id: 'test-chain',
    name: 'Test Chain',
    description: '',
    executionMode: 'multi-step',
    inputs: [],
    steps: [],
    outputs: {},
    source: 'user',
    version: '1.0.0',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('PromptChainExecutor', () => {
  let executor: PromptChainExecutor

  beforeEach(() => {
    vi.clearAllMocks()
    executor = new PromptChainExecutor({ saveHistory: false })
  })

  describe('execute - 多步模式', () => {
    it('应该执行空链', async () => {
      const chain = createTestChain({ steps: [] })

      const result = await executor.execute(chain, {})

      expect(result.status).toBe('completed')
      expect(result.stepResults).toHaveLength(0)
      expect(result.executionMode).toBe('multi-step')
    })

    it('应该执行单步骤链', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'transform',
            inputMapping: { result: '"hello"' },
            outputKey: 'greeting',
          },
        ],
        outputs: { final: 'greeting' },
      })

      const result = await executor.execute(chain, {})

      expect(result.status).toBe('completed')
      expect(result.stepResults).toHaveLength(1)
      expect(result.outputs.final).toBe('hello')
    })

    it('应该执行多步骤链并传递变量', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'transform',
            inputMapping: { value: '10' },
            outputKey: 'num',
          },
          {
            id: 'step2',
            name: '步骤2',
            type: 'transform',
            inputMapping: { doubled: 'num' },
            outputKey: 'result',
          },
        ],
        outputs: { final: 'result' },
      })

      const result = await executor.execute(chain, {})

      expect(result.status).toBe('completed')
      expect(result.stepResults).toHaveLength(2)
      expect(result.outputs.final).toBe(10)
    })

    it('应该跳过条件不满足的步骤', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'transform',
            inputMapping: { value: 'false' },
            outputKey: 'flag',
          },
          {
            id: 'step2',
            name: '条件步骤',
            type: 'transform',
            condition: 'flag',
            inputMapping: { value: '"skipped"' },
            outputKey: 'result',
          },
        ],
      })

      const result = await executor.execute(chain, {})

      expect(result.status).toBe('completed')
      expect(result.stepResults[1].status).toBe('skipped')
    })

    it('应该在步骤失败时停止执行', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '失败步骤',
            type: 'prompt',
            promptId: 'non.existent',
            inputMapping: {},
            outputKey: 'result',
          },
          {
            id: 'step2',
            name: '后续步骤',
            type: 'transform',
            inputMapping: { x: '1' },
            outputKey: 'y',
          },
        ],
      })

      const result = await executor.execute(chain, {})

      expect(result.status).toBe('failed')
      expect(result.stepResults).toHaveLength(1)
    })

    it('应该在 onError=skip 时继续执行', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '失败步骤',
            type: 'prompt',
            promptId: 'non.existent',
            inputMapping: {},
            outputKey: 'result',
            onError: 'skip',
          },
          {
            id: 'step2',
            name: '后续步骤',
            type: 'transform',
            inputMapping: { x: '1' },
            outputKey: 'y',
          },
        ],
      })

      const result = await executor.execute(chain, {})

      expect(result.status).toBe('completed')
      expect(result.stepResults).toHaveLength(2)
      expect(result.stepResults[0].status).toBe('failed')
      expect(result.stepResults[1].status).toBe('completed')
    })
  })

  describe('execute - 单次模式', () => {
    it('应该执行单次模式链', async () => {
      const chain = createTestChain({
        executionMode: 'single-shot',
        steps: [
          {
            id: 'step1',
            name: '任务1',
            type: 'prompt',
            inlineTemplate: 'Task 1',
            inputMapping: {},
            outputKey: 'task1',
          },
        ],
        singleShotConfig: {
          responseMapping: {
            output: 'result',
          },
        },
      })

      const result = await executor.execute(chain, {})

      expect(result.executionMode).toBe('single-shot')
      expect(result.stepResults).toHaveLength(1)
      expect(result.stepResults[0].stepId).toBe('composite')
    })
  })

  describe('事件回调', () => {
    it('应该触发 start 事件', async () => {
      const chain = createTestChain({ steps: [] })
      const events: ChainExecutionEvent[] = []

      await executor.execute(chain, {}, (event) => events.push(event))

      expect(events.some((e) => e.type === 'start')).toBe(true)
    })

    it('应该触发 complete 事件', async () => {
      const chain = createTestChain({ steps: [] })
      const events: ChainExecutionEvent[] = []

      await executor.execute(chain, {}, (event) => events.push(event))

      expect(events.some((e) => e.type === 'complete')).toBe(true)
    })

    it('应该触发 step-start 和 step-complete 事件', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'transform',
            inputMapping: { x: '1' },
            outputKey: 'y',
          },
        ],
      })
      const events: ChainExecutionEvent[] = []

      await executor.execute(chain, {}, (event) => events.push(event))

      expect(events.some((e) => e.type === 'step-start' && e.stepId === 'step1')).toBe(true)
      expect(events.some((e) => e.type === 'step-complete' && e.stepId === 'step1')).toBe(true)
    })

    it('应该在错误时触发 error 事件', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '失败步骤',
            type: 'prompt',
            promptId: 'non.existent',
            inputMapping: {},
            outputKey: 'result',
          },
        ],
      })
      const events: ChainExecutionEvent[] = []

      await executor.execute(chain, {}, (event) => events.push(event))

      expect(events.some((e) => e.type === 'step-error')).toBe(true)
    })

    it('应该在回调出错时不中断执行', async () => {
      const chain = createTestChain({ steps: [] })

      const result = await executor.execute(chain, {}, () => {
        throw new Error('Callback error')
      })

      expect(result.status).toBe('completed')
    })
  })

  describe('abort', () => {
    it('应该能够中止执行', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'transform',
            inputMapping: { x: '1' },
            outputKey: 'y',
          },
          {
            id: 'step2',
            name: '步骤2',
            type: 'transform',
            inputMapping: { x: '2' },
            outputKey: 'z',
          },
        ],
      })

      let executionId = ''
      const resultPromise = executor.execute(chain, {}, (event) => {
        if (event.type === 'start') {
          executionId = event.executionId
        }
        if (event.type === 'step-complete' && event.stepId === 'step1') {
          // 在第一步完成后中止
          executor.abort(executionId)
        }
      })

      const result = await resultPromise

      expect(result.status).toBe('aborted')
    })

    it('abort 不存在的执行应该返回 false', () => {
      const result = executor.abort('non-existent')
      expect(result).toBe(false)
    })

    it('abortAll 应该中止所有执行', () => {
      // 这个测试只验证方法不抛出错误
      expect(() => executor.abortAll()).not.toThrow()
    })
  })

  describe('循环步骤', () => {
    it('应该执行循环步骤', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'loop1',
            name: '循环步骤',
            type: 'transform',
            inputMapping: { value: 'item' },
            outputKey: 'results',
            loop: {
              type: 'over',
              over: 'items',
              as: 'item',
            },
          },
        ],
        outputs: { final: 'results' },
      })

      const result = await executor.execute(chain, { items: [1, 2, 3] })

      expect(result.status).toBe('completed')
      expect(result.outputs.final).toEqual([1, 2, 3])
    })
  })

  describe('Token 用量统计', () => {
    it('应该累计所有步骤的 token 用量', async () => {
      const chain = createTestChain({
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'prompt',
            inlineTemplate: 'Test 1',
            inputMapping: {},
            outputKey: 'r1',
          },
          {
            id: 'step2',
            name: '步骤2',
            type: 'prompt',
            inlineTemplate: 'Test 2',
            inputMapping: {},
            outputKey: 'r2',
          },
        ],
      })

      const result = await executor.execute(chain, {})

      expect(result.totalUsage.totalTokens).toBe(60) // 2 * 30
    })
  })

  describe('配置选项', () => {
    it('应该限制最大步骤数', async () => {
      const limitedExecutor = new PromptChainExecutor({
        maxSteps: 2,
        saveHistory: false,
      })

      const steps: ChainStep[] = []
      for (let i = 0; i < 10; i++) {
        steps.push({
          id: `step${i}`,
          name: `步骤${i}`,
          type: 'transform',
          inputMapping: { x: '1' },
          outputKey: `o${i}`,
        })
      }

      const chain = createTestChain({ steps })

      const result = await limitedExecutor.execute(chain, {})

      expect(result.status).toBe('failed')
      expect(result.error).toContain('超过最大步骤数')
    })

    it('应该支持调试模式', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const debugExecutor = new PromptChainExecutor({
        debug: true,
        saveHistory: false,
      })

      const chain = createTestChain({
        executionMode: 'single-shot',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'prompt',
            inlineTemplate: 'Test',
            inputMapping: {},
            outputKey: 'r1',
          },
        ],
        singleShotConfig: {
          responseMapping: {},
        },
      })

      await debugExecutor.execute(chain, {})

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('输入变量', () => {
    it('应该使用输入变量', async () => {
      const chain = createTestChain({
        inputs: [
          { name: 'name', type: 'string', required: true, description: '' },
        ],
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            type: 'transform',
            inputMapping: { greeting: 'name' },
            outputKey: 'result',
          },
        ],
        outputs: { final: 'result' },
      })

      const result = await executor.execute(chain, { name: 'World' })

      expect(result.status).toBe('completed')
      expect(result.outputs.final).toBe('World')
    })
  })
})
