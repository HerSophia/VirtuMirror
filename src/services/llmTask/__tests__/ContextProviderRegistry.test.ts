/**
 * ContextProviderRegistry 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContextProviderRegistry,
  getContextProviderRegistry,
  resetContextProviderRegistry,
} from '../ContextProviderRegistry';
import { createMockContextProvider } from './setup';
import type { ContextProvider } from '../types';

describe('ContextProviderRegistry', () => {
  let registry: ContextProviderRegistry;

  beforeEach(() => {
    resetContextProviderRegistry();
    registry = getContextProviderRegistry();
  });

  describe('register', () => {
    it('应该成功注册有效的上下文提供器', () => {
      const provider = createMockContextProvider();

      registry.register(provider);

      expect(registry.has(provider.id)).toBe(true);
      expect(registry.get(provider.id)).toEqual(provider);
    });

    it('应该覆盖已存在的提供器', () => {
      const provider1 = createMockContextProvider({ name: 'Provider 1' });
      const provider2 = createMockContextProvider({ name: 'Provider 2' });

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.get(provider1.id)?.name).toBe('Provider 2');
    });

    it('应该抛出错误当缺少必填字段 id', () => {
      const provider = createMockContextProvider({ id: '' });

      expect(() => registry.register(provider)).toThrow('缺少 id');
    });

    it('应该抛出错误当缺少必填字段 appId', () => {
      const provider = createMockContextProvider({ appId: '' });

      expect(() => registry.register(provider)).toThrow('缺少 appId');
    });

    it('应该抛出错误当缺少必填字段 name', () => {
      const provider = createMockContextProvider({ name: '' });

      expect(() => registry.register(provider)).toThrow('缺少 name');
    });

    it('应该抛出错误当缺少 getContext 方法', () => {
      const provider = createMockContextProvider({ getContext: undefined as any });

      expect(() => registry.register(provider)).toThrow('缺少 getContext');
    });
  });

  describe('registerBatch', () => {
    it('应该批量注册多个提供器', () => {
      const providers = [
        createMockContextProvider({ id: 'test:provider-1' }),
        createMockContextProvider({ id: 'test:provider-2' }),
        createMockContextProvider({ id: 'test:provider-3' }),
      ];

      registry.registerBatch(providers);

      expect(registry.size).toBe(3);
      expect(registry.has('test:provider-1')).toBe(true);
      expect(registry.has('test:provider-2')).toBe(true);
      expect(registry.has('test:provider-3')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('应该成功注销已注册的提供器', () => {
      const provider = createMockContextProvider();
      registry.register(provider);

      const result = registry.unregister(provider.id);

      expect(result).toBe(true);
      expect(registry.has(provider.id)).toBe(false);
    });

    it('应该返回 false 当注销不存在的提供器', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });

    it('应该从 App 索引中移除', () => {
      const provider = createMockContextProvider();
      registry.register(provider);

      registry.unregister(provider.id);

      expect(registry.getByApp(provider.appId)).toHaveLength(0);
    });
  });

  describe('get', () => {
    it('应该返回已注册的提供器', () => {
      const provider = createMockContextProvider();
      registry.register(provider);

      const result = registry.get(provider.id);

      expect(result).toEqual(provider);
    });

    it('应该返回 undefined 当提供器不存在', () => {
      const result = registry.get('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('应该返回 true 当提供器存在', () => {
      const provider = createMockContextProvider();
      registry.register(provider);

      expect(registry.has(provider.id)).toBe(true);
    });

    it('应该返回 false 当提供器不存在', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('应该返回所有已注册的提供器', () => {
      const providers = [
        createMockContextProvider({ id: 'test:provider-1' }),
        createMockContextProvider({ id: 'test:provider-2' }),
      ];
      registry.registerBatch(providers);

      const result = registry.getAll();

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id)).toContain('test:provider-1');
      expect(result.map((p) => p.id)).toContain('test:provider-2');
    });

    it('应该返回空数组当没有注册任何提供器', () => {
      const result = registry.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getByApp', () => {
    it('应该返回指定 App 的所有提供器', () => {
      const providers = [
        createMockContextProvider({ id: 'app1:provider-1', appId: 'app1' }),
        createMockContextProvider({ id: 'app1:provider-2', appId: 'app1' }),
        createMockContextProvider({ id: 'app2:provider-1', appId: 'app2' }),
      ];
      registry.registerBatch(providers);

      const result = registry.getByApp('app1');

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.appId === 'app1')).toBe(true);
    });

    it('应该返回空数组当 App 没有注册任何提供器', () => {
      const result = registry.getByApp('non-existent-app');

      expect(result).toEqual([]);
    });
  });

  describe('getSortedByPriority', () => {
    it('应该按优先级排序返回提供器', () => {
      const providers = [
        createMockContextProvider({ id: 'test:low', priority: 100 }),
        createMockContextProvider({ id: 'test:high', priority: 10 }),
        createMockContextProvider({ id: 'test:medium', priority: 50 }),
      ];
      registry.registerBatch(providers);

      const result = registry.getSortedByPriority();

      expect(result[0].id).toBe('test:high');
      expect(result[1].id).toBe('test:medium');
      expect(result[2].id).toBe('test:low');
    });

    it('应该只返回指定 ID 的提供器', () => {
      const providers = [
        createMockContextProvider({ id: 'test:a', priority: 100 }),
        createMockContextProvider({ id: 'test:b', priority: 10 }),
        createMockContextProvider({ id: 'test:c', priority: 50 }),
      ];
      registry.registerBatch(providers);

      const result = registry.getSortedByPriority(['test:a', 'test:c']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('test:c');
      expect(result[1].id).toBe('test:a');
    });

    it('应该使用默认优先级 100 当未指定', () => {
      const providers = [
        createMockContextProvider({ id: 'test:default', priority: undefined }),
        createMockContextProvider({ id: 'test:high', priority: 10 }),
      ];
      registry.registerBatch(providers);

      const result = registry.getSortedByPriority();

      expect(result[0].id).toBe('test:high');
      expect(result[1].id).toBe('test:default');
    });
  });

  describe('getContext', () => {
    it('应该执行提供器并合并上下文', async () => {
      const providers = [
        createMockContextProvider({
          id: 'test:provider-1',
          getContext: async () => ({ var1: 'value1' }),
        }),
        createMockContextProvider({
          id: 'test:provider-2',
          getContext: async () => ({ var2: 'value2' }),
        }),
      ];
      registry.registerBatch(providers);

      const result = await registry.getContext(['test:provider-1', 'test:provider-2']);

      expect(result).toEqual({
        var1: 'value1',
        var2: 'value2',
      });
    });

    it('应该按优先级顺序执行提供器', async () => {
      const executionOrder: string[] = [];

      const providers = [
        createMockContextProvider({
          id: 'test:low',
          priority: 100,
          getContext: async () => {
            executionOrder.push('low');
            return { low: 'value' };
          },
        }),
        createMockContextProvider({
          id: 'test:high',
          priority: 10,
          getContext: async () => {
            executionOrder.push('high');
            return { high: 'value' };
          },
        }),
      ];
      registry.registerBatch(providers);

      await registry.getContext(['test:low', 'test:high']);

      expect(executionOrder).toEqual(['high', 'low']);
    });

    it('应该应用变量前缀', async () => {
      const provider = createMockContextProvider({
        id: 'test:prefixed',
        variablePrefix: 'prefix',
        getContext: async () => ({ value: 'test' }),
      });
      registry.register(provider);

      const result = await registry.getContext(['test:prefixed']);

      expect(result).toEqual({ prefixValue: 'test' });
    });

    it('应该处理提供器执行失败', async () => {
      const providers = [
        createMockContextProvider({
          id: 'test:success',
          getContext: async () => ({ success: 'value' }),
        }),
        createMockContextProvider({
          id: 'test:fail',
          getContext: async () => {
            throw new Error('Provider failed');
          },
        }),
      ];
      registry.registerBatch(providers);

      const result = await registry.getContext(['test:success', 'test:fail']);

      // 失败的提供器不影响成功的
      expect(result).toEqual({ success: 'value' });
    });

    it('应该忽略不存在的提供器 ID', async () => {
      const provider = createMockContextProvider({
        id: 'test:exists',
        getContext: async () => ({ value: 'test' }),
      });
      registry.register(provider);

      const result = await registry.getContext(['test:exists', 'test:not-exists']);

      expect(result).toEqual({ value: 'test' });
    });
  });

  describe('size', () => {
    it('应该返回正确的提供器数量', () => {
      expect(registry.size).toBe(0);

      registry.register(createMockContextProvider({ id: 'test:provider-1' }));
      expect(registry.size).toBe(1);

      registry.register(createMockContextProvider({ id: 'test:provider-2' }));
      expect(registry.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('应该清空所有提供器', () => {
      registry.registerBatch([
        createMockContextProvider({ id: 'test:provider-1' }),
        createMockContextProvider({ id: 'test:provider-2' }),
      ]);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('单例模式', () => {
    it('getContextProviderRegistry 应该返回同一个实例', () => {
      const instance1 = getContextProviderRegistry();
      const instance2 = getContextProviderRegistry();

      expect(instance1).toBe(instance2);
    });

    it('resetContextProviderRegistry 应该重置实例', () => {
      const instance1 = getContextProviderRegistry();
      instance1.register(createMockContextProvider());

      resetContextProviderRegistry();

      const instance2 = getContextProviderRegistry();
      expect(instance2.size).toBe(0);
    });
  });
});
