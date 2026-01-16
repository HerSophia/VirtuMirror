<script setup lang="ts">
import { computed } from 'vue'
import { useStagedActionsStore } from '@/stores/stagedActionsStore'

const stagedActionsStore = useStagedActionsStore()

const actionCount = computed(() => stagedActionsStore.count)
const showButton = computed(() => stagedActionsStore.hasActions)

async function handleCommit() {
  const formatted = await stagedActionsStore.commitActions()
  if (formatted) {
    console.log('[CommitButton] Actions committed:', formatted)
  }
}
</script>

<template>
  <Transition name="bounce">
    <button
      v-if="showButton"
      class="commit-button"
      @click="handleCommit"
      title="提交操作"
    >
      <i class="fas fa-paper-plane" />
      <span class="action-count">{{ actionCount }}</span>
    </button>
  </Transition>
</template>

<style scoped>
.commit-button {
  @apply fixed z-phone;
  @apply w-14 h-14 rounded-full;
  @apply bg-wechat-green text-white;
  @apply flex items-center justify-center;
  @apply shadow-lg cursor-pointer;
  @apply transition-all duration-200;
  @apply hover:bg-wechat-green/90 hover:scale-105;
  @apply active:scale-95;
  bottom: 80px;
  right: 20px;
}

.commit-button i {
  @apply text-xl;
}

.action-count {
  @apply absolute -top-1 -right-1;
  @apply min-w-[22px] h-[22px] px-1;
  @apply bg-phone-danger text-white text-xs font-bold;
  @apply rounded-full flex items-center justify-center;
}

/* 动画 */
.bounce-enter-active {
  animation: bounceIn 0.4s ease-out;
}

.bounce-leave-active {
  animation: bounceOut 0.3s ease-in;
}

@keyframes bounceIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes bounceOut {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(0);
    opacity: 0;
  }
}
</style>