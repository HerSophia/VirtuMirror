<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { SettingsGroup, SettingsItem, ToggleSwitch } from '../components'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAppStoreStore } from '@/stores/appStoreStore'

const router = useRouter()
const notificationStore = useNotificationStore()
const appStoreStore = useAppStoreStore()

function goBack() {
  router.back()
}

// 暂时的全局开关
const permissionGranted = ref(true)

// 获取已安装应用列表
const installedApps = computed(() => {
  return appStoreStore.installedApps
})

// 辅助函数：获取应用图标
function getAppIcon(app: any) {
  const icon = app.package.icon
  if (!icon) return 'fa-cube'
  
  if (typeof icon === 'string') {
     // 如果是 URL，暂时返回通用图标，后续 SettingsItem 可能需要支持 img 标签
     if (icon.startsWith('http')) return 'fa-cube'
     return icon
  }
  
  // 处理对象类型图标
  if (icon.type === 'font' || icon.type === 'fontawesome') {
    return icon.value
  }
  
  return 'fa-cube'
}

function getAppIconBg(app: any) {
  const icon = app.package.icon
  if (typeof icon === 'object' && icon !== null) {
    return icon.background
  }
  return undefined
}
</script>

<template>
  <div class="notification-settings-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="page-title">通知</h1>
    </div>
    
    <div class="page-content">
      <SettingsGroup>
        <SettingsItem label="允许通知">
          <template #right>
            <ToggleSwitch v-model="permissionGranted" />
          </template>
        </SettingsItem>
        <SettingsItem label="勿扰模式">
          <template #right>
            <ToggleSwitch v-model="notificationStore.doNotDisturb" />
          </template>
        </SettingsItem>
      </SettingsGroup>

      <SettingsGroup title="通知样式">
        <SettingsItem label="显示预览" value="解锁时" arrow />
        <SettingsItem label="屏幕共享" value="关闭通知" arrow />
      </SettingsGroup>

      <SettingsGroup title="应用通知">
        <SettingsItem 
          v-for="app in installedApps" 
          :key="app.id"
          :label="app.package.name"
          :icon="getAppIcon(app)"
          :icon-bg="getAppIconBg(app)"
          icon-color="white"
          arrow
        />
      </SettingsGroup>
    </div>
  </div>
</template>

<style scoped>
.notification-settings-page {
  @apply flex flex-col h-full bg-[var(--color-background)];
}

.page-header {
  @apply flex items-center px-4 py-3 border-b border-[var(--color-border)];
  background-color: var(--color-surface);
}

.back-btn {
  @apply p-2 -ml-2 rounded-full;
  color: var(--color-text);
}

.back-btn:active {
  background-color: var(--color-surface-variant);
}

.page-title {
  @apply ml-2 text-lg font-medium;
  color: var(--color-text);
}

.page-content {
  @apply flex-1 overflow-y-auto p-4 flex flex-col gap-6;
}
</style>
