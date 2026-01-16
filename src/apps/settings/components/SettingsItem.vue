<script setup lang="ts">
/**
 * 设置项组件
 * 支持多种类型的设置项：普通、带箭头、带开关、带值显示
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** 设置项标签 */
  label: string
  /** 副标签（可选） */
  subtitle?: string
  /** 图标（可选，FontAwesome 类名） */
  icon?: string
  /** 图标背景色（可选） */
  iconBg?: string
  /** 图标颜色（可选） */
  iconColor?: string
  /** 是否显示右箭头 */
  arrow?: boolean
  /** 右侧显示的值 */
  value?: string
  /** 是否为危险操作（红色文字） */
  danger?: boolean
  /** 是否禁用 */
  disabled?: boolean
}>(), {
  arrow: false,
  danger: false,
  disabled: false
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

const hasIcon = computed(() => !!props.icon)
const hasValue = computed(() => !!props.value)

function handleClick() {
  if (!props.disabled) {
    emit('click')
  }
}
</script>

<template>
  <div
    class="settings-item"
    :class="{ danger, disabled }"
    @click="handleClick"
  >
    <div class="settings-item-left">
      <!-- 图标 -->
      <div
        v-if="hasIcon"
        class="settings-item-icon"
        :style="{
          backgroundColor: iconBg || 'var(--color-surface-variant)',
          color: iconColor || 'var(--color-primary)'
        }"
      >
        <i class="fas" :class="icon" />
      </div>
      
      <!-- 标签 -->
      <div class="settings-item-label">
        <span class="label-text">{{ label }}</span>
        <span v-if="subtitle" class="label-subtitle">{{ subtitle }}</span>
      </div>
    </div>
    
    <div class="settings-item-right">
      <!-- 自定义右侧内容插槽 -->
      <slot name="right">
        <!-- 值显示 -->
        <span v-if="hasValue" class="settings-value-text">{{ value }}</span>
      </slot>
      
      <!-- 右箭头 -->
      <i v-if="arrow" class="fas fa-chevron-right arrow-icon" />
    </div>
  </div>
</template>

<style scoped>
.settings-item {
  @apply flex items-center justify-between px-4 py-3;
  @apply last:border-b-0;
  @apply cursor-pointer transition-colors;
  border-bottom: 1px solid var(--color-border);
}

.settings-item:hover:not(.disabled) {
  background-color: var(--color-surface-variant);
}

.settings-item.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.settings-item-left {
  @apply flex items-center gap-3;
}

.settings-item-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center;
  @apply text-lg;
}

.settings-item-label {
  @apply flex flex-col;
}

.label-text {
  color: var(--color-text);
}

.settings-item.danger .label-text {
  color: var(--color-error);
}

.label-subtitle {
  @apply text-xs mt-0.5;
  color: var(--color-text-secondary);
}

.settings-item-right {
  @apply flex items-center gap-2;
}

.settings-value-text {
  color: var(--color-text-secondary);
}

.arrow-icon {
  color: var(--color-text-secondary);
  @apply text-sm;
}
</style>