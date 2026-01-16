# Logger Service 类型定义

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 核心接口

### 1.1 LoggerService

日志服务的主接口，提供全局配置和子日志器创建。

```typescript
interface LoggerService {
  // === 日志输出 ===
  debug(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void

  // === 分组日志 ===
  group(label: string): void
  groupEnd(): void

  // === 性能计时 ===
  time(label: string): void
  timeEnd(label: string): number  // 返回耗时 ms

  // === 子日志器（带命名空间）===
  child(namespace: string): Logger

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
```

### 1.2 Logger

子日志器接口，由 `loggerService.child()` 创建。

```typescript
interface Logger {
  // 命名空间
  readonly namespace: string

  // === 日志输出 ===
  debug(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void

  // === 分组日志 ===
  group(label: string): void
  groupEnd(): void

  // === 性能计时 ===
  time(label: string): void
  timeEnd(label: string): number

  // === 创建子日志器 ===
  child(subNamespace: string): Logger
}
```

## 2. 日志级别

### 2.1 LogLevel

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
```

**级别说明**：

| 级别 | 数值 | 说明 | 使用场景 |
| ---- | ---- | ---- | -------- |
| `debug` | 0 | 调试信息 | 变量值、执行路径、详细追踪 |
| `info` | 1 | 常规信息 | 操作成功、状态变更 |
| `warn` | 2 | 警告信息 | 性能问题、降级处理、潜在问题 |
| `error` | 3 | 错误信息 | 异常捕获、失败操作 |
| `silent` | 4 | 静默模式 | 禁用所有日志输出 |

### 2.2 LogLevelValue

```typescript
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}
```

## 3. 过滤器

### 3.1 LogFilter

```typescript
interface LogFilter {
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
```

**过滤示例**：

```typescript
// 只显示微博和社交引擎的日志
loggerService.setFilter({
  namespaces: ['weibo:*', 'social:*'],
})

// 排除噪音模块
loggerService.setFilter({
  excludeNamespaces: ['debug:*', 'trace:*'],
  minLevel: 'info',
})
```

## 4. 日志条目

### 4.1 LogEntry

单条日志记录的完整结构。

```typescript
interface LogEntry {
  /** 时间戳（毫秒） */
  timestamp: number

  /** 日志级别 */
  level: LogLevel

  /** 命名空间 */
  namespace: string

  /** 日志消息 */
  message: string

  /** 附加参数 */
  args: any[]

  /** 错误堆栈（仅 error 级别） */
  stack?: string

  /** 唯一标识 */
  id?: string
}
```

### 4.2 LogEntryFormatted

格式化后的日志条目，用于显示。

```typescript
interface LogEntryFormatted extends LogEntry {
  /** 格式化的时间字符串 */
  timeString: string

  /** 格式化的完整消息 */
  formattedMessage: string

  /** 控制台样式（用于彩色输出） */
  style?: string
}
```

## 5. Transport（输出目标）

### 5.1 LogTransport

```typescript
interface LogTransport {
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
```

### 5.2 内置 Transport 类型

```typescript
/** 控制台输出配置 */
interface ConsoleTransportOptions {
  /** 是否使用彩色输出 */
  colorize?: boolean

  /** 是否显示时间戳 */
  showTimestamp?: boolean

  /** 时间戳格式 */
  timestampFormat?: 'iso' | 'time' | 'relative'
}

/** 内存存储配置 */
interface MemoryTransportOptions {
  /** 最大存储条数（环形缓冲区） */
  maxSize?: number
}

/** IndexedDB 存储配置 */
interface IndexedDBTransportOptions {
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
```

## 6. 日志查看器

### 6.1 LogViewer

用于开发者工具的日志查看接口。

```typescript
interface LogViewer {
  /** 实时日志流（Observable 模式） */
  subscribe(filter?: LogFilter): () => void

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
```

### 6.2 LogQueryOptions

```typescript
interface LogQueryOptions {
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

  /** 分页 */
  offset?: number
  limit?: number

  /** 排序 */
  order?: 'asc' | 'desc'
}
```

### 6.3 LogStats

```typescript
interface LogStats {
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
```

## 7. 工厂函数

### 7.1 createLogger

```typescript
/** 创建独立日志器的工厂函数 */
function createLogger(namespace: string, options?: LoggerOptions): Logger

interface LoggerOptions {
  /** 父日志器（继承配置） */
  parent?: Logger

  /** 自定义输出目标 */
  transports?: LogTransport[]

  /** 默认日志级别 */
  level?: LogLevel
}
```

## 8. 类型导出

```typescript
// src/types/logger.ts
export type {
  LoggerService,
  Logger,
  LogLevel,
  LogFilter,
  LogEntry,
  LogEntryFormatted,
  LogTransport,
  ConsoleTransportOptions,
  MemoryTransportOptions,
  IndexedDBTransportOptions,
  LogViewer,
  LogQueryOptions,
  LogStats,
  LoggerOptions,
}

export { LOG_LEVEL_VALUES }
```
