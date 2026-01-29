/**
 * Context Sharing Service 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextSharingService } from '../ContextSharingService';
import type { PublishContextOptions } from '../types';

describe('ContextSharingService', () => {
  let service: ContextSharingService;

  beforeEach(() => {
    service = new ContextSharingService();
  });

  describe('publish', () => {
    it('应该能够发布静态值上下文', () => {
      const options: PublishContextOptions<{ timestamp: number }> = {
        id: 'test:static',
        type: 'system:time',
        description: '测试静态值',
        value: { timestamp: 123456 },
        visibility: { level: 'public' },
      };

      service.publish(options);

      const result = service.get('test:static');
      expect(result).toEqual({ timestamp: 123456 });
    });

    it('应该能够发布带 getter 的上下文', async () => {
      const options: PublishContextOptions<{ now: number }> = {
        id: 'test:getter',
        type: 'system:time',
        description: '测试 getter',
        getter: () => ({ now: Date.now() }),
        visibility: { level: 'public' },
      };

      service.publish(options);

      const result = await service.getAsync<{ now: number }>('test:getter');
      expect(result).toHaveProperty('now');
      expect(typeof result?.now).toBe('number');
    });

    it('应该能够发布带异步 getter 的上下文', async () => {
      const options: PublishContextOptions<{ async: boolean }> = {
        id: 'test:async-getter',
        type: 'system:time',
        description: '测试异步 getter',
        getter: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { async: true };
        },
        visibility: { level: 'public' },
      };

      service.publish(options);

      const result = await service.getAsync<{ async: boolean }>('test:async-getter');
      expect(result).toEqual({ async: true });
    });

    it('应该覆盖已存在的同 ID 上下文', () => {
      service.publish({
        id: 'test:override',
        type: 'system:time',
        description: '原始值',
        value: 'original',
        visibility: { level: 'public' },
      });

      service.publish({
        id: 'test:override',
        type: 'system:time',
        description: '新值',
        value: 'updated',
        visibility: { level: 'public' },
      });

      expect(service.get('test:override')).toBe('updated');
    });

    it('应该返回上下文 ID', () => {
      const id = service.publish({
        id: 'test:return-id',
        type: 'system:time',
        description: '返回 ID 测试',
        value: 'test',
        visibility: { level: 'public' },
      });

      expect(id).toBe('test:return-id');
    });

    it('不提供 ID 时应该自动生成', () => {
      const id = service.publish({
        type: 'system:time',
        description: '自动生成 ID 测试',
        value: 'test',
        visibility: { level: 'public' },
      });

      expect(id).toBeTruthy();
      expect(id).toContain('system:time');
    });
  });

  describe('get / getAsync', () => {
    it('get 应该返回静态值', () => {
      service.publish({
        id: 'test:value',
        type: 'system:time',
        description: '静态值',
        value: { data: 'test' },
        visibility: { level: 'public' },
      });

      expect(service.get('test:value')).toEqual({ data: 'test' });
    });

    it('get 应该对 getter 返回 undefined（无缓存时）', () => {
      service.publish({
        id: 'test:getter-only',
        type: 'system:time',
        description: 'getter 上下文',
        getter: () => ({ data: 'test' }),
        visibility: { level: 'public' },
      });

      // get 不会调用 getter，且无缓存时返回 undefined
      expect(service.get('test:getter-only')).toBeUndefined();
    });

    it('getAsync 应该能获取静态值', async () => {
      service.publish({
        id: 'test:async-static',
        type: 'system:time',
        description: '静态值',
        value: 'static-data',
        visibility: { level: 'public' },
      });

      const result = await service.getAsync('test:async-static');
      expect(result).toBe('static-data');
    });

    it('getAsync 应该调用 getter', async () => {
      const getter = vi.fn().mockReturnValue({ called: true });

      service.publish({
        id: 'test:getter-call',
        type: 'system:time',
        description: 'getter 调用测试',
        getter,
        visibility: { level: 'public' },
      });

      const result = await service.getAsync('test:getter-call');
      expect(getter).toHaveBeenCalled();
      expect(result).toEqual({ called: true });
    });

    it('不存在的上下文应该返回 undefined', () => {
      expect(service.get('non-existent')).toBeUndefined();
    });

    it('getAsync 不存在的上下文应该返回 undefined', async () => {
      const result = await service.getAsync('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('订阅时应该立即收到当前值', () => {
      const callback = vi.fn();

      service.publish({
        id: 'test:subscribe',
        type: 'system:time',
        description: '订阅测试',
        value: 'initial',
        visibility: { level: 'public' },
      });

      service.subscribe('test:subscribe', callback);

      // 订阅时应该立即收到当前值
      expect(callback).toHaveBeenCalledWith('initial');
    });

    it('更新后应该收到新值', () => {
      const callback = vi.fn();

      service.publish({
        id: 'test:subscribe-update',
        type: 'system:time',
        description: '订阅更新测试',
        value: 'initial',
        visibility: { level: 'public' },
      });

      service.subscribe('test:subscribe-update', callback);
      callback.mockClear(); // 清除初始调用

      // 更新上下文
      service.replace('test:subscribe-update', 'updated');

      expect(callback).toHaveBeenCalledWith('updated');
    });

    it('取消订阅后不应该再收到通知', () => {
      const callback = vi.fn();

      service.publish({
        id: 'test:unsubscribe',
        type: 'system:time',
        description: '取消订阅测试',
        value: 'initial',
        visibility: { level: 'public' },
      });

      const unsubscribe = service.subscribe('test:unsubscribe', callback);
      callback.mockClear();
      unsubscribe();

      service.replace('test:unsubscribe', 'updated');

      expect(callback).not.toHaveBeenCalled();
    });

    it('多个订阅者应该都收到通知', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      service.publish({
        id: 'test:multi-sub',
        type: 'system:time',
        description: '多订阅者测试',
        value: 'initial',
        visibility: { level: 'public' },
      });

      service.subscribe('test:multi-sub', callback1);
      service.subscribe('test:multi-sub', callback2);
      callback1.mockClear();
      callback2.mockClear();

      service.replace('test:multi-sub', 'updated');

      expect(callback1).toHaveBeenCalledWith('updated');
      expect(callback2).toHaveBeenCalledWith('updated');
    });
  });

  describe('unpublish', () => {
    it('应该能取消发布上下文', () => {
      service.publish({
        id: 'test:unpublish',
        type: 'system:time',
        description: '取消发布测试',
        value: 'data',
        visibility: { level: 'public' },
      });

      expect(service.get('test:unpublish')).toBe('data');

      service.unpublish('test:unpublish');

      expect(service.get('test:unpublish')).toBeUndefined();
    });

    it('取消发布不存在的上下文应该返回 false', () => {
      expect(service.unpublish('non-existent')).toBe(false);
    });
  });

  describe('replace', () => {
    it('应该能替换上下文值', () => {
      service.publish({
        id: 'test:replace',
        type: 'system:time',
        description: '替换测试',
        value: 'original',
        visibility: { level: 'public' },
      });

      const result = service.replace('test:replace', 'replaced');

      expect(result).toBe(true);
      expect(service.get('test:replace')).toBe('replaced');
    });

    it('替换不存在的上下文应该返回 false', () => {
      expect(service.replace('non-existent', 'value')).toBe(false);
    });
  });

  describe('getByType', () => {
    beforeEach(() => {
      service.publish({
        id: 'weibo:trending',
        type: 'social:trending',
        description: '微博热搜',
        value: ['热搜1', '热搜2'],
        visibility: { level: 'public' },
      });

      service.publish({
        id: 'bilibili:trending',
        type: 'social:trending',
        description: 'B站热门',
        value: ['热门1', '热门2'],
        visibility: { level: 'public' },
      });

      service.publish({
        id: 'system:time',
        type: 'system:time',
        description: '系统时间',
        value: Date.now(),
        visibility: { level: 'public' },
      });
    });

    it('应该返回指定类型的所有上下文', () => {
      const result = service.getByType<string[]>('social:trending');

      expect(result.size).toBe(2);
      expect(result.has('weibo:trending')).toBe(true);
      expect(result.has('bilibili:trending')).toBe(true);
    });

    it('不存在的类型应该返回空 Map', () => {
      const result = service.getByType('chat:lastMessage');
      expect(result.size).toBe(0);
    });
  });

  describe('getAllContexts', () => {
    it('应该返回所有可见的上下文元信息', () => {
      service.publish({
        id: 'test:1',
        type: 'system:time',
        description: '测试1',
        value: 1,
        visibility: { level: 'public' },
      });

      service.publish({
        id: 'test:2',
        type: 'system:time',
        description: '测试2',
        value: 2,
        visibility: { level: 'public' },
      });

      const contexts = service.getAllContexts();
      expect(contexts).toHaveLength(2);
      expect(contexts[0]).toHaveProperty('id');
      expect(contexts[0]).toHaveProperty('type');
      expect(contexts[0]).toHaveProperty('description');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      service.publish({
        id: 'weibo:trending',
        type: 'social:trending',
        description: '微博热搜榜',
        value: [],
        visibility: { level: 'public' },
      });

      service.publish({
        id: 'bilibili:hot',
        type: 'social:hotTopics',
        description: 'B站热门话题',
        value: [],
        visibility: { level: 'public' },
      });
    });

    it('应该能按类型搜索', () => {
      const result = service.search({ type: 'social:trending' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('weibo:trending');
    });

    it('应该能按关键词搜索', () => {
      const result = service.search({ keyword: '热门' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('bilibili:hot');
    });
  });
});
