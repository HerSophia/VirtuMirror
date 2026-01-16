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
    case 'sync':
      return '正在同步...'
    case 'system':
      return '系统更新...'
    default:
      return '保存中...'
  }
})

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = writeQueue.subscribe((s) => {
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
  pointer-events: none;
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
  to {
    transform: rotate(360deg);
  }
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
