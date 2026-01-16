# AppRuntime 使用指南

> 使用指南与最佳实践

## 概述

本文档介绍如何在 App 开发中正确使用 AppRuntime 服务，包括创建运行时、上下文传递、存储使用等最佳实践。

## 快速开始

### 1. 在 App 容器中创建运行时

每个 App 的根组件（容器组件）负责创建和提供 AppRuntime：

```vue
<!-- MyApp.vue -->
<template>
  <div class="my-app">
    <MyAppContent />
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import { 
  createBuiltinAppRuntime, 
  provideAppRuntime,
  unregisterAppRuntime 
} from '@/services/appRuntime'

// 创建运行时
const runtime = createBuiltinAppRuntime('my-app', '我的应用')

// 提供给子组件
provideAppRuntime(runtime)

// 清理（可选，用于动态卸载场景）
onUnmounted(() => {
  unregisterAppRuntime(runtime.identity.appId)
})
</script>
```

### 2. 在子组件中使用

```vue
<!-- MyAppContent.vue -->
<template>
  <div>
    <p>App ID: {{ appId }}</p>
    <button @click="saveData">保存</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppRuntime, useAppStorage } from '@/services/appRuntime'

const runtime = useAppRuntime()
const storage = useAppStorage()

const appId = computed(() => runtime.identity.appId)

async function saveData() {
  await storage.set('my-data', { value: 42 })
  runtime.system.toast('已保存', 'success')
}
</script>
```

## 创建方式

### 内置应用

对于内置应用，使用简化的创建函数：

```typescript
import { createBuiltinAppRuntime } from '@/services/appRuntime'

const runtime = createBuiltinAppRuntime('notes', '备忘录')
// 命名空间: builtin/notes
```

### 已安装应用

对于从商店或外部安装的应用：

```typescript
import { createAppRuntime } from '@/services/appRuntime'

const runtime = createAppRuntime({
  id: 'super-notes',
  name: 'Super Notes',
  sourceInfo: { 
    type: 'repo', 
    repoId: 'official', 
    developerId: 'awesome-dev' 
  },
  installationId: 'inst_abc123'
})
// 命名空间: repo/official/awesome-dev/super-notes
```

### 不同来源的命名空间

```typescript
// 内置应用
const builtin = createAppRuntime({
  id: 'calc',
  name: '计算器',
  sourceInfo: { type: 'builtin' },
  installationId: 'builtin_calc'
})
// 命名空间: builtin/calc

// 商店应用
const repo = createAppRuntime({
  id: 'game',
  name: '小游戏',
  sourceInfo: { type: 'repo', repoId: 'community', developerId: 'dev123' },
  installationId: 'inst_xyz'
})
// 命名空间: repo/community/dev123/game

// URL 导入
const url = createAppRuntime({
  id: 'tool',
  name: '工具',
  sourceInfo: { type: 'url', url: 'https://example.com/app.json' },
  installationId: 'inst_url1'
})
// 命名空间: url/example.com/{hash}

// 本地导入
const local = createAppRuntime({
  id: 'my-tool',
  name: '本地工具',
  sourceInfo: { type: 'local', filename: 'my-tool.json' },
  installationId: 'inst_local1'
})
// 命名空间: local/inst_local1
```

## 上下文访问

### 在组件中访问

```typescript
import { useAppRuntime, useAppStorage } from '@/services/appRuntime'

// 获取完整 runtime
const runtime = useAppRuntime()

// 便捷方法：直接获取存储
const storage = useAppStorage()
```

### 在非组件上下文中访问

在 Pinia store、composables 或普通函数中：

```typescript
import { tryUseAppRuntime } from '@/services/appRuntime'

// 安全获取，不存在时返回 null
const runtime = tryUseAppRuntime()

if (runtime) {
  await runtime.storage.set('key', value)
} else {
  console.warn('Not in app context')
}
```

### 访问机制说明

```
┌─────────────────────────────────────────────────┐
│  tryUseAppRuntime()                             │
│                                                  │
│  1. 检查是否在 Vue 组件上下文中                   │
│     │                                            │
│     ├── 是 → 使用 inject() 获取                 │
│     │         │                                  │
│     │         └── 成功 → 返回 runtime           │
│     │                                            │
│     └── 否 → 回退到全局注册表                    │
│               │                                  │
│               └── 返回当前活动的 runtime         │
│                                                  │
└─────────────────────────────────────────────────┘
```

## 存储使用最佳实践

### 键名设计

```typescript
// ✅ 推荐：使用有意义的前缀
await storage.set('settings', { theme: 'dark' })
await storage.set('note-1', { title: '笔记1' })
await storage.set('cache-users', [...])

// ✅ 推荐：使用连字符分隔
await storage.set('user-preferences', { ... })
await storage.set('last-opened-file', 'doc1')

// ❌ 避免：使用冒号（会报错）
await storage.set('user:settings', value)  // Error!

// ❌ 避免：过于简短的键名
await storage.set('s', value)  // 难以理解
await storage.set('d', value)  // 难以维护
```

### 数据结构设计

```typescript
// ✅ 推荐：扁平化结构，单独的设置键
await storage.set('settings', {
  theme: 'dark',
  fontSize: 14,
  language: 'zh-CN'
})

// ✅ 推荐：列表数据单独存储
await storage.set('notes-list', ['note-1', 'note-2', 'note-3'])
await storage.set('note-1', { id: 'note-1', content: '...' })
await storage.set('note-2', { id: 'note-2', content: '...' })

// ❌ 避免：将所有数据放在一个巨大对象中
await storage.set('all-data', {
  settings: { ... },
  notes: [...hundreds of notes...],
  cache: { ... }
})  // 每次更新都要读写全部数据
```

### 版本兼容性

```typescript
// 存储数据时包含版本信息
interface AppData {
  version: number
  // ... 其他字段
}

await storage.set('app-data', {
  version: 2,
  settings: { ... },
  notes: []
})

// 读取时检查版本并迁移
const data = await storage.get<AppData>('app-data')
if (data) {
  if (data.version === 1) {
    // 迁移到 v2
    const migrated = migrateV1ToV2(data)
    await storage.set('app-data', migrated)
  }
}
```

### 错误处理

```typescript
async function saveNote(note: Note) {
  const runtime = useAppRuntime()
  const storage = useAppStorage()

  try {
    await storage.set(`note-${note.id}`, {
      ...note,
      updatedAt: runtime.system.now()
    })
    runtime.system.toast('保存成功', 'success')
  } catch (error) {
    console.error('Failed to save note:', error)
    runtime.system.toast('保存失败，请重试', 'error')
  }
}
```

## 常见模式

### 模式 1：设置管理

```typescript
interface AppSettings {
  theme: 'light' | 'dark'
  fontSize: number
  notifications: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  fontSize: 14,
  notifications: true
}

export function useSettings() {
  const storage = useAppStorage()
  const settings = ref<AppSettings>(DEFAULT_SETTINGS)

  async function load() {
    const saved = await storage.get<AppSettings>('settings')
    if (saved) {
      settings.value = { ...DEFAULT_SETTINGS, ...saved }
    }
  }

  async function save(newSettings: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...newSettings }
    await storage.set('settings', settings.value)
  }

  return { settings, load, save }
}
```

### 模式 2：列表数据管理

```typescript
interface Note {
  id: string
  title: string
  content: string
  createdAt: number
}

export function useNotes() {
  const runtime = useAppRuntime()
  const storage = useAppStorage()
  const notes = ref<Note[]>([])

  async function loadAll() {
    const keys = await storage.keys()
    const noteKeys = keys.filter(k => k.startsWith('note-'))
    
    const loaded = await Promise.all(
      noteKeys.map(k => storage.get<Note>(k))
    )
    
    notes.value = loaded.filter(Boolean) as Note[]
  }

  async function create(title: string, content: string) {
    const note: Note = {
      id: runtime.system.uuid(),
      title,
      content,
      createdAt: runtime.system.now()
    }
    
    await storage.set(`note-${note.id}`, note)
    notes.value.push(note)
    
    return note
  }

  async function remove(id: string) {
    await storage.delete(`note-${id}`)
    notes.value = notes.value.filter(n => n.id !== id)
  }

  return { notes, loadAll, create, remove }
}
```

### 模式 3：缓存管理

```typescript
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export function useCache() {
  const runtime = useAppRuntime()
  const storage = useAppStorage()

  async function get<T>(key: string): Promise<T | null> {
    const entry = await storage.get<CacheEntry<T>>(`cache-${key}`)
    
    if (!entry) return null
    
    // 检查是否过期
    if (runtime.system.now() - entry.timestamp > entry.ttl) {
      await storage.delete(`cache-${key}`)
      return null
    }
    
    return entry.data
  }

  async function set<T>(key: string, data: T, ttlMs: number = 3600000) {
    const entry: CacheEntry<T> = {
      data,
      timestamp: runtime.system.now(),
      ttl: ttlMs
    }
    await storage.set(`cache-${key}`, entry)
  }

  return { get, set }
}
```

## 调试技巧

### 查看存储内容

```typescript
// 在组件中
const storage = useAppStorage()

async function debugStorage() {
  const keys = await storage.keys()
  console.log('All keys:', keys)

  for (const key of keys) {
    const value = await storage.get(key)
    console.log(`${key}:`, value)
  }

  const usage = await storage.getUsage()
  console.log('Usage:', usage)
}
```

### 使用浏览器开发工具

1. 打开浏览器开发者工具
2. 切换到 Application（应用程序）标签
3. 在左侧找到 IndexedDB
4. 展开数据库，查看 `appData` 表
5. 按 `namespace` 列筛选特定 App 的数据

### 清除测试数据

```typescript
// 清除当前 App 的所有数据
const storage = useAppStorage()
await storage.clear()

runtime.system.toast('数据已清除', 'info')
```

## 注意事项

### 1. 异步操作

所有存储操作都是异步的，记得使用 `await`：

```typescript
// ✅ 正确
const data = await storage.get('key')

// ❌ 错误：忘记 await
const data = storage.get('key')  // 返回 Promise，不是实际数据
```

### 2. 类型安全

使用泛型确保类型安全：

```typescript
interface UserSettings {
  theme: string
  fontSize: number
}

// ✅ 推荐：指定类型
const settings = await storage.get<UserSettings>('settings')
if (settings) {
  console.log(settings.theme)  // TypeScript 知道类型
}

// ❌ 不推荐：不指定类型
const settings = await storage.get('settings')  // 类型是 unknown
```

### 3. 上下文要求

`useAppRuntime()` 必须在 App 上下文中调用：

```typescript
// ✅ 正确：在已提供 runtime 的组件树中
const runtime = useAppRuntime()

// ❌ 错误：在没有提供 runtime 的地方调用
// 会抛出 Error: useAppRuntime must be called within an App context
```

### 4. 数据大小

IndexedDB 有存储限制（通常是可用磁盘空间的一定比例），但单个值没有硬性限制。建议：

- 单个值不超过 1MB
- 定期清理不需要的数据
- 使用 `getUsage()` 监控存储使用情况

## 相关文档

- [AppRuntime 概述](./README.md)
- [类型定义](./types.md)
- [隔离存储](./scoped-storage.md)
- [系统 API](./system-api.md)
