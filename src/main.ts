import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import './assets/styles/index.css'

// 导入适配器和服务
import { createAdapter, getAdapter } from './adapters'
import { initChatSyncService, destroyChatSyncService, getGlobalConfigService, registerBuiltinApps, DirectorService, PlatformRegistry } from './services'
import { registerBuiltinNarrativePrompts } from './services/builtinNarrativePrompts'
// 导入 App 注册清单
import { registerWeiboApp } from '@/apps/weibo/manifest'
import { registerPromptsApp } from '@/apps/prompts/manifest'
import { registerAccountManagerApp } from '@/apps/account-manager/manifest'
import { registerSocialEngineApp } from '@/apps/social-engine/manifest'

// 创建Pinia实例
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 创建Vue应用
const app = createApp(App)

// 使用Pinia
app.use(pinia)

// 使用Vue Router
app.use(router)

// 初始化适配器和服务
async function initializeServices() {
  // 创建适配器（开发模式会使用 MockAdapter）
  const adapter = createAdapter()
  
  // 注册内置 App 图标（在全局配置之前，因为桌面布局可能依赖它）
  registerBuiltinApps()
  registerWeiboApp() // 注册微博 App
  registerPromptsApp() // 注册提示词 App
  registerAccountManagerApp() // 注册账号管理 App
  registerSocialEngineApp() // 注册社交引擎 App
  
  // 初始化全局配置（如果不存在则创建默认配置）
  const globalConfigService = getGlobalConfigService()
  if (!globalConfigService.getConfig()) {
    globalConfigService.saveConfig(globalConfigService.getOrCreateConfig())
    console.log('[PhoneSim] 已初始化全局配置')
  }
  
  // 初始化聊天同步服务
  initChatSyncService()
  
  // 注意：叙事服务在 Bridge 适配器初始化时自动设置
  // 见 src/apps/bridge/composables/useBridge.ts
  
  // 初始化社交媒体导演服务 (启动时间监听)
  DirectorService.getInstance();

  // 初始化社交平台注册表 (确保 Prompts 被注册)
  PlatformRegistry.getInstance();
  
  // 注册内置叙事理解提示词（用户可在 Prompts App 中修改）
  registerBuiltinNarrativePrompts();
  
  console.log('[PhoneSim] 服务初始化完成')
  
  return adapter
}

// 开发模式下的额外配置
if (import.meta.env.DEV) {
  // 开启Vue开发工具
  app.config.performance = true
  
  // 初始化Mock服务（兼容旧的 mock 系统）
  import('./mock').then(({ initMockServices }) => {
    initMockServices()
    console.log('[PhoneSim Dev] Mock services initialized')
  })
}

// 初始化服务后挂载应用
initializeServices().then(() => {
  // 挂载应用
  app.mount('#app')
  console.log('[PhoneSim] 应用已挂载')
}).catch((error) => {
  console.error('[PhoneSim] 服务初始化失败:', error)
  // 即使服务初始化失败，也尝试挂载应用
  app.mount('#app')
})

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  destroyChatSyncService()
})

// 导出app实例供测试使用
export { app, pinia, router }