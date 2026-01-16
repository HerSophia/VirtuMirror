<script setup lang="ts">
/**
 * 骨架屏组件
 * 用于显示加载状态的占位符
 */

withDefaults(defineProps<{
  /** 变体类型 */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  /** 宽度 */
  width?: string | number
  /** 高度 */
  height?: string | number
  /** 是否启用动画 */
  animation?: boolean
  /** 动画类型 */
  animationType?: 'pulse' | 'wave'
}>(), {
  variant: 'text',
  animation: true,
  animationType: 'pulse',
})

function formatSize(value?: string | number): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return `${value}px`
  return value
}
</script>

<template>
  <span
    class="skeleton"
    :class="[
      `skeleton--${variant}`,
      {
        'skeleton--animated': animation,
        'skeleton--pulse': animation && animationType === 'pulse',
        'skeleton--wave': animation && animationType === 'wave',
      }
    ]"
    :style="{
      width: formatSize(width),
      height: formatSize(height),
    }"
  />
</template>

<style scoped>
.skeleton {
  @apply block;
  background: var(--color-surface-variant, #e5e5ea);
}

.skeleton--text {
  @apply h-4 w-full rounded;
  transform-origin: 0 55%;
  transform: scale(1, 0.6);
}

.skeleton--circular {
  @apply rounded-full;
  aspect-ratio: 1;
}

.skeleton--rectangular {
  @apply rounded-none;
}

.skeleton--rounded {
  @apply rounded-lg;
}

/* Pulse 动画 */
.skeleton--pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* Wave 动画 */
.skeleton--wave {
  @apply relative overflow-hidden;
}

.skeleton--wave::after {
  content: '';
  @apply absolute inset-0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: skeleton-wave 1.6s linear infinite;
}

@keyframes skeleton-wave {
  100% {
    transform: translateX(100%);
  }
}
</style>