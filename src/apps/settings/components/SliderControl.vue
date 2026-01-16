<script setup lang="ts">
/**
 * 滑块控制组件
 * 用于数值范围选择
 */
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** 当前值 */
  modelValue: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步进值 */
  step?: number
  /** 单位后缀 */
  unit?: string
  /** 显示为百分比 */
  percent?: boolean
  /** 小数位数 */
  decimals?: number
  /** 是否禁用 */
  disabled?: boolean
}>(), {
  min: 0,
  max: 100,
  step: 1,
  unit: '',
  percent: false,
  decimals: 0,
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

// 拖动时的临时值
const tempValue = ref(props.modelValue)
const isDragging = ref(false)

// 同步外部值变化
watch(() => props.modelValue, (newVal) => {
  if (!isDragging.value) {
    tempValue.value = newVal
  }
})

// 格式化显示值
function formatValue(val: number): string {
  const formatted = val.toFixed(props.decimals)
  if (props.percent) {
    return `${formatted}%`
  }
  return `${formatted}${props.unit}`
}

// 拖动中 - 只更新临时值
function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  tempValue.value = parseFloat(target.value)
  isDragging.value = true
}

// 拖动结束 - 应用到外部
function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', parseFloat(target.value))
  isDragging.value = false
}
</script>

<template>
  <div class="slider-control" :class="{ disabled }">
    <div class="slider-container">
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="tempValue"
        :disabled="disabled"
        class="slider"
        @input="onInput"
        @change="onChange"
      />
      <span class="slider-value" :class="{ dragging: isDragging }">
        {{ formatValue(tempValue) }}
        <span v-if="isDragging" class="dragging-hint">(拖动中)</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.slider-control {
  @apply w-full;
}

.slider-control.disabled {
  @apply opacity-50;
}

.slider-container {
  @apply w-full flex items-center gap-3;
}

.slider {
  @apply flex-1 h-1 rounded-full appearance-none;
  background: var(--color-border);
}

.slider:disabled {
  @apply cursor-not-allowed;
}

.slider::-webkit-slider-thumb {
  @apply appearance-none w-5 h-5 rounded-full cursor-pointer;
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.slider:disabled::-webkit-slider-thumb {
  @apply cursor-not-allowed;
}

.slider::-moz-range-thumb {
  @apply w-5 h-5 rounded-full cursor-pointer border-0;
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.slider:disabled::-moz-range-thumb {
  @apply cursor-not-allowed;
}

.slider-value {
  @apply text-sm font-mono min-w-[80px] text-right;
  color: var(--color-text-secondary);
}

.slider-value.dragging {
  color: var(--color-primary);
}

.dragging-hint {
  @apply text-xs ml-1;
}
</style>