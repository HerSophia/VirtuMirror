<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { usePhoneStore } from '@/stores/phoneStore'

const uiStore = useUIStore()
const phoneStore = usePhoneStore()

const unreadCount = computed(() => phoneStore.totalUnreadCount)
const showBadge = computed(() => unreadCount.value > 0)

function togglePanel() {
  uiStore.togglePanel()
}
</script>

<template>
  <button
    class="toggle-button"
    :class="{ active: uiStore.isPanelVisible }"
    @click="togglePanel"
    title="手机模拟器"
  >
    <i class="fas fa-mobile-alt" />
    <span v-if="showBadge" class="unread-badge">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </span>
  </button>
</template>

<style scoped>
.toggle-button {
  @apply fixed z-phone;
  @apply w-12 h-12 rounded-full;
  @apply bg-phone-primary text-white;
  @apply flex items-center justify-center;
  @apply shadow-lg cursor-pointer;
  @apply transition-all duration-200;
  @apply hover:scale-105;
  @apply active:scale-95;
  bottom: 20px;
  right: 20px;
}

.toggle-button:hover {
  opacity: 0.9;
}

.toggle-button.active {
  @apply bg-phone-secondary;
}

.toggle-button i {
  @apply text-xl;
}

.unread-badge {
  @apply absolute -top-1 -right-1;
  @apply min-w-[20px] h-5 px-1;
  @apply bg-phone-danger text-white text-xs font-bold;
  @apply rounded-full flex items-center justify-center;
}
</style>