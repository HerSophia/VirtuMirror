<script setup lang="ts">
import { computed } from 'vue';
import type { RepostSnapshot, PrimaryContentType } from '@/types/social';
import { formatRelativeTime } from '@/types/social';

/**
 * WeiboRepost 组件
 * Phase 6：转发帖展示组件
 * 
 * 展示转发的原帖快照，遵循扁平化设计（只保存一层）
 * @see docs/systems/social-content-types.md
 */
const props = defineProps<{
  repost: RepostSnapshot;
}>();

// 原作者名称
const originalAuthorName = computed(() => props.repost.originalAuthor.name);

// 原作者头像
const originalAuthorAvatar = computed(() => {
  // 如果有 URL，否则生成占位图
  const avatar = props.repost.originalAuthor.avatar;
  if (avatar?.startsWith('http')) return avatar;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(originalAuthorName.value)}&background=random&size=40`;
});

// 原作者认证状态
const isVerified = computed(() => props.repost.originalAuthor.verified);

// 原帖内容（截断显示）
const originalText = computed(() => {
  const text = props.repost.originalContent.text || '';
  // 截断过长的内容
  if (text.length > 200) {
    return text.slice(0, 200) + '...';
  }
  return text;
});

// 原帖类型图标
const typeIcon = computed(() => {
  const type = props.repost.originalContent.primaryType;
  switch (type) {
    case 'video': return 'fa-video';
    case 'poll': return 'fa-poll';
    case 'gallery': return 'fa-images';
    case 'article': return 'fa-newspaper';
    case 'link': return 'fa-link';
    case 'audio': return 'fa-music';
    case 'live': return 'fa-broadcast-tower';
    default: return '';
  }
});

// 原帖类型标签文字
const typeLabel = computed(() => {
  const type = props.repost.originalContent.primaryType;
  switch (type) {
    case 'video': return '视频';
    case 'poll': return '投票';
    case 'gallery': return '图片';
    case 'article': return '文章';
    case 'link': return '链接';
    case 'audio': return '音频';
    case 'live': return '直播';
    default: return '';
  }
});

// 原帖时间
const originalTime = computed(() => {
  return formatRelativeTime(props.repost.originalContent.timestamp);
});

// 缩略图
const thumbnail = computed(() => {
  const thumb = props.repost.originalContent.thumbnail;
  if (!thumb) return null;
  if (thumb.startsWith('http')) return thumb;
  // 生成占位图
  return `https://via.placeholder.com/120x80?text=${encodeURIComponent(thumb.slice(0, 10))}`;
});

// 转发链信息
const repostChain = computed(() => props.repost.repostChain);

// 是否是多层转发
const isNestedRepost = computed(() => {
  return repostChain.value && repostChain.value.depth > 1;
});
</script>

<template>
  <div class="weibo-repost bg-gray-50 rounded-lg border border-gray-100 overflow-hidden mt-2">
    <!-- 原帖内容区域 -->
    <div class="p-3">
      <!-- 原作者信息 -->
      <div class="flex items-center mb-2">
        <img 
          :src="originalAuthorAvatar" 
          class="w-5 h-5 rounded-full mr-1.5 object-cover"
          :alt="originalAuthorName"
        />
        <span class="text-sm font-medium text-gray-700">@{{ originalAuthorName }}</span>
        <span 
          v-if="isVerified" 
          class="ml-1 text-yellow-500 text-xs"
          title="认证用户"
        >
          <i class="fas fa-check-circle"></i>
        </span>
        <span class="mx-1 text-gray-300">·</span>
        <span class="text-xs text-gray-400">{{ originalTime }}</span>
      </div>
      
      <!-- 转发链提示（多层转发时显示） -->
      <div 
        v-if="isNestedRepost" 
        class="text-xs text-gray-400 mb-2 flex items-center"
      >
        <i class="fas fa-retweet mr-1"></i>
        <span>第{{ repostChain?.depth }}层转发</span>
        <span v-if="repostChain?.rootAuthorName" class="ml-1">
          · 原作者 @{{ repostChain.rootAuthorName }}
        </span>
      </div>
      
      <!-- 原帖内容 -->
      <div class="flex">
        <div class="flex-1 min-w-0">
          <!-- 类型标签 -->
          <span 
            v-if="typeIcon && typeLabel"
            class="inline-flex items-center text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded mr-2 mb-1"
          >
            <i :class="['fas', typeIcon, 'mr-1 text-[10px]']"></i>
            {{ typeLabel }}
          </span>
          
          <!-- 文字内容 -->
          <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
            {{ originalText }}
          </p>
        </div>
        
        <!-- 缩略图 -->
        <div 
          v-if="thumbnail" 
          class="ml-3 flex-shrink-0"
        >
          <div class="w-16 h-16 rounded overflow-hidden bg-gray-200">
            <img 
              :src="thumbnail" 
              class="w-full h-full object-cover"
              alt="缩略图"
            />
            <!-- 视频播放图标 -->
            <div 
              v-if="typeIcon === 'fa-video'" 
              class="absolute inset-0 flex items-center justify-center"
            >
              <div class="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                <i class="fas fa-play text-white text-xs"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 原帖已删除的提示 -->
    <div 
      v-if="!originalText && !thumbnail" 
      class="p-3 text-center text-gray-400 text-sm"
    >
      <i class="fas fa-exclamation-circle mr-1"></i>
      原帖内容不可用
    </div>
  </div>
</template>

<style scoped>
.weibo-repost {
  position: relative;
}

.weibo-repost::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #f97316 0%, #fb923c 100%);
  border-radius: 3px 0 0 3px;
}
</style>
