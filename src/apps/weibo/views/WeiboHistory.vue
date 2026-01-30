<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useFeedStore, useUserActionStore } from '../stores';
import type { DisplayPost } from '@/types/social';
import WeiboPost from '../components/WeiboPost.vue';
import { loggerService } from '@/services/logger/loggerService';

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'view-post', postId: string): void;
}>();

const feedStore = useFeedStore();
const userActionStore = useUserActionStore();

const posts = ref<DisplayPost[]>([]);
const isLoading = ref(true);
const showClearConfirm = ref(false);

const isEmpty = computed(() => !isLoading.value && posts.value.length === 0);

onMounted(async () => {
  await loadHistory();
});

async function loadHistory() {
  isLoading.value = true;
  try {
    const historyIds = userActionStore.getViewHistoryPostIds();
    const loadedPosts: DisplayPost[] = [];
    
    for (const postId of historyIds) {
      const post = await feedStore.getPostById(postId);
      if (post) {
        loadedPosts.push(post);
      }
    }
    
    posts.value = loadedPosts;
  } catch (error) {
    loggerService.error('WeiboHistory', 'Failed to load history:', error);
  } finally {
    isLoading.value = false;
  }
}

function handleClearHistory() {
  showClearConfirm.value = true;
}

function confirmClear() {
  userActionStore.clearViewHistory();
  posts.value = [];
  showClearConfirm.value = false;
}

function handlePostDeleted(postId: string) {
  const index = posts.value.findIndex(p => p.id === postId);
  if (index !== -1) {
    posts.value.splice(index, 1);
  }
  // 同时从历史记录中删除
  userActionStore.removeViewHistory(postId);
}
</script>

<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- 顶部导航栏 -->
    <header class="flex-none bg-white border-b border-gray-100 px-4 py-3 flex items-center">
      <button 
        @click="emit('back')"
        class="w-8 h-8 flex items-center justify-center text-gray-600 -ml-2"
      >
        <i class="fas fa-arrow-left"></i>
      </button>
      <h1 class="flex-1 text-center text-base font-medium">浏览历史</h1>
      <button 
        v-if="posts.length > 0"
        @click="handleClearHistory"
        class="text-sm text-gray-500 hover:text-orange-500"
      >
        清空
      </button>
      <div v-else class="w-8"></div>
    </header>
    
    <!-- 内容区域 -->
    <main class="flex-1 overflow-y-auto">
      <!-- 加载中 -->
      <div v-if="isLoading" class="h-full flex items-center justify-center">
        <div class="text-gray-400">
          <i class="fas fa-spinner fa-spin text-2xl"></i>
          <p class="mt-2 text-sm">加载中...</p>
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="isEmpty" class="h-full flex flex-col items-center justify-center p-6">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <i class="fas fa-history text-2xl text-gray-300"></i>
        </div>
        <h3 class="text-base font-medium text-gray-600 mb-2">暂无浏览记录</h3>
        <p class="text-sm text-gray-400 text-center">
          浏览过的微博会出现在这里
        </p>
      </div>
      
      <!-- 历史列表 -->
      <div v-else>
        <WeiboPost
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @deleted="handlePostDeleted"
        />
      </div>
    </main>
    
    <!-- 清空确认弹窗 -->
    <Teleport to="body">
      <div 
        v-if="showClearConfirm"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="showClearConfirm = false"
      >
        <div class="bg-white rounded-xl w-72 overflow-hidden">
          <div class="p-6 text-center">
            <h3 class="text-base font-medium text-gray-800 mb-2">清空浏览历史</h3>
            <p class="text-sm text-gray-500">确定要清空所有浏览历史吗？此操作无法撤销。</p>
          </div>
          <div class="border-t border-gray-100 flex">
            <button 
              @click="showClearConfirm = false"
              class="flex-1 py-3 text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button 
              @click="confirmClear"
              class="flex-1 py-3 text-orange-500 font-medium hover:bg-orange-50 border-l border-gray-100"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
