/**
 * Bridge 适配器
 * 通过 Socket.IO 连接到 Bridge Server，实现与酒馆等平台的数据同步
 *
 * 状态管理设计：
 * - 使用 sessionId (UUID) 来唯一标识一个聊天会话
 * - sessionId 存储在酒馆的聊天级别变量中 (_phone_bridge.sessionId)
 * - 这样即使切换聊天再切回来，也能识别是同一个会话
 * - message_id 是酒馆的楼层号
 * - 组合使用 sessionId + message_id 可以唯一定位一条消息
 */

import { timeService } from '@/services/time/timeService'
import type { PhoneGlobalConfig } from '@/types/globalConfig'
import type { PhoneChatData } from '@/types/persistedData'
import type { MessageDeletedEvent, SwipeChangedEvent } from '@/types/swipe'
import { io, Socket } from 'socket.io-client'
import type {
  ChatMessage,
  GenerateOptions,
  HostAdapter,
  UnsubscribeFn,
  VariableOption,
} from './types'

// ============ 类型定义 ============

/** 同步消息 */
export interface SyncMessage {
  type:
    | 'full_sync'
    | 'incremental'
    | 'message_received'
    | 'message_edited'
    | 'message_deleted'
    | 'message_swiped'
    | 'chat_changed'
  platform: string
  chatId: string // 聊天文件唯一标识
  characterName: string
  playerName: string
  timestamp: number
  payload: SyncPayload
}

/** 同步数据 */
export interface SyncPayload {
  messages?: SyncedMessage[]
  messageRange?: { start: number; end: number }
  contacts?: unknown[]
  moments?: unknown[]
  emails?: unknown[]
  chatId?: string
  [key: string]: unknown
}

/** 同步的消息（来自酒馆，使用 snake_case） */
export interface SyncedMessage {
  message_id: number // 酒馆楼层号
  sessionId: string // 所属会话ID (UUID)
  name: string
  role: 'system' | 'assistant' | 'user'
  is_hidden: boolean
  message: string
  data: Record<string, unknown>
  extra: Record<string, unknown>
  // Swipe 相关字段
  swipe_id?: number // 当前显示的 swipe ID
  swipes?: string[] // 所有 swipe 内容
}

/** 平台信息 */
export interface PlatformInfo {
  id: string // platform:sessionId
  platform: string
  chatId: string // 实际上是 sessionId (UUID)
  characterName: string
  playerName: string
}

/** 共享配置（双向同步） */
export interface SharedConfig {
  floorRange: number
  autoSync: boolean
  syncInterval: number
  [key: string]: unknown
}

/** 配置更新消息 */
export interface ConfigUpdateMessage {
  type: 'config_update'
  source: 'platform' | 'phone' | 'server'
  config: Partial<SharedConfig>
  timestamp: number
}

/** Bridge 状态 */
export interface BridgeStatus {
  connected: boolean
  serverUrl: string
  currentPlatform: string | null
  currentSessionId: string | null // 当前会话的 UUID
  platform: PlatformInfo | null // 单一平台
  lastSyncTime: number | null
  lastPingTime: number | null
  lastPongTime: number | null
  latency: number | null
  sharedConfig: SharedConfig
}

export interface BridgeAdapterOptions {
  serverUrl?: string
  apiKey?: string // API Key 用于鉴权
  autoConnect?: boolean
  reconnection?: boolean
  reconnectionAttempts?: number
  reconnectionDelay?: number
  heartbeatTimeout?: number
}

const DEFAULT_OPTIONS: Required<BridgeAdapterOptions> = {
  serverUrl: 'http://localhost:3001',
  apiKey: '',
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 3000,
  heartbeatTimeout: 90000,
}

const DEFAULT_CONFIG: SharedConfig = {
  floorRange: 10,
  autoSync: true,
  syncInterval: 5000,
}

// ============ BridgeAdapter ============

export class BridgeAdapter implements HostAdapter {
  private socket: Socket | null = null
  private options: Required<BridgeAdapterOptions>
  private eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>()

  // 状态
  private _connected = false
  private _platform: PlatformInfo | null = null // 单一平台
  private _currentSessionId: string | null = null // 当前会话 UUID
  private _characterName = 'Character'
  private _playerName = 'Player'
  private _lastSyncTime: number | null = null
  private _lastPingTime: number | null = null
  private _lastPongTime: number | null = null
  private _latency: number | null = null
  private _heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null

  // 共享配置（双向同步）
  private _sharedConfig: SharedConfig = { ...DEFAULT_CONFIG }

  // 缓存的数据
  private _chatHistory: SyncedMessage[] = []
  private _chatData: PhoneChatData | null = null
  private _globalConfig: PhoneGlobalConfig | null = null

  constructor(options: BridgeAdapterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.loadConfig()

    if (this.options.autoConnect) {
      this.connect()
    }
  }

  // ==================== 连接管理 ====================

  connect(serverUrl?: string): void {
    if (serverUrl) {
      this.options.serverUrl = serverUrl
      this.saveConfig()
    }

    if (this.socket?.connected) {
      console.log('[BridgeAdapter] 已经连接')
      return
    }

    console.log(`[BridgeAdapter] 正在连接到 ${this.options.serverUrl}...`)

    // 构建连接选项
    const socketOptions: Parameters<typeof io>[1] = {
      query: { type: 'phone' },
      transports: ['websocket', 'polling'],
      reconnection: this.options.reconnection,
      reconnectionAttempts: this.options.reconnectionAttempts,
      reconnectionDelay: this.options.reconnectionDelay,
    }

    // 如果有 API Key，添加鉴权信息
    if (this.options.apiKey) {
      socketOptions.auth = { apiKey: this.options.apiKey }
      console.log('[BridgeAdapter] 使用 API Key 鉴权')
    }

    this.socket = io(this.options.serverUrl, socketOptions)

    this.setupSocketHandlers()
  }

  disconnect(): void {
    this.stopHeartbeatCheck()
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this._connected = false
    this._platform = null
    this._lastPingTime = null
    this._lastPongTime = null
    this._latency = null
    this.emit('bridge:disconnected')
  }

  getStatus(): BridgeStatus {
    return {
      connected: this._connected,
      serverUrl: this.options.serverUrl,
      currentPlatform: this._platform?.platform || null,
      currentSessionId: this._currentSessionId,
      platform: this._platform,
      lastSyncTime: this._lastSyncTime,
      lastPingTime: this._lastPingTime,
      lastPongTime: this._lastPongTime,
      latency: this._latency,
      sharedConfig: this._sharedConfig,
    }
  }

  /** 获取当前连接的平台（单一） */
  getPlatform(): PlatformInfo | null {
    return this._platform
  }

  /** 获取当前 sessionId (UUID) */
  getCurrentSessionId(): string | null {
    return this._currentSessionId
  }

  /** 获取完整的会话标识 (platform:sessionId) */
  getFullSessionId(): string | null {
    if (this._platform && this._currentSessionId) {
      return `${this._platform.platform}:${this._currentSessionId}`
    }
    return null
  }

  /** 请求同步数据 */
  requestSync(floorRange?: number): void {
    if (!this._connected || !this.socket) {
      console.warn('[BridgeAdapter] 未连接，无法请求同步')
      return
    }

    this.socket.emit('request_sync', {
      floorRange: floorRange ?? this._sharedConfig.floorRange,
    })
  }

  // ==================== 配置管理（双向同步） ====================

  /** 获取共享配置 */
  getSharedConfig(): SharedConfig {
    return { ...this._sharedConfig }
  }

  /** 更新配置并同步到服务器 */
  updateConfig(config: Partial<SharedConfig>): void {
    this._sharedConfig = { ...this._sharedConfig, ...config }

    if (this._connected && this.socket) {
      this.socket.emit('config_update', {
        type: 'config_update',
        source: 'phone',
        config,
        timestamp: Date.now(),
      })
      console.log('[BridgeAdapter] 已发送配置更新:', config)
    }

    this.emit('bridge:config_updated', this._sharedConfig)
  }

  // ==================== Socket 事件处理 ====================

  private setupSocketHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this._connected = true
      this._lastPongTime = Date.now()
      console.log('[BridgeAdapter] 已连接到 Bridge Server')
      this.emit('bridge:connected')
      this.startHeartbeatCheck()
    })

    this.socket.on('disconnect', (reason) => {
      this._connected = false
      this.stopHeartbeatCheck()
      console.log('[BridgeAdapter] 已断开连接:', reason)
      this.emit('bridge:disconnected', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('[BridgeAdapter] 连接错误:', error.message)
      this.emit('bridge:error', error)
    })

    // 单一平台模式：接收平台列表（0或1个）
    this.socket.on('connected_platforms', (platforms: PlatformInfo[]) => {
      console.log('[BridgeAdapter] 已连接平台:', platforms)

      if (platforms.length > 0) {
        this._platform = platforms[0]
        this._currentSessionId = platforms[0].chatId // chatId 实际上是 sessionId (UUID)
        this._characterName = platforms[0].characterName || 'Character'
        this._playerName = platforms[0].playerName || 'Player'
      } else {
        this._platform = null
      }

      this.emit('bridge:platforms', platforms)
      this.emit('bridge:platform_changed', this._platform)
    })

    this.socket.on('platform_connected', (info: { platform: string; chatId: string }) => {
      console.log('[BridgeAdapter] 平台已连接:', info)
      // chatId 实际上是 sessionId (UUID)
      this._platform = {
        id: `${info.platform}:${info.chatId}`,
        platform: info.platform,
        chatId: info.chatId,
        characterName: '',
        playerName: '',
      }
      this._currentSessionId = info.chatId
      this.emit('bridge:platform_connected', info)
      this.emit('bridge:platform_changed', this._platform)
    })

    this.socket.on(
      'platform_disconnected',
      (info: { platform: string; chatId: string; reason?: string }) => {
        console.log('[BridgeAdapter] 平台断开:', info)
        this._platform = null
        this.emit('bridge:platform_disconnected', info)
        this.emit('bridge:platform_changed', null)
      }
    )

    // 同步处理
    this.socket.on('sync', (data: SyncMessage) => {
      this.handleSync(data)
    })

    // 配置同步
    this.socket.on('config_sync', (data: ConfigUpdateMessage) => {
      console.log('[BridgeAdapter] 收到配置同步:', data)
      if (data.config) {
        this._sharedConfig = { ...this._sharedConfig, ...data.config }
        this.emit('bridge:config_updated', this._sharedConfig)
      }
    })

    // 同步错误
    this.socket.on('sync_error', (error: { error: string }) => {
      console.error('[BridgeAdapter] 同步错误:', error)
      this.emit('bridge:sync_error', error)
    })

    // 心跳处理
    this.socket.on('ping', (data: { timestamp: number }) => {
      this._lastPingTime = data.timestamp
      this.socket?.emit('pong', { timestamp: Date.now() })
      this._lastPongTime = Date.now()
      this._latency = this._lastPongTime - data.timestamp
      this.emit('bridge:heartbeat', {
        pingTime: this._lastPingTime,
        pongTime: this._lastPongTime,
        latency: this._latency,
      })
    })

    // Swipe 切换处理（直接从服务器推送）
    this.socket.on('swipe_changed', (data: SwipeChangedEvent) => {
      console.log('[BridgeAdapter] 收到 Swipe 切换:', data)
      this.emit('swipe_changed', data)
      this.emit('bridge:swipe_changed', data)
    })
  }

  private handleSync(data: SyncMessage): void {
    console.log('[BridgeAdapter] 收到同步:', data.type, 'sessionId:', data.chatId)

    // 更新上下文信息
    this._characterName = data.characterName || this._characterName
    this._playerName = data.playerName || this._playerName
    this._currentSessionId = data.chatId // chatId 实际上是 sessionId
    this._lastSyncTime = Date.now()

    // 更新平台信息
    if (this._platform) {
      this._platform.characterName = data.characterName
      this._platform.playerName = data.playerName
      this._platform.chatId = data.chatId
      this._platform.id = `${data.platform}:${data.chatId}`
    }

    switch (data.type) {
      case 'full_sync':
        this.handleFullSync(data.payload)
        break
      case 'message_received':
        // 尝试从新消息中同步时间（如果启用了模拟时间模式）
        if (data.payload.messages && data.payload.messages.length > 0) {
          const lastMsg = data.payload.messages[data.payload.messages.length - 1]
          if (lastMsg.message) {
            timeService.syncFromContent(lastMsg.message)
          }
        }
        this.emit('message_received', data.payload)
        break
      case 'message_edited':
        this.emit('message_edited', data.payload)
        break
      case 'message_deleted':
        // 楼层删除事件，可能需要用户确认
        this.emit('message_deleted', {
          ...data.payload,
          requireConfirmation: data.payload.requireConfirmation ?? false,
        } as MessageDeletedEvent)
        break
      case 'message_swiped':
        // Swipe 切换（通过 sync 通道）
        this.emit('swipe_changed', data.payload)
        break
      case 'chat_changed':
        // 聊天切换是状态管理的关键事件
        console.log('[BridgeAdapter] 聊天已切换:', data.chatId)
        this.emit('chat_changed', data.chatId)
        break
    }

    this.emit('bridge:sync', data)
  }

  private handleFullSync(payload: SyncPayload): void {
    // 更新消息历史（带 chatId 标识）
    if (payload.messages) {
      this._chatHistory = payload.messages as SyncedMessage[]
      console.log(`[BridgeAdapter] 收到 ${this._chatHistory.length} 条消息`)
    }

    this.emit('bridge:full_sync', payload)
  }

  // ==================== 消息追踪工具 ====================

  /**
   * 根据 sessionId 和 message_id 查找消息
   * 这是状态管理的核心方法
   */
  findMessage(sessionId: string, messageId: number): SyncedMessage | undefined {
    return this._chatHistory.find(
      (msg) => msg.sessionId === sessionId && msg.message_id === messageId
    )
  }

  /**
   * 获取指定 sessionId 的所有消息
   */
  getMessagesBySessionId(sessionId: string): SyncedMessage[] {
    return this._chatHistory.filter((msg) => msg.sessionId === sessionId)
  }

  /**
   * 检查消息是否属于当前会话
   */
  isCurrentSession(sessionId: string): boolean {
    return this._currentSessionId === sessionId
  }

  // ==================== 心跳检测 ====================

  private startHeartbeatCheck(): void {
    this.stopHeartbeatCheck()
    this._heartbeatCheckTimer = setInterval(() => {
      this.checkHeartbeatTimeout()
    }, 30000)
  }

  private stopHeartbeatCheck(): void {
    if (this._heartbeatCheckTimer) {
      clearInterval(this._heartbeatCheckTimer)
      this._heartbeatCheckTimer = null
    }
  }

  private checkHeartbeatTimeout(): void {
    if (!this._lastPongTime) return

    const now = Date.now()
    const elapsed = now - this._lastPongTime

    if (elapsed > this.options.heartbeatTimeout) {
      console.warn(`[BridgeAdapter] 心跳超时 (${elapsed}ms)，尝试重连...`)
      this.emit('bridge:heartbeat_timeout', { elapsed, timeout: this.options.heartbeatTimeout })
      this.socket?.disconnect()
    }
  }

  // ==================== 配置持久化 ====================

  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('phone_bridge_config')
      if (saved) {
        const config = JSON.parse(saved)
        if (config.serverUrl) {
          this.options.serverUrl = config.serverUrl
        }
        if (config.apiKey) {
          this.options.apiKey = config.apiKey
        }
        if (config.sharedConfig) {
          this._sharedConfig = { ...DEFAULT_CONFIG, ...config.sharedConfig }
        }
      }
    } catch (e) {
      console.warn('[BridgeAdapter] 加载配置失败:', e)
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(
        'phone_bridge_config',
        JSON.stringify({
          serverUrl: this.options.serverUrl,
          apiKey: this.options.apiKey,
          sharedConfig: this._sharedConfig,
        })
      )
    } catch (e) {
      console.warn('[BridgeAdapter] 保存配置失败:', e)
    }
  }

  /** 设置 API Key */
  setApiKey(apiKey: string): void {
    this.options.apiKey = apiKey
    this.saveConfig()
  }

  /** 获取当前 API Key */
  getApiKey(): string {
    return this.options.apiKey
  }

  // ==================== HostAdapter 接口实现 ====================

  getVariables(_option: VariableOption): Record<string, unknown> {
    return {}
  }

  replaceVariables(_variables: Record<string, unknown>, _option: VariableOption): void {}

  insertOrAssignVariables(
    variables: Record<string, unknown>,
    _option: VariableOption
  ): Record<string, unknown> {
    return variables
  }

  deleteVariable(
    _path: string,
    _option: VariableOption
  ): { variables: Record<string, unknown>; deleteOccurred: boolean } {
    return { variables: {}, deleteOccurred: false }
  }

  getChatData(): PhoneChatData | null {
    return this._chatData
  }

  saveChatData(data: PhoneChatData): void {
    this._chatData = data
  }

  getGlobalConfig(): PhoneGlobalConfig | null {
    return this._globalConfig
  }

  saveGlobalConfig(config: PhoneGlobalConfig): void {
    this._globalConfig = config
    try {
      localStorage.setItem('phone_global_config', JSON.stringify(config))
    } catch (e) {
      console.warn('[BridgeAdapter] 保存全局配置失败:', e)
    }
  }

  async generate(_prompt: string, _options?: GenerateOptions): Promise<string> {
    console.warn('[BridgeAdapter] AI 生成需要通过平台进行')
    return '[桥接模式: 请使用平台的 AI 生成功能]'
  }

  async *generateStream(_prompt: string, _options?: GenerateOptions): AsyncIterable<string> {
    yield await this.generate(_prompt, _options)
  }

  stopGeneration(): void {}

  getChatHistory(_range?: number | string): ChatMessage[] {
    // 将 SyncedMessage 转换为内部的 ChatMessage 格式
    return this._chatHistory.map((msg) => ({
      messageId: msg.message_id,
      role: msg.role,
      content: msg.message,
      name: msg.name,
      isHidden: msg.is_hidden,
    }))
  }

  async sendUserMessage(content: string): Promise<void> {
    if (this._connected && this.socket) {
      this.socket.emit('platform_command', {
        command: {
          type: 'send_message',
          content,
        },
      })
    }
  }

  onMessageReceived(callback: (msgId: number, content: string) => void): UnsubscribeFn {
    return this.on('message_received', callback as (...args: unknown[]) => void)
  }

  onMessageEdited(callback: (msgId: number, content: string) => void): UnsubscribeFn {
    return this.on('message_edited', callback as (...args: unknown[]) => void)
  }

  onMessageDeleted(callback: (msgId: number) => void): UnsubscribeFn {
    return this.on('message_deleted', callback as (...args: unknown[]) => void)
  }

  onChatChanged(callback: (chatFileName: string) => void): UnsubscribeFn {
    return this.on('chat_changed', callback as (...args: unknown[]) => void)
  }

  /** 监听 Swipe 切换事件 */
  onSwipeChanged(callback: (event: SwipeChangedEvent) => void): UnsubscribeFn {
    return this.on('swipe_changed', callback as (...args: unknown[]) => void)
  }

  /** 监听楼层删除事件（需要用户确认） */
  onMessageDeletedWithConfirm(callback: (event: MessageDeletedEvent) => void): UnsubscribeFn {
    return this.on('message_deleted', callback as (...args: unknown[]) => void)
  }

  on(event: string, handler: (...args: unknown[]) => void): UnsubscribeFn {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)

    return () => {
      this.eventHandlers.get(event)?.delete(handler)
    }
  }

  emit(event: string, ...args: unknown[]): void {
    this.eventHandlers.get(event)?.forEach((handler) => {
      try {
        handler(...args)
      } catch (e) {
        console.error(`[BridgeAdapter] 事件处理错误 (${event}):`, e)
      }
    })
  }

  getCharacterName(): string {
    return this._characterName
  }

  getPlayerName(): string {
    return this._playerName
  }

  isDevMode(): boolean {
    return true
  }

  getAdapterType(): 'sillytavern' | 'mock' {
    return 'mock'
  }
}

// ============ 工厂函数 ============

let bridgeAdapterInstance: BridgeAdapter | null = null

export function createBridgeAdapter(options?: BridgeAdapterOptions): BridgeAdapter {
  if (!bridgeAdapterInstance) {
    bridgeAdapterInstance = new BridgeAdapter(options)
  }
  return bridgeAdapterInstance
}

export function getBridgeAdapter(): BridgeAdapter | null {
  return bridgeAdapterInstance
}

export function resetBridgeAdapter(): void {
  if (bridgeAdapterInstance) {
    bridgeAdapterInstance.disconnect()
    bridgeAdapterInstance = null
  }
}
