# 系统 API (SystemAPI)

> 提供基础的系统功能，如时间、UUID、Toast 等

## 概述

`SystemAPI` 是 AppRuntime 提供的系统功能接口，为 App 提供基础的系统能力，无需直接访问浏览器 API。

**源文件**：`src/services/appRuntime/systemAPI.ts`

## 设计原则

1. **简单易用**：提供最常用的系统功能
2. **来源追踪**：所有操作都关联到 App ID，n3. **可扩展**：通过回调机制支持 UI 层集成
4. **降级处理**：当 UI 层未就绪时提供合理的降级方案

## 接口定义

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

## 方法详解

### now()

获取当前时间戳。

```typescript
now(): number
```

**返回值**：当前时间的毫秒时间戳（等同于 `Date.now()`）

**实现**：

```typescript
now(): number {
  return Date.now()
}
```

**使用示例**：

```typescript
const runtime = useAppRuntime()

// 获取当前时间
const timestamp = runtime.system.now()
console.log(timestamp) // 1705388400000

// 用于记录创建时间
const item = {
  id: runtime.system.uuid(),
  createdAt: runtime.system.now(),
  content: 'Hello'
}
```

### uuid()

生成符合 RFC 4122 的 UUID v4。

```typescript
uuid(): string
```

**返回值**：UUID 字符串，格式如 `"550e8400-e29b-41d4-a716-446655440000"`

**实现**：

```typescript
uuid(): string {
  return crypto.randomUUID()
}
```

**使用示例**：

```typescript
const runtime = useAppRuntime()

// 生成唯一 ID
const id = runtime.system.uuid()
console.log(id) // "550e8400-e29b-41d4-a716-446655440000"

// 用于创建新记录
const newNote = {
  id: runtime.system.uuid(),
  title: '新笔记',
  content: ''
}
```

### toast()

显示 Toast 提示消息。

```typescript
toast(message: string, type?: 'info' | 'success' | 'error'): void
```

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| ---- | ---- | ---- | ------ | ---- |
| message | `string` | ✓ | - | 提示消息内容 |
| type | `'info' \ | 'success' \ | 'error'` | - | `'info'` | 提示类型 |

**Toast 类型**：

| 类型 | 说明 | 典型场景 | 视觉样式 |
| ---- | ---- | ---- | ---- |
| `'info'` | 普通信息 | 操作提示、状态更新 | 中性色 |
| `'success'` | 成功提示 | 保存成功、操作完成 | 绿色 |
| `'error'` | 错误提示 | 操作失败、验证错误 | 红色 |

**使用示例**：

```typescript
const runtime = useAppRuntime()

// 普通提示
runtime.system.toast('正在加载...')

// 成功提示
runtime.system.toast('保存成功', 'success')

// 错误提示
runtime.system.toast('网络连接失败', 'error')
```

## 实现机制

### Toast 回调系统

Toast 功能通过回调机制与 UI 层集成：

```typescript
// Toast 回调函数类型
type ToastCallback = (
  message: string,
  type: 'info' | 'success' | 'error',
  source: string  // App ID，用于调试追踪
) => void

// 全局 Toast 回调
let globalToastCallback: ToastCallback | null = null

/**
 * 注册全局 Toast 回调
 * 由 NotificationStore 调用来注册
 */
export function registerToastCallback(callback: ToastCallback): void {
  globalToastCallback = callback
}
```

### Toast 实现

```typescript
export function createSystemAPI(appId: string): SystemAPI {
  return {
    // ... 其他方法

    toast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
      if (globalToastCallback) {
        // UI 层已注册，使用回调
        globalToastCallback(message, type, appId)
      } else {
        // 降级处理：输出到控制台
        const prefix = `[${appId}]`
        switch (type) {
          case 'error':
            console.error(prefix, message)
            break
          case 'success':
            console.log(prefix, '✓', message)
            break
          default:
            console.log(prefix, message)
        }
      }
    },
  }
}
```

### 回调注册时机

```
应用启动
    │
    ▼
NotificationStore 初始化
    │
    ▼
调用 registerToastCallback()
    │
    ▼
App 调用 toast() 时使用回调
```

## 与 NotificationStore 的集成

`NotificationStore` 在初始化时注册 Toast 回调：

```typescript
// src/stores/notificationStore.ts
import { registerToastCallback } from '@/services/appRuntime'

export const useNotificationStore = defineStore('notification', () => {
  // 注册 Toast 回调
  registerToastCallback((message, type, source) => {
    // 使用 NotificationStore 的 toast 功能
    showToast(message, type, source)
  })

  // ...
})
```

## 使用示例

### 完整示例：笔记保存

```typescript
import { useAppRuntime, useAppStorage } from '@/services/appRuntime'

const runtime = useAppRuntime()
const storage = useAppStorage()

async function saveNote(content: string) {
  try {
    const note = {
      id: runtime.system.uuid(),
      content,
      createdAt: runtime.system.now(),
      updatedAt: runtime.system.now()
    }

    await storage.set(`note:${note.id}`, note)
    runtime.system.toast('笔记已保存', 'success')

    return note
  } catch (error) {
    runtime.system.toast('保存失败: ' + error.message, 'error')
    throw error
  }
}
```

### 完整示例：数据加载

```typescript
import { useAppRuntime, useAppStorage } from '@/services/appRuntime'

const runtime = useAppRuntime()
const storage = useAppStorage()

async function loadNotes() {
  runtime.system.toast('正在加载笔记...')

  try {
    const keys = await storage.keys()
    const noteKeys = keys.filter(k => k.startsWith('note:'))

    const notes = await Promise.all(
      noteKeys.map(key => storage.get(key))
    )

    runtime.system.toast(`加载了 ${notes.length} 条笔记`, 'success')
    return notes
  } catch (error) {
    runtime.system.toast('加载失败', 'error')
    throw error
  }
}
```

## 扩展规划

当前 SystemAPI 仅提供基础功能，未来可扩展：

| 功能 | 方法 | 说明 | 状态 |
| ---- | ---- | ---- | ---- |
| 时间 | `now()` | 当前时间戳 | ✅ 已实现 |
| UUID | `uuid()` | 生成唯一 ID | ✅ 已实现 |
| Toast | `toast()` | 显示提示 | ✅ 已实现 |
| 剪贴板 | `clipboard.read/write()` | 剪贴板操作 | 🔲 待实现 |
| 震动 | `vibrate()` | 触感反馈 | 🔲 待实现 |
| 分享 | `share()` | 系统分享 | 🔲 待实现 |
| 打开链接 | `openUrl()` | 打开外部链接 | 🔲 待实现 |

## 相关文档

- [AppRuntime 概述](./README.md)
- [通知服务](../notification-service/README.md)
