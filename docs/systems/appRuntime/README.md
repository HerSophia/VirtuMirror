# AppRuntime 服务

> 应用运行时与数据隔离服务，为每个 App 提供独立的运行环境

## 概述

AppRuntime 是小手机的核心基础设施服务，解决以下问题：

1. **数据隔离** - 每个 App 拥有独立的存储空间，互不干扰
2. **身份管理** - 统一管理 App 的身份信息和来源
3. **系统 API** - 提供标准化的系统功能接口
4. **上下文传递** - 通过 Vue 的依赖注入机制传递运行时

## 文档目录

| 文档 | 说明 |
| ---- | ---- |
| [types.md](./types.md) | 核心类型定义 |
| [scoped-storage.md](./scoped-storage.md) | 隔离存储实现 |
| [system-api.md](./system-api.md) | 系统 API 说明 |
| [usage-guide.md](./usage-guide.md) | 使用指南与最佳实践 |

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                          App 层                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   App A     │    │   App B     │    │   App C     │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   AppRuntime 层                          │   │
│  │                                                          │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │   │
│  │  │   Identity    │  │ ScopedStorage │  │  SystemAPI  │  │   │
│  │  │   (身份信息)   │  │  (隔离存储)    │  │ (系统功能)   │  │   │
│  │  └───────────────┘  └───────┬───────┘  └─────────────┘  │   │
│  │                             │                            │   │
│  └─────────────────────────────┼────────────────────────────┘   │
│                                │                                 │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WriteQueue (写入队列)                       │
│                    优先级排序 + 串行执行                          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        IndexedDB 存储层                          │
│              appData 表 (按 namespace 隔离)                      │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. AppRuntime 接口

每个 App 获得一个独立的 `AppRuntime` 实例，包含三个核心部分：

```typescript
interface AppRuntime {
  /** App 身份信息 */
  readonly identity: AppIdentity

  /** 应用私有存储（已隔离的 namespace） */
  readonly storage: ScopedStorage

  /** 系统 API（基础功能） */
  readonly system: SystemAPI
}
```

### 2. 身份信息 (AppIdentity)

```typescript
interface AppIdentity {
  /** 应用 ID */
  readonly appId: string
  /** 应用名称 */
  readonly appName: string
  /** 数据命名空间 */
  readonly dataNamespace: string
  /** 应用来源信息 */
  readonly source: AppSourceInfo
}
```

### 3. 隔离存储 (ScopedStorage)

```typescript
interface ScopedStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  clear(): Promise<void>
  getUsage(): Promise<{ count: number; estimatedSize: number }>
}
```

### 4. 系统 API (SystemAPI)

```typescript
interface SystemAPI {
  /** 获取当前时间戳 */
  now(): number
  /** 生成 UUID */
  uuid(): string
  /** 显示 Toast 提示 */
  toast(message: string, type?: 'info' | 'success' | 'error'): void
}
```

## 实现文件

| 文件 | 路径 | 说明 |
| ---- | ---- | ---- |
| 类型定义 | `src/services/appRuntime/types.ts` | 核心接口定义 |
| 上下文管理 | `src/services/appRuntime/context.ts` | Vue provide/inject 集成 |
| 工厂函数 | `src/services/appRuntime/factory.ts` | AppRuntime 创建 |
| 隔离存储 | `src/services/appRuntime/scopedStorage.ts` | ScopedStorage 实现 |
| 系统 API | `src/services/appRuntime/systemAPI.ts` | SystemAPI 实现 |

## 命名空间隔离策略

不同来源的 App 使用不同的命名空间格式：

| 来源 | 命名空间格式 | 示例 |
| ---- | ---- | ---- |
| 内置应用 | `builtin/{appId}` | `builtin/calculator` |
| 商店应用 | `repo/{repoId}/{developerId}/{appId}` | `repo/official/dev1/notes` |
| URL 导入 | `url/{domain}/{hash}` | `url/example.com/a1b2c3d4` |
| 本地导入 | `local/{installationId}` | `local/inst_xyz12345` |

## 快速开始

### 1. 创建 AppRuntime

```typescript
import { 
  createBuiltinAppRuntime, 
  createAppRuntime,
  provideAppRuntime 
} from '@/services/appRuntime'

// 方式 1：内置应用（简化创建）
const runtime = createBuiltinAppRuntime('notes', '备忘录')

// 方式 2：已安装应用
const runtime = createAppRuntime({
  id: 'my-app',
  name: 'My App',
  sourceInfo: { type: 'builtin' },
  installationId: 'inst_123'
})

// 在 App 容器组件中提供
provideAppRuntime(runtime)
```

### 2. 使用 AppRuntime

```typescript
import { useAppRuntime, useAppStorage } from '@/services/appRuntime'

// 在子组件中获取完整 runtime
const runtime = useAppRuntime()
console.log(runtime.identity.appId)

// 便捷方法：直接获取存储
const storage = useAppStorage()
await storage.set('my-key', { data: 'value' })
const data = await storage.get<MyData>('my-key')
```

### 3. 在非组件上下文中使用

```typescript
import { tryUseAppRuntime } from '@/services/appRuntime'

// 在 Pinia store 或其他非组件上下文中
const runtime = tryUseAppRuntime()
if (runtime) {
  // 使用 runtime
}
```

## 与其他服务的关系

```
┌─────────────────────────────────────────────────────────┐
│                     AppRuntime                          │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ WriteQueue  │   │AppIdentity  │   │Notification │
│  Service    │   │  Service    │   │  Service    │
│ (写入队列)   │   │ (身份计算)   │   │ (Toast回调) │
└─────────────┘   └─────────────┘   └─────────────┘
```

- **WriteQueue**：所有存储写入操作通过写入队列串行执行，确保数据一致性
- **AppIdentityService**：计算 App 的数据命名空间
- **NotificationService**：提供 Toast 提示的实际显示能力

## 实现状态

### ✅ 已实现

- [x] AppRuntime 接口定义
- [x] ScopedStorage 隔离存储
- [x] SystemAPI 基础功能
- [x] Vue provide/inject 集成
- [x] 全局注册表（支持非组件上下文）
- [x] 内置应用快捷创建
- [x] WriteQueue 集成

### 🔲 待扩展

- [ ] 存储配额限制
- [ ] 存储使用量统计 UI
- [ ] 跨 App 数据共享机制
- [ ] 更多 SystemAPI 能力（如剪贴板、震动）

## 相关文档

- [数据隔离设计](../../dev/Security/data-isolation.md)
- [写入队列机制](../../dev/Security/write-queue.md)
- [应用身份识别设计](../../dev/app-identity-design.md)
- [应用沙箱设计](../../dev/app-sandbox-design.md)
