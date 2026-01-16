/**
 * 服务器端类型定义
 */

import type { Socket } from 'socket.io'

// ============ 客户端类型 ============

/** 平台客户端 - 只允许一个平台连接 */
export interface PlatformClient {
  socket: Socket
  platform: string
  sessionId: string          // 使用 sessionId 替代 chatId
  characterName: string
  playerName: string
  connectedAt: number
  lastPong: number
  isGenerating: boolean      // 是否正在请求 LLM 生成
  generationStartTime: number | null  // 生成开始时间
}

/** 手机客户端 */
export interface PhoneClient {
  socket: Socket
  connectedAt: number
  lastPong: number
}

// ============ 消息类型 ============

/** 同步消息类型 */
export type SyncMessageType =
  | 'full_sync'
  | 'incremental'
  | 'message_received'
  | 'message_edited'
  | 'message_deleted'
  | 'message_swiped'     // 消息页切换
  | 'chat_changed'
  | 'config_update'

/** 同步消息 */
export interface SyncMessage {
  type: SyncMessageType
  platform: string
  chatId: string             // 实际上是 sessionId
  characterName: string
  playerName: string
  timestamp: number
  payload: SyncPayload
}

/** 同步数据负载 */
export interface SyncPayload {
  sessionId?: string
  messages?: SyncedMessage[]
  messageRange?: { start: number; end: number }
  contacts?: unknown[]
  moments?: unknown[]
  emails?: unknown[]
  chatId?: string
  [key: string]: unknown
}

/** 同步的消息 */
export interface SyncedMessage {
  message_id: number
  sessionId: string
  name: string
  role: 'system' | 'assistant' | 'user'
  is_hidden: boolean
  message: string
  data: Record<string, unknown>
  extra: Record<string, unknown>
}

// ============ 配置类型 ============

/** 配置更新消息 */
export interface ConfigUpdateMessage {
  type: 'config_update'
  source: 'platform' | 'phone' | 'server'
  config: SharedConfig
  timestamp: number
}

/** 共享配置 */
export interface SharedConfig {
  floorRange: number
  autoSync: boolean
  syncInterval: number
  [key: string]: unknown
}

// ============ 服务器配置 ============

export interface ServerConfig {
  port: number
  corsOrigins: string[]
  heartbeatInterval: number
  heartbeatTimeout: number
}

// ============ API 响应类型 ============

/** 健康检查响应 */
export interface HealthResponse {
  status: 'ok' | 'error'
  platform: {
    id: string
    connected: boolean
  } | null
  phones: number
  uptime: number
  heartbeat: {
    interval: number
    timeout: number
  }
  config: SharedConfig
  auth: {
    enabled: boolean
  }
  storage: {
    sessions: number
    persistent: boolean
  }
}

/** 生成状态消息 */
export interface GenerationStatusMessage {
  status: 'started' | 'ended' | 'stopped'
  timestamp?: number
  messageId?: number
  duration?: number
  sessionId: string
}

/** 心跳响应（包含生成状态） */
export interface PongMessage {
  timestamp: number
  isGenerating?: boolean
  generationDuration?: number | null
}

/** Swipe 切换消息 */
export interface SwipeChangedMessage {
  /** 被切换 swipe 的楼层号 */
  messageId: number
  /** 新的 swipe ID */
  newSwipeId: number
  /** 总共有几个 swipe */
  swipeCount: number
  /** 新 swipe 的内容 */
  content: string
  /** 所属会话 ID */
  sessionId: string
  /** 时间戳 */
  timestamp: number
}

/** 状态响应 */
export interface StatusResponse {
  server: {
    uptime: number
    startTime: number
    heartbeatInterval: number
    heartbeatTimeout: number
  }
  auth: {
    enabled: boolean
    keyHint?: string
  }
  platform: {
    id: string
    platform: string
    sessionId: string
    characterName: string
    playerName: string
    connectedAt: number
    lastPong: number
    alive: boolean
    isGenerating: boolean
    generationDuration: number | null
  } | null
  phones: Array<{
    id: string
    connectedAt: number
    lastPong: number
    alive: boolean
  }>
  sharedConfig: SharedConfig
  storage: {
    sessions: number
    syncDataEntries: number
    totalMessages: number
    persistent: boolean
  }
}

/** 会话数据响应 */
export interface SessionDataResponse {
  success: boolean
  session?: {
    id: string
    platform: string
    characterName: string
    playerName: string
    createdAt: number
    lastActiveAt: number
  }
  syncData?: {
    messages: SyncedMessage[]
    messageRange: { start: number; end: number }
    contacts: unknown[]
    moments: unknown[]
    emails: unknown[]
    syncedAt: number
  }
  error?: string
}
