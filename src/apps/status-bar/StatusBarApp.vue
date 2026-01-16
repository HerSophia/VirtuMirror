<script setup lang="ts">
/**
 * StatusBarApp - 状态栏 App
 * 
 * 状态栏是一个特殊的 App，始终显示在屏幕顶部。
 * 类似于 HomeApp（桌面）的设计理念，它虽然是 App 架构，
 * 但不参与路由系统，而是作为系统级 UI 组件常驻显示。
 * 
 * 功能：
 * - 显示时间
 * - 显示通知图标（在时间右侧）
 * - 显示系统状态图标（信号、WiFi、电池等）
 * - 作为下拉手势触发区域
 */
import { computed } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useTimeStore } from '@/stores/timeStore'
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue'

const uiStore = useUIStore()
const notificationStore = useNotificationStore()
const timeStore = useTimeStore()

const currentTime = computed(() => timeStore.formatTime(timeStore.currentTime))

// 可见的通知图标（最多显示5个，状态栏左侧区域）
const visibleNotificationIcons = computed(() =>
  notificationStore.visibleStatusBarIcons.slice(0, 5)
)

// 是否有更多未显示的通知图标
const hasMoreNotifications = computed(() =>
  notificationStore.visibleStatusBarIcons.length > 5
)
</script>

<template>
  <div class="status-bar-app" @mousedown.prevent>
    <!-- 左侧：时间 + 通知图标 -->
    <div class="status-bar-left">
      <span class="status-time">{{ currentTime }}</span>
      
      <!-- 通知图标区域 -->
      <div v-if="visibleNotificationIcons.length > 0" class="notification-icons">
        <div
          v-for="icon in visibleNotificationIcons"
          :key="icon.id"
          class="notification-icon-item"
          :title="icon.tooltip"
        >
          <DynamicAppIcon
            :icon="icon.icon"
            size="xxs"
            :show-background="false"
            :rounded="false"
          />
        </div>
        <span v-if="hasMoreNotifications" class="more-indicator">•</span>
      </div>
    </div>
    
    <!-- 右侧：系统图标 -->
    <div class="status-bar-right">
      <i class="fas fa-signal" />
      <i class="fas fa-wifi" />
      <i class="fas fa-battery-three-quarters" />
    </div>
  </div>
</template>

<style scoped>
.status-bar-app {
  @apply relative h-[44px] px-6 flex-shrink-0;
  @apply flex items-center justify-between z-40;
  @apply bg-transparent text-white text-xs font-medium;
  @apply select-none;
}

.status-bar-left {
  @apply flex items-center gap-3;
}

.status-bar-right {
  @apply flex items-center gap-2;
}

.status-time {
  @apply font-semibold;
}

.status-bar-app i {
  @apply text-sm;
}

/* 通知图标区域 */
.notification-icons {
  @apply flex items-center gap-1;
  @apply pl-2;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
}

.notification-icon-item {
  @apply flex items-center justify-center;
  @apply w-4 h-4;
  @apply text-white/90;
}

.notification-icon-item :deep(i) {
  @apply text-xs;
}

.notification-icon-item :deep(.notification-icon) {
  @apply bg-transparent;
}

.more-indicator {
  @apply text-white/60 text-xs leading-none;
}
</style>
