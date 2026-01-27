/**
 * 步骤执行器
 * @description 各类步骤的具体执行逻辑
 */

import type {
  ChainExecutionContext,
  ChainStep,
  PromptChain,
  StepExecutionResult,
} from '@/types/promptChain'
import { AIGenerateService } from '../../aiGenerateService'
import { PromptService } from '../promptService'
import { SystemPromptService } from '../systemPromptService'
import {
  evaluateExpression,
  renderTemplate,
  postProcess,
} from './utils'

/**
 * 执行器配置（从 executor.ts 复制的接口定义，避免循环导入）
 */
export interface ExecutorConfig {
  /** 默认超时（毫秒） */
  defaultTimeout?: number
  /** 最大步骤数（防止无限循环） */
  maxSteps?: number
  /** 是否保存执行历史 */
  saveHistory?: boolean
  /** 调试模式（输出详细日志） */
  debug?: boolean
  /** 来源 App ID（用于加载 App 级系统提示词） */
  appId?: string
  /** 是否禁用系统提示词注入 */
  disableSystemPrompt?: boolean
}

/**
 * 执行 Prompt 步骤
 */
export async function executePromptStep(
  step: ChainStep,
  context: ChainExecutionContext,
  chain: PromptChain,
  config: ExecutorConfig,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()

  // 解析输入变量
  const variables: Record<string, unknown> = {}
  for (const [key, expression] of Object.entries(step.inputMapping)) {
    variables[key] = evaluateExpression(expression as string, context)
  }

  // 获取提示词模板
  let userPrompt: string
  let systemPrompt: string | undefined = step.systemPrompt

  if (step.inlineTemplate) {
    // 使用内联模板
    userPrompt = renderTemplate(step.inlineTemplate, variables)
  } else if (step.promptId) {
    // 使用提示词服务
    const template =
      PromptService.getPromptByScene(step.promptId) ||
      PromptService.getPromptById(step.promptId)

    if (!template) {
      throw new Error(`未找到提示词: ${step.promptId}`)
    }

    const rendered = PromptService.renderPrompt(template, variables)
    userPrompt = rendered.userPrompt
    systemPrompt = systemPrompt || rendered.systemPrompt
  } else {
    throw new Error('步骤必须指定 promptId 或 inlineTemplate')
  }

  // 组装系统提示词（包含全局和 App 级系统提示词）
  let finalSystemPrompt = systemPrompt

  if (!config.disableSystemPrompt) {
    const assembled = SystemPromptService.assemble({
      appId: config.appId || chain.appId,
      scene: step.promptId,
      baseSystemPrompt: systemPrompt,
    })
    finalSystemPrompt = assembled.systemPrompt || undefined
  }

  // 调用 AI 生成
  const result = await AIGenerateService.generate(
    { userPrompt, systemPrompt: finalSystemPrompt },
    {
      maxTokens: step.provider?.overrides?.maxTokens,
      temperature: step.provider?.overrides?.temperature,
      disableSystemPrompt: true, // 已经在这里组装过了，避免重复
      // TODO: 支持 step.provider.presetId 切换 Provider
    }
  )

  if (!result.success) {
    return {
      stepId: step.id,
      status: 'failed',
      error: result.error,
      rawResponse: result.text,
      duration: Date.now() - startTime,
    }
  }

  // 后处理
  let output: unknown = result.text

  if (step.postProcess) {
    output = postProcess(result.text, step.postProcess)
  }

  return {
    stepId: step.id,
    status: 'completed',
    output,
    rawResponse: result.text,
    usage: result.usage,
    duration: Date.now() - startTime,
  }
}

/**
 * 执行 Transform 步骤
 */
export function executeTransformStep(
  step: ChainStep,
  context: ChainExecutionContext
): StepExecutionResult {
  const startTime = Date.now()

  try {
    // Transform 步骤使用 inputMapping 中的表达式计算输出
    const result: Record<string, unknown> = {}

    for (const [key, expression] of Object.entries(step.inputMapping)) {
      result[key] = evaluateExpression(expression as string, context)
    }

    return {
      stepId: step.id,
      status: 'completed',
      output: Object.keys(result).length === 1 ? Object.values(result)[0] : result,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      stepId: step.id,
      status: 'failed',
      error: error instanceof Error ? error.message : '转换失败',
      duration: Date.now() - startTime,
    }
  }
}

/**
 * 执行单个步骤（根据类型分发）
 */
export async function executeStep(
  step: ChainStep,
  context: ChainExecutionContext,
  chain: PromptChain,
  config: ExecutorConfig,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  if (step.type === 'prompt') {
    return executePromptStep(step, context, chain, config, signal)
  } else if (step.type === 'transform') {
    return executeTransformStep(step, context)
  } else {
    throw new Error(`不支持的步骤类型: ${step.type}`)
  }
}

/**
 * 执行循环步骤
 */
export async function executeLoopStep(
  step: ChainStep,
  context: ChainExecutionContext,
  chain: PromptChain,
  config: ExecutorConfig,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()
  const loop = step.loop!
  const iterations: StepExecutionResult[] = []
  const outputs: unknown[] = []
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  const maxIterations = loop.maxIterations || 50
  let items: unknown[] = []

  if (loop.type === 'over' && loop.over) {
    const value = evaluateExpression(loop.over, context)
    if (Array.isArray(value)) {
      items = value
    } else {
      throw new Error(`循环目标不是数组: ${loop.over}`)
    }
  } else if (loop.type === 'times' && loop.times) {
    items = Array.from({ length: Math.min(loop.times, maxIterations) }, (_, i) => i)
  }

  // 限制迭代次数
  items = items.slice(0, maxIterations)

  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) break

    // 创建迭代上下文
    const iterContext: ChainExecutionContext = {
      ...context,
      variables: {
        ...context.variables,
        [loop.as || 'item']: items[i],
        [loop.indexAs || 'index']: i,
      },
    }

    // 执行步骤（不带循环配置）
    const iterStep = { ...step, loop: undefined }
    const iterResult = await executeStep(iterStep, iterContext, chain, config, signal)

    iterations.push(iterResult)

    if (iterResult.status === 'completed') {
      outputs.push(iterResult.output)
    }

    if (iterResult.usage) {
      totalUsage.promptTokens += iterResult.usage.promptTokens
      totalUsage.completionTokens += iterResult.usage.completionTokens
      totalUsage.totalTokens += iterResult.usage.totalTokens
    }

    // 如果迭代失败且不是跳过策略，终止循环
    if (iterResult.status === 'failed' && step.onError !== 'skip') {
      break
    }
  }

  const allCompleted = iterations.every(
    (r) => r.status === 'completed' || r.status === 'skipped'
  )

  return {
    stepId: step.id,
    status: allCompleted ? 'completed' : 'failed',
    output: outputs,
    usage: totalUsage,
    duration: Date.now() - startTime,
    iterations,
  }
}
