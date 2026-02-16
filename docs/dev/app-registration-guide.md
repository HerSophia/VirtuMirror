# App 注册指南

## 概述

小手机模拟器提供了统一的 App 注册服务 (`appRegistry`)，只需一次注册即可自动完成：

1. ✅ 图标注册（IconService）
2. ✅ 桌面布局添加（自动找空位）
3. ✅ 路由配置（需手动添加）

## 快速开始

### 1. 创建 manifest.ts

在你的 App 目录下创建 `manifest.ts`：

```typescript
// src/apps/my-app/manifest.ts
import { registerApp } from '@/services/appRegistryService'

export function registerMyApp() {
  registerApp({
    id: 'my-app',
    name: '我的应用',
    route: '/my-app',
    category: 'tool',
    isBuiltin: true,
    
    // 图标配置
    icon: {
      type: 'font',           // 'font' | 'emoji' | 'url' | 'component'
      value: 'fas fa-star',   // FontAwesome 图标
      background: '#FF5722',  // 背景色
      color: '#FFFFFF'        // 图标颜色
    },
    
    // 桌面配置（可选）
    desktop: {
      show: true,             // 是否显示在桌面
      position: 'auto'        // 'auto' | 'first' | 'last'
    },
    
    // 快捷操作（可选）
    quickActions: [
      { id: 'action-1', label: '快捷入口', icon: 'fa-bolt', route: '/my-app/quick' }
    ]
  }, { override: true })
}
```

### 2. 在 main.ts 中注册

```typescript
// src/main.ts
import { registerMyApp } from '@/apps/my-app/manifest'

async function initializeServices() {
  // ... 其他初始化
  
  registerBuiltinApps()
  registerMyApp()  // 添加这行
  
  // ...
}
```

### 3. 添加路由（如果还没有）

```typescript
// src/router/index.ts
{
  path: '/my-app',
  name: 'MyApp',
  component: () => import('@/apps/my-app/MyApp.vue'),
  meta: { title: '我的应用' }
}
```

## 完整配置参考

```typescript
interface AppRegistration {
  // === 必填 ===
  id: string              // 唯一标识
  name: string            // 显示名称
  route: string           // 路由路径
  category: AppCategory   // 分类
  
  // === 图标 ===
  isBuiltin?: boolean     // 是否内置（默认true）
  iconId?: string         // 图标ID（默认与id相同）
  icon?: {
    type: 'font' | 'emoji' | 'url' | 'component'
    value: string | Component
    background: string
    color?: string
  }
  
  // === 桌面 ===
  desktop?: {
    show?: boolean        // 默认true
    position?: 'auto' | 'first' | 'last'
    page?: number         // 指定页码（0-based）
  }
  
  // === 快捷操作 ===
  quickActions?: {
    id: string
    label: string
    icon?: string
    route?: string
    action?: () => void
  }[]
  
  // === 动态徽章 ===
  getBadge?: () => number
}
```

## 图标类型

### Font（FontAwesome）
```typescript
icon: {
  type: 'font',
  value: 'fas fa-users',
  background: '#5C6BC0',
  color: '#FFFFFF'
}
```

### Emoji
```typescript
icon: {
  type: 'emoji',
  value: '📱',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
}
```

### URL（外部图片）
```typescript
icon: {
  type: 'url',
  value: 'https://example.com/icon.png',
  background: '#FFFFFF'
}
```

### Component（Vue组件）
```typescript
import IconMyApp from '@/components/icons/IconMyApp.vue'

icon: {
  type: 'component',
  value: IconMyApp,
  background: '#E6162D'
}
```

## 分类说明

| 分类 | 值 | 说明 |
| ------ | ----- | ------ |
| 社交 | `social` | 微博、聊天等 |
| 工具 | `tool` / `tools` | 实用工具 |
| 娱乐 | `entertainment` | 直播、游戏等 |
| 效率 | `productivity` | 提示词、笔记等 |
| 系统 | `system` | 设置、账号管理等 |
| 生活 | `lifestyle` | 生活服务 |
| 其他 | `other` | 未分类 |

## 注意事项

1. **桌面布局缓存**：用户的桌面布局会保存到 localStorage。新注册的 App 会自动添加到已有布局中。

2. **override 选项**：使用 `{ override: true }` 确保覆盖已存在的配置。

3. **顺序依赖**：需要在 `registerBuiltinApps()` 之后注册，确保基础服务已初始化。

4. **响应式徽章**：使用 `getBadge` 返回动态数值（如未读消息数）。

## 迁移旧代码

如果你之前使用的是分散的注册方式：

```typescript
// 旧方式（分散在多个地方）
iconService.register({ ... })
// + HomeApp.vue 的 defaultPageItems
// + HomeApp.vue 的 requiredApps
// + builtinApps.ts

// 新方式（统一）
registerApp({ ... })
```

## 调试

```typescript
import { appRegistry } from '@/services/appRegistryService'

// 查看所有已注册的 App
console.log(appRegistry.getAll())

// 检查特定 App
console.log(appRegistry.get('my-app'))

// 按分类查询
console.log(appRegistry.getByCategory('tool'))
```
