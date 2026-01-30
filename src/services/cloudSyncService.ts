/**
 * 云端同步服务
 * 负责将本地 IndexedDB 数据备份到 Server，或从 Server 恢复
 */

import { db, sessionService } from '@/services/database'
import { getBridgeAdapter } from '@/adapters/bridgeAdapter'
import { exportDB, importInto } from 'dexie-export-import'
import type { Session } from '@/services/database/schema'
import { loggerService } from '@/services/logger/loggerService'

export interface SyncStatus {
  lastSyncTime: number | null
  inProgress: boolean
  error: string | null
}

export class CloudSyncService {
  private _status: SyncStatus = {
    lastSyncTime: null,
    inProgress: false,
    error: null,
  }

  /**
   * 获取同步状态
   */
  getStatus(): SyncStatus {
    return { ...this._status }
  }

  /**
   * 获取服务器 URL
   */
  private getServerUrl(): string {
    const adapter = getBridgeAdapter()
    return adapter?.getStatus().serverUrl || 'http://localhost:3001'
  }

  /**
   * 获取 API Key
   */
  private getApiKey(): string | undefined {
    const adapter = getBridgeAdapter()
    return adapter?.getApiKey()
  }

  /**
   * 备份当前会话到云端
   */
  async backupToCloud(): Promise<void> {
    const sessionId = sessionService.getCurrentSessionIdOrNull()
    if (!sessionId) {
      throw new Error('No active session to backup')
    }

    this._status.inProgress = true
    this._status.error = null
    
    try {
      loggerService.info('CloudSync', `开始备份会话: ${sessionId}`)
      
      // 1. 导出数据 (Blob)
      let rowCount = 0
      const blob = await exportDB(db, {
        filter: (table, value) => {
          // 全局表不备份
          if (table === 'appSettings' || table === 'trustedRepositories') {
            return false
          }
          
          // 应用数据暂不备份
          if (table === 'appData') {
            return false
          }
          
          // 检查匹配
          let match = false
          if (table === 'sessions') {
            match = (value as Session).id === sessionId
          } else {
            match = (value as any).sessionId === sessionId
          }

          if (match) rowCount++
          return match
        },
        prettyJson: true
      })
      
      loggerService.info('CloudSync', `导出完成，共匹配 ${rowCount} 条记录 (sessionId=${sessionId})`)

      // 2. 读取 Blob 为 JSON 对象
      const text = await blob.text()
      const data = JSON.parse(text)

      // 3. 上传到服务器
      const url = `${this.getServerUrl()}/api/v1/storage/${sessionId}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      const apiKey = this.getApiKey()
      if (apiKey) {
        headers['X-API-Key'] = apiKey
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data }),
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Unknown server error')
      }

      this._status.lastSyncTime = result.syncedAt || Date.now()
      loggerService.info('CloudSync', `备份成功，时间: ${this._status.lastSyncTime}`)
      
    } catch (error) {
      loggerService.error('CloudSync', '备份失败:', error)
      this._status.error = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      this._status.inProgress = false
    }
  }

  /**
   * 从云端恢复当前会话
   * @param force 如果为 true，则不检查本地是否有数据，直接覆盖
   */
  async restoreFromCloud(force = false): Promise<void> {
    const sessionId = sessionService.getCurrentSessionIdOrNull()
    if (!sessionId) {
      throw new Error('No active session to restore')
    }

    this._status.inProgress = true
    this._status.error = null

    try {
      loggerService.info('CloudSync', `开始恢复会话: ${sessionId}`)

      // 1. 获取云端备份
      const url = `${this.getServerUrl()}/api/v1/storage/${sessionId}`
      const headers: Record<string, string> = {}
      
      const apiKey = this.getApiKey()
      if (apiKey) {
        headers['X-API-Key'] = apiKey
      }

      const response = await fetch(url, { headers })
      
      if (response.status === 404) {
        loggerService.info('CloudSync', '云端无备份')
        return // 无备份，无需恢复
      }
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      // result 结构: { timestamp: number, data: object }
      // data 是 dexie-export-import 的导出结构

      if (!result.data) {
        throw new Error('Invalid backup data')
      }

      // 2. 清理本地数据 (为了避免合并导致的数据残留)
      // 注意：这里需要事务吗？deleteSession 已经是一个事务了
      loggerService.info('CloudSync', '清理本地数据...')
      await sessionService.deleteSession(sessionId)

      // 3. 导入数据
      loggerService.info('CloudSync', '导入数据...')
      const blob = new Blob([JSON.stringify(result.data)], { type: 'application/json' })
      
      await importInto(db, blob, {
        clearTablesBeforeImport: false, // 不能清空全表，因为还有其他会话
        overwriteValues: true, // 覆盖相同主键的数据
        acceptMissingTables: true,
        acceptVersionDiff: true,
      })

      // 4. 恢复当前会话ID (deleteSession 可能重置了它)
      sessionService.setCurrentSessionId(sessionId)
      
      // 5. 触发 UI 更新? 
      // 由于 deleteSession 操作，可能需要重新加载某些 store
      // 这一步通常由调用者处理，或者通过事件总线通知

      this._status.lastSyncTime = result.timestamp
      loggerService.info('CloudSync', '恢复成功')

    } catch (error) {
      loggerService.error('CloudSync', '恢复失败:', error)
      this._status.error = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      this._status.inProgress = false
    }
  }

  /**
   * 检查是否有云端备份
   */
  async checkCloudBackup(sessionId?: string): Promise<{ exists: boolean; updatedAt?: number; size?: number }> {
    const targetSessionId = sessionId || sessionService.getCurrentSessionIdOrNull()
    if (!targetSessionId) return { exists: false }

    try {
      const url = `${this.getServerUrl()}/api/v1/storage/${targetSessionId}/meta`
      const headers: Record<string, string> = {}
      
      const apiKey = this.getApiKey()
      if (apiKey) {
        headers['X-API-Key'] = apiKey
      }

      const response = await fetch(url, { headers })
      
      if (response.status === 404) {
        return { exists: false }
      }
      
      if (response.ok) {
        const meta = await response.json()
        return { 
          exists: true, 
          updatedAt: meta.updatedAt,
          size: meta.size 
        }
      }
      
      return { exists: false }
    } catch (error) {
      loggerService.error('CloudSync', '检查备份失败:', error)
      return { exists: false }
    }
  }
}

export const cloudSyncService = new CloudSyncService()
