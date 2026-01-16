/**
 * 存储管理器 V2
 *
 * 兼容旧版 API，内部使用分表存储
 * 
 * V2.1: 按应用分类存储
 */

import { tableStorage } from './tableStorage'
import { appStorage } from './appStorage'
import type { TableName, SessionMeta, BuiltinAppId, BackupOptions } from './types'
import { TABLE_TO_APP_MAPPING } from './types'

// ============ 酒馆消息缓存（非小手机数据） ============
// 注意：这是酒馆 RP 楼层的缓存，不是小手机短信！
// 小手机短信应该存储在 apps/messages/ 下

/** 酒馆消息（RP 楼层） - 用于缓存和调试 */
export interface TavernMessage {
  message_id: number
  sessionId: string
  name: string
  role: 'system' | 'assistant' | 'user'
  is_hidden: boolean
  message: string
  data: Record<string, unknown>
  extra: Record<string, unknown>
  cachedAt: number
}

/** @deprecated 使用 TavernMessage 代替 */
export interface CachedMessage extends TavernMessage {}

/** 酒馆同步数据缓存 - 用于桥接和调试 */
export interface CachedSyncData {
  sessionId: string
  platform: string
  characterName: string
  playerName: string
  /** 酒馆 RP 楼层（不是小手机短信！） */
  tavernMessages: TavernMessage[]
  /** @deprecated 使用 tavernMessages */
  messages: TavernMessage[]
  messageRange: { start: number; end: number }
  /** 小手机通讯录（从酒馆解析出的） */
  contacts: unknown[]
  /** 小手机朋友圈（从酒馆解析出的） */
  moments: unknown[]
  /** 小手机邮件（从酒馆解析出的） */
  emails: unknown[]
  syncedAt: number
}

export interface Session {
  id: string
  platform: string
  characterName: string
  playerName: string
  createdAt: number
  lastActiveAt: number
}

/**
 * 存储管理器 V2 - 兼容旧版 API
 */
export class StorageManagerV2 {
  constructor() {
    console.log('[StorageV2] 使用分表存储模式')
  }

  // ==================== 备份 API（兼容旧版） ====================

  async saveBackup(
    sessionId: string,
    data: unknown
  ): Promise<{ success: true; syncedAt: number }> {
    return tableStorage.createFullBackup(sessionId, data)
  }

  async getBackup(
    sessionId: string
  ): Promise<{ timestamp: number; data: unknown } | null> {
    return tableStorage.getFullBackup(sessionId)
  }

  async getBackupMeta(
    sessionId: string
  ): Promise<{ updatedAt: number; size: number } | null> {
    return tableStorage.getBackupMeta(sessionId)
  }

  // ==================== 会话管理（兼容旧版） ====================

  getOrCreateSession(
    sessionId: string,
    platform: string,
    characterName: string,
    playerName: string
  ): Session {
    const meta = tableStorage.upsertSession(sessionId, {
      platform,
      characterName,
      playerName,
    })

    return {
      id: meta.id,
      platform: meta.platform,
      characterName: meta.characterName,
      playerName: meta.playerName,
      createdAt: meta.createdAt,
      lastActiveAt: meta.lastActiveAt,
    }
  }

  getSession(sessionId: string): Session | undefined {
    const meta = tableStorage.getSessionMeta(sessionId)
    if (!meta) return undefined

    return {
      id: meta.id,
      platform: meta.platform,
      characterName: meta.characterName,
      playerName: meta.playerName,
      createdAt: meta.createdAt,
      lastActiveAt: meta.lastActiveAt,
    }
  }

  getAllSessions(): Session[] {
    return tableStorage.listSessions().map((meta) => ({
      id: meta.id,
      platform: meta.platform,
      characterName: meta.characterName,
      playerName: meta.playerName,
      createdAt: meta.createdAt,
      lastActiveAt: meta.lastActiveAt,
    }))
  }

  deleteSession(sessionId: string): boolean {
    return tableStorage.deleteSession(sessionId)
  }

  // ==================== 酒馆同步数据缓存 ====================
  // 注意区分：
  // - 酒馆消息 (tavernMessages) -> 存储到 tavern-cache/ 目录
  // - 小手机数据 (contacts, moments, emails) -> 存储到 apps/ 目录

  /**
   * 缓存酒馆同步数据
   * 
   * 重要：这里的 messages 是酒馆 RP 楼层，不是小手机短信！
   * - 酒馆消息存储到 tavern-cache/ 目录（用于调试和桥接缓存）
   * - 小手机数据存储到 apps/ 目录
   */
  cacheSyncData(data: {
    sessionId: string
    platform: string
    characterName: string
    playerName: string
    /** 酒馆 RP 楼层（不是小手机短信！） */
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
    /** 小手机通讯录（从酒馆解析出的） */
    contacts?: unknown[]
    /** 小手机朋友圈（从酒馆解析出的） */
    moments?: unknown[]
    /** 小手机邮件（从酒馆解析出的） */
    emails?: unknown[]
  }): void {
    const now = Date.now()

    // 更新会话
    tableStorage.upsertSession(data.sessionId, {
      platform: data.platform,
      characterName: data.characterName,
      playerName: data.playerName,
    })

    // 缓存酒馆消息到 tavern-cache（不是 apps/messages！）
    if (data.messages && data.messages.length > 0) {
      const tavernMessages: TavernMessage[] = data.messages.map((msg) => ({
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

      // 存储到 tavern-cache 目录，而不是 apps/messages
      tableStorage.writeTavernCache(data.sessionId, tavernMessages, data.messageRange)
    }

    // 存储小手机通讯录到 apps/contacts
    if (data.contacts && data.contacts.length > 0) {
      tableStorage.writeTable(data.sessionId, 'contacts', data.contacts)
    }

    // 存储小手机朋友圈到 apps/moments
    if (data.moments && data.moments.length > 0) {
      tableStorage.writeTable(data.sessionId, 'moments', data.moments)
    }

    // 存储小手机邮件到 apps/email
    if (data.emails && data.emails.length > 0) {
      tableStorage.writeTable(data.sessionId, 'emails', data.emails)
    }

    console.log(
      `[StorageV2] 缓存同步数据: ${data.sessionId} (${data.messages?.length || 0} 条酒馆楼层)`
    )
  }

  getCachedSyncData(sessionId: string): CachedSyncData | undefined {
    const meta = tableStorage.getSessionMeta(sessionId)
    if (!meta) return undefined

    // 读取酒馆消息缓存（不是小手机短信）
    const tavernCache = tableStorage.readTavernCache(sessionId)
    // 读取小手机数据
    const contacts = tableStorage.readTable(sessionId, 'contacts')
    const moments = tableStorage.readTable(sessionId, 'moments')
    const emails = tableStorage.readTable(sessionId, 'emails')

    // 计算酒馆消息范围
    let messageRange = { start: 0, end: 0 }
    if (tavernCache?.messages && tavernCache.messages.length > 0) {
      const ids = tavernCache.messages.map((m) => m.message_id)
      messageRange = {
        start: Math.min(...ids),
        end: Math.max(...ids),
      }
    }

    return {
      sessionId,
      platform: meta.platform,
      characterName: meta.characterName,
      playerName: meta.playerName,
      // 酒馆 RP 楼层
      tavernMessages: tavernCache?.messages || [],
      messages: tavernCache?.messages || [], // 兼容旧版
      messageRange: tavernCache?.messageRange || messageRange,
      // 小手机数据
      contacts: contacts?.data || [],
      moments: moments?.data || [],
      emails: emails?.data || [],
      syncedAt: tavernCache?.syncedAt || meta.lastActiveAt,
    }
  }

  /** 获取缓存的酒馆消息（不是小手机短信！） */
  getCachedMessages(sessionId: string): TavernMessage[] {
    const cache = tableStorage.readTavernCache(sessionId)
    return cache?.messages || []
  }

  /** @deprecated 使用 getCachedMessages */
  getTavernMessages(sessionId: string): TavernMessage[] {
    return this.getCachedMessages(sessionId)
  }

  getMessage(sessionId: string, messageId: number): CachedMessage | undefined {
    const messages = this.getCachedMessages(sessionId)
    return messages.find((m) => m.message_id === messageId)
  }

  // ==================== 增量同步支持 ====================

  /** 获取某时间点之后的变更 */
  getChangesSince(sessionId: string, since: number) {
    return tableStorage.getChangesSince(sessionId, since)
  }

  /** 应用增量变更 */
  applyChanges(
    sessionId: string,
    changes: Array<{
      table: TableName
      operation: 'insert' | 'update' | 'delete'
      key: string | number
      value?: unknown
    }>,
    deviceId: string
  ): void {
    // 按表分组
    const byTable = new Map<TableName, typeof changes>()
    for (const change of changes) {
      if (!byTable.has(change.table)) {
        byTable.set(change.table, [])
      }
      byTable.get(change.table)!.push(change)
    }

    // 应用变更并记录日志
    for (const [table, tableChanges] of byTable) {
      for (const change of tableChanges) {
        // 获取应用ID
        const appId = TABLE_TO_APP_MAPPING[table] || table
        tableStorage.logChange(sessionId, {
          appId,
          table,
          key: change.key,
          operation: change.operation,
          value: change.value,
          deviceId,
        })
      }

      // 实际应用变更
      if (table !== 'appData') {
        const inserts = tableChanges
          .filter((c) => c.operation !== 'delete' && c.value)
          .map((c) => c.value!)
        const deletes = tableChanges
          .filter((c) => c.operation === 'delete')
          .map((c) => c.key)

        if (inserts.length > 0) {
          tableStorage.appendToTable(sessionId, table, inserts)
        }
        if (deletes.length > 0) {
          tableStorage.deleteFromTable(sessionId, table, deletes)
        }
      }
    }
  }

  // ==================== 统计和清理 ====================

  getStats(): {
    sessions: number
    syncDataEntries: number
    totalMessages: number
    persistent: boolean
  } {
    const stats = tableStorage.getStats()
    return {
      sessions: stats.sessionCount,
      syncDataEntries: stats.sessionCount,
      totalMessages: stats.tables.messages || 0,
      persistent: true, // V2 总是持久化的
    }
  }

  stopCleanup(): void {
    // V2 不需要清理定时器
  }

  clear(): void {
    // 警告：这会删除所有数据
    console.warn('[StorageV2] clear() 被调用，但 V2 不支持清空所有数据')
  }
}
