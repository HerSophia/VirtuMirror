<script setup lang="ts">
/**
 * 统计卡片组件
 */
defineProps<{
  label: string;
  value: number | string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
}>();

const colorClasses = {
  primary: 'bg-blue-500/10 text-blue-600',
  success: 'bg-green-500/10 text-green-600',
  warning: 'bg-yellow-500/10 text-yellow-600',
  error: 'bg-red-500/10 text-red-600',
  info: 'bg-gray-500/10 text-gray-600',
};
</script>

<template>
  <div class="stat-card">
    <div class="stat-icon" :class="colorClasses[color || 'primary']">
      <slot name="icon">
        <span v-if="icon">{{ icon }}</span>
      </slot>
    </div>
    <div class="stat-content">
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
    <div v-if="trend" class="stat-trend" :class="trend">
      <svg v-if="trend === 'up'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
      </svg>
      <svg v-else-if="trend === 'down'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  @apply flex items-center gap-3 p-4 rounded-xl;
  background: var(--color-surface);
}

.stat-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center text-lg;
}

.stat-content {
  @apply flex-1 min-w-0;
}

.stat-value {
  @apply text-xl font-bold;
  color: var(--color-text);
}

.stat-label {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.stat-trend {
  @apply flex items-center;
}

.stat-trend.up {
  color: #10b981;
}

.stat-trend.down {
  color: #ef4444;
}

.stat-trend.neutral {
  color: var(--color-text-secondary);
}
</style>
