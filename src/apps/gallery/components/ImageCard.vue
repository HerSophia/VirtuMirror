<script setup lang="ts">
/**
 * 图片卡片组件
 */
import { computed } from 'vue'
import type { AnyImage } from '../types'

interface Props {
  image: AnyImage
  selected?: boolean
  selectionMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  selectionMode: false,
})

const emit = defineEmits<{
  click: [image: AnyImage]
  select: [image: AnyImage]
  longPress: [image: AnyImage]
}>()

/** 显示的图片URL（优先缩略图） */
const displayUrl = computed(() => props.image.thumbnail || props.image.url)

/** 来源图标 */
const sourceIcon = computed(() => {
  switch (props.image.source) {
    case 'local': return 'fa-folder'
    case 'generated': return 'fa-magic'
    case 'remote': return 'fa-cloud'
    default: return 'fa-image'
  }
})

/** 来源标签 */
const sourceLabel = computed(() => {
  switch (props.image.source) {
    case 'local': return '本地'
    case 'generated': return 'AI生成'
    case 'remote': return '图床'
    default: return '图片'
  }
})

function handleClick() {
  if (props.selectionMode) {
    emit('select', props.image)
  } else {
    emit('click', props.image)
  }
}

// 长按检测
let pressTimer: ReturnType<typeof setTimeout> | null = null

function handleTouchStart() {
  pressTimer = setTimeout(() => {
    emit('longPress', props.image)
  }, 500)
}

function handleTouchEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}
</script>

<template>
  <div
    class="image-card"
    :class="{ selected }"
    @click="handleClick"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
  >
    <!-- 图片 -->
    <div class="image-container">
      <img
        :src="displayUrl"
        :alt="image.description || '图片'"
        class="image"
        loading="lazy"
      />
      
      <!-- 选择框 -->
      <div v-if="selectionMode" class="select-overlay">
        <div class="select-checkbox" :class="{ checked: selected }">
          <i v-if="selected" class="fas fa-check"></i>
        </div>
      </div>
      
      <!-- 收藏标记 -->
      <div v-if="image.favorite" class="favorite-badge">
        <i class="fas fa-heart"></i>
      </div>
      
      <!-- 来源标记 -->
      <div class="source-badge" :title="sourceLabel">
        <i :class="['fas', sourceIcon]"></i>
      </div>
    </div>
    
    <!-- 信息 -->
    <div v-if="image.description" class="info">
      <p class="description">{{ image.description }}</p>
    </div>
  </div>
</template>

<style scoped>
.image-card {
  @apply relative rounded-lg overflow-hidden;
  @apply transition-all duration-200;
  background: var(--color-surface);
  border: 2px solid transparent;
}

.image-card:hover {
  @apply shadow-lg;
  transform: translateY(-2px);
}

.image-card.selected {
  border-color: var(--color-primary);
}

.image-container {
  @apply relative aspect-square;
  background: var(--color-surface-variant);
}

.image {
  @apply w-full h-full object-cover;
}

.select-overlay {
  @apply absolute inset-0;
  background: rgba(0, 0, 0, 0.3);
}

.select-checkbox {
  @apply absolute top-2 right-2;
  @apply w-6 h-6 rounded-full border-2 border-white;
  @apply flex items-center justify-center;
  background: rgba(255, 255, 255, 0.3);
}

.select-checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.favorite-badge {
  @apply absolute top-2 left-2;
  @apply w-6 h-6 rounded-full;
  @apply flex items-center justify-center;
  @apply text-xs;
  background: rgba(255, 59, 48, 0.9);
  color: white;
}

.source-badge {
  @apply absolute bottom-2 right-2;
  @apply px-2 py-1 rounded;
  @apply text-xs;
  background: rgba(0, 0, 0, 0.6);
  color: white;
}

.info {
  @apply p-2;
}

.description {
  @apply text-xs truncate;
  color: var(--color-text-secondary);
}
</style>
