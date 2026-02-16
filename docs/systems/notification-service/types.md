# 通知服务类型定义

> 本文档提供通知服务所有 TypeScript 类型的完整参考。

## 1. 核心类型

### 1.1 Notification

通知对象的完整结构：

```typescript
interface Notification {
  /** 唯一ID */
  id: string
  
  /** 所属应用ID */
  appId: string
  
  /** 应用名称 */
  appName: string
  
  /** 应用图标 */
  appIcon: NotificationIcon
  
  /** 通知标题 */
  title: string
  
  /** 通知正文 */
  body: string
  
  /** 通知副标题（可选） */
  subtitle?: string
  
  /** 通知类别 */
  category: NotificationCategory
  
  /** 优先级 */
  priority: NotificationPriority
  
  /** 创建时间戳 */
  timestamp: number
  
  /** 是否已读 */
  read: boolean
  
  /** 是否已展示过 Toast */
  shown: boolean
  
  /** 分组ID（用于通知堆叠） */
  groupId?: string
  
  /** 分组标题 */
  groupTitle?: string
  
  /** 通知动作按钮 */
  actions?: NotificationAction[]
  
  /** 点击通知时的路由路径（可选） */
  route?: string
  
  /** 附加数据 */
  data?: Record<string, unknown>
  
  /** 自动消失时间（毫秒，0表示不自动消失） */
  autoDismiss?: number
  
  /** 是否允许用户关闭 */
  dismissible?: boolean
  
  /** 通知声音（可选） */
  sound?: string | boolean
  
  /** 是否振动 */
  vibrate?: boolean
  
  /** 大图（可选，用于展开视图） */
  bigImage?: string
  
  /** 进度条（可选，0-100） */
  progress?: number
}
```

### 1.2 CreateNotificationParams

创建通知时的参数：

```typescript
interface CreateNotificationParams {
  /** 应用ID（必填） */
  appId: string
  
  /** 应用名称（必填） */
  appName: string
  
  /** 应用图标（必填） */
  appIcon: NotificationIcon
  
  /** 通知标题（必填） */
  title: string
  
  /** 通知正文（必填） */
  body: string
  
  /** 副标题 */
  subtitle?: string
  
  /** 类别，默认 'app' */
  category?: NotificationCategory
  
  /** 优先级，默认 'normal' */
  priority?: NotificationPriority
  
  /** 分组ID */
  groupId?: string
  
  /** 分组标题 */
  groupTitle?: string
  
  /** 动作按钮 */
  actions?: NotificationAction[]
  
  /** 点击跳转路由 */
  route?: string
  
  /** 附加数据 */
  data?: Record<string, unknown>
  
  /** 自动消失时间，默认 5000ms */
  autoDismiss?: number
  
  /** 是否可关闭，默认 true */
  dismissible?: boolean
  
  /** 声音配置 */
  sound?: string | boolean
  
  /** 是否振动 */
  vibrate?: boolean
  
  /** 大图URL */
  bigImage?: string
  
  /** 进度值 0-100 */
  progress?: number
}
```

## 2. 图标类型

### 2.1 NotificationIcon

通知图标支持三种类型：

```typescript
interface NotificationIcon {
  /** 图标类型 */
  type: NotificationIconType
  
  /** 
   * 图标值
   * - fontawesome: 'fas fa-bell' / 'fab fa-weixin'
   * - svg: '<svg>...</svg>' 或 SVG 文件路径
   * - image: 图片 URL 或 base64
   */
  value: string
  
  /** 图标背景色（可选） */
  backgroundColor?: string
  
  /** 图标颜色（仅 fontawesome 有效） */
  color?: string
}

type NotificationIconType = 'fontawesome' | 'svg' | 'image'
```

**使用示例**：

```typescript
// FontAwesome 图标
const faIcon: NotificationIcon = {
  type: 'fontawesome',
  value: 'fas fa-bell',
  color: '#ffffff',
  backgroundColor: '#3b82f6'
}

// SVG 图标
const svgIcon: NotificationIcon = {
  type: 'svg',
  value: '<svg>...</svg>'
}

// 图片图标
const imageIcon: NotificationIcon = {
  type: 'image',
  value: '/icons/app-icon.png'
}
```

## 3. 枚举类型

### 3.1 NotificationPriority

通知优先级：

```typescript
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
```

| 值 | 权重 | 说明 | Toast 行为 |
| ---- | ------ | ------ | ------------ |
| `low` | 1 | 低优先级 | 通常不显示 Toast |
| `normal` | 2 | 普通优先级 | 正常显示 Toast |
| `high` | 3 | 高优先级 | 可抢占普通 Toast |
| `urgent` | 4 | 紧急 | 可抢占所有 Toast |

### 3.2 NotificationCategory

通知类别（用于分类和过滤）：

```typescript
type NotificationCategory = 
  | 'message'      // 消息通知
  | 'social'       // 社交通知（点赞、评论、关注）
  | 'email'        // 邮件通知
  | 'reminder'     // 提醒
  | 'system'       // 系统通知
  | 'app'          // 应用通知（默认）
  | 'call'         // 通话
  | 'media'        // 媒体
  | 'custom'       // 自定义
```

## 4. 动作类型

### 4.1 NotificationAction

通知上的交互按钮：

```typescript
interface NotificationAction {
  /** 动作ID */
  id: string
  
  /** 动作标签（按钮文字） */
  label: string
  
  /** 动作图标（可选） */
  icon?: string
  
  /** 是否为破坏性操作（显示为红色） */
  destructive?: boolean
}
```

**使用示例**：

```typescript
const actions: NotificationAction[] = [
  { id: 'reply', label: '回复', icon: 'fas fa-reply' },
  { id: 'mark-read', label: '标记已读' },
  { id: 'delete', label: '删除', destructive: true }
]
```

## 5. 分组类型

### 5.1 NotificationGroup

通知分组（用于通知中心的聚合显示）：

```typescript
interface NotificationGroup {
  /** 分组ID */
  id: string
  
  /** 分组标题 */
  title: string
  
  /** 应用ID */
  appId: string
  
  /** 应用图标 */
  appIcon: NotificationIcon
  
  /** 分组内的通知 */
  notifications: Notification[]
  
  /** 最新通知时间 */
  latestTimestamp: number
  
  /** 未读数量 */
  unreadCount: number
}
```

**分组逻辑**：

通知按以下优先级分组：
1. 如果有 `groupId`，使用 `groupId` 分组
2. 否则使用 `appId` 分组

## 6. 状态栏类型

### 6.1 StatusBarNotificationIcon

状态栏中显示的通知图标：

```typescript
interface StatusBarNotificationIcon {
  /** 图标ID（通常与 appId 相同） */
  id: string
  
  /** 图标配置 */
  icon: NotificationIcon
  
  /** 优先级（数字越大越靠前） */
  priority: number
  
  /** 是否显示 */
  visible: boolean
  
  /** 工具提示（鼠标悬停显示） */
  tooltip?: string
}
```

**可见性规则**：

- 当应用有未读通知时，`visible = true`
- 当应用所有通知都已读时，`visible = false`
- 图标按 `priority` 降序排列显示

## 7. 配置类型

### 7.1 ToastConfig

Toast 显示配置：

```typescript
interface ToastConfig {
  /** 显示时长（毫秒） */
  duration: number
  
  /** 位置 */
  position: 'top' | 'bottom'
  
  /** 是否可点击 */
  clickable: boolean
  
  /** 是否显示关闭按钮 */
  showClose: boolean
}
```

### 7.2 NotificationCenterState

通知中心的状态接口：

```typescript
interface NotificationCenterState {
  /** 所有通知 */
  notifications: Notification[]
  
  /** 未读数量 */
  unreadCount: number
  
  /** 是否有新通知（用于图标动画） */
  hasNew: boolean
  
  /** 勿扰模式 */
  doNotDisturb: boolean
  
  /** 静音应用列表 */
  mutedApps: string[]
}
```

## 8. 类型使用示例

### 8.1 完整的通知创建示例

```typescript
import { useNotificationStore } from '@/stores/notificationStore'
import type { CreateNotificationParams, NotificationIcon } from '@/types/notification'

const notificationStore = useNotificationStore()

// 定义应用图标
const appIcon: NotificationIcon = {
  type: 'fontawesome',
  value: 'fab fa-weibo',
  backgroundColor: '#e6162d'
}

// 创建通知参数
const params: CreateNotificationParams = {
  appId: 'com.weibo',
  appName: '微博',
  appIcon,
  title: '有人评论了你的微博',
  body: '张三: 这个观点很有意思！',
  category: 'social',
  priority: 'high',
  groupId: 'weibo-comments',
  groupTitle: '微博评论',
  actions: [
    { id: 'reply', label: '回复' },
    { id: 'like', label: '点赞' }
  ],
  route: '/weibo/post/12345',
  data: {
    postId: '12345',
    commentId: '67890'
  },
  autoDismiss: 8000,
  sound: true
}

// 发送通知
const notification = notificationStore.createNotification(params)
console.log('Created notification:', notification.id)
```

### 8.2 类型守卫示例

```typescript
import type { Notification, NotificationPriority } from '@/types/notification'

// 检查是否为高优先级通知
function isHighPriority(notification: Notification): boolean {
  return notification.priority === 'high' || notification.priority === 'urgent'
}

// 检查是否有动作按钮
function hasActions(notification: Notification): boolean {
  return notification.actions !== undefined && notification.actions.length > 0
}

// 获取优先级权重
function getPriorityWeight(priority: NotificationPriority): number {
  const weights: Record<NotificationPriority, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1
  }
  return weights[priority]
}
```

## 9. 类型导入

所有类型都从 `@/types/notification` 导出：

```typescript
import type {
  Notification,
  NotificationIcon,
  NotificationIconType,
  NotificationPriorityificationCategory,
  NotificationAction,
  NotificationGroup,
  StatusBarNotificationIcon,
  ToastConfig,
  NotificationCenterState,
  CreateNotificationParams
} from '@/types/notification'
```
