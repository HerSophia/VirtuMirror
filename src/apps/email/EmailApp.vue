<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="email-app">
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left" />
      </button>
      <h3>邮箱</h3>
      <div class="w-8" />
    </div>
    <div class="content">
      <p class="text-phone-gray-500 text-center py-10">邮件列表</p>
    </div>
  </div>
</template>

<style scoped>
.email-app {
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