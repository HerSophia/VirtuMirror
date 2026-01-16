<script setup lang="ts">
/**
 * 平台账号分组组件
 * 
 * 可折叠的平台账号列表
 */
import { ref, computed } from 'vue'
import type { PlatformAccount } from '@/types/account'
import AccountCard from './AccountCard.vue'

const props = defineProps<{
  platformId: string
  platformName: string
  platformIcon: string
  platformColor: string
  accounts: PlatformAccount[]
}>()

const emit = defineEmits<{
  edit: [account: PlatformAccount]
  delete: [account: PlatformAccount]
  switch: [account: PlatformAccount]
  create: []
}>()

const isExpanded = ref(true)

const accountCount = computed(() => props.accounts.length)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="platform-account-group">
    <!-- 平台头部 -->
    <div class="group-header" @click="toggleExpand">
      <div class="platform-info">
        <div 
          class="platform-icon"
          :style="{ backgroundColor: platformColor }"
        >
          <i :class="platformIcon"></i>
        </div>
        <span class="platform-name">{{ platformName }}</span>
        <span class="account-count">({{ accountCount }} 个账号)</span>
      </div>
      <i 
        class="fas expand-icon"
        :class="isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'"
      ></i>
    </div>
    
    <!-- 账号列表 -->
    <transition name="expand">
      <div v-show="isExpanded" class="group-content">
        <!-- 账号卡片 -->
        <AccountCard
          v-for="account in accounts"
          :key="account.id"
          :account="account"
          @edit="emit('edit', account)"
          @delete="emit('delete', account)"
          @switch="emit('switch', account)"
        />
        
        <!-- 空状态 -->
        <div v-if="accounts.length === 0" class="empty-hint">
          <p>暂无账号</p>
        </div>
        
        <!-- 创建按钮 -->
        <button class="create-btn" @click.stop="emit('create')">
          <i class="fas fa-plus"></i>
          <span>创建新{{ platformName }}账号</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.platform-account-group {
  @apply rounded-xl overflow-hidden;
  background-color: var(--color-surface);
}

.group-header {
  @apply flex items-center justify-between px-4 py-3;
  @apply cursor-pointer select-none;
  transition: background-color 0.2s;
}

.group-header:hover {
  background-color: var(--color-surface-variant);
}

.platform-info {
  @apply flex items-center gap-3;
}

.platform-icon {
  @apply w-8 h-8 rounded-lg flex items-center justify-center;
  color: white;
}

.platform-icon i {
  @apply text-sm;
}

.platform-name {
  @apply font-medium;
  color: var(--color-text);
}

.account-count {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.expand-icon {
  @apply text-sm;
  color: var(--color-text-secondary);
  transition: transform 0.2s;
}

.group-content {
  @apply px-4 pb-4 space-y-3;
  border-top: 1px solid var(--color-border);
}

.empty-hint {
  @apply py-4 text-center text-sm;
  color: var(--color-text-secondary);
}

.create-btn {
  @apply w-full flex items-center justify-center gap-2;
  @apply py-3 rounded-xl text-sm font-medium;
  @apply border-2 border-dashed;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
  background: transparent;
  transition: all 0.2s;
}

.create-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: rgba(var(--color-primary-rgb), 0.05);
}

/* 展开/收起动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
