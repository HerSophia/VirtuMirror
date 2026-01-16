<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChatHeader, BottomNav, type TabName } from './components'
import { MessagesTab, ContactsTab, DiscoverTab, MeTab } from './tabs'

const router = useRouter()
const route = useRoute()

const activeTab = ref<TabName>('messages')

// 如果是子路由（ChatConversation），显示子视图
const isChildRoute = computed(() => route.name !== 'ChatApp')

// 标题映射
const tabTitles: Record<TabName, string> = {
  messages: '微信',
  contacts: '通讯录',
  discover: '发现',
  me: '我'
}

function goBack() {
  router.push('/')
}

function handleTabChange(tab: TabName) {
  activeTab.value = tab
}
</script>

<template>
  <div class="chat-app-view">
    <!-- 子路由视图 -->
    <router-view v-if="isChildRoute" />
    
    <!-- 主列表视图 -->
    <template v-else>
      <!-- 头部 -->
      <ChatHeader
        :title="tabTitles[activeTab]"
        :show-back="false"
        :show-search="true"
        :show-add="true"
      />
      
      <!-- 内容区域 -->
      <div class="chat-content">
        <MessagesTab v-if="activeTab === 'messages'" />
        <ContactsTab v-else-if="activeTab === 'contacts'" />
        <DiscoverTab v-else-if="activeTab === 'discover'" />
        <MeTab v-else-if="activeTab === 'me'" />
      </div>
      
      <!-- 底部导航 -->
      <BottomNav 
        :active-tab="activeTab"
        @update:active-tab="handleTabChange"
      />
    </template>
  </div>
</template>

<style scoped>
.chat-app-view {
  @apply h-full flex flex-col;
  background-color: #ededed;
}

.chat-content {
  @apply flex-1 overflow-y-auto pb-[60px];
}
</style>