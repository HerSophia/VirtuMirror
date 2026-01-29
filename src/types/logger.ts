/**
 * Logger Service 类型定义
 * @version 1.0
 */

// ============ 日志级别 ============

/**
 * 日志级别
 * - debug: 调试信息（变量值、执行路径）
 * - info: 常规信息（操作成功、状态变更）
 * - warn: 警告信息（性能问题、降级处理）
 * - error: 错误信息（异常捕获、失败操作）
 * - silent: 静默模式（禁用所有输出）
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

/** 日志级别对应的数值，用于比较 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

// ============ 日志过滤器 ============

/**
 * 日志过滤器配置
 */
export interface LogFilter {
  /**
   * 只显示特定命名空间
   * 支持通配符: 'weibo:*' 匹配 'weibo:store', 'weibo:api' 等
   */
  namespaces?: string[]

  /**
   * 排除特定命名空间
   */
  excludeNamespaces?: string[]

  /**
   * 最低显示级别
   * 设置为 'warn' 则只显示 warn 和 error
   */
  minLevel?: LogLevel
}

// ============ 日志条目 ============

/**
 * 单条日志记录的完整结构
 */
export interface LogEntry {
  /** 唯一标识 */
  id: string

  /** 时间戳（毫秒） */
  timestamp: number

  /** 日志级别 */
  level: LogLevel

  /** 命名空间 */
  namespace: string

  /** 日志消息 */
  message: string

  /** 附加参数 */
  args: unknown[]

  /** 错误堆栈（仅 error 级别） */
  stack?: string
}

/**
 * 格式化后的日志条目，用于显示
 */
export interface LogEntryFormatted extends LogEntry {
  /** 格式化的时间字符串 */
  timeString: string

  /** 格式化的完整消息 */
  formattedMessage: string

  /** 控制台样式（用于彩色输出） */
  style?: string
}

// ============ Transport ============

/**
 * 日志输出目标接口
 */
export interface LogTransport {
  /** Transport 名称，用于标识和移除 */
  name: string

  /** 写入日志条目 */
  write(entry: LogEntry): void

  /** 可选：批量写入 */
  writeBatch?(entries: LogEntry[]): void

  /** 可选：清理资源 */
  dispose?(): void

  /** 可选：刷新缓冲区 */
  flush?(): Promise<void>
}

/** 控制台输出配置 */
export interface ConsoleTransportOptions {
  /** 是否使用彩色输出 */
  colorize?: boolean

  /** 是否显示时间戳 */
  showTimestamp?: boolean

  /** 时间戳格式 */
  timestampFormat?: 'iso' | 'time' | 'relative'
}

/** 内存存储配置 */
export interface MemoryTransportOptions {
  /** 最大存储条数（环形缓冲区） */
  maxSize?: number
}

/** IndexedDB 存储配置 */
export interface IndexedDBTransportOptions {
  /** 数据库名称 */
  dbName?: string

  /** 表名称 */
  storeName?: string

  /** 最大存储条数 */
  maxSize?: number

  /** 日志保留天数 */
  retentionDays?: number

  /** 只存储特定级别以上的日志 */
  minLevel?: LogLevel
}

// ============ 日志查看器 ============

/**
 * 日志查询选项
 */
export interface LogQueryOptions {
  /** 时间范围 */
  timeRange?: {
    start: number
    end: number
  }

  /** 日志级别 */
  levels?: LogLevel[]

  /** 命名空间过滤 */
  namespaces?: string[]

  /** 消息内容搜索 */
  search?: string

  /** 分页偏移 */
  offset?: number

  /** 分页大小 */
  limit?: number

  /** 排序 */
  order?: 'asc' | 'desc'
}

/**
 * 日志统计信息
 */
export interface LogStats {
  /** 总条数 */
  total: number

  /** 按级别统计 */
  byLevel: Record<LogLevel, number>

  /** 按命名空间统计（前10） */
  byNamespace: Array<{ namespace: string; count: number }>

  /** 最早日志时间 */
  earliest: number

  /** 最新日志时间 */
  latest: number
}

/**
 * 日志查看器接口
 */
export interface LogViewer {
  /** 获取回调 */
  onEntry(callback: (entry: LogEntry) => void): () => void

  /** 历史查询 */
  query(options: LogQueryOptions): Promise<LogEntry[]>

  /** 导出日志 */
  export(format: 'json' | 'csv' | 'txt'): Promise<Blob>

  /** 清理日志 */
  clear(): Promise<void>

  /** 获取统计信息 */
  getStats(): LogStats
}

// ============ Logger 接口 ============

/**
 * 子日志器接口，由 loggerService.child() 创建
 */
export interface Logger {
  /** 命名空间 */
  readonly namespace: string

  // === 日志输出 ===
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void

  // === 分组日志 ===
  group(label: string): void
  groupEnd(): void

  // === 性能计时 ===
  time(label: string): void
  timeEnd(label: string): number

  // === 创建子日志器 ===
  child(subNamespace: string): Logger
}

/**
 * 日志服务主接口
 */
export interface LoggerService extends Logger {
  // === 配置 ===
  setLevel(level: LogLevel): void
  setFilter(filter: LogFilter): void
  addTransport(transport: LogTransport): void
  removeTransport(name: string): void

  // === 查询 ===
  getLevel(): LogLevel
  getFilter(): LogFilter
  getTransports(): LogTransport[]
}

/**
 * 创建日志器的选项
 */
export interface LoggerOptions {
  /** 父日志器（继承配置） */
  parent?: Logger

  /** 自定义输出目标 */
  transports?: LogTransport[]

  /** 默认日志级别 */
  level?: LogLevel
}
