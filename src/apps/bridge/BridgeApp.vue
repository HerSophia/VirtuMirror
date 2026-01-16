<script setup lang="ts">
/**
 * Bridge 应用主入口
 * 用于管理与酒馆等平台的连接和数据同步
 */
import { ConnectionSection, PlatformsSection, StatusSection } from './sections'
</script>

<template>
  <div class="bridge-app">
    <!-- 页面标题 -->
    <div class="bridge-title">
      <h3>桥接管理</h3>
      <p class="subtitle">连接到酒馆等平台进行数据同步</p>
    </div>

    <!-- 内容区域 -->
    <div class="bridge-content">
      <!-- 连接状态 -->
      <StatusSection />

      <!-- 连接设置 -->
      <ConnectionSection />

      <!-- 已连接平台 -->
      <PlatformsSection />
    </div>
  </div>
</template>

<style scoped>
.bridge-app {
  @apply h-full flex flex-col;
  background-color: var(--color-background);
  transition: background-color 0.3s ease;
}

.bridge-title {
  @apply px-4 pt-4 pb-2;
}

.bridge-title h3 {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.bridge-title .subtitle {
  @apply text-sm mt-1;
  color: var(--color-text-secondary);
}

.bridge-content {
  @apply flex-1 overflow-y-auto p-4 pt-2;
}
</style>
