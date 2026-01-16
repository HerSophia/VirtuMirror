<script setup lang="ts">
/**
 * 设备模式分区
 * 包含设备模式、尺寸预设、屏幕方向、自动适应等设置
 */
import { ref, computed } from 'vue'
import { useDeviceStore, type DeviceMode } from '@/stores/deviceStore'
import { SettingsGroup, SettingsItem, ToggleSwitch } from '../components'

const deviceStore = useDeviceStore()

// 下拉菜单展开状态
const isPresetDropdownOpen = ref(false)

// 设备模式选项
const deviceModeOptions: { value: DeviceMode; label: string; icon: string }[] = [
  { value: 'phone', label: '手机', icon: 'fa-mobile-alt' },
  { value: 'tablet', label: '平板', icon: 'fa-tablet-alt' },
  { value: 'desktop', label: '桌面', icon: 'fa-desktop' },
]

// 当前模式下的预设列表
const currentModePresets = computed(() =>
  deviceStore.presetsByMode[deviceStore.mode]
)

function setDeviceMode(mode: DeviceMode) {
  deviceStore.setMode(mode)
}

function selectPreset(presetId: string) {
  deviceStore.selectPreset(presetId)
  isPresetDropdownOpen.value = false
}

function togglePresetDropdown() {
  isPresetDropdownOpen.value = !isPresetDropdownOpen.value
}

function toggleAutoFit() {
  deviceStore.toggleAutoFit()
}
</script>

<template>
  <SettingsGroup title="设备模式">
    <!-- 设备模式选择器 -->
    <div class="device-mode-selector">
      <button
        v-for="option in deviceModeOptions"
        :key="option.value"
        class="device-mode-btn"
        :class="{ active: deviceStore.mode === option.value }"
        @click="setDeviceMode(option.value)"
      >
        <i class="fas" :class="option.icon" />
        <span>{{ option.label }}</span>
      </button>
    </div>
    
    <!-- 尺寸预设下拉选择 -->
    <SettingsItem
      label="尺寸预设"
      :value="deviceStore.selectedPreset.name"
      @click="togglePresetDropdown"
    >
      <template #right>
        <span class="preset-value">{{ deviceStore.selectedPreset.name }}</span>
        <i class="fas" :class="isPresetDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'" />
      </template>
    </SettingsItem>
    
    <!-- 预设下拉菜单 -->
    <Transition name="dropdown">
      <div v-if="isPresetDropdownOpen" class="preset-dropdown">
        <div
          v-for="preset in currentModePresets"
          :key="preset.id"
          class="preset-option"
          :class="{ active: deviceStore.selectedPresetId === preset.id }"
          @click="selectPreset(preset.id)"
        >
          <div class="preset-info">
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-desc">{{ preset.description }}</span>
          </div>
          <span class="preset-size">{{ preset.width }} × {{ preset.height }}</span>
        </div>
      </div>
    </Transition>
    
    <!-- 横竖屏切换（仅手机和平板模式可用） -->
    <SettingsItem
      v-if="deviceStore.canRotate"
      label="屏幕方向"
    >
      <template #right>
        <div class="orientation-selector">
          <button
            class="orientation-btn"
            :class="{ active: deviceStore.isPortrait }"
            @click.stop="deviceStore.setOrientation('portrait')"
          >
            <i class="fas fa-mobile-alt" />
            <span>竖屏</span>
          </button>
          <button
            class="orientation-btn"
            :class="{ active: deviceStore.isLandscape }"
            @click.stop="deviceStore.setOrientation('landscape')"
          >
            <i class="fas fa-mobile-alt fa-rotate-90" />
            <span>横屏</span>
          </button>
        </div>
      </template>
    </SettingsItem>
    
    <!-- 自动适应窗口 -->
    <SettingsItem label="自动适应窗口" @click="toggleAutoFit">
      <template #right>
        <ToggleSwitch v-model="deviceStore.autoFit" />
      </template>
    </SettingsItem>
    
    <!-- 当前尺寸 -->
    <SettingsItem
      label="当前尺寸"
      :value="`${deviceStore.dimensions.width} × ${deviceStore.dimensions.height}`"
    />
  </SettingsGroup>
</template>

<style scoped>
/* 设备模式选择器 */
.device-mode-selector {
  @apply flex p-3 gap-2;
}

.device-mode-btn {
  @apply flex-1 flex flex-col items-center gap-1.5 py-3 px-2;
  @apply rounded-lg;
  @apply transition-all duration-200;
  background-color: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.device-mode-btn:hover {
  opacity: 0.8;
}

.device-mode-btn.active {
  background-color: var(--color-primary);
  color: white;
}

.device-mode-btn i {
  @apply text-xl;
}

.device-mode-btn span {
  @apply text-xs font-medium;
}

/* 预设值显示 */
.preset-value {
  color: var(--color-text-secondary);
}

/* 预设下拉菜单 */
.preset-dropdown {
  @apply max-h-[200px] overflow-y-auto;
  background-color: var(--color-surface-variant);
  border-top: 1px solid var(--color-border);
}

.preset-option {
  @apply flex items-center justify-between px-4 py-2.5;
  @apply last:border-b-0;
  @apply cursor-pointer transition-colors;
  border-bottom: 1px solid var(--color-border);
}

.preset-option:hover {
  background-color: var(--color-surface);
}

.preset-option.active {
  background-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.preset-option.active .preset-name {
  color: var(--color-primary);
  @apply font-medium;
}

.preset-info {
  @apply flex flex-col gap-0.5;
}

.preset-name {
  @apply text-sm;
  color: var(--color-text);
}

.preset-desc {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.preset-size {
  @apply text-xs font-mono;
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

/* 横竖屏选择器 */
.orientation-selector {
  @apply flex gap-2;
}

.orientation-btn {
  @apply flex items-center gap-1.5 px-3 py-1.5;
  @apply rounded-lg;
  @apply text-xs font-medium;
  @apply transition-all duration-200;
  background-color: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.orientation-btn:hover {
  opacity: 0.8;
}

.orientation-btn.active {
  background-color: var(--color-primary);
  color: white;
}

.orientation-btn i {
  @apply text-sm;
}
</style>