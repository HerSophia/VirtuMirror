<script setup lang="ts">
import { ref, onMounted } from 'vue';
import WeiboPost from '../components/WeiboPost.vue';
import ComposePostDialog from '../components/ComposePostDialog.vue';
import DraftsDialog from '../components/DraftsDialog.vue';
import { useWeiboStore } from '@/stores/weiboStore';
import { loggerService } from '@/services/logger/loggerService';
import type { WeiboDraft } from '../types';
import { useLLMTaskStore } from '../stores';
import { storeToRefs } from 'pinia';

const currentTab = ref('follow'); // recommend, follow
const store = useWeiboStore();
const llmTaskStore = useLLMTaskStore();
const { displayPosts, stories, isLoading } = storeToRefs(store);

// 生成博文状态
const isGenerating = ref(false);

// 发博文对话框状态
const showComposeDialog = ref(false);
const showDraftsDialog = ref(false);
const selectedDraft = ref<WeiboDraft | null>(null);

onMounted(() => {
  // 初始化内置任务
  llmTaskStore.initializeBuiltinTasks();
  
  // Initial random refresh if empty or simulate live feel
  if (displayPosts.value.length <= 2) {
    store.refreshFeed();
  }
});

/**
 * 生成首页博文
 * 触发批量生成博文任务（只执行一次）
 */
async function handleGeneratePosts() {
  if (isGenerating.value) return;
  
  isGenerating.value = true;
  
  try {
    // 查找批量生成博文的内置任务
    // 新系统任务定义 ID 格式: weibo:batch-posts，builtinId 为 batch-posts
    const batchPostTask = llmTaskStore.builtinTasks.find(
      t => t.builtinId === 'batch-posts' || t.builtinId === 'weibo-batch-posts'
    );
    
    if (batchPostTask) {
      // 执行任务
      await llmTaskStore.executeTask(batchPostTask.id);
      // 刷新信息流以显示新生成的博文
      await store.refreshFeed();
    } else {
      loggerService.warn('WeiboHome', '未找到批量生成博文任务');
    }
  } catch (error) {
    loggerService.error('WeiboHome', '生成博文失败:', error);
  } finally {
    isGenerating.value = false;
  }
}

// 打开发博文对话框
function openComposeDialog() {
  selectedDraft.value = null;
  showComposeDialog.value = true;
}

// 打开草稿箱
function openDraftsDialog() {
  showComposeDialog.value = false;
  showDraftsDialog.value = true;
}

// 从草稿箱选择草稿
function handleSelectDraft(draft: WeiboDraft) {
  selectedDraft.value = draft;
  showDraftsDialog.value = false;
  showComposeDialog.value = true;
}

// 发布成功后的处理
function handlePostSuccess(postId: string) {
  showComposeDialog.value = false;
  // 如果有草稿，发布成功后删除草稿
  if (selectedDraft.value) {
    store.deleteDraft(selectedDraft.value.id);
    selectedDraft.value = null;
  }
  loggerService.info('WeiboHome', '博文发布成功:', postId);
}
</script>

<template>
  <div class="h-full flex flex-col bg-gray-100 overflow-hidden relative">
    <!-- Top Navigation -->
    <header class="flex-none bg-white px-3 py-2 flex items-center justify-between border-b border-gray-100 z-10">
      <!-- 生成博文按钮 -->
      <button 
        @click="handleGeneratePosts"
        :disabled="isGenerating"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        :class="isGenerating ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100 hover:text-orange-500'"
        title="生成博文"
      >
        <i :class="['fas', isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles']"></i>
      </button>
      
      <div class="flex items-center space-x-6 text-lg font-bold">
        <button 
          @click="currentTab = 'recommend'"
          :class="['transition-colors duration-200', currentTab === 'recommend' ? 'text-black text-xl border-b-2 border-orange-500 pb-1' : 'text-gray-400']"
        >
          推荐
        </button>
        <button 
          @click="currentTab = 'follow'"
          :class="['transition-colors duration-200 relative', currentTab === 'follow' ? 'text-black text-xl border-b-2 border-orange-500 pb-1' : 'text-gray-400']"
        >
          关注
          <!-- Small arrow usually here -->
          <span class="text-[10px] align-top ml-0.5 text-orange-500" v-if="currentTab === 'follow'">▼</span>
        </button>
      </div>

      <div class="flex items-center space-x-4 text-orange-500 text-xl">
        <i class="fas fa-gift"></i>
        <button @click="openComposeDialog" class="hover:scale-110 transition-transform">
          <i class="fas fa-plus-circle"></i>
        </button>
      </div>
    </header>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto hide-scrollbar">
      
      <!-- Stories (Only on Follow tab usually, but shown in image 2) -->
      <div v-if="currentTab === 'follow'" class="bg-white pt-3 pb-4 mb-2 overflow-x-auto whitespace-nowrap hide-scrollbar border-b border-gray-100">
        <div class="inline-flex px-4 space-x-4">
          <div v-for="story in stories" :key="story.id" class="flex flex-col items-center w-16">
            <div class="relative w-14 h-14 rounded-full p-[2px] border-2 border-orange-500">
              <img :src="story.avatar" class="w-full h-full rounded-full object-cover border border-white" />
              <div v-if="story.isLive" class="absolute bottom-0 right-0 bg-red-500 text-white text-[8px] px-1 rounded-full border border-white">
                LIVE
              </div>
            </div>
            <span class="mt-1 text-[10px] text-gray-600 truncate w-full text-center">{{ story.name }}</span>
          </div>
        </div>
      </div>

      <!-- Suggestion / Ad (Placeholder) -->
      <div class="bg-white p-3 mb-2 flex items-center justify-between text-sm text-gray-500">
        <span>你可能感兴趣的内容</span>
        <i class="fas fa-times text-gray-300"></i>
      </div>

      <!-- Feed -->
      <div class="pb-4">
        <div v-if="isLoading || isGenerating" class="text-center py-2 text-gray-400 text-xs">
          <i class="fas fa-spinner fa-spin mr-1"></i> 
          {{ isGenerating ? '正在生成博文...' : '刷新中...' }}
        </div>
        <WeiboPost v-for="post in displayPosts" :key="post.id" :post="post" />
      </div>
      
      <!-- Loading / End -->
      <div class="py-4 text-center text-gray-400 text-xs" @click="store.loadMore">
        {{ isLoading ? '加载中...' : '- 点击加载更多 -' }}
      </div>
    </div>
    
    <!-- 发博文对话框 -->
    <ComposePostDialog
      :visible="showComposeDialog"
      :initial-draft="selectedDraft"
      @close="showComposeDialog = false; selectedDraft = null"
      @posted="handlePostSuccess"
      @open-drafts="openDraftsDialog"
    />
    
    <!-- 草稿箱对话框 -->
    <DraftsDialog
      :visible="showDraftsDialog"
      @close="showDraftsDialog = false"
      @select="handleSelectDraft"
    />
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
