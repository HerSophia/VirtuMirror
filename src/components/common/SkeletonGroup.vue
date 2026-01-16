<script setup lang="ts">
/**
 * 骨架屏组合组件
 * 提供常见布局的骨架屏预设
 */
import Skeleton from './Skeleton.vue'

withDefaults(defineProps<{
  /** 预设类型 */
  preset?: 'list-item' | 'chat-item' | 'card' | 'avatar-text' | 'paragraph'
  /** 重复次数 */
  count?: number
  /** 是否启用动画 */
  animation?: boolean
}>(), {
  preset: 'list-item',
  count: 3,
  animation: true,
})
</script>

<template>
  <div class="skeleton-group">
    <template v-for="i in count" :key="i">
      <!-- 列表项 -->
      <div v-if="preset === 'list-item'" class="skeleton-list-item">
        <Skeleton variant="circular" :width="48" :height="48" :animation="animation" />
        <div class="skeleton-content">
          <Skeleton variant="text" width="60%" :animation="animation" />
          <Skeleton variant="text" width="40%" :animation="animation" />
        </div>
      </div>
      
      <!-- 聊天项 -->
      <div v-else-if="preset === 'chat-item'" class="skeleton-chat-item">
        <Skeleton variant="circular" :width="52" :height="52" :animation="animation" />
        <div class="skeleton-content">
          <div class="skeleton-header">
            <Skeleton variant="text" width="120px" :animation="animation" />
            <Skeleton variant="text" width="40px" :animation="animation" />
          </div>
          <Skeleton variant="text" width="80%" :animation="animation" />
        </div>
      </div>
      
      <!-- 卡片 -->
      <div v-else-if="preset === 'card'" class="skeleton-card">
        <Skeleton variant="rectangular" width="100%" height="160px" :animation="animation" />
        <div class="skeleton-card-content">
          <Skeleton variant="text" width="80%" :animation="animation" />
          <Skeleton variant="text" width="60%" :animation="animation" />
        </div>
      </div>
      
      <!-- 头像+文字 -->
      <div v-else-if="preset === 'avatar-text'" class="skeleton-avatar-text">
        <Skeleton variant="circular" :width="40" :height="40" :animation="animation" />
        <Skeleton variant="text" width="100px" :animation="animation" />
      </div>
      
      <!-- 段落 -->
      <div v-else-if="preset === 'paragraph'" class="skeleton-paragraph">
        <Skeleton variant="text" width="100%" :animation="animation" />
        <Skeleton variant="text" width="100%" :animation="animation" />
        <Skeleton variant="text" width="75%" :animation="animation" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.skeleton-group {
  @apply space-y-4;
}

.skeleton-list-item {
  @apply flex items-center gap-3 p-3;
}

.skeleton-chat-item {
  @apply flex items-start gap-3 p-3;
}

.skeleton-content {
  @apply flex-1 space-y-2;
}

.skeleton-header {
  @apply flex items-center justify-between;
}

.skeleton-card {
  @apply rounded-xl overflow-hidden;
  background: var(--color-surface, #ffffff);
}

.skeleton-card-content {
  @apply p-4 space-y-2;
}

.skeleton-avatar-text {
  @apply flex items-center gap-3;
}

.skeleton-paragraph {
  @apply space-y-2;
}
</style>