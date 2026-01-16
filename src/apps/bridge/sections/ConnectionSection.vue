<script setup lang="ts">
/**
 * 连接设置分区
 * 配置服务器地址、API Key 和同步参数
 */
import { ref, computed, onMounted } from 'vue'
import { useBridge } from '../composables'
import { SettingsGroup, SettingsItem } from '@/apps/settings/components'
import InputDialog from '../components/InputDialog.vue'

const { status, connect, disconnect, requestSync, updateConfig, getAdapter, setApiKey } = useBridge()

// 对话框状态
const showUrlDialog = ref(false)
const showKeyDialog = ref(false)
const showFloorDialog = ref(false)

const serverUrl = ref(status.value.serverUrl)
const apiKey = ref('')
const floorRange = computed(() => status.value.sharedConfig.floorRange)

// 初始化时获取当前配置
onMounted(() => {
  const adapter = getAdapter()
  if (adapter) {
    apiKey.value = adapter.getApiKey() || ''
  }
})

// 获取 API Key 显示文本
const apiKeyDisplay = computed(() => {
  if (!apiKey.value) return '未配置'
  if (apiKey.value.length <= 12) return '****'
  return `${apiKey.value.substring(0, 6)}...${apiKey.value.substring(apiKey.value.length - 4)}`
})

function handleUrlConfirm(value: string) {
  const url = value.trim()
  if (url && url !== status.value.serverUrl) {
    serverUrl.value = url
    // 如果已连接，先断开再重连
    if (status.value.connected) {
      disconnect()
    }
    connect(url)
  }
}

function handleKeyConfirm(value: string) {
  const key = value.trim()
  apiKey.value = key
  setApiKey(key)
  // 如果已连接，需要重新连接以应用新 Key
  if (status.value.connected) {
    disconnect()
    setTimeout(() => connect(), 100)
  }
}

function handleFloorConfirm(value: string) {
  const num = parseInt(value)
  if (!isNaN(num) && num > 0 && num <= 100) {
    updateConfig({ floorRange: num })
  }
}

function handleSyncRequest() {
  requestSync(floorRange.value)
}
</script>

<template>
  <SettingsGroup title="连接设置">
    <!-- 服务器地址 -->
    <SettingsItem
      label="服务器地址"
      icon="fa-server"
      icon-bg="#3b82f6"
      icon-color="white"
      :value="status.serverUrl"
      arrow
      @click="showUrlDialog = true"
    />

    <!-- API Key -->
    <SettingsItem
      label="API Key"
      subtitle="用于服务器鉴权"
      icon="fa-key"
      icon-bg="#f59e0b"
      icon-color="white"
      :value="apiKeyDisplay"
      arrow
      @click="showKeyDialog = true"
    />

    <!-- 同步楼层数 -->
    <SettingsItem
      label="同步楼层数"
      subtitle="每次同步的消息数量"
      icon="fa-layer-group"
      icon-bg="#a855f7"
      icon-color="white"
      :value="String(floorRange)"
      arrow
      @click="showFloorDialog = true"
    />

    <!-- 手动同步 -->
    <SettingsItem
      label="手动同步"
      subtitle="从平台获取最新数据"
      icon="fa-sync"
      icon-bg="#22c55e"
      icon-color="white"
      :disabled="!status.connected || !status.platform"
      @click="handleSyncRequest"
    />
  </SettingsGroup>

  <!-- 服务器地址对话框 -->
  <InputDialog
    v-model:visible="showUrlDialog"
    title="服务器地址"
    label="Bridge 服务器 URL"
    placeholder="http://localhost:3001"
    :value="serverUrl"
    help-text="输入 Bridge 服务器的地址，通常是 http://localhost:3001"
    @confirm="handleUrlConfirm"
  />

  <!-- API Key 对话框 -->
  <InputDialog
    v-model:visible="showKeyDialog"
    title="API Key"
    label="服务器鉴权密钥"
    placeholder="pk_xxxxxxxxxxxxxxxx"
    type="password"
    :value="apiKey"
    help-text="从服务器的 data/api.key 文件中获取，或访问服务器状态页面查看"
    @confirm="handleKeyConfirm"
  />

  <!-- 同步楼层数对话框 -->
  <InputDialog
    v-model:visible="showFloorDialog"
    title="同步楼层数"
    label="每次同步的消息数量"
    placeholder="10"
    :value="String(floorRange)"
    help-text="设置每次从平台同步的消息楼层数（1-100）"
    @confirm="handleFloorConfirm"
  />
</template>
