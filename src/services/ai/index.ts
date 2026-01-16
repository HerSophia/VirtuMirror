/**
 * AI Service 模块导出
 * 统一的 AI 生成服务
 */

// 核心服务
export { AIService, getAIService, resetAIService } from './aiService';

// 子模块
export { ProviderFactory } from './providerFactory';
export { ProviderManager, getProviderManager } from './providerManager';
export { RequestManager, getRequestManager } from './requestManager';
export { RequestQueue, getRequestQueue } from './requestQueue';
export { TavernAdapter, getTavernAdapter } from './tavernAdapter';

// 工具
export { withRateLimitRetry, withTimeout } from './rateLimiter';
export {
  createAIError,
  isRetryable,
  inferErrorCode,
  formatErrorMessage,
  generateRequestId,
  normalizeFinishReason,
  maskUrl,
  estimateTokens,
  sleep,
} from './utils';

// 常量
export {
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_QUEUE_CONFIG,
  PROVIDER_ENDPOINTS,
  PROVIDER_NAMES,
} from './constants';

// 枚举（必须作为值导出，不能用 export type）
export { RequestPriority } from './types';

// 类型
export type {
  // 生成选项
  GenerateOptions,
  StreamOptions,
  
  // 结果
  GenerateResult,
  StreamChunk,
  StreamHandle,
  FinishReason,
  TokenUsage,
  
  // Provider
  ProviderSource,
  ProviderInfo,
  ApiConfig,
  
  // 错误
  AIError,
  AIErrorCode,
  
  // 请求
  RequestStatus,
  RequestInfo,
  
  // 队列
  QueueConfig,
  QueuedRequest,
  QueueStatus,
  
  // 服务
  AIServiceConfig,
  IAIService,
} from './types';
