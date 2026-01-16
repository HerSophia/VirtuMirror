import express from 'express'
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import cors from 'cors'
import { AuthManager } from './src/auth'
import { StorageManagerV2 as StorageManager } from './src/storage/storageV2'
import { deviceManager } from './src/services'
import type {
  PlatformClient,
  PhoneClient,
  SyncMessage,
  ConfigUpdateMessage,
  SharedConfig,
  ServerConfig,
  HealthResponse,
  StatusResponse,
  SessionDataResponse,
  GenerationStatusMessage,
  PongMessage,
  SwipeChangedMessage,
} from './src/types'

// ============ Bridge Server ============

class BridgeServer {
  private app = express()
  private httpServer = createServer(this.app)
  private io: Server

  // 改为单一平台连接
  private platform: PlatformClient | null = null
  private phones = new Map<string, PhoneClient>()
  private heartbeatTimer: NodeJS.Timeout | null = null
  private startTime = Date.now()

  // 鉴权和存储
  private auth: AuthManager
  private storage: StorageManager

  // 共享配置（双向同步）
  private sharedConfig: SharedConfig = {
    floorRange: 10,
    autoSync: true,
    syncInterval: 5000,
  }

  constructor(private config: ServerConfig) {
    // 初始化鉴权
    this.auth = new AuthManager()

    // 初始化存储（V2 分表存储）
    this.storage = new StorageManager()

    this.io = new Server(this.httpServer, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST'],
      },
      // 增加最大消息大小（默认 1MB，增加到 10MB）
      maxHttpBufferSize: 10 * 1024 * 1024,
      // 增加 ping 超时
      pingTimeout: 60000,
      pingInterval: 25000,
    })

    this.setupMiddleware()
    this.setupRoutes()
    this.setupSocketHandlers()
    this.startHeartbeat()
  }

  private setupMiddleware() {
    this.app.use(cors({ origin: this.config.corsOrigins }))
    this.app.use(express.json())

    // API 鉴权中间件
    this.app.use('/api', (req, res, next) => {
      const apiKey = req.headers['x-api-key'] as string | undefined
      const result = this.auth.validate(apiKey)

      if (!result.success) {
        res.status(401).json({
          error: result.error,
          message: 'Authentication required. Provide API key in X-API-Key header.',
        })
        return
      }

      next()
    })
  }

  private setupRoutes() {
    // 健康检查（公开）
    this.app.get('/health', (_req, res) => {
      const response: HealthResponse = {
        status: 'ok',
        platform: this.platform
          ? {
              id: `${this.platform.platform}:${this.platform.sessionId}`,
              connected: true,
            }
          : null,
        phones: this.phones.size,
        uptime: process.uptime(),
        heartbeat: {
          interval: this.config.heartbeatInterval,
          timeout: this.config.heartbeatTimeout,
        },
        config: this.sharedConfig,
        auth: {
          enabled: this.auth.isEnabled(),
        },
        storage: {
          sessions: this.storage.getStats().sessions,
          persistent: this.storage.getStats().persistent,
        },
      }
      res.json(response)
    })

    // 状态页面 JSON（公开）
    this.app.get('/status', (_req, res) => {
      const now = Date.now()
      const stats = this.storage.getStats()

      const response: StatusResponse = {
        server: {
          uptime: process.uptime(),
          startTime: this.startTime,
          heartbeatInterval: this.config.heartbeatInterval,
          heartbeatTimeout: this.config.heartbeatTimeout,
        },
        auth: {
          enabled: this.auth.isEnabled(),
          keyHint: this.auth.isEnabled() ? this.auth.getMaskedKey() : undefined,
        },
        platform: this.platform
          ? {
              id: `${this.platform.platform}:${this.platform.sessionId}`,
              platform: this.platform.platform,
              sessionId: this.platform.sessionId,
              characterName: this.platform.characterName,
              playerName: this.platform.playerName,
              connectedAt: this.platform.connectedAt,
              lastPong: this.platform.lastPong,
              alive: now - this.platform.lastPong < this.config.heartbeatTimeout,
              isGenerating: this.platform.isGenerating,
              generationDuration: this.platform.isGenerating && this.platform.generationStartTime
                ? now - this.platform.generationStartTime
                : null,
            }
          : null,
        phones: Array.from(this.phones.entries()).map(([id, client]) => ({
          id,
          connectedAt: client.connectedAt,
          lastPong: client.lastPong,
          alive: now - client.lastPong < this.config.heartbeatTimeout,
        })),
        sharedConfig: this.sharedConfig,
        storage: stats,
      }
      res.json(response)
    })

    // ==================== API 路由（需要鉴权） ====================

    // ==================== Device API (V2 多设备同步) ====================

    // 设备心跳
    this.app.post('/api/v2/devices/heartbeat', (req, res) => {
      const { sessionId, deviceId, deviceName } = req.body
      
      if (!sessionId || !deviceId) {
        res.status(400).json({ success: false, error: 'missing_params' })
        return
      }
      
      const result = deviceManager.heartbeat(
        sessionId,
        deviceId,
        deviceName || 'Unknown Device'
      )
      
      res.json(result)
    })

    // ==================== Storage / Backup API ====================

    // 获取指定会话的备份数据
    this.app.get('/api/v1/storage/:sessionId', async (req, res) => {
      const { sessionId } = req.params
      const backup = await this.storage.getBackup(sessionId)
      
      if (!backup) {
        res.status(404).json({ success: false, error: 'backup_not_found' })
        return
      }
      
      res.json(backup)
    })

    // 上传/覆盖备份数据
    this.app.post('/api/v1/storage/:sessionId', async (req, res) => {
      const { sessionId } = req.params
      const { data } = req.body
      
      if (!data) {
        res.status(400).json({ success: false, error: 'missing_data' })
        return
      }
      
      try {
        const result = await this.storage.saveBackup(sessionId, data)
        res.json(result)
      } catch (error) {
        console.error('Backup failed:', error)
        res.status(500).json({ success: false, error: 'save_failed' })
      }
    })

    // 检查云端版本
    this.app.get('/api/v1/storage/:sessionId/meta', async (req, res) => {
      const { sessionId } = req.params
      const meta = await this.storage.getBackupMeta(sessionId)
      
      if (!meta) {
        res.status(404).json({ success: false, error: 'backup_not_found' })
        return
      }
      
      res.json(meta)
    })

    // 获取会话列表
    this.app.get('/api/sessions', (_req, res) => {
      const sessions = this.storage.getAllSessions()
      res.json({ success: true, sessions })
    })

    // 获取会话数据
    this.app.get('/api/sessions/:sessionId', (req, res) => {
      const { sessionId } = req.params
      const session = this.storage.getSession(sessionId)
      const syncData = this.storage.getCachedSyncData(sessionId)

      if (!session) {
        res.status(404).json({ success: false, error: 'session_not_found' })
        return
      }

      const response: SessionDataResponse = {
        success: true,
        session: {
          id: session.id,
          platform: session.platform,
          characterName: session.characterName,
          playerName: session.playerName,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
  },
        syncData: syncData
          ? {
              messages: syncData.messages,
              messageRange: syncData.messageRange,
              contacts: syncData.contacts,
              moments: syncData.moments,
              emails: syncData.emails,
              syncedAt: syncData.syncedAt,
            }
          : undefined,
      }
      res.json(response)
    })

    // 删除会话
    this.app.delete('/api/sessions/:sessionId', (req, res) => {
      const { sessionId } = req.params
      const deleted = this.storage.deleteSession(sessionId)
      res.json({ success: deleted })
    })

    // 获取会话消息
    this.app.get('/api/sessions/:sessionId/messages', (req, res) => {
      const { sessionId } = req.params
      const messages = this.storage.getCachedMessages(sessionId)
      res.json({ success: true, messages })
    })

    // 获取 API Key（用于配置分享）
    this.app.get('/api/auth/key', (_req, res) => {
      res.json({
        success: true,
        key: this.auth.getFullKey(),
        hint: this.auth.getMaskedKey(),
      })
    })

    // 重新生成 API Key
    this.app.post('/api/auth/regenerate', (_req, res) => {
      const newKey = this.auth.regenerateKey()
      res.json({
        success: true,
        key: newKey,
        hint: this.auth.getMaskedKey(),
      })
    })

    // 获取存储统计
    this.app.get('/api/storage/stats', (_req, res) => {
      res.json({ success: true, stats: this.storage.getStats() })
    })

    // 清空存储
    this.app.post('/api/storage/clear', (_req, res) => {
      this.storage.clear()
      res.json({ success: true })
    })

    // 简单的状态页面 HTML
    this.app.get('/', (_req, res) => {
      const generatingStatus = this.platform?.isGenerating
        ? `<span style="color: #856404; background: #fff3cd; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">⏳ 生成中 (${this.platform.generationStartTime ? Math.round((Date.now() - this.platform.generationStartTime) / 1000) : 0}s)</span>`
        : ''
      
      const platformInfo = this.platform
        ? `<li class="connected">🎮 ${this.platform.platform}:${this.platform.sessionId.substring(0, 8)}... - ${this.platform.characterName} (${this.platform.playerName}) - 连接于 ${new Date(this.platform.connectedAt).toLocaleTimeString()}${generatingStatus}</li>`
        : '<li class="empty">暂无平台连接</li>'

      const phoneList = Array.from(this.phones.entries())
        .map(
          ([id, c]) =>
            `<li>📱 ${id.substring(0, 12)}... - 连接于 ${new Date(c.connectedAt).toLocaleTimeString()}</li>`
        )
        .join('')

      const stats = this.storage.getStats()

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Phone Bridge Server</title>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .status { padding: 10px 20px; border-radius: 8px; margin: 10px 0; }
            .ok { background: #d4edda; color: #155724; }
            .single-mode { background: #fff3cd; color: #856404; font-size: 12px; margin-top: 5px; }
            .auth-status { background: ${this.auth.isEnabled() ? '#d4edda' : '#f8d7da'}; color: ${this.auth.isEnabled() ? '#155724' : '#721c24'}; font-size: 12px; margin-top: 5px; }
            ul { list-style: none; padding: 0; }
            li { padding: 8px 12px; background: #f8f9fa; margin: 4px 0; border-radius: 4px; }
            li.connected { background: #d4edda; }
            li.empty { color: #6c757d; font-style: italic; }
            .config { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .config h3 { margin-top: 0; }
            .config-item { display: flex; justify-content: space-between; padding: 5px 0; }
            .api-key { font-family: monospace; background: #fff; padding: 2px 6px; border-radius: 4px; }
          </style>
          <script>
            setTimeout(() => location.reload(), 5000);
          </script>
        </head>
        <body>
          <h1>📡 Phone Bridge Server</h1>
          <div class="status ok">✅ 服务运行中 - 运行时间: ${Math.floor(process.uptime())}n          <div class="status single-mode">⚠️ 单平台模式：同一时间只允许一个平台连接</div>
          <div class="status auth-status">🔐 鉴权: ${this.auth.isEnabled() ? '已启用' : '已禁用'} ${this.auth.isEnabled() ? `- Key: <span class="api-key">${this.auth.getMaskedKey()}</span>` : ''}</div>
          
          <h2>已连接的平台</h2>
          <ul>${platformInfo}</ul>
          
          <h2>已连接的手机 (${this.phones.size})</h2>
          <ul>${phoneList || '<li class="empty">暂无手机连接</li>'}</ul>
          
          <div class="config">
            <h3>📋 共享配置（双向同步）</h3>
            ${Object.entries(this.sharedConfig)
              .map(
                ([k, v]) =>
                  `<div class="config-item"><span>${k}:</span><span>${JSON.stringify(v)}</span></div>`
              )
              .join('')}
          </div>
          
          <div class="config">
            <h3>💾 存储状态</h3>
            <div class="config-item"><span>会话数:</span><span>${stats.sessions}</span></div>
            <div class="config-item"><span>缓存消息:</span><span>${stats.totalMessages}</span></div>
            <div class="config-item"><span>持久化:</span><span>${stats.persistent ? '已启用' : '已禁用'}</span></div>
          </div>
          
          <p style="color: #6c757d; font-size: 12px;">页面每5秒自动刷新</p>
        </body>
        </html>
      `)
    })
  }

  private setupSocketHandlers() {
    // Socket.IO 鉴权中间件
    this.io.use((socket, next) => {
      const result = this.auth.validateSocket(socket.handshake)

      if (!result.success) {
        console.log(`[Bridge] Socket 鉴权失败: ${result.error}`)
        next(new Error(result.error || 'Authentication failed'))
        return
      }

      next()
    })

    this.io.on('connection', (socket) => {
      const clientType = socket.handshake.query.type as string
      const platform = socket.handshake.query.platform as string
      const sessionId = socket.handshake.query.chatId as string // chatId 实际上是 sessionId

      console.log(`[Bridge] 新连接: ${clientType} (${socket.id})`)

      if (clientType === 'platform') {
        this.handlePlatformConnection(socket, platform, sessionId)
      } else if (clientType === 'phone') {
        this.handlePhoneConnection(socket)
      } else {
        console.log(`[Bridge] 未知客户端类型: ${clientType}`)
        socket.disconnect()
      }
    })
  }

  private handlePlatformConnection(socket: Socket, platform: string, sessionId: string) {
    const clientId = `${platform}:${sessionId}`
    const socketId = socket.id
    
    console.log(`[Bridge][连接调试] 新平台连接请求: clientId=${clientId}, socketId=${socketId}, time=${new Date().toISOString()}`)

    // 单平台模式：如果已有平台连接，先断开
    if (this.platform) {
      const oldId = `${this.platform.platform}:${this.platform.sessionId}`
      const oldSocketId = this.platform.socket.id
      console.log(`[Bridge][连接调试] 已有平台连接 ${oldId} (socketId=${oldSocketId})，正在断开以接受新连接 ${clientId} (socketId=${socketId})`)

      // 通知旧平台被替换
      this.platform.socket.emit('replaced', {
        reason: 'new_platform_connected',
        newPlatform: platform,
        newSessionId: sessionId,
      })
      this.platform.socket.disconnect(true)
      console.log(`[Bridge][连接调试] 已断开旧连接 ${oldSocketId}`)

      // 通知手机端旧平台断开
      this.io.to('phones').emit('platform_disconnected', {
        platform: this.platform.platform,
        chatId: this.platform.sessionId,
        reason: 'replaced',
      })
    }

    const now = Date.now()
    this.platform = {
      socket,
      platform,
      sessionId,
      characterName: '',
      playerName: '',
      connectedAt: now,
      lastPong: now,
      isGenerating: false,
      generationStartTime: null,
    }

    console.log(`[Bridge] 平台已连接: ${clientId}`)

    // 通知所有手机客户端
    this.io.to('phones').emit('platform_connected', { platform, chatId: sessionId })

    // 发送当前共享配置给新连接的平台
    socket.emit('config_sync', {
      type: 'config_update',
      source: 'server',
      config: this.sharedConfig,
      timestamp: now,
    })

    // 心跳响应（包含生成状态）
    socket.on('pong', (data: PongMessage) => {
      if (this.platform && this.platform.socket === socket) {
        this.platform.lastPong = Date.now()
        
        // 更新生成状态（如果心跳中包含）
        if (typeof data?.isGenerating === 'boolean') {
          this.platform.isGenerating = data.isGenerating
          if (data.isGenerating && data.generationDuration) {
            // 推算生成开始时间
            this.platform.generationStartTime = Date.now() - data.generationDuration
          } else if (!data.isGenerating) {
            this.platform.generationStartTime = null
          }
        }
      }
    })

    // 接收平台发来的同步消息
    socket.on('sync', (data: SyncMessage) => {
      console.log(`[Bridge] 收到同步: ${data.type} from ${clientId}`)

      // 更新平台信息
      if (this.platform && this.platform.socket === socket) {
        this.platform.characterName = data.characterName
        this.platform.playerName = data.playerName
        // 如果 sessionId 变化（切换聊天），更新
        if (data.chatId !== this.platform.sessionId) {
          console.log(`[Bridge] 平台切换聊天: ${this.platform.sessionId} -> ${data.chatId}`)
          this.platform.sessionId = data.chatId
        }
      }

      // 缓存同步数据
      if (data.type === 'full_sync' && data.payload) {
        this.storage.cacheSyncData({
          sessionId: data.chatId,
          platform: data.platform,
          characterName: data.characterName,
          playerName: data.playerName,
          messages: data.payload.messages as any,
          messageRange: data.payload.messageRange,
          contacts: data.payload.contacts,
          moments: data.payload.moments,
          emails: data.payload.emails,
        })
      }

      // 转发给所有手机客户端
      this.io.to('phones').emit('sync', data)
    })

    // 接收平台的配置更新
    socket.on('config_update', (data: ConfigUpdateMessage) => {
      console.log(`[Bridge] 收到配置更新 from platform:`, data.config)
      this.handleConfigUpdate(data, 'platform')
    })

    // 接收生成状态更新
    socket.on('generation_status', (data: GenerationStatusMessage) => {
      console.log(`[Bridge] 收到生成状态: ${data.status} from ${clientId}`)
      
      if (this.platform && this.platform.socket === socket) {
        switch (data.status) {
          case 'started':
            this.platform.isGenerating = true
            this.platform.generationStartTime = data.timestamp || Date.now()
            break
          case 'ended':
          case 'stopped':
            this.platform.isGenerating = false
            this.platform.generationStartTime = null
            break
        }
      }
      
      // 转发给所有手机客户端
      this.io.to('phones').emit('generation_status', data)
    })

    // 接收 Swipe 切换事件
    socket.on('swipe_changed', (data: SwipeChangedMessage) => {
      console.log(`[Bridge] 收到 Swipe 切换: 楼层 ${data.messageId}, swipe ${data.newSwipeId} from ${clientId}`)
      
      // 转发给所有手机客户端
      this.io.to('phones').emit('swipe_changed', data)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[Bridge][连接调试] 平台断开: clientId=${clientId}, socketId=${socket.id}, reason=${reason}, time=${new Date().toISOString()}`)
      if (this.platform && this.platform.socket === socket) {
        console.log(`[Bridge][连接调试] 清除平台记录，通知手机端`)
        this.platform = null
        this.io.to('phones').emit('platform_disconnected', { platform, chatId: sessionId, reason })
      } else {
        console.log(`[Bridge][连接调试] 平台记录不匹配或已清除，跳过通知`)
      }
    })
  }

  private handlePhoneConnection(socket: Socket) {
    const phoneId = socket.id

    const now = Date.now()
    this.phones.set(phoneId, {
      socket,
      connectedAt: now,
      lastPong: now,
    })

    // 加入手机房间
    socket.join('phones')

    console.log(`[Bridge] 手机已连接: ${phoneId}`)

    // 心跳响应
    socket.on('pong', () => {
      const client = this.phones.get(phoneId)
      if (client) {
        client.lastPong = Date.now()
      }
    })

    // 发送当前已连接的平台（单一或无）
    if (this.platform) {
      socket.emit('connected_platforms', [
        {
          id: `${this.platform.platform}:${this.platform.sessionId}`,
          platform: this.platform.platform,
          chatId: this.platform.sessionId,
          characterName: this.platform.characterName,
          playerName: this.platform.playerName,
        },
      ])
    } else {
      socket.emit('connected_platforms', [])
    }

    // 发送当前共享配置
    socket.emit('config_sync', {
      type: 'config_update',
      source: 'server',
      config: this.sharedConfig,
      timestamp: now,
    })

    // 手机请求同步
    socket.on(
      'request_sync',
      (data: { platform?: string; chatId?: string; floorRange?: number }) => {
        if (this.platform) {
          console.log(`[Bridge] 转发同步请求到平台`)
          this.platform.socket.emit('request_sync', { floorRange: data.floorRange })
        } else {
          console.log(`[Bridge] 没有平台连接，无法同步`)
          socket.emit('sync_error', { error: 'no_platform_connected' })
        }
      }
    )

    // 手机请求缓存的会话数据
    socket.on('request_cached_data', (data: { sessionId: string }) => {
      const cachedData = this.storage.getCachedSyncData(data.sessionId)
      if (cachedData) {
        console.log(`[Bridge] 发送缓存数据: ${data.sessionId}`)
        socket.emit('cached_data', {
          sessionId: data.sessionId,
          data: cachedData,
        })
      } else {
        socket.emit('cached_data', {
          sessionId: data.sessionId,
          data: null,
          error: 'no_cached_data',
        })
      }
    })

    // 手机发送命令给平台（双向通信）
    socket.on('platform_command', (data: { command: unknown }) => {
      if (this.platform) {
        console.log(`[Bridge] 转发命令到平台`)
        this.platform.socket.emit('command', data.command)
      }
    })

    // 接收手机的配置更新
    socket.on('config_update', (data: ConfigUpdateMessage) => {
      console.log(`[Bridge] 收到配置更新 from phone:`, data.config)
      this.handleConfigUpdate(data, 'phone')
    })

    socket.on('disconnect', () => {
      console.log(`[Bridge] 手机断开: ${phoneId}`)
      this.phones.delete(phoneId)
    })
  }

  // ============ 配置双向同步 ============

  private handleConfigUpdate(data: ConfigUpdateMessage, source: 'platform' | 'phone') {
    // 合并配置
    this.sharedConfig = { ...this.sharedConfig, ...data.config }

    const updateMessage: ConfigUpdateMessage = {
      type: 'config_update',
      source,
      config: this.sharedConfig,
      timestamp: Date.now(),
    }

    // 广播给所有客户端（除了发送者）
    if (source === 'platform' && this.platform) {
      // 通知所有手机
      this.io.to('phones').emit('config_sync', updateMessage)
    } else if (source === 'phone') {
      // 通知平台（如果有）
      if (this.platform) {
        this.platform.socket.emit('config_sync', updateMessage)
      }
      // 通知其他手机
      this.phones.forEach((client) => {
        client.socket.emit('config_sync', updateMessage)
      })
    }

    console.log(`[Bridge] 配置已同步:`, this.sharedConfig)
  }

  // ============ 心跳机制 ============

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
      this.checkTimeouts()
    }, this.config.heartbeatInterval)

    console.log(
      `[Bridge] 心跳已启动 (间隔: ${this.config.heartbeatInterval}ms, 超时: ${this.config.heartbeatTimeout}ms)`
    )
  }

  private sendHeartbeat() {
    const timestamp = Date.now()

    // 向平台发送心跳
    if (this.platform) {
      this.platform.socket.emit('ping', { timestamp })
    }

    // 向所有手机发送心跳
    this.phones.forEach((client) => {
      client.socket.emit('ping', { timestamp })
    })
  }

  private checkTimeouts() {
    const now = Date.now()
    const timeout = this.config.heartbeatTimeout

    // 检查平台超时
    if (this.platform && now - this.platform.lastPong > timeout) {
      const id = `${this.platform.platform}:${this.platform.sessionId}`
      console.log(`[Bridge] 平台心跳超时，断开连接: ${id}`)
      this.platform.socket.disconnect(true)
      const oldPlatform = this.platform
      this.platform = null
      this.io.to('phones').emit('platform_disconnected', {
        platform: oldPlatform.platform,
        chatId: oldPlatform.sessionId,
        reason: 'heartbeat_timeout',
      })
    }

    // 检查手机超时
    this.phones.forEach((client, id) => {
      if (now - client.lastPong > timeout) {
        console.log(`[Bridge] 手机心跳超时，断开连接: ${id}`)
        client.socket.disconnect(true)
        this.phones.delete(id)
      }
    })
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  start() {
    this.httpServer.listen(this.config.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║           📡 Phone Bridge Server 已启动                   ║
╠═══════════════════════════════════════════════════════════╣
║  地址: http://localhost:${this.config.port.toString().padEnd(37)}║
║  状态: http://localhost:${this.config.port}/status${' '.repeat(28)}║
║  模式: 单平台连接（同时只允许一个平台）                   ║
║  鉴权: ${this.auth.isEnabled() ? '已启用' : '已禁用'}${' '.repeat(this.auth.isEnabled() ? 47 : 47)}║
╚═══════════════════════════════════════════════════════════╝
      `)

      if (this.auth.isEnabled()) {
        console.log(`[Auth] API Key: ${this.auth.getMaskedKey()}`)
        console.log(`[Auth] 完整 Key 请查看: ./data/api.key`)
      }
    })
  }

  stop() {
    this.stopHeartbeat()
    this.storage.stopCleanup()
    this.httpServer.close()
  }
}

// ============ 启动 ============

const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3001'),
  corsOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:8000',
    '*',
  ],
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
  heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '90000'),
}

const server = new BridgeServer(config)
server.start()

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[Bridge] 正在关闭服务器...')
  server.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n[Bridge] 正在关闭服务器...')
  server.stop()
  process.exit(0)
})
