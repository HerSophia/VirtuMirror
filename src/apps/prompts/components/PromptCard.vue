<script setup lang="ts">
/**
 * 提示词卡片组件
 * @description 显示单个提示词的信息，支持编辑、切换、删除等操作
 */
import { computed } from 'vue';
import { PromptService } from '@/services/promptService';
import type { PromptTemplate } from '@/types/prompts';
import DynamicAppIcon from '@/components/common/DynamicAppIcon.vue';

const props = defineProps<{
  prompt: PromptTemplate;
}>();

const emit = defineEmits<{
  edit: [prompt: PromptTemplate];
  toggle: [prompt: PromptTemplate];
  reset: [id: string];
  delete: [id: string];
  duplicate: [id: string];
  view: [prompt: PromptTemplate];
}>();

// 获取编辑权限
const permission = computed(() => PromptService.isPromptEditable(props.prompt));

// 获取来源标签
const sourceLabel = computed(() => PromptService.getSourceLabel(props.prompt));

// 来源标签颜色
const sourceBadgeClass = computed(() => {
  switch (props.prompt.source.type) {
    case 'builtin':
      return 'badge-blue';
    case 'app':
      return 'badge-purple';
    case 'user':
      return 'badge-green';
    default:
      return 'badge-gray';
  }
});

// 分类图标
const categoryIcon = computed(() => {
  const icons: Record<string, string> = {
    chat: 'fas fa-comments',
    email: 'fas fa-envelope',
    browser: 'fas fa-globe',
    live: 'fas fa-video',
    system: 'fas fa-cog',
  };
  return icons[props.prompt.category] || 'fas fa-file-alt';
});

// 获取来源 App ID（当 source.type === 'app' 时）
const sourceAppId = computed(() => {
  if (props.prompt.source.type === 'app') {
    return (props.prompt.source as { type: 'app'; appId: string }).appId;
  }
  return null;
});

// 判断是否显示 App 图标
const showAppIcon = computed(() => !!sourceAppId.value);

// 处理点击
const handleClick = () => {
  emit('view', props.prompt);
};

// 处理编辑
const handleEdit = (e: Event) => {
  e.stopPropagation();
  emit('edit', props.prompt);
};

// 处理切换
const handleToggle = (e: Event) => {
  e.stopPropagation();
  emit('toggle', props.prompt);
};

// 处理重置
const handleReset = (e: Event) => {
  e.stopPropagation();
  emit('reset', props.prompt.id);
};

// 处理删除
const handleDelete = (e: Event) => {
  e.stopPropagation();
  emit('delete', props.prompt.id);
};

// 处理复制
const handleDuplicate = (e: Event) => {
  e.stopPropagation();
  emit('duplicate', props.prompt.id);
};
</script>

<template>
  <div 
    class="prompt-card"
    :class="{ disabled: !prompt.enabled }"
    @click="handleClick"
  >
    <!-- 头部信息 -->
    <div class="card-header">
      <!-- 优先显示自定义图标 -->
      <DynamicAppIcon
        v-if="prompt.icon"
        :icon="prompt.icon"
        size="md"
        :rounded="false"
        class="card-app-icon"
      />
      <!-- App 来源时显示 App 图标 -->
      <DynamicAppIcon
        v-else-if="showAppIcon"
        :app-id="sourceAppId!"
        size="md"
        :rounded="false"
        class="card-app-icon"
      />
      <div v-else class="card-icon">
        <i :class="categoryIcon"></i>
      </div>
      <div class="card-info">
        <div class="card-title-row">
          <h3 class="card-title">{{ prompt.name }}</h3>
          <span :class="['badge', sourceBadgeClass]">{{ sourceLabel }}</span>
        </div>
        <p v-if="prompt.description" class="card-desc">{{ prompt.description }}</p>
      </div>
    </div>
    
    <!-- 标签区 -->
    <div class="card-tags">
      <span class="tag">
        <i class="fas fa-tag"></i>
        {{ prompt.scene }}
      </span>
      <span :class="['status-tag', prompt.enabled ? 'enabled' : 'disabled']">
        {{ prompt.enabled ? '已启用' : '已禁用' }}
      </span>
      <span v-if="prompt.priority > 0" class="tag">
        优先级: {{ prompt.priority }}
      </span>
    </div>
    
    <!-- 模板预览 -->
    <div class="card-preview">
      <details>
        <summary class="preview-toggle">
          <i class="fas fa-code"></i>
          查看模板
        </summary>
        <pre class="preview-content">{{ prompt.template.substring(0, 300) }}{{ prompt.template.length > 300 ? '...' : '' }}</pre>
      </details>
    </div>
    
    <!-- 操作按钮 -->
    <div class="card-actions">
      <button 
        class="action-btn"
        @click="handleToggle"
        :title="prompt.enabled ? '禁用' : '启用'"
      >
        <i :class="prompt.enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'"></i>
      </button>
      
      <button 
        v-if="permission.canEdit"
        class="action-btn"
        @click="handleEdit"
        title="编辑"
      >
        <i class="fas fa-edit"></i>
      </button>
      
      <button 
        class="action-btn"
        @click="handleDuplicate"
        title="复制"
      >
        <i class="fas fa-copy"></i>
      </button>
      
      <button 
        v-if="prompt.source.type === 'builtin'"
        class="action-btn"
        @click="handleReset"
        title="重置为默认"
      >
        <i class="fas fa-undo"></i>
      </button>
      
      <button 
        v-if="permission.canDelete"
        class="action-btn danger"
        @click="handleDelete"
        title="删除"
      >
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
    
    <!-- 更新时间 -->
    <div class="card-footer">
      <span class="update-time">
        更新于 {{ new Date(prompt.updatedAt).toLocaleDateString() }}
      </span>
      <span class="version">v{{ prompt.version }}</span>
    </div>
  </div>
</template>

<style scoped>
.prompt-card {
  @apply rounded-xl p-4 cursor-pointer;
  @apply transition-all duration-200;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.prompt-card:hover {
  @apply shadow-md;
  border-color: var(--color-primary);
}

.prompt-card.disabled {
  opacity: 0.6;
}

/* 头部 */
.card-header {
  @apply flex items-start gap-3 mb-3;
}

.card-icon {
  @apply w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0;
  background: var(--color-surface-variant);
  color: var(--color-primary);
}

.card-info {
  @apply flex-1 min-w-0;
}

.card-title-row {
  @apply flex items-center gap-2 flex-wrap;
}

.card-title {
  @apply text-base font-semibold truncate;
  color: var(--color-text);
}

.card-desc {
  @apply text-sm mt-1 line-clamp-2;
  color: var(--color-text-secondary);
}

/* 标签 */
.badge {
  @apply px-2 py-0.5 rounded-full text-xs font-medium;
}

.badge-blue {
  @apply bg-blue-100 text-blue-700;
}

.badge-purple {
  @apply bg-purple-100 text-purple-700;
}

.badge-green {
  @apply bg-green-100 text-green-700;
}

.badge-gray {
  @apply bg-gray-100 text-gray-700;
}

/* 标签区 */
.card-tags {
  @apply flex flex-wrap gap-2 mb-3;
}

.tag {
  @apply flex items-center gap-1 px-2 py-0.5 rounded text-xs;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.status-tag {
  @apply px-2 py-0.5 rounded text-xs font-medium;
}

.status-tag.enabled {
  @apply bg-green-100 text-green-700;
}

.status-tag.disabled {
  @apply bg-gray-100 text-gray-500;
}

/* 预览 */
.card-preview {
  @apply mb-3;
}

.preview-toggle {
  @apply flex items-center gap-1.5 text-sm cursor-pointer;
  color: var(--color-primary);
}

.preview-toggle::-webkit-details-marker {
  display: none;
}

.preview-content {
  @apply mt-2 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap;
  @apply font-mono;
  background: var(--color-surface-variant);
  color: var(--color-text);
  max-height: 150px;
  overflow-y: auto;
}

/* 操作按钮 */
.card-actions {
  @apply flex items-center gap-1 pt-3 border-t;
  border-color: var(--color-border);
}

.action-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-lg;
  @apply transition-colors;
  color: var(--color-text-secondary);
}

.action-btn:hover {
  background: var(--color-surface-variant);
  color: var(--color-text);
}

.action-btn.danger:hover {
  @apply bg-red-50 text-red-600;
}

/* 底部 */
.card-footer {
  @apply flex items-center justify-between mt-2 pt-2 text-xs;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
}
</style>