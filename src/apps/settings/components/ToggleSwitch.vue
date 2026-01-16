<script setup lang="ts">
/**
 * 开关组件
 * 用于开/关状态切换
 */
const props = defineProps<{
  /** 是否激活 */
  modelValue: boolean
  /** 是否禁用 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<template>
  <div
    class="toggle-switch"
    :class="{ active: modelValue, disabled }"
    @click.stop="toggle"
  >
    <div class="toggle-handle" />
  </div>
</template>

<style scoped>
.toggle-switch {
  @apply w-12 h-7 rounded-full relative;
  @apply transition-colors duration-200 cursor-pointer;
  background-color: var(--color-border);
}

.toggle-switch.active {
  background-color: var(--color-success);
}

.toggle-switch.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.toggle-handle {
  @apply absolute top-1 left-1 w-5 h-5 rounded-full;
  @apply shadow transition-transform duration-200;
  background-color: var(--color-surface);
}

.toggle-switch.active .toggle-handle {
  @apply translate-x-5;
}
</style>