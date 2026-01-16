/**
 * 变更追踪器
 *
 * 追踪本地数据变更，用于同步
 */

import type { TrackedChange } from './types'

class ChangeTracker {
  private changes: TrackedChange[] = []
  private paused = false
  private maxChanges = 1000

  /**
   * 记录变更
   */
  track(
    table: string,
    key: unknown,
    operation: 'add' | 'update' | 'delete',
    value?: unknown
  ): void {
    if (this.paused) return

    const change: TrackedChange = {
      id: crypto.randomUUID(),
      table,
      key,
      operation,
      value,
      timestamp: Date.now(),
    }

    this.changes.push(change)

    // 限制队列长度
    if (this.changes.length > this.maxChanges) {
      this.changes = this.changes.slice(-this.maxChanges)
    }
  }

  /**
   * 获取待同步的变更
   */
  getPendingChanges(): TrackedChange[] {
    return [...this.changes]
  }

  /**
   * 标记变更为已同步
   */
  markSynced(changeIds: string[]): void {
    const idSet = new Set(changeIds)
    this.changes = this.changes.filter((c) => !idSet.has(c.id))
  }

  /**
   * 丢弃待同步的变更
   */
  discardPending(changeIds: string[]): void {
    const idSet = new Set(changeIds)
    this.changes = this.changes.filter((c) => !idSet.has(c.id))
  }

  /**
   * 暂停追踪（用于应用服务器变更时）
   */
  pause(): void {
    this.paused = true
  }

  /**
   * 恢复追踪
   */
  resume(): void {
    this.paused = false
  }

  /**
   * 是否暂停中
   */
  isPaused(): boolean {
    return this.paused
  }

  /**
   * 清空所有变更
   */
  clear(): void {
    this.changes = []
  }

  /**
   * 获取待同步变更数量
   */
  getPendingCount(): number {
    return this.changes.length
  }
}

export const changeTracker = new ChangeTracker()
