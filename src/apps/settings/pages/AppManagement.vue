<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { SettingsGroup, SettingsItem } from '../components'
import { useAppStoreStore } from '@/stores/appStoreStore'

const router = useRouter()
const appStoreStore = useAppStoreStore()

function goBack() {
  router.back()
}

// 获取已安装应用列表
const installedApps = computed(() => {
  return appStoreStore.installedApps
})

// 计算命名空间 (简化版，实际应该引用 AppIdentityService)
function getNamespace(app: any) {
  if (app.sourceInfo?.type === 'builtin') return '内置'
  if (app.sourceInfo?.type === 'repository') return '官方商店'
  return '未知来源'
}

// 辅助函数：获取应用图标
function getAppIcon(app: any) {
  const icon = app.package.icon
  if (!icon) return 'fa-cube'
  
  if (typeof icon === 'string') {
     // 如果是 URL，暂时返回通用图标，后续 SettingsItem 可能需要支持 img 标签
     if (icon.startsWith('http')) return 'fa-cube'
     return icon
  }
  
  // 处理对象类型图标 (AppIcon 类型)
  // 假设 fontawesome 类型直接返回 value
  if (icon.type === 'font' || icon.type === 'fontawesome') {
    return icon.value
  }
  
  // 其他类型暂时返回默认图标
  return 'fa-cube'
}

function getAppIconBg(app: any) {
  const icon = app.package.icon
  if (typeof icon === 'object' && icon !== null) {
    return icon.background || '#8e8e93'
  }
  return '#8e8e93'
}

function getAppIconColor(app: any) {
  const icon = app.package.icon
  if (typeof icon === 'object' && icon !== null) {
    return icon.color || 'white'
  }
  return 'white'
}

</script>

<template>
  <div class="app-management-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="page-title">应用管理</h1>
    </div>
    
    <div class="page-content">
      <SettingsGroup title="默认应用">
        <SettingsItem label="浏览器" value="Chrome" arrow />
        <SettingsItem label="电话" value="电话" arrow />
        <SettingsItem label="短信" value="信息" arrow />
      </SettingsGroup>

      <SettingsGroup title="已安装应用">
        <SettingsItem 
          v-for="app in installedApps" 
          :key="app.id"
          :label="app.package.name"
          :subtitle="getNamespace(app)"
          :icon="getAppIcon(app)"
          :icon-bg="getAppIconBg(app)"
          :icon-color="getAppIconColor(app)"
          arrow
        />
      </SettingsGroup>
    </div>
  </div>
</template>

<style scoped>
.app-management-page {
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
