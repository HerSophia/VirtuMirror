<script setup lang="ts">
/**
 * DeviceModeSwitch - 设备模式三阶切换组件
 * 
 * 提供手机/平板/桌面三种模式的快速切换
 */
import { computed } from 'vue'
import { useDeviceStore, type DeviceMode } from '@/stores/deviceStore'

const deviceStore = useDeviceStore()

const modes: { value: DeviceMode; icon: string; label: string }[] = [
  { value: 'phone', icon: 'fas fa-mobile-alt', label: '手机' },
  { value: 'tablet', icon: 'fas fa-tablet-alt', label: '平板' },
  { value: 'desktop', icon: 'fas fa-desktop', label: '桌面' },
]

const currentModeIndex = computed(() =>
  modes.findIndex(m => m.value === deviceStore.mode)
)

function selectMode(mode: DeviceMode) {
  deviceStore.setMode(mode)
}
</script>

<template>
  <div class="device-mode-switch">
    <div class="switch-track">
      <!-- 滑块指示器 -->
      <div
        class="switch-indicator"
        :style="{ transform: `translateX(${currentModeIndex * 100}%)` }"
      />
      
      <!-- 模式选项 -->
      <button
        v-for="mode in modes"
        :key="mode.value"
        class="switch-option"
        :class="{ active: deviceStore.mode === mode.value }"
        @click="selectMode(mode.value)"
        :title="mode.label"
      >
        <i :class="mode.icon" />
        <span class="option-label">{{ mode.label }}</span>
      </button>
    </div>
    
    <!-- 当前模式描述 -->
    <div class="mode-description">
      {{ modes[currentModeIndex]?.label }}模式
    </div>
  </div>
</template>

<style scoped>
.device-mode-switch {
  @apply flex flex-col items-center gap-2;
}

.switch-track {
  @apply relative flex;
  @apply rounded-full;
  @apply p-1;
  background: rgba(255, 255, 255, 0.1);
}

.switch-indicator {
  @apply absolute top-1 bottom-1 left-1;
  @apply rounded-full;
  width: calc(33.333% - 4px);
  background: rgba(255, 255, 255, 0.25);
  @apply transition-transform duration-300 ease-out;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.switch-option {
  @apply relative z-10;
  @apply flex flex-col items-center justify-center gap-0.5;
  @apply w-16 h-14;
  @apply text-white/60;
  @apply rounded-full;
  @apply transition-all duration-200;
}

.switch-option:hover {
  @apply text-white/80;
}

.switch-option.active {
  @apply text-white;
}

.switch-option i {
  @apply text-lg;
}

.option-label {
  @apply text-[10px] font-medium;
}

.mode-description {
  @apply text-xs text-white/50 font-medium;
}

/* iOS 风格适配 */
:global(.ios-style) .switch-track {
  background: rgba(120, 120, 128, 0.24);
}

:global(.ios-style) .switch-indicator {
  background: #FFFFFF;
  box-shadow: 
    0 3px 8px rgba(0, 0, 0, 0.12),
    0 1px 1px rgba(0, 0, 0, 0.04);
}

:global(.ios-style) .switch-option {
  @apply text-black/60;
}

:global(.ios-style) .switch-option.active {
  @apply text-black;
}

/* Android 风格适配 */
:global(.android-style) .switch-track {
  background: #48464C;
  @apply rounded-[16px];
}

:global(.android-style) .switch-indicator {
  background: #D0BCFF;
  @apply rounded-[12px];
}

:global(.android-style) .switch-option.active {
  color: #381E72;
}
</style>
