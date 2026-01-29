/**
 * 会话上下文服务 - Bridge 事件监听初始化
 *
 * 自动响应酒馆事件，保持上下文状态同步
 */

import { loggerService } from '@/services/logger'
import { sessionContextService } from './SessionContextService'
import type { HostAdapter } from '@/adapters/types'
import type { BridgeAdapter, PlatformInfo, SyncMessage } from '@/adapters/bridgeAdapter'
import type { SwipeChangedEvent } from '@/types/swipe'

const logger = loggerService.child('session-context:init')

/** 取消订阅函数集合 */
let unsubscribers: Array<() => void> = []

/**
 * 初始化会话上下文监听器
 * 应在应用启动时调用
 *
 * @param adapter 宿主适配器（通常是 BridgeAdapter）
 */
export function initSessionContextListeners(adapter: HostAdapter): void {
  // 清理旧的监听器
  cleanupListeners()

  logger.info('正在初始化会话上下文监听器...')

  // 检查是否是 BridgeAdapter
  const isBridgeAdapter = 'getStatus' in adapter && 'getPlatform' in adapter

  if (!isBridgeAdapter) {
    logger.warn('适配器不是 BridgeAdapter，部分功能可能不可用')
    initBasicListeners(adapter)
    return
  }

  const bridgeAdapter = adapter as unknown as BridgeAdapter
  initBridgeListeners(bridgeAdapter)

  logger.info('会话上下文监听器已初始化')
}

/**
 * 清理监听器
 */
export function cleanupListeners(): void {
  unsubscribers.forEach((unsub) => unsub())
  unsubscribers = []
  logger.debug('监听器已清理')
}

/**
 * 初始化基础监听器（非 BridgeAdapter）
 */
function initBasicListeners(adapter: HostAdapter): void {
  // 监听聊天切换
  const unsubChatChanged = adapter.onChatChanged((chatFileName: string) => {
    logger.info('聊天已切换', { chatFileName })

    // 获取角色和玩家名称
    const characterName = adapter.getCharacterName()
    const playerName = adapter.getPlayerName()

    sessionContextService.updateSession(
      chatFileName, // 使用聊天文件名作为 sessionId
      characterName,
      playerName,
      adapter.getAdapterType()
    )
  })
  unsubscribers.push(unsubChatChanged)

  // 监听新消息
  const unsubMessageReceived = adapter.onMessageReceived((msgId: number) => {
    sessionContextService.updateMessage(msgId)
  })
  unsubscribers.push(unsubMessageReceived)
}

/**
 * 初始化 Bridge 监听器
 */
function initBridgeListeners(adapter: BridgeAdapter): void {
  // 监听连接状态
  const unsubConnected = adapter.on('bridge:connected', () => {
    logger.info('Bridge 已连接')
  })
  unsubscribers.push(unsubConnected)

  const unsubDisconnected = adapter.on('bridge:disconnected', () => {
    logger.info('Bridge 已断开')
    sessionContextService.clearContext()
  })
  unsubscribers.push(unsubDisconnected)

  // 监听平台变更
  const unsubPlatformChanged = adapter.on(
    'bridge:platform_changed',
    ((...args: unknown[]) => {
      const platform = args[0] as PlatformInfo | null
      if (platform) {
        logger.info('平台已连接', {
          platform: platform.platform,
          sessionId: platform.chatId,
        })

        sessionContextService.updateSession(
          platform.chatId, // chatId 实际上是 sessionId (UUID)
          platform.characterName || 'Character',
          platform.playerName || 'Player',
          platform.platform
        )
      } else {
        logger.info('平台已断开')
        sessionContextService.clearContext()
      }
    })
  )
  unsubscribers.push(unsubPlatformChanged)

  // 监听同步事件
  const unsubSync = adapter.on('bridge:sync', ((...args: unknown[]) => {
    const data = args[0] as SyncMessage
    handleSyncMessage(data)
  }))
  unsubscribers.push(unsubSync)

  // 监听完整同步
  const unsubFullSync = adapter.on('bridge:full_sync', (payload: unknown) => {
    const syncPayload = payload as { messages?: Array<{ message_id: number }> }
    if (syncPayload.messages && syncPayload.messages.length > 0) {
      // 更新到最后一条消息的楼层
      const lastMessage = syncPayload.messages[syncPayload.messages.length - 1]
      sessionContextService.updateMessage(lastMessage.message_id)
    }
  })
  unsubscribers.push(unsubFullSync)

  // 监听 Swipe 切换
  const unsubSwipeChanged = adapter.on('swipe_changed', ((...args: unknown[]) => {
    const event = args[0] as SwipeChangedEvent
    logger.debug('Swipe 已切换', {
      messageId: event.messageId,
      swipeId: event.newSwipeId,
    })

    // 更新楼层（如果需要）
    const context = sessionContextService.context
    if (context.sessionId && context.messageId !== event.messageId) {
      sessionContextService.updateMessage(event.messageId)
    }

    // 更新 Swipe
    sessionContextService.updateSwipe(event.newSwipeId)
  }))
  unsubscribers.push(unsubSwipeChanged)

  // 监听聊天切换
  const unsubChatChanged = adapter.on('chat_changed', ((...args: unknown[]) => {
    const chatId = args[0] as string
    logger.info('聊天已切换', { chatId })

    // 获取平台信息
    const platform = adapter.getPlatform()
    if (platform) {
      sessionContextService.updateSession(
        chatId,
        platform.characterName || 'Character',
        platform.playerName || 'Player',
        platform.platform
      )
    }
  }))
  unsubscribers.push(unsubChatChanged)

  // 初始化时检查当前状态
  initFromCurrentState(adapter)
}

/**
 * 处理同步消息
 */
function handleSyncMessage(data: SyncMessage): void {
  // 更新上下文（如果会话 ID 不同）
  const context = sessionContextService.context

  if (context.sessionId !== data.chatId) {
    sessionContextService.updateSession(
      data.chatId,
      data.characterName,
      data.playerName,
      data.platform
    )
  }

  // 根据消息类型更新楼层
  if (data.type === 'message_received' && data.payload.messages) {
    const messages = data.payload.messages as Array<{ message_id: number }>
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      sessionContextService.updateMessage(lastMessage.message_id)
    }
  }
}

/**
 * 从适配器当前状态初始化
 */
function initFromCurrentState(adapter: BridgeAdapter): void {
  const status = adapter.getStatus()

  if (status.connected && status.platform) {
    logger.info('从当前状态初始化', {
      platform: status.platform.platform,
      sessionId: status.currentSessionId,
    })

    sessionContextService.updateSession(
      status.currentSessionId || status.platform.chatId,
      status.platform.characterName || 'Character',
      status.platform.playerName || 'Player',
      status.platform.platform
    )
  }
}
