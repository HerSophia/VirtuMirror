# App 注册服务 (AppRegistryService)

> 统一的 App 注册服务，解决图标注册与桌面布局的分散问题

## 概述

`AppRegistryService` 提供一站式的 App 注册能力，同时处理：
- 图标注册（通过 IconService）
- 桌面布局（自动添加到桌面）
- 分类管理
- 快捷操作配置

**源文件**：`src/services/icon/appRegistryService.ts`

## 设计目的

之前的问题：
```typescript
// ❌ 分散的注册逻辑
iconService.register({ id: 'my-app', ... })  // 注册图标
desktopStore.addItem({ id: 'my-app', ... })   // 手动添加桌面
```

现在的方案：
```typescript
// ✅ 统一注册
appRegistry.register({
  id: 'my-app',
  name: '我的应用',
  route: '/my-app',
  category: 'tool',
  icon: { type: 'emoji', value: '🚀', background: '#000' },
  desktop: { show: true }  // 自动添加到桌面
})
```

## 接口定义

### AppRegistration

```typescript
interface AppRegistration {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 路由路径 */
  route: string
  /** 分类 */
  category: AppCategory
  /** 是否内置应用 */
  isBuiltin?: boolean
  
  // === 图标配置 ===
  /** 图标ID（默认与id相同） */
  iconId?: string
  /** 图标配置 */
  icon?: AppIconConfig
  
  // === 桌面配置 ===
  desktop?: {
    /** 是否显示在桌面（默认true） */
    show?: boolean
    /** 添加位置：auto=自动找空位, first=第一页开头, last=最后 */
    position?: 'auto' | 'first' | 'last'
    /** 指定添加到哪一页（0-based，默认自动） */
    page?: number
  }
  
  // === 快捷操作 ===
  quickActions?: QuickActionConfig[]
  
  // === 动态徽章 ===
  getBadge?: () => number
}
```

## API 参考

### register()

注册单个 App：

```typescript
appRegistry.register({
  id: 'notes',
  name: '备忘录',
  route: '/notes',
  category: 'productivity',
  icon: { type: 'emoji', value: '📝', background: '#FFE082' },
  desktop: { show: true, position: 'auto' },
  quickActions: [
    { id: 'new', label: '新建笔记', icon: 'fas fa-plus', route: '/notes/new' }
  ]
})
```

### registerAll()

批量注册 App：

```typescript
appRegistry.registerAll([
  { id: 'notes', name: '备忘录', ... },
  { id: 'calc', name: '计算器', ... },
])
```

### 查询方法

```typescript
// 获取所有已注册的 App
const allApps = appRegistry.getAll()

// 获取特定 App
const app = appRegistry.get('notes')

// 检查是否已注册
if (appRegistry.has('notes')) { ... }

// 按分类获取
const toolApps = appRegistry.getByCategory('tool')

// 获取桌面 App 列表
const desktopApps = appRegistry.getDesktopApps()
```

### 桌面队列处理

```typescript
// 处理待添加到桌面的 App（由 HomeApp 调用）
appRegistry.processPendingDesktopApps()

// 获取待处理列表
const pending = appRegistry.getPendingDesktopApps()

// 设置桌面更新回调
appRegistry.setDesktopUpdateCallback((apps) => {
  console.log('新增桌面 App:', apps)
})
```

## 桌面布局逻辑

### 添加位置策略

| 位置 | 说明 |
| ---- | ---- |
| `auto` | 自动找第一个有空位的页面（默认） |
| `first` | 添加到第一页开头 |
| `last` | 添加到最后一页末尾 |

### 处理流程

```
appRegistry.register(config)
       │
       ├── 1. 注册图标到 IconService
       │
       ├── 2. 检查是否需要添加到桌面
       │       │
       │       ├── desktop.show === false → 跳过
       │       │
       │       └── desktop.show !== false → 继续
       │               │
       │               ├── 布局已初始化 → 直接添加
       │               │
       │               └── 布局未初始化 → 加入待处理队列
       │
       └── 3. 完成
```

## 使用示例

### 内置应用注册

```typescript
// src/services/builtinApps.ts
import { appRegistry } from '@/services/icon'

export function registerBuiltinApps() {
  appRegistry.registerAll([
    {
      id: 'wechat',
      name: '微信',
      route: '/chat',
      category: 'social',
      icon: { type: 'font', value: 'fab fa-weixin', background: '#07C160' },
      isBuiltin: true,
    },
    {
      id: 'settings',
      name: '设置',
      route: '/settings',
      category: 'system',
      icon: { type: 'font', value: 'fas fa-cog', background: '#8E8E93' },
      isBuiltin: true,
    },
  ])
}
```

### 动态应用注册

```typescript
// src/apps/my-app/manifest.ts
import { registerApp } from '@/services/icon'

export function registerMyApp() {
  registerApp({
    id: 'my-app',
    name: '我的应用',
    route: '/my-app',
    category: 'tool',
    icon: { type: 'emoji', value: '🎮', background: '#9C27B0' },
    desktop: {
      show: true,
      position: 'last',
    },
    quickActions: [
      { id: 'play', label: '开始游戏', icon: 'fas fa-play', route: '/my-app/play' },
    ],
    getBadge: () => newGamesCount.value,
  })
}
```

## 导出

从 `@/services/icon` 统一导出：

```typescript
import { 
  appRegistry,        // 服务实例
  registerApp,        // 便捷函数
  registerApps,       // 批量注册
  type AppRegistration 
} from '@/services/icon'
```

也可以从 `@/services` 导入：

```typescript
import { appRegistry, registerApp } from '@/services'
```

## 相关文档

- [IconService API](./service-api.md)
- [App 注册指南](../../dev/app-registration-guide.md)
- [Home App](../../apps/home.md)
