<script setup lang="ts">
/**
 * 账号卡片组件
 * 
 * 显示单个平台账号信息
 */
import { computed } from 'vue'
import type { PlatformAccount } from '@/types/account'
import { useAccountStore } from '@/stores/accountStore'

const props = defineProps<{
  account: PlatformAccount
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  switch: []
}>()

const accountStore = useAccountStore()

// 获取关联的实体信息
const entity = computed(() => {
  return accountStore.entities.get(props.account.entityId)
})

// 显示名称（优先使用账号昵称，否则使用实体名称）
const displayName = computed(() => {
  return props.account.nickname || entity.value?.displayName || '未知'
})

// 显示头像
const displayAvatar = computed(() => {
  return props.account.avatarOverride || entity.value?.avatar || null
})

// 首字母
const initials = computed(() => {
  return displayName.value.charAt(0).toUpperCase()
})

// 作用域标签
const scopeInfo = computed(() => {
  switch (props.account.scope) {
    case 'global':
      return { icon: '🌐', text: '全局', class: 'global' }
    case 'character':
      return { 
        icon: '🏷️', 
        text: props.account.scopeCharacterCardId || '角色卡', 
        class: 'character' 
      }
    case 'session': {
      // 显示绑定的会话 ID（截断显示）
      const sessionId = props.account.scopeSessionId
      const sessionDisplay = sessionId 
        ? (sessionId.length > 8 ? `${sessionId.slice(0, 6)}...` : sessionId)
        : '当前会话'
      return { icon: '📍', text: sessionDisplay, class: 'session' }
    }
    default:
      return { icon: '❓', text: '未知', class: '' }
  }
})

// 是否绑定到当前会话
const isBoundToCurrentSession = computed(() => {
  if (props.account.scope !== 'session') return false
  const currentSessionId = accountStore.sessionContext?.sessionId
  return props.account.scopeSessionId === currentSessionId
})

// 粉丝数显示
const followersDisplay = computed(() => {
  const count = props.account.platformData?.followers
  if (!count) return null
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万'
  }
  return count.toString()
})
</script>

<template>
  <div class="account-card">
    <!-- 头像 -->
    <div class="account-avatar">
      <img v-if="displayAvatar" :src="displayAvatar" alt="头像" />
      <span v-else class="avatar-initials">{{ initials }}</span>
    </div>
    
    <!-- 信息 -->
    <div class="account-info">
      <div class="name-row">
        <span class="account-name">{{ displayName }}</span>
        <span v-if="account.handle" class="account-handle">@{{ account.handle }}</span>
      </div>
      <div class="meta-row">
        <span :class="['scope-badge', scopeInfo.class, { 'current': isBoundToCurrentSession }]">
          {{ scopeInfo.icon }} {{ scopeInfo.text }}
          <i v-if="isBoundToCurrentSession" class="fas fa-check-circle current-indicator"></i>
        </span>
        <span v-if="followersDisplay" class="followers">
          粉丝 {{ followersDisplay }}
        </span>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="account-actions">
      <button class="action-btn edit" @click.stop="emit('edit')" title="编辑">
        <i class="fas fa-pen"></i>
      </button>
      <button class="action-btn delete" @click.stop="emit('delete')" title="删除">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.account-card {
  @apply flex items-center gap-3 p-3 rounded-xl;
  background-color: var(--color-surface-variant);
  transition: all 0.2s;
}

.account-card:hover {
  background-color: var(--color-border);
}

.account-avatar {
  @apply w-12 h-12 rounded-full overflow-hidden flex-shrink-0;
  @apply flex items-center justify-center;
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.account-avatar img {
  @apply w-full h-full object-cover;
}

.avatar-initials {
  @apply text-lg font-semibold;
  color: #666;
}

.account-info {
  @apply flex-1 min-w-0;
}

.name-row {
  @apply flex items-center gap-2 mb-1;
}

.account-name {
  @apply font-medium truncate;
  color: var(--color-text);
}

.account-handle {
  @apply text-sm truncate;
  color: var(--color-text-secondary);
}

.meta-row {
  @apply flex items-center gap-3 text-xs;
}

.scope-badge {
  @apply px-2 py-0.5 rounded;
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
}

.scope-badge.global {
  background-color: rgba(102, 126, 234, 0.15);
  color: #667eea;
}

.scope-badge.character {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.scope-badge.session {
  background-color: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.scope-badge.session.current {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.current-indicator {
  @apply ml-1 text-xs;
}

.followers {
  color: var(--color-text-secondary);
}

.account-actions {
  @apply flex items-center gap-1 flex-shrink-0;
}

.action-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  @apply text-sm;
  background: transparent;
  transition: all 0.2s;
}

.action-btn.edit {
  color: var(--color-text-secondary);
}

.action-btn.edit:hover {
  background-color: var(--color-surface);
  color: var(--color-primary);
}

.action-btn.delete {
  color: var(--color-text-secondary);
}

.action-btn.delete:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
</style>
