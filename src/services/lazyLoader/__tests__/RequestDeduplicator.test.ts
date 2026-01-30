/**
 * 请求去重器测试
 */

import { describe, it, expect, vi } from 'vitest';
import { RequestDeduplicator } from '../RequestDeduplicator';

describe('RequestDeduplicator', () => {
  describe('基础属性', () => {
    it('应该初始化为空', () => {
      const deduplicator = new RequestDeduplicator<string>();

      expect(deduplicator.pendingCount).toBe(0);
    });

    it('isPending 对于不存在的 key 应该返回 false', () => {
      const deduplicator = new RequestDeduplicator<string>();

      expect(deduplicator.isPending('nonexistent')).toBe(false);
    });
  });

  describe('dedupe 方法', () => {
    it('应该执行加载函数并返回结果', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      const loader = vi.fn().mockResolvedValue('result');

      const result = await deduplicator.dedupe('key1', loader);

      expect(result).toBe('result');
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('相同 key 的并发请求应该只执行一次 loader', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      let resolveLoader: (value: string) => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);

      // 发起两个相同 key 的请求
      const promise1 = deduplicator.dedupe('key1', loader);
      const promise2 = deduplicator.dedupe('key1', loader);

      // loader 应该只被调用一次
      expect(loader).toHaveBeenCalledTimes(1);

      // 两个请求都应该在等待中
      expect(deduplicator.isPending('key1')).toBe(true);

      // 解决 loader promise
      resolveLoader!('shared result');

      // 两个请求应该得到相同的结果
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('shared result');
      expect(result2).toBe('shared result');
    });

    it('不同 key 的请求应该独立执行', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      const loader1 = vi.fn().mockResolvedValue('result1');
      const loader2 = vi.fn().mockResolvedValue('result2');

      const [result1, result2] = await Promise.all([
        deduplicator.dedupe('key1', loader1),
        deduplicator.dedupe('key2', loader2),
      ]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(loader1).toHaveBeenCalledTimes(1);
      expect(loader2).toHaveBeenCalledTimes(1);
    });

    it('完成后应该从 pending 中移除', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      const loader = vi.fn().mockResolvedValue('result');

      expect(deduplicator.isPending('key1')).toBe(false);

      const promise = deduplicator.dedupe('key1', loader);
      // 在 loader 同步返回的情况下，这里可能已经不 pending 了
      // 所以我们使用异步 loader 来测试

      await promise;

      expect(deduplicator.isPending('key1')).toBe(false);
      expect(deduplicator.pendingCount).toBe(0);
    });

    it('同一个 key 完成后可以再次请求', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      const loader = vi.fn()
        .mockResolvedValueOnce('first')
        .mockResolvedValueOnce('second');

      const result1 = await deduplicator.dedupe('key1', loader);
      expect(result1).toBe('first');

      const result2 = await deduplicator.dedupe('key1', loader);
      expect(result2).toBe('second');

      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe('错误处理', () => {
    it('应该传递 loader 的错误', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      const error = new Error('loader error');
      const loader = vi.fn().mockRejectedValue(error);

      await expect(deduplicator.dedupe('key1', loader)).rejects.toThrow('loader error');
    });

    it('错误应该传递给所有等待者', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      let rejectLoader: (error: Error) => void;
      const loaderPromise = new Promise<string>((_, reject) => {
        rejectLoader = reject;
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);

      const promise1 = deduplicator.dedupe('key1', loader);
      const promise2 = deduplicator.dedupe('key1', loader);

      const error = new Error('shared error');
      rejectLoader!(error);

      await expect(promise1).rejects.toThrow('shared error');
      await expect(promise2).rejects.toThrow('shared error');
    });

    it('错误后应该从 pending 中移除', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      const loader = vi.fn().mockRejectedValue(new Error('error'));

      try {
        await deduplicator.dedupe('key1', loader);
      } catch {
        // 忽略错误
      }

      expect(deduplicator.isPending('key1')).toBe(false);
      expect(deduplicator.pendingCount).toBe(0);
    });
  });

  describe('clear 方法', () => {
    it('应该清空所有等待的请求', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      let resolveLoader: () => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = () => resolve('result');
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);

      const promise1 = deduplicator.dedupe('key1', loader);
      const promise2 = deduplicator.dedupe('key1', loader);
      const promise3 = deduplicator.dedupe('key2', loader);

      expect(deduplicator.pendingCount).toBe(2);

      deduplicator.clear();

      expect(deduplicator.pendingCount).toBe(0);

      // 等待者应该收到取消错误
      await expect(promise2).rejects.toThrow('Request cancelled');

      // 原始请求（非等待者）在 clear 后会继续，因为 promise 已经在执行中
      // 但由于 pending map 已经被清空，后续的 resolve/reject 不会再通知任何人
      resolveLoader!();

      // promise1 和 promise3 应该最终解决（虽然 pending map 已清空，但原始 promise 仍在执行）
      // 注意：这取决于实现细节，当前实现中原始调用者会正常完成
    });

    it('clear 后应该能够重新发起请求', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      let resolveFirst: () => void;
      const firstPromise = new Promise<string>((resolve) => {
        resolveFirst = () => resolve('first');
      });
      const firstLoader = vi.fn().mockReturnValue(firstPromise);

      deduplicator.dedupe('key1', firstLoader);
      deduplicator.clear();

      // 应该能够发起新请求
      const secondLoader = vi.fn().mockResolvedValue('second');
      const result = await deduplicator.dedupe('key1', secondLoader);

      expect(result).toBe('second');
      expect(secondLoader).toHaveBeenCalledTimes(1);
    });
  });

  describe('pendingCount', () => {
    it('应该正确跟踪并发请求数', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      const resolvers: Array<(value: string) => void> = [];

      const createLoader = () => new Promise<string>((resolve) => {
        resolvers.push(resolve);
      });

      // 发起 3 个不同 key 的请求
      deduplicator.dedupe('key1', () => createLoader());
      deduplicator.dedupe('key2', () => createLoader());
      deduplicator.dedupe('key3', () => createLoader());

      expect(deduplicator.pendingCount).toBe(3);

      // 完成一个
      resolvers[0]('result1');
      await Promise.resolve(); // 等待微任务完成

      expect(deduplicator.pendingCount).toBe(2);

      // 完成剩余的
      resolvers[1]('result2');
      resolvers[2]('result3');
      await Promise.resolve();
      await Promise.resolve();

      expect(deduplicator.pendingCount).toBe(0);
    });
  });

  describe('多等待者场景', () => {
    it('应该支持多个等待者', async () => {
      const deduplicator = new RequestDeduplicator<string>();
      let resolveLoader: (value: string) => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);

      // 发起多个相同 key 的请求
      const promises = [
        deduplicator.dedupe('key1', loader),
        deduplicator.dedupe('key1', loader),
        deduplicator.dedupe('key1', loader),
        deduplicator.dedupe('key1', loader),
        deduplicator.dedupe('key1', loader),
      ];

      expect(loader).toHaveBeenCalledTimes(1);

      resolveLoader!('shared result');

      const results = await Promise.all(promises);
      expect(results).toEqual([
        'shared result',
        'shared result',
        'shared result',
        'shared result',
        'shared result',
      ]);
    });
  });

  describe('undefined 返回值', () => {
    it('应该正确处理 undefined 返回值', async () => {
      const deduplicator = new RequestDeduplicator<string | undefined>();
      const loader = vi.fn().mockResolvedValue(undefined);

      const result = await deduplicator.dedupe('key1', loader);

      expect(result).toBeUndefined();
    });

    it('等待者也应该收到 undefined', async () => {
      const deduplicator = new RequestDeduplicator<string | undefined>();
      let resolveLoader: (value: string | undefined) => void;
      const loaderPromise = new Promise<string | undefined>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);

      const promise1 = deduplicator.dedupe('key1', loader);
      const promise2 = deduplicator.dedupe('key1', loader);

      resolveLoader!(undefined);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });
});
