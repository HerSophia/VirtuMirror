<script setup lang="ts">
/**
 * 应用卡片组件
 */
import { computed } from 'vue'
import type { AppRegistryEntry, IconConfig } from '@/types/appPackage'
import { useAppStoreStore } from '@/stores/appStoreStore'

const props = defineProps<{
  app: AppRegistryEntry
  compact?: boolean
}>()

const emit = defineEmits<{
  click: []
  install: []
}>()

const appStore = useAppStoreStore()

// 是否已安装
const isInstalled = computed(() => appStore.isInstalled(props.app.id))

// 图标样式
const iconStyle = computed(() => {
  const icon = props.app.icon
  return {
    background: icon.background,
    color: icon.color || '#FFFFFF'
  }
})

// 格式化下载量
function formatDownloads(count?: number): string {
  if (!count) return ''
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

// 处理安装/查看按钮
function handleAction(e: Event) {
  e.stopPropagation()
  if (!isInstalled.value) {
    emit('install')
  } else {
    emit('click')
  }
}
</script>

<template>
  <div
    class="app-card"
    :class="{ compact }"
    @click="emit('click')"
  >
    <!-- 图标 -->
    <div class="app-icon" :style="iconStyle">
      <i v-if="app.icon.type === 'font'" :class="app.icon.value"></i>
      <span v-else-if="app.icon.type === 'emoji'">{{ app.icon.value }}</span>
      <img v-else :src="app.icon.value" alt="" />
    </div>
    
    <!-- 信息 -->
    <div class="app-info">
      <h3 class="app-name">{{ app.name }}</h3>
      <p v-if="!compact" class="app-desc">{{ app.description }}</p>
      <div class="app-meta">
        <span v-if="app.rating" class="rating">
          <i class="fas fa-star"></i>
          {{ app.rating.toFixed(1) }}
        </span>
        <span v-if="app.downloads" class="downloads">
          {{ formatDownloads(app.downloads) }} 次下载
        </span>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <button
      class="action-btn"
      :class="{ installed: isInstalled }"
      @click="handleAction"
    >
      {{ isInstalled ? '打开' : '获取' }}
    </button>
  </div>
</template>

<style scoped>
.app-card {
  @apply flex items-center gap-4 p-4 rounded-2xl w-full;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-sizing: border-box;
}

.app-card:active {
  transform: scale(0.98);
  background: var(--color-surface-variant);
}

.app-card:hover {
  background: var(--color-surface);
}

.app-card.compact {
  @apply p-2 gap-3;
}

.app-icon {
  @apply w-16 h-16 rounded-[18px] flex items-center justify-center flex-shrink-0;
  @apply text-3xl shadow-sm;
}

.app-card.compact .app-icon {
  @apply w-12 h-12 rounded-xl text-xl;
}

.app-icon img {
  @apply w-full h-full rounded-2xl object-cover;
}

.app-info {
  @apply flex-1 min-w-0 flex flex-col justify-center;
}

.app-name {
  @apply font-bold text-base truncate;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.app-card.compact .app-name {
  @apply text-sm;
}

.app-desc {
  @apply text-sm mt-0.5 line-clamp-1;
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.app-meta {
  @apply flex items-center gap-2 mt-1 text-xs;
  color: var(--color-text-secondary);
}

.rating {
  @apply flex items-center gap-0.5;
}

.rating i {
  color: #FFD60A;
  font-size: 10px;
}

.downloads {
  @apply text-xs;
}

.action-btn {
  @apply px-5 py-1.5 rounded-full text-sm font-bold flex-shrink-0;
  background: var(--color-surface-variant);
  color: var(--color-primary);
  transition: all 0.2s ease;
}

.action-btn:not(.installed) {
  background: var(--color-surface-variant);
  color: var(--color-primary);
}

.action-btn.installed {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  font-weight: normal;
}

.action-btn:active {
  opacity: 0.8;
}
</style>