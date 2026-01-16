<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { usePhoneStore } from '@/stores/phoneStore'
import { useTheme } from '@/composables/useTheme'
import { useTimeStore } from '@/stores/timeStore'

const uiStore = useUIStore()
const phoneStore = usePhoneStore()
const { currentTheme } = useTheme()
const timeStore = useTimeStore()

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

// 模拟通知数据
const notifications = ref([
  {
    id: '1',
    app: '微信',
    icon: 'fab fa-weixin',
    iconBg: '#07C160',
    title: '小明',
    message: '在吗？想问你一个问题',
    time: '刚刚',
    unread: true,
  },
  {
    id: '2',
    app: '邮件',
    icon: 'fas fa-envelope',
    iconBg: '#007AFF',
    title: '工作通知',
    message: '您有一封新邮件待处理',
    time: '5分钟前',
    unread: true,
  },
  {
    id: '3',
    app: '日历',
    icon: 'fas fa-calendar',
    iconBg: '#FF3B30',
    title: '会议提醒',
    message: '下午3点 - 项目评审会议',
    time: '10分钟前',
    unread: false,
  },
])

// 当前时间
const currentTime = computed(() => timeStore.formatTime(timeStore.currentTime))

// 当前日期
const currentDate = computed(() => {
  const now = new Date()
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = weekdays[now.getDay()]
  return `${month}月${day}日 ${weekday}`
})

// 关闭通知中心
function close() {
  uiStore.closePullDownPanel()
}

// 清除所有通知
function clearAll() {
  notifications.value = []
}

// 删除单个通知
function removeNotification(id: string) {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

// 手势处理
function handlePointerDown(clientX: number, clientY: number, target: EventTarget | null) {
  // 只在空余区域响应手势（不在通知卡片上）
  if (target && (target as HTMLElement).closest('.ios-notification-card, .android-notification-card, .default-notification-card')) {
    return
  }
  
  isSwiping = true
  startX = clientX
  startY = clientY
}

function handlePointerMove(clientX: number, clientY: number) {
  // 暂时不处理移动中的视觉反馈
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
      // 向右滑动 - 无操作（通知中心在左侧）
    } else if (deltaX < -SWIPE_THRESHOLD) {
      // 向左滑动 - 切换到控制中心
      uiStore.openPullDownPanel('control')
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
</script>

<template>
  <div
    ref="containerRef"
    class="notification-center"
    :class="{
      'ios-style': isIOSStyle,
      'android-style': isAndroidStyle,
    }"
  >
    <div class="notification-content">
      <!-- iOS 风格 -->
      <template v-if="isIOSStyle">
        <!-- 时间和日期 -->
        <div class="ios-header">
          <div class="ios-lock-icon">
            <i class="fas fa-lock"></i>
          </div>
          <div class="ios-time">{{ currentTime }}</div>
          <div class="ios-date">{{ currentDate }}</div>
        </div>
        
        <!-- 通知列表 -->
        <div class="ios-notifications">
          <div 
            v-for="notification in notifications" 
            :key="notification.id"
            class="ios-notification-card"
          >
            <div class="ios-notification-header">
              <div 
                class="ios-notification-icon"
                :style="{ backgroundColor: notification.iconBg }"
              >
                <i :class="notification.icon"></i>
              </div>
              <span class="ios-notification-app">{{ notification.app }}</span>
              <span class="ios-notification-time">{{ notification.time }}</span>
            </div>
            <div class="ios-notification-body">
              <div class="ios-notification-title">{{ notification.title }}</div>
              <div class="ios-notification-message">{{ notification.message }}</div>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="notifications.length === 0" class="ios-empty-state">
            <i class="fas fa-bell-slash"></i>
            <p>没有通知</p>
          </div>
        </div>
      </template>
      
      <!-- Android 风格 -->
      <template v-else-if="isAndroidStyle">
        <!-- 顶部状态栏信息 -->
        <div class="android-header">
          <div class="android-time">{{ currentTime }}</div>
          <div class="android-date">{{ currentDate }}</div>
        </div>
        
        <!-- 快捷设置预览 -->
        <div class="android-quick-toggles">
          <div class="android-toggle active">
            <i class="fas fa-wifi"></i>
          </div>
          <div class="android-toggle active">
            <i class="fas fa-bluetooth-b"></i>
          </div>
          <div class="android-toggle">
            <i class="fas fa-moon"></i>
          </div>
          <div class="android-toggle">
            <i class="fas fa-plane"></i>
          </div>
          <div class="android-toggle active">
            <i class="fas fa-location-arrow"></i>
          </div>
        </div>
        
        <!-- 亮度滑块 -->
        <div class="android-brightness">
          <i class="fas fa-sun"></i>
          <div class="android-brightness-slider">
            <div class="android-brightness-fill" style="width: 60%"></div>
          </div>
        </div>
        
        <!-- 通知列表 -->
        <div class="android-notifications">
          <div class="android-notifications-header">
            <span>通知</span>
            <button v-if="notifications.length > 0" @click="clearAll" class="android-clear-btn">
              清除全部
            </button>
          </div>
          
          <div 
            v-for="notification in notifications" 
            :key="notification.id"
            class="android-notification-card"
          >
            <div 
              class="android-notification-icon"
              :style="{ backgroundColor: notification.iconBg }"
            >
              <i :class="notification.icon"></i>
            </div>
            <div class="android-notification-content">
              <div class="android-notification-top">
                <span class="android-notification-app">{{ notification.app }}</span>
                <span class="android-notification-time">{{ notification.time }}</span>
              </div>
              <div class="android-notification-title">{{ notification.title }}</div>
              <div class="android-notification-message">{{ notification.message }}</div>
            </div>
            <button 
              class="android-notification-dismiss"
              @click="removeNotification(notification.id)"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- 空状态 -->
          <div v-if="notifications.length === 0" class="android-empty-state">
            <i class="fas fa-check-circle"></i>
            <p>没有新通知</p>
          </div>
        </div>
      </template>
      
      <!-- 默认样式（其他主题） -->
      <template v-else>
        <div class="default-header">
          <div class="default-time">{{ currentTime }}</div>
          <div class="default-date">{{ currentDate }}</div>
        </div>
        
        <div class="default-notifications">
          <div 
            v-for="notification in notifications" 
            :key="notification.id"
            class="default-notification-card"
          >
            <div 
              class="default-notification-icon"
              :style="{ backgroundColor: notification.iconBg }"
            >
              <i :class="notification.icon"></i>
            </div>
            <div class="default-notification-content">
              <div class="default-notification-title">{{ notification.title }}</div>
              <div class="default-notification-message">{{ notification.message }}</div>
            </div>
            <span class="default-notification-time">{{ notification.time }}</span>
          </div>
          
          <div v-if="notifications.length === 0" class="default-empty-state">
            <i class="fas fa-bell-slash"></i>
            <p>没有通知</p>
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
.notification-center {
  @apply absolute inset-0 z-50;
  @apply flex flex-col;
  @apply overflow-hidden;
  /* 基础模糊，具体风格会覆盖 */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.notification-content {
  @apply flex-1 overflow-y-auto;
  @apply px-4 pt-12 pb-8;
  /* 隐藏滚动条 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.notification-content::-webkit-scrollbar {
  display: none;
}

/* ==================== iOS 风格 (仿 iOS 17/18) ==================== */
.ios-style {
  /* 磨砂玻璃背景 */
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(50px) saturate(150%);
  -webkit-backdrop-filter: blur(50px) saturate(150%);
}

.ios-style .notification-content {
  @apply pt-16;
}

.ios-header {
  @apply text-center text-white mb-10;
  @apply flex flex-col items-center;
}

.ios-lock-icon {
  @apply text-xl mb-4 opacity-60;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
}

.ios-time {
  @apply text-[86px] font-medium tracking-tight leading-none;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.ios-date {
  @apply text-xl font-medium opacity-90 mt-2 tracking-wide;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.ios-notifications {
  @apply space-y-2.5;
  @apply max-w-md mx-auto; /* 限制宽度以获得更好的阅读体验 */
}

.ios-notification-card {
  @apply rounded-[20px] p-3.5;
  background: rgba(245, 245, 245, 0.75); /* 浅色模式下的半透明白 */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  @apply transition-transform duration-200;
}

/* 深色模式适配 (这里简单用 .ios-style 覆盖，实际可能需要更复杂的 dark mode 检测) */
.ios-style .ios-notification-card {
  background: rgba(60, 60, 60, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ios-notification-card:active {
  transform: scale(0.98);
}

.ios-notification-header {
  @apply flex items-center gap-2.5 mb-2.5;
}

.ios-notification-icon {
  @apply w-[22px] h-[22px] rounded-[6px] flex items-center justify-center;
  @apply text-white text-[10px];
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.ios-notification-app {
  @apply text-[13px] text-white/90 font-medium tracking-wide;
  text-shadow: 0 1px 1px rgba(0,0,0,0.1);
}

.ios-notification-time {
  @apply text-[11px] text-white/60 ml-auto font-medium;
}

.ios-notification-body {
  @apply text-white pl-1;
}

.ios-notification-title {
  @apply font-semibold text-[15px] mb-0.5 leading-tight;
  text-shadow: 0 1px 1px rgba(0,0,0,0.1);
}

.ios-notification-message {
  @apply text-[14px] opacity-90 line-clamp-3 leading-snug;
}

.ios-empty-state {
  @apply text-center text-white/40 py-20;
  @apply flex flex-col items-center gap-4;
}

.ios-empty-state i {
  @apply text-5xl opacity-50;
}

.ios-empty-state p {
  @apply text-lg font-medium tracking-wide;
}

/* 底部指示区域 */
.home-indicator-area {
  @apply py-5 flex flex-col items-center gap-2;
  @apply cursor-pointer;
  background: linear-gradient(to top, rgba(0,0,0,0.1), transparent);
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

/* ==================== Android 风格 (Material You) ==================== */
.android-style {
  background: #121212; /* 纯黑背景 */
  color: #E3E2E6;
}

.android-style .notification-content {
  @apply pt-10;
}

.android-header {
  @apply text-white mb-8 px-2;
}

.android-time {
  @apply text-[64px] font-normal leading-none tracking-tight;
  color: #E3E2E6;
}

.android-date {
  @apply text-lg opacity-80 mt-1 font-medium;
  color: #C4C7C5;
}

.android-quick-toggles {
  @apply flex gap-3 mb-6 px-1;
}

.android-toggle {
  @apply w-[52px] h-[52px] rounded-full;
  @apply flex items-center justify-center;
  @apply text-white/80 text-xl;
  background: #343434;
  @apply transition-all duration-200;
  border: 1px solid rgba(255,255,255,0.05);
}

.android-toggle.active {
  background: #D0BCFF;
  color: #381E72;
  border-color: transparent;
}

.android-brightness {
  @apply flex items-center gap-4 mb-8 px-2;
  @apply text-white/70;
}

.android-brightness-slider {
  @apply flex-1 h-12 rounded-[24px];
  background: #343434;
  @apply overflow-hidden relative;
  border: 1px solid rgba(255,255,255,0.05);
}

.android-brightness-fill {
  @apply h-full rounded-[24px];
  background: #D0BCFF;
  opacity: 0.8;
}

.android-notifications-header {
  @apply flex items-center justify-between mb-4 px-2;
  @apply text-white/70 text-sm font-medium;
}

.android-clear-btn {
  @apply text-xs px-3 py-1.5 rounded-full;
  @apply text-[#D0BCFF] bg-[#381E72];
  @apply hover:bg-[#4F378B] transition-colors;
  font-weight: 500;
}

.android-notifications {
  @apply space-y-2;
}

.android-notification-card {
  @apply flex items-start gap-4 p-4 rounded-[28px]; /* Material You 大圆角 */
  background: #343434; /* Surface Container High */
  @apply relative;
  @apply transition-transform duration-200;
  border: 1px solid rgba(255,255,255,0.05);
}

.android-notification-card:active {
  transform: scale(0.98);
}

.android-notification-icon {
  @apply w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0;
  @apply text-white text-sm;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.android-notification-content {
  @apply flex-1 min-w-0;
}

.android-notification-top {
  @apply flex items-center gap-2 mb-1;
}

.android-notification-app {
  @apply text-xs text-[#C4C7C5] font-medium;
}

.android-notification-time {
  @apply text-xs text-[#8E918F];
}

.android-notification-title {
  @apply text-base font-semibold text-[#E3E2E6] mb-0.5;
}

.android-notification-message {
  @apply text-sm text-[#C4C7C5] line-clamp-2 leading-relaxed;
}

.android-notification-dismiss {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  @apply text-[#8E918F] hover:text-[#E3E2E6] hover:bg-white/10;
  @apply transition-colors;
}

.android-empty-state {
  @apply text-center text-[#8E918F] py-16;
}

.android-empty-state i {
  @apply text-5xl mb-4 text-[#D0BCFF];
}

/* ==================== 默认样式 ==================== */
.notification-center:not(.ios-style):not(.android-style) {
  background: rgba(20, 20, 20, 0.95);
}

.default-header {
  @apply text-white text-center mb-8;
}

.default-time {
  @apply text-6xl font-light tracking-wider;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.default-date {
  @apply text-lg opacity-70 mt-2;
}

.default-notifications {
  @apply space-y-4;
}

.default-notification-card {
  @apply flex items-center gap-4 p-4 rounded-xl;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.default-notification-icon {
  @apply w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0;
  @apply text-white text-lg;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.default-notification-content {
  @apply flex-1 min-w-0;
}

.default-notification-title {
  @apply text-base font-medium text-white mb-1;
}

.default-notification-message {
  @apply text-sm text-white/70 line-clamp-1;
}

.default-notification-time {
  @apply text-xs text-white/50 font-mono;
}

.default-empty-state {
  @apply text-center text-white/50 py-16;
}

.default-empty-state i {
  @apply text-5xl mb-4;
}
</style>