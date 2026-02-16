# AppRuntime 类型定义

> 核心接口与类型定义

## 概述

本文档描述 AppRuntime 服务的所有核心类型定义。

**源文件**：`src/services/appRuntime/types.ts`

## AppRuntime 接口

`AppRuntime` 是每个 App 获得的独立运行时实例，包含身份信息、隔离存储和系统 API。

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

### 设计原则

1. **只读属性**：所有属性都是 `readonly`，防止意外修改
2. **接口隔离**：将功能分为三个独立接口，职责清晰
3. **最小化暴露**：只暴露必要的 API，隐藏实现细节

## AppIdentity 接口

`AppIdentity` 包含 App 的身份标识信息。

```typescript
import type { AppSourceInfo } from '@/types/appIdentity'

interface AppIdentity {
  /** 应用 ID */
  readonly appId: string
  
  /** 应用名称 */
  readonly appName: string
  
  /** 数据命名空间（用于存储隔离） */
  readonly dataNamespace: string
  
  /** 应用来源信息 */
  readonly source: AppSourceInfo
}
```

### 字段说明

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `appId` | `string` | 应用的唯一标识符，如 `"notes"`、`"calculator"` |
| `appName` | `string` | 应用的显示名称，如 `"备忘录"`、`"计算器"` |
| `dataNamespace` | `string` | 存储隔离的命名空间，由来源信息自动计算 |
| `source` | `AppSourceInfo` | 应用的来源信息，用于安全隔离 |

### AppSourceInfo 类型

来源于 `@/types/appIdentity`：

```typescript
type AppSourceInfo =
  | { type: 'builtin' }  // 内置应用
  | { type: 'repo'; repoId: string; developerId: string }  // 商店应用
  | { type: 'url'; url: string }  // URL 导入
  | { type: 'local'; filename?: string }  // 本地导入
```

## ScopedStorage 接口

`ScopedStorage` 提供 App 私有的键值存储能力。

```typescript
interface ScopedStorage {
  /**
   * 获取数据
   * @param key - 存储键名
   * @returns 存储的值，不存在时返回 undefined
   */
  get<T>(key: string): Promise<T | undefined>

  /**
   * 设置数据
   * @param key - 存储键名
   * @param value - 要存储的值（可序列化的任意类型）
   */
  set<T>(key: string, value: T): Promise<void>

  /**
   * 删除数据
   * @param key - 要删除的键名
   */
  delete(key: string): Promise<void>

  /**
   * 获取所有键名
   * @returns 当前命名空间下的所有键名数组
   */
  keys(): Promise<string[]>

  /**
   * 清空存储
   * 删除当前命名空间下的所有数据
   */
  clear(): Promise<void>

  /**
   * 获取存储使用情况
   * @returns 存储统计信息
   */
  getUsage(): Promise<{ count: number; estimatedSize: number }>
}
```

### 方法说明

| 方法 | 返回类型 | 说明 |
| ---- | ---- | ---- |
| `get<T>(key)` | `Promise<T \ | undefined>` | 获取指定键的值 |
| `set<T>(key, value)` | `Promise<void>` | 存储键值对 |
| `delete(key)` | `Promise<void>` | 删除指定键 |
| `keys()` | `Promise<string[]>` | 列出所有键名 |
| `clear()` | `Promise<void>` | 清空所有数据 |
| `getUsage()` | `Promise<{count, estimatedSize}>` | 获取存储统计 |

### 键名规则

- 必须是非空字符串
- **不能包含冒号 `:`**（冒号用于内部命名空间分隔）
- 建议使用有意义的命名，如 `"settings"`、`"user-preferences"`

### 值类型

存储的值必须是可序列化的类型：

```typescript
// ✅ 支持的类型
await storage.set('string', 'hello')
await storage.set('number', 42)
await storage.set('boolean', true)
await storage.set('array', [1, 2, 3])
await storage.set('object', { name: 'test', count: 1 })
await storage.set('nested', { items: [{ id: 1 }] })

// ❌ 不支持的类型
await storage.set('function', () => {})  // 函数不可序列化
await storage.set('symbol', Symbol())     // Symbol 不可序列化
await storage.set('date', new Date())     // Date 会被转为字符串
```

## SystemAPI 接口

`SystemAPI` 提供基础的系统功能。

```typescript
interface SystemAPI {
  /**
   * 获取当前时间戳
   * @returns 当前时间的毫秒时间戳
   */
  now(): number

  /**
   * 生成 UUID
   * @returns 符合 RFC 4122 的 UUID v4 字符串
   */
  uuid(): string

  /**
   * 显示 Toast 提示
   * @param message - 提示消息
   * @param type - 提示类型，默认为 'info'
   */
  toast(message: string, type?: 'info' | 'success' | 'error'): void
}
```

### 方法说明

| 方法 | 返回类型 | 说明 |
| ---- | ---- | ---- |
| `now()` | `number` | 返回 `Date.now()` 的值 |
| `uuid()` | `string` | 返回 `crypto.randomUUID()` 的值 |
| `toast(msg, type?)` | `void` | 显示 Toast 提示 |

### Toast 类型

| 类型 | 说明 | 典型场景 |
| ---- | ---- | ---- |
| `'info'` | 普通信息（默认） | 操作提示、状态更新 |
| `'success'` | 成功提示 | 保存成功、操作完成 |
| `'error'` | 错误提示 | 操作失败、验证错误 |

## 工厂接口

### InstalledAppInfo

用于创建 AppRuntime 的应用信息：

```typescript
interface InstalledAppInfo {
  /** 应用 ID */
  id: string
  /** 应用名称 */
  name: string
  /** 应用来源信息 */
  sourceInfo: AppSourceInfo
  /** 安装实例 ID（用于区分同一应用的多次安装） */
  installationId: string
}
```

## 类型导出

所有类型从 `@/services/appRuntime` 统一导出：

```typescript
import type {
  AppRuntime,
  AppIdentity,
  ScopedStorage,
  SystemAPI
} from '@/services/appRuntime'
```

## 相关类型

以下类型定义在其他模块，但与 AppRuntime 紧密相关：

```typescript
// @/types/appIdentity
type AppSourceInfo = 
  | { type: 'builtin' }
  | { type: 'repo'; repoId: string; developerId: string }
  | { type: 'url'; url: string }
  | { type: 'local'; filename?: string }

// @/types/appPackage  
interface PhoneAppPackage {
  id: string
  name: string
  version: string
  packageVersion: string
  appType: 'configurable' | 'native'
  icon: AppIcon
  // ... 其他字段
}
```
