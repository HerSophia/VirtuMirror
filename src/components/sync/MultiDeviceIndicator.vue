<template>
  <Transition name="fade">
    <div
      v-if="showIndicator"
      class="multi-device-indicator"
      @click="showDetail"
    >
      <span class="icon">📱</span>
      <span class="count">{{ deviceCount }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { deviceSyncManager } from '@/services/sync/deviceSync'
import type { DeviceStatus } from '@/services/sync/types'

const emit = defineEmits<{
  showDevices: [devices: DeviceStatus['otherDevices']]
}>()

const status = ref<DeviceStatus | null>(null)
const showIndicator = computed(() => status.value && !status.value.isOnlyDevice)
const deviceCount = computed(() => (status.value?.otherDevices.length ?? 0) + 1)

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = deviceSyncManager.subscribe((s) => {
    status.value = s
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

function showDetail() {
  if (status.value?.otherDevices) {
    emit('showDevices', status.value.otherDevices)
  }
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
  z-index: 1000;
  transition: background 0.2s;
}

.multi-device-indicator:hover {
  background: rgba(0, 0, 0, 0.8);
}

.count {
  background: #ff9800;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: bold;
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
