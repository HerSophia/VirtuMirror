<script setup lang="ts">
/**
 * 账号管理 App
 * 
 * 聚合管理玩家在各个平台、各个世界的所有身份
 * @see docs/systems/account-service.md Section 5
 * @see docs/dev/Security/account-session-binding.md
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/accountStore'
import { accountService } from '@/services/account/accountService'
import type { CharacterEntity, PlatformAccount, FullProfile } from '@/types/account'

import PlayerIdentityCard from './components/PlayerIdentityCard.vue'
import PlatformAccountGroup from './components/PlatformAccountGroup.vue'
import AccountEditDialog from './components/AccountEditDialog.vue'
import AccountCreateDialog from './components/AccountCreateDialog.vue'

const router = useRouter()
const accountStore = useAccountStore()

// 状态
const isLoading = ref(false)
const playerEntity = ref<CharacterEntity | null>(null)
const playerAccounts = ref<PlatformAccount[]>([])
const accountsByPlatform = ref<Map<string, PlatformAccount[]>>(new Map())

// 弹窗状态
const showEditDialog = ref(false)
const showCreateDialog = ref(false)
const editingAccount = ref<PlatformAccount | null>(null)
const createPlatformId = ref('')

// 平台配置
const platformConfig: Record<string, { name: string; icon: string; color: string }> = {
  weibo: { name: '微博', icon: 'fab fa-weibo', color: '#E6162D' },
  bilibili: { name: 'B站', icon: 'fas fa-tv', color: '#FB7299' },
  chat: { name: '聊天', icon: 'fas fa-comments', color: '#07C160' },
}

// 会话上下文（来自 accountStore，自动从 Bridge Adapter 获取）
const sessionContext = computed(() => accountStore.sessionContext)
const isConnectedToTavern = computed(() => {
  const sid = sessionContext.value?.sessionId
  return sid && sid !== 'standalone-session'
})
const sessionIdDisplay = computed(() => {
  const sid = sessionContext.value?.sessionId
  if (!sid || sid === 'standalone-session') return null
  return sid.length > 12 ? `${sid.slice(0, 8)}...${sid.slice(-4)}` : sid
})

// 计算属性
const platforms = computed(() => {
  const result: { id: string; name: string; icon: string; color: string; accounts: PlatformAccount[] }[] = []
  
  // 添加已有账号的平台
  for (const [platformId, accounts] of accountsByPlatform.value) {
    const config = platformConfig[platformId] || { 
      name: platformId, 
      icon: 'fas fa-globe', 
      color: '#666' 
    }
    result.push({
      id: platformId,
      ...config,
      accounts,
    })
  }
  
  // 添加没有账号但配置了的平台
  for (const [platformId, config] of Object.entries(platformConfig)) {
    if (!accountsByPlatform.value.has(platformId)) {
      result.push({
        id: platformId,
        ...config,
        accounts: [],
      })
    }
  }
  
  return result
})

// 加载数据
async function loadData() {
  isLoading.value = true
  try {
    // 获取玩家实体
    playerEntity.value = await accountService.getPlayerEntity()
    
    if (playerEntity.value) {
      // 获取玩家的所有平台账号
      playerAccounts.value = await accountStore.getPlayerAllAccounts()
      
      // 按平台分组
      const grouped = new Map<string, PlatformAccount[]>()
      for (const account of playerAccounts.value) {
        const list = grouped.get(account.platformId) || []
        list.push(account)
        grouped.set(account.platformId, list)
      }
      accountsByPlatform.value = grouped
    }
  } catch (error) {
    console.error('[AccountManager] 加载数据失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 编辑玩家身份
function handleEditPlayer() {
  // TODO: 可以添加编辑玩家基础信息的弹窗
  console.log('编辑玩家身份')
}

// 编辑账号
function handleEditAccount(account: PlatformAccount) {
  editingAccount.value = account
  showEditDialog.value = true
}

// 创建新账号
function handleCreateAccount(platformId: string) {
  createPlatformId.value = platformId
  showCreateDialog.value = true
}

// 删除账号
async function handleDeleteAccount(account: PlatformAccount) {
  if (!confirm(`确定要删除账号 ${account.nickname || account.handle || '未命名'} 吗？`)) {
    return
  }
  
  try {
    await accountService.deletePlatformAccount(account.id)
    await loadData()
  } catch (error) {
    console.error('[AccountManager] 删除账号失败:', error)
    alert('删除失败，请重试')
  }
}

// 切换到某个账号（设置为当前活跃）
function handleSwitchAccount(account: PlatformAccount) {
  // TODO: 实现账号切换逻辑
  console.log('切换到账号:', account.id)
}

// 保存编辑
async function handleSaveEdit(data: Partial<PlatformAccount>) {
  if (!editingAccount.value) return
  
  try {
    await accountService.updatePlatformAccount(editingAccount.value.id, data)
    showEditDialog.value = false
    editingAccount.value = null
    await loadData()
  } catch (error) {
    console.error('[AccountManager] 保存失败:', error)
    alert('保存失败，请重试')
  }
}

// 账号创建完成回调（CreateAccountDialog 内部已处理创建逻辑）
function handleAccountCreated(account: PlatformAccount) {
  console.log('[AccountManager] 账号创建成功:', account.id)
  showCreateDialog.value = false
  createPlatformId.value = ''
  loadData()
}

// 返回
function handleBack() {
  router.back()
}

// 获取作用域标签
function getScopeLabel(account: PlatformAccount): string {
  switch (account.scope) {
    case 'global':
      return '🌐 全局'
    case 'character':
      return `🏷️ ${account.scopeCharacterCardId || '角色卡'}`
    case 'session':
      return '📍 当前会话'
    default:
      return ''
  }
}

onMounted(() => {
  loadData()
})

// 监听 store 变化
watch(() => accountStore.isInitialized, (initialized) => {
  if (initialized) {
    loadData()
  }
})
</script>

<template>
  <div class="account-manager-app">
    <!-- 头部 -->
    <div class="app-header">
      <button class="back-btn" @click="handleBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="app-title">账号管理</h1>
      <div class="header-spacer"></div>
    </div>
    
    <!-- 内容区 -->
    <div class="app-content">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载中...</span>
      </div>
      
      <template v-else>
        <!-- 会话上下文卡片 -->
        <div class="session-context-card">
          <div class="session-header">
            <i class="fas fa-link session-icon"></i>
            <span class="session-title">当前会话上下文</span>
          </div>
          <div class="session-info">
            <div class="session-row">
              <span class="session-label">状态：</span>
              <span :class="['session-status', isConnectedToTavern ? 'connected' : 'standalone']">
                <i :class="isConnectedToTavern ? 'fas fa-circle' : 'far fa-circle'"></i>
                {{ isConnectedToTavern ? '已连接酒馆' : '独立模式' }}
              </span>
            </div>
            <div v-if="sessionIdDisplay" class="session-row">
              <span class="session-label">会话 ID：</span>
              <span class="session-value">{{ sessionIdDisplay }}</span>
            </div>
            <div v-if="sessionContext?.characterCardId" class="session-row">
              <span class="session-label">角色卡：</span>
              <span class="session-value">{{ sessionContext.characterCardId }}</span>
            </div>
          </div>
          <p class="session-hint">
            {{ isConnectedToTavern ? '创建的账号将自动绑定到当前会话' : '独立模式下创建的账号为全局可见' }}
          </p>
        </div>
        
        <!-- 玩家身份卡片 -->
        <PlayerIdentityCard
          v-if="playerEntity"
          :entity="playerEntity"
          @edit="handleEditPlayer"
        />
        
        <!-- 分隔线 -->
        <div class="section-divider">
          <span class="divider-text">📱 平台账号</span>
        </div>
        
        <!-- 平台账号列表 -->
        <div class="platform-list">
          <PlatformAccountGroup
            v-for="platform in platforms"
            :key="platform.id"
            :platform-id="platform.id"
            :platform-name="platform.name"
            :platform-icon="platform.icon"
            :platform-color="platform.color"
            :accounts="platform.accounts"
            @edit="handleEditAccount"
            @delete="handleDeleteAccount"
            @switch="handleSwitchAccount"
            @create="handleCreateAccount(platform.id)"
          />
        </div>
        
        <!-- 空状态提示 -->
        <div v-if="!playerEntity" class="empty-state">
          <i class="fas fa-user-circle"></i>
          <p>请先初始化账号系统</p>
        </div>
      </template>
    </div>
    
    <!-- 编辑账号弹窗 -->
    <AccountEditDialog
      v-if="showEditDialog && editingAccount"
      :account="editingAccount"
      @close="showEditDialog = false"
      @save="handleSaveEdit"
    />
    
    <!-- 创建账号弹窗 -->
    <AccountCreateDialog
      :visible="showCreateDialog"
      :platform-id="createPlatformId"
      :platform-name="platformConfig[createPlatformId]?.name || createPlatformId"
      :platform-color="platformConfig[createPlatformId]?.color"
      @close="showCreateDialog = false"
      @created="handleAccountCreated"
    />
  </div>
</template>

<style scoped>
.account-manager-app {
  @apply h-full flex flex-col;
  background-color: var(--color-background);
}

.app-header {
  @apply flex items-center px-4 py-3;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.back-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  @apply text-lg;
  color: var(--color-primary);
  background: transparent;
  transition: background-color 0.2s;
}

.back-btn:hover {
  background-color: var(--color-surface-variant);
}

.app-title {
  @apply flex-1 text-center text-lg font-semibold;
  color: var(--color-text);
}

.header-spacer {
  @apply w-8;
}

.app-content {
  @apply flex-1 overflow-y-auto p-4;
}

.loading-state {
  @apply flex flex-col items-center justify-center py-12;
  @apply text-lg gap-3;
  color: var(--color-text-secondary);
}

.section-divider {
  @apply my-6 flex items-center;
}

.divider-text {
  @apply px-3 text-sm font-medium;
  color: var(--color-text-secondary);
  background-color: var(--color-background);
}

.section-divider::before,
.section-divider::after {
  content: '';
  @apply flex-1 h-px;
  background-color: var(--color-border);
}

.platform-list {
  @apply space-y-4;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-16;
  @apply text-center gap-4;
  color: var(--color-text-secondary);
}

.empty-state i {
  @apply text-5xl opacity-50;
}

.empty-state p {
  @apply text-base;
}

/* 会话上下文卡片 */
.session-context-card {
  @apply p-4 rounded-xl mb-4;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
}

.session-header {
  @apply flex items-center gap-2 mb-3;
}

.session-icon {
  @apply text-sm;
  color: var(--color-primary);
}

.session-title {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.session-info {
  @apply space-y-2 mb-3;
}

.session-row {
  @apply flex items-center gap-2 text-sm;
}

.session-label {
  color: var(--color-text-secondary);
  min-width: 60px;
}

.session-value {
  @apply font-mono text-xs;
  color: var(--color-text);
}

.session-status {
  @apply flex items-center gap-1.5;
}

.session-status.connected {
  color: #10b981;
}

.session-status.connected i {
  @apply text-xs;
}

.session-status.standalone {
  color: var(--color-text-secondary);
}

.session-status.standalone i {
  @apply text-xs;
}

.session-hint {
  @apply text-xs;
  color: var(--color-text-secondary);
}
</style>
