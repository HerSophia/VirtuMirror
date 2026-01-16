<script setup lang="ts">
/**
 * 分类应用列表页
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStoreStore } from '@/stores/appStoreStore'
import { CATEGORY_NAMES } from '@/types/appPackage'
import AppStoreHeader from '../components/AppStoreHeader.vue'
import AppCard from '../components/AppCard.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStoreStore()

// 分类 ID
const categoryId = computed(() => route.params.categoryId as string)

// 分类名称
const categoryName = computed(() => {
  return CATEGORY_NAMES[categoryId.value as keyof typeof CATEGORY_NAMES] || categoryId.value
})

// 该分类下的应用
const categoryApps = computed(() => {
  return appStore.registry.apps.filter(app => app.category === categoryId.value)
})

// 跳转到应用详情
function goToDetail(appId: string) {
  router.push({ name: 'AppDetail', params: { appId } })
}

// 安装应用
async function handleInstall(appId: string) {
  await appStore.installApp(appId)
}
</script>

<template>
  <div class="category-apps">
    <!-- 头部 -->
    <AppStoreHeader
      :title="categoryName"
      :show-back="true"
      :show-search="false"
      :show-manage="false"
    />
    
    <div class="content">
      <!-- 应用列表 -->
      <div v-if="categoryApps.length > 0" class="app-list">
        <AppCard
          v-for="app in categoryApps"
          :key="app.id"
          :app="app"
          @click="goToDetail(app.id)"
          @install="handleInstall(app.id)"
        />
      </div>
      
      <!-- 空状态 -->
      <div v-else class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>该分类暂无应用</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-apps {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.content {
  @apply flex-1 overflow-y-auto p-4;
}

.app-list {
  @apply space-y-2;
}

.empty-state {
  @apply flex flex-col items-center justify-center h-full;
  color: var(--color-text-secondary);
}

.empty-state i {
  @apply text-5xl mb-4;
}

.empty-state p {
  @apply text-sm;
}
</style>