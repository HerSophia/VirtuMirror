/**
 * Logger 类
 * 子日志器实现，由 loggerService.child() 创建
 */

import type { Logger as ILogger, LogEntry, LogLevel } from '@/types/logger'

/** 生成唯一ID */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 日志器上下文接口
 * 提供日志服务的核心功能，由 LoggerService 实现
 */
export interface LoggerContext {
  getLevel(): LogLevel
  shouldLog(namespace: string, level: LogLevel): boolean
  writeEntry(entry: LogEntry): void
  consoleGroup(label: string): void
  consoleGroupEnd(): void
}

export class Logger implements ILogger {
  readonly namespace: string
  private context: LoggerContext
  private timers: Map<string, number> = new Map()

  constructor(namespace: string, context: LoggerContext) {
    this.namespace = namespace
    this.context = context
  }

  // === 日志输出 ===

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
    // 检查是否应该记录
    if (!this.context.shouldLog(this.namespace, level)) {
      return
    }

    // 提取错误堆栈
    let stack: string | undefined
    if (level === 'error') {
      for (const arg of args) {
        if (arg instanceof Error && arg.stack) {
          stack = arg.stack
          break
        }
      }
    }

    // 创建日志条目
    const entry: LogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level,
      namespace: this.namespace,
      message,
      args,
      stack,
    }

    // 写入日志
    this.context.writeEntry(entry)
  }

  // === 分组日志 ===

  group(label: string): void {
    const fullLabel = this.namespace ? `[${this.namespace}] ${label}` : label
    this.context.consoleGroup(fullLabel)
  }

  groupEnd(): void {
    this.context.consoleGroupEnd()
  }

  // === 性能计时 ===

  time(label: string): void {
    const key = `${this.namespace}:${label}`
    this.timers.set(key, performance.now())
  }

  timeEnd(label: string): number {
    const key = `${this.namespace}:${label}`
    const startTime = this.timers.get(key)

    if (startTime === undefined) {
      this.warn(`Timer '${label}' does not exist`)
      return 0
    }

    const elapsed = performance.now() - startTime
    this.timers.delete(key)

    // 输出计时结果
    this.info(`${label}: ${elapsed.toFixed(2)}ms`)

    return elapsed
  }

  // === 创建子日志器 ===

  child(subNamespace: string): ILogger {
    const newNamespace = this.namespace
      ? `${this.namespace}:${subNamespace}`
      : subNamespace
    return new Logger(newNamespace, this.context)
  }
}
