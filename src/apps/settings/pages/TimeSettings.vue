<script setup lang="ts">
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { SettingsGroup, SettingsItem, ToggleSwitch, DropdownSelect } from '../components'
import { useTimeStore } from '@/stores/timeStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const timeStore = useTimeStore()
const { mode, is24Hour } = storeToRefs(timeStore)

// Modes configuration
const timeModeOptions = [
  { 
    value: 'system', 
    label: '跟随系统', 
    description: '使用设备的真实时间' 
  },
  { 
    value: 'simulated', 
    label: '模拟时间', 
    description: '自动解析最新聊天消息中的时间' 
  },
  { 
    value: 'virtual', 
    label: '虚拟流逝', 
    description: '相对于开始时间自然流逝' 
  },
  { 
    value: 'frozen', 
    label: '冻结时间', 
    description: '时间停止' 
  }
]

function goBack() {
  router.back()
}
</script>

<template>
  <div class="time-settings-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h1 class="page-title">日期与时间</h1>
    </div>
    
    <div class="page-content">
      <SettingsGroup title="显示">
        <SettingsItem label="24 小时制">
          <template #right>
            <ToggleSwitch v-model="is24Hour" />
          </template>
        </SettingsItem>
      </SettingsGroup>

      <SettingsGroup title="时间源">
        <SettingsItem 
          label="时间模式" 
          :subtitle="timeModeOptions.find(o => o.value === mode)?.description"
        >
          <template #right>
            <div class="w-32">
              <!-- Using DropdownSelect in the right slot -->
              <DropdownSelect 
                v-model="mode" 
                :options="timeModeOptions"
                align="right"
              />
            </div>
          </template>
        </SettingsItem>
      </SettingsGroup>
      
      <div class="info-text">
        <p v-if="mode === 'simulated'">
          模拟模式下，系统会自动读取最新一条包含时间信息的聊天消息（如 "10:30"），并将手机时间同步到该时刻。
        </p>
        <p v-else-if="mode === 'system'">
          当前使用您设备的真实系统时间。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.time-settings-page {
  @apply flex flex-col h-full bg-[var(--color-background)];
}

.page-header {
  @apply flex items-center px-4 py-3 border-b border-[var(--color-border)];
  background-color: var(--color-surface);
}

.back-btn {
  @apply p-2 -ml-2 rounded-full;
  color: var(--color-text);
}

.back-btn:active {
  background-color: var(--color-surface-variant);
}

.page-title {
  @apply ml-2 text-lg font-medium;
  color: var(--color-text);
}

.page-content {
  @apply flex-1 overflow-y-auto p-4 flex flex-col gap-6;
}

.info-text {
  @apply px-4 text-sm text-center;
  color: var(--color-text-secondary);
}
</style>
