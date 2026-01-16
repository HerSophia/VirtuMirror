<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePhoneStore } from '@/stores/phoneStore'
import { useContactStore } from '@/stores/contactStore'
import { useChatStore } from '@/stores/chatStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { getMockServices } from '@/mock'
import { mockContactData } from '@/mock/data/contactData'

// 导入持久化服务
import { useChatDataService, useGlobalConfigService, useEnvironment } from '@/composables'
import { getAdapter } from '@/adapters'
import type { MockAdapter } from '@/adapters/mockAdapter'
import type { NotificationPriority } from '@/types/notification'

const phoneStore = usePhoneStore()
const contactStore = useContactStore()
const chatStore = useChatStore()
const notificationStore = useNotificationStore()

// 获取持久化服务
const chatDataService = useChatDataService()
const globalConfigService = useGlobalConfigService()
const { characterName, playerName, adapterType, isDevMode } = useEnvironment()

const isExpanded = ref(false)
const testMessage = ref('')
const persistenceTestResult = ref('')

// 加载Mock数据
function loadMockData() {
  contactStore.setContacts(mockContactData)
  console.log('[DevToolbar] Mock contacts loaded')
}

// 触发测试消息
function triggerTestMessage() {
  const mockServices = getMockServices()
  if (mockServices) {
    const messageId = mockServices.sillyTavern.addMessage({
      mes: testMessage.value || `[app:微信, type:聊天, from:小明]
测试消息 - ${new Date().toLocaleTimeString()}
[/app]`,
    })
    console.log('[DevToolbar] Test message triggered:', messageId)
  }
}

// 模拟AI生成
async function simulateGeneration() {
  const mockServices = getMockServices()
  if (mockServices) {
    console.log('[DevToolbar] Starting simulated generation...')
    const context = mockServices.sillyTavern.getContext()
    await context.generate()
  }
}

// 清除所有数据
function clearAllData() {
  if (confirm('确定清除所有数据？')) {
    phoneStore.resetAll()
    console.log('[DevToolbar] All data cleared')
  }
}

// 创建测试通知
function createTestNotification(priority: NotificationPriority = 'normal') {
  const apps = [
    { id: 'wechat', name: '微信', icon: 'fab fa-weixin', color: '#07C160' },
    { id: 'mail', name: '邮件', icon: 'fas fa-envelope', color: '#007AFF' },
    { id: 'calendar', name: '日历', icon: 'fas fa-calendar', color: '#FF3B30' },
    { id: 'system', name: '系统', icon: 'fas fa-cog', color: '#8E8E93' },
  ]
  
  const randomApp = apps[Math.floor(Math.random() * apps.length)]
  const titles = ['新消息', '提醒', '通知', '警告']
  const bodies = ['你好，在吗？', '会议将在5分钟后开始', '系统更新已就绪', '账户登录提醒']
  
  notificationStore.createNotification({
    appId: randomApp.id,
    appName: randomApp.name,
    appIcon: {
      type: 'fontawesome',
      value: randomApp.icon,
      backgroundColor: randomApp.color,
    },
    title: titles[Math.floor(Math.random() * titles.length)],
    body: bodies[Math.floor(Math.random() * bodies.length)],
    priority,
    autoDismiss: priority === 'urgent' ? 0 : 5000, 
    sound: true,
  })
  
  console.log('[DevToolbar] Created test notification')
}

// 清除所有通知
function clearNotifications() {
  notificationStore.clearAll()
  console.log('[DevToolbar] Cleared all notifications')
}

// 显示状态摘要
const stateSummary = computed(() => ({
  contacts: Object.keys(contactStore.contacts).length,
  conversations: chatStore.activeConversations.length,
  emails: phoneStore.emails.length,
  notifications: notificationStore.notifications.length,
  stagedActions: phoneStore.stagedActionsStore.count,
}))

// ==================== 数据持久化测试功能 ====================

// 测试保存聊天数据
function testSaveChatData() {
  const testData = {
    chat: {
      conversations: {
        'test_contact': [
          {
            uid: `msg_${Date.now()}`,
            contactId: 'test_contact',
            senderId: 'test_contact',
            type: 'text' as const,
            timestamp: Date.now(),
            content: '测试消息 - ' + new Date().toLocaleTimeString(),
          }
        ]
      },
      unreadCounts: { 'test_contact': 1 },
    }
  }
  
  chatDataService.updateData(testData)
  persistenceTestResult.value = '✅ 聊天数据已保存'
  console.log('[DevToolbar] Chat data saved:', testData)
}

// 测试读取聊天数据
function testLoadChatData() {
  const data = chatDataService.getData()
  if (data) {
    persistenceTestResult.value = `✅ 读取成功: ${JSON.stringify(data._meta)}`
    console.log('[DevToolbar] Chat data loaded:', data)
  } else {
    persistenceTestResult.value = '⚠️ 没有找到聊天数据'
  }
}

// 测试保存全局配置
function testSaveGlobalConfig() {
  globalConfigService.updateConfig({
    ui: {
      themeId: 'test_theme_' + Date.now(),
    } as any
  })
  persistenceTestResult.value = '✅ 全局配置已保存'
  console.log('[DevToolbar] Global config saved')
}

// 测试读取全局配置
function testLoadGlobalConfig() {
  const config = globalConfigService.getConfig()
  if (config) {
    persistenceTestResult.value = `✅ 配置读取成功: 主题=${config.ui.themeId}`
    console.log('[DevToolbar] Global config loaded:', config)
  } else {
    persistenceTestResult.value = '⚠️ 没有找到全局配置'
  }
}

// 模拟聊天切换
function simulateChatChange() {
  const adapter = getAdapter()
  if (adapter.getAdapterType() === 'mock') {
    const mockAdapter = adapter as MockAdapter
    const newChatId = `chat_${Date.now()}`
    mockAdapter.simulateChatChange(newChatId)
    persistenceTestResult.value = `✅ 已切换到新聊天: ${newChatId}`
    console.log('[DevToolbar] Simulated chat change to:', newChatId)
  } else {
    persistenceTestResult.value = '⚠️ 仅在 Mock 模式下可用'
  }
}

// 查看 localStorage 数据
function viewLocalStorageData() {
  const chatData = localStorage.getItem('phone_sim_mock_chat')
  const globalData = localStorage.getItem('phone_sim_mock_global')
  
  console.log('[DevToolbar] localStorage chat data:', chatData ? JSON.parse(chatData) : null)
  console.log('[DevToolbar] localStorage global data:', globalData ? JSON.parse(globalData) : null)
  
  persistenceTestResult.value = '✅ 已在控制台输出 localStorage 数据'
}

// 清除持久化数据
function clearPersistenceData() {
  if (confirm('确定清除所有持久化数据？')) {
    localStorage.removeItem('phone_sim_mock_chat')
    localStorage.removeItem('phone_sim_mock_global')
    chatDataService.clearData()
    persistenceTestResult.value = '✅ 持久化数据已清除'
    console.log('[DevToolbar] Persistence data cleared')
  }
}

// 导出当前数据
function exportData() {
  const chatJson = chatDataService.exportToJson()
  const configJson = globalConfigService.exportToJson()
  
  const exportData = {
    chatData: JSON.parse(chatJson || '{}'),
    globalConfig: JSON.parse(configJson || '{}'),
    exportedAt: new Date().toISOString(),
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `phone_sim_data_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  persistenceTestResult.value = '✅ 数据已导出'
}
</script>

<template>
  <div class="dev-toolbar" :class="{ expanded: isExpanded }">
    <button class="toggle-btn" @click="isExpanded = !isExpanded">
      <i class="fas" :class="isExpanded ? 'fa-chevron-down' : 'fa-chevron-up'" />
      <span>开发工具</span>
    </button>
    
    <div v-if="isExpanded" class="toolbar-content">
      <!-- 状态摘要 -->
      <div class="state-summary">
        <span>联系人: {{ stateSummary.contacts }}</span>
        <span>对话: {{ stateSummary.conversations }}</span>
        <span>邮件: {{ stateSummary.emails }}</span>
        <span>通知: {{ stateSummary.notifications }}</span>
        <span>暂存: {{ stateSummary.stagedActions }}</span>
      </div>
      
      <!-- 快捷操作 -->
      <div class="actions">
        <button @click="loadMockData" title="加载Mock数据">
          <i class="fas fa-database" />
          加载Mock数据
        </button>
        
        <button @click="simulateGeneration" title="模拟AI生成">
          <i class="fas fa-robot" />
          模拟生成
        </button>
        
        <button @click="clearAllData" class="danger" title="清除数据">
          <i class="fas fa-trash" />
          清除数据
        </button>
      </div>
      
      <!-- 测试消息输入 -->
      <div class="test-message">
        <textarea
          v-model="testMessage"
          placeholder="输入测试消息（支持[app:...]格式）..."
          rows="3"
        />
        <button @click="triggerTestMessage">
          <i class="fas fa-paper-plane" />
          发送测试
        </button>
      </div>
      
      <!-- 快速测试命令 -->
      <div class="quick-commands">
        <span class="label">快速测试:</span>
        <button @click="testMessage = '[app:微信, type:聊天, from:小红]\n你好呀！\n[/app]'">
          微信消息
        </button>
        <button @click="testMessage = '[app:朋友圈, type:动态, from:小明]\n今天天气真好！\n[/app]'">
          朋友圈
        </button>
        <button @click="testMessage = '[app:电话, type:来电, from:妈妈]\n[/app]'">
          来电
        </button>
        <button @click="testMessage = '[app:邮件, type:新邮件, from:HR, subject:通知]\n请查收附件。\n[/app]'">
          邮件
        </button>
      </div>

      <!-- 通知测试 -->
      <div class="quick-commands">
        <span class="label">通知测试:</span>
        <button @click="createTestNotification('normal')">
          普通通知
        </button>
        <button @click="createTestNotification('high')">
          重要通知
        </button>
        <button @click="createTestNotification('urgent')">
          紧急通知
        </button>
        <button @click="clearNotifications" class="danger">
          清除通知
        </button>
      </div>
      
      <!-- 数据持久化测试 -->
      <div class="persistence-section">
        <div class="section-header">
          <span class="label">📦 数据持久化测试</span>
          <span class="adapter-badge" :class="adapterType">
            {{ adapterType === 'mock' ? '🔧 Mock' : '🎭 SillyTavern' }}
          </span>
        </div>
        
        <div class="env-info">
          <span>角色: {{ characterName }}</span>
          <span>玩家: {{ playerName }}</span>
        </div>
        
        <div class="persistence-actions">
          <button @click="testSaveChatData" title="保存测试聊天数据">
            <i class="fas fa-save" /> 保存聊天
          </button>
          <button @click="testLoadChatData" title="读取聊天数据">
            <i class="fas fa-download" /> 读取聊天
          </button>
          <button @click="testSaveGlobalConfig" title="保存全局配置">
            <i class="fas fa-cog" /> 保存配置
          </button>
          <button @click="testLoadGlobalConfig" title="读取全局配置">
            <i class="fas fa-cogs" /> 读取配置
          </button>
        </div>
        
        <div class="persistence-actions">
          <button @click="simulateChatChange" title="模拟切换聊天">
            <i class="fas fa-exchange-alt" /> 模拟切换聊天
          </button>
          <button @click="viewLocalStorageData" title="查看localStorage">
            <i class="fas fa-eye" /> 查看存储
          </button>
          <button @click="exportData" title="导出数据">
            <i class="fas fa-file-export" /> 导出数据
          </button>
          <button @click="clearPersistenceData" class="danger" title="清除持久化数据">
            <i class="fas fa-eraser" /> 清除存储
          </button>
        </div>
        
        <div v-if="persistenceTestResult" class="test-result">
          {{ persistenceTestResult }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dev-toolbar {
  @apply fixed bottom-0 left-0 right-0 z-[9999];
  @apply bg-gray-900 text-white text-sm;
  @apply transition-all duration-300;
}

.toggle-btn {
  @apply w-full py-2 px-4 flex items-center justify-center gap-2;
  @apply bg-gray-800 hover:bg-gray-700 transition-colors;
}

.toolbar-content {
  @apply p-4 space-y-4;
}

.state-summary {
  @apply flex items-center gap-4 text-xs text-gray-400;
}

.actions {
  @apply flex flex-wrap gap-2;
}

.actions button {
  @apply px-3 py-1.5 rounded text-xs;
  @apply bg-gray-700 hover:bg-gray-600 transition-colors;
  @apply flex items-center gap-1.5;
}

.actions button.danger {
  @apply bg-red-900 hover:bg-red-800;
}

.test-message {
  @apply flex gap-2;
}

.test-message textarea {
  @apply flex-1 px-3 py-2 rounded text-xs;
  @apply bg-gray-800 text-white;
  @apply border border-gray-700 focus:border-blue-500 focus:outline-none;
  @apply resize-none;
}

.test-message button {
  @apply px-4 rounded;
  @apply bg-blue-600 hover:bg-blue-500 transition-colors;
  @apply flex items-center gap-1.5;
}

.quick-commands {
  @apply flex flex-wrap items-center gap-2;
}

.quick-commands .label {
  @apply text-xs text-gray-400;
}

.quick-commands button {
  @apply px-2 py-1 rounded text-xs;
  @apply bg-gray-700 hover:bg-gray-600 transition-colors;
}

/* 数据持久化测试区域样式 */
.persistence-section {
  @apply mt-4 pt-4 border-t border-gray-700;
}

.section-header {
  @apply flex items-center justify-between mb-2;
}

.section-header .label {
  @apply text-sm font-medium text-blue-400;
}

.adapter-badge {
  @apply px-2 py-0.5 rounded text-xs;
}

.adapter-badge.mock {
  @apply bg-yellow-900 text-yellow-300;
}

.adapter-badge.sillytavern {
  @apply bg-green-900 text-green-300;
}

.env-info {
  @apply flex items-center gap-4 text-xs text-gray-400 mb-3;
}

.persistence-actions {
  @apply flex flex-wrap gap-2 mb-2;
}

.persistence-actions button {
  @apply px-3 py-1.5 rounded text-xs;
  @apply bg-indigo-900 hover:bg-indigo-800 transition-colors;
  @apply flex items-center gap-1.5;
}

.persistence-actions button.danger {
  @apply bg-red-900 hover:bg-red-800;
}

.test-result {
  @apply mt-2 px-3 py-2 rounded text-xs;
  @apply bg-gray-800 text-green-400;
  @apply font-mono;
}
</style>