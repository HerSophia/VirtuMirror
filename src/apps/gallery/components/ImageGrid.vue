<script setup lang="ts">
/**
 * 图片网格组件
 */
import { computed } from 'vue'
import type { AnyImage } from '../types'
import ImageCard from './ImageCard.vue'

interface Props {
  images: AnyImage[]
  columns?: number
  selectionMode?: boolean
  selectedIds?: string[]
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  columns: 3,
  selectionMode: false,
  selectedIds: () => [],
  emptyText: '暂无图片',
})

const emit = defineEmits<{
  imageClick: [image: AnyImage]
  imageSelect: [image: AnyImage]
  imageLongPress: [image: AnyImage]
}>()

/** 网格样式 */
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
}))

/** 判断是否选中 */
function isSelected(id: string): boolean {
  return props.selectedIds.includes(id)
}
</script>

<template>
  <div class="image-grid-container">
    <!-- 空状态 -->
    <div v-if="images.length === 0" class="empty-state">
      <i class="fas fa-images empty-icon"></i>
      <p class="empty-text">{{ emptyText }}</p>
    </div>
    
    <!-- 图片网格 -->
    <div v-else class="image-grid" :style="gridStyle">
      <ImageCard
        v-for="image in images"
        :key="image.id"
        :image="image"
        :selected="isSelected(image.id)"
        :selection-mode="selectionMode"
        @click="emit('imageClick', image)"
        @select="emit('imageSelect', image)"
        @long-press="emit('imageLongPress', image)"
      />
    </div>
  </div>
</template>

<style scoped>
.image-grid-container {
  @apply flex-1 overflow-auto p-2;
}

.empty-state {
  @apply flex flex-col items-center justify-center;
  @apply h-full min-h-[200px];
  color: var(--color-text-secondary);
}

.empty-icon {
  @apply text-5xl mb-4 opacity-50;
}

.empty-text {
  @apply text-sm;
}

.image-grid {
  @apply grid gap-2;
}
</style>
