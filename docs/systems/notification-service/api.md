# 通知服务 API 参考

> 本文档提供通知服务所有公开 API 的完整参考。

## 1. NotificationStore API

通过 Pinia Store 使用通知服务是推荐的方式：

```typescript
import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()
```

### 1.1 状态属性

#### notifications

所有通知的列表。

```typescript
notifications: Ref<Notification[]>
```

#### activeToast

当前正在显示的 Toast 通知。

```typescript
activeToast: Ref<Notification | null>
```

#### toastQueue

等待显示的 Toast 队列。

```typescript
toastQueue: Ref<Notification[]>
```

#### doNotDisturb

勿扰模式开关。

```typescript
doNotDisturb: Ref<boolean>
```

#### mutedApps

被静音的应用 ID 列表。

```typescript
mutedApps: Ref<string[]>
```

#### statusBarIcons

状态栏通知图标列表。

```typescript
statusBarIcons: Ref<StatusBarNotificationIcon[]>
```

### 1.2 计算属性

#### unreadCount

未读通知数量。

```typescript
unreadCount: ComputedRef<number>
```

**示例**：

```typescript
// 在模板中显示未读数
<span v-if="notificationStore.unreadCount > 0">
  {{ notificationStore.unreadCount }}
</span>
```

#### hasUnread

是否有未读通知。

```typescript
hasUnread: ComputedRef<boolean>
```

#### sortedNotifications

按时间降序排列的通知列表（最新在前）。

```typescript
sortedNotifications: ComputedRef<Notification[]>
```

#### groupedNotifications

按应用/分组聚合的通知列表。

```typescript
groupedNotifications: ComputedRef<NotificationGroup[]>
```

**分组规则**：

1. 优先使用 `notification.groupId` 分组
2. 如无 groupId，则使用 `notification.appId` 分组

#### highPriorityNotifications

高优先级和紧急通知列表。

```typescript
highPriorityNotifications: ComputedRef<Notification[]>
```

#### visibleStatusBarIcons

可见的状态栏图标（按优先级排序）。

```typescript
visibleStatusBarIcons: ComputedRef<StatusBarNotificationIcon[]>
```

### 1.3 操作方法

#### createNotification()

创建并推送一条新通知。

```typescript
function createNotification(params: CreateNotificationParams): Notification
```

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `appId` | `string` | ✅ | - | 应用唯一标识 |
| `appName` | `string` | ✅ | - | 应用显示名称 |
| `appIcon` | `NotificationIcon` | ✅ | - | 应用图标 |
| `title` | `string` | ✅ | - | 通知标题 |
| `body` | `string` | ✅ | - | 通知正文 |
| `subtitle` | `string` | - | - | 副标题 |
| `category` | `NotificationCategory` | - | `'app'` | 通知类别 |
| `priority` | `NotificationPriority` | - | `'normal'` | 优先级 |
| `groupId` | `string` | - | - | 分组 ID |
| `groupTitle` | `string` | - | - | 分组标题 |
| `actions` | `NotificationAction[]` | - | - | 动作按钮 |
| `route` | `string` | - | - | 点击跳转路由 |
| `data` | `Record<string, unknown>` | - | - | 附加数据 |
| `autoDismiss` | `number` | - | `5000` | 自动消失时间(ms) |
| `dismissible` | `boolean` | - | `true` | 是否可关闭 |
| `sound` | `string \| boolean` | - | - | 声音配置 |
| `vibrate` | `boolean` | - | - | 是否振动 |
| `bigImage` | `string` | - | - | 大图 URL |
| `progress` | `number` | - | - | 进度值 0-100 |

**返回**：创建的 `Notification` 对象

**示例**：

```typescript
const notification = notificationStore.createNotification({
  appId: 'com.weibo',
  appName: '微博',
  appIcon: { type: 'fontawesome', value: 'fab fa-weibo' },
  title: '新粉丝',
  body: '用户 @张三 关注了你',
  category: 'social',
  priority: 'normal',
  sound: true
})

console.log('通知ID:', notification.id)
```

#### showToast()

显示指定通知的 Toast。

```typescript
function showToast(notification: Notification): void
```

**注意**：通常不需要手动调用，`createNotification` 会自动处理。

#### dismissToast()

关闭当前显示的 Toast。

```typescript
function dismissToast(): void
```

**示例**：

```typescript
// 用户滑动关闭 Toast
function onSwipeAway() {
  notificationStore.dismissToast()
}
```

#### markAsRead()

标记指定通知为已读。

```typescript
function markAsRead(notificationId: string): void
```

**示例**：

```typescript
// 用户点击通知后标记已读
function onNotificationClick(notification: Notification) {
  notificationStore.markAsRead(notification.id)
  if (notification.route) {
    router.push(notification.route)
  }
}
```

#### markAllAsRead()

标记所有通知为已读。

```typescript
function markAllAsRead(): void
```

#### markAppAsRead()

标记指定应用的所有通知为已读。

```typescript
function markAppAsRead(appId: string): void
```

**示例**：

```typescript
// 打开微博应用时，标记所有微博通知已读
notificationStore.markAppAsRead('com.weibo')
```

#### removeNotification()

删除指定通知。

```typescript
function removeNotification(notificationId: string): void
```

#### removeAppNotifications()

删除指定应用的所有通知。

```typescript
function removeAppNotifications(appId: string): void
```

#### clearAll()

清空所有通知。

```typescript
function clearAll(): void
```

#### toggleDoNotDisturb()

切换勿扰模式。

```typescript
function toggleDoNotDisturb(): void
```

#### setDoNotDisturb()

设置勿扰模式状态。

```typescript
function setDoNotDisturb(value: boolean): void
```

#### muteApp()

静音指定应用。

```typescript
function muteApp(appId: string): void
```

**示例**：

```typescript
// 静音广告应用
notificationStore.muteApp('com.example.ads')
```

#### unmuteApp()

取消静音指定应用。

```typescript
function unmuteApp(appId: string): void
```

#### updateStatusBarIcon()

更新状态栏图标。

```typescript
function updateStatusBarIcon(appId: string, icon: NotificationIcon): void
```

#### removeStatusBarIcon()

移除状态栏图标。

```typescript
function removeStatusBarIcon(appId: string): void
```

#### refreshStatusBarIcons()

刷新所有状态栏图标的可见性。

```typescript
function refreshStatusBarIcons(): void
```

#### setStatusBarIconPriority()

设置状态栏图标的优先级。

```typescript
function setStatusBarIconPriority(appId: string, priority: number): void
```

#### getAppUnreadCount()

获取指定应用的未读通知数。

```typescript
function getAppUnreadCount(appId: string): number
```

**示例**：

```typescript
// 显示应用角标
const unread = notificationStore.getAppUnreadCount('com.weibo')
```

#### getAppNotifications()

获取指定应用的通知列表。

```typescript
function getAppNotifications(appId: string): Notification[]
```

#### formatNotificationTime()

格式化通知时间为人类可读格式。

```typescript
function formatNotificationTime(timestamp: number): string
```

**返回值示例**：

- `"刚刚"` - 1分钟内
- `"5分钟前"` - 1小时内
- `"2小时前"` - 24小时内
- `"昨天"` - 24-48小时
- `"1月15日"` - 更早

## 2. NotificationService API

直接使用 Service 的场景较少，通常通过 Store 调用。

```typescript
import { notificationService } from '@/services/notification/notificationService'
```

### 2.1 初始化

#### init()

初始化服务，注入 Store 的状态引用。

```typescript
function init(refs: {
  notifications: Ref<Notification[]>
  activeToast: Ref<Notification | null>
  toastQueue: Ref<Notification[]>
  doNotDisturb: Ref<boolean>
  mutedApps: Ref<string[]>
  statusBarIcons: Ref<StatusBarNotificationIcon[]>
}): void
```

**注意**：此方法由 Store 在初始化时自动调用，开发者无需手动调用。

### 2.2 核心方法

#### push()

推送新通知（Store 的 `createNotification` 内部调用此方法）。

```typescript
function push(params: CreateNotificationParams): Notification
```

#### generateId()

生成唯一通知 ID。

```typescript
function generateId(): string
```

**格式**：`notif_{timestamp}_{random}`

## 3. 使用场景示例

### 3.1 社交应用通知

```typescript
// 新评论通知
notificationStore.createNotification({
  appId: 'com.weibo',
  appName: '微博',
  appIcon: { type: 'fontawesome', value: 'fab fa-weibo' },
  title: '收到新评论',
  body: '张三评论了你的微博: 说得太好了！',
  category: 'social',
  priority: 'normal',
  groupId: 'weibo-comments',
  groupTitle: '微博评论',
  route: '/weibo/post/123',
  sound: true,
  data: {
    postId: '123',
    commentId: '456'
  }
})
```

### 3.2 即时消息通知

```typescript
// 新消息通知（高优先级）
notificationStore.createNotification({
  appId: 'com.chat',
  appName: '聊天',
  appIcon: { type: 'fontawesome', value: 'fas fa-comment' },
  title: '张三',
  body: '你好，在吗？',
  category: 'message',
  priority: 'high',
  actions: [
    { id: 'reply', label: '回复' },
    { id: 'mute', label: '静音对话' }
  ],
  route: '/chat/conversation/user123',
  sound: '/sounds/message.mp3'
})
```

### 3.3 系统通知

```typescript
// 系统更新通知（紧急）
notificationStore.createNotification({
  appId: 'com.system',
  appName: '系统',
  appIcon: { type: 'fontawesome', value: 'fas fa-cog' },
  title: '系统更新',
  body: '有新版本可用，点击更新',
  category: 'system',
  priority: 'urgent',
  dismissible: false,
  autoDismiss: 0,  // 不自动消失
  actions: [
    { id: 'update', label: '立即更新' },
    { id: 'later', label: '稍后提醒' }
  ]
})
```

### 3.4 下载进度通知

```typescript
// 带进度条的通知
const notification = notificationStore.createNotification({
  appId: 'com.download',
  appName: '下载管理',
  appIcon: { type: 'fontawesome', value: 'fas fa-download' },
  title: '正在下载...',
  body: 'file.zip',
  category: 'app',
  priority: 'low',
  progress: 0,
  autoDismiss: 0,
  dismissible: false
})

// 更新进度
function updateProgress(percent: number) {
  const n = notificationStore.notifications.find(n => n.id === notification.id)
  if (n) {
    n.progress = percent
    n.body = `file.zip - ${percent}%`
  }
}
```

### 3.5 通知中心 UI

```vue
<template>
  <div class="notification-center">
    <!-- 头部 -->
    <div class="header">
      <span>通知 ({{ notificationStore.unreadCount }})</span>
      <button @click="notificationStore.markAllAsRead()">
        全部已读
      </button>
    </div>
    
    <!-- 分组列表 -->
    <div
      v-for="group in notificationStore.groupedNotifications"
      :key="group.id"
      class="notification-group"
    >
      <div class="group-header">
        <NotificationIcon :icon="group.appIcon" />
        <span>{{ group.title }}</span>
        <span class="badge" v-if="group.unreadCount > 0">
          {{ group.unreadCount }}
        </span>
      </div>
      
      <div
        v-for="notification in group.notifications"
        :key="notification.id"
        class="notification-item"
        :class="{ unread: !notification.read }"
        @click="handleClick(notification)"
      >
        <div class="title">{{ notification.title }}</div>
        <div class="body">{{ notification.body }}</div>
        <div class="time">
          {{ notificationStore.formatNotificationTime(notification.timestamp) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '@/stores/notificationStore'
import { useRouter } from 'vue-router'

const notificationStore = useNotificationStore()
const router = useRouter()

function handleClick(notification) {
  notificationStore.markAsRead(notification.id)
  if (notification.route) {
    router.push(notification.route)
  }
}
</script>
```

## 4. 错误处理

通知服务的方法通常不会抛出异常。如果参数不正确，系统会使用默认值：

```typescript
// 即使缺少可选参数，也能正常工作
const notification = notificationStore.createNotification({
  appId: 'test',
  appName: 'Test',
  appIcon: { type: 'fontawesome', value: 'fas fa-bell' },
  title: 'Test',
  body: 'Test message'
  // priority 默认为 'normal'
  // category 默认为 'app'
  // autoDismiss 默认为 5000
})
```

## 5. 最佳实践

### 5.1 合理设置优先级

```typescript
// ❌ 不要给所有通知设置高优先级
notificationStore.createNotification({
  // ...
  priority: 'urgent'  // 只有真正紧急的才用
})

// ✅ 根据场景选择合适的优先级
notificationStore.createNotification({
  // ...
  priority: 'normal'  // 普通推送
})
```

### 5.2 使用分组减少干扰

```typescript
// ✅ 同类通知使用 groupId 聚合
notificationStore.createNotification({
  // ...
  groupId: 'weibo-likes',
  groupTitle: '点赞通知'
})
```

### 5.3 提供有意义的动作

```typescript
// ✅ 为用户提供快捷操作
notificationStore.createNotification({
  // ...
  actions: [
    { id: 'reply', label: '回复' },
    { id: 'archive', label: '归档' }
  ]
})
```
