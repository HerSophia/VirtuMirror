/**
 * App 身份识别与数据隔离类型定义
 * 
 * 解决 App 同名不同开发者、同开发者不同版本、恶意身份伪造等场景下的数据管理和安全问题
 */

// ===== 应用来源类型 =====

/** 应用来源类型 */
export type AppSourceType =
  | 'builtin'    // 内置应用
  | 'repository' // 仓库安装
  | 'url'        // URL 导入
  | 'local'      // 本地文件导入

/** 内置应用来源信息 */
export interface BuiltinSourceInfo {
  type: 'builtin'
}

/** 仓库应用来源信息 */
export interface RepositorySourceInfo {
  type: 'repository'
  /** 仓库ID */
  repositoryId: string
  /** 仓库对应用包的签名 */
  signature: string
  /** 签名时间戳 */
  signedAt: number
}

/** URL导入应用来源信息 */
export interface UrlSourceInfo {
  type: 'url'
  /** 来源URL */
  url: string
  /** 首次安装时的内容哈希 */
  contentHash: string
  /** 获取时间戳 */
  fetchedAt: number
}

/** 本地文件导入应用来源信息 */
export interface LocalSourceInfo {
  type: 'local'
  /** 原始文件名 */
  fileName: string
  /** 导入时间戳 */
  importedAt: number
}

/** 应用来源详情（联合类型） */
export type AppSourceInfo =
  | BuiltinSourceInfo
  | RepositorySourceInfo
  | UrlSourceInfo
  | LocalSourceInfo

// ===== 受信任仓库 =====

/** 仓库信任级别 */
export type RepositoryTrustLevel = 'official' | 'community' | 'custom'

/** 受信任的仓库 */
export interface TrustedRepository {
  /** 仓库唯一 ID */
  id: string

  /** 仓库显示名称 */
  name: string

  /** 仓库描述 */
  description?: string

  /** 索引文件 URL */
  indexUrl: string

  /**
   * 仓库公钥（Ed25519）
   * 用于验证应用包签名
   * 格式: "ed25519:base64编码的公钥"
   */
  publicKey: string

  /** 信任级别 */
  trustLevel: RepositoryTrustLevel

  /** 添加时间 */
  addedAt: number

  /** 最后更新时间 */
  lastUpdatedAt?: number

  /** 是否启用 */
  enabled: boolean
}

/** 默认官方仓库 */
export const OFFICIAL_REPOSITORY: TrustedRepository = {
  id: 'official',
  name: '小手机官方商店',
  description: '官方维护的应用仓库',
  indexUrl: 'https://phone-sim.example.com/registry/index.json',
  publicKey: 'ed25519:', // 实际部署时填入
  trustLevel: 'official',
  addedAt: 0, // 内置
  enabled: true,
}

// ===== 仓库签名 =====

/** 应用包中的仓库签名 */
export interface RepositorySignature {
  /** 签名仓库 ID */
  repositoryId: string

  /**
   * 签名值
   * 仓库私钥对 (appId + version + contentHash) 的 Ed25519 签名
   */
  signature: string

  /** 签名时间戳 */
  signedAt: number
}

// ===== 验证状态 =====

/** 信任级别 */
export type TrustLevel = 'full' | 'repository' | 'tofu' | 'untrusted'

/** 验证状态 */
export interface VerificationStatus {
  /** 是否已验证 */
  verified: boolean

  /** 信任级别 */
  trustLevel: TrustLevel

  /** 担保方（仓库名称） */
  guaranteedBy?: string

  /** 警告信息 */
  warnings?: string[]
}

// ===== 数据迁移 =====

/** 数据迁移动作类型 */
export type DataMigrationAction =
  | { type: 'rename'; from: string; to: string }
  | { type: 'transform'; field: string; transformer: string }
  | { type: 'delete'; fields: string[] }
  | { type: 'merge'; source: string[]; target: string }
  | { type: 'setDefault'; field: string; value: unknown }

/** 迁移记录 */
export interface MigrationRecord {
fromVersion: number
  toVersion: number
  migratedAt: string
  success: boolean
  error?: string
}

// ===== 安装验证结果 =====

/** TOFU 信息 */
export interface TofuInfo {
  url: string
  contentHash: string
}

/** 安装验证结果 */
export interface InstallVerificationResult {
  /** 是否已验证 */
  verified: boolean
  /** 信任级别 */
  trustLevel: TrustLevel
  /** 是否允许安装 */
  canInstall: boolean
  /** 担保方 */
  guaranteedBy?: string
  /** 错误信息 */
  error?: string
  /** 警告信息 */
  warnings?: string[]
  /** TOFU 信息（URL导入时） */
  tofu?: TofuInfo
}

/** 更新验证结果 */
export interface UpdateVerificationResult {
  /** 是否允许更新 */
  allowed: boolean
  /** 原因 */
  reason?: string
  /** 警告信息 */
  warning?: string
  /** 建议 */
  suggestion?: string
  /** 数据迁移检查结果 */
  dataMigration?: DataMigrationCheck
}

/** 数据迁移检查结果 */
export interface DataMigrationCheck {
  /** 是否需要迁移 */
  needed: boolean
  /** 起始版本 */
  fromVersion: number
  /** 目标版本 */
  toVersion: number
  /** 迁移动作列表 */
  migrations: DataMigrationAction[]
}

/** 迁移执行结果 */
export interface MigrationResult {
  success: boolean
  error?: string
}

// ===== 工具类型 =====

/** 生成安装ID */
export function generateInstallationId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'inst_'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/** 计算内容哈希（简化版，实际应使用 SHA-256） */
export async function calculateContentHash(content: string): Promise<string> {
  // 使用 Web Crypto API 计算 SHA-256
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
