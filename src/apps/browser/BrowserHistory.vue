<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/browser')
}
</script>

<template>
  <div class="browser-history">
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left" />
      </button>
      <h3>浏览历史</h3>
      <div class="w-8" />
    </div>
    <div class="content">
      <p class="text-phone-gray-500 text-center py-10">浏览历史</p>
    </div>
  </div>
</template>

<style scoped>
.browser-history {
  @apply h-full flex flex-col bg-phone-gray-100;
}

.content {
  @apply flex-1 overflow-y-auto;
}
</style>