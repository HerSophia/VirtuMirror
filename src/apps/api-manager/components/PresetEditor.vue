<script setup lang="ts">
/**
 * 预设编辑器组件
 * 用于创建和编辑API预设
 */
import { computed, ref, watch, nextTick } from 'vue'
import type { ApiConfigFormData, TestResult } from '../types'
import { API_SOURCE_OPTIONS } from '../types'
import { getModelListService, type ModelInfo } from '@/services/modelListService'

interface Props {
  formData: ApiConfigFormData
  testResult: TestResult
  isEditing: boolean
  isSaving: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:formData': [data: ApiConfigFormData]
  save: []
  cancel: []
  test: []
}>()

// 直接使用模型列表服务（单例）
const modelListService = getModelListService()

// 本地状态
const showModelDropdown = ref(false)
const modelInputFocused = ref(false)
const fetchDebugInfo = ref<string | null>(null)
const localModelList = ref<ModelInfo[]>([])
const isLoadingModels = ref(false)
const modelListError = ref<string | null>(null)

// 测试连接调试信息
const testDebugInfo = ref<string | null>(null)

// 可用模型列表
const availableModels = computed(() => localModelList.value.map(m => m.id))

// 是否显示下拉选择器（有多个模型时）
const hasMultipleModels = computed(() => availableModels.value.length > 1)

// 过滤后的模型列表（根据输入过滤）
// 当输入为空或下拉框刚打开时，显示全部模型
// 当正在输入时，进行模糊匹配
const filteredModels = computed(() => {
  // 如果没有可用模型，返回空
  if (availableModels.value.length === 0) return []
  
  // 如果输入为空，返回全部
  if (!props.formData.model || props.formData.model.trim() === '') {
    return availableModels.value
  }
  
  const search = props.formData.model.toLowerCase().trim()
  
  // 如果输入的值正好是某个模型（完全匹配），显示全部列表
  // 这样用户选择后仍然可以看到其他选项
  const exactMatch = availableModels.value.find(m => m.toLowerCase() === search)
  if (exactMatch) {
    return availableModels.value
  }
  
  // 否则进行模糊匹配
  return availableModels.value.filter(m => m.toLowerCase().includes(search))
})

/**
 * 获取模型列表
 */
async function handleFetchModels() {
  const startTime = Date.now()
  fetchDebugInfo.value = null
  
  console.group('🔍 [ModelList] 开始获取模型列表')
  console.log('API URL:', props.formData.apiUrl)
  console.log('API Source:', props.formData.source)
  console.log('Has API Key:', !!props.formData.apiKey)
  
  isLoadingModels.value = true
  modelListError.value = null
  
  try {
    // 直接使用模型列表服务
    const result = await modelListService.getModels(
      {
        apiUrl: props.formData.apiUrl,
        apiKey: props.formData.apiKey,
        source: props.formData.source,
      },
      { forceRefresh: true }
    )
    
    const elapsed = Date.now() - startTime
    
    if (result.success) {
      localModelList.value = result.models
      const models = result.models.map(m => m.id)
      
      console.log(`✅ 获取成功，耗时: ${elapsed}ms`)
      console.log(`📋 模型数量: ${models.length}`)
      console.log('📋 模型列表:', models)
      
      // 设置调试信息
      if (models.length > 0) {
        fetchDebugInfo.value = `✅ 获取到 ${models.length} 个模型 (${elapsed}ms)`
        showModelDropdown.value = true
      } else {
        fetchDebugInfo.value = `⚠️ API 返回空列表 (${elapsed}ms)，该服务可能不支持模型列表查询，请手动输入模型名称`
        console.warn('该 API 可能不支持 /models 端点，常见于第三方代理服务')
      }
    } else {
      modelListError.value = result.error || '获取失败'
      fetchDebugInfo.value = `❌ 获取失败: ${result.error}`
      console.error('❌ 获取失败:', result.error)
    }
  } catch (error) {
    const elapsed = Date.now() - startTime
    const message = error instanceof Error ? error.message : '未知错误'
    modelListError.value = message
    console.error('❌ 获取失败:', error)
    fetchDebugInfo.value = `❌ 获取失败: ${message}`
  } finally {
    isLoadingModels.value = false
    console.groupEnd()
  }
}

/**
 * 选择模型
 */
function selectModel(modelId: string) {
  updateField('model', modelId)
  showModelDropdown.value = false
}

/**
 * 处理输入框获得焦点
 */
function handleModelInputFocus() {
  modelInputFocused.value = true
  if (hasMultipleModels.value) {
    showModelDropdown.value = true
  }
}

/**
 * 处理输入框失去焦点
 */
function handleModelInputBlur() {
  modelInputFocused.value = false
  // 延迟关闭，允许点击下拉选项
  setTimeout(() => {
    if (!modelInputFocused.value) {
      showModelDropdown.value = false
    }
  }, 200)
}

/**
 * 处理测试连接（带调试信息）
 */
async function handleTestConnection() {
  testDebugInfo.value = null
  const startTime = Date.now()
  
  console.group('🔌 [TestConnection] 开始测试连接')
  console.log('API URL:', props.formData.apiUrl)
  console.log('API Source:', props.formData.source)
  console.log('Model:', props.formData.model)
  console.log('Has API Key:', !!props.formData.apiKey)
  
  // 构建请求信息用于调试
  const baseUrl = props.formData.apiUrl.replace(/\/$/, '')
  let endpoint = ''
  let method = 'POST'
  
  if (props.formData.source === 'anthropic') {
    endpoint = `${baseUrl}/messages`
    console.log('Using Anthropic API format')
  } else if (props.formData.source === 'google') {
    endpoint = `${baseUrl}/models/${props.formData.model}:generateContent?key=***`
    console.log('Using Google Gemini API format')
  } else {
    endpoint = `${baseUrl}/chat/completions`
    console.log('Using OpenAI Compatible API format')
  }
  
  console.log('Endpoint:', endpoint)
  console.log('Method:', method)
  
  // 触发父组件的测试
  emit('test')
  
  // 等待测试完成（监听 testResult 变化）
  const checkResult = () => {
    return new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (props.testResult.status !== 'testing') {
          clearInterval(check)
          resolve()
        }
      }, 100)
      // 超时保护
      setTimeout(() => {
        clearInterval(check)
        resolve()
      }, 30000)
    })
  }
  
  await checkResult()
  
  const elapsed = Date.now() - startTime
  
  if (props.testResult.status === 'success') {
    console.log(`✅ 测试成功，耗时: ${elapsed}ms`)
    console.log('响应信息:', props.testResult.message)
    testDebugInfo.value = `✅ 测试成功 (${props.testResult.responseTime || elapsed}ms)`
  } else if (props.testResult.status === 'error') {
    console.error(`❌ 测试失败，耗时: ${elapsed}ms`)
    console.error('错误信息:', props.testResult.message)
    testDebugInfo.value = `❌ 测试失败: ${props.testResult.message}`
  }
  
  console.groupEnd()
}

/**
 * 更新表单字段
 */
function updateField<K extends keyof ApiConfigFormData>(key: K, value: ApiConfigFormData[K]) {
  emit('update:formData', {
    ...props.formData,
    [key]: value,
  })
}

/**
 * 字段代理工厂
 */
function useField<K extends keyof ApiConfigFormData>(key: K) {
  return computed({
    get: () => props.formData[key],
    set: (value: ApiConfigFormData[K]) => updateField(key, value)
  })
}

const name = useField('name')
const description = useField('description')
const source = useField('source')
const apiUrl = useField('apiUrl')
const apiKey = useField('apiKey')
const model = useField('model')
const maxTokens = useField('maxTokens')
const temperature = useField('temperature')
const topP = useField('topP')
const frequencyPenalty = useField('frequencyPenalty')

/**
 * 测试状态样式
 */
const testStatusClass = computed(() => {
  switch (props.testResult.status) {
    case 'success': return 'status-success'
    case 'error': return 'status-error'
    case 'testing': return 'status-testing'
    default: return ''
  }
})

/**
 * 表单是否有效
 */
const isFormValid = computed(() => {
  return props.formData.name.trim() !== '' &&
    props.formData.apiUrl.trim() !== '' &&
    props.formData.model.trim() !== ''
})
</script>

<template>
  <div class="preset-editor">
    <!-- 编辑器头部 -->
    <div class="editor-header">
      <h3>{{ isEditing ? '编辑配置' : '新建配置' }}</h3>
      <button class="close-btn" @click="emit('cancel')">
        ✕
      </button>
    </div>
    
    <!-- 表单内容 -->
    <div class="editor-content">
      <!-- 基本信息 -->
      <div class="form-section">
        <h4 class="section-title">基本信息</h4>
        
        <div class="form-group">
          <label class="form-label">配置名称 *</label>
          <input
            type="text"
            class="form-input"
            placeholder="例如：OpenAI GPT-4"
            v-model="name"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">描述</label>
          <input
            type="text"
            class="form-input"
            placeholder="可选的配置描述"
            v-model="description"
          />
        </div>
      </div>
      
      <!-- API 配置 -->
      <div class="form-section">
        <h4 class="section-title">API 配置</h4>
        
        <div class="form-group">
          <label class="form-label">API 类型</label>
          <select
            class="form-select"
     v-model="source"
          >
            <option
              v-for="option in API_SOURCE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">API 地址 *</label>
          <input
            type="url"
            class="form-input"
            placeholder="https://api.openai.com/v1"
            v-model="apiUrl"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input
            type="password"
            class="form-input"
            placeholder="sk-..."
            v-model="apiKey"
          />
          <p class="form-hint">密钥将安全存储，不会导出</p>
        </div>
        
        <div class="form-group relative">
          <div class="flex justify-between items-center mb-1">
            <label class="form-label mb-0">模型名称 *</label>
            <button 
              class="fetch-models-btn"
              @click="handleFetchModels"
              :disabled="isLoadingModels || (!formData.apiKey && formData.source !== 'anthropic')"
            >
              <span v-if="isLoadingModels" class="loading-spinner">⟳</span>
              {{ isLoadingModels ? '获取中...' : '获取列表' }}
            </button>
          </div>
          
          <!-- 调试信息 -->
          <div v-if="fetchDebugInfo" class="debug-info" :class="{ 'debug-error': fetchDebugInfo.startsWith('❌') }">
            {{ fetchDebugInfo }}
          </div>
          
          <!-- 错误信息 -->
          <div v-if="modelListError" class="model-error">
            ⚠️ {{ modelListError }}
          </div>
          
          <!-- 模型输入/选择 ComboBox -->
          <div class="model-combobox">
            <div class="combobox-input-wrapper">
              <input
                type="text"
                class="form-input"
                :class="{ 'has-dropdown': hasMultipleModels }"
                placeholder="gpt-4, claude-3-sonnet-20240229, etc."
                v-model="model"
                @focus="handleModelInputFocus"
                @blur="handleModelInputBlur"
              />
              <!-- 下拉箭头（有模型列表时显示） -->
              <button
                v-if="hasMultipleModels"
                class="dropdown-toggle"
                type="button"
                @mousedown.prevent
                @click="showModelDropdown = !showModelDropdown"
              >
                <span :class="{ 'rotate-180': showModelDropdown }">▼</span>
              </button>
            </div>
            
            <!-- 下拉列表 -->
            <div
              v-if="showModelDropdown && hasMultipleModels"
              class="model-dropdown"
            >
              <div class="dropdown-header">
                共 {{ availableModels.length }} 个模型
              </div>
              <div class="dropdown-list">
                <button
                  v-for="modelId in filteredModels"
                  :key="modelId"
                  class="dropdown-item"
                  :class="{ 'is-selected': modelId === formData.model }"
                  type="button"
                  @mousedown.prevent
                  @click="selectModel(modelId)"
                >
                  {{ modelId }}
                </button>
                <div v-if="filteredModels.length === 0" class="dropdown-empty">
                  没有匹配的模型
                </div>
              </div>
            </div>
          </div>
          
          <p class="form-hint" v-if="hasMultipleModels">
            💡 可直接输入或从列表中选择模型
          </p>
        </div>
      </div>
      
      <!-- 生成参数 -->
      <div class="form-section">
        <h4 class="section-title">生成参数</h4>
        
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">最大 Tokens</label>
            <input
              type="number"
              class="form-input"
              min="1"
              max="32000"
              v-model="maxTokens"
            />
          </div>
          
          <div class="form-group flex-1">
            <div class="flex justify-between mb-1">
              <label class="form-label">温度 (Temperature)</label>
              <span class="text-xs text-secondary">{{ formData.temperature }}</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="range"
                class="flex-1 range-input"
                min="0"
                max="2"
                step="0.1"
                v-model.number="temperature"
              />
              <input
                type="number"
                class="form-input w-16 px-1 text-center"
                min="0"
                max="2"
                step="0.1"
                v-model.number="temperature"
              />
            </div>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group flex-1">
            <div class="flex justify-between mb-1">
              <label class="form-label">Top P</label>
              <span class="text-xs text-secondary">{{ formData.topP }}</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="range"
                class="flex-1 range-input"
                min="0"
                max="1"
                step="0.05"
                v-model.number="topP"
              />
              <input
                type="number"
                class="form-input w-16 px-1 text-center"
                min="0"
                max="1"
                step="0.1"
                v-model.number="topP"
              />
            </div>
          </div>
          
          <div class="form-group flex-1">
            <div class="flex justify-between mb-1">
              <label class="form-label">频率惩罚</label>
              <span class="text-xs text-secondary">{{ formData.frequencyPenalty }}</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="range"
                class="flex-1 range-input"
                min="-2"
                max="2"
                step="0.1"
                v-model.number="frequencyPenalty"
              />
              <input
                type="number"
                class="form-input w-16 px-1 text-center"
                min="-2"
                max="2"
                step="0.1"
                v-model.number="frequencyPenalty"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- 测试区域 -->
      <div class="form-section">
        <h4 class="section-title">连接测试</h4>
        
        <!-- 测试调试信息 -->
        <div v-if="testDebugInfo" class="debug-info" :class="{ 'debug-error': testDebugInfo.startsWith('❌') }">
          {{ testDebugInfo }}
        </div>
        
        <button
          class="test-btn"
          :class="testStatusClass"
          :disabled="!isFormValid || testResult.status === 'testing'"
          @click="handleTestConnection"
        >
          <span v-if="testResult.status === 'testing'">测试中...</span>
          <span v-else-if="testResult.status === 'success'">✓ 测试成功</span>
          <span v-else-if="testResult.status === 'error'">✗ 测试失败</span>
          <span v-else>测试连接</span>
        </button>
        
        <p v-if="testResult.message" class="test-message" :class="testStatusClass">
          {{ testResult.message }}
        </p>
      </div>
    </div>
    
    <!-- 编辑器底部 -->
    <div class="editor-footer">
      <button class="btn-secondary" @click="emit('cancel')">
        取消
      </button>
      <button
        class="btn-primary"
        :disabled="!isFormValid || isSaving"
        @click="emit('save')"
      >
        {{ isSaving ? '保存中...' : '保存' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.preset-editor {
  @apply h-full flex flex-col;
  background: var(--color-background);
}

.editor-header {
  @apply flex items-center justify-between px-4 py-3 border-b;
  border-color: var(--color-border);
}

.editor-header h3 {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.close-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full text-lg;
  color: var(--color-text-secondary);
}

.close-btn:hover {
  background: var(--color-surface);
}

.editor-content {
  @apply flex-1 overflow-y-auto p-4;
}

.form-section {
  @apply mb-6;
}

.section-title {
  @apply text-sm font-semibold mb-3;
  color: var(--color-text-secondary);
}

.form-group {
  @apply mb-4;
}

.form-row {
  @apply flex gap-4;
}

.form-label {
  @apply block text-sm font-medium mb-1;
  color: var(--color-text);
}

.form-input,
.form-select {
  @apply w-full px-3 py-2 rounded-lg text-sm;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input::placeholder {
  color: var(--color-text-tertiary);
}

.form-hint {
  @apply text-xs mt-1;
  color: var(--color-text-tertiary);
}

.test-btn {
  @apply w-full py-2 rounded-lg font-medium transition-all;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.test-btn:not(:disabled):hover {
  background: var(--color-surface-variant);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-btn.status-success {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.test-btn.status-error {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.test-btn.status-testing {
  opacity: 0.7;
}

.test-message {
  @apply text-sm mt-2 p-2 rounded;
  background: var(--color-surface);
}

.test-message.status-success {
  color: var(--color-success);
}

.test-message.status-error {
  color: var(--color-error);
}

.text-secondary {
  color: var(--color-text-secondary);
}

.text-primary {
  color: var(--color-primary);
}

.range-input {
  @apply h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer;
  background: var(--color-border);
}

.range-input::-webkit-slider-thumb {
  @apply w-4 h-4 rounded-full appearance-none cursor-pointer;
  background: var(--color-primary);
  border: 2px solid var(--color-surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.text-secondary {
  color: var(--color-text-secondary);
}

.text-primary {
  color: var(--color-primary);
}

.range-input {
  @apply h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer;
  background: var(--color-border);
}

.range-input::-webkit-slider-thumb {
  @apply w-4 h-4 rounded-full appearance-none cursor-pointer;
  background: var(--color-primary);
  border: 2px solid var(--color-surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.editor-footer {
  @apply flex gap-3 p-4 border-t;
  border-color: var(--color-border);
}

.btn-secondary,
.btn-primary {
  @apply flex-1 py-2.5 rounded-lg font-medium transition-all;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-surface-variant);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== 模型列表获取按钮 ==================== */
.fetch-models-btn {
  @apply text-xs px-2 py-1 rounded transition-all;
  color: var(--color-primary);
  background: transparent;
}

.fetch-models-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
}

.fetch-models-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ==================== 调试信息 ==================== */
.debug-info {
  @apply text-xs px-2 py-1 mb-2 rounded;
  background: var(--color-success);
  color: white;
  opacity: 0.9;
}

.debug-info.debug-error {
  background: var(--color-error);
}

.model-error {
  @apply text-xs px-2 py-1 mb-2 rounded;
  background: rgba(255, 193, 7, 0.2);
  color: #f57c00;
}

/* ==================== 模型 ComboBox ==================== */
.model-combobox {
  position: relative;
}

.combobox-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.combobox-input-wrapper .form-input {
  padding-right: 2rem;
}

.combobox-input-wrapper .form-input.has-dropdown {
  border-color: var(--color-primary);
}

.dropdown-toggle {
  position: absolute;
  right: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 0.6rem;
  transition: transform 0.2s;
}

.dropdown-toggle:hover {
  color: var(--color-primary);
}

.dropdown-toggle span {
  transition: transform 0.2s;
}

.dropdown-toggle span.rotate-180 {
  transform: rotate(180deg);
}

/* ==================== 下拉列表 ==================== */
.model-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  margin-top: 0.25rem;
  border-radius: 0.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.dropdown-header {
  @apply px-3 py-2 text-xs;
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.dropdown-list {
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  @apply w-full px-3 py-2 text-left text-sm;
  color: var(--color-text);
  transition: background-color 0.15s;
}

.dropdown-item:hover {
  background: var(--color-surface-variant);
}

.dropdown-item.is-selected {
  background: var(--color-primary);
  color: white;
}

.dropdown-empty {
  @apply px-3 py-4 text-center text-sm;
  color: var(--color-text-tertiary);
}
</style>
