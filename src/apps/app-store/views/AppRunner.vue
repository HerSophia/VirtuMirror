<script setup lang="ts">
/**
 * 动态应用运行器视图
 */
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStoreStore } from '@/stores/appStoreStore'
import ConfigurableAppRenderer from '@/components/common/ConfigurableAppRenderer.vue'
import AppStoreHeader from '../components/AppStoreHeader.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStoreStore()

// 应用 ID
const appId = computed(() => route.params.appId as string)

// 获取已安装的应用
const installedApp = computed(() => appStore.getInstalledApp(appId.value))

// 应用包
const appPackage = computed(() => installedApp.value?.package)

// 用户数据
const userData = ref<Record<string, unknown>>({})

// 初始化用户数据
onMounted(() => {
  if (installedApp.value?.userData) {
    userData.value = { ...installedApp.value.userData }
  }
})

// 处理数据更新
function handleUpdateUserData(data: Record<string, unknown>) {
  userData.value = data
  // TODO: 保存数据到持久化存储
  // appStore.updateAppUserData(appId.value, data)
}

// 处理动作
function handleAction(action: string, payload?: unknown) {
  console.log('[AppRunner] Action:', action, payload)
  if (action === 'navigate') {
    // 处理导航
  }
}
</script>

<template>
  <div class="app-runner">
    <!-- 头部 -->
    <AppStoreHeader
      :title="appPackage?.name || '应用'"
      :show-back="true"
      :show-search="false"
      :show-manage="false"
      @back="router.back()"
    />
    
    <div class="runner-content">
      <ConfigurableAppRenderer
        v-if="appPackage"
        :app-package="appPackage"
        :user-data="userData"
        @update:user-data="handleUpdateUserData"
        @action="handleAction"
      />
      
      <div v-else class="not-found">
        <i class="fas fa-exclamation-triangle"></i>
        <p>应用未安装或数据损坏</p>
        <button class="back-btn" @click="router.back()">返回</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-runner {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.runner-content {
  @apply flex-1 overflow-hidden relative;
}

.not-found {
  @apply flex-1 flex flex-col items-center justify-center h-full;
  color: var(--color-text-secondary);
}

.not-found i {
  @apply text-5xl mb-4;
  color: var(--color-warning);
}

.not-found p {
  @apply text-lg mb-4;
}

.back-btn {
  @apply px-6 py-2 rounded-full text-sm;
  background: var(--color-primary);
  color: #FFFFFF;
}
</style>