<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  boardId: string
  streamId: string
}>()

const router = useRouter()

function goBack() {
  router.push({ name: 'LiveStreamList', params: { boardId: props.boardId } })
}
</script>

<template>
  <div class="live-stream-room">
    <div class="app-header">
      <button class="app-back-btn" @click="goBack">
        <i class="fas fa-chevron-left" />
      </button>
      <h3>直播间</h3>
      <div class="w-8" />
    </div>
    <div class="content">
      <p class="text-phone-gray-500 text-center py-10">直播间 {{ streamId }}</p>
    </div>
  </div>
</template>

<style scoped>
.live-stream-room {
  @apply h-full flex flex-col bg-phone-gray-100;
}

.content {
  @apply flex-1 overflow-y-auto;
}
</style>