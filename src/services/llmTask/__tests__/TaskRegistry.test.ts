/**
 * TaskRegistry 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskRegistry, getTaskRegistry, resetTaskRegistry } from '../TaskRegistry';
import { createMockTaskDefinition } from './setup';
import type { LLMTaskDefinition } from '../types';

describe('TaskRegistry', () => {
  let registry: TaskRegistry;

  beforeEach(() => {
    resetTaskRegistry();
    registry = getTaskRegistry();
  });

  describe('register', () => {
    it('应该成功注册有效的任务定义', () => {
      const definition = createMockTaskDefinition();

      registry.register(definition);

      expect(registry.has(definition.id)).toBe(true);
      expect(registry.get(definition.id)).toEqual(definition);
    });

    it('应该覆盖已存在的任务定义', () => {
      const definition1 = createMockTaskDefinition({ name: 'Task 1' });
      const definition2 = createMockTaskDefinition({ name: 'Task 2' });

      registry.register(definition1);
      registry.register(definition2);

      expect(registry.get(definition1.id)?.name).toBe('Task 2');
    });

    it('应该抛出错误当缺少必填字段 id', () => {
      const definition = createMockTaskDefinition({ id: '' });

      expect(() => registry.register(definition)).toThrow('缺少 id');
    });

    it('应该抛出错误当缺少必填字段 appId', () => {
      const definition = createMockTaskDefinition({ appId: '' });

      expect(() => registry.register(definition)).toThrow('缺少 appId');
    });

    it('应该抛出错误当缺少必填字段 name', () => {
      const definition = createMockTaskDefinition({ name: '' });

      expect(() => registry.register(definition)).toThrow('缺少 name');
    });

    it('应该抛出错误当缺少必填字段 type', () => {
      const definition = createMockTaskDefinition({ type: '' as any });

      expect(() => registry.register(definition)).toThrow('缺少 type');
    });

    it('应该抛出错误当缺少必填字段 outputHandlerId', () => {
      const definition = createMockTaskDefinition({ outputHandlerId: '' });

      expect(() => registry.register(definition)).toThrow('缺少 outputHandlerId');
    });

    it('应该抛出错误当 prompt 类型缺少 promptId', () => {
      const definition = createMockTaskDefinition({
        type: 'prompt',
        promptId: undefined,
      });

      expect(() => registry.register(definition)).toThrow('缺少 promptId');
    });

    it('应该抛出错误当 chain 类型缺少 chainId', () => {
      const definition = createMockTaskDefinition({
        type: 'chain',
        chainId: undefined,
      });

      expect(() => registry.register(definition)).toThrow('缺少 chainId');
    });

    it('应该抛出错误当 manual 类型缺少 promptTemplate', () => {
      const definition = createMockTaskDefinition({
        type: 'manual',
        promptTemplate: undefined,
      });

      expect(() => registry.register(definition)).toThrow('缺少 promptTemplate');
    });
  });

  describe('registerBatch', () => {
    it('应该批量注册多个任务定义', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'test:task-1' }),
        createMockTaskDefinition({ id: 'test:task-2' }),
        createMockTaskDefinition({ id: 'test:task-3' }),
      ];

      registry.registerBatch(definitions);

      expect(registry.size).toBe(3);
      expect(registry.has('test:task-1')).toBe(true);
      expect(registry.has('test:task-2')).toBe(true);
      expect(registry.has('test:task-3')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('应该成功注销已注册的任务定义', () => {
      const definition = createMockTaskDefinition();
      registry.register(definition);

      const result = registry.unregister(definition.id);

      expect(result).toBe(true);
      expect(registry.has(definition.id)).toBe(false);
    });

    it('应该返回 false 当注销不存在的任务定义', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });

    it('应该从 App 索引中移除', () => {
      const definition = createMockTaskDefinition();
      registry.register(definition);

      registry.unregister(definition.id);

      expect(registry.getByApp(definition.appId)).toHaveLength(0);
    });
  });

  describe('get', () => {
    it('应该返回已注册的任务定义', () => {
      const definition = createMockTaskDefinition();
      registry.register(definition);

      const result = registry.get(definition.id);

      expect(result).toEqual(definition);
    });

    it('应该返回 undefined 当任务定义不存在', () => {
      const result = registry.get('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('应该返回 true 当任务定义存在', () => {
      const definition = createMockTaskDefinition();
      registry.register(definition);

      expect(registry.has(definition.id)).toBe(true);
    });

    it('应该返回 false 当任务定义不存在', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('应该返回所有已注册的任务定义', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'test:task-1' }),
        createMockTaskDefinition({ id: 'test:task-2' }),
      ];
      registry.registerBatch(definitions);

      const result = registry.getAll();

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toContain('test:task-1');
      expect(result.map((d) => d.id)).toContain('test:task-2');
    });

    it('应该返回空数组当没有注册任何定义', () => {
      const result = registry.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getByApp', () => {
    it('应该返回指定 App 的所有任务定义', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'app1:task-1', appId: 'app1' }),
        createMockTaskDefinition({ id: 'app1:task-2', appId: 'app1' }),
        createMockTaskDefinition({ id: 'app2:task-1', appId: 'app2' }),
      ];
      registry.registerBatch(definitions);

      const result = registry.getByApp('app1');

      expect(result).toHaveLength(2);
      expect(result.every((d) => d.appId === 'app1')).toBe(true);
    });

    it('应该返回空数组当 App 没有注册任何定义', () => {
      const result = registry.getByApp('non-existent-app');

      expect(result).toEqual([]);
    });
  });

  describe('getRegisteredApps', () => {
    it('应该返回所有已注册的 App ID', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'app1:task', appId: 'app1' }),
        createMockTaskDefinition({ id: 'app2:task', appId: 'app2' }),
        createMockTaskDefinition({ id: 'app3:task', appId: 'app3' }),
      ];
      registry.registerBatch(definitions);

      const result = registry.getRegisteredApps();

      expect(result).toHaveLength(3);
      expect(result).toContain('app1');
      expect(result).toContain('app2');
      expect(result).toContain('app3');
    });
  });

  describe('getByCategory', () => {
    it('应该返回指定分类的任务定义', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'test:task-1', category: 'content' }),
        createMockTaskDefinition({ id: 'test:task-2', category: 'content' }),
        createMockTaskDefinition({ id: 'test:task-3', category: 'analysis' }),
      ];
      registry.registerBatch(definitions);

      const result = registry.getByCategory('content');

      expect(result).toHaveLength(2);
      expect(result.every((d) => d.category === 'content')).toBe(true);
    });
  });

  describe('searchByTags', () => {
    it('应该返回包含指定标签的任务定义', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'test:task-1', tags: ['weibo', 'social'] }),
        createMockTaskDefinition({ id: 'test:task-2', tags: ['weibo', 'trending'] }),
        createMockTaskDefinition({ id: 'test:task-3', tags: ['email'] }),
      ];
      registry.registerBatch(definitions);

      const result = registry.searchByTags(['weibo']);

      expect(result).toHaveLength(2);
    });

    it('应该返回匹配任意标签的任务定义', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'test:task-1', tags: ['weibo'] }),
        createMockTaskDefinition({ id: 'test:task-2', tags: ['email'] }),
      ];
      registry.registerBatch(definitions);

      const result = registry.searchByTags(['weibo', 'email']);

      expect(result).toHaveLength(2);
    });
  });

  describe('getDefaultVisible', () => {
    it('应该返回默认显示的任务定义', () => {
      const definitions = [
        createMockTaskDefinition({ id: 'test:task-1', showByDefault: true }),
        createMockTaskDefinition({ id: 'test:task-2', showByDefault: false }),
        createMockTaskDefinition({ id: 'test:task-3' }), // 默认为 true
      ];
      registry.registerBatch(definitions);

      const result = registry.getDefaultVisible();

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toContain('test:task-1');
      expect(result.map((d) => d.id)).toContain('test:task-3');
    });
  });

  describe('size', () => {
    it('应该返回正确的任务定义数量', () => {
      expect(registry.size).toBe(0);

      registry.register(createMockTaskDefinition({ id: 'test:task-1' }));
      expect(registry.size).toBe(1);

      registry.register(createMockTaskDefinition({ id: 'test:task-2' }));
      expect(registry.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('应该清空所有任务定义', () => {
      registry.registerBatch([
        createMockTaskDefinition({ id: 'test:task-1' }),
        createMockTaskDefinition({ id: 'test:task-2' }),
      ]);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('单例模式', () => {
    it('getTaskRegistry 应该返回同一个实例', () => {
      const instance1 = getTaskRegistry();
      const instance2 = getTaskRegistry();

      expect(instance1).toBe(instance2);
    });

    it('resetTaskRegistry 应该重置实例', () => {
      const instance1 = getTaskRegistry();
      instance1.register(createMockTaskDefinition());

      resetTaskRegistry();

      const instance2 = getTaskRegistry();
      expect(instance2.size).toBe(0);
    });
  });
});
