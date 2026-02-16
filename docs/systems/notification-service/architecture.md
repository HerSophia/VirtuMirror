# 通知服务架构设计

> 本文档详细说明通知服务的架构设计、核心模式和实现细节。

## 1. 整体架构

### 1.1 分层设计

通知服务采用经典的三层架构，符合 [系统服务开发指南](../service-development-guide.md) 的规范：

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              表现层 (UI)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ NotificationToast│  │   StatusBar     │  │NotificationCenter│        │
│  │   (横幅通知)      │  │  (状态栏图标)    │  │   (通知中心)      │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ 订阅响应式状态
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          状态层 (Store)                                  │
│                                                                          │
│  NotificationStore (Pinia)                                               │
│  ├── 状态: notifications, activeToast, toastQueue, doNotDisturb, ...    │
│  ├── 计算属性: unreadCount, groupedNotifications, ...                   │
│  └── Actions: createNotification(), markAsRead(), ... (代理到 Service)  │
│                                                                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ 状态注入 + 方法调用
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          服务层 (Service)                                │
│                                                                          │
│  NotificationService (单例)                                              │
│  ├── push(): 推送新通知                                                  │
│  ├── showToast(): Toast 显示与抢占逻辑                                   │
│  ├── dismissToast(): 关闭 Toast 并处理队列                               │
│  ├── markAsRead(): 标记已读                                              │
│  ├── 状态栏图标管理                                                       │
│  └── 音频服务集成                                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流向

```text
App 调用
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ notificationStore.createNotification(params)                  │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ notificationService.push(params)                              │
│  1. 生成唯一 ID 和时间戳                                        │
│  2. 检查勿扰模式和应用静音状态                                   │
│  3. 添加到 notifications 列表                                   │
│  4. 决定是否显示 Toast                                          │
│  5. 播放提示音                                                  │
│  6. 更新状态栏图标                                              │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ Store 状态自动更新 (响应式)                                     │
│  - notifications.value 变化                                    │
│  - activeToast.value 变化                                      │
│  - statusBarIcons.value 变化                                   │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ UI 组件自动重渲染                                              │
│  - Toast 横幅显示/隐藏                                         │
│  - 状态栏图标更新                                              │
│  - 通知中心列表刷新                                            │
└───────────────────────────────────────────────────────────────┘
```

## 2. 核心设计模式

### 2.1 State Injection 模式

通知服务采用 **State Injection** 模式，这是一种在 Service 和 Store 之间建立桥梁的设计模式。

**传统模式的问题**：

```typescript
// ❌ 传统模式：Service 依赖 Store
class NotificationService {
  push(params) {
    const store = useNotificationStore()  // 直接依赖 Pinia
    store.notifications.push(...)
  }
}
```

这种模式的问题是 Service 与 Pinia 强耦合，难以进行单元测试。

**State Injection 模式**：

```typescript
// ✅ State Injection：Store 注入状态到 Service
class NotificationService {
  private _notifications: Ref<Notification[]> = ref([])
  
  // Store 在初始化时注入状态引用
  init(refs: {
    notifications: Ref<Notification[]>
    activeToast: Ref<Notification | null>
    // ...
  }) {
    this._notifications = refs.notifications
    // ...
  }
  
  push(params) {
    // 直接操作注入的响应式引用
    this._notifications.value.unshift(notification)
  }
}
```

**优势**：

1. **解耦**: Service 不依赖 Pinia，只依赖 Vue 的 Ref
2. **可测试**: 单元测试时可以注入 mock 的 Ref
3. **响应式**: 通过 Ref 操作的状态变化自动触发 UI 更新
4. **单一数据源**: Store 仍然是状态的唯一所有者

### 2.2 单例模式

```typescript
export class NotificationService {
  private static instance: NotificationService
  
  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService()
    }
    return this.instance
  }
}

// 导出单例
export const notificationService = NotificationService.getInstance()
```

**为什么使用单例**：

1. 通知系统是全局唯一的，不应有多个实例
2. 所有 App 共享同一个通知队列
3. Toast 显示需要统一调度，避免冲突

### 2.3 优先级抢占机制

Toast 显示采用优先级抢占机制，高优先级通知可以立即替换低优先级通知：

```typescript
showToast(notification: Notification) {
  if (this._activeToast.value) {
    const currentPriority = this.getPriorityWeight(this._activeToast.value.priority)
    const newPriority = this.getPriorityWeight(notification.priority)
    
    if (newPriority > currentPriority) {
      // 高优先级：立即抢占
      if (this.toastTimer) {
        clearTimeout(this.toastTimer)
        this.toastTimer = null
      }
      // 继续执行，覆盖 activeToast
    } else {
      // 低优先级：加入队列等待
      this._toastQueue.value.push(notification)
      return
    }
  }
  
  this._activeToast.value = notification
  // 设置自动关闭定时器...
}
```

**优先级权重**：

| 优先级 | 权重 | 说明 |
| -------- | ------ | ------ |
| `urgent` | 4 | 紧急通知，如来电、报警 |
| `high` | 3 | 重要通知，如即时消息 |
| `normal` | 2 | 普通通知，如应用推送 |
| `low` | 1 | 低优先级，如后台同步 |

### 2.4 Toast 队列管理

当一个 Toast 关闭时，系统会自动显示队列中的下一个通知：

```typescript
dismissToast() {
  if (this.toastTimer) {
    clearTimeout(this.toastTimer)
    this.toastTimer = null
  }
  
  this._activeToast.value = null
  
  // 处理队列中的下一个
  if (this._toastQueue.value.length > 0) {
    const next = this._toastQueue.value.shift()!
    // 稍微延迟，产生视觉间隔
    setTimeout(() => this.showToast(next), 300)
  }
}
```

## 3. 状态管理

### 3.1 核心状态

| 状态 | 类型 | 说明 |
| ------ | ------ | ------ |
| `notifications` | `Notification[]` | 所有通知列表 |
| `activeToast` | `Notification \ | null` | 当前显示的 Toast |
| `toastQueue` | `Notification[]` | 等待显示的 Toast 队列 |
| `doNotDisturb` | `boolean` | 勿扰模式开关 |
| `mutedApps` | `string[]` | 被静音的应用 ID 列表 |
| `statusBarIcons` | `StatusBarNotificationIcon[]` | 状态栏图标列表 |

### 3.2 计算属性

| 计算属性 | 说明 |
| ---------- | ------ |
| `unreadCount` | 未读通知数量 |
| `hasUnread` | 是否有未读通知 |
| `sortedNotifications` | 按时间排序的通知列表 |
| `groupedNotifications` | 按应用/分组聚合的通知 |
| `highPriorityNotifications` | 高优先级通知列表 |
| `visibleStatusBarIcons` | 可见的状态栏图标 |

### 3.3 持久化配置

```typescript
defineStore('notification', () => {
  // ...
}, {
  persist: {
    key: 'phone-sim-notifications',
    paths: [
      'notifications',    // 通知列表
      'doNotDisturb',     // 勿扰模式
      'mutedApps',        // 静音应用
    ],
  },
})
```

**持久化策略**：
- ✅ `notifications`: 保留历史通知
- ✅ `doNotDisturb`: 保留用户设置
- ✅ `mutedApps`: 保留应用静音状态
- ❌ `activeToast`: 不持久化，每次刷新后重置
- ❌ `toastQueue`: 不持久化，运行时状态

## 4. 勿扰模式设计

### 4.1 勿扰规则

```typescript
push(params: CreateNotificationParams): Notification {
  // ...
  
  // 检查是否需要显示 Toast
  if (!this._doNotDisturb.value && !this._mutedApps.value.includes(params.appId)) {
    this.showToast(notification)
    
    // 播放声音
    if (params.sound) {
      // ...
    }
  }
  
  // 无论是否勿扰，都添加到通知列表
  this._notifications.value.unshift(notification)
  
  return notification
}
```

**规则说明**：

| 条件 | Toast | 声音 | 添加到列表 |
| ------ | ------- | ------ | ------------ |
| 正常模式 | ✅ | ✅ | ✅ |
| 勿扰模式 | ❌ | ❌ | ✅ |
| 应用静音 | ❌ | ❌ | ✅ |
| urgent 优先级 | ✅ (规划中) | ✅ | ✅ |

### 4.2 未来规划

- **时间段勿扰**: 支持设置勿扰时间段（如 22:00 - 7:00）
- **联系人白名单**: 重要联系人的消息可突破勿扰
- **紧急通知穿透**: `urgent` 优先级可忽略勿扰设置

## 5. 声音集成

### 5.1 声音播放逻辑

```typescript
if (!this._doNotDisturb.value && !this._mutedApps.value.includes(params.appId)) {
  // 自定义提示音
  if (typeof params.sound === 'string' && params.sound) {
    audioService.play({
      source: params.sound,
      channel: 'notification',
      overlap: true
    })
  } 
  // 系统默认提示音
  else if (params.sound === true) {
    audioService.playSystemSound('NOTIFICATION')
  }
}
```

### 5.2 声音配置选项

| 配置值 | 行为 |
| -------- | ------ |
| `true` | 播放系统默认提示音 |
| `false` / `undefined` | 静音 |
| `string` (路径) | 播放指定音频文件 |

## 6. 状态栏图标管理

### 6.1 图标生命周期

```typescript
// 1. 新通知到来时更新图标
updateStatusBarIcon(appId: string, icon: NotificationIcon) {
  const hasUnread = this._notifications.value.some(
    n => n.appId === appId && !n.read
  )
  
  const existing = this._statusBarIcons.value.find(i => i.id === appId)
  if (existing) {
    existing.visible = hasUnread
  } else if (hasUnread) {
    this._statusBarIcons.value.push({
      id: appId,
      icon,
      priority: 50,
      visible: true,
    })
  }
}

// 2. 标记已读后刷新可见性
refreshStatusBarIcons() {
  for (const icon of this._statusBarIcons.value) {
    const hasUnread = this._notifications.value.some(
      n => n.appId === icon.id && !n.read
    )
    icon.visible = hasUnread
  }
}

// 3. 清空应用通知时移除图标
removeStatusBarIcon(appId: string) {
  const index = this._statusBarIcons.value.findIndex(i => i.id === appId)
  if (index !== -1) {
    this._statusBarIcons.value.splice(index, 1)
  }
}
```

### 6.2 图标优先级

状态栏空间有限，图标按优先级排序显示：

```typescript
const visibleStatusBarIcons = computed(() =>
  statusBarIcons.value
    .filter(icon => icon.visible)
    .sort((a, b) => b.priority - a.priority)
)
```

## 7. 与其他服务的集成

### 7.1 AudioService 集成

```typescript
import { audioService } from '@/services/audioService'

// 播放系统提示音
audioService.playSystemSound('NOTIFICATION')

// 播放自定义音频
audioService.play({
  source: '/sounds/message.mp3',
  channel: 'notification',
  overlap: true  // 允许重叠播放
})
```

### 7.2 Router 集成（规划中）

点击通知跳转到指定路由：

```typescript
// 通知中配置路由
{
  route: '/chat/conversation/123'
}

// 点击处理
function handleNotificationClick(notification: Notification) {
  if (notification.route) {
    router.push(notification.route)
  }
  notificationStore.markAsRead(notification.id)
}
```

## 8. 设计决策记录

### 8.1 为什么不使用 Web Notification API?

**原因**：
1. 我们模拟的是手机 OS，需要完全控制通知的外观和行为
2. Web Notification 在不同浏览器表现不一致
3. 需要支持自定义的优先级抢占和队列机制
4. 状态栏图标是模拟器特有的概念

### 8.2 为什么 Service 使用 Ref 而不是 reactive?

**原因**：
1. `Ref` 可以直接赋值替换整个数组，更方便
2. 与 Store 中的状态类型一致，便于注入
3. 单个值的响应式用 `Ref` 更直观

### 8.3 为什么 Toast 自动关闭用 setTimeout 而不是 CSS 动画?

**原因**：
1. 需要精确控制自动关闭时机
2. 高优先级通知需要能够中断定时器
3. 用户交互（手动关闭）需要取消定时器
4. CSS 动画不提供这种控制能力
