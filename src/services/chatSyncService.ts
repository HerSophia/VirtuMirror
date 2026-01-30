/**
 * 聊天同步服务
 * 处理聊天切换时的数据自动加载和同步
 */

import { getAdapter } from '@/adapters'
import type { HostAdapter, UnsubscribeFn } from '@/adapters/types'
import { getChatDataService, resetChatDataService } from './chatDataService'
import { getGlobalConfigService } from './globalConfigService'
import { sessionService } from '@/services/database'
import { getBridgeAdapter } from '@/adapters/bridgeAdapter'
import type { PhoneChatData } from '@/types/persistedData'
import { createEmptyPhoneChatData } from '@/types/persistedData'
import { loggerService } from '@/services/logger/loggerService'

/**
 * Store 同步回调类型
 */
export type StoreSyncCallback = (data: PhoneChatData) => void

/**
 * 聊天同步服务类
 * 负责在聊天切换时自动加载和同步数据
 */
export class ChatSyncService {
  private adapter: HostAdapter
  private unsubscribers: UnsubscribeFn[] = []
  private storeSyncCallbacks: Set<StoreSyncCallback> = new Set()
  private isInitialized = false
  private currentChatId: string | null = null
  
  constructor(adapter?: HostAdapter) {
    this.adapter = adapter ?? getAdapter()
  }
  
  /**
   * 初始化聊天同步服务
   */
  init(): void {
    if (this.isInitialized) {
      loggerService.warn('ChatSyncService', '服务已初始化')
      return
    }
    
    // 监听聊天切换事件
    const unsubChatChanged = this.adapter.onChatChanged((chatFileName) => {
      this.onChatChanged(chatFileName)
    })
    this.unsubscribers.push(unsubChatChanged)
    
    // 监听消息接收事件（用于处理 AI 生成的数据）
    const unsubMessageReceived = this.adapter.onMessageReceived((msgId, content) => {
      this.onMessageReceived(msgId, content)
    })
    this.unsubscribers.push(unsubMessageReceived)
    
    // 监听消息删除事件
    const unsubMessageDeleted = this.adapter.onMessageDeleted((msgId) => {
      this.onMessageDeleted(msgId)
    })
    this.unsubscribers.push(unsubMessageDeleted)
    
    // 监听 Bridge 平台连接事件
    const bridgeAdapter = getBridgeAdapter()
    if (bridgeAdapter) {
      const unsubPlatformConnected = bridgeAdapter.on('bridge:platform_connected', () => {
        this.updateSessionId()
      })
      const unsubPlatformDisconnected = bridgeAdapter.on('bridge:platform_disconnected', () => {
        sessionService.setCurrentSessionId(null)
      })
      this.unsubscribers.push(unsubPlatformConnected)
      this.unsubscribers.push(unsubPlatformDisconnected)
      
      // 初始化时检查
      this.updateSessionId()
    }
    
    this.isInitialized = true
    console.info('[ChatSyncService] 聊天同步服务已初始化')
    
    // 首次加载当前聊天的数据
    this.loadCurrentChatData()
  }
  
  /**
   * 更新当前 Session ID
   */
  private updateSessionId() {
    const bridgeAdapter = getBridgeAdapter()
    if (!bridgeAdapter) return

    const fullSessionId = bridgeAdapter.getFullSessionId()
    if (fullSessionId) {
      loggerService.info('ChatSyncService', `更新全局 SessionID: ${fullSessionId}`)
      sessionService.setCurrentSessionId(fullSessionId)
      
      // 确保会话记录存在
      const platformInfo = bridgeAdapter.getPlatform()
      if (platformInfo) {
        sessionService.getOrCreateSession(
          platformInfo.platform,
          platformInfo.chatId,
          bridgeAdapter.getCharacterName(),
          bridgeAdapter.getPlayerName()
        ).catch(err => {
          loggerService.error('ChatSyncService', '创建会话记录失败:', err)
        })
      }
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 保存当前数据
    const chatDataService = getChatDataService()
    chatDataService.saveImmediately()
    
    // 取消所有事件监听
    this.unsubscribers.forEach(unsub => unsub())
    this.unsubscribers = []
    
    // 清理回调
    this.storeSyncCallbacks.clear()
    
    // 重置服务
    resetChatDataService()
    
    this.isInitialized = false
    this.currentChatId = null
    
    console.info('[ChatSyncService] 聊天同步服务已销毁')
  }
  
  /**
   * 注册 Store 同步回调
   * 当数据加载时会调用这些回调来更新 Pinia stores
   */
  registerStoreSyncCallback(callback: StoreSyncCallback): UnsubscribeFn {
    this.storeSyncCallbacks.add(callback)
    return () => {
      this.storeSyncCallbacks.delete(callback)
    }
  }
  
  /**
   * 手动触发数据同步到 Stores
   */
  syncToStores(): void {
    const chatDataService = getChatDataService()
    const data = chatDataService.getOrCreateData()
    this.notifyStores(data)
  }
  
  /**
   * 手动触发从 Stores 保存数据
   */
  saveFromStores(): void {
    const chatDataService = getChatDataService()
    chatDataService.saveImmediately()
  }
  
  /**
   * 获取当前聊天ID
   */
  getCurrentChatId(): string | null {
    return this.currentChatId
  }
  
  /**
   * 检查服务是否已初始化
   */
  isServiceInitialized(): boolean {
    return this.isInitialized
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 处理聊天切换事件
   */
  private onChatChanged(chatFileName: string): void {
    console.info(`[ChatSyncService] 检测到聊天切换: ${chatFileName}`)
    
    // 保存当前聊天的数据
    const chatDataService = getChatDataService()
    chatDataService.saveImmediately()
    
    // 重置聊天数据服务（清除缓存）
    resetChatDataService()
    
    // 更新当前聊天ID
    this.currentChatId = chatFileName
    
    // 尝试更新全局 SessionID (如果是 Bridge Adapter)
    this.updateSessionId()
    
    // 加载新聊天的数据
    this.loadCurrentChatData()
  }
  
  /**
   * 加载当前聊天的数据
   */
  private loadCurrentChatData(): void {
    const chatDataService = getChatDataService()
    let data = chatDataService.getData()
    
    if (data) {
      console.info('[ChatSyncService] 已从聊天变量加载数据')
    } else {
      // 如果没有数据，初始化空数据
      data = createEmptyPhoneChatData()
      chatDataService.saveData(data)
      console.info('[ChatSyncService] 已初始化新聊天的数据')
    }
    
    // 通知所有 Store 更新
    this.notifyStores(data)
  }
  
  /**
   * 处理消息接收事件
   */
  private onMessageReceived(msgId: number, content: string): void {
    // TODO: 解析 AI 消息中的指令并更新数据
    loggerService.debug('ChatSyncService', `收到消息: ${msgId}`)
  }
  
  /**
   * 处理消息删除事件
   */
  private onMessageDeleted(msgId: number): void {
    // TODO: 删除与该消息关联的数据
    loggerService.debug('ChatSyncService', `消息已删除: ${msgId}`)
  }
  
  /**
   * 通知所有注册的 Store 回调
   */
  private notifyStores(data: PhoneChatData): void {
    this.storeSyncCallbacks.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        loggerService.error('ChatSyncService', 'Store 同步回调执行失败:', error)
      }
    })
  }
}

// ==================== 单例实例 ====================

let chatSyncServiceInstance: ChatSyncService | null = null

/**
 * 获取 ChatSyncService 单例实例
 */
export function getChatSyncService(): ChatSyncService {
  if (!chatSyncServiceInstance) {
    chatSyncServiceInstance = new ChatSyncService()
  }
  return chatSyncServiceInstance
}

/**
 * 初始化 ChatSyncService
 * 应该在应用启动时调用
 */
export function initChatSyncService(): ChatSyncService {
  const service = getChatSyncService()
  service.init()
  return service
}

/**
 * 销毁 ChatSyncService
 * 应该在应用卸载时调用
 */
export function destroyChatSyncService(): void {
  if (chatSyncServiceInstance) {
    chatSyncServiceInstance.destroy()
    chatSyncServiceInstance = null
  }
}