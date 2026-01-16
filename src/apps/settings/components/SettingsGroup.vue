<script setup lang="ts">
/**
 * 设置分组容器组件
 * 用于包裹一组相关的设置项
 */
defineProps<{
  /** 分组标题（可选） */
  title?: string
}>()
</script>

<template>
  <div class="settings-section">
    <h3 v-if="title" class="settings-group-header">{{ title }}</h3>
    <div class="settings-group">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings-section {
  @apply mb-4;
}

.settings-group-header {
  @apply text-sm px-4 py-2;
  color: var(--color-text-secondary);
}

.settings-group {
  @apply rounded-lg overflow-hidden;
  background-color: var(--color-surface);
  transition: background-color 0.3s ease;
}
</style>