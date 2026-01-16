<script setup lang="ts">
/**
 * 已安装应用管理页
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStoreStore } from '@/stores/appStoreStore'
import AppStoreHeader from '../components/AppStoreHeader.vue'

const router = useRouter()
const appStore = useAppStoreStore()

// 内置应用列表（模拟）
const builtinApps = [
  { id: 'chat', name: '微信', icon: 'fab fa-weixin', iconBg: '#07C160' },
  { id: 'email', name: '邮件', icon: 'fas fa-envelope', iconBg: '#007AFF' },
  { id: 'browser', name: '浏览器', icon: 'fas fa-compass', iconBg: '#5856D6' },
  { id: 'live', name: '直播', icon: 'fas fa-video', iconBg: '#FF3B30' },
  { id: 'settings', name: '设置', icon: 'fas fa-cog', iconBg: '#8E8E93' }
]

// 有更新的应用
const appsWithUpdates = computed(() => appStore.appsWithUpdates)

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

// 跳转到应用详情
function goToDetail(appId: string) {
  router.push({ name: 'AppDetail', params: { appId } })
}

// 卸载应用
async function handleUninstall(appId: string) {
  if (confirm('确定要卸载此应用吗？')) {
    await appStore.uninstallApp(appId)
  }
}

// 更新应用
async function handleUpdate(appId: string) {
  await appStore.updateApp(appId)
}

// 更新全部
async function updateAll() {
  for (const app of appsWithUpdates.value) {
    await appStore.updateApp(app.id)
  }
}

// 导入相关
const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      const content = e.target?.result as string
      if (content) {
        const success = await appStore.importFromFile(content)
        if (success) {
          alert('应用导入成功')
        } else {
          alert('应用导入失败: ' + appStore.error)
        }
      }
    }
    
    reader.readAsText(file)
    // 清空 input 以便下次可以选择同一文件
    input.value = ''
  }
}
</script>

<template>
  <div class="installed-apps">
    <!-- 头部 -->
    <AppStoreHeader
      title="已安装应用"
      :show-back="true"
      :show-search="false"
      :show-manage="false"
    />
    
    <div class="content">
      <!-- 隐藏的文件输入框 -->
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleFileChange"
      />
      
      <!-- 导入按钮区域 -->
      <div class="import-section">
        <button class="import-btn" @click="triggerImport">
          <i class="fas fa-file-import"></i>
          <span>导入应用包 (JSON)</span>
        </button>
      </div>

      <!-- 更新提示 -->
      <div v-if="appsWithUpdates.length > 0" class="update-banner">
        <div class="update-info">
          <i class="fas fa-arrow-circle-up"></i>
          <span>{{ appsWithUpdates.length }} 个应用可更新</span>
        </div>
        <button class="update-all-btn" @click="updateAll">
          全部更新
        </button>
      </div>
      
      <!-- 内置应用 -->
      <section class="section">
        <h2 class="section-title">内置应用</h2>
        <div class="app-list">
          <div
            v-for="app in builtinApps"
            :key="app.id"
            class="app-item"
          >
            <div
              class="app-icon"
              :style="{ background: app.iconBg }"
            >
              <i :class="app.icon"></i>
            </div>
            <div class="app-info">
              <span class="app-name">{{ app.name }}</span>
              <span class="app-status">内置应用</span>
            </div>
            <span class="builtin-badge">内置</span>
          </div>
        </div>
      </section>
      
      <!-- 已安装应用 -->
      <section v-if="appStore.installedApps.length > 0" class="section">
        <h2 class="section-title">已安装 ({{ appStore.installedApps.length }})</h2>
        <div class="app-list">
          <div
            v-for="app in appStore.installedApps"
            :key="app.id"
            class="app-item"
            @click="goToDetail(app.id)"
          >
            <div
              class="app-icon"
              :style="{
                background: app.package.icon.background,
                color: app.package.icon.color || '#FFFFFF'
              }"
            >
              <i
                v-if="app.package.icon.type === 'font'"
                :class="app.package.icon.value"
              ></i>
              <span v-else-if="app.package.icon.type === 'emoji'">
                {{ app.package.icon.value }}
              </span>
            </div>
            
            <div class="app-info">
              <span class="app-name">{{ app.package.name }}</span>
              <span class="app-status">
                v{{ app.version }} · 安装于 {{ formatDate(app.installedAt) }}
              </span>
            </div>
            
            <div class="app-actions">
              <!-- 更新按钮 -->
              <button
                v-if="appsWithUpdates.some(a => a.id === app.id)"
                class="action-btn update"
                @click.stop="handleUpdate(app.id)"
              >
                <i class="fas fa-arrow-up"></i>
              </button>
              
              <!-- 卸载按钮 -->
              <button
                class="action-btn uninstall"
                @click.stop="handleUninstall(app.id)"
              >
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 空状态 -->
      <div v-if="appStore.installedApps.length === 0" class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>暂无已安装的应用</p>
        <button class="browse-btn" @click="router.push({ name: 'AppStore' })">
          浏览应用商店
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.installed-apps {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.content {
  @apply flex-1 overflow-y-auto p-5 space-y-6;
}

/* 更新提示 */
.update-banner {
  @apply flex items-center justify-between p-4 rounded-2xl shadow-sm;
  background: var(--color-primary);
  color: #FFFFFF;
}

.update-info {
  @apply flex items-center gap-3 font-medium;
}

.update-info i {
  @apply text-xl;
}

.update-all-btn {
  @apply px-4 py-1.5 rounded-full text-sm font-bold;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}

.update-all-btn:active {
  background: rgba(255, 255, 255, 0.3);
}

/* 导入按钮 */
.import-section {
  @apply px-4;
}

.import-btn {
  @apply w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all;
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px dashed var(--color-primary);
}

.import-btn:active {
  background: var(--color-surface-variant);
  opacity: 0.8;
}

/* Section */
.section {
  @apply space-y-3;
}

.section-title {
  @apply text-sm font-bold uppercase tracking-wider px-1;
  color: var(--color-text-secondary);
}

/* 应用列表 */
.app-list {
  @apply space-y-3;
}

.app-item {
  @apply flex items-center gap-4 p-4 rounded-2xl;
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.app-item:active {
  transform: scale(0.98);
  background: var(--color-surface-variant);
}

.app-icon {
  @apply w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm;
  color: #FFFFFF;
}

.app-info {
  @apply flex-1 flex flex-col min-w-0;
}

.app-name {
  @apply font-bold text-base truncate;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.app-status {
  @apply text-xs mt-0.5 font-medium;
  color: var(--color-text-secondary);
}

.builtin-badge {
  @apply px-2.5 py-1 rounded-lg text-xs font-bold;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.app-actions {
  @apply flex gap-3;
}

.action-btn {
  @apply w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-200;
}

.action-btn.update {
  background: var(--color-primary);
  color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(var(--color-primary-rgb), 0.3);
}

.action-btn.uninstall {
  background: var(--color-surface-variant);
  color: var(--color-error);
}

.action-btn:active {
  transform: scale(0.9);
}

/* 空状态 */
.empty-state {
  @apply flex flex-col items-center justify-center py-16;
  color: var(--color-text-secondary);
}

.empty-state i {
  @apply text-5xl mb-4;
}

.empty-state p {
  @apply text-sm mb-4;
}

.browse-btn {
  @apply px-6 py-2 rounded-full text-sm font-medium;
  background: var(--color-primary);
  color: #FFFFFF;
}

.browse-btn:active {
  opacity: 0.8;
}
</style>