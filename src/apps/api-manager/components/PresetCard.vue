<script setup lang="ts">
/**
 * 预设卡片组件
 * 显示单个API预设的信息和操作按钮
 */
import type { ApiPreset } from '@/types/globalConfig'

interface Props {
  preset: ApiPreset
  isActive: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  activate: []
  edit: []
  duplicate: []
  delete: []
}>()

/**
 * 获取来源图标
 */
function getSourceIcon(source?: string): string {
  switch (source) {
    case 'openai': return '🤖'
    case 'anthropic': return '🎭'
    case 'custom': return '⚙️'
    default: return '🔗'
  }
}

/**
 * 格式化日期
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '未知'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div 
    class="preset-card"
    :class="{ 'is-active': isActive }"
  >
    <!-- 卡片头部 -->
    <div class="card-header">
      <div class="card-icon">
        {{ getSourceIcon(preset.config.source) }}
      </div>
      <div class="card-info">
        <h4 class="card-title">{{ preset.name }}</h4>
        <p class="card-model">{{ preset.config.model }}</p>
      </div>
      <div v-if="isActive" class="active-badge">
        使用中
      </div>
    </div>
    
    <!-- 卡片描述 -->
    <p v-if="preset.description" class="card-description">
      {{ preset.description }}
    </p>
    
    <!-- API 信息 -->
    <div class="card-meta">
      <span class="meta-item">
        <span class="meta-label">API:</span>
        <span class="meta-value">{{ preset.config.apiUrl }}</span>
      </span>
      <span class="meta-item">
        <span class="meta-label">创建:</span>
        <span class="meta-value">{{ formatDate(preset.createdAt) }}</span>
      </span>
    </div>
    
    <!-- 操作按钮 -->
    <div class="card-actions">
      <button 
        v-if="!isActive"
        class="action-btn primary"
        @click="emit('activate')"
      >
        启用
      </button>
      <button 
        class="action-btn"
        @click="emit('edit')"
      >
        编辑
      </button>
      <button 
        class="action-btn"
        @click="emit('duplicate')"
      >
        复制
      </button>
      <button 
        class="action-btn danger"
        @click="emit('delete')"
      >
        删除
      </button>
    </div>
  </div>
</template>

<style scoped>
.preset-card {
  @apply rounded-xl p-4;
  background: var(--color-surface);
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.preset-card.is-active {
  border-color: var(--color-primary);
  background: var(--color-surface-variant);
}

.card-header {
  @apply flex items-center gap-3 mb-2;
}

.card-icon {
  @apply text-2xl w-10 h-10 flex items-center justify-center rounded-lg;
  background: var(--color-background);
}

.card-info {
  @apply flex-1 min-w-0;
}

.card-title {
  @apply font-semibold truncate;
  color: var(--color-text);
}

.card-model {
  @apply text-sm truncate;
  color: var(--color-text-secondary);
}

.active-badge {
  @apply px-2 py-1 rounded-full text-xs font-medium;
  background: var(--color-primary);
  color: white;
}

.card-description {
  @apply text-sm mb-3 line-clamp-2;
  color: var(--color-text-secondary);
}

.card-meta {
  @apply flex flex-col gap-1 mb-3 text-xs;
  color: var(--color-text-secondary);
}

.meta-item {
  @apply flex gap-1 truncate;
}

.meta-label {
  @apply flex-shrink-0;
  color: var(--color-text-tertiary);
}

.meta-value {
  @apply truncate;
}

.card-actions {
  @apply flex gap-2 flex-wrap;
}

.action-btn {
  @apply px-3 py-1.5 rounded-lg text-sm font-medium;
  background: var(--color-background);
  color: var(--color-text);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--color-surface-variant);
}

.action-btn.primary {
  background: var(--color-primary);
  color: white;
}

.action-btn.primary:hover {
  opacity: 0.9;
}

.action-btn.danger {
  color: var(--color-error);
}

.action-btn.danger:hover {
  background: var(--color-error);
  color: white;
}
</style>
