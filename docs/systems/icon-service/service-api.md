# 图标服务 - Service API

本文档详细说明 `IconService` 的 API 接口。

## 1. 概述

`IconService` 是图标服务的核心逻辑层，采用单例模式，负责：

- 图标注册与校验
- 去重与覆盖逻辑
- 图标查询
- 变更通知（向后兼容）

**状态注入**：IconService 本身不持有状态，由 `IconStore` 在初始化时注入响应式状态。

---

## 2. 获取实例

```typescript
// 方式 1：直接导入单例
import { iconService } from '@/services/icon'

// 方式 2：通过类方法获取
import { IconService } from '@/services/icon'
const service = IconService.getInstance()
```

---

## 3. API 参考

### 3.1 初始化

#### `init(state)`

初始化服务，注入响应式状态。由 `IconStore` 自动调用，通常不需要手动调用。

```typescript
init(state: { icons: Ref<Map<string, RegisteredAppIcon>> }): void
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `state.icons` | `Ref<Map<string, RegisteredAppIcon>>` | 响应式的图标 Map |

**示例**：

```typescript
// IconStore 内部实现
const icons = ref<Map<string, RegisteredAppIcon>>(new Map())
iconService.init({ icons })
```

---

### 3.2 注册操作

#### `register(icon, options?)`

注册一个 App 图标。

```typescript
register(
  icon: RegisteredAppIcon, 
  options?: IconRegistrationOptions
): boolean
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `icon` | `RegisteredAppIcon` | 图标配置对象 |
| `options.override` | `boolean` | 是否覆盖已存在的注册，默认 `false` |

**返回值**：`boolean` - 注册是否成功

**行为说明**：

1. 检查服务是否已初始化
2. 验证必要字段（`id` 和 `name`）
3. 检查是否已存在相同 ID
   - 如果存在且 `override = false`：打印警告，返回 `false`
   - 如果存在且 `override = true`：覆盖已有配置
4. 注册成功后通知监听器

**示例**：

```typescript
// 基本注册
iconService.register({
  id: 'my-app',
  name: '我的应用',
  route: '/my-app',
  icon: { type: 'emoji', value: '📱' },
  category: 'tool',
  isBuiltin: true
})

// 强制覆盖
iconService.register({
  id: 'my-app',
  name: '我的应用 v2',
  route: '/my-app',
  icon: { type: 'emoji', value: '🚀' }
}, { override: true })
```

---

#### `registerAll(icons, options?)`

批量注册图标。

```typescript
registerAll(
  icons: RegisteredAppIcon[], 
  options?: IconRegistrationOptions
): void
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `icons` | `RegisteredAppIcon[]` | 图标配置数组 |
| `options` | `IconRegistrationOptions` | 注册选项，应用于所有图标 |

**示例**：

```typescript
iconService.registerAll([
  { id: 'app1', name: 'App 1', route: '/app1' },
  { id: 'app2', name: 'App 2', route: '/app2' },
  { id: 'app3', name: 'App 3', route: '/app3' }
])
```

---

#### `unregister(id)`

取消注册图标。

```typescript
unregister(id: string): boolean
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 图标 ID |

**返回值**：`boolean` - 是否成功取消注册

**示例**：

```typescript
if (iconService.unregister('my-app')) {
  console.log('图标已取消注册')
}
```

---

### 3.3 查询操作

#### `get(id)`

获取单个图标配置。

```typescript
get(id: string): RegisteredAppIcon | undefined
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 图标 ID |

**返回值**：`RegisteredAppIcon | undefined` - 图标配置或 undefined

**示例**：

```typescript
const wechatIcon = iconService.get('wechat')
if (wechatIcon) {
  console.log(wechatIcon.name) // '微信'
}
```

---

#### `getAll()`

获取所有已注册的图标。

```typescript
getAll(): RegisteredAppIcon[]
```

**返回值**：`RegisteredAppIcon[]` - 所有图标配置数组

**示例**：

```typescript
const allIcons = iconService.getAll()
console.log(`已注册 ${allIcons.length} 个图标`)
```

---

#### `has(id)`

检查图标是否已注册。

```typescript
has(id: string): boolean
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 图标 ID |

**返回值**：`boolean` - 是否已注册

**示例**：

```typescript
if (!iconService.has('my-app')) {
  iconService.register({ ... })
}
```

---

### 3.4 管理操作

#### `clear()`

清除所有注册的图标。主要用于测试。

```typescript
clear(): void
```

**示例**：

```typescript
// 测试前清理
beforeEach(() => {
  iconService.clear()
})
```

---

#### `subscribe(listener)`

订阅图标变化事件。用于向后兼容旧代码。

```typescript
subscribe(listener: () => void): () => void
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `listener` | `() => void` | 变化回调函数 |

**返回值**：`() => void` - 取消订阅函数

**示例**：

```typescript
const unsubscribe = iconService.subscribe(() => {
  console.log('图标配置已变化')
  // 刷新 UI...
})

// 取消订阅
onUnmounted(() => {
  unsubscribe()
})
```

> **注意**：在 Vue 组件中，推荐直接使用 `useIconStore()` 的响应式数据，而不是手动订阅。

---

## 4. 完整类型定义

```typescript
class IconService {
  // 单例获取
  static getInstance(): IconService
  
  // 初始化
  init(state: { icons: Ref<Map<string, RegisteredAppIcon>> }): void
  
  // 注册操作
  register(icon: RegisteredAppIcon, options?: IconRegistrationOptions): boolean
  registerAll(icons: RegisteredAppIcon[], options?: IconRegistrationOptions): void
  unregister(id: string): boolean
  
  // 查询操作
  get(id: string): RegisteredAppIcon | undefined
  getAll(): RegisteredAppIcon[]
  has(id: string): boolean
  
  // 管理操作
  clear(): void
  subscribe(listener: () => void): () => void
}
```

---

## 5. 使用建议

### 5.1 在非 Vue 上下文中使用

```typescript
// services/myService.ts
import { iconService } from '@/services/icon'

export function registerMyAppIcons() {
  iconService.registerAll([
    { id: 'feature-1', name: '功能1', route: '/f1' },
    { id: 'feature-2', name: '功能2', route: '/f2' }
  ])
}
```

### 5.2 在 Vue 组件中使用

推荐直接使用 Store，获得更好的响应式体验：

```vue
<script setup>
import { useIconStore } from '@/stores/iconStore'
import { computed } from 'vue'

const iconStore = useIconStore()

// 响应式数据
const icons = computed(() => iconStore.allIcons)
</script>
```

### 5.3 初始化时机

确保在 Pinia 初始化后再使用 `iconService`：

```typescript
// main.ts
import { createPinia } from 'pinia'

const app = createApp(App)
app.use(createPinia())

// 此时 iconStore 会自动初始化，iconService 可用
import { useIconStore } from '@/stores/iconStore'
useIconStore() // 触发初始化

// 现在可以安全使用 iconService
import { iconService } from '@/services/icon'
iconService.register({ ... })
```

---

## 6. 错误处理

### 6.1 服务未初始化

```typescript
// 如果在 Pinia 初始化前调用
iconService.register({ ... })
// 警告：[IconService] Service not initialized...
// 返回 false
```

### 6.2 缺少必要字段

```typescript
iconService.register({ id: 'test' }) // 缺少 name
// 错误：[IconService] 注册失败：缺少 id 或 name
// 返回 false
```

### 6.3 重复注册

```typescript
iconService.register({ id: 'app', name: 'App', route: '/' })
iconService.register({ id: 'app', name: 'App2', route: '/' })
// 警告：[IconService] 图标 app 已存在，跳过注册。使用 override: true 覆盖。
// 返回 false
```
