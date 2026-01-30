<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAccountStore } from '@/stores/accountStore';
import { useAIStore } from '@/stores/aiStore';
import { useWeiboStore } from '@/stores/weiboStore';
import { loggerService } from '@/services/logger/loggerService';
import { useLLMTaskStore, useSettingsStore, useUserActionStore } from '../stores';
import { 
  getSessionContext, 
  setFilterMode, 
  hasValidContext,
  syncContextFromNarrative,
  type FilterMode 
} from '../services/sessionContext';
import { 
  getBindingStats, 
  bindDataToSession, 
  bindWeiboAccountToCurrentSession,
  getAccountBindingStatus,
  type AccountBindingStatus,
} from '../stores/dataMigration';
import { getNarrativeCacheMetadata } from '../stores/llm/narrativeIntegration';
import type { PlatformAccount } from '@/types/account';

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'switch-account', account: PlatformAccount): void;
  (e: 'open-verification'): void;
  (e: 'open-task-manager'): void;
}>();

const accountStore = useAccountStore();
const aiStore = useAIStore();
const weiboStore = useWeiboStore();
const llmTaskStore = useLLMTaskStore();
const settingsStore = useSettingsStore();
const userActionStore = useUserActionStore();

// 当前玩家的所有微博账号
const playerAccounts = ref<PlatformAccount[]>([]);
const currentAccountId = ref<string | null>(null);
const isLoading = ref(true);

// 清除缓存相关
const showClearCacheDialog = ref(false);
const clearCacheLoading = ref(false);
const cacheStats = ref({ posts: 0, hotSearches: 0, comments: 0 });
const clearOptions = ref({
  posts: true,
  hotSearches: true,
});

// 会话绑定相关
const bindingStats = ref({
  totalPosts: 0,
  boundPosts: 0,
  unboundPosts: 0,
  totalComments: 0,
  boundComments: 0,
  unboundComments: 0,
  totalTopics: 0,
  boundTopics: 0,
  unboundTopics: 0,
});
const isBindingData = ref(false);
const currentFilterMode = ref<FilterMode>('session');
const showFilterHelpDialog = ref(false);

// 账号会话绑定相关 (Phase 3)
const accountBindingStatus = ref<AccountBindingStatus>({
  hasAccount: false,
  accountId: undefined,
  currentSessionId: undefined,
  isBound: false,
  boundSessionId: undefined,
});
const isBindingAccount = ref(false);

// 设置项类型
interface SettingItem {
  icon: string;
  label: string;
  action: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  danger?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

// LLM 请求统计
const llmStats = computed(() => {
  const history = aiStore.generationHistory || [];
  const queueStatus = aiStore.queueStatus;
  return {
    totalRequests: history.length,
    pendingRequests: queueStatus?.pending || 0,
    failedRequests: 0, // 暂不统计失败请求
    isGenerating: aiStore.isGenerating || false,
  };
});

// 设置项
const settingSections = ref<SettingSection[]>([
  {
    title: '账号与安全',
    items: [
      { icon: 'fa-certificate', label: '账号认证', action: 'verification', value: '' },
      { icon: 'fa-user-shield', label: '账号安全', action: 'security' },
      { icon: 'fa-lock', label: '隐私设置', action: 'privacy' },
      { icon: 'fa-bell', label: '通知设置', action: 'notification' },
    ],
  },
  {
    title: '通用设置',
    items: [
      { icon: 'fa-language', label: '语言', value: '简体中文', action: 'language' },
      { icon: 'fa-moon', label: '深色模式', toggle: true, toggleValue: false, action: 'darkmode' },
      { icon: 'fa-text-height', label: '字体大小', value: '标准', action: 'fontsize' },
    ],
  },
  {
    title: '其他',
    items: [
      { icon: 'fa-trash-alt', label: '清理缓存', action: 'clearcache' },
      { icon: 'fa-info-circle', label: '关于微博', action: 'about' },
      { icon: 'fa-sign-out-alt', label: '退出登录', danger: true, action: 'logout' },
    ],
  },
]);

onMounted(async () => {
  await loadAccounts();
  await loadCacheStats();
  await loadBindingStats();
  await loadAccountBindingStatus();
  // 同步会话上下文
  syncContextFromNarrative();
  // 同步当前过滤模式
  currentFilterMode.value = getSessionContext().filterMode;
});

async function loadBindingStats() {
  try {
    bindingStats.value = await getBindingStats();
  } catch (error) {
    loggerService.error('WeiboSettings', 'Failed to load binding stats:', error);
  }
}

// 加载账号绑定状态
async function loadAccountBindingStatus() {
  try {
    accountBindingStatus.value = await getAccountBindingStatus();
  } catch (error) {
    loggerService.error('WeiboSettings', 'Failed to load account binding status:', error);
  }
}

// 绑定账号到当前会话
async function handleBindAccountToSession() {
  if (isBindingAccount.value) return;
  
  if (!confirm('确定要将微博账号绑定到当前会话吗？\n\n绑定后，此账号将仅在当前聊天会话中可见。')) {
    return;
  }
  
  isBindingAccount.value = true;
  try {
    const result = await bindWeiboAccountToCurrentSession();
    await loadAccountBindingStatus();
    
    if (result.success) {
      alert(`✅ ${result.message}\n\n会话ID: ${result.sessionId?.slice(0, 8)}...`);
    } else {
      alert(`❌ ${result.message}`);
    }
  } catch (error) {
    loggerService.error('WeiboSettings', 'Failed to bind account:', error);
    alert('绑定失败，请查看控制台');
  } finally {
    isBindingAccount.value = false;
  }
}

// 切换过滤模式
function handleFilterModeChange(mode: FilterMode) {
  currentFilterMode.value = mode;
  setFilterMode(mode);
  // 同步用户行为的会话过滤
  userActionStore.setFilterBySession(mode !== 'all');
}

// 手动绑定数据到当前会话
async function handleBindDataToSession() {
  const metadata = getNarrativeCacheMetadata();
  if (!metadata?.sessionId) {
    alert('无法获取当前会话信息，请确保已连接到酒馆');
    return;
  }
  
  if (!confirm(`确定要将所有未绑定的微博数据绑定到当前会话吗？\n\n会话ID: ${metadata.sessionId.slice(0, 8)}...`)) {
    return;
  }
  
  isBindingData.value = true;
  try {
    const result = await bindDataToSession(
      metadata.sessionId,
      metadata.messageId,
      metadata.swipeId
    );
    await loadBindingStats();
    alert(`绑定完成！\n博文: ${result.posts} 条\n评论: ${result.comments} 条\n热搜: ${result.topics} 条`);
  } catch (error) {
    loggerService.error('WeiboSettings', 'Failed to bind data:', error);
    alert('绑定失败，请查看控制台');
  } finally {
    isBindingData.value = false;
  }
}

async function loadCacheStats() {
  try {
    cacheStats.value = await weiboStore.getCacheStats();
  } catch (error) {
    loggerService.error('WeiboSettings', 'Failed to load cache stats:', error);
  }
}

async function loadAccounts() {
  isLoading.value = true;
  try {
    // 获取玩家的所有微博账号
    const allAccounts = await accountStore.getPlayerAllAccounts();
    playerAccounts.value = allAccounts.filter(a => a.platformId === 'weibo');
    
    // 获取当前账号
    const result = await accountStore.ensurePlayerAccount('weibo');
    if (!('suggestedScope' in result)) {
      currentAccountId.value = result.id;
    }
  } catch (error) {
    loggerService.error('WeiboSettings', 'Failed to load accounts:', error);
  } finally {
    isLoading.value = false;
  }
}

function getAccountAvatar(account: PlatformAccount): string {
  return account.avatarOverride || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';
}

function getAccountName(account: PlatformAccount): string {
  return account.nickname || account.handle || '未设置昵称';
}

function getScopeLabel(account: PlatformAccount): string {
  switch (account.scope) {
    case 'global': return '全局账号';
    case 'character': return `角色: ${account.scopeCharacterCardId || '未知'}`;
    case 'session': return '会话账号';
    default: return '';
  }
}

function handleSwitchAccount(account: PlatformAccount) {
  currentAccountId.value = account.id;
  emit('switch-account', account);
}

function handleSettingClick(action: string) {
  switch (action) {
    case 'verification':
      emit('open-verification');
      break;
    case 'clearcache':
      openClearCacheDialog();
      break;
    case 'about':
      alert('微博 v1.0.0\n模拟版');
      break;
    case 'logout':
      if (confirm('确定要退出登录吗？')) {
        // TODO: 实现退出登录
      }
      break;
    default:
      loggerService.debug('WeiboSettings', 'Setting action:', action);
  }
}

async function openClearCacheDialog() {
  await loadCacheStats();
  showClearCacheDialog.value = true;
}

function closeClearCacheDialog() {
  showClearCacheDialog.value = false;
}

async function confirmClearCache() {
  clearCacheLoading.value = true;
  try {
    let clearedPosts = 0;
    let clearedHotSearches = 0;
    
    if (clearOptions.value.posts && clearOptions.value.hotSearches) {
      // 清除全部
      const result = await weiboStore.clearAllCache();
      clearedPosts = result.posts;
      clearedHotSearches = result.hotSearches;
    } else if (clearOptions.value.posts) {
      // 只清除博文
      clearedPosts = await weiboStore.clearAllPosts();
    } else if (clearOptions.value.hotSearches) {
      // 只清除热搜
      clearedHotSearches = await weiboStore.clearHotSearches();
    }
    
    // 更新缓存统计
    await loadCacheStats();
    
    // 关闭对话框
    showClearCacheDialog.value = false;
    
    // 显示成功提示
    const messages: string[] = [];
    if (clearedPosts > 0) messages.push(`${clearedPosts} 条博文`);
    if (clearedHotSearches > 0) messages.push(`${clearedHotSearches} 条热搜`);
    
    if (messages.length > 0) {
      alert(`已清除: ${messages.join('、')}`);
    } else {
      alert('没有需要清除的数据');
    }
  } catch (error) {
    loggerService.error('WeiboSettings', 'Failed to clear cache:', error);
    alert('清除缓存失败');
  } finally {
    clearCacheLoading.value = false;
  }
}

// 计算缓存大小显示
const cacheSize = computed(() => {
  const total = cacheStats.value.posts + cacheStats.value.hotSearches + cacheStats.value.comments;
  if (total === 0) return '无缓存';
  // 粗略估算：每条数据约 1KB
  const sizeKB = total * 1;
  if (sizeKB < 1024) return `${sizeKB}KB`;
  return `${(sizeKB / 1024).toFixed(1)}MB`;
});

function handleToggle(section: number, item: number) {
  const setting = settingSections.value[section].items[item];
  if ('toggleValue' in setting) {
    setting.toggleValue = !setting.toggleValue;
  }
}

function cancelPendingRequests() {
  aiStore.abortAll();
}

function toggleAutoGenerate(key: 'onEmptyFeed' | 'onFewComments') {
  settingsStore.setAutoGenerateConfig({
    [key]: !settingsStore.autoGenerateConfig[key]
  });
}
</script>

<template>
  <div class="h-full bg-gray-50 overflow-y-auto">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center z-10">
      <button @click="emit('back')" class="mr-3">
        <i class="fas fa-arrow-left text-gray-600"></i>
      </button>
      <h1 class="text-lg font-medium text-gray-800">设置</h1>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="p-8 text-center">
      <i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
    </div>

    <div v-else class="pb-6">
      <!-- 自动叙事分析开关 -->
      <div class="bg-white mt-2">
        <div class="px-4 py-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                <i class="fas fa-brain text-purple-500"></i>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-800">自动叙事分析</h3>
                <p class="text-xs text-gray-400">收到酒馆消息时自动分析并生成微博</p>
              </div>
            </div>
            <div class="relative">
              <div 
                @click="settingsStore.toggleAutoNarrativeAnalysis()"
                :class="[
                  'w-10 h-6 rounded-full transition-colors cursor-pointer',
                  settingsStore.autoNarrativeAnalysisEnabled ? 'bg-orange-500' : 'bg-gray-200'
                ]"
              >
                <div 
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    settingsStore.autoNarrativeAnalysisEnabled ? 'translate-x-5' : 'translate-x-1'
                  ]"
                ></div>
              </div>
            </div>
          </div>
          <p v-if="settingsStore.autoNarrativeAnalysisEnabled" class="mt-2 px-11 text-xs text-orange-500">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            已开启：每次收到酒馆消息都会消耗 API 调用
          </p>
          <p v-else class="mt-2 px-11 text-xs text-gray-400">
            关闭时，叙事内容仍会缓存，可在任务管理中手动执行
          </p>
        </div>
      </div>

      <!-- 账号会话绑定 (Phase 3) -->
      <div class="bg-white mt-2">
        <div class="px-4 py-2 text-xs text-gray-400 bg-gray-50 flex items-center justify-between">
          <span>账号会话绑定</span>
          <span 
            v-if="accountBindingStatus.isBound" 
            class="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded"
          >
            已绑定
          </span>
          <span 
            v-else-if="hasValidContext" 
            class="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-600 rounded"
          >
            待绑定
          </span>
          <span v-else class="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">未连接</span>
        </div>
        
        <!-- 账号绑定状态 -->
        <div class="px-4 py-3">
          <div class="flex items-center mb-3">
            <div class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mr-3">
              <i class="fas fa-user-tag text-orange-500"></i>
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-800">微博账号</h3>
              <p class="text-xs text-gray-400">
                <template v-if="accountBindingStatus.hasAccount">
                  ID: {{ accountBindingStatus.accountId?.slice(0, 8) }}...
                </template>
                <template v-else>
                  未创建账号
                </template>
              </p>
            </div>
          </div>
          
          <!-- 当前会话信息 -->
          <div v-if="hasValidContext" class="bg-gray-50 rounded-lg p-3 mb-3 text-xs">
            <div class="flex items-center text-gray-500 mb-1">
              <i class="fas fa-link mr-1.5"></i>
              当前会话
            </div>
            <div class="text-gray-700 font-mono">{{ accountBindingStatus.currentSessionId?.slice(0, 16) }}...</div>
            <div v-if="accountBindingStatus.boundSessionId && accountBindingStatus.boundSessionId !== accountBindingStatus.currentSessionId" class="mt-2 text-yellow-600">
              <i class="fas fa-exclamation-triangle mr-1"></i>
              账号绑定在其他会话: {{ accountBindingStatus.boundSessionId?.slice(0, 8) }}...
            </div>
          </div>
          
          <!-- 绑定按钮 -->
          <button
            v-if="accountBindingStatus.hasAccount && hasValidContext && !accountBindingStatus.isBound"
            @click="handleBindAccountToSession"
            :disabled="isBindingAccount"
            class="w-full py-2.5 rounded-lg text-sm transition-colors"
            :class="[
              isBindingAccount
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            ]"
          >
            <i v-if="isBindingAccount" class="fas fa-spinner fa-spin mr-1"></i>
            <i v-else class="fas fa-link mr-1"></i>
            {{ isBindingAccount ? '绑定中...' : '绑定账号到当前会话' }}
          </button>
          
          <p v-else-if="accountBindingStatus.isBound" class="text-xs text-green-500 text-center py-2">
            <i class="fas fa-check-circle mr-1"></i>
            账号已绑定到当前会话
          </p>
          
          <p v-else-if="!accountBindingStatus.hasAccount" class="text-xs text-gray-400 text-center py-2">
            请先创建微博账号
          </p>
          
          <p v-else class="text-xs text-gray-400 text-center py-2">
            请先连接到酒馆
          </p>
          
          <!-- 说明 -->
          <p class="mt-3 text-xs text-gray-400">
            <i class="fas fa-info-circle mr-1"></i>
            绑定后，账号数据仅在当前聊天会话中可见，切换聊天或存档会自动切换账号。
          </p>
        </div>
      </div>

      <!-- 数据过滤模式 -->
      <div class="bg-white mt-2">
        <div class="px-4 py-2 text-xs text-gray-400 bg-gray-50 flex items-center justify-between">
          <span>数据过滤</span>
          <span 
            v-if="hasValidContext" 
            class="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded"
          >
            已连接
          </span>
          <span v-else class="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">未连接</span>
        </div>
        
        <!-- 绑定统计 -->
        <div class="px-4 py-3 border-b border-gray-50">
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div class="font-medium text-gray-700">{{ bindingStats.boundPosts }}/{{ bindingStats.totalPosts }}</div>
              <div class="text-gray-400">博文</div>
            </div>
            <div>
              <div class="font-medium text-gray-700">{{ bindingStats.boundComments }}/{{ bindingStats.totalComments }}</div>
              <div class="text-gray-400">评论</div>
            </div>
            <div>
              <div class="font-medium text-gray-700">{{ bindingStats.boundTopics }}/{{ bindingStats.totalTopics }}</div>
              <div class="text-gray-400">热搜</div>
            </div>
          </div>
          
          <!-- 绑定按钮 -->
          <button
            v-if="bindingStats.unboundPosts > 0 || bindingStats.unboundComments > 0 || bindingStats.unboundTopics > 0"
            @click="handleBindDataToSession"
            :disabled="isBindingData || !hasValidContext"
            class="mt-3 w-full py-2 rounded-lg text-sm transition-colors"
            :class="[
              isBindingData || !hasValidContext
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
            ]"
          >
            <i v-if="isBindingData" class="fas fa-spinner fa-spin mr-1"></i>
            <i v-else class="fas fa-link mr-1"></i>
            {{ isBindingData ? '绑定中...' : '绑定到当前会话' }}
          </button>
          <p v-else class="mt-2 text-xs text-green-500 text-center">
            <i class="fas fa-check-circle mr-1"></i>
            所有数据已绑定
          </p>
        </div>
        
        <!-- 过滤模式选择 -->
        <div class="px-4 py-3">
          <div class="flex items-center mb-3">
            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
              <i class="fas fa-filter text-indigo-500"></i>
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-medium text-gray-800">过滤模式</h3>
              <p class="text-xs text-gray-400">控制显示哪些会话的数据</p>
            </div>
            <button
              @click="showFilterHelpDialog = true"
              class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              title="查看帮助"
            >
              <i class="fas fa-question text-gray-400 text-xs"></i>
            </button>
          </div>
          
          <div class="space-y-2">
            <label 
              v-for="mode in (['all', 'session', 'message', 'swipe'] as FilterMode[])"
              :key="mode"
              class="flex items-center p-2 rounded-lg cursor-pointer transition-colors"
              :class="currentFilterMode === mode ? 'bg-orange-50' : 'hover:bg-gray-50'"
            >
              <input
                type="radio"
                :value="mode"
                v-model="currentFilterMode"
                @change="handleFilterModeChange(mode)"
                class="sr-only"
              />
              <div 
                class="w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center"
                :class="currentFilterMode === mode ? 'border-orange-500' : 'border-gray-300'"
              >
                <div 
                  v-if="currentFilterMode === mode" 
                  class="w-2 h-2 rounded-full bg-orange-500"
                ></div>
              </div>
              <div class="flex-1">
                <span class="text-sm" :class="currentFilterMode === mode ? 'text-orange-600 font-medium' : 'text-gray-700'">
                  {{ mode === 'all' ? '显示全部' : mode === 'session' ? '按会话' : mode === 'message' ? '按楼层' : '按消息页' }}
                </span>
                <p class="text-xs text-gray-400">
                  {{ 
                    mode === 'all' ? '显示所有微博数据' : 
                    mode === 'session' ? '只显示当前会话的数据' : 
                    mode === 'message' ? '显示当前及之前楼层的数据' : 
                    '精确匹配：最后楼层只显示当前 Swipe' 
                  }}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- 自动生成配置 -->
      <div class="bg-white mt-2">
        <div class="px-4 py-2 text-xs text-gray-400 bg-gray-50 flex items-center justify-between">
          <span>自动内容生成</span>
          <span class="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">默认关闭</span>
        </div>
        
        <!-- 首页无内容时自动生成 -->
        <div class="px-4 py-3 border-b border-gray-50">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <i class="fas fa-magic text-green-500"></i>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-800">空首页自动填充</h3>
                <p class="text-xs text-gray-400">首页无内容时自动生成博文</p>
              </div>
            </div>
            <div class="relative">
              <div 
                @click="toggleAutoGenerate('onEmptyFeed')"
                :class="[
                  'w-10 h-6 rounded-full transition-colors cursor-pointer',
                  settingsStore.autoGenerateConfig.onEmptyFeed ? 'bg-orange-500' : 'bg-gray-200'
                ]"
              >
                <div 
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    settingsStore.autoGenerateConfig.onEmptyFeed ? 'translate-x-5' : 'translate-x-1'
                  ]"
                ></div>
              </div>
            </div>
          </div>
          <p v-if="settingsStore.autoGenerateConfig.onEmptyFeed" class="mt-2 px-11 text-xs text-orange-500">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            已开启：刷新首页时可能消耗 API 调用
          </p>
        </div>
        
        <!-- 评论不足时自动生成 -->
        <div class="px-4 py-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <i class="fas fa-comments text-blue-500"></i>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-800">自动生成评论</h3>
                <p class="text-xs text-gray-400">评论不足时自动补充评论</p>
              </div>
            </div>
            <div class="relative">
              <div 
                @click="toggleAutoGenerate('onFewComments')"
                :class="[
         'w-10 h-6 rounded-full transition-colors cursor-pointer',
                  settingsStore.autoGenerateConfig.onFewComments ? 'bg-orange-500' : 'bg-gray-200'
                ]"
              >
                <div 
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    settingsStore.autoGenerateConfig.onFewComments ? 'translate-x-5' : 'translate-x-1'
                  ]"
                ></div>
              </div>
            </div>
          </div>
          <p v-if="settingsStore.autoGenerateConfig.onFewComments" class="mt-2 px-11 text-xs text-orange-500">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            已开启：查看博文详情时可能消耗 API 调用
          </p>
        </div>
      </div>
      
      <!-- LLM 请求管理 -->
      <div class="bg-white mt-2">
        <div class="px-4 py-3 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <i class="fas fa-robot text-blue-500"></i>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-800">LLM 请求管理</h3>
                <p class="text-xs text-gray-400">管理 AI 内容生成请求</p>
              </div>
            </div>
            <div 
              v-if="llmStats.isGenerating"
              class="flex items-center text-xs text-orange-500"
            >
              <i class="fas fa-circle-notch fa-spin mr-1"></i>
              生成中
            </div>
          </div>
        </div>
        
        <!-- 请求统计 -->
        <div class="px-4 py-3 grid grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-lg font-bold text-gray-800">{{ llmStats.totalRequests }}</div>
            <div class="text-xs text-gray-400">总请求</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-orange-500">{{ llmStats.pendingRequests }}</div>
            <div class="text-xs text-gray-400">进行中</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-red-500">{{ llmStats.failedRequests }}</div>
            <div class="text-xs text-gray-400">失败</div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            @click="cancelPendingRequests"
            :disabled="llmStats.pendingRequests === 0"
            :class="[
              'flex-1 py-2 rounded-lg text-sm transition-colors',
              llmStats.pendingRequests > 0
                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            ]"
          >
            <i class="fas fa-stop-circle mr-1"></i>
            取消全部
          </button>
          <button
            @click="emit('open-task-manager')"
            class="flex-1 py-2 rounded-lg text-sm bg-orange-50 text-orange-500 hover:bg-orange-100 transition-colors"
          >
            <i class="fas fa-tasks mr-1"></i>
            任务管理
          </button>
        </div>
      </div>

      <!-- 账号切换 -->
      <div class="bg-white mt-2">
        <div class="px-4 py-3 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                <i class="fas fa-users text-orange-500"></i>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-800">账号切换</h3>
                <p class="text-xs text-gray-400">在不同身份间切换</p>
              </div>
            </div>
            <span class="text-xs text-gray-400">{{ playerAccounts.length }} 个账号</span>
          </div>
        </div>
        
        <!-- 账号列表 -->
        <div class="divide-y divide-gray-50">
          <div
            v-for="account in playerAccounts"
            :key="account.id"
            @click="handleSwitchAccount(account)"
            class="px-4 py-3 flex items-center cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <img
              :src="getAccountAvatar(account)"
              class="w-10 h-10 rounded-full mr-3"
              alt="头像"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-800 truncate">{{ getAccountName(account) }}</span>
                <span 
                  v-if="account.id === currentAccountId"
                  class="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] rounded"
                >
                  当前
                </span>
              </div>
              <p class="text-xs text-gray-400 truncate">{{ getScopeLabel(account) }}</p>
            </div>
            <i 
              v-if="account.id === currentAccountId"
              class="fas fa-check text-orange-500"
            ></i>
            <i v-else class="fas fa-chevron-right text-gray-300 text-xs"></i>
          </div>
        </div>
        
        <!-- 无账号提示 -->
        <div v-if="playerAccounts.length === 0" class="px-4 py-6 text-center">
          <i class="fas fa-user-plus text-2xl text-gray-300 mb-2"></i>
          <p class="text-sm text-gray-400">暂无其他账号</p>
        </div>
      </div>

      <!-- 其他设置 -->
      <div
        v-for="(section, sectionIndex) in settingSections"
        :key="section.title"
        class="bg-white mt-2"
      >
        <div class="px-4 py-2 text-xs text-gray-400 bg-gray-50">
          {{ section.title }}
        </div>
        <div class="divide-y divide-gray-50">
          <div
            v-for="(item, itemIndex) in section.items"
            :key="item.label"
            @click="item.toggle ? handleToggle(sectionIndex, itemIndex) : handleSettingClick(item.action)"
            class="px-4 py-3 flex items-center cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div class="w-8 flex justify-center mr-3">
              <i 
                :class="[
                  'fas', item.icon,
                  item.danger ? 'text-red-500' : 'text-gray-400'
                ]"
              ></i>
            </div>
            <span 
              :class="[
                'flex-1 text-sm',
                item.danger ? 'text-red-500' : 'text-gray-700'
              ]"
            >
              {{ item.label }}
            </span>
            
            <!-- 缓存大小显示 -->
         <span v-if="item.action === 'clearcache'" class="text-sm text-gray-400 mr-2">
              {{ cacheSize }}
            </span>
            <!-- 其他值显示 -->
            <span v-else-if="item.value" class="text-sm text-gray-400 mr-2">
              {{ item.value }}
            </span>
            
            <!-- 开关 -->
            <div v-if="item.toggle" class="relative">
              <div 
                :class="[
                  'w-10 h-6 rounded-full transition-colors',
                  item.toggleValue ? 'bg-orange-500' : 'bg-gray-200'
                ]"
              >
                <div 
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    item.toggleValue ? 'translate-x-5' : 'translate-x-1'
                  ]"
                ></div>
              </div>
            </div>
            
            <!-- 箭头 -->
            <i 
              v-else-if="!item.danger"
              class="fas fa-chevron-right text-gray-300 text-xs"
            ></i>
          </div>
        </div>
      </div>

      <!-- 版本信息 -->
      <div class="text-center py-6 text-xs text-gray-400">
        微博 模拟版 v1.0.0
      </div>
    </div>

    <!-- 清除缓存弹窗 -->
    <div 
      v-if="showClearCacheDialog"
      class="absolute inset-0 bg-black/50 flex items-center justify-center z-[100]"
      @click.self="closeClearCacheDialog"
    >
        <div class="bg-white rounded-xl w-[90%] max-w-sm overflow-hidden shadow-xl">
          <!-- 弹窗标题 -->
          <div class="px-4 py-3 border-b border-gray-100">
            <h3 class="text-base font-medium text-gray-800 text-center">清理缓存</h3>
          </div>
          
          <!-- 缓存统计 -->
          <div class="px-4 py-4">
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
              <div class="text-center mb-3">
                <span class="text-2xl font-bold text-orange-500">{{ cacheSize }}</span>
                <p class="text-xs text-gray-400 mt-1">缓存数据</p>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div class="font-medium text-gray-700">{{ cacheStats.posts }}</div>
                  <div class="text-gray-400">博文</div>
                </div>
                <div>
                  <div class="font-medium text-gray-700">{{ cacheStats.hotSearches }}</div>
                  <div class="text-gray-400">热搜</div>
                </div>
                <div>
                  <div class="font-medium text-gray-700">{{ cacheStats.comments }}</div>
                  <div class="text-gray-400">评论</div>
                </div>
              </div>
            </div>
            
            <!-- 清理选项 -->
            <div class="space-y-3">
              <p class="text-sm text-gray-500 mb-2">选择要清理的数据：</p>
              
              <!-- 清除博文选项 -->
              <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                <div class="flex items-center">
                  <i class="fas fa-file-alt text-blue-500 mr-3"></i>
                  <div>
                    <span class="text-sm text-gray-700">所有博文</span>
                    <p class="text-xs text-gray-400">包含博文和评论</p>
                  </div>
                </div>
                <div class="relative">
                  <input 
                    type="checkbox" 
                    v-model="clearOptions.posts"
                    class="sr-only"
                  />
                  <div 
                    :class="[
                      'w-10 h-6 rounded-full transition-colors',
                      clearOptions.posts ? 'bg-orange-500' : 'bg-gray-200'
                    ]"
                  >
                    <div 
                      :class="[
                        'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        clearOptions.posts ? 'translate-x-5' : 'translate-x-1'
                      ]"
                    ></div>
                  </div>
                </div>
              </label>
              
              <!-- 清除热搜选项 -->
              <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                <div class="flex items-center">
                  <i class="fas fa-fire text-red-500 mr-3"></i>
                  <div>
                    <span class="text-sm text-gray-700">热搜榜</span>
                    <p class="text-xs text-gray-400">所有热搜话题数据</p>
                  </div>
                </div>
                <div class="relative">
                  <input 
                    type="checkbox" 
                    v-model="clearOptions.hotSearches"
                    class="sr-only"
                  />
                  <div 
                    :class="[
                      'w-10 h-6 rounded-full transition-colors',
                      clearOptions.hotSearches ? 'bg-orange-500' : 'bg-gray-200'
                    ]"
                  >
                    <div 
                      :class="[
                        'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        clearOptions.hotSearches ? 'translate-x-5' : 'translate-x-1'
                      ]"
                    ></div>
                  </div>
                </div>
              </label>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="px-4 py-3 border-t border-gray-100 flex gap-3">
            <button
              @click="closeClearCacheDialog"
              class="flex-1 py-2.5 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              @click="confirmClearCache"
              :disabled="clearCacheLoading || (!clearOptions.posts && !clearOptions.hotSearches)"
              :class="[
                'flex-1 py-2.5 rounded-lg text-sm text-white transition-colors',
                clearCacheLoading || (!clearOptions.posts && !clearOptions.hotSearches)
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600'
              ]"
            >
              <i v-if="clearCacheLoading" class="fas fa-spinner fa-spin mr-1"></i>
              {{ clearCacheLoading ? '清理中...' : '确认清理' }}
            </button>
          </div>
        </div>
      </div>

    <!-- 过滤模式帮助弹窗 -->
    <div 
      v-if="showFilterHelpDialog"
      class="absolute inset-0 bg-black/50 flex items-center justify-center z-[100]"
      @click.self="showFilterHelpDialog = false"
    >
      <div class="bg-white rounded-xl w-[90%] max-w-sm overflow-hidden shadow-xl max-h-[80%] flex flex-col">
        <!-- 弹窗标题 -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 class="text-base font-medium text-gray-800">过滤模式说明</h3>
          <button @click="showFilterHelpDialog = false" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- 帮助内容 -->
        <div class="px-4 py-4 overflow-y-auto">
          <!-- 名词解释 -->
          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-book text-indigo-400 mr-1.5"></i>
              名词解释
            </h4>
            <div class="space-y-3 text-xs">
              <div class="bg-blue-50 rounded-lg p-3">
                <div class="font-medium text-blue-700 mb-1">会话 (Session)</div>
                <p class="text-blue-600">指一次完整的聊天对话。在酒馆中，每次开始新聊天或加载不同存档，都是一个独立会话。</p>
              </div>
              <div class="bg-green-50 rounded-lg p-3">
                <div class="font-medium text-green-700 mb-1">楼层 (Message)</div>
                <p class="text-green-600">聊天中的每一条消息就是一层楼。第1楼是开场白，之后你发一条、AI回复一条，楼层依次增加。</p>
              </div>
              <div class="bg-purple-50 rounded-lg p-3">
                <div class="font-medium text-purple-700 mb-1">消息页 (Swipe)</div>
                <p class="text-purple-600">同一楼层可以有多个回复版本。当你对AI的回复不满意，点击"换一个"生成的新回复，就是不同的消息页。</p>
              </div>
            </div>
          </div>
          
          <!-- 模式说明 -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-filter text-indigo-400 mr-1.5"></i>
              过滤模式
            </h4>
            <div class="space-y-2 text-xs">
              <div class="border border-gray-100 rounded-lg p-3">
                <div class="font-medium text-gray-700 mb-1">
                  <i class="fas fa-globe text-gray-400 mr-1"></i>
                  显示全部
                </div>
                <p class="text-gray-500">不进行任何过滤，显示所有微博数据。适合想看全部内容的情况。</p>
              </div>
              <div class="border border-orange-200 rounded-lg p-3 bg-orange-50/50">
                <div class="font-medium text-orange-700 mb-1">
                  <i class="fas fa-comments text-orange-400 mr-1"></i>
                  按会话 <span class="text-[10px] text-orange-500 ml-1">推荐</span>
                </div>
                <p class="text-gray-500">只显示当前聊天会话中产生的微博数据。切换到其他存档时，会自动显示该存档的数据。</p>
              </div>
              <div class="border border-gray-100 rounded-lg p-3">
                <div class="font-medium text-gray-700 mb-1">
                  <i class="fas fa-layer-group text-gray-400 mr-1"></i>
                  按楼层
                </div>
                <p class="text-gray-500">显示当前楼层及之前产生的数据。适合回顾故事进展时使用。</p>
              </div>
              <div class="border border-gray-100 rounded-lg p-3">
                <div class="font-medium text-gray-700 mb-1">
                  <i class="fas fa-file-alt text-gray-400 mr-1"></i>
                  按消息页
                </div>
                <p class="text-gray-500">最精确的过滤。最后一楼只显示当前消息页的数据，之前楼层的数据保持显示。适合需要严格匹配剧情分支的场景。</p>
              </div>
            </div>
          </div>
          
          <!-- 使用建议 -->
          <div class="mt-4 bg-gray-50 rounded-lg p-3">
            <div class="flex items-start">
              <i class="fas fa-lightbulb text-yellow-500 mr-2 mt-0.5"></i>
              <div class="text-xs text-gray-600">
                <span class="font-medium">建议：</span>大多数情况下使用「按会话」即可。只有在需要精细控制剧情分支时，才需要使用「按楼层」或「按消息页」。
              </div>
            </div>
          </div>
        </div>
        
        <!-- 关闭按钮 -->
        <div class="px-4 py-3 border-t border-gray-100 flex-shrink-0">
          <button
            @click="showFilterHelpDialog = false"
            class="w-full py-2.5 rounded-lg text-sm text-white bg-orange-500 hover:bg-orange-600 transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
