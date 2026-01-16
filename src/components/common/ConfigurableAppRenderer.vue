<script setup lang="ts">
/**
 * 配置式应用渲染器
 * 
 * 根据应用包配置动态渲染应用界面
 */
import { ref, computed, onMounted, watch } from 'vue'
import type { 
  PhoneAppPackage, 
  ConfigurableAppConfig,
  ListConfig
} from '@/types/appPackage'

const props = defineProps<{
  /** 应用包配置 */
  appPackage: PhoneAppPackage
  /** 用户数据 */
  userData?: Record<string, unknown>
}>()

const emit = defineEmits<{
  /** 数据更新 */
  'update:userData': [data: Record<string, unknown>]
  /** 执行动作 */
  action: [action: string, payload?: unknown]
}>()

// 应用配置
const config = computed(() => props.appPackage.configurable)

// 本地状态
const localState = ref<Record<string, unknown>>({
  ...props.appPackage.initialState,
  ...props.userData
})

// 数据项列表
const dataItems = computed(() => {
  const stateKey = getDataKey()
  const items = localState.value[stateKey]
  return Array.isArray(items) ? items : []
})

// 获取数据键名
function getDataKey(): string {
  // 从配置中推断数据键
  const dataSource = props.appPackage.dataSource
  if (dataSource?.worldbookKey) {
    return dataSource.worldbookKey.replace('phone_', '')
  }
  return 'items'
}

// 获取项目字段值
function getFieldValue(item: Record<string, unknown>, field?: string): string {
  if (!field) return ''
  return String(item[field] ?? '')
}

// 格式化时间
function formatTime(timestamp?: string | number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

// 处理项目点击
function handleItemClick(item: Record<string, unknown>) {
  emit('action', 'itemClick', item)
}

// 处理项目动作
function handleItemAction(action: string, item: Record<string, unknown>) {
  emit('action', action, item)
}

// 处理浮动按钮点击
function handleFloatingButtonClick() {
  const action = config.value?.floatingButton?.action
  if (action) {
    emit('action', action)
  }
}

// 添加新项目
function addItem(item: Record<string, unknown>) {
  const key = getDataKey()
  const items = [...dataItems.value, item]
  localState.value = { ...localState.value, [key]: items }
  emit('update:userData', localState.value)
}

// 删除项目
function removeItem(itemId: string) {
  const key = getDataKey()
  const items = dataItems.value.filter((item: Record<string, unknown>) => item.id !== itemId)
  localState.value = { ...localState.value, [key]: items }
  emit('update:userData', localState.value)
}

// 更新项目
function updateItem(itemId: string, updates: Record<string, unknown>) {
  const key = getDataKey()
  const items = dataItems.value.map((item: Record<string, unknown>) => 
    item.id === itemId ? { ...item, ...updates } : item
  )
  localState.value = { ...localState.value, [key]: items }
  emit('update:userData', localState.value)
}

// 监听外部数据变化
watch(() => props.userData, (newData) => {
  if (newData) {
    localState.value = { ...localState.value, ...newData }
  }
}, { deep: true })

// 暴露方法供外部调用
defineExpose({
  addItem,
  removeItem,
  updateItem,
  getState: () => localState.value
})
</script>

<template>
  <div class="configurable-app" :data-layout="config?.layout">
    <!-- 列表布局 -->
    <template v-if="config?.layout === 'list'">
      <div class="list-container">
        <!-- 空状态 -->
        <div v-if="dataItems.length === 0" class="empty-state">
          <i :class="config.listConfig?.emptyIcon || 'fas fa-inbox'"></i>
          <p>{{ config.listConfig?.emptyText || '暂无内容' }}</p>
        </div>
        
        <!-- 列表项 -->
        <div
          v-for="item in dataItems"
          :key="String(item.id)"
          class="list-item"
          @click="handleItemClick(item)"
        >
          <!-- 头像 -->
          <div
            v-if="config.listConfig?.avatarField"
            class="item-avatar"
          >
            <img
              v-if="getFieldValue(item, config.listConfig.avatarField)"
              :src="getFieldValue(item, config.listConfig.avatarField)"
              alt=""
            />
            <i v-else class="fas fa-user"></i>
          </div>
          
          <!-- 内容 -->
          <div class="item-content">
            <div class="item-title">
              {{ getFieldValue(item, config.listConfig?.titleField) }}
            </div>
            <div
              v-if="config.listConfig?.subtitleField"
              class="item-subtitle"
            >
              {{ getFieldValue(item, config.listConfig.subtitleField) }}
            </div>
          </div>
          
          <!-- 时间 -->
          <div
            v-if="config.listConfig?.timeField"
            class="item-time"
          >
            {{ formatTime(item[config.listConfig.timeField] as string) }}
          </div>
          
          <!-- 动作按钮 -->
          <div v-if="config.itemActions?.length" class="item-actions">
            <button
              v-for="action in config.itemActions"
              :key="action.action"
              class="action-btn"
              @click.stop="handleItemAction(action.action, item)"
            >
              <i :class="action.icon"></i>
            </button>
          </div>
        </div>
      </div>
      
      <!-- 浮动按钮 -->
      <button
        v-if="config.floatingButton"
        class="floating-btn"
        @click="handleFloatingButtonClick"
      >
        <i :class="config.floatingButton.icon"></i>
      </button>
    </template>
    
    <!-- 网格布局 -->
    <template v-else-if="config?.layout === 'grid'">
      <div
        class="grid-container"
        :style="{ gridTemplateColumns: `repeat(${config.gridConfig?.columns || 3}, 1fr)` }"
      >
        <div
          v-for="item in dataItems"
          :key="String(item.id)"
          class="grid-item"
          @click="handleItemClick(item)"
        >
          <div class="grid-item-content">
            {{ getFieldValue(item, config.listConfig?.titleField || 'title') }}
          </div>
        </div>
      </div>
    </template>
    
    <!-- 详情布局 -->
    <template v-else-if="config?.layout === 'detail'">
      <div class="detail-container">
        <h1 class="detail-title">
          {{ getFieldValue(dataItems[0] || {}, config.detailConfig?.titleField) }}
        </h1>
        <div class="detail-content">
          {{ getFieldValue(dataItems[0] || {}, config.detailConfig?.contentField) }}
        </div>
      </div>
    </template>
    
    <!-- WebView 布局 -->
    <template v-else-if="config?.layout === 'webview'">
      <iframe
        v-if="config.webviewConfig?.url"
        :src="config.webviewConfig.url"
        class="webview-frame"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>
    </template>
    
    <!-- 未知布局 -->
    <template v-else>
      <div class="unknown-layout">
        <i class="fas fa-exclamation-triangle"></i>
        <p>不支持的布局类型</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.configurable-app {
  @apply h-full flex flex-col relative;
  background: var(--color-background);
}

/* 列表布局 */
.list-container {
  @apply flex-1 overflow-y-auto;
}

.list-item {
  @apply flex items-center gap-3 p-4;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.2s ease;
}

.list-item:active {
  background: var(--color-surface-variant);
}

.item-avatar {
  @apply w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.item-avatar img {
  @apply w-full h-full object-cover;
}

.item-content {
  @apply flex-1 min-w-0;
}

.item-title {
  @apply font-medium truncate;
  color: var(--color-text);
}

.item-subtitle {
  @apply text-sm truncate mt-0.5;
  color: var(--color-text-secondary);
}

.item-time {
  @apply text-xs flex-shrink-0;
  color: var(--color-text-secondary);
}

.item-actions {
  @apply flex gap-1 ml-2;
}

.action-btn {
  @apply w-8 h-8 rounded-full flex items-center justify-center;
  color: var(--color-text-secondary);
}

.action-btn:active {
  background: var(--color-surface-variant);
}

/* 浮动按钮 */
.floating-btn {
  @apply absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg;
  background: var(--color-primary);
  color: #FFFFFF;
}

.floating-btn:active {
  transform: scale(0.95);
}

/* 网格布局 */
.grid-container {
  @apply grid gap-3 p-4;
}

.grid-item {
  @apply aspect-square rounded-xl flex items-center justify-center p-3;
  background: var(--color-surface);
  cursor: pointer;
}

.grid-item:active {
  background: var(--color-surface-variant);
}

.grid-item-content {
  @apply text-center text-sm;
  color: var(--color-text);
}

/* 详情布局 */
.detail-container {
  @apply flex-1 overflow-y-auto p-4;
}

.detail-title {
  @apply text-xl font-bold mb-4;
  color: var(--color-text);
}

.detail-content {
  @apply text-sm leading-relaxed;
  color: var(--color-text-secondary);
}

/* WebView 布局 */
.webview-frame {
  @apply w-full h-full border-0;
}

/* 空状态 */
.empty-state {
  @apply flex flex-col items-center justify-center h-64;
  color: var(--color-text-secondary);
}

.empty-state i {
  @apply text-4xl mb-3;
}

.empty-state p {
  @apply text-sm;
}

/* 未知布局 */
.unknown-layout {
  @apply flex flex-col items-center justify-center h-full;
  color: var(--color-text-secondary);
}

.unknown-layout i {
  @apply text-4xl mb-3;
  color: var(--color-warning);
}
</style>