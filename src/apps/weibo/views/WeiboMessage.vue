<script setup lang="ts">
import { useWeiboStore } from '@/stores/weiboStore';
import { storeToRefs } from 'pinia';

const store = useWeiboStore();
const { messages, messageGrid } = storeToRefs(store);
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="px-4 py-3 flex items-center justify-between bg-white z-10 sticky top-0">
      <div class="flex items-center space-x-6 text-base text-gray-500 font-medium">
        <span>发现群</span>
        <span>动态</span>
        <div class="relative text-black text-xl font-bold flex flex-col items-center">
          <span>消息</span>
          <div class="w-4 h-1 bg-orange-500 rounded-full mt-1"></div>
        </div>
      </div>
      <div class="flex items-center space-x-4 text-gray-600 text-lg">
        <i class="fas fa-broom"></i>
        <i class="fas fa-cog"></i>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="px-4 pb-2">
      <div class="bg-gray-100 rounded-full py-1.5 px-4 flex items-center justify-center text-gray-400 text-sm">
        <i class="fas fa-search mr-2"></i>
        <span>搜索聊天记录、群号</span>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto hide-scrollbar">
      <!-- Grid Actions -->
      <div class="px-4 py-2">
        <div class="flex flex-col space-y-4">
          <div v-for="item in messageGrid" :key="item.id" class="flex items-center justify-between py-2 active:bg-gray-50 cursor-pointer">
            <div class="flex items-center">
              <div :class="[item.color, 'w-12 h-12 rounded-full flex items-center justify-center text-white text-xl mr-4']">
                <i v-if="item.id === 'at'" class="fas fa-at"></i>
                <i v-if="item.id === 'comment'" class="fas fa-comment-dots"></i>
                <i v-if="item.id === 'like'" class="fas fa-thumbs-up"></i>
              </div>
              <span class="text-lg text-gray-800">{{ item.title }}</span>
            </div>
            <i class="fas fa-chevron-right text-gray-300 text-sm"></i>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="h-2 bg-gray-50"></div>

      <!-- Message List -->
      <div class="pb-4">
        <div v-for="item in messages" :key="item.id" class="flex items-center px-4 py-3 active:bg-gray-50 cursor-pointer">
          <!-- Icon/Avatar -->
          <div class="relative w-12 h-12 mr-3 flex-shrink-0">
            <div v-if="item.avatar" class="w-full h-full rounded-full overflow-hidden border border-gray-100">
              <img :src="item.avatar" class="w-full h-full object-cover" />
              <!-- Verified badge simulation -->
              <div class="absolute bottom-0 right-0 bg-blue-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center border border-white">
                <i class="fas fa-check"></i>
              </div>
            </div>
            <div v-else :class="[item.iconColor || 'bg-blue-500', 'w-full h-full rounded-full flex items-center justify-center text-white text-xl']">
              <i v-if="item.icon === 'account-group'" class="fas fa-user-friends"></i>
              <i v-if="item.icon === 'message-text'" class="far fa-comment-alt"></i>
              <i v-if="item.icon === 'diamond'" class="far fa-gem"></i>
              <i v-else-if="!item.icon" class="fas fa-bell"></i>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0 border-b border-gray-50 pb-3">
            <div class="flex justify-between items-baseline mb-1">
              <span class="text-base font-medium text-gray-900">{{ item.title }}</span>
              <span class="text-xs text-gray-400">{{ item.time }}</span>
            </div>
            <div class="text-sm text-gray-500 truncate">{{ item.subtitle }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
