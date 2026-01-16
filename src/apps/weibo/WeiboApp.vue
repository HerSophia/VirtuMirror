<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useNarrativeSubscription } from './composables/useNarrativeSubscription';
import { useLLMTaskStore, useUserActionStore, useComposeStore, useSettingsStore, useFeedStore, useHotSearchStore } from './stores';
import { registerWeiboLLMExtensions } from './llmTask';
import { migrateWeiboData, autoBindToCurrentSession } from './stores/dataMigration';
import { createBuiltinAppRuntime, provideAppRuntime, unregisterAppRuntime } from '@/services/appRuntime';
// 导入清理脚本，自动注册到 window 对象
import './scripts/clearAllWeiboData';
import { syncContextFromNarrative } from './services/sessionContext';
import { useAdapter } from '@/composables/useAdapter';
import type { SwipeChangedEvent } from '@/types/swipe';
import WeiboHome from './views/WeiboHome.vue';
import WeiboHot from './views/WeiboHot.vue';
import WeiboMessage from './views/WeiboMessage.vue';
import WeiboProfile from './views/WeiboProfile.vue';
import WeiboSettings from './views/WeiboSettings.vue';
import LLMTaskManager from './views/LLMTaskManager.vue';
import WeiboUserPosts from './views/WeiboUserPosts.vue';
import WeiboPostDetail from './views/WeiboPostDetail.vue';
import WeiboFavorites from './views/WeiboFavorites.vue';
import WeiboLikes from './views/WeiboLikes.vue';
import WeiboHistory from './views/WeiboHistory.vue';
import CreateAccountDialog from './components/CreateAccountDialog.vue';
import EditProfileDialog from './components/EditProfileDialog.vue';
import EditFollowersDialog from './components/EditFollowersDialog.vue';
import VerificationDialog from './components/VerificationDialog.vue';
import DraftsDialog from './components/DraftsDialog.vue';
import ComposePostDialog from './components/ComposePostDialog.vue';
import type { MissingAccountInfo, FullProfile, PlatformAccount } from '@/types/account';
import type { WeiboDraft } from './types';
import { useWeiboStore } from '@/stores/weiboStore';

const accountStore = useAccountStore();
const notificationStore = useNotificationStore();
const llmTaskStore = useLLMTaskStore();
const weiboStore = useWeiboStore();
const userActionStore = useUserActionStore();
const composeStore = useComposeStore();
const settingsStore = useSettingsStore();
const feedStore = useFeedStore();
const hotSearchStore = useHotSearchStore();

// 适配器（用于监听 swipe 切换事件）
const adapter = useAdapter();

// 叙事内容订阅（仅当 autoNarrativeAnalysisEnabled 开启时才自动分析生成内容）
const {
  isSubscribed: isNarrativeSubscribed,
  isProcessing: isNarrativeProcessing,
  startSubscription,
  stopSubscription,
} = useNarrativeSubscription();

// WeiboProfile 组件引用
const profileRef = ref<InstanceType<typeof WeiboProfile> | null>(null);

// 提示词和提示词链已在 manifest.ts 中注册，应用启动时自动加载

// Define the available tabs
type Tab = 'home' | 'video' | 'discover' | 'message' | 'me';
const currentTab = ref<Tab>('home');

// 弹窗状态
const showCreateDialog = ref(false);
const missingAccountInfo = ref<MissingAccountInfo | null>(null);
const showEditDialog = ref(false);
const editingProfile = ref<FullProfile | null>(null);
const showFollowersDialog = ref(false);
const followersProfile = ref<FullProfile | null>(null);
const showVerificationDialog = ref(false);
const verificationProfile = ref<FullProfile | null>(null);

// 当前视图模式
const viewMode = ref<'main' | 'settings' | 'task-manager' | 'user-posts' | 'post-detail' | 'favorites' | 'likes' | 'history'>('main');

// 用户博文列表参数
const userPostsParams = ref<{
  authorId: string;
  authorName: string;
  authorAvatar?: string;
} | null>(null);

// 博文详情参数
const postDetailId = ref<string | null>(null);

// 草稿箱和发布弹窗状态
const showDraftsDialog = ref(false);
const showComposeDialog = ref(false);
const selectedDraft = ref<WeiboDraft | null>(null);

// 创建并提供微博 AppRuntime（用于数据隔离）
const weiboRuntime = createBuiltinAppRuntime('weibo', '微博');
provideAppRuntime(weiboRuntime);

// 初始化账号系统和叙事订阅
onMounted(async () => {
  try {
    // 首先执行数据迁移（为旧数据补充 namespace）
    try {
      const migrationResult = await migrateWeiboData();
      if (!migrationResult.skipped) {
        console.log('[WeiboApp] 数据迁移完成:', migrationResult);
      }
    } catch (e) {
      console.warn('[WeiboApp] 数据迁移失败，继续初始化:', e);
    }
    
    // 确保账号系统已初始化
    // accountStore 会自动从 Bridge Adapter 获取真实会话信息
    // 如果没有连接，会回退到 'standalone-session'
    if (!accountStore.isInitialized) {
      await accountStore.initialize('玩家');
    }
    
    // 注册微博 LLM 任务扩展到系统服务（包含定义、上下文提供器、输出处理器）
    registerWeiboLLMExtensions();
    
    // 初始化内置任务实例（会清理旧格式任务，创建新任务，启动叙事订阅）
    await llmTaskStore.initializeBuiltinTasks();
    
    // 初始化需要 ScopedStorage 的 stores
    try {
      // 初始化设置 store（自动生成配置、LLM 设置等）
      await settingsStore.initialize();
      
      const playerAccount = await accountStore.getPlayerAccountForPlatform('weibo');
      if (playerAccount) {
        // 初始化用户行为 store（点赞、收藏、浏览历史）
        await userActionStore.initialize(playerAccount.id);
      }
      // 初始化草稿 store
      await composeStore.loadDrafts();
    } catch (e) {
      console.log('[WeiboApp] ScopedStorage stores 初始化延迟:', e);
    }
    
    // 仅当用户开启自动叙事分析时，才启动自动内容生成订阅
    if (settingsStore.autoNarrativeAnalysisEnabled) {
      startSubscription();
      console.log('[WeiboApp] 已启动自动叙事分析订阅');
    } else {
      console.log('[WeiboApp] 自动叙事分析已关闭，仅缓存叙事内容用于手动任务');
    }
  } catch (error: any) {
    console.error('[WeiboApp] Failed to initialize:', error);
    showErrorToast('账号系统初始化失败');
  }
});

// 监听自动叙事分析开关变化
watch(() => settingsStore.autoNarrativeAnalysisEnabled, (enabled) => {
  if (enabled) {
    startSubscription();
    console.log('[WeiboApp] 自动叙事分析已开启');
  } else {
    stopSubscription();
    console.log('[WeiboApp] 自动叙事分析已关闭');
  }
});

// 事件监听取消函数
let unsubscribeSwipeChanged: (() => void) | null = null;
let unsubscribeSync: (() => void) | null = null;

// Swipe 切换处理
async function handleSwipeChanged(event: SwipeChangedEvent) {
  console.log('[WeiboApp] Swipe 切换:', event);
  
  // 同步会话上下文
  syncContextFromNarrative();
  
  // 同步用户行为的会话上下文
  userActionStore.syncSessionContext();
  
  // 刷新数据（会自动按新的 swipe 过滤）
  await feedStore.refreshFeed();
  await hotSearchStore.refreshHotSearch();
  
  // 重新加载用户行为数据
  const playerAccount = await accountStore.getPlayerAccountForPlatform('weibo');
  if (playerAccount) {
    await userActionStore.initialize(playerAccount.id);
  }
}

// 同步事件处理
function handleSyncEvent() {
  // 完整同步时也更新上下文
  syncContextFromNarrative();
  
  // 同步用户行为的会话上下文
  userActionStore.syncSessionContext();
  
  // 尝试自动绑定现有数据到当前会话（仅首次）
  autoBindToCurrentSession().then(result => {
    if (result) {
      console.log('[WeiboApp] 已将现有数据绑定到当前会话:', result);
    }
  }).catch(e => {
    console.warn('[WeiboApp] 自动会话绑定失败:', e);
  });
}

// 设置事件监听
onMounted(() => {
  // 监听 swipe 切换事件（adapter.on 返回取消订阅函数）
  unsubscribeSwipeChanged = adapter.on('swipe_changed', handleSwipeChanged as (...args: unknown[]) => void);
  unsubscribeSync = adapter.on('sync', handleSyncEvent as (...args: unknown[]) => void);
});

// 组件卸载时停止订阅并取消注册 AppRuntime
onUnmounted(() => {
  stopSubscription();
  // 移除事件监听
  unsubscribeSwipeChanged?.();
  unsubscribeSync?.();
  unregisterAppRuntime('weibo');
});

// 显示错误 Toast
function showErrorToast(message: string) {
  notificationStore.createNotification({
    appId: 'weibo',
    appName: '微博',
    appIcon: { type: 'fontawesome', value: 'fab fa-weibo', color: '#ff8200' },
    title: '提示',
    body: message,
    priority: 'normal',
    category: 'app',
  });
}

// 处理请求创建账号
async function handleRequestCreateAccount() {
  try {
    // 检查是否缺少账号
    const result = await accountStore.ensurePlayerAccount('weibo');
    
    // MissingAccountInfo 有 suggestedScope 属性，PlatformAccount 没有
    if ('suggestedScope' in result) {
      // 返回的是 MissingAccountInfo
      missingAccountInfo.value = result;
      showCreateDialog.value = true;
    }
  } catch (error: any) {
    console.error('[WeiboApp] Failed to check account:', error);
    showErrorToast('获取账号信息失败，请稍后再试');
  }
}

// 账号创建成功
async function handleAccountCreated() {
  showCreateDialog.value = false;
  missingAccountInfo.value = null;
  // 切换到"我的"页面并刷新
  currentTab.value = 'me';
  // 等待 DOM 更新后刷新 profile
  await nextTick();
  profileRef.value?.refresh();
}

// 关闭创建弹窗
function handleCloseDialog() {
  showCreateDialog.value = false;
}

// 打开编辑资料弹窗
function handleRequestEditProfile(profile: FullProfile) {
  editingProfile.value = profile;
  showEditDialog.value = true;
}

// 编辑资料完成
async function handleProfileUpdated() {
  showEditDialog.value = false;
  editingProfile.value = null;
  // 刷新个人主页
  await nextTick();
  profileRef.value?.refresh();
}

// 关闭编辑弹窗
function handleCloseEditDialog() {
  showEditDialog.value = false;
  editingProfile.value = null;
}

// 打开修改粉丝数弹窗
function handleRequestEditFollowers(profile: FullProfile) {
  followersProfile.value = profile;
  showFollowersDialog.value = true;
}

// 粉丝数修改完成
async function handleFollowersUpdated() {
  showFollowersDialog.value = false;
  followersProfile.value = null;
  // 刷新个人主页
  await nextTick();
  profileRef.value?.refresh();
}

// 关闭粉丝数弹窗
function handleCloseFollowersDialog() {
  showFollowersDialog.value = false;
  followersProfile.value = null;
}

// 打开认证弹窗
async function handleOpenVerification() {
  // 获取当前的 profile
  const profile = profileRef.value?.profile;
  if (profile) {
    verificationProfile.value = profile;
    showVerificationDialog.value = true;
  } else {
    // 尝试获取
    try {
      const result = await accountStore.ensurePlayerAccount('weibo');
      if (!('suggestedScope' in result)) {
        const fullProfile = await accountStore.getFullProfile(result.id);
        if (fullProfile) {
          verificationProfile.value = fullProfile;
          showVerificationDialog.value = true;
        }
      }
    } catch (error) {
      console.error('[WeiboApp] Failed to get profile for verification:', error);
      showErrorToast('获取账号信息失败');
    }
  }
}

// 认证完成
async function handleVerificationUpdated() {
  showVerificationDialog.value = false;
  verificationProfile.value = null;
  // 刷新个人主页
  viewMode.value = 'main';
  currentTab.value = 'me';
  await nextTick();
  profileRef.value?.refresh();
}

// 关闭认证弹窗
function handleCloseVerificationDialog() {
  showVerificationDialog.value = false;
  verificationProfile.value = null;
}

// 打开设置页面
function handleOpenSettings() {
  viewMode.value = 'settings';
}

// 从设置返回
function handleBackFromSettings() {
  viewMode.value = 'main';
}

// 打开任务管理页面
function handleOpenTaskManager() {
  viewMode.value = 'task-manager';
}

// 从任务管理返回
function handleBackFromTaskManager() {
  viewMode.value = 'settings';
}

// 查看用户博文列表
function handleViewUserPosts(authorId: string, authorName: string, authorAvatar?: string) {
  userPostsParams.value = { authorId, authorName, authorAvatar };
  viewMode.value = 'user-posts';
}

// 从用户博文列表返回
function handleBackFromUserPosts() {
  viewMode.value = 'main';
  currentTab.value = 'me';
  userPostsParams.value = null;
}

// 查看博文详情
function handleViewPostDetail(postId: string) {
  postDetailId.value = postId;
  viewMode.value = 'post-detail';
}

// 从博文详情返回
function handleBackFromPostDetail() {
  // 返回用户博文列表或主页
  if (userPostsParams.value) {
    viewMode.value = 'user-posts';
  } else {
    viewMode.value = 'main';
    currentTab.value = 'home';
  }
  postDetailId.value = null;
}

// 切换账号
async function handleSwitchAccount(account: PlatformAccount) {
  // TODO: 实现账号切换逻辑
  console.log('Switch to account:', account.id);
  viewMode.value = 'main';
  currentTab.value = 'me';
  await nextTick();
  profileRef.value?.refresh();
}

// 打开草稿箱
function handleOpenDrafts() {
  showDraftsDialog.value = true;
}

// 从草稿箱选择草稿
function handleSelectDraft(draft: WeiboDraft) {
  selectedDraft.value = draft;
  showDraftsDialog.value = false;
  showComposeDialog.value = true;
}

// 发布成功
function handlePostSuccess(postId: string) {
  showComposeDialog.value = false;
  // 如果是从草稿发布，删除草稿
  if (selectedDraft.value) {
    composeStore.deleteDraft(selectedDraft.value.id);
    selectedDraft.value = null;
  }
  // 切换到首页查看新发布的博文
  viewMode.value = 'main';
  currentTab.value = 'home';
  console.log('[WeiboApp] 博文发布成功:', postId);
}

// 关闭发布对话框
function handleCloseCompose() {
  showComposeDialog.value = false;
  selectedDraft.value = null;
}

// 从发布对话框打开草稿箱
function handleOpenDraftsFromCompose() {
  showComposeDialog.value = false;
  showDraftsDialog.value = true;
}

// 打开收藏页面
function handleOpenFavorites() {
  viewMode.value = 'favorites';
}

// 打开点赞页面
function handleOpenLikes() {
  viewMode.value = 'likes';
}

// 打开浏览历史页面
function handleOpenHistory() {
  viewMode.value = 'history';
}

// 从收藏/点赞/历史页面返回
function handleBackToProfile() {
  viewMode.value = 'main';
  currentTab.value = 'me';
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- 设置页面 -->
    <WeiboSettings 
      v-if="viewMode === 'settings'"
      @back="handleBackFromSettings"
      @switch-account="handleSwitchAccount"
      @open-verification="handleOpenVerification"
      @open-task-manager="handleOpenTaskManager"
    />
    
    <!-- LLM 任务管理页面 -->
    <LLMTaskManager
      v-else-if="viewMode === 'task-manager'"
      @back="handleBackFromTaskManager"
    />
    
    <!-- 用户博文列表页面 -->
    <WeiboUserPosts
      v-else-if="viewMode === 'user-posts' && userPostsParams"
      :author-id="userPostsParams.authorId"
      :author-name="userPostsParams.authorName"
      :author-avatar="userPostsParams.authorAvatar"
      @back="handleBackFromUserPosts"
      @view-post="handleViewPostDetail"
    />
    
    <!-- 博文详情页面 -->
    <WeiboPostDetail
      v-else-if="viewMode === 'post-detail' && postDetailId"
      :post-id="postDetailId"
      @back="handleBackFromPostDetail"
    />
    
    <!-- 收藏列表页面 -->
    <WeiboFavorites
      v-else-if="viewMode === 'favorites'"
      @back="handleBackToProfile"
      @view-post="handleViewPostDetail"
    />
    
    <!-- 点赞列表页面 -->
    <WeiboLikes
      v-else-if="viewMode === 'likes'"
      @back="handleBackToProfile"
      @view-post="handleViewPostDetail"
    />
    
    <!-- 浏览历史页面 -->
    <WeiboHistory
      v-else-if="viewMode === 'history'"
      @back="handleBackToProfile"
      @view-post="handleViewPostDetail"
    />
    
    <!-- 主内容区域 -->
    <template v-else>
      <!-- Main Content Area -->
      <main class="flex-1 overflow-hidden relative">
        <WeiboHome v-if="currentTab === 'home'" />
        <WeiboHot v-else-if="currentTab === 'discover'" />
        <WeiboMessage v-else-if="currentTab === 'message'" />
        <WeiboProfile 
          v-else-if="currentTab === 'me'"
          ref="profileRef"
          @request-create-account="handleRequestCreateAccount"
          @request-edit-profile="handleRequestEditProfile"
          @request-edit-followers="handleRequestEditFollowers"
          @open-settings="handleOpenSettings"
          @open-drafts="handleOpenDrafts"
          @open-favorites="handleOpenFavorites"
          @open-likes="handleOpenLikes"
          @open-history="handleOpenHistory"
          @view-user-posts="handleViewUserPosts"
        />
        
        <!-- Placeholder for Video -->
        <div v-else-if="currentTab === 'video'" class="h-full flex flex-col items-center justify-center text-gray-400">
          <i class="fas fa-play-circle text-4xl mb-2"></i>
          <span>视频号</span>
        </div>
      </main>

    <!-- Bottom Navigation Bar -->
    <nav class="flex-none bg-white border-t border-gray-100 flex justify-between items-center px-6 py-1 pb-2 text-[10px] text-gray-500">
      
      <!-- Home -->
      <button 
        @click="currentTab = 'home'" 
        class="flex flex-col items-center space-y-1 w-12"
        :class="currentTab === 'home' ? 'text-black' : ''"
      >
        <i class="fas fa-home text-2xl" v-if="currentTab !== 'home'"></i>
        <i class="fas fa-home text-2xl text-black" v-else></i>
        <span>首页</span>
      </button>

      <!-- Video -->
      <button 
        @click="currentTab = 'video'" 
        class="flex flex-col items-center space-y-1 w-12"
        :class="currentTab === 'video' ? 'text-black' : ''"
      >
        <i class="fas fa-play-circle text-2xl"></i>
        <span>视频</span>
      </button>

      <!-- Discover -->
      <button 
        @click="currentTab = 'discover'" 
        class="flex flex-col items-center space-y-1 w-12"
        :class="currentTab === 'discover' ? 'text-black' : ''"
      >
        <i class="fas fa-search text-2xl" v-if="currentTab !== 'discover'"></i>
        <i class="fas fa-search text-2xl font-bold text-black" v-else></i>
        <span>发现</span>
      </button>

      <!-- Message -->
      <button 
        @click="currentTab = 'message'" 
        class="flex flex-col items-center space-y-1 w-12 relative"
        :class="currentTab === 'message' ? 'text-black' : ''"
      >
        <div class="relative">
          <i class="far fa-envelope text-2xl" v-if="currentTab !== 'message'"></i>
          <i class="fas fa-envelope text-2xl text-black" v-else></i>
          <!-- Badge -->
          <div class="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] px-1 rounded-full border border-white">
            8
          </div>
        </div>
        <span>消息</span>
      </button>

      <!-- Me -->
      <button 
        @click="currentTab = 'me'" 
        class="flex flex-col items-center space-y-1 w-12"
        :class="currentTab === 'me' ? 'text-black' : ''"
      >
        <i class="far fa-user text-2xl" v-if="currentTab !== 'me'"></i>
        <i class="fas fa-user text-2xl text-black" v-else></i>
        <span>我</span>
      </button>

    </nav>
    </template>

    <!-- 创建账号弹窗 -->
    <CreateAccountDialog
      :visible="showCreateDialog"
      :missing-info="missingAccountInfo"
      @close="handleCloseDialog"
      @created="handleAccountCreated"
    />
    
    <!-- 编辑资料弹窗 -->
    <EditProfileDialog
      :visible="showEditDialog"
      :profile="editingProfile"
      @close="handleCloseEditDialog"
      @updated="handleProfileUpdated"
    />
    
    <!-- 修改粉丝数弹窗 -->
    <EditFollowersDialog
      :visible="showFollowersDialog"
      :profile="followersProfile"
      @close="handleCloseFollowersDialog"
      @updated="handleFollowersUpdated"
    />
    
    <!-- 账号认证弹窗 -->
    <VerificationDialog
      :visible="showVerificationDialog"
      :profile="verificationProfile"
      @close="handleCloseVerificationDialog"
      @updated="handleVerificationUpdated"
    />
    
    <!-- 草稿箱弹窗 -->
    <DraftsDialog
      :visible="showDraftsDialog"
      @close="showDraftsDialog = false"
      @select="handleSelectDraft"
    />
    
    <!-- 发布博文弹窗（从草稿箱进入） -->
    <ComposePostDialog
      :visible="showComposeDialog"
      :initial-draft="selectedDraft"
      @close="handleCloseCompose"
      @posted="handlePostSuccess"
      @open-drafts="handleOpenDraftsFromCompose"
    />
  </div>
</template>

<style scoped>
</style>
