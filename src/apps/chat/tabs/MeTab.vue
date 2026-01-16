<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import { ListItem } from '../components'

const router = useRouter()
const uiStore = useUIStore()
</script>

<template>
  <div class="me-view">
    <div class="me-profile">
      <img
        :src="uiStore.customization.playerAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=player'"
        class="me-avatar"
      />
      <div class="me-info">
        <div class="me-name">{{ uiStore.customization.playerNickname }}</div>
        <div class="me-row">
          <span class="me-id">微信号: player001</span>
          <i class="fas fa-qrcode ml-2 text-gray-400 text-xs"></i>
        </div>
        <div class="me-status">
          <span class="status-pill">+ 状态</span>
        </div>
      </div>
      <i class="fas fa-chevron-right arrow-icon text-gray-400" />
    </div>

    <div class="group-section">
      <ListItem
        icon-class="fas fa-concierge-bell"
        icon-bg-color="#22c55e"
        icon-color="#fff"
        title="服务"
        :show-arrow="true"
        @click="router.push('/chat/services')"
      />
    </div>

    <div class="group-section">
      <ListItem
        icon-class="fas fa-cube"
        icon-bg-color="#f97316"
        icon-color="#fff"
        title="收藏"
        :show-arrow="true"
      />
      <ListItem
        icon-class="fas fa-image"
        icon-bg-color="#3b82f6"
        icon-color="#fff"
        title="相册"
        :show-arrow="true"
      />
      <ListItem
        icon-class="fas fa-smile"
        icon-bg-color="#eab308"
        icon-color="#fff"
        title="表情"
        :show-arrow="true"
      />
    </div>

    <div class="group-section">
      <ListItem
        icon-class="fas fa-cog"
        icon-bg-color="#2563eb"
        icon-color="#fff"
        title="设置"
        :show-arrow="true"
        @click="router.push('/settings')"
      />
    </div>
  </div>
</template>

<style scoped>
.me-view {
  background-color: #ededed;
}

.me-profile {
  @apply flex items-center gap-4 p-6 bg-white mt-0 mb-2;
  padding-top: 40px;
}

.me-avatar {
  @apply w-16 h-16 rounded-lg;
}

.me-info {
  @apply flex-1 flex flex-col gap-1;
}

.me-name {
  @apply text-xl font-semibold text-black;
}

.me-row {
  @apply flex items-center;
}

.me-id {
  @apply text-sm text-gray-500;
}

.me-status {
  @apply mt-1;
}

.status-pill {
  @apply text-xs border border-gray-300 rounded-full px-2 py-0.5 text-gray-500 inline-block;
}

.group-section {
  @apply mt-2 bg-white;
}

.arrow-icon {
  @apply text-gray-400 text-xs ml-auto;
}
</style>