/**
 * SillyTavern API 类型定义
 * 基于 docs/ 目录下的类型定义文件
 */

// ==================== 聊天消息 ====================

export interface STChatMessage {
  name: string
  is_user: boolean
  is_system: boolean
  mes: string
  swipe_id?: number
  swipes?: string[]
  swipe_info?: Record<string, unknown>[]
  extra?: Record<string, unknown>
  variables?: Record<string, unknown>[] | { [swipe_id: number]: Record<string, unknown> }
}

export interface ChatMessage {
  message_id: number
  name: string
  role: 'system' | 'assistant' | 'user'
  is_hidden: boolean
  message: string
  data: Record<string, unknown>
  extra: Record<string, unknown>
}

// ==================== 世界书 ====================

export interface WorldbookEntry {
  uid: number
  name: string
  enabled: boolean
  strategy: {
    type: 'constant' | 'selective' | 'vectorized'
    keys: (string | RegExp)[]
    keys_secondary: {
      logic: 'and_any' | 'and_all' | 'not_all' | 'not_any'
      keys: (string | RegExp)[]
    }
    scan_depth: 'same_as_global' | number
  }
  position: {
    type:
      | 'before_character_definition'
      | 'after_character_definition'
      | 'before_example_messages'
      | 'after_example_messages'
      | 'before_author_note'
      | 'after_author_note'
      | 'at_depth'
    role: 'system' | 'assistant' | 'user'
    depth: number
    order: number
  }
  content: string
  probability: number
  recursion: {
    prevent_incoming: boolean
    prevent_outgoing: boolean
    delay_until: null | number
  }
  effect: {
    sticky: null | number
    cooldown: null | number
    delay: null | number
  }
  extra?: Record<string, unknown>
}

// ==================== 事件类型 ====================

export const TavernEvents = {
  APP_READY: 'app_ready',
  MESSAGE_SWIPED: 'message_swiped',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_UPDATED: 'message_updated',
  CHAT_CHANGED: 'chat_id_changed',
  GENERATION_STARTED: 'generation_started',
  GENERATION_STOPPED: 'generation_stopped',
  GENERATION_ENDED: 'generation_ended',
} as const

export type TavernEventType = (typeof TavernEvents)[keyof typeof TavernEvents]

// ==================== 事件监听器类型 ====================

export interface EventListenerMap {
  [TavernEvents.APP_READY]: () => void
  [TavernEvents.MESSAGE_SWIPED]: (messageId: number) => void
  [TavernEvents.MESSAGE_SENT]: (messageId: number) => void
  [TavernEvents.MESSAGE_RECEIVED]: (messageId: number, type?: string) => void
  [TavernEvents.MESSAGE_EDITED]: (messageId: number) => void
  [TavernEvents.MESSAGE_DELETED]: (messageId: number) => void
  [TavernEvents.MESSAGE_UPDATED]: (messageId: number) => void
  [TavernEvents.CHAT_CHANGED]: (chatFileName: string) => void
  [TavernEvents.GENERATION_STARTED]: (type: string, options: unknown, dryRun: boolean) => void
  [TavernEvents.GENERATION_STOPPED]: () => void
  [TavernEvents.GENERATION_ENDED]: (messageId: number) => void
  [key: string]: (...args: unknown[]) => void
}

// ==================== 事件发射器 ====================

export interface EventEmitter {
  on<K extends keyof EventListenerMap>(event: K, listener: EventListenerMap[K]): void
  once<K extends keyof EventListenerMap>(event: K, listener: EventListenerMap[K]): void
  off<K extends keyof EventListenerMap>(event: K, listener: EventListenerMap[K]): void
  emit<K extends keyof EventListenerMap>(event: K, ...args: Parameters<EventListenerMap[K]>): void
}

// ==================== TavernHelper API ====================

export interface TavernHelperAPI {
  // 聊天消息
  getChatMessages: (
    range: string | number,
    options?: {
      role?: 'all' | 'system' | 'assistant' | 'user'
      hide_state?: 'all' | 'hidden' | 'unhidden'
      include_swipes?: boolean
    }
  ) => ChatMessage[]
  
  setChatMessages: (
    messages: Array<{ message_id: number } & Partial<ChatMessage>>,
    options?: { refresh?: 'none' | 'affected' | 'all' }
  ) => Promise<void>
  
  createChatMessages: (
    messages: Array<{
      name?: string
      role: 'system' | 'assistant' | 'user'
      is_hidden?: boolean
      message: string
      data?: Record<string, unknown>
      extra?: Record<string, unknown>
    }>,
    options?: { insert_at?: number | 'end'; refresh?: 'none' | 'affected' | 'all' }
  ) => Promise<void>
  
  deleteChatMessages: (
    messageIds: number[],
    options?: { refresh?: 'none' | 'all' }
  ) => Promise<void>
  
  getLastMessageId: () => number
  
  // 世界书
  getWorldbookNames: () => string[]
  getWorldbook: (name: string) => Promise<WorldbookEntry[]>
  createWorldbook: (name: string, entries?: WorldbookEntry[]) => Promise<boolean>
  replaceWorldbook: (
    name: string,
    entries: Partial<WorldbookEntry>[],
    options?: { render?: 'debounced' | 'immediate' }
  ) => Promise<void>
  updateWorldbookWith: (
    name: string,
    updater: (entries: WorldbookEntry[]) => Partial<WorldbookEntry>[],
    options?: { render?: 'debounced' | 'immediate' }
  ) => Promise<WorldbookEntry[]>
  createWorldbookEntries: (
    name: string,
    entries: Partial<WorldbookEntry>[],
    options?: { render?: 'debounced' | 'immediate' }
  ) => Promise<{ worldbook: WorldbookEntry[]; new_entries: WorldbookEntry[] }>
  deleteWorldbookEntries: (
    name: string,
    predicate: (entry: WorldbookEntry) => boolean,
    options?: { render?: 'debounced' | 'immediate' }
  ) => Promise<{ worldbook: WorldbookEntry[]; deleted_entries: WorldbookEntry[] }>
  getOrCreateChatWorldbook: (chatName: 'current', worldbookName?: string) => Promise<string>
  
  // 变量
  getVariables: () => Record<string, unknown>
  insertOrAssignVariables: (variables: Record<string, unknown>) => Promise<void>
  deleteVariable: (key: string) => Promise<void>
  
  // 生成
  generate: (options?: {
    prompt?: string
    quietPrompt?: string
    stream?: boolean
  }) => Promise<string>
  
  // 版本
  getTavernHelperVersion: () => string
  getTavernVersion: () => string
}

// ==================== SillyTavern Context ====================

export interface SillyTavernContext {
  chat: STChatMessage[]
  characters: unknown[]
  groups: unknown[]
  name1: string
  name2: string
  characterId: string
  groupId: string
  chatId: string
  getCurrentChatId: () => string
  eventSource: EventEmitter
  eventTypes: typeof TavernEvents
  generate: (options?: unknown) => Promise<string>
  stopGeneration: () => boolean
  callGenericPopup: (
    content: string | HTMLElement,
    type: number,
    inputValue?: string,
    options?: unknown
  ) => Promise<number | string | boolean | undefined>
}

// ==================== 全局Window扩展 ====================

declare global {
  interface Window {
    SillyTavern?: {
      getContext: () => SillyTavernContext
    }
    TavernHelper?: TavernHelperAPI
    jQuery?: typeof jQuery
    toastr?: {
      info: (message: string, title?: string, options?: unknown) => void
      success: (message: string, title?: string, options?: unknown) => void
      warning: (message: string, title?: string, options?: unknown) => void
      error: (message: string, title?: string, options?: unknown) => void
    }
  }
}

export {}