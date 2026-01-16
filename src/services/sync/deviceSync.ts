/**
 * 设备同步管理器
 *
 * 负责设备心跳、多设备检测
 */

import type { DeviceStatus, HeartbeatResponse } from './types'

class DeviceSyncManager {
  private deviceId: string
  private deviceName: string
  private status: DeviceStatus | null = null
  private heartbeatTimer: number | null = null
  private listeners = new Set<(status: DeviceStatus | null) => void>()
  private serverUrl: string = ''
  private sessionId: string = ''

  constructor() {
    this.deviceId = this.getOrCreateDeviceId()
    this.deviceName = this.detectDeviceName()
  }

  /**
   * 配置服务器信息
   */
  configure(serverUrl: string, sessionId: string): void {
    this.serverUrl = serverUrl
    this.sessionId = sessionId
  }

  /**
   * 启动心跳
   */
  start(): void {
    if (this.heartbeatTimer) return

    this.sendHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat()
    }, 30_000) // 30 秒
  }

  /**
   * 停止心跳
   */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): DeviceStatus | null {
    return this.status
  }

  /**
   * 获取设备ID
   */
  getDeviceId(): string {
    return this.deviceId
  }

  /**
   * 获取设备名称
   */
  getDeviceName(): string {
    return this.deviceName
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (status: DeviceStatus | null) => void): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => this.listeners.delete(listener)
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.serverUrl || !this.sessionId) {
      console.warn('[DeviceSync] 未配置服务器信息')
      return
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/v2/devices/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          deviceId: this.deviceId,
          deviceName: this.deviceName,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: HeartbeatResponse = await response.json()

      this.status = {
        isOnlyDevice: data.activeDeviceCount === 1,
        canWrite: data.canWrite,
        otherDevices: data.otherDevices,
      }

      this.notifyListeners()

      // 检测到其他设备时记录日志
      if (!this.status.isOnlyDevice) {
        console.log(
          `[DeviceSync] 检测到其他设备: ${this.status.otherDevices
            .map((d) => `${d.name} (${d.lastActive})`)
            .join(', ')}`
        )
      }
    } catch (e) {
      console.error('[DeviceSync] 心跳失败:', e)
      // 心跳失败时保持之前的状态
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l(this.status))
  }

  private getOrCreateDeviceId(): string {
    let id = localStorage.getItem('device_id')
    if (!id) {
      id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem('device_id', id)
    }
    return id
  }

  private detectDeviceName(): string {
    const ua = navigator.userAgent
    if (/iPhone/.test(ua)) return 'iPhone'
    if (/iPad/.test(ua)) return 'iPad'
    if (/Android/.test(ua)) return 'Android'
    if (/Windows/.test(ua)) return 'Windows PC'
    if (/Mac/.test(ua)) return 'Mac'
    if (/Linux/.test(ua)) return 'Linux'
    return 'Unknown Device'
  }
}

export const deviceSyncManager = new DeviceSyncManager()
