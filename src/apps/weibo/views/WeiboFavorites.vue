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

const isEmpty = computed(() => !isLoading.value && posts.value.length === 0);

onMounted(async () => {
  await loadFavorites();
});

async function loadFavorites() {
  isLoading.value = true;
  try {
    const favoriteIds = userActionStore.getFavoritedPostIds();
    const loadedPosts: DisplayPost[] = [];
    
    for (const postId of favoriteIds) {
      const post = await feedStore.getPostById(postId);
      if (post) {
        loadedPosts.push(post);
      }
    }
    
    posts.value = loadedPosts;
  } catch (error) {
    loggerService.error('WeiboFavorites', 'Failed to load favorites:', error);
  } finally {
    isLoading.value = false;
  }
}

function handlePostDeleted(postId: string) {
  // 从列表中移除
  const index = posts.value.findIndex(p => p.id === postId);
  if (index !== -1) {
    posts.value.splice(index, 1);
  }
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
      <h1 class="flex-1 text-center text-base font-medium">我的收藏</h1>
      <div class="w-8"></div>
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
          <i class="fas fa-star text-2xl text-gray-300"></i>
        </div>
        <h3 class="text-base font-medium text-gray-600 mb-2">暂无收藏</h3>
        <p class="text-sm text-gray-400 text-center">
          浏览微博时点击收藏按钮，感兴趣的内容会出现在这里
        </p>
      </div>
      
      <!-- 收藏列表 -->
      <div v-else>
        <WeiboPost
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @deleted="handlePostDeleted"
        />
      </div>
    </main>
  </div>
</template>
