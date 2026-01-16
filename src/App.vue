<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { usePhoneStore } from '@/stores/phoneStore'
import { useUIStore } from '@/stores/uiStore'
import { useAppStateStore } from '@/stores/appStateStore'
import PhoneContainer from '@/components/PhoneContainer.vue'
import ToggleButton from '@/components/ToggleButton.vue'
import CommitButton from '@/components/CommitButton.vue'
import DevToolbar from '@/components/dev/DevToolbar.vue'
import { GlobalDialog } from '@/components/common'

// 导入适配器服务提供者
import { provideAdapterServices } from '@/composables/useAdapter'
import { useEnvironment } from '@/composables'
import { useTheme } from '@/composables/useTheme'
import { timeService } from '@/services/timeService'
import { useTimeStore } from '@/stores/timeStore'
import { useBridge } from '@/apps/bridge/composables/useBridge'

const phoneStore = usePhoneStore()
const uiStore = useUIStore()
const appStateStore = useAppStateStore()
const timeStore = useTimeStore()

const isDev = computed(() => import.meta.env.DEV)

// 提供适配器服务到组件树
const { adapter, chatDataService, globalConfigService, chatSyncService } = provideAdapterServices()

// 获取环境信息
const { characterName, playerName, isDevMode, adapterType } = useEnvironment()

// 初始化主题系统
const { initTheme, currentTheme } = useTheme()

onMounted(async () => {
  // 初始化主题
  initTheme()
  console.log(`[App] Theme initialized: ${currentTheme.value.name}`)
  
  // 初始化时间服务
  timeService.init()
  // 确保 TimeStore 被初始化，以便应用持久化的设置
  // 访问一次 mode 属性以触发 store 的初始化逻辑
  console.log(`[App] Time service initialized (Mode: ${timeStore.mode})`)
  
  await phoneStore.initialize()
  appStateStore.initApp()
  console.log('[App] Phone simulator initialized')
  console.log(`[App] Using ${adapterType.value} adapter`)
  console.log(`[App] Character: ${characterName.value}, Player: ${playerName.value}`)

  // 尝试自动连接 Bridge Server
  const { autoConnect } = useBridge()
  autoConnect()
})

onUnmounted(() => {
  // 确保在组件卸载时保存数据
  chatDataService.saveImmediately()
  appStateStore.saveState()
  console.log('[App] Data saved on unmount')
})
</script>

<template>
  <div class="app-container">
    <!-- 开发模式工具栏 -->
    <DevToolbar v-if="isDev" />
    
    <!-- 手机面板切换按钮 -->
    <ToggleButton />
    
    <!-- 手机模拟器主体 -->
    <Transition name="phone">
      <PhoneContainer v-if="uiStore.isPanelVisible" />
    </Transition>
    
    <!-- 提交按钮 -->
    <CommitButton />
    
    <!-- 全局对话框 -->
    <GlobalDialog />
  </div>
</template>

<style scoped>
.app-container {
  @apply w-full h-full relative;
}

/* 手机面板动画 */
.phone-enter-active,
.phone-leave-active {
  @apply transition-all duration-300 ease-out;
}

.phone-enter-from,
.phone-leave-to {
  @apply opacity-0 scale-95;
}
</style>