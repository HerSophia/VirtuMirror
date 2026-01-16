/**
 * 社交引擎配置 App 注册清单
 */
import { registerApp } from '@/services/appRegistryService'

/**
 * 注册社交引擎配置 App
 */
export function registerSocialEngineApp() {
  registerApp({
    id: 'social-engine',
    name: '社交引擎',
    route: '/social-engine',
    category: 'system',
    isBuiltin: true,
    
    // 图标配置
    icon: {
      type: 'font',
      value: 'fas fa-network-wired',
      background: '#607D8B',
      color: '#FFFFFF'
    },
    
    // 桌面配置
    desktop: {
      show: true,
      position: 'auto'
    },
    
    // 快捷操作
    quickActions: [
      { 
        id: 'social-engine-director', 
        label: '导演服务', 
        icon: 'fa-clapperboard', 
        route: '/social-engine' 
      },
      { 
        id: 'social-engine-platforms', 
        label: '平台管理', 
        icon: 'fa-globe', 
        route: '/social-engine' 
      },
    ]
  }, { override: true })
  
  console.log('[SocialEngine] App registered')
}
