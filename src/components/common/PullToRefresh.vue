<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  /** 是否正在刷新 */
  loading?: boolean
  /** 触发刷新的下拉距离 */
  threshold?: number
  /** 刷新指示器的颜色 */
  color?: string
  /** 是否禁用 */
  disabled?: boolean
}>(), {
  loading: false,
  threshold: 60,
  color: 'var(--color-primary, #007AFF)',
  disabled: false,
})

const emit = defineEmits<{
  refresh: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const isPulling = ref(false)
const pullDistance = ref(0)
const startY = ref(0)

// 计算进度
const progress = computed(() => Math.min(pullDistance.value / props.threshold, 1))

// 是否达到刷新阈值
const canRefresh = computed(() => pullDistance.value >= props.threshold)

// 旋转角度
const rotateAngle = computed(() => progress.value * 180)

// 指示器样式
const indicatorStyle = computed(() => ({
  transform: `translateY(${Math.min(pullDistance.value, props.threshold + 20)}px) rotate(${rotateAngle.value}deg)`,
  opacity: progress.value,
  color: props.color,
}))

function handleTouchStart(e: TouchEvent) {
  if (props.disabled || props.loading) return
  
  const scrollTop = containerRef.value?.scrollTop || 0
  if (scrollTop > 0) return // 只在顶部触发
  
  startY.value = e.touches[0].clientY
  isPulling.value = true
}

function handleTouchMove(e: TouchEvent) {
  if (!isPulling.value || props.loading) return
  
  const currentY = e.touches[0].clientY
  const delta = currentY - startY.value
  
  if (delta > 0) {
    e.preventDefault()
    // 使用阻尼效果
    pullDistance.value = delta * 0.5
  }
}

function handleTouchEnd() {
  if (!isPulling.value) return
  
  isPulling.value = false
  
  if (canRefresh.value && !props.loading) {
    emit('refresh')
    // 保持刷新状态下的高度
    pullDistance.value = props.threshold
  } else {
    pullDistance.value = 0
  }
}

// 监听 loading 状态变化，结束后重置
function resetPullDistance() {
  if (!props.loading) {
    pullDistance.value = 0
  }
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.addEventListener('touchstart', handleTouchStart, { passive: true })
  el.addEventListener('touchmove', handleTouchMove, { passive: false })
  el.addEventListener('touchend', handleTouchEnd)
})

onUnmounted(() => {
  const el = containerRef.value
  if (!el) return
  
  el.removeEventListener('touchstart', handleTouchStart)
  el.removeEventListener('touchmove', handleTouchMove)
  el.removeEventListener('touchend', handleTouchEnd)
})

// 暴露重置方法
defineExpose({
  reset: () => {
    pullDistance.value = 0
    isPulling.value = false
  }
})
</script>

<template>
  <div ref="containerRef" class="pull-to-refresh-container">
    <!-- 刷新指示器 -->
    <div class="refresh-indicator" :style="indicatorStyle">
      <div v-if="loading" class="refresh-spinner">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <div v-else class="refresh-arrow">
        <i class="fas fa-arrow-down"></i>
      </div>
      <span class="refresh-text">
        {{ loading ? '刷新中...' : canRefresh ? '释放刷新' : '下拉刷新' }}
      </span>
    </div>
    
    <!-- 内容区域 -->
    <div 
      class="pull-to-refresh-content"
      :style="{ transform: `translateY(${isPulling || loading ? Math.min(pullDistance, threshold + 20) : 0}px)` }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.pull-to-refresh-container {
  @apply relative h-full overflow-y-auto overflow-x-hidden;
  overscroll-behavior: contain;
}

.refresh-indicator {
  @apply absolute top-0 left-0 right-0;
  @apply flex items-center justify-center gap-2;
  @apply h-14 -mt-14;
  @apply text-sm;
  transition: opacity 0.2s ease;
}

.refresh-spinner,
.refresh-arrow {
  @apply text-lg;
}

.refresh-text {
  @apply text-xs opacity-80;
}

.pull-to-refresh-content {
  @apply min-h-full;
  transition: transform 0.2s ease;
}

.pull-to-refresh-container.is-pulling .pull-to-refresh-content {
  transition: none;
}
</style>