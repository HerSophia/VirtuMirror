/**
 * IconStore 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useIconStore } from '@/stores/iconStore';
import { iconService } from '../iconService';
import type { RegisteredAppIcon } from '@/types/icon';
import './setup';

describe('IconStore', () => {
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
    // 每个测试前创建新的 Pinia 实例
    setActivePinia(createPinia());
  });

  describe('初始化', () => {
    it('应正确初始化空的图标 Map', () => {
      const store = useIconStore();
      expect(store.icons.size).toBe(0);
    });

    it('应自动初始化 iconService', () => {
      const store = useIconStore();
      
      // 通过 iconService 注册图标应该能成功
      const result = iconService.register(createTestIcon());
      expect(result).toBe(true);
      
      // Store 应该反映变化
      expect(store.icons.size).toBe(1);
    });
  });

  describe('allIcons getter', () => {
    it('应返回所有图标的数组', () => {
      const store = useIconStore();
      
      iconService.register(createTestIcon({ id: 'app-1', name: '应用1' }));
      iconService.register(createTestIcon({ id: 'app-2', name: '应用2' }));
      
      expect(store.allIcons).toHaveLength(2);
    });

    it('无图标时应返回空数组', () => {
      const store = useIconStore();
      expect(store.allIcons).toEqual([]);
    });
  });

  describe('builtinApps getter', () => {
    it('应只返回内置应用', () => {
      const store = useIconStore();
      
      iconService.register(createTestIcon({ id: 'builtin-1', isBuiltin: true }));
      iconService.register(createTestIcon({ id: 'builtin-2', isBuiltin: true }));
      iconService.register(createTestIcon({ id: 'third-party', isBuiltin: false }));
      
      expect(store.builtinApps).toHaveLength(2);
      expect(store.builtinApps.every(app => app.isBuiltin)).toBe(true);
    });

    it('无内置应用时应返回空数组', () => {
      const store = useIconStore();
      
      iconService.register(createTestIcon({ id: 'third-party', isBuiltin: false }));
      
      expect(store.builtinApps).toEqual([]);
    });
  });

  describe('getByCategory', () => {
    it('应返回指定分类的图标', () => {
      const store = useIconStore();
      
      iconService.register(createTestIcon({ id: 'social-1', category: 'social' }));
      iconService.register(createTestIcon({ id: 'social-2', category: 'social' }));
      iconService.register(createTestIcon({ id: 'tool-1', category: 'tool' }));
      
      const socialApps = store.getByCategory('social');
      expect(socialApps).toHaveLength(2);
      expect(socialApps.every(app => app.category === 'social')).toBe(true);
    });

    it('无匹配分类时应返回空数组', () => {
      const store = useIconStore();
      
      iconService.register(createTestIcon({ id: 'tool-1', category: 'tool' }));
      
      expect(store.getByCategory('entertainment')).toEqual([]);
    });

    it('应支持所有定义的分类', () => {
      const store = useIconStore();
      
      const categories = ['social', 'tool', 'entertainment', 'productivity', 'system', 'lifestyle', 'games', 'other'] as const;
      
      categories.forEach((category, index) => {
        iconService.register(createTestIcon({ 
          id: `app-${category}`, 
          category 
        }));
      });
      
      categories.forEach(category => {
        const apps = store.getByCategory(category);
        expect(apps).toHaveLength(1);
        expect(apps[0].category).toBe(category);
      });
    });
  });

  describe('getIcon', () => {
    it('应返回指定 ID 的图标', () => {
      const store = useIconStore();
      const icon = createTestIcon();
      
      iconService.register(icon);
      
      expect(store.getIcon('test-app')).toEqual(icon);
    });

    it('不存在的 ID 应返回 undefined', () => {
      const store = useIconStore();
      expect(store.getIcon('non-existent')).toBeUndefined();
    });
  });

  describe('响应式更新', () => {
    it('注册图标后应自动更新 allIcons', () => {
      const store = useIconStore();
      
      expect(store.allIcons).toHaveLength(0);
      
      iconService.register(createTestIcon());
      
      expect(store.allIcons).toHaveLength(1);
    });

    it('取消注册后应自动更新 allIcons', () => {
      const store = useIconStore();
      
      iconService.register(createTestIcon());
      expect(store.allIcons).toHaveLength(1);
      
      iconService.unregister('test-app');
      expect(store.allIcons).toHaveLength(0);
    });

    it('清除后应自动更新 allIcons', () => {
      const store = useIconStore();
      
      iconService.register(createTestIcon({ id: 'app-1' }));
      iconService.register(createTestIcon({ id: 'app-2' }));
      expect(store.allIcons).toHaveLength(2);
      
      iconService.clear();
      expect(store.allIcons).toHaveLength(0);
    });
  });
});
