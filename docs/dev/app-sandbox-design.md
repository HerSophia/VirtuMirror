# App 存储权限控制设计

> 防止 App（无论是否恶意）越权访问其他 App 或系统的数据

## 目录

1. [问题分析](#问题分析)
2. [安全威胁模型](#安全威胁模型)
3. [设计目标](#设计目标)
4. [方案对比](#方案对比)
5. [推荐方案：AppRuntime 沙箱](#推荐方案appruntime-沙箱)
6. [实现细节](#实现细节)
7. [权限模型](#权限模型)
8. [迁移计划](#迁移计划)

---

## 问题分析

### 当前架构

```typescript
// 现有的 AppDataService - 基于信任的命名空间隔离
const dataService = new AppDataService('builtin/chat')
await dataService.set('key', 'value')  // 写入 appData 表

// 问题：App 代码可以直接绕过 AppDataService
import { db } from '@/services/database'
await db.contacts.toArray()  // 直接读取所有联系人！
await db.messages.clear()     // 删除所有消息！
```

### 核心问题

| 问题 | 描述 | 风险等级 |
|------|------|----------|
| **无隔离边界** | App 代码与系统代码在同一 JS 上下文 | 🔴 高 |
| **直接数据库访问** | 任何代码都能 import db 并操作 | 🔴 高 |
| **权限形同虚设** | 声明权限但运行时不检查 | 🔴 高 |
| **无调用者追踪** | 不知道是哪个 App 发起的操作 | ⚠️ 中 |

---

## 安全威胁模型

### 威胁场景

```
┌─────────────────────────────────────────────────────────────────┐
│                        威胁场景                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. 恶意 App 读取其他 App 数据                                    │
│     攻击者: 社区/URL/本地导入的 App                               │
│     目标: 其他 App 的私有数据                                     │
│     手段: 直接访问 db.appData                                     │
│                                                                   │
│  2. 恶意 App 读取系统敏感数据                                     │
│     攻击者: 未授权联系人权限的 App                                │
│     目标: 联系人、消息、通话记录                                  │
│     手段: 直接访问 db.contacts, db.messages                       │
│                                                                   │
│  3. 恶意 App 破坏系统数据                                         │
│     攻击者: 任何第三方 App                                        │
│     目标: 删除/篡改系统配置或其他 App 数据                        │
│     手段: db.xxx.clear() 或 db.xxx.delete()                      │
│                                                                   │
│  4. 权限提升攻击                                                  │
│     攻击者: 仅有 storage 权限的 App                               │
│     目标: 访问 contacts/messages 等敏感数据                       │
│     手段: 绕过权限检查直接访问数据库                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 攻击面

1. **动态应用**：`configurable`、`template`、`composite` 类型的 App 由 JSON 配置驱动，相对安全
2. **脚本应用**（未来可能支持）：允许自定义 JS 代码，风险最高
3. **第三方组件**：App 可能引用恶意组件库

---

## 设计目标

### 必须实现 (P0)

1. **命名空间强制隔离**：App 只能访问自己的 `dataNamespace`
2. **权限运行时检查**：访问敏感资源前验证权限
3. **调用者身份追踪**：记录每次数据操作的发起者

### 应该实现 (P1)

4. **API 代理层**：所有数据访问通过统一入口
5. **操作审计日志**：记录敏感操作便于排查
6. **权限撤销**：用户可以随时撤销已授予的权限

### 可以延后 (P2)

7. **完全沙箱化**：使用 iframe 隔离 App 运行环境
8. **资源配额**：限制 App 的存储空间使用量
9. **网络请求拦截**：控制 App 的网络访问

---

## 方案对比

### 方案 A: 完全沙箱化 (iframe)

```
┌─────────────────────────────────────────┐
│           主应用 (Vue)                   │
│  ┌────────────────────────────────────┐ │
│  │  App 容器                           │ │
│  │  ┌──────────────────────────────┐  │ │
│  │  │  iframe (sandbox)             │  │ │
│  │  │  ┌────────────────────────┐  │  │ │
│  │  │  │  App 代码              │  │  │ │
│  │  │  │  (完全隔离环境)         │  │  │ │
│  │  │  └────────────────────────┘  │  │ │
│  │  │        ↑↓ postMessage         │  │ │
│  │  └──────────────────────────────┘  │ │
│  │            ↑↓ API Bridge           │ │
│  └────────────────────────────────────┘ │
│                  ↓                       │
│  ┌────────────────────────────────────┐ │
│  │  权限检查层                         │ │
│  │  ┌──────────────────────────────┐  │ │
│  │  │  IndexedDB                    │  │ │
│  │  └──────────────────────────────┘  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**优点**：
- 最高安全级别，完全隔离 JS 上下文
- 即使 App 代码恶意也无法直接访问主应用

**缺点**：
- 实现复杂度极高
- 性能开销大（跨 iframe 通信）
- 样式和主题同步困难
- 不适合当前的 Vue 组件架构

**结论**：❌ 过度设计，不推荐

---

### 方案 B: AppRuntime 代理 (推荐)

```
┌─────────────────────────────────────────┐
│           App 运行时                     │
│  ┌────────────────────────────────────┐ │
│  │  AppRuntime (每个 App 独立实例)     │ │
│  │  ├── storage: ScopedStorage        │ │
│  │  ├── contacts: ContactsAPI (受限)  │ │
│  │  ├── messages: MessagesAPI (受限)  │ │
│  │  └── system: SystemAPI             │ │
│  └─────────────────┬──────────────────┘ │
│                    ↓                     │
│  ┌────────────────────────────────────┐ │
│  │  权限检查中间件                      │ │
│  │  checkPermission(appId, resource)   │ │
│  └─────────────────┬──────────────────┘ │
│                    ↓                     │
│  ┌────────────────────────────────────┐ │
│  │  数据服务层                          │ │
│  │  AppDataService / ContactService    │ │
│  └─────────────────┬──────────────────┘ │
│                    ↓                     │
│  ┌────────────────────────────────────┐ │
│  │  IndexedDB (Dexie)                  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**优点**：
- 实现复杂度适中
- 与现有架构兼容
- 灵活的权限控制
- 性能开销小

**缺点**：
- 需要改造 App 的数据访问方式
- 依赖约定，理论上仍可被绕过（但实际难度高）

**结论**：✅ 推荐方案

---

### 方案 C: 全局拦截器

```typescript
// 在 Dexie 层面拦截所有操作
db.appData.hook('creating', (primKey, obj, trans) => {
  const currentApp = getCurrentAppContext()
  if (!obj.namespace.startsWith(currentApp.dataNamespace)) {
    throw new Error('Permission denied')
  }
})
```

**优点**：
- 改动最小
- 透明拦截

**缺点**：
- 如何获取 "当前 App 上下文"？（异步操作会丢失上下文）
- Dexie hooks 不支持所有场景
- 难以实现细粒度权限

**结论**：⚠️ 可作为补充，但不能作为主方案

---

## 推荐方案：AppRuntime 沙箱

### 核心设计

```typescript
/**
 * App 运行时接口
 * 每个 App 获得一个独立的 runtime 实例
 */
export interface AppRuntime {
  /** App 身份信息 */
  readonly identity: AppIdentity
  
  /** 应用私有存储 (已隔离的 namespace) */
  readonly storage: ScopedStorage
  
  /** 联系人 API (需要 contacts 权限) */
  readonly contacts: ContactsAPI | null
  
  /** 消息 API (需要 messages 权限) */
  readonly messages: MessagesAPI | null
  
  /** 通知 API (需要 notifications 权限) */
  readonly notifications: NotificationsAPI | null
  
  /** AI 生成 API (需要 ai-generate 权限) */
  readonly ai: AIAPI | null
  
  /** 系统 API (基础功能，无需权限) */
  readonly system: SystemAPI
}

/** App 身份信息 */
export interface AppIdentity {
  readonly appId: string
  readonly installationId: string
  readonly dataNamespace: string
  readonly grantedPermissions: readonly AppPermission[]
  readonly source: AppSource
  readonly trustLevel: TrustLevel
}
```

### 隔离存储 API

```typescript
/**
 * 隔离存储 - 自动限定在 App 的 namespace 内
 */
export interface ScopedStorage {
  /** 获取数据 */
  get<T>(key: string): Promise<T | undefined>
  
  /** 设置数据 */
  set<T>(key: string, value: T): Promise<void>
  
  /** 删除数据 */
  delete(key: string): Promise<void>
  
  /** 列出所有键 */
  keys(): Promise<string[]>
  
  /** 清空所有数据 */
  clear(): Promise<void>
  
  /** 获取使用量统计 */
  getUsage(): Promise<{ count: number; estimatedSize: number }>
}
```

### 受限联系人 API

```typescript
/**
 * 联系人 API - 需要 contacts 权限
 */
export interface ContactsAPI {
  /** 获取所有联系人 (只读) */
  getAll(): Promise<ReadonlyContact[]>
  
  /** 根据 ID 获取联系人 */
  getById(id: string): Promise<ReadonlyContact | undefined>
  
  /** 搜索联系人 */
  search(query: string): Promise<ReadonlyContact[]>
  
  // 注意：没有 create/update/delete 方法！
  // 第三方 App 不能修改系统联系人
}

/** 只读联系人类型 */
export type ReadonlyContact = Readonly<Contact>
```

### 权限检查逻辑

```typescript
/**
 * 创建 App 运行时实例
 */
export function createAppRuntime(app: InstalledAppExtended): AppRuntime {
  const permissions = new Set(app.grantedPermissions)
  
  return {
    identity: {
      appId: app.id,
      installationId: app.installationId,
      dataNamespace: app.dataNamespace,
      grantedPermissions: Object.freeze([...app.grantedPermissions]),
      source: app.source,
      trustLevel: app.verificationStatus.trustLevel,
    },
    
    // 存储：始终可用，自动隔离
    storage: createScopedStorage(app.dataNamespace),
    
    // 联系人：需要权限
    contacts: permissions.has('contacts') 
      ? createContactsAPI(app.id) 
      : null,
    
    // 消息：需要权限
    messages: permissions.has('messages') 
      ? createMessagesAPI(app.id) 
      : null,
    
    // 通知：需要权限
    notifications: permissions.has('notifications') 
      ? createNotificationsAPI(app.id) 
      : null,
    
    // AI：需要权限
    ai: permissions.has('ai-generate') 
      ? createAIAPI(app.id) 
      : null,
    
    // 系统：基础功能
    system: createSystemAPI(app.id),
  }
}
```

---

## 实现细节

### 1. ScopedStorage 实现

```typescript
// src/services/appRuntime/scopedStorage.ts

import { db } from '@/services/database'

export function createScopedStorage(namespace: string): ScopedStorage {
  // 验证 namespace 格式
  if (!isValidNamespace(namespace)) {
    throw new Error(`Invalid namespace: ${namespace}`)
  }
  
  return {
    async get<T>(key: string): Promise<T | undefined> {
      validateKey(key)
      const record = await db.appData.get([namespace, key])
      return record?.value as T | undefined
    },
    
    async set<T>(key: string, value: T): Promise<void> {
      validateKey(key)
      await db.appData.put({
        namespace,
        key,
        value,
        version: 1,
        updatedAt: Date.now(),
      })
    },
    
    async delete(key: string): Promise<void> {
      validateKey(key)
      await db.appData.delete([namespace, key])
    },
    
    async keys(): Promise<string[]> {
      const records = await db.appData
        .where('namespace')
        .equals(namespace)
        .toArray()
      return records.map(r => r.key)
    },
    
    async clear(): Promise<void> {
      await db.appData
        .where('namespace')
        .equals(namespace)
        .delete()
    },
    
    async getUsage(): Promise<{ count: number; estimatedSize: number }> {
      const records = await db.appData
        .where('namespace')
        .equals(namespace)
        .toArray()
      
      const estimatedSize = records.reduce((acc, r) => {
        return acc + JSON.stringify(r.value).length * 2 // 粗略估算
      }, 0)
      
      return { count: records.length, estimatedSize }
    }
  }
}

function validateKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid key: must be a non-empty string')
  }
  if (key.includes('/') || key.includes('\\')) {
    throw new Error('Invalid key: cannot contain path separators')
  }
}

function isValidNamespace(ns: string): boolean {
  // 必须匹配预定义的格式
  return /^(builtin|repo|url|local)\//.test(ns)
}
```

### 2. 联系人 API 实现

```typescript
// src/services/appRuntime/contactsAPI.ts

import { contactService } from '@/services/database'

export function createContactsAPI(appId: string): ContactsAPI {
  // 记录操作日志
  const log = (action: string) => {
    console.log(`[Contacts] App "${appId}" called ${action}`)
  }
  
  return {
    async getAll(): Promise<ReadonlyContact[]> {
     log('getAll()')
      const contacts = await contactService.getAll()
      // 返回冻结的副本，防止意外修改
      return Object.freeze(contacts.map(c => Object.freeze({ ...c })))
    },
    
    async getById(id: string): Promise<ReadonlyContact | undefined> {
      log(`getById(${id})`)
      const contact = await contactService.getById(id)
      return contact ? Object.freeze({ ...contact }) : undefined
    },
    
    async search(query: string): Promise<ReadonlyContact[]> {
      log(`search(${query})`)
      const contacts = await contactService.getAll()
      const lowerQuery = query.toLowerCase()
      const results = contacts.filter(c => 
        c.name.toLowerCase().includes(lowerQuery)
      )
      return Object.freeze(results.map(c => Object.freeze({ ...c })))
    }
  }
}
```

### 3. 运行时注入

```typescript
// src/services/appRuntime/context.ts

import { provide, inject, type InjectionKey } from 'vue'

/** AppRuntime 注入键 */
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
 * 获取存储 API (便捷方法)
 */
export function useAppStorage(): ScopedStorage {
  return useAppRuntime().storage
}

/**
 * 获取联系人 API (如果有权限)
 */
export function useContactsAPI(): ContactsAPI | null {
  return useAppRuntime().contacts
}
```

### 4. App 容器组件

```vue
<!-- src/components/apps/AppContainer.vue -->
<template>
  <div class="app-container">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
importideAppRuntime, createAppRuntime } from '@/services/appRuntime'
import type { InstalledAppExtended } from '@/types/appPackage'

const props = defineProps<{
  app: InstalledAppExtended
}>()

// 创建并注入 runtime
const runtime = createAppRuntime(props.app)
provideAppRuntime(runtime)

onMounted(() => {
  console.log(`[AppContainer] Initialized runtime for ${props.app.id}`)
  console.log(`[AppContainer] Namespace: ${runtime.identity.dataNamespace}`)
  console.log(`[AppContainer] Permissions: ${runtime.identity.grantedPermissions.join(', ')}`)
})
</script>
```

---

## 权限模型

### 权限级别

```typescript
export type AppPermission =
  // 基础权限 (低风险)
  | 'storage'       // 应用私有存储 - 自动授予
  | 'notifications' // 发送通知
  | 'camera'        // 虚拟相机
  | 'location'      // 虚拟位置
  
  // 敏感权限 (中风险)
  | 'contacts'      // 只读访问联系人
  | 'ai-generate'   // 调用 AI 生成
  
  // 高危权限 (高风险)
  | 'messages'      // 访问聊天消息
  | 'storage-full'  // 访问其他应用数据 (特殊权限，几乎不授予)
```

### 权限授予规则

| 来源 | 自动授予 | 用户确认 | 禁止授予 |
|------|----------|----------|----------|
| 内置应用 | 全部 | - | - |
| 官方仓库 | storage | 其他所有 | storage-full |
| 社区仓库 | storage | contacts, notifications | messages, ai-generate |
| URL 导入 | storage | notifications | contacts, messages, ai-generate |
| 本地导入 | storage | - | 其他所有 |

### 权限检查流程

```typescript
function checkPermission(
  app: InstalledAppExtended,
  permission: AppPermission
): PermissionCheckResult {
  // 1. 内置应用始终通过
  if (app.source === 'builtin') {
    return { granted: true }
  }
  
  // 2. 检查是否已授权
  if (app.grantedPermissions.includes(permission)) {
    return { granted: true }
  }
  
  // 3. 检查是否可以请求
  const trustLevel = app.verificationStatus.trustLevel
  const canRequest = PERMISSION_REQUEST_RULES[trustLevel][permission]
  
  if (!canRequest) {
    return { 
      granted: false, 
      reason: `该应用信任级别不允许请求 ${permission} 权限` 
    }
  }
  
  // 4. 需要用户授权
  return { 
    granted: false, 
    canRequest: true 
  }
}
```

---

## 迁移计划

### Phase 1: 基础设施 (P0)

**预估工时**: 6-8h

1. 创建 `src/services/appRuntime/` 目录结构
2. 实现 `ScopedStorage` 类
3. 实现 `createAppRuntime` 工厂函数
4. 实现 Vue 注入/提供机制

```
src/services/appRuntime/
├── index.ts              # 统一导出
├── types.ts              # 类型定义
├── scopedStorage.ts      # 隔离存储实现
├── contactsAPI.ts        # 联系人 API
├── messagesAPI.ts        # 消息 API
├── notificationsAPI.ts   # 通知 API
├── aiAPI.ts              # AI API
├── systemAPI.ts          # 系统 API
├── context.ts            # Vue 上下文
└── factory.ts            # 运行时工厂
```

### Phase 2: 内置应用改造 (P1)

**预估工时**: 8-12h

1. 改造微博 App 使用 `useAppRuntime()`
2. 改造聊天 App 使用 `useAppRuntime()`
3. 改造其他内置 App
4. 添加权限检查中间件

### Phase 3: 动态应用支持 (P1)

**预估工时**: 4-6h

1. `AppContainer` 组件集成 runtime 注入
2. 配置式/模板式 App 自动使用 runtime
3. 错误边界处理权限拒绝

### Phase 4: 审计与监控 (P2)

**预估工时**: 4-6h

1. 操作日志记录
2. 权限使用统计
3. 异常行为告警
4. 开发者工具面板

---

## 安全考虑

### 已解决的威胁

1. ✅ **App 数据隔离**：通过 namespace 强制隔离
2. ✅ **系统数据保护**：通过权限检查保护
3. ✅ **权限最小化**：App 只能访问已授权资源

### 未完全解决的威胁

1. ⚠️ **恶意代码直接访问 db**：
   - 缓解：不暴露 `db` 给 App，代码审查
   - 未来：使用 iframe 沙箱

2. ⚠️ **组件库注入攻击**：
   - 缓解：限制 App 可用的组件
   - 未来：组件白名单机制

3. ⚠️ **原型链污染**：
   - 缓解：冻结返回对象
   - 未来：深度冻结或代理

### 安全最佳实践

1. **最小权限原则**：默认不授予任何敏感权限
2. **权限透明性**：清晰告知用户每个权限的用途
3. **可撤销性**：用户可以随时撤销权限
4. **审计日志**：记录所有敏感操作
5. **信任分级**：根据来源给予不同的信任级别
