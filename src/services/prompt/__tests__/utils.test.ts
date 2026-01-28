/**
 * chainExecutor/utils.ts 单元测试
 * 测试模板渲染、表达式求值、JSON 解析等工具函数
 */

import { describe, it, expect } from 'vitest'
import {
  getValueByPath,
  evaluateExpression,
  evaluateCondition,
  renderTemplate,
  parseJSON,
  postProcess,
  computeOutputs,
} from '../chainExecutor/utils'
import type { ChainExecutionContext } from '@/types/promptChain'

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

describe('getValueByPath', () => {
  it('应该获取简单路径的值', () => {
    const obj = { name: 'test', value: 123 }
    expect(getValueByPath(obj, 'name')).toBe('test')
    expect(getValueByPath(obj, 'value')).toBe(123)
  })

  it('应该获取嵌套路径的值', () => {
    const obj = {
      user: {
        profile: {
          name: 'Alice',
          age: 25,
        },
      },
    }
    expect(getValueByPath(obj, 'user.profile.name')).toBe('Alice')
    expect(getValueByPath(obj, 'user.profile.age')).toBe(25)
  })

  it('应该支持数组索引', () => {
    const obj = {
      items: ['a', 'b', 'c'],
      nested: {
        list: [{ id: 1 }, { id: 2 }],
      },
    }
    expect(getValueByPath(obj, 'items[0]')).toBe('a')
    expect(getValueByPath(obj, 'items[2]')).toBe('c')
    expect(getValueByPath(obj, 'nested.list[1].id')).toBe(2)
  })

  it('应该对不存在的路径返回 undefined', () => {
    const obj = { name: 'test' }
    expect(getValueByPath(obj, 'notExist')).toBeUndefined()
    expect(getValueByPath(obj, 'a.b.c')).toBeUndefined()
    expect(getValueByPath(obj, 'items[0]')).toBeUndefined()
  })

  it('应该处理 null 和 undefined', () => {
    expect(getValueByPath(null, 'name')).toBeUndefined()
    expect(getValueByPath(undefined, 'name')).toBeUndefined()
  })
})

describe('evaluateExpression', () => {
  it('应该解析字符串字面量', () => {
    const context = createContext()
    expect(evaluateExpression('"hello"', context)).toBe('hello')
    expect(evaluateExpression("'world'", context)).toBe('world')
  })

  it('应该解析布尔值', () => {
    const context = createContext()
    expect(evaluateExpression('true', context)).toBe(true)
    expect(evaluateExpression('false', context)).toBe(false)
  })

  it('应该解析 null', () => {
    const context = createContext()
    expect(evaluateExpression('null', context)).toBe(null)
  })

  it('应该解析数字', () => {
    const context = createContext()
    expect(evaluateExpression('42', context)).toBe(42)
    expect(evaluateExpression('-3.14', context)).toBe(-3.14)
    expect(evaluateExpression('0', context)).toBe(0)
  })

  it('应该从上下文获取变量', () => {
    const context = createContext({
      name: 'Alice',
      count: 10,
      nested: { value: 'deep' },
    })
    expect(evaluateExpression('name', context)).toBe('Alice')
    expect(evaluateExpression('count', context)).toBe(10)
    expect(evaluateExpression('nested.value', context)).toBe('deep')
  })

  it('应该处理空白字符', () => {
    const context = createContext({ name: 'test' })
    expect(evaluateExpression('  name  ', context)).toBe('test')
    expect(evaluateExpression('  "hello"  ', context)).toBe('hello')
  })
})

describe('evaluateCondition', () => {
  it('应该评估真值', () => {
    const context = createContext({
      hasValue: true,
      count: 5,
      name: 'test',
    })
    expect(evaluateCondition('hasValue', context)).toBe(true)
    expect(evaluateCondition('count', context)).toBe(true)
    expect(evaluateCondition('name', context)).toBe(true)
  })

  it('应该评估假值', () => {
    const context = createContext({
      isEmpty: false,
      count: 0,
      name: '',
    })
    expect(evaluateCondition('isEmpty', context)).toBe(false)
    expect(evaluateCondition('count', context)).toBe(false)
    expect(evaluateCondition('name', context)).toBe(false)
    expect(evaluateCondition('notExist', context)).toBe(false)
  })

  it('应该支持否定表达式', () => {
    const context = createContext({
      hasError: true,
      isEmpty: false,
    })
    expect(evaluateCondition('!hasError', context)).toBe(false)
    expect(evaluateCondition('!isEmpty', context)).toBe(true)
    expect(evaluateCondition('!notExist', context)).toBe(true)
  })

  it('应该支持相等比较', () => {
    const context = createContext({
      status: 'active',
      count: 10,
    })
    expect(evaluateCondition('status === "active"', context)).toBe(true)
    expect(evaluateCondition('status == "active"', context)).toBe(true)
    // 注意：单个 = 不被支持，正则只匹配 == 或 ===
    expect(evaluateCondition('count === 10', context)).toBe(true)
    expect(evaluateCondition('count === 5', context)).toBe(false)
  })

  it('应该支持不等比较', () => {
    const context = createContext({
      status: 'active',
      count: 10,
    })
    expect(evaluateCondition('status !== "inactive"', context)).toBe(true)
    expect(evaluateCondition('status != "inactive"', context)).toBe(true)
    expect(evaluateCondition('count !== 5', context)).toBe(true)
  })

  it('应该支持数值比较', () => {
    const context = createContext({ count: 10 })
    expect(evaluateCondition('count > 5', context)).toBe(true)
    expect(evaluateCondition('count >= 10', context)).toBe(true)
    expect(evaluateCondition('count < 20', context)).toBe(true)
    expect(evaluateCondition('count <= 10', context)).toBe(true)
    expect(evaluateCondition('count > 15', context)).toBe(false)
  })

  it('应该在异常时返回 false', () => {
    const context = createContext({})
    // 测试一些可能导致异常的表达式
    expect(evaluateCondition('', context)).toBe(false)
  })
})

describe('renderTemplate', () => {
  it('应该替换简单变量', () => {
    const variables = { name: 'Alice', age: 25 }
    expect(renderTemplate('Hello, {{name}}!', variables)).toBe('Hello, Alice!')
    expect(renderTemplate('Age: {{age}}', variables)).toBe('Age: 25')
  })

  it('应该替换嵌套路径变量', () => {
    const variables = {
      user: {
        name: 'Bob',
        profile: { city: 'Beijing' },
      },
    }
    expect(renderTemplate('User: {{user.name}}', variables)).toBe('User: Bob')
    expect(renderTemplate('City: {{user.profile.city}}', variables)).toBe('City: Beijing')
  })

  it('应该保留未找到的变量占位符', () => {
    const variables = { name: 'Alice' }
    expect(renderTemplate('{{name}} - {{unknown}}', variables)).toBe('Alice - {{unknown}}')
  })

  it('应该将对象转为 JSON 字符串', () => {
    const variables = {
      data: { key: 'value' },
      list: [1, 2, 3],
    }
    expect(renderTemplate('Data: {{data}}', variables)).toBe('Data: {"key":"value"}')
    expect(renderTemplate('List: {{list}}', variables)).toBe('List: [1,2,3]')
  })

  it('应该处理多个变量', () => {
    const variables = { first: 'Hello', second: 'World' }
    expect(renderTemplate('{{first}} {{second}}!', variables)).toBe('Hello World!')
  })
})

describe('parseJSON', () => {
  it('应该解析标准 JSON 对象', () => {
    expect(parseJSON('{"name": "test"}')).toEqual({ name: 'test' })
  })

  it('应该解析 JSON 数组', () => {
    expect(parseJSON('[1, 2, 3]')).toEqual([1, 2, 3])
  })

  it('应该从代码块中提取 JSON', () => {
    const text = '```json\n{"key": "value"}\n```'
    expect(parseJSON(text)).toEqual({ key: 'value' })
  })

  it('应该从纯代码块中提取 JSON', () => {
    const text = '```\n{"key": "value"}\n```'
    expect(parseJSON(text)).toEqual({ key: 'value' })
  })

  it('应该从混合文本中提取 JSON 对象', () => {
    const text = 'Some text before {"data": 123} and after'
    expect(parseJSON(text)).toEqual({ data: 123 })
  })

  it('应该从混合文本中提取 JSON 数组', () => {
    const text = 'Result: ["a", "b", "c"]'
    expect(parseJSON(text)).toEqual(['a', 'b', 'c'])
  })

  it('应该在无法解析时抛出错误', () => {
    expect(() => parseJSON('not json')).toThrow()
  })
})

describe('postProcess', () => {
  it('应该解析为 JSON', () => {
    const result = postProcess('{"name": "test"}', { parseAs: 'json' })
    expect(result).toEqual({ name: 'test' })
  })

  it('应该从 JSON 中提取路径', () => {
    const result = postProcess('{"user": {"name": "Alice"}}', {
      parseAs: 'json',
      extract: 'user.name',
    })
    expect(result).toBe('Alice')
  })

  it('应该按行分割', () => {
    const result = postProcess('line1\nline2\n\nline3', { parseAs: 'lines' })
    expect(result).toEqual(['line1', 'line2', 'line3'])
  })

  it('应该使用正则提取', () => {
    const result = postProcess('The answer is 42.', {
      parseAs: 'regex',
      extract: 'answer is (\\d+)',
    })
    expect(result).toBe('42')
  })

  it('应该在正则不匹配时返回默认值', () => {
    const result = postProcess('No match here', {
      parseAs: 'regex',
      extract: 'pattern (\\d+)',
      defaultValue: 'N/A',
    })
    expect(result).toBe('N/A')
  })

  it('应该返回原始文本', () => {
    const result = postProcess('raw text', { parseAs: 'text' })
    expect(result).toBe('raw text')
  })

  it('应该在解析失败时返回默认值', () => {
    const result = postProcess('invalid json', {
      parseAs: 'json',
      defaultValue: { error: true },
    })
    expect(result).toEqual({ error: true })
  })

  it('应该在解析失败且无默认值时返回原文', () => {
    const result = postProcess('invalid json', { parseAs: 'json' })
    expect(result).toBe('invalid json')
  })
})

describe('computeOutputs', () => {
  it('应该计算输出映射', () => {
    const context = createContext({
      step1: { result: 'value1' },
      step2: { data: [1, 2, 3] },
    })

    const outputMapping = {
      output1: 'step1.result',
      output2: 'step2.data',
    }

    const result = computeOutputs(outputMapping, context)

    expect(result).toEqual({
      output1: 'value1',
      output2: [1, 2, 3],
    })
  })

  it('应该处理字面量表达式', () => {
    const context = createContext({})

    const outputMapping = {
      str: '"hello"',
      num: '42',
      bool: 'true',
    }

    const result = computeOutputs(outputMapping, context)

    expect(result).toEqual({
      str: 'hello',
      num: 42,
      bool: true,
    })
  })

  it('应该处理空映射', () => {
    const context = createContext({ data: 'test' })
    const result = computeOutputs({}, context)
    expect(result).toEqual({})
  })
})
