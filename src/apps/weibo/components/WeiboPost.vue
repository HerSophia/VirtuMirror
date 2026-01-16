<script setup lang="ts">
import type { DisplayPost } from '@/types/social';
import { ref, computed, onMounted, watch, toRef } from 'vue';
import { useRouter } from 'vue-router';
import { useWeiboStore } from '@/stores/weiboStore';
import { useAccountStore } from '@/stores/accountStore';
import { useFeedStore, useUserActionStore } from '../stores';
import { usePostDisplay } from '../composables';
import PostActionSheet from './PostActionSheet.vue';
import WeiboPoll from './WeiboPoll.vue';
import WeiboVideo from './WeiboVideo.vue';
import WeiboRepost from './WeiboRepost.vue';

/**
 * WeiboPost 组件
 * Phase 3 重构：统一使用 DisplayPost 类型
 */
const props = defineProps<{
  post: DisplayPost
}>();

const emit = defineEmits<{
  (e: 'edit', post: DisplayPost): void;
  (e: 'deleted', postId: string): void;
}>();

const router = useRouter();
const store = useWeiboStore();
const feedStore = useFeedStore();
const accountStore = useAccountStore();
const userActionStore = useUserActionStore();

// 使用 usePostDisplay composable
const postRef = toRef(props, 'post');
const { formattedContent, primaryType, poll: computedPoll, video: computedVideo, repost: computedRepost, isRepost } = usePostDisplay(postRef);

// ==================== 直接使用 DisplayPost 属性 ====================

/** 作者 ID */
const authorId = computed(() => props.post.author.id);

/** 作者名称 */
const authorName = computed(() => props.post.author.name);

/** 作者头像 */
const authorAvatar = computed(() => props.post.author.avatar);

/** 认证状态 */
const authorVerified = computed(() => props.post.author.verified);

/** VIP 等级 */
const authorVipLevel = computed(() => props.post.author.vipLevel);

/** 时间显示 */
const displayTimeValue = computed(() => props.post.displayTime);

/** 来源 */
const source = computed(() => props.post.meta?.source || '微博网页版');

/** 内容 */
const content = computed(() => props.post.payload.text || '');

/** 图片列表 */
const images = computed(() => props.post.imageUrls);

/** 点赞数 */
const likes = computed(() => props.post.stats.likes);

/** 评论数 */
const comments = computed(() => props.post.stats.comments);

/** 转发数 */
const shares = computed(() => props.post.stats.shares);

/** 关注状态 */
const isFollowingAuthor = computed(() => props.post.isFollowing);

/** 博文类型 */
const postType = computed(() => primaryType.value);

/** 投票数据 */
const pollData = computed(() => computedPoll.value);

/** 视频数据 */
const videoData = computed(() => computedVideo.value);

/** 转发快照数据 */
const repostData = computed(() => computedRepost.value);

// ==================== 原有逻辑 ====================

// 操作菜单状态
const showActionSheet = ref(false);
const isActionLoading = ref(false);

// 检查是否是自己的博文（异步获取）
const isOwner = ref(false);

// 点赞和收藏状态
const isLiked = computed(() => userActionStore.isLiked(props.post.id));
const isFavorited = computed(() => userActionStore.isFavorited(props.post.id));
const displayLikes = computed(() => {
  const baseLikes = likes.value || 0;
  // 如果用户点赞了，显示 +1
  return isLiked.value ? baseLikes + 1 : baseLikes;
});

async function checkOwnership() {
  try {
    const playerAccount = await accountStore.getPlayerAccountForPlatform('weibo');
    isOwner.value = playerAccount?.id === authorId.value;
  } catch (e) {
    isOwner.value = false;
  }
}

onMounted(() => {
  checkOwnership();
});

// 当 post 改变时重新检查
watch(authorId, () => {
  checkOwnership();
});

function goToDetail() {
  router.push({
    name: 'WeiboPostDetail',
    params: { postId: props.post.id }
  });
}

// 操作菜单处理
function openActionSheet(e: Event) {
  e.stopPropagation();
  showActionSheet.value = true;
}

function closeActionSheet() {
  showActionSheet.value = false;
}

// 编辑博文
function handleEdit() {
  closeActionSheet();
  emit('edit', props.post);
}

// 删除博文
async function handleDelete() {
  if (!confirm('确定要删除这条微博吗？删除后无法恢复。')) {
    return;
  }
  
  isActionLoading.value = true;
  try {
    const success = await feedStore.deletePost(props.post.id);
    if (success) {
      closeActionSheet();
      emit('deleted', props.post.id);
    } else {
      alert('删除失败，请重试');
    }
  } finally {
    isActionLoading.value = false;
  }
}

// 生成互动
async function handleGenerateEngagement() {
  isActionLoading.value = true;
  try {
    // 获取博主信息
    const account = await accountStore.getAccountById(authorId.value);
    const platformData = (account?.platformData as any)?.weibo || {};
    
    await feedStore.generatePostEngagement(
      props.post.id,
      content.value,
      {
        name: authorName.value,
        bio: account?.bioOverride || '',
        followerCount: platformData.followers || 100,
        accountType: platformData.verified ? '认证用户' : '普通用户',
      }
    );
    
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
  isActionLoading.value = true;
  try {
    const result = await feedStore.generateCommentsForPost(props.post.id, 5);
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
  navigator.clipboard.writeText(content.value).then(() => {
    closeActionSheet();
    alert('内容已复制');
  }).catch(() => {
    alert('复制失败');
  });
}

// 复制博文 ID
function handleCopyId() {
  navigator.clipboard.writeText(props.post.id).then(() => {
    closeActionSheet();
    alert('博文ID已复制: ' + props.post.id);
  }).catch(() => {
    alert('复制失败');
  });
}

// 处理投票
function handleVote(optionIds: string[]) {
  console.log('[WeiboPost] 投票:', props.post.id, optionIds);
  // TODO: 保存投票到数据库
}

// 处理点赞
function handleLike(e: Event) {
  e.stopPropagation();
  userActionStore.toggleLike(props.post.id, 'post');
}

// 处理收藏（通过操作菜单）
function handleFavorite() {
  userActionStore.toggleFavorite(props.post.id);
  closeActionSheet();
}
</script>

<template>
  <div class="bg-white mb-2 pb-2 border-b border-gray-100">
    <!-- Header -->
    <div class="flex justify-between items-start px-4 pt-4 mb-2">
      <div class="flex items-center">
        <div class="relative w-10 h-10 mr-3">
          <img 
            :src="authorAvatar" 
            class="w-full h-full rounded-full object-cover border border-gray-100" 
          />
          <div v-if="authorVerified" class="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white text-[10px] text-white">
            <i class="fas fa-check"></i>
          </div>
        </div>
        <div>
          <div class="flex items-center">
            <span class="font-bold text-[15px] text-[#333] mr-1">{{ authorName }}</span>
            <span v-if="authorVipLevel" class="text-yellow-500 text-xs">
              <i class="fas fa-crown"></i>
            </span>
          </div>
          <div class="text-[11px] text-gray-400 flex items-center">
            <span>{{ displayTimeValue }}</span>
            <span v-if="source" class="mx-1">·</span>
            <span v-if="source">{{ source }}</span>
          </div>
        </div>
      </div>
      
      <!-- 右侧按钮区域 -->
      <div class="flex items-center space-x-2">
        <!-- Follow Button -->
        <button 
          v-if="!isFollowingAuthor && !isOwner" 
          @click.stop="store.followUser(authorId)"
          class="text-orange-500 border border-orange-500 rounded-full px-3 py-0.5 text-xs font-medium flex items-center bg-white hover:bg-orange-50"
        >
          <i class="fas fa-plus mr-1 text-[10px]"></i>关注
        </button>
        <button 
          v-else-if="!isOwner" 
          class="text-gray-400 border border-gray-300 rounded-full px-3 py-0.5 text-xs font-medium bg-white"
        >
          已关注
        </button>
        
        <!-- 三点菜单按钮 -->
        <button
          @click="openActionSheet"
          class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          title="更多操作"
        >
          <i class="fas fa-ellipsis-h"></i>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="px-4 mb-2 text-[15px] text-[#333] leading-relaxed whitespace-pre-wrap" v-html="formattedContent" @click="goToDetail"></div>

    <!-- Poll -->
    <div v-if="postType === 'poll' && pollData" class="px-4 mb-3">
      <WeiboPoll 
        :poll="pollData" 
        :post-id="post.id"
        @vote="handleVote"
      />
    </div>

    <!-- Video -->
    <div v-if="postType === 'video' && videoData" class="px-4 mb-3" @click="goToDetail">
      <WeiboVideo :video="videoData" />
    </div>

    <!-- Repost 转发 -->
    <div v-if="isRepost && repostData" class="px-4 mb-3" @click="goToDetail">
      <WeiboRepost :repost="repostData" />
    </div>

    <!-- Images (for text posts or additional images) -->
    <div v-if="images && images.length > 0 && postType !== 'video'" class="px-4 mb-3" @click="goToDetail">
      <!-- Single Image -->
      <div v-if="images.length === 1" class="rounded-lg overflow-hidden max-h-64 w-2/3">
        <img :src="images[0]" class="w-full h-full object-cover bg-gray-100" />
      </div>
      <!-- Grid Images (Simplified 3 cols) -->
      <div v-else class="grid grid-cols-3 gap-1">
        <div v-for="(img, idx) in images" :key="idx" class="aspect-square bg-gray-100">
          <img :src="img" class="w-full h-full object-cover" />
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="flex items-center justify-between px-4 border-t border-gray-50 pt-2 text-gray-600">
      <button class="flex-1 flex items-center justify-center text-sm active:text-gray-400">
        <i class="fas fa-share mr-1.5 text-lg transform flip-horizontal"></i>
        <span>{{ shares || '转发' }}</span>
      </button>
      <button class="flex-1 flex items-center justify-center text-sm active:text-gray-400 border-l border-gray-100" @click.stop="goToDetail">
        <i class="far fa-comment-dots mr-1.5 text-lg"></i>
        <span>{{ comments || '评论' }}</span>
      </button>
      <button 
        class="flex-1 flex items-center justify-center text-sm border-l border-gray-100 transition-colors"
        :class="isLiked ? 'text-red-500' : 'text-gray-600 active:text-gray-400'"
        @click="handleLike"
      >
        <i :class="[isLiked ? 'fas' : 'far', 'fa-thumbs-up mr-1.5 text-lg']"></i>
        <span>{{ displayLikes || '赞' }}</span>
      </button>
    </div>
  </div>
  
  <!-- 操作菜单 -->
  <PostActionSheet
    :visible="showActionSheet"
    :post="post"
    :is-owner="isOwner"
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
.flip-horizontal {
  transform: scaleX(-1);
}
</style>
