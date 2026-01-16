<script setup lang="ts">
/**
 * 底部 Dock 栏组件
 * 显示常用 App 快捷入口，毛玻璃背景效果
 */
import AppIcon from '@/components/common/AppIcon.vue'
import type { DockAppItem } from '../types'

defineProps<{
  /** Dock 栏 App 列表 */
  apps: DockAppItem[]
}>()

const emit = defineEmits<{
  open: [app: DockAppItem, event: MouseEvent | TouchEvent]
}>()

function handleOpen(app: DockAppItem, event: MouseEvent | TouchEvent) {
  emit('open', app, event)
}
</script>

<template>
  <div class="dock-bar">
    <div
      v-for="app in apps"
      :key="`dock-${app.id}`"
      class="dock-item"
      @click="(e) => handleOpen(app, e)"
    >
      <AppIcon
        :app-id="app.iconId || app.id"
        size="sm"
        :badge="app.badge"
        :icon="app.icon"
      />
    </div>
  </div>
</template>

<style scoped>
.dock-bar {
  @apply mx-4 mb-8 px-4 py-2;
  @apply bg-white/20 backdrop-blur-lg rounded-2xl;
  @apply flex items-center justify-around;
}

.dock-item {
  @apply cursor-pointer transition-transform active:scale-90;
}
</style>