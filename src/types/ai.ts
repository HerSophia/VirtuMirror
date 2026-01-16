/**
 * AI SDK 类型定义
 * 重新导出 Vercel AI SDK 的类型，并添加项目特定扩展
 */

import type {
  LanguageModel,
  GenerateTextResult as VercelGenerateTextResult,
  StreamTextResult as VercelStreamTextResult,
} from 'ai';

// 重新导出核心类型
export type { LanguageModel as AIModel } from 'ai';

// 本地定义兼容类型（Vercel AI SDK v4 不再导出这些）
// 注意：这是自定义的 Mock 专用接口，不是 Vercel SDK 的类型
export interface LanguageModelV1 {
  readonly specificationVersion: 'v1';
  readonly provider: string;
  readonly modelId: string;
  readonly defaultObjectGenerationMode?: 'json' | 'tool' | 'grammar' | undefined;
  readonly supportedUrls?: undefined;
  doGenerate(options: any): Promise<any>;
  doStream(options: any): Promise<any>;
}

export interface LanguageModelV1StreamPart {
  type: 'text-delta' | 'finish' | 'error' | 'tool-call' | 'tool-result';
  /** 文本增量（Mock 使用） */
  textDelta?: string;
  /** 文本增量（新版 SDK 使用 text） */
  text?: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * AI 消息
 * 兼容 Vercel CoreMessage
 */
export interface AIMessage {
  role: MessageRole;
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}

/**
 * 生成文本的选项
 * 简化版，用于服务层调用
 */
export interface GenerateTextOptions {
  model: LanguageModel;
  system?: string;
  prompt?: string;
  messages?: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  abortSignal?: AbortSignal;
}

/**
 * 流式生成文本的选项
 */
export interface StreamTextOptions extends GenerateTextOptions {
  onChunk?: (chunk: TextStreamChunk) => void;
  onFinish?: (result: StreamTextResult) => void;
}

/**
 * 文本生成结果
 * 兼容 Vercel GenerateTextResult
 */
export type GenerateTextResult = VercelGenerateTextResult<any, any>;

/**
 * 文本流块
 * 简化定义用于回调
 */
export interface TextStreamChunk {
  type: 'text-delta' | 'finish';
  textDelta?: string;
  finishReason?: string;
  usage?: TokenUsage;
}

/**
 * 流式生成结果
 * 兼容 Vercel StreamTextResult
 */
export type StreamTextResult = VercelStreamTextResult<any, any>;

/**
 * AI Provider 接口
 * 注意：createModel 的返回类型使用联合类型以支持 Mock 模型
 */
export interface AIProvider {
  name: string;
  createModel: (modelId: string) => LanguageModel | LanguageModelV1;
  listModels?: () => Promise<string[]>;
}
