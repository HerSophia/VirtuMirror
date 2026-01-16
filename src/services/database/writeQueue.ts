/**
 * 写入队列机制
 *
 * 统一的写入队列，确保本地 IndexedDB 写入有序进行
 * - 防止并发写入导致的数据不一致
 * - 支持优先级控制（系统 > App > 云同步）
 * - 提供写入状态订阅机制
 */

type WriteOperation = () => Promise<void>

interface QueuedWrite {
  id: string
  source: 'app' | 'sync' | 'system'
  sourceId: string // appId 或 'cloud-sync'
  operation: WriteOperation
  priority: number // 数字越小优先级越高
  timestamp: number
  resolve: () => void
  reject: (error: Error) => void
}

export interface WriteLockState {
  isWriting: boolean
  currentSource: string | null
  queueLength: number
  lastWriteAt: number
}

class WriteQueueManager {
  private queue: QueuedWrite[] = []
  private isProcessing = false
  private state: WriteLockState = {
    isWriting: false,
    currentSource: null,
    queueLength: 0,
    lastWriteAt: 0,
  }

  // 状态变化监听器
  private listeners = new Set<(state: WriteLockState) => void>()

  /**
   * 提交写入操作到队列
   */
  async enqueue(
    source: 'app' | 'sync' | 'system',
    sourceId: string,
    operation: WriteOperation,
    options: { priority?: number } = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const item: QueuedWrite = {
        id: crypto.randomUUID(),
        source,
        sourceId,
        operation,
        priority: options.priority ?? this.getDefaultPriority(source),
        timestamp: Date.now(),
        resolve,
        reject,
      }

      // 按优先级插入队列
      this.insertByPriority(item)
      this.updateState()

      // 触发处理
      this.processQueue()
    })
  }

  /**
   * 批量写入（作为一个原子操作）
   */
  async enqueueBatch(
    source: 'app' | 'sync' | 'system',
    sourceId: string,
    operations: WriteOperation[],
    options: { priority?: number } = {}
  ): Promise<void> {
    const batchOperation = async () => {
      for (const op of operations) {
        await op()
      }
    }
    return this.enqueue(source, sourceId, batchOperation, options)
  }

  /**
   * 检查是否可以立即写入
   */
  canWriteImmediately(): boolean {
    return this.queue.length === 0 && !this.isProcessing
  }

  /**
   * 等待队列清空
   */
  async waitForIdle(): Promise<void> {
    if (this.canWriteImmediately()) return

    return new Promise((resolve) => {
      const check = () => {
        if (this.canWriteImmediately()) {
          resolve()
        } else {
          setTimeout(check, 50)
        }
      }
      check()
    })
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (state: WriteLockState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state) // 立即通知当前状态
    return () => this.listeners.delete(listener)
  }

  /**
   * 获取当前状态
   */
  getState(): WriteLockState {
    return { ...this.state }
  }

  // ========== 私有方法 ==========

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()!

      // 更新状态
      this.state.isWriting = true
      this.state.currentSource = `${item.source}:${item.sourceId}`
      this.notifyListeners()

      try {
        await item.operation()
        this.state.lastWriteAt = Date.now()
        item.resolve()
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)))
      }

      this.updateState()
    }

    this.isProcessing = false
    this.state.isWriting = false
    this.state.currentSource = null
    this.notifyListeners()
  }

  private insertByPriority(item: QueuedWrite): void {
    const index = this.queue.findIndex((q) => q.priority > item.priority)
    if (index === -1) {
      this.queue.push(item)
    } else {
      this.queue.splice(index, 0, item)
    }
  }

  private getDefaultPriority(source: 'app' | 'sync' | 'system'): number {
    // 系统 > App > 同步
    switch (source) {
      case 'system':
        return 0
      case 'app':
        return 10
      case 'sync':
        return 20
    }
  }

  private updateState(): void {
    this.state.queueLength = this.queue.length
  }

  private notifyListeners(): void {
    const snapshot = { ...this.state }
    this.listeners.forEach((l) => l(snapshot))
  }
}

export const writeQueue = new WriteQueueManager()
