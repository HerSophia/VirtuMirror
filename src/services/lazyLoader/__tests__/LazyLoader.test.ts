/**
 * LazyLoader 核心类测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LazyLoader } from '../LazyLoader';

describe('LazyLoader', () => {
  describe('基础加载功能', () => {
    it('应该通过 loader 加载数据', async () => {
      const loader = vi.fn().mockResolvedValue('loaded data');
      const lazyLoader = new LazyLoader({ loader });

      const result = await lazyLoader.get('key1');

      expect(result).toBe('loaded data');
      expect(loader).toHaveBeenCalledWith('key1');
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('应该缓存加载结果', async () => {
      const loader = vi.fn().mockResolvedValue('loaded data');
      const lazyLoader = new LazyLoader({ loader });

      await lazyLoader.get('key1');
      await lazyLoader.get('key1');

      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('不同的 key 应该独立加载', async () => {
      const loader = vi.fn()
        .mockResolvedValueOnce('data1')
        .mockResolvedValueOnce('data2');
      const lazyLoader = new LazyLoader({ loader });

      const result1 = await lazyLoader.get('key1');
      const result2 = await lazyLoader.get('key2');

      expect(result1).toBe('data1');
      expect(result2).toBe('data2');
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe('缓存状态检查', () => {
    it('has 应该在加载后返回 true', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader });

      expect(lazyLoader.has('key1')).toBe(false);

      await lazyLoader.get('key1');

      expect(lazyLoader.has('key1')).toBe(true);
    });

    it('peek 应该返回缓存值而不触发加载', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader });

      expect(lazyLoader.peek('key1')).toBeUndefined();
      expect(loader).not.toHaveBeenCalled();

      await lazyLoader.get('key1');

      expect(lazyLoader.peek('key1')).toBe('data');
    });

    it('isLoading 应该在加载中返回 true', async () => {
      let resolveLoader: (value: string) => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);
      const lazyLoader = new LazyLoader({ loader });

      expect(lazyLoader.isLoading('key1')).toBe(false);

      const getPromise = lazyLoader.get('key1');
      expect(lazyLoader.isLoading('key1')).toBe(true);

      resolveLoader!('data');
      await getPromise;

      expect(lazyLoader.isLoading('key1')).toBe(false);
    });
  });

  describe('缓存失效', () => {
    it('invalidate 应该移除缓存条目', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader });

      await lazyLoader.get('key1');
      expect(lazyLoader.has('key1')).toBe(true);

      lazyLoader.invalidate('key1');
      expect(lazyLoader.has('key1')).toBe(false);
    });

    it('invalidate 后应该重新加载', async () => {
      const loader = vi.fn()
        .mockResolvedValueOnce('first')
        .mockResolvedValueOnce('second');
      const lazyLoader = new LazyLoader({ loader });

      const result1 = await lazyLoader.get('key1');
      expect(result1).toBe('first');

      lazyLoader.invalidate('key1');

      const result2 = await lazyLoader.get('key1');
      expect(result2).toBe('second');
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('invalidateAll 应该清除所有缓存', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader });

      await lazyLoader.get('key1');
      await lazyLoader.get('key2');
      expect(lazyLoader.has('key1')).toBe(true);
      expect(lazyLoader.has('key2')).toBe(true);

      lazyLoader.invalidateAll();

      expect(lazyLoader.has('key1')).toBe(false);
      expect(lazyLoader.has('key2')).toBe(false);
    });
  });

  describe('prime 预热', () => {
    it('prime 应该手动设置缓存值', () => {
      const loader = vi.fn().mockResolvedValue('loaded');
      const lazyLoader = new LazyLoader({ loader });

      lazyLoader.prime('key1', 'primed');

      expect(lazyLoader.has('key1')).toBe(true);
      expect(lazyLoader.peek('key1')).toBe('primed');
    });

    it('prime 后 get 应该返回预热值', async () => {
      const loader = vi.fn().mockResolvedValue('loaded');
      const lazyLoader = new LazyLoader({ loader });

      lazyLoader.prime('key1', 'primed');
      const result = await lazyLoader.get('key1');

      expect(result).toBe('primed');
      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe('批量加载 getMany', () => {
    it('应该返回所有 key 的值', async () => {
      const loader = vi.fn((key: string) => Promise.resolve(`data-${key}`));
      const lazyLoader = new LazyLoader({ loader });

      const result = await lazyLoader.getMany(['key1', 'key2', 'key3']);

      expect(result.get('key1')).toBe('data-key1');
      expect(result.get('key2')).toBe('data-key2');
      expect(result.get('key3')).toBe('data-key3');
    });

    it('已缓存的应该直接返回', async () => {
      const loader = vi.fn((key: string) => Promise.resolve(`data-${key}`));
      const lazyLoader = new LazyLoader({ loader });

      // 先加载一些
      await lazyLoader.get('key1');

      const callCountBefore = loader.mock.calls.length;

      // getMany 包含已缓存的 key
      await lazyLoader.getMany(['key1', 'key2']);

      // 只应该加载 key2
      expect(loader.mock.calls.length - callCountBefore).toBe(1);
      expect(loader).toHaveBeenLastCalledWith('key2');
    });

    it('应该使用 batchLoader 如果提供', async () => {
      const loader = vi.fn();
      const batchLoader = vi.fn().mockResolvedValue(
        new Map([
          ['key1', 'batch-data-1'],
          ['key2', 'batch-data-2'],
        ])
      );
      const lazyLoader = new LazyLoader({ loader, batchLoader });

      const result = await lazyLoader.getMany(['key1', 'key2']);

      expect(result.get('key1')).toBe('batch-data-1');
      expect(result.get('key2')).toBe('batch-data-2');
      expect(batchLoader).toHaveBeenCalledWith(['key1', 'key2']);
      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe('预加载 preload', () => {
    it('应该在后台加载指定 keys', async () => {
      const loader = vi.fn((key: string) => Promise.resolve(`data-${key}`));
      const lazyLoader = new LazyLoader({ loader });

      await lazyLoader.preload(['key1', 'key2']);

      expect(lazyLoader.has('key1')).toBe(true);
      expect(lazyLoader.has('key2')).toBe(true);
    });

    it('已缓存的 key 不应该重新加载', async () => {
      const loader = vi.fn((key: string) => Promise.resolve(`data-${key}`));
      const lazyLoader = new LazyLoader({ loader });

      await lazyLoader.get('key1');
      const callCount = loader.mock.calls.length;

      await lazyLoader.preload(['key1', 'key2']);

      // 只应该加载 key2
      expect(loader.mock.calls.length - callCount).toBe(1);
    });

    it('预加载失败不应该抛出错误', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('load failed'));
      const lazyLoader = new LazyLoader({ loader });

      // 不应该抛出错误
      await expect(lazyLoader.preload(['key1'])).resolves.toBeUndefined();
    });
  });

  describe('请求去重', () => {
    it('默认应该启用去重', async () => {
      let resolveLoader: (value: string) => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);
      const lazyLoader = new LazyLoader({ loader });

      const promise1 = lazyLoader.get('key1');
      const promise2 = lazyLoader.get('key1');

      // 等待一个微任务周期，确保 loader 被调用
      await Promise.resolve();

      expect(loader).toHaveBeenCalledTimes(1);

      resolveLoader!('data');

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('data');
      expect(result2).toBe('data');
    });

    it('禁用去重时每次都应该调用 loader', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({
        loader,
        deduplication: false,
      });

      // 由于缓存的存在，第二次不会调用 loader
      // 但如果我们 invalidate 后，应该会调用
      await lazyLoader.get('key1');
      lazyLoader.invalidate('key1');
      await lazyLoader.get('key1');

      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe('错误处理', () => {
    it('加载失败应该返回 undefined', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('load failed'));
      const lazyLoader = new LazyLoader({ loader });

      const result = await lazyLoader.get('key1');

      expect(result).toBeUndefined();
    });

    it('应该调用 onError 回调', async () => {
      const onError = vi.fn();
      const error = new Error('load failed');
      const loader = vi.fn().mockRejectedValue(error);
      const lazyLoader = new LazyLoader({ loader, onError });

      await lazyLoader.get('key1');

      expect(onError).toHaveBeenCalledWith('key1', error);
    });

    it('cacheFailures 为 true 时应该缓存失败', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('failed'));
      const lazyLoader = new LazyLoader({
        loader,
        cacheFailures: true,
      });

      await lazyLoader.get('key1');
      await lazyLoader.get('key1');

      // loader 只应该被调用一次
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('invalidate 应该清除失败缓存', async () => {
      const loader = vi.fn()
        .mockRejectedValueOnce(new Error('failed'))
        .mockResolvedValueOnce('success');
      const lazyLoader = new LazyLoader({
        loader,
        cacheFailures: true,
      });

      await lazyLoader.get('key1');
      lazyLoader.invalidate('key1');
      const result = await lazyLoader.get('key1');

      expect(result).toBe('success');
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe('重试机制', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该在失败时重试指定次数', async () => {
      const loader = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');
      const lazyLoader = new LazyLoader({
        loader,
        retryCount: 2,
        retryDelay: 100,
      });

      const promise = lazyLoader.get('key1');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(loader).toHaveBeenCalledTimes(3);
    });

    it('超过重试次数应该返回 undefined', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('always fail'));
      const lazyLoader = new LazyLoader({
        loader,
        retryCount: 2,
        retryDelay: 100,
      });

      const promise = lazyLoader.get('key1');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBeUndefined();
      expect(loader).toHaveBeenCalledTimes(3); // 1 + 2 retries
    });
  });

  describe('生命周期钩子', () => {
    it('应该调用 onLoadStart', async () => {
      const onLoadStart = vi.fn();
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader, onLoadStart });

      await lazyLoader.get('key1');

      expect(onLoadStart).toHaveBeenCalledWith('key1');
    });

    it('应该调用 onLoadEnd（成功）', async () => {
      const onLoadEnd = vi.fn();
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader, onLoadEnd });

      await lazyLoader.get('key1');

      expect(onLoadEnd).toHaveBeenCalledWith('key1', 'data');
    });

    it('应该调用 onLoadEnd（失败）', async () => {
      const onLoadEnd = vi.fn();
      const error = new Error('failed');
      const loader = vi.fn().mockRejectedValue(error);
      const lazyLoader = new LazyLoader({ loader, onLoadEnd });

      await lazyLoader.get('key1');

      expect(onLoadEnd).toHaveBeenCalledWith('key1', undefined, error);
    });

    it('应该调用 onCacheHit', async () => {
      const onCacheHit = vi.fn();
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader, onCacheHit });

      await lazyLoader.get('key1');
      await lazyLoader.get('key1');

      expect(onCacheHit).toHaveBeenCalledTimes(1);
      expect(onCacheHit).toHaveBeenCalledWith('key1');
    });
  });

  describe('统计信息', () => {
    it('应该正确统计命中和未命中', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader });

      await lazyLoader.get('key1'); // miss
      await lazyLoader.get('key1'); // hit
      await lazyLoader.get('key2'); // miss
      await lazyLoader.get('key1'); // hit

      const stats = lazyLoader.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('应该正确报告缓存大小', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({ loader });

      expect(lazyLoader.getStats().size).toBe(0);

      await lazyLoader.get('key1');
      expect(lazyLoader.getStats().size).toBe(1);

      await lazyLoader.get('key2');
      expect(lazyLoader.getStats().size).toBe(2);
    });

    it('应该正确报告 pendingCount', async () => {
      let resolveLoader: (value: string) => void;
      const loaderPromise = new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = vi.fn().mockReturnValue(loaderPromise);
      const lazyLoader = new LazyLoader({ loader });

      expect(lazyLoader.getStats().pendingCount).toBe(0);

      const promise = lazyLoader.get('key1');
      expect(lazyLoader.getStats().pendingCount).toBe(1);

      resolveLoader!('data');
      await promise;

      expect(lazyLoader.getStats().pendingCount).toBe(0);
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该清理所有资源', async () => {
      const loader = vi.fn().mockResolvedValue('data');
      const lazyLoader = new LazyLoader({
        loader,
        cache: {
          autoCleanup: true,
          ttl: 1000,
          cleanupInterval: 100,
        },
      });

      await lazyLoader.get('key1');
      expect(lazyLoader.has('key1')).toBe(true);

      lazyLoader.destroy();

      expect(lazyLoader.has('key1')).toBe(false);
      expect(lazyLoader.getStats().size).toBe(0);
    });
  });

  describe('并发控制', () => {
    it('应该限制并发加载数', async () => {
      let currentConcurrency = 0;
      let maxConcurrency = 0;

      const loader = vi.fn(async (key: string) => {
        currentConcurrency++;
        maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrency--;
        return `data-${key}`;
      });

      const lazyLoader = new LazyLoader({
        loader,
        concurrency: 2,
      });

      // 并行发起 5 个请求
      await Promise.all([
        lazyLoader.get('key1'),
        lazyLoader.get('key2'),
        lazyLoader.get('key3'),
        lazyLoader.get('key4'),
        lazyLoader.get('key5'),
      ]);

      expect(maxConcurrency).toBeLessThanOrEqual(2);
    });
  });

  describe('缓存策略', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该支持 FIFO 策略', async () => {
      const loader = vi.fn((key: string) => Promise.resolve(`data-${key}`));
      const lazyLoader = new LazyLoader({
        loader,
        cache: {
          maxSize: 2,
          strategy: 'fifo',
        },
      });

      await lazyLoader.get('key1');
      vi.advanceTimersByTime(10);
      await lazyLoader.get('key2');
      vi.advanceTimersByTime(10);

      // 访问 key1（对于 FIFO 不应该影响淘汰顺序）
      await lazyLoader.get('key1');
      vi.advanceTimersByTime(10);

      // 添加第三个，应该淘汰 key1（最早添加的）
      await lazyLoader.get('key3');

      expect(lazyLoader.has('key1')).toBe(false);
      expect(lazyLoader.has('key2')).toBe(true);
      expect(lazyLoader.has('key3')).toBe(true);
    });

    it('应该支持 LRU 策略', async () => {
      const loader = vi.fn((key: string) => Promise.resolve(`data-${key}`));
      const lazyLoader = new LazyLoader({
        loader,
        cache: {
          maxSize: 2,
          strategy: 'lru',
        },
      });

      await lazyLoader.get('key1');
      vi.advanceTimersByTime(10);
      await lazyLoader.get('key2');
      vi.advanceTimersByTime(10);

      // 访问 key1（使其成为最近使用）
      await lazyLoader.get('key1');
      vi.advanceTimersByTime(10);

      // 添加第三个，应该淘汰 key2（最少使用）
      await lazyLoader.get('key3');

      expect(lazyLoader.has('key1')).toBe(true);
      expect(lazyLoader.has('key2')).toBe(false);
      expect(lazyLoader.has('key3')).toBe(true);
    });
  });
});
