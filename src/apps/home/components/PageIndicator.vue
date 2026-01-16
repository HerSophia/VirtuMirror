<script setup lang="ts">
/**
 * 页面指示器组件
 * 显示多页桌面的当前页面位置
 */

const props = withDefaults(defineProps<{
  /** 总页数 */
  total: number
  /** 当前页索引 (0-based) */
  current: number
  /** 滑动进度 (-1 到 1，用于平滑过渡) */
  progress?: number
}>(), {
  progress: 0,
})

// 计算当前高亮点的偏移
function getDotStyle(index: number) {
  const isActive = index === props.current
  const isNext = index === props.current + 1 && props.progress > 0
  const isPrev = index === props.current - 1 && props.progress < 0
  
  // 基础透明度
  let opacity = 0.4
  if (isActive) {
    opacity = 1 - Math.abs(props.progress) * 0.6
  } else if (isNext || isPrev) {
    opacity = 0.4 + Math.abs(props.progress) * 0.6
  }
  
  // 基础缩放
  let scale = 1
  if (isActive) {
    scale = 1.2 - Math.abs(props.progress) * 0.2
  } else if (isNext || isPrev) {
    scale = 1 + Math.abs(props.progress) * 0.2
  }
  
  return {
    opacity,
    transform: `scale(${scale})`,
  }
}
</script>

<template>
  <div class="page-indicator">
    <div
      v-for="index in total"
      :key="index"
      class="dot"
      :class="{ active: index - 1 === current }"
      :style="getDotStyle(index - 1)"
    />
  </div>
</template>

<style scoped>
.page-indicator {
  @apply flex items-center justify-center gap-2 py-2;
}

.dot {
  @apply w-2 h-2 rounded-full bg-white;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dot.active {
  @apply opacity-100;
}
</style>