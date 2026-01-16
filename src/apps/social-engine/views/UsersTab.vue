<script setup lang="ts">
/**
 * 用户池 Tab
 * 管理影子账号（Shadow Accounts）
 */
import { ref, computed, onMounted } from 'vue';
import { db } from '@/services/database/schema';
import type { PlatformAccount as SocialAccount } from '@/types/social';
import type { PlatformAccount as NewAccount } from '@/types/account';

// 统一的账号显示接口
interface DisplayAccount {
  id: string;
  nickname?: string;
  handle?: string;
  platformId: string;
  origin: string;
  evolution?: {
    appearanceCount: number;
    semanticTags?: string[];
  };
  source: 'social' | 'account'; // 区分来源表
}

// 账号列表
const accounts = ref<DisplayAccount[]>([]);

// 筛选条件
const filterPlatform = ref<string>('all');
const filterOrigin = ref<string>('all');

// 可用平台
const availablePlatforms = ref<string[]>([]);

// 加载状态
const isLoading = ref(true);

// 过滤后的账号
const filteredAccounts = computed(() => {
  return accounts.value.filter(acc => {
    if (filterPlatform.value !== 'all' && acc.platformId !== filterPlatform.value) return false;
    if (filterOrigin.value !== 'all' && acc.origin !== filterOrigin.value) return false;
    return true;
  });
});

// 统计数据
const stats = computed(() => {
  const total = accounts.value.length;
  const shadow = accounts.value.filter(a => a.origin === 'llm_generated').length;
  const preset = accounts.value.filter(a => a.origin === 'system_preset').length;
  const user = accounts.value.filter(a => a.origin === 'user_created').length;
  return { total, shadow, preset, user };
});

onMounted(async () => {
  await loadAccounts();
});

async function loadAccounts() {
  isLoading.value = true;
  try {
    // 同时获取两个账号系统的数据
    const [socialAccounts, newAccounts] = await Promise.all([
      db.socialAccounts.toArray(),
      db.platformAccounts.toArray(),
    ]);
    
    // 转换旧系统账号
    const socialDisplayAccounts: DisplayAccount[] = socialAccounts.map(a => ({
      id: a.id,
      nickname: a.nickname,
      handle: a.handle,
      platformId: a.platformId,
      origin: a.origin,
      evolution: a.evolution,
      source: 'social' as const,
    }));
    
    // 转换新系统账号
    const newDisplayAccounts: DisplayAccount[] = newAccounts.map(a => ({
      id: a.id,
      nickname: a.nickname || a.handle,
      handle: a.handle,
      platformId: a.platformId,
      origin: 'account_system', // 新系统的账号标记
      source: 'account' as const,
    }));
    
    // 合并两个列表
    accounts.value = [...socialDisplayAccounts, ...newDisplayAccounts];
    
    // 提取可用平台
    const platforms = new Set(accounts.value.map(a => a.platformId));
    availablePlatforms.value = Array.from(platforms);
  } catch (error) {
    console.error('[UsersTab] Failed to load accounts:', error);
  } finally {
    isLoading.value = false;
  }
}

// 清理过期影子账号（只清理 socialAccounts 中的）
async function cleanupShadowAccounts() {
  const confirmed = window.confirm('确定要清理所有影子账号吗？此操作不可恢复。');
  if (!confirmed) return;
  
  try {
    // 只清理旧系统的影子账号
    const shadowIds = accounts.value
      .filter(a => a.source === 'social' && a.origin === 'llm_generated')
      .map(a => a.id);
    
    await db.socialAccounts.bulkDelete(shadowIds);
    await loadAccounts();
  } catch (error) {
    console.error('[UsersTab] Failed to cleanup:', error);
  }
}

// 来源标签
const originLabels: Record<string, { label: string; color: string }> = {
  system_preset: { label: '预设', color: 'bg-blue-500' },
  user_created: { label: '用户', color: 'bg-green-500' },
  llm_generated: { label: '影子', color: 'bg-purple-500' },
  account_system: { label: '账号系统', color: 'bg-indigo-500' },
};
</script>

<template>
  <div class="users-tab">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">总账号</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.shadow }}</span>
        <span class="stat-label">影子账号</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.preset }}</span>
        <span class="stat-label">预设账号</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.user }}</span>
        <span class="stat-label">用户账号</span>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filters">
      <select v-model="filterPlatform" class="filter-select">
        <option value="all">全部平台</option>
        <option v-for="p in availablePlatforms" :key="p" :value="p">{{ p }}</option>
      </select>
      
      <select v-model="filterOrigin" class="filter-select">
        <option value="all">全部来源</option>
        <option value="system_preset">预设账号</option>
        <option value="user_created">用户创建</option>
        <option value="llm_generated">影子账号</option>
      </select>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <button class="action-btn" @click="loadAccounts">
        🔄 刷新
      </button>
      <button class="action-btn danger" @click="cleanupShadowAccounts">
        🗑️ 清理影子账号
      </button>
    </div>

    <!-- 账号列表 -->
    <div class="accounts-list">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner" />
        <p>加载中...</p>
      </div>
      
      <div v-else-if="filteredAccounts.length === 0" class="empty-state">
        <p>暂无账号数据</p>
      </div>
      
      <div
        v-for="account in filteredAccounts"
        :key="account.id"
        class="account-card"
      >
        <div class="account-avatar">
          {{ account.nickname?.charAt(0) || '?' }}
        </div>
        <div class="account-info">
          <div class="account-name">
            {{ account.nickname || '未命名' }}
            <span v-if="account.handle" class="account-handle">@{{ account.handle }}</span>
          </div>
          <div class="account-meta">
            <span class="platform-tag">{{ account.platformId }}</span>
            <span 
              class="origin-tag" 
              :class="originLabels[account.origin]?.color || 'bg-gray-500'"
            >
              {{ originLabels[account.origin]?.label || account.origin }}
            </span>
          </div>
          <div v-if="account.evolution" class="evolution-info">
            <span>出现 {{ account.evolution.appearanceCount }} 次</span>
            <span v-if="account.evolution.semanticTags?.length">
              · {{ account.evolution.semanticTags.slice(0, 3).join(', ') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 说明 -->
    <div class="info-section">
      <h4 class="section-title">ℹ️ 关于影子账号</h4>
      <div class="info-content">
        <p><strong>影子账号（Shadow Accounts）</strong>是由 LLM 在生成内容时自动创建的虚拟用户：</p>
        <ul>
          <li>当 LLM 生成评论/博文时，会创建对应的作者账号</li>
          <li>影子账号会被持久化，后续可能被复用，产生"熟面孔"效果</li>
          <li>账号会记录出现次数和语义标签，用于人设演化</li>
        </ul>
        <p class="note">💡 清理影子账号可以释放存储空间，但会丢失账号演化数据</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-tab {
  @apply p-4 space-y-4;
}

.stats-row {
  @apply grid grid-cols-4 gap-2;
}

.stat-item {
  @apply flex flex-col items-center p-3 rounded-lg;
  background: var(--color-surface);
}

.stat-value {
  @apply text-xl font-bold;
  color: var(--color-text);
}

.stat-label {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.filters {
  @apply flex gap-2;
}

.filter-select {
  @apply flex-1 p-2 rounded-lg text-sm;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.actions {
  @apply flex gap-2;
}

.action-btn {
  @apply flex-1 p-2 rounded-lg text-sm font-medium transition-colors;
  background: var(--color-surface);
  color: var(--color-text);
}

.action-btn:hover {
  background: var(--color-surface-variant);
}

.action-btn.danger {
  color: var(--color-error);
}

.accounts-list {
  @apply space-y-2;
}

.loading-state,
.empty-state {
  @apply flex flex-col items-center justify-center py-8;
  color: var(--color-text-secondary);
}

.loading-spinner {
  @apply w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-2;
  border-color: var(--color-primary);
  border-top-color: transparent;
}

.account-card {
  @apply flex gap-3 p-3 rounded-lg;
  background: var(--color-surface);
}

.account-avatar {
  @apply w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium;
  background: var(--color-primary);
  color: white;
}

.account-info {
  @apply flex-1 min-w-0;
}

.account-name {
  @apply font-medium truncate;
  color: var(--color-text);
}

.account-handle {
  @apply text-sm font-normal;
  color: var(--color-text-secondary);
}

.account-meta {
  @apply flex gap-2 mt-1;
}

.platform-tag {
  @apply text-xs px-1.5 py-0.5 rounded;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.origin-tag {
  @apply text-xs px-1.5 py-0.5 rounded text-white;
}

.evolution-info {
  @apply text-xs mt-1 truncate;
  color: var(--color-text-secondary);
}

.info-section {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.section-title {
  @apply text-sm font-medium mb-2;
  color: var(--color-text);
}

.info-content {
  @apply text-sm space-y-2;
  color: var(--color-text-secondary);
}

.info-content ul {
  @apply list-disc pl-5 space-y-1;
}

.info-content .note {
  @apply mt-3 p-2 rounded-lg text-xs;
  background: var(--color-surface-variant);
}
</style>
