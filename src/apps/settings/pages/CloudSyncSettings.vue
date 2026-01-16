<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { cloudSyncService, type SyncStatus } from '@/services/cloudSyncService'
import { sessionService } from '@/services/database'
import { writeQueue, type WriteLockState } from '@/services/database/writeQueue'
import { deviceSyncManager, type DeviceStatus } from '@/services/sync'
import WriteQueueIndicator from '@/components/common/WriteQueueIndicator.vue'
import MultiDeviceIndicator from '@/components/sync/MultiDeviceIndicator.vue'

const router = useRouter()
const status = ref<SyncStatus>({
  lastSyncTime: null,
  inProgress: false,
  error: null
})

const serverMeta = ref<{ exists: boolean; updatedAt?: number; size?: number } | null>(null)
const sessionId = ref<string>('')

// 写入队列状态
const writeState = ref<WriteLockState>(writeQueue.getState())
let unsubscribeWrite: (() => void) | null = null

// 多设备状态
const deviceStatus = ref<DeviceStatus | null>(null)
let unsubscribeDevice: (() => void) | null = null

// 是否有其他设备在线
const hasOtherDevices = computed(() => deviceStatus.value && !deviceStatus.value.isOnlyDevice)
const otherDeviceCount = computed(() => deviceStatus.value?.otherDevices.length ?? 0)

async function refreshStatus() {
  status.value = cloudSyncService.getStatus()
  
  let currentId = sessionService.getCurrentSessionIdOrNull()
  
  // 如果当前没有 Session ID，尝试通过全局事件或其他方式获取
  if (!currentId) {
    const { getBridgeAdapter } = await import('@/adapters/bridgeAdapter')
    const adapter = getBridgeAdapter()
    if (adapter) {
      currentId = adapter.getFullSessionId()
      if (currentId) {
        sessionService.setCurrentSessionId(currentId)
      }
    }
  }

  sessionId.value = currentId || '未连接'
  
  if (currentId) {
    try {
      serverMeta.value = await cloudSyncService.checkCloudBackup(currentId)
    } catch (e) {
      console.error('Failed to check backup:', e)
    }
  }
}

async function handleBackup() {
  if (status.value.inProgress || writeState.value.isWriting) return
  
  try {
    // 等待写入队列空闲后再备份
    await writeQueue.waitForIdle()
    await cloudSyncService.backupToCloud()
    await refreshStatus()
  } catch (e) {
    // Error is handled in service
  }
}

async function handleRestore() {
  if (status.value.inProgress || writeState.value.isWriting) return
  
  // 检查是否有其他设备在写入
  if (hasOtherDevices.value && !deviceStatus.value?.canWrite) {
    alert('其他设备正在编辑数据，请稍后再试。')
    return
  }
  
  if (!confirm('确定要从云端恢复吗？这将覆盖当前会话的本地数据。')) {
    return
  }
  
  try {
    // 等待写入队列空闲后再恢复
    await writeQueue.waitForIdle()
    await cloudSyncService.restoreFromCloud(true)
    await refreshStatus()
    alert('恢复成功！')
  } catch (e) {
    alert('恢复失败: ' + e)
  }
}

function formatDate(ts?: number | null) {
  if (!ts) return '无'
  return new Date(ts).toLocaleString()
}

function formatSize(bytes?: number) {
  if (!bytes) return '未知'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function showDeviceList(devices: DeviceStatus['otherDevices']) {
  const list = devices.map(d => `${d.name} (${formatDeviceTime(d.lastActive)})`).join('\n')
  alert(`其他在线设备:\n${list}`)
}

function formatDeviceTime(ts: number | string): string {
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts)
  return date.toLocaleTimeString()
}

onMounted(() => {
  refreshStatus()
  
  // 订阅写入队列状态
  unsubscribeWrite = writeQueue.subscribe((s) => {
    writeState.value = s
  })
  
  // 订阅设备同步状态
  unsubscribeDevice = deviceSyncManager.subscribe((s) => {
    deviceStatus.value = s
  })
})

onUnmounted(() => {
  unsubscribeWrite?.()
  unsubscribeDevice?.()
})
</script>

<template>
  <div class="page-container">
    <!-- 导航栏 -->
    <div class="nav-bar">
      <button class="back-btn" @click="router.back()">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h3 class="title">云同步</h3>
      <div class="nav-right">
        <!-- 多设备指示器 -->
        <MultiDeviceIndicator @showDevices="showDeviceList" />
      </div>
    </div>

    <div class="content">
      <!-- 状态卡片 -->
      <div class="status-card" :class="{ 'syncing': status.inProgress }">
        <div class="icon-wrapper">
          <i class="fas fa-cloud-upload-alt text-4xl text-blue-500" v-if="!status.inProgress"></i>
          <i class="fas fa-spinner fa-spin text-4xl text-blue-500" v-else></i>
        </div>
        <div class="status-info">
          <h4 class="font-bold text-lg mb-1">
            {{ status.inProgress ? '同步中...' : '同步状态' }}
          </h4>
          <p class="text-sm text-gray-500 mb-1">
            当前会话: {{ sessionId }}
          </p>
          <p class="text-xs text-gray-400">
            上次同步: {{ formatDate(status.lastSyncTime) }}
          </p>
          <p v-if="status.error" class="text-xs text-red-500 mt-1">
            错误: {{ status.error }}
          </p>
        </div>
      </div>

      <!-- 云端信息 -->
      <div class="section">
        <h4 class="section-title">云端备份</h4>
        <div class="info-item">
          <span>状态</span>
          <span :class="serverMeta?.exists ? 'text-green-500' : 'text-gray-400'">
            {{ serverMeta?.exists ? '已备份' : '无备份' }}
          </span>
        </div>
        <div class="info-item" v-if="serverMeta?.exists">
          <span>更新时间</span>
          <span>{{ formatDate(serverMeta.updatedAt) }}</span>
        </div>
        <div class="info-item" v-if="serverMeta?.exists">
          <span>大小</span>
          <span>{{ formatSize(serverMeta.size) }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <button class="action-btn primary" @click="handleBackup" :disabled="status.inProgress || sessionId === '未连接'">
          <i class="fas fa-cloud-upload-alt mr-2"></i>
          立即备份
        </button>
        
        <button class="action-btn secondary" @click="handleRestore" :disabled="status.inProgress || sessionId === '未连接'">
          <i class="fas fa-cloud-download-alt mr-2"></i>
          恢复备份
        </button>
      </div>
      
      <p class="text-xs text-gray-400 text-center mt-4 px-4">
        备份仅包含当前聊天会话的数据 (联系人, 消息, 朋友圈等)。
      </p>
      
      <!-- 多设备警告 -->
      <div v-if="hasOtherDevices" class="device-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <span>检测到 {{ otherDeviceCount }} 个其他设备在线，请注意数据同步</span>
      </div>
    </div>
    
    <!-- 写入状态指示器 -->
    <WriteQueueIndicator />
  </div>
</template>

<style scoped>
.page-container {
  @apply h-full flex flex-col bg-gray-50;
}

.nav-bar {
  @apply flex items-center justify-between px-4 h-12 bg-white border-b border-gray-200;
}

.nav-right {
  @apply w-8 flex items-center justify-end;
}

.back-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 text-blue-500;
}

.title {
  @apply font-bold text-lg;
}

.content {
  @apply flex-1 overflow-y-auto p-4;
}

.status-card {
  @apply bg-white rounded-xl p-6 mb-6 flex items-center shadow-sm;
}

.icon-wrapper {
  @apply w-16 h-16 flex items-center justify-center bg-blue-50 rounded-full mr-4;
}

.status-info {
  @apply flex-1;
}

.section {
  @apply bg-white rounded-xl overflow-hidden mb-6 shadow-sm;
}

.section-title {
  @apply px-4 py-2 bg-gray-100 text-xs font-bold text-gray-500 uppercase;
}

.info-item {
  @apply flex justify-between items-center px-4 py-3 border-b border-gray-100 last:border-0;
  font-size: 0.9rem;
}

.actions {
  @apply flex flex-col gap-3;
}

.action-btn {
  @apply w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors;
}

.action-btn.primary {
  @apply bg-blue-500 text-white active:bg-blue-600 disabled:bg-blue-300;
}

.action-btn.secondary {
  @apply bg-white text-blue-500 border border-blue-200 active:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400;
}

.device-warning {
  @apply flex items-center justify-center gap-2 mt-4 p-3 rounded-lg text-sm;
  background-color: #FEF3CD;
  color: #856404;
}

.device-warning i {
  color: #F6C23E;
}
</style>
