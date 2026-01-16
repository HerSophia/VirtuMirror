<script setup lang="ts">
/**
 * ControlCenter - 控制中心面板
 * 
 * 从状态栏右侧下拉触发的控制面板，支持多种主题风格：
 * - iOS 风格（毛玻璃效果 + 圆形开关）
 * - Android 风格（Material You 风格）
 * - 默认风格
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useTheme } from '@/composables/useTheme'
import DeviceModeSwitch from '@/components/common/DeviceModeSwitch.vue'

const uiStore = useUIStore()
const deviceStore = useDeviceStore()
const notificationStore = useNotificationStore()
const { currentTheme } = useTheme()

// 容器引用
const containerRef = ref<HTMLElement | null>(null)

// 手势状态
let startX = 0
let startY = 0
let isSwiping = false
const SWIPE_THRESHOLD = 60

// 判断是否为 iOS 风格
const isIOSStyle = computed(() => {
  const themeId = currentTheme.value.id
  return themeId === 'ios' || themeId === 'dark'
})

// 判断是否为 Android 风格
const isAndroidStyle = computed(() => {
  const themeId = currentTheme.value.id
  return themeId === 'android'
})

const isTablet = computed(() => deviceStore.isTablet)

// 控制开关状态
const toggles = ref({
  wifi: true,
  bluetooth: false,
  cellular: true,
  airplane: false,
  flashlight: false,
  doNotDisturb: false,
  rotation: true,
  hotspot: false,
  nfc: false,
  location: true,
  darkMode: false,
  batterySaver: false,
})

// 亮度
const brightness = ref(70)

// 音量
const volume = ref(50)

// 当前播放（模拟）
const nowPlaying = ref({
  title: '未在播放',
  artist: '',
  isPlaying: false,
})

// 关闭控制中心
function close() {
  uiStore.closePullDownPanel()
}

// 手势处理
function handlePointerDown(clientX: number, clientY: number, target: EventTarget | null) {
  // 只在空余区域响应手势（不在控件上）
  if (target && (target as HTMLElement).closest('.ios-module, .android-quick-tile, .default-toggle-btn, button, input')) {
    return
  }
  
  isSwiping = true
  startX = clientX
  startY = clientY
}

function handlePointerUp(clientX: number, clientY: number) {
  if (!isSwiping) return
  isSwiping = false
  
  const deltaX = clientX - startX
  const deltaY = clientY - startY
  
  // 判断滑动方向
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    // 垂直滑动
    if (deltaY < -SWIPE_THRESHOLD) {
      // 向上滑动 - 关闭
      close()
    }
  } else {
    // 水平滑动
    if (deltaX > SWIPE_THRESHOLD) {
      // 向右滑动 - 切换到通知中心
      uiStore.openPullDownPanel('notification')
    } else if (deltaX < -SWIPE_THRESHOLD) {
      // 向左滑动 - 无操作（控制中心在右侧）
    }
  }
}

// 鼠标事件
function onMouseDown(e: MouseEvent) {
  handlePointerDown(e.clientX, e.clientY, e.target)
}

function onMouseUp(e: MouseEvent) {
  handlePointerUp(e.clientX, e.clientY)
}

// 触摸事件
function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  handlePointerDown(touch.clientX, touch.clientY, e.target)
}

function onTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  handlePointerUp(touch.clientX, touch.clientY)
}

// 滑块触摸处理
function handleSliderTouch(e: TouchEvent | MouseEvent, type: 'brightness' | 'volume') {
  // 阻止事件冒泡，防止触发滑动关闭
  e.stopPropagation()
  
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  
  // 计算百分比 (从底部开始)
  const height = rect.height
  const relativeY = clientY - rect.top
  const percentage = Math.max(0, Math.min(100, 100 - (relativeY / height * 100)))
  
  if (type === 'brightness') {
    brightness.value = Math.round(percentage)
  } else {
    volume.value = Math.round(percentage)
  }
}

// 滑块拖动状态
const isDraggingSlider = ref(false)

function startSliderDrag(e: TouchEvent | MouseEvent, type: 'brightness' | 'volume') {
  isDraggingSlider.value = true
  handleSliderTouch(e, type)
  
  const moveHandler = (event: TouchEvent | MouseEvent) => {
    if (!isDraggingSlider.value) return
    handleSliderTouch(event, type)
  }
  
  const upHandler = () => {
    isDraggingSlider.value = false
    document.removeEventListener('mousemove', moveHandler)
    document.removeEventListener('mouseup', upHandler)
    document.removeEventListener('touchmove', moveHandler)
    document.removeEventListener('touchend', upHandler)
  }
  
  document.addEventListener('mousemove', moveHandler)
  document.addEventListener('mouseup', upHandler)
  document.addEventListener('touchmove', moveHandler, { passive: false })
  document.addEventListener('touchend', upHandler)
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('mouseup', onMouseUp)
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchend', onTouchEnd)
})

onUnmounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.removeEventListener('mousedown', onMouseDown)
  el.removeEventListener('mouseup', onMouseUp)
  el.removeEventListener('touchstart', onTouchStart)
  el.removeEventListener('touchend', onTouchEnd)
})

// 保存飞行模式开启前的状态
let preAirplaneState = {
  wifi: true,
  cellular: true,
}

// 切换开关
function toggle(key: keyof typeof toggles.value) {
  const newValue = !toggles.value[key]
  
  // 特殊处理飞行模式
  if (key === 'airplane') {
    if (newValue) {
      // 开启飞行模式：保存当前状态，然后关闭 WiFi 和流量
      preAirplaneState.wifi = toggles.value.wifi
      preAirplaneState.cellular = toggles.value.cellular
      toggles.value.wifi = false
      toggles.value.cellular = false
      toggles.value.hotspot = false // 热点也需要关闭
    } else {
      // 关闭飞行模式：恢复之前的状态
      toggles.value.wifi = preAirplaneState.wifi
      toggles.value.cellular = preAirplaneState.cellular
    }
  }
  
  // 如果飞行模式开启时，阻止开启 WiFi、流量和热点
  if (toggles.value.airplane && (key === 'wifi' || key === 'cellular' || key === 'hotspot')) {
    return // 飞行模式下不允许开启这些功能
  }
  
  toggles.value[key] = newValue
}

// 切换横竖屏
function toggleScreenOrientation() {
  deviceStore.toggleOrientation()
}

// 获取开关图标
function getToggleIcon(key: string): string {
  const icons: Record<string, string> = {
    wifi: 'fas fa-wifi',
    bluetooth: 'fab fa-bluetooth-b',
    cellular: 'fas fa-signal',
    airplane: 'fas fa-plane',
    flashlight: 'fas fa-bolt',
    doNotDisturb: 'fas fa-moon',
    rotation: 'fas fa-sync-alt',
    hotspot: 'fas fa-broadcast-tower',
    nfc: 'fas fa-nfc',
    location: 'fas fa-location-arrow',
    darkMode: 'fas fa-adjust',
    batterySaver: 'fas fa-battery-half',
    screenOrientation: 'fas fa-mobile-alt',
  }
  return icons[key] || 'fas fa-cog'
}

// 判断开关是否被禁用（飞行模式下某些功能不可用）
function isToggleDisabled(key: string): boolean {
  if (toggles.value.airplane && (key === 'wifi' || key === 'cellular' || key === 'hotspot')) {
    return true
  }
  return false
}

// 获取开关名称
function getToggleName(key: string): string {
  const names: Record<string, string> = {
    wifi: 'Wi-Fi',
    bluetooth: '蓝牙',
    cellular: '蜂窝数据',
    airplane: '飞行模式',
    flashlight: '手电筒',
    doNotDisturb: '勿扰模式',
    rotation: '自动旋转',
    hotspot: '个人热点',
    nfc: 'NFC',
    location: '定位',
    darkMode: '深色模式',
    batterySaver: '省电模式',
  }
  return names[key] || key
}
</script>

<template>
  <div
    ref="containerRef"
    class="control-center"
    :class="{
      'ios-style': isIOSStyle,
      'android-style': isAndroidStyle,
      'is-tablet': isTablet
    }"
  >
    <div class="control-content">
      <!-- iOS 风格控制中心 -->
      <template v-if="isIOSStyle">
        <div class="ios-control-wrapper" :class="{ 'tablet-layout': isTablet }">
          <div class="ios-control-grid">
          <!-- 网络控制模块 (2x2) -->
          <div class="ios-module ios-network-module">
            <div class="ios-toggle-grid">
              <button
                class="ios-toggle"
                :class="{ active: toggles.airplane }"
                @click="toggle('airplane')"
              >
                <i class="fas fa-plane"></i>
              </button>
              <button
                class="ios-toggle"
                :class="{ active: toggles.cellular }"
                @click="toggle('cellular')"
              >
                <i class="fas fa-signal"></i>
              </button>
              <button
                class="ios-toggle"
                :class="{ active: toggles.wifi }"
                @click="toggle('wifi')"
              >
                <i class="fas fa-wifi"></i>
              </button>
              <button
                class="ios-toggle"
                :class="{ active: toggles.bluetooth }"
                @click="toggle('bluetooth')"
              >
                <i class="fab fa-bluetooth-b"></i>
              </button>
            </div>
          </div>
          
          <!-- 媒体控制模块 (2x2) -->
          <div class="ios-module ios-media-module">
            <div class="ios-now-playing">
              <div class="ios-track-info">
                <div class="ios-track-title">{{ nowPlaying.title }}</div>
                <div class="ios-track-artist">{{ nowPlaying.artist || 'Not Playing' }}</div>
              </div>
              <div class="ios-album-art">
                <i class="fas fa-music"></i>
              </div>
            </div>
            <div class="ios-media-controls">
              <button class="ios-media-btn">
                <i class="fas fa-backward"></i>
              </button>
              <button class="ios-media-btn ios-play-btn">
                <i :class="nowPlaying.isPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
              </button>
              <button class="ios-media-btn">
                <i class="fas fa-forward"></i>
              </button>
            </div>
          </div>
          
          <!-- 旋转锁定 (1x1) -->
          <div class="ios-module ios-small-toggle">
            <button
              class="ios-toggle"
              :class="{ active: !toggles.rotation }"
              @click="toggle('rotation')"
            >
              <i class="fas fa-lock" v-if="!toggles.rotation"></i>
              <i class="fas fa-lock-open" v-else></i>
            </button>
          </div>

          <!-- 镜像/投屏 (1x1) -->
          <div class="ios-module ios-small-toggle">
             <button class="ios-toggle">
              <i class="fas fa-clone"></i>
            </button>
          </div>

          <!-- 亮度滑块 (1x2 Vertical) -->
          <div
            class="ios-module ios-slider-vertical"
            @mousedown="startSliderDrag($event, 'brightness')"
            @touchstart="startSliderDrag($event, 'brightness')"
          >
            <div class="ios-slider-fill" :style="{ height: brightness + '%' }"></div>
            <div class="ios-slider-icon">
              <i class="fas fa-sun" :class="{ 'text-dark': brightness > 50 }"></i>
            </div>
          </div>
          
          <!-- 音量滑块 (1x2 Vertical) -->
          <div
            class="ios-module ios-slider-vertical"
            @mousedown="startSliderDrag($event, 'volume')"
            @touchstart="startSliderDrag($event, 'volume')"
          >
            <div class="ios-slider-fill" :style="{ height: volume + '%' }"></div>
            <div class="ios-slider-icon">
              <i class="fas fa-volume-up" :class="{ 'text-dark': volume > 50 }"></i>
            </div>
          </div>

          <!-- 勿扰模式 (2x1 or 1x1) -->
          <div class="ios-module ios-toggle-module">
            <button
              class="ios-toggle-lg"
              :class="{ active: toggles.doNotDisturb }"
              @click="toggle('doNotDisturb')"
            >
              <i class="fas fa-moon"></i>
              <span>勿扰</span>
            </button>
          </div>
          
          <!-- 手电筒 (1x1) -->
          <div class="ios-module ios-small-toggle">
            <button
              class="ios-toggle"
              :class="{ active: toggles.flashlight }"
              @click="toggle('flashlight')"
            >
              <i class="fas fa-bolt"></i>
            </button>
          </div>

          <!-- 其他小开关 -->
          <div class="ios-module ios-small-toggle">
            <button
              class="ios-toggle"
              :class="{ active: toggles.location }"
              @click="toggle('location')"
            >
              <i class="fas fa-location-arrow"></i>
            </button>
          </div>

          <div class="ios-module ios-small-toggle">
            <button class="ios-toggle">
              <i class="fas fa-calculator"></i>
            </button>
          </div>

          <div class="ios-module ios-small-toggle">
            <button class="ios-toggle">
              <i class="fas fa-camera"></i>
            </button>
          </div>
          
          <!-- 横竖屏切换（仅手机和平板模式可用） -->
          <div v-if="deviceStore.canRotate" class="ios-module ios-small-toggle">
            <button
              class="ios-toggle"
              :class="{ active: deviceStore.isLandscape }"
              @click="toggleScreenOrientation"
            >
              <i class="fas fa-mobile-alt" :class="{ 'fa-rotate-90': deviceStore.isLandscape }"></i>
            </button>
          </div>
          </div>
        
          <!-- 设备模式切换 -->
          <div class="ios-device-mode-section">
            <DeviceModeSwitch />
          </div>
        </div>
      </template>
      
      <!-- Android 风格控制中心 -->
      <template v-else-if="isAndroidStyle">
        <div class="android-control-panel">
          <!-- 快捷设置网格 -->
          <div class="android-quick-settings">
            <button
              v-for="(active, key) in toggles"
              :key="key"
              class="android-quick-tile"
              :class="{ active, disabled: isToggleDisabled(key as string) }"
              @click="toggle(key as keyof typeof toggles)"
            >
              <div class="android-tile-icon">
                <i :class="getToggleIcon(key as string)"></i>
              </div>
              <span class="android-tile-label">{{ getToggleName(key as string) }}</span>
            </button>
            
            <!-- 横竖屏切换按钮 -->
            <button
              v-if="deviceStore.canRotate"
              class="android-quick-tile"
              :class="{ active: deviceStore.isLandscape }"
              @click="toggleScreenOrientation"
            >
              <div class="android-tile-icon">
                <i class="fas fa-mobile-alt" :class="{ 'fa-rotate-90': deviceStore.isLandscape }"></i>
              </div>
              <span class="android-tile-label">{{ deviceStore.isLandscape ? '横屏' : '竖屏' }}</span>
            </button>
          </div>
          
          <!-- 亮度控制 -->
          <div class="android-slider-container">
            <i class="fas fa-sun"></i>
            <input 
              type="range" 
              v-model="brightness" 
              min="0" 
              max="100"
              class="android-slider"
            />
          </div>
          
          <!-- 设备模式切换 -->
          <div class="android-device-mode-section">
            <div class="android-section-title">设备模式</div>
            <DeviceModeSwitch />
          </div>
          
          <!-- 底部快捷入口 -->
          <div class="android-shortcuts">
            <button class="android-shortcut">
              <i class="fas fa-cog"></i>
              <span>设置</span>
            </button>
            <button class="android-shortcut">
              <i class="fas fa-user-cog"></i>
              <span>个人资料</span>
            </button>
            <button class="android-shortcut">
              <i class="fas fa-power-off"></i>
              <span>电源</span>
            </button>
          </div>
        </div>
      </template>
      
      <!-- 默认样式 -->
      <template v-else>
        <div class="default-control-panel">
          <!-- 设备模式切换 -->
          <div class="default-device-mode-section">
            <div class="default-section-title">设备模式</div>
            <DeviceModeSwitch />
          </div>
          
          <div class="default-toggles-grid">
            <button
              v-for="(active, key) in toggles"
              :key="key"
              class="default-toggle-btn"
              :class="{ active, disabled: isToggleDisabled(key as string) }"
              @click="toggle(key as keyof typeof toggles)"
            >
              <i :class="getToggleIcon(key as string)"></i>
              <span>{{ getToggleName(key as string) }}</span>
            </button>
            
            <!-- 横竖屏切换按钮 -->
            <button
              v-if="deviceStore.canRotate"
              class="default-toggle-btn"
              :class="{ active: deviceStore.isLandscape }"
              @click="toggleScreenOrientation"
            >
              <i class="fas fa-mobile-alt" :class="{ 'fa-rotate-90': deviceStore.isLandscape }"></i>
              <span>{{ deviceStore.isLandscape ? '横屏' : '竖屏' }}</span>
            </button>
          </div>
          
          <div class="default-slider-group">
            <div class="default-slider-item">
              <i class="fas fa-sun"></i>
              <input 
                type="range" 
                v-model="brightness" 
                min="0" 
                max="100"
                class="default-slider"
              />
              <span>{{ brightness }}%</span>
            </div>
            <div class="default-slider-item">
              <i class="fas fa-volume-up"></i>
              <input 
                type="range" 
                v-model="volume" 
                min="0" 
                max="100"
                class="default-slider"
              />
              <span>{{ volume }}%</span>
            </div>
          </div>
        </div>
      </template>
    </div>
    
    <!-- 底部指示条 -->
    <div class="home-indicator-area" @click="close">
      <div class="home-indicator"></div>
      <span class="swipe-hint">向上滑动关闭 · 左右滑动切换</span>
    </div>
  </div>
</template>

<style scoped>
.control-center {
  @apply absolute inset-0 z-50;
  @apply flex flex-col;
  @apply overflow-hidden;
  /* 基础模糊效果，具体风格会覆盖 */
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
}

.control-content {
  @apply flex-1 overflow-y-auto;
  @apply px-4 pt-14 pb-6;
  /* 隐藏滚动条但保持功能 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

/* 平板模式布局调整 */
.control-center.is-tablet .control-content {
  @apply flex items-start justify-end p-6 pt-10;
}

/* iOS 控制包装器 - 用于统一布局 */
.ios-control-wrapper {
  @apply flex flex-col;
}

.ios-control-wrapper.tablet-layout {
  @apply w-[360px];
}

.control-content::-webkit-scrollbar {
  display: none;
}

/* 底部指示区域 */
.home-indicator-area {
  @apply py-5 flex flex-col items-center gap-2;
  @apply cursor-pointer;
  background: linear-gradient(to top, rgba(0,0,0,0.2), transparent);
}

.home-indicator {
  @apply w-36 h-1.5 bg-white/40 rounded-full;
  @apply transition-all duration-300;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.home-indicator-area:hover .home-indicator {
  @apply bg-white/80 w-40;
}

.swipe-hint {
  @apply text-[10px] text-white/30 font-medium tracking-wide;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* ==================== iOS 风格 (仿 iOS 17/18) ==================== */
.ios-style {
  /* 更通透的深色背景 */
  background: rgba(30, 30, 30, 0.4);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
}

.ios-control-grid {
  @apply grid grid-cols-4 gap-4; /* 增加间距 */
  @apply w-full max-w-[400px] mx-auto; /* 限制最大宽度 */
}

/* 平板模式下的网格 - 移除单独样式，由包装器控制 */
.ios-control-wrapper.tablet-layout .ios-control-grid {
  @apply w-full mx-0; /* 填满包装器 */
  @apply gap-4;
}

.ios-module {
  @apply rounded-[20px]; /* 更圆润的角 */
  background: rgba(30, 30, 30, 0.6); /* 深灰色玻璃感 */
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  /* border: 1px solid rgba(255, 255, 255, 0.05); */
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  @apply transition-transform duration-200;
  @apply overflow-hidden;
}

.ios-module:active {
  transform: scale(0.96);
}

.ios-network-module {
  @apply col-span-2 row-span-2 p-3;
}

.ios-toggle-grid {
  @apply grid grid-cols-2 gap-3 h-full;
}

.ios-toggle {
  @apply w-full aspect-square rounded-full;
  @apply flex items-center justify-center;
  @apply text-white text-xl;
  background: rgba(255, 255, 255, 0.12);
  @apply transition-all duration-300;
}

.ios-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
}

.ios-toggle.active {
  background: #007AFF; /* iOS System Blue */
  color: white;
  box-shadow: 0 0 12px rgba(0, 122, 255, 0.4);
}

.ios-toggle.active:hover {
  background: #006EE6;
}

/* 绿色蜂窝数据 */
.ios-toggle.active:nth-child(2) {
  background: #34C759;
  box-shadow: 0 0 12px rgba(52, 199, 89, 0.4);
}

.ios-media-module {
  @apply col-span-2 row-span-2 p-4;
  @apply flex flex-col justify-between;
  background: rgba(50, 50, 50, 0.65);
}

.ios-now-playing {
  @apply flex items-center gap-3;
}

.ios-album-art {
  @apply w-12 h-12 rounded-lg shadow-md;
  @apply flex items-center justify-center;
  background: linear-gradient(135deg, #a8c0ff, #3f2b96);
  @apply text-white/90 text-lg;
}

.ios-track-info {
  @apply flex-1 min-w-0 flex flex-col justify-center;
}

.ios-track-title {
  @apply text-base font-semibold text-white truncate leading-tight;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.ios-track-artist {
  @apply text-xs text-white/60 truncate mt-0.5;
}

.ios-media-controls {
  @apply flex items-center justify-between px-2 mt-2;
}

.ios-media-btn {
  @apply text-white/80 text-xl;
  @apply transition-all duration-200;
}

.ios-media-btn:hover {
  @apply text-white scale-110;
}

.ios-play-btn {
  @apply text-3xl text-white;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

.ios-toggle-module {
  @apply col-span-1 aspect-square p-0;
  @apply flex items-center justify-center;
  @apply overflow-hidden;
}

.ios-toggle-lg {
  @apply w-full h-full rounded-[20px];
  @apply flex flex-col items-center justify-center gap-1.5;
  @apply text-white;
  background: transparent;
  @apply transition-all duration-300;
}

.ios-toggle-lg:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ios-toggle-lg.active {
  background: #5E5CE6; /* iOS Focus Purple */
  color: white;
  box-shadow: 0 4px 12px rgba(94, 92, 230, 0.3);
}

.ios-toggle-lg i {
  @apply text-2xl mb-0.5;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.ios-toggle-lg span {
  @apply text-[11px] font-medium tracking-wide;
}

/* 垂直滑块样式 */
.ios-slider-vertical {
  @apply col-span-1 row-span-2;
  @apply relative;
  @apply flex flex-col justify-end items-center;
  background: rgba(30, 30, 30, 0.6);
  @apply cursor-pointer;
  @apply transition-transform duration-100;
}

.ios-slider-vertical:active {
  transform: scale(0.96);
}

.ios-slider-fill {
  @apply absolute bottom-0 left-0 right-0 bg-white;
  @apply transition-all duration-100 ease-out;
  /* 确保不覆盖圆角 */
  border-radius: 0 0 20px 20px;
}

/* 当充满时，圆角也要变化 */
.ios-slider-vertical[style*="height: 100%"] .ios-slider-fill {
  border-radius: 20px;
}

.ios-slider-icon {
  @apply absolute bottom-4 left-0 right-0 text-center z-10;
  @apply pointer-events-none;
}

.ios-slider-icon i {
  @apply text-white/80 text-xl;
  @apply transition-colors duration-200;
}

.ios-slider-icon i.text-dark {
  @apply text-black/60;
}

.ios-small-toggle {
  @apply col-span-1 aspect-square p-0;
}

.ios-small-toggle .ios-toggle {
  @apply w-full h-full rounded-[20px];
  background: rgba(50, 50, 50, 0.65);
  /* border: 1px solid rgba(255, 255, 255, 0.08); */
}

.ios-small-toggle .ios-toggle.active {
  background: #FF3B30; /* 红色用于旋转锁定等 */
  color: white;
}

/* 定位按钮激活色 */
.ios-small-toggle:has(.fa-location-arrow) .ios-toggle.active {
  background: #34C759;
}

/* 手电筒激活色 */
.ios-small-toggle:has(.fa-bolt) .ios-toggle.active {
  background: #007AFF;
  box-shadow: 0 0 15px rgba(0, 122, 255, 0.6);
}

/* ==================== Android 风格 (Material You) ==================== */
.android-style {
  background: #121212; /* 纯黑/深灰背景 */
  color: #E3E2E6;
}

.android-control-panel {
  @apply space-y-6;
  @apply px-1;
}

.android-quick-settings {
  @apply grid grid-cols-4 gap-3;
}

.android-quick-tile {
  @apply flex flex-col items-center gap-2 p-0 rounded-full;
  @apply transition-all duration-300;
  background: transparent;
}

.android-tile-icon {
  @apply w-[68px] h-[68px] rounded-[28px]; /* 方圆形 */
  @apply flex items-center justify-center;
  @apply text-2xl;
  background: #343434;
  color: #E3E2E6;
  @apply transition-all duration-300;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.android-quick-tile.active .android-tile-icon {
  background: #D0BCFF; /* Material You Primary Light */
  color: #381E72; /* Material You On-Primary */
  box-shadow: 0 4px 8px rgba(208, 188, 255, 0.2);
}

.android-tile-label {
  @apply text-[11px] font-medium text-center tracking-wide;
  @apply text-white/80;
  @apply line-clamp-1 w-full px-1;
}

.android-quick-tile.active .android-tile-label {
  @apply text-white font-semibold;
}

.android-quick-tile.disabled {
  @apply opacity-50;
}

.android-slider-container {
  @apply flex items-center gap-4 px-1 py-2;
  @apply text-white/80;
}

.android-slider-container i {
  @apply text-xl;
}

.android-slider {
  @apply flex-1 h-12; /* 粗滑块 */
  @apply appearance-none;
  @apply bg-[#343434] rounded-[24px];
  @apply overflow-hidden;
  border: 1px solid rgba(255,255,255,0.05);
}

.android-slider::-webkit-slider-thumb {
  @apply appearance-none;
  @apply w-0 h-full;
  box-shadow: -100vw 0 0 100vw #D0BCFF; /* Material You 填充色 */
}

.android-shortcuts {
  @apply flex justify-around pt-6 mt-4;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.android-shortcut {
  @apply flex flex-col items-center gap-2;
  @apply text-white/60 text-xs font-medium;
  @apply hover:text-white transition-colors;
  @apply p-2 rounded-xl hover:bg-white/5;
}

.android-shortcut i {
  @apply text-xl mb-0.5;
}

/* ==================== 默认样式 (Glassmorphism) ==================== */
.control-center:not(.ios-style):not(.android-style) {
  background: linear-gradient(135deg, rgba(20,20,20,0.9), rgba(40,40,40,0.8));
}

.default-control-panel {
  @apply space-y-6;
}

.default-toggles-grid {
  @apply grid grid-cols-3 gap-4;
}

.default-toggle-btn {
  @apply flex flex-col items-center gap-3 p-4 rounded-2xl;
  @apply text-white/70;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.05);
  @apply transition-all duration-200;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.default-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.default-toggle-btn.active {
  @apply text-white;
  background: linear-gradient(135deg, #007AFF, #0056b3);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  border-color: transparent;
}

.default-toggle-btn i {
  @apply text-2xl;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
}

.default-toggle-btn span {
  @apply text-xs font-medium tracking-wide;
}

.default-slider-group {
  @apply space-y-5 p-2;
}

.default-slider-item {
  @apply flex items-center gap-4;
  @apply text-white/80;
}

.default-slider-item i {
  @apply w-6 text-center text-lg;
}

.default-slider-item span {
  @apply w-12 text-right text-sm font-mono opacity-70;
}

.default-slider {
  @apply flex-1 h-2;
  @apply appearance-none;
  @apply bg-white/10 rounded-full;
  @apply cursor-pointer;
}

.default-slider::-webkit-slider-thumb {
  @apply appearance-none;
  @apply w-5 h-5 rounded-full;
  @apply bg-white;
  box-shadow: 0 0 10px rgba(255,255,255,0.5);
  @apply transition-transform duration-100;
}

.default-slider::-webkit-slider-thumb:hover {
  @apply scale-125;
}

/* ==================== 设备模式切换区域 ==================== */
.ios-device-mode-section {
  @apply mt-6 pt-4 pb-2;
  @apply flex justify-center;
  @apply w-full;
}

.android-device-mode-section {
  @apply py-4;
}

.android-section-title {
  @apply text-sm font-medium text-white/70 mb-3 px-2;
}

.default-device-mode-section {
  @apply p-4 rounded-2xl mb-4;
  background: rgba(255, 255, 255, 0.08);
}

.default-section-title {
  @apply text-sm font-medium text-white/70 mb-3 text-center;
}
</style>