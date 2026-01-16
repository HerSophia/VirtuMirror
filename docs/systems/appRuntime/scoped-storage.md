# 隔离存储 (ScopedStorage)

> 为每个 App 提供独立的存储空间，通过命名空间实现数据隔离

## 概述

`ScopedStorage` 是 AppRuntime 的核心组件，为每个 App 提供独立的键值存储空间。通过命名空间机制，确保不同来源的 App 数据完全隔离。

**源文件**：`src/services/appRuntime/scopedStorage.ts`

## 设计原则

1. **命名空间隔离**：每个 App 的数据存储在独立的命名空间下
2. **写入队列集成**：所有写入操作通过 WriteQueue 串行执行，确保数据一致性
3. **透明访问**：App 无需关心底层存储细节，只需使用简单的 API
4. **版本追踪**：自动维护数据版本号，支持冲突检测

## 存储结构

### IndexedDB 表结构

数据存储在 `appData` 表中：

```typescript
interface AppDataRecord {
  /** 命名空间（主键部分） */
  namespace: string
  /** 存储键（主键部分） */
  key: string
  /** 存储值（任意可序列化类型） */
  value: any
  /** 数据版本号 */
  version: number
  /** 最后更新时间 */
  updatedAt: number
}

// 复合主键：[namespace, key]
```

### 命名空间格式

不同来源的 App 使用不同的命名空间格式：

| 来源类型 | 命名空间格式 | 示例 |
| -------- | ------------ | ---- |
| 内置应用 | `builtin/{appId}` | `builtin/calculator` |
| 商店应用 | `repo/{repoId}/{developerId}/{appId}` | `repo/official/dev1/notes` |
| URL 导入 | `url/{domain}/{hash}` | `url/example.com/a1b2c3d4` |
| 本地导入 | `local/{installationId}` | `local/inst_xyz12345` |

## 实现细节

### 创建隔离存储

```typescript
import { db } from '@/services/database'
import { writeQueue } from '@/services/database/writeQueue'
import type { ScopedStorage } from './types'

export function createScopedStorage(
  namespace: string,
  appId: string
): ScopedStorage {
  // 验证 key 格式
  const validateKey = (key: string) => {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string')
    }
    if (key.includes(':')) {
      throw new Error('Invalid key: cannot contain ":"')
    }
  }

  return {
    // ... 方法实现
  }
}
```

### get 方法

获取指定键的值：

```typescript
async get<T>(key: string): Promise<T | undefined> {
  validateKey(key)
  
  const record = await db.appData
    .where('[namespace+key]')
    .equals([namespace, key])
    .first()
    
  return record?.value as T | undefined
}
```

**特点**：
- 直接读取，不经过写入队列
- 使用复合索引 `[namespace+key]` 快速查询
- 返回 `undefined` 表示键不存在

### set 方法

存储键值对：

```typescript
async set<T>(key: string, value: T): Promise<void> {
  validateKey(key)

  // 通过写入队列执行
  await writeQueue.enqueue('app', appId, async () => {
    const existing = await db.appData
      .where('[namespace+key]')
      .equals([namespace, key])
      .first()

    if (existing) {
      // 更新现有记录
      await db.appData.update([namespace, key], {
        value,
        version: (existing.version || 0) + 1,
        updatedAt: Date.now(),
      })
    } else {
      // 创建新记录
      await db.appData.add({
        namespace,
        key,
        value,
        version: 1,
        updatedAt: Date.now(),
      })
    }
  })
}
```

**特点**：
- 通过 WriteQueue 串行执行，避免并发冲突
- 自动维护 version 版本号
- 自动更新 updatedAt 时间戳

### delete 方法

删除指定键：

```typescript
async delete(key: string): Promise<void> {
  validateKey(key)

  await writeQueue.enqueue('app', appId, async () => {
    await db.appData
      .where('[namespace+key]')
      .equals([namespace, key])
      .delete()
  })
}
```

### keys 方法

获取所有键名：

```typescript
async keys(): Promise<string[]> {
  const records = await db.appData
    .where('namespace')
    .equals(namespace)
    .toArray()
    
  return records.map((r) => r.key)
}
```

### clear 方法

清空存储：

```typescript
async clear(): Promise<void> {
  await writeQueue.enqueue('app', appId, async () => {
    await db.appData
      .where('namespace')
      .equals(namespace)
      .delete()
  })
}
```

### getUsage 方法

获取存储使用情况：

```typescript
async getUsage(): Promise<{ count: number; estimatedSize: number }> {
  const records = await db.appData
    .where('namespace')
    .equals(namespace)
    .toArray()

  // 估算存储大小（UTF-16 编码，每个字符约 2 字节）
  const estimatedSize = records.reduce((acc, r) => {
    return acc + JSON.stringify(r.value).length * 2
  }, 0)

  return { count: records.length, estimatedSize }
}
```

**返回值**：
- `count`：存储的键值对数量
- `estimatedSize`：估算的存储大小（字节）

## 与 WriteQueue 的集成

所有写入操作都通过 WriteQueue 执行：

```
App 调用 storage.set()
        │
        ▼
┌─────────────────────┐
│   WriteQueue        │
│   优先级: 'app'     │
│   来源: appId       │
└──────────┬──────────┘
           │
           ▼ 串行执行
┌─────────────────────┐
│    IndexedDB        │
│    appData 表       │
└─────────────────────┘
```

**写入优先级**：

| 来源 | 优先级值 | 说明 |
| ---- | -------- | ---- |
| system | 0 | 系统级操作，最高优先 |
| app | 10 | 应用写入操作 |
| sync | 20 | 云同步写入，最低优先 |

## 使用示例

### 基本使用

```typescript
import { useAppStorage } from '@/services/appRuntime'

// 在 App 组件中
const storage = useAppStorage()

// 存储数据
await storage.set('user-settings', {
  theme: 'dark',
  fontSize: 14
})

// 读取数据
const settings = await storage.get<UserSettings>('user-settings')
if (settings) {
  console.log(settings.theme) // 'dark'
}

// 删除数据
await storage.delete('user-settings')
```

### 存储复杂数据

```typescript
// 存储数组
await storage.set('recent-items', [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' }
])

// 存储嵌套对象
await storage.set('app-state', {
  currentPage: 'home',
  history: ['/home', '/settings'],
  user: {
    id: 'user-1',
    preferences: { ... }
  }
})
```

### 检查存储使用情况

```typescript
const usage = await storage.getUsage()
console.log(`存储了 ${usage.count} 条数据`)
console.log(`估算大小: ${(usage.estimatedSize / 1024).toFixed(2)} KB`)
```

### 批量操作

```typescript
// 获取所有键
const allKeys = await storage.keys()
console.log('所有键:', allKeys)

// 清空存储
await storage.clear()
```

## 错误处理

### 键名验证错误

```typescript
// ❌ 空键名
await storage.set('', value)  // Error: Invalid key: must be a non-empty string

// ❌ 非字符串键名
await storage.set(123, value)  // Error: Invalid key: must be a non-empty string

// ❌ 包含冒号
await storage.set('my:key', value)  // Error: Invalid key: cannot contain ":"
```

### 序列化错误

```typescript
// ❌ 循环引用
const obj = { self: null }
obj.self = obj
await storage.set('circular', obj)  // Error: Converting circular structure to JSON
```

## 安全考虑

1. **命名空间隔离**：不同 App 的数据完全隔离，无法互相访问
2. **键名限制**：禁止冒号 `:` 防止命名空间注入攻击
3. **版本追踪**：自动维护版本号，支持冲突检测和同步
4. **写入队列**：串行化写入操作，防止并发问题

## 相关文档

- [写入队列机制](../../dev/Security/write-queue.md)
- [数据隔离设计](../../dev/Security/data-isolation.md)
- [AppRuntime 概述](./README.md)
