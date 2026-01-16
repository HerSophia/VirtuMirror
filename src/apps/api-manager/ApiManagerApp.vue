<script setup lang="ts">
/**
 * API 管理器应用主入口
 * 提供 API 配置的创建、编辑、测试和管理功能
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApiManager } from './composables'
import { PresetCard, PresetEditor, TemplateSelector } from './components'
import type { PresetTemplate } from './types'

const router = useRouter()
const {
  presets,
  activePresetId,
  isCustomApiEnabled,
  formData,
  editingPresetId,
  showEditor,
  testResult,
  isSaving,
  hasPresets,
  isEditing,
  presetTemplates,
  startNewPreset,
  startEditPreset,
  cancelEdit,
  savePreset,
  deletePreset,
  activatePreset,
  deactivatePreset,
  testConnection,
  duplicatePreset,
  exportPreset,
  importPreset,
} = useApiManager()

/** 是否显示模板选择器 */
const showTemplateSelector = ref(false)

/** 确认删除的预设ID */
const confirmDeleteId = ref<string | null>(null)

/** 是否显示导入弹窗 */
const showImportModal = ref(false)

/** 导入的JSON内容 */
const importJson = ref('')

/**
 * 返回上一页
 */
function goBack() {
  router.back()
}

/**
 * 处理新建按钮点击
 */
function handleNewClick() {
  showTemplateSelector.value = true
}

/**
 * 处理模板选择
 */
function handleTemplateSelect(template: PresetTemplate) {
  showTemplateSelector.value = false
  startNewPreset(template)
}

/**
 * 处理删除确认
 */
function handleDeleteConfirm(presetId: string) {
  confirmDeleteId.value = presetId
}

/**
 * 确认删除
 */
function confirmDelete() {
  if (confirmDeleteId.value) {
    deletePreset(confirmDeleteId.value)
    confirmDeleteId.value = null
  }
}

/**
 * 取消删除
 */
function cancelDelete() {
  confirmDeleteId.value = null
}

/**
 * 处理导出
 */
function handleExport(presetId: string) {
  const preset = presets.value.find(p => p.id === presetId)
  if (!preset) return
  
  const json = exportPreset(preset)
  
  // 复制到剪贴板
  navigator.clipboard.writeText(json).then(() => {
    alert('配置已复制到剪贴板')
  }).catch(() => {
    // 回退：显示在弹窗中
    alert('导出的配置:\n' + json)
  })
}

/**
 * 处理导入
 */
function handleImport() {
  if (importPreset(importJson.value)) {
    showImportModal.value = false
    importJson.value = ''
  } else {
    alert('导入失败：无效的配置格式')
  }
}

/**
 * 更新表单数据
 */
function updateFormData(data: typeof formData) {
  Object.assign(formData, data)
}
</script>

<template>
  <div class="api-manager-app">
    <!-- 主视图 -->
    <template v-if="!showEditor && !showTemplateSelector">
      <!-- 头部 -->
      <div class="app-header">
        <button class="back-btn" @click="goBack">
          ←
        </button>
        <h1 class="app-title">API 管理</h1>
        <button class="action-icon-btn" @click="showImportModal = true">
          📥
        </button>
      </div>
      
      <!-- 状态栏 -->
      <div class="status-bar">
        <div class="status-indicator" :class="{ active: isCustomApiEnabled }">
          <span class="status-dot"></span>
          <span class="status-text">
            {{ isCustomApiEnabled ? '使用自定义 API' : '使用酒馆默认 API' }}
          </span>
        </div>
        <button
          v-if="isCustomApiEnabled"
          class="reset-btn"
          @click="deactivatePreset"
        >
          恢复默认
        </button>
      </div>
      
      <!-- 预设列表 -->
      <div class="preset-list">
        <template v-if="hasPresets">
          <PresetCard
            v-for="preset in presets"
            :key="preset.id"
            :preset="preset"
            :is-active="preset.id === activePresetId"
            @activate="activatePreset(preset.id)"
            @edit="startEditPreset(preset)"
            @duplicate="duplicatePreset(preset)"
            @delete="handleDeleteConfirm(preset.id)"
          />
        </template>
        
        <!-- 空状态 -->
        <div v-else class="empty-state">
          <div class="empty-icon">🔌</div>
          <h3 class="empty-title">暂无 API 配置</h3>
          <p class="empty-desc">添加自定义 API 配置以使用不同的 AI 服务</p>
        </div>
      </div>
      
      <!-- 新建按钮 -->
      <button class="fab" @click="handleNewClick">
        <span class="fab-icon">+</span>
      </button>
    </template>
    
    <!-- 模板选择器 -->
    <TemplateSelector
      v-else-if="showTemplateSelector"
      @select="handleTemplateSelect"
      @cancel="showTemplateSelector = false"
    />
    
    <!-- 编辑器 -->
    <PresetEditor
      v-else-if="showEditor"
      :form-data="formData"
      :test-result="testResult"
      :is-editing="isEditing"
      :is-saving="isSaving"
      @update:form-data="updateFormData"
      @save="savePreset"
      @cancel="cancelEdit"
      @test="testConnection"
    />
    
    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <div v-if="confirmDeleteId" class="modal-overlay" @click="cancelDelete">
        <div class="modal-content" @click.stop>
          <h3 class="modal-title">确认删除</h3>
          <p class="modal-text">确定要删除这个配置吗？此操作无法撤销。</p>
          <div class="modal-actions">
            <button class="modal-btn secondary" @click="cancelDelete">
              取消
            </button>
            <button class="modal-btn danger" @click="confirmDelete">
              删除
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 导入弹窗 -->
    <Teleport to="body">
      <div v-if="showImportModal" class="modal-overlay" @click="showImportModal = false">
        <div class="modal-content import-modal" @click.stop>
          <h3 class="modal-title">导入配置</h3>
          <textarea
            v-model="importJson"
            class="import-textarea"
            placeholder="粘贴 JSON 配置..."
          ></textarea>
          <div class="modal-actions">
            <button class="modal-btn secondary" @click="showImportModal = false">
              取消
            </button>
            <button class="modal-btn primary" @click="handleImport">
              导入
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.api-manager-app {
  @apply h-full flex flex-col relative;
  background: var(--color-background);
}

/* 头部 */
.app-header {
  @apply flex items-center gap-3 px-4 py-3 border-b;
  border-color: var(--color-border);
  background: var(--color-surface);
}

.back-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full text-lg;
  color: var(--color-primary);
}

.back-btn:hover {
  background: var(--color-surface-variant);
}

.app-title {
  @apply flex-1 text-lg font-semibold;
  color: var(--color-text);
}

.action-icon-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
}

.action-icon-btn:hover {
  background: var(--color-surface-variant);
}

/* 状态栏 */
.status-bar {
  @apply flex items-center justify-between px-4 py-2;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.status-indicator {
  @apply flex items-center gap-2 text-sm;
  color: var(--color-text-secondary);
}

.status-indicator.active {
  color: var(--color-success);
}

.status-dot {
  @apply w-2 h-2 rounded-full;
  background: currentColor;
}

.reset-btn {
  @apply px-3 py-1 rounded text-sm;
  color: var(--color-primary);
}

.reset-btn:hover {
  background: var(--color-surface-variant);
}

/* 预设列表 */
.preset-list {
  @apply flex-1 overflow-y-auto p-4 space-y-3;
}

/* 空状态 */
.empty-state {
  @apply flex flex-col items-center justify-center h-full text-center px-8;
}

.empty-icon {
  @apply text-5xl mb-4;
}

.empty-title {
  @apply text-lg font-semibold mb-2;
  color: var(--color-text);
}

.empty-desc {
  @apply text-sm;
  color: var(--color-text-secondary);
}

/* FAB 按钮 */
.fab {
  @apply absolute bottom-6 right-6 w-14 h-14 rounded-full shadow-lg;
  @apply flex items-center justify-center;
  background: var(--color-primary);
  color: white;
  transition: transform 0.2s, box-shadow 0.2s;
}

.fab:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.fab-icon {
  @apply text-2xl font-light;
}

/* 弹窗 */
.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center z-50;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  @apply rounded-2xl p-6 mx-4 max-w-sm w-full;
  background: var(--color-surface);
}

.modal-title {
  @apply text-lg font-semibold mb-2;
  color: var(--color-text);
}

.modal-text {
  @apply text-sm mb-4;
  color: var(--color-text-secondary);
}

.modal-actions {
  @apply flex gap-3;
}

.modal-btn {
  @apply flex-1 py-2 rounded-lg font-medium;
}

.modal-btn.secondary {
  background: var(--color-background);
  color: var(--color-text);
}

.modal-btn.primary {
  background: var(--color-primary);
  color: white;
}

.modal-btn.danger {
  background: var(--color-error);
  color: white;
}

/* 导入弹窗 */
.import-modal {
  @apply max-w-md;
}

.import-textarea {
  @apply w-full h-40 p-3 rounded-lg text-sm mb-4 resize-none;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.import-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}
</style>
