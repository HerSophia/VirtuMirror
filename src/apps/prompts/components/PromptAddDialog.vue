<script setup lang="ts">
/**
 * 提示词新建对话框
 * @description 用于创建新提示词的对话框组件
 */
import { ref } from 'vue';
import { PROMPT_CATEGORIES } from '@/types/prompts';
import type { PromptTemplate, PromptVariable, PromptCategory } from '@/types/prompts';
import VariableEditor from './VariableEditor.vue';

const emit = defineEmits<{
  save: [prompt: Omit<PromptTemplate, 'id' | 'isBuiltin' | 'source' | 'createdAt' | 'updatedAt'>];
  close: [];
}>();

// 表单数据
const formData = ref({
  name: '',
  description: '',
  category: 'chat' as PromptCategory,
  scene: '',
  template: '',
  systemPrompt: '',
  availableVariables: [] as PromptVariable[],
  enabled: true,
  priority: 0,
  version: '1.0.0',
});

// 分类选项
const categoryOptions = PROMPT_CATEGORIES.filter(c => c.id !== 'all');

// 当前活动的编辑 tab
const activeTab = ref<'basic' | 'template' | 'variables'>('basic');

// 验证表单
const validate = (): boolean => {
  if (!formData.value.name.trim()) {
    alert('请输入提示词名称');
    return false;
  }
  if (!formData.value.scene.trim()) {
    alert('请输入场景标识');
    return false;
  }
  if (!formData.value.template.trim()) {
    alert('请输入提示词模板');
    return false;
  }
  return true;
};

// 保存
const handleSave = () => {
  if (!validate()) return;
  
  emit('save', {
    name: formData.value.name,
    description: formData.value.description || undefined,
    category: formData.value.category,
    scene: formData.value.scene,
    template: formData.value.template,
    systemPrompt: formData.value.systemPrompt || undefined,
    availableVariables: formData.value.availableVariables,
    enabled: formData.value.enabled,
    priority: formData.value.priority,
    version: formData.value.version,
  });
};

// 关闭
const handleClose = () => {
  emit('close');
};

// 更新变量
const handleVariablesUpdate = (variables: PromptVariable[]) => {
  formData.value.availableVariables = variables;
};

// 阻止点击冒泡
const stopPropagation = (e: Event) => {
  e.stopPropagation();
};

// 格式化变量名（用于显示双花括号）
const formatVarName = (name: string): string => {
  return `{{${name}}}`;
};

// 变量提示文本
const varHintText = '（使用 {{变量名}} 插入变量）';

// 快速模板
const quickTemplates = [
  {
    name: '聊天回复',
    category: 'chat',
    scene: 'chat.custom_reply',
    template: `请以 {{characterName}} 的身份回复消息：

【用户消息】
{{userMessage}}

请生成自然的回复，只输出回复内容。`,
    variables: [
      { name: 'characterName', description: '角色名称', type: 'string', required: true },
      { name: 'userMessage', description: '用户消息', type: 'string', required: true },
    ],
  },
  {
    name: '内容生成',
    category: 'system',
    scene: 'system.custom_generate',
    template: `请根据以下要求生成内容：

【主题】{{topic}}
【要求】{{requirements}}
【字数】{{wordCount}}

请生成内容。`,
    variables: [
      { name: 'topic', description: '主题', type: 'string', required: true },
      { name: 'requirements', description: '具体要求', type: 'string', required: false },
      { name: 'wordCount', description: '字数要求', type: 'string', required: false, defaultValue: '适中' },
    ],
  },
];

// 应用快速模板
const applyQuickTemplate = (template: typeof quickTemplates[0]) => {
  formData.value.name = template.name;
  formData.value.category = template.category as PromptCategory;
  formData.value.scene = template.scene;
  formData.value.template = template.template;
  formData.value.availableVariables = template.variables as PromptVariable[];
  activeTab.value = 'template';
};
</script>

<template>
  <div class="dialog-overlay" @click="handleClose">
    <div class="dialog-container" @click="stopPropagation">
      <!-- 头部 -->
      <header class="dialog-header">
        <h2 class="dialog-title">新建提示词</h2>
        <button class="close-btn" @click="handleClose">
          <i class="fas fa-times"></i>
        </button>
      </header>
      
      <!-- 快速模板 -->
      <div class="quick-templates">
        <span class="quick-label">快速开始：</span>
        <button 
          v-for="tpl in quickTemplates"
          :key="tpl.scene"
          class="quick-btn"
          @click="applyQuickTemplate(tpl)"
        >
          {{ tpl.name }}
        </button>
      </div>
      
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
            <label class="form-label">名称 *</label>
            <input
              v-model="formData.name"
              type="text"
              class="form-input"
              placeholder="提示词名称"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">描述</label>
            <textarea
              v-model="formData.description"
              class="form-textarea"
              rows="2"
              placeholder="提示词描述（可选）"
            ></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">分类 *</label>
              <select v-model="formData.category" class="form-select">
                <option v-for="cat in categoryOptions" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
            
            <div class="form-group flex-1">
              <label class="form-label">场景标识 *</label>
              <input
                v-model="formData.scene"
                type="text"
                class="form-input"
                placeholder="如: chat.custom_reply"
              />
              <p class="form-hint">建议格式：分类.功能名</p>
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
              />
              <p class="form-hint">数字越小优先级越高</p>
            </div>
            
            <div class="form-group flex-1">
              <label class="form-label">启用状态</label>
              <div class="toggle-wrapper">
                <button
                  :class="['toggle-btn', { active: formData.enabled }]"
                  @click="formData.enabled = !formData.enabled"
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
            ></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">
              用户提示词模板 *
              <span class="label-hint">{{ varHintText }}</span>
            </label>
            <textarea
              v-model="formData.template"
              class="form-textarea code"
              rows="12"
              placeholder="提示词模板内容..."
            ></textarea>
          </div>
          
          <!-- 可用变量提示 -->
          <div v-if="formData.availableVariables.length > 0" class="variables-hint">
            <p class="hint-title">已定义的变量：</p>
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
            @update="handleVariablesUpdate"
          />
        </div>
      </div>
      
      <!-- 底部按钮 -->
      <footer class="dialog-footer">
        <div class="footer-info">
          <span class="source-label">类型: 自定义提示词</span>
        </div>
        <div class="footer-actions">
          <button class="btn btn-secondary" @click="handleClose">取消</button>
          <button class="btn btn-primary" @click="handleSave">创建</button>
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
  @apply w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden;
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
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  @apply transition-colors;
  color: var(--color-text-secondary);
}

.close-btn:hover {
  background: var(--color-surface-variant);
}

/* 快速模板 */
.quick-templates {
  @apply flex items-center gap-2 px-5 py-2 overflow-x-auto;
  background: var(--color-surface-variant);
}

.quick-label {
  @apply text-sm whitespace-nowrap;
  color: var(--color-text-secondary);
}

.quick-btn {
  @apply px-3 py-1 rounded-full text-sm whitespace-nowrap;
  @apply transition-colors;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.quick-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* 标签页 */
.dialog-tabs {
  @apply flex gap-1 px-5 py-2;
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  @apply px-4 py-2 rounded-lg text-sm font-medium;
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

.form-hint {
  @apply text-xs mt-0.5;
  color: var(--color-text-secondary);
}

.form-input,
.form-textarea,
.form-select {
  @apply px-3 py-2 rounded-lg border;
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
  @apply relative w-10 h-5 rounded-full;
  @apply transition-colors;
  background: var(--color-border);
}

.toggle-btn.active .toggle-track {
  background: var(--color-primary);
}

.toggle-thumb {
  @apply absolute top-0.5 left-0.5 w-4 h-4 rounded-full;
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
  @apply p-3 rounded-lg;
  background: var(--color-surface-variant);
}

.hint-title {
  @apply text-sm font-medium mb-2;
  color: var(--color-text);
}

.hint-tags {
  @apply flex flex-wrap gap-2;
}

.var-tag {
  @apply px-2 py-1 rounded text-xs font-mono cursor-help;
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
  @apply px-4 py-2 rounded-lg text-sm font-medium;
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