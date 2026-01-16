<script setup lang="ts">
/**
 * 平台卡片组件
 * 显示已连接平台的信息
 */
import type { PlatformInfo } from '@/adapters/bridgeAdapter'
import StatusBadge from './StatusBadge.vue'

defineProps<{
  /** 平台信息 */
  platform: PlatformInfo
  /** 是否为当前选中的平台 */
  active?: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'sync'): void
}>()
</script>

<template>
  <div
    class="platform-card"
    :class="{ active }"
    @click="emit('select')"
  >
    <div class="platform-header">
      <div class="platform-icon">
        <i class="fas fa-gamepad" />
      </div>
      <div class="platform-info">
        <div class="platform-name">{{ platform.platform }}</div>
        <div class="platform-chat">Session: {{ platform.chatId.substring(0, 8) }}...</div>
      </div>
      <StatusBadge :connected="true" connected-text="在线" />
    </div>

    <div v-if="platform.characterName" class="platform-details">
      <div class="detail-item">
        <span class="detail-label">角色</span>
        <span class="detail-value">{{ platform.characterName }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">玩家</span>
        <span class="detail-value">{{ platform.playerName }}</span>
      </div>
    </div>

    <div class="platform-actions">
      <button class="action-btn" @click.stop="emit('sync')">
        <i class="fas fa-sync-alt" />
        <span>同步数据</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.platform-card {
  @apply rounded-xl p-4 cursor-pointer transition-all;
  background-color: var(--color-surface);
  border: 2px solid transparent;
}

.platform-card:hover {
  background-color: var(--color-surface-variant);
}

.platform-card.active {
  border-color: var(--color-primary);
}

.platform-header {
  @apply flex items-center gap-3;
}

.platform-icon {
  @apply w-12 h-12 rounded-xl flex items-center justify-center text-xl;
  background-color: var(--color-primary);
  color: white;
}

.platform-info {
  @apply flex-1;
}

.platform-name {
  @apply font-semibold capitalize;
  color: var(--color-text);
}

.platform-chat {
  @apply text-sm truncate max-w-[150px];
  color: var(--color-text-secondary);
}

.platform-details {
  @apply mt-3 pt-3 flex gap-4;
  border-top: 1px solid var(--color-border);
}

.detail-item {
  @apply flex flex-col;
}

.detail-label {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.detail-value {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.platform-actions {
  @apply mt-3 pt-3 flex gap-2;
  border-top: 1px solid var(--color-border);
}

.action-btn {
  @apply flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors;
  background-color: var(--color-primary);
  color: white;
}

.action-btn:hover {
  opacity: 0.9;
}

.action-btn:active {
  opacity: 0.8;
}
</style>
