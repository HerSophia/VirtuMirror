<script setup lang="ts">
import { computed } from 'vue'
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()

const currentTime = computed(() => timeStore.formatTime(timeStore.currentTime))
</script>

<template>
  <div class="status-bar" @mousedown.prevent>
    <div class="status-bar-left">
      <span class="status-time">{{ currentTime }}</span>
    </div>
    <div class="status-bar-right">
      <i class="fas fa-signal" />
      <i class="fas fa-wifi" />
      <i class="fas fa-battery-three-quarters" />
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  @apply relative h-[44px] px-6 flex-shrink-0;
  @apply flex items-center justify-between z-40;
  @apply bg-transparent text-white text-xs font-medium;
  @apply cursor-grab select-none;
}

.status-bar:active {
  @apply cursor-grabbing;
}

.status-bar-left {
  @apply flex items-center gap-1;
}

.status-bar-right {
  @apply flex items-center gap-2;
}

.status-time {
  @apply font-semibold;
}

.status-bar i {
  @apply text-sm;
}
</style>
