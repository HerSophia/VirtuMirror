# 图标服务 - Store API

本文档详细说明 `IconStore` 的 API 接口。

## 1. 概述

`IconStore` 是基于 Pinia 的响应式状态管理，负责：

- 持有图标配置的响应式状态
- 提供计算属性（Getters）
- 在初始化时注入状态到 `IconService`

**架构特点**：

- Store 负责「状态持有」
- Service 负责「业务逻辑」
- 两者协同工作，实现关注点分离

---

## 2. 获取 Store

```typescript
import { useIconStore } from '@/stores/iconStore'

const iconStore = useIconStore()
```

> **注意**：必须在 Pinia 初始化后使用，通常在 Vue 组件或 `setup()` 函数中调用。

---

## 3. State（状态）

### 3.1 icons

图标配置的 Map 集合。

```typescript
icons: Ref<Map<string, RegisteredAppIcon>>
```

**类型说明**：

- Key: 图标 ID（字符串）
- Value: `RegisteredAppIcon` 对象

**使用示例**：

```typescript
const iconStore = useIconStore()

// 直接访问 Map
const map = iconStore.icons
console.log(map.size) // 已注册数量

// 遍历所有图标
map.forEach((icon, id) => {
  console.log(`${id}: ${icon.name}`)
})
```

---

## 4. Getters（计算属性）

### 4.1 allIcons

获取所有已注册的图标列表。

```typescript
allIcons: ComputedRef<RegisteredAppIcon[]>
```

**说明**：将 Map 转换为数组，方便遍历和渲染。

**使用示例**：

```vue
<template>
  <div v-for="icon in iconStore.allIcons" :key="icon.id">
    {{ icon.name }}
  </div>
</template>

<script setup>
import { useIconStore } from '@/stores/iconStore'
const iconStore = useIconStore()
</script>
```

---

### 4.2 builtinApps

获取所有内置应用的图标。

```typescript
builtinApps: ComputedRef<RegisteredAppIcon[]>
```

**说明**：过滤 `isBuiltin === true` 的图标。

**使用示例**：

```typescript
const iconStore = useIconStore()

// 获取内置应用
const builtins = computed(() => iconStore.builtinApps)
console.log(`内置应用数量: ${builtins.value.length}`)
```

---

## 5. Actions（方法）

### 5.1 getIcon(id)

获取单个图标配置。

```typescript
getIcon(id: string): RegisteredAppIcon | undefined
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 图标 ID |

**返回值**：`RegisteredAppIcon | undefined`

**使用示例**：

```typescript
const iconStore = useIconStore()

const wechat = iconStore.getIcon('wechat')
if (wechat) {
  console.log(wechat.name) // '微信'
  console.log(wechat.route) // '/wechat'
}
```

---

### 5.2 getByCategory(category)

获取指定分类的所有图标。

```typescript
getByCategory(category: AppCategory): RegisteredAppIcon[]
```

**参数**：

| 参数 | 类型 | 说明 |
| :--- | :--- | :--- |
| `category` | `AppCategory` | 分类类型 |

**返回值**：`RegisteredAppIcon[]`

**使用示例**：

```typescript
const iconStore = useIconStore()

// 获取社交类应用
const socialApps = iconStore.getByCategory('social')
console.log(socialApps.map(app => app.name)) // ['微信', '微博', ...]

// 获取工具类应用
const toolApps = iconStore.getByCategory('tool')
```

---

## 6. 完整类型定义

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RegisteredAppIcon, AppCategory } from '@/types/icon'

export const useIconStore = defineStore('icon', () => {
  // State
  const icons: Ref<Map<string, RegisteredAppIcon>>
  
  // Getters
  const allIcons: ComputedRef<RegisteredAppIcon[]>
  const builtinApps: ComputedRef<RegisteredAppIcon[]>
  
  // Actions
  function getIcon(id: string): RegisteredAppIcon | undefined
  function getByCategory(category: AppCategory): RegisteredAppIcon[]
  
  return {
    icons,
    allIcons,
    builtinApps,
    getIcon,
    getByCategory
  }
})
```

---

## 7. 与 Service 的关系

### 7.1 初始化流程

```typescript
// src/stores/iconStore.ts

import { iconService } from '@/services/icon/iconService'

export const useIconStore = defineStore('icon', () => {
  // 创建响应式状态
  const icons = ref<Map<string, RegisteredAppIcon>>(new Map())
  
  // 依赖注入：将状态注入到 Service
  iconService.init({ icons })
  
  // ... 其他代码
})
```

### 7.2 数据流向

```text
              ┌─────────────────┐
              │   App / 组件     │
              └────────┬────────┘
                       │ 调用 register()
                       ▼
              ┌─────────────────┐
              │  IconService    │
              │  (业务逻辑)      │
              └────────┬────────┘
                       │ 操作 icons.value
                       ▼
              ┌─────────────────┐
              │   IconStore     │
              │  (响应式状态)    │
              └────────┬────────┘
                       │ 响应式更新
                       ▼
              ┌─────────────────┐
              │   UI 组件        │
              │ (自动重新渲染)   │
              └─────────────────┘
```

---

## 8. 使用模式

### 8.1 在组件中使用（推荐）

```vue
<script setup lang="ts">
import { useIconStore } from '@/stores/iconStore'
import { computed } from 'vue'

const iconStore = useIconStore()

// 响应式计算
const icons = computed(() => iconStore.allIcons)
const socialApps = computed(() => iconStore.getByCategory('social'))
const hasWeibo = computed(() => !!iconStore.getIcon('weibo'))
</script>

<template>
  <div>
    <p>已注册 {{ icons.length }} 个应用</p>
    <p>社交应用: {{ socialApps.length }} 个</p>
    <p>微博已注册: {{ hasWeibo ? '是' : '否' }}</p>
  </div>
</template>
```

### 8.2 在 Composable 中使用

```typescript
// composables/useAppIcons.ts
import { useIconStore } from '@/stores/iconStore'
import { computed } from 'vue'

export function useAppIcons(category?: AppCategory) {
  const iconStore = useIconStore()
  
  const icons = computed(() => {
    if (category) {
      return iconStore.getByCategory(category)
    }
    return iconStore.allIcons
  })
  
  const getIconById = (id: string) => iconStore.getIcon(id)
  
  return {
    icons,
    getIconById
  }
}
```

### 8.3 桌面一键整理

```typescript
import { useIconStore } from '@/stores/iconStore'
import type { AppCategory } from '@/types/icon'

const CATEGORY_ORDER: AppCategory[] = [
  'social',
  'entertainment',
  'productivity',
  'tool',
  'system',
  'other'
]

export function useDesktopOrganize() {
  const iconStore = useIconStore()
  
  function organizeByCategory() {
    const grouped = new Map<AppCategory, RegisteredAppIcon[]>()
    
    // 按分类分组
    iconStore.allIcons.forEach(icon => {
      const category = icon.category || 'other'
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(icon)
    })
    
    // 按预定义顺序排列
    const result: RegisteredAppIcon[] = []
    CATEGORY_ORDER.forEach(category => {
      const icons = grouped.get(category) || []
      result.push(...icons)
    })
    
    return result
  }
  
  return { organizeByCategory }
}
```

---

## 9. 注意事项

### 9.1 初始化时机

确保在 Pinia 初始化后使用：

```typescript
// ✅ 正确：在 setup 中使用
export default {
  setup() {
    const iconStore = useIconStore()
    return { iconStore }
  }
}

// ❌ 错误：在模块顶层使用
const iconStore = useIconStore() // 可能 Pinia 还未初始化
```

### 9.2 响应式保持

```typescript
// ✅ 正确：使用 computed 保持响应式
const icons = computed(() => iconStore.allIcons)

// ❌ 错误：直接解构会丢失响应式
const { allIcons } = iconStore // allIcons 不再响应式
```

### 9.3 修改数据

不要直接修改 Store 的状态，应通过 Service 操作：

```typescript
// ✅ 正确：通过 Service 操作
import { iconService } from '@/services/icon'
iconService.register({ ... })
iconService.unregister('my-app')

// ❌ 错误：直接修改 Store
iconStore.icons.set('my-app', { ... }) // 绕过了验证逻辑
```
