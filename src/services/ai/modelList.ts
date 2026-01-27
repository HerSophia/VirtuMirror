/**
 * 模型列表服务
 * 用于从各种 AI API 获取可用模型列表
 *
 * @module ai/modelList
 */

import type { ProviderSource, ApiConfig } from './types';

// ==================== 类型定义 ====================

/**
 * 模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string;
  /** 模型名称（可选，用于显示） */
  name?: string;
  /** 模型描述（可选） */
  description?: string;
  /** 模型所有者/创建者（可选） */
  ownedBy?: string;
  /** 创建时间戳（可选） */
  created?: number;
  /** 模型类型（可选） */
  type?: 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'other';
  /** 是否支持多模态（可选） */
  multimodal?: boolean;
  /** 上下文长度（可选） */
  contextLength?: number;
  /** 原始数据 */
  raw?: Record<string, unknown>;
}

/**
 * 获取模型列表的结果
 */
export interface FetchModelsResult {
  /** 是否成功 */
  success: boolean;
  /** 模型列表 */
  models: ModelInfo[];
  /** 错误信息（如果失败） */
  error?: string;
  /** 响应时间（毫秒） */
  responseTime?: number;
}

/**
 * 获取模型列表的选项
 */
export interface FetchModelsOptions {
  /** API 地址 */
  apiUrl: string;
  /** API 密钥 */
  apiKey?: string;
  /** API 来源类型 */
  source?: ProviderSource | 'custom';
  /** 超时时间（毫秒），默认 10000 */
  timeout?: number;
  /** 是否只返回聊天模型 */
  chatModelsOnly?: boolean;
}

// ==================== 常量 ====================

/** 默认超时时间 */
const DEFAULT_FETCH_TIMEOUT = 10000;

// ==================== OpenAI Compatible API ====================

/**
 * OpenAI Models API 响应格式
 * @see https://platform.openai.com/docs/api-reference/models/list
 */
interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModelObject[];
}

/**
 * OpenAI 模型对象
 */
interface OpenAIModelObject {
  /** 模型 ID */
  id: string;
  /** 对象类型，总是 "model" */
  object: 'model';
  /** 创建时间戳 */
  created: number;
  /** 所有者 */
  owned_by: string;
}

/**
 * 从 OpenAI 兼容 API 获取模型列表
 * 支持：OpenAI、DeepSeek、Moonshot、SiliconFlow、OpenRouter、Groq、Mistral、Ollama 等
 *
 * @param options 获取选项
 * @returns 模型列表结果
 *
 * @example
 * ```typescript
 * // OpenAI 官方
 * const result = await fetchOpenAIModels({
 *   apiUrl: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx'
 * })
 *
 * // DeepSeek
 * const result = await fetchOpenAIModels({
 *   apiUrl: 'https://api.deepseek.com/v1',
 *   apiKey: 'sk-xxx'
 * })
 *
 * // Ollama 本地
 * const result = await fetchOpenAIModels({
 *   apiUrl: 'http://localhost:11434/v1'
 * })
 * ```
 */
export async function fetchOpenAIModels(
  options: FetchModelsOptions
): Promise<FetchModelsResult> {
  const {
    apiUrl,
    apiKey,
    timeout = DEFAULT_FETCH_TIMEOUT,
    chatModelsOnly = false,
  } = options;

  const startTime = Date.now();

  try {
    // 规范化 URL
    let baseUrl = apiUrl.trim();
    // 移除末尾斜杠
    baseUrl = baseUrl.replace(/\/$/, '');
    // 如果用户填写了完整的 chat/completions URL，提取 base URL
    baseUrl = baseUrl.replace(/\/chat\/completions$/, '');

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        // 尝试解析错误信息
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          }
        } catch {
          // 忽略 JSON 解析错误
        }

        return {
          success: false,
          models: [],
          error: errorMessage,
          responseTime,
        };
      }

      const data: OpenAIModelsResponse = await response.json();

      // 调试：打印原始响应
      console.log('[ModelList] 原始响应:', JSON.stringify(data, null, 2));

      if (!data.data || !Array.isArray(data.data)) {
        // 某些 API 可能返回不同的格式，尝试兼容处理
        if (Array.isArray(data)) {
          // 直接是数组的情况
          console.log('[ModelList] 检测到数组格式响应');
          const models: ModelInfo[] = (data as unknown as OpenAIModelObject[]).map((model) => ({
            id: model.id,
            name: model.id,
            ownedBy: model.owned_by,
            created: model.created,
            type: inferModelType(model.id),
            raw: model as unknown as Record<string, unknown>,
          }));
          return {
            success: true,
            models,
            responseTime,
          };
        }

        return {
          success: false,
          models: [],
          error: `响应格式无效：${JSON.stringify(data).slice(0, 100)}...`,
          responseTime,
        };
      }

      // 如果 data.data 是空数组，给出提示
      if (data.data.length === 0) {
        console.warn('[ModelList] API 返回了空的模型列表，该 API 可能不支持 /models 端点');
      }

      // 转换为统一的 ModelInfo 格式
      let models: ModelInfo[] = data.data.map((model) => ({
        id: model.id,
        name: model.id, // OpenAI API 没有单独的 name 字段
        ownedBy: model.owned_by,
        created: model.created,
        type: inferModelType(model.id),
        raw: model as unknown as Record<string, unknown>,
      }));

      // 如果只需要聊天模型，进行过滤
      if (chatModelsOnly) {
        models = models.filter((m) => m.type === 'chat' || m.type === 'other');
      }

      // 按 ID 排序
      models.sort((a, b) => a.id.localeCompare(b.id));

      return {
        success: true,
        models,
        responseTime,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          models: [],
          error: `请求超时 (${timeout}ms)`,
          responseTime,
        };
      }
      return {
        success: false,
        models: [],
        error: error.message,
        responseTime,
      };
    }

    return {
      success: false,
      models: [],
      error: '未知错误',
      responseTime,
    };
  }
}

/**
 * 根据模型 ID 推断模型类型
 */
function inferModelType(modelId: string): ModelInfo['type'] {
  const id = modelId.toLowerCase();

  // 嵌入模型
  if (id.includes('embed') || id.includes('embedding')) {
    return 'embedding';
  }

  // 图像模型
  if (id.includes('dall-e') || id.includes('image') || id.includes('vision-gen')) {
    return 'image';
  }

  // 音频模型
  if (id.includes('whisper') || id.includes('tts') || id.includes('audio')) {
    return 'audio';
  }

  // 补全模型（旧版）
  if (id.includes('instruct') && !id.includes('gpt-3.5-turbo-instruct')) {
    return 'completion';
  }

  // 聊天模型（大多数现代模型）
  if (
    id.includes('gpt') ||
    id.includes('claude') ||
    id.includes('gemini') ||
    id.includes('llama') ||
    id.includes('mistral') ||
    id.includes('qwen') ||
    id.includes('yi-') ||
    id.includes('glm') ||
    id.includes('deepseek') ||
    id.includes('moonshot') ||
    id.includes('chat')
  ) {
    return 'chat';
  }

  return 'other';
}

// ==================== Anthropic API ====================

/**
 * Anthropic 预定义模型列表
 * Anthropic 没有公开的模型列表 API，所以使用预定义列表
 * @see https://docs.anthropic.com/en/docs/about-claude/models
 */
export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: '最新的 Claude Sonnet 4 模型',
    ownedBy: 'anthropic',
    type: 'chat',
    contextLength: 200000,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    description: '最新的 Claude Opus 4 模型',
    ownedBy: 'anthropic',
    type: 'chat',
    contextLength: 200000,
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    description: 'Claude 3.7 Sonnet 支持扩展思考',
    ownedBy: 'anthropic',
    type: 'chat',
    contextLength: 200000,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Latest)',
    description: '最新的 Claude 3.5 Sonnet',
    ownedBy: 'anthropic',
    type: 'chat',
    multimodal: true,
    contextLength: 200000,
  },
  {
    id: 'claude-3-5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet',
    description: 'Claude 3.5 Sonnet',
    ownedBy: 'anthropic',
    type: 'chat',
    multimodal: true,
    contextLength: 200000,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: '快速、高效的 Claude 3.5 Haiku',
    ownedBy: 'anthropic',
    type: 'chat',
    multimodal: true,
    contextLength: 200000,
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: '最强大的 Claude 3 模型',
    ownedBy: 'anthropic',
    type: 'chat',
    multimodal: true,
    contextLength: 200000,
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    description: '平衡性能与速度的 Claude 3',
    ownedBy: 'anthropic',
    type: 'chat',
    multimodal: true,
    contextLength: 200000,
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    description: '最快速的 Claude 3 模型',
    ownedBy: 'anthropic',
    type: 'chat',
    multimodal: true,
    contextLength: 200000,
  },
];

/**
 * 获取 Anthropic 模型列表
 * 由于 Anthropic 没有公开的模型列表 API，返回预定义列表
 */
export async function fetchAnthropicModels(
  _options?: FetchModelsOptions
): Promise<FetchModelsResult> {
  // Anthropic 没有模型列表 API，直接返回预定义列表
  return {
    success: true,
    models: ANTHROPIC_MODELS,
    responseTime: 0,
  };
}

// ==================== Google Gemini API ====================

/**
 * Google Gemini Models API 响应格式
 * @see https://ai.google.dev/api/models#method:-models.list
 */
interface GoogleModelsResponse {
  models: GoogleModelObject[];
  nextPageToken?: string;
}

/**
 * Google 模型对象
 */
interface GoogleModelObject {
  /** 模型资源名称，格式: models/{model} */
  name: string;
  /** 模型基础 ID */
  baseModelId?: string;
  /** 模型版本 */
  version: string;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 输入 token 限制 */
  inputTokenLimit: number;
  /** 输出 token 限制 */
  outputTokenLimit: number;
  /** 支持的生成方法 */
  supportedGenerationMethods: string[];
  /** 温度 */
  temperature?: number;
  /** 最大温度 */
  maxTemperature?: number;
  /** Top P */
  topP?: number;
  /** Top K */
  topK?: number;
}

/**
 * 从 Google Gemini API 获取模型列表
 *
 * @param options 获取选项
 * @returns 模型列表结果
 *
 * @example
 * ```typescript
 * const result = await fetchGoogleModels({
 *   apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
 *   apiKey: 'AIzaSy...',
 * })
 * ```
 */
export async function fetchGoogleModels(
  options: FetchModelsOptions
): Promise<FetchModelsResult> {
  const {
    apiUrl,
    apiKey,
    timeout = DEFAULT_FETCH_TIMEOUT,
    chatModelsOnly = false,
  } = options;

  if (!apiKey) {
    return {
      success: false,
      models: [],
      error: 'Google API 需要 API Key',
    };
  }

  const startTime = Date.now();

  try {
    // 规范化 URL
    const baseUrl = apiUrl.trim().replace(/\/$/, '');

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Google API 将 key 放在 URL 参数中
      const response = await fetch(`${baseUrl}/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // 忽略 JSON 解析错误
        }

        return {
          success: false,
          models: [],
          error: errorMessage,
          responseTime,
        };
      }

      const data: GoogleModelsResponse = await response.json();

      if (!data.models || !Array.isArray(data.models)) {
        return {
          success: false,
          models: [],
          error: '响应格式无效：缺少 models 数组',
          responseTime,
        };
      }

      // 转换为统一的 ModelInfo 格式
      let models: ModelInfo[] = data.models.map((model) => {
        // 从 "models/gemini-1.5-pro" 提取 "gemini-1.5-pro"
        const id = model.name.replace('models/', '');

        // 判断是否为聊天模型
        const isChat = model.supportedGenerationMethods?.includes('generateContent');

        return {
          id,
          name: model.displayName || id,
          description: model.description,
          ownedBy: 'google',
          type: isChat ? 'chat' : 'other',
          contextLength: model.inputTokenLimit,
          raw: model as unknown as Record<string, unknown>,
        };
      });

      // 如果只需要聊天模型，进行过滤（只保留 gemini 模型）
      if (chatModelsOnly) {
        models = models.filter(
          (m) =>
            m.type === 'chat' &&
            (m.id.includes('gemini') || m.id.includes('learnlm'))
        );
      }

      // 按 ID 排序
      models.sort((a, b) => a.id.localeCompare(b.id));

      return {
        success: true,
        models,
        responseTime,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          models: [],
          error: `请求超时 (${timeout}ms)`,
          responseTime,
        };
      }
      return {
        success: false,
        models: [],
        error: error.message,
        responseTime,
      };
    }

    return {
      success: false,
      models: [],
      error: '未知错误',
      responseTime,
    };
  }
}

// ==================== 统一入口 ====================

/**
 * 根据 API 配置获取模型列表
 * 自动根据 source 类型选择合适的获取方法
 *
 * @param config API 配置
 * @param options 额外选项
 * @returns 模型列表结果
 *
 * @example
 * ```typescript
 * import { fetchModels } from '@/services/ai/modelList'
 *
 * const result = await fetchModels({
 *   apiUrl: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx',
 *   source: 'openai'
 * })
 *
 * if (result.success) {
 *   console.log('可用模型:', result.models.map(m => m.id))
 * } else {
 *   console.error('获取失败:', result.error)
 * }
 * ```
 */
export async function fetchModels(
  config: Partial<ApiConfig> | FetchModelsOptions,
  options?: Partial<FetchModelsOptions>
): Promise<FetchModelsResult> {
  const mergedOptions: FetchModelsOptions = {
    apiUrl: config.apiUrl || '',
    apiKey: config.apiKey,
    source: config.source || 'openai',
    ...options,
  };

  switch (mergedOptions.source) {
    case 'anthropic':
      return fetchAnthropicModels(mergedOptions);

    case 'google':
      return fetchGoogleModels(mergedOptions);

    case 'openai':
    case 'deepseek':
    case 'custom':
    default:
      // OpenAI 兼容 API
      return fetchOpenAIModels(mergedOptions);
  }
}

// ==================== ModelListService 类 ====================

/**
 * ModelListService 类
 * 提供模型列表获取的面向对象接口，带缓存
 */
export class ModelListService {
  private cache: Map<string, { models: ModelInfo[]; timestamp: number }> = new Map();
  private cacheTTL: number;

  /**
   * @param cacheTTL 缓存有效期（毫秒），默认 5 分钟
   */
  constructor(cacheTTL = 5 * 60 * 1000) {
    this.cacheTTL = cacheTTL;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(options: FetchModelsOptions): string {
    return `${options.source || 'openai'}:${options.apiUrl}:${options.apiKey?.slice(-8) || 'no-key'}`;
  }

  /**
   * 获取模型列表（带缓存）
   */
  async getModels(
    config: Partial<ApiConfig> | FetchModelsOptions,
    options?: Partial<FetchModelsOptions> & { forceRefresh?: boolean }
  ): Promise<FetchModelsResult> {
    const mergedOptions: FetchModelsOptions = {
      apiUrl: config.apiUrl || '',
      apiKey: config.apiKey,
      source: config.source || 'openai',
      ...options,
    };

    const cacheKey = this.getCacheKey(mergedOptions);

    // 检查缓存
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return {
          success: true,
          models: cached.models,
          responseTime: 0,
        };
      }
    }

    // 获取新数据
    const result = await fetchModels(mergedOptions);

    // 缓存成功结果
    if (result.success) {
      this.cache.set(cacheKey, {
        models: result.models,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除特定配置的缓存
   */
  clearCacheFor(config: Partial<ApiConfig> | FetchModelsOptions): void {
    const cacheKey = this.getCacheKey({
      apiUrl: config.apiUrl || '',
      apiKey: config.apiKey,
      source: config.source || 'openai',
    });
    this.cache.delete(cacheKey);
  }
}

// ==================== 单例 ====================

let modelListServiceInstance: ModelListService | null = null;

/**
 * 获取 ModelListService 单例
 */
export function getModelListService(): ModelListService {
  if (!modelListServiceInstance) {
    modelListServiceInstance = new ModelListService();
  }
  return modelListServiceInstance;
}

/**
 * 重置 ModelListService 单例（用于测试）
 */
export function resetModelListService(): void {
  if (modelListServiceInstance) {
    modelListServiceInstance.clearCache();
  }
  modelListServiceInstance = null;
}
