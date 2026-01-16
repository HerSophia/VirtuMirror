<script setup lang="ts">
/**
 * 微信风格底部导航栏组件
 */

export type TabName = 'messages' | 'contacts' | 'discover' | 'me'

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
  { name: 'messages', label: '微信', icon: 'fas fa-comment' },
  { name: 'contacts', label: '通讯录', icon: 'fas fa-address-book' },
  { name: 'discover', label: '发现', icon: 'fas fa-compass' },
  { name: 'me', label: '我', icon: 'fas fa-user' }
]

function selectTab(tab: TabName) {
  emit('update:activeTab', tab)
  emit('tabChange', tab)
}
</script>

<template>
  <div class="bottom-nav">
    <div 
      v-for="tab in tabs"
      :key="tab.name"
      class="nav-item"
      :class="{ active: activeTab === tab.name }"
      @click="selectTab(tab.name)"
    >
      <i :class="tab.icon" />
      <span>{{ tab.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.bottom-nav {
  @apply flex items-center justify-around py-2 bg-[#f7f7f7];
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: env(safe-area-inset-bottom, 8px);
  z-index: 100;
}

.nav-item {
  @apply flex flex-col items-center gap-1 px-4 py-1 cursor-pointer transition-colors;
  color: #999;
}

.nav-item i {
  @apply text-xl;
}

.nav-item span {
  @apply text-xs;
}

.nav-item.active {
  color: #07c160;
}

.nav-item:active {
  opacity: 0.7;
}
</style>