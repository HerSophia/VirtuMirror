<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWeiboStore } from '@/stores/weiboStore';
import { useAccountStore } from '@/stores/accountStore';
import { useFeedStore, useUserActionStore } from '../stores';
import WeiboPost from '../components/WeiboPost.vue';
import PostActionSheet from '../components/PostActionSheet.vue';
import type { DisplayPost } from '@/types/social';
import type { WeiboCommentUI, WeiboPlatformData } from '../types';

const props = defineProps<{
  postId: string
}>();

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const router = useRouter();
const store = useWeiboStore();
const feedStore = useFeedStore();
const accountStore = useAccountStore();
const userActionStore = useUserActionStore();

const post = ref<DisplayPost | undefined>(undefined);
const comments = ref<WeiboCommentUI[]>([]);
const isLoadingComments = ref(false);

// 操作菜单状态
const showActionSheet = ref(false);
const isActionLoading = ref(false);

// 检查是否是自己的博文
const isOwnerAsync = ref(false);

// 收藏状态
const isFavorited = computed(() => post.value ? userActionStore.isFavorited(post.value.id) : false);

onMounted(async () => {
  // Load post
  post.value = await feedStore.getPostById(props.postId);
  
  if (post.value) {
    // 检查是否是自己的博文
    const playerAccount = await accountStore.getPlayerAccountForPlatform('weibo');
    isOwnerAsync.value = playerAccount?.id === post.value.author.id;
    
    // 记录浏览历史
    userActionStore.addViewHistory(props.postId);
    
    // Load comments
    loadComments();
  }
});

async function loadComments() {
  if (!post.value) return;
  isLoadingComments.value = true;
  comments.value = await store.getCommentsForPost(post.value.id);
  isLoadingComments.value = false;
}

function goBack() {
  // 优先使用 emit，如果有父组件监听的话
  emit('back');
  // 兼容路由模式
  // router.back();
}

// 打开操作菜单
function openActionSheet() {
  showActionSheet.value = true;
}

function closeActionSheet() {
  showActionSheet.value = false;
}

// 编辑博文
function handleEdit() {
  closeActionSheet();
  // TODO: 打开编辑对话框
  alert('编辑功能开发中...');
}

// 删除博文
async function handleDelete() {
  if (!post.value) return;
  if (!confirm('确定要删除这条微博吗？删除后无法恢复。')) {
    return;
  }
  
  isActionLoading.value = true;
  try {
    const success = await feedStore.deletePost(post.value.id);
    if (success) {
      closeActionSheet();
      emit('back');
    } else {
      alert('删除失败，请重试');
    }
  } finally {
    isActionLoading.value = false;
  }
}

// 生成互动
async function handleGenerateEngagement() {
  if (!post.value) return;
  
  isActionLoading.value = true;
  try {
    const account = await accountStore.getAccountById(post.value.author.id);
    const platformData = (account?.platformData as Record<string, WeiboPlatformData> | undefined)?.weibo;
    
    await feedStore.generatePostEngagement(
      post.value.id,
      post.value.payload.text || '',
      {
        name: post.value.author.name,
        bio: account?.bioOverride || '',
        followerCount: platformData?.followers || 100,
        accountType: platformData?.verified ? '认证用户' : '普通用户',
      }
    );
    
    // 重新加载评论
    await loadComments();
    
    closeActionSheet();
    alert('互动生成完成！');
  } catch (error) {
    console.error('生成互动失败:', error);
    alert('生成互动失败，请重试');
  } finally {
    isActionLoading.value = false;
  }
}

// 生成评论
async function handleGenerateComments() {
  if (!post.value) return;
  
  isActionLoading.value = true;
  try {
    const result = await feedStore.generateCommentsForPost(post.value.id, 5);
    
    // 重新加载评论
    await loadComments();
    
    closeActionSheet();
    if (result.success) {
      alert(`已生成 ${result.count} 条评论！`);
    } else {
      alert('生成评论失败，请重试');
    }
  } catch (error) {
    console.error('生成评论失败:', error);
    alert('生成评论失败，请重试');
  } finally {
    isActionLoading.value = false;
  }
}

// 复制内容
function handleCopyContent() {
  if (!post.value) return;
  navigator.clipboard.writeText(post.value.payload.text || '').then(() => {
    closeActionSheet();
    alert('内容已复制');
  }).catch(() => {
    alert('复制失败');
  });
}

// 复制博文 ID
function handleCopyId() {
  if (!post.value) return;
  navigator.clipboard.writeText(post.value.id).then(() => {
    closeActionSheet();
    alert('博文ID已复制: ' + post.value!.id);
  }).catch(() => {
    alert('复制失败');
  });
}

// 收藏/取消收藏
function handleFavorite() {
  if (!post.value) return;
  userActionStore.toggleFavorite(post.value.id);
  closeActionSheet();
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <header class="flex-none bg-white px-3 py-2 flex items-center border-b border-gray-100 z-10">
      <button @click="goBack" class="mr-4 text-gray-600">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="font-bold text-lg">微博正文</div>
      <div class="flex-1"></div>
      <button 
        v-if="post"
        @click="openActionSheet"
        class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
      >
        <i class="fas fa-ellipsis-h"></i>
      </button>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto hide-scrollbar">
      <div v-if="post">
        <WeiboPost :post="post" />
        
        <!-- Comments Section -->
        <div class="border-t border-gray-100 mt-2">
          <div class="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
            <span class="font-bold text-sm">评论 {{ post.stats.comments }}</span>
            <div class="flex text-xs text-gray-400 space-x-3">
              <span class="text-orange-500 font-bold">按热度</span>
              <span>按时间</span>
            </div>
          </div>

          <div v-if="isLoadingComments" class="py-8 text-center text-gray-400 text-sm">
            <i class="fas fa-spinner fa-spin mr-1"></i> 加载评论中...
          </div>
          
          <div v-else-if="comments.length === 0" class="py-10 text-center">
            <div class="text-gray-400 text-sm mb-3">暂无评论，快来抢沙发吧~</div>
            <button
              @click="handleGenerateComments"
              class="px-4 py-2 bg-orange-500 text-white text-sm rounded-full hover:bg-orange-600 transition-colors"
            >
              <i class="fas fa-magic mr-1"></i> AI 生成评论
            </button>
          </div>

          <div v-else>
            <div v-for="comment in comments" :key="comment.id" class="flex px-4 py-3 border-b border-gray-50">
              <img :src="comment.user.avatar" class="w-8 h-8 rounded-full mr-3 border border-gray-100">
              <div class="flex-1">
                <div class="flex justify-between items-start">
                  <div class="text-sm font-bold text-orange-600">{{ comment.user.name }}</div>
                  <div class="text-xs text-gray-400 flex items-center">
                    <i class="far fa-thumbs-up mr-1"></i> {{ comment.likes }}
                  </div>
                </div>
                <div class="text-sm text-gray-800 mt-1 leading-normal">{{ comment.content }}</div>
                <div class="text-xs text-gray-400 mt-2 flex space-x-3">
                  <span>{{ comment.time }}</span>
                  <span>回复</span>
                </div>
                
                <!-- Nested Replies (Simplified) -->
                <div v-if="comment.replies && comment.replies.length > 0" class="mt-2 bg-gray-50 p-2 rounded text">
                  <div v-for="reply in comment.replies" :key="reply.id" class="mb-1">
                    <span class="font-bold text-blue-600">{{ reply.user.name }}</span>: 
                    <span class="text-gray-700">{{ reply.content }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 加载更多评论按钮 -->
            <div class="py-4 text-center">
              <button
                @click="handleGenerateComments"
                class="px-4 py-2 text-orange-500 text-sm hover:bg-orange-50 rounded-full transition-colors"
              >
                <i class="fas fa-plus mr-1"></i> 生成更多评论
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="py-20 text-center text-gray-400">
        博文不存在或已删除
      </div>
    </div>
    
    <!-- Footer Input -->
    <div class="flex-none bg-white border-t border-gray-100 px-3 py-2 flex items-center">
      <div class="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-500 mr-3">
        写评论...
      </div>
      <div class="flex space-x-4 text-gray-500 text-lg px-1">
        <i class="far fa-comment-dots"></i>
        <i class="far fa-star"></i>
        <i class="far fa-thumbs-up"></i>
      </div>
    </div>
  </div>
  
  <!-- 操作菜单 -->
  <PostActionSheet
    v-if="post"
    :visible="showActionSheet"
    :post="post"
    :is-owner="isOwnerAsync"
    :is-favorited="isFavorited"
    :loading="isActionLoading"
    @close="closeActionSheet"
    @edit="handleEdit"
    @delete="handleDelete"
    @generate-engagement="handleGenerateEngagement"
    @generate-comments="handleGenerateComments"
    @copy-content="handleCopyContent"
    @copy-id="handleCopyId"
    @favorite="handleFavorite"
  />
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
