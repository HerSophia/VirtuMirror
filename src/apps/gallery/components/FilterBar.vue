<script setup lang="ts">
/**
 * 筛选栏组件
 */
import { computed } from 'vue'
import type { ImageSource, ImageSort, ImageSortBy, SortOrder } from '../types'

interface Props {
  activeSource?: ImageSource | 'all' | 'favorite'
  currentSort: ImageSort
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:activeSource': [value: ImageSource | 'all' | 'favorite']
  'update:currentSort': [value: ImageSort]
}>()

const sources: Array<{ value: ImageSource | 'all' | 'favorite'; label: string; icon: string }> = [
  { value: 'all', label: '全部', icon: 'fa-th' },
  { value: 'local', label: '本地', icon: 'fa-folder' },
  { value: 'generated', label: 'AI生成', icon: 'fa-magic' },
  { value: 'remote', label: '图床', icon: 'fa-cloud' },
  { value: 'favorite', label: '收藏', icon: 'fa-heart' },
]

const sortOptions: Array<{ value: ImageSortBy; label: string }> = [
  { value: 'createdAt', label: '时间' },
  { value: 'name', label: '名称' },
  { value: 'size', label: '大小' },
  { value: 'random', label: '随机' },
]

function selectSource(source: ImageSource | 'all' | 'favorite') {
  emit('update:activeSource', source)
}

function toggleSortOrder() {
  emit('update:currentSort', {
    ...props.currentSort,
    order: props.currentSort.order === 'asc' ? 'desc' : 'asc',
  })
}

function setSortBy(by: ImageSortBy) {
  emit('update:currentSort', {
    ...props.currentSort,
    by,
  })
}
</script>

<template>
  <div class="filter-bar">
    <!-- 来源筛选 -->
    <div class="source-tabs">
      <button
        v-for="source in sources"
        :key="source.value"
        class="source-tab"
        :class="{ active: activeSource === source.value }"
        @click="selectSource(source.value)"
      >
        <i :class="['fas', source.icon]"></i>
        <span>{{ source.label }}</span>
      </button>
    </div>
    
    <!-- 排序 -->
    <div class="sort-section">
      <select
        :value="currentSort.by"
        class="sort-select"
        @change="setSortBy(($event.target as HTMLSelectElement).value as ImageSortBy)"
      >
        <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <button class="sort-order-btn" @click="toggleSortOrder">
        <i :class="['fas', currentSort.order === 'asc' ? 'fa-sort-amount-up' : 'fa-sort-amount-down']"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  @apply flex items-center justify-between px-2 py-2;
  @apply border-b;
  background: var(--color-surface);
  border-color: var(--color-border);
}

.source-tabs {
  @apply flex gap-1 overflow-x-auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.source-tabs::-webkit-scrollbar {
  display: none;
}

.source-tab {
  @apply flex items-center gap-1 px-3 py-1.5 rounded-full;
  @apply text-xs whitespace-nowrap;
  @apply transition-colors;
  color: var(--color-text-secondary);
  background: var(--color-surface-variant);
}

.source-tab:hover {
  background: var(--color-border);
}

.source-tab.active {
  background: var(--color-primary);
  color: white;
}

.sort-section {
  @apply flex items-center gap-1;
}

.sort-select {
  @apply px-2 py-1 rounded text-xs;
  @apply border-none outline-none;
  background: var(--color-surface-variant);
  color: var(--color-text);
}

.sort-order-btn {
  @apply w-8 h-8 rounded flex items-center justify-center;
  @apply transition-colors;
  color: var(--color-text-secondary);
}

.sort-order-btn:hover {
  background: var(--color-surface-variant);
}
</style>
