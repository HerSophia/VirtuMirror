# 日志服务 (Logger Service)

> **版本**: 1.0  
> **状态**: ✅ 已实现  
> **优先级**: 🟡 中  
> **最后更新**: 2025-01-16

## 1. 概述

日志服务是小手机模拟器的基础设施层服务，提供统一的日志记录、过滤和调试能力。当前各模块 `console.log` 散落各处，难以追踪和过滤，本服务旨在解决这一问题。

### 1.1 核心特性

- **命名空间管理**: 每个模块可创建独立的子日志器，便于追踪来源
- **日志级别**: 支持 debug、info、warn、error 四个级别
- **灵活过滤**: 按命名空间、级别进行过滤
- **多输出源**: 支持控制台、内存、IndexedDB 等多种输出目标
- **性能计时**: 内置计时器，便于性能分析
- **分组日志**: 支持日志分组，提升可读性

### 1.2 设计原则

1. **零侵入性**: 可逐步替换现有 console.log，无需大规模重构
2. **按需加载**: 日志存储等重型功能可按需启用
3. **开发友好**: 开发环境默认输出到控制台，生产环境可静默
4. **可扩展**: 通过 Transport 机制支持自定义输出目标

## 2. 快速开始

### 2.1 创建日志器

```typescript
import { loggerService } from '@/services/loggerService'

// 创建模块专属日志器
const logger = loggerService.child('weibo:store')

// 使用日志器
logger.debug('Loading posts for topic', { topicId })
logger.info('Posts loaded', { count: posts.length })
logger.warn('Cache miss, generating content')
logger.error('Failed to generate', error)
```

### 2.2 性能计时

```typescript
const logger = loggerService.child('content-factory')

// 开始计时
logger.time('generatePosts')

// 执行操作
await contentFactory.generatePosts(topic, 5)

// 结束计时并输出
const elapsed = logger.timeEnd('generatePosts')
// 输出: [content-factory] generatePosts: 1234ms
```

### 2.3 分组日志

```typescript
const logger = loggerService.child('llm-task')

logger.group('执行任务链')
logger.info('Step 1: 获取上下文')
logger.info('Step 2: 生成内容')
logger.info('Step 3: 解析结果')
logger.groupEnd()
```

### 2.4 配置日志级别

```typescript
import { loggerService } from '@/services/loggerService'

// 设置全局日志级别
loggerService.setLevel('warn')  // 只显示 warn 和 error

// 设置过滤器
loggerService.setFilter({
  namespaces: ['weibo:*', 'social:*'],  // 只显示特定命名空间
  minLevel: 'info',
})
```

## 3. 架构总览

```text
┌─────────────────────────────────────────────────────────────────┐
│                          应用/服务层                              │
│    微博 │ 社交引擎 │ LLM Task │ 通知服务 │ ...                    │
│      logger.info()  logger.warn()  logger.error()               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 调用子日志器
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LoggerService (单例)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ • child(namespace): 创建子日志器                          │    │
│  │ • setLevel(): 设置日志级别                                │    │
│  │ • setFilter(): 设置过滤规则                               │    │
│  │ • addTransport(): 添加输出目标                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      Transports                          │    │
│  │  Console │ Memory │ IndexedDB │ Remote │ Custom          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        开发者工具                                │
│                    LogViewer (设置 App)                          │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 文件结构

```text
src/
├── services/
│   └── logger/
│       ├── loggerService.ts      # 核心服务类（单例）
│       ├── Logger.ts             # 日志器类
│       ├── transports/
│       │   ├── ConsoleTransport.ts  # 控制台输出（默认启用）
│       │   ├── MemoryTransport.ts   # 内存存储（环形缓冲区）
│       │   ├── IndexedDBTransport.ts # 持久化存储
│       │   └── index.ts
│       └── index.ts
└── types/
    └── logger.ts                 # 类型定义
```

## 5. 相关文档

- [类型定义](./types.md) - 完整的 TypeScript 类型参考
- [API 参考](./api.md) - 完整的 API 文档
- [Transport 扩展](./transports.md) - 自定义输出目标
- [开发者工具集成](./devtools.md) - 日志查看器设计

## 6. 与其他服务的关系

| 服务 | 关系 | 说明 |
| ---- | ---- | ---- |
| **所有服务** | 被依赖 | 作为基础设施，所有服务都可使用日志服务 |
| **Settings App** | 集成 | 提供日志查看器 UI |
| **Database Service** | 可选依赖 | IndexedDB Transport 需要数据库支持 |

## 7. 使用场景

| 场景 | 日志级别 | 示例 |
| ---- | -------- | ---- |
| 调试信息 | debug | 变量值、执行路径 |
| 常规信息 | info | 操作成功、状态变更 |
| 警告信息 | warn | 性能问题、降级处理 |
| 错误信息 | error | 异常捕获、失败操作 |

## 8. 版本历史

| 版本 | 日期 | 变更内容 |
| ---- | ---- | -------- |
| 1.0 | 2025-01-16 | 初始实现：核心服务、三种 Transport |
