# Logger Service Transport 扩展

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 概述

Transport 是日志服务的输出目标抽象层。通过实现 `LogTransport` 接口，可以将日志输出到不同的目标：控制台、内存、数据库、远程服务等。

## 2. 内置 Transport

### 2.1 ConsoleTransport

输出到浏览器控制台，是默认启用的 Transport。

```typescript
import { ConsoleTransport } from '@/services/logger/transports'

const transport = new ConsoleTransport({
  colorize: true,           // 彩色输出
  showTimestamp: true,      // 显示时间戳
  timestampFormat: 'time',  // 时间格式
})

loggerService.addTransport(transport)
```

**配置项**：

| 选项 | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| `colorize` | boolean | true | 是否使用彩色输出 |
| `showTimestamp` | boolean | true | 是否显示时间戳 |
| `timestampFormat` | string | 'time' | 时间格式：'iso'/'time'/'relative' |

**颜色方案**：

| 级别 | 颜色 | 控制台方法 |
| ---- | ---- | ---------- |
| debug | 灰色 | console.debug |
| info | 蓝色 | console.info |
| warn | 橙色 | console.warn |
| error | 红色 | console.error |

**输出示例**：

```text
[14:30:25] [INFO] [weibo:store] Posts loaded { count: 10 }
[14:30:26] [WARN] [social:engine] Cache miss, regenerating
[14:30:27] [ERROR] [api:generate] Request failed Error: Network error
```

### 2.2 MemoryTransport

存储日志到内存环形缓冲区，用于日志查看器实时展示。

```typescript
import { MemoryTransport } from '@/services/logger/transports'

const transport = new MemoryTransport({
  maxSize: 1000,  // 最多存储 1000 条
})

loggerService.addTransport(transport)

// 获取存储的日志
const entries = transport.getEntries()

// 清空日志
transport.clear()

// 订阅新日志
transport.onEntry((entry) => {
  console.log('New log:', entry)
})
```

**配置项**：

| 选项 | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| `maxSize` | number | 500 | 最大存储条数（环形缓冲区） |

**API**：

| 方法 | 说明 |
| ---- | ---- |
| `getEntries()` | 获取所有存储的日志条目 |
| `getEntries(filter)` | 按条件过滤获取 |
| `clear()` | 清空存储 |
| `onEntry(callback)` | 订阅新日志，返回取消订阅函数 |
| `getStats()` | 获取统计信息 |

### 2.3 IndexedDBTransport

持久化日志到 IndexedDB，用于错误日志留存和历史查询。

```typescript
import { IndexedDBTransport } from '@/services/logger/transports'

const transport = new IndexedDBTransport({
  dbName: 'app-logs',
  storeName: 'logs',
  maxSize: 10000,        // 最多存储 10000 条
  retentionDays: 7,      // 保留 7 天
  minLevel: 'warn',      // 只存储 warn 和 error
})

loggerService.addTransport(transport)
```

**配置项**：

| 选项 | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| `dbName` | string | 'logger' | 数据库名称 |
| `storeName` | string | 'logs' | 对象存储名称 |
| `maxSize` | number | 5000 | 最大存储条数 |
| `retentionDays` | number | 3 | 日志保留天数 |
| `minLevel` | LogLevel | 'debug' | 最低存储级别 |

**API**：

| 方法 | 说明 |
| ---- | ---- |
| `query(options)` | 查询历史日志 |
| `export(format)` | 导出日志（json/csv/txt） |
| `clear()` | 清空所有日志 |
| `cleanup()` | 清理过期日志 |
| `getStats()` | 获取存储统计 |

**查询示例**：

```typescript
const logs = await transport.query({
  timeRange: {
    start: Date.now() - 24 * 60 * 60 * 1000,  // 最近 24 小时
    end: Date.now(),
  },
  levels: ['error'],
  search: 'network',
  limit: 100,
})
```

## 3. 自定义 Transport

### 3.1 实现接口

```typescript
import { LogTransport, LogEntry } from '@/types/logger'

class MyCustomTransport implements LogTransport {
  name = 'my-transport'
  
  write(entry: LogEntry): void {
    // 处理单条日志
    console.log('Custom:', entry.message)
  }
  
  // 可选：批量写入（性能优化）
  writeBatch?(entries: LogEntry[]): void {
    // 批量处理
  }
  
  // 可选：资源清理
  dispose?(): void {
    // 清理资源
  }
  
  // 可选：刷新缓冲区
  async flush?(): Promise<void> {
    // 确保所有日志已写入
  }
}
```

### 3.2 远程日志 Transport 示例

```typescript
class RemoteTransport implements LogTransport {
  name = 'remote'
  private buffer: LogEntry[] = []
  private flushInterval: number
  
  constructor(private config: {
    endpoint: string
    batchSize?: number
    flushIntervalMs?: number
  }) {
    // 定时刷新
    this.flushInterval = window.setInterval(
      () => this.flush(),
      config.flushIntervalMs ?? 5000
    )
  }
  
  write(entry: LogEntry): void {
    this.buffer.push(entry)
    
    // 达到批量大小时立即发送
    if (this.buffer.length >= (this.config.batchSize ?? 50)) {
      this.flush()
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    
    const entries = this.buffer.splice(0)
    
    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: entries }),
      })
    } catch (err) {
      // 发送失败，放回缓冲区
      this.buffer.unshift(...entries)
      console.error('Failed to send logs:', err)
    }
  }
  
  dispose(): void {
    clearInterval(this.flushInterval)
    this.flush()  // 最后刷新一次
  }
}

// 使用
loggerService.addTransport(new RemoteTransport({
  endpoint: 'https://logs.example.com/api/logs',
  batchSize: 100,
  flushIntervalMs: 10000,
}))
```

### 3.3 文件下载 Transport 示例

```typescript
class FileDownloadTransport implements LogTransport {
  name = 'file-download'
  private entries: LogEntry[] = []
  
  write(entry: LogEntry): void {
    this.entries.push(entry)
  }
  
  download(filename = 'logs.json'): void {
    const blob = new Blob(
      [JSON.stringify(this.entries, null, 2)],
      { type: 'application/json' }
    )
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  
  clear(): void {
    this.entries = []
  }
}
```

### 3.4 过滤 Transport 示例

只处理特定条件的日志：

```typescript
class FilteredTransport implements LogTransport {
  name = 'filtered'
  
  constructor(
    private inner: LogTransport,
    private filter: (entry: LogEntry) => boolean
  ) {}
  
  write(entry: LogEntry): void {
    if (this.filter(entry)) {
      this.inner.write(entry)
    }
  }
  
  dispose(): void {
    this.inner.dispose?.()
  }
}

// 使用：只存储特定命名空间的错误
const filtered = new FilteredTransport(
  new IndexedDBTransport({ maxSize: 1000 }),
  (entry) => 
    entry.level === 'error' && 
    entry.namespace.startsWith('social:')
)

loggerService.addTransport(filtered)
```

## 4. Transport 组合

### 4.1 多 Transport 配置

```typescript
import { 
  ConsoleTransport, 
  MemoryTransport, 
  IndexedDBTransport 
} from '@/services/logger/transports'

// 开发环境配置
if (import.meta.env.DEV) {
  loggerService.addTransport(new ConsoleTransport({ colorize: true }))
  loggerService.addTransport(new MemoryTransport({ maxSize: 500 }))
}

// 生产环境配置
if (import.meta.env.PROD) {
  // 控制台只输出警告以上
  loggerService.addTransport(new ConsoleTransport({ colorize: false }))
  loggerService.setLevel('warn')
  
  // 持久化存储错误
  loggerService.addTransport(new IndexedDBTransport({
    minLevel: 'error',
    retentionDays: 7,
  }))
}
```

### 4.2 动态添加/移除

```typescript
// 添加临时 Transport 用于调试
const debugTransport = new MemoryTransport({ maxSize: 100 })
loggerService.addTransport(debugTransport)

// 完成后移除
loggerService.removeTransport('memory')
```

## 5. 性能考虑

### 5.1 异步写入

对于耗时的写入操作（如网络请求、数据库写入），建议使用异步处理：

```typescript
class AsyncTransport implements LogTransport {
  name = 'async'
  private queue: LogEntry[] = []
  private processing = false
  
  write(entry: LogEntry): void {
    this.queue.push(entry)
    this.processQueue()
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true
    
    while (this.queue.length > 0) {
      const entry = this.queue.shift()!
      await this.asyncWrite(entry)
    }
    
    this.processing = false
  }
  
  private async asyncWrite(entry: LogEntry): Promise<void> {
    // 异步写入逻辑
  }
}
```

### 5.2 批量写入

对于高频日志，使用批量写入减少开销：

```typescript
class BatchTransport implements LogTransport {
  name = 'batch'
  private buffer: LogEntry[] = []
  private timer: number | null = null
  
  constructor(private batchSize = 50, private flushMs = 1000) {}
  
  write(entry: LogEntry): void {
    this.buffer.push(entry)
    
    if (this.buffer.length >= this.batchSize) {
      this.flush()
    } else if (!this.timer) {
      this.timer = window.setTimeout(() => this.flush(), this.flushMs)
    }
  }
  
  writeBatch(entries: LogEntry[]): void {
    // 直接处理批量写入
    this.processBatch(entries)
  }
  
  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    
    if (this.buffer.length > 0) {
      const entries = this.buffer.splice(0)
      this.processBatch(entries)
    }
  }
  
  private processBatch(entries: LogEntry[]): void {
    // 批量处理逻辑
  }
}
```
