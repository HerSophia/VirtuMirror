/**
 * 通知系统状态管理 Store
 * 
 * 架构说明：
 * Store 仅作为 View Model 层，负责维护响应式状态和计算属性。
 * 核心业务逻辑（创建、删除、调度等）已迁移至 NotificationService。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Notification,
  NotificationGroup,
  NotificationIcon,
  CreateNotificationParams,
  StatusBarNotificationIcon,
} from '@/types/notification'
import { notificationService } from '@/services/notification/notificationService'

export const useNotificationStore = defineStore('notification', () => {
  // ==================== 状态 ====================
  // 注意：这些状态由 Service 直接引用和修改
  
  /** 所有通知列表 */
  const notifications = ref<Notification[]>([])
  
  /** 当前显示的 Toast 通知 */
  const activeToast = ref<Notification | null>(null)
  
  /** Toast 队列 */
  const toastQueue = ref<Notification[]>([])
  
  /** 勿扰模式 */
  const doNotDisturb = ref(false)
  
  /** 静音的应用列表 */
  const mutedApps = ref<string[]>([])
  
  /** 状态栏图标列表 */
  const statusBarIcons = ref<StatusBarNotificationIcon[]>([])
  
  // 初始化 Service (注入状态)
  notificationService.init({
    notifications,
    activeToast,
    toastQueue,
    doNotDisturb,
    mutedApps,
    statusBarIcons,
  })
  
  // ==================== 计算属性 ====================
  
  /** 未读通知数量 */
  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  )
  
  /** 是否有未读通知 */
  const hasUnread = computed(() => unreadCount.value > 0)
  
  /** 按时间排序的通知（最新在前） */
  const sortedNotifications = computed(() =>
    [...notifications.value].sort((a, b) => b.timestamp - a.timestamp)
  )
  
  /** 按应用分组的通知 */
  const groupedNotifications = computed<NotificationGroup[]>(() => {
    const groups = new Map<string, NotificationGroup>()
    
    for (const notification of sortedNotifications.value) {
      const groupKey = notification.groupId || notification.appId
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          title: notification.groupTitle || notification.appName,
          appId: notification.appId,
          appIcon: notification.appIcon,
          notifications: [],
          latestTimestamp: notification.timestamp,
          unreadCount: 0,
        })
      }
      
      const group = groups.get(groupKey)!
      group.notifications.push(notification)
      if (!notification.read) {
        group.unreadCount++
      }
      if (notification.timestamp > group.latestTimestamp) {
        group.latestTimestamp = notification.timestamp
      }
    }
    
    return Array.from(groups.values()).sort(
      (a, b) => b.latestTimestamp - a.latestTimestamp
    )
  })
  
  /** 高优先级通知 */
  const highPriorityNotifications = computed(() =>
    notifications.value.filter(
      n => n.priority === 'high' || n.priority === 'urgent'
    )
  )
  
  /** 可见的状态栏图标 */
  const visibleStatusBarIcons = computed(() =>
    statusBarIcons.value
      .filter(icon => icon.visible)
      .sort((a, b) => b.priority - a.priority)
  )
  
  // ==================== 操作 (代理到 Service) ====================
  
  /** 创建新通知 */
  function createNotification(params: CreateNotificationParams): Notification {
    return notificationService.push(params)
  }
  
  /** 显示 Toast 通知 */
  function showToast(notification: Notification) {
    notificationService.showToast(notification)
  }
  
  /** 关闭当前 Toast */
  function dismissToast() {
    notificationService.dismissToast()
  }
  
  /** 标记通知为已读 */
  function markAsRead(notificationId: string) {
    notificationService.markAsRead(notificationId)
  }
  
  /** 标记所有通知为已读 */
  function markAllAsRead() {
    notificationService.markAllAsRead()
  }
  
  /** 标记应用的所有通知为已读 */
  function markAppAsRead(appId: string) {
    notificationService.markAppAsRead(appId)
  }
  
  /** 删除通知 */
  function removeNotification(notificationId: string) {
    notificationService.removeNotification(notificationId)
  }
  
  /** 删除应用的所有通知 */
  function removeAppNotifications(appId: string) {
    notificationService.removeAppNotifications(appId)
  }
  
  /** 清除所有通知 */
  function clearAll() {
    notificationService.clearAll()
  }
  
  /** 切换勿扰模式 */
  function toggleDoNotDisturb() {
    doNotDisturb.value = !doNotDisturb.value
  }
  
  /** 设置勿扰模式 */
  function setDoNotDisturb(value: boolean) {
    doNotDisturb.value = value
  }
  
  /** 静音应用 */
  function muteApp(appId: string) {
    notificationService.muteApp(appId)
  }
  
  /** 取消静音应用 */
  function unmuteApp(appId: string) {
    notificationService.unmuteApp(appId)
  }
  
  /** 更新状态栏图标 */
  function updateStatusBarIcon(appId: string, icon: NotificationIcon) {
    notificationService.updateStatusBarIcon(appId, icon)
  }
  
  /** 刷新所有状态栏图标的可见性 */
  function refreshStatusBarIcons() {
    notificationService.refreshStatusBarIcons()
  }
  
  /** 移除状态栏图标 */
  function removeStatusBarIcon(appId: string) {
    notificationService.removeStatusBarIcon(appId)
  }
  
  /** 设置状态栏图标优先级 */
  function setStatusBarIconPriority(appId: string, priority: number) {
    notificationService.setStatusBarIconPriority(appId, priority)
  }
  
  /** 获取应用的未读通知数 */
  function getAppUnreadCount(appId: string): number {
    return notifications.value.filter(
      n => n.appId === appId && !n.read
    ).length
  }
  
  /** 获取应用的通知 */
  function getAppNotifications(appId: string): Notification[] {
    return sortedNotifications.value.filter(n => n.appId === appId)
  }
  
  /** 格式化通知时间 */
  function formatNotificationTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 60000) {
      return '刚刚'
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`
    } else if (diff < 172800000) {
      return '昨天'
    } else {
      const date = new Date(timestamp)
      return `${date.getMonth() + 1}月${date.getDate()}日`
    }
  }
  
  return {
    // 状态
    notifications,
    activeToast,
    toastQueue,
    doNotDisturb,
    mutedApps,
    statusBarIcons,
    
    // 计算属性
    unreadCount,
    hasUnread,
    sortedNotifications,
    groupedNotifications,
    highPriorityNotifications,
    visibleStatusBarIcons,
    
    // 操作
    createNotification,
    showToast,
    dismissToast,
    markAsRead,
    markAllAsRead,
    markAppAsRead,
    removeNotification,
    removeAppNotifications,
    clearAll,
    toggleDoNotDisturb,
    setDoNotDisturb,
    muteApp,
    unmuteApp,
    updateStatusBarIcon,
    removeStatusBarIcon,
    setStatusBarIconPriority,
    refreshStatusBarIcons,
    getAppUnreadCount,
    getAppNotifications,
    formatNotificationTime,
  }
}, {
  persist: {
    key: 'phone-sim-notifications',
    paths: [
      'notifications',
      'doNotDisturb',
      'mutedApps',
    ],
  },
})
