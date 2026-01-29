/**
 * OutputHandlerRegistry 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OutputHandlerRegistry,
  getOutputHandlerRegistry,
  resetOutputHandlerRegistry,
} from '../OutputHandlerRegistry';
import { createMockOutputHandler } from './setup';
import type { OutputHandler } from '../types';

describe('OutputHandlerRegistry', () => {
  let registry: OutputHandlerRegistry;

  beforeEach(() => {
    resetOutputHandlerRegistry();
    registry = getOutputHandlerRegistry();
  });

  describe('register', () => {
    it('应该成功注册有效的输出处理器', () => {
      const handler = createMockOutputHandler();

      registry.register(handler);

      expect(registry.has(handler.id)).toBe(true);
      expect(registry.get(handler.id)).toEqual(handler);
    });

    it('应该覆盖已存在的处理器', () => {
      const handler1 = createMockOutputHandler({ name: 'Handler 1' });
      const handler2 = createMockOutputHandler({ name: 'Handler 2' });

      registry.register(handler1);
      registry.register(handler2);

      expect(registry.get(handler1.id)?.name).toBe('Handler 2');
    });

    it('应该抛出错误当缺少必填字段 id', () => {
      const handler = createMockOutputHandler({ id: '' });

      expect(() => registry.register(handler)).toThrow('缺少 id');
    });

    it('应该抛出错误当缺少必填字段 appId', () => {
      const handler = createMockOutputHandler({ appId: '' });

      expect(() => registry.register(handler)).toThrow('缺少 appId');
    });

    it('应该抛出错误当缺少必填字段 name', () => {
      const handler = createMockOutputHandler({ name: '' });

      expect(() => registry.register(handler)).toThrow('缺少 name');
    });

    it('应该抛出错误当缺少 handle 方法', () => {
      const handler = createMockOutputHandler({ handle: undefined as any });

      expect(() => registry.register(handler)).toThrow('缺少 handle');
    });
  });

  describe('registerBatch', () => {
    it('应该批量注册多个处理器', () => {
      const handlers = [
        createMockOutputHandler({ id: 'test:handler-1' }),
        createMockOutputHandler({ id: 'test:handler-2' }),
        createMockOutputHandler({ id: 'test:handler-3' }),
      ];

      registry.registerBatch(handlers);

      expect(registry.size).toBe(3);
      expect(registry.has('test:handler-1')).toBe(true);
      expect(registry.has('test:handler-2')).toBe(true);
      expect(registry.has('test:handler-3')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('应该成功注销已注册的处理器', () => {
      const handler = createMockOutputHandler();
      registry.register(handler);

      const result = registry.unregister(handler.id);

      expect(result).toBe(true);
      expect(registry.has(handler.id)).toBe(false);
    });

    it('应该返回 false 当注销不存在的处理器', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });

    it('应该从 App 索引中移除', () => {
      const handler = createMockOutputHandler();
      registry.register(handler);

      registry.unregister(handler.id);

      expect(registry.getByApp(handler.appId)).toHaveLength(0);
    });
  });

  describe('get', () => {
    it('应该返回已注册的处理器', () => {
      const handler = createMockOutputHandler();
      registry.register(handler);

      const result = registry.get(handler.id);

      expect(result).toEqual(handler);
    });

    it('应该返回 undefined 当处理器不存在', () => {
      const result = registry.get('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('应该返回 true 当处理器存在', () => {
      const handler = createMockOutputHandler();
      registry.register(handler);

      expect(registry.has(handler.id)).toBe(true);
    });

    it('应该返回 false 当处理器不存在', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('应该返回所有已注册的处理器', () => {
      const handlers = [
        createMockOutputHandler({ id: 'test:handler-1' }),
        createMockOutputHandler({ id: 'test:handler-2' }),
      ];
      registry.registerBatch(handlers);

      const result = registry.getAll();

      expect(result).toHaveLength(2);
      expect(result.map((h) => h.id)).toContain('test:handler-1');
      expect(result.map((h) => h.id)).toContain('test:handler-2');
    });

    it('应该返回空数组当没有注册任何处理器', () => {
      const result = registry.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getByApp', () => {
    it('应该返回指定 App 的所有处理器', () => {
      const handlers = [
        createMockOutputHandler({ id: 'app1:handler-1', appId: 'app1' }),
        createMockOutputHandler({ id: 'app1:handler-2', appId: 'app1' }),
        createMockOutputHandler({ id: 'app2:handler-1', appId: 'app2' }),
      ];
      registry.registerBatch(handlers);

      const result = registry.getByApp('app1');

      expect(result).toHaveLength(2);
      expect(result.every((h) => h.appId === 'app1')).toBe(true);
    });

    it('应该返回空数组当 App 没有注册任何处理器', () => {
      const result = registry.getByApp('non-existent-app');

      expect(result).toEqual([]);
    });
  });

  describe('getPreviewable', () => {
    it('应该返回支持预览的处理器', () => {
      const handlers = [
        createMockOutputHandler({
          id: 'test:previewable-1',
          supportsPreview: true,
          preview: async () => ({ data: {}, summary: 'Preview' }),
        }),
        createMockOutputHandler({
          id: 'test:previewable-2',
          supportsPreview: true,
          preview: async () => ({ data: {}, summary: 'Preview' }),
        }),
        createMockOutputHandler({
          id: 'test:not-previewable',
          supportsPreview: false,
        }),
      ];
      registry.registerBatch(handlers);

      const result = registry.getPreviewable();

      expect(result).toHaveLength(2);
      expect(result.every((h) => h.supportsPreview)).toBe(true);
    });

    it('应该返回空数组当没有支持预览的处理器', () => {
      const handlers = [
        createMockOutputHandler({ id: 'test:handler-1', supportsPreview: false }),
        createMockOutputHandler({ id: 'test:handler-2', supportsPreview: undefined }),
      ];
      registry.registerBatch(handlers);

      const result = registry.getPreviewable();

      expect(result).toEqual([]);
    });
  });

  describe('size', () => {
    it('应该返回正确的处理器数量', () => {
      expect(registry.size).toBe(0);

      registry.register(createMockOutputHandler({ id: 'test:handler-1' }));
      expect(registry.size).toBe(1);

      registry.register(createMockOutputHandler({ id: 'test:handler-2' }));
      expect(registry.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('应该清空所有处理器', () => {
      registry.registerBatch([
        createMockOutputHandler({ id: 'test:handler-1' }),
        createMockOutputHandler({ id: 'test:handler-2' }),
      ]);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('单例模式', () => {
    it('getOutputHandlerRegistry 应该返回同一个实例', () => {
      const instance1 = getOutputHandlerRegistry();
      const instance2 = getOutputHandlerRegistry();

      expect(instance1).toBe(instance2);
    });

    it('resetOutputHandlerRegistry 应该重置实例', () => {
      const instance1 = getOutputHandlerRegistry();
      instance1.register(createMockOutputHandler());

      resetOutputHandlerRegistry();

      const instance2 = getOutputHandlerRegistry();
      expect(instance2.size).toBe(0);
    });
  });
});
