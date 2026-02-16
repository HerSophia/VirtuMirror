# 写入队列机制

> 统一的写入队列，确保本地和云同步的数据写入有序进行

## 目录

1. [问题背景](#问题背景)
2. [设计目标](#设计目标)
3. [前端 WriteQueue](#前端-writequeue)
4. [后端 SessionWriteQueue](#后端-sessionwritequeue)
5. [状态通知与 UI](#状态通知与-ui)
6. [完整写入流程](#完整写入流程)

---

## 问题背景

### 潜在问题

```
场景 1: App 写入与云同步冲突
├── App A 正在写入联系人
├── 同时云同步要写入服务器拉取的数据
└── 可能导致数据不一致或写入失败

场景 2: 多 App 并发写入
├── App A 写入数据 X
├── App B 同时写入数据 Y
└── IndexedDB 事务可能冲突

场景 3: 多设备服务端写入
├── 设备 A 提交写入请求
├── 设备 B 也提交写入请求
└── 文件系统写入可能冲突
```

### 解决方案

```
┌─────────────────────────────────────────────────────────────────┐
│                        写入保护机制                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  前端 WriteQueue                                                  │
│  ├── 所有写入操作排队执行                                         │
│  ├── 优先级：系统 > App > 云同步                                  │
│  └── 防止 IndexedDB 并发写入问题                                  │
│                                                                   │
│  后端 SessionWriteQueue                                           │
│  ├── 按 session 隔离的写入队列                                    │
│  ├── 数据级锁定                                                   │
│  └── 保证存储层串行写入                                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 设计目标

1. **有序写入** - 所有写入操作排队执行，避免冲突
2. **优先级控制** - 本地操作优先于云同步
3. **状态可见** - UI 可以感知当前写入状态
4. **错误隔离** - 单个写入失败不影响其他操作

---

## 前端 WriteQueue

### 类型定义

```typescript
// src/services/database/writeQueue.ts

type WriteOperation = () => Promise<void>

interface QueuedWrite {
  id: string
  source: 'app' | 'sync' | 'system'
  sourceId: string        // appId 或 'cloud-sync'
  operation: WriteOperation
  priority: number        // 数字越小优先级越高
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
```

### 核心实现

```typescript
// src/services/database/writeQueue.ts

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
    
    return new Promise(resolve => {
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
    listener(this.state)  // 立即通知当前状态
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
    const index = this.queue.findIndex(q => q.priority > item.priority)
    if (index === -1) {
      this.queue.push(item)
    } else {
      this.queue.splice(index, 0, item)
    }
  }
  
  private getDefaultPriority(source: 'app' | 'sync' | 'system'): number {
    // 系统 > App > 同步
    switch (source) {
      case 'system': return 0
      case 'app': return 10
      case 'sync': return 20
    }
  }
  
  private updateState(): void {
    this.state.queueLength = this.queue.length
  }
  
  private notifyListeners(): void {
    const snapshot = { ...this.state }
    this.listeners.forEach(l => l(snapshot))
  }
}

export const writeQueue = new WriteQueueManager()
```

### 与 AppRuntime 集成

```typescript
// src/services/appRuntime/scopedStorage.ts

import { writeQueue } from '@/services/database/writeQueue'

export function createScopedStorage(
  namespace: string,
  appId: string
): ScopedStorage {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      // 读取不需要排队
      const record = await db.appData.get(`${namespace}:${key}`)
      return record?.value as T | undefined
    },
    
    async set<T>(key: string, value: T): Promise<void> {
      // 写入需要排队
      await writeQueue.enqueue('app', appId, async () => {
        await db.appData.put({
          key: `${namespace}:${key}`,
          namespace,
          value,
          updatedAt: Date.now(),
        })
      })
    },
    
    async delete(key: string): Promise<void> {
      await writeQueue.enqueue('app', appId, async () => {
        await db.appData.delete(`${namespace}:${key}`)
      })
    },
    
    // ... 其他方法
  }
}
```

### 与云同步集成

```typescript
// src/services/sync/syncManager.ts

import { writeQueue } from '@/services/database/writeQueue'
import { changeTracker } from './changeTracker'

class SyncManager {
  private async applyServerChanges(changes: ServerChange[]): Promise<void> {
    // 暂停变更追踪
    changeTracker.pause()
    
    try {
      // 通过写入队列批量写入，优先级较低
      await writeQueue.enqueueBatch(
        'sync',
        'cloud-sync',
        changes.map(change => async () => {
          const table = db.table(change.table)
          if (change.operation === 'delete') {
            await table.delete(change.key)
          } else {
            await table.put(change.value)
          }
        }),
        { priority: 20 }  // 低优先级
      )
    } finally {
      changeTracker.resume()
    }
  }
  
  /**
   * 在开始同步前等待本地写入完成
   */
  async prepareSync(): Promise<void> {
    const state = writeQueue.getState()
    if (state.isWriting) {
      await writeQueue.waitForIdle()
    }
  }
}
```

---

## 后端 SessionWriteQueue

### 类型定义

```typescript
// server/src/services/sessionWriteQueue.ts

interface QueuedRequest {
  id: string
  deviceId: string
  changes: any[]
  timestamp: number
  resolve: (result: WriteResult) => void
  reject: (error: Error) => void
}

interface WriteResult {
  success: boolean
  appliedCount?: number
  error?: string
  hasConflicts?: boolean
  conflicts?: ConflictInfo[]
}

interface QueueStatus {
  pendingCount: number
  isProcessing: boolean
  oldestRequest?: number
}
```

### 核心实现

```typescript
// server/src/services/sessionWriteQueue.ts

import { conflictDetector } from './conflictDetector'
import { storageService } from './storage'

class SessionWriteQueue {
  // sessionId -> queue
  private queues = new Map<string, QueuedRequest[]>()
  private processing = new Set<string>()
  
  /**
   * 提交写入请求
   */
  async submit(
    sessionId: string,
    deviceId: string,
    deviceName: string,
    changes: any[]
  ): Promise<WriteResult> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: crypto.randomUUID(),
        deviceId,
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
      this.processSession(sessionId, deviceName)
    })
  }
  
  /**
   * 处理某个 session 的队列
   */
  private async processSession(
    sessionId: string,
    deviceName: string
  ): Promise<void> {
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
          deviceName,
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
        await storageService.applyChanges(sessionId, request.changes)
        
        // 释放锁
        conflictDetector.releaseLocks(sessionId, request.deviceId, request.changes)
        
        request.resolve({
          success: true,
          appliedCount: request.changes.length,
        })
        
      } catch (error) {
        // 出错时释放锁
        conflictDetector.releaseLocks(sessionId, request.deviceId, request.changes)
        
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
```

### API 集成

```typescript
// server/src/routes/sync.ts

import { sessionWriteQueue } from '../services/sessionWriteQueue'

router.post('/sync', async (req, res) => {
  const { sessionId, deviceId, deviceName, changes, lastSyncTime } = req.body
  
  // 如果没有变更，只拉取
  if (!changes || changes.length === 0) {
    const serverChanges = await getServerChanges(sessionId, lastSyncTime)
    return res.json({
      success: true,
      serverChanges,
      queueStatus: sessionWriteQueue.getStatus(sessionId),
    })
  }
  
  // 提交到写入队列
  const result = await sessionWriteQueue.submit(
    sessionId,
    deviceId,
    deviceName,
    changes
  )
  
  // 如果成功，获取服务器变更
  if (result.success) {
    const serverChanges = await getServerChanges(sessionId, lastSyncTime)
    return res.json({
      ...result,
      serverChanges,
      syncTime: Date.now(),
      queueStatus: sessionWriteQueue.getStatus(sessionId),
    })
  }
  
  res.json(result)
})

// 队列状态查询
router.get('/sync/:sessionId/queue-status', (req, res) => {
  const { sessionId } = req.params
  res.json(sessionWriteQueue.getStatus(sessionId))
})
```

---

## 状态通知与 UI

### 写入状态指示器

```vue
<!-- src/components/common/WriteQueueIndicator.vue -->
<template>
  <Transition name="fade">
    <div v-if="state.isWriting" class="write-indicator">
      <span class="spinner" />
      <span class="text">{{ displayText }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { writeQueue, type WriteLockState } from '@/services/database/writeQueue'

const state = ref<WriteLockState>(writeQueue.getState())

const displayText = computed(() => {
  if (!state.value.currentSource) return '保存中...'
  
  const [type] = state.value.currentSource.split(':')
  switch (type) {
    case 'sync': return '正在同步...'
    case 'system': return '系统更新...'
    default: return '保存中...'
  }
})

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = writeQueue.subscribe(s => {
    state.value = s
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.write-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  z-index: 1000;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

### 队列状态调试面板

```vue
<!-- src/components/dev/WriteQueueDebug.vue -->
<template>
  <div v-if="isDev" class="queue-debug">
    <div class="header" @click="expanded = !expanded">
      <span>📝 WriteQueue</span>
      <span class="badge" :class="{ active: state.isWriting }">
        {{ state.queueLength }}
      </span>
    </div>
    
    <div v-if="expanded" class="details">
      <div>状态: {{ state.isWriting ? '写入中' : '空闲' }}</div>
      <div>当前: {{ state.currentSource || '-' }}</div>
      <div>队列: {{ state.queueLength }}</div>
      <div>上次: {{ formatTime(state.lastWriteAt) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { writeQueue, type WriteLockState } from '@/services/database/writeQueue'

const isDev = import.meta.env.DEV
const expanded = ref(false)
const state = ref<WriteLockState>(writeQueue.getState())

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = writeQueue.subscribe(s => {
    state.value = s
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString()
}
</script>
```

---

## 完整写入流程

```
时间线示例：

T=0    App A 开始编辑联系人
T=1    App A 调用 storage.set() → 进入前端队列 [A]
T=2    云同步触发，想写入服务器数据 → 进入前端队列 [A, Sync]
T=3    App B 也保存数据 → 进入前端队列 [A, Sync, B]
       
       前端队列开始处理（按优先级）：
T=4    执行 A 的写入 (priority=10) → IndexedDB ✓
T=5    执行 B 的写入 (priority=10) → IndexedDB ✓
T=6    执行 Sync 的写入 (priority=20) → IndexedDB ✓
       
       同时，Sync 完成后推送到服务器：
T=7    发送 POST /api/v2/sync → 进入后端队列
       
       另一个设备也在同步：
T=8    设备 2 的请求到达 → 进入后端队列 [设备1, 设备2]
       
       后端队列处理：
T=9    处理设备 1 的请求 → 检查冲突 → 无冲突 → 写入存储 ✓
T=10   处理设备 2 的请求 → 检查冲突 → 无冲突 → 写入存储 ✓
       （如果冲突）→ 返回冲突信息 → 设备 2 显示提示
```

### 保护效果

| 场景 | 保护机制 | 结果 |
| ------ | ---------- | ------ |
| 多 App 同时写入 | 前端队列化 | 串行执行，无冲突 |
| App 写入 vs 云同步 | 前端优先级 | App 优先，同步等待 |
| 多设备写入不同数据 | 后端数据级检测 | 无冲突，都写入 |
| 多设备写入相同数据 | 后端数据级检测 | 检测冲突，提醒用户 |
