<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useFeedStore } from '../stores/feedStore';
import { loggerService } from '@/services/logger/loggerService';
import type { DisplayPost } from '@/types/social';
import WeiboPost from '../components/WeiboPost.vue';

const props = defineProps<{
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'view-post', postId: string): void;
}>();

const feedStore = useFeedStore();

const posts = ref<DisplayPost[]>([]);
const isLoading = ref(true);
const hasError = ref(false);

// 标题
const title = computed(() => {
  return props.authorName ? `${props.authorName}的微博` : '我的微博';
});

onMounted(async () => {
  await loadPosts();
});

async function loadPosts() {
  isLoading.value = true;
  hasError.value = false;
  
  try {
    posts.value = await feedStore.getPostsByAuthor(props.authorId);
  } catch (error) {
    loggerService.error('WeiboUserPosts', 'Failed to load posts:', error);
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
}

function handlePostClick(postId: string) {
  emit('view-post', postId);
}

function handleBack() {
  emit('back');
}
</script>

<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- 顶部导航栏 -->
    <header class="flex-none bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
      <button 
        @click="handleBack"
        class="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900"
      >
        <i class="fas fa-arrow-left"></i>
      </button>
      <h1 class="flex-1 text-lg font-medium text-gray-900">{{ title }}</h1>
      <span class="text-sm text-gray-500">{{ posts.length }}条微博</span>
    </header>

    <!-- 内容区 -->
    <main class="flex-1 overflow-y-auto">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="h-full flex items-center justify-center">
        <div class="text-gray-400 text-center">
          <i class="fas fa-spinner fa-spin text-2xl"></i>
          <p class="mt-2 text-sm">加载中...</p>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="hasError" class="h-full flex flex-col items-center justify-center p-6">
        <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <i class="fas fa-exclamation-triangle text-2xl text-red-400"></i>
        </div>
        <h3 class="text-lg font-medium text-gray-700 mb-2">加载失败</h3>
        <p class="text-sm text-gray-500 text-center mb-4">
          无法获取微博列表
        </p>
        <button
          @click="loadPosts"
          class="px-4 py-2 bg-orange-500 text-white rounded-full text-sm hover:bg-orange-600 transition-colors"
        >
          <i class="fas fa-redo mr-2"></i>重试
        </button>
      </div>

      <!-- 空状态 -->
      <div v-else-if="posts.length === 0" class="h-full flex flex-col items-center justify-center p-6">
        <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <i class="fas fa-feather-alt text-3xl text-gray-300"></i>
        </div>
        <h3 class="text-lg font-medium text-gray-600 mb-2">还没有微博</h3>
        <p class="text-sm text-gray-400 text-center">
          发布第一条微博，分享你的精彩生活
        </p>
      </div>

      <!-- 博文列表 -->
      <div v-else class="divide-y divide-gray-100">
        <div 
          v-for="post in posts" 
          :key="post.id"
          @click="handlePostClick(post.id)"
          class="cursor-pointer"
        >
          <WeiboPost :post="post" />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
</style>
