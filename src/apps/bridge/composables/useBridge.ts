/**
 * Bridge 连接管理 Composable
 * 提供响应式的 Bridge 连接状态和操作方法
 */
import {
  BridgeAdapter,
  createBridgeAdapter,
  getBridgeAdapter,
  type BridgeStatus,
  type PlatformInfo,
  type SharedConfig,
} from '@/adapters/bridgeAdapter'
import { narrativeService } from '@/services/narrative/narrativeService'
import { notificationService } from '@/services/notification/notificationService'
import { onMounted, readonly, ref } from 'vue'

// 默认配置
const DEFAULT_SHARED_CONFIG: SharedConfig = {
  floorRange: 10,
  autoSync: true,
  syncInterval: 5000,
}

// 全局响应式状态
const status = ref<BridgeStatus>({
  connected: false,
  serverUrl: 'http://localhost:3001',
  currentPlatform: null,
  currentSessionId: null,
  platform: null,
  lastSyncTime: null,
  lastPingTime: null,
  lastPongTime: null,
  latency: null,
  sharedConfig: DEFAULT_SHARED_CONFIG,
})

// 连接错误信息
const connectionError = ref<string | null>(null)

// 自动连接状态
const isAutoConnecting = ref(false)
const retryCount = ref(0)
const hasNotifiedFailure = ref(false)

const isInitialized = ref(false)
let adapter: BridgeAdapter | null = null
let unsubscribers: (() => void)[] = []

/**
 * 初始化 Bridge 适配器
 */
function initAdapter(): BridgeAdapter {
  if (adapter) return adapter

  adapter = getBridgeAdapter() || createBridgeAdapter()

  // 更新初始状态
  updateStatus()

  // 监听事件
  unsubscribers.push(
    adapter.on('bridge:connected', () => {
      connectionError.value = null
      // 重置自动连接状态
      isAutoConnecting.value = false
      retryCount.value = 0
      hasNotifiedFailure.value = false
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:disconnected', (reason: unknown) => {
      if (typeof reason === 'string') {
        connectionError.value = `连接断开: ${reason}`
      }
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:error', (error: unknown) => {
      connectionError.value = (error as Error).message || '连接失败'
      updateStatus()

      // 处理自动连接重试逻辑
      if (isAutoConnecting.value && !hasNotifiedFailure.value) {
        retryCount.value++
        console.warn(`[Bridge] 自动连接尝试失败 (${retryCount.value}/3)`)

        if (retryCount.value >= 3) {
          console.error('[Bridge] 自动连接失败次数过多，发送紧急通知')
          hasNotifiedFailure.value = true
          isAutoConnecting.value = false

          notificationService.push({
            appId: 'bridge',
            appName: '系统桥接',
            appIcon: {
              type: 'fontawesome',
              value: 'fas fa-link-slash',
              backgroundColor: '#EF4444',
            },
            title: '桥接连接失败',
            body: '无法连接到 Bridge Server，请检查服务器状态。',
            priority: 'urgent',
            category: 'system',
            actions: [
              {
                id: 'retry',
                label: '重试',
              },
            ],
          })
        }
      }
    })
  )

  unsubscribers.push(
    adapter.on('bridge:platforms', () => {
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:platform_connected', () => {
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:platform_disconnected', () => {
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:sync', () => {
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:platform_changed', () => {
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:config_updated', () => {
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:heartbeat', () => {
      updateStatus()
    })
  )

  unsubscribers.push(
    adapter.on('bridge:sync_error', (error: unknown) => {
      const err = error as { error: string }
      connectionError.value = `同步失败: ${err.error}`
    })
  )

  isInitialized.value = true

  // 初始化叙事服务（监听来自酒馆的聊天内容）
  narrativeService.setupBridgeListener()
  console.log('[Bridge] 叙事服务已初始化')

  return adapter
}

/**
 * 更新响应式状态
 */
function updateStatus(): void {
  if (!adapter) return
  const newStatus = adapter.getStatus()
  status.value = { ...newStatus }
}

/**
 * 连接到 Bridge Server
 */
function connect(serverUrl?: string): void {
  connectionError.value = null
  const a = initAdapter()
  a.connect(serverUrl)
}

/**
 * 断开连接
 */
function disconnect(): void {
  if (adapter) {
    adapter.disconnect()
    updateStatus()
  }
}

/**
 * 设置 API Key
 */
function setApiKey(apiKey: string): void {
  const a = initAdapter()
  a.setApiKey(apiKey)
}

/**
 * 获取 API Key
 */
function getApiKey(): string {
  const a = initAdapter()
  return a.getApiKey()
}

/**
 * 更新共享配置
 */
function updateConfig(config: Partial<SharedConfig>): void {
  if (adapter) {
    adapter.updateConfig(config)
    updateStatus()
  }
}

/**
 * 请求同步
 */
function requestSync(floorRange?: number): void {
  if (adapter) {
    adapter.requestSync(floorRange)
  }
}

/**
 * 获取适配器实例
 */
function getAdapter(): BridgeAdapter | null {
  return adapter
}

/**
 * 清除错误信息
 */
function clearError(): void {
  connectionError.value = null
}

/**
 * 启动自动连接
 */
function autoConnect(): void {
  if (status.value.connected) return

  // 初始化状态
  isAutoConnecting.value = true
  retryCount.value = 0
  hasNotifiedFailure.value = false

  // 开始连接
  connect()
}

/**
 * Bridge 管理 Composable
 */
export function useBridge() {
  onMounted(() => {
    if (!isInitialized.value) {
      initAdapter()
    }
  })

  return {
    // 状态（只读）
    status: readonly(status),
    connectionError: readonly(connectionError),
    isInitialized: readonly(isInitialized),

    // 连接管理
    connect,
    autoConnect,
    disconnect,

    // API Key 管理
    setApiKey,
    getApiKey,

    // 同步与配置
    requestSync,
    updateConfig,

    // 工具方法
    clearError,
    getAdapter,
  }
}

// 导出类型
export type { BridgeStatus, PlatformInfo, SharedConfig }
