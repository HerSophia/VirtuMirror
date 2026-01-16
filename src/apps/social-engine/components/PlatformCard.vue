<script setup lang="ts">
/**
 * 平台卡片组件
 */
import type { PlatformStatus } from '../types';

defineProps<{
  platform: PlatformStatus;
}>();

const emit = defineEmits<{
  (e: 'click', id: string): void;
}>();

// 平台图标映射
const platformIcons: Record<string, string> = {
  weibo: '📱',
  bilibili: '📺',
  zhihu: '📚',
  redbook: '📕',
};

// 平台颜色映射
const platformColors: Record<string, string> = {
  weibo: 'bg-red-500/10 border-red-500/20',
  bilibili: 'bg-pink-500/10 border-pink-500/20',
  zhihu: 'bg-blue-500/10 border-blue-500/20',
  redbook: 'bg-rose-500/10 border-rose-500/20',
};
</script>

<template>
  <div 
    class="platform-card" 
    :class="[platformColors[platform.id] || 'bg-gray-500/10 border-gray-500/20', { 'opacity-50': !platform.enabled }]"
    @click="emit('click', platform.id)"
  >
    <div class="platform-icon">
      {{ platformIcons[platform.id] || '🌐' }}
    </div>
    <div class="platform-info">
      <div class="platform-name">{{ platform.name }}</div>
      <div class="platform-stats">
        <span class="stat-item">
          <span class="stat-icon">📝</span>
          {{ platform.postCount }}
        </span>
        <span class="stat-item">
          <span class="stat-icon">🔥</span>
          {{ platform.topicCount }}
        </span>
        <span class="stat-item">
          <span class="stat-icon">👤</span>
          {{ platform.accountCount }}
        </span>
      </div>
    </div>
    <div class="platform-status">
      <span 
        class="status-dot" 
        :class="platform.enabled ? 'bg-green-500' : 'bg-gray-400'"
      />
    </div>
  </div>
</template>

<style scoped>
.platform-card {
  @apply flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all;
}

.platform-card:hover {
  @apply scale-[1.02];
}

.platform-card:active {
  @apply scale-[0.98];
}

.platform-icon {
  @apply text-2xl;
}

.platform-info {
  @apply flex-1 min-w-0;
}

.platform-name {
  @apply font-medium;
  color: var(--color-text);
}

.platform-stats {
  @apply flex gap-3 mt-1 text-xs;
  color: var(--color-text-secondary);
}

.stat-item {
  @apply flex items-center gap-1;
}

.stat-icon {
  @apply text-xs;
}

.platform-status {
  @apply flex items-center;
}

.status-dot {
  @apply w-2 h-2 rounded-full;
}
</style>
