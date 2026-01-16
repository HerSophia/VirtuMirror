<template>
  <Transition name="slide">
    <div v-if="editingInfo" class="editing-banner">
      <span class="warning">⚠️ {{ editingInfo.byDevice }} 也在编辑这条数据</span>
      <button class="refresh-btn" @click="onRefresh">刷新</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { deviceSyncManager } from '@/services/sync/deviceSync'

const props = defineProps<{
  table: string
  dataKey: unknown
  checkInterval?: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const editingInfo = ref<{ byDevice: string } | null>(null)
let timer: number | null = null

async function checkEditing() {
  // 如果没有配置服务器，跳过检查
  const status = deviceSyncManager.getStatus()
  if (!status || status.isOnlyDevice) {
    editingInfo.value = null
    return
  }

  try {
    // 这里可以调用服务端 API 检查编辑状态
    // 目前简化实现：如果有其他设备在线，显示提示
    // 实际项目中应该调用: POST /api/v2/sync/check-editing
    
    // 暂时不实现实际检查，因为需要服务端 API
    editingInfo.value = null
  } catch (e) {
    console.error('[EditingBanner] 检查编辑状态失败:', e)
  }
}

function onRefresh() {
  emit('refresh')
}

function startPolling() {
  checkEditing()
  const interval = props.checkInterval ?? 5000
  timer = window.setInterval(checkEditing, interval)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

// 监听数据变化，重新检查
watch(
  () => [props.table, props.dataKey],
  () => {
    checkEditing()
  }
)
</script>

<style scoped>
.editing-banner {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border-left: 4px solid #ff9800;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.warning {
  color: #e65100;
}

.refresh-btn {
  background: #ff9800;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.refresh-btn:hover {
  background: #f57c00;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
