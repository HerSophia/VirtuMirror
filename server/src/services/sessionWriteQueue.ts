/**
 * Session 写入队列
 *
 * 按 session 隔离的写入队列，保证存储层串行写入
 */

import { conflictDetector, type ConflictInfo } from './conflictDetector'

interface WriteResult {
  success: boolean
  appliedCount?: number
  error?: string
  hasConflicts?: boolean
  conflicts?: ConflictInfo[]
}

interface QueuedRequest {
  id: string
  deviceId: string
  deviceName: string
  changes: Array<{
    table: string
    key: unknown
    operation: string
    value?: unknown
  }>
  timestamp: number
  resolve: (result: WriteResult) => void
  reject: (error: Error) => void
}

interface QueueStatus {
  pendingCount: number
  isProcessing: boolean
  oldestRequest?: number
}

// 存储写入回调类型
type StorageWriteCallback = (
  sessionId: string,
  changes: Array<{
    table: string
    key: unknown
    operation: string
    value?: unknown
  }>
) => Promise<void>

class SessionWriteQueue {
  // sessionId -> queue
  private queues = new Map<string, QueuedRequest[]>()
  private processing = new Set<string>()
  private storageCallback: StorageWriteCallback | null = null

  /**
   * 设置存储写入回调
   */
  setStorageCallback(callback: StorageWriteCallback): void {
    this.storageCallback = callback
  }

  /**
   * 提交写入请求
   */
  async submit(
    sessionId: string,
    deviceId: string,
    deviceName: string,
    changes: Array<{
      table: string
      key: unknown
      operation: string
      value?: unknown
    }>
  ): Promise<WriteResult> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: crypto.randomUUID(),
        deviceId,
        deviceName,
        changes,
        timestamp: Date.now(),
        resolve,
        reject,
      }

      // 加入队列
      if (!this.queues.has(sessionId)) {
        this.queues.set(sessionId, [])
      }
      this.queues.get(sessionId)!.push(request)

      // 触发处理
      this.processSession(sessionId)
    })
  }

  /**
   * 处理某个 session 的队列
   */
  private async processSession(sessionId: string): Promise<void> {
    // 防止并发处理
    if (this.processing.has(sessionId)) return
    this.processing.add(sessionId)

    const queue = this.queues.get(sessionId)
    if (!queue) {
      this.processing.delete(sessionId)
      return
    }

    while (queue.length > 0) {
      const request = queue.shift()!

      try {
        // 检查数据级冲突
        const conflicts = conflictDetector.checkAndLock(
          sessionId,
          request.deviceId,
          request.deviceName,
          request.changes
        )

        if (conflicts.length > 0) {
          request.resolve({
            success: false,
            hasConflicts: true,
            conflicts,
          })
          continue
        }

        // 执行写入
        if (this.storageCallback) {
          await this.storageCallback(sessionId, request.changes)
        }

        // 释放锁
        conflictDetector.releaseLocks(
          sessionId,
          request.deviceId,
          request.changes
        )

        request.resolve({
          success: true,
          appliedCount: request.changes.length,
        })
      } catch (error) {
        // 出错时释放锁
        conflictDetector.releaseLocks(
          sessionId,
          request.deviceId,
          request.changes
        )

        request.resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    this.processing.delete(sessionId)
  }

  /**
   * 获取队列状态
   */
  getStatus(sessionId: string): QueueStatus {
    const queue = this.queues.get(sessionId) ?? []
    return {
      pendingCount: queue.length,
      isProcessing: this.processing.has(sessionId),
      oldestRequest: queue[0]?.timestamp,
    }
  }
}

export const sessionWriteQueue = new SessionWriteQueue()
