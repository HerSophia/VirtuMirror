<script setup lang="ts">
/**
 * 社交引擎配置 App
 * 
 * 用于配置和管理社交媒体模拟引擎的各项功能：
 * - 平台管理：查看已注册的社交平台
 * - 导演服务：控制世界事件的自动生成
 * - 用户池：管理影子账号
 * - 热度算法：查看算法说明
 */
import { ref, computed, onMounted } from 'vue';
import { EngineHeader, StatCard } from './components';
import { 
  OverviewTab, 
  PlatformsTab, 
  DirectorTab, 
  UsersTab, 
  AlgorithmTab 
} from './views';
import { TABS, type TabId } from './types';

// 当前激活的 Tab
const activeTab = ref<TabId>('overview');

// Tab 组件映射
const tabComponents = {
  overview: OverviewTab,
  platforms: PlatformsTab,
  director: DirectorTab,
  users: UsersTab,
  algorithm: AlgorithmTab,
};

// 当前显示的组件
const currentComponent = computed(() => tabComponents[activeTab.value]);

// 切换 Tab
function switchTab(tabId: TabId) {
  activeTab.value = tabId;
}
</script>

<template>
  <div class="social-engine-app">
    <!-- 头部 -->
    <EngineHeader />
    
    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
      >
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>
    
    <!-- Tab 内容 -->
    <div class="tab-content">
      <KeepAlive>
        <component :is="currentComponent" />
      </KeepAlive>
    </div>
  </div>
</template>

<style scoped>
.social-engine-app {
  @apply h-full flex flex-col relative;
  background: var(--color-background);
  /* relative 定位用于模态框容器 */
}

.tab-nav {
  @apply flex border-b;
  border-color: var(--color-border);
  background: var(--color-surface);
}

.tab-btn {
  @apply flex-1 py-3 px-2 text-sm font-medium transition-colors;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-variant);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-label {
  @apply truncate;
}

.tab-content {
  @apply flex-1 overflow-y-auto;
}
</style>
