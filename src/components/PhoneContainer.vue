<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { useAppStateStore, getAppIdFromRoute } from '@/stores/appStateStore'
import { useTheme } from '@/composables/useTheme'
import { StatusBarApp, NotificationCenter, ControlCenter } from '@/apps/status-bar'
import ViewsContainer from './phone/ViewsContainer.vue'
import NavigationBar from './phone/NavigationBar.vue'
import AppSwitcher from './phone/AppSwitcher.vue'
import NotificationToast from './common/NotificationToast.vue'

const route = useRoute()
const uiStore = useUIStore()
const deviceStore = useDeviceStore()
const appStateStore = useAppStateStore()
const { currentTheme } = useTheme()

// 容器引用
const containerRef = ref<HTMLElement | null>(null)

// 下拉相关
const isPullDownGesture = ref(false)
const pullDownStartY = ref(0)
const pullDownStartX = ref(0)
const pullDownCurrentY = ref(0)
const PULL_DOWN_THRESHOLD = 80 // 触发下拉面板的阈值

// 计算容器尺寸样式
const containerSizeStyle = computed(() => ({
  width: `${deviceStore.dimensions.width}px`,
  height: `${deviceStore.dimensions.height}px`,
  marginLeft: `-${deviceStore.dimensions.width / 2}px`,
  marginTop: `-${deviceStore.dimensions.height / 2}px`,
}))

// 计算变换样式
const containerTransformStyle = computed(() => ({
  transform: `translate(${uiStore.position.x}px, ${uiStore.position.y}px) scale(${uiStore.position.scale})`,
}))

// 合并所有样式
const containerStyle = computed(() => ({
  ...containerSizeStyle.value,
  ...containerTransformStyle.value,
}))

// 背景样式
const backgroundStyle = computed(() => {
  const wallpaper = uiStore.customization.homescreenWallpaper
  if (wallpaper) {
    return { backgroundImage: `url(${wallpaper})` }
  }
  return {}
})

// 边框样式（根据设备模式和主题）
const frameStyle = computed(() => ({
  borderRadius: `${deviceStore.layout.borderRadius}px`,
  backgroundColor: currentTheme.value.device.frameColor,
  boxShadow: `var(--device-shadow)`,
}))

// 判断是否为 iOS 风格主题（用于决定下拉行为）
const isIOSStyle = computed(() => {
  const themeId = currentTheme.value.id
  return themeId === 'ios' || themeId === 'dark'
})

// 计算下拉进度对应的位移
const pullDownTransform = computed(() => {
  if (!uiStore.hasPullDownPanelOpen && !isPullDownGesture.value) {
    return 'translateY(-100%)'
  }
  
  const progress = uiStore.pullDownProgress
  const translateY = -100 + (progress * 100)
  return `translateY(${translateY}%)`
})

// 容器类名
const containerClasses = computed(() => ({
  [`device-${deviceStore.mode}`]: true,
}))

// 下拉手势处理
function onStatusBarMouseDown(e: MouseEvent) {
  // 如果已经有下拉面板打开，不处理新的下拉手势
  if (uiStore.hasPullDownPanelOpen) return
  
  isPullDownGesture.value = true
  pullDownStartY.value = e.clientY
  pullDownStartX.value = e.clientX
  pullDownCurrentY.value = e.clientY
  
  document.addEventListener('mousemove', onPullDownMove)
  document.addEventListener('mouseup', onPullDownEnd)
}

function onPullDownMove(e: MouseEvent) {
  if (!isPullDownGesture.value) return
  
  pullDownCurrentY.value = e.clientY
  const deltaY = pullDownCurrentY.value - pullDownStartY.value
  
  // 只处理向下拖动
  if (deltaY > 0) {
    const progress = Math.min(deltaY / PULL_DOWN_THRESHOLD, 1)
    
    // 如果还没有开始拖拽面板，判断应该打开哪个面板
    if (!uiStore.isPullingDown && progress > 0.1) {
      // iOS 风格：根据触摸位置决定打开哪个面板
      if (isIOSStyle.value) {
        const statusBarWidth = deviceStore.dimensions.width
        const touchX = pullDownStartX.value - (containerRef.value?.getBoundingClientRect().left || 0)
        
        if (touchX < statusBarWidth / 2) {
          uiStore.startPulling('notification')
        } else {
          uiStore.startPulling('control')
        }
      } else {
        // Android 和其他主题：统一打开通知中心
        uiStore.startPulling('notification')
      }
    }
    
    if (uiStore.isPullingDown) {
      uiStore.setPullDownProgress(progress)
    }
  }
}

function onPullDownEnd() {
  isPullDownGesture.value = false
  
  if (uiStore.isPullingDown) {
    uiStore.endPulling()
  }
  
  document.removeEventListener('mousemove', onPullDownMove)
  document.removeEventListener('mouseup', onPullDownEnd)
}

// 触摸事件处理（移动端支持）
function onStatusBarTouchStart(e: TouchEvent) {
  if (uiStore.hasPullDownPanelOpen) return
  
  const touch = e.touches[0]
  isPullDownGesture.value = true
  pullDownStartY.value = touch.clientY
  pullDownStartX.value = touch.clientX
  pullDownCurrentY.value = touch.clientY
}

function onStatusBarTouchMove(e: TouchEvent) {
  if (!isPullDownGesture.value) return
  
  const touch = e.touches[0]
  pullDownCurrentY.value = touch.clientY
  const deltaY = pullDownCurrentY.value - pullDownStartY.value
  
  if (deltaY > 0) {
    e.preventDefault()
    const progress = Math.min(deltaY / PULL_DOWN_THRESHOLD, 1)
    
    if (!uiStore.isPullingDown && progress > 0.1) {
      if (isIOSStyle.value) {
        const statusBarWidth = deviceStore.dimensions.width
        const touchX = pullDownStartX.value - (containerRef.value?.getBoundingClientRect().left || 0)
        
        if (touchX < statusBarWidth / 2) {
          uiStore.startPulling('notification')
        } else {
          uiStore.startPulling('control')
        }
      } else {
        uiStore.startPulling('notification')
      }
    }
    
    if (uiStore.isPullingDown) {
      uiStore.setPullDownProgress(progress)
    }
  }
}

function onStatusBarTouchEnd() {
  isPullDownGesture.value = false
  
  if (uiStore.isPullingDown) {
    uiStore.endPulling()
  }
}

// 缩放处理
function updateScale() {
  if (!deviceStore.autoFit) return
  
  // 使用 deviceStore 的 recommendedScale，已考虑 DPI 和缩放模式
  const scale = Math.max(0.3, deviceStore.recommendedScale)
  
  uiStore.updatePosition({ scale })
}

// 监听设备模式变化
watch(() => deviceStore.mode, () => {
  // 重新计算缩放
  setTimeout(() => {
    updateScale()
    // 重置位置到中心
    uiStore.updatePosition({ x: 0, y: 0 })
  }, 50)
})

// 监听缩放模式和相关设置变化，实时更新缩放
watch(
  () => [
    deviceStore.scaleMode,
    deviceStore.customScale,
    deviceStore.targetPhysicalWidth,
    deviceStore.recommendedScale,
  ],
  () => {
    if (deviceStore.autoFit) {
      updateScale()
    }
  }
)

// 监听路由变化，更新 App 运行状态
watch(
  () => route.path,
  (newPath) => {
    if (newPath && newPath !== '/') {
      const appId = getAppIdFromRoute(newPath)
      appStateStore.openApp(appId, newPath)
    }
  },
  { immediate: true }
)

onMounted(() => {
  // 初始化设备设置
  deviceStore.initialize()
  updateScale()
  window.addEventListener('resize', updateScale)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScale)
})
</script>

<template>
  <div
    ref="containerRef"
    class="phone-container"
    :style="containerStyle"
    :class="containerClasses"
  >
    <!-- 设备边框装饰 -->
    <div class="phone-frame" :style="frameStyle">
      <!-- 状态栏（下拉触发区域）- 使用 StatusBarApp -->
      <StatusBarApp
        @mousedown="onStatusBarMouseDown"
        @touchstart="onStatusBarTouchStart"
        @touchmove="onStatusBarTouchMove"
        @touchend="onStatusBarTouchEnd"
      />
      
      <!-- Toast 通知 -->
      <NotificationToast />
      
      <!-- 视图容器 -->
      <ViewsContainer :style="backgroundStyle" />
      
      <!-- 三键导航栏（仅在三键导航模式下显示） -->
      <NavigationBar v-if="deviceStore.isButtonNavigation" />
      
      <!-- 手势导航指示条（仅在手势导航模式下显示，且不在桌面） -->
      <div
        v-if="deviceStore.isGestureNavigation && route.path !== '/'"
        class="gesture-home-indicator"
      />
      
      <!-- 通知中心 -->
      <Transition name="pull-down">
        <NotificationCenter
          v-if="uiStore.isNotificationCenterOpen"
        />
      </Transition>
      
      <!-- 控制中心 -->
      <Transition name="pull-down">
        <ControlCenter
          v-if="uiStore.isControlCenterOpen"
        />
      </Transition>
      
      <!-- 下拉遮罩（用于显示下拉进度） -->
      <div
        v-if="uiStore.isPullingDown && !uiStore.hasPullDownPanelOpen"
        class="pull-down-overlay"
        :style="{ opacity: uiStore.pullDownProgress * 0.5 }"
      />
      
      <!-- 多任务切换界面 -->
      <AppSwitcher />
    </div>
  </div>
</template>

<style scoped>
.phone-container {
  @apply fixed z-phone;
  @apply top-1/2 left-1/2;
  transform-origin: center center;
  transition:
    transform 0.1s ease-out,
    width 0.3s ease-out,
    height 0.3s ease-out,
    margin 0.3s ease-out;
}

.phone-frame {
  @apply relative w-full h-full flex flex-col;
  @apply overflow-hidden;
  transition:
    border-radius 0.3s ease-out,
    background-color 0.3s ease-out,
    box-shadow 0.3s ease-out;
  /* 禁止浏览器默认手势和滑动导航 */
  touch-action: pan-y pinch-zoom;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  overscroll-behavior: contain;
  overscroll-behavior-x: none;
  -ms-scroll-chaining: none;
}

/* 允许输入框正常交互 - 覆盖 phone-frame 的 user-select: none */
.phone-frame :deep(input),
.phone-frame :deep(textarea),
.phone-frame :deep(select),
.phone-frame :deep([contenteditable]) {
  user-select: text;
  -webkit-user-select: text;
  touch-action: auto;
  -webkit-touch-callout: default;
}

.phone-frame :deep(select) {
  user-select: none;
  -webkit-user-select: none;
}

/* 设备模式特定样式 */
.device-phone .phone-frame {
  @apply shadow-phone;
}

.device-tablet .phone-frame {
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.3);
}

.device-desktop .phone-frame {
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.2);
}

/* 下拉遮罩 */
.pull-down-overlay {
  @apply absolute inset-0 z-40;
  @apply bg-black pointer-events-none;
}

/* 下拉动画 */
.pull-down-enter-active,
.pull-down-leave-active {
  @apply transition-all duration-300 ease-out;
}

.pull-down-enter-from,
.pull-down-leave-to {
  @apply opacity-0;
  transform: translateY(-20px);
}

/* 手势导航底部指示条 */
.gesture-home-indicator {
  @apply absolute bottom-2 left-1/2 -translate-x-1/2;
  width: 134px;
  height: 5px;
  border-radius: 3px;
  background-color: var(--color-text, #000000);
  opacity: 0.2;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 10;
}

/* 深色背景下的指示条 */
[data-theme="dark"] .gesture-home-indicator {
  background-color: #ffffff;
  opacity: 0.3;
}
</style>
