<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  emailId: string
}>()

const router = useRouter()

function goBack() {
  router.push('/email')
}
</script>

<template>
  <div class="email-detail">
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left" />
      </button>
      <h3>邮件详情</h3>
      <div class="w-8" />
    </div>
    <div class="content">
      <p class="text-phone-gray-500 text-center py-10">邮件详情 ({{ $props.emailId }})</p>
    </div>
  </div>
</template>

<style scoped>
.email-detail {
  @apply h-full flex flex-col bg-phone-gray-100;
}

.content {
  @apply flex-1 overflow-y-auto;
}
</style>