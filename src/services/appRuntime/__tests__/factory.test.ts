/**
 * Factory 单元测试
 * 测试 AppRuntime 创建工厂函数
 */

import { describe, it, expect, vi } from 'vitest'
import { createAppRuntime, createBuiltinAppRuntime } from '../factory'
import type { InstalledAppInfo } from '../factory'
import type { AppSourceInfo } from '@/types/appIdentity'

// Mock 依赖
vi.mock('@/services/database', () => ({
  db: {
    appData: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(undefined)),
          toArray: vi.fn(() => Promise.resolve([])),
          delete: vi.fn(() => Promise.resolve()),
        })),
      })),
      add: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
    },
  },
}))

vi.mock('@/services/database/writeQueue', () => ({
  writeQueue: {
    enqueue: vi.fn((_, __, fn) => fn()),
  },
}))

describe('Factory', () => {
  describe('createAppRuntime', () => {
    it('应该创建包含所有必需属性的 runtime', () => {
      const appInfo: InstalledAppInfo = {
        id: 'test-app',
        name: 'Test App',
        sourceInfo: { type: 'builtin' },
        installationId: 'inst_123',
      }
      
      const runtime = createAppRuntime(appInfo)
      
      expect(runtime).toHaveProperty('identity')
      expect(runtime).toHaveProperty('storage')
      expect(runtime).toHaveProperty('system')
    })

    describe('identity', () => {
      it('应该包含正确的 appId', () => {
        const appInfo: InstalledAppInfo = {
          id: 'my-app',
          name: 'My App',
          sourceInfo: { type: 'builtin' },
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.identity.appId).toBe('my-app')
      })

      it('应该包含正确的 appName', () => {
        const appInfo: InstalledAppInfo = {
          id: 'my-app',
          name: '我的应用',
          sourceInfo: { type: 'builtin' },
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.identity.appName).toBe('我的应用')
      })

      it('应该包含正确的 source 信息', () => {
        const sourceInfo: AppSourceInfo = {
          type: 'repository',
          repositoryId: 'official',
          signature: 'sig123',
          signedAt: Date.now(),
        }
        const appInfo: InstalledAppInfo = {
          id: 'my-app',
          name: 'My App',
          sourceInfo,
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.identity.source).toEqual(sourceInfo)
      })

      it('内置应用应该有正确的命名空间', () => {
        const appInfo: InstalledAppInfo = {
          id: 'calculator',
          name: 'Calculator',
          sourceInfo: { type: 'builtin' },
          installationId: 'builtin_calculator',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.identity.dataNamespace).toBe('builtin/calculator')
      })

      it('本地应用应该有隔离的命名空间', () => {
        const appInfo: InstalledAppInfo = {
          id: 'local-app',
          name: 'Local App',
          sourceInfo: {
            type: 'local',
            fileName: 'app.json',
            importedAt: Date.now(),
          },
          installationId: 'inst_unique123',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.identity.dataNamespace).toBe('local/inst_unique123')
      })

      it('URL 应用应该有基于域名的命名空间', () => {
        const appInfo: InstalledAppInfo = {
          id: 'url-app',
          name: 'URL App',
          sourceInfo: {
            type: 'url',
            url: 'https://example.com/app.json',
            contentHash: 'abcd1234efgh5678',
            fetchedAt: Date.now(),
          },
          installationId: 'inst_url',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.identity.dataNamespace).toBe('url/example.com/abcd1234')
      })

      it('仓库应用应该有包含开发者ID的命名空间', () => {
        const appInfo: InstalledAppInfo = {
          id: 'repo-app',
          name: 'Repo App',
          sourceInfo: {
            type: 'repository',
            repositoryId: 'official',
            signature: 'sig',
            signedAt: Date.now(),
          },
          installationId: 'inst_repo',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        // 由于 createAppRuntime 内部创建的 pkg 没有 author，所以是 unknown
        expect(runtime.identity.dataNamespace).toBe('repo/official/unknown/repo-app')
      })
    })

    describe('storage', () => {
      it('应该提供 storage API', () => {
        const appInfo: InstalledAppInfo = {
          id: 'test-app',
          name: 'Test App',
          sourceInfo: { type: 'builtin' },
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.storage).toHaveProperty('get')
        expect(runtime.storage).toHaveProperty('set')
        expect(runtime.storage).toHaveProperty('delete')
        expect(runtime.storage).toHaveProperty('keys')
        expect(runtime.storage).toHaveProperty('clear')
        expect(runtime.storage).toHaveProperty('getUsage')
      })

      it('storage 方法应该是函数', () => {
        const appInfo: InstalledAppInfo = {
          id: 'test-app',
          name: 'Test App',
          sourceInfo: { type: 'builtin' },
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(typeof runtime.storage.get).toBe('function')
        expect(typeof runtime.storage.set).toBe('function')
        expect(typeof runtime.storage.delete).toBe('function')
        expect(typeof runtime.storage.keys).toBe('function')
        expect(typeof runtime.storage.clear).toBe('function')
        expect(typeof runtime.storage.getUsage).toBe('function')
      })
    })

    describe('system', () => {
      it('应该提供 system API', () => {
        const appInfo: InstalledAppInfo = {
          id: 'test-app',
          name: 'Test App',
          sourceInfo: { type: 'builtin' },
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        
        expect(runtime.system).toHaveProperty('now')
        expect(runtime.system).toHaveProperty('uuid')
        expect(runtime.system).toHaveProperty('toast')
      })

      it('system.now 应该返回时间戳', () => {
        const appInfo: InstalledAppInfo = {
          id: 'test-app',
          name: 'Test App',
          sourceInfo: { type: 'builtin' },
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        const now = runtime.system.now()
        
        expect(typeof now).toBe('number')
        expect(now).toBeGreaterThan(0)
      })

      it('system.uuid 应该返回 UUID', () => {
        const appInfo: InstalledAppInfo = {
          id: 'test-app',
          name: 'Test App',
          sourceInfo: { type: 'builtin' },
          installationId: 'inst_123',
        }
        
        const runtime = createAppRuntime(appInfo)
        const uuid = runtime.system.uuid()
        
        expect(typeof uuid).toBe('string')
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      })
    })
  })

  describe('createBuiltinAppRuntime', () => {
    it('应该创建内置应用的 runtime', () => {
      const runtime = createBuiltinAppRuntime('notes', '备忘录')
      
      expect(runtime.identity.appId).toBe('notes')
      expect(runtime.identity.appName).toBe('备忘录')
      expect(runtime.identity.source.type).toBe('builtin')
    })

    it('应该自动生成正确的命名空间', () => {
      const runtime = createBuiltinAppRuntime('calculator', 'Calculator')
      
      expect(runtime.identity.dataNamespace).toBe('builtin/calculator')
    })

    it('不同应用应该有不同的命名空间', () => {
      const runtime1 = createBuiltinAppRuntime('app1', 'App 1')
      const runtime2 = createBuiltinAppRuntime('app2', 'App 2')
      
      expect(runtime1.identity.dataNamespace).not.toBe(runtime2.identity.dataNamespace)
    })

    it('应该包含完整的 runtime 接口', () => {
      const runtime = createBuiltinAppRuntime('test', 'Test')
      
      expect(runtime.identity).toBeDefined()
      expect(runtime.storage).toBeDefined()
      expect(runtime.system).toBeDefined()
    })

    it('system API 应该正常工作', () => {
      const runtime = createBuiltinAppRuntime('test', 'Test')
      
      expect(runtime.system.now()).toBeGreaterThan(0)
      expect(runtime.system.uuid()).toMatch(/^[0-9a-f-]+$/i)
    })
  })

  describe('不同应用的隔离性', () => {
    it('不同应用应该有独立的 runtime', () => {
      const runtime1 = createBuiltinAppRuntime('app1', 'App 1')
      const runtime2 = createBuiltinAppRuntime('app2', 'App 2')
      
      expect(runtime1).not.toBe(runtime2)
      expect(runtime1.identity).not.toBe(runtime2.identity)
      expect(runtime1.storage).not.toBe(runtime2.storage)
      expect(runtime1.system).not.toBe(runtime2.system)
    })

    it('相同参数创建的 runtime 应该有相同的配置', () => {
      const runtime1 = createBuiltinAppRuntime('test', 'Test')
      const runtime2 = createBuiltinAppRuntime('test', 'Test')
      
      expect(runtime1.identity.appId).toBe(runtime2.identity.appId)
      expect(runtime1.identity.dataNamespace).toBe(runtime2.identity.dataNamespace)
    })
  })
})
