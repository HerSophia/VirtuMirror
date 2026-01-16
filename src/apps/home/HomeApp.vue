<script setup lang="ts">
/**
 * Home App - 桌面主入口组件
 * 桌面本身就是一个 App，只是它比较特殊，是整个系统的入口
 * 支持多页滑动切换 + 一键整理功能（取消了拖拽排序）
 */
import { computed, ref, onMounted, onActivated, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePhoneStore } from '@/stores/phoneStore'
import { useAppStoreStore } from '@/stores/appStoreStore'
import { getAppIdFromRoute } from '@/stores/appStateStore'
import { setZoomOrigin } from '@/router'
import { getGlobalConfigService } from '@/services/globalConfigService'
import { DesktopGrid, DockBar, PageIndicator, RemoveAppDialog, AppContextMenu } from './components'
import { useIconPosition, useDesktopOrganize } from './composables'
import type { DesktopItem, AppItem, DesktopPage, AppQuickAction, DockAppItem } from './types'
import { useIconStore } from '@/stores/iconStore'
import { getIconRegistryService } from '@/services/iconRegistryService'
import { appRegistry } from '@/services/appRegistryService'

const router = useRouter()
const phoneStore = usePhoneStore()
const appStoreStore = useAppStoreStore()
const { setIconRef, registerAllIcons, getIconPosition } = useIconPosition()
const { autoAddApp, organizeDesktop, getOrganizePreview } = useDesktopOrganize()
const iconStore = useIconStore()
// Facade service 依然可用，但主要用于兼容旧代码，组件内推荐使用 store
const iconRegistryService = getIconRegistryService()
const iconRegistry = computed(() => iconStore.icons)

// 全局配置服务
const globalConfigService = getGlobalConfigService()

// 主屏幕容器引用
const homeAppRef = ref<HTMLElement | null>(null)
// 桌面页面容器引用
const pagesContainerRef = ref<HTMLElement | null>(null)

// ========== 编辑模式相关状态 ==========
const isEditMode = ref(false)
// 是否正在加载布局
const isLoadingLayout = ref(true)

// ========== 删除对话框相关状态 ==========
const showRemoveDialog = ref(false)
const appToRemove = ref<AppItem | null>(null)

// ========== 上下文菜单相关状态 ==========
const showContextMenu = ref(false)
const contextMenuApp = ref<AppItem | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

// ========== 整理确认对话框 ==========
const showOrganizeDialog = ref(false)
const organizePreview = ref<{ category: string; count: number }[]>([])

// ========== 空白区域长按菜单 ==========
const showQuickActions = ref(false)
const quickActionsPosition = ref({ x: 0, y: 0 })
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressStartPos = { x: 0, y: 0 }
const LONG_PRESS_DURATION = 500
const LONG_PRESS_MOVE_THRESHOLD = 10


// ========== 多页桌面相关状态 ==========
const currentPageIndex = ref(0)
const swipeProgress = ref(0)
const isSwiping = ref(false)

/**
 * 默认桌面布局配置（单页）
 */
const defaultPageItems: DesktopItem[] = [
  { id: 'app-wechat', type: 'app', iconId: 'wechat', name: '微信', route: '/chat', w: 1, h: 1 },
  { id: 'app-email', type: 'app', iconId: 'email', name: '邮箱', route: '/email', w: 1, h: 1 },
  { id: 'app-browser', type: 'app', iconId: 'browser', name: '浏览器', route: '/browser', w: 1, h: 1 },
  { id: 'app-live', type: 'app', iconId: 'live', name: '直播', route: '/live', w: 1, h: 1 },
  { id: 'app-appstore', type: 'app', iconId: 'appstore', name: '应用商店', route: '/app-store', w: 1, h: 1 },
  { id: 'app-tutorial', type: 'app', iconId: 'tutorial', name: '使用帮助', route: '/tutorial', w: 1, h: 1 },
  { id: 'app-prompts', type: 'app', iconId: 'prompts', name: '提示词', route: '/prompts', w: 1, h: 1 },
  { id: 'app-pathfinder-student', type: 'app', iconId: 'pathfinder-student', name: 'Pathfinder 学员', route: '/pathfinder-student', w: 1, h: 1 },
  { id: 'app-api-manager', type: 'app', iconId: 'api-manager', name: 'API 管理', route: '/api-manager', w: 1, h: 1 },
  { id: 'app-bridge', type: 'app', iconId: 'bridge', name: '桥接管理', route: '/bridge', w: 1, h: 1 },
  { id: 'app-gallery', type: 'app', iconId: 'gallery', name: '图库', route: '/gallery', w: 1, h: 1 },
  { id: 'app-weibo', type: 'app', iconId: 'weibo', name: '微博', route: '/weibo', w: 1, h: 1 },
  { id: 'app-account-manager', type: 'app', iconId: 'account-manager', name: '账号管理', route: '/account-manager', w: 1, h: 1 },
  { id: 'app-settings', type: 'app', iconId: 'settings', name: '设置', route: '/settings', w: 1, h: 1 },
]

// 监听已安装应用的变化，自动添加到桌面
watch(() => appStoreStore.installedApps, (newApps, oldApps) => {
  // 如果是第一次加载（oldApps 为 undefined），不处理
  if (!oldApps) return
  
  // 找出新安装的应用
  const addedApps = newApps.filter(newApp => !oldApps.some(oldApp => oldApp.id === newApp.id))
  
  if (addedApps.length > 0) {
    console.log('[HomeApp] 检测到新应用安装:', addedApps.map(a => a.package.name))
    
    addedApps.forEach(app => {
      // 检查是否已经在桌面上了
      const exists = desktopPages.value.some(page =>
        page.items.some(item => item.id === `app-${app.id}` || item.id === app.id)
      )
      
      if (!exists) {
        // 创建桌面项
        const newItem: DesktopItem = {
          id: `app-${app.id}`,
          type: 'app',
          iconId: app.id,
          name: app.package.name,
          route: `/app-store/app/${app.id}`,
          w: 1,
          h: 1,
          icon: app.package.icon
        }
        
        // 使用 autoAddApp 自动找空位添加
        autoAddApp(desktopPages.value, newItem, 4, 5)
      }
    })
    
    saveLayout()
  }
}, { deep: true })

// 多页桌面数据
const desktopPages = ref<DesktopPage[]>([
  { id: 'page-1', items: [...defaultPageItems] }
])

// Dock 栏 App ID 列表
const dockAppIds = ref<string[]>(['wechat', 'browser', 'email', 'live'])

/**
 * 获取当前页的桌面项（带动态 badge）
 */
const currentPageItems = computed<DesktopItem[]>(() => {
  const page = desktopPages.value[currentPageIndex.value]
  if (!page) return []
  
  return page.items.map(item => {
    if (item.type === 'app') {
      const appItem = item as AppItem
      // 使用响应式的 iconRegistry (Map)
      // 注意：iconRegistry 已经是一个 computed ref
      const registered = iconRegistry.value.get(appItem.iconId as string)
      
      // 合并动态属性
      const mergedItem = { ...appItem }
      
      // 如果注册信息中有图标配置，且当前item没有或需要更新，则合并
      if (registered?.icon) {
        mergedItem.icon = registered.icon
      }
      
      if (appItem.iconId === 'wechat') {
        mergedItem.badge = phoneStore.contactStore.totalUnreadCount
      } else if (appItem.iconId === 'email') {
        mergedItem.badge = phoneStore.unreadEmailCount
      }
      
      return mergedItem
    }
    return item
  })
})

/**
 * 总页数（实际页面数）
 */
const totalPages = computed(() => desktopPages.value.length)

/**
 * 计算页面滑动偏移
 */
const translateX = computed(() => {
  const baseOffset = -currentPageIndex.value * 100
  const dragOffset = swipeProgress.value * 100
  return baseOffset + dragOffset
})

/**
 * Dock 栏 App 列表
 */
const dockApps = computed<DockAppItem[]>(() => {
  return dockAppIds.value.map(id => {
    const registered = iconRegistryService.get(id)
    const baseApp: DockAppItem = {
      id,
      iconId: registered?.iconId || id,
      name: registered?.name || id,
      route: registered?.route || `/${id}`,
      icon: registered?.icon,
    }
    
    // 添加动态 badge
    if (id === 'wechat') {
      baseApp.badge = phoneStore.contactStore.totalUnreadCount
    } else if (id === 'email') {
      baseApp.badge = phoneStore.unreadEmailCount
    } else if (registered?.getBadge) {
      baseApp.badge = registered.getBadge()
    }
    
    return baseApp
  })
})

// ========== 滑动手势相关 ==========
let startX = 0
let startY = 0
let currentX = 0
let isDragging = false
let isHorizontalSwipe: boolean | null = null

/**
 * 检查触摸/点击位置是否在空白区域（不在 App 图标上）
 */
function isEmptyAreaClick(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return true
  
  // 检查是否点击在 App 图标、按钮或菜单上
  const isAppBlock = target.closest('.app-block, .app-icon-wrapper, .dock-bar, .edit-mode-hint, .organize-dialog, .context-menu, .quick-actions-menu')
  return !isAppBlock
}

/**
 * 开始空白区域长按检测
 */
function startLongPressDetection(clientX: number, clientY: number, target: EventTarget | null) {
  // 如果点击在 App 上，不处理
  if (!isEmptyAreaClick(target)) return
  
  // 如果已经显示菜单，不处理
  if (showContextMenu.value || showQuickActions.value) return
  
  longPressStartPos = { x: clientX, y: clientY }
  
  // 清除之前的定时器
  if (longPressTimer) {
    clearTimeout(longPressTimer)
  }
  
  longPressTimer = setTimeout(() => {
    // 震动反馈
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
    
    // 获取相对于 phone-frame 的位置
    const phoneFrame = document.querySelector('.phone-frame')
    let relativeX = clientX
    let relativeY = clientY
    
    if (phoneFrame) {
      const rect = phoneFrame.getBoundingClientRect()
      relativeX = clientX - rect.left
      relativeY = clientY - rect.top
    }
    
    // 显示快捷操作菜单
    quickActionsPosition.value = { x: relativeX, y: relativeY }
    showQuickActions.value = true
    
    console.log('[HomeApp] 空白区域长按，显示快捷操作')
  }, LONG_PRESS_DURATION)
}

/**
 * 取消长按检测
 */
function cancelLongPressDetection() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

/**
 * 检查移动是否超过阈值
 */
function checkLongPressMove(clientX: number, clientY: number) {
  const deltaX = Math.abs(clientX - longPressStartPos.x)
  const deltaY = Math.abs(clientY - longPressStartPos.y)
  
  if (deltaX > LONG_PRESS_MOVE_THRESHOLD || deltaY > LONG_PRESS_MOVE_THRESHOLD) {
    cancelLongPressDetection()
  }
}

/**
 * 关闭快捷操作菜单
 */
function closeQuickActions() {
  showQuickActions.value = false
}

function handleTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  currentX = startX
  isDragging = true
  isSwiping.value = true
  isHorizontalSwipe = null
  
  // 开始长按检测
  startLongPressDetection(startX, startY, e.target)
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging) return
  
  const deltaX = e.touches[0].clientX - startX
  const deltaY = e.touches[0].clientY - startY
  
  // 检查是否移动超过阈值，取消长按
  checkLongPressMove(e.touches[0].clientX, e.touches[0].clientY)
  
  // 判断滑动方向
  if (isHorizontalSwipe === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
    isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)
  }
  
  // 只处理水平滑动
  if (isHorizontalSwipe !== true) return
  
  currentX = e.touches[0].clientX
  
  // 计算滑动进度
  const containerWidth = pagesContainerRef.value?.offsetWidth || 375
  let progress = deltaX / containerWidth
  
  // 边界阻尼效果
  if (currentPageIndex.value === 0 && progress > 0) {
    progress = progress * 0.3
  } else if (currentPageIndex.value >= totalPages.value - 1 && progress < 0) {
    progress = progress * 0.3
  }
  
  swipeProgress.value = progress
  
  // 水平滑动时阻止默认行为
  if (isHorizontalSwipe) {
    e.preventDefault()
    e.stopPropagation()
  }
}

function handleTouchEnd() {
  // 取消长按检测
  cancelLongPressDetection()
  
  if (!isDragging) return
  isDragging = false
  
  const containerWidth = pagesContainerRef.value?.offsetWidth || 375
  const velocity = (currentX - startX) / containerWidth
  const threshold = 0.15
  
  // 判断是否切换页面
  if (Math.abs(swipeProgress.value) > threshold || Math.abs(velocity) > 0.3) {
    if (swipeProgress.value > 0 && currentPageIndex.value > 0) {
      currentPageIndex.value--
    } else if (swipeProgress.value < 0 && currentPageIndex.value < totalPages.value - 1) {
      currentPageIndex.value++
    }
  }
  
  swipeProgress.value = 0
  isSwiping.value = false
  isHorizontalSwipe = null
}

// 鼠标事件处理（PC 端支持）
function handleMouseDown(e: MouseEvent) {
  startX = e.clientX
  startY = e.clientY
  currentX = startX
  isDragging = true
  isSwiping.value = true
  isHorizontalSwipe = null
  
  // 开始长按检测
  startLongPressDetection(startX, startY, e.target)
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging) return
  
  const deltaX = e.clientX - startX
  const deltaY = e.clientY - startY
  
  // 检查是否移动超过阈值，取消长按
  checkLongPressMove(e.clientX, e.clientY)
  
  if (isHorizontalSwipe === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
    isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)
  }
  
  if (isHorizontalSwipe !== true) return
  
  currentX = e.clientX
  
  const containerWidth = pagesContainerRef.value?.offsetWidth || 375
  let progress = deltaX / containerWidth
  
  // 边界阻尼效果
  if (currentPageIndex.value === 0 && progress > 0) {
    progress = progress * 0.3
  } else if (currentPageIndex.value >= totalPages.value - 1 && progress < 0) {
    progress = progress * 0.3
  }
  
  swipeProgress.value = progress
}

function handleMouseUp() {
  // 取消长按检测
  cancelLongPressDetection()
  
  if (!isDragging) return
  isDragging = false
  
  const containerWidth = pagesContainerRef.value?.offsetWidth || 375
  const velocity = (currentX - startX) / containerWidth
  const threshold = 0.15
  
  // 判断是否切换页面
  if (Math.abs(swipeProgress.value) > threshold || Math.abs(velocity) > 0.3) {
    if (swipeProgress.value > 0 && currentPageIndex.value > 0) {
      currentPageIndex.value--
    } else if (swipeProgress.value < 0 && currentPageIndex.value < totalPages.value - 1) {
      currentPageIndex.value++
    }
  }
  
  swipeProgress.value = 0
  isSwiping.value = false
  isHorizontalSwipe = null
  
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

/**
 * 处理图标引用收集
 */
function handleIconRef(appId: string, el: HTMLElement | null) {
  setIconRef(appId, el)
}

/**
 * 打开 App
 */
function openApp(item: AppItem, event: MouseEvent | TouchEvent) {
  if (isEditMode.value) return
  
  const appId = getAppIdFromRoute(item.route)
  const iconPosition = getIconPosition(appId)
  
  if (iconPosition) {
    setZoomOrigin(iconPosition)
  } else {
    const container = homeAppRef.value
    if (container) {
      let clientX: number, clientY: number
      if ('touches' in event) {
        clientX = event.touches[0].clientX
        clientY = event.touches[0].clientY
      } else {
        clientX = event.clientX
        clientY = event.clientY
      }
      const rect = container.getBoundingClientRect()
      setZoomOrigin({
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100
      })
    }
  }
  
  router.push(item.route)
}

/**
 * 从 Dock 打开 App
 */
function openDockApp(app: DockAppItem, event: MouseEvent | TouchEvent) {
  if (isEditMode.value) return
  
  const appId = getAppIdFromRoute(app.route)
  const iconPosition = getIconPosition(appId)
  
  if (iconPosition) {
    setZoomOrigin(iconPosition)
  }
  
  router.push(app.route)
}

// ========== 编辑模式相关方法 ==========

/**
 * 进入编辑模式
 */
function enterEditMode() {
  isEditMode.value = true
  if (navigator.vibrate) {
    navigator.vibrate(50)
  }
}

/**
 * 退出编辑模式
 */
function exitEditMode() {
  isEditMode.value = false
  saveLayout()
}

/**
 * 处理长按事件（显示快捷菜单）
 */
function handleLongPress(item: DesktopItem, event: MouseEvent | TouchEvent) {
  console.log('[HomeApp] handleLongPress 被调用', { item, isEditMode: isEditMode.value })
  
  // 如果已经在编辑模式，不显示菜单
  if (isEditMode.value) {
    console.log('[HomeApp] 编辑模式下，跳过显示菜单')
    return
  }
  
  // 只处理 App 类型
  if (item.type !== 'app') {
    console.log('[HomeApp] 非 App 类型，跳过')
    return
  }
  
  const appItem = item as AppItem
  
  // 获取点击位置（视口坐标）
  let clientX: number, clientY: number
  if ('touches' in event && event.touches.length > 0) {
    clientX = event.touches[0].clientX
    clientY = event.touches[0].clientY
  } else if ('changedTouches' in event && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX
    clientY = event.changedTouches[0].clientY
  } else if ('clientX' in event) {
    clientX = event.clientX
    clientY = event.clientY
  } else {
    // 默认位置
    clientX = window.innerWidth / 2
    clientY = window.innerHeight / 2
  }
  
  // 获取 phone-frame 容器的位置，将视口坐标转换为容器内相对坐标
  const phoneFrame = document.querySelector('.phone-frame')
  let relativeX = clientX
  let relativeY = clientY
  
  if (phoneFrame) {
    const rect = phoneFrame.getBoundingClientRect()
    relativeX = clientX - rect.left
    relativeY = clientY - rect.top
  }
  
  console.log('[HomeApp] 显示上下文菜单', { appItem, clientX, clientY, relativeX, relativeY })
  
  // 显示上下文菜单（使用相对坐标）
  contextMenuApp.value = appItem
  contextMenuPosition.value = { x: relativeX, y: relativeY }
  showContextMenu.value = true
}

/**
 * 处理长按后拖拽事件（进入编辑模式）
 * 注意：现在编辑模式只用于显示整理按钮，不再支持拖拽排序
 */
function handleLongPressDrag(item: DesktopItem, event: MouseEvent | TouchEvent) {
  console.log('[HomeApp] handleLongPressDrag 被调用', { item })
  
  // 关闭可能打开的上下文菜单
  showContextMenu.value = false
  
  if (!isEditMode.value) {
    console.log('[HomeApp] 进入编辑模式')
    enterEditMode()
  }
}

/**
 * 关闭上下文菜单
 */
function closeContextMenu() {
  showContextMenu.value = false
  contextMenuApp.value = null
}

/**
 * 处理上下文菜单选择
 */
function handleContextMenuSelect(action: AppQuickAction) {
  const app = contextMenuApp.value
  if (!app) return
  
  switch (action.type) {
    case 'share':
      // TODO: 实现分享功能
      console.log('[HomeApp] 分享应用:', app.name)
      break
    case 'uninstall':
      // 打开卸载确认对话框
      appToRemove.value = app
      showRemoveDialog.value = true
      break
    case 'remove':
      // 从桌面移除图标
      handleRemoveIcon(app)
      break
    case 'shortcut':
      // 快捷入口，跳转到指定路由
      if (action.route) {
        router.push(action.route)
      }
      break
  }
  
  closeContextMenu()
}

// ========== 删除/卸载相关方法 ==========

/**
 * 打开删除确认对话框
 */
function handleDeleteApp(app: AppItem) {
  appToRemove.value = app
  showRemoveDialog.value = true
}

/**
 * 关闭删除对话框
 */
function closeRemoveDialog() {
  showRemoveDialog.value = false
  appToRemove.value = null
}

/**
 * 删除图标（只从桌面移除，不卸载应用）
 */
function handleRemoveIcon(app: AppItem) {
  if (!app) return
  
  // 从所有页面中查找并移除该图标
  for (const page of desktopPages.value) {
    const itemIndex = page.items.findIndex(item => item.id === `app-${app.id}` || item.id === app.id)
    if (itemIndex !== -1) {
      page.items.splice(itemIndex, 1)
      console.log('[HomeApp] 图标已从桌面移除:', app.name)
      break
    }
  }
  
  closeRemoveDialog()
  saveLayout()
}

/**
 * 卸载应用
 */
function handleUninstallApp(app: AppItem) {
  if (!app) return
  
  // 从所有页面中移除该图标
  desktopPages.value.forEach(page => {
    const itemIndex = page.items.findIndex(item => item.id === `app-${app.id}` || item.id === app.id)
    if (itemIndex !== -1) {
      page.items.splice(itemIndex, 1)
    }
  })
  
  // TODO: 实际的卸载逻辑（如果是第三方应用）
  // 可以调用 appStoreStore 的卸载方法
  
  console.log('[HomeApp] 应用已卸载:', app.name)
  closeRemoveDialog()
  saveLayout()
}

// ========== 一键整理相关方法 ==========

/**
 * 显示整理确认对话框
 */
function showOrganizeConfirm() {
  // 获取整理预览
  organizePreview.value = getOrganizePreview(desktopPages.value)
  showOrganizeDialog.value = true
}

/**
 * 执行一键整理
 */
function doOrganize() {
  console.log('[HomeApp] 执行一键整理')
  
  // 使用整理功能重新排列
  const newPages = organizeDesktop(desktopPages.value, 4, 5)
  desktopPages.value = newPages
  
  // 回到第一页
  currentPageIndex.value = 0
  
  // 保存布局
  saveLayout()
  
  // 关闭对话框和编辑模式
  showOrganizeDialog.value = false
  exitEditMode()
  
  // 震动反馈
  if (navigator.vibrate) {
    navigator.vibrate([50, 50, 50])
  }
}

/**
 * 取消整理
 */
function cancelOrganize() {
  showOrganizeDialog.value = false
}

/**
 * 快捷操作：一键整理
 */
function handleQuickOrganize() {
  closeQuickActions()
  showOrganizeConfirm()
}

/**
 * 快捷操作：编辑桌面
 */
function handleQuickEditMode() {
  closeQuickActions()
  enterEditMode()
}

/**
 * 获取指定页面的桌面项（带动态 badge）
 */
function getPageItems(pageIndex: number): DesktopItem[] {
  const page = desktopPages.value[pageIndex]
  if (!page) return []
  
  return page.items.map(item => {
    if (item.type === 'app') {
      const appItem = item as AppItem
      const registered = iconRegistryService.get(appItem.iconId as string)
      
      // Debug log for Weibo
      if (appItem.iconId === 'weibo') {
        console.log('[HomeApp] getPageItems weibo:', {
          iconId: appItem.iconId,
          registered: registered,
          hasIcon: !!registered?.icon,
          iconValue: registered?.icon?.value
        })
      }
      
      // 合并动态属性
      const mergedItem = { ...appItem }
      
      // 如果注册信息中有图标配置，且当前item没有或需要更新，则合并
      if (registered?.icon) {
        mergedItem.icon = registered.icon
      }
      
      if (appItem.iconId === 'wechat') {
        mergedItem.badge = phoneStore.contactStore.totalUnreadCount
      } else if (appItem.iconId === 'email') {
        mergedItem.badge = phoneStore.unreadEmailCount
      }
      
      return mergedItem
    }
    return item
  })
}

// ========== 持久化相关方法 ==========

/**
 * 从全局配置加载桌面布局
 */
function loadLayout() {
  isLoadingLayout.value = true
  
  try {
    const savedLayout = globalConfigService.getDesktopLayout()
    
    if (savedLayout) {
      // 优先使用新的多页格式
      if (savedLayout.pages && savedLayout.pages.length > 0) {
        desktopPages.value = savedLayout.pages
        dockAppIds.value = savedLayout.dockAppIds
        currentPageIndex.value = savedLayout.currentPageIndex ?? 0
        console.info('[HomeApp] 已加载多页桌面布局', {
          pageCount: savedLayout.pages.length,
          totalItems: savedLayout.pages.reduce((sum, p) => sum + p.items.length, 0),
          dockCount: savedLayout.dockAppIds.length,
        })
      }
      // 兼容旧的单页布局：转换为多页格式
      else if (savedLayout.items && savedLayout.items.length > 0) {
        desktopPages.value = [{ id: 'page-1', items: savedLayout.items }]
        dockAppIds.value = savedLayout.dockAppIds
        console.info('[HomeApp] 已加载保存的桌面布局（旧格式）', {
          itemCount: savedLayout.items.length,
          dockCount: savedLayout.dockAppIds.length,
        })
      } else {
        // 使用默认布局
        desktopPages.value = [{ id: 'page-1', items: [...defaultPageItems] }]
        console.info('[HomeApp] 使用默认桌面布局')
      }
    } else {
      // 使用默认布局
      desktopPages.value = [{ id: 'page-1', items: [...defaultPageItems] }]
      console.info('[HomeApp] 使用默认桌面布局')
    }

    // 处理通过 appRegistry 注册但尚未添加到桌面的 App
    const pendingApps = appRegistry.processPendingDesktopApps()
    if (pendingApps.length > 0) {
      console.info(`[HomeApp] 处理了 ${pendingApps.length} 个待添加的 App`)
    }
  } catch (error) {
    console.error('[HomeApp] 加载桌面布局失败:', error)
    desktopPages.value = [{ id: 'page-1', items: [...defaultPageItems] }]
  } finally {
    isLoadingLayout.value = false
  }
}

/**
 * 保存桌面布局到全局配置（多页格式）
 */
function saveLayout() {
  try {
    globalConfigService.saveDesktopLayoutPages(
      desktopPages.value,
      dockAppIds.value,
      currentPageIndex.value
    )
    console.info('[HomeApp] 桌面布局已保存（多页格式）', {
      pageCount: desktopPages.value.length,
      totalItems: desktopPages.value.reduce((sum, p) => sum + p.items.length, 0),
    })
  } catch (error) {
    console.error('[HomeApp] 保存桌面布局失败:', error)
  }
}

/**
 * 重置桌面布局为默认
 */
function resetLayout() {
  globalConfigService.clearDesktopLayout()
  desktopPages.value = [{ id: 'page-1', items: [...defaultPageItems] }]
  dockAppIds.value = ['wechat', 'browser', 'email', 'live']
  currentPageIndex.value = 0
  console.info('[HomeApp] 桌面布局已重置')
}

// 组件挂载和激活时注册图标位置
onMounted(() => {
  loadLayout()
  
  nextTick(() => {
    if (homeAppRef.value) {
      registerAllIcons(homeAppRef.value)
    }
  })
  
  // 添加触摸事件监听
  const container = pagesContainerRef.value
  if (container) {
    container.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    container.addEventListener('touchend', handleTouchEnd, { capture: true })
  }
})

onActivated(() => {
  nextTick(() => {
    if (homeAppRef.value) {
      registerAllIcons(homeAppRef.value)
    }
  })
})

onUnmounted(() => {
  const container = pagesContainerRef.value
  if (container) {
    container.removeEventListener('touchstart', handleTouchStart, { capture: true } as EventListenerOptions)
    container.removeEventListener('touchmove', handleTouchMove, { capture: true } as EventListenerOptions)
    container.removeEventListener('touchend', handleTouchEnd, { capture: true } as EventListenerOptions)
  }
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div
    ref="homeAppRef"
    class="home-app"
    :class="{ 'is-edit-mode': isEditMode }"
  >
    <!-- 多页桌面容器 -->
    <div
      ref="pagesContainerRef"
      class="pages-container"
      @mousedown="handleMouseDown"
    >
      <div
        class="pages-wrapper"
        :class="{ 'is-swiping': isSwiping }"
        :style="{ transform: `translateX(${translateX}%)` }"
      >
        <!-- 现有页面 - 渲染所有页面以支持滑动时显示 -->
        <div
          v-for="(page, pageIndex) in desktopPages"
          :key="page.id"
          class="page"
        >
          <DesktopGrid
            :items="getPageItems(pageIndex)"
            :is-edit-mode="isEditMode"
            :page-index="pageIndex"
            :is-active="pageIndex === currentPageIndex"
            @open="openApp"
            @icon-ref="handleIconRef"
            @long-press="handleLongPress"
            @long-press-drag="handleLongPressDrag"
            @delete-app="handleDeleteApp"
          />
        </div>
      </div>
    </div>
    
    <!-- 页面指示器 -->
    <PageIndicator
      v-if="totalPages > 1"
      :total="totalPages"
      :current="currentPageIndex"
      :progress="swipeProgress"
    />
    
    <DockBar
      :apps="dockApps"
      @open="openDockApp"
    />
    
    <!-- 编辑模式提示 -->
    <Transition name="fade">
      <div v-if="isEditMode" class="edit-mode-hint">
        <button class="organize-btn" @click="showOrganizeConfirm">
          <span class="icon">📱</span>
          <span>一键整理</span>
        </button>
        <button class="done-btn" @click="exitEditMode">完成</button>
      </div>
    </Transition>
    
    <!-- 删除/卸载对话框 -->
    <RemoveAppDialog
      :visible="showRemoveDialog"
      :app="appToRemove"
      @cancel="closeRemoveDialog"
      @remove-icon="handleRemoveIcon"
      @uninstall="handleUninstallApp"
    />
    
    <!-- App 快捷操作菜单 -->
    <AppContextMenu
      v-model:visible="showContextMenu"
      :app="contextMenuApp"
      :x="contextMenuPosition.x"
      :y="contextMenuPosition.y"
      @select="handleContextMenuSelect"
      @close="closeContextMenu"
    />
    
    <!-- 空白区域长按快捷操作菜单 -->
    <Transition name="pop">
      <div
        v-if="showQuickActions"
        class="quick-actions-overlay"
        @click="closeQuickActions"
      >
        <div
          class="quick-actions-menu"
          :style="{
            left: `${quickActionsPosition.x}px`,
            top: `${Math.max(60, quickActionsPosition.y - 60)}px`,
          }"
          @click.stop
        >
          <button class="quick-action-btn" @click="handleQuickOrganize">
            <span class="icon">✨</span>
            <span>一键整理</span>
          </button>
          <button class="quick-action-btn" @click="handleQuickEditMode">
            <span class="icon">✏️</span>
            <span>编辑桌面</span>
          </button>
        </div>
      </div>
    </Transition>
    
    <!-- 整理确认对话框 -->
    <Transition name="fade">
      <div v-if="showOrganizeDialog" class="organize-dialog-overlay" @click.self="cancelOrganize">
        <div class="organize-dialog">
          <h3 class="dialog-title">一键整理桌面</h3>
          <p class="dialog-desc">将按照应用功能自动分类排列：</p>
          <ul class="category-list">
            <li v-for="item in organizePreview" :key="item.category">
              <span class="category-name">{{ item.category }}</span>
              <span class="category-count">{{ item.count }} 个应用</span>
            </li>
          </ul>
          <div class="dialog-actions">
            <button class="cancel-btn" @click="cancelOrganize">取消</button>
            <button class="confirm-btn" @click="doOrganize">确认整理</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.home-app {
  @apply h-full flex flex-col relative;
  background: var(--wallpaper-homescreen);
  background-size: cover;
  background-position: center;
  transition: background 0.3s ease;
}

.home-app.is-edit-mode {
  /* 编辑模式下可以添加一些视觉效果 */
}

/* 多页桌面容器 */
.pages-container {
  @apply flex-1 overflow-hidden;
  touch-action: pan-y pinch-zoom;
}

.pages-wrapper {
  @apply h-full flex;
  transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.pages-wrapper.is-swiping {
  transition: none;
}

.page {
  @apply h-full flex-shrink-0;
  width: 100%;
}

/* 编辑模式提示 */
.edit-mode-hint {
  @apply absolute top-2 left-1/2 -translate-x-1/2;
  @apply px-3 py-2 rounded-full;
  @apply bg-black/60 backdrop-blur-sm;
  @apply flex items-center gap-2;
  @apply text-white text-sm;
  z-index: 100;
}

.organize-btn {
  @apply px-3 py-1 rounded-full;
  @apply bg-blue-500 hover:bg-blue-600;
  @apply text-white text-sm font-medium;
  @apply transition-colors;
  @apply flex items-center gap-1;
}

.organize-btn .icon {
  @apply text-base;
}

.done-btn {
  @apply px-3 py-1 rounded-full;
  @apply bg-white/20 hover:bg-white/30;
  @apply text-white text-sm font-medium;
  @apply transition-colors;
}

/* 整理对话框 */
.organize-dialog-overlay {
  @apply fixed inset-0 z-50;
  @apply bg-black/50 backdrop-blur-sm;
  @apply flex items-center justify-center p-4;
}

.organize-dialog {
  @apply bg-white rounded-2xl p-5 w-full max-w-xs;
  @apply shadow-2xl;
}

.dialog-title {
  @apply text-lg font-bold text-gray-900 mb-2;
}

.dialog-desc {
  @apply text-sm text-gray-600 mb-3;
}

.category-list {
  @apply space-y-2 mb-4;
}

.category-list li {
  @apply flex justify-between items-center;
  @apply px-3 py-2 rounded-lg bg-gray-100;
}

.category-name {
  @apply text-sm font-medium text-gray-800;
}

.category-count {
  @apply text-xs text-gray-500;
}

.dialog-actions {
  @apply flex gap-3;
}

.cancel-btn {
  @apply flex-1 py-2 rounded-lg;
  @apply bg-gray-200 text-gray-700;
  @apply hover:bg-gray-300 transition-colors;
  @apply text-sm font-medium;
}

.confirm-btn {
  @apply flex-1 py-2 rounded-lg;
  @apply bg-blue-500 text-white;
  @apply hover:bg-blue-600 transition-colors;
  @apply text-sm font-medium;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.organize-dialog-overlay.fade-enter-from .organize-dialog,
.organize-dialog-overlay.fade-leave-to .organize-dialog {
  transform: scale(0.95);
}

/* 空白区域快捷操作菜单 */
.quick-actions-overlay {
  @apply fixed inset-0 z-40;
}

.quick-actions-menu {
  @apply absolute;
  @apply bg-white/95 backdrop-blur-lg rounded-2xl;
  @apply shadow-2xl border border-white/20;
  @apply p-2 min-w-[140px];
  transform: translateX(-50%);
}

.quick-action-btn {
  @apply w-full px-4 py-3 rounded-xl;
  @apply flex items-center gap-3;
  @apply text-gray-800 text-sm font-medium;
  @apply hover:bg-gray-100 active:bg-gray-200;
  @apply transition-colors;
}

.quick-action-btn .icon {
  @apply text-lg;
}

/* 弹出动画 */
.pop-enter-active {
  transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.pop-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.pop-enter-from {
  opacity: 0;
}

.pop-enter-from .quick-actions-menu {
  transform: translateX(-50%) scale(0.8);
}

.pop-leave-to {
  opacity: 0;
}

.pop-leave-to .quick-actions-menu {
  transform: translateX(-50%) scale(0.9);
}
</style>
