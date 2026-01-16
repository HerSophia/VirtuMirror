<template>
  <div v-if="isDev" class="queue-debug">
    <div class="header" @click="expanded = !expanded">
      <span class="title">📝 WriteQueue</span>
      <span class="badge" :class="{ active: state.isWriting }">
        {{ state.queueLength }}
      </span>
    </div>

    <div v-if="expanded" class="details">
      <div class="row">
        <span class="label">状态:</span>
        <span class="value" :class="{ writing: state.isWriting }">
          {{ state.isWriting ? '写入中' : '空闲' }}
        </span>
      </div>
      <div class="row">
        <span class="label">当前:</span>
        <span class="value">{{ state.currentSource || '-' }}</span>
      </div>
      <div class="row">
        <span class="label">队列:</span>
        <span class="value">{{ state.queueLength }}</span>
      </div>
      <div class="row">
        <span class="label">上次写入:</span>
        <span class="value">{{ formatTime(state.lastWriteAt) }}</span>
      </div>
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
  unsubscribe = writeQueue.subscribe((s) => {
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

<style scoped>
.queue-debug {
  position: fixed;
  bottom: 60px;
  right: 10px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  border-radius: 8px;
  font-size: 11px;
  font-family: monospace;
  z-index: 9999;
  overflow: hidden;
  min-width: 140px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
}

.header:hover {
  background: rgba(255, 255, 255, 0.1);
}

.title {
  font-weight: bold;
}

.badge {
  background: #666;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
}

.badge.active {
  background: #4caf50;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.details {
  padding: 8px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.label {
  color: #aaa;
}

.value {
  color: #fff;
}

.value.writing {
  color: #4caf50;
}
</style>
