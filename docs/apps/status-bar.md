# Status Bar App - 状态栏应用

> 状态栏是一个特殊的 App，类似于 HomeApp（桌面）的设计理念。它不参与路由系统，而是作为系统级 UI 组件常驻显示在屏幕顶部。

## 目录结构

```
src/apps/status-bar/
├── StatusBarApp.vue          # 主状态栏组件
├── index.ts                  # 统一导出入口
└── panels/                   # 下拉面板组件
    ├── NotificationCenter.vue # 通知中心面板
    ├── ControlCenter.vue      # 控制中心面板
    └── index.ts              # 面板导出

src/components/common/
├── NotificationIcon.vue      # 通知图标组件（支持多种类型）
├── NotificationToast.vue     # Toast 通知横幅组件
└── DeviceModeSwitch.vue      # 设备模式三阶切换组件

src/stores/
└── notificationStore.ts      # 通知状态管理（View Model）

src/services/
└── notification/             # 通知服务（核心逻辑）
    └── notificationService.ts

src/types/
└── notification.ts           # 通知类型定义
```

## 设计理念

### 状态栏即 App

与 HomeApp（桌面）的设计类似，状态栏虽然不参与路由系统，但采用 App 的架构模式来组织代码。这样做的好处：

1. **架构一致性**：所有系统组件都遵循相同的目录结构和命名规范
2. **易于维护**：相关组件集中管理，便于查找和修改
3. **可扩展性**：未来可以轻松添加新的面板或功能

## 通知系统

### 通知图标类型

通知图标支持三种类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `fontawesome` | FontAwesome 图标类名 | `fas fa-bell`、`fab fa-weixin` |
| `svg` | SVG 字符串或文件路径 | `<svg>...</svg>` 或 `/icons/app.svg` |
| `image` | 图片 URL 或 base64 | `https://...` 或 `data:image/png;base64,...` |

### 使用示例

```typescript
import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()

// 创建通知
notificationStore.createNotification({
  appId: 'wechat',
  appName: '微信',
  appIcon: {
    type: 'fontawesome',
    value: 'fab fa-weixin',
    backgroundColor: '#07C160',
  },
  title: '小明',
  body: '在吗？想问你一个问题',
  category: 'message',
  priority: 'normal',
  route: '/chat/wechat-xiaoming', // 点击跳转
})
```

### NotificationIcon 组件

通用通知图标组件，支持多种尺寸和样式。

**Props：**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| icon | `NotificationIcon` | - | 图标配置 |
| size | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 尺寸 |
| rounded | `boolean` | `true` | 是否圆形 |
| showBackground | `boolean` | `true` | 是否显示背景 |

**使用示例：**

```vue
<NotificationIcon
  :icon="{
    type: 'fontawesome',
    value: 'fab fa-weixin',
    backgroundColor: '#07C160',
    color: '#fff'
  }"
  size="lg"
/>
```

### NotificationToast 组件

Toast 通知横幅，自动从 `notificationStore.activeToast` 读取数据。

**特性：**

- 自动滑入/滑出动画
- 支持点击跳转
- 支持手动关闭
- 支持快捷操作按钮
- 自动适配 iOS/Android 风格

## 控制中心

### 设备模式切换

控制中心包含一个三阶设备模式切换组件 (DeviceModeSwitch)，可快速在以下模式间切换：

| 模式 | 图标 | 说明 |
|------|------|------|
| phone | `fa-mobile-alt` | 手机模式 |
| tablet | `fa-tablet-alt` | 平板模式 |
| desktop | `fa-desktop` | 桌面模式 |

**使用示例：**

```vue
<script setup>
import DeviceModeSwitch from '@/components/common/DeviceModeSwitch.vue'
</script>

<template>
  <DeviceModeSwitch />
</template>
```

组件会自动读取和更新 `deviceStore.mode`。

### 控制中心功能

**支持的开关：**

| 开关 | 功能 | 互斥关系 |
|------|------|----------|
| wifi | Wi-Fi | 飞行模式下禁用 |
| bluetooth | 蓝牙 | - |
| cellular | 蜂窝数据 | 飞行模式下禁用 |
| airplane | 飞行模式 | 关闭 WiFi、蜂窝、热点 |
| flashlight | 手电筒 | - |
| doNotDisturb | 勿扰模式 | - |
| rotation | 自动旋转 | - |
| hotspot | 个人热点 | 飞行模式下禁用 |
| location | 定位 | - |

## 状态管理

### notificationStore

通知系统的核心状态管理。

```typescript
interface NotificationStore {
  // 状态
  notifications: Notification[]        // 所有通知
  activeToast: Notification | null     // 当前显示的 Toast
  doNotDisturb: boolean                // 勿扰模式
  mutedApps: string[]                  // 静音的应用
  statusBarIcons: StatusBarNotificationIcon[] // 状态栏图标
  
  // 计算属性
  unreadCount: number                  // 未读数量
  hasUnread: boolean                   // 是否有未读
  sortedNotifications: Notification[]  // 按时间排序的通知
  groupedNotifications: NotificationGroup[] // 按应用分组
  
  // 操作
  createNotification(params)           // 创建通知
  dismissToast()                       // 关闭 Toast
  markAsRead(id)                       // 标记已读
  markAllAsRead()                      // 全部已读
  removeNotification(id)               // 删除通知
  clearAll()                           // 清除所有
  toggleDoNotDisturb()                 // 切换勿扰
  muteApp(appId)                       // 静音应用
  unmuteApp(appId)                     // 取消静音
}
```

### uiStore 状态

下拉面板相关状态由 `uiStore` 管理：

```typescript
interface UIState {
  pullDownPanel: 'none' | 'notification' | 'control'
  pullDownProgress: number
  isPullingDown: boolean
  
  isNotificationCenterOpen: boolean
  isControlCenterOpen: boolean
  hasPullDownPanelOpen: boolean
}

uiStore.openPullDownPanel('notification' | 'control')
uiStore.closePullDownPanel()
uiStore.startPulling('notification' | 'control')
uiStore.setPullDownProgress(progress: number)
uiStore.endPulling()
```

## 手势交互

### 下拉触发

| 触发位置 | iOS 风格 | Android 风格 |
|----------|----------|--------------|
| 左半边 | 通知中心 | 通知中心 |
| 右半边 | 控制中心 | 通知中心 |

### 面板内手势

| 手势 | 效果 |
|------|------|
| 向上滑动 | 关闭当前面板 |
| 向左 切换到控制中心（仅通知中心） |
| 向右滑动 | 切换到通知中心（仅控制中心） |
| 点击底部指示条 | 关闭面板 |

## 集成方式

在 `PhoneContainer.vue` 中集成：

```vue
<script setup>
import { StatusBarApp, NotificationCenter, ControlCenter } from '@/apps/status-bar'
import NotificationToast from '@/components/common/NotificationToast.vue'
</script>

<template>
  <div class="phone-frame">
    <StatusBarApp
      @mousedown="onStatusBarMouseDown"
      @touchstart="onStatusBarTouchStart"
      @touchmove="onStatusBarTouchMove"
      @touchend="onStatusBarTouchEnd"
    />
    
    <!-- Toast 通知 -->
    <NotificationToast />
    
    <ViewsContainer />
    
    <Transition name="pull-down">
      <NotificationCenter v-if="uiStore.isNotificationCenterOpen" />
    </Transition>
    
    <Transition name="pull-down">
      <ControlCenter v-if="uiStore.isControlCenterOpen" />
    </Transition>
  </div>
</template>
```

## 样式定制

### 主题适配

通过 `useTheme()` composable 获取当前主题，自动适配不同风格：

```typescript
const { currentTheme } = useTheme()

const isIOSStyle = computed(() => {
  return currentTheme.value.id === 'ios' || currentTheme.value.id === 'dark'
})

const isAndroidStyle = computed(() => {
  return currentTheme.value.id === 'android'
})
```

## 扩展指南

### 添加新的快捷开关

1. 在 `ControlCenter.vue` 的 `toggles` 中添加新开关状态
2. 在 `getToggleIcon` 函数中添加新开关的图标配置
3. 在 `getToggleName` 函数中添加新开关的显示名称

### 添加新的面板

1. 在 `panels/` 目录创建新面板组件
2. 在 `panels/index.ts` 中导出
3. 在 `uiStore` 中添加相应状态
4. 在 `PhoneContainer.vue` 中集成

### 自定义通知行为

```typescript
// 创建带有自定义操作的通知
notificationStore.createNotification({
  appId: 'myapp',
  appName: '我的应用',
  appIcon: { type: 'image', value: '/icons/myapp.png' },
  title: '新消息',
  body: '您有一条新消息',
  actions: [
    { id: 'reply', label: '回复', icon: 'fas fa-reply' },
    { id: 'dismiss', label: '忽略', destructive: true },
  ],
  autoDismiss: 8000, // 8秒后自动消失
  sound: true,
  vibrate: true,
})
```

## 参考

- [架构概览](../架构概览.md) - 整体架构设计
- [Home App](./home.md) - 桌面即 App 的设计理念
- [Settings App](./settings.md) - 设备模式详细配置
- [UI Store](../状态管理.md#uistore) - UI 状态管理
