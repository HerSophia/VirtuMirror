<script setup lang="ts">
import { onMounted, onUnmounted, unref, ref } from 'vue'
import { useRouter } from 'vue-router'
import { settingsRegistry, type SettingsEntry } from '@/services/settings/settingsRegistry'
import { registerBuiltinSettings } from './services/builtin'
import { SettingsGroup, SettingsItem } from './components'
import { PersonalSection } from './sections'
import { deviceSyncManager, type DeviceStatus } from '@/services/sync'
import WriteQueueIndicator from '@/components/common/WriteQueueIndicator.vue'
import MultiDeviceIndicator from '@/components/sync/MultiDeviceIndicator.vue'

const router = useRouter()

// 注册内置设置项
// 注意：settingsRegistry 有去重逻辑，所以这里调用是安全的
registerBuiltinSettings()

// 获取分组后的设置项
const groupedEntries = settingsRegistry.getGroupedEntries()
// 获取分类列表（用于排序）
const categories = settingsRegistry.getCategories()

// 多设备状态
const deviceStatus = ref<DeviceStatus | null>(null)
let unsubscribeDevice: (() => void) | null = null

onMounted(() => {
  unsubscribeDevice = deviceSyncManager.subscribe((s) => {
    deviceStatus.value = s
  })
})

onUnmounted(() => {
  unsubscribeDevice?.()
})

function showDeviceList(devices: DeviceStatus['otherDevices']) {
  const list = devices.map(d => `${d.name}`).join('\n')
  alert(`其他在线设备:\n${list}`)
}

function handleAction(entry: SettingsEntry) {
  if (!entry.action) return

  const action = entry.action
  if (action.type === 'route') {
    if (typeof action.value === 'string') {
      router.push(action.value)
    }
  } else if (action.type === 'click') {
    if (typeof action.value === 'function') {
      action.value()
    }
  }
}

// 辅助函数：解包 Ref
function unwrap(val: any) {
  return unref(val)
}
</script>

<template>
  <div class="settings-view">
    <!-- 页面标题 -->
    <div class="settings-header">
      <h3 class="settings-title">设置</h3>
      <MultiDeviceIndicator @showDevices="showDeviceList" />
    </div>
    
    <div class="settings-content">
      <!-- 个人设置 (作为头部特殊区域) -->
      <PersonalSection />
      
      <!-- 动态设置列表 -->
      <template v-for="cat in categories" :key="cat.id">
        <!-- 仅当该分类下有条目时显示 -->
        <SettingsGroup 
          v-if="groupedEntries.get(cat.id)?.length"
          :title="cat.title"
        >
          <SettingsItem
            v-for="entry in groupedEntries.get(cat.id)"
            :key="entry.id"
            :label="entry.title"
            :subtitle="unwrap(entry.subtitle)"
            :icon="entry.icon?.value"
            :icon-bg="entry.icon?.backgroundColor"
            :icon-color="entry.icon?.color"
            arrow
            @click="handleAction(entry)"
          />
        </SettingsGroup>
      </template>

      <!-- 版本信息 -->
      <div class="version-info">
        <p>手机模拟器 v2.0.0 (Platform)</p>
        <p class="text-phone-gray-400">Vue3 + Vite + TailwindCSS + Vue Router</p>
      </div>
    </div>
    
    <!-- 写入状态指示器 -->
    <WriteQueueIndicator />
  </div>
</template>

<style scoped>
.settings-view {
  @apply h-full flex flex-col;
  background-color: var(--color-background);
  transition: background-color 0.3s ease;
}

.settings-header {
  @apply px-4 pt-4 pb-2 flex items-center justify-between;
}

.settings-title {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.settings-content {
  @apply flex-1 overflow-y-auto p-4 pt-0;
}

.version-info {
  @apply text-center py-8 text-sm;
  color: var(--color-text-secondary);
}
</style>
