/**
 * AI 生成服务
 * @description 封装 AI 生成功能，集成提示词系统
 *
 * 【阶段四重构】
 * 现在内部统一调用 AIService，保持公共 API 不变
 * - 开发/生产模式的判断由 AIService 内部处理
 * - Provider 管理由 ProviderManager 处理
 * - 请求队列和并发控制由 RequestQueue 处理
 */

import type { RenderedPrompt } from '@/types/prompts'
import { getAIService, RequestPriority } from './ai'
import type { GenerateResult as AIServiceResult, StreamChunk } from './ai/types'
import { PromptService } from './prompt/promptService'
import { SystemPromptService } from './prompt/systemPromptService'

/**
 * 生成配置
 */
export interface GenerateConfig {
  /** 用户输入 */
  userInput?: string
  /** 是否流式输出 */
  stream?: boolean
  /** 最大 token 数 */
  maxTokens?: number
  /** 温度参数 */
  temperature?: number
  /** 自定义系统提示词 */
  systemPrompt?: string
  /** 请求优先级 */
  priority?: RequestPriority
  /** 来源 App ID（用于加载 App 级系统提示词） */
  appId?: string
  /** 场景标识（用于过滤适用的系统提示词） */
  scene?: string
  /** 是否禁用系统提示词注入 */
  disableSystemPrompt?: boolean
}

/**
 * 生成结果
 */
export interface GenerateResult {
  /** 生成的文本 */
  text: string
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 请求 ID（用于取消等） */
  requestId?: string
  /** Token 用量 */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * 流式生成回调
 */
export type StreamCallback = (chunk: string, done: boolean) => void

/**
 * AI 生成服务
 * 提供与提示词系统集成的 AI 生成能力
 */
export class AIGenerateService {
  private static initialized = false

  /**
   * 确保 AIService 已初始化
   */
  private static async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    const service = getAIService()
    await service.initialize()
    this.initialized = true
  }

  /**
   * 使用提示词模板生成内容
   */
  static async generateWithPrompt(
    scene: string,
    variables: Record<string, unknown>,
    options?: Partial<GenerateConfig>
  ): Promise<GenerateResult> {
    // 1. 获取提示词模板
    const template = PromptService.getPromptByScene(scene)
    if (!template) {
      return {
        text: '',
        success: false,
        error: `未找到场景 "${scene}" 的提示词模板`,
      }
    }

    // 2. 渲染提示词
    const rendered = PromptService.renderPrompt(template, variables)

    // 3. 执行生成
    return this.generate(rendered, options)
  }

  /**
   * 使用渲染后的提示词生成内容
   */
  static async generate(
    prompt: RenderedPrompt | string,
    options?: Partial<GenerateConfig>
  ): Promise<GenerateResult> {
    await this.ensureInitialized()

    const renderedPrompt: RenderedPrompt =
      typeof prompt === 'string' ? { userPrompt: prompt } : prompt

    try {
      // 组装最终的系统提示词
      let finalSystemPrompt = renderedPrompt.systemPrompt || options?.systemPrompt

      if (!options?.disableSystemPrompt) {
        const assembled = SystemPromptService.assemble({
          appId: options?.appId,
          scene: options?.scene,
          baseSystemPrompt: finalSystemPrompt,
        })
        finalSystemPrompt = assembled.systemPrompt || undefined
      }

      const service = getAIService()
      const result = await service.generateText(
        {
          prompt: renderedPrompt.userPrompt,
          system: finalSystemPrompt,
          maxTokens: options?.maxTokens,
          temperature: options?.temperature,
          source: 'AIGenerateService',
        },
        options?.priority ?? RequestPriority.NORMAL
      )

      return this.convertResult(result)
    } catch (error) {
      console.error('[AIGenerateService] 生成失败:', error)
      return {
        text: '',
        success: false,
        error: error instanceof Error ? error.message : '生成失败',
      }
    }
  }

  /**
   * 流式生成
   */
  static async generateStream(
    prompt: RenderedPrompt | string,
    callback: StreamCallback,
    options?: Partial<GenerateConfig>
  ): Promise<GenerateResult> {
    await this.ensureInitialized()

    const renderedPrompt: RenderedPrompt =
      typeof prompt === 'string' ? { userPrompt: prompt } : prompt

    try {
      // 组装最终的系统提示词
      let finalSystemPrompt = renderedPrompt.systemPrompt || options?.systemPrompt

      if (!options?.disableSystemPrompt) {
        const assembled = SystemPromptService.assemble({
          appId: options?.appId,
          scene: options?.scene,
          baseSystemPrompt: finalSystemPrompt,
        })
        finalSystemPrompt = assembled.systemPrompt || undefined
      }

      const service = getAIService()
      const handle = service.streamText(
        {
          prompt: renderedPrompt.userPrompt,
          system: finalSystemPrompt,
          maxTokens: options?.maxTokens,
          temperature: options?.temperature,
          source: 'AIGenerateService.stream',
          onChunk: (chunk: StreamChunk) => {
            if (chunk.type === 'text-delta' && chunk.textDelta) {
              callback(chunk.textDelta, false)
            } else if (chunk.type === 'finish') {
              callback('', true)
            }
          },
          onError: (error) => {
            console.error('[AIGenerateService] 流式生成错误:', error)
            callback('', true)
          },
          onAbort: () => {
            callback('', true)
          },
        },
        options?.priority ?? RequestPriority.NORMAL
      )

      // 等待完成
      const text = await handle.text

      return {
        text,
        success: true,
        requestId: handle.requestId,
      }
    } catch (error) {
      console.error('[AIGenerateService] 流式生成失败:', error)
      callback('', true)
      return {
        text: '',
        success: false,
        error: error instanceof Error ? error.message : '流式生成失败',
      }
    }
  }

  /**
   * 使用场景模板流式生成
   */
  static async streamWithPrompt(
    scene: string,
    variables: Record<string, unknown>,
    callback: StreamCallback,
    options?: Partial<GenerateConfig>
  ): Promise<GenerateResult> {
    const template = PromptService.getPromptByScene(scene)
    if (!template) {
      callback('', true)
      return {
        text: '',
        success: false,
        error: `未找到场景 "${scene}" 的提示词模板`,
      }
    }

    const rendered = PromptService.renderPrompt(template, variables)
    return this.generateStream(rendered, callback, options)
  }

  // ========== 便捷方法 ==========

  /**
   * 生成聊天回复
   */
  static async generateChatReply(params: {
    contactName: string
    contactPersonality?: string
    relationship?: string
    chatHistory?: string
    userMessage: string
  }): Promise<GenerateResult> {
    return this.generateWithPrompt('chat.reply', params, {
      priority: RequestPriority.CRITICAL, // 用户聊天优先级最高
    })
  }

  /**
   * 生成新对话开场
   */
  static async generateNewConversation(params: {
    contactName: string
    userName: string
    contactPersonality?: string
    scenario?: string
    mood?: string
  }): Promise<GenerateResult> {
    return this.generateWithPrompt('chat.new_conversation', params, {
      priority: RequestPriority.HIGH,
    })
  }

  /**
   * 生成直播弹幕
   */
  static async generateDanmaku(params: {
    streamTitle: string
    streamerName: string
    viewerName: string
    currentContent?: string
    danmakuType?: string
  }): Promise<GenerateResult> {
    return this.generateWithPrompt('live.danmaku', params, {
      priority: RequestPriority.NORMAL,
    })
  }

  /**
   * 生成邮件内容
   */
  static async generateEmail(params: {
    senderName: string
    senderRole?: string
    recipientName: string
    emailType?: string
    subject?: string
    additionalInfo?: string
  }): Promise<GenerateResult> {
    return this.generateWithPrompt('email.compose', params, {
      priority: RequestPriority.NORMAL,
    })
  }

  /**
   * 生成网页文章
   */
  static async generateArticle(params: {
    siteType: string
    topic: string
    style?: string
    targetAudience?: string
  }): Promise<GenerateResult> {
    return this.generateWithPrompt('browser.article', params, {
      priority: RequestPriority.LOW, // 文章生成优先级较低
    })
  }

  // ========== 工具方法 ==========

  /**
   * 转换 AIService 结果为本服务的结果格式
   */
  private static convertResult(result: AIServiceResult): GenerateResult {
    return {
      text: result.text,
      success: true,
      requestId: result.requestId,
      usage: result.usage,
    }
  }

  /**
   * 测试提示词（预览渲染结果，不实际调用 AI）
   */
  static testPrompt(scene: string, variables: Record<string, unknown>): RenderedPrompt | null {
    const template = PromptService.getPromptByScene(scene)
    if (!template) return null

    return PromptService.renderPrompt(template, variables)
  }

  /**
   * 使用指定模板 ID 测试
   */
  static testPromptById(id: string, variables: Record<string, unknown>): RenderedPrompt | null {
    const template = PromptService.getPromptById(id)
    if (!template) return null

    return PromptService.renderPrompt(template, variables)
  }

  /**
   * 取消当前生成
   * @param requestId 可选的请求 ID，不传则取消最近一个
   */
  static abort(requestId?: string): void {
    const service = getAIService()
    service.abort(requestId)
  }

  /**
   * 取消所有生成
   */
  static abortAll(): void {
    const service = getAIService()
    service.abortAll()
  }

  /**
   * 检查是否正在生成
   */
  static get isGenerating(): boolean {
    const service = getAIService()
    return service.isGenerating
  }
}

export default AIGenerateService
