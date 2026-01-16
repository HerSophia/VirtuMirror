<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  userId: string
}>()

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <div class="homepage-view">
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left" />
      </button>
      <h3>个人主页</h3>
      <div class="w-8" />
    </div>
    <div class="content">
      <p class="text-phone-gray-500 text-center py-10">用户主页 ({{ $props.userId }})</p>
    </div>
  </div>
</template>

<style scoped>
.homepage-view {
  @apply h-full flex flex-col;
  background-color: var(--color-background);
}

.content {
  @apply flex-1 overflow-y-auto;
}

.content p {
  color: var(--color-text-secondary);
}
</style>