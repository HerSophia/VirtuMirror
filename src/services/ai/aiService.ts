/**
 * AI Service 核心服务
 * 统一的 AI 生成入口，协调各模块
 */

import {
  generateText as vercelGenerateText,
  streamText as vercelStreamText,
} from 'ai';
import type { LanguageModel } from 'ai';

import type {
  IAIService,
  GenerateOptions,
  StreamOptions,
  GenerateResult,
  StreamHandle,
  StreamChunk,
  AIError,
  ProviderInfo,
  RequestPriority,
  QueueStatus,
  QueueConfig,
  AIServiceConfig,
} from './types';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from './constants';
import { createAIError, generateRequestId, normalizeFinishReason, inferErrorCode } from './utils';
import { ProviderManager, getProviderManager } from './providerManager';
import { RequestManager, getRequestManager } from './requestManager';
import { RequestQueue, getRequestQueue } from './requestQueue';
import { TavernAdapter, getTavernAdapter } from './tavernAdapter';
import { withRateLimitRetry, withTimeout } from './rateLimiter';
import { loggerService } from '@/services/logger';

// 创建模块专属日志器
const logger = loggerService.child('ai-service');

// 事件类型
type EventType = 'start' | 'chunk' | 'finish' | 'error' | 'abort';
type EventHandler = (...args: any[]) => void;

/**
 * AI Service 实现
 */
export class AIService implements IAIService {
  private static instance: AIService;
  
  private providerManager: ProviderManager;
  private requestManager: RequestManager;
  private requestQueue: RequestQueue;
  private tavernAdapter: TavernAdapter;
  
  private config: AIServiceConfig;
  private initialized = false;
  private eventListeners = new Map<EventType, Set<EventHandler>>();

  private constructor(config?: AIServiceConfig) {
    this.config = {
      defaultTimeout: DEFAULT_TIMEOUT,
      maxConcurrent: 3,
      enableLogging: true,
      useMockInDev: true,
      ...config,
    };
    
    this.providerManager = getProviderManager();
    this.requestManager = getRequestManager();
    this.requestQueue = getRequestQueue();
    this.tavernAdapter = getTavernAdapter();
    
    // 注入执行器到队列
    this.requestQueue.setExecutor((options, isStream, signal) => 
      this.executeDirectly(options, isStream, signal)
    );
  }

  static getInstance(config?: AIServiceConfig): AIService {
    if (!this.instance) {
      this.instance = new AIService(config);
    }
    return this.instance;
  }

  // ==================== 初始化 ====================

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.providerManager.initialize();
    this.initialized = true;
    
    if (this.config.enableLogging) {
      logger.info('初始化完成', this.getProviderInfo());
    }
  }

  get isReady(): boolean {
    return this.initialized;
  }

  // ==================== 生成 API ====================

  async generateText(
    options: GenerateOptions,
    priority: RequestPriority = 2 // NORMAL
  ): Promise<GenerateResult> {
    // 通过队列调度
    return this.requestQueue.enqueue(options, false, priority);
  }

  streamText(
    options: StreamOptions,
    priority: RequestPriority = 2 // NORMAL
  ): StreamHandle {
    const requestId = options.requestId || generateRequestId();
    let isDone = false;
    let abortController = new AbortController();
    let resolveText: (value: string) => void;
    let rejectText: (error: any) => void;
    let fullText = '';

    const textPromise = new Promise<string>((resolve, reject) => {
      resolveText = resolve;
      rejectText = reject;
    });

    // 通过队列调度，但需要特殊处理流式响应
    const streamOptions: StreamOptions = {
      ...options,
      requestId,
      onChunk: (chunk) => {
        if (chunk.type === 'text-delta' && chunk.textDelta) {
          fullText += chunk.textDelta;
          this.emit('chunk', requestId, chunk.textDelta);
        }
        options.onChunk?.(chunk);
      },
      onFinish: (result) => {
        isDone = true;
        resolveText(result.text);
        options.onFinish?.(result);
      },
      onError: (error) => {
        isDone = true;
        rejectText(error);
        options.onError?.(error);
      },
      onAbort: () => {
        isDone = true;
        options.onAbort?.();
      },
    };

    // 创建异步可迭代的文本流
    const textStream = this.createAsyncTextStream(streamOptions, requestId, abortController);
    const fullStream = this.createAsyncFullStream(streamOptions, requestId, abortController);

    // 入队
    this.requestQueue.enqueue<GenerateResult>(streamOptions, true, priority)
      .then((result) => {
        if (!isDone) {
          isDone = true;
          resolveText(result.text);
        }
      })
      .catch((error) => {
        if (!isDone) {
          isDone = true;
          rejectText(error);
        }
      });

    return {
      requestId,
      textStream,
      fullStream,
      text: textPromise,
      abort: () => {
        abortController.abort();
        this.requestQueue.cancel(requestId);
        this.emit('abort', requestId);
        isDone = true;
      },
      get done() {
        return isDone;
      },
    };
  }

  // ==================== 请求控制 ====================

  abort(requestId?: string): void {
    if (requestId) {
      this.requestQueue.cancel(requestId);
      this.requestManager.cancel(requestId);
    } else {
      const latestId = this.requestManager.getLatestRequestId();
      if (latestId) {
        this.requestQueue.cancel(latestId);
        this.requestManager.cancel(latestId);
      }
    }
  }

  abortAll(): void {
    this.requestQueue.clear();
    this.requestManager.cancelAll();
  }

  get isGenerating(): boolean {
    return this.requestManager.isGenerating();
  }

  // ==================== Provider 管理 ====================

  getActiveProvider(): LanguageModel | null {
    return this.providerManager.getActiveProvider();
  }

  getProviderInfo(): ProviderInfo | null {
    return this.providerManager.getProviderInfo();
  }

  switchProvider(presetId: string | null): void {
    this.providerManager.switchToPreset(presetId);
  }

  refreshProvider(): void {
    this.providerManager.refresh();
  }

  // ==================== 队列管理 ====================

  getQueueStatus(): QueueStatus {
    return this.requestQueue.getStatus();
  }

  updateQueueConfig(config: Partial<QueueConfig>): void {
    this.requestQueue.updateConfig(config);
  }

  // ==================== 事件 ====================

  on(event: EventType, handler: EventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  private emit(event: EventType, ...args: any[]): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (e) {
          logger.error(`Event handler error (${event}):`, e);
        }
      });
    }
  }

  // ==================== 直接执行（内部方法） ====================

  private async executeDirectly(
    options: GenerateOptions | StreamOptions,
    isStream: boolean,
    signal: AbortSignal
  ): Promise<GenerateResult> {
    const requestId = options.requestId || generateRequestId();
    const ctx = this.requestManager.create({ id: requestId, source: options.source });
    
    this.requestManager.start(requestId);
    this.emit('start', requestId);
    
    const startTime = Date.now();
    
    try {
      // 获取 Provider
      const provider = this.providerManager.getActiveProvider();
      
      let result: GenerateResult;
      
      if (provider) {
        // 使用自定义 API Provider
        result = await this.executeWithProvider(provider, options, isStream, signal);
      } else {
        // 使用酒馆 API
        result = await this.executeWithTavern(options, isStream);
      }
      
      result.requestId = requestId;
      result.duration = Date.now() - startTime;
      
      this.requestManager.complete(requestId);
      this.emit('finish', requestId, result);
      
      if ('onFinish' in options && options.onFinish) {
        options.onFinish(result);
      }
      
      return result;
    } catch (error) {
      const aiError = this.wrapError(error, requestId);
      
      this.requestManager.fail(requestId);
      this.emit('error', requestId, aiError);
      
      if ('onError' in options && options.onError) {
        options.onError(aiError);
      }
      
      throw aiError;
    }
  }

  /**
   * 使用 Provider 执行生成
   */
  private async executeWithProvider(
    provider: LanguageModel,
    options: GenerateOptions | StreamOptions,
    isStream: boolean,
    signal: AbortSignal
  ): Promise<GenerateResult> {
    const commonOptions = {
      model: options.model || provider,
      system: options.system,
      maxTokens: options.maxTokens || DEFAULT_MAX_TOKENS,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stopSequences,
      abortSignal: signal,
    };

    // 处理 prompt 或 messages
    const inputOptions: any = { ...commonOptions };
    if (options.messages && options.messages.length > 0) {
      inputOptions.messages = options.messages;
    } else if (options.prompt) {
      inputOptions.prompt = options.prompt;
    }

    if (isStream) {
      // 流式生成
      const streamResult = await vercelStreamText(inputOptions);
      let fullText = '';
      
      // 处理流
      for await (const chunk of streamResult.fullStream) {
        if (chunk.type === 'text-delta') {
          // 新版 SDK 使用 text 而不是 textDelta
          const textDelta = (chunk as any).text || (chunk as any).textDelta || '';
          fullText += textDelta;
          if ('onChunk' in options && options.onChunk) {
            options.onChunk({
              type: 'text-delta',
              textDelta,
            });
          }
        } else if (chunk.type === 'finish') {
          // 新版 SDK 使用 totalUsage 而不是 usage
          const usage = (chunk as any).totalUsage || (chunk as any).usage;
          if ('onChunk' in options && options.onChunk) {
            options.onChunk({
              type: 'finish',
              finishReason: normalizeFinishReason(chunk.finishReason),
              usage: usage ? {
                promptTokens: usage.promptTokens ?? 0,
                completionTokens: usage.completionTokens ?? 0,
                totalTokens: usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
              } : undefined,
            });
          }
        }
      }
      
      const finalText = await streamResult.text;
      const usage = await streamResult.usage;
      
      return {
        text: finalText || fullText,
        requestId: '',
        finishReason: normalizeFinishReason(await streamResult.finishReason),
        usage: usage ? {
          promptTokens: (usage as any).promptTokens ?? 0,
          completionTokens: (usage as any).completionTokens ?? 0,
          totalTokens: (usage as any).totalTokens ?? ((usage as any).promptTokens ?? 0) + ((usage as any).completionTokens ?? 0),
        } : undefined,
      };
    } else {
      // 非流式生成
      const result = await withRateLimitRetry(() => 
        withTimeout(
          vercelGenerateText(inputOptions),
          options.timeout || this.config.defaultTimeout || DEFAULT_TIMEOUT
        )
      );
      
      const usage = result.usage as any;
      
      return {
        text: result.text,
        requestId: '',
        finishReason: normalizeFinishReason(result.finishReason),
        usage: usage ? {
          promptTokens: usage.promptTokens ?? 0,
          completionTokens: usage.completionTokens ?? 0,
          totalTokens: usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
        } : undefined,
      };
    }
  }

  /**
   * 使用酒馆 API 执行生成
   */
  private async executeWithTavern(
    options: GenerateOptions | StreamOptions,
    isStream: boolean
  ): Promise<GenerateResult> {
    if (isStream) {
      // 酒馆流式生成
      const handle = this.tavernAdapter.streamText(options as StreamOptions);
      const text = await handle.text;
      return {
        text,
        requestId: handle.requestId,
        finishReason: 'stop',
      };
    } else {
      // 酒馆非流式生成
      return this.tavernAdapter.generateText(options);
    }
  }

  /**
   * 创建异步文本流
   */
  private async *createAsyncTextStream(
    options: StreamOptions,
    requestId: string,
    abortController: AbortController
  ): AsyncIterable<string> {
    const buffer: string[] = [];
    let isFinished = false;
    let error: AIError | null = null;
    
    const originalOnChunk = options.onChunk;
    options.onChunk = (chunk) => {
      if (chunk.type === 'text-delta' && chunk.textDelta) {
        buffer.push(chunk.textDelta);
      } else if (chunk.type === 'finish') {
        isFinished = true;
      }
      originalOnChunk?.(chunk);
    };
    
    const originalOnError = options.onError;
    options.onError = (err) => {
      error = err;
      isFinished = true;
      originalOnError?.(err);
    };
    
    while (!isFinished && !abortController.signal.aborted) {
      while (buffer.length > 0) {
        yield buffer.shift()!;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // 输出剩余
    while (buffer.length > 0) {
      yield buffer.shift()!;
    }
    
    if (error) {
      throw error;
    }
  }

  /**
   * 创建异步完整事件流
   */
  private async *createAsyncFullStream(
    options: StreamOptions,
    requestId: string,
    abortController: AbortController
  ): AsyncIterable<StreamChunk> {
    const buffer: StreamChunk[] = [];
    let isFinished = false;
    
    const originalOnChunk = options.onChunk;
    options.onChunk = (chunk) => {
      buffer.push(chunk);
      if (chunk.type === 'finish') {
        isFinished = true;
      }
      originalOnChunk?.(chunk);
    };
    
    while (!isFinished && !abortController.signal.aborted) {
      while (buffer.length > 0) {
        yield buffer.shift()!;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // 输出剩余
    while (buffer.length > 0) {
      yield buffer.shift()!;
    }
  }

  /**
   * 包装错误
   */
  private wrapError(error: unknown, requestId: string): AIError {
    if (error && typeof error === 'object' && 'code' in error) {
      return error as AIError;
    }
    
    if (error instanceof Error) {
      const code = inferErrorCode(error);
      return createAIError(code, error.message, {
        cause: error,
        requestId,
      });
    }
    
    return createAIError('UNKNOWN', String(error), { requestId });
  }
}

// ==================== 单例导出 ====================

let aiServiceInstance: AIService | null = null;

/**
 * 获取 AIService 单例
 */
export function getAIService(config?: AIServiceConfig): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = AIService.getInstance(config);
  }
  return aiServiceInstance;
}

/**
 * 重置 AIService（主要用于测试）
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}
