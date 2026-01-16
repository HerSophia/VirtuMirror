import { registerApp } from '@/services/appRegistryService'

/**
 * 注册账号管理 App
 * 
 * 使用统一的 appRegistry 服务，自动处理：
 * - 图标注册
 * - 桌面布局添加
 */
export function registerAccountManagerApp() {
  registerApp({
    id: 'account-manager',
    name: '账号管理',
    route: '/account-manager',
    category: 'system',
    isBuiltin: true,
    icon: {
      type: 'font',
      value: 'fas fa-users-cog',
      background: '#5C6BC0',
      color: '#FFFFFF'
    },
    desktop: {
      show: true,
      position: 'auto'
    },
    quickActions: [
      { id: 'account-manager-player', label: '玩家身份', icon: 'fa-user', route: '/account-manager' },
      { id: 'account-manager-create', label: '创建账号', icon: 'fa-plus', route: '/account-manager?action=create' },
    ],
  }, { override: true })
}
