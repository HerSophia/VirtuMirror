# 图标服务 - 集成示例

本文档提供图标服务的完整集成示例。

## 1. 内置应用注册

### 1.1 集中注册模式

在应用启动时集中注册所有内置应用的图标。

```typescript
// src/services/builtinApps.ts

import { iconService } from '@/services/icon'
import type { RegisteredAppIcon } from '@/types/icon'

// 定义内置应用配置
const builtinApps: RegisteredAppIcon[] = [
  {
    id: 'wechat',
    name: '微信',
    route: '/wechat',
    iconId: 'wechat',
    category: 'social',
    isBuiltin: true,
    getBadge: () => useWechatStore().unreadCount
  },
  {
    id: 'weibo',
    name: '微博',
    route: '/weibo',
    icon: { type: 'component', value: WeiboLogo, background: '#FF5722' },
    category: 'social',
    isBuiltin: true,
    quickActions: [
      { id: 'compose', label: '发微博', icon: 'fas fa-pen', route: '/weibo/compose' },
      { id: 'search', label: '搜索', icon: 'fas fa-search', route: '/weibo/search' }
    ]
  },
  {
    id: 'email',
    name: '邮件',
    route: '/email',
    iconId: 'mail',
    category: 'productivity',
    isBuiltin: true,
    getBadge: () => useEmailStore().unreadCount
  },
  {
    id: 'settings',
    name: '设置',
    route: '/settings',
    iconId: 'settings',
    category: 'system',
    isBuiltin: true
  },
  // ... 更多应用
]

/**
 * 注册所有内置应用
 */
export function registerBuiltinApps() {
  iconService.registerAll(builtinApps)
  console.log(`[BuiltinApps] 已注册 ${builtinApps.length} 个内置应用`)
}
```

### 1.2 应用入口调用

```typescript
// src/main.ts

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { registerBuiltinApps } from './services/builtinApps'
import { useIconStore } from './stores/iconStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 触发 IconStore 初始化（会自动注入状态到 IconService）
useIconStore()

// 注册内置应用
registerBuiltinApps()

app.mount('#app')
```

---

## 2. 单个应用自注册

### 2.1 应用入口注册

每个应用在其入口文件中自行注册图标。

```typescript
// src/apps/weibo/index.ts

import { iconService } from '@/services/icon'
import WeiboLogo from './components/WeiboLogo.vue'
import { useWeiboStore } from './stores/weiboStore'

// 应用图标配置
export const weiboIconConfig = {
  id: 'weibo',
  name: '微博',
  route: '/weibo',
  icon: {
    type: 'component' as const,
    value: WeiboLogo,
    background: 'linear-gradient(135deg, #FF5722, #FF9800)'
  },
  category: 'social' as const,
  isBuiltin: true,
  getBadge: () => {
    const store = useWeiboStore()
    return store.unreadNotifications + store.unreadMessages
  },
  quickActions: [
    {
      id: 'compose',
      label: '发微博',
      icon: 'fas fa-pen',
      route: '/weibo/compose'
    },
    {
      id: 'hot',
      label: '热搜榜',
      icon: 'fas fa-fire',
      route: '/weibo/hot'
    }
  ]
}

// 注册图标
export function registerWeiboApp() {
  iconService.register(weiboIconConfig)
}
```

### 2.2 路由守卫注册

```typescript
// src/router/index.ts

import { createRouter, createWebHistory } from 'vue-router'
import { registerWeiboApp } from '@/apps/weibo'
import { registerEmailApp } from '@/apps/email'
// ...

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/weibo',
      component: () => import('@/apps/weibo/WeiboApp.vue'),
      beforeEnter: () => {
        // 确保应用图标已注册
        registerWeiboApp()
      }
    },
    // ...
  ]
})

// 或者在全局守卫中批量注册
router.beforeEach((to) => {
  // 首次访问时注册所有应用
  if (!registered) {
    registerWeiboApp()
    registerEmailApp()
    // ...
    registered = true
  }
})
```

---

## 3. 桌面集成

### 3.1 Home App 桌面

```vue
<!-- src/apps/home/HomeApp.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIconStore } from '@/stores/iconStore'
import AppIcon from '@/components/common/AppIcon.vue'

const router = useRouter()
const iconStore = useIconStore()

// 获取所有已注册的应用
const apps = computed(() => iconStore.allIcons)

// 点击应用
function handleAppClick(app: RegisteredAppIcon) {
  router.push(app.route)
}

// 长按应用（显示快捷操作）
function handleAppLongPress(app: RegisteredAppIcon, event: Event) {
  if (app.quickActions?.length) {
    showQuickActionMenu(app, event)
  }
}

function showQuickActionMenu(app: RegisteredAppIcon, event: Event) {
  // 显示快捷操作菜单...
}
</script>

<template>
  <div class="desktop">
    <div class="app-grid">
      <div
        v-for="app in apps"
        :key="app.id"
        class="app-item"
        @click="handleAppClick(app)"
        @contextmenu.prevent="handleAppLongPress(app, $event)"
      >
        <AppIcon
          :app-id="app.iconId || app.id"
          :icon="app.icon"
          :badge="app.getBadge?.()"
          size="md"
        />
        <span class="app-name">{{ app.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.desktop {
  min-height: 100vh;
  padding: 20px;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.app-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.app-name {
  font-size: 12px;
  color: #333;
  text-align: center;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

### 3.2 一键整理功能

```typescript
// src/apps/home/composables/useDesktopOrganize.ts

import { useIconStore } from '@/stores/iconStore'
import type { RegisteredAppIcon, AppCategory } from '@/types/icon'

// 分类顺序
const CATEGORY_ORDER: AppCategory[] = [
  'social',
  'entertainment',
  'productivity',
  'tool',
  'lifestyle',
  'games',
  'system',
  'other'
]

// 分类名称映射
const CATEGORY_NAMES: Record<AppCategory, string> = {
  social: '社交',
  entertainment: '娱乐',
  productivity: '效率',
  tool: '工具',
  tools: '工具',
  lifestyle: '生活',
  games: '游戏',
  system: '系统',
  other: '其他'
}

export function useDesktopOrganize() {
  const iconStore = useIconStore()

  /**
   * 按分类整理应用
   */
  function organizeByCategory(): Map<AppCategory, RegisteredAppIcon[]> {
    const grouped = new Map<AppCategory, RegisteredAppIcon[]>()
    
    // 初始化分类
    CATEGORY_ORDER.forEach(cat => grouped.set(cat, []))
    
    // 分组
    iconStore.allIcons.forEach(icon => {
      const category = icon.category || 'other'
      const list = grouped.get(category) || grouped.get('other')!
      list.push(icon)
    })
    
    return grouped
  }

  /**
   * 获取排序后的应用列表
   */
  function getSortedApps(): RegisteredAppIcon[] {
    const grouped = organizeByCategory()
    const result: RegisteredAppIcon[] = []
    
    CATEGORY_ORDER.forEach(category => {
      const apps = grouped.get(category) || []
      result.push(...apps)
    })
    
    return result
  }

  /**
   * 创建分类文件夹
   */
  function createCategoryFolders(): Array<{
    name: string
    category: AppCategory
    apps: RegisteredAppIcon[]
  }> {
    const grouped = organizeByCategory()
    const folders: Array<{
      name: string
      category: AppCategory
      apps: RegisteredAppIcon[]
    }> = []
    
    grouped.forEach((apps, category) => {
      if (apps.length > 0) {
        folders.push({
          name: CATEGORY_NAMES[category],
          category,
          apps
        })
      }
    })
    
    return folders
  }

  return {
    organizeByCategory,
    getSortedApps,
    createCategoryFolders,
    categoryNames: CATEGORY_NAMES
  }
}
```

---

## 4. 通知系统集成

### 4.1 通知列表

```vue
<!-- src/apps/notification-center/NotificationList.vue -->

<script setup lang="ts">
import { useNotificationStore } from '@/stores/notificationStore'
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue'

const notificationStore = useNotificationStore()
</script>

<template>
  <div class="notification-list">
    <div
      v-for="notification in notificationStore.notifications"
      :key="notification.id"
      class="notification-item"
    >
      <!-- 使用 DynamicAppIcon 显示通知图标 -->
      <DynamicAppIcon
        :app-id="notification.appId"
        :icon="notification.icon"
        size="sm"
        :rounded="true"
      />
      
      <div class="notification-content">
        <div class="notification-header">
          <span class="app-name">{{ notification.appName }}</span>
          <span class="time">{{ formatTime(notification.timestamp) }}</span>
        </div>
        <div class="notification-title">{{ notification.title }}</div>
        <div class="notification-body">{{ notification.body }}</div>
      </div>
    </div>
  </div>
</template>
```

### 4.2 通知发送时使用

```typescript
// 发送通知时，可以指定 appId 或自定义 icon

import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()

// 方式 1：使用 appId（自动从 iconStore 获取图标）
notificationStore.push({
  appId: 'wechat',
  title: '新消息',
  body: '你有一条新消息'
})

// 方式 2：自定义图标
notificationStore.push({
  appId: 'system',
  title: '系统通知',
  body: '设置已更新',
  icon: {
    type: 'fontawesome',
    value: 'fas fa-cog',
    backgroundColor: '#8E8E93'
  }
})

// 方式 3：Emoji 图标
notificationStore.push({
  appId: 'reminder',
  title: '提醒',
  body: '该喝水了',
  icon: {
    type: 'emoji',
    value: '💧'
  }
})
```

---

## 5. 第三方应用注册

### 5.1 App Store 安装应用

```typescript
// src/apps/app-store/services/installService.ts

import { iconService } from '@/services/icon'
import type { AppPackage } from '@/types/appPackage'

/**
 * 安装应用包
 */
export async function installApp(pkg: AppPackage) {
  // 1. 验证应用包
  validatePackage(pkg)
  
  // 2. 注册图标
  iconService.register({
    id: pkg.id,
    name: pkg.name,
    route: pkg.route || `/apps/${pkg.id}`,
    icon: pkg.icon,
    category: pkg.category || 'other',
    isBuiltin: false,
    quickActions: pkg.quickActions
  })
  
  // 3. 安装应用资源
  await installResources(pkg)
  
  console.log(`[AppStore] 已安装应用: ${pkg.name}`)
}

/**
 * 卸载应用
 */
export function uninstallApp(appId: string) {
  // 1. 取消图标注册
  iconService.unregister(appId)
  
  // 2. 清理应用资源
  cleanupResources(appId)
  
  console.log(`[AppStore] 已卸载应用: ${appId}`)
}
```

### 5.2 动态加载应用

```typescript
// src/apps/app-store/services/dynamicAppLoader.ts

import { iconService } from '@/services/icon'

/**
 * 从远程加载应用配置
 */
export async function loadRemoteApp(appUrl: string) {
  const response = await fetch(appUrl)
  const manifest = await response.json()
  
  // 注册图标
  iconService.register({
    id: manifest.id,
    name: manifest.name,
    route: `/dynamic/${manifest.id}`,
    icon: manifest.icon,
    category: manifest.category,
    isBuiltin: false
  })
  
  // 加载应用组件
  const component = await import(/* @vite-ignore */ manifest.entry)
  
  return {
    manifest,
    component: component.default
  }
}
```

---

## 6. 兼容旧代码

### 6.1 使用 Legacy Facade

如果项目中有使用旧 API 的代码，可以通过 Facade 保持兼容：

```typescript
// 旧代码（仍然可用）
import { getIconRegistryService } from '@/services/iconRegistryService'

const iconRegistry = getIconRegistryService()

// 注册
iconRegistry.register({ ... })

// 获取
const icon = iconRegistry.get('my-app')

// 获取所有
const allIcons = iconRegistry.getAll()

// 获取内置应用
const builtins = iconRegistry.getBuiltinApps()

// 响应式访问
const iconList = iconRegistry.iconList // ComputedRef<RegisteredAppIcon[]>
```

### 6.2 迁移建议

```typescript
// 旧代码
import { getIconRegistryService } from '@/services/iconRegistryService'
const iconRegistry = getIconRegistryService()
iconRegistry.register({ ... })

// 新代码（推荐）
import { iconService } from '@/services/icon'
iconService.register({ ... })

// 在 Vue 组件中
import { useIconStore } from '@/stores/iconStore'
const iconStore = useIconStore()
const icons = computed(() => iconStore.allIcons)
```

---

## 7. 测试示例

### 7.1 Service 测试

```typescript
// tests/services/iconService.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useIconStore } from '@/stores/iconStore'
import { iconService } from '@/services/icon'

describe('IconService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useIconStore() // 触发初始化
    iconService.clear() // 清理之前的注册
  })

  it('应该成功注册图标', () => {
    const result = iconService.register({
      id: 'test-app',
      name: 'Test App',
      route: '/test'
    })
    
    expect(result).toBe(true)
    expect(iconService.has('test-app')).toBe(true)
  })

  it('应该阻止重复注册', () => {
    iconService.register({ id: 'app', name: 'App 1', route: '/1' })
    const result = iconService.register({ id: 'app', name: 'App 2', route: '/2' })
    
    expect(result).toBe(false)
    expect(iconService.get('app')?.name).toBe('App 1')
  })

  it('应该允许覆盖注册', () => {
    iconService.register({ id: 'app', name: 'App 1', route: '/1' })
    iconService.register({ id: 'app', name: 'App 2', route: '/2' }, { override: true })
    
    expect(iconService.get('app')?.name).toBe('App 2')
  })

  it('应该成功取消注册', () => {
    iconService.register({ id: 'app', name: 'App', route: '/' })
    const result = iconService.unregister('app')
    
    expect(result).toBe(true)
    expect(iconService.has('app')).toBe(false)
  })
})
```

### 7.2 Store 测试

```typescript
// tests/stores/iconStore.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useIconStore } from '@/stores/iconStore'
import { iconService } from '@/services/icon'

describe('IconStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('应该返回所有图标', () => {
    const store = useIconStore()
    
    iconService.register({ id: 'app1', name: 'App 1', route: '/1' })
    iconService.register({ id: 'app2', name: 'App 2', route: '/2' })
    
    expect(store.allIcons.length).toBe(2)
  })

  it('应该按分类筛选', () => {
    const store = useIconStore()
    
    iconService.register({ id: 'social1', name: 'Social 1', route: '/s1', category: 'social' })
    iconService.register({ id: 'tool1', name: 'Tool 1', route: '/t1', category: 'tool' })
    iconService.register({ id: 'social2', name: 'Social 2', route: '/s2', category: 'social' })
    
    const socialApps = store.getByCategory('social')
    expect(socialApps.length).toBe(2)
  })

  it('应该返回内置应用', () => {
    const store = useIconStore()
    
    iconService.register({ id: 'builtin', name: 'Builtin', route: '/b', isBuiltin: true })
    iconService.register({ id: 'thirdparty', name: 'Third', route: '/t', isBuiltin: false })
    
    expect(store.builtinApps.length).toBe(1)
    expect(store.builtinApps[0].id).toBe('builtin')
  })
})
```

---

## 8. 调试技巧

### 8.1 查看注册状态

```typescript
// 在控制台中调试
import { iconService } from '@/services/icon'

console.log('已注册图标:', iconService.getAll())
console.log('图标数量:', iconService.getAll().length)
console.log('是否注册:', iconService.has('wechat'))
console.log('获取单个:', iconService.get('wechat'))
```

### 8.2 监听变化

```typescript
const unsubscribe = iconService.subscribe(() => {
  console.log('图标配置已变化', iconService.getAll())
})

// 完成后取消订阅
unsubscribe()
```

### 8.3 Vue DevTools

在 Vue DevTools 中可以直接查看 Pinia Store 状态：

1. 打开 Vue DevTools
2. 切换到 Pinia 标签页
3. 找到 `icon` Store
4. 查看 `icons` Map 的内容
