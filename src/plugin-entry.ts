/**
 * SillyTavern 插件入口文件
 * 用于生产构建，在 SillyTavern 环境中加载
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import type { TavernEventType } from './types/sillytavern'
import { TavernEvents } from './types/sillytavern'

// 导入适配器和服务
import { createAdapter, setAdapter } from './adapters'
import { SillyTavernAdapter } from './adapters/sillyTavernAdapter'
import {
  initChatSyncService,
  destroyChatSyncService,
  getGlobalConfigService,
  destroyArchiveAutoExtractService,
  initArchiveAutoExtractService,
  getChatDataService,
} from './services'

// 全局变量
const loggingPrefix = '[手机模拟器 Vue]'
const parentWin = typeof window.parent !== 'undefined' ? window.parent : window

let app: ReturnType<typeof createApp> | null = null
let pinia: ReturnType<typeof createPinia> | null = null
let isInitialized = false

/**
 * 检查SillyTavern核心API是否就绪
 */
function areCoreApisReady(): boolean {
  const st = parentWin.SillyTavern
  const th = parentWin.TavernHelper
  const jq = parentWin.jQuery

  if (!st || !th || !jq) return false

  const context = st.getContext?.()
  if (!context) return false

  return !!(
    context.eventSource &&
    typeof context.eventSource.on === 'function' &&
    context.eventTypes &&
    typeof th.getWorldbook === 'function' &&
    typeof jq.fn?.append === 'function'
  )
}

/**
 * 初始化Vue应用
 */
async function initializeApp(): Promise<void> {
  if (isInitialized) return

  console.log(`%c${loggingPrefix} Initializing...`, 'color: #4CAF50; font-weight: bold;')

  try {
    // 创建并设置 SillyTavern 适配器
    const adapter = new SillyTavernAdapter()
    setAdapter(adapter)
    console.log(`${loggingPrefix} SillyTavern adapter initialized`)

    // 初始化全局配置
    const globalConfigService = getGlobalConfigService()
    if (!globalConfigService.getConfig()) {
      globalConfigService.saveConfig(globalConfigService.getOrCreateConfig())
      console.log(`${loggingPrefix} Global config initialized`)
    }

    // 初始化聊天同步服务
    initChatSyncService()
    console.log(`${loggingPrefix} Chat sync service initialized`)

    // 创建挂载点
    const mountPoint = document.createElement('div')

    initArchiveAutoExtractService()

    mountPoint.id = 'phone-sim-vue-app'
    document.body.appendChild(mountPoint)

    // 创建Pinia
    pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)

    // 创建Vue应用
    app = createApp(App)
    app.use(pinia)
    app.use(router)

    // 挂载应用
    app.mount('#phone-sim-vue-app')

    // 绑定SillyTavern事件（额外的事件处理）
    bindTavernEvents()

    isInitialized = true
    console.log(`%c${loggingPrefix} Initialization complete.`, 'color: #4CAF50; font-weight: bold;')
  } catch (error) {
    console.error(`${loggingPrefix} Initialization failed:`, error)
    throw error
  }
}

/**
 * 绑定SillyTavern事件
 */
function bindTavernEvents(): void {
  const context = parentWin.SillyTavern?.getContext()
  if (!context?.eventSource) return

  const { eventSource, eventTypes } = context

  // 消息接收
  eventSource.on(eventTypes.MESSAGE_RECEIVED as TavernEventType, (msgId: number) => {
    console.log(`${loggingPrefix} Message received:`, msgId)
    processMessage(msgId)
  })

  // 消息编辑
  eventSource.on(eventTypes.MESSAGE_EDITED as TavernEventType, (msgId: number) => {
    console.log(`${loggingPrefix} Message edited:`, msgId)
    processMessage(msgId)
  })

  // 消息删除
  eventSource.on(eventTypes.MESSAGE_DELETED as TavernEventType, (msgId: number) => {
    console.log(`${loggingPrefix} Message deleted:`, msgId)
    handleMessageDeleted(msgId)
  })

  // 聊天切换
  eventSource.on(eventTypes.CHAT_CHANGED as TavernEventType, () => {
    console.log(`${loggingPrefix} Chat changed`)
    handleChatChanged()
  })
}

/**
 * 处理消息
 */
function processMessage(msgId: number): void {
  const context = parentWin.SillyTavern?.getContext()
  if (!context?.chat) return

  const message = context.chat[msgId]
  if (!message || message.is_user) return

  // TODO: 调用解析器处理AI消息
  console.log(`${loggingPrefix} Processing message:`, msgId, message.mes.substring(0, 100))
}

/**
 * 处理消息删除
 */
function handleMessageDeleted(msgId: number): void {
  // TODO: 删除与该消息关联的数据
  console.log(`${loggingPrefix} Handling message deletion:`, msgId)
}

/**
 * 处理聊天切换
 */
function handleChatChanged(): void {
  // 聊天同步服务会自动处理数据加载
  // 这里只记录日志
  console.log(`${loggingPrefix} Handling chat change - data sync handled by ChatSyncService`)
}

/**
 * 销毁应用
 */
function destroyApp(): void {
  // 销毁聊天同步服务（会自动保存数据）
  destroyChatSyncService()
  console.log(`${loggingPrefix} Chat sync service destroyed`)

  destroyArchiveAutoExtractService()
  if (app) {
    app.unmount()
    app = null
  }
  const mountPoint = document.getElementById('phone-sim-vue-app')
  if (mountPoint) {
    mountPoint.remove()
  }
  isInitialized = false
  console.log(`${loggingPrefix} App destroyed`)
}

// 等待API就绪后初始化
let apiReadyInterval: ReturnType<typeof setInterval> | null = null

apiReadyInterval = setInterval(() => {
  if (areCoreApisReady()) {
    if (apiReadyInterval) {
      clearInterval(apiReadyInterval)
      apiReadyInterval = null
    }
    initializeApp()
  }
}, 100)

// 导出供调试使用
if (typeof window !== 'undefined') {
  (window as Window & { PhoneSimVue?: object }).PhoneSimVue = {
    destroy: destroyApp,
    reinitialize: initializeApp,
  }
}

export { initializeApp, destroyApp }