<script setup lang="ts">
/**
 * 状态徽章组件
 * 显示连接状态的小标签
 */
import { computed } from 'vue'

const props = defineProps<{
  /** 是否已连接 */
  connected: boolean
  /** 是否有错误 */
  error?: boolean
  /** 自定义已连接文本 */
  connectedText?: string
  /** 自定义未连接文本 */
  disconnectedText?: string
  /** 自定义错误文本 */
  errorText?: string
}>()

const statusClass = computed(() => {
  if (props.error) return 'error'
  if (props.connected) return 'connected'
  return 'disconnected'
})

const statusText = computed(() => {
  if (props.error) return props.errorText || '连接失败'
  if (props.connected) return props.connectedText || '已连接'
  return props.disconnectedText || '未连接'
})
</script>

<template>
  <span class="status-badge" :class="statusClass">
    <span class="status-dot" />
    <span class="status-text">{{ statusText }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium;
}

.status-badge.connected {
  background-color: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-badge.disconnected {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-badge.error {
  background-color: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-dot {
  @apply w-2 h-2 rounded-full;
}

.status-badge.connected .status-dot {
  background-color: #22c55e;
  animation: pulse 2s infinite;
}

.status-badge.disconnected .status-dot {
  background-color: #ef4444;
}

.status-badge.error .status-dot {
  background-color: #f59e0b;
  animation: blink 1s infinite;
}

@keyframes pulse {
 0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
