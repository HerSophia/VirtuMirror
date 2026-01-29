/**
 * 速率限制处理测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRateLimitRetry, withTimeout } from '../rateLimiter';

describe('rateLimiter', () => {
  describe('withRateLimitRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该在成功时直接返回结果', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = withRateLimitRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该在 429 错误时重试', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ message: '429 Too Many Requests' })
        .mockResolvedValue('success');

      const resultPromise = withRateLimitRetry(fn, { baseDelay: 100 });
      
      // 运行所有定时器
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('应该在 RATE_LIMIT 错误码时重试', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'RATE_LIMIT' })
        .mockResolvedValue('success');

      const resultPromise = withRateLimitRetry(fn, { baseDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('应该在 status 429 时重试', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValue('success');

      const resultPromise = withRateLimitRetry(fn, { baseDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('应该在非速率限制错误时立即抛出', async () => {
      vi.useRealTimers(); // 需要使用真实定时器来正确捕获错误
      const error = new Error('Some other error');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRateLimitRetry(fn)).rejects.toThrow('Some other error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      vi.useRealTimers(); // 使用真实定时器以正确处理 rejection
      const error = { message: '429 Too Many Requests' };
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        withRateLimitRetry(fn, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(3); // 初始 + 2 次重试
    });

    it('应该使用自定义的 shouldRetry 函数', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ customCode: 'RETRY_ME' })
        .mockResolvedValue('success');

      const resultPromise = withRateLimitRetry(fn, {
        baseDelay: 100,
        shouldRetry: (error) => error.customCode === 'RETRY_ME',
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('应该限制最大延迟', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'RATE_LIMIT' })
        .mockResolvedValue('success');

      const resultPromise = withRateLimitRetry(fn, {
        baseDelay: 100000, // 很大的基础延迟
        maxDelay: 1000, // 但限制最大延迟
      });
      
      // 应该在 maxDelay 后重试
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;
      expect(result).toBe('success');
    });
  });

  describe('withTimeout', () => {
    it('应该在 Promise 完成前返回结果', async () => {
      const promise = Promise.resolve('success');

      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('应该在超时时抛出错误', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      await expect(withTimeout(promise, 50)).rejects.toThrow('请求超时');
    });

    it('应该使用自定义超时消息', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      await expect(withTimeout(promise, 50, '自定义超时消息')).rejects.toThrow('自定义超时消息');
    });

    it('应该在 Promise 拒绝时传递错误', async () => {
      const error = new Error('Promise rejected');
      const promise = Promise.reject(error);

      await expect(withTimeout(promise, 1000)).rejects.toThrow('Promise rejected');
    });

    it('应该在成功后清除超时定时器', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = Promise.resolve('success');
      await withTimeout(promise, 1000);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
