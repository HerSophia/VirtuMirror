# 数据隔离与 AppRuntime 设计

> 简化版的应用数据隔离方案，确保不同 App 的数据互不干扰

## 目录

1. [设计目标](#设计目标)
2. [数据命名空间](#数据命名空间)
3. [AppRuntime 接口](#appruntime-接口)
4. [来源标识与警告](#来源标识与警告)
5. [实现代码](#实现代码)

---

## 设计目标

### 核心需求

1. **App 数据隔离** - 不同 App 的数据分开存储，互不影响
2. **统一访问接口** - 所有 App 通过相同的 API 访问数据
3. **来源透明** - 用户知道 App 来自哪里

### 简化原则

| 原方案 | 简化后 |
|--------|--------|
| Ed25519 签名验证 | 简单的来源标识 |
| 复杂的信任层级 | 4 种来源类型 |
| 细粒度权限模型 | 基础的存储隔离 |

---

## 数据命名空间

### 来源类型

```typescript
// src/types/appIdentity.ts

/** 应用来源类型 */
export type AppSource = 'builtin' | 'store' | 'url' | 'local'

/** 应用来源详情 */
export interface AppSourceInfo {
  type: AppSource
  /** URL 导入时的原始 URL */
  url?: string
  /** 本地导入时的文件名 */
  fileName?: string
  /** 导入/安装时间 */
  installedAt: number
}
```

### 命名空间计算

```typescript
// src/services/appIdentityService.ts

/**
 * 计算应用的数据命名空间
 * 简单直接，不需要复杂的哈希或签名
 */
export function calculateDataNamespace(
  appId: string,
  source: AppSourceInfo
): string {
  switch (source.type) {
    case 'builtin':
      // 内置应用：直接用 appId
      return `builtin:${appId}`
    
    case 'store':
      // 商店应用：用 appId（商店保证唯一性）
      return `store:${appId}`
    
    case 'url':
      // URL 导入：用域名 + appId
      const domain = source.url ? new URL(source.url).hostname : 'unknown'
      return `url:${domain}:${appId}`
    
    case 'local':
      // 本地导入：用安装时间戳保证唯一
      return `local:${source.installedAt}:${appId}`
  }
}
```

### 隔离效果示例

```
场景：多个 "计算器" 应用

1. 内置计算器
   命名空间: builtin:calculator

2. 商店安装的 "超级计算器"
   命名空间: store:super-calculator

3. 从 example.com 导入的 "计算器"
   命名空间: url:example.com:calculator

4. 本地导入的 "计算器"
   命名空间: local:1704067200000:calculator

→ 4 个应用，4 个独立的数据空间，互不干扰
```

---

## AppRuntime 接口

### 核心设计

```typescript
// src/services/appRuntime/types.ts

/**
 * App 运行时接口
 * 每个 App 获得一个独立的 runtime 实例
 */
export interface AppRuntime {
  /** App 身份信息 */
  readonly identity: AppIdentity
  
  /** 应用私有存储（已隔离的 namespace） */
  readonly storage: ScopedStorage
  
  /** 系统 API（基础功能） */
  readonly system: SystemAPI
}

/** App 身份信息 */
export interface AppIdentity {
  readonly appId: string
  readonly appName: string
  readonly dataNamespace: string
  readonly source: AppSourceInfo
}

/** 隔离存储接口 */
export interface ScopedStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  clear(): Promise<void>
  getUsage(): Promise<{ count: number; estimatedSize: number }>
}

/** 系统 API */
export interface SystemAPI {
  /** 获取当前时间 */
  now(): number
  /** 生成 UUID */
  uuid(): string
  /** 显示 Toast 提示 */
  toast(message: string, type?: 'info' | 'success' | 'error'): void
}
```

### 运行时创建

```typescript
// src/services/appRuntime/factory.ts

import type { InstalledApp } from '@/types/appPackage'
import { createScopedStorage } from './scopedStorage'
import { createSystemAPI } from './systemAPI'

/**
 * 创建 App 运行时实例
 */
export function createAppRuntime(app: InstalledApp): AppRuntime {
  const namespace = calculateDataNamespace(app.id, app.sourceInfo)
  
  return {
    identity: {
      appId: app.id,
      appName: app.name,
      dataNamespace: namespace,
      source: app.sourceInfo,
    },
    
    storage: createScopedStorage(namespace, app.id),
    
    system: createSystemAPI(app.id),
  }
}
```

### Vue 注入机制

```typescript
// src/services/appRuntime/context.ts

import { provide, inject, type InjectionKey } from 'vue'
import type { AppRuntime } from './types'

export const APP_RUNTIME_KEY: InjectionKey<AppRuntime> = Symbol('AppRuntime')

/**
 * 在 App 容器中提供 runtime
 */
export function provideAppRuntime(runtime: AppRuntime): void {
  provide(APP_RUNTIME_KEY, runtime)
}

/**
 * 在 App 组件中使用 runtime
 */
export function useAppRuntime(): AppRuntime {
  const runtime = inject(APP_RUNTIME_KEY)
  if (!runtime) {
    throw new Error('useAppRuntime must be called within an App context')
  }
  return runtime
}

/**
 * 获取存储 API（便捷方法）
 */
export function useAppStorage(): ScopedStorage {
  return useAppRuntime().storage
}
```

---

## 来源标识与警告

### 安装时警告

```typescript
// src/services/appInstallService.ts

export interface InstallWarning {
  level: 'info' | 'warning' | 'danger'
  title: string
  message: string
  confirmText: string
}

/**
 * 获取安装警告信息
 */
export function getInstallWarning(source: AppSourceInfo): InstallWarning | null {
  switch (source.type) {
    case 'builtin':
    case 'store':
      // 内置和商店应用无需警告
      return null
    
    case 'url':
      return {
        level: 'warning',
        title: '安装外部应用',
        message: `该应用来自 ${new URL(source.url!).hostname}，请确认您信任该来源。`,
        confirmText: '我信任此来源，继续安装',
      }
    
    case 'local':
      return {
        level: 'danger',
        title: '安装本地应用',
        message: '该应用来自本地文件，无法验证其来源和安全性。请确保您了解该应用的内容。',
        confirmText: '我了解风险，继续安装',
      }
  }
}
```

### 警告对话框

```vue
<!-- src/components/apps/InstallWarningDialog.vue -->
<template>
  <div v-if="warning" class="install-warning-dialog">
    <div class="overlay" @click="onCancel" />
    <div class="dialog" :class="warning.level">
      <div class="icon">
        <span v-if="warning.level === 'warning'">⚠️</span>
        <span v-else-if="warning.level === 'danger'">🔴</span>
        <span v-else>ℹ️</span>
      </div>
      
      <h3>{{ warning.title }}</h3>
      <p>{{ warning.message }}</p>
      
      <div class="source-info">
        <span class="label">应用名称:</span>
        <span class="value">{{ appName }}</span>
      </div>
      
      <div class="actions">
        <button class="cancel" @click="onCancel">取消</button>
        <button class="confirm" :class="warning.level" @click="onConfirm">
          {{ warning.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>
```

### 应用详情页显示

```vue
<!-- src/components/apps/AppSourceBadge.vue -->
<template>
  <div class="source-badge" :class="source.type">
    <span class="icon">{{ icon }}</span>
    <span class="label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AppSourceInfo } from '@/types/appIdentity'

const props = defineProps<{
  source: AppSourceInfo
}>()

const icon = computed(() => {
  switch (props.source.type) {
    case 'builtin': return '📦'
    case 'store': return '🏪'
    case 'url': return '🔗'
    case 'local': return '📁'
  }
})

const label = computed(() => {
  switch (props.source.type) {
    case 'builtin': return '内置应用'
    case 'store': return '应用商店'
    case 'url': return `来自 ${new URL(props.source.url!).hostname}`
    case 'local': return '本地导入'
  }
})
</script>

<style scoped>
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.source-badge.builtin { background: #e8f5e9; color: #2e7d32; }
.source-badge.store { background: #e3f2fd; color: #1565c0; }
.source-badge.url { background: #fff3e0; color: #ef6c00; }
.source-badge.local { background: #ffebee; color: #c62828; }
</style>
```

---

## 实现代码

### ScopedStorage 实现

```typescript
// src/services/appRuntime/scopedStorage.ts

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
    async get<T>(key: string): Promise<T | undefined> {
      validateKey(key)
      const fullKey = `${namespace}:${key}`
      const record = await db.appData.get(fullKey)
      return record?.value as T | undefined
    },
    
    async set<T>(key: string, value: T): Promise<void> {
      validateKey(key)
      const fullKey = `${namespace}:${key}`
      
      // 通过写入队列执行
      await writeQueue.enqueue('app', appId, async () => {
        await db.appData.put({
          key: fullKey,
          namespace,
          value,
          updatedAt: Date.now(),
        })
      })
    },
    
    async delete(key: string): Promise<void> {
      validateKey(key)
      const fullKey = `${namespace}:${key}`
      
      await writeQueue.enqueue('app', appId, async () => {
        await db.appData.delete(fullKey)
      })
    },
    
    async keys(): Promise<string[]> {
      const records = await db.appData
        .where('namespace')
        .equals(namespace)
        .toArray()
      
      // 移除 namespace 前缀
      const prefixLen = namespace.length + 1
      return records.map(r => r.key.slice(prefixLen))
    },
    
    async clear(): Promise<void> {
      await writeQueue.enqueue('app', appId, async () => {
        await db.appData
          .where('namespace')
          .equals(namespace)
          .delete()
      })
    },
    
    async getUsage(): Promise<{ count: number; estimatedSize: number }> {
      const records = await db.appData
        .where('namespace')
        .equals(namespace)
        .toArray()
      
      const estimatedSize = records.reduce((acc, r) => {
        return acc + JSON.stringify(r.value).length * 2
      }, 0)
      
      return { count: records.length, estimatedSize }
    },
  }
}
```

### SystemAPI 实现

```typescript
// src/services/appRuntime/systemAPI.ts

import type { SystemAPI } from './types'
import { useNotificationStore } from '@/stores/notificationStore'

export function createSystemAPI(appId: string): SystemAPI {
  return {
    now(): number {
      return Date.now()
    },
    
    uuid(): string {
      return crypto.randomUUID()
    },
    
    toast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
      const store = useNotificationStore()
      store.showToast({ message, type, source: appId })
    },
  }
}
```

### 数据库 Schema 扩展

```typescript
// src/services/database/schema.ts

import Dexie, { type Table } from 'dexie'

export interface AppDataRecord {
  /** 完整 key：namespace:key */
  key: string
  /** 命名空间（用于查询） */
  namespace: string
  /** 数据值 */
  value: unknown
  /** 更新时间 */
  updatedAt: number
}

export class PhoneDatabase extends Dexie {
  // ... 现有表 ...
  
  /** 应用数据表 */
  appData!: Table<AppDataRecord>
  
  constructor() {
    super('PhoneSimulator')
    
    this.version(2).stores({
      // ... 现有表 ...
      
      // 应用数据：主键为完整 key，索引 namespace 用于查询
      appData: 'key, namespace, updatedAt',
    })
  }
}
```

---

## 使用示例

### 在 App 中使用

```vue
<!-- 某个第三方 App 的组件 -->
<template>
  <div>
    <input v-model="note" @blur="saveNote" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStorage } from '@/services/appRuntime'

const storage = useAppStorage()
const note = ref('')

onMounted(async () => {
  // 读取保存的笔记
  note.value = await storage.get<string>('my-note') ?? ''
})

async function saveNote() {
  // 保存笔记（自动隔离到当前 App 的命名空间）
  await storage.set('my-note', note.value)
}
</script>
```

### 在 App 容器中初始化

```vue
<!-- src/components/apps/AppContainer.vue -->
<template>
  <div class="app-container">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { provideAppRuntime, createAppRuntime } from '@/services/appRuntime'
import type { InstalledApp } from '@/types/appPackage'

const props = defineProps<{
  app: InstalledApp
}>()

// 创建并注入 runtime
const runtime = createAppRuntime(props.app)
provideAppRuntime(runtime)

onMounted(() => {
  console.log(`[AppContainer] App "${props.app.name}" initialized`)
  console.log(`[AppContainer] Namespace: ${runtime.identity.dataNamespace}`)
})
</script>
```
