/**
 * App 状态管理 Store
 *
 * 管理每个 App 的状态信息，包括：
 * - 图标在桌面上的位置（用于 zoom 动画）
 * - 运行中的 App 列表（用于多任务切换）
 * - 最后访问的路由、滚动位置等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { cloudSyncService } from '@/services/cloudSyncService'
import { sessionService } from '@/services/database'
import { getBridgeAdapter } from '@/adapters/bridgeAdapter'

export interface AppIconPosition {
  x: number  // 相对于容器的 x 百分比 (0-100)
  y: number  // 相对于容器的 y 百分比 (0-100)
}

export interface AppState {
  /** App 图标在桌面上的位置 */
  iconPosition: AppIconPosition | null
  /** 最后访问的路由路径 */
  lastRoute: string | null
  /** 是否正在运行（已打开过） */
  isRunning: boolean
  /** App 打开的时间戳（用于排序） */
  openedAt: number | null
  /** App 的显示名称 */
  name: string
}

/** App 信息（用于多任务切换显示） */
export interface RunningAppInfo {
  /** App ID */
  id: string
  /** App 显示名称 */
  name: string
  /** 最后访问的路由 */
  lastRoute: string
  /** 图标位置 */
  iconPosition: AppIconPosition | null
  /** 打开时间 */
  openedAt: number
}

/** 从路由路径提取 App ID */
export function getAppIdFromRoute(route: string): string {
  // /chat/xxx -> chat
  // /settings/about -> settings
  // / -> home
  if (route === '/') return 'home'
  const match = route.match(/^\/([^/]+)/)
  return match ? match[1] : 'unknown'
}

/** App ID 到名称的映射 */
const appNameMap: Record<string, string> = {
  home: '主屏幕',
  chat: '微信',
  phone: '电话',
  email: '邮箱',
  browser: '浏览器',
  forum: '论坛',
  live: '直播',
  settings: '设置',
  moments: '朋友圈',
  profile: '个人主页',
  services: '服务',
  wallet: '钱包',
  creation: '创作',
}

export const useAppStateStore = defineStore('appState', () => {
  // App 状态映射：appId -> AppState
  const appStates = ref<Map<string, AppState>>(new Map())
  
  // 桌面容器的引用（用于计算相对位置）
  const containerRect = ref<DOMRect | null>(null)
  
  // 多任务切换界面是否显示
  const isAppSwitcherVisible = ref(false)
  
  /**
   * 获取 App 状态
   */
  function getAppState(appId: string): AppState | undefined {
    return appStates.value.get(appId)
  }
  
  /**
   * 获取 App 图标位置
   */
  function getIconPosition(appId: string): AppIconPosition | null {
    return appStates.value.get(appId)?.iconPosition ?? null
  }
  
  /**
   * 根据路由获取图标位置
   */
  function getIconPositionByRoute(route: string): AppIconPosition | null {
    const appId = getAppIdFromRoute(route)
    return getIconPosition(appId)
  }
  
  /**
   * 注册 App 图标位置
   * @param appId App 标识符（如 'chat', 'settings'）
   * @param position 图标位置（百分比）
   */
  function registerIconPosition(appId: string, position: AppIconPosition): void {
    const existing = appStates.value.get(appId)
    if (existing) {
      existing.iconPosition = position
    } else {
      appStates.value.set(appId, {
        iconPosition: position,
        lastRoute: null,
        isRunning: false,
        openedAt: null,
        name: appNameMap[appId] || appId
      })
    }
  }
  
  /**
   * 批量注册图标位置
   * @param positions 位置映射
   */
  function registerIconPositions(positions: Record<string, AppIconPosition>): void {
    for (const [appId, position] of Object.entries(positions)) {
      registerIconPosition(appId, position)
    }
  }
  
  /**
   * 从 DOM 元素计算并注册图标位置
   * @param appId App 标识符
   * @param element 图标 DOM 元素
   * @param container 容器元素（用于计算相对位置）
   */
  function registerIconFromElement(appId: string, element: HTMLElement, container: HTMLElement): void {
    const containerRect = container.getBoundingClientRect()
    const iconRect = element.getBoundingClientRect()
    
    // 计算图标中心点相对于容器的百分比位置
    const centerX = iconRect.left + iconRect.width / 2 - containerRect.left
    const centerY = iconRect.top + iconRect.height / 2 - containerRect.top
    
    const position: AppIconPosition = {
      x: (centerX / containerRect.width) * 100,
      y: (centerY / containerRect.height) * 100
    }
    
    registerIconPosition(appId, position)
  }
  
  /**
   * 更新 App 的最后访问路由
   */
  function updateLastRoute(appId: string, route: string): void {
    const existing = appStates.value.get(appId)
    if (existing) {
      existing.lastRoute = route
      existing.isRunning = true
      if (!existing.openedAt) {
        existing.openedAt = Date.now()
      }
    } else {
      appStates.value.set(appId, {
        iconPosition: null,
        lastRoute: route,
        isRunning: true,
        openedAt: Date.now(),
        name: appNameMap[appId] || appId
      })
    }
  }
  
  /**
   * 打开 App（标记为运行中）
   */
  function openApp(appId: string, route: string): void {
    const existing = appStates.value.get(appId)
    if (existing) {
      existing.lastRoute = route
      existing.isRunning = true
      existing.openedAt = Date.now()
    } else {
      appStates.value.set(appId, {
        iconPosition: null,
        lastRoute: route,
        isRunning: true,
        openedAt: Date.now(),
        name: appNameMap[appId] || appId
      })
    }
  }
  
  /**
   * 标记 App 为已关闭
   */
  function closeApp(appId: string): void {
    const existing = appStates.value.get(appId)
    if (existing) {
      existing.isRunning = false
      existing.openedAt = null
    }
  }
  
  /**
   * 关闭所有 App
   */
  function closeAllApps(): void {
    for (const [appId, state] of appStates.value.entries()) {
      if (appId !== 'home') {
        state.isRunning = false
        state.openedAt = null
      }
    }
  }
  
  /**
   * 获取所有正在运行的 App ID 列表
   */
  const runningApps = computed(() => {
    const result: string[] = []
    for (const [appId, state] of appStates.value.entries()) {
      if (state.isRunning && appId !== 'home') {
        result.push(appId)
      }
    }
    return result
  })
  
  /**
   * 获取运行中 App 的详细信息（按打开时间排序，最近打开的在前）
   */
  const runningAppInfos = computed((): RunningAppInfo[] => {
    const result: RunningAppInfo[] = []
    for (const [appId, state] of appStates.value.entries()) {
      if (state.isRunning && appId !== 'home' && state.lastRoute) {
        result.push({
          id: appId,
          name: state.name,
          lastRoute: state.lastRoute,
          iconPosition: state.iconPosition,
          openedAt: state.openedAt || 0
        })
      }
    }
    // 按打开时间倒序排列（最近打开的在前）
    return result.sort((a, b) => b.openedAt - a.openedAt)
  })
  
  /**
   * 显示多任务切换界面
   */
  function showAppSwitcher(): void {
    isAppSwitcherVisible.value = true
  }
  
  /**
   * 隐藏多任务切换界面
   */
  function hideAppSwitcher(): void {
    isAppSwitcherVisible.value = false
  }
  
  /**
   * 切换多任务切换界面显示状态
   */
  function toggleAppSwitcher(): void {
    isAppSwitcherVisible.value = !isAppSwitcherVisible.value
  }
  
  /**
   * 清除所有状态
   */
  function clearAll(): void {
    appStates.value.clear()
  }

  /**
   * 初始化应用
   * 尝试从云端恢复当前会话的数据
   */
  async function initApp() {
    // 1. 检查当前已有的会话 (如果有)
    const sessionId = sessionService.getCurrentSessionIdOrNull()
    if (sessionId) {
      await checkAndRestore(sessionId)
    }
    
    // 2. 监听 Bridge 连接事件 (处理后续连接的会话)
    const adapter = getBridgeAdapter()
    if (adapter) {
      adapter.on('bridge:platform_connected', async (info: any) => {
        if (info && info.chatId) {
          await checkAndRestore(info.chatId)
        }
      })
    }
  }

  async function checkAndRestore(sessionId: string) {
    console.log(`[AppState] Checking session: ${sessionId}`)
    const session = await sessionService.getSession(sessionId)
    
    if (!session) {
      console.log('[AppState] No local session found, attempting restore from cloud...')
      try {
        await cloudSyncService.restoreFromCloud()
      } catch (error) {
        console.error('[AppState] Restore from cloud failed:', error)
      }
    }
  }

  /**
   * 保存应用状态
   * 备份当前会话数据到云端
   */
  async function saveState() {
    try {
      await cloudSyncService.backupToCloud()
    } catch (error) {
      console.error('[AppState] Backup to cloud failed:', error)
    }
  }
  
  return {
    appStates,
    containerRect,
    isAppSwitcherVisible,
    getAppState,
    getIconPosition,
    getIconPositionByRoute,
    registerIconPosition,
    registerIconPositions,
    registerIconFromElement,
    updateLastRoute,
    openApp,
    closeApp,
    closeAllApps,
    runningApps,
    runningAppInfos,
    showAppSwitcher,
    hideAppSwitcher,
    toggleAppSwitcher,
    clearAll,
    initApp,
    saveState
  }
})
