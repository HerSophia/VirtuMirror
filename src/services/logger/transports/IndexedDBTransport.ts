/**
 * IndexedDB 存储 Transport
 * 持久化日志到 IndexedDB，用于错误日志留存和历史查询
 */

import type {
  LogTransport,
  LogEntry,
  IndexedDBTransportOptions,
  LogQueryOptions,
  LogStats,
  LogLevel,
} from '@/types/logger'
import { LOG_LEVEL_VALUES } from '@/types/logger'

const DEFAULT_DB_NAME = 'logger'
const DEFAULT_STORE_NAME = 'logs'
const DEFAULT_MAX_SIZE = 5000
const DEFAULT_RETENTION_DAYS = 3

export class IndexedDBTransport implements LogTransport {
  readonly name = 'indexeddb'

  private dbName: string
  private storeName: string
  private maxSize: number
  private retentionDays: number
  private minLevel: LogLevel
  private db: IDBDatabase | null = null
  private dbReady: Promise<IDBDatabase>
  private writeQueue: LogEntry[] = []
  private isWriting = false

  constructor(options: IndexedDBTransportOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME
    this.storeName = options.storeName ?? DEFAULT_STORE_NAME
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
    this.retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS
    this.minLevel = options.minLevel ?? 'debug'

    this.dbReady = this.initDB()
  }

  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => {
        console.error('[IndexedDBTransport] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)

        // 启动时清理过期日志
        this.cleanup().catch(console.error)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
          })

          // 创建索引
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('level', 'level', { unique: false })
          store.createIndex('namespace', 'namespace', { unique: false })
        }
      }
    })
  }

  write(entry: LogEntry): void {
    // 检查日志级别
    const entryLevel = LOG_LEVEL_VALUES[entry.level]
    const minLevel = LOG_LEVEL_VALUES[this.minLevel]
    if (entryLevel < minLevel) return

    // 添加到写入队列
    this.writeQueue.push(entry)
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return

    this.isWriting = true

    try {
      const db = await this.dbReady
      const entries = this.writeQueue.splice(0)

      const transaction = db.transaction(this.storeName, 'readwrite')
      const store = transaction.objectStore(this.storeName)

      for (const entry of entries) {
        store.add(entry)
      }

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })

      // 检查是否需要清理
      await this.enforceMaxSize()
    } catch (err) {
      console.error('[IndexedDBTransport] Write error:', err)
    } finally {
      this.isWriting = false

      // 如果队列还有数据，继续处理
      if (this.writeQueue.length > 0) {
        this.processQueue()
      }
    }
  }

  /**
   * 查询历史日志
   */
  async query(options: LogQueryOptions = {}): Promise<LogEntry[]> {
    const db = await this.dbReady
    const transaction = db.transaction(this.storeName, 'readonly')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const results: LogEntry[] = []
      const index = store.index('timestamp')

      // 确定时间范围
      let range: IDBKeyRange | undefined
      if (options.timeRange) {
        range = IDBKeyRange.bound(options.timeRange.start, options.timeRange.end)
      }

      const direction = options.order === 'asc' ? 'next' : 'prev'
      const request = index.openCursor(range, direction)

      const offset = options.offset ?? 0
      const limit = options.limit ?? 100
      let skipped = 0

      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve(results)
          return
        }

        const entry = cursor.value as LogEntry

        // 应用过滤条件
        if (this.matchQueryFilter(entry, options)) {
          if (skipped < offset) {
            skipped++
          } else if (results.length < limit) {
            results.push(entry)
          } else {
            resolve(results)
            return
          }
        }

        cursor.continue()
      }

      request.onerror = () => reject(request.error)
    })
  }

  private matchQueryFilter(entry: LogEntry, options: LogQueryOptions): boolean {
    // 检查级别
    if (options.levels && options.levels.length > 0) {
      if (!options.levels.includes(entry.level)) return false
    }

    // 检查命名空间
    if (options.namespaces && options.namespaces.length > 0) {
      const matched = options.namespaces.some((ns) => entry.namespace.startsWith(ns))
      if (!matched) return false
    }

    // 检查搜索关键词
    if (options.search) {
      const searchLower = options.search.toLowerCase()
      const messageLower = entry.message.toLowerCase()
      if (!messageLower.includes(searchLower)) return false
    }

    return true
  }

  /**
   * 导出日志
   */
  async export(format: 'json' | 'csv' | 'txt'): Promise<Blob> {
    const entries = await this.query({ limit: this.maxSize, order: 'asc' })

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(entries, null, 2)], {
          type: 'application/json',
        })

      case 'csv': {
        const headers = 'id,timestamp,level,namespace,message\n'
        const rows = entries
          .map(
            (e) =>
              `"${e.id}",${e.timestamp},"${e.level}","${e.namespace}","${e.message.replace(/"/g, '""')}"`
          )
          .join('\n')
        return new Blob([headers + rows], { type: 'text/csv' })
      }

      case 'txt': {
        const lines = entries
          .map((e) => {
            const time = new Date(e.timestamp).toISOString()
            return `[${time}] [${e.level.toUpperCase()}] [${e.namespace}] ${e.message}`
          })
          .join('\n')
        return new Blob([lines], { type: 'text/plain' })
      }
    }
  }

  /**
   * 清空所有日志
   */
  async clear(): Promise<void> {
    const db = await this.dbReady
    const transaction = db.transaction(this.storeName, 'readwrite')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 清理过期日志
   */
  async cleanup(): Promise<void> {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000

    const db = await this.dbReady
    const transaction = db.transaction(this.storeName, 'readwrite')
    const store = transaction.objectStore(this.storeName)
    const index = store.index('timestamp')

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.upperBound(cutoff)
      const request = index.openCursor(range)

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 强制执行最大存储限制
   */
  private async enforceMaxSize(): Promise<void> {
    const db = await this.dbReady
    const transaction = db.transaction(this.storeName, 'readwrite')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const countRequest = store.count()

      countRequest.onsuccess = () => {
        const count = countRequest.result
        if (count <= this.maxSize) {
          resolve()
          return
        }

        // 需要删除最旧的记录
        const deleteCount = count - this.maxSize
        const index = store.index('timestamp')
        const cursorRequest = index.openCursor()
        let deleted = 0

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (cursor && deleted < deleteCount) {
            cursor.delete()
            deleted++
            cursor.continue()
          } else {
            resolve()
          }
        }

        cursorRequest.onerror = () => reject(cursorRequest.error)
      }

      countRequest.onerror = () => reject(countRequest.error)
    })
  }

  /**
   * 获取存储统计
   */
  async getStats(): Promise<LogStats> {
    const entries = await this.query({ limit: this.maxSize, order: 'asc' })

    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      silent: 0,
    }

    const namespaceCount = new Map<string, number>()

    let earliest = Infinity
    let latest = -Infinity

    for (const entry of entries) {
      byLevel[entry.level]++

      const count = namespaceCount.get(entry.namespace) ?? 0
      namespaceCount.set(entry.namespace, count + 1)

      if (entry.timestamp < earliest) earliest = entry.timestamp
      if (entry.timestamp > latest) latest = entry.timestamp
    }

    const byNamespace = Array.from(namespaceCount.entries())
      .map(([namespace, count]) => ({ namespace, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      total: entries.length,
      byLevel,
      byNamespace,
      earliest: earliest === Infinity ? 0 : earliest,
      latest: latest === -Infinity ? 0 : latest,
    }
  }

  async flush(): Promise<void> {
    // 等待所有写入完成
    while (this.writeQueue.length > 0 || this.isWriting) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  dispose(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
