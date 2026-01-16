/**
 * 通知系统类型定义
 */

/** 通知图标类型 */
export type NotificationIconType = 'fontawesome' | 'svg' | 'image'

/** 通知图标配置 */
export interface NotificationIcon {
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

/** 通知优先级 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/** 通知类别 */
export type NotificationCategory = 
  | 'message'      // 消息通知
  | 'social'       // 社交通知
  | 'email'        // 邮件通知
  | 'reminder'     // 提醒
  | 'system'       // 系统通知
  | 'app'          // 应用通知
  | 'call'         // 通话
  | 'media'        // 媒体
  | 'custom'       // 自定义

/** 通知动作 */
export interface NotificationAction {
  /** 动作ID */
  id: string
  /** 动作标签 */
  label: string
  /** 动作图标（可选） */
  icon?: string
  /** 是否为破坏性操作 */
  destructive?: boolean
}

/** 通知数据 */
export interface Notification {
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

/** 通知分组 */
export interface NotificationGroup {
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

/** Toast 通知配置 */
export interface ToastConfig {
  /** 显示时长（毫秒） */
  duration: number
  /** 位置 */
  position: 'top' | 'bottom'
  /** 是否可点击 */
  clickable: boolean
  /** 是否显示关闭按钮 */
  showClose: boolean
}

/** 通知中心状态 */
export interface NotificationCenterState {
  /** 所有通知 */
  notifications: Notification[]
  /** 未读数量 */
  unreadCount: number
  /** 是否有新通知（于图标动画） */
  hasNew: boolean
  /** 勿扰模式 */
  doNotDisturb: boolean
  /** 静音应用列表 */
  mutedApps: string[]
}

/** 状态栏通知图标项 */
export interface StatusBarNotificationIcon {
  /** 图标ID */
  id: string
  /** 图标配置 */
  icon: NotificationIcon
  /** 优先级（数字越大越靠前） */
  priority: number
  /** 是否显示 */
  visible: boolean
  /** 工具提示 */
  tooltip?: string
}

/** 创建通知的参数 */
export interface CreateNotificationParams {
  appId: string
  appName: string
  appIcon: NotificationIcon
  title: string
  body: string
  subtitle?: string
  category?: NotificationCategory
  priority?: NotificationPriority
  groupId?: string
  groupTitle?: string
  actions?: Notification['actions']
  route?: string
  data?: Record<string, unknown>
  autoDismiss?: number
  dismissible?: boolean
  sound?: string | boolean
  vibrate?: boolean
  bigImage?: string
  progress?: number
}
