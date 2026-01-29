/**
 * LoggerService 核心服务类
 * 提供统一的日志记录、过滤和调试能力
 */

import type {
  LoggerService as ILoggerService,
  Logger as ILogger,
  LogLevel,
  LogFilter,
  LogTransport,
  LogEntry,
} from '@/types/logger'
import { LOG_LEVEL_VALUES } from '@/types/logger'
import { Logger, type LoggerContext } from './Logger'
import { ConsoleTransport } from './transports/ConsoleTransport'

/**
 * LoggerService 实现
 * 单例模式，提供全局日志管理
 */
class LoggerServiceImpl implements ILoggerService, LoggerContext {
  readonly namespace = 'root'

  private level: LogLevel = 'debug'
  private filter: LogFilter = {}
  private transports: Map<string, LogTransport> = new Map()
  private timers: Map<string, number> = new Map()

  constructor() {
    // 默认添加控制台输出
    this.addTransport(new ConsoleTransport())
  }

  // ============ Logger 接口实现 ============

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, args)
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, args)
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, args)
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, args)
  }

  private log(level: LogLevel, message: string, args: unknown[]): void {
    if (!this.shouldLog(this.namespace, level)) {
      return
    }

    let stack: string | undefined
    if (level === 'error') {
      for (const arg of args) {
        if (arg instanceof Error && arg.stack) {
          stack = arg.stack
          break
        }
      }
    }

    const entry: LogEntry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      namespace: this.namespace,
      message,
      args,
      stack,
    }

    this.writeEntry(entry)
  }

  // ============ 分组日志 ============

  group(label: string): void {
    this.consoleGroup(label)
  }

  groupEnd(): void {
    this.consoleGroupEnd()
  }

  // ============ 性能计时 ============

  time(label: string): void {
    this.timers.set(label, performance.now())
  }

  timeEnd(label: string): number {
    const startTime = this.timers.get(label)

    if (startTime === undefined) {
      this.warn(`Timer '${label}' does not exist`)
      return 0
    }

    const elapsed = performance.now() - startTime
    this.timers.delete(label)

    this.info(`${label}: ${elapsed.toFixed(2)}ms`)

    return elapsed
  }

  // ============ 子日志器 ============

  child(namespace: string): ILogger {
    return new Logger(namespace, this)
  }

  // ============ 配置方法 ============

  setLevel(level: LogLevel): void {
    this.level = level
  }

  setFilter(filter: LogFilter): void {
    this.filter = filter
  }

  addTransport(transport: LogTransport): void {
    // 如果已存在同名 transport，先移除
    if (this.transports.has(transport.name)) {
      this.removeTransport(transport.name)
    }
    this.transports.set(transport.name, transport)
  }

  removeTransport(name: string): void {
    const transport = this.transports.get(name)
    if (transport) {
      transport.dispose?.()
      this.transports.delete(name)
    }
  }

  // ============ 查询方法 ============

  getLevel(): LogLevel {
    return this.level
  }

  getFilter(): LogFilter {
    return { ...this.filter }
  }

  getTransports(): LogTransport[] {
    return Array.from(this.transports.values())
  }

  // ============ LoggerContext 实现 ============

  shouldLog(namespace: string, level: LogLevel): boolean {
    // 检查全局级别
    const entryLevel = LOG_LEVEL_VALUES[level]
    const globalLevel = LOG_LEVEL_VALUES[this.level]
    if (entryLevel < globalLevel) {
      return false
    }

    // 检查过滤器最低级别
    if (this.filter.minLevel) {
      const filterLevel = LOG_LEVEL_VALUES[this.filter.minLevel]
      if (entryLevel < filterLevel) {
        return false
      }
    }

    // 检查命名空间包含
    if (this.filter.namespaces && this.filter.namespaces.length > 0) {
      const matched = this.filter.namespaces.some((pattern) =>
        this.matchNamespace(namespace, pattern)
      )
      if (!matched) {
        return false
      }
    }

    // 检查命名空间排除
    if (this.filter.excludeNamespaces && this.filter.excludeNamespaces.length > 0) {
      const excluded = this.filter.excludeNamespaces.some((pattern) =>
        this.matchNamespace(namespace, pattern)
      )
      if (excluded) {
        return false
      }
    }

    return true
  }

  writeEntry(entry: LogEntry): void {
    // 写入所有 transport
    for (const transport of this.transports.values()) {
      try {
        transport.write(entry)
      } catch (err) {
        console.error(`[LoggerService] Transport '${transport.name}' error:`, err)
      }
    }
  }

  consoleGroup(label: string): void {
    console.group(label)
  }

  consoleGroupEnd(): void {
    console.groupEnd()
  }

  // ============ 私有方法 ============

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
}

// 创建单例实例
export const loggerService: ILoggerService = new LoggerServiceImpl()

// 便捷函数
export function useLoggerService(): ILoggerService {
  return loggerService
}
