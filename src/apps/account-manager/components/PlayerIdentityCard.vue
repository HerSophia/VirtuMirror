<script setup lang="ts">
/**
 * 玩家身份卡片组件
 * 
 * 显示玩家的基础身份信息
 */
import { computed } from 'vue'
import type { CharacterEntity } from '@/types/account'

const props = defineProps<{
  entity: CharacterEntity
}>()

const emit = defineEmits<{
  edit: []
}>()

const avatarDisplay = computed(() => {
  if (props.entity.avatar) {
    return props.entity.avatar
  }
  // 默认头像使用首字母
  return null
})

const initials = computed(() => {
  return props.entity.displayName.charAt(0).toUpperCase()
})
</script>

<template>
  <div class="player-identity-card">
    <div class="card-content">
      <!-- 头像 -->
      <div class="avatar-section">
        <div class="avatar">
          <img v-if="avatarDisplay" :src="avatarDisplay" alt="头像" />
          <span v-else class="avatar-initials">{{ initials }}</span>
        </div>
      </div>
      
      <!-- 信息 -->
      <div class="info-section">
        <div class="name-row">
          <span class="player-name">{{ entity.displayName }}</span>
          <span class="player-badge">👤 玩家</span>
        </div>
        <p v-if="entity.bio" class="player-bio">{{ entity.bio }}</p>
        <p v-else class="player-bio placeholder">这个人很懒，什么都没写~</p>
        <div class="meta-row">
          <span class="scope-badge global">🌐 全局身份</span>
        </div>
      </div>
      
      <!-- 编辑按钮 -->
      <button class="edit-btn" @click="emit('edit')">
        <i class="fas fa-pen"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.player-identity-card {
  @apply rounded-2xl overflow-hidden;
  background-color: var(--color-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-content {
  @apply flex items-start gap-4 p-4;
}

.avatar-section {
  @apply flex-shrink-0;
}

.avatar {
  @apply w-16 h-16 rounded-full overflow-hidden;
  @apply flex items-center justify-center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar img {
  @apply w-full h-full object-cover;
}

.avatar-initials {
  @apply text-2xl font-bold text-white;
}

.info-section {
  @apply flex-1 min-w-0;
}

.name-row {
  @apply flex items-center gap-2 mb-1;
}

.player-name {
  @apply text-lg font-semibold truncate;
  color: var(--color-text);
}

.player-badge {
  @apply text-xs px-2 py-0.5 rounded-full;
  background-color: var(--color-primary);
  color: white;
}

.player-bio {
  @apply text-sm mb-2 line-clamp-2;
  color: var(--color-text-secondary);
}

.player-bio.placeholder {
  @apply italic opacity-60;
}

.meta-row {
  @apply flex items-center gap-2;
}

.scope-badge {
  @apply text-xs px-2 py-0.5 rounded;
  background-color: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.scope-badge.global {
  background-color: rgba(102, 126, 234, 0.15);
  color: #667eea;
}

.edit-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  @apply flex-shrink-0;
  color: var(--color-text-secondary);
  background: transparent;
  transition: all 0.2s;
}

.edit-btn:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-primary);
}
</style>
