<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  boardId: string
}>()

const router = useRouter()

function goBack() {
  router.push('/live')
}
</script>

<template>
  <div class="live-stream-list">
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left" />
      </button>
      <h3>直播列表</h3>
      <div class="w-8" />
    </div>
    <div class="content">
      <p class="text-phone-gray-500 text-center py-10">分类 {{ $props.boardId }} 的直播列表</p>
    </div>
  </div>
</template>

<style scoped>
.live-stream-list {
  @apply h-full flex flex-col bg-phone-gray-100;
}

.content {
  @apply flex-1 overflow-y-auto;
}
</style>