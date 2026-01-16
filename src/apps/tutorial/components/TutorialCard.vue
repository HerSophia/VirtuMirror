<script setup lang="ts">
/**
 * 教程卡片组件
 * 用于显示教程列表中的单个教程项
 */
import type { Tutorial, TutorialListItem } from '../types'

interface Props {
  tutorial: Tutorial | TutorialListItem
}

defineProps<Props>()

const emit = defineEmits<{
  'click': []
}>()
</script>

<template>
  <div class="tutorial-card" @click="emit('click')">
    <div class="card-icon">{{ tutorial.icon }}</div>
    <div class="card-content">
      <h3 class="card-title">{{ tutorial.title }}</h3>
      <p class="card-description">{{ tutorial.description }}</p>
      <div v-if="tutorial.readTime" class="card-meta">
        <span class="read-time">📖 {{ tutorial.readTime }} 分钟</span>
      </div>
    </div>
    <div class="card-arrow">›</div>
  </div>
</template>

<style scoped>
.tutorial-card {
  @apply flex items-center gap-3 p-4 cursor-pointer;
  background: var(--color-surface);
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.tutorial-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.tutorial-card:active {
  transform: scale(0.98);
}

.card-icon {
  @apply text-3xl flex-shrink-0 w-12 h-12 flex items-center justify-center;
  background: var(--color-surface-variant);
  border-radius: 10px;
}

.card-content {
  @apply flex-1 min-w-0;
}

.card-title {
  @apply font-semibold text-base truncate;
  color: var(--color-text);
}

.card-description {
  @apply text-sm mt-0.5 line-clamp-2;
  color: var(--color-text-secondary);
}

.card-meta {
  @apply mt-1.5 flex items-center gap-2;
}

.read-time {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.card-arrow {
  @apply text-xl flex-shrink-0;
  color: var(--color-text-secondary);
}
</style>