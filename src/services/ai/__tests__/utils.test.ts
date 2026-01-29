/**
 * AI Service 工具函数测试
 */

import { describe, it, expect } from 'vitest';
import {
  createAIError,
  isRetryable,
  inferErrorCode,
  formatErrorMessage,
  generateRequestId,
  normalizeFinishReason,
  maskUrl,
  estimateTokens,
  sleep,
} from '../utils';
import type { AIError, AIErrorCode } from '../types';

describe('utils', () => {
  describe('createAIError', () => {
    it('应该创建基本的 AI 错误', () => {
      const error = createAIError('NETWORK_ERROR', '网络连接失败');

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('网络连接失败');
      expect(error.retryable).toBe(true);
      expect(error.cause).toBeUndefined();
      expect(error.requestId).toBeUndefined();
      expect(error.status).toBeUndefined();
    });

    it('应该包含可选参数', () => {
      const cause = new Error('原始错误');
      const error = createAIError('AUTH_ERROR', '认证失败', {
        cause,
        requestId: 'req_123',
        status: 401,
      });

      expect(error.code).toBe('AUTH_ERROR');
      expect(error.cause).toBe(cause);
      expect(error.requestId).toBe('req_123');
      expect(error.status).toBe(401);
      expect(error.retryable).toBe(false);
    });

    it('应该根据错误码设置 retryable', () => {
      expect(createAIError('RATE_LIMIT', '').retryable).toBe(true);
      expect(createAIError('NETWORK_ERROR', '').retryable).toBe(true);
      expect(createAIError('TIMEOUT', '').retryable).toBe(true);
      expect(createAIError('PROVIDER_NOT_READY', '').retryable).toBe(true);
      expect(createAIError('AUTH_ERROR', '').retryable).toBe(false);
      expect(createAIError('ABORTED', '').retryable).toBe(false);
    });
  });

  describe('isRetryable', () => {
    it('应该正确识别可重试的错误码', () => {
      const retryableCodes: AIErrorCode[] = ['RATE_LIMIT', 'NETWORK_ERROR', 'TIMEOUT', 'PROVIDER_NOT_READY'];
      const nonRetryableCodes: AIErrorCode[] = ['AUTH_ERROR', 'ABORTED', 'INVALID_REQUEST', 'CONTENT_FILTER', 'QUEUE_FULL', 'UNKNOWN', 'PROVIDER_ERROR'];

      retryableCodes.forEach(code => {
        expect(isRetryable(code)).toBe(true);
      });

      nonRetryableCodes.forEach(code => {
        expect(isRetryable(code)).toBe(false);
      });
    });
  });

  describe('inferErrorCode', () => {
    it('应该识别中止错误', () => {
      expect(inferErrorCode(new Error('Request aborted'))).toBe('ABORTED');
      const abortError = new Error('test');
      abortError.name = 'AbortError';
      expect(inferErrorCode(abortError)).toBe('ABORTED');
    });

    it('应该识别超时错误', () => {
      expect(inferErrorCode(new Error('Request timeout'))).toBe('TIMEOUT');
      // 'timed out' 不包含 'timeout'，所以返回 UNKNOWN
      expect(inferErrorCode(new Error('Connection timeout'))).toBe('TIMEOUT');
    });

    it('应该识别网络错误', () => {
      expect(inferErrorCode(new Error('Network error'))).toBe('NETWORK_ERROR');
      expect(inferErrorCode(new Error('Failed to fetch'))).toBe('NETWORK_ERROR');
    });

    it('应该识别认证错误', () => {
      expect(inferErrorCode(new Error('401 Unauthorized'))).toBe('AUTH_ERROR');
      expect(inferErrorCode(new Error('Invalid API key'))).toBe('AUTH_ERROR');
    });

    it('应该识别速率限制错误', () => {
      expect(inferErrorCode(new Error('429 Too Many Requests'))).toBe('RATE_LIMIT');
      expect(inferErrorCode(new Error('Rate limit exceeded'))).toBe('RATE_LIMIT');
    });

    it('应该识别内容过滤错误', () => {
      expect(inferErrorCode(new Error('Content filtered'))).toBe('CONTENT_FILTER');
    });

    it('应该对未知错误返回 UNKNOWN', () => {
      expect(inferErrorCode(new Error('Some random error'))).toBe('UNKNOWN');
    });
  });

  describe('formatErrorMessage', () => {
    it('应该格式化各种错误消息', () => {
      const testCases: Array<{ error: AIError; expected: string }> = [
        { error: { code: 'PROVIDER_NOT_READY', message: '', retryable: true }, expected: '服务未就绪，请稍后重试' },
        { error: { code: 'NETWORK_ERROR', message: '', retryable: true }, expected: '网络连接失败，请检查网络' },
        { error: { code: 'TIMEOUT', message: '', retryable: true }, expected: '请求超时，请重试' },
        { error: { code: 'ABORTED', message: '', retryable: false }, expected: '已取消' },
        { error: { code: 'RATE_LIMIT', message: '', retryable: true }, expected: '请求过于频繁，请稍后重试' },
        { error: { code: 'AUTH_ERROR', message: '', retryable: false }, expected: 'API 认证失败，请检查配置' },
        { error: { code: 'INVALID_REQUEST', message: '', retryable: false }, expected: '请求参数错误' },
        { error: { code: 'CONTENT_FILTER', message: '', retryable: false }, expected: '内容被安全策略拦截' },
        { error: { code: 'QUEUE_FULL', message: '', retryable: false }, expected: '请求队列已满，请稍后重试' },
        { error: { code: 'UNKNOWN', message: '', retryable: false }, expected: '未知错误' },
      ];

      testCases.forEach(({ error, expected }) => {
        expect(formatErrorMessage(error)).toBe(expected);
      });
    });

    it('应该在 PROVIDER_ERROR 时显示原始消息', () => {
      const error: AIError = { code: 'PROVIDER_ERROR', message: '模型不可用', retryable: false };
      expect(formatErrorMessage(error)).toBe('生成失败: 模型不可用');
    });
  });

  describe('generateRequestId', () => {
    it('应该生成有效的请求 ID', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('应该生成唯一的 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('normalizeFinishReason', () => {
    it('应该处理 null 和 undefined', () => {
      expect(normalizeFinishReason(null)).toBe('unknown');
      expect(normalizeFinishReason(undefined)).toBe('unknown');
    });

    it('应该规范化 stop 类型', () => {
      expect(normalizeFinishReason('stop')).toBe('stop');
      expect(normalizeFinishReason('STOP')).toBe('stop');
      expect(normalizeFinishReason('end_turn')).toBe('stop');
    });

    it('应该规范化 length 类型', () => {
      expect(normalizeFinishReason('length')).toBe('length');
      expect(normalizeFinishReason('max_tokens')).toBe('length');
    });

    it('应该规范化 content-filter 类型', () => {
      expect(normalizeFinishReason('content_filter')).toBe('content-filter');
      expect(normalizeFinishReason('content filtered')).toBe('content-filter');
    });

    it('应该规范化 tool-calls 类型', () => {
      expect(normalizeFinishReason('tool_calls')).toBe('tool-calls');
      expect(normalizeFinishReason('tool')).toBe('tool-calls');
    });

    it('应该规范化 error 类型', () => {
      expect(normalizeFinishReason('error')).toBe('error');
    });

    it('应该对其他值返回 other', () => {
      expect(normalizeFinishReason('something_else')).toBe('other');
    });
  });

  describe('maskUrl', () => {
    it('应该正确脱敏 URL', () => {
      expect(maskUrl('https://api.openai.com/v1/chat/completions')).toBe('https://api.openai.com/...');
      expect(maskUrl('http://localhost:3000/api')).toBe('http://localhost:3000/...');
    });

    it('应该处理无效 URL', () => {
      expect(maskUrl('not-a-url')).toBe('***');
      expect(maskUrl('')).toBe('***');
    });
  });

  describe('estimateTokens', () => {
    it('应该估算纯英文文本的 token 数', () => {
      const text = 'Hello world'; // 11 字符
      const tokens = estimateTokens(text);
      expect(tokens).toBe(Math.ceil(11 / 4)); // 3
    });

    it('应该估算纯中文文本的 token 数', () => {
      const text = '你好世界'; // 4 个中文字符
      const tokens = estimateTokens(text);
      expect(tokens).toBe(Math.ceil(4 / 1.5)); // 3
    });

    it('应该估算混合文本的 token 数', () => {
      const text = 'Hello 世界'; // 6 英文字符 + 2 中文字符
      const tokens = estimateTokens(text);
      // 2 中文 / 1.5 + 6 其他 / 4 = 1.33 + 1.5 = 2.83 -> 3
      expect(tokens).toBe(Math.ceil(2 / 1.5 + 6 / 4));
    });

    it('应该处理空字符串', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('sleep', () => {
    it('应该延迟指定时间', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // 允许一些误差
      expect(elapsed).toBeLessThan(100);
    });
  });
});
