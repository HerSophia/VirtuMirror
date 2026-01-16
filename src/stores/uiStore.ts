/**
 * UI状态管理Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ViewName, SubViewName, UICustomization, UIPosition } from '@/types'

/** 下拉面板类型 */
export type PullDownPanelType = 'none' | 'notification' | 'control'

export const useUIStore = defineStore('ui', () => {
  // ==================== 状态 ====================
  
  /** 面板是否可见 */
  const isPanelVisible = ref(false)
  
  /** 当前打开的下拉面板 */
  const activePullDownPanel = ref<PullDownPanelType>('none')
  
  /** 下拉面板的拖拽进度 (0-1) */
  const pullDownProgress = ref(0)
  
  /** 是否正在拖拽下拉面板 */
  const isPullingDown = ref(false)
  
  /** 当前视图 */
  const currentView = ref<ViewName>('HomeScreen')
  
  /** 前一个视图（用于返回） */
  const previousView = ref<ViewName | null>(null)
  
  /** 子视图状态 */
  const activeSubviews = ref<Record<string, SubViewName>>({
    chatapp: 'messages',
    phoneapp: 'contacts',
  })
  
  /** 导航锁（防止快速点击导致的动画问题） */
  const isNavigating = ref(false)
  
  /** 当前活跃的联系人ID */
  const activeContactId = ref<string | null>(null)
  
  /** 当前活跃的个人主页ID */
  const activeProfileId = ref<string | null>(null)
  
  /** 当前活跃的邮件ID */
  const activeEmailId = ref<string | null>(null)
  
  /** 当前活跃的论坛板块ID */
  const activeForumBoardId = ref<string | null>(null)
  
  /** 当前活跃的论坛帖子ID */
  const activeForumPostId = ref<string | null>(null)
  
  /** 当前活跃的直播板块ID */
  const activeLiveBoardId = ref<string | null>(null)
  
  /** 当前活跃的直播间ID */
  const activeLiveStreamId = ref<string | null>(null)
  
  /** 创建页面上下文 */
  const creationContext = ref<'forum' | 'live' | null>(null)
  const creationBoardContext = ref<string | null>(null)
  
  /** UI位置 */
  const position = ref<UIPosition>({
    x: 0,
    y: 0,
    scale: 1,
  })
  
  /** UI自定义设置 */
  const customization = ref<UICustomization>({
    enabled: true,
    playerNickname: '玩家',
    playerAvatar: undefined,
    homescreenWallpaper: undefined,
    chatlistWallpaper: undefined,
    chatviewWallpaper: undefined,
    muted: false,
  })
  
  /** 当前时间显示 */
  const currentTime = ref(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  
  // ==================== 计算属性 ====================
  
  /** 是否在主屏幕 */
  const isOnHomeScreen = computed(() => currentView.value === 'HomeScreen')
  
  /** 是否在聊天对话页 */
  const isInConversation = computed(() => currentView.value === 'ChatConversation')
  
  /** 是否在通话中 */
  const isInCall = computed(() =>
    currentView.value === 'VoiceCall' || currentView.value === 'PhoneCall'
  )
  
  /** 是否有下拉面板打开 */
  const hasPullDownPanelOpen = computed(() => activePullDownPanel.value !== 'none')
  
  /** 通知中心是否打开 */
  const isNotificationCenterOpen = computed(() => activePullDownPanel.value === 'notification')
  
  /** 控制中心是否打开 */
  const isControlCenterOpen = computed(() => activePullDownPanel.value === 'control')
  
  // ==================== 操作 ====================
  
  /** 切换面板可见性 */
  function togglePanel(visible?: boolean) {
    isPanelVisible.value = visible ?? !isPanelVisible.value
  }
  
  /** 导航到视图 */
  function navigateTo(view: ViewName, options?: {
    activeId?: string
    context?: 'forum' | 'live'
    boardId?: string
    forceRerender?: boolean
    isTabSwitch?: boolean
  }) {
    if (isNavigating.value && !options?.forceRerender) {
      return
    }
    
    isNavigating.value = true
    previousView.value = currentView.value
    currentView.value = view
    
    // 设置相应的活跃ID
    if (options?.activeId) {
      switch (view) {
        case 'ChatConversation':
        case 'GroupMembers':
        case 'GroupInvite':
          activeContactId.value = options.activeId
          break
        case 'Homepage':
          activeProfileId.value = options.activeId
          break
        case 'EmailDetail':
          activeEmailId.value = options.activeId
          break
        case 'ForumPostList':
          activeForumBoardId.value = options.activeId
          break
        case 'ForumPostDetail':
          activeForumPostId.value = options.activeId
          break
        case 'LiveStreamList':
          activeLiveBoardId.value = options.activeId
          break
        case 'LiveStreamRoom':
          activeLiveStreamId.value = options.activeId
          break
      }
    }
    
    // 设置创建上下文
    if (view === 'Creation') {
      creationContext.value = options?.context || null
      creationBoardContext.value = options?.boardId || null
    }
    
    // 导航动画完成后解锁
    setTimeout(() => {
      isNavigating.value = false
    }, 350)
  }
  
  /** 返回上一个视图 */
  function goBack() {
    if (previousView.value) {
      navigateTo(previousView.value)
    } else {
      navigateTo('HomeScreen')
    }
  }
  
  /** 返回主屏幕 */
  function goHome() {
    navigateTo('HomeScreen')
  }
  
  /** 设置子视图 */
  function setSubview(app: string, subview: SubViewName) {
    activeSubviews.value[app] = subview
  }
  
  /** 更新位置 */
  function updatePosition(newPosition: Partial<UIPosition>) {
    position.value = { ...position.value, ...newPosition }
  }
  
  /** 重置位置 */
  function resetPosition() {
    position.value = { x: 0, y: 0, scale: 1 }
  }
  
  /** 更新自定义设置 */
  function updateCustomization(settings: Partial<UICustomization>) {
    customization.value = { ...customization.value, ...settings }
  }
  
  /** 更新时间 */
  function updateTime() {
    currentTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  /** 切换静音 */
  function toggleMute() {
    customization.value.muted = !customization.value.muted
  }
  
  /** 打开下拉面板 */
  function openPullDownPanel(panel: PullDownPanelType) {
    activePullDownPanel.value = panel
    pullDownProgress.value = 1
  }
  
  /** 关闭下拉面板 */
  function closePullDownPanel() {
    activePullDownPanel.value = 'none'
    pullDownProgress.value = 0
    isPullingDown.value = false
  }
  
  /** 切换下拉面板 */
  function togglePullDownPanel(panel: Exclude<PullDownPanelType, 'none'>) {
    if (activePullDownPanel.value === panel) {
      closePullDownPanel()
    } else {
      openPullDownPanel(panel)
    }
  }
  
  /** 设置下拉进度 */
  function setPullDownProgress(progress: number) {
    pullDownProgress.value = Math.max(0, Math.min(1, progress))
    if (progress <= 0) {
      closePullDownPanel()
    }
  }
  
  /** 开始拖拽下拉 */
  function startPulling(panel: Exclude<PullDownPanelType, 'none'>) {
    isPullingDown.value = true
    activePullDownPanel.value = panel
  }
  
  /** 结束拖拽下拉 */
  function endPulling() {
    isPullingDown.value = false
    // 如果进度超过阈值就完全打开，否则关闭
    if (pullDownProgress.value > 0.3) {
      pullDownProgress.value = 1
    } else {
      closePullDownPanel()
    }
  }
  
  // 启动时间更新定时器
  setInterval(updateTime, 60000)
  
  return {
    // 状态
    isPanelVisible,
    currentView,
    previousView,
    activeSubviews,
    isNavigating,
    activeContactId,
    activeProfileId,
    activeEmailId,
    activeForumBoardId,
    activeForumPostId,
    activeLiveBoardId,
    activeLiveStreamId,
    creationContext,
    creationBoardContext,
    position,
    customization,
    currentTime,
    activePullDownPanel,
    pullDownProgress,
    isPullingDown,
    
    // 计算属性
    isOnHomeScreen,
    isInConversation,
    isInCall,
    hasPullDownPanelOpen,
    isNotificationCenterOpen,
    isControlCenterOpen,
    
    // 操作
    togglePanel,
    navigateTo,
    goBack,
    goHome,
    setSubview,
    updatePosition,
    resetPosition,
    updateCustomization,
    updateTime,
    toggleMute,
    openPullDownPanel,
    closePullDownPanel,
    togglePullDownPanel,
    setPullDownProgress,
    startPulling,
    endPulling,
  }
}, {
  persist: {
    key: 'phone-sim-ui-state',
    paths: [
      'isPanelVisible',
      'currentView',
      'activeSubviews',
      'position',
      'customization',
      // 注意：不持久化下拉面板状态，每次刷新都应该关闭
      // 'activePullDownPanel',
      // 'pullDownProgress',
      // 'isPullingDown',
    ],
  },
})