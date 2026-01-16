<script setup lang="ts">
/**
 * 提示词详情页面
 * @description 查看提示词详细信息并支持测试功能
 * 
 * 【阶段四迁移】使用 AIStore 替代直接调用 AIGenerateService
 * 优势：
 * - 响应式状态管理（isGenerating 自动更新）
 * - 统一的错误处理
 * - 支持请求取消
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { PromptService } from '@/services/promptService';
import { useAIStore } from '@/stores/aiStore';
import { RequestPriority } from '@/services/ai';
import type { PromptTemplate, PromptVariable, RenderedPrompt } from '@/types/prompts';

const router = useRouter();
const route = useRoute();
const aiStore = useAIStore();

// 状态
const prompt = ref<PromptTemplate | null>(null);
const isLoading = ref(true);
const activeTab = ref<'info' | 'template' | 'test'>('info');

// 测试相关
const testVariables = ref<Record<string, string>>({});
const testResult = ref<RenderedPrompt | null>(null);
const generateResult = ref<string>('');

// 使用 AIStore 的响应式状态
const isGenerating = computed(() => aiStore.isGenerating);

// 获取提示词 ID
const promptId = computed(() => route.params.id as string);

// 获取编辑权限
const permission = computed(() => {
  if (!prompt.value) return null;
  return PromptService.isPromptEditable(prompt.value);
});

// 加载提示词
const loadPrompt = () => {
  isLoading.value = true;
  try {
    prompt.value = PromptService.getPromptById(promptId.value);
    if (prompt.value) {
      // 初始化测试变量
      initTestVariables();
    }
  } finally {
    isLoading.value = false;
  }
};

// 初始化测试变量
const initTestVariables = () => {
  if (!prompt.value) return;
  
  testVariables.value = {};
  for (const v of prompt.value.availableVariables) {
    testVariables.value[v.name] = v.example !== undefined 
      ? String(v.example)
      : v.defaultValue !== undefined 
        ? String(v.defaultValue) 
        : '';
  }
};

// 返回
const handleBack = () => {
  router.back();
};

// 渲染预览
const renderPreview = () => {
  if (!prompt.value) return;
  testResult.value = PromptService.renderPrompt(prompt.value, testVariables.value);
};

// 执行生成测试
const handleGenerate = async () => {
  if (!prompt.value) return;
  
  generateResult.value = '';
  
  try {
    const rendered = PromptService.renderPrompt(prompt.value, testVariables.value);
    const result = await aiStore.generate(
      {
        prompt: rendered.userPrompt,
        system: rendered.systemPrompt,
        source: 'PromptDetail.test',
      },
      RequestPriority.HIGH // 用户主动操作，高优先级
    );
    
    generateResult.value = result.text;
  } catch (error) {
    // 检查是否是 AIError
    if (error && typeof error === 'object' && 'code' in error) {
      generateResult.value = `[${(error as any).code}] ${(error as any).message}`;
    } else {
      generateResult.value = `[错误] ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }
};

// 取消生成
const handleCancel = () => {
  aiStore.abort();
  generateResult.value = '[已取消]';
};

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  } catch {
    alert('复制失败');
  }
};

// 分类图标
const categoryIcon = computed(() => {
  if (!prompt.value) return 'fas fa-file-alt';
  const icons: Record<string, string> = {
    chat: 'fas fa-comments',
    email: 'fas fa-envelope',
    browser: 'fas fa-globe',
    live: 'fas fa-video',
    system: 'fas fa-cog',
  };
  return icons[prompt.value.category] || 'fas fa-file-alt';
});

// 格式化变量名（用于显示双花括号）
const formatVarName = (name: string): string => {
  return `{{${name}}}`;
};

// 初始化
onMounted(() => {
  loadPrompt();
});
</script>

<template>
  <div class="prompt-detail">
    <!-- 头部 -->
    <header class="detail-header">
      <button class="back-btn" @click="handleBack">
        <i class="fas fa-chevron-left"></i>
      </button>
      <div class="header-info">
        <h1 class="header-title">{{ prompt?.name || '提示词详情' }}</h1>
        <p v-if="prompt" class="header-subtitle">{{ prompt.scene }}</p>
      </div>
    </header>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i>
      <span>加载中...</span>
    </div>
    
    <!-- 未找到 -->
    <div v-else-if="!prompt" class="empty-state">
      <i class="fas fa-exclamation-circle empty-icon"></i>
      <p>未找到该提示词</p>
      <button class="btn btn-primary" @click="handleBack">返回</button>
    </div>
    
    <!-- 详情内容 -->
    <template v-else>
      <!-- 标签页 -->
      <div class="detail-tabs">
        <button 
          :class="['tab-btn', { active: activeTab === 'info' }]"
          @click="activeTab = 'info'"
        >
          <i class="fas fa-info-circle"></i>
          基本信息
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'template' }]"
          @click="activeTab = 'template'"
        >
          <i class="fas fa-code"></i>
          模板内容
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'test' }]"
          @click="activeTab = 'test'"
        >
          <i class="fas fa-flask"></i>
          测试
        </button>
      </div>
      
      <!-- 内容区 -->
      <div class="detail-content">
        <!-- 基本信息 -->
        <div v-show="activeTab === 'info'" class="tab-panel">
          <div class="info-card">
            <div class="info-icon">
              <i :class="categoryIcon"></i>
            </div>
            <div class="info-main">
              <h2 class="info-name">{{ prompt.name }}</h2>
              <p v-if="prompt.description" class="info-desc">{{ prompt.description }}</p>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">场景标识</span>
              <code class="info-value">{{ prompt.scene }}</code>
            </div>
            <div class="info-item">
              <span class="info-label">分类</span>
              <span class="info-value">{{ prompt.category }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">来源</span>
              <span class="info-value">{{ PromptService.getSourceLabel(prompt) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">状态</span>
              <span :class="['status-badge', prompt.enabled ? 'enabled' : 'disabled']">
                {{ prompt.enabled ? '已启用' : '已禁用' }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">优先级</span>
              <span class="info-value">{{ prompt.priority }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">版本</span>
              <span class="info-value">v{{ prompt.version }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">创建时间</span>
              <span class="info-value">{{ new Date(prompt.createdAt).toLocaleString() }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">更新时间</span>
              <span class="info-value">{{ new Date(prompt.updatedAt).toLocaleString() }}</span>
            </div>
          </div>
          
          <!-- 变量列表 -->
          <div v-if="prompt.availableVariables.length > 0" class="variables-section">
            <h3 class="section-title">可用变量 ({{ prompt.availableVariables.length }})</h3>
            <div class="variables-list">
              <div 
                v-for="v in prompt.availableVariables" 
                :key="v.name"
                class="variable-item"
              >
                <div class="var-header">
                  <code class="var-name">{{ formatVarName(v.name) }}</code>
                  <span :class="['var-type', `type-${v.type}`]">{{ v.type }}</span>
                  <span v-if="v.required" class="var-required">必填</span>
                </div>
                <p v-if="v.description" class="var-desc">{{ v.description }}</p>
                <p v-if="v.defaultValue !== undefined" class="var-default">
                  默认值: <code>{{ JSON.stringify(v.defaultValue) }}</code>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 模板内容 -->
        <div v-show="activeTab === 'template'" class="tab-panel">
          <!-- 系统提示词 -->
          <div v-if="prompt.systemPrompt" class="template-section">
            <div class="section-header">
              <h3 class="section-title">系统提示词</h3>
              <button class="copy-btn" @click="copyToClipboard(prompt.systemPrompt!)">
                <i class="fas fa-copy"></i>
                复制
              </button>
            </div>
            <pre class="template-content">{{ prompt.systemPrompt }}</pre>
          </div>
          
          <!-- 用户提示词 -->
          <div class="template-section">
            <div class="section-header">
              <h3 class="section-title">用户提示词模板</h3>
              <button class="copy-btn" @click="copyToClipboard(prompt.template)">
                <i class="fas fa-copy"></i>
                复制
              </button>
            </div>
            <pre class="template-content">{{ prompt.template }}</pre>
          </div>
        </div>
        
        <!-- 测试 -->
        <div v-show="activeTab === 'test'" class="tab-panel">
          <!-- 变量输入 -->
          <div class="test-section">
            <h3 class="section-title">填写变量</h3>
            <div class="variables-form">
              <div 
                v-for="v in prompt.availableVariables" 
                :key="v.name"
                class="form-group"
              >
                <label class="form-label">
                  {{ v.name }}
                  <span v-if="v.required" class="required-mark">*</span>
                  <span v-if="v.description" class="label-hint">{{ v.description }}</span>
                </label>
                <input
                  v-model="testVariables[v.name]"
                  type="text"
                  class="form-input"
                  :placeholder="v.defaultValue !== undefined ? `默认: ${v.defaultValue}` : '请输入...'"
                />
              </div>
            </div>
            
            <div class="test-actions">
              <button class="btn btn-secondary" @click="renderPreview">
                <i class="fas fa-eye"></i>
                预览渲染结果
              </button>
              <button 
                v-if="!isGenerating"
                class="btn btn-primary" 
                @click="handleGenerate"
              >
                <i class="fas fa-play"></i>
                执行生成
              </button>
              <button 
                v-else
                class="btn btn-danger" 
                @click="handleCancel"
              >
                <i class="fas fa-stop"></i>
                取消生成
              </button>
            </div>
          </div>
          
          <!-- 渲染预览 -->
          <div v-if="testResult" class="result-section">
            <h3 class="section-title">渲染结果</h3>
            <div v-if="testResult.systemPrompt" class="result-block">
              <h4 class="result-label">系统提示词：</h4>
              <pre class="result-content">{{ testResult.systemPrompt }}</pre>
            </div>
            <div class="result-block">
              <h4 class="result-label">用户提示词：</h4>
              <pre class="result-content">{{ testResult.userPrompt }}</pre>
            </div>
          </div>
          
          <!-- 生成结果 -->
          <div v-if="generateResult" class="result-section">
            <div class="section-header">
              <h3 class="section-title">生成结果</h3>
              <button class="copy-btn" @click="copyToClipboard(generateResult)">
                <i class="fas fa-copy"></i>
                复制
              </button>
            </div>
            <pre class="result-content generate-result">{{ generateResult }}</pre>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.prompt-detail {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

/* 头部 */
.detail-header {
  @apply flex items-center gap-3 px-4 py-3;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.back-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  @apply transition-colors;
  color: var(--color-text);
}

.back-btn:hover {
  background: var(--color-surface-variant);
}

.header-info {
  @apply flex-1 min-w-0;
}

.header-title {
  @apply text-lg font-semibold truncate;
  color: var(--color-text);
}

.header-subtitle {
  @apply text-sm truncate;
  color: var(--color-text-secondary);
}

/* 状态 */
.loading-state,
.empty-state {
  @apply flex flex-col items-center justify-center flex-1 gap-3;
  color: var(--color-text-secondary);
}

.empty-icon {
  @apply text-4xl opacity-50;
}

/* 标签页 */
.detail-tabs {
  @apply flex gap-1 px-4 py-2;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  @apply flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium;
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
.detail-content {
  @apply flex-1 overflow-y-auto p-4;
}

.tab-panel {
  @apply space-y-4;
}

/* 信息卡片 */
.info-card {
  @apply flex items-center gap-4 p-4 rounded-xl;
  background: var(--color-surface);
}

.info-icon {
  @apply w-14 h-14 flex items-center justify-center rounded-xl text-2xl;
  background: var(--color-surface-variant);
  color: var(--color-primary);
}

.info-main {
  @apply flex-1 min-w-0;
}

.info-name {
  @apply text-xl font-semibold;
  color: var(--color-text);
}

.info-desc {
  @apply text-sm mt-1;
  color: var(--color-text-secondary);
}

/* 信息网格 */
.info-grid {
  @apply grid grid-cols-2 gap-3;
}

.info-item {
  @apply p-3 rounded-lg;
  background: var(--color-surface);
}

.info-label {
  @apply block text-xs mb-1;
  color: var(--color-text-secondary);
}

.info-value {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.status-badge {
  @apply inline-block px-2 py-0.5 rounded text-xs font-medium;
}

.status-badge.enabled {
  @apply bg-green-100 text-green-700;
}

.status-badge.disabled {
  @apply bg-gray-100 text-gray-500;
}

/* 变量列表 */
.variables-section {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.section-title {
  @apply text-sm font-semibold mb-3;
  color: var(--color-text);
}

.section-header {
  @apply flex items-center justify-between mb-3;
}

.variables-list {
  @apply space-y-2;
}

.variable-item {
  @apply p-3 rounded-lg;
  background: var(--color-surface-variant);
}

.var-header {
  @apply flex items-center gap-2 flex-wrap;
}

.var-name {
  @apply px-2 py-0.5 rounded text-sm font-mono;
  background: var(--color-background);
  color: var(--color-primary);
}

.var-type {
  @apply px-2 py-0.5 rounded text-xs;
}

.type-string { @apply bg-blue-100 text-blue-700; }
.type-number { @apply bg-green-100 text-green-700; }
.type-boolean { @apply bg-purple-100 text-purple-700; }
.type-array { @apply bg-orange-100 text-orange-700; }
.type-object { @apply bg-pink-100 text-pink-700; }

.var-required {
  @apply px-2 py-0.5 rounded text-xs bg-red-100 text-red-700;
}

.var-desc {
  @apply text-sm mt-1;
  color: var(--color-text-secondary);
}

.var-default {
  @apply text-xs mt-1;
  color: var(--color-text-secondary);
}

.var-default code {
  @apply px-1 py-0.5 rounded;
  background: var(--color-background);
}

/* 模板内容 */
.template-section {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.copy-btn {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm;
  @apply transition-colors;
  color: var(--color-primary);
}

.copy-btn:hover {
  background: var(--color-surface-variant);
}

.template-content {
  @apply p-3 rounded-lg text-sm font-mono whitespace-pre-wrap;
  background: var(--color-surface-variant);
  color: var(--color-text);
  max-height: 400px;
  overflow-y: auto;
}

/* 测试 */
.test-section {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.variables-form {
  @apply space-y-3 mb-4;
}

.form-group {
  @apply flex flex-col gap-1;
}

.form-label {
  @apply text-sm font-medium;
  color: var(--color-text);
}

.required-mark {
  @apply text-red-500;
}

.label-hint {
  @apply font-normal text-xs ml-1;
  color: var(--color-text-secondary);
}

.form-input {
  @apply px-3 py-2 rounded-lg border;
  background: var(--color-background);
  border-color: var(--color-border);
  color: var(--color-text);
}

.form-input:focus {
  @apply outline-none;
  border-color: var(--color-primary);
}

.test-actions {
  @apply flex gap-2;
}

.btn {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium;
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

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger {
  background: var(--color-error, #ef4444);
  color: white;
}

.btn-danger:hover {
  opacity: 0.9;
}

/* 结果 */
.result-section {
  @apply p-4 rounded-xl;
  background: var(--color-surface);
}

.result-block {
  @apply mb-3;
}

.result-block:last-child {
  @apply mb-0;
}

.result-label {
  @apply text-xs font-medium mb-1;
  color: var(--color-text-secondary);
}

.result-content {
  @apply p-3 rounded-lg text-sm font-mono whitespace-pre-wrap;
  background: var(--color-surface-variant);
  color: var(--color-text);
  max-height: 300px;
  overflow-y: auto;
}

.generate-result {
  @apply bg-green-50;
  border: 1px solid var(--color-success);
}
</style>