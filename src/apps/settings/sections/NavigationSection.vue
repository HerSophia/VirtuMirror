<script setup lang="ts">
/**
 * 导航方式分区
 * 包含手势导航和三键导航切换
 */
import { useDeviceStore, type NavigationMode } from '@/stores/deviceStore'
import { SettingsGroup } from '../components'

const deviceStore = useDeviceStore()

// 导航模式选项
const navigationModeOptions: { value: NavigationMode; label: string; description: string; icon: string }[] = [
  { value: 'gesture', label: '手势导航', description: '底部上滑返回桌面', icon: 'fa-hand-pointer' },
  { value: 'buttons', label: '三键导航', description: '返回、主页、多任务按钮', icon: 'fa-th-list' },
]

function setNavigationMode(mode: NavigationMode) {
  deviceStore.setNavigationMode(mode)
}
</script>

<template>
  <SettingsGroup title="导航方式">
    <div class="navigation-mode-selector">
      <button
        v-for="option in navigationModeOptions"
        :key="option.value"
        class="navigation-mode-btn"
        :class="{ active: deviceStore.navigationMode === option.value }"
        @click="setNavigationMode(option.value)"
      >
        <i class="fas" :class="option.icon" />
        <div class="nav-mode-info">
          <span class="nav-mode-label">{{ option.label }}</span>
          <span class="nav-mode-desc">{{ option.description }}</span>
        </div>
      </button>
    </div>
  </SettingsGroup>
</template>

<style scoped>
.navigation-mode-selector {
  @apply flex flex-col p-3 gap-2;
}

.navigation-mode-btn {
  @apply flex items-center gap-3 p-3;
  @apply rounded-lg;
  @apply transition-all duration-200;
  @apply text-left;
  background-color: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.navigation-mode-btn:hover {
  opacity: 0.8;
}

.navigation-mode-btn.active {
  background-color: var(--color-primary);
  color: white;
}

.navigation-mode-btn i {
  @apply text-xl w-8 text-center;
}

.nav-mode-info {
  @apply flex flex-col;
}

.nav-mode-label {
  @apply text-sm font-medium;
}

.navigation-mode-btn.active .nav-mode-label {
  color: white;
}

.nav-mode-desc {
  @apply text-xs opacity-70;
}

.navigation-mode-btn.active .nav-mode-desc {
  color: rgba(255, 255, 255, 0.8);
}
</style>