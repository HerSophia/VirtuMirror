/**
 * 提示词链执行引擎
 * @description 负责执行提示词链，支持多步模式和单次模式
 */

import type {
  ChainExecutionCallback,
  ChainExecutionContext,
  ChainExecutionEvent,
  ChainExecutionHistory,
  ChainExecutionResult,
  ChainExecutionStatus,
  PromptChain,
  StepExecutionResult,
} from '@/types/promptChain'
import { AIGenerateService } from '../../aiGenerateService'
import { PromptService } from '../promptService'
import { promptChainService } from '../promptChainService'
import {
  evaluateExpression,
  evaluateCondition,
  renderTemplate,
  parseJSON,
  getValueByPath,
  computeOutputs,
} from './utils'
import {
  executeStep,
  executeLoopStep,
  type ExecutorConfig,
} from './stepExecutors'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('service:promptChainExecutor')

// 重新导出 ExecutorConfig 类型
export type { ExecutorConfig }

const DEFAULT_CONFIG: ExecutorConfig = {
  defaultTimeout: 60000,
  maxSteps: 100,
  saveHistory: true,
  debug: false,
  appId: undefined,
  disableSystemPrompt: false,
}

/**
 * 提示词链执行器
 */
export class PromptChainExecutor {
  private config: ExecutorConfig
  private abortControllers: Map<string, AbortController> = new Map()

  constructor(config: ExecutorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 执行链
   */
  async execute(
    chain: PromptChain,
    inputs: Record<string, unknown>,
    callback?: ChainExecutionCallback
  ): Promise<ChainExecutionResult> {
    const executionId = `exec.${crypto.randomUUID()}`
    const abortController = new AbortController()
    this.abortControllers.set(executionId, abortController)

    // 初始化上下文
    const context: ChainExecutionContext = {
      chainId: chain.id,
      executionId,
      inputs,
      variables: { ...inputs },
      currentStepIndex: 0,
      startTime: Date.now(),
      aborted: false,
    }

    // 发送开始事件
    this.emit(callback, {
      type: 'start',
      executionId,
      chainId: chain.id,
      timestamp: Date.now(),
    })

    try {
      let result: ChainExecutionResult

      if (chain.executionMode === 'single-shot') {
        result = await this.executeSingleShot(chain, context, callback, abortController.signal)
      } else {
        result = await this.executeMultiStep(chain, context, callback, abortController.signal)
      }

      // 保存执行历史
      if (this.config.saveHistory) {
        await this.saveHistory(chain, result)
      }

      // 发送完成事件
      this.emit(callback, {
        type: 'complete',
        executionId,
        chainId: chain.id,
        data: result,
        timestamp: Date.now(),
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      this.emit(callback, {
        type: 'error',
        executionId,
        chainId: chain.id,
        error: errorMessage,
        timestamp: Date.now(),
      })

      return {
        executionId,
        chainId: chain.id,
        status: 'failed',
        outputs: {},
        stepResults: [],
        error: errorMessage,
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalDuration: Date.now() - context.startTime,
        executionMode: chain.executionMode,
      }
    } finally {
      this.abortControllers.delete(executionId)
    }
  }

  /**
   * 中止执行
   */
  abort(executionId: string): boolean {
    const controller = this.abortControllers.get(executionId)
    if (controller) {
      controller.abort()
      return true
    }
    return false
  }

  /**
   * 中止所有执行
   */
  abortAll(): void {
    this.abortControllers.forEach((controller) => controller.abort())
    this.abortControllers.clear()
  }

  // ==================== 多步模式执行 ====================

  private async executeMultiStep(
    chain: PromptChain,
    context: ChainExecutionContext,
    callback?: ChainExecutionCallback,
    signal?: AbortSignal
  ): Promise<ChainExecutionResult> {
    const stepResults: StepExecutionResult[] = []
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let status: ChainExecutionStatus = 'running'

    for (let i = 0; i < chain.steps.length; i++) {
      // 检查是否中止
      if (signal?.aborted) {
        context.aborted = true
        status = 'aborted'
        break
      }

      // 防止无限循环
      const maxSteps = this.config.maxSteps ?? 100
      if (i >= maxSteps) {
        throw new Error(`超过最大步骤数限制: ${maxSteps}`)
      }

      const step = chain.steps[i]
      context.currentStepIndex = i

      // 发送步骤开始事件
      this.emit(callback, {
        type: 'step-start',
        executionId: context.executionId,
        chainId: chain.id,
        stepId: step.id,
        stepIndex: i,
        timestamp: Date.now(),
      })

      try {
        // 检查条件
        if (step.condition && !evaluateCondition(step.condition, context)) {
          const skipResult: StepExecutionResult = {
            stepId: step.id,
            status: 'skipped',
          }
          stepResults.push(skipResult)

          this.emit(callback, {
            type: 'step-complete',
            executionId: context.executionId,
            chainId: chain.id,
            stepId: step.id,
            stepIndex: i,
            data: skipResult,
            timestamp: Date.now(),
          })

          continue
        }

        // 执行步骤
        let stepResult: StepExecutionResult

        if (step.loop) {
          stepResult = await executeLoopStep(step, context, chain, this.config, signal)
        } else {
          stepResult = await executeStep(step, context, chain, this.config, signal)
        }

        stepResults.push(stepResult)

        // 累加 token 用量
        if (stepResult.usage) {
          totalUsage.promptTokens += stepResult.usage.promptTokens
          totalUsage.completionTokens += stepResult.usage.completionTokens
          totalUsage.totalTokens += stepResult.usage.totalTokens
        }

        // 将输出存入上下文
        if (stepResult.status === 'completed' && step.outputKey) {
          context.variables[step.outputKey] = stepResult.output
        }

        // 发送步骤完成事件
        this.emit(callback, {
          type: 'step-complete',
          executionId: context.executionId,
          chainId: chain.id,
          stepId: step.id,
          stepIndex: i,
          data: stepResult,
          timestamp: Date.now(),
        })

        // 如果步骤失败且不是跳过策略，终止执行
        if (stepResult.status === 'failed' && step.onError !== 'skip') {
          status = 'failed'
          break
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '步骤执行失败'

        const failedResult: StepExecutionResult = {
          stepId: step.id,
          status: 'failed',
          error: errorMessage,
        }
        stepResults.push(failedResult)

        this.emit(callback, {
          type: 'step-error',
          executionId: context.executionId,
          chainId: chain.id,
          stepId: step.id,
          stepIndex: i,
          error: errorMessage,
          timestamp: Date.now(),
        })

        if (step.onError !== 'skip') {
          status = 'failed'
          break
        }
      }
    }

    // 确定最终状态
    if (status === 'running') {
      status = 'completed'
    }

    // 计算输出
    const outputs = computeOutputs(chain.outputs, context)

    return {
      executionId: context.executionId,
      chainId: chain.id,
      status,
      outputs,
      stepResults,
      totalUsage,
      totalDuration: Date.now() - context.startTime,
      executionMode: 'multi-step',
    }
  }

  // ==================== 单次模式执行 ====================

  private async executeSingleShot(
    chain: PromptChain,
    context: ChainExecutionContext,
    callback?: ChainExecutionCallback,
    signal?: AbortSignal
  ): Promise<ChainExecutionResult> {
    const startTime = Date.now()

    // 组装复合提示词
    const compositePrompt = this.composePrompt(chain, context)

    if (this.config.debug) {
      logger.debug('组装后的提示词:', compositePrompt)
    }

    // 单次调用 LLM
    const result = await AIGenerateService.generate(
      { userPrompt: compositePrompt },
      {
        maxTokens: chain.singleShotConfig?.maxTokens || 4096,
      }
    )

    if (!result.success) {
      return {
        executionId: context.executionId,
        chainId: chain.id,
        status: 'failed',
        outputs: {},
        stepResults: [],
        error: result.error,
        totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalDuration: Date.now() - startTime,
        executionMode: 'single-shot',
      }
    }

    // 解析响应
    let parsedOutputs: Record<string, unknown> = {}

    try {
      const jsonResponse = parseJSON(result.text)

      if (chain.singleShotConfig?.responseMapping) {
        for (const [key, path] of Object.entries(chain.singleShotConfig.responseMapping)) {
          parsedOutputs[key] = getValueByPath(jsonResponse, path as string)
        }
      } else if (jsonResponse && typeof jsonResponse === 'object' && !Array.isArray(jsonResponse)) {
        parsedOutputs = jsonResponse as Record<string, unknown>
      } else {
        parsedOutputs = { result: jsonResponse }
      }
    } catch (error) {
      return {
        executionId: context.executionId,
        chainId: chain.id,
        status: 'failed',
        outputs: {},
        stepResults: [
          {
            stepId: 'composite',
            status: 'failed',
            rawResponse: result.text,
            error: '响应解析失败',
          },
        ],
        error: '响应 JSON 解析失败',
        totalUsage: result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalDuration: Date.now() - startTime,
        executionMode: 'single-shot',
      }
    }

    return {
      executionId: context.executionId,
      chainId: chain.id,
      status: 'completed',
      outputs: parsedOutputs,
      stepResults: [
        {
          stepId: 'composite',
          status: 'completed',
          output: parsedOutputs,
          rawResponse: result.text,
          usage: result.usage,
          duration: Date.now() - startTime,
        },
      ],
      totalUsage: result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      totalDuration: Date.now() - startTime,
      executionMode: 'single-shot',
    }
  }

  /**
   * 组装单次模式的复合提示词
   */
  private composePrompt(chain: PromptChain, context: ChainExecutionContext): string {
    // 使用自定义模板
    if (chain.singleShotConfig?.compositeTemplate) {
      return renderTemplate(chain.singleShotConfig.compositeTemplate, context.variables)
    }

    // 自动组装
    const sections: string[] = []

    sections.push('你需要完成以下多个任务，并将所有结果以 JSON 格式一次性返回。\n')

    chain.steps.forEach((step, index) => {
      if (step.type !== 'prompt') return

      // 解析变量
      const variables: Record<string, unknown> = {}
      for (const [key, expression] of Object.entries(step.inputMapping)) {
        variables[key] = evaluateExpression(expression as string, context)
      }

      let taskContent = ''

      if (step.inlineTemplate) {
        taskContent = renderTemplate(step.inlineTemplate, variables)
      } else if (step.promptId) {
        const template =
          PromptService.getPromptByScene(step.promptId) ||
          PromptService.getPromptById(step.promptId)

        if (template) {
          const rendered = PromptService.renderPrompt(template, variables)
          taskContent = rendered.userPrompt
        }
      }

      if (taskContent) {
        sections.push(`## 任务 ${index + 1}: ${step.name}`)
        sections.push(taskContent)
        sections.push('')
      }
    })

    // 生成输出 Schema
    const outputSchema = this.generateOutputSchema(chain)
    sections.push('---')
    sections.push('请严格按照以下 JSON 格式返回（不要包含其他内容）：')
    sections.push('```json')
    sections.push(outputSchema)
    sections.push('```')

    return sections.join('\n')
  }

  /**
   * 生成输出 Schema
   */
  private generateOutputSchema(chain: PromptChain): string {
    const schema: Record<string, string> = {}

    chain.steps.forEach((step) => {
      if (step.type === 'prompt' && step.outputKey) {
        schema[step.outputKey] = `<${step.name}的结果>`
      }
    })

    return JSON.stringify(schema, null, 2)
  }

  // ==================== 工具方法 ====================

  /**
   * 发送事件
   */
  private emit(callback: ChainExecutionCallback | undefined, event: ChainExecutionEvent): void {
    if (callback) {
      try {
        callback(event)
      } catch (error) {
        logger.error('事件回调错误:', error)
      }
    }
  }

  /**
   * 保存执行历史
   */
  private async saveHistory(chain: PromptChain, result: ChainExecutionResult): Promise<void> {
    try {
      const history: ChainExecutionHistory = {
        executionId: result.executionId,
        chainId: chain.id,
        chainName: chain.name,
        status: result.status,
        inputs: {}, // 可选：保存输入
        outputs: result.outputs,
        totalUsage: result.totalUsage,
        totalDuration: result.totalDuration,
        executedAt: Date.now(),
        error: result.error,
      }

      await promptChainService.saveExecutionHistory(history)
    } catch (error) {
      logger.error('保存历史失败:', error)
    }
  }
}

// 默认执行器实例
export const promptChainExecutor = new PromptChainExecutor()
