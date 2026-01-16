import { registerApp } from '@/services/appRegistryService'
import { PromptService } from '@/services/promptService'
import { promptChainService } from '@/services/promptChainService'
import IconWeibo from '@/components/icons/IconWeibo.vue'
import { weiboPrompts } from './prompts'
import { weiboChains } from './chains'

/**
 * 注册微博应用
 * 
 * 使用统一的 appRegistry 服务
 * 同时注册提示词和提示词链
 */
export function registerWeiboApp() {
  // 注册 App 元数据
  registerApp({
    id: 'weibo',
    name: '微博',
    route: '/weibo',
    category: 'social',
    isBuiltin: true,
    icon: {
      type: 'component',
      value: IconWeibo,
      background: '#E6162D',
      color: '#FFFFFF'
    },
    desktop: {
      show: true,
      position: 'auto'
    },
    quickActions: [
      { id: 'weibo-post', label: '发微博', icon: 'fa-edit', route: '/weibo?action=compose' },
      { id: 'weibo-hot', label: '热搜榜', icon: 'fa-fire', route: '/weibo?tab=hot' },
    ],
  }, { override: true })
  
  // 注册提示词
  PromptService.registerAppPrompts('weibo', weiboPrompts)
  
  // 注册提示词链
  promptChainService.registerAppChains('weibo', weiboChains)
  
  console.log('[Weibo] 已注册提示词和提示词链')
}
