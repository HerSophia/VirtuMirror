import fs from 'fs'
import path from 'path'

/**
 * 数据存储模块
 * 提供内存缓存和可选的持久化支持
 * 
 * 注意：这个模块用于在服务器端临时缓存同步数据
 * 主要的数据存储仍然在前端的 IndexedDB 中
 */

// ============ 类型定义 ============

/** 会话信息 */
export interface Session {
  id: string                    // sessionId (UUID)
  platform: string              // 来源平台
  characterName: string         // 角色名
  playerName: string            // 玩家名
  createdAt: number
  lastActiveAt: number
}

/** 缓存的消息 */
export interface CachedMessage {
  message_id: number            // 酒馆楼层号
  sessionId: string             // 所属会话
  name: string
  role: 'system' | 'assistant' | 'user'
  is_hidden: boolean
  message: string
  data: Record<string, unknown>
  extra: Record<string, unknown>
  cachedAt: number              // 缓存时间
}

/** 缓存的同步数据 */
export interface CachedSyncData {
  sessionId: string
  platform: string
  characterName: string
  playerName: string
  messages: CachedMessage[]
  messageRange: { start: number; end: number }
  contacts: unknown[]
  moments: unknown[]
  emails: unknown[]
  syncedAt: number
}

/** 存储配置 */
export interface StorageConfig {
  /** 最大缓存会话数 */
  maxSessions: number
  /** 消息缓存时间（毫秒） */
  messageTTL: number
  /** 会话缓存时间（毫秒） */
  sessionTTL: number
  /** 是否启用持久化 */
  persistent: boolean
  /** 持久化文件路径 */
  dataFilePath: string
  /** 备份目录路径 */
  backupDir: string
}

const DEFAULT_CONFIG: StorageConfig = {
  maxSessions: 10,
  messageTTL: 24 * 60 * 60 * 1000,      // 24 小时
  sessionTTL: 7 * 24 * 60 * 60 * 1000,  // 7 天
  persistent: false,
  dataFilePath: './data/cache.json',
  backupDir: './data/storage',
}

// ============ StorageManager 类 ============

export class StorageManager {
  private config: StorageConfig
  
  // 内存缓存
  private sessions = new Map<string, Session>()
  private syncDataCache = new Map<string, CachedSyncData>()
  
  // 清理定时器
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(options: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options }
    
    // 从环境变量读取配置
    if (process.env.STORAGE_PERSISTENT === 'true') {
      this.config.persistent = true
    }
    if (process.env.STORAGE_DATA_FILE) {
      this.config.dataFilePath = process.env.STORAGE_DATA_FILE
    }
    
    // 确保目录存在
    this.ensureDirs()

    // 加载持久化数据
    if (this.config.persistent) {
      this.loadFromDisk()
    }
    
    // 启动定期清理
    this.startCleanup()
    
    console.log('[Storage] 存储管理器已初始化')
    console.log(`[Storage] 持久化: ${this.config.persistent ? '已启用' : '已禁用'}`)
  }

  /** 确保必要的目录存在 */
  private ensureDirs() {
    try {
      const cacheDir = path.dirname(this.config.dataFilePath)
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true })
      }
      
      if (!fs.existsSync(this.config.backupDir)) {
        fs.mkdirSync(this.config.backupDir, { recursive: true })
      }
    } catch (error) {
      console.error('[Storage] 创建目录失败:', error)
    }
  }

  // ==================== 备份管理 (Full Backup) ====================

  /** 获取备份文件路径 */
  private getBackupPath(sessionId: string): string {
    // 简单的文件名清理，防止路径遍历
    // 注意：Windows 文件名不支持冒号，所以需要将 : 替换为其他字符 (如 __)
    const safeId = sessionId.replace(/:/g, '__').replace(/[^a-zA-Z0-9__-]/g, '_')
    return path.join(this.config.backupDir, `${safeId}.json`)
  }

  /** 保存备份 */
  async saveBackup(sessionId: string, data: any): Promise<{ success: true; syncedAt: number }> {
    const timestamp = Date.now()
    const filePath = this.getBackupPath(sessionId)
    
    console.log(`[Storage] 正在保存备份: ${sessionId} -> ${filePath}`)
    console.log(`[Storage] 数据概览: Tables=${data?.data?.tables?.length}, Format=${data?.formatName}`)

    const backupData = {
      sessionId,
      updatedAt: timestamp,
      version: 1,
      data // 实际的数据库导出数据
    }
    
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8')
      console.log(`[Storage] 备份已保存: ${sessionId}`)
      return { success: true, syncedAt: timestamp }
    } catch (error) {
      console.error(`[Storage] 保存备份失败 ${sessionId}:`, error)
      throw error
    }
  }

  /** 获取备份 */
  async getBackup(sessionId: string): Promise<{ timestamp: number; data: any } | null> {
    const filePath = this.getBackupPath(sessionId)
    
    if (!fs.existsSync(filePath)) {
      return null
    }
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const backup = JSON.parse(content)
      return {
        timestamp: backup.updatedAt,
        data: backup.data
      }
    } catch (error) {
      console.error(`[Storage] 读取备份失败 ${sessionId}:`, error)
      return null
    }
  }

  /** 获取备份元数据 */
  async getBackupMeta(sessionId: string): Promise<{ updatedAt: number; size: number } | null> {
    const filePath = this.getBackupPath(sessionId)
    
    if (!fs.existsSync(filePath)) {
      return null
    }
    
    try {
      const stats = await fs.promises.stat(filePath)
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const backup = JSON.parse(content)
      
      return {
        updatedAt: backup.updatedAt,
        size: stats.size
      }
    } catch (error) {
      console.error(`[Storage] 获取备份元数据失败 ${sessionId}:`, error)
      return null
    }
  }

  // ==================== 会话管理 ====================

  /** 获取或创建会话 */
  getOrCreateSession(
    sessionId: string,
    platform: string,
    characterName: string,
    playerName: string
  ): Session {
    let session = this.sessions.get(sessionId)
    
    if (!session) {
      session = {
        id: sessionId,
        platform,
        characterName,
        playerName,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      }
      this.sessions.set(sessionId, session)
      console.log(`[Storage] 创建新会话: ${sessionId}`)
    } else {
      // 更新会话信息
      session.characterName = characterName
      session.playerName = playerName
      session.lastActiveAt = Date.now()
    }
    
    // 清理过多的会话
    this.enforceMaxSessions()
    
    return session
  }

  /** 获取会话 */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  /** 获取所有会话 */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  }

  /** 删除会话及其数据 */
  deleteSession(sessionId: string): boolean {
    const existed = this.sessions.delete(sessionId)
    this.syncDataCache.delete(sessionId)
    if (existed) {
      console.log(`[Storage] 删除会话: ${sessionId}`)
    }
    return existed
  }

  // ==================== 同步数据缓存 ====================

  /** 缓存同步数据 */
  cacheSyncData(data: {
    sessionId: string
    platform: string
    characterName: string
    playerName: string
    messages?: Array<{
      message_id: number
      sessionId?: string
      name: string
      role: 'system' | 'assistant' | 'user'
      is_hidden: boolean
      message: string
      data?: Record<string, unknown>
      extra?: Record<string, unknown>
    }>
    messageRange?: { start: number; end: number }
    contacts?: unknown[]
    moments?: unknown[]
    emails?: unknown[]
  }): void {
    const now = Date.now()
    
    // 确保会话存在
    this.getOrCreateSession(
      data.sessionId,
      data.platform,
      data.characterName,
      data.playerName
    )
    
    // 转换消息格式
    const cachedMessages: CachedMessage[] = (data.messages || []).map(msg => ({
      message_id: msg.message_id,
      sessionId: data.sessionId,
      name: msg.name,
      role: msg.role,
      is_hidden: msg.is_hidden,
      message: msg.message,
      data: msg.data || {},
      extra: msg.extra || {},
      cachedAt: now,
    }))
    
    const cached: CachedSyncData = {
      sessionId: data.sessionId,
      platform: data.platform,
      characterName: data.characterName,
      playerName: data.playerName,
      messages: cachedMessages,
      messageRange: data.messageRange || { start: 0, end: 0 },
      contacts: data.contacts || [],
      moments: data.moments || [],
      emails: data.emails || [],
      syncedAt: now,
    }
    
    this.syncDataCache.set(data.sessionId, cached)
    console.log(`[Storage] 缓存同步数据: ${data.sessionId} (${cachedMessages.length} 条消息)`)
    
    // 如果启用持久化，保存到磁盘
    if (this.config.persistent) {
      this.saveToDisk()
    }
  }

  /** 获取缓存的同步数据 */
  getCachedSyncData(sessionId: string): CachedSyncData | undefined {
    return this.syncDataCache.get(sessionId)
  }

  /** 获取缓存的消息 */
  getCachedMessages(sessionId: string): CachedMessage[] {
    const cached = this.syncDataCache.get(sessionId)
    return cached?.messages || []
  }

  /** 根据 message_id 获取消息 */
  getMessage(sessionId: string, messageId: number): CachedMessage | undefined {
    const messages = this.getCachedMessages(sessionId)
    return messages.find(m => m.message_id === messageId)
  }

  // ==================== 数据持久化 ====================

  /** 保存到磁盘 */
  private saveToDisk(): void {
    if (!this.config.persistent) return
    
    try {
      const dir = path.dirname(this.config.dataFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      const data = {
        version: 1,
        savedAt: Date.now(),
        sessions: Array.from(this.sessions.entries()),
        syncData: Array.from(this.syncDataCache.entries()),
      }
      
      fs.writeFileSync(
        this.config.dataFilePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      )
      
      console.log(`[Storage] 数据已保存到磁盘`)
    } catch (error) {
      console.error('[Storage] 保存到磁盘失败:', error)
    }
  }

  /** 从磁盘加载 */
  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.config.dataFilePath)) {
        console.log('[Storage] 无缓存文件，跳过加载')
        return
      }
      
      const content = fs.readFileSync(this.config.dataFilePath, 'utf-8')
      const data = JSON.parse(content)
      
      if (data.version !== 1) {
        console.warn('[Storage] 缓存文件版本不匹配，跳过加载')
        return
      }
      
      // 恢复会话
      if (data.sessions) {
        this.sessions = new Map(data.sessions)
      }
      
      // 恢复同步数据
      if (data.syncData) {
        this.syncDataCache = new Map(data.syncData)
      }
      
      console.log(`[Storage] 已从磁盘加载 ${this.sessions.size} 个会话`)
    } catch (error) {
      console.error('[Storage] 从磁盘加载失败:', error)
    }
  }

  // ==================== 清理机制 ====================

  /** 启动定期清理 */
  private startCleanup(): void {
    // 每小时清理一次
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, 60 * 60 * 1000)
  }

  /** 停止清理 */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /** 执行清理 */
  private cleanup(): void {
    const now = Date.now()
    let cleanedSessions = 0
    let cleanedSyncData = 0
    
    // 清理过期会话
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActiveAt > this.config.sessionTTL) {
        this.sessions.delete(sessionId)
        this.syncDataCache.delete(sessionId)
        cleanedSessions++
      }
    }
    
    // 清理过期的同步数据（消息）
    for (const [sessionId, cached] of this.syncDataCache) {
      if (now - cached.syncedAt > this.config.messageTTL) {
        this.syncDataCache.delete(sessionId)
        cleanedSyncData++
      }
    }
    
    if (cleanedSessions > 0 || cleanedSyncData > 0) {
      console.log(`[Storage] 清理完成: ${cleanedSessions} 个会话, ${cleanedSyncData} 个同步缓存`)
      
      if (this.config.persistent) {
        this.saveToDisk()
      }
    }
  }

  /** 强制执行最大会话数限制 */
  private enforceMaxSessions(): void {
    if (this.sessions.size <= this.config.maxSessions) return
    
    // 按最后活跃时间排序，删除最旧的
    const sessions = Array.from(this.sessions.entries())
      .sort((a, b) => a[1].lastActiveAt - b[1].lastActiveAt)
    
    const toDelete = sessions.slice(0, sessions.length - this.config.maxSessions)
    for (const [sessionId] of toDelete) {
      this.deleteSession(sessionId)
    }
    
    console.log(`[Storage] 清理超限会话: 删除了 ${toDelete.length} 个会话`)
  }

  // ==================== 统计信息 ====================

  /** 获取存储统计 */
  getStats(): {
    sessions: number
    syncDataEntries: number
    totalMessages: number
    persistent: boolean
  } {
    let totalMessages = 0
    for (const cached of this.syncDataCache.values()) {
      totalMessages += cached.messages.length
    }
    
    return {
      sessions: this.sessions.size,
      syncDataEntries: this.syncDataCache.size,
      totalMessages,
      persistent: this.config.persistent,
    }
  }

  /** 清空所有数据 */
  clear(): void {
    this.sessions.clear()
    this.syncDataCache.clear()
    console.log('[Storage] 所有数据已清空')
    
    if (this.config.persistent) {
      this.saveToDisk()
    }
  }
}
