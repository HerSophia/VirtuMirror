import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RegisteredAppIcon, AppCategory } from '@/types/icon'
import { iconService } from '@/services/icon/iconService'

export const useIconStore = defineStore('icon', () => {
  // State
  // 使用 Map 存储图标配置，key 为 App ID
  const icons = ref<Map<string, RegisteredAppIcon>>(new Map())
  
  // Initialize Service with reactive state
  // 依赖注入：将 Store 的状态注入到 Service 中
  iconService.init({ icons })
  
  // Getters
  const allIcons = computed(() => Array.from(icons.value.values()))
  
  const builtinApps = computed(() => 
    allIcons.value.filter(icon => icon.isBuiltin)
  )
  
  // Actions / Helper functions
  function getByCategory(category: AppCategory) {
    return allIcons.value.filter(icon => icon.category === category)
  }
  
  function getIcon(id: string) {
    return icons.value.get(id)
  }
  
  return {
    icons,
    allIcons,
    builtinApps,
    getByCategory,
    getIcon
  }
})
