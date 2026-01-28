/**
 * stepExecutors 单元测试
 * 测试各类步骤执行器
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  executePromptStep,
  executeTransformStep,
  executeStep,
  executeLoopStep,
} from '../chainExecutor/stepExecutors'
import type { ChainExecutionContext, ChainStep, PromptChain } from '@/types/promptChain'

// Mock AIGenerateService
vi.mock('../../aiGenerateService', () => ({
  AIGenerateService: {
    generate: vi.fn(() =>
      Promise.resolve({
        success: true,
        text: '{"result": "generated content"}',
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
          name: 'Test Prompt',
          template: 'Hello, {{name}}!',
          availableVariables: [],
        }
      }
      return null
    }),
    getPromptById: vi.fn(() => null),
    renderPrompt: vi.fn((template: { template: string }, variables: Record<string, string>) => ({
      userPrompt: template.template.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => variables[key] || ''),
      systemPrompt: undefined,
    })),
  },
}))

// Mock SystemPromptService
vi.mock('../systemPromptService', () => ({
  SystemPromptService: {
    assemble: vi.fn(() => ({
      systemPrompt: 'System prompt',
      appliedPrompts: [],
    })),
  },
}))

// 创建测试用的上下文
function createContext(variables: Record<string, unknown> = {}): ChainExecutionContext {
  return {
    chainId: 'test-chain',
    executionId: 'test-exec',
    inputs: {},
    variables,
    currentStepIndex: 0,
    startTime: Date.now(),
    aborted: false,
  }
}

// 创建测试用的链
function createChain(): PromptChain {
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
  }
}

describe('executeTransformStep', () => {
  it('应该执行变量转换', () => {
    const context = createContext({
      input: 'hello',
      count: 5,
    })

    const step: ChainStep = {
      id: 'transform1',
      name: '转换步骤',
      type: 'transform',
      inputMapping: {
        result: 'input',
        doubled: 'count',
      },
      outputKey: 'output',
    }

    const result = executeTransformStep(step, context)

    expect(result.status).toBe('completed')
    expect(result.output).toEqual({
      result: 'hello',
      doubled: 5,
    })
  })

  it('应该处理单个输出', () => {
    const context = createContext({ value: 'test' })

    const step: ChainStep = {
      id: 'transform2',
      name: '单输出转换',
      type: 'transform',
      inputMapping: {
        only: 'value',
      },
      outputKey: 'output',
    }

    const result = executeTransformStep(step, context)

    expect(result.status).toBe('completed')
    expect(result.output).toBe('test')
  })

  it('应该处理字面量', () => {
    const context = createContext({})

    const step: ChainStep = {
      id: 'transform3',
      name: '字面量转换',
      type: 'transform',
      inputMapping: {
        str: '"literal"',
        num: '42',
        bool: 'true',
      },
      outputKey: 'output',
    }

    const result = executeTransformStep(step, context)

    expect(result.status).toBe('completed')
    expect(result.output).toEqual({
      str: 'literal',
      num: 42,
      bool: true,
    })
  })

  it('应该返回执行时间', () => {
    const context = createContext({ x: 1 })

    const step: ChainStep = {
      id: 'transform4',
      name: '计时测试',
      type: 'transform',
      inputMapping: { y: 'x' },
      outputKey: 'output',
    }

    const result = executeTransformStep(step, context)

    expect(result.duration).toBeDefined()
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})

describe('executePromptStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该使用内联模板执行', async () => {
    const context = createContext({ name: 'World' })
    const chain = createChain()

    const step: ChainStep = {
      id: 'prompt1',
      name: 'Prompt 步骤',
      type: 'prompt',
      inlineTemplate: 'Hello, {{name}}!',
      inputMapping: {
        name: 'name',
      },
      outputKey: 'greeting',
    }

    const result = await executePromptStep(step, context, chain, {})

    expect(result.status).toBe('completed')
    expect(result.rawResponse).toBeDefined()
  })

  it('应该使用 promptId 执行', async () => {
    const context = createContext({ name: 'Alice' })
    const chain = createChain()

    const step: ChainStep = {
      id: 'prompt2',
      name: 'Prompt 步骤',
      type: 'prompt',
      promptId: 'test.prompt',
      inputMapping: {
        name: 'name',
      },
      outputKey: 'result',
    }

    const result = await executePromptStep(step, context, chain, {})

    expect(result.status).toBe('completed')
  })

  it('应该在找不到 promptId 时失败', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'prompt3',
      name: 'Prompt 步骤',
      type: 'prompt',
      promptId: 'non.existent',
      inputMapping: {},
      outputKey: 'result',
    }

    await expect(executePromptStep(step, context, chain, {})).rejects.toThrow('未找到提示词')
  })

  it('应该在没有 promptId 或 inlineTemplate 时失败', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'prompt4',
      name: 'Prompt 步骤',
      type: 'prompt',
      inputMapping: {},
      outputKey: 'result',
    }

    await expect(executePromptStep(step, context, chain, {})).rejects.toThrow(
      '必须指定 promptId 或 inlineTemplate'
    )
  })

  it('应该应用后处理', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'prompt5',
      name: 'Prompt 步骤',
      type: 'prompt',
      inlineTemplate: 'Generate JSON',
      inputMapping: {},
      outputKey: 'result',
      postProcess: {
        parseAs: 'json',
        extract: 'result',
      },
    }

    const result = await executePromptStep(step, context, chain, {})

    expect(result.status).toBe('completed')
    expect(result.output).toBe('generated content')
  })

  it('应该返回 token 用量', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'prompt6',
      name: 'Prompt 步骤',
      type: 'prompt',
      inlineTemplate: 'Test',
      inputMapping: {},
      outputKey: 'result',
    }

    const result = await executePromptStep(step, context, chain, {})

    expect(result.usage).toBeDefined()
    expect(result.usage?.totalTokens).toBe(30)
  })
})

describe('executeStep', () => {
  it('应该分发到 prompt 执行器', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'step1',
      name: '步骤',
      type: 'prompt',
      inlineTemplate: 'Test',
      inputMapping: {},
      outputKey: 'result',
    }

    const result = await executeStep(step, context, chain, {})
    expect(result.stepId).toBe('step1')
  })

  it('应该分发到 transform 执行器', async () => {
    const context = createContext({ x: 1 })
    const chain = createChain()

    const step: ChainStep = {
      id: 'step2',
      name: '步骤',
      type: 'transform',
      inputMapping: { y: 'x' },
      outputKey: 'result',
    }

    const result = await executeStep(step, context, chain, {})
    expect(result.status).toBe('completed')
  })

  it('应该对不支持的类型抛出错误', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'step3',
      name: '步骤',
      type: 'condition' as ChainStep['type'],
      inputMapping: {},
      outputKey: 'result',
    }

    await expect(executeStep(step, context, chain, {})).rejects.toThrow('不支持的步骤类型')
  })
})

describe('executeLoopStep', () => {
  it('应该遍历数组执行', async () => {
    const context = createContext({
      items: ['a', 'b', 'c'],
    })
    const chain = createChain()

    const step: ChainStep = {
      id: 'loop1',
      name: '循环步骤',
      type: 'transform',
      inputMapping: {
        value: 'item',
        idx: 'index',
      },
      outputKey: 'results',
      loop: {
        type: 'over',
        over: 'items',
        as: 'item',
        indexAs: 'index',
      },
    }

    const result = await executeLoopStep(step, context, chain, {})

    expect(result.status).toBe('completed')
    expect(result.output).toHaveLength(3)
    expect(result.iterations).toHaveLength(3)
  })

  it('应该按次数循环', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'loop2',
      name: '循环步骤',
      type: 'transform',
      inputMapping: {
        iteration: 'index',
      },
      outputKey: 'results',
      loop: {
        type: 'times',
        times: 5,
        indexAs: 'index',
      },
    }

    const result = await executeLoopStep(step, context, chain, {})

    expect(result.status).toBe('completed')
    expect(result.output).toHaveLength(5)
  })

  it('应该限制最大迭代次数', async () => {
    const context = createContext({})
    const chain = createChain()

    const step: ChainStep = {
      id: 'loop3',
      name: '循环步骤',
      type: 'transform',
      inputMapping: { i: 'index' },
      outputKey: 'results',
      loop: {
        type: 'times',
        times: 100,
        maxIterations: 10,
        indexAs: 'index',
      },
    }

    const result = await executeLoopStep(step, context, chain, {})

    expect(result.output).toHaveLength(10)
  })

  it('应该累计 token 用量', async () => {
    const context = createContext({ items: [1, 2] })
    const chain = createChain()

    const step: ChainStep = {
      id: 'loop4',
      name: '循环步骤',
      type: 'prompt',
      inlineTemplate: 'Process {{item}}',
      inputMapping: { item: 'item' },
      outputKey: 'results',
      loop: {
        type: 'over',
        over: 'items',
        as: 'item',
      },
    }

    const result = await executeLoopStep(step, context, chain, {})

    expect(result.usage).toBeDefined()
    // 2 iterations * 30 tokens each
    expect(result.usage?.totalTokens).toBe(60)
  })

  it('应该在非数组上抛出错误', async () => {
    const context = createContext({ notArray: 'string' })
    const chain = createChain()

    const step: ChainStep = {
      id: 'loop5',
      name: '循环步骤',
      type: 'transform',
      inputMapping: {},
      outputKey: 'results',
      loop: {
        type: 'over',
        over: 'notArray',
      },
    }

    await expect(executeLoopStep(step, context, chain, {})).rejects.toThrow('不是数组')
  })

  it('应该支持中止信号', async () => {
    const context = createContext({ items: [1, 2, 3, 4, 5] })
    const chain = createChain()
    const abortController = new AbortController()

    const step: ChainStep = {
      id: 'loop6',
      name: '循环步骤',
      type: 'transform',
      inputMapping: { x: 'item' },
      outputKey: 'results',
      loop: {
        type: 'over',
        over: 'items',
        as: 'item',
      },
    }

    // 立即中止
    abortController.abort()

    const result = await executeLoopStep(step, context, chain, {}, abortController.signal)

    // 应该立即停止，输出为空
    expect(result.output).toHaveLength(0)
  })
})
