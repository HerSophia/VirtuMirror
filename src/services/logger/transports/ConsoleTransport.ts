/**
 * 控制台输出 Transport
 * 输出到浏览器控制台，是默认启用的 Transport
 */

import type {
  LogTransport,
  LogEntry,
  ConsoleTransportOptions,
  LogLevel,
} from '@/types/logger'

/** 日志级别对应的控制台颜色样式 */
const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #9e9e9e', // 灰色
  info: 'color: #2196f3', // 蓝色
  warn: 'color: #ff9800', // 橙色
  error: 'color: #f44336', // 红色
  silent: '',
}

/** 日志级别对应的标签 */
const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  silent: '',
}

/** 日志级别对应的控制台方法 */
const CONSOLE_METHODS: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error' | 'log'> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  silent: 'log',
}

export class ConsoleTransport implements LogTransport {
  readonly name = 'console'

  private colorize: boolean
  private showTimestamp: boolean
  private timestampFormat: 'iso' | 'time' | 'relative'
  private startTime: number

  constructor(options: ConsoleTransportOptions = {}) {
    this.colorize = options.colorize ?? true
    this.showTimestamp = options.showTimestamp ?? true
    this.timestampFormat = options.timestampFormat ?? 'time'
    this.startTime = Date.now()
  }

  write(entry: LogEntry): void {
    if (entry.level === 'silent') return

    const method = CONSOLE_METHODS[entry.level]
    const timeStr = this.formatTimestamp(entry.timestamp)
    const levelLabel = LEVEL_LABELS[entry.level]
    const namespace = entry.namespace || 'root'

    if (this.colorize) {
      // 彩色输出
      const style = LEVEL_STYLES[entry.level]
      const prefix = this.showTimestamp
        ? `%c[${timeStr}] [${levelLabel}] [${namespace}]`
        : `%c[${levelLabel}] [${namespace}]`

      if (entry.args.length > 0) {
        console[method](prefix, style, entry.message, ...entry.args)
      } else {
        console[method](prefix, style, entry.message)
      }
    } else {
      // 纯文本输出
      const prefix = this.showTimestamp
        ? `[${timeStr}] [${levelLabel}] [${namespace}]`
        : `[${levelLabel}] [${namespace}]`

      if (entry.args.length > 0) {
        console[method](prefix, entry.message, ...entry.args)
      } else {
        console[method](prefix, entry.message)
      }
    }

    // 如果有错误堆栈，额外输出
    if (entry.stack) {
      console[method](entry.stack)
    }
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp)

    switch (this.timestampFormat) {
      case 'iso':
        return date.toISOString()

      case 'relative': {
        const elapsed = timestamp - this.startTime
        const seconds = Math.floor(elapsed / 1000)
        const ms = elapsed % 1000
        return `+${seconds}.${ms.toString().padStart(3, '0')}s`
      }

      case 'time':
      default:
        return date.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
    }
  }
}
