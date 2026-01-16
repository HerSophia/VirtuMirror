/**
 * AI Service 工具函数
 */

import type { AIError, AIErrorCode, FinishReason } from './types';

/**
 * 创建 AI 错误
 */
export function createAIError(
  code: AIErrorCode,
  message: string,
  options?: {
    cause?: Error;
    requestId?: string;
    status?: number;
  }
): AIError {
  return {
    code,
    message,
    cause: options?.cause,
    requestId: options?.requestId,
    status: options?.status,
    retryable: isRetryable(code),
  };
}

/**
 * 判断错误是否可重试
 */
export function isRetryable(code: AIErrorCode): boolean {
  return ['RATE_LIMIT', 'NETWORK_ERROR', 'TIMEOUT', 'PROVIDER_NOT_READY'].includes(code);
}

/**
 * 从原生错误推断错误码
 */
export function inferErrorCode(error: Error): AIErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes('abort') || error.name === 'AbortError') {
    return 'ABORTED';
  }
  if (message.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('api key')) {
    return 'AUTH_ERROR';
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return 'RATE_LIMIT';
  }
  if (message.includes('content') && message.includes('filter')) {
    return 'CONTENT_FILTER';
  }

  return 'UNKNOWN';
}

/**
 * 格式化错误消息（用于 UI 显示）
 */
export function formatErrorMessage(error: AIError): string {
  const messages: Record<AIErrorCode, string> = {
    PROVIDER_NOT_READY: '服务未就绪，请稍后重试',
    PROVIDER_ERROR: `生成失败: ${error.message}`,
    NETWORK_ERROR: '网络连接失败，请检查网络',
    TIMEOUT: '请求超时，请重试',
    ABORTED: '已取消',
    RATE_LIMIT: '请求过于频繁，请稍后重试',
    AUTH_ERROR: 'API 认证失败，请检查配置',
    INVALID_REQUEST: '请求参数错误',
    CONTENT_FILTER: '内容被安全策略拦截',
    QUEUE_FULL: '请求队列已满，请稍后重试',
    UNKNOWN: '未知错误',
  };

  return messages[error.code] || error.message;
}

/**
 * 生成请求 ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 转换 finish reason
 */
export function normalizeFinishReason(reason: string | undefined | null): FinishReason {
  if (!reason) return 'unknown';
  
  const normalized = reason.toLowerCase();
  
  if (normalized === 'stop' || normalized === 'end_turn') return 'stop';
  if (normalized === 'length' || normalized === 'max_tokens') return 'length';
  if (normalized.includes('content') || normalized.includes('filter')) return 'content-filter';
  if (normalized.includes('tool')) return 'tool-calls';
  if (normalized === 'error') return 'error';
  
  return 'other';
}

/**
 * URL 脱敏
 */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/...`;
  } catch {
    return '***';
  }
}

/**
 * 估算 token 数量
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
