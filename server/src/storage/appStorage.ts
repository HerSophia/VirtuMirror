/**
 * 按应用分类的存储实现
 *
 * 存储结构:
 * storage/{sessionId}/
 * ├── meta.json                    # 会话元信息
 * ├── apps/                        # 应用数据目录
 * │   ├── contacts/               # 通讯录应用
 * │   │   └── data.json
 * │   ├── messages/               # 短信应用
 * │   │   └── data.json
 * │   ├── weibo/                  # 微博应用
 * │   │   └── data.json
 * │   └── {appId}/                # 其他应用
 * │       └── data.json
 * ├── global/                      # 全局数据
 * │   ├── settings.json
 * │   └── desktop.json
 * ├── accounts/                    # 账号系统
 * │   ├── entities.json
 * │   ├── platform-accounts.json
 * │   └── relations.json
 * ├── prompt-chains/               # 提示词链
 * │   ├── chains.json
 * │   └── history.json
 * ├── changelog/                   # 变更日志（增量同步）
 * └── backup/                      # 完整备份
 */

import fs from 'fs'
import path from 'path'
import type {
  SessionMeta,
  AppMeta,
  AppData,
  ChangeRecord,
  BackupOptions,
  StorageV2Config,
  BuiltinAppId,
} from './types'
import { DEFAULT_CONFIG, APP_TABLE_MAPPING, TABLE_TO_APP_MAPPING } from './types'

/**
 * 按应用分类的存储管理器
 */
export class AppStorageManager {
  private config: StorageV2Config
  private metaCache = new Map<string, SessionMeta>()

  constructor(config: Partial<StorageV2Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ensureBaseDir()
  }

  // ==================== 目录管理 ====================

  /** 获取 session 目录路径 */
  private getSessionDir(sessionId: string): string {
    const safeId = this.sanitizeId(sessionId)
    return path.join(this.config.baseDir, safeId)
  }

  /** 获取应用数据目录 */
  private getAppDir(sessionId: string, appId: string): string {
    return path.join(this.getSessionDir(sessionId), 'apps', this.sanitizeName(appId))
  }

  /** 获取应用数据文件路径 */
  private getAppDataPath(sessionId: string, appId: string): string {
    return path.join(this.getAppDir(sessionId, appId), 'data.json')
  }

  /** 获取全局数据目录 */
  private getGlobalDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'global')
  }

  /** 获取账号系统目录 */
  private getAccountsDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'accounts')
  }

  /** 获取提示词链目录 */
  private getPromptChainsDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'prompt-chains')
  }

  /** 获取元信息文件路径 */
  private getMetaPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'meta.json')
  }

  /** 获取变更日志目录 */
  private getChangeLogDir(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'changelog')
  }

  /** 确保目录存在 */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private ensureBaseDir(): void {
    this.ensureDir(this.config.baseDir)
  }

  // ==================== Session 管理 ====================

  /** 获取所有 session 列表 */
  listSessions(): SessionMeta[] {
    try {
      const entries = fs.readdirSync(this.config.baseDir, { withFileTypes: true })
      const sessions: SessionMeta[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const meta = this.getSessionMeta(entry.name)
          if (meta) {
            sessions.push(meta)
          }
        }
      }

      return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    } catch (error) {
      console.error('[AppStorage] 读取 session 列表失败:', error)
      return []
    }
  }

  /** 获取 session 元信息 */
  getSessionMeta(sessionId: string): SessionMeta | null {
    if (this.metaCache.has(sessionId)) {
      return this.metaCache.get(sessionId)!
    }

    const metaPath = this.getMetaPath(sessionId)
    if (!fs.existsSync(metaPath)) {
      return null
    }

    try {
      const content = fs.readFileSync(metaPath, 'utf-8')
      const meta = JSON.parse(content) as SessionMeta
      this.metaCache.set(sessionId, meta)
      return meta
    } catch (error) {
      console.error(`[AppStorage] 读取 meta 失败 ${sessionId}:`, error)
      return null
    }
  }

  /** 创建或更新 session */
  upsertSession(
    sessionId: string,
    info: {
      platform: string
      characterName: string
      playerName: string
    }
  ): SessionMeta {
    this.ensureDir(this.getSessionDir(sessionId))

    let meta = this.getSessionMeta(sessionId)
    const now = Date.now()

    if (!meta) {
      meta = {
        id: sessionId,
        platform: info.platform,
        characterName: info.characterName,
        playerName: info.playerName,
        createdAt: now,
        lastActiveAt: now,
        version: 1,
        storageVersion: 2 as const,
        apps: {},
      }
    } else {
      meta.characterName = info.characterName
      meta.playerName = info.playerName
      meta.lastActiveAt = now
    }

    this.saveSessionMeta(meta)
    return meta
  }

  /** 保存 session 元信息 */
  private saveSessionMeta(meta: SessionMeta): void {
    const metaPath = this.getMetaPath(meta.id)
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
    this.metaCache.set(meta.id, meta)
  }

  /** 删除 session */
  deleteSession(sessionId: string): boolean {
    const dir = this.getSessionDir(sessionId)
    if (!fs.existsSync(dir)) {
      return false
    }

    try {
      fs.rmSync(dir, { recursive: true, force: true })
      this.metaCache.delete(sessionId)
      console.log(`[AppStorage] 已删除 session: ${sessionId}`)
      return true
    } catch (error) {
      console.error(`[AppStorage] 删除 session 失败 ${sessionId}:`, error)
      return false
    }
  }

  // ==================== 应用数据操作 ====================

  /** 读取应用数据 */
  readAppData<T = unknown>(sessionId: string, appId: string): AppData<T> | null {
    const dataPath = this.getAppDataPath(sessionId, appId)

    if (!fs.existsSync(dataPath)) {
      return null
    }

    try {
      const content = fs.readFileSync(dataPath, 'utf-8')
      return JSON.parse(content) as AppData<T>
    } catch (error) {
      console.error(`[AppStorage] 读取应用数据失败 ${sessionId}/${appId}:`, error)
      return null
    }
  }

  /** 写入应用数据 */
  writeAppData<T = unknown>(
    sessionId: string,
    appId: string,
    tables: Record<string, T[]>
  ): void {
    const appDir = this.getAppDir(sessionId, appId)
    this.ensureDir(appDir)

    const dataPath = this.getAppDataPath(sessionId, appId)
    const now = Date.now()

    // 读取现有版本
    const existing = this.readAppData(sessionId, appId)
    const version = existing ? existing.version + 1 : 1

    const appData: AppData<T> = {
      appId,
      sessionId,
      version,
      updatedAt: now,
      tables,
    }

    fs.writeFileSync(dataPath, JSON.stringify(appData, null, 2), 'utf-8')

    // 更新 meta
    this.updateAppMeta(sessionId, appId, tables)

    console.log(`[AppStorage] 写入应用数据 ${sessionId}/${appId}: ${Object.keys(tables).length} 个表`)
  }

  /** 更新应用元信息 */
  private updateAppMeta(
    sessionId: string,
    appId: string,
    tables: Record<string, unknown[]>
  ): void {
    const meta = this.getSessionMeta(sessionId)
    if (!meta) return

    const now = Date.now()
    let totalCount = 0
    const tableMeta: AppMeta['tables'] = {}

    for (const [tableName, data] of Object.entries(tables)) {
      totalCount += data.length
      tableMeta[tableName] = {
        count: data.length,
        updatedAt: now,
      }
    }

    // 确保 apps 对象存在
    if (!meta.apps) {
      meta.apps = {}
    }

    meta.apps[appId] = {
      appId,
      tables: tableMeta,
      totalCount,
      updatedAt: now,
    }
    meta.lastActiveAt = now

    this.saveSessionMeta(meta)
  }

  /** 列出会话的所有应用 */
  listApps(sessionId: string): string[] {
    const appsDir = path.join(this.getSessionDir(sessionId), 'apps')
    if (!fs.existsSync(appsDir)) {
      return []
    }

    try {
      return fs.readdirSync(appsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    } catch {
      return []
    }
  }

  // ==================== 旧表兼容层 ====================

  /** 从旧表名获取应用ID */
  getAppIdFromTable(tableName: string): BuiltinAppId | null {
    return TABLE_TO_APP_MAPPING[tableName] || null
  }

  /** 获取应用包含的表名 */
  getTablesForApp(appId: BuiltinAppId): string[] {
    return APP_TABLE_MAPPING[appId] || []
  }

  /** 兼容旧版：按表名写入数据 */
  writeTableData<T = unknown>(
    sessionId: string,
    tableName: string,
    data: T[]
  ): void {
    const appId = this.getAppIdFromTable(tableName)
    if (!appId) {
      // 非内置应用，使用表名作为应用ID
      this.writeAppData(sessionId, tableName, { [tableName]: data })
      return
    }

    // 读取现有应用数据
    const existing = this.readAppData(sessionId, appId)
    const tables = existing?.tables || {}

    // 更新指定表
    tables[tableName] = data

    this.writeAppData(sessionId, appId, tables)
  }

  /** 兼容旧版：按表名读取数据 */
  readTableData<T = unknown>(
    sessionId: string,
    tableName: string
  ): T[] | null {
    const appId = this.getAppIdFromTable(tableName)
    if (!appId) {
      const appData = this.readAppData<T>(sessionId, tableName)
      return appData?.tables[tableName] || null
    }

    const appData = this.readAppData<T>(sessionId, appId)
    return appData?.tables[tableName] || null
  }

  // ==================== 全局数据 ====================

  /** 读取全局设置 */
  readGlobalSettings(sessionId: string): Record<string, unknown> | null {
    const filePath = path.join(this.getGlobalDir(sessionId), 'settings.json')
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /** 写入全局设置 */
  writeGlobalSettings(sessionId: string, settings: Record<string, unknown>): void {
    const dir = this.getGlobalDir(sessionId)
    this.ensureDir(dir)

    const filePath = path.join(dir, 'settings.json')
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')

    // 更新 meta
    const meta = this.getSessionMeta(sessionId)
    if (meta) {
      meta.global = meta.global || {}
      meta.global.settings = {
        count: Object.keys(settings).length,
        updatedAt: Date.now(),
      }
      this.saveSessionMeta(meta)
    }
  }

  /** 读取桌面布局 */
  readDesktopLayout(sessionId: string): unknown | null {
    const filePath = path.join(this.getGlobalDir(sessionId), 'desktop.json')
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /** 写入桌面布局 */
  writeDesktopLayout(sessionId: string, layout: unknown): void {
    const dir = this.getGlobalDir(sessionId)
    this.ensureDir(dir)

    const filePath = path.join(dir, 'desktop.json')
    fs.writeFileSync(filePath, JSON.stringify(layout, null, 2), 'utf-8')
  }

  // ==================== 账号系统 ====================

  /** 读取账号系统数据 */
  readAccountsData(sessionId: string): {
    entities: unknown[]
    platformAccounts: unknown[]
    relations: unknown[]
  } | null {
    const dir = this.getAccountsDir(sessionId)
    if (!fs.existsSync(dir)) {
      return null
    }

    try {
      const readFile = (name: string) => {
        const filePath = path.join(dir, name)
        if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        }
        return []
      }

      return {
        entities: readFile('entities.json'),
        platformAccounts: readFile('platform-accounts.json'),
        relations: readFile('relations.json'),
      }
    } catch {
      return null
    }
  }

  /** 写入账号系统数据 */
  writeAccountsData(
    sessionId: string,
    data: {
      entities?: unknown[]
      platformAccounts?: unknown[]
      relations?: unknown[]
    }
  ): void {
    const dir = this.getAccountsDir(sessionId)
    this.ensureDir(dir)

    const writeFile = (name: string, content: unknown[]) => {
      const filePath = path.join(dir, name)
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8')
    }

    if (data.entities) writeFile('entities.json', data.entities)
    if (data.platformAccounts) writeFile('platform-accounts.json', data.platformAccounts)
    if (data.relations) writeFile('relations.json', data.relations)
  }

  // ==================== 提示词链 ====================

  /** 读取提示词链数据 */
  readPromptChainsData(sessionId: string): {
    chains: unknown[]
    history: unknown[]
  } | null {
    const dir = this.getPromptChainsDir(sessionId)
    if (!fs.existsSync(dir)) {
      return null
    }

    try {
      const readFile = (name: string) => {
        const filePath = path.join(dir, name)
        if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        }
        return []
      }

      return {
        chains: readFile('chains.json'),
        history: readFile('history.json'),
      }
    } catch {
      return null
    }
  }

  /** 写入提示词链数据 */
  writePromptChainsData(
    sessionId: string,
    data: {
      chains?: unknown[]
      history?: unknown[]
    }
  ): void {
    const dir = this.getPromptChainsDir(sessionId)
    this.ensureDir(dir)

    const writeFile = (name: string, content: unknown[]) => {
      const filePath = path.join(dir, name)
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8')
    }

    if (data.chains) writeFile('chains.json', data.chains)
    if (data.history) writeFile('history.json', data.history)
  }

  // ==================== 变更日志（增量同步） ====================

  /** 记录变更 */
  logChange(
    sessionId: string,
    change: Omit<ChangeRecord, 'timestamp'>
  ): void {
    if (!this.config.enableIncrementalSync) return

    const dir = this.getChangeLogDir(sessionId)
    this.ensureDir(dir)

    const record: ChangeRecord = {
      ...change,
      timestamp: Date.now(),
    }

    const date = new Date().toISOString().split('T')[0]
    const logPath = path.join(dir, `${date}.jsonl`)

    fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8')
  }

  /** 获取某时间点之后的变更 */
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
      console.error(`[AppStorage] 读取变更日志失败:`, error)
    }

    return changes.sort((a, b) => a.timestamp - b.timestamp)
  }

  // ==================== 完整备份 ====================

  /** 创建完整备份（含选项） */
  async createFullBackup(
    sessionId: string,
    data: unknown,
    options?: BackupOptions
  ): Promise<{ success: true; syncedAt: number }> {
    this.ensureDir(this.getSessionDir(sessionId))
    const backupDir = path.join(this.getSessionDir(sessionId), 'backup')
    this.ensureDir(backupDir)

    const now = Date.now()
    const backupData = {
      sessionId,
      createdAt: now,
      version: 2,
      storageVersion: 2,
      options,
      data,
    }

    // 保存带时间戳的文件
    const filename = `full_${new Date(now).toISOString().split('T')[0]}.json`
    const filePath = path.join(backupDir, filename)

    await fs.promises.writeFile(
      filePath,
      JSON.stringify(backupData, null, 2),
      'utf-8'
    )

    // 同时保存 latest
    const latestPath = path.join(backupDir, 'latest.json')
    await fs.promises.writeFile(
      latestPath,
      JSON.stringify(backupData, null, 2),
      'utf-8'
    )

    // 更新 meta
    const meta = this.getSessionMeta(sessionId)
    if (meta) {
      meta.lastSyncAt = now
      this.saveSessionMeta(meta)
    }

    console.log(`[AppStorage] 完整备份已创建: ${sessionId}`)
    return { success: true, syncedAt: now }
  }

  /** 获取最新的完整备份 */
  async getFullBackup(
    sessionId: string
  ): Promise<{ timestamp: number; data: unknown; version?: number } | null> {
    const latestPath = path.join(
      this.getSessionDir(sessionId),
      'backup',
      'latest.json'
    )

    if (!fs.existsSync(latestPath)) {
      return null
    }

    try {
      const content = await fs.promises.readFile(latestPath, 'utf-8')
      const backup = JSON.parse(content)
      return {
        timestamp: backup.createdAt,
        data: backup.data,
        version: backup.storageVersion || 1,
      }
    } catch (error) {
      console.error(`[AppStorage] 读取备份失败 ${sessionId}:`, error)
      return null
    }
  }

  /** 获取备份元信息 */
  async getBackupMeta(
    sessionId: string
  ): Promise<{ updatedAt: number; size: number; version?: number } | null> {
    const latestPath = path.join(
      this.getSessionDir(sessionId),
      'backup',
      'latest.json'
    )

    if (!fs.existsSync(latestPath)) {
      return null
    }

    try {
      const stats = await fs.promises.stat(latestPath)
      const content = await fs.promises.readFile(latestPath, 'utf-8')
      const backup = JSON.parse(content)

      return {
        updatedAt: backup.createdAt,
        size: stats.size,
        version: backup.storageVersion || 1,
      }
    } catch (error) {
      console.error(`[AppStorage] 获取备份元数据失败 ${sessionId}:`, error)
      return null
    }
  }

  // ==================== 统计 ====================

  /** 获取存储统计 */
  getStats(): {
    sessionCount: number
    totalSize: number
    apps: Record<string, { sessions: number; records: number }>
  } {
    const sessions = this.listSessions()
    let totalSize = 0
    const appStats: Record<string, { sessions: number; records: number }> = {}

    for (const session of sessions) {
      // 计算大小
      const dir = this.getSessionDir(session.id)
      totalSize += this.getDirSize(dir)

      // 统计应用
      for (const [appId, appMeta] of Object.entries(session.apps || {})) {
        if (!appStats[appId]) {
          appStats[appId] = { sessions: 0, records: 0 }
        }
        appStats[appId].sessions++
        appStats[appId].records += appMeta.totalCount
      }
    }

    return {
      sessionCount: sessions.length,
      totalSize,
      apps: appStats,
    }
  }

  /** 获取目录大小 */
  private getDirSize(dir: string): number {
    if (!fs.existsSync(dir)) return 0

    let size = 0
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        size += this.getDirSize(fullPath)
      } else {
        size += fs.statSync(fullPath).size
      }
    }

    return size
  }

  // ==================== 工具方法 ====================

  /** 清理 sessionId 中的特殊字符 */
  private sanitizeId(id: string): string {
    return id.replace(/:/g, '__').replace(/[^a-zA-Z0-9_\-]/g, '_')
  }

  /** 清理文件名中的特殊字符 */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-]/g, '_')
  }
}

/** 导出单例 */
export const appStorage = new AppStorageManager()
