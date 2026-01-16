<script setup lang="ts">
/**
 * 状态分区
 * 显示当前连接状态概览
 */
import { computed } from 'vue'
import { useBridge } from '../composables'
import { SettingsGroup } from '@/apps/settings/components'
import StatusBadge from '../components/StatusBadge.vue'

const { status, connectionError, connect, disconnect, clearError } = useBridge()

const connectionTime = computed(() => {
  if (!status.value.lastSyncTime) return null
  return new Date(status.value.lastSyncTime).toLocaleTimeString()
})

const statusText = computed(() => {
  if (connectionError.value) return '连接失败'
  if (status.value.connected) return '已连接'
  return '未连接'
})
</script>

<template>
  <SettingsGroup>
    <div class="status-section">
      <div class="status-header">
        <div class="status-info">
          <div class="status-title">
            <span class="title-text">Bridge 服务器</span>
            <StatusBadge :connected="status.connected" :error="!!connectionError" />
          </div>
          <div class="status-url">{{ status.serverUrl }}</div>
        </div>

        <button
          class="connect-btn"
          :class="{ connected: status.connected }"
          @click="status.connected ? disconnect() : connect()"
        >
          <i :class="status.connected ? 'fas fa-plug-circle-xmark' : 'fas fa-plug'" />
          <span>{{ status.connected ? '断开' : '连接' }}</span>
        </button>
      </div>

      <!-- 错误信息 -->
      <div v-if="connectionError" class="error-message" @click="clearError">
        <i class="fas fa-exclamation-triangle" />
        <span>{{ connectionError }}</span>
        <i class="fas fa-times close-icon" />
      </div>

      <!-- 连接成功后的详情 -->
      <div v-if="status.connected" class="status-details">
        <div class="detail-row">
          <span class="detail-label">平台状态</span>
          <span class="detail-value" :class="{ active: status.platform }">
            {{ status.platform ? '已连接' : '等待平台...' }}
          </span>
        </div>
        <div v-if="connectionTime" class="detail-row">
          <span class="detail-label">最后同步</span>
          <span class="detail-value">{{ connectionTime }}</span>
        </div>
        <div v-if="status.platform" class="detail-row">
          <span class="detail-label">当前平台</span>
          <span class="detail-value">{{ status.platform.platform }}</span>
        </div>
        <div v-if="status.platform?.characterName" class="detail-row">
          <span class="detail-label">角色</span>
          <span class="detail-value">{{ status.platform.characterName }}</span>
        </div>
        <div v-if="status.currentSessionId" class="detail-row">
          <span class="detail-label">Session ID</span>
          <span class="detail-value session-id">{{ status.currentSessionId.substring(0, 8) }}...</span>
        </div>
        <div v-if="status.latency !== null" class="detail-row">
          <span class="detail-label">延迟</span>
          <span class="detail-value latency">{{ status.latency }}ms</span>
        </div>
      </div>
    </div>
  </SettingsGroup>
</template>

<style scoped>
.status-section {
  @apply p-4;
}

.status-header {
  @apply flex items-center justify-between gap-4;
}

.status-info {
  @apply flex-1;
}

.status-title {
  @apply flex items-center gap-2;
}

.title-text {
  @apply font-semibold;
  color: var(--color-text);
}

.status-url {
  @apply text-sm mt-1;
  color: var(--color-text-secondary);
}

.connect-btn {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors;
  background-color: var(--color-primary);
  color: white;
}

.connect-btn.connected {
  background-color: var(--color-error);
}

.connect-btn:hover {
  opacity: 0.9;
}

.error-message {
  @apply flex items-center gap-2 mt-3 p-3 rounded-lg text-sm cursor-pointer;
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.error-message .close-icon {
  @apply ml-auto;
  opacity: 0.6;
}

.error-message:hover .close-icon {
  opacity: 1;
}

.status-details {
  @apply mt-4 pt-4 space-y-2;
  border-top: 1px solid var(--color-border);
}

.detail-row {
  @apply flex items-center justify-between;
}

.detail-label {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.detail-value {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.detail-value.active {
  color: var(--color-success, #22c55e);
}

.detail-value.session-id {
  font-family: monospace;
  font-size: 12px;
}

.detail-value.latency {
  color: var(--color-primary);
}
</style>
