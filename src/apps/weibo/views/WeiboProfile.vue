<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useWeiboStore } from '@/stores/weiboStore';
import { loggerService } from '@/services/logger/loggerService';
import { useFeedStore, useUserActionStore } from '../stores';
import type { FullProfile } from '@/types/account';
import { getVerifyTypeConfig, type WeiboVerifyType } from '../types';

const accountStore = useAccountStore();
const notificationStore = useNotificationStore();
const weiboStore = useWeiboStore();
const feedStore = useFeedStore();
const userActionStore = useUserActionStore();

// 玩家的微博账号
const playerProfile = ref<FullProfile | null>(null);
const currentAccountId = ref<string | null>(null);
const isLoading = ref(true);
const hasError = ref(false);

// 统计数据
const stats = ref({
  posts: 0,
  following: 0,
  followers: 0,
});

// 草稿数量
const draftsCount = computed(() => weiboStore.getDraftCount());

// 收藏、点赞、浏览历史数量
const favoritesCount = computed(() => userActionStore.favoriteCount);
const likesCount = computed(() => userActionStore.likeCount);
const historyCount = computed(() => userActionStore.viewHistoryCount);

// 菜单项
const menuItems = computed(() => [
  { icon: 'fa-star', label: '收藏', badge: favoritesCount.value > 0 ? String(favoritesCount.value) : '', action: 'favorites' },
  { icon: 'fa-heart', label: '赞', badge: likesCount.value > 0 ? String(likesCount.value) : '', action: 'likes' },
  { icon: 'fa-history', label: '浏览历史', badge: historyCount.value > 0 ? String(historyCount.value) : '', action: 'history' },
  { icon: 'fa-file-alt', label: '草稿箱', badge: draftsCount.value > 0 ? String(draftsCount.value) : '', action: 'drafts' },
  { icon: 'fa-wallet', label: '微博钱包', badge: '', action: 'wallet' },
  { icon: 'fa-crown', label: '会员中心', badge: '', action: 'vip' },
  { icon: 'fa-palette', label: '主题换肤', badge: '', action: 'theme' },
  { icon: 'fa-cog', label: '设置', badge: '', action: 'settings' },
]);

// 快捷入口
const quickActions = [
  { icon: 'fa-users', label: '粉丝群', color: 'text-orange-500' },
  { icon: 'fa-fire', label: '超话社区', color: 'text-red-500' },
  { icon: 'fa-bookmark', label: '订阅', color: 'text-blue-500' },
  { icon: 'fa-shopping-cart', label: '微博商城', color: 'text-green-500' },
];

onMounted(async () => {
  await loadProfile();
});

async function loadProfile() {
  isLoading.value = true;
  hasError.value = false;
  
  try {
    // 确保账号系统已初始化
    if (!accountStore.isInitialized) {
      // 设置默认的 session context
      const defaultContext = {
        sessionId: 'default-session',
        characterCardId: 'default-character',
      };
      await accountStore.initialize('玩家', defaultContext);
    }
    
    // 获取玩家的微博账号
    const result = await accountStore.ensurePlayerAccount('weibo');
    
    // MissingAccountInfo 有 suggestedScope 属性，PlatformAccount 没有
    if ('suggestedScope' in result) {
      // 没有账号，需要创建
      playerProfile.value = null;
    } else {
      // 有账号，获取完整档案
      const account = result;
      currentAccountId.value = account.id;
      const profile = await accountStore.getFullProfile(account.id);
      playerProfile.value = profile;
      
      // 获取统计数据
      if (profile) {
        const following = await accountStore.getFollowingAccounts(account.id);
        const followerRelations = await accountStore.getFollowerAccounts(account.id);
        
        // 粉丝数优先使用 platformData.followers（用户自定义的数值）
        // 如果没有设置，则使用社交关系数量
        const customFollowers = profile.account.platformData?.followers as number | undefined;
        
        // 从数据库获取真实的博文数量
        const realPostCount = await feedStore.getPostCountByAuthor(account.id);
        
        stats.value = {
          posts: realPostCount,
          following: following.length,
          followers: customFollowers !== undefined ? customFollowers : followerRelations.length,
        };
      }
    }
  } catch (error: any) {
    loggerService.error('WeiboProfile', 'Failed to load profile:', error);
    hasError.value = true;
    // 显示友好的错误提示
    notificationStore.createNotification({
      appId: 'weibo',
      appName: '微博',
      appIcon: { type: 'fontawesome', value: 'fab fa-weibo', color: '#ff8200' },
      title: '加载失败',
      body: error.message?.includes('Session context') 
        ? '请先进入一个聊天会话' 
        : '无法加载个人资料，请稍后再试',
      priority: 'normal',
      category: 'app',
    });
  } finally {
    isLoading.value = false;
  }
}

// 获取头像URL
function getAvatarUrl(avatar?: string): string {
  if (!avatar) {
    return 'https://api.dicebear.com/7.x/avataaars/svg?seed=player';
  }
  if (avatar.startsWith('avatar://')) {
    // 内部头像，转换为实际URL
    const seed = avatar.replace('avatar://', '');
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  }
  return avatar;
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toString();
}

// 兴趣领域映射
const interestMap: Record<string, { label: string; icon: string }> = {
  tech: { label: '科技', icon: '💻' },
  entertainment: { label: '娱乐', icon: '🎬' },
  gaming: { label: '游戏', icon: '🎮' },
  anime: { label: '动漫', icon: '🎌' },
  food: { label: '美食', icon: '🍜' },
  travel: { label: '旅行', icon: '✈️' },
  fashion: { label: '时尚', icon: '👗' },
  fitness: { label: '健身', icon: '💪' },
  finance: { label: '财经', icon: '📈' },
  education: { label: '教育', icon: '📚' },
  news: { label: '时事', icon: '📰' },
  life: { label: '生活', icon: '🏠' },
  art: { label: '艺术', icon: '🎨' },
  pet: { label: '宠物', icon: '🐱' },
  car: { label: '汽车', icon: '🚗' },
};

// 获取认证信息
const verificationInfo = computed(() => {
  if (!playerProfile.value?.account.platformData?.verified) return null;
  const verifyType = playerProfile.value.account.platformData.verifyType as WeiboVerifyType;
  const verifyDescription = playerProfile.value.account.platformData.verifyDescription as string;
  if (!verifyType) return { label: '已认证', icon: 'fa-check', color: 'text-orange-500', description: '' };
  const config = getVerifyTypeConfig(verifyType);
  return {
    label: config?.label || '已认证',
    icon: config?.icon || 'fa-check',
    color: config?.color || 'text-orange-500',
    description: verifyDescription || config?.description || '',
    isOrg: config?.category === 'org',
  };
});

// 获取画像标签
const profileTags = computed(() => {
  const tags: string[] = [];
  const entityProfile = playerProfile.value?.entity.profile;
  const platformData = playerProfile.value?.account.platformData;
  
  // 添加职业
  if (entityProfile?.occupation) {
    tags.push(entityProfile.occupation);
  }
  
  // 添加地点
  if (entityProfile?.location) {
    tags.push(entityProfile.location);
  }
  
  // 添加自定义标签
  if (entityProfile?.tags) {
    tags.push(...entityProfile.tags.slice(0, 3));
  }
  
  // 添加平台标签
  if (platformData?.accountTags) {
    const accountTags = platformData.accountTags as string[];
    for (const tag of accountTags) {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
  }
  
  return tags.slice(0, 5);
});

// 获取兴趣领域
const profileInterests = computed(() => {
  const interests: { value: string; label: string; icon: string }[] = [];
  const entityProfile = playerProfile.value?.entity.profile;
  const platformData = playerProfile.value?.account.platformData;
  
  // 优先使用实体画像中的兴趣
  const interestList = entityProfile?.interests || 
    (platformData?.contentDomains as string[]) || [];
  
  for (const interest of interestList.slice(0, 5)) {
    const info = interestMap[interest];
    if (info) {
      interests.push({ value: interest, ...info });
    }
  }
  
  return interests;
});

// 发送事件
const emit = defineEmits<{
  (e: 'request-create-account'): void;
  (e: 'request-edit-profile', profile: FullProfile): void;
  (e: 'request-edit-followers', profile: FullProfile): void;
  (e: 'open-settings'): void;
  (e: 'open-drafts'): void;
  (e: 'open-favorites'): void;
  (e: 'open-likes'): void;
  (e: 'open-history'): void;
  (e: 'view-user-posts', accountId: string, displayName: string, avatar?: string): void;
}>();

function handleCreateAccount() {
  emit('request-create-account');
}

function handleEditProfile() {
  if (playerProfile.value) {
    emit('request-edit-profile', playerProfile.value);
  }
}

function handleEditFollowers() {
  if (playerProfile.value) {
    emit('request-edit-followers', playerProfile.value);
  }
}

function handleViewUserPosts() {
  if (currentAccountId.value && playerProfile.value) {
    emit(
      'view-user-posts', 
      currentAccountId.value, 
      playerProfile.value.displayName,
      playerProfile.value.avatar
    );
  }
}

function handleMenuClick(action: string) {
  switch (action) {
    case 'settings':
      emit('open-settings');
      break;
    case 'drafts':
      emit('open-drafts');
      break;
    case 'favorites':
      emit('open-favorites');
      break;
    case 'likes':
      emit('open-likes');
      break;
    case 'history':
      emit('open-history');
      break;
    default:
      loggerService.debug('WeiboProfile', 'Menu action:', action);
  }
}

// 暴露给父组件的刷新方法和数据
defineExpose({
  refresh: loadProfile,
  profile: playerProfile,
});
</script>

<template>
  <div class="h-full bg-gray-50 overflow-y-auto">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="h-full flex items-center justify-center">
      <div class="text-gray-400">
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
        无法获取账号信息
      </p>
      <button
        @click="loadProfile"
        class="px-4 py-2 bg-orange-500 text-white rounded-full text-sm hover:bg-orange-600 transition-colors"
      >
        <i class="fas fa-redo mr-2"></i>重试
      </button>
    </div>

    <!-- 未创建账号状态 -->
    <div v-else-if="!playerProfile" class="h-full flex flex-col items-center justify-center p-6">
      <div class="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4">
        <i class="fas fa-user text-4xl text-gray-400"></i>
      </div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">欢迎来到微博</h3>
      <p class="text-sm text-gray-500 text-center mb-6">
        创建你的微博身份，开始分享精彩生活
      </p>
      <button
        @click="handleCreateAccount"
        class="px-6 py-2.5 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
      >
        创建微博账号
      </button>
    </div>

    <!-- 已有账号 - 个人主页 -->
    <div v-else>
      <!-- 顶部背景 -->
      <div class="relative">
        <!-- 背景图 -->
        <div class="h-32 bg-gradient-to-r from-orange-400 to-red-500"></div>
        
        <!-- 头像和基本信息 -->
        <div class="absolute -bottom-12 left-4 flex items-end">
          <div class="relative">
            <img
              :src="getAvatarUrl(playerProfile.avatar)"
              class="w-20 h-20 rounded-full border-4 border-white bg-white"
              alt="头像"
            />
            <!-- 认证标识 -->
            <div 
              v-if="verificationInfo"
              :class="[
                'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center',
                verificationInfo.isOrg ? 'bg-blue-500' : 'bg-orange-500'
              ]"
            >
              <i class="fas fa-check text-white text-xs"></i>
            </div>
          </div>
        </div>

        <!-- 编辑按钮 -->
        <div class="absolute bottom-4 right-4">
          <button 
            @click="handleEditProfile"
            class="px-4 py-1.5 bg-white/90 rounded-full text-sm text-gray-700 font-medium hover:bg-white transition-colors"
          >
            编辑资料
          </button>
        </div>
      </div>

      <!-- 用户信息区 -->
      <div class="pt-14 px-4 pb-4 bg-white">
        <!-- 昵称和认证 -->
        <div class="flex items-center gap-2 mb-1">
          <h2 class="text-lg font-bold text-gray-900">{{ playerProfile.displayName }}</h2>
          <span 
            v-if="verificationInfo"
            :class="[
              'px-1.5 py-0.5 text-xs rounded flex items-center gap-1',
              verificationInfo.isOrg ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
            ]"
          >
            <i :class="['fas', verificationInfo.icon]"></i>
            {{ verificationInfo.label }}
          </span>
        </div>
        
        <!-- 认证说明 -->
        <p v-if="verificationInfo?.description" class="text-xs text-gray-400 mb-1">
          {{ verificationInfo.description }}
        </p>

        <!-- Handle -->
        <p v-if="playerProfile.account.handle" class="text-sm text-gray-400 mb-2">
          @{{ playerProfile.account.handle }}
        </p>

        <!-- 一句话标语 -->
        <p v-if="playerProfile.entity.tagline" class="text-sm text-orange-500 mb-1">
          {{ playerProfile.entity.tagline }}
        </p>

        <!-- 简介 -->
        <p class="text-sm text-gray-600 mb-2">
          {{ playerProfile.bio || '这个人很懒，什么都没写。' }}
        </p>
        
        <!-- 画像标签 -->
        <div v-if="profileTags.length > 0" class="flex flex-wrap gap-1.5 mb-3">
          <span
            v-for="tag in profileTags"
            :key="tag"
            class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs"
          >
            {{ tag }}
          </span>
        </div>
        
        <!-- 兴趣领域 -->
        <div v-if="profileInterests.length > 0" class="flex flex-wrap gap-1.5 mb-3">
          <span
            v-for="interest in profileInterests"
            :key="interest.value"
            class="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-xs flex items-center gap-1"
          >
            <span>{{ interest.icon }}</span>
            <span>{{ interest.label }}</span>
          </span>
        </div>

        <!-- 统计数据 -->
        <div class="flex gap-6">
          <div class="text-center">
            <div class="text-lg font-bold text-gray-900">{{ formatNumber(stats.following) }}</div>
            <div class="text-xs text-gray-500">关注</div>
          </div>
          <div 
            class="text-center cursor-pointer hover:opacity-80 transition-opacity"
            @click="handleEditFollowers"
            title="点击修改粉丝数"
          >
            <div class="text-lg font-bold text-gray-900">{{ formatNumber(stats.followers) }}</div>
            <div class="text-xs text-gray-500 flex items-center justify-center gap-1">
              粉丝
              <i class="fas fa-pen text-[8px] text-gray-400"></i>
            </div>
          </div>
          <div 
            class="text-center cursor-pointer hover:opacity-80 transition-opacity"
            @click="handleViewUserPosts"
            title="查看我的微博"
          >
            <div class="text-lg font-bold text-gray-900">{{ formatNumber(stats.posts) }}</div>
            <div class="text-xs text-gray-500 flex items-center justify-center gap-1">
              微博
              <i class="fas fa-chevron-right text-[8px] text-gray-400"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="mt-2 bg-white px-4 py-3">
        <div class="grid grid-cols-4 gap-4">
          <div 
            v-for="action in quickActions" 
            :key="action.label"
            class="flex flex-col items-center gap-1"
          >
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <i :class="['fas', action.icon, action.color]"></i>
            </div>
            <span class="text-xs text-gray-600">{{ action.label }}</span>
          </div>
        </div>
      </div>

      <!-- 菜单列表 -->
      <div class="mt-2 bg-white">
        <div 
          v-for="item in menuItems" 
          :key="item.label"
          @click="handleMenuClick(item.action)"
          class="flex items-center px-4 py-3 border-b border-gray-50 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div class="w-8 flex justify-center">
            <i :class="['fas', item.icon, 'text-gray-400']" />
          </div>
          <span class="flex-1 text-sm text-gray-700 ml-3">{{ item.label }}</span>
          <span v-if="item.badge" class="text-xs text-orange-500 mr-2">{{ item.badge }}</span>
          <i class="fas fa-chevron-right text-gray-300 text-xs"></i>
        </div>
      </div>

      <!-- 底部留白 -->
      <div class="h-4"></div>
    </div>
  </div>
</template>

<style scoped>
</style>
