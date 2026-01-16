/**
 * AI Service 常量定义
 */

import type { QueueConfig } from './types';

/** 默认超时时间（毫秒） */
export const DEFAULT_TIMEOUT = 60000;

/** 默认最大 token 数 */
export const DEFAULT_MAX_TOKENS = 2048;

/** 默认温度 */
export const DEFAULT_TEMPERATURE = 0.7;

/** 默认队列配置 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrent: 3,
  maxRPM: 0, // 不限制
  minInterval: 100, // 100ms 最小间隔
  maxQueueSize: 100,
  queueTimeout: 300000, // 5 分钟
};

/** Provider 默认端点 */
export const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
};

/** Provider 显示名称 */
export const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  deepseek: 'DeepSeek',
  mock: 'Mock (Dev)',
  tavern: '酒馆 API',
};
