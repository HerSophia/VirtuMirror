/**
 * AppRegistryService 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { appRegistry, registerApp, registerApps } from '../appRegistryService';
import { iconService } from '../iconService';
import { useIconStore } from '@/stores/iconStore';
import type { AppRegistration } from '../appRegistryService';
import './setup';

// Mock globalConfigService
vi.mock('@/services/globalConfigService', () => ({
  getGlobalConfigService: vi.fn(() => ({
    getDesktopLayout: vi.fn(() => ({
      pages: [
        { id: 'page-1', items: [] },
      ],
      dockAppIds: ['wechat', 'browser'],
      currentPageIndex: 0,
    })),
    saveDesktopLayoutPages: vi.fn(),
  })),
}));

describe('AppRegistryService', () => {
  // 使用计数器确保每个测试使用唯一 ID
  let testCounter = 0;
  
  // 创建测试用的 App 注册配置（总是使用唯一 ID）
  const createUniqueApp = (overrides: Partial<AppRegistration> = {}): AppRegistration => {
    const uniqueId = overrides.id || `test-app-${Date.now()}-${++testCounter}`;
    const { id, name, route, category, isBuiltin, ...rest } = overrides;
    return {
      id: uniqueId,
      name: name || '测试应用',
      route: route || `/${uniqueId}`,
      category: category || 'tool',
      isBuiltin: isBuiltin ?? true,
      ...rest,
    };
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    // 初始化 IconStore，这会重新初始化 iconService 与新的 Pinia store
    useIconStore();
    // 清除 iconService 的数据
    iconService.clear();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('应注册 App 并创建图标', () => {
      const app = createUniqueApp();
      appRegistry.register(app);

      expect(iconService.get(app.id)).toBeDefined();
      expect(iconService.get(app.id)?.name).toBe(app.name);
    });

    it('应正确设置图标的所有属性', () => {
      const appId = `props-test-${Date.now()}-${++testCounter}`;
      const app = createUniqueApp({
        id: appId,
        name: '我的应用',
        route: '/my-app',
        category: 'social',
        isBuiltin: false,
        iconId: 'custom-icon',
        icon: { type: 'emoji', value: '🚀', background: '#000' },
        quickActions: [
          { id: 'action-1', label: '操作1' },
        ],
        getBadge: () => 5,
      });

      appRegistry.register(app);

      const icon = iconService.get(appId);
      expect(icon).toBeDefined();
      expect(icon?.name).toBe('我的应用');
      expect(icon?.route).toBe('/my-app');
      expect(icon?.category).toBe('social');
      expect(icon?.isBuiltin).toBe(false);
      expect(icon?.iconId).toBe('custom-icon');
      expect(icon?.icon).toEqual({ type: 'emoji', value: '🚀', background: '#000' });
      expect(icon?.quickActions).toHaveLength(1);
      expect(icon?.getBadge?.()).toBe(5);
    });

    it('应跳过已注册的 App（无 override）', () => {
      const appId = `skip-test-${Date.now()}-${++testCounter}`;
      appRegistry.register(createUniqueApp({ id: appId, name: '原始名称' }));
      appRegistry.register(createUniqueApp({ id: appId, name: '新名称' }));

      expect(iconService.get(appId)?.name).toBe('原始名称');
    });

    it('应支持 override 选项', () => {
      const appId = `override-test-${Date.now()}-${++testCounter}`;
      appRegistry.register(createUniqueApp({ id: appId, name: '原始名称' }));
      appRegistry.register(createUniqueApp({ id: appId, name: '新名称' }), { override: true });

      expect(iconService.get(appId)?.name).toBe('新名称');
    });

    it('默认 isBuiltin 应为 true', () => {
      const appId = `builtin-test-${Date.now()}-${++testCounter}`;
      appRegistry.register({
        id: appId,
        name: '测试',
        route: '/test',
        category: 'tool',
      });

      expect(iconService.get(appId)?.isBuiltin).toBe(true);
    });

    it('iconId 默认应与 id 相同', () => {
      const appId = `iconid-test-${Date.now()}-${++testCounter}`;
      appRegistry.register(createUniqueApp({ id: appId }));

      expect(iconService.get(appId)?.iconId).toBe(appId);
    });
  });

  describe('registerAll', () => {
    it('应批量注册多个 App', () => {
      const prefix = `batch-${Date.now()}`;
      const apps = [
        createUniqueApp({ id: `${prefix}-1`, name: '应用1' }),
        createUniqueApp({ id: `${prefix}-2`, name: '应用2' }),
        createUniqueApp({ id: `${prefix}-3`, name: '应用3' }),
      ];

      appRegistry.registerAll(apps);

      // 检查这三个应用是否都被注册到了 iconService
      expect(iconService.get(`${prefix}-1`)).toBeDefined();
      expect(iconService.get(`${prefix}-2`)).toBeDefined();
      expect(iconService.get(`${prefix}-3`)).toBeDefined();
    });

    it('应支持 override 选项', () => {
      const appId = `batch-override-${Date.now()}-${++testCounter}`;
      appRegistry.register(createUniqueApp({ id: appId, name: '原始' }));

      appRegistry.registerAll(
        [createUniqueApp({ id: appId, name: '新名称' })],
        { override: true }
      );

      expect(iconService.get(appId)?.name).toBe('新名称');
    });
  });

  describe('getAll', () => {
    it('应返回所有已注册的 App', () => {
      const prefix = `getall-${Date.now()}`;
      appRegistry.register(createUniqueApp({ id: `${prefix}-1` }));
      appRegistry.register(createUniqueApp({ id: `${prefix}-2` }));

      const all = appRegistry.getAll();
      const testApps = all.filter(a => a.id.startsWith(prefix));
      expect(testApps).toHaveLength(2);
    });
  });

  describe('get', () => {
    it('应返回指定 ID 的 App 注册信息', () => {
      const appId = `get-test-${Date.now()}-${++testCounter}`;
      const app = createUniqueApp({ id: appId });
      appRegistry.register(app);

      const result = appRegistry.get(appId);
      expect(result).toBeDefined();
      expect(result?.id).toBe(appId);
    });

    it('不存在时应返回 undefined', () => {
      expect(appRegistry.get('definitely-non-existent-app-id-12345')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('已注册时应返回 true', () => {
      const app = createUniqueApp();
      appRegistry.register(app);
      expect(appRegistry.has(app.id)).toBe(true);
    });

    it('未注册时应返回 false', () => {
      expect(appRegistry.has('definitely-non-existent-app-id-67890')).toBe(false);
    });
  });

  describe('getByCategory', () => {
    it('应返回指定分类的 App', () => {
      const prefix = `category-${Date.now()}`;
      appRegistry.register(createUniqueApp({ id: `${prefix}-social-1`, category: 'social' }));
      appRegistry.register(createUniqueApp({ id: `${prefix}-social-2`, category: 'social' }));
      appRegistry.register(createUniqueApp({ id: `${prefix}-tool-1`, category: 'tool' }));

      const socialApps = appRegistry.getByCategory('social');
      // 检查新注册的 social 应用是否在结果中
      const newSocialApps = socialApps.filter(a => a.id.startsWith(`${prefix}-social`));
      expect(newSocialApps).toHaveLength(2);
    });
  });

  describe('getDesktopApps', () => {
    it('应返回所有应显示在桌面的 App', () => {
      const prefix = `desktop-${Date.now()}`;
      appRegistry.register(createUniqueApp({ id: `${prefix}-show-1` }));
      appRegistry.register(createUniqueApp({ id: `${prefix}-show-2`, desktop: { show: true } }));
      appRegistry.register(createUniqueApp({ id: `${prefix}-hide-1`, desktop: { show: false } }));

      const desktopApps = appRegistry.getDesktopApps();
      const ids = desktopApps.map(a => a.id);
      
      expect(ids).toContain(`${prefix}-show-1`);
      expect(ids).toContain(`${prefix}-show-2`);
      expect(ids).not.toContain(`${prefix}-hide-1`);
    });
  });

  describe('桌面回调', () => {
    it('应能设置桌面更新回调', () => {
      const callback = vi.fn();
      appRegistry.setDesktopUpdateCallback(callback);

      // 回调应该被保存（不直接测试内部状态）
      expect(() => appRegistry.setDesktopUpdateCallback(callback)).not.toThrow();
    });
  });

  describe('待处理队列', () => {
    it('getPendingDesktopApps 应返回待处理的 App 列表', () => {
      // 这个测试主要验证方法存在且不报错
      const pending = appRegistry.getPendingDesktopApps();
      expect(Array.isArray(pending)).toBe(true);
    });

    it('processPendingDesktopApps 应处理并返回待处理的 App', () => {
      const processed = appRegistry.processPendingDesktopApps();
      expect(Array.isArray(processed)).toBe(true);
    });
  });

  describe('便捷函数', () => {
    it('registerApp 应调用 appRegistry.register', () => {
      const appId = `convenient-${Date.now()}-${++testCounter}`;
      const app = createUniqueApp({ id: appId });
      registerApp(app);

      expect(appRegistry.has(appId)).toBe(true);
    });

    it('registerApps 应调用 appRegistry.registerAll', () => {
      const prefix = `batch-func-${Date.now()}`;
      const apps = [
        createUniqueApp({ id: `${prefix}-1` }),
        createUniqueApp({ id: `${prefix}-2` }),
      ];
      registerApps(apps);

      expect(appRegistry.has(`${prefix}-1`)).toBe(true);
      expect(appRegistry.has(`${prefix}-2`)).toBe(true);
    });
  });

  describe('getBadge 功能', () => {
    it('应正确传递 getBadge 函数到图标配置', () => {
      const getBadge = vi.fn(() => 10);
      const appId = `badge-${Date.now()}-${++testCounter}`;
      appRegistry.register(createUniqueApp({ id: appId, getBadge }));

      const icon = iconService.get(appId);
      expect(icon?.getBadge).toBe(getBadge);
      expect(icon?.getBadge?.()).toBe(10);
    });
  });
});
