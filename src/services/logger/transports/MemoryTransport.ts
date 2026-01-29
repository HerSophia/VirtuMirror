/**
 * 内存存储 Transport
 * 存储日志到内存环形缓冲区，用于日志查看器实时展示
 */

import type {
  LogTransport,
  LogEntry,
  MemoryTransportOptions,
  LogFilter,
  LogStats,
  LogLevel,
} from '@/types/logger'
import { LOG_LEVEL_VALUES } from '@/types/logger'

export class MemoryTransport implements LogTransport {
  readonly name = 'memory'

  private entries: LogEntry[] = []
  private maxSize: number
  private listeners: Set<(entry: LogEntry) => void> = new Set()

  constructor(options: MemoryTransportOptions = {}) {
    this.maxSize = options.maxSize ?? 500
  }

  write(entry: LogEntry): void {
    // 添加到缓冲区
    this.entries.push(entry)

    // 环形缓冲区：超出大小时移除最旧的
    while (this.entries.length > this.maxSize) {
      this.entries.shift()
    }

    // 通知所有监听器
    this.listeners.forEach((listener) => {
      try {
        listener(entry)
      } catch (err) {
        console.error('[MemoryTransport] Listener error:', err)
      }
    })
  }

  /**
   * 获取所有存储的日志条目
   */
  getEntries(filter?: LogFilter): LogEntry[] {
    if (!filter) {
      return [...this.entries]
    }

    return this.entries.filter((entry) => this.matchFilter(entry, filter))
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.entries = []
  }

  /**
   * 订阅新日志
   * @returns 取消订阅函数
   */
  onEntry(callback: (entry: LogEntry) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): LogStats {
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

    for (const entry of this.entries) {
      // 统计级别
      byLevel[entry.level]++

      // 统计命名空间
      const count = namespaceCount.get(entry.namespace) ?? 0
      namespaceCount.set(entry.namespace, count + 1)

      // 时间范围
      if (entry.timestamp < earliest) earliest = entry.timestamp
      if (entry.timestamp > latest) latest = entry.timestamp
    }

    // 按数量排序命名空间，取前10
    const byNamespace = Array.from(namespaceCount.entries())
      .map(([namespace, count]) => ({ namespace, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      total: this.entries.length,
      byLevel,
      byNamespace,
      earliest: earliest === Infinity ? 0 : earliest,
      latest: latest === -Infinity ? 0 : latest,
    }
  }

  /**
   * 检查日志条目是否匹配过滤器
   */
  private matchFilter(entry: LogEntry, filter: LogFilter): boolean {
    // 检查最低级别
    if (filter.minLevel) {
      const entryLevel = LOG_LEVEL_VALUES[entry.level]
      const minLevel = LOG_LEVEL_VALUES[filter.minLevel]
      if (entryLevel < minLevel) return false
    }

    // 检查命名空间包含
    if (filter.namespaces && filter.namespaces.length > 0) {
      const matched = filter.namespaces.some((pattern) =>
        this.matchNamespace(entry.namespace, pattern)
      )
      if (!matched) return false
    }

    // 检查命名空间排除
    if (filter.excludeNamespaces && filter.excludeNamespaces.length > 0) {
      const excluded = filter.excludeNamespaces.some((pattern) =>
        this.matchNamespace(entry.namespace, pattern)
      )
      if (excluded) return false
    }

    return true
  }

  /**
   * 匹配命名空间模式
   * 支持通配符: 'weibo:*' 匹配 'weibo:store', 'weibo:api' 等
   */
  private matchNamespace(namespace: string, pattern: string): boolean {
    if (pattern === '*') return true

    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1) // 保留冒号
      return namespace.startsWith(prefix) || namespace === pattern.slice(0, -2)
    }

    if (pattern.startsWith('*:')) {
      const suffix = pattern.slice(1) // 保留冒号
      return namespace.endsWith(suffix)
    }

    return namespace === pattern
  }

  dispose(): void {
    this.entries = []
    this.listeners.clear()
  }
}
