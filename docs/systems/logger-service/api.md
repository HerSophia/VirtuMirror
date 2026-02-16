# Logger Service API 参考

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. LoggerService 实例

### 获取服务实例

```typescript
import { loggerService } from '@/services/logger'

// 或者通过依赖注入
import { useLoggerService } from '@/services/logger'
const loggerService = useLoggerService()
```

## 2. 日志输出方法

### 2.1 debug()

输出调试级别日志。

```typescript
loggerService.debug(message: string, ...args: any[]): void
```

**参数**：

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| message | string | 日志消息 |
| args | any[] | 附加参数，会被序列化显示 |

**示例**：

```typescript
logger.debug('Processing item', { id: 123, name: 'test' })
// 输出: [DEBUG] [namespace] Processing item { id: 123, name: 'test' }
```

### 2.2 info()

输出信息级别日志。

```typescript
loggerService.info(message: string, ...args: any[]): void
```

**示例**：

```typescript
logger.info('User logged in', { userId: 'user_001' })
```

### 2.3 warn()

输出警告级别日志。

```typescript
loggerService.warn(message: string, ...argsd
```

**示例**：

```typescript
logger.warn('Cache miss, falling back to API')
logger.warn('Deprecated method used', { method: 'oldFunc', alternative: 'newFunc' })
```

### 2.4 error()

输出错误级别日志。自动捕获错误堆栈。

```typescript
loggerService.error(message: string, ...args: any[]): void
```

**示例**：

```typescript
try {
  await riskyOperation()
} catch (err) {
  logger.error('Operation failed', err)
  // 自动包含错误堆栈
}
```

## 3. 分组日志

### 3.1 group()

开始一个日志分组。

```typescript
loggerService.group(label: string): void
```

### 3.2 groupEnd()

结束当前日志分组。

```typescript
loggerService.groupEnd(): void
```

**示例**：

```typescript
logger.group('批量处理任务')
logger.info('处理项目 1')
logger.info('处理项目 2')
logger.info('处理项目 3')
logger.groupEnd()

// 控制台输出:
// ▼ 批量处理任务
//   处理项目 1
//   处理项目 2
//   处理项目 3
```

## 4. 性能计时

### 4.1 time()

开始一个计时器。

```typescript
loggerService.time(label: string): void
```

**参数**：

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| label | string | 计时器标签，用于 timeEnd 匹配 |

### 4.2 timeEnd()

结束计时器并输出耗时。

```typescript
loggerService.timeEnd(label: string): number
```

**返回值**：耗时毫秒数

**示例**：

```typescript
logger.time('generateContent')
await contentFactory.generate()
const elapsed = logger.timeEnd('generateContent')
// 输出: [INFO] [namespace] generateContent: 1234ms

console.log(`耗时 ${elapsed}ms`)  // 可以用返回值做进一步处理
```

## 5. 子日志器

### 5.1 child()

创建带命名空间的子日志器。

```typescript
loggerService.child(namespace: string): Logger
```

**参数**：

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| namespace | string | 命名空间，支持冒号分隔层级 |

**返回值**：新的 Logger 实例

**示例**：

```typescript
// 创建模块日志器
const weiboLogger = loggerService.child('weibo')
weiboLogger.info('Module loaded')
// 输出: [INFO] [weibo] Module loaded

// 创建子模块日志器
const storeLogger = weiboLogger.child('store')
storeLogger.debug('State updated')
// 输出: [DEBUG] [weibo:store] State updated

// 继续嵌套
const postLogger = storeLogger.child('post')
postLogger.info('Post created')
// 输出: [INFO] [weibo:store:post] Post created
```

**推荐的命名空间约定**：

| 模式 | 示例 | 说明 |
| ---- | ---- | ---- |
| `app:module` | `weibo:store` | App 内部模块 |
| `service:name` | `service:notification` | 系统服务 |
| `api:endpoint` | `api:generate` | API 调用 |
| `ui:component` | `ui:toast` | UI 组件 |

## 6. 配置方法

### 6.1 setLevel()

设置全局日志级别。低于此级别的日志不会输出。

```typescript
loggerService.setLevel(level: LogLevel): void
```

**参数**：

| 值 | 说明 |
| -- | ---- |
| `'debug'` | 显示所有日志 |
| `'info'` | 显示 info 及以上 |
| `'warn'` | 显示 warn 及以上 |
| `'error'` | 只显示 error |
| `'silent'` | 禁用所有输出 |

**示例**：

```typescript
// 开发环境显示所有日志
if (import.meta.env.DEV) {
  loggerService.setLevel('debug')
}

// 生产环境只显示警告和错误
if (import.meta.env.PROD) {
  loggerService.setLevel('warn')
}
```

### 6.2 setFilter()

设置日志过滤规则。

```typescript
loggerService.setFilter(filter: LogFilter): void
```

**参数**：

```typescript
interface LogFilter {
  namespaces?: string[]         // 只显示这些命名空间
  excludeNamespaces?: string[]  // 排除这些命名空间
  minLevel?: LogLevel           // 最低显示级别
}
```

**通配符支持**：

| 模式 | 匹配 |
| ---- | ---- |
| `'weibo'` | 精确匹配 `weibo` |
| `'weibo:*'` | 匹配 `weibo:store`, `weibo:api` 等 |
| `'*:store'` | 匹配所有 store 模块 |
| `'*'` | 匹配所有命名空间 |

**示例**：

```typescript
// 只看微博相关日志
loggerService.setFilter({
  namespaces: ['weibo:*'],
})

// 排除噪音日志
loggerService.setFilter({
  excludeNamespaces: ['debug:*', 'verbose:*'],
  minLevel: 'info',
})

// 清除过滤器
loggerService.setFilter({})
```

### 6.3 addTransport()

添加日志输出目标。

```typescript
loggerService.addTransport(transport: LogTransport): void
```

**示例**：

```typescript
import { MemoryTransport, IndexedDBTransport } from '@/services/logger/transports'

// 添加内存存储（用于日志查看器）
loggerService.addTransport(new MemoryTransport({ maxSize: 1000 }))

// 添加持久化存储（只存储错误）
loggerService.addTransport(new IndexedDBTransport({
  minLevel: 'error',
  retentionDays: 7,
}))
```

### 6.4 removeTransport()

移除日志输出目标。

```typescript
loggerService.removeTransport(name: string): void
```

**示例**：

```typescript
loggerService.removeTransport('memory')
```

## 7. 查询方法

### 7.1 getLevel()

获取当前日志级别。

```typescript
loggerService.getLevel(): LogLevel
```

### 7.2 getFilter()

获取当前过滤器配置。

```typescript
loggerService.getFilter(): LogFilter
```

### 7.3 getTransports()

获取所有已注册的 Transport。

```typescript
loggerService.getTransports(): LogTransport[]
```

## 8. 最佳实践

### 8.1 模块初始化模式

```typescript
// src/services/social/contentFactory.ts
import { loggerService } from '@/services/logger'

// 在模块顶层创建日志器
const logger = loggerService.child('social:content-factory')

export class ContentFactory {
  async generate(topic: string) {
    logger.debug('Starting generation', { topic })
    
    logger.time('generate')
    try {
      const result = await this.doGenerate(topic)
      logger.info('Generation complete', { resultCount: result.length })
      return result
    } catch (err) {
      logger.error('Generation failed', err)
      throw err
    } finally {
      logger.timeEnd('generate')
    }
  }
}
```

### 8.2 Store 中使用

```typescript
// src/stores/weiboStore.ts
import { loggerService } from '@/services/logger'

const logger = loggerService.child('weibo:store')

export const useWeiboStore = defineStore('weibo', () => {
  const posts = ref<Post[]>([])
  
  async function loadPosts() {
    logger.debug('Loading posts...')
    
    try {
      posts.value = await api.getPosts()
      logger.info('Posts loaded', { count: posts.value.length })
    } catch (err) {
      logger.error('Failed to load posts', err)
    }
  }
  
  return { posts, loadPosts }
})
```

### 8.3 条件日志

```typescript
// 避免在日志禁用时计算开销
if (loggerService.getLevel() === 'debug') {
  const expensiveData = computeExpensiveDebugInfo()
  logger.debug('Detailed info', expensiveData)
}
```
