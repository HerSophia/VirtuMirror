# 通知服务设置集成

> 本文档说明通知服务如何与系统设置应用集成。

## 1. 概述

通知服务遵循 [设置平台架构](../../dev/settings-platform-design.md)，将通知设置界面注册到系统设置应用中，让用户能够统一管理通知偏好。

## 2. 设置入口

### 2.1 注册位置

- **路径**: `/settings/notifications`
- **组件**: `src/apps/settings/pages/NotificationSettings.vue`
- **注册文件**: `src/apps/settings/services/builtin.ts`

### 2.2 设置分类

通知设置在系统设置中的位置：

```text
设置
├── 通用
├── 显示与亮度
├── 声音与触感
├── 🔔 通知              ← 通知设置入口
│   ├── 全局控制
│   ├── 通知样式
│   └── 应用通知管理
├── 隐私
└── ...
```

## 3. 功能模块

### 3.1 全局控制

| 设置项 | 类型 | 说明 |
| -------- | ------ | ------ |
| 允许通知 | 开关 | 总开关，关闭后所有应用不推送 |
| 勿扰模式 | 开关 | 开启后不显示 Toast，不播放声音 |
| 勿扰时间段 | 时间范围 | 自动勿扰的时间段（规划中） |

### 3.2 通知样式

| 设置项 | 类型 | 说明 |
| -------- | ------ | ------ |
| 锁屏显示 | 选择 | 始终显示/解锁显示/不显示（UI 模拟） |
| 屏幕共享时隐藏 | 开关 | 屏幕共享时隐藏通知内容（UI 模拟） |
| 横幅样式 | 选择 | 临时/持续 |
| 显示预览 | 选择 | 始终/解锁时/从不 |

### 3.3 应用通知管理

列出所有已安装的应用，支持逐个管理：

| 设置项 | 类型 | 说明 |
| -------- | ------ | ------ |
| 允许通知 | 开关 | 应用级通知开关 |
| 静音 | 开关 | 应用静音（不播放声音） |
| 角标 | 开关 | 是否显示应用图标角标 |
| 显示预览 | 选择 | 覆盖全局设置 |

## 4. 实现示例

### 4.1 设置页面组件

```vue
<!-- src/apps/settings/pages/NotificationSettings.vue -->
<template>
  <SettingsPage title="通知">
    <!-- 全局控制 -->
    <SettingsSection title="全局控制">
      <SettingsToggle
        label="允许通知"
        v-model="allowNotifications"
      />
      <SettingsToggle
        label="勿扰模式"
        :disabled="!allowNotifications"
        v-model="notificationStore.doNotDisturb"
        @update:model-value="handleDndChange"
      />
    </SettingsSection>
    
    <!-- 通知样式 -->
    <SettingsSection title="通知样式">
      <SettingsSelect
        label="锁屏显示"
        v-model="lockScreenStyle"
        :options="[
          { value: 'always', label: '始终' },
          { value: 'unlocked', label: '解锁时' },
          { value: 'never', label: '从不' }
        ]"
      />
      <SettingsSelect
        label="横幅样式"
        v-model="bannerStyle"
        :options="[
          { value: 'temporary', label: '临时' },
          { value: 'persistent', label: '持续' }
        ]"
      />
    </SettingsSection>
    
    <!-- 应用列表 -->
    <SettingsSection title="应用通知">
      <div
        v-for="app in installedApps"
        :key="app.id"
        class="app-notification-item"
        @click="openAppSettings(app.id)"
      >
        <AppIcon :icon="app.icon" />
        <span class="app-name">{{ app.name }}</span>
        <span class="app-status">
          {{ getAppNotificationStatus(app.id) }}
        </span>
        <ChevronRight />
      </div>
    </SettingsSection>
  </SettingsPage>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAppStoreStore } from '@/stores/appStoreStore'

const notificationStore = useNotificationStore()
const appStore = useAppStoreStore()

// 全局通知开关
const allowNotifications = ref(true)

// 样式设置
const lockScreenStyle = ref('always')
const bannerStyle = ref('temporary')

// 已安装应用列表
const installedApps = computed(() => appStore.installedApps)

// 获取应用通知状态文本
function getAppNotificationStatus(appId: string): string {
  if (notificationStore.mutedApps.includes(appId)) {
    return '已静音'
  }
  return '允许'
}

// 处理勿扰模式变更
function handleDndChange(value: boolean) {
  notificationStore.setDoNotDisturb(value)
}

// 打开应用通知设置
function openAppSettings(appId: string) {
  // 导航到应用专属通知设置页面
}
</script>
```

### 4.2 应用专属设置页面

```vue
<!-- src/apps/settings/pages/AppNotificationSettings.vue -->
<template>
  <SettingsPage :title="`${app?.name} 通知`">
    <SettingsSection>
      <SettingsToggle
        label="允许通知"
        v-model="allowNotifications"
      />
      
      <SettingsToggle
        label="静音"
        :disabled="!allowNotifications"
        v-model="isMuted"
        @update:model-value="handleMuteChange"
      />
      
      <SettingsToggle
        label="显示角标"
        :disabled="!allowNotifications"
        v-model="showBadge"
      />
    </SettingsSection>
    
    <!-- 通知历史 -->
    <SettingsSection title="最近通知">
      <div
        v-for="notification in appNotifications"
        :key="notification.id"
        class="notification-history-item"
      >
        <span class="title">{{ notification.title }}</span>
        <span class="body">{{ notification.body }}</span>
        <span class="time">
          {{ notificationStore.formatNotificationTime(notification.timestamp) }}
        </span>
      </div>
      
      <div v-if="appNotifications.length === 0" class="empty">
        暂无通知
      </div>
    </SettingsSection>
  </SettingsPage>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAppStoreStore } from '@/stores/appStoreStore'

const route = useRoute()
const notificationStore = useNotificationStore()
const appStore = useAppStoreStore()

const appId = computed(() => route.params.appId as string)
const app = computed(() => appStore.getAppById(appId.value))

// 通知开关
const allowNotifications = ref(true)

// 静音状态
const isMuted = computed(() => 
  notificationStore.mutedApps.includes(appId.value)
)

// 角标开关
const showBadge = ref(true)

// 应用通知历史
const appNotifications = computed(() =>
  notificationStore.getAppNotifications(appId.value).slice(0, 10)
)

// 处理静音切换
function handleMuteChange(muted: boolean) {
  if (muted) {
    notificationStore.muteApp(appId.value)
  } else {
    notificationStore.unmuteApp(appId.value)
  }
}
</script>
```

### 4.3 设置入口注册

```typescript
// src/apps/settings/services/builtin.ts
import { defineSettingsEntry } from './settingsRegistry'

export const builtinSettings = [
  // ... 其他设置
  
  defineSettingsEntry({
    id: 'notifications',
    title: '通知',
    icon: { type: 'fontawesome', value: 'fas fa-bell' },
    path: '/settings/notifications',
    component: () => import('../pages/NotificationSettings.vue'),
    order: 40,  // 显示顺序
    keywords: ['通知', '推送', '消息', '勿扰', 'notification', 'push']
  }),
  
  // 应用通知详情页（动态路由）
  defineSettingsEntry({
    id: 'app-notifications',
    title: '应用通知',
    path: '/settings/notifications/:appId',
    component: () => import('../pages/AppNotificationSettings.vue'),
    hidden: true  // 不在主列表显示
  })
]
```

## 5. 状态同步

### 5.1 与 Store 的集成

设置页面直接使用 `useNotificationStore` 管理状态：

```typescript
import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()

// 读取状态
const isDnd = notificationStore.doNotDisturb
const mutedApps = notificationStore.mutedApps

// 修改状态
notificationStore.setDoNotDisturb(true)
notificationStore.muteApp('com.example.app')
notificationStore.unmuteApp('com.example.app')
```

### 5.2 持久化

以下设置项自动持久化到本地存储：

- `doNotDisturb` - 勿扰模式
- `mutedApps` - 静音应用列表
- `notifications` - 通知历史

## 6. 与其他设置的协作

### 6.1 声音设置

通知声音设置与「声音与触感」设置协作：

- 系统静音时，通知声音自动静音
- 可独立配置通知音量
- 支持自定义通知铃声（规划中）

### 6.2 隐私设置

通知预览设置与隐私相关：

- 锁屏时是否显示通知内容
- 敏感应用通知是否显示预览

## 7. 未来规划

### 7.1 勿扰时间段

```typescript
interface DndSchedule {
  enabled: boolean
  startTime: string  // "22:00"
  endTime: string    // "07:00"
  days: number[]     // [0,1,2,3,4,5,6] 周日-周六
}
```

### 7.2 通知分类管理

```typescript
// 按类别管理通知
interface CategorySettings {
  category: NotificationCategory
enabled: boolean
  sound: boolean
  banner: boolean
}
```

### 7.3 智能通知摘要

```typescript
// 定时汇总低优先级通知
interface NotificationSummary {
  enabled: boolean
  scheduleTime: string  // "09:00"
  categories: NotificationCategory[]
}
```

## 8. 最佳实践

### 8.1 尊重用户选择

```typescript
// ✅ 检查应用是否被静音
if (!notificationStore.mutedApps.includes(appId)) {
  notificationStore.createNotification({ ... })
}

// ❌ 忽略用户设置
notificationStore.createNotification({ ... })  // 不推荐
```

### 8.2 提供有意义的默认值

```typescript
// ✅ 新安装应用默认开启通知
const defaultSettings = {
  allowNotifications: true,
  sound: true,
  badge: true
}
```

### 8.3 优雅处理权限变更

```typescript
// 监听静音状态变化
watch(
  () => notificationStore.mutedApps,
  (mutedApps) => {
    if (mutedApps.includes(myAppId)) {
      // 应用被静音，更新 UI 状态
    }
  }
)
```
