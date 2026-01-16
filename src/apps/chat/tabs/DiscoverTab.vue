<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ListItem } from '../components'

const router = useRouter()
</script>

<template>
  <div class="discover-list">
    <div class="group-section">
      <ListItem :show-arrow="true" @click="router.push('/moments')">
        <template #left>
          <div class="discover-icon">
            <img src="https://api.iconify.design/emojione:aperture.svg" class="w-6 h-6" />
          </div>
        </template>
        <template #content>
          <span class="item-title">朋友圈</span>
        </template>
      </ListItem>
    </div>

    <div class="group-section">
      <ListItem :show-arrow="true">
        <template #left>
          <div class="discover-icon text-yellow-500"><i class="fas fa-video"></i></div>
        </template>
        <template #content>
          <span class="item-title">视频号</span>
        </template>
      </ListItem>
    </div>

    <div class="group-section">
      <ListItem :show-arrow="true">
        <template #left>
          <div class="discover-icon text-blue-500"><i class="fas fa-qrcode"></i></div>
        </template>
        <template #content>
          <span class="item-title">扫一扫</span>
        </template>
      </ListItem>
      <ListItem :show-arrow="true">
        <template #left>
          <div class="discover-icon text-blue-500"><i class="fas fa-music"></i></div>
        </template>
        <template #content>
          <span class="item-title">听一听</span>
        </template>
      </ListItem>
    </div>

    <div class="group-section">
      <ListItem :show-arrow="true">
        <template #left>
          <div class="discover-icon text-red-500"><i class="fas fa-search"></i></div>
        </template>
        <template #content>
          <span class="item-title">搜一搜</span>
        </template>
      </ListItem>
    </div>
  </div>
</template>

<style scoped>
.discover-list {
  background-color: #ededed;
}

.group-section {
  @apply mt-2 bg-white;
}

.discover-icon {
  @apply w-6 h-6 flex items-center justify-center text-lg mr-3;
}

.item-title {
  @apply font-medium text-gray-900;
}
</style>