<script setup lang="ts">
/**
 * 提示词编辑对话框
 * @description 用于编辑已有提示词的对话框组件
 */
import { PromptService } from '@/services/prompt/promptService'
import type { PromptTemplate, PromptVariable } from '@/types/prompts'
import { PROMPT_CATEGORIES } from '@/types/prompts'
import { computed, ref, watch } from 'vue'
import VariableEditor from './VariableEditor.vue'

const props = defineProps<{
  prompt: PromptTemplate
}>()

const emit = defineEmits<{
  save: [prompt: PromptTemplate]
  close: []
}>()

// 编辑表单数据
const formData = ref<PromptTemplate>({ ...props.prompt })

// 获取编辑权限
const permission = computed(() => PromptService.isPromptEditable(props.prompt))

// 是否可编辑字段
const canEditField = (field: string): boolean => {
  if (permission.value.editableFields.includes('*')) {
    return true
  }
  return permission.value.editableFields.includes(field)
}

// 分类选项
const categoryOptions = PROMPT_CATEGORIES.filter((c) => c.id !== 'all')

// 当前活动的编辑 tab
const activeTab = ref<'basic' | 'template' | 'variables'>('basic')

// 更新表单数据
watch(
  () => props.prompt,
  (newVal) => {
    formData.value = { ...newVal }
  },
  { deep: true }
)

// 保存
const handleSave = () => {
  // 更新时间戳
  formData.value.updatedAt = new Date().toISOString()
  emit('save', formData.value)
}

// 关闭
const handleClose = () => {
  emit('close')
}

// 更新变量
const handleVariablesUpdate = (variables: PromptVariable[]) => {
  formData.value.availableVariables = variables
}

// 阻止点击冒泡
const stopPropagation = (e: Event) => {
  e.stopPropagation()
}

// 格式化变量名（用于显示双花括号）
const formatVarName = (name: string): string => {
  return `{{${name}}}`
}

// 变量提示文本
const varHintText = '（使用 {{变量名}} 插入变量）'
</script>

<template>
  <div class="dialog-overlay" @click="handleClose">
    <div class="dialog-container" @click="stopPropagation">
      <!-- 头部 -->
      <header class="dialog-header">
        <h2 class="dialog-title">编辑提示词</h2>
        <button class="close-btn" @click="handleClose">
          <i class="fas fa-times"></i>
        </button>
      </header>

      <!-- 标签页 -->
      <div class="dialog-tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'basic' }]"
          @click="activeTab = 'basic'"
        >
          基本信息
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'template' }]"
          @click="activeTab = 'template'"
        >
          提示词模板
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'variables' }]"
          @click="activeTab = 'variables'"
        >
          变量定义
        </button>
      </div>

      <!-- 内容区 -->
      <div class="dialog-content">
        <!-- 基本信息 -->
        <div v-show="activeTab === 'basic'" class="tab-panel">
          <div class="form-group">
            <label class="form-label">名称</label>
            <input
              v-model="formData.name"
              type="text"
              class="form-input"
              placeholder="提示词名称"
              :disabled="!canEditField('name')"
            />
          </div>

          <div class="form-group">
            <label class="form-label">描述</label>
            <textarea
              v-model="formData.description"
              class="form-textarea"
              rows="2"
              placeholder="提示词描述（可选）"
              :disabled="!canEditField('description')"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">分类</label>
              <select
                v-model="formData.category"
                class="form-select"
                :disabled="!canEditField('category')"
              >
                <option v-for="cat in categoryOptions" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <div class="form-group flex-1">
              <label class="form-label">场景标识</label>
              <input
                v-model="formData.scene"
                type="text"
                class="form-input"
                placeholder="如: chat.reply"
                :disabled="!canEditField('scene')"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">优先级</label>
              <input
                v-model.number="formData.priority"
                type="number"
                min="0"
                class="form-input"
                :disabled="!canEditField('priority')"
              />
            </div>

            <div class="form-group flex-1">
              <label class="form-label">启用状态</label>
              <div class="toggle-wrapper">
                <button
                  :class="['toggle-btn', { active: formData.enabled }]"
                  @click="formData.enabled = !formData.enabled"
                  :disabled="!canEditField('enabled')"
                >
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                  <span class="toggle-label">{{ formData.enabled ? '启用' : '禁用' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 提示词模板 -->
        <div v-show="activeTab === 'template'" class="tab-panel">
          <div class="form-group">
            <label class="form-label">
              系统提示词
              <span class="label-hint">（可选，用于设置 AI 角色）</span>
            </label>
            <textarea
              v-model="formData.systemPrompt"
              class="form-textarea code"
              rows="4"
              placeholder="系统提示词内容..."
              :disabled="!canEditField('systemPrompt')"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">
              用户提示词模板
              <span class="label-hint">{{ varHintText }}</span>
            </label>
            <textarea
              v-model="formData.template"
              class="form-textarea code"
              rows="12"
              placeholder="提示词模板内容..."
              :disabled="!canEditField('template')"
            ></textarea>
          </div>

          <!-- 可用变量提示 -->
          <div v-if="formData.availableVariables.length > 0" class="variables-hint">
            <p class="hint-title">可用变量：</p>
            <div class="hint-tags">
              <span
                v-for="v in formData.availableVariables"
                :key="v.name"
                class="var-tag"
                :title="v.description"
              >
                {{ formatVarName(v.name) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 变量定义 -->
        <div v-show="activeTab === 'variables'" class="tab-panel">
          <VariableEditor
            :variables="formData.availableVariables"
            :disabled="!canEditField('availableVariables')"
            @update="handleVariablesUpdate"
          />
        </div>
      </div>

      <!-- 底部按钮 -->
      <footer class="dialog-footer">
        <div class="footer-info">
          <span class="source-label">来源: {{ PromptService.getSourceLabel(prompt) }}</span>
        </div>
        <div class="footer-actions">
          <button class="btn btn-secondary" @click="handleClose">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.dialog-container {
  @apply flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl;
  background: var(--color-surface);
  margin: 16px;
}

/* 头部 */
.dialog-header {
  @apply flex items-center justify-between px-5 py-4;
  border-bottom: 1px solid var(--color-border);
}

.dialog-title {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.close-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-full;
  @apply transition-colors;
  color: var(--color-text-secondary);
}

.close-btn:hover {
  background: var(--color-surface-variant);
}

/* 标签页 */
.dialog-tabs {
  @apply flex gap-1 px-5 py-2;
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  @apply rounded-lg px-4 py-2 text-sm font-medium;
  @apply transition-colors;
  color: var(--color-text-secondary);
}

.tab-btn.active {
  background: var(--color-primary);
  color: white;
}

.tab-btn:not(.active):hover {
  background: var(--color-surface-variant);
}

/* 内容区 */
.dialog-content {
  @apply flex-1 overflow-y-auto p-5;
}

.tab-panel {
  @apply space-y-4;
}

/* 表单 */
.form-group {
  @apply flex flex-col gap-1.5;
}

.form-row {
  @apply flex gap-4;
}

.form-label {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.label-hint {
  @apply font-normal;
  color: var(--color-text-secondary);
}

.form-input,
.form-textarea,
.form-select {
  @apply rounded-lg border px-3 py-2;
  @apply transition-colors;
  background: var(--color-background);
  border-color: var(--color-border);
  color: var(--color-text);
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  @apply outline-none;
  border-color: var(--color-primary);
}

.form-input:disabled,
.form-textarea:disabled,
.form-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-textarea {
  @apply resize-none;
}

.form-textarea.code {
  @apply font-mono text-sm;
}

/* Toggle */
.toggle-wrapper {
  @apply pt-1;
}

.toggle-btn {
  @apply flex items-center gap-2;
}

.toggle-track {
  @apply relative h-5 w-10 rounded-full;
  @apply transition-colors;
  background: var(--color-border);
}

.toggle-btn.active .toggle-track {
  background: var(--color-primary);
}

.toggle-thumb {
  @apply absolute left-0.5 top-0.5 h-4 w-4 rounded-full;
  @apply transition-transform;
  background: white;
}

.toggle-btn.active .toggle-thumb {
  transform: translateX(20px);
}

.toggle-label {
  @apply text-sm;
  color: var(--color-text);
}

/* 变量提示 */
.variables-hint {
  @apply rounded-lg p-3;
  background: var(--color-surface-variant);
}

.hint-title {
  @apply mb-2 text-sm font-medium;
  color: var(--color-text);
}

.hint-tags {
  @apply flex flex-wrap gap-2;
}

.var-tag {
  @apply cursor-help rounded px-2 py-1 font-mono text-xs;
  background: var(--color-background);
  color: var(--color-primary);
}

/* 底部 */
.dialog-footer {
  @apply flex items-center justify-between px-5 py-4;
  border-top: 1px solid var(--color-border);
}

.footer-info {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.footer-actions {
  @apply flex gap-2;
}

.btn {
  @apply rounded-lg px-4 py-2 text-sm font-medium;
  @apply transition-colors;
}

.btn-secondary {
  background: var(--color-surface-variant);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-border);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}
</style>
