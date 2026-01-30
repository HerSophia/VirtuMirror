/**
 * 速率限制处理
 * 自动处理 429 错误的重试逻辑
 */

import { sleep } from './utils';
import { loggerService } from '@/services/logger';

// 创建模块专属日志器
const logger = loggerService.child('ai:rate-limiter');

/**
 * 重试选项
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 基础延迟（毫秒） */
  baseDelay?: number;
  /** 最大延迟（毫秒） */
  maxDelay?: number;
  /** 是否应该重试的判断函数 */
  shouldRetry?: (error: any) => boolean;
}

/**
 * 默认重试判断
 */
function defaultShouldRetry(error: any): boolean {
  if (error.code === 'RATE_LIMIT') return true;
  if (error.message?.includes('429')) return true;
  if (error.status === 429) return true;
  return false;
}

/**
 * 自动处理 429 错误的重试逻辑
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 60000,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 检查是否应该重试
      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      // 指数退避 + 随机抖动
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      logger.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 带超时的 Promise 包装
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  message = '请求超时'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
