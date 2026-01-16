/**
 * 鉴权模块
 * 使用简单的 API Key 机制进行身份验证
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// ============ 类型定义 ============

export interface AuthConfig {
  /** 是否启用鉴权 */
  enabled: boolean
  /** API Key */
  apiKey: string
  /** Key 文件路径 */
  keyFilePath: string
}

export interface AuthResult {
  success: boolean
  error?: string
}

// ============ API Key 管理 ============

/**
 * 生成随机 API Key
 */
export function generateApiKey(): string {
  return `pk_${crypto.randomBytes(24).toString('hex')}`
}

/**
 * 从文件加载 API Key，存在则生成新的
 */
export function loadOrCreateApiKey(keyFilePath: string): string {
  try {
    // 确保目录存在
    const dir = path.dirname(keyFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 尝试读取现有的 Key
    if (fs.existsSync(keyFilePath)) {
      const key = fs.readFileSync(keyFilePath, 'utf-8').trim()
      if (key && key.startsWith('pk_')) {
        console.log('[Auth] 已加载 API Key')
        return key
      }
    }

    // 生成新的 Key
    const newKey = generateApiKey()
    fs.writeFileSync(keyFilePath, newKey, 'utf-8')
    console.log('[Auth] 已生成新的 API Key')
    console.log(`[Auth] Key 已保存到: ${keyFilePath}`)
    return newKey
  } catch (error) {
    console.error('[Auth] 加载/创建 API Key 失败:', error)
    // 返回内存中的临时 Key
    return generateApiKey()
  }
}

// ============ 鉴权验证 ============

/**
 * 验证 API Key
 */
export function validateApiKey(providedKey: string | undefined, expectedKey: string): AuthResult {
  if (!providedKey) {
    return {
      success: false,
      error: 'missing_api_key',
    }
  }

  // 使用时间安全的比较防止时序攻击
  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedKey),
    Buffer.from(expectedKey)
  )

  if (!isValid) {
    return {
      success: false,
      error: 'invalid_api_key',
    }
  }

  return { success: true }
}

/**
 * 验证 Socket 连接的鉴权信息
 */
export function validateSocketAuth(
  handshake: { query: Record<string, string | string[] | undefined>; auth: Record<string, unknown> },
  expectedKey: string
): AuthResult {
  // 优先从 auth 对象获取（Socket.IO 推荐方式）
  let apiKey = handshake.auth?.apiKey as string | undefined
  
  // 备用：从 query 参数获取
  if (!apiKey) {
    const queryKey = handshake.query.apiKey
    apiKey = Array.isArray(queryKey) ? queryKey[0] : queryKey
  }

  return validateApiKey(apiKey, expectedKey)
}

// ============ AuthManager 类 ============

export class AuthManager {
  private config: AuthConfig

  constructor(options: Partial<AuthConfig> = {}) {
    const enabled = options.enabled ?? (process.env.AUTH_ENABLED !== 'false')
    const keyFilePath = options.keyFilePath ?? process.env.KEY_FILE_PATH ?? './data/api.key'
    
    let apiKey: string
    if (options.apiKey) {
      apiKey = options.apiKey
    } else if (process.env.API_KEY) {
      apiKey = process.env.API_KEY
    } else if (enabled) {
      apiKey = loadOrCreateApiKey(keyFilePath)
    } else {
      apiKey = ''
    }

    this.config = {
      enabled,
      apiKey,
      keyFilePath,
    }

    if (enabled) {
      console.log('[Auth] 鉴权已启用')
      console.log(`[Auth] API Key: ${this.getMaskedKey()}`)
    } else {
      console.log('[Auth] ⚠️ 鉴权已禁用（不推荐用于生产环境）')
    }
  }

  /** 获取脱敏的 Key（用于日志显示） */
  getMaskedKey(): string {
    if (!this.config.apiKey) return '(empty)'
    const key = this.config.apiKey
    if (key.length <= 12) return '****'
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`
  }

  /** 获取完整的 Key（用于配置分享） */
  getFullKey(): string {
    return this.config.apiKey
  }

  /** 检查是否启用鉴权 */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /** 验证 API Key */
  validate(providedKey: string | undefined): AuthResult {
    if (!this.config.enabled) {
      return { success: true }
    }
    return validateApiKey(providedKey, this.config.apiKey)
  }

  /** 验证 Socket 连接 */
  validateSocket(
    handshake: { query: Record<string, string | string[] | undefined>; auth: Record<string, unknown> }
  ): AuthResult {
    if (!this.config.enabled) {
      return { success: true }
    }
    return validateSocketAuth(handshake, this.config.apiKey)
  }

  /** 重新生成 API Key */
  regenerateKey(): string {
    const newKey = generateApiKey()
    this.config.apiKey = newKey
    
    // 保存到文件
    try {
      fs.writeFileSync(this.config.keyFilePath, newKey, 'utf-8')
      console.log('[Auth] API Key 已重新生成并保存')
    } catch (error) {
      console.error('[Auth] 保存新 Key 失败:', error)
    }
    
    return newKey
  }
}
