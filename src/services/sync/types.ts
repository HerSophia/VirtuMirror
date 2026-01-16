/**
 * 同步相关类型定义
 */

/**
 * 设备状态
 */
export interface DeviceStatus {
  /** 是否为唯一设备 */
  isOnlyDevice: boolean
  /** 是否可以写入 */
  canWrite: boolean
  /** 其他在线设备 */
  otherDevices: Array<{ name: string; lastActive: string }>
}

/**
 * 冲突信息
 */
export interface ConflictInfo {
  /** 表名 */
  table: string
  /** 主键 */
  key: unknown
  /** 你的操作 */
  yourOperation: string
  /** 冲突设备 */
  conflictDevice: string
  /** 冲突时间 */
  conflictTime: number
}

/**
 * 变更记录
 */
export interface TrackedChange {
  id: string
  table: string
  key: unknown
  operation: 'add' | 'update' | 'delete'
  value?: unknown
  timestamp: number
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean
  error?: string
  pushed?: number
  pulled?: number
  hasConflicts?: boolean
  conflicts?: ConflictInfo[]
}

/**
 * 心跳响应
 */
export interface HeartbeatResponse {
  activeDeviceCount: number
  otherDevices: Array<{ name: string; lastActive: string }>
  canWrite: boolean
}

/**
 * 服务器变更
 */
export interface ServerChange {
  table: string
  key: unknown
  operation: 'add' | 'update' | 'delete'
  value?: unknown
  timestamp: number
}
