<script setup lang="ts">
import { ref } from 'vue'
import { BottomNav, type TabName } from './components'
import { ExploreTab, DataTab, CareerTab, ProfileTab } from './tabs'

const activeTab = ref<TabName>('explore')
</script>

<template>
  <div class="pathfinder-app">
    <div class="pathfinder-content custom-scrollbar">
      <Transition name="fade" mode="out-in">
        <ExploreTab v-if="activeTab === 'explore'" key="explore" />
        <DataTab v-else-if="activeTab === 'data'" key="data" />
        <CareerTab v-else-if="activeTab === 'career'" key="career" />
        <ProfileTab v-else-if="activeTab === 'profile'" key="profile" />
      </Transition>
    </div>

    <BottomNav
      :active-tab="activeTab"
      @update:active-tab="(tab) => (activeTab = tab)"
    />
  </div>
</template>

<style scoped>
.pathfinder-app {
  @apply h-full flex flex-col relative overflow-hidden;
  background: linear-gradient(180deg, #f0f4f8 0%, #e2e8f0 100%);
  color: #1e293b;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.pathfinder-content {
  @apply flex-1 overflow-y-auto overflow-x-hidden;
  scroll-behavior: smooth;
  /* 底部留白给导航栏 */
  padding-bottom: calc(4rem + env(safe-area-inset-bottom));
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded-full;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>