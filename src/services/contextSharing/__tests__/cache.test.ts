/**
 * Context Sharing Service 缓存功能测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextSharingService } from '../ContextSharingService';

describe('ContextSharingService - 缓存功能', () => {
  let service: ContextSharingService;

  beforeEach(() => {
    service = new ContextSharingService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('TTL 缓存', () => {
    it('在 TTL 内应该使用缓存值', async () => {
      let callCount = 0;
      const getter = vi.fn(() => {
        callCount++;
        return { count: callCount };
      });

      service.publish({
        id: 'test:cache-ttl',
        type: 'system:time',
        description: 'TTL 缓存测试',
        getter,
        visibility: { level: 'public' },
        cache: { ttl: 5000 }, // 5 秒 TTL
      });

      // 第一次调用
      const result1 = await service.getAsync('test:cache-ttl');
      expect(result1).toEqual({ count: 1 });
      expect(getter).toHaveBeenCalledTimes(1);

      // 2 秒后再次调用，应该使用缓存
      vi.advanceTimersByTime(2000);
      const result2 = await service.getAsync('test:cache-ttl');
      expect(result2).toEqual({ count: 1 });
      expect(getter).toHaveBeenCalledTimes(1);

      // 4 秒后（总共 6 秒），缓存过期
      vi.advanceTimersByTime(4000);
      const result3 = await service.getAsync('test:cache-ttl');
      expect(result3).toEqual({ count: 2 });
      expect(getter).toHaveBeenCalledTimes(2);
    });

    it('没有 TTL 配置时每次都应该调用 getter', async () => {
      let callCount = 0;
      const getter = vi.fn(() => {
        callCount++;
        return { count: callCount };
      });

      service.publish({
        id: 'test:no-cache',
        type: 'system:time',
        description: '无缓存测试',
        getter,
        visibility: { level: 'public' },
        // 不设置 cache
      });

      await service.getAsync('test:no-cache');
      await service.getAsync('test:no-cache');
      await service.getAsync('test:no-cache');

      expect(getter).toHaveBeenCalledTimes(3);
    });
  });

  describe('缓存失效', () => {
    it('replace 应该清除缓存', async () => {
      let callCount = 0;
      const getter = vi.fn(() => {
        callCount++;
        return { count: callCount };
      });

      service.publish({
        id: 'test:replace-cache',
        type: 'system:time',
        description: 'replace 缓存测试',
        getter,
        visibility: { level: 'public' },
        cache: { ttl: 60000 }, // 60 秒 TTL
      });

      // 第一次调用，填充缓存
      const result1 = await service.getAsync('test:replace-cache');
      expect(result1).toEqual({ count: 1 });
      expect(getter).toHaveBeenCalledTimes(1);

      // 使用 replace 更新值
      service.replace('test:replace-cache', { replaced: true });

      // 应该返回新的值
      const result2 = service.get('test:replace-cache');
      expect(result2).toEqual({ replaced: true });
    });

    it('重新发布会保留旧缓存直到过期', async () => {
      let callCount = 0;
      const getter = vi.fn(() => {
        callCount++;
        return { count: callCount };
      });

      service.publish({
        id: 'test:republish-cache',
        type: 'system:time',
        description: '重新发布缓存测试',
        getter,
        visibility: { level: 'public' },
        cache: { ttl: 5000 }, // 5 秒 TTL
      });

      // 第一次调用，填充缓存
      await service.getAsync('test:republish-cache');
      expect(getter).toHaveBeenCalledTimes(1);

      // 重新发布（注意：当前实现不清除缓存）
      const newGetter = vi.fn(() => ({ newValue: true }));
      service.publish({
        id: 'test:republish-cache',
        type: 'system:time',
        description: '重新发布缓存测试',
        getter: newGetter,
        visibility: { level: 'public' },
        cache: { ttl: 5000 },
      });

      // 缓存过期后应该调用新的 getter
      vi.advanceTimersByTime(6000);
      const result = await service.getAsync('test:republish-cache');
      expect(result).toEqual({ newValue: true });
      expect(newGetter).toHaveBeenCalledTimes(1);
    });
  });

  describe('静态值与缓存', () => {
    it('静态值不需要缓存机制', () => {
      service.publish({
        id: 'test:static-value',
        type: 'system:time',
        description: '静态值测试',
        value: { static: true },
        visibility: { level: 'public' },
        cache: { ttl: 5000 }, // TTL 对静态值无效
      });

      // 静态值直接返回，不需要缓存
      const result1 = service.get('test:static-value');
      const result2 = service.get('test:static-value');

      expect(result1).toEqual({ static: true });
      expect(result2).toEqual({ static: true });
    });
  });

  describe('同步获取缓存值', () => {
    it('有缓存时 get 应该返回缓存值', async () => {
      const getter = vi.fn(() => ({ cached: true }));

      service.publish({
        id: 'test:sync-cache',
        type: 'system:time',
        description: '同步缓存测试',
        getter,
        visibility: { level: 'public' },
        cache: { ttl: 60000 },
      });

      // 先异步调用填充缓存
      await service.getAsync('test:sync-cache');

      // 然后同步获取应该返回缓存值
      const result = service.get('test:sync-cache');
      expect(result).toEqual({ cached: true });
    });
  });
});
