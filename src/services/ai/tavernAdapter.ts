/**
 * 酒馆 API 适配器
 * 封装 TavernHelper.generate() 调用，适配 AI Service 接口
 */

import type {
  GenerateOptions,
  StreamOptions,
  GenerateResult,
  StreamHandle,
  StreamChunk,
  AIError,
} from './types';
import { createAIError, generateRequestId, normalizeFinishReason } from './utils';
import { getGlobalConfigService } from '../globalConfigService';
import { loggerService } from '@/services/logger';

// 创建模块专属日志器
const logger = loggerService.child('ai:tavern-adapter');

/**
 * TavernHelper 类型定义
 */
interface TavernHelper {
  generate: (config: unknown) => Promise<string>;
}

/**
 * 获取 TavernHelper 实例
 */
function getTavernHelper(): TavernHelper | null {
  const parentWin = window.parent as Window & {
    TavernHelper?: TavernHelper;
  };
  return parentWin.TavernHelper ?? null;
}

/**
 * 酒馆 API 适配器
 */
export class TavernAdapter {
  private static instance: TavernAdapter;

  static getInstance(): TavernAdapter {
    if (!this.instance) {
      this.instance = new TavernAdapter();
    }
    return this.instance;
  }

  /**
   * 检查 TavernHelper 是否可用
   */
  isAvailable(): boolean {
    return getTavernHelper()?.generate !== undefined;
  }

  /**
   * 非流式生成
   */
  async generateText(options: GenerateOptions): Promise<GenerateResult> {
    const helper = getTavernHelper();
    if (!helper?.generate) {
      throw createAIError('PROVIDER_NOT_READY', 'TavernHelper.generate 不可用');
    }

    const requestId = options.requestId || generateRequestId();
    const startTime = Date.now();

    try {
      const config = this.buildConfig(options, false);
      const text = await helper.generate(config);

      return {
        text,
        requestId,
        finishReason: 'stop',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw this.wrapError(error, requestId);
    }
  }

  /**
   * 流式生成
   */
  streamText(options: StreamOptions): StreamHandle {
    const requestId = options.requestId || generateRequestId();
    let isDone = false;
    let abortController: AbortController | null = new AbortController();
    let resolveText: (value: string) => void;
    let rejectText: (error: any) => void;
    let fullText = '';

    const textPromise = new Promise<string>((resolve, reject) => {
      resolveText = resolve;
      rejectText = reject;
    });

    // 创建文本流
    const textStream = this.createTextStream(
      options,
      requestId,
      abortController,
      (text) => {
        fullText = text;
        isDone = true;
        resolveText(text);
      },
      (error) => {
        isDone = true;
        rejectText(error);
      }
    );

    // 创建完整事件流
    const fullStream = this.createFullStream(
      options,
      requestId,
      abortController
    );

    return {
      requestId,
      textStream,
      fullStream,
      text: textPromise,
      abort: () => {
        if (abortController) {
          abortController.abort();
          abortController = null;
          isDone = true;
          options.onAbort?.();
        }
      },
      get done() {
        return isDone;
      },
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 构建酒馆 API 配置
   */
  private buildConfig(
    options: GenerateOptions | StreamOptions,
    isStream: boolean
  ): Record<string, unknown> {
    const configService = getGlobalConfigService();
    const customApiConfig = configService.getActiveApiConfig();
    const globalConfig = configService.getConfig();

    const config: Record<string, unknown> = {
      user_input: options.prompt || '',
      should_stream: isStream,
    };

    // 如果是流式请求，添加回调
    if (isStream && 'onChunk' in options) {
      config.stream_callback = (chunk: string, done: boolean) => {
        if (done) {
          (options as StreamOptions).onChunk?.({
            type: 'finish',
            finishReason: 'stop',
          });
        } else {
          (options as StreamOptions).onChunk?.({
            type: 'text-delta',
            textDelta: chunk,
          });
        }
      };
    }

    // 如果有系统提示词
    if (options.system) {
      config.ordered_prompts = [
        { role: 'system', content: options.system },
        'chat_history',
        'user_input',
      ];
    }

    // 如果启用了自定义 API
    if (customApiConfig) {
      config.custom_api = {
        apiurl: customApiConfig.apiUrl,
        key: customApiConfig.apiKey,
        model: customApiConfig.model,
        source: customApiConfig.source ?? 'openai',
        max_tokens: options.maxTokens ?? customApiConfig.maxTokens ?? globalConfig?.defaultGenerateOptions.maxTokens,
        temperature: options.temperature ?? customApiConfig.temperature ?? globalConfig?.defaultGenerateOptions.temperature,
        frequency_penalty: customApiConfig.frequencyPenalty,
        presence_penalty: customApiConfig.presencePenalty,
        top_p: customApiConfig.topP,
      };
    }

    return config;
  }

  /**
   * 创建文本流
   */
  private async *createTextStream(
    options: StreamOptions,
    requestId: string,
    abortController: AbortController | null,
    onComplete: (text: string) => void,
    onError: (error: AIError) => void
  ): AsyncIterable<string> {
    const helper = getTavernHelper();
    if (!helper?.generate) {
      onError(createAIError('PROVIDER_NOT_READY', 'TavernHelper.generate 不可用'));
      return;
    }

    let textBuffer: string[] = [];
    let isFinished = false;

    const config = this.buildConfig(
      {
        ...options,
        onChunk: (chunk) => {
          if (chunk.type === 'text-delta' && chunk.textDelta) {
            textBuffer.push(chunk.textDelta);
          } else if (chunk.type === 'finish') {
            isFinished = true;
          }
          options.onChunk?.(chunk);
        },
      },
      true
    );

    try {
      // 启动生成
      const textPromise = helper.generate(config);

      // 逐步输出缓冲的文本
      while (!isFinished) {
        if (abortController?.signal.aborted) {
          return;
        }

        while (textBuffer.length > 0) {
          yield textBuffer.shift()!;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 输出剩余文本
      while (textBuffer.length > 0) {
        yield textBuffer.shift()!;
      }

      const fullText = await textPromise;
      onComplete(fullText);
    } catch (error) {
      onError(this.wrapError(error, requestId));
    }
  }

  /**
   * 创建完整事件流
   */
  private async *createFullStream(
    options: StreamOptions,
    requestId: string,
    abortController: AbortController | null
  ): AsyncIterable<StreamChunk> {
    const helper = getTavernHelper();
    if (!helper?.generate) {
      return;
    }

    let chunkBuffer: StreamChunk[] = [];
    let isFinished = false;

    const config = this.buildConfig(
      {
        ...options,
        onChunk: (chunk) => {
          chunkBuffer.push(chunk);
          if (chunk.type === 'finish') {
            isFinished = true;
          }
          options.onChunk?.(chunk);
        },
      },
      true
    );

    try {
      // 启动生成
      helper.generate(config);

      // 逐步输出缓冲的 chunk
      while (!isFinished) {
        if (abortController?.signal.aborted) {
          return;
        }

        while (chunkBuffer.length > 0) {
          yield chunkBuffer.shift()!;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 输出剩余 chunk
      while (chunkBuffer.length > 0) {
        yield chunkBuffer.shift()!;
      }
    } catch (error) {
      logger.error('Stream error:', error);
    }
  }

  /**
   * 包装错误
   */
  private wrapError(error: unknown, requestId: string): AIError {
    if (error instanceof Error) {
      return createAIError('PROVIDER_ERROR', error.message, {
        cause: error,
        requestId,
      });
    }
    return createAIError('UNKNOWN', String(error), { requestId });
  }
}

/**
 * 获取 TavernAdapter 单例
 */
export function getTavernAdapter(): TavernAdapter {
  return TavernAdapter.getInstance();
}
