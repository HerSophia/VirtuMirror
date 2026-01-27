/**
 * 应用身份识别服务
 *
 * 提供应用身份验证、数据命名空间计算、安装验证、数据迁移等功能
 */

import { db } from '@/services/database'
import { AppDataService } from './dataService'
import type {
  AppSourceInfo,
  TrustedRepository,
  InstallVerificationResult,
  UpdateVerificationResult,
  DataMigrationCheck,
  DataMigrationAction,
  MigrationResult,
  MigrationRecord,
  VerificationStatus,
} from '@/types/appIdentity'
import { OFFICIAL_REPOSITORY } from '@/types/appIdentity'
import type { PhoneAppPackage, InstalledAppExtended } from '@/types/appPackage'

// ============ 数据命名空间计算 ============

/**
 * 计算应用的数据命名空间
 * 根据应用来源确定数据隔离边界
 */
export function calculateDataNamespace(
  pkg: PhoneAppPackage,
  sourceInfo: AppSourceInfo,
  installationId: string
): string {
  switch (sourceInfo.type) {
    case 'builtin':
      // 内置应用：直接用 appId
      return `builtin/${pkg.id}`

    case 'repository': {
      // 仓库应用：仓库担保身份，可信任 developerId
      const developerId = pkg.author?.name ?? 'unknown'
      return `repo/${sourceInfo.repositoryId}/${developerId}/${pkg.id}`
    }

    case 'url': {
      // URL 导入：用域名 + 内容哈希（TOFU）
      try {
        const domain = new URL(sourceInfo.url).hostname
        const hash = sourceInfo.contentHash.substring(0, 8)
        return `url/${domain}/${hash}`
      } catch {
        return `url/invalid/${sourceInfo.contentHash.substring(0, 8)}`
      }
    }

    case 'local':
      // 本地导入：用随机安装 ID 完全隔离
      return `local/${installationId}`
  }
}

// ============ 受信任仓库管理 ============

/**
 * 受信任仓库服务
 */
export class TrustedRepositoryService {
  /**
   * 初始化（确保官方仓库存在）
   */
  async initialize(): Promise<void> {
    const official = await db.trustedRepositories.get('official')
    if (!official) {
      await db.trustedRepositories.add(OFFICIAL_REPOSITORY)
    }
  }

  /**
   * 获取所有受信任仓库
   */
  async getAll(): Promise<TrustedRepository[]> {
    return db.trustedRepositories.toArray()
  }

  /**
   * 获取已启用的仓库
   */
  async getEnabled(): Promise<TrustedRepository[]> {
    return db.trustedRepositories.filter((repo) => repo.enabled).toArray()
  }

  /**
   * 根据ID获取仓库
   */
  async getById(id: string): Promise<TrustedRepository | undefined> {
    return db.trustedRepositories.get(id)
  }

  /**
   * 添加仓库
   */
  async add(repo: TrustedRepository): Promise<void> {
    await db.trustedRepositories.add(repo)
  }

  /**
   * 更新仓库
   */
  async update(id: string, updates: Partial<TrustedRepository>): Promise<void> {
    await db.trustedRepositories.update(id, updates)
  }

  /**
   * 删除仓库（官方仓库不可删除）
   */
  async delete(id: string): Promise<boolean> {
    if (id === 'official') {
      return false
    }
    await db.trustedRepositories.delete(id)
    return true
  }

  /**
   * 切换仓库启用状态
   */
  async toggleEnabled(id: string): Promise<void> {
    const repo = await this.getById(id)
    if (repo) {
      await this.update(id, { enabled: !repo.enabled })
    }
  }
}

export const trustedRepositoryService = new TrustedRepositoryService()

// ============ 签名验证 ============

/**
 * 获取用于签名的内容
 */
export function getSignableContent(pkg: PhoneAppPackage): string {
  return JSON.stringify({
    id: pkg.id,
    version: pkg.version,
    name: pkg.name,
    appType: pkg.appType,
  })
}

/**
 * 验证 Ed25519 签名
 * 注意：这是一个简化实现，实际应使用 Web Crypto API 或专门的库
 */
export async function verifyEd25519Signature(
  _content: string,
  _signature: string,
  _publicKey: string
): Promise<boolean> {
  // TODO: 实现真正的 Ed25519 签名验证
  // 当前简化实现：如果公钥为空则验证失败
  // 在实际部署时需要集成 tweetnacl 或类似库

  // 简化：如果签名和公钥都存在且非空，则认为验证通过
  // 这仅用于开发阶段，生产环境必须实现真正的验证
  console.warn('[AppIdentity] 签名验证使用简化实现，生产环境需要真正的 Ed25519 验证')
  return _signature.length > 0 && _publicKey.length > 0
}

// ============ 安装验证 ============

/**
 * 验证并安装应用
 */
export async function verifyAndInstall(
  pkg: PhoneAppPackage,
  source: AppSourceInfo
): Promise<InstallVerificationResult> {
  // Level 0: 内置应用
  if (source.type === 'builtin') {
    return {
      verified: true,
      trustLevel: 'full',
      canInstall: true,
    }
  }

  // Level 1-2: 仓库来源
  if (source.type === 'repository') {
    const repo = await trustedRepositoryService.getById(source.repositoryId)
    if (!repo) {
      return {
        verified: false,
        trustLevel: 'untrusted',
        canInstall: false,
        error: '未知仓库，请先添加该仓库',
      }
    }

    if (!repo.enabled) {
      return {
        verified: false,
        trustLevel: 'untrusted',
        canInstall: false,
        error: '该仓库已被禁用',
      }
    }

    // 验证仓库签名
    const signatureValid = await verifyEd25519Signature(
      getSignableContent(pkg),
      source.signature,
      repo.publicKey
    )

    if (!signatureValid) {
      return {
        verified: false,
        trustLevel: 'untrusted',
        canInstall: false,
        error: '应用签名验证失败，可能已被篡改',
      }
    }

    return {
      verified: true,
      trustLevel: 'repository',
      guaranteedBy: repo.name,
      canInstall: true,
    }
  }

  // Level 3: URL 导入
  if (source.type === 'url') {
    return {
      verified: false,
      trustLevel: 'tofu',
      canInstall: true, // 允许安装，但需警告
      warnings: [
        '无法验证开发者身份',
        '任何人都可以在应用中声称任意开发者名称',
        '请仅安装来自您信任的 URL',
      ],
      tofu: {
        url: source.url,
        contentHash: source.contentHash,
      },
    }
  }

  // Level 4: 本地导入
  if (source.type === 'local') {
    return {
      verified: false,
      trustLevel: 'untrusted',
      canInstall: true, // 允许安装，但需强警告
      warnings: [
        '无法验证开发者身份',
        '无法验证应用来源',
        '无法验证应用完整性',
        '该应用数据将完全独立存储',
      ],
    }
  }

  // 未知来源
  return {
    verified: false,
    trustLevel: 'untrusted',
    canInstall: false,
    error: '未知的应用来源类型',
  }
}

// ============ 更新验证 ============

/**
 * 验证应用更新
 */
export async function verifyUpdate(
  installed: InstalledAppExtended,
  newPkg: PhoneAppPackage,
  newSource: AppSourceInfo
): Promise<UpdateVerificationResult> {
  const oldSource = installed.sourceInfo

  // 检查来源一致性
  if (oldSource.type !== newSource.type) {
    return {
      allowed: false,
      reason: '更新来源类型与原安装不符',
      suggestion: '请卸载后重新安装',
    }
  }

  // 仓库应用：必须来自同一仓库
  if (oldSource.type === 'repository' && newSource.type === 'repository') {
    if (oldSource.repositoryId !== newSource.repositoryId) {
      return {
        allowed: false,
        reason: '更新来自不同仓库',
        suggestion: '请从原仓库获取更新',
      }
    }
  }

  // URL 应用：必须来自同一 URL（TOFU）
  if (oldSource.type === 'url' && newSource.type === 'url') {
    if (oldSource.url !== newSource.url) {
      return {
        allowed: false,
        reason: '更新 URL 与原安装不符',
        warning: '这可能是尝试劫持应用数据的攻击',
      }
    }
  }

  // 本地应用：不允许更新（每次导入都是新安装）
  if (oldSource.type === 'local') {
    return {
      allowed: false,
      reason: '本地导入应用不支持更新',
      suggestion: '请卸载后重新导入',
    }
  }

  // 通过基本检查，继续数据迁移检查
  return {
    allowed: true,
    dataMigration: checkDataMigration(installed, newPkg),
  }
}

// ============ 数据迁移 ============

/**
 * 检查是否需要数据迁移
 */
export function checkDataMigration(
  installed: InstalledAppExtended,
  newPkg: PhoneAppPackage
): DataMigrationCheck {
  const oldVersion = installed.currentDataVersion
  const newVersion = newPkg.dataVersion ?? 1

  if (newVersion <= oldVersion) {
    return {
      needed: false,
      fromVersion: oldVersion,
      toVersion: newVersion,
      migrations: [],
    }
  }

  // 收集所有需要执行的迁移
  const allMigrations: DataMigrationAction[] = []
  const migrationDefs = newPkg.dataMigrations ?? {}

  for (let v = oldVersion; v < newVersion; v++) {
    const key = `${v}:${v + 1}`
    const actions = migrationDefs[key] ?? []
    allMigrations.push(...actions)
  }

  return {
    needed: true,
    fromVersion: oldVersion,
    toVersion: newVersion,
    migrations: allMigrations,
  }
}

/**
 * 预定义的数据转换器
 */
const DATA_TRANSFORMERS: Record<string, (v: unknown) => unknown> = {
  intToFloat: (v) => (typeof v === 'number' ? v : parseFloat(String(v))),
  stringToArray: (v) => (typeof v === 'string' ? v.split(',') : v),
  boolToInt: (v) => (v ? 1 : 0),
  intToBool: (v) => Boolean(v),
  stringify: (v) => JSON.stringify(v),
  parse: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
  trim: (v) => (typeof v === 'string' ? v.trim() : v),
  lowercase: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  uppercase: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
}

/**
 * 执行数据迁移
 */
export async function executeDataMigration(
  namespace: string,
  migrations: DataMigrationAction[]
): Promise<MigrationResult> {
  const dataService = new AppDataService(namespace)

  try {
    for (const action of migrations) {
      switch (action.type) {
        case 'rename': {
          const value = await dataService.get(action.from)
          if (value !== undefined) {
            await dataService.set(action.to, value)
            await dataService.delete(action.from)
          }
          break
        }

        case 'delete': {
          for (const field of action.fields) {
            await dataService.delete(field)
          }
          break
        }

        case 'setDefault': {
          const existing = await dataService.get(action.field)
          if (existing === undefined) {
            await dataService.set(action.field, action.value)
          }
          break
        }

        case 'merge': {
          const sources = await Promise.all(action.source.map((s) => dataService.get(s)))
          const merged = Object.assign({}, ...sources.filter(Boolean))
          await dataService.set(action.target, merged)
          for (const s of action.source) {
            await dataService.delete(s)
          }
          break
        }

        case 'transform': {
          const transformer = DATA_TRANSFORMERS[action.transformer]
          if (transformer) {
            const oldVal = await dataService.get(action.field)
            if (oldVal !== undefined) {
              await dataService.set(action.field, transformer(oldVal))
            }
          } else {
            console.warn(`[AppIdentity] 未知的转换器: ${action.transformer}`)
          }
          break
        }
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '迁移失败',
    }
  }
}

/**
 * 创建迁移记录
 */
export function createMigrationRecord(
  fromVersion: number,
  toVersion: number,
  result: MigrationResult
): MigrationRecord {
  return {
    fromVersion,
    toVersion,
    migratedAt: new Date().toISOString(),
    success: result.success,
    error: result.error,
  }
}

// ============ 验证状态工具 ============

/**
 * 从安装验证结果创建验证状态
 */
export function createVerificationStatus(result: InstallVerificationResult): VerificationStatus {
  return {
    verified: result.verified,
    trustLevel: result.trustLevel,
    guaranteedBy: result.guaranteedBy,
    warnings: result.warnings,
  }
}
