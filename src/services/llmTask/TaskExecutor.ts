/**
 * 任务执行器
 * 处理 L的执行流程
 */

import type { TokenUsage } from '@/services/ai/types'
import { promptChainExecutor } from '@/services/prompt'
import { promptChainService } from '@/services/prompt/promptChainService'
import { PromptService } from '@/services/prompt/promptService'
import { useAIStore } from '@/stores/aiStore'
import type { ChainExecutionEvent, ChainExecutionResult } from '@/types/promptChain'

import type {
  ExecutionResult,
  LLMTask,
  LLMTaskDefinition,
  LLMTaskStatus,
  OutputHandlerResult,
  TaskExecutionContext,
  TaskLog,
} from './types'

import { sharedContextProvider } from './builtinProviders'
import { getContextProviderRegistry } from './ContextProviderRegistry'
import { getOutputHandlerRegistry } from './OutputHandlerRegistry'
import { getTaskRegistry } from './TaskRegistry'
import { getTimeContextVariables, getVariableResolver } from './VariableResolver'

// ==================== 类型定义 ====================

/** 执行器上下文 */
export interface ExecutorContext {
  /** 获取任务 */
  getTask: (id: string) => LLMTask | undefined
  /** 更新任务 */
  updateTask: (id: string, updates: Partial<LLMTask>) => boolean
  /** 添加日志 */
  addLog: (taskId: string, level: TaskLog['level'], message: string, data?: unknown) => void
  /** 获取任务日志 */
  getTaskLogs: (taskId: string) => TaskLog[]
  /** 安排下次执行（自动任务） */
  scheduleNextExecution: (taskId: string) => void
  /** 获取服务（依赖注入） */
  getService?: <T>(serviceId: string) => T | undefined
}

/** 内部执行结果 */
interface InternalExecutionResult {
  text: string
  usage?: TokenUsage
  chainResult?: ChainExecutionResult
}

// ==================== 执行器实现 ====================

/**
 * 任务执行器
 * 负责执行 LLM 任务、变量替换、调用 AI 服务、处理输出
 */
export class TaskExecutor {
  private context: ExecutorContext | null = null

  /**
   * 初始化执行器
   */
  initialize(context: ExecutorContext): void {
    this.context = context
    console.log('[TaskExecutor] 执行器已初始化')
  }

  /**
   * 执行任务
   * @param taskId 任务 ID
   */
  async execute(taskId: string): Promise<ExecutionResult> {
    if (!this.context) {
      return {
        success: false,
        error: '执行器未初始化',
        duration: 0,
      }
    }

    const task = this.context.getTask(taskId)
    if (!task) {
      return {
        success: false,
        error: '任务不存在',
        duration: 0,
      }
    }

    if (task.status === 'running') {
      this.context.addLog(taskId, 'warn', '任务已在运行中')
      return {
        success: false,
        error: '任务已在运行中',
        duration: 0,
      }
    }

    const startTime = Date.now()

    // 更新状态为运行中
    this.context.updateTask(taskId, {
      status: 'running',
      startedAt: startTime,
      error: undefined,
    })
    this.context.addLog(taskId, 'info', '任务开始执行')
    this.context.addLog(
      taskId,
      'info',
      `配置来源: ${task.config.source}${task.config.presetName ? ` (${task.config.presetName})` : ''}`
    )

    try {
      // 获取任务定义
      const definition = getTaskRegistry().get(task.definitionId)
      if (!definition) {
        throw new Error(`找不到任务定义: ${task.definitionId}`)
      }

      // 1. 收集上下文变量
      const contextVariables = await this.collectContextVariables(task, definition)

      // 2. 构建提示词
      const prompt = await this.buildPrompt(task, definition, contextVariables)

      // 3. 执行 LLM 调用
      const result = await this.executeLLMCall(task, definition, prompt)

      // 4. 处理输出
      const handlerResult = await this.handleOutput(task, definition, result.text)

      // 5. 更新任务状态
      const completedAt = Date.now()
      const duration = completedAt - startTime

      // 根据执行模式设置状态
      let newStatus: LLMTaskStatus
      switch (task.executionMode) {
        case 'once':
          newStatus = 'completed'
          break
        case 'repeatable':
        case 'auto':
          newStatus = 'pending'
          break
        default:
          newStatus = 'completed'
      }

      // 保存输出历史
      const outputHistory = [...(task.outputHistory || [])]
      if (task.executionMode !== 'once') {
        outputHistory.unshift({
          timestamp: completedAt,
          output: result.text,
          usage: result.usage,
          chainResult: result.chainResult
            ? {
                outputs: result.chainResult.outputs,
                stepResults: result.chainResult.stepResults.map((s) => ({
                  stepId: s.stepId,
                  status: s.status,
                  output: s.output,
                  error: s.error,
                })),
              }
            : undefined,
        })
        // 限制历史记录数量
        if (outputHistory.length > 20) {
          outputHistory.pop()
        }
      }

      // 更新任务
      this.context.updateTask(taskId, {
        status: newStatus,
        output: result.text,
        outputHistory,
        chainResult: result.chainResult
          ? {
              outputs: result.chainResult.outputs,
              stepResults: result.chainResult.stepResults.map((s) => ({
                stepId: s.stepId,
                status: s.status,
                output: s.output,
                error: s.error,
              })),
            }
          : undefined,
        completedAt,
        duration,
        usage: result.usage,
        totalExecutions: (task.totalExecutions || 0) + 1,
        retryCount: 0,
      })

      // 更新自动执行配置
      if (task.autoConfig) {
        this.context.updateTask(taskId, {
          autoConfig: {
            ...task.autoConfig,
            executionCount: (task.autoConfig.executionCount || 0) + 1,
            lastExecutionAt: completedAt,
          },
        })
      }

      this.context.addLog(
        taskId,
        'info',
        `任务完成，使用 ${result.usage?.totalTokens || 0} tokens，` +
          `总执行次数: ${(task.totalExecutions || 0) + 1}`
      )

      // 如果是自动任务，安排下次执行
      if (task.executionMode === 'auto' && task.autoConfig?.enabled) {
        this.context.scheduleNextExecution(taskId)
      }

      return {
        success: true,
        output: result.text,
        usage: result.usage,
        chainResult: result.chainResult,
        handlerResult,
        duration,
      }
    } catch (error: unknown) {
      return this.handleError(taskId, error, task, startTime)
    }
  }

  /**
   * 收集上下文变量
   */
  private async collectContextVariables(
    task: LLMTask,
    definition: LLMTaskDefinition
  ): Promise<Record<string, string>> {
    const providerIds = definition.contextProviders || []
    const contextRegistry = getContextProviderRegistry()

    // 1. 获取时间上下文（最低优先级）
    const timeVars = getTimeContextVariables()

    // 2. 获取常规上下文提供器的变量
    const contextVars = await contextRegistry.getContext(providerIds)

    // 3. 处理共享上下文配置（新增）
    let sharedContextVars: Record<string, string> = {}
    if (definition.sharedContextConfig) {
      this.context?.addLog(
        task.id,
        'info',
        `正在获取共享上下文 (类型: ${definition.sharedContextConfig.types?.join(', ') || '全部'})`
      )
      sharedContextVars = await sharedContextProvider.getContext({
        config: definition.sharedContextConfig,
        appId: task.appId,
        taskId: task.id,
      })
      this.context?.addLog(
        task.id,
        'info',
        `共享上下文已获取，变量名: ${definition.sharedContextConfig.variableName || 'sharedContext'}`
      )
    }

    // 合并（后面的优先级更高）
    return {
      ...timeVars,
      ...contextVars,
      ...sharedContextVars,
    }
  }

  /**
   * 构建最终提示词
   */
  private async buildPrompt(
    task: LLMTask,
    definition: LLMTaskDefinition,
    contextVariables: Record<string, string>
  ): Promise<string> {
    const resolver = getVariableResolver()

    // 合并用户输入和上下文变量
    const allVariables: Record<string, unknown> = {
      ...contextVariables,
      ...task.input,
    }

    // 特殊处理时间上下文
    if (allVariables['timeContext'] === '当前时间' || allVariables['timeContext'] === '') {
      allVariables['timeContext'] = contextVariables['fullDateTime'] || ''
    }

    let prompt = ''

    if (task.type === 'manual') {
      // 使用定义中的模板或任务实例中的
      const template = definition.promptTemplate || ''
      prompt = resolver.resolve(template, allVariables)
    } else if (task.type === 'prompt') {
      // 注册提示词类型，返回占位符（实际渲染在执行时）
      prompt = `[Prompt: ${definition.promptId}] with vars: ${JSON.stringify(allVariables)}`
    } else if (task.type === 'chain') {
      prompt = `[Chain: ${definition.chainId}]`
    }

    // 更新任务的解析后提示词
    this.context?.updateTask(task.id, { resolvedPrompt: prompt })

    return prompt
  }

  /**
   * 执行 LLM 调用
   */
  private async executeLLMCall(
    task: LLMTask,
    definition: LLMTaskDefinition,
    prompt: string
  ): Promise<InternalExecutionResult> {
    const aiStore = useAIStore()

    // 确保 AIStore 已初始化
    if (!aiStore.initialized) {
      await aiStore.initialize()
    }

    if (task.type === 'chain' && definition.chainId) {
      return this.executeChain(task, definition)
    } else if (task.type === 'prompt' && definition.promptId) {
      return this.executePrompt(task, definition)
    } else {
      return this.executeManual(task, definition, prompt)
    }
  }

  /**
   * 执行提示词链
   */
  private async executeChain(
    task: LLMTask,
    definition: LLMTaskDefinition
  ): Promise<InternalExecutionResult> {
    this.context?.addLog(task.id, 'info', `执行提示词链: ${definition.chainId}`)

    const chain = await promptChainService.getChainById(definition.chainId!)
    if (!chain) {
      throw new Error(`找不到链定义: ${definition.chainId}`)
    }

    // 准备输入变量
    const chainInputs = { ...task.input }

    // 执行链
    const executionResult = await promptChainExecutor.execute(
      chain,
      chainInputs as Record<string, string>,
      (event: ChainExecutionEvent) => {
        const stepNum = event.stepIndex !== undefined ? event.stepIndex + 1 : '?'
        if (event.type === 'step-start') {
          this.context?.addLog(task.id, 'info', `[步骤 ${stepNum}] 开始: ${event.stepId}`)
        } else if (event.type === 'step-complete') {
          this.context?.addLog(task.id, 'info', `[步骤 ${stepNum}] 完成: ${event.stepId}`)
        } else if (event.type === 'step-error') {
          this.context?.addLog(task.id, 'error', `[步骤 ${stepNum}] 失败: ${event.error}`)
        }
      }
    )

    if (executionResult.status === 'failed') {
      throw new Error(executionResult.error || '链执行失败')
    }

    return {
      text: JSON.stringify(executionResult.outputs, null, 2),
      usage: executionResult.totalUsage,
      chainResult: executionResult,
    }
  }

  /**
   * 执行注册提示词
   */
  private async executePrompt(
    task: LLMTask,
    definition: LLMTaskDefinition
  ): Promise<InternalExecutionResult> {
    this.context?.addLog(task.id, 'info', `执行注册提示词: ${definition.promptId}`)

    const promptDef = PromptService.getPromptByScene(definition.promptId!)
    if (!promptDef) {
      throw new Error(`找不到提示词定义: ${definition.promptId}`)
    }

    // 渲染提示词
    const rendered = PromptService.renderPrompt(promptDef, task.input as Record<string, string>)

    // 执行生成
    const aiStore = useAIStore()
    const result = await aiStore.generate(
      {
        prompt: rendered.userPrompt,
        system: rendered.systemPrompt || task.systemPrompt,
        temperature: task.config.temperature,
        maxTokens: task.config.maxTokens,
        topP: task.config.topP,
        frequencyPenalty: task.config.frequencyPenalty,
        presencePenalty: task.config.presencePenalty,
        source: `llm-task-${task.id}`,
        appId: task.appId,
        scene: definition.promptId,
      },
      task.priority
    )

    return { text: result.text, usage: result.usage }
  }

  /**
   * 执行手动提示词
   */
  private async executeManual(
    task: LLMTask,
    definition: LLMTaskDefinition,
    prompt: string
  ): Promise<InternalExecutionResult> {
    this.context?.addLog(task.id, 'info', '执行手动提示词')

    const aiStore = useAIStore()
    const result = await aiStore.generate(
      {
        prompt,
        system: definition.systemPrompt || task.systemPrompt,
        temperature: task.config.temperature,
        maxTokens: task.config.maxTokens,
        topP: task.config.topP,
        frequencyPenalty: task.config.frequencyPenalty,
        presencePenalty: task.config.presencePenalty,
        source: `llm-task-${task.id}`,
        appId: task.appId,
        scene: task.definitionId,
      },
      task.priority
    )

    return { text: result.text, usage: result.usage }
  }

  /**
   * 处理输出
   */
  private async handleOutput(
    task: LLMTask,
    definition: LLMTaskDefinition,
    output: string
  ): Promise<OutputHandlerResult | undefined> {
    const handlerRegistry = getOutputHandlerRegistry()
    const handler = handlerRegistry.get(definition.outputHandlerId)

    if (!handler) {
      this.context?.addLog(task.id, 'warn', `找不到输出处理器: ${definition.outputHandlerId}`)
      return undefined
    }

    // 创建执行上下文
    const executionContext: TaskExecutionContext = {
      taskId: task.id,
      appId: task.appId,
      variables: task.input,
      addLog: (level, message, data) => {
        this.context?.addLog(task.id, level, message, data)
      },
      getService: this.context?.getService || (() => undefined),
    }

    try {
      const result = await handler.handle(output, task, executionContext)

      if (result.success) {
        this.context?.addLog(
          task.id,
          'info',
          `输出处理成功${result.recordsCreated ? `，创建 ${result.recordsCreated} 条记录` : ''}`
        )
      } else {
        this.context?.addLog(task.id, 'error', `输出处理失败: ${result.error}`)
      }

      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.context?.addLog(task.id, 'error', `输出处理器异常: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 处理执行错误
   */
  private handleError(
    taskId: string,
    error: unknown,
    task: LLMTask,
    startTime: number
  ): ExecutionResult {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const duration = Date.now() - startTime

    this.context?.addLog(taskId, 'error', `任务失败: ${errorMessage}`)

    // 判断是否重试
    if (task.retryCount < task.maxRetries && this.isRetryableError(error)) {
      this.context?.updateTask(taskId, {
        status: 'pending',
        retryCount: task.retryCount + 1,
      })
      this.context?.addLog(taskId, 'info', `准备重试 (${task.retryCount + 1}/${task.maxRetries})`)

      // 延迟重试
      setTimeout(
        () => {
          this.execute(taskId)
        },
        2000 * (task.retryCount + 1)
      )
    } else {
      this.context?.updateTask(taskId, {
        status: 'failed',
        error: errorMessage,
        completedAt: Date.now(),
      })

      // 自动任务失败后仍然安排下次执行
      if (task.executionMode === 'auto' && task.autoConfig?.enabled) {
        this.context?.scheduleNextExecution(taskId)
      }
    }

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const retryableMessages = [
        'RATE_LIMIT',
        'NETWORK_ERROR',
        'TIMEOUT',
        'rate limit',
        'timeout',
        'network',
      ]
      return retryableMessages.some((msg) =>
        error.message.toLowerCase().includes(msg.toLowerCase())
      )
    }
    return false
  }
}

// 导出单例
let taskExecutorInstance: TaskExecutor | null = null

export function getTaskExecutor(): TaskExecutor {
  if (!taskExecutorInstance) {
    taskExecutorInstance = new TaskExecutor()
  }
  return taskExecutorInstance
}

// 用于测试的重置函数
export function resetTaskExecutor(): void {
  taskExecutorInstance = null
}
