<script setup lang="ts">
/**
 * 多任务切换组件
 * 
 * 功能：
 * - 显示所有运行中的 App 卡片
 * - 支持横向滚动浏览
 * - 点击卡片切换到对应 App
 * - 向上滑动卡片关闭 App
 * - 一键清除所有 App
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStateStore, getAppIdFromRoute, type RunningAppInfo } from '@/stores/appStateStore'
import { setZoomOrigin, setTransitionType } from '@/router'
import AppIcon from '@/components/common/AppIcon.vue'
import type { AppIconId } from '@/types/theme'

const router = useRouter()
const appStateStore = useAppStateStore()

// 卡片容器引用
const cardsContainerRef = ref<HTMLElement | null>(null)
const cardsScrollRef = ref<HTMLElement | null>(null)

// 当前正在滑动关闭的卡片 ID
const closingAppId = ref<string | null>(null)
const closingProgress = ref(0)

// 当前聚焦的卡片索引
const currentCardIndex = ref(0)

// 各卡片的滑动状态
const cardSwipeStates = ref<Map<string, { offsetX: number; offsetY: number; isDragging: boolean }>>(new Map())

// 运行中的 App 列表
const runningApps = computed(() => appStateStore.runningAppInfos)

// 是否有运行中的 App
const hasRunningApps = computed(() => runningApps.value.length > 0)

// App ID 到图标 ID 的映射
const appIdToIconId: Record<string, AppIconId> = {
  chat: 'wechat',
  phone: 'phone',
  email: 'email',
  browser: 'browser',
  forum: 'forum',
  live: 'live',
  settings: 'settings',
  moments: 'moments',
  profile: 'contacts',
  services: 'wallet',
  wallet: 'wallet',
  creation: 'notes',
}

/**
 * 获取 App 的图标 ID
 */
function getIconId(appId: string): AppIconId {
  return appIdToIconId[appId] || 'settings'
}

/**
 * 切换到指定 App
 */
function switchToApp(app: RunningAppInfo): void {
  // 设置动画原点到卡片位置（使用图标位置或屏幕中心）
  if (app.iconPosition) {
    setZoomOrigin(app.iconPosition)
  } else {
    setZoomOrigin({ x: 50, y: 50 })
  }
  
  // 使用 zoom 动画
  setTransitionType('zoom')
  
  // 隐藏多任务界面
  appStateStore.hideAppSwitcher()
  
  // 导航到 App
  router.push(app.lastRoute)
}

/**
 * 关闭指定 App
 */
function closeApp(appId: string, event: Event): void {
  event.stopPropagation()
  appStateStore.closeApp(appId)
}

/**
 * 清除所有 App
 */
function clearAllApps(): void {
  appStateStore.closeAllApps()
}

/**
 * 返回桌面
 */
function goHome(): void {
  setTransitionType('zoom')
  appStateStore.hideAppSwitcher()
  router.push('/')
}

// ============ 卡片滑动关闭手势处理 ============
// 支持向上、向左、向右三个方向滑动关闭

interface SwipeState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  isDragging: boolean
  startTime: number
  direction: 'none' | 'horizontal' | 'vertical' // 滑动方向锁定
}

interface CardSwipeState {
  offsetX: number
  offsetY: number
  isDragging: boolean
}

const swipeStates = ref<Map<string, SwipeState>>(new Map())

// 方向判断阈值（超过此距离后锁定滑动方向）
const DIRECTION_LOCK_THRESHOLD = 10

function handleCardTouchStart(appId: string, event: TouchEvent): void {
  const touch = event.touches[0]
  swipeStates.value.set(appId, {
    startX: touch.clientX,
    startY: touch.clientY,
    currentX: touch.clientX,
    currentY: touch.clientY,
    isDragging: true,
    startTime: Date.now(),
    direction: 'none'
  })
  
  cardSwipeStates.value.set(appId, {
    offsetX: 0,
    offsetY: 0,
    isDragging: true
  })
}

function handleCardTouchMove(appId: string, event: TouchEvent): void {
  const state = swipeStates.value.get(appId)
  if (!state?.isDragging) return
  
  const touch = event.touches[0]
  const deltaX = touch.clientX - state.startX
  const deltaY = touch.clientY - state.startY
  
  // 确定滑动方向（首次超过阈值时锁定）
  if (state.direction === 'none') {
    if (Math.abs(deltaX) > DIRECTION_LOCK_THRESHOLD || Math.abs(deltaY) > DIRECTION_LOCK_THRESHOLD) {
      state.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
      swipeStates.value.set(appId, state)
    }
  }
  
  // 根据锁定的方向处理滑动
  if (state.direction === 'horizontal') {
    // 水平滑动 - 左右关闭
    event.preventDefault()
    cardSwipeStates.value.set(appId, {
      offsetX: deltaX,
      offsetY: 0,
      isDragging: true
    })
    closingAppId.value = appId
    closingProgress.value = Math.min(Math.abs(deltaX) / 150, 1)
  } else if (state.direction === 'vertical' && deltaY < 0) {
    // 向上滑动
    event.preventDefault()
    cardSwipeStates.value.set(appId, {
      offsetX: 0,
      offsetY: deltaY,
      isDragging: true
    })
    closingAppId.value = appId
    closingProgress.value = Math.min(Math.abs(deltaY) / 200, 1)
  }
}

function handleCardTouchEnd(appId: string, event: TouchEvent): void {
  const state = swipeStates.value.get(appId)
  const cardState = cardSwipeStates.value.get(appId)
  
  if (!state || !cardState) return
  
  const { offsetX, offsetY } = cardState
  const duration = Date.now() - state.startTime
  
  // 判断是否应该关闭
  let shouldClose = false
  let flyOutX = 0
  let flyOutY = 0
  
  if (state.direction === 'horizontal') {
    // 水平方向 - 左右滑动关闭
    const velocityX = Math.abs(offsetX) / duration
    if (Math.abs(offsetX) > 100 || (velocityX > 0.5 && Math.abs(offsetX) > 50)) {
      shouldClose = true
      flyOutX = offsetX > 0 ? 500 : -500
    }
  } else if (state.direction === 'vertical') {
    // 垂直方向 - 向上滑动关闭
    const velocityY = Math.abs(offsetY) / duration
    if (offsetY < -100 || (velocityY > 0.5 && offsetY < -50)) {
      shouldClose = true
      flyOutY = -500
    }
  }
  
  if (shouldClose) {
    // 添加飞出动画
    cardSwipeStates.value.set(appId, {
      offsetX: flyOutX,
      offsetY: flyOutY,
      isDragging: false
    })
    
    // 延迟关闭以显示动画
    setTimeout(() => {
      appStateStore.closeApp(appId)
      cardSwipeStates.value.delete(appId)
    }, 200)
  } else {
    // 回弹
    cardSwipeStates.value.set(appId, {
      offsetX: 0,
      offsetY: 0,
      isDragging: false
    })
  }
  
  swipeStates.value.delete(appId)
  closingAppId.value = null
  closingProgress.value = 0
}

// 鼠标事件支持
function handleCardMouseDown(appId: string, event: MouseEvent): void {
  const state: SwipeState = {
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    isDragging: true,
    startTime: Date.now(),
    direction: 'none'
  }
  swipeStates.value.set(appId, state)
  
  cardSwipeStates.value.set(appId, {
    offsetX: 0,
    offsetY: 0,
    isDragging: true
  })
  
  const handleMouseMove = (e: MouseEvent) => {
    const swipeState = swipeStates.value.get(appId)
    if (!swipeState?.isDragging) return
    
    const deltaX = e.clientX - swipeState.startX
    const deltaY = e.clientY - swipeState.startY
    
    // 确定滑动方向
    if (swipeState.direction === 'none') {
      if (Math.abs(deltaX) > DIRECTION_LOCK_THRESHOLD || Math.abs(deltaY) > DIRECTION_LOCK_THRESHOLD) {
        swipeState.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
        swipeStates.value.set(appId, swipeState)
      }
    }
    
    if (swipeState.direction === 'horizontal') {
      cardSwipeStates.value.set(appId, {
        offsetX: deltaX,
        offsetY: 0,
        isDragging: true
      })
      closingAppId.value = appId
      closingProgress.value = Math.min(Math.abs(deltaX) / 150, 1)
    } else if (swipeState.direction === 'vertical' && deltaY < 0) {
      cardSwipeStates.value.set(appId, {
        offsetX: 0,
        offsetY: deltaY,
        isDragging: true
      })
      closingAppId.value = appId
      closingProgress.value = Math.min(Math.abs(deltaY) / 200, 1)
    }
  }
  
  const handleMouseUp = (e: MouseEvent) => {
    const swipeState = swipeStates.value.get(appId)
    const cardState = cardSwipeStates.value.get(appId)
    
    if (swipeState && cardState) {
      const { offsetX, offsetY } = cardState
      const duration = Date.now() - swipeState.startTime
      
      let shouldClose = false
      let flyOutX = 0
      let flyOutY = 0
      
      if (swipeState.direction === 'horizontal') {
        const velocityX = Math.abs(offsetX) / duration
        if (Math.abs(offsetX) > 100 || (velocityX > 0.5 && Math.abs(offsetX) > 50)) {
          shouldClose = true
          flyOutX = offsetX > 0 ? 500 : -500
        }
      } else if (swipeState.direction === 'vertical') {
        const velocityY = Math.abs(offsetY) / duration
        if (offsetY < -100 || (velocityY > 0.5 && offsetY < -50)) {
          shouldClose = true
          flyOutY = -500
        }
      }
      
      if (shouldClose) {
        cardSwipeStates.value.set(appId, {
          offsetX: flyOutX,
          offsetY: flyOutY,
          isDragging: false
        })
        
        setTimeout(() => {
          appStateStore.closeApp(appId)
          cardSwipeStates.value.delete(appId)
        }, 200)
      } else {
        cardSwipeStates.value.set(appId, {
          offsetX: 0,
          offsetY: 0,
          isDragging: false
        })
      }
    }
    
    swipeStates.value.delete(appId)
    closingAppId.value = null
    closingProgress.value = 0
    
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

/**
 * 获取卡片样式
 */
function getCardStyle(appId: string): Record<string, string> {
  const state = cardSwipeStates.value.get(appId)
  if (!state) return {}
  
  const { offsetX, offsetY, isDragging } = state
  
  // 计算总偏移距离
  const totalOffset = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
  const opacity = 1 - Math.min(totalOffset / 300, 0.5)
  const scale = 1 - Math.min(totalOffset / 1000, 0.1)
  
  // 根据水平偏移添加旋转效果
  const rotation = (offsetX / 500) * 15 // 最大旋转15度
  
  return {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale}) rotate(${rotation}deg)`,
    opacity: String(opacity),
    transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'
  }
}

// ============ 卡片列表左右滑动手势 ============

interface ListSwipeState {
  startX: number
  startScrollLeft: number
  isDragging: boolean
  startTime: number
  lastX: number
  lastTime: number
  velocity: number
}

const listSwipeState = ref<ListSwipeState | null>(null)
const listTranslateX = ref(0)
const isListDragging = ref(false)

// 卡片宽度（包含间距）
const CARD_WIDTH = 220 + 16 // 卡片宽度 + gap

/**
 * 滚动到指定卡片
 */
function scrollToCard(index: number, animated = true): void {
  if (!cardsScrollRef.value) return
  
  const clampedIndex = Math.max(0, Math.min(index, runningApps.value.length - 1))
  currentCardIndex.value = clampedIndex
  
  // 计算目标滚动位置
  const targetScroll = clampedIndex * CARD_WIDTH
  
  if (animated) {
    cardsScrollRef.value.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    })
  } else {
    cardsScrollRef.value.scrollLeft = targetScroll
  }
}

/**
 * 处理列表触摸开始
 */
function handleListTouchStart(event: TouchEvent): void {
  if (!cardsScrollRef.value) return
  
  const touch = event.touches[0]
  listSwipeState.value = {
    startX: touch.clientX,
    startScrollLeft: cardsScrollRef.value.scrollLeft,
    isDragging: true,
    startTime: Date.now(),
    lastX: touch.clientX,
    lastTime: Date.now(),
    velocity: 0
  }
  isListDragging.value = true
}

/**
 * 处理列表触摸移动
 */
function handleListTouchMove(event: TouchEvent): void {
  const state = listSwipeState.value
  if (!state?.isDragging || !cardsScrollRef.value) return
  
  const touch = event.touches[0]
  const deltaX = touch.clientX - state.startX
  const now = Date.now()
  const dt = now - state.lastTime
  
  // 计算速度
  if (dt > 0) {
    state.velocity = (touch.clientX - state.lastX) / dt
    state.lastX = touch.clientX
    state.lastTime = now
  }
  
  // 更新滚动位置
  cardsScrollRef.value.scrollLeft = state.startScrollLeft - deltaX
}

/**
 * 处理列表触摸结束
 */
function handleListTouchEnd(event: TouchEvent): void {
  const state = listSwipeState.value
  if (!state || !cardsScrollRef.value) return
  
  const velocity = state.velocity
  const currentScroll = cardsScrollRef.value.scrollLeft
  
  // 根据速度和当前位置计算目标卡片
  let targetIndex = Math.round(currentScroll / CARD_WIDTH)
  
  // 如果有足够的速度，则额外滚动一张卡片
  if (Math.abs(velocity) > 0.3) {
    if (velocity > 0) {
      targetIndex = Math.floor(currentScroll / CARD_WIDTH)
    } else {
      targetIndex = Math.ceil(currentScroll / CARD_WIDTH)
    }
  }
  
  // 滚动到目标卡片
  scrollToCard(targetIndex)
  
  listSwipeState.value = null
  isListDragging.value = false
}

/**
 * 处理列表鼠标事件
 */
function handleListMouseDown(event: MouseEvent): void {
  if (!cardsScrollRef.value) return
  
  // 阻止默认行为和事件冒泡
  event.preventDefault()
  
  listSwipeState.value = {
    startX: event.clientX,
    startScrollLeft: cardsScrollRef.value.scrollLeft,
    isDragging: true,
    startTime: Date.now(),
    lastX: event.clientX,
    lastTime: Date.now(),
    velocity: 0
  }
  isListDragging.value = true
  
  const handleMouseMove = (e: MouseEvent) => {
    const state = listSwipeState.value
    if (!state?.isDragging || !cardsScrollRef.value) return
    
    const deltaX = e.clientX - state.startX
    const now = Date.now()
    const dt = now - state.lastTime
    
    if (dt > 0) {
      state.velocity = (e.clientX - state.lastX) / dt
      state.lastX = e.clientX
      state.lastTime = now
    }
    
    cardsScrollRef.value.scrollLeft = state.startScrollLeft - deltaX
  }
  
  const handleMouseUp = (e: MouseEvent) => {
    const state = listSwipeState.value
    if (state && cardsScrollRef.value) {
      const velocity = state.velocity
      const currentScroll = cardsScrollRef.value.scrollLeft
      
      let targetIndex = Math.round(currentScroll / CARD_WIDTH)
      
      if (Math.abs(velocity) > 0.3) {
        if (velocity > 0) {
          targetIndex = Math.floor(currentScroll / CARD_WIDTH)
        } else {
          targetIndex = Math.ceil(currentScroll / CARD_WIDTH)
        }
      }
      
      scrollToCard(targetIndex)
    }
    
    listSwipeState.value = null
    isListDragging.value = false
    
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

/**
 * 切换到上一个卡片
 */
function prevCard(): void {
  scrollToCard(currentCardIndex.value - 1)
}

/**
 * 切换到下一个卡片
 */
function nextCard(): void {
  scrollToCard(currentCardIndex.value + 1)
}

// 监听键盘事件（左右箭头切换卡片）
function handleKeyDown(event: KeyboardEvent): void {
  if (!appStateStore.isAppSwitcherVisible) return
  
  if (event.key === 'ArrowLeft') {
    prevCard()
    event.preventDefault()
  } else if (event.key === 'ArrowRight') {
    nextCard()
    event.preventDefault()
  } else if (event.key === 'Escape') {
    goHome()
    event.preventDefault()
  } else if (event.key === 'Enter') {
    // 进入当前聚焦的 App
    const currentApp = runningApps.value[currentCardIndex.value]
    if (currentApp) {
      switchToApp(currentApp)
    }
    event.preventDefault()
  }
}

// 组件挂载时添加键盘事件监听
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

// 组件卸载时移除键盘事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Transition name="app-switcher">
    <div 
      v-if="appStateStore.isAppSwitcherVisible" 
      class="app-switcher"
      @click.self="goHome"
    >
      <!-- 顶部状态区域（点击可返回桌面） -->
      <div class="switcher-header" @click="goHome">
        <div class="header-blur"></div>
      </div>
      
      <!-- 运行中的 App 卡片列表（点击空白区域返回桌面） -->
      <div
        v-if="hasRunningApps"
        ref="cardsContainerRef"
        class="cards-container"
        @click.self="goHome"
        @touchstart="handleListTouchStart"
        @touchmove.passive="handleListTouchMove"
        @touchend="handleListTouchEnd"
        @mousedown="handleListMouseDown"
      >
        <div
          ref="cardsScrollRef"
          class="cards-scroll"
          :class="{ 'is-dragging': isListDragging }"
        >
          <div 
            v-for="app in runningApps" 
            :key="app.id"
            class="app-card-wrapper"
          >
            <!-- App 图标和名称 -->
            <div class="app-card-header">
              <AppIcon 
                :app-id="getIconId(app.id)" 
                size="xs" 
              />
              <span class="app-card-name">{{ app.name }}</span>
            </div>
            
            <!-- App 卡片预览 -->
            <div 
              class="app-card"
              :style="getCardStyle(app.id)"
              @click="switchToApp(app)"
              @touchstart="handleCardTouchStart(app.id, $event)"
              @touchmove.passive="handleCardTouchMove(app.id, $event)"
              @touchend="handleCardTouchEnd(app.id, $event)"
              @mousedown="handleCardMouseDown(app.id, $event)"
            >
              <!-- 卡片内容占位 -->
              <div class="card-content">
                <div class="card-placeholder">
                  <AppIcon 
                    :app-id="getIconId(app.id)" 
                    size="xl" 
                  />
                </div>
              </div>
              
              <!-- 锁定图标（示意应用锁，可选显示） -->
              <div class="card-lock-indicator" v-if="false">
                <i class="fas fa-lock"></i>
                <span>应用锁正在保护</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 无运行 App 时的提示（点击可返回桌面） -->
      <div v-else class="no-apps-message" @click="goHome">
        <i class="fas fa-mobile-alt"></i>
        <span>无正在运行的应用</span>
      </div>
      
      <!-- 底部清除按钮（点击空白区域返回桌面） -->
      <div class="switcher-footer" @click.self="goHome">
        <button
          v-if="hasRunningApps"
          class="clear-all-btn"
          @click.stop="clearAllApps"
        >
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.app-switcher {
  @apply fixed inset-0 z-50;
  @apply flex flex-col;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* 顶部区域 */
.switcher-header {
  @apply h-24 flex-shrink-0;
  @apply flex items-end justify-center pb-2;
}

.header-blur {
  @apply w-16 h-1 rounded-full;
  background: rgba(255, 255, 255, 0.3);
}

/* 卡片容器 */
.cards-container {
  @apply flex-1 overflow-hidden;
  @apply flex items-center justify-center;
  padding: 20px 0;
}

.cards-scroll {
  @apply flex gap-4;
  @apply overflow-x-auto overflow-y-visible;
  @apply items-start justify-start;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0 calc(50% - 110px) 20px;
  scroll-behavior: smooth;
}

.cards-scroll.is-dragging {
  scroll-behavior: auto;
  scroll-snap-type: none;
}

.cards-scroll::-webkit-scrollbar {
  display: none;
}

/* App 卡片包装器 */
.app-card-wrapper {
  @apply flex flex-col items-center gap-3;
  @apply flex-shrink-0;
  scroll-snap-align: center;
  width: 220px;
}

/* 卡片头部（图标+名称） */
.app-card-header {
  @apply flex items-center gap-2;
  @apply text-white text-sm font-medium;
}

.app-card-name {
  @apply truncate max-w-[100px];
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* App 卡片 */
.app-card {
  @apply relative;
  @apply rounded-2xl overflow-hidden;
  @apply cursor-pointer;
  @apply shadow-2xl;
  width: 200px;
  height: 400px;
  background: var(--color-surface, #ffffff);
  transform-origin: center bottom;
  transition: transform 0.15s ease-out, opacity 0.15s ease-out;
  user-select: none;
}

.app-card:active {
  transform: scale(0.98);
}

/* 卡片内容 */
.card-content {
  @apply w-full h-full;
  @apply flex items-center justify-center;
  background: var(--color-background, #f2f2f7);
}

.card-placeholder {
  @apply flex flex-col items-center justify-center gap-4;
  @apply text-gray-400;
  opacity: 0.5;
}

/* 应用锁指示器 */
.card-lock-indicator {
  @apply absolute inset-0;
  @apply flex flex-col items-center justify-center gap-2;
  @apply text-gray-400;
  background: var(--color-surface, #ffffff);
}

.card-lock-indicator i {
  @apply text-4xl;
  color: var(--color-text-secondary, #8e8e93);
}

.card-lock-indicator span {
  @apply text-sm;
  color: var(--color-text-secondary, #8e8e93);
}

/* 无 App 提示 */
.no-apps-message {
  @apply flex-1;
  @apply flex flex-col items-center justify-center gap-4;
  @apply text-white/60;
}

.no-apps-message i {
  @apply text-5xl;
}

.no-apps-message span {
  @apply text-lg;
}

/* 底部区域 */
.switcher-footer {
  @apply h-24 flex-shrink-0;
  @apply flex items-start justify-center pt-4;
}

.clear-all-btn {
  @apply w-14 h-14 rounded-full;
  @apply flex items-center justify-center;
  @apply text-white/80 text-xl;
  @apply transition-all duration-150;
  background: rgba(255, 255, 255, 0.15);
}

.clear-all-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.clear-all-btn:active {
  transform: scale(0.9);
  background: rgba(255, 255, 255, 0.3);
}

/* 进入/离开动画 */
.app-switcher-enter-active {
  animation: switcher-in 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.app-switcher-leave-active {
  animation: switcher-out 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes switcher-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes switcher-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* 多卡片时的布局调整 */
@media (min-width: 400px) {
  .app-card {
    width: 220px;
    height: 440px;
  }
}
</style>