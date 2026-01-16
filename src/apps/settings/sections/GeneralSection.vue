<script setup lang="ts">
/**
 * 通用设置分区
 * 包含静音模式、重置 UI、重置数据等设置
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import { usePhoneStore } from '@/stores/phoneStore'
import { SettingsGroup, SettingsItem, ToggleSwitch } from '../components'
import { writeQueue } from '@/services/database/writeQueue'

const router = useRouter()
const uiStore = useUIStore()
const phoneStore = usePhoneStore()

// 重置操作状态
const isResetting = ref(false)

function toggleMute() {
  uiStore.toggleMute()
}

function resetUIPosition() {
  uiStore.resetPosition()
}

async function resetAllData() {
  if (isResetting.value) return
  
  if (!confirm('确定要重置所有手机数据吗？此操作不可撤销。')) {
    return
  }
  
  isResetting.value = true
  
  try {
    // 等待写入队列空闲，确保所有待处理的写入完成
    await writeQueue.waitForIdle()
    
    // 执行重置（通过写入队列确保安全）
    await writeQueue.enqueue('system', 'settings', async () => {
      phoneStore.resetAll()
    })
    
    alert('数据已重置')
  } catch (error) {
    console.error('[Settings] 重置数据失败:', error)
    alert('重置失败，请重试')
  } finally {
    isResetting.value = false
  }
}

function goToAboutPhone() {
  router.push('/settings/about')
}
</script>

<template>
  <!-- 通用设置 -->
  <SettingsGroup title="通用">
    <SettingsItem label="静音模式" @click="toggleMute">
      <template #right>
        <ToggleSwitch :model-value="uiStore.customization.muted" @update:model-value="toggleMute" />
      </template>
    </SettingsItem>
    <SettingsItem
      label="重置UI位置"
      arrow
      @click="resetUIPosition"
    />
  </SettingsGroup>
  
  <!-- 危险操作 -->
  <SettingsGroup>
    <SettingsItem
      label="重置所有手机数据"
      :subtitle="isResetting ? '正在重置...' : undefined"
      danger
      :disabled="isResetting"
      @click="resetAllData"
    />
  </SettingsGroup>
  
  <!-- 系统 -->
  <SettingsGroup title="系统">
    <SettingsItem
      label="关于手机"
      icon="fa-info-circle"
      arrow
      @click="goToAboutPhone"
    />
  </SettingsGroup>
</template>