# 多设备同步与冲突检测

> 支持多设备使用场景，通过数据级冲突检测避免数据覆盖

## 目录

1. [使用场景](#使用场景)
2. [设计思路](#设计思路)
3. [设备心跳机制](#设备心跳机制)
4. [数据级冲突检测](#数据级冲突检测)
5. [用户界面](#用户界面)
6. [实现代码](#实现代码)

---

## 使用场景

### 典型场景

```
用户同时使用：
• PC 上运行 SillyTavern + 小手机
• 手机浏览器访问小手机 Web 界面

期望：
• 两边数据实时同步
• 大部分操作互不干扰
• 只在真正冲突时提醒用户
```

### 核心思路

```
复杂方案（放弃）：
  多设备 → 检测冲突 → 版本向量 → 冲突UI → 用户手动合并
  
简化方案（采用）：
  多设备 → 数据级检测 → 无冲突直接写 → 有冲突才提醒
```

**关键洞察**：大多数情况下，多设备操作的是不同的数据。

```
设备 A 改联系人 "小明"
设备 B 改微博帖子 #123
                          → 无冲突，都写入 ✅

设备 A 改联系人 "小明"
设备 B 也改联系人 "小明"
                          → 冲突！提醒用户 ⚠️
```

---

## 设计思路

### 预防优于解决

| 策略 | 说明 |
|------|------|
| **数据级检测** | 只检测正在被修改的具体数据 |
| **短期锁定** | 写入时锁定 30 秒，防止同时修改 |
| **latest-wins** | 无法判断时，后写入的覆盖先写入的 |
| **用户选择** | 真正冲突时让用户决定 |

### 对比

| 方案 | 粒度 | 用户干预频率 | 复杂度 |
|------|------|--------------|--------|
| 设备级锁定 | 整个 session | 频繁 | 低 |
| **数据级检测** | 单条记录 | 很少 | 中 |
| 版本向量 | 单条记录 | 很少 | 高 |

---

## 设备心跳机制

### 服务端实现

```typescript
// server/src/services/deviceManager.ts

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
    const otherDevices = allDevices.filter(d => d.deviceId !== deviceId)
    
    return {
      activeDeviceCount: allDevices.length,
      otherDevices: otherDevices.map(d => ({
        name: d.deviceName,
        lastActive: this.formatRelativeTime(now - d.lastHeartbeat),
      })),
      canWrite: true,  // 数据级检测，始终允许尝试写入
    }
  }
  
  /**
   * 清理超时设备
   */
  private cleanupStaleDevices(
    devices: Map<string, ActiveDevice>,
    now: number
  ): void {
    const timeout = 2 * 60 * 1000  // 2 分钟
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
```

### 客户端实现

```typescript
// src/services/sync/deviceSync.ts

interface DeviceStatus {
  isOnlyDevice: boolean
  canWrite: boolean
  otherDevices: Array<{ name: string; lastActive: string }>
}

class DeviceSyncManager {
  private deviceId: string
  private deviceName: string
  private status: DeviceStatus | null = null
  private heartbeatTimer: number | null = null
  
  constructor() {
    this.deviceId = this.getOrCreateDeviceId()
    this.deviceName = this.detectDeviceName()
  }
  
  /**
   * 启动心跳
   */
  start(): void {
    this.sendHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat()
    }, 30_000)  // 30 秒
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
  
  private async sendHeartbeat(): Promise<void> {
    try {
      const response = await fetch('/api/v2/devices/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionService.getCurrentSessionId(),
          deviceId: this.deviceId,
          deviceName: this.deviceName,
        }),
      })
      
      const data = await response.json()
      
      this.status = {
        isOnlyDevice: data.activeDeviceCount === 1,
        canWrite: data.canWrite,
        otherDevices: data.otherDevices,
      }
      
      // 检测到其他设备时显示提示
      if (!this.status.isOnlyDevice) {
        this.showMultiDeviceNotice()
      }
    } catch (e) {
      console.error('[DeviceSync] 心跳失败:', e)
    }
  }
  
  private showMultiDeviceNotice(): void {
    const devices = this.status!.otherDevices
      .map(d => `${d.name} (${d.lastActive})`)
      .join(', ')
    
    // 显示非阻塞提示
    console.log(`[DeviceSync] 检测到其他设备: ${devices}`)
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
    return 'Unknown Device'
  }
}

export const deviceSyncManager = new DeviceSyncManager()
```

---

## 数据级冲突检测

### 服务端冲突检测器

```typescript
// server/src/services/conflictDetector.ts

interface DataLock {
  deviceId: string
  deviceName: string
  lockedAt: number
  expiresAt: number
}

interface ConflictInfo {
  table: string
  key: any
  yourOperation: string
  conflictDevice: string
  conflictTime: number
}

class ConflictDetector {
  // key 格式: "{sessionId}:{table}:{primaryKey}"
  private locks = new Map<string, DataLock>()
  
  /**
   * 检查并尝试获取写入锁
   * @returns 冲突列表，空数组表示无冲突
   */
  checkAndLock(
    sessionId: string,
    deviceId: string,
    deviceName: string,
    changes: Array<{ table: string; key: any; operation: string }>
  ): ConflictInfo[] {
    const now = Date.now()
    const conflicts: ConflictInfo[] = []
    const lockDuration = 30_000  // 30 秒锁定
    
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
          expiresAt: now + lockDuration,
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
    changes: Array<{ table: string; key: any }>
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
    key: any,
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
  
  private makeLockKey(sessionId: string, table: string, key: any): string {
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
```

### API 接口

```typescript
// server/src/routes/sync.ts

import { conflictDetector } from '../services/conflictDetector'
import { deviceManager } from '../services/deviceManager'

// 心跳接口
router.post('/devices/heartbeat', (req, res) => {
  const { sessionId, deviceId, deviceName } = req.body
  const result = deviceManager.heartbeat(sessionId, deviceId, deviceName)
  res.json(result)
})

// 同步接口（集成冲突检测）
router.post('/sync', async (req, res) => {
  const { sessionId, deviceId, deviceName, changes, lastSyncTime } = req.body
  
  // 1. 如果没有变更，只拉取
  if (!changes || changes.length === 0) {
    const serverChanges = await getServerChanges(sessionId, lastSyncTime)
    return res.json({ success: true, serverChanges })
  }
  
  // 2. 检查冲突
  const conflicts = conflictDetector.checkAndLock(
    sessionId,
    deviceId,
    deviceName,
    changes
  )
  
  // 3. 有冲突，返回冲突信息
  if (conflicts.length > 0) {
    return res.json({
      success: false,
      hasConflicts: true,
      conflicts,
    })
  }
  
  // 4. 无冲突，写入数据
  try {
    await storageService.applyChanges(sessionId, changes)
    
    // 5. 释放锁
    conflictDetector.releaseLocks(sessionId, deviceId, changes)
    
    // 6. 获取服务器变更
    const serverChanges = await getServerChanges(sessionId, lastSyncTime)
    
    return res.json({
      success: true,
      hasConflicts: false,
      serverChanges,
syncTime: Date.now(),
    })
  } catch (error) {
    conflictDetector.releaseLocks(sessionId, deviceId, changes)
    throw error
  }
})

// 检查编辑状态（可选，用于实时提示）
router.post('/sync/check-editing', (req, res) => {
  const { sessionId, deviceId, table, key } = req.body
  const result = conflictDetector.isBeingEdited(sessionId, table, key, deviceId)
  res.json(result)
})
```

---

## 用户界面

### 多设备提示

```vue
<!-- src/components/sync/MultiDeviceIndicator.vue -->
<template>
  <Transition name="fade">
    <div v-if="showIndicator" class="multi-device-indicator" @click="showDetail">
      <span class="icon">📱</span>
      <span class="count">{{ deviceCount }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { deviceSyncManager } from '@/services/sync/deviceSync'

const status = computed(() => deviceSyncManager.getStatus())
const showIndicator = computed(() => status.value && !status.value.isOnlyDevice)
const deviceCount = computed(() => (status.value?.otherDevices.length ?? 0) + 1)

function showDetail() {
  // 显示设备列表弹窗
}
</script>

<style scoped>
.multi-device-indicator {
  position: fixed;
  top: 10px;
  right: 10px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.count {
  background: #ff9800;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 10px;
}
</style>
```

### 冲突提示对话框

```vue
<!-- src/components/sync/ConflictDialog.vue -->
<template>
  <div v-if="conflicts.length > 0" class="conflict-dialog">
    <div class="overlay" />
    <div class="dialog">
      <h3>⚠️ 检测到数据冲突</h3>
      
      <p>以下数据正在被其他设备修改:</p>
      
      <div class="conflict-list">
        <div v-for="c in conflicts" :key="`${c.table}:${c.key}`" class="conflict-item">
          <span class="table">{{ tableNames[c.table] || c.table }}</span>
          <span class="device">{{ c.conflictDevice }} 正在编辑</span>
        </div>
      </div>
      
      <p class="hint">你可以:</p>
      <ul>
        <li>等待对方完成后再操作</li>
        <li>强制覆盖（对方的修改会丢失）</li>
        <li>放弃你的修改，使用对方的版本</li>
      </ul>
      
      <div class="actions">
        <button class="secondary" @click="onRetryLater">稍后再试</button>
        <button class="secondary" @click="onDiscard">放弃我的</button>
        <button class="danger" @click="onForce">强制覆盖</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConflictInfo } from '@/services/sync/types'

const props = defineProps<{
  conflicts: ConflictInfo[]
}>()

const emit = defineEmits<{
  resolve: [decision: 'retry' | 'discard' | 'force']
}>()

const tableNames: Record<string, string> = {
  contacts: '📇 联系人',
  messages: '💬 消息',
  moments: '📷 动态',
  socialPosts: '📝 帖子',
}

function onRetryLater() { emit('resolve', 'retry') }
function onDiscard() { emit('resolve', 'discard') }
function onForce() { emit('resolve', 'force') }
</script>
```

### 实时编辑提示

```vue
<!-- src/components/common/EditingBanner.vue -->
<template>
  <Transition name="slide">
    <div v-if="editingInfo" class="editing-banner">
      <span>⚠️ {{ editingInfo.byDevice }} 也在编辑这条数据</span>
      <button @click="refresh">刷新</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  table: string
  dataKey: any
}>()

const editingInfo = ref<{ byDevice: string } | null>(null)

async function checkEditing() {
  const response = await fetch('/api/v2/sync/check-editing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: sessionService.getCurrentSessionId(),
      deviceId: localStorage.getItem('device_id'),
      table: props.table,
      key: props.dataKey,
    }),
  })
  
  const result = await response.json()
  editingInfo.value = result.editing ? { byDevice: result.byDevice } : null
}

let timer: number | null = null

onMounted(() => {
  checkEditing()
  timer = window.setInterval(checkEditing, 5000)  // 每 5 秒检查
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function refresh() {
  // 触发数据刷新
  emit('refresh')
}
</script>
```

---

## 客户端同步集成

```typescript
// src/services/sync/syncManager.ts

import { changeTracker } from './changeTracker'
import type { ConflictInfo } from './types'

class SyncManager {
  private syncing = false
  private lastSyncTime = 0
  
  async sync(): Promise<SyncResult> {
    if (this.syncing) {
      return { success: false, error: 'Sync in progress' }
    }
    
    this.syncing = true
    
    try {
      const changes = changeTracker.getPendingChanges()
      
      const response = await fetch('/api/v2/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionService.getCurrentSessionId(),
          deviceId: localStorage.getItem('device_id'),
          deviceName: deviceSyncManager.deviceName,
          changes: changes.map(c => ({
            table: c.table,
            key: c.key,
            operation: c.operation,
            value: c.value,
          })),
          lastSyncTime: this.lastSyncTime,
        }),
      })
      
      const result = await response.json()
      
      // 处理冲突
      if (result.hasConflicts) {
        const decision = await this.handleConflicts(result.conflicts)
        return await this.resolveConflicts(decision, changes)
      }
      
      // 无冲突，应用服务器变更
      if (result.serverChanges?.length > 0) {
        await this.applyServerChanges(result.serverChanges)
      }
      
      changeTracker.markSynced(changes.map(c => c.id))
      this.lastSyncTime = result.syncTime
      
      return {
        success: true,
        pushed: changes.length,
        pulled: result.serverChanges?.length ?? 0,
      }
      
    } finally {
      this.syncing = false
    }
  }
  
  private async handleConflicts(conflicts: ConflictInfo[]): Promise<'retry' | 'discard' | 'force'> {
    // 显示冲突对话框，等待用户决策
    return new Promise(resolve => {
      showConflictDialog(conflicts, resolve)
    })
  }
  
  private async resolveConflicts(
    decision: 'retry' | 'discard' | 'force',
    changes: TrackedChange[]
  ): Promise<SyncResult> {
    switch (decision) {
      case 'retry':
        // 稍后重试
        return { success: false, error: 'User chose to retry later' }
      
      case 'discard':
        // 放弃本地修改，拉取服务器数据
        changeTracker.discardPending(changes.map(c => c.id))
        return await this.pullOnly()
      
      case 'force':
        // 强制写入（TODO: 需要服务端支持 force 参数）
        return await this.syncWithForce(changes)
    }
  }
}

export const syncManager = new SyncManager()
```
