/**
 * IdentityService 单元测试
 * 测试应用身份识别、命名空间计算、安装验证、数据迁移等功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateDataNamespace,
  getSignableContent,
  verifyEd25519Signature,
  verifyAndInstall,
  verifyUpdate,
  checkDataMigration,
  executeDataMigration,
  createMigrationRecord,
  createVerificationStatus,
  TrustedRepositoryService,
} from '../identityService'
import type { PhoneAppPackage, InstalledAppExtended } from '@/types/appPackage'
import type {
  AppSourceInfo,
  BuiltinSourceInfo,
  RepositorySourceInfo,
  UrlSourceInfo,
  LocalSourceInfo,
  DataMigrationAction,
} from '@/types/appIdentity'

// Mock 数据库
vi.mock('@/services/database', () => ({
  db: {
    trustedRepositories: {
      get: vi.fn(),
      add: vi.fn(),
      toArray: vi.fn(),
      filter: vi.fn(() => ({ toArray: vi.fn() })),
      update: vi.fn(),
      delete: vi.fn(),
    },
    appData: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => []),
          delete: vi.fn(),
        })),
      })),
    },
  },
}))

describe('IdentityService', () => {
  // 创建测试用的 app 包
  const createTestPackage = (overrides: Partial<PhoneAppPackage> = {}): PhoneAppPackage => ({
    id: 'test-app',
    name: 'Test App',
    version: '1.0.0',
    packageVersion: '1.0',
    appType: 'configurable',
    icon: { type: 'emoji', value: '📱', background: '#f0f0f0' },
    ...overrides,
  })

  describe('calculateDataNamespace', () => {
    describe('内置应用', () => {
      it('应该生成 builtin/{appId} 格式的命名空间', () => {
        const pkg = createTestPackage({ id: 'calculator' })
        const source: BuiltinSourceInfo = { type: 'builtin' }
        
        const namespace = calculateDataNamespace(pkg, source, 'inst_123')
        
        expect(namespace).toBe('builtin/calculator')
      })

      it('不同 appId 应该生成不同的命名空间', () => {
        const pkg1 = createTestPackage({ id: 'app-1' })
        const pkg2 = createTestPackage({ id: 'app-2' })
        const source: BuiltinSourceInfo = { type: 'builtin' }
        
        const ns1 = calculateDataNamespace(pkg1, source, 'inst_123')
        const ns2 = calculateDataNamespace(pkg2, source, 'inst_123')
        
        expect(ns1).not.toBe(ns2)
      })
    })

    describe('仓库应用', () => {
      it('应该生成 repo/{repoId}/{developerId}/{appId} 格式的命名空间', () => {
        const pkg = createTestPackage({ 
          id: 'notes', 
          author: { name: 'dev1' } 
        })
        const source: RepositorySourceInfo = {
          type: 'repository',
          repositoryId: 'official',
          signature: 'sig123',
          signedAt: Date.now(),
        }
        
        const namespace = calculateDataNamespace(pkg, source, 'inst_123')
        
        expect(namespace).toBe('repo/official/dev1/notes')
      })

      it('没有 author 时应该使用 unknown', () => {
        const pkg = createTestPackage({ id: 'notes' })
        const source: RepositorySourceInfo = {
          type: 'repository',
          repositoryId: 'official',
          signature: 'sig123',
          signedAt: Date.now(),
        }
        
        const namespace = calculateDataNamespace(pkg, source, 'inst_123')
        
        expect(namespace).toBe('repo/official/unknown/notes')
      })

      it('不同仓库的同名应用应该有不同的命名空间', () => {
        const pkg = createTestPackage({ id: 'notes', author: { name: 'dev1' } })
        const source1: RepositorySourceInfo = {
          type: 'repository',
          repositoryId: 'repo-a',
          signature: 'sig',
          signedAt: Date.now(),
        }
        const source2: RepositorySourceInfo = {
          type: 'repository',
          repositoryId: 'repo-b',
          signature: 'sig',
          signedAt: Date.now(),
        }
        
        const ns1 = calculateDataNamespace(pkg, source1, 'inst_123')
        const ns2 = calculateDataNamespace(pkg, source2, 'inst_123')
        
        expect(ns1).not.toBe(ns2)
      })
    })

    describe('URL 导入应用', () => {
      it('应该生成 url/{domain}/{hash} 格式的命名空间', () => {
        const pkg = createTestPackage({ id: 'url-app' })
        const source: UrlSourceInfo = {
          type: 'url',
          url: 'https://example.com/apps/my-app.json',
          contentHash: 'a1b2c3d4e5f67890abcd',
          fetchedAt: Date.now(),
        }
        
        const namespace = calculateDataNamespace(pkg, source, 'inst_123')
        
        expect(namespace).toBe('url/example.com/a1b2c3d4')
      })

      it('无效 URL 应该使用 invalid 前缀', () => {
        const pkg = createTestPackage({ id: 'url-app' })
        const source: UrlSourceInfo = {
          type: 'url',
          url: 'not-a-valid-url',
          contentHash: 'a1b2c3d4e5f67890abcd',
          fetchedAt: Date.now(),
        }
        
        const namespace = calculateDataNamespace(pkg, source, 'inst_123')
        
        expect(namespace).toBe('url/invalid/a1b2c3d4')
      })

      it('不同 URL 的应用应该有不同的命名空间', () => {
        const pkg = createTestPackage({ id: 'url-app' })
        const source1: UrlSourceInfo = {
          type: 'url',
          url: 'https://site-a.com/app.json',
          contentHash: 'hash1234',
          fetchedAt: Date.now(),
        }
        const source2: UrlSourceInfo = {
          type: 'url',
          url: 'https://site-b.com/app.json',
          contentHash: 'hash5678',
          fetchedAt: Date.now(),
        }
        
        const ns1 = calculateDataNamespace(pkg, source1, 'inst_123')
        const ns2 = calculateDataNamespace(pkg, source2, 'inst_123')
        
        expect(ns1).not.toBe(ns2)
      })
    })

    describe('本地导入应用', () => {
      it('应该生成 local/{installationId} 格式的命名空间', () => {
        const pkg = createTestPackage({ id: 'local-app' })
        const source: LocalSourceInfo = {
          type: 'local',
          fileName: 'my-app.json',
          importedAt: Date.now(),
        }
        
        const namespace = calculateDataNamespace(pkg, source, 'inst_xyz12345')
        
        expect(namespace).toBe('local/inst_xyz12345')
      })

      it('不同安装 ID 应该有不同的命名空间', () => {
        const pkg = createTestPackage({ id: 'local-app' })
        const source: LocalSourceInfo = {
          type: 'local',
          fileName: 'my-app.json',
          importedAt: Date.now(),
        }
        
        const ns1 = calculateDataNamespace(pkg, source, 'inst_aaa')
        const ns2 = calculateDataNamespace(pkg, source, 'inst_bbb')
        
        expect(ns1).not.toBe(ns2)
      })
    })
  })

  describe('getSignableContent', () => {
    it('应该返回包含关键字段的 JSON 字符串', () => {
      const pkg = createTestPackage({
        id: 'my-app',
        version: '2.0.0',
        name: 'My App',
        appType: 'configurable',
      })
      
      const content = getSignableContent(pkg)
      const parsed = JSON.parse(content)
      
      expect(parsed).toEqual({
        id: 'my-app',
        version: '2.0.0',
        name: 'My App',
        appType: 'configurable',
      })
    })

    it('不应该包含非关键字段', () => {
      const pkg = createTestPackage({
        description: 'A test app',
        author: { name: 'Test Author' },
      })
      
      const content = getSignableContent(pkg)
      const parsed = JSON.parse(content)
      
      expect(parsed).not.toHaveProperty('description')
      expect(parsed).not.toHaveProperty('author')
      expect(parsed).not.toHaveProperty('icon')
    })
  })

  describe('verifyEd25519Signature', () => {
    it('签名和公钥都存在时应该返回 true（简化实现）', async () => {
      const result = await verifyEd25519Signature('content', 'signature', 'publicKey')
      expect(result).toBe(true)
    })

    it('签名为空时应该返回 false', async () => {
      const result = await verifyEd25519Signature('content', '', 'publicKey')
      expect(result).toBe(false)
    })

    it('公钥为空时应该返回 false', async () => {
      const result = await verifyEd25519Signature('content', 'signature', '')
      expect(result).toBe(false)
    })
  })

  describe('verifyAndInstall', () => {
    describe('内置应用', () => {
      it('应该返回完全信任的结果', async () => {
        const pkg = createTestPackage()
        const source: BuiltinSourceInfo = { type: 'builtin' }
        
        const result = await verifyAndInstall(pkg, source)
        
        expect(result.verified).toBe(true)
        expect(result.trustLevel).toBe('full')
        expect(result.canInstall).toBe(true)
        expect(result.error).toBeUndefined()
      })
    })

    describe('URL 导入应用', () => {
      it('应该返回 TOFU 信任级别', async () => {
        const pkg = createTestPackage()
        const source: UrlSourceInfo = {
          type: 'url',
          url: 'https://example.com/app.json',
          contentHash: 'hash123',
          fetchedAt: Date.now(),
        }
        
        const result = await verifyAndInstall(pkg, source)
        
        expect(result.verified).toBe(false)
        expect(result.trustLevel).toBe('tofu')
        expect(result.canInstall).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.length).toBeGreaterThan(0)
        expect(result.tofu).toEqual({
          url: 'https://example.com/app.json',
          contentHash: 'hash123',
        })
      })
    })

    describe('本地导入应用', () => {
      it('应该返回不信任但可安装的结果', async () => {
        const pkg = createTestPackage()
        const source: LocalSourceInfo = {
          type: 'local',
          fileName: 'app.json',
          importedAt: Date.now(),
        }
        
        const result = await verifyAndInstall(pkg, source)
        
        expect(result.verified).toBe(false)
        expect(result.trustLevel).toBe('untrusted')
        expect(result.canInstall).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.length).toBeGreaterThan(0)
      })
    })
  })

  describe('checkDataMigration', () => {
    const createInstalledApp = (dataVersion: number): InstalledAppExtended => ({
      id: 'test-app',
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      source: 'builtin',
      status: 'installed',
      package: {
        id: 'test-app',
        name: 'Test App',
        version: '1.0.0',
        packageVersion: '1.0',
        appType: 'configurable',
        icon: { type: 'emoji', value: '📱', background: '#f0f0f0' },
      },
      grantedPermissions: [],
      installationId: 'inst_123',
      currentDataVersion: dataVersion,
      sourceInfo: { type: 'builtin' },
      verificationStatus: { verified: true, trustLevel: 'full' },
      dataNamespace: 'builtin/test-app',
    })

    it('版本相同时不需要迁移', () => {
      const installed = createInstalledApp(2)
      const newPkg = createTestPackage({ dataVersion: 2 })
      
      const result = checkDataMigration(installed, newPkg)
      
      expect(result.needed).toBe(false)
      expect(result.fromVersion).toBe(2)
      expect(result.toVersion).toBe(2)
      expect(result.migrations).toEqual([])
    })

    it('新版本更低时不需要迁移', () => {
      const installed = createInstalledApp(3)
      const newPkg = createTestPackage({ dataVersion: 2 })
      
      const result = checkDataMigration(installed, newPkg)
      
      expect(result.needed).toBe(false)
    })

    it('新版本更高时需要迁移', () => {
      const installed = createInstalledApp(1)
      const newPkg = createTestPackage({ 
        dataVersion: 3,
        dataMigrations: {
          '1:2': [{ type: 'rename', from: 'old', to: 'new' }],
          '2:3': [{ type: 'delete', fields: ['temp'] }],
        },
      })
      
      const result = checkDataMigration(installed, newPkg)
      
      expect(result.needed).toBe(true)
      expect(result.fromVersion).toBe(1)
      expect(result.toVersion).toBe(3)
      expect(result.migrations).toHaveLength(2)
    })

    it('没有 dataVersion 时默认为 1', () => {
      const installed = createInstalledApp(1)
      const newPkg = createTestPackage()
      delete (newPkg as any).dataVersion
      
      const result = checkDataMigration(installed, newPkg)
      
      expect(result.needed).toBe(false)
      expect(result.toVersion).toBe(1)
    })
  })

  describe('createMigrationRecord', () => {
    it('成功迁移应该创建正确的记录', () => {
      const result = createMigrationRecord(1, 2, { success: true })
      
      expect(result.fromVersion).toBe(1)
      expect(result.toVersion).toBe(2)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.migratedAt).toBeDefined()
    })

    it('失败迁移应该包含错误信息', () => {
      const result = createMigrationRecord(1, 2, { 
        success: false, 
        error: '迁移失败' 
      })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('迁移失败')
    })
  })

  describe('createVerificationStatus', () => {
    it('应该从验证结果创建正确的状态', () => {
      const status = createVerificationStatus({
        verified: true,
        trustLevel: 'repository',
        canInstall: true,
        guaranteedBy: '官方商店',
        warnings: ['警告1'],
      })
      
      expect(status.verified).toBe(true)
      expect(status.trustLevel).toBe('repository')
      expect(status.guaranteedBy).toBe('官方商店')
      expect(status.warnings).toEqual(['警告1'])
    })
  })

  describe('verifyUpdate', () => {
    const createInstalledApp = (source: AppSourceInfo): InstalledAppExtended => ({
      id: 'test-app',
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      source: 'builtin',
      status: 'installed',
      package: {
        id: 'test-app',
        name: 'Test App',
        version: '1.0.0',
        packageVersion: '1.0',
        appType: 'configurable',
        icon: { type: 'emoji', value: '📱', background: '#f0f0f0' },
      },
      grantedPermissions: [],
      installationId: 'inst_123',
      currentDataVersion: 1,
      sourceInfo: source,
      verificationStatus: { verified: true, trustLevel: 'full' },
      dataNamespace: 'test',
    })

    it('来源类型不同应该拒绝更新', async () => {
      const installed = createInstalledApp({ type: 'builtin' })
      const newPkg = createTestPackage()
      const newSource: UrlSourceInfo = {
        type: 'url',
        url: 'https://example.com/app.json',
        contentHash: 'hash',
        fetchedAt: Date.now(),
      }
      
      const result = await verifyUpdate(installed, newPkg, newSource)
      
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('来源类型')
    })

    it('URL 应用更新 URL 不同应该拒绝', async () => {
      const source1: UrlSourceInfo = {
        type: 'url',
        url: 'https://site-a.com/app.json',
        contentHash: 'hash1',
        fetchedAt: Date.now(),
      }
      const source2: UrlSourceInfo = {
        type: 'url',
        url: 'https://site-b.com/app.json',
        contentHash: 'hash2',
        fetchedAt: Date.now(),
      }
      const installed = createInstalledApp(source1)
      const newPkg = createTestPackage()
      
      const result = await verifyUpdate(installed, newPkg, source2)
      
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('URL')
    })

    it('本地应用不允许更新', async () => {
      const source: LocalSourceInfo = {
        type: 'local',
        fileName: 'app.json',
        importedAt: Date.now(),
      }
      const installed = createInstalledApp(source)
      const newPkg = createTestPackage()
      
      const result = await verifyUpdate(installed, newPkg, source)
      
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('本地导入')
    })
  })
})

describe('TrustedRepositoryService', () => {
  let service: TrustedRepositoryService

  beforeEach(() => {
    service = new TrustedRepositoryService()
    vi.clearAllMocks()
  })

  it('应该创建服务实例', () => {
    expect(service).toBeInstanceOf(TrustedRepositoryService)
  })

  describe('delete', () => {
    it('不应该删除官方仓库', async () => {
      const result = await service.delete('official')
      expect(result).toBe(false)
    })
  })
})
