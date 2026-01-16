<script setup lang="ts">
/**
 * Pathfinder Student App 底部导航栏
 * 四个主 Tab：
 * - 探索
 * - 数据
 * - 生涯
 * - 我的
 */

export type TabName = 'explore' | 'data' | 'career' | 'profile'

interface Tab {
  name: TabName
  label: string
  icon: string
}

interface Props {
  /** 当前激活的标签 */
  activeTab: TabName
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:activeTab', tab: TabName): void
  (e: 'tabChange', tab: TabName): void
}>()

const tabs: Tab[] = [
  { name: 'explore', label: '探索', icon: 'fa-solid fa-compass' },
  { name: 'data', label: '数据', icon: 'fa-solid fa-chart-column' },
  { name: 'career', label: '生涯', icon: 'fa-solid fa-briefcase' },
  { name: 'profile', label: '我的', icon: 'fa-solid fa-user' },
]

function selectTab(tab: TabName) {
  emit('update:activeTab', tab)
  emit('tabChange', tab)
}
</script>

<template>
  <div class="pf-nav-container">
    <nav class="pf-bottom-nav">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        class="pf-nav-item"
        :class="{ active: activeTab === tab.name }"
        type="button"
        @click="selectTab(tab.name)"
      >
        <div class="pf-nav-icon-wrapper">
          <i :class="tab.icon" class="pf-nav-icon" />
          <div v-if="activeTab === tab.name" class="pf-nav-glow" />
        </div>
        <span class="pf-nav-label">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.pf-nav-container {
  @apply fixed left-0 right-0 bottom-0 z-50 pointer-events-none;
  padding: 0 1rem 1.5rem 1rem;
  /* 底部渐变遮罩，让内容滚动到底部时平滑消失 */
  background: linear-gradient(to top, rgba(241, 245, 249, 1) 0%, rgba(241, 245, 249, 0) 100%);
  height: 6rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.pf-bottom-nav {
  @apply relative w-full max-w-sm mx-auto;
  @apply flex items-center justify-between px-6 py-3;
  @apply rounded-2xl pointer-events-auto;
  
  /* 磨砂玻璃拟态 - Glassmorphism */
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 10px 30px -5px rgba(0, 0, 0, 0.08),
    0 4px 6px -2px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.pf-nav-item {
  @apply relative flex flex-col items-center gap-1.5;
  @apply text-gray-400 transition-all duration-300;
  min-width: 3.5rem;
}

.pf-nav-item:active {
  transform: scale(0.95);
}

.pf-nav-icon-wrapper {
  @apply relative flex items-center justify-center w-6 h-6;
}

.pf-nav-icon {
  @apply text-lg transition-all duration-300 relative z-10;
}

/* 选中状态动画 */
.pf-nav-item.active {
  @apply text-blue-600;
}

.pf-nav-item.active .pf-nav-icon {
  transform: translateY(-2px);
  @apply text-blue-600;
}

.pf-nav-label {
  @apply text-[10px] font-medium transition-all duration-300;
  opacity: 0.8;
}

.pf-nav-item.active .pf-nav-label {
  @apply font-bold text-blue-700;
  opacity: 1;
}

/* 激活时的光晕效果 */
.pf-nav-glow {
  @apply absolute inset-0 rounded-full;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
  filter: blur(4px);
  animation: glow-pulse 2s infinite;
  z-index: 0;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.2); }
}
</style>