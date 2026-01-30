/**
 * LRU/FIFO 缓存测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache, FIFOCache } from '../LRUCache';

describe('LRUCache', () => {
  describe('基础操作', () => {
    it('应该能够设置和获取值', () => {
      const cache = new LRUCache<string>(10);

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('对于不存在的 key 应该返回 undefined', () => {
      const cache = new LRUCache<string>(10);

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('应该正确报告缓存大小', () => {
      const cache = new LRUCache<string>(10);

      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });

    it('应该能够检查 key 是否存在', () => {
      const cache = new LRUCache<string>(10);

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('应该能够删除缓存条目', () => {
      const cache = new LRUCache<string>(10);

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该能够清空所有缓存', () => {
      const cache = new LRUCache<string>(10);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('key1')).toBe(false);
    });

    it('应该能够获取所有 keys', () => {
      const cache = new LRUCache<string>(10);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('peek 操作', () => {
    it('应该能够查看值而不更新访问时间', () => {
      const cache = new LRUCache<string>(2);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // peek 不应该影响 LRU 顺序
      expect(cache.peek('key1')).toBe('value1');

      // 添加新条目时，应该淘汰最少访问的 key1
      cache.set('key3', 'value3');

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });

    it('对于不存在的 key，peek 应该返回 undefined', () => {
      const cache = new LRUCache<string>(10);

      expect(cache.peek('nonexistent')).toBeUndefined();
    });
  });

  describe('LRU 淘汰策略', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('当缓存满时应该淘汰最近最少使用的条目', () => {
      const cache = new LRUCache<string>(3);

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);

      // 访问 key1，使其成为最近使用的
      cache.get('key1');
      vi.advanceTimersByTime(10);

      // 添加新条目，应该淘汰 key2（最少使用）
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('更新已存在的 key 不应该增加缓存大小', () => {
      const cache = new LRUCache<string>(3);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // 更新 key1
      cache.set('key1', 'newValue1');

      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBe('newValue1');
    });

    it('更新已存在的 key 应该更新访问时间', () => {
      const cache = new LRUCache<string>(2);

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);

      // 更新 key1，使其成为最近使用的
      cache.set('key1', 'newValue1');
      vi.advanceTimersByTime(10);

      // 添加新条目，应该淘汰 key2
      cache.set('key3', 'value3');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
    });
  });

  describe('TTL 过期', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('未过期的条目应该可以正常获取', () => {
      const cache = new LRUCache<string>(10, 1000); // 1秒 TTL

      cache.set('key1', 'value1');

      // 500ms 后仍然有效
      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('value1');
    });

    it('过期的条目应该返回 undefined', () => {
      const cache = new LRUCache<string>(10, 1000); // 1秒 TTL

      cache.set('key1', 'value1');

      // 1001ms 后过期
      vi.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('过期的条目应该被自动删除', () => {
      const cache = new LRUCache<string>(10, 1000);

      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);

      vi.advanceTimersByTime(1001);

      // get 会触发删除
      cache.get('key1');
      expect(cache.size).toBe(0);
    });

    it('has 方法应该检查过期', () => {
      const cache = new LRUCache<string>(10, 1000);

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      vi.advanceTimersByTime(1001);
      expect(cache.has('key1')).toBe(false);
    });

    it('peek 方法应该检查过期', () => {
      const cache = new LRUCache<string>(10, 1000);

      cache.set('key1', 'value1');
      expect(cache.peek('key1')).toBe('value1');

      vi.advanceTimersByTime(1001);
      expect(cache.peek('key1')).toBeUndefined();
    });

    it('cleanup 应该清除所有过期条目', () => {
      const cache = new LRUCache<string>(10, 1000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(500);
      cache.set('key3', 'value3');

      vi.advanceTimersByTime(600); // key1, key2 过期，key3 未过期

      const removed = cache.cleanup();
      expect(removed).toBe(2);
      expect(cache.size).toBe(1);
      expect(cache.has('key3')).toBe(true);
    });

    it('TTL 为 0 时应该永不过期', () => {
      const cache = new LRUCache<string>(10, 0); // 永不过期

      cache.set('key1', 'value1');

      vi.advanceTimersByTime(999999999);
      expect(cache.get('key1')).toBe('value1');
    });

    it('cleanup 在 TTL 为 0 时应该不做任何事', () => {
      const cache = new LRUCache<string>(10, 0);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const removed = cache.cleanup();
      expect(removed).toBe(0);
      expect(cache.size).toBe(2);
    });
  });
});

describe('FIFOCache', () => {
  describe('基础操作', () => {
    it('应该能够设置和获取值', () => {
      const cache = new FIFOCache<string>(10);

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('对于不存在的 key 应该返回 undefined', () => {
      const cache = new FIFOCache<string>(10);

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('应该正确报告缓存大小', () => {
      const cache = new FIFOCache<string>(10);

      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('FIFO 淘汰策略', () => {
    it('当缓存满时应该淘汰最早添加的条目', () => {
      const cache = new FIFOCache<string>(3);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // 即使访问 key1，也不影响 FIFO 顺序
      cache.get('key1');

      // 添加新条目，应该淘汰最早的 key1
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('更新已存在的 key 不应该改变其创建时间', () => {
      const cache = new FIFOCache<string>(2);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // 更新 key1，但它仍然是最早创建的
      cache.set('key1', 'newValue1');

      // 添加新条目，应该淘汰最早创建的 key1
      cache.set('key3', 'value3');

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });
  });

  describe('TTL 过期', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('过期的条目应该返回 undefined', () => {
      const cache = new FIFOCache<string>(10, 1000);

      cache.set('key1', 'value1');

      vi.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('cleanup 应该清除所有过期条目', () => {
      const cache = new FIFOCache<string>(10, 1000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(500);
      cache.set('key3', 'value3');

      vi.advanceTimersByTime(600);

      const removed = cache.cleanup();
      expect(removed).toBe(2);
      expect(cache.size).toBe(1);
    });
  });
});
