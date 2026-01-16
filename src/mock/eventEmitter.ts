/**
 * Mock事件发射器
 * 模拟SillyTavern的事件系统
 */

import type { EventEmitter, EventListenerMap, TavernEventType } from '@/types/sillytavern'

type Listener = (...args: unknown[]) => void

export function createMockEventEmitter(): EventEmitter {
  const listeners = new Map<string, Set<Listener>>()

  const emitter: EventEmitter = {
    on<K extends keyof EventListenerMap>(event: K, listener: EventListenerMap[K]) {
      const eventName = event as string
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set())
      }
      listeners.get(eventName)!.add(listener as Listener)
      console.log(`[Mock EventEmitter] Registered listener for: ${eventName}`)
    },

    once<K extends keyof EventListenerMap>(event: K, listener: EventListenerMap[K]) {
      const wrappedListener = ((...args: unknown[]) => {
        emitter.off(event, wrappedListener as EventListenerMap[K])
        ;(listener as Listener)(...args)
      }) as EventListenerMap[K]
      emitter.on(event, wrappedListener)
    },

    off<K extends keyof EventListenerMap>(event: K, listener: EventListenerMap[K]) {
      const eventName = event as string
      const eventListeners = listeners.get(eventName)
      if (eventListeners) {
        eventListeners.delete(listener as Listener)
        console.log(`[Mock EventEmitter] Removed listener for: ${eventName}`)
      }
    },

    emit<K extends keyof EventListenerMap>(event: K, ...args: Parameters<EventListenerMap[K]>) {
      const eventName = event as string
      const eventListeners = listeners.get(eventName)
      console.log(`[Mock EventEmitter] Emitting: ${eventName}`, args)
      if (eventListeners) {
        eventListeners.forEach(listener => {
          try {
            listener(...args)
          } catch (error) {
            console.error(`[Mock EventEmitter] Error in listener for ${eventName}:`, error)
          }
        })
      }
    },
  }

  return emitter
}

/**
 * 创建用于测试的事件触发器
 */
export function createTestEventTrigger(emitter: EventEmitter) {
  return {
    /**
     * 触发消息接收事件
     */
    triggerMessageReceived(messageId: number) {
      emitter.emit('message_received' as TavernEventType, messageId)
    },

    /**
     * 触发消息编辑事件
     */
    triggerMessageEdited(messageId: number) {
      emitter.emit('message_edited' as TavernEventType, messageId)
    },

    /**
     * 触发消息删除事件
     */
    triggerMessageDeleted(messageId: number) {
      emitter.emit('message_deleted' as TavernEventType, messageId)
    },

    /**
     * 触发聊天切换事件
     */
    triggerChatChanged(chatFileName: string) {
      emitter.emit('chat_id_changed' as TavernEventType, chatFileName)
    },

    /**
     * 触发应用就绪事件
     */
    triggerAppReady() {
      emitter.emit('app_ready' as TavernEventType)
    },

    /**
     * 触发生成开始事件
     */
    triggerGenerationStarted() {
      emitter.emit('generation_started' as TavernEventType, 'normal', {}, false)
    },

    /**
     * 触发生成结束事件
     */
    triggerGenerationEnded(messageId: number) {
      emitter.emit('generation_ended' as TavernEventType, messageId)
    },
  }
}