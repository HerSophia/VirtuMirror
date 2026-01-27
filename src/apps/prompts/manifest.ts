import { registerApp } from '@/services/icon'

/**
 * 注册提示词管理 App
 * 
 * 使用统一的 appRegistry 服务
 */
export function registerPromptsApp() {
  registerApp({
    id: 'prompts',
    name: '提示词',
    route: '/prompts',
    category: 'productivity',
    isBuiltin: true,
    desktop: {
      show: true,
      position: 'auto'
    },
    quickActions: [
      { id: 'prompts-create', label: '新建提示词', icon: 'fa-plus', route: '/prompts/list/user?action=create' },
      { id: 'prompts-search', label: '搜索提示词', icon: 'fa-search', route: '/prompts/list/search' },
    ],
  }, { override: true })
}
