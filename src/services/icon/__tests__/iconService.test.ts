/**
 * IconService 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import { IconService } from '../iconService';
import type { RegisteredAppIcon } from '@/types/icon';
import './setup';

describe('IconService', () => {
  let service: IconService;
  let mockIconsRef: Ref<Map<string, RegisteredAppIcon>>;

  // 创建测试用的图标数据
  const createTestIcon = (overrides: Partial<RegisteredAppIcon> = {}): RegisteredAppIcon => ({
    id: 'test-app',
    name: '测试应用',
    route: '/test-app',
    category: 'tool',
    isBuiltin: true,
    ...overrides,
  });

  beforeEach(() => {
    // 创建新的 IconService 实例（绕过单例模式）
    service = new IconService();
    mockIconsRef = ref(new Map<string, RegisteredAppIcon>());
  });

  describe('单例模式', () => {
    it('getInstance 应返回同一个实例', () => {
      const instance1 = IconService.getInstance();
      const instance2 = IconService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('init', () => {
    it('应正确初始化状态', () => {
      service.init({ icons: mockIconsRef });
      
      // 初始化后应该可以正常注册
      const result = service.register(createTestIcon());
      expect(result).toBe(true);
    });
  });

  describe('register', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应成功注册有效的图标', () => {
      const icon = createTestIcon();
      const result = service.register(icon);

      expect(result).toBe(true);
      expect(service.get('test-app')).toEqual(icon);
    });

    it('应拒绝重复注册（无 override）', () => {
      const icon = createTestIcon();
      service.register(icon);

      const result = service.register(icon);
      expect(result).toBe(false);
    });

    it('应允许使用 override 覆盖已存在的图标', () => {
      const icon1 = createTestIcon({ name: '原始名称' });
      const icon2 = createTestIcon({ name: '新名称' });

      service.register(icon1);
      const result = service.register(icon2, { override: true });

      expect(result).toBe(true);
      expect(service.get('test-app')?.name).toBe('新名称');
    });

    it('应拒绝缺少 id 的图标', () => {
      const icon = createTestIcon({ id: '' });
      const result = service.register(icon);

      expect(result).toBe(false);
    });

    it('应拒绝缺少 name 的图标', () => {
      const icon = createTestIcon({ name: '' });
      const result = service.register(icon);

      expect(result).toBe(false);
    });

    it('未初始化时应返回 false', () => {
      const uninitializedService = new IconService();
      const result = uninitializedService.register(createTestIcon());

      expect(result).toBe(false);
    });

    it('注册后应通知监听器', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.register(createTestIcon());

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerAll', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应批量注册多个图标', () => {
      const icons = [
        createTestIcon({ id: 'app-1', name: '应用1' }),
        createTestIcon({ id: 'app-2', name: '应用2' }),
        createTestIcon({ id: 'app-3', name: '应用3' }),
      ];

      service.registerAll(icons);

      expect(service.getAll()).toHaveLength(3);
      expect(service.get('app-1')?.name).toBe('应用1');
      expect(service.get('app-2')?.name).toBe('应用2');
      expect(service.get('app-3')?.name).toBe('应用3');
    });

    it('应使用 options 应用到所有图标', () => {
      service.register(createTestIcon({ id: 'app-1', name: '原始' }));

      const icons = [
        createTestIcon({ id: 'app-1', name: '新名称1' }),
        createTestIcon({ id: 'app-2', name: '应用2' }),
      ];

      service.registerAll(icons, { override: true });

      expect(service.get('app-1')?.name).toBe('新名称1');
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应成功取消注册已存在的图标', () => {
      service.register(createTestIcon());
      const result = service.unregister('test-app');

      expect(result).toBe(true);
      expect(service.has('test-app')).toBe(false);
    });

    it('取消注册不存在的图标应返回 false', () => {
      const result = service.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('未初始化时应返回 false', () => {
      const uninitializedService = new IconService();
      const result = uninitializedService.unregister('test-app');
      expect(result).toBe(false);
    });

    it('取消注册后应通知监听器', () => {
      service.register(createTestIcon());
      
      const listener = vi.fn();
      service.subscribe(listener);

      service.unregister('test-app');

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应返回已注册的图标', () => {
      const icon = createTestIcon();
      service.register(icon);

      expect(service.get('test-app')).toEqual(icon);
    });

    it('不存在的图标应返回 undefined', () => {
      expect(service.get('non-existent')).toBeUndefined();
    });

    it('未初始化时应返回 undefined', () => {
      const uninitializedService = new IconService();
      expect(uninitializedService.get('test-app')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应返回所有已注册的图标', () => {
      service.register(createTestIcon({ id: 'app-1' }));
      service.register(createTestIcon({ id: 'app-2' }));

      const all = service.getAll();
      expect(all).toHaveLength(2);
    });

    it('无注册时应返回空数组', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('未初始化时应返回空数组', () => {
      const uninitializedService = new IconService();
      expect(uninitializedService.getAll()).toEqual([]);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('已注册的图标应返回 true', () => {
      service.register(createTestIcon());
      expect(service.has('test-app')).toBe(true);
    });

    it('未注册的图标应返回 false', () => {
      expect(service.has('non-existent')).toBe(false);
    });

    it('未初始化时应返回 false', () => {
      const uninitializedService = new IconService();
      expect(uninitializedService.has('test-app')).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应清除所有注册的图标', () => {
      service.register(createTestIcon({ id: 'app-1' }));
      service.register(createTestIcon({ id: 'app-2' }));

      service.clear();

      expect(service.getAll()).toHaveLength(0);
    });

    it('清除后应通知监听器', () => {
      service.register(createTestIcon());

      const listener = vi.fn();
      service.subscribe(listener);

      service.clear();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('未初始化时不应报错', () => {
      const uninitializedService = new IconService();
      expect(() => uninitializedService.clear()).not.toThrow();
    });
  });

  describe('subscribe', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应返回取消订阅函数', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('取消订阅后不应再收到通知', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      service.register(createTestIcon({ id: 'app-1' }));
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      service.register(createTestIcon({ id: 'app-2' }));
      expect(listener).toHaveBeenCalledTimes(1); // 仍然是1次
    });

    it('监听器出错不应影响其他监听器', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = vi.fn();

      service.subscribe(errorListener);
      service.subscribe(normalListener);

      service.register(createTestIcon());

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('getBadge 功能', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应正确存储 getBadge 函数', () => {
      const getBadge = vi.fn(() => 5);
      const icon = createTestIcon({ getBadge });

      service.register(icon);

      const registered = service.get('test-app');
      expect(registered?.getBadge).toBe(getBadge);
      expect(registered?.getBadge?.()).toBe(5);
    });
  });

  describe('quickActions 功能', () => {
    beforeEach(() => {
      service.init({ icons: mockIconsRef });
    });

    it('应正确存储快捷操作配置', () => {
      const quickActions = [
        { id: 'action-1', label: '操作1', icon: 'fas fa-star' },
        { id: 'action-2', label: '操作2', route: '/test' },
      ];
      const icon = createTestIcon({ quickActions });

      service.register(icon);

      const registered = service.get('test-app');
      expect(registered?.quickActions).toEqual(quickActions);
    });
  });
});
