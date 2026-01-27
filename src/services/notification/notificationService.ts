import { audioService } from '@/services/audio/audioService'
import type {
  CreateNotificationParams,
  Notification,
  NotificationIcon,
  StatusBarNotificationIcon,
} from '@/types/notification'
import { ref, type Ref } from 'vue'

export class NotificationService {
  private static instance: NotificationService

  // State refs (injected from Store)
  private _notifications: Ref<Notification[]> = ref([])
  private _activeToast: Ref<Notification | null> = ref(null)
  private _toastQueue: Ref<Notification[]> = ref([])
  private _doNotDisturb: Ref<boolean> = ref(false)
  private _mutedApps: Ref<string[]> = ref([])
  private _statusBarIcons: Ref<StatusBarNotificationIcon[]> = ref([])

  private toastTimer: ReturnType<typeof setTimeout> | null = null

  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService()
    }
    return this.instance
  }

  /**
   * 初始化 Service，注入 Store 的状态
   */
  init(refs: {
    notifications: Ref<Notification[]>
    activeToast: Ref<Notification | null>
    toastQueue: Ref<Notification[]>
    doNotDisturb: Ref<boolean>
    mutedApps: Ref<string[]>
    statusBarIcons: Ref<StatusBarNotificationIcon[]>
  }) {
    this._notifications = refs.notifications
    this._activeToast = refs.activeToast
    this._toastQueue = refs.toastQueue
    this._doNotDisturb = refs.doNotDisturb
    this._mutedApps = refs.mutedApps
    this._statusBarIcons = refs.statusBarIcons
  }

  /**
   * 生成唯一 ID
   */
  generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 推送新通知
   */
  push(params: CreateNotificationParams): Notification {
    const notification: Notification = {
      id: this.generateId(),
      appId: params.appId,
      appName: params.appName,
      appIcon: params.appIcon,
      title: params.title,
      body: params.body,
      subtitle: params.subtitle,
      category: params.category || 'app',
      priority: params.priority || 'normal',
      timestamp: Date.now(),
      read: false,
      shown: false,
      groupId: params.groupId,
      groupTitle: params.groupTitle,
      actions: params.actions,
      route: params.route,
      data: params.data,
      autoDismiss: params.autoDismiss ?? 5000,
      dismissible: params.dismissible ?? true,
      sound: params.sound,
      vibrate: params.vibrate,
      bigImage: params.bigImage,
      progress: params.progress,
    }

    // 添加到通知列表
    this._notifications.value.unshift(notification)

    // 检查是否需要显示 Toast
    // 规则: 非勿扰模式 且 应用未被静音
    if (!this._doNotDisturb.value && !this._mutedApps.value.includes(params.appId)) {
      this.showToast(notification)

      // 播放声音
      if (typeof params.sound === 'string' && params.sound) {
        audioService.play({
          source: params.sound,
          channel: 'notification',
          overlap: true,
        })
      } else if (params.sound === true) {
        // 使用系统默认提示音
        audioService.playSystemSound('NOTIFICATION')
      }
    }

    // 更新状态栏图标
    this.updateStatusBarIcon(params.appId, params.appIcon)

    return notification
  }

  /**
   * 获取优先级权重
   */
  private getPriorityWeight(priority: string = 'normal'): number {
    const weights: Record<string, number> = {
      urgent: 4,
      high: 3,
      normal: 2,
      low: 1,
    }
    return weights[priority] || 2
  }

  /**
   * 显示 Toast
   */
  showToast(notification: Notification) {
    if (this._activeToast.value) {
      const currentPriority = this.getPriorityWeight(this._activeToast.value.priority)
      const newPriority = this.getPriorityWeight(notification.priority)

      // 如果新通知优先级更高，立即替换（挤出去）
      if (newPriority > currentPriority) {
        // 清除旧的定时器
        if (this.toastTimer) {
          clearTimeout(this.toastTimer)
          this.toastTimer = null
        }
        // 旧的 activeToast 将被替换。
        // 继续向下执行，直接覆盖 _activeToast.value
      } else {
        // 否则加入队列
        this._toastQueue.value.push(notification)
        return
      }
    }

    this._activeToast.value = notification
    notification.shown = true

    // 设置自动关闭
    if (notification.autoDismiss && notification.autoDismiss > 0) {
      this.toastTimer = setTimeout(() => {
        this.dismissToast()
      }, notification.autoDismiss)
    }
  }

  /**
   * 关闭当前 Toast
   */
  dismissToast() {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer)
      this.toastTimer = null
    }

    this._activeToast.value = null

    // 处理队列中的下一个
    if (this._toastQueue.value.length > 0) {
      const next = this._toastQueue.value.shift()!
      // 稍微延迟一点显示下一个，产生视觉间隔
      setTimeout(() => this.showToast(next), 300)
    }
  }

  /**
   * 标记通知为已读
   */
  markAsRead(notificationId: string) {
    const notification = this._notifications.value.find((n) => n.id === notificationId)
    if (notification) {
      notification.read = true
      // 刷新该应用的状态栏图标可见性
      this.refreshStatusBarIcons()
    }
  }

  /**
   * 标记所有通知为已读
   */
  markAllAsRead() {
    this._notifications.value.forEach((n) => {
      n.read = true
    })
    this.refreshStatusBarIcons()
  }

  /**
   * 标记应用的所有通知为已读
   */
  markAppAsRead(appId: string) {
    this._notifications.value
      .filter((n) => n.appId === appId)
      .forEach((n) => {
        n.read = true
      })
    this.refreshStatusBarIcons()
  }

  /**
   * 删除通知
   */
  removeNotification(notificationId: string) {
    const index = this._notifications.value.findIndex((n) => n.id === notificationId)
    if (index !== -1) {
      this._notifications.value.splice(index, 1)
    }
  }

  /**
   * 删除应用的所有通知
   */
  removeAppNotifications(appId: string) {
    this._notifications.value = this._notifications.value.filter((n) => n.appId !== appId)
    this.removeStatusBarIcon(appId)
  }

  /**
   * 清除所有通知
   */
  clearAll() {
    this._notifications.value = []
    this._statusBarIcons.value = []
  }

  /**
   * 静音应用
   */
  muteApp(appId: string) {
    if (!this._mutedApps.value.includes(appId)) {
      this._mutedApps.value.push(appId)
    }
  }

  /**
   * 取消静音应用
   */
  unmuteApp(appId: string) {
    const index = this._mutedApps.value.indexOf(appId)
    if (index !== -1) {
      this._mutedApps.value.splice(index, 1)
    }
  }

  /**
   * 更新状态栏图标
   */
  updateStatusBarIcon(appId: string, icon: NotificationIcon) {
    const hasUnread = this._notifications.value.some((n) => n.appId === appId && !n.read)

    const existing = this._statusBarIcons.value.find((i) => i.id === appId)
    if (existing) {
      existing.icon = icon
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

  /**
   * 刷新所有状态栏图标的可见性
   */
  refreshStatusBarIcons() {
    for (const icon of this._statusBarIcons.value) {
      const hasUnread = this._notifications.value.some((n) => n.appId === icon.id && !n.read)
      icon.visible = hasUnread
    }
  }

  /**
   * 移除状态栏图标
   */
  removeStatusBarIcon(appId: string) {
    const index = this._statusBarIcons.value.findIndex((i) => i.id === appId)
    if (index !== -1) {
      this._statusBarIcons.value.splice(index, 1)
    }
  }
  /**
   * 设置状态栏图标优先级
   */
  setStatusBarIconPriority(appId: string, priority: number) {
    const icon = this._statusBarIcons.value.find((i) => i.id === appId)
    if (icon) {
      icon.priority = priority
    }
  }
}

export const notificationService = NotificationService.getInstance()
