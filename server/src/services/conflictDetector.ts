/**
 * 冲突检测器
 *
 * 数据级冲突检测，使用短期锁定机制
 */

interface DataLock {
  deviceId: string
  deviceName: string
  lockedAt: number
  expiresAt: number
}

export interface ConflictInfo {
  table: string
  key: unknown
  yourOperation: string
  conflictDevice: string
  conflictTime: number
}

interface ChangeItem {
  table: string
  key: unknown
  operation: string
}

class ConflictDetector {
  // key 格式: "{sessionId}:{table}:{primaryKey}"
  private locks = new Map<string, DataLock>()
  private lockDuration = 30_000 // 30 秒锁定

  /**
   * 检查并尝试获取写入锁
   * @returns 冲突列表，空数组表示无冲突
   */
  checkAndLock(
    sessionId: string,
    deviceId: string,
    deviceName: string,
    changes: ChangeItem[]
  ): ConflictInfo[] {
    const now = Date.now()
    const conflicts: ConflictInfo[] = []

    // 清理过期的锁
    this.cleanupExpired(now)

    // 检查每个变更是否有冲突
    for (const change of changes) {
      const lockKey = this.makeLockKey(sessionId, change.table, change.key)
      const existing = this.locks.get(lockKey)

      if (existing && existing.deviceId !== deviceId) {
        // 发现冲突！
        conflicts.push({
          table: change.table,
          key: change.key,
          yourOperation: change.operation,
          conflictDevice: existing.deviceName,
          conflictTime: existing.lockedAt,
        })
      }
    }

    // 如果无冲突，锁定这些数据
    if (conflicts.length === 0) {
      for (const change of changes) {
        const lockKey = this.makeLockKey(sessionId, change.table, change.key)
        this.locks.set(lockKey, {
          deviceId,
          deviceName,
          lockedAt: now,
          expiresAt: now + this.lockDuration,
        })
      }
    }

    return conflicts
  }

  /**
   * 写入完成，释放锁
   */
  releaseLocks(
    sessionId: string,
    deviceId: string,
    changes: Array<{ table: string; key: unknown }>
  ): void {
    for (const change of changes) {
      const lockKey = this.makeLockKey(sessionId, change.table, change.key)
      const existing = this.locks.get(lockKey)

      // 只释放自己的锁
      if (existing?.deviceId === deviceId) {
        this.locks.delete(lockKey)
      }
    }
  }

  /**
   * 检查某条数据是否正在被编辑
   */
  isBeingEdited(
    sessionId: string,
    table: string,
    key: unknown,
    excludeDevice?: string
  ): { editing: boolean; byDevice?: string } {
    const lockKey = this.makeLockKey(sessionId, table, key)
    const lock = this.locks.get(lockKey)

    if (!lock || lock.expiresAt < Date.now()) {
      return { editing: false }
    }

    if (excludeDevice && lock.deviceId === excludeDevice) {
      return { editing: false }
    }

  return { editing: true, byDevice: lock.deviceName }
  }

  /**
   * 获取锁定统计
   */
  getStats(): { totalLocks: number; activeLocks: number } {
    const now = Date.now()
    let activeLocks = 0
    for (const lock of this.locks.values()) {
      if (lock.expiresAt >= now) {
        activeLocks++
      }
    }
    return {
      totalLocks: this.locks.size,
      activeLocks,
    }
  }

  private makeLockKey(sessionId: string, table: string, key: unknown): string {
    return `${sessionId}:${table}:${JSON.stringify(key)}`
  }

  private cleanupExpired(now: number): void {
    for (const [key, lock] of this.locks) {
      if (lock.expiresAt < now) {
        this.locks.delete(key)
      }
    }
  }
}

export const conflictDetector = new ConflictDetector()
