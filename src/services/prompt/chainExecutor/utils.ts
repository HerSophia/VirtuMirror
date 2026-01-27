/**
 * 链执行器工具函数
 * @description 模板渲染、表达式求值、JSON 解析等通用工具
 */

import type { ChainExecutionContext, ChainStep } from '@/types/promptChain'

/**
 * 根据路径获取对象中的值
 * @param obj 目标对象
 * @param path 路径表达式，如 "step1.result.title" 或 "items[0].name"
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current == null) return undefined

    // 支持数组索引 [0]
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, key, index] = arrayMatch
      current = (current as Record<string, unknown>)[key]
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)]
      } else {
        return undefined
      }
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }

  return current
}

/**
 * 求值表达式
 * 支持简单的路径表达式，如 "step1.result.title" 或 "inputs.name"
 * @param expression 表达式字符串
 * @param context 执行上下文
 */
export function evaluateExpression(
  expression: string,
  context: ChainExecutionContext
): unknown {
  // 去除空白
  expression = expression.trim()

  // 字面量
  if (expression.startsWith('"') && expression.endsWith('"')) {
    return expression.slice(1, -1)
  }
  if (expression.startsWith("'") && expression.endsWith("'")) {
    return expression.slice(1, -1)
  }
  if (expression === 'true') return true
  if (expression === 'false') return false
  if (expression === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(expression)) {
    return parseFloat(expression)
  }

  // 路径表达式
  return getValueByPath(context.variables, expression)
}

/**
 * 求值条件表达式
 * 支持: "step1.result" (truthy), "!step1.error" (falsy), "step1.count > 0"
 * @param condition 条件表达式
 * @param context 执行上下文
 */
export function evaluateCondition(
  condition: string,
  context: ChainExecutionContext
): boolean {
  try {
    // 否定表达式
    if (condition.startsWith('!')) {
      const value = evaluateExpression(condition.slice(1), context)
      return !value
    }

    // 比较表达式
    const compareMatch = condition.match(/^(.+?)\s*(===?|!==?|>=?|<=?|>|<)\s*(.+)$/)
    if (compareMatch) {
      const [, left, op, right] = compareMatch
      const leftValue = evaluateExpression(left, context)
      const rightValue = evaluateExpression(right, context)

      switch (op) {
        case '=':
        case '==':
        case '===':
          return leftValue === rightValue
        case '!=':
        case '!==':
          return leftValue !== rightValue
        case '>':
          return (leftValue as number) > (rightValue as number)
        case '>=':
          return (leftValue as number) >= (rightValue as number)
        case '<':
          return (leftValue as number) < (rightValue as number)
        case '<=':
          return (leftValue as number) <= (rightValue as number)
      }
    }

    // Truthy 判断
    const value = evaluateExpression(condition, context)
    return !!value
  } catch {
    return false
  }
}

/**
 * 渲染模板（简单的变量替换）
 * 支持 {{variable}} 和 {{path.to.value}} 语法
 * @param template 模板字符串
 * @param variables 变量对象
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getValueByPath(variables, path)
    if (value === undefined) return match
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

/**
 * 解析 JSON（容错）
 * 支持从代码块中提取 JSON，或直接解析 {} 和 []
 * @param text 待解析的文本
 */
export function parseJSON(text: string): unknown {
  // 尝试提取 JSON 块
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch) {
    text = jsonBlockMatch[1]
  }

  // 尝试提取 {} 或 []
  const objectMatch = text.match(/\{[\s\S]*\}/)
  const arrayMatch = text.match(/\[[\s\S]*\]/)

  const jsonText = objectMatch?.[0] || arrayMatch?.[0] || text

  return JSON.parse(jsonText)
}

/**
 * 后处理响应
 * @param text 原始响应文本
 * @param config 后处理配置
 */
export function postProcess(
  text: string,
  config: NonNullable<ChainStep['postProcess']>
): unknown {
  try {
    switch (config.parseAs) {
      case 'json':
        const json = parseJSON(text)
        if (config.extract) {
          return getValueByPath(json, config.extract)
        }
        return json

      case 'lines':
        return text.split('\n').filter((line) => line.trim())

      case 'regex':
        if (config.extract) {
          const regex = new RegExp(config.extract)
          const match = text.match(regex)
          return match ? match[1] || match[0] : config.defaultValue
        }
        return text

      case 'text':
      default:
        return text
    }
  } catch {
    return config.defaultValue ?? text
  }
}

/**
 * 计算最终输出
 * @param outputMapping 输出映射配置
 * @param context 执行上下文
 */
export function computeOutputs(
  outputMapping: Record<string, string>,
  context: ChainExecutionContext
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {}

  for (const [key, expression] of Object.entries(outputMapping)) {
    outputs[key] = evaluateExpression(expression, context)
  }

  return outputs
}
