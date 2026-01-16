<script setup lang="ts">
/**
 * 显示缩放分区
 * 包含 DPR 信息、缩放模式、缩放比例等设置
 */
import { ref, computed } from 'vue'
import { useDeviceStore, type ScaleMode } from '@/stores/deviceStore'
import { SettingsGroup, SettingsItem, SliderControl } from '../components'

const deviceStore = useDeviceStore()

// 下拉菜单展开状态
const isScaleModeDropdownOpen = ref(false)

// 缩放模式选项
const scaleModeOptions: { value: ScaleMode; label: string; description: string }[] = [
  { value: 'auto', label: '自动', description: '根据屏幕DPI智能调整' },
  { value: 'fit', label: '适应屏幕', description: '填满可用空间' },
  { value: 'real', label: '真实尺寸', description: '模拟实际物理大小' },
  { value: 'custom', label: '自定义', description: '手动设置缩放比例' },
]

// 当前缩放模式显示
const currentScaleModeLabel = computed(() => {
  const option = scaleModeOptions.find(o => o.value === deviceStore.scaleMode)
  return option?.label || '自动'
})

// 当前缩放百分比显示
const currentScalePercent = computed(() => {
  return Math.round(deviceStore.recommendedScale * 100)
})

// 屏幕 DPI 信息
const screenDPR = computed(() => window.devicePixelRatio || 1)

// 自定义缩放值（百分比）
const customScalePercent = computed({
  get: () => deviceStore.customScale * 100,
  set: (val: number) => deviceStore.setCustomScale(val / 100)
})

// 目标物理宽度
const targetWidth = computed({
  get: () => deviceStore.targetPhysicalWidth,
  set: (val: number) => deviceStore.setTargetPhysicalWidth(val)
})

function toggleScaleModeDropdown() {
  isScaleModeDropdownOpen.value = !isScaleModeDropdownOpen.value
}

function selectScaleMode(mode: ScaleMode) {
  deviceStore.setScaleMode(mode)
  isScaleModeDropdownOpen.value = false
}
</script>

<template>
  <SettingsGroup title="显示缩放">
    <!-- 屏幕信息 -->
    <SettingsItem
      label="屏幕像素比 (DPR)"
      :value="`${screenDPR.toFixed(2)}x`"
    />
    
    <!-- 缩放模式选择 -->
    <SettingsItem label="缩放模式" @click="toggleScaleModeDropdown">
      <template #right>
        <span class="scale-mode-value">{{ currentScaleModeLabel }}</span>
        <i class="fas" :class="isScaleModeDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'" />
      </template>
    </SettingsItem>
    
    <!-- 缩放模式下拉菜单 -->
    <Transition name="dropdown">
      <div v-if="isScaleModeDropdownOpen" class="scale-mode-dropdown">
        <div
          v-for="option in scaleModeOptions"
          :key="option.value"
          class="scale-mode-option"
          :class="{ active: deviceStore.scaleMode === option.value }"
          @click="selectScaleMode(option.value)"
        >
          <div class="option-info">
            <span class="option-label">{{ option.label }}</span>
            <span class="option-desc">{{ option.description }}</span>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- 自定义缩放滑块（仅在 custom 模式下显示） -->
    <div v-if="deviceStore.scaleMode === 'custom'" class="slider-item">
      <span class="slider-label">缩放比例</span>
      <SliderControl
        v-model="customScalePercent"
        :min="30"
        :max="200"
        :step="1"
        percent
        :decimals="0"
      />
    </div>
    
    <!-- 目标物理宽度（仅在 real 模式下显示） -->
    <div v-if="deviceStore.scaleMode === 'real'" class="slider-item">
      <span class="slider-label">目标宽度</span>
      <SliderControl
        v-model="targetWidth"
        :min="1.5"
        :max="6.0"
        :step="0.1"
        unit="英寸"
        :decimals="1"
      />
    </div>
    
    <!-- 当前缩放比例 -->
    <SettingsItem
      label="当前缩放"
      :value="`${currentScalePercent}%`"
    />
  </SettingsGroup>
</template>

<style scoped>
.scale-mode-value {
  color: var(--color-text-secondary);
}

/* 缩放模式下拉菜单 */
.scale-mode-dropdown {
  @apply max-h-[200px] overflow-y-auto;
  background-color: var(--color-surface-variant);
  border-top: 1px solid var(--color-border);
}

.scale-mode-option {
  @apply flex items-center justify-between px-4 py-2.5;
  @apply last:border-b-0;
  @apply cursor-pointer transition-colors;
  border-bottom: 1px solid var(--color-border);
}

.scale-mode-option:hover {
  background-color: var(--color-surface);
}

.scale-mode-option.active {
  background-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.scale-mode-option.active .option-label {
  color: var(--color-primary);
  @apply font-medium;
}

.option-info {
  @apply flex flex-col gap-0.5;
}

.option-label {
  @apply text-sm;
  color: var(--color-text);
}

.option-desc {
  @apply text-xs;
  color: var(--color-text-secondary);
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  @apply transition-all duration-200 ease-out;
}

.dropdown-enter-from,
.dropdown-leave-to {
  @apply opacity-0;
  max-height: 0;
}

.dropdown-enter-to,
.dropdown-leave-from {
  @apply opacity-100;
  max-height: 200px;
}

/* 滑块项 */
.slider-item {
  @apply flex flex-col gap-2 px-4 py-3;
  border-bottom: 1px solid var(--color-border);
}

.slider-label {
  @apply text-sm;
  color: var(--color-text);
}
</style>