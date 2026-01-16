<script setup lang="ts">
/**
 * 分类网格组件
 */
import type { CategoryInfo } from '@/types/appPackage'

defineProps<{
  categories: CategoryInfo[]
}>()

const emit = defineEmits<{
  select: [categoryId: string]
}>()
</script>

<template>
  <div class="category-grid">
    <button
      v-for="category in categories"
      :key="category.id"
      class="category-item"
      @click="emit('select', category.id)"
    >
      <div class="category-icon">
        <i :class="category.icon"></i>
      </div>
      <span class="category-name">{{ category.name }}</span>
      <span class="category-count">{{ category.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.category-grid {
  @apply grid grid-cols-2 gap-3;
}

.category-item {
  @apply flex items-center gap-3 p-4 rounded-2xl;
  background: var(--color-surface);
  transition: all 0.2s ease;
}

.category-item:active {
  transform: scale(0.98);
  background: var(--color-surface-variant);
}

.category-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-xl;
  background: var(--color-surface-variant);
  color: var(--color-primary);
}

.category-name {
  @apply text-sm font-bold flex-1 text-left;
  color: var(--color-text);
}

.category-count {
  @apply text-xs font-medium px-2 py-0.5 rounded-full;
  background: var(--color-background);
  color: var(--color-text-secondary);
}
</style>