/**
 * 分表存储实现（兼容层）
 *
 * 此模块保持旧版 API 兼容性，内部委托给 appStorage
 */

import fs from 'fs'
import path from 'path'
import type {
  TableName,
  SessionMeta,
  TableData,
  ChangeRecord,
  StorageV2Config,
} from './types'
import { DEFAULT_CONFIG, TABLE_TO_APP_MAPPING } from './types'
import { appStorage } from './appStorage'

/**
 * 兼容层：将旧的表操作 API 映射到新的 appStorage
 */
class TableStorageManager {
  private config: StorageV2Config
  private metaCache = new Map<string, SessionMeta>()

  constructor(config: Partial<StorageV2Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ensureBaseDir()
  }

  // ==================== 目录管理（保持兼容） ====================

  private getSessionDir(sessionId: string): string {
    const safeId = sessionId.replace(/:/g, '__').replace(/[^a-zA-Z0-9_\-]/g, '_')
    return path.join(this.config.baseDir, safeId)
  }

  private getTablePath(sessionId: string, table: TableName): string {
    return path.join(this.getSessionDir(sessionId), `${table}.json`)
  }

  private getMetaPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'meta.json')
  }

  private getChangeLogDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'changelog')
  }

  /** 获取酒馆缓存目录（存储酒馆 RP 楼层，不是小手机数据） */
  private getTavernCacheDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'tavern-cache')
  }

  private getAppDataDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'appData')
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.config.baseDir)) {
      fs.mkdirSync(this.config.baseDir, { recursive: true })
    }
  }

  private ensureSessionDir(sessionId: string): void {
    const dir = this.getSessionDir(sessionId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  // ==================== Session 管理 ====================

  listSessions(): SessionMeta[] {
    // 委托给 appStorage，但转换为旧格式
    const sessions = appStorage.listSessions()
    return sessions.map(s => this.convertToLegacyMeta(s))
  }

  getSessionMeta(sessionId: string): SessionMeta | null {
    // 优先从缓存读取
    if (this.metaCache.has(sessionId)) {
      return this.metaCache.get(sessionId)!
    }

    // 尝试读取旧格式 meta
    const metaPath = this.getMetaPath(sessionId)
    if (fs.existsSync(metaPath)) {
      try {
        const content = fs.readFileSync(metaPath, 'utf-8')
        const meta = JSON.parse(content) as SessionMeta
        this.metaCache.set(sessionId, meta)
        return meta
      } catch (error) {
        console.error(`[TableStorage] 读取旧格式 meta 失败 ${sessionId}:`, error)
      }
    }

    // 尝试从 appStorage 读取
    const newMeta = appStorage.getSessionMeta(sessionId)
    if (newMeta) {
      const legacyMeta = this.convertToLegacyMeta(newMeta)
      this.metaCache.set(sessionId,legacyMeta)
      return legacyMeta
    }

    return null
  }

  /** 转换新格式 meta 到旧格式 */
  private convertToLegacyMeta(newMeta: any): SessionMeta {
    const tables: SessionMeta['tables'] = {}
    
    // 从 apps 提取表信息
    if (newMeta.apps) {
      for (const appMeta of Object.values(newMeta.apps) as any[]) {
        if (appMeta.tables) {
          for (const [tableName, tableInfo] of Object.entries(appMeta.tables) as any[]) {
            tables[tableName as TableName] = tableInfo
          }
        }
      }
    }

    // 保留旧格式的 tables 字段
    if (newMeta.tables) {
      Object.assign(tables, newMeta.tables)
    }

    return {
      id: newMeta.id,
      platform: newMeta.platform,
      characterName: newMeta.characterName,
      playerName: newMeta.playerName,
      createdAt: newMeta.createdAt,
      lastActiveAt: newMeta.lastActiveAt,
      lastSyncAt: newMeta.lastSyncAt,
      version: newMeta.version,
      tables,
    }
  }

  upsertSession(
    sessionId: string,
    info: {
      platform: string
      characterName: string
      playerName: string
    }
  ): SessionMeta {
    // 委托给 appStorage
    const newMeta = appStorage.upsertSession(sessionId, info)
    const legacyMeta = this.convertToLegacyMeta(newMeta)
    this.metaCache.set(sessionId, legacyMeta)
    return legacyMeta
  }

  private saveSessionMeta(meta: SessionMeta): void {
    const metaPath = this.getMetaPath(meta.id)
    this.ensureSessionDir(meta.id)
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
    this.metaCache.set(meta.id, meta)
  }

  deleteSession(sessionId: string): boolean {
    this.metaCache.delete(sessionId)
    return appStorage.deleteSession(sessionId)
  }

  // ==================== 表操作（兼容层） ====================

  readTable<T = unknown>(sessionId: string, table: TableName): TableData<T> | null {
    // 先尝试读取旧格式文件
    const tablePath = this.getTablePath(sessionId, table)
    if (fs.existsSync(tablePath)) {
      try {
        const content = fs.readFileSync(tablePath, 'utf-8')
        return JSON.parse(content) as TableData<T>
      } catch (error) {
        console.error(`[TableStorage] 读取旧格式表失败 ${sessionId}/${table}:`, error)
      }
    }

    // 尝试从 appStorage 读取
    const data = appStorage.readTableData<T>(sessionId, table)
    if (data) {
      return {
        table,
        sessionId,
        version: 1,
        updatedAt: Date.now(),
        count: data.length,
        data,
      }
    }

    return null
  }

  writeTable<T = unknown>(
    sessionId: string,
    table: TableName,
    data: T[]
  ): void {
    // 使用新的 appStorage（V2.1 按应用分类存储）
    appStorage.writeTableData(sessionId, table, data)

    // ==================== 旧格式兼容代码（已废弃） ====================
    // 以下代码会在旧目录下同时创建文件，导致一个会话出现两个目录
    // 例如：storage/UUID/ 和 storage/sillytavern__UUID/
    // 已于 2026-01-07 注释掉，统一使用 appStorage
    //
    // this.ensureSessionDir(sessionId)
    // const tablePath = this.getTablePath(sessionId, table)
    // const now = Date.now()
    //
    // const tableData: TableData<T> = {
    //   table,
    //   sessionId,
    //   version: 1,
    //   updatedAt: now,
    //   count: data.length,
    //   data,
    // }
    //
    // const existing = this.readTable(sessionId, table)
    // if (existing) {
    //   tableData.version = existing.version + 1
    // }
    //
    // fs.writeFileSync(tablePath, JSON.stringify(tableData, null, 2), 'utf-8')
    //
    // // 更新 meta 中的表信息（旧格式）
    // const meta = this.getSessionMeta(sessionId)
    // if (meta) {
    //   meta.tables = meta.tables || {}
    //   meta.tables[table] = {
    //     count: data.length,
    //     updatedAt: now,
    //   }
    //   meta.lastActiveAt = now
    //   this.saveSessionMeta(meta)
    // }
    // ==================================================================

    console.log(`[TableStorage] 写入表 ${sessionId}/${table}: ${data.length} 条记录`)
  }

  appendToTable<T = unknown>(
    sessionId: string,
    table: TableName,
    items: T[],
    keyField: string = 'id'
  ): number {
    const existing = this.readTable<T>(sessionId, table)
    let data: T[] = existing?.data || []

    const existingMap = new Map(
      data.map((item) => [(item as any)[keyField], item])
    )

    for (const item of items) {
      existingMap.set((item as any)[keyField], item)
    }

    data = Array.from(existingMap.values())
    this.writeTable(sessionId, table, data)

    return items.length
  }

  deleteFromTable(
    sessionId: string,
    table: TableName,
    keys: (string | number)[],
    keyField: string = 'id'
  ): number {
    const existing = this.readTable(sessionId, table)
    if (!existing) return 0

    const keySet = new Set(keys)
    const data = existing.data.filter(
      (item: any) => !keySet.has(item[keyField])
    )

    const deletedCount = existing.count - data.length
    this.writeTable(sessionId, table, data)

    return deletedCount
  }

  // ==================== 应用数据（旧版兼容） ====================

  readAppData<T = unknown>(sessionId: string, namespace: string): T | null {
    const dir = this.getAppDataDir(sessionId)
    const filePath = path.join(dir, `${this.sanitizeName(namespace)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (error) {
      console.error(`[TableStorage] 读取应用数据失败 ${namespace}:`, error)
      return null
    }
  }

  writeAppData<T = unknown>(
    sessionId: string,
    namespace: string,
    data: T
  ): void {
    const dir = this.getAppDataDir(sessionId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const filePath = path.join(dir, `${this.sanitizeName(namespace)}.json`)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  listAppDataNamespaces(sessionId: string): string[] {
    const dir = this.getAppDataDir(sessionId)
    if (!fs.existsSync(dir)) {
      return []
    }

    try {
      return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
    } catch {
      return []
    }
  }

  // ==================== 酒馆消息缓存 ====================
  // 注意：这里存储的是酒馆 RP 楼层，不是小手机短信！
  // 小手机短信应该通过 writeTable(sessionId, 'messages', ...) 存储到 apps/messages

  /**
   * 写入酒馆消息缓存
   * 
   * 重要：这是酒馆 RP 楼层的缓存，不是小手机短信！
   * 存储到 tavern-cache/messages.json
   */
  writeTavernCache(
    sessionId: string,
    messages: Array<{
      message_id: number
      sessionId: string
      name: string
      role: 'system' | 'assistant' | 'user'
      is_hidden: boolean
      message: string
      data: Record<string, unknown>
      extra: Record<string, unknown>
      cachedAt: number
    }>,
    messageRange?: { start: number; end: number }
  ): void {
    const dir = this.getTavernCacheDir(sessionId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const now = Date.now()
    
    // 计算消息范围
    let range = messageRange || { start: 0, end: 0 }
    if (!messageRange && messages.length > 0) {
      const ids = messages.map(m => m.message_id)
      range = {
        start: Math.min(...ids),
        end: Math.max(...ids),
      }
    }

    const cacheData = {
      sessionId,
      messages,
      messageRange: range,
      syncedAt: now,
    }

    const filePath = path.join(dir, 'messages.json')
    fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf-8')

    console.log(`[TableStorage] 写入酒馆缓存 ${sessionId}: ${messages.length} 条楼层`)
  }

  /**
   * 读取酒馆消息缓存
   * 
   * 返回酒馆 RP 楼层缓存（不是小手机短信！）
   */
  readTavernCache(sessionId: string): {
    messages: Array<{
      message_id: number
      sessionId: string
      name: string
      role: 'system' | 'assistant' | 'user'
      is_hidden: boolean
      message: string
      data: Record<string, unknown>
      extra: Record<string, unknown>
      cachedAt: number
    }>
    messageRange: { start: number; end: number }
    syncedAt: number
  } | null {
    const filePath = path.join(this.getTavernCacheDir(sessionId), 'messages.json')
    
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.error(`[TableStorage] 读取酒馆缓存失败 ${sessionId}:`, error)
      return null
    }
  }

  // ==================== 变更日志 ====================

  logChange(sessionId: string, change: Omit<ChangeRecord, 'timestamp'>): void {
    if (!this.config.enableIncrementalSync) return

    const dir = this.getChangeLogDir(sessionId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 转换为新格式
    const appId = TABLE_TO_APP_MAPPING[change.table] || change.table
    const record: ChangeRecord = {
      appId,
      table: change.table,
      key: change.key,
      operation: change.operation,
      value: change.value,
      timestamp: Date.now(),
      deviceId: change.deviceId,
    }

    const date = new Date().toISOString().split('T')[0]
    const logPath = path.join(dir, `${date}.jsonl`)

    fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8')
  }

  getChangesSince(sessionId: string, since: number): ChangeRecord[] {
    const dir = this.getChangeLogDir(sessionId)
    if (!fs.existsSync(dir)) {
      return []
    }

    const changes: ChangeRecord[] = []

    try {
      const files = fs.readdirSync(dir).sort()

      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        const lines = content.trim().split('\n')

        for (const line of lines) {
          if (!line) continue
          try {
            const record = JSON.parse(line) as ChangeRecord
            if (record.timestamp > since) {
              changes.push(record)
            }
          } catch {
            // 忽略解析错误的行
          }
        }
      }
    } catch (error) {
      console.error(`[TableStorage] 读取变更日志失败:`, error)
    }

    return changes.sort((a, b) => a.timestamp - b.timestamp)
  }

  cleanupChangeLogs(): void {
    const cutoff = Date.now() - this.config.changeLogRetention
    const cutoffDate = new Date(cutoff).toISOString().split('T')[0]

    for (const session of this.listSessions()) {
      const dir = this.getChangeLogDir(session.id)
      if (!fs.existsSync(dir)) continue

      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const fileDate = file.replace('.jsonl', '')
          if (fileDate < cutoffDate) {
            fs.unlinkSync(path.join(dir, file))
            console.log(`[TableStorage] 清理变更日志: ${session.id}/${file}`)
          }
        }
      } catch (error) {
        console.error(`[TableStorage] 清理变更日志失败:`, error)
      }
    }
  }

  // ==================== 完整备份 ====================

  async createFullBackup(
    sessionId: string,
    data: unknown
  ): Promise<{ success: true; syncedAt: number }> {
    return appStorage.createFullBackup(sessionId, data)
  }

  async getFullBackup(
    sessionId: string
  ): Promise<{ timestamp: number; data: unknown } | null> {
    return appStorage.getFullBackup(sessionId)
  }

  async getBackupMeta(
    sessionId: string
  ): Promise<{ updatedAt: number; size: number } | null> {
    return appStorage.getBackupMeta(sessionId)
  }

  // ==================== 工具方法 ====================

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-]/g, '_')
  }

  getStats(): {
    sessionCount: number
    totalSize: number
    tables: Record<TableName, number>
  } {
    const sessions = this.listSessions()
    let totalSize = 0
    const tableCounts: Record<string, number> = {}

    for (const session of sessions) {
      const dir = this.getSessionDir(session.id)
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const filePath = path.join(dir, file)
          const stats = fs.statSync(filePath)
          if (stats.isFile()) {
            totalSize += stats.size
          }
        }

        for (const [table, info] of Object.entries(session.tables || {})) {
          tableCounts[table] = (tableCounts[table] || 0) + (info?.count || 0)
        }
      } catch {
        // 忽略读取错误
      }
    }

    return {
      sessionCount: sessions.length,
      totalSize,
      tables: tableCounts as Record<TableName, number>,
    }
  }
}

export const tableStorage = new TableStorageManager()
