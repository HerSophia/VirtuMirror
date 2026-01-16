<script setup lang="ts">
/**
 * 分类卡片组件
 * 用于显示教程分类
 */
import type { TutorialCategory } from '../types'

interface Props {
  category: TutorialCategory
  count?: number
}

defineProps<Props>()

const emit = defineEmits<{
  'click': []
}>()
</script>

<template>
  <div class="category-card" @click="emit('click')">
    <div class="category-icon">{{ category.icon }}</div>
    <div class="category-content">
      <h3 class="category-name">{{ category.name }}</h3>
      <p v-if="category.description" class="category-description">
        {{ category.description }}
      </p>
      <span v-if="count !== undefined" class="category-count">
        {{ count }} 篇教程
      </span>
    </div>
    <div class="category-arrow">›</div>
  </div>
</template>

<style scoped>
.category-card {
  @apply flex items-center gap-4 p-4 cursor-pointer;
  background: var(--color-surface);
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.category-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.category-card:active {
  transform: scale(0.98);
}

.category-icon {
  @apply text-4xl flex-shrink-0 w-14 h-14 flex items-center justify-center;
  background: var(--color-surface-variant);
  border-radius: 12px;
}

.category-content {
  @apply flex-1 min-w-0;
}

.category-name {
  @apply font-bold text-lg;
  color: var(--color-text);
}

.category-description {
  @apply text-sm mt-0.5;
  color: var(--color-text-secondary);
}

.category-count {
  @apply text-xs mt-1 inline-block px-2 py-0.5 rounded-full;
  background: var(--color-primary);
  color: white;
}

.category-arrow {
  @apply text-2xl flex-shrink-0;
  color: var(--color-text-secondary);
}
</style>