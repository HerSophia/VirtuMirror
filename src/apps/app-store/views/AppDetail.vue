<script setup lang="ts">
/**
 * 应用详情页
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStoreStore } from '@/stores/appStoreStore'
import { PERMISSION_DESCRIPTIONS, CATEGORY_NAMES } from '@/types/appPackage'
import AppStoreHeader from '../components/AppStoreHeader.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStoreStore()

// 应用 ID
const appId = computed(() => route.params.appId as string)

// 应用信息
const app = computed(() => {
  return appStore.registry.apps.find(a => a.id === appId.value) || null
})

// 是否已安装
const isInstalled = computed(() => appStore.isInstalled(appId.value))

// 已安装的应用信息
const installedApp = computed(() => appStore.getInstalledApp(appId.value))

// 是否有更新
const hasUpdate = computed(() => {
  if (!installedApp.value || !app.value) return false
  return app.value.version !== installedApp.value.version
})

// 安装状态
const isInstalling = ref(false)

// 图标样式
const iconStyle = computed(() => {
  if (!app.value) return {}
  return {
    background: app.value.icon.background,
    color: app.value.icon.color || '#FFFFFF'
  }
})

// 格式化大小
function formatSize(bytes?: number): string {
  if (!bytes) return '未知'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// 格式化日期
function formatDate(dateStr?: string): string {
  if (!dateStr) return '未知'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// 格式化下载量
function formatDownloads(count?: number): string {
  if (!count) return '0'
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)} 万`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)} 千`
  }
  return count.toString()
}

// 获取分类名称
function getCategoryName(categoryId?: string): string {
  if (!categoryId) return '其他'
  return CATEGORY_NAMES[categoryId as keyof typeof CATEGORY_NAMES] || categoryId
}

// 安装应用
async function handleInstall() {
  isInstalling.value = true
  await appStore.installApp(appId.value)
  isInstalling.value = false
}

// 卸载应用
async function handleUninstall() {
  if (confirm('确定要卸载此应用吗？')) {
    await appStore.uninstallApp(appId.value)
  }
}

// 更新应用
async function handleUpdate() {
  isInstalling.value = true
  await appStore.updateApp(appId.value)
  isInstalling.value = false
}

// 打开应用（如果已安装）
function openApp() {
  // 如果是 configurable 类型的应用，使用 AppRunner 运行
  if (installedApp.value?.package.appType === 'configurable') {
    // 我们的路由还没配置，但我们可以先添加一个简单的运行逻辑
    // 或者在 AppDetail 内部添加一个运行模式
    // 这里我们先跳转到 AppRunner 路由（需要添加）
    router.push({ name: 'AppRunner', params: { appId: appId.value } })
  } else {
    // 其他类型的应用，回到桌面
    router.push({ name: 'HomeScreen' })
  }
}
</script>

<template>
  <div class="app-detail">
    <!-- 头部 -->
    <AppStoreHeader
      :title="app?.name || '应用详情'"
      :show-back="true"
      :show-search="false"
      :show-manage="false"
    />
    
    <div v-if="app" class="detail-content">
      <!-- 应用信息头部 -->
      <div class="app-header">
        <div class="app-icon" :style="iconStyle">
          <i v-if="app.icon.type === 'font'" :class="app.icon.value"></i>
          <span v-else-if="app.icon.type === 'emoji'">{{ app.icon.value }}</span>
          <img v-else :src="app.icon.value" alt="" />
        </div>
        
        <div class="app-info">
          <h1 class="app-name">{{ app.name }}</h1>
          <p class="app-author">{{ app.author }}</p>
          <div class="app-meta">
            <span v-if="app.rating" class="rating">
              <i class="fas fa-star"></i>
              {{ app.rating.toFixed(1) }}
            </span>
            <span class="category">{{ getCategoryName(app.category) }}</span>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="app-actions">
          <template v-if="isInstalled">
            <button
              v-if="hasUpdate"
              class="action-btn update"
              :disabled="isInstalling"
              @click="handleUpdate"
            >
              {{ isInstalling ? '更新中...' : '更新' }}
            </button>
            <button
              v-else
              class="action-btn open"
              @click="openApp"
            >
              打开
            </button>
          </template>
          <button
            v-else
            class="action-btn install"
            :disabled="isInstalling"
            @click="handleInstall"
          >
            {{ isInstalling ? '安装中...' : '获取' }}
          </button>
        </div>
      </div>
      
      <!-- 截图 -->
      <section v-if="app.screenshots?.length" class="section">
        <h2 class="section-title">截图预览</h2>
        <div class="screenshots-scroll">
          <img
            v-for="(screenshot, index) in app.screenshots"
            :key="index"
            :src="screenshot"
            class="screenshot"
            alt=""
          />
        </div>
      </section>
      
      <!-- 描述 -->
      <section class="section">
        <h2 class="section-title">简介</h2>
        <p class="description">{{ app.description }}</p>
      </section>
      
      <!-- 权限 -->
      <section v-if="app.permissions?.length" class="section">
        <h2 class="section-title">所需权限</h2>
        <div class="permission-list">
          <div
            v-for="permission in app.permissions"
            :key="permission"
            class="permission-item"
          >
            <i class="fas fa-shield-alt permission-icon"></i>
            <div class="permission-info">
              <span class="permission-name">
                {{ PERMISSION_DESCRIPTIONS[permission]?.name || permission }}
              </span>
              <span class="permission-desc">
                {{ PERMISSION_DESCRIPTIONS[permission]?.description || '' }}
              </span>
            </div>
          </div>
        </div>
      </section>
      
      <!-- 信息 -->
      <section class="section">
        <h2 class="section-title">信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">版本</span>
            <span class="info-value">{{ app.version }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">大小</span>
            <span class="info-value">{{ formatSize(app.packageSize) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">更新日期</span>
            <span class="info-value">{{ formatDate(app.updatedAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">下载量</span>
            <span class="info-value">{{ formatDownloads(app.downloads) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">分类</span>
            <span class="info-value">{{ getCategoryName(app.category) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">兼容性</span>
            <span class="info-value">{{ app.minPhoneVersion || '所有版本' }}</span>
          </div>
        </div>
      </section>
      
      <!-- 卸载按钮 -->
      <div v-if="isInstalled" class="uninstall-section">
        <button class="uninstall-btn" @click="handleUninstall">
          <i class="fas fa-trash-alt"></i>
          卸载应用
        </button>
      </div>
    </div>
    
    <!-- 应用不存在 -->
    <div v-else class="not-found">
      <i class="fas fa-question-circle"></i>
      <p>应用不存在</p>
      <button class="back-btn" @click="router.back()">返回</button>
    </div>
  </div>
</template>

<style scoped>
.app-detail {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.detail-content {
  @apply flex-1 overflow-y-auto;
}

/* 应用头部 - 水平布局 */
.app-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
}

.app-icon {
  width: 72px;
  height: 72px;
  min-width: 72px;
  min-height: 72px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.app-icon img {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  object-fit: cover;
}

.app-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.app-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-author {
  font-size: 13px;
  margin-top: 2px;
  color: var(--color-primary);
}

.app-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.rating {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rating i {
  color: #FFD60A;
  font-size: 11px;
}

.app-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  align-self: center;
}

.action-btn {
  padding: 8px 20px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  min-width: 72px;
  text-align: center;
  transition: all 0.2s ease;
}

.action-btn:active {
  transform: scale(0.95);
  opacity: 0.9;
}

.action-btn.install,
.action-btn.update {
  background: var(--color-primary);
  color: #FFFFFF;
}

.action-btn.open {
  background: var(--color-surface-variant);
  color: var(--color-primary);
}

.action-btn:disabled {
  opacity: 0.6;
}

/* 通用 section */
.section {
  @apply p-4;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  @apply text-base font-bold mb-3;
  color: var(--color-text);
}

/* 截图 */
.screenshots-scroll {
  @apply flex gap-3 overflow-x-auto -mx-4 px-4 pb-2;
  -webkit-overflow-scrolling: touch;
}

.screenshots-scroll::-webkit-scrollbar {
  display: none;
}

.screenshot {
  @apply h-48 rounded-lg flex-shrink-0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 描述 */
.description {
  @apply text-sm leading-relaxed;
  color: var(--color-text-secondary);
}

/* 权限列表 */
.permission-list {
  @apply space-y-2;
}

.permission-item {
  @apply flex items-center gap-3 p-3 rounded-xl;
  background: var(--color-surface-variant);
}

.permission-icon {
  @apply text-lg;
  color: var(--color-primary);
}

.permission-info {
  @apply flex flex-col;
}

.permission-name {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.permission-desc {
  @apply text-xs;
  color: var(--color-text-secondary);
}

/* 信息网格 */
.info-grid {
  @apply grid grid-cols-2 gap-3;
}

.info-item {
  @apply flex flex-col;
}

.info-label {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.info-value {
  @apply text-sm font-medium;
  color: var(--color-text);
}

/* 卸载 */
.uninstall-section {
  @apply p-4;
}

.uninstall-btn {
  @apply w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2;
  background: var(--color-surface);
  color: var(--color-error);
  border: 1px solid var(--color-error);
  transition: all 0.2s ease;
}

.uninstall-btn:active {
  background: var(--color-error);
  color: #FFFFFF;
}

/* 应用不存在 */
.not-found {
  @apply flex-1 flex flex-col items-center justify-center;
  color: var(--color-text-secondary);
}

.not-found i {
  @apply text-5xl mb-4;
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