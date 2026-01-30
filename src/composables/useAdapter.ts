/**
 * 适配器组合式函数
 * 提供 Vue 组件访问适配器和服务的便捷方式
 */

import { inject, provide, readonly, ref, computed, onUnmounted } from 'vue'
import type { InjectionKey, Ref, ComputedRef } from 'vue'
import type { HostAdapter } from '@/adapters/types'
import { getAdapter, createAdapter, setAdapter } from '@/adapters'
import {
  getChatDataService,
  getGlobalConfigService,
  getChatSyncService,
  initChatSyncService,
  destroyChatSyncService,
} from '@/services'
import type { ChatDataService } from '@/services/chatDataService'
import type { GlobalConfigService } from '@/services/globalConfigService'
import type { ChatSyncService } from '@/services/chatSyncService'
import { loggerService } from '@/services/logger/loggerService'

// ==================== Injection Keys ====================

/**
 * 适配器注入键
 */
export const AdapterKey: InjectionKey<HostAdapter> = Symbol('HostAdapter')

/**
 * 聊天数据服务注入键
 */
export const ChatDataServiceKey: InjectionKey<ChatDataService> = Symbol('ChatDataService')

/**
 * 全局配置服务注入键
 */
export const GlobalConfigServiceKey: InjectionKey<GlobalConfigService> = Symbol('GlobalConfigService')

/**
 * 聊天同步服务注入键
 */
export const ChatSyncServiceKey: InjectionKey<ChatSyncService> = Symbol('ChatSyncService')

// ==================== Provider ====================

/**
 * 提供适配器和服务到 Vue 组件树
 * 应该在根组件中调用
 */
export function provideAdapterServices(): {
  adapter: HostAdapter
  chatDataService: ChatDataService
  globalConfigService: GlobalConfigService
  chatSyncService: ChatSyncService
} {
  // 创建或获取适配器
  const adapter = createAdapter()
  
  // 获取服务实例
  const chatDataService = getChatDataService()
  const globalConfigService = getGlobalConfigService()
  const chatSyncService = initChatSyncService()
  
  // 提供到组件树
  provide(AdapterKey, adapter)
  provide(ChatDataServiceKey, chatDataService)
  provide(GlobalConfigServiceKey, globalConfigService)
  provide(ChatSyncServiceKey, chatSyncService)
  
  loggerService.info('useAdapter', 'Services provided to component tree')
  
  return {
    adapter,
    chatDataService,
    globalConfigService,
    chatSyncService,
  }
}

// ==================== Composables ====================

/**
 * 使用宿主环境适配器
 */
export function useAdapter(): HostAdapter {
  const adapter = inject(AdapterKey)
  if (!adapter) {
    // 如果没有提供，返回全局单例
    loggerService.warn('useAdapter', 'No adapter provided, using global instance')
    return getAdapter()
  }
  return adapter
}

/**
 * 使用聊天数据服务
 */
export function useChatDataService(): ChatDataService {
  const service = inject(ChatDataServiceKey)
  if (!service) {
    loggerService.warn('useChatDataService', 'No service provided, using global instance')
    return getChatDataService()
  }
  return service
}

/**
 * 使用全局配置服务
 */
export function useGlobalConfigService(): GlobalConfigService {
  const service = inject(GlobalConfigServiceKey)
  if (!service) {
    loggerService.warn('useGlobalConfigService', 'No service provided, using global instance')
    return getGlobalConfigService()
  }
  return service
}

/**
 * 使用聊天同步服务
 */
export function useChatSyncService(): ChatSyncService {
  const service = inject(ChatSyncServiceKey)
  if (!service) {
    loggerService.warn('useChatSyncService', 'No service provided, using global instance')
    return getChatSyncService()
  }
  return service
}

// ==================== 响应式状态 ====================

/**
 * 使用环境信息的响应式状态
 */
export function useEnvironment() {
  const adapter = useAdapter()
  
  const characterName = ref(adapter.getCharacterName())
  const playerName = ref(adapter.getPlayerName())
  const isDevMode = ref(adapter.isDevMode())
  const adapterType = ref(adapter.getAdapterType())
  
  // 如果是 Mock 适配器，可以动态更新名称
  const updateNames = () => {
    characterName.value = adapter.getCharacterName()
    playerName.value = adapter.getPlayerName()
  }
  
  return {
    characterName: readonly(characterName),
    playerName: readonly(playerName),
    isDevMode: readonly(isDevMode),
    adapterType: readonly(adapterType),
    updateNames,
  }
}

/**
 * 使用持久化数据的响应式状态
 * 提供便捷的数据访问和自动保存
 */
export function usePersistentData() {
  const chatDataService = useChatDataService()
  const globalConfigService = useGlobalConfigService()
  const chatSyncService = useChatSyncService()
  
  // 聊天数据响应式引用
  const chatData = ref(chatDataService.getOrCreateData())
  
  // 全局配置响应式引用
  const globalConfig = ref(globalConfigService.getOrCreateConfig())
  
  // 注册同步回调以更新响应式数据
  const unsubscribe = chatSyncService.registerStoreSyncCallback((data) => {
    chatData.value = data
  })
  
  // 组件卸载时取消订阅
  onUnmounted(() => {
    unsubscribe()
  })
  
  // 更新聊天数据
  const updateChatData = (updater: (data: typeof chatData.value) => void) => {
    updater(chatData.value)
    chatDataService.updateData(chatData.value)
  }
  
  // 更新全局配置
  const updateGlobalConfig = (updater: (config: typeof globalConfig.value) => void) => {
    updater(globalConfig.value)
    globalConfigService.updateConfig(globalConfig.value)
  }
  
  // 保存所有数据
  const saveAll = () => {
    chatDataService.saveImmediately()
  }
  
  return {
    chatData: readonly(chatData),
    globalConfig: readonly(globalConfig),
    updateChatData,
    updateGlobalConfig,
    saveAll,
  }
}

/**
 * 使用自定义 API 配置
 */
export function useCustomApi() {
  const globalConfigService = useGlobalConfigService()
  
  const isEnabled = computed(() => globalConfigService.isCustomApiEnabled())
  const activeConfig = computed(() => globalConfigService.getActiveApiConfig())
  const presets = computed(() => globalConfigService.getApiPresets())
  const activePreset = computed(() => globalConfigService.getActivePreset())
  
  return {
    isEnabled,
    activeConfig,
    presets,
    activePreset,
    enable: (config: Parameters<typeof globalConfigService.enableCustomApi>[0]) => 
      globalConfigService.enableCustomApi(config),
    disable: () => globalConfigService.disableCustomApi(),
    addPreset: (preset: Parameters<typeof globalConfigService.addPreset>[0]) => 
      globalConfigService.addPreset(preset),
    removePreset: (id: string) => globalConfigService.removePreset(id),
    setActivePreset: (id: string | null) => globalConfigService.setActivePreset(id),
  }
}