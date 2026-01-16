<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cachedComponents, preloadComponents, navigationDirection, transitionType, setTransitionType, zoomOrigin, setZoomOrigin, resetZoomOrigin, canGoBack as routerCanGoBack, willBackToHome } from '@/router'
import { useAppStateStore, getAppIdFromRoute } from '@/stores/appStateStore'
import { useDeviceStore } from '@/stores/deviceStore'
import SkeletonGroup from '@/components/common/SkeletonGroup.vue'

const route = useRoute()
const router = useRouter()
const appStateStore = useAppStateStore()
const deviceStore = useDeviceStore()

// 容器引用
const containerRef = ref<HTMLElement | null>(null)

// 导航方向：直接使用 router 中的状态
const direction = navigationDirection

// 滑动返回状态
const isSwipingBack = ref(false)
const swipeProgress = ref(0)

// 加载状态
const isLoading = ref(false)

// 手势相关状态
const SWIPE_THRESHOLD = 80
const SWIPE_HOME_THRESHOLD = 100 // 返回桌面的滑动距离阈值
const HOME_SWIPE_VELOCITY = 0.8 // 快速滑动回桌面的速度阈值 (px/ms)
const APP_SWITCHER_VELOCITY = 0.3 // 慢速滑动进入多任务的速度阈值 (px/ms)
let startX = 0
let startY = 0
let isSwiping = false
const isFromLeftEdge = ref(false)
const isFromRightEdge = ref(false)
const isFromBottomEdge = ref(false)
let startTime = 0

// 底部上滑状态
const isSwipingHome = ref(false)
const swipeHomeProgress = ref(0)

// 多任务切换状态
const isSwipingForSwitcher = ref(false)
const switcherProgress = ref(0)

// 是否可以返回：使用路由器内部的历史栈来判断
const canGoBack = routerCanGoBack

// 是否不在桌面（可以返回桌面）
const canGoHome = computed(() => {
  return route.path !== '/'
})

// 是否在桌面
const isAtHome = computed(() => {
  return route.path === '/'
})

// 是否需要缓存当前组件
const shouldCache = computed(() => {
  return route.meta?.keepAlive === true
})

// 根据过渡类型和方向选择动画名称
const transitionName = computed(() => {
  // zoom 动画：桌面与 App 之间的切换
  if (transitionType.value === 'zoom') {
    return direction.value === 'back' ? 'zoom-out' : 'zoom-in'
  }
  // slide 动画：App 内部页面之间的切换
  return direction.value === 'back' ? 'slide-back' : 'slide'
})

// zoom 动画的 transform-origin 样式
const zoomOriginStyle = computed(() => {
  if (transitionType.value !== 'zoom') return {}
  return {
    '--zoom-origin-x': `${zoomOrigin.value.x}%`,
    '--zoom-origin-y': `${zoomOrigin.value.y}%`
  }
})

// 动画结束后重置 zoom 原点
function onTransitionEnd() {
  if (transitionType.value === 'zoom') {
    // 延迟重置，确保动画完成
    setTimeout(() => {
      resetZoomOrigin()
    }, 50)
  }
}

// 注意：zoom 原点的设置已移动到具体的触发位置：
// 1. 手势上滑返回桌面：在 handlePointerUp 中设置
// 2. 三键导航主页键：在 NavigationBar.vue 中设置
// 3. 从桌面打开 App：在 HomeScreen.vue 中设置（点击图标时）

// 判断当前是否在 App 首页（一级路由，如 /chat, /settings, /phone）
// 用于决定滑动返回时是否使用 zoom 动画
const isAtAppMainPage = computed(() => {
  const path = route.path
  // 桌面不算 App 首页
  if (path === '/') return false
  // 检查是否是一级路由（只有一个路径段）
  // /chat -> true, /chat/123 -> false, /settings/theme -> false
  const segments = path.split('/').filter(Boolean)
  return segments.length === 1
})

// 判断当前滑动是否会返回桌面（用于决定是否显示滑动预览）
const isSwipingToHome = computed(() => {
  return isSwipingBack.value && isAtAppMainPage.value
})

// 滑动返回预览样式（仅在非返回桌面时显示）
const swipeBackStyle = computed(() => {
  // 如果会返回桌面，不显示滑动预览效果，因为会使用 zoom 动画
  if (!isSwipingBack.value || isSwipingToHome.value) return {}
  
  return {
    transform: `translateX(${swipeProgress.value * 30}%)`,
    // 移除透明度变化，保持画面不变暗
  }
})

// 启动预加载
onMounted(() => {
  preloadComponents()
})

// 鼠标/触摸事件处理
function handlePointerDown(clientX: number, clientY: number) {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  
  // 边缘区域为屏幕宽度的四分之一（从两侧各 25%）
  const edgeWidth = rect.width / 4
  const relativeX = clientX - rect.left
  const relativeY = clientY - rect.top
  
  // 底部边缘区域（从底部 60px 开始）
  const bottomEdgeHeight = 60
  
  isFromLeftEdge.value = relativeX < edgeWidth
  isFromRightEdge.value = relativeX > rect.width - edgeWidth
  isFromBottomEdge.value = relativeY > rect.height - bottomEdgeHeight
  
  // 底部向上滑动：在 App 中返回桌面，在桌面中打开多任务
    // 注意：仅在手势导航模式下处理底部滑动
    if (isFromBottomEdge.value && deviceStore.isGestureNavigation) {
      isSwiping = true
      startX = clientX
      startY = clientY
      startTime = Date.now()
      return
    }
  
  // 左边缘向右滑动 或 右边缘向左滑动都可以返回
  if ((isFromLeftEdge.value || isFromRightEdge.value) && canGoBack.value) {
    isSwiping = true
    startX = clientX
    startY = clientY
    startTime = Date.now()
  }
}

function handlePointerMove(clientX: number, clientY: number) {
  if (!isSwiping) return
  
  const deltaX = clientX - startX
  const deltaY = clientY - startY
  
  // 底部向上滑动（仅手势导航模式）
    if (isFromBottomEdge.value && deviceStore.isGestureNavigation) {
      // 只处理向上滑动
      if (deltaY < 0) {
      const absDeltaY = Math.abs(deltaY)
      
      // 在桌面上：只显示多任务切换提示
      if (isAtHome.value) {
        isSwipingForSwitcher.value = true
        isSwipingHome.value = false
        switcherProgress.value = Math.min(absDeltaY / 80, 1)
      } else {
        // 在 App 中：根据滑动距离决定显示哪个指示器
        if (absDeltaY < SWIPE_HOME_THRESHOLD) {
          // 短距离：多任务切换提示
          isSwipingForSwitcher.value = true
          isSwipingHome.value = false
          switcherProgress.value = Math.min(absDeltaY / SWIPE_HOME_THRESHOLD, 1)
        } else {
          // 长距离：返回桌面提示
          isSwipingHome.value = true
          isSwipingForSwitcher.value = false
          swipeHomeProgress.value = Math.min((absDeltaY - SWIPE_HOME_THRESHOLD) / SWIPE_HOME_THRESHOLD, 1)
        }
      }
    }
    return
  }
  
  // 水平滑动返回
  // 确保是水平滑动
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    isSwiping = false
    isSwipingBack.value = false
    swipeProgress.value = 0
    return
  }
  
  // 左边缘向右滑动 或 右边缘向左滑动都触发返回手势
  const isValidSwipe = (isFromLeftEdge.value && deltaX > 0) || (isFromRightEdge.value && deltaX < 0)
  
  if (isValidSwipe) {
    isSwipingBack.value = true
    swipeProgress.value = Math.min(Math.abs(deltaX) / (SWIPE_THRESHOLD * 2), 1)
  }
}

function handlePointerUp(clientX: number, clientY: number) {
  if (!isSwiping) return
  
  const deltaX = clientX - startX
  const deltaY = clientY - startY
  const duration = Date.now() - startTime
  
  // 底部向上滑动处理（仅手势导航模式）
    if (isFromBottomEdge.value && deviceStore.isGestureNavigation && deltaY < 0) {
    const absDeltaY = Math.abs(deltaY)
    const velocityY = absDeltaY / duration
    
    // 在桌面上：只打开多任务切换
    if (isAtHome.value) {
      if (absDeltaY > 50) {
        appStateStore.showAppSwitcher()
        console.log('[Gesture] App switcher triggered from home (distance:', absDeltaY, ')')
      }
    } else {
      // 在 App 中：
      // 快速向上滑动：直接返回桌面
      if (velocityY >= HOME_SWIPE_VELOCITY || absDeltaY > SWIPE_HOME_THRESHOLD) {
        // 获取当前 App 的图标位置，设置为 zoom 动画的终点
        const currentAppId = getAppIdFromRoute(route.path)
        const iconPosition = appStateStore.getIconPosition(currentAppId)
        
        if (iconPosition) {
          setZoomOrigin(iconPosition)
          console.log(`[ViewsContainer] 手势返回桌面，设置 zoom 原点到 ${currentAppId} 图标位置:`, iconPosition)
        }
        
        // 手势返回桌面使用 zoom 动画
        setTransitionType('zoom')
        router.push('/')
      }
      // 慢速向上滑动（悬停）或中等距离：打开多任务切换界面
      else if (absDeltaY > 50 && absDeltaY < SWIPE_HOME_THRESHOLD && velocityY < HOME_SWIPE_VELOCITY) {
        // 打开多任务切换界面
        appStateStore.showAppSwitcher()
        console.log('[Gesture] App switcher triggered (velocity:', velocityY.toFixed(2), ', distance:', absDeltaY, ')')
      }
    }
    
    // 重置状态
    isSwiping = false
    isSwipingHome.value = false
    swipeHomeProgress.value = 0
    isSwipingForSwitcher.value = false
    switcherProgress.value = 0
    isFromBottomEdge.value = false
    return
  }
  
  // 水平滑动返回处理
  const velocity = Math.abs(deltaX) / duration
  const absDeltaX = Math.abs(deltaX)
  
  // 检查是否是有效的返回手势
  const isValidBackGesture = (isFromLeftEdge.value && deltaX > 0) || (isFromRightEdge.value && deltaX < 0)
  
  // 快速滑动或超过阈值时触发返回
  if (isValidBackGesture && (absDeltaX > SWIPE_THRESHOLD || (velocity > 0.5 && absDeltaX > SWIPE_THRESHOLD / 2))) {
    // 检查返回后是否会回到桌面，如果是则使用 zoom 动画
    if (willBackToHome()) {
      const currentAppId = getAppIdFromRoute(route.path)
      const iconPosition = appStateStore.getIconPosition(currentAppId)
      
      if (iconPosition) {
        setZoomOrigin(iconPosition)
        console.log(`[ViewsContainer] 边缘滑动返回桌面，设置 zoom 原点到 ${currentAppId} 图标位置:`, iconPosition)
      }
      
      setTransitionType('zoom')
    }
    
    router.back()
  }
  
  // 重置状态
  isSwiping = false
  isSwipingBack.value = false
  swipeProgress.value = 0
  isFromLeftEdge.value = false
  isFromRightEdge.value = false
}

// 鼠标事件
function onMouseDown(e: MouseEvent) {
  handlePointerDown(e.clientX, e.clientY)
  if (isSwiping) {
    // 阻止浏览器默认行为（如文本选择、拖拽等）
    e.preventDefault()
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}

function onMouseMove(e: MouseEvent) {
  if (isSwiping) {
    e.preventDefault()
  }
  handlePointerMove(e.clientX, e.clientY)
}

function onMouseUp(e: MouseEvent) {
  handlePointerUp(e.clientX, e.clientY)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// 触摸事件
function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  handlePointerDown(touch.clientX, touch.clientY)
}

function onTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (isSwiping && (isSwipingBack.value || isSwipingHome.value)) {
    e.preventDefault()
  }
  handlePointerMove(touch.clientX, touch.clientY)
}

function onTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  handlePointerUp(touch.clientX, touch.clientY)
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEnd)
})

onUnmounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.removeEventListener('mousedown', onMouseDown)
  el.removeEventListener('touchstart', onTouchStart)
  el.removeEventListener('touchmove', onTouchMove)
  el.removeEventListener('touchend', onTouchEnd)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div ref="containerRef" class="views-container no-drag">
    <!-- 滑动返回指示器（左侧） -->
    <div
      v-if="isSwipingBack && swipeProgress > 0.1 && isFromLeftEdge"
      class="swipe-back-indicator swipe-back-indicator-left"
      :style="{ transform: `translateX(${swipeProgress * 40}px) scale(${0.8 + swipeProgress * 0.2})` }"
    >
      <i class="fas fa-chevron-left"></i>
    </div>
    
    <!-- 滑动返回指示器（右侧） -->
    <div
      v-if="isSwipingBack && swipeProgress > 0.1 && isFromRightEdge"
      class="swipe-back-indicator swipe-back-indicator-right"
      :style="{ transform: `translateX(${-swipeProgress * 40}px) scale(${0.8 + swipeProgress * 0.2})` }"
    >
      <i class="fas fa-chevron-right"></i>
    </div>
    
    <!-- 底部上滑多任务切换指示器 -->
    <div
      v-if="isSwipingForSwitcher && switcherProgress > 0.1"
      class="swipe-switcher-indicator"
      :style="{
        transform: `translateY(${-switcherProgress * 50}px) scale(${0.8 + switcherProgress * 0.2})`,
        opacity: switcherProgress
      }"
    >
      <div class="swipe-switcher-bar"></div>
      <span class="swipe-switcher-text">松开打开多任务</span>
    </div>
    
    <!-- 底部上滑返回桌面指示器 -->
    <div
      v-if="isSwipingHome && swipeHomeProgress > 0.1"
      class="swipe-home-indicator"
      :style="{
        transform: `translateY(${-swipeHomeProgress * 60}px) scale(${0.8 + swipeHomeProgress * 0.2})`,
        opacity: swipeHomeProgress
      }"
    >
      <div class="swipe-home-bar"></div>
      <span class="swipe-home-text">继续上滑返回桌面</span>
    </div>
    
    <router-view v-slot="{ Component, route: currentRoute }">
      <!-- 移除 mode="out-in"，实现并行动画（类似 iOS 原生切换效果） -->
      <Transition :name="transitionName" @after-leave="onTransitionEnd">
        <!-- 使用 Suspense 处理异步组件加载 -->
        <Suspense>
          <!-- KeepAlive 缓存组件，避免重复渲染 -->
          <KeepAlive :include="cachedComponents">
            <component
              :is="Component"
              :key="currentRoute.path"
              class="view"
              :class="{ 'zoom-animated': transitionType === 'zoom' }"
              :style="{ ...swipeBackStyle, ...zoomOriginStyle }"
            />
          </KeepAlive>
          
          <!-- 加载中的骨架屏 -->
          <template #fallback>
            <div class="view loading-view">
              <div class="loading-content">
                <SkeletonGroup preset="list-item" :count="5" />
              </div>
            </div>
          </template>
        </Suspense>
      </Transition>
    </router-view>
  </div>
</template>

<style scoped>
.views-container {
  @apply relative flex-1 overflow-hidden;
  background-color: var(--color-background);
  background-size: cover;
  background-position: center;
  transition: background-color 0.3s ease;
  /* 禁止浏览器默认手势 */
  overscroll-behavior-x: none;
  -webkit-user-select: none;
  user-select: none;
}

.view {
  @apply absolute inset-0 overflow-y-auto overflow-x-hidden;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  @apply transition-opacity duration-200;
}

.fade-enter-from,
.fade-leave-to {
  @apply opacity-0;
}

/* 前进滑动动画：新页面从右侧进入，旧页面向左退出 */
/* 使用 position: absolute 实现并行动画 */
.slide-enter-active {
  @apply transition-all duration-300;
  transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 2;
}

.slide-leave-active {
  @apply transition-all duration-300;
  transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 1;
}

.slide-enter-to {
  transform: translateX(0);
  opacity: 1;
}

.slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.slide-leave-to {
  transform: translateX(-30%);
  opacity: 1;
}

/* 后退滑动动画：新页面从左侧进入，旧页面向右退出 */
.slide-back-enter-active {
  @apply transition-all duration-300;
  transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 1;
}

.slide-back-leave-active {
  @apply transition-all duration-300;
  transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: absolute;
  z-index: 2;
  width: 100%;
  height: 100%;
}

.slide-back-enter-from {
  transform: translateX(-30%);
  opacity: 1;
}

.slide-back-enter-to {
  transform: translateX(0);
  opacity: 1;
}

.slide-back-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.slide-back-leave-to {
  transform: translateX(100%);
  opacity: 1;
}

/* 缩放动画 */
.scale-enter-active,
.scale-leave-active {
  @apply transition-all duration-200 ease-out;
}

.scale-enter-from,
.scale-leave-to {
  @apply opacity-0 scale-95;
}

/* 滑动返回指示器基础样式 */
.swipe-back-indicator {
  @apply absolute top-1/2 -translate-y-1/2 z-50;
  @apply w-10 h-10 rounded-full;
  @apply flex items-center justify-center;
  @apply bg-black/50 text-white;
  @apply transition-transform duration-100;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* 左侧指示器 */
.swipe-back-indicator-left {
  @apply left-2;
}

/* 右侧指示器 */
.swipe-back-indicator-right {
  @apply right-2;
}

/* 底部上滑返回桌面指示器 */
.swipe-home-indicator {
  @apply absolute bottom-4 left-1/2 -translate-x-1/2 z-50;
  @apply flex flex-col items-center gap-2;
  @apply transition-all duration-100;
  pointer-events: none;
}

.swipe-home-bar {
  @apply w-32 h-1.5 rounded-full;
  @apply bg-white/80;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.swipe-home-text {
  @apply text-xs text-white font-medium;
  @apply px-3 py-1.5 rounded-full;
  @apply bg-black/60;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 底部上滑多任务切换指示器 */
.swipe-switcher-indicator {
  @apply absolute bottom-4 left-1/2 -translate-x-1/2 z-50;
  @apply flex flex-col items-center gap-2;
  @apply transition-all duration-100;
  pointer-events: none;
}

.swipe-switcher-bar {
  @apply w-24 h-1 rounded-full;
  @apply bg-white/60;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.swipe-switcher-text {
  @apply text-xs text-white/90 font-medium;
  @apply px-3 py-1.5 rounded-full;
  @apply bg-black/50;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* zoom 动画使用动态原点 */
.zoom-animated {
  transform-origin: var(--zoom-origin-x, 50%) var(--zoom-origin-y, 50%);
}

/* ============ 放大进入动画（从桌面打开 App） ============ */
.zoom-in-enter-active {
  @apply transition-all duration-300;
  transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 2;
  transform-origin: var(--zoom-origin-x, 50%) var(--zoom-origin-y, 50%);
}

.zoom-in-leave-active {
  @apply transition-all duration-300;
  transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
  transform-origin: var(--zoom-origin-x, 50%) var(--zoom-origin-y, 50%);
}

.zoom-in-enter-from {
  opacity: 0;
  transform: scale(0.3);
}

.zoom-in-enter-to {
  opacity: 1;
  transform: scale(1);
}

.zoom-in-leave-from {
  opacity: 1;
  transform: scale(1);
}

.zoom-in-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

/* ============ 缩小离开动画（从 App 返回桌面） ============ */
.zoom-out-enter-active {
  @apply transition-all;
  transition-duration: 250ms;
  transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 1;
  transform-origin: var(--zoom-origin-x, 50%) var(--zoom-origin-y, 50%);
}

.zoom-out-leave-active {
  @apply transition-all;
  transition-duration: 250ms;
  transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
  position: absolute;
  z-index: 2;
  width: 100%;
  height: 100%;
  transform-origin: var(--zoom-origin-x, 50%) var(--zoom-origin-y, 50%);
}

.zoom-out-enter-from {
  opacity: 0;
  transform: scale(1.02);
}

.zoom-out-enter-to {
  opacity: 1;
  transform: scale(1);
}

.zoom-out-leave-from {
  opacity: 1;
  transform: scale(1);
}

.zoom-out-leave-to {
  opacity: 0;
  transform: scale(0.3);
}

/* iOS 风格弹起动画 */
.ios-sheet-enter-active {
  @apply transition-all duration-300;
  animation: ios-sheet-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.ios-sheet-leave-active {
  @apply transition-all duration-200;
  animation: ios-sheet-down 0.2s ease-in;
}

@keyframes ios-sheet-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ios-sheet-down {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}

/* 加载状态视图 */
.loading-view {
  @apply flex items-center justify-center;
  background: var(--color-background, #f2f2f7);
}

.loading-content {
  @apply w-full p-4;
}

/* 页面容器需要相对定位来支持并行动画 */
.views-container {
  position: relative;
}
</style>