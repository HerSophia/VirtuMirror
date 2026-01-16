<script setup lang="ts">
/**
 * 应用商店主入口
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStoreStore } from '@/stores/appStoreStore'
import AppStoreHeader from './components/AppStoreHeader.vue'
import PermissionDialog from './components/PermissionDialog.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStoreStore()

// 是否在子路由
const hasSubRoute = computed(() => {
  return route.name !== 'AppStore'
})

// 返回主页
function goBack() {
  router.back()
}
</script>

<template>
  <div class="app-store-app">
    <!-- 头部 -->
    <AppStoreHeader
      v-if="!hasSubRoute"
      title="应用商店"
      :show-back="false"
      :show-search="true"
      @search="appStore.setSearchQuery"
    />
    
    <!-- 路由视图 -->
    <router-view v-slot="{ Component }">
      <transition name="slide-left" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    
    <!-- 权限请求对话框 -->
    <PermissionDialog
      :visible="appStore.permissionDialog.visible"
      :app-id="appStore.permissionDialog.appId"
      :permissions="appStore.permissionDialog.permissions"
      @confirm="appStore.respondToPermissionRequest(true)"
      @cancel="appStore.respondToPermissionRequest(false)"
    />
  </div>
</template>

<style scoped>
.app-store-app {
  @apply h-full flex flex-col relative;
  background: var(--color-background);
}

/* 页面切换动画 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>