/**
 * IconRegistryService (Facade) 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { iconRegistryService, getIconRegistryService } from '../registryService';
import { iconService } from '../iconService';
import type { RegisteredAppIcon } from '@/types/icon';
import './setup';

describe('IconRegistryService (Facade)', () => {
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
    setActivePinia(createPinia());
    // 清除之前的注册
    iconRegistryService.clear();
  });

  describe('getIconRegistryService', () => {
    it('应返回 iconRegistryService 实例', () => {
      const service = getIconRegistryService();
      expect(service).toBe(iconRegistryService);
    });
  });

  describe('register', () => {
    it('应通过 iconService 注册图标', () => {
      const icon = createTestIcon();
      const result = iconRegistryService.register(icon);

      expect(result).toBe(true);
      expect(iconService.get('test-app')).toEqual(icon);
    });

    it('应支持 override 选项', () => {
      iconRegistryService.register(createTestIcon({ name: '原始' }));
      const result = iconRegistryService.register(
        createTestIcon({ name: '新名称' }),
        { override: true }
      );

      expect(result).toBe(true);
      expect(iconRegistryService.get('test-app')?.name).toBe('新名称');
    });
  });

  describe('registerAll', () => {
    it('应批量注册多个图标', () => {
      const icons = [
        createTestIcon({ id: 'app-1' }),
        createTestIcon({ id: 'app-2' }),
      ];

      iconRegistryService.registerAll(icons);

      expect(iconRegistryService.getAll()).toHaveLength(2);
    });
  });

  describe('unregister', () => {
    it('应通过 iconService 取消注册', () => {
      iconRegistryService.register(createTestIcon());
      const result = iconRegistryService.unregister('test-app');

      expect(result).toBe(true);
      expect(iconRegistryService.has('test-app')).toBe(false);
    });
  });

  describe('get', () => {
    it('应返回已注册的图标', () => {
      const icon = createTestIcon();
      iconRegistryService.register(icon);

      expect(iconRegistryService.get('test-app')).toEqual(icon);
    });

    it('不存在时应返回 undefined', () => {
      expect(iconRegistryService.get('non-existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('应返回所有已注册的图标', () => {
      iconRegistryService.register(createTestIcon({ id: 'app-1' }));
      iconRegistryService.register(createTestIcon({ id: 'app-2' }));

      expect(iconRegistryService.getAll()).toHaveLength(2);
    });
  });

  describe('getBuiltinApps', () => {
    it('应只返回内置应用', () => {
      iconRegistryService.register(createTestIcon({ id: 'builtin', isBuiltin: true }));
      iconRegistryService.register(createTestIcon({ id: 'third-party', isBuiltin: false }));

      const builtinApps = iconRegistryService.getBuiltinApps();
      expect(builtinApps).toHaveLength(1);
      expect(builtinApps[0].id).toBe('builtin');
    });
  });

  describe('getByCategory', () => {
    it('应返回指定分类的图标', () => {
      iconRegistryService.register(createTestIcon({ id: 'social-1', category: 'social' }));
      iconRegistryService.register(createTestIcon({ id: 'tool-1', category: 'tool' }));

      const socialApps = iconRegistryService.getByCategory('social');
      expect(socialApps).toHaveLength(1);
      expect(socialApps[0].category).toBe('social');
    });
  });

  describe('has', () => {
    it('已注册时应返回 true', () => {
      iconRegistryService.register(createTestIcon());
      expect(iconRegistryService.has('test-app')).toBe(true);
    });

    it('未注册时应返回 false', () => {
      expect(iconRegistryService.has('non-existent')).toBe(false);
    });
  });

  describe('size', () => {
    it('应返回已注册图标的数量', () => {
      expect(iconRegistryService.size).toBe(0);

      iconRegistryService.register(createTestIcon({ id: 'app-1' }));
      expect(iconRegistryService.size).toBe(1);

      iconRegistryService.register(createTestIcon({ id: 'app-2' }));
      expect(iconRegistryService.size).toBe(2);
    });
  });

  describe('icons getter', () => {
    it('应返回响应式的图标 Map', () => {
      iconRegistryService.register(createTestIcon());

      const icons = iconRegistryService.icons;
      expect(icons.value.size).toBe(1);
      expect(icons.value.get('test-app')).toBeDefined();
    });
  });

  describe('iconList getter', () => {
    it('应返回响应式的图标列表', () => {
      iconRegistryService.register(createTestIcon({ id: 'app-1' }));
      iconRegistryService.register(createTestIcon({ id: 'app-2' }));

      const iconList = iconRegistryService.iconList;
      expect(iconList.value).toHaveLength(2);
    });
  });

  describe('subscribe', () => {
    it('应能订阅图标变化', () => {
      const listener = vi.fn();
      const unsubscribe = iconRegistryService.subscribe(listener);

      iconRegistryService.register(createTestIcon());

      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });
  });

  describe('clear', () => {
    it('应清除所有注册的图标', () => {
      iconRegistryService.register(createTestIcon({ id: 'app-1' }));
      iconRegistryService.register(createTestIcon({ id: 'app-2' }));

      iconRegistryService.clear();

      expect(iconRegistryService.size).toBe(0);
    });
  });
});
