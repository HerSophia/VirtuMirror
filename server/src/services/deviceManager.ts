/**
 * 设备管理器
 *
 * 管理多设备心跳、在线状态
 */

interface ActiveDevice {
  deviceId: string
  deviceName: string
  lastHeartbeat: number
  lastWriteAt: number
}

interface HeartbeatResponse {
  activeDeviceCount: number
  otherDevices: Array<{ name: string; lastActive: string }>
  canWrite: boolean
}

class DeviceManager {
  // sessionId -> devices
  private sessions = new Map<string, Map<string, ActiveDevice>>()

  /**
   * 设备心跳（客户端每 30 秒调用一次）
   */
  heartbeat(
    sessionId: string,
    deviceId: string,
    deviceName: string
  ): HeartbeatResponse {
    const devices = this.getOrCreateSession(sessionId)
    const now = Date.now()

    // 更新设备状态
    devices.set(deviceId, {
      deviceId,
      deviceName,
      lastHeartbeat: now,
      lastWriteAt: devices.get(deviceId)?.lastWriteAt ?? 0,
    })

    // 清理超时设备（2 分钟无心跳视为离线）
    this.cleanupStaleDevices(devices, now)

    // 统计活跃设备
    const allDevices = Array.from(devices.values())
    const otherDevices = allDevices.filter((d) => d.deviceId !== deviceId)

    return {
      activeDeviceCount: allDevices.length,
      otherDevices: otherDevices.map((d) => ({
        name: d.deviceName,
        lastActive: this.formatRelativeTime(now - d.lastHeartbeat),
      })),
      canWrite: true, // 数据级检测，始终允许尝试写入
    }
  }

  /**
   * 记录设备写入时间
   */
  recordWrite(sessionId: string, deviceId: string): void {
    const devices = this.sessions.get(sessionId)
    const device = devices?.get(deviceId)
    if (device) {
      device.lastWriteAt = Date.now()
    }
  }

  /**
   * 获取会话的活跃设备数
   */
  getActiveDeviceCount(sessionId: string): number {
    const devices = this.sessions.get(sessionId)
    if (!devices) return 0
    this.cleanupStaleDevices(devices, Date.now())
    return devices.size
  }

  /**
   * 清理超时设备
   */
  private cleanupStaleDevices(
    devices: Map<string, ActiveDevice>,
    now: number
  ): void {
    const timeout = 2 * 60 * 1000 // 2 分钟
    for (const [id, device] of devices) {
      if (now - device.lastHeartbeat > timeout) {
        devices.delete(id)
      }
    }
  }

  private getOrCreateSession(sessionId: string): Map<string, ActiveDevice> {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map())
    }
    return this.sessions.get(sessionId)!
  }

  private formatRelativeTime(ms: number): string {
    if (ms < 60_000) return '刚刚'
    if (ms < 3600_000) return `${Math.floor(ms / 60_000)} 分钟前`
    return `${Math.floor(ms / 3600_000)} 小时前`
  }
}

export const deviceManager = new DeviceManager()
