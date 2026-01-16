<script setup lang="ts">
/**
 * 预设模板选择器
 * 用于快速创建基于模板的新配置
 */
import type { PresetTemplate } from '../types'
import { PRESET_TEMPLATES } from '../types'

const emit = defineEmits<{
  select: [template: PresetTemplate]
  cancel: []
}>()
</script>

<template>
  <div class="template-selector">
    <div class="selector-header">
      <h3>选择模板</h3>
      <button class="close-btn" @click="emit('cancel')">
        ✕
      </button>
    </div>
    
    <div class="selector-content">
      <p class="selector-hint">
        选择一个模板快速开始，或从空白配置开始
      </p>
      
      <div class="template-grid">
        <button
          v-for="template in PRESET_TEMPLATES"
          :key="template.id"
          class="template-card"
          @click="emit('select', template)"
        >
          <span class="template-icon">{{ template.icon }}</span>
          <span class="template-name">{{ template.name }}</span>
          <span class="template-desc">{{ template.description }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-selector {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.selector-header {
  @apply flex items-center justify-between px-4 py-3 border-b;
  border-color: var(--color-border);
}

.selector-header h3 {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.close-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full text-lg;
  color: var(--color-text-secondary);
}

.close-btn:hover {
  background: var(--color-surface);
}

.selector-content {
  @apply flex-1 overflow-y-auto p-4;
}

.selector-hint {
  @apply text-sm mb-4;
  color: var(--color-text-secondary);
}

.template-grid {
  @apply grid gap-3;
  grid-template-columns: repeat(2, 1fr);
}

.template-card {
  @apply flex flex-col items-center p-4 rounded-xl text-center transition-all;
  background: var(--color-surface);
  border: 2px solid transparent;
}

.template-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.template-icon {
  @apply text-3xl mb-2;
}

.template-name {
  @apply font-semibold text-sm;
  color: var(--color-text);
}

.template-desc {
  @apply text-xs mt-1;
  color: var(--color-text-secondary);
}
</style>
