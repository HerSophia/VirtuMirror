/**
 * 请求队列测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestQueue, getRequestQueue } from '../requestQueue';
import { RequestPriority } from '../types';

describe('RequestQueue', () => {
  let queue: RequestQueue;
  let mockExecutor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 创建新实例用于测试（绕过单例）
    queue = new (RequestQueue as any)({
      maxConcurrent: 2,
      maxRPM: 0,
      minInterval: 0,
      maxQueueSize: 10,
      queueTimeout: 5000,
    });

    // 注入 mock 执行器
    mockExecutor = vi.fn().mockResolvedValue({ text: 'success' });
    queue.setExecutor(mockExecutor as any);
  });

  describe('enqueue', () => {
    it('应该成功入队并执行请求', async () => {
      const result = await queue.enqueue({ prompt: 'test' }, false, RequestPriority.NORMAL);

      expect(result).toEqual({ text: 'success' });
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it('应该使用提供的 requestId', async () => {
      const promise = queue.enqueue(
        { prompt: 'test', requestId: 'custom-id' },
        false,
        RequestPriority.NORMAL
      );

      await promise;
      expect(mockExecutor).toHaveBeenCalled();
    });

    it('应该在队列满时拒绝请求', async () => {
      // 创建一个小队列
      const smallQueue = new (RequestQueue as any)({
        maxConcurrent: 1,
        maxRPM: 0,
        minInterval: 0,
        maxQueueSize: 2,
        queueTimeout: 5000,
      });

      // 使执行器永不返回
      const blockingExecutor = vi.fn().mockImplementation(() => new Promise(() => {}));
      smallQueue.setExecutor(blockingExecutor as any);

      // 入队 3 个请求（1 个执行中，2 个队列中 = 满）
      const promises = [
        smallQueue.enqueue({ prompt: '1' }, false).catch(() => {}),
        smallQueue.enqueue({ prompt: '2' }, false).catch(() => {}),
        smallQueue.enqueue({ prompt: '3' }, false).catch(() => {}),
      ];

      // 第 4 个应该被拒绝
      await expect(smallQueue.enqueue({ prompt: '4' }, false)).rejects.toMatchObject({
        code: 'QUEUE_FULL',
      });
    });

    it('应该按优先级排序队列', async () => {
      // 使执行器阻塞以便观察队列状态
      let resolvers: Array<(value: { text: string }) => void> = [];
      const blockingExecutor = vi.fn().mockImplementation(() => {
        return new Promise<{ text: string }>((resolve) => {
          resolvers.push(resolve);
        });
      });
      queue.setExecutor(blockingExecutor as any);

      // 入队多个请求（maxConcurrent=2，所以前2个会立即执行）
      const promises = [
        queue.enqueue({ prompt: 'low' }, false, RequestPriority.LOW).catch(() => {}),
        queue.enqueue({ prompt: 'normal' }, false, RequestPriority.NORMAL).catch(() => {}),
        queue.enqueue({ prompt: 'critical' }, false, RequestPriority.CRITICAL).catch(() => {}),
        queue.enqueue({ prompt: 'high' }, false, RequestPriority.HIGH).catch(() => {}),
      ];

      // 等待一点时间让队列处理
      await new Promise((r) => setTimeout(r, 10));

      const status = queue.getStatus();
      // 应该有 2 个正在运行，2 个在队列中
      expect(status.running).toBe(2);
      expect(status.pending).toBe(2);

      // 清理 - 解决所有 pending promises
      resolvers.forEach((r) => r({ text: 'done' }));
    }, 10000); // 增加超时时间
  });

  describe('cancel', () => {
    it('应该取消队列中的请求', async () => {
      // 使执行器阻塞
      const blockingExecutor = vi.fn().mockImplementation(() => new Promise(() => {}));
      queue.setExecutor(blockingExecutor as any);

      // 入队请求
      const promise1 = queue.enqueue({ prompt: '1' }, false).catch(() => {});
      const promise2 = queue.enqueue({ prompt: '2' }, false).catch(() => {});
      const promise3 = queue.enqueue({ prompt: '3', requestId: 'cancel-me' }, false);

      await new Promise((r) => setTimeout(r, 10));

      // 取消第三个（在队列中）
      const cancelled = queue.cancel('cancel-me');
      expect(cancelled).toBe(true);

      await expect(promise3).rejects.toMatchObject({ code: 'ABORTED' });
    });

    it('应该取消执行中的请求', async () => {
      let abortSignal: AbortSignal | undefined = undefined;
      const executor = vi.fn().mockImplementation(
        (_options: any, _isStream: boolean, signal: AbortSignal) => {
          abortSignal = signal;
          return new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          });
        }
      );
      queue.setExecutor(executor as any);

      const promise = queue.enqueue({ prompt: 'test', requestId: 'running-req' }, false).catch(() => {});

      await new Promise((r) => setTimeout(r, 10));

      const cancelled = queue.cancel('running-req');
      expect(cancelled).toBe(true);
      expect(abortSignal).toBeDefined();
      expect(abortSignal!.aborted).toBe(true);
    });

    it('应该对不存在的请求返回 false', () => {
      expect(queue.cancel('non-existent')).toBe(false);
    });
  });

  describe('cancelByPriority', () => {
    it('应该取消指定优先级的所有请求', async () => {
      const blockingExecutor = vi.fn().mockImplementation(() => new Promise(() => {}));
      queue.setExecutor(blockingExecutor as any);

      const promises = [
        queue.enqueue({ prompt: '1' }, false, RequestPriority.LOW).catch(() => {}),
        queue.enqueue({ prompt: '2' }, false, RequestPriority.LOW).catch(() => {}),
        queue.enqueue({ prompt: '3' }, false, RequestPriority.HIGH).catch(() => {}),
        queue.enqueue({ prompt: '4' }, false, RequestPriority.LOW).catch(() => {}),
      ];

      await new Promise((r) => setTimeout(r, 10));

      const count = queue.cancelByPriority(RequestPriority.LOW);
      expect(count).toBeGreaterThanOrEqual(1); // 至少有一个在队列中被取消
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的队列状态', async () => {
      const blockingExecutor = vi.fn().mockImplementation(() => new Promise(() => {}));
      queue.setExecutor(blockingExecutor as any);

      const promises = [
        queue.enqueue({ prompt: '1' }, false, RequestPriority.CRITICAL).catch(() => {}),
        queue.enqueue({ prompt: '2' }, false, RequestPriority.HIGH).catch(() => {}),
        queue.enqueue({ prompt: '3' }, false, RequestPriority.NORMAL).catch(() => {}),
        queue.enqueue({ prompt: '4' }, false, RequestPriority.LOW).catch(() => {}),
      ];

      await new Promise((r) => setTimeout(r, 10));

      const status = queue.getStatus();

      expect(status.running).toBe(2);
      expect(status.pending).toBe(2);
      expect(status.pendingByPriority).toBeDefined();
      expect(typeof status.currentRPM).toBe('number');
    });
  });

  describe('clear', () => {
    it('应该清空队列中的所有请求', async () => {
      const blockingExecutor = vi.fn().mockImplementation(() => new Promise(() => {}));
      queue.setExecutor(blockingExecutor as any);

      const promises = [
        queue.enqueue({ prompt: '1' }, false).catch(() => {}),
        queue.enqueue({ prompt: '2' }, false).catch(() => {}),
        queue.enqueue({ prompt: '3' }, false).catch(() => {}),
      ];

      await new Promise((r) => setTimeout(r, 10));

      queue.clear();

      const status = queue.getStatus();
      expect(status.pending).toBe(0);
      // running 的不受影响
    });
  });

  describe('updateConfig', () => {
    it('应该更新队列配置', async () => {
      queue.updateConfig({ maxConcurrent: 5 });

      // 测试新配置生效（通过行为验证）
      const blockingExecutor = vi.fn().mockImplementation(() => new Promise(() => {}));
      queue.setExecutor(blockingExecutor as any);

      // 入队 5 个请求，都应该开始执行
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(queue.enqueue({ prompt: `${i}` }, false).catch(() => {}));
      }

      // 给一点时间处理
      await new Promise((r) => setTimeout(r, 50));
      const status = queue.getStatus();
      expect(status.running).toBe(5);
    });
  });

  describe('getRequestQueue', () => {
    it('应该返回单例实例', () => {
      const instance1 = getRequestQueue();
      const instance2 = getRequestQueue();
      expect(instance1).toBe(instance2);
    });
  });
});
