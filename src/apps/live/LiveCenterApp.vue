<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="live-center-app">
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left" />
      </button>
      <h3>直播中心</h3>
      <div class="w-8" />
    </div>
    <div class="content">
      <p class="text-phone-gray-500 text-center py-10">直播分类列表</p>
    </div>
  </div>
</template>

<style scoped>
.live-center-app {
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