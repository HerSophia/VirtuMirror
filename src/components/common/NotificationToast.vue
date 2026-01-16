<script setup lang="ts">
/**
 * NotificationToast - Toast 通知弹窗组件
 *
 * 用于在状态栏下方显示新通知的横幅
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useTheme } from '@/composables/useTheme'
import DynamicAppIcon from './DynamicAppIcon.vue'

const router = useRouter()
const notificationStore = useNotificationStore()
const { currentTheme } = useTheme()

const notification = computed(() => notificationStore.activeToast)

// 判断主题风格
const isIOSStyle = computed(() => {
  const themeId = currentTheme.value.id
  return themeId === 'ios' || themeId === 'dark'
})

const isAndroidStyle = computed(() => {
  return currentTheme.value.id === 'android'
})

// 格式化时间
const timeText = computed(() => {
  if (!notification.value) return ''
  return notificationStore.formatNotificationTime(notification.value.timestamp)
})

// 点击通知
function handleClick() {
  if (!notification.value) return
  
  // 标记为已读
  notificationStore.markAsRead(notification.value.id)
  
  // 跳转路由
  if (notification.value.route) {
    router.push(notification.value.route)
  }
  
  // 关闭 Toast
  notificationStore.dismissToast()
}

// 关闭
function handleDismiss() {
  notificationStore.dismissToast()
}
</script>

<template>
  <Transition name="toast">
    <div
      v-if="notification"
      :key="notification.id"
      class="notification-toast"
      :class="{
        'ios-style': isIOSStyle,
        'android-style': isAndroidStyle,
      }"
      @click="handleClick"
    >
      <div class="toast-content">
        <!-- 应用图标 -->
        <DynamicAppIcon
          :app-id="notification.appId"
          :icon="notification.appIcon"
          size="md"
          :rounded="isIOSStyle"
          class="toast-icon"
        />
        
        <!-- 文字内容 -->
        <div class="toast-text">
          <div class="toast-header">
            <span class="toast-app">{{ notification.appName }}</span>
            <span class="toast-time">{{ timeText }}</span>
          </div>
          <div class="toast-title">{{ notification.title }}</div>
          <div class="toast-body">{{ notification.body }}</div>
        </div>
        
        <!-- 关闭按钮 -->
        <button
          v-if="notification.dismissible"
          class="toast-close"
          @click.stop="handleDismiss"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <!-- 快捷操作 -->
      <div v-if="notification.actions?.length" class="toast-actions">
        <button
          v-for="action in notification.actions"
          :key="action.id"
          class="toast-action"
          :class="{ destructive: action.destructive }"
        >
          <i v-if="action.icon" :class="action.icon"></i>
          <span>{{ action.label }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.notification-toast {
  @apply absolute top-12 left-2 right-2 z-[100];
  @apply rounded-2xl;
  @apply overflow-hidden;
  @apply cursor-pointer;
  @apply transition-all duration-200;
  background: rgba(50, 50, 50, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.notification-toast:hover {
  transform: scale(1.02);
}

.notification-toast:active {
  transform: scale(0.98);
}

/* iOS 风格 */
.notification-toast.ios-style {
  @apply rounded-3xl;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 0 0 0.5px rgba(0, 0, 0, 0.05);
}

.ios-style .toast-app,
.ios-style .toast-title {
  @apply text-gray-900;
}

.ios-style .toast-time,
.ios-style .toast-body {
  @apply text-gray-500;
}

.ios-style .toast-close {
  @apply text-gray-400 hover:text-gray-600;
}

/* Android 风格 */
.notification-toast.android-style {
  @apply rounded-[28px];
  background: #2D2D2D;
}

.toast-content {
  @apply flex items-start gap-3 p-3;
}

.toast-text {
  @apply flex-1 min-w-0;
}

.toast-header {
  @apply flex items-center gap-2 mb-0.5;
}

.toast-app {
  @apply text-xs font-medium text-white/70;
}

.toast-time {
  @apply text-[10px] text-white/40;
}

.toast-title {
  @apply text-sm font-semibold text-white truncate;
}

.toast-body {
  @apply text-xs text-white/70 line-clamp-2;
}

.toast-close {
  @apply w-6 h-6 flex items-center justify-center;
  @apply text-white/50 hover:text-white;
  @apply rounded-full hover:bg-white/10;
  @apply transition-colors;
}

.toast-actions {
  @apply flex border-t border-white/10;
}

.toast-action {
  @apply flex-1 py-2 text-center;
  @apply text-sm font-medium text-blue-400;
  @apply hover:bg-white/5;
  @apply transition-colors;
}

.toast-action.destructive {
  @apply text-red-400;
}

.toast-action + .toast-action {
  @apply border-l border-white/10;
}

/* 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease-out;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
</style>
