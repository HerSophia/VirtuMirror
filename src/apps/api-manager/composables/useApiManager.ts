/**
 * API 管理器核心逻辑
 */

import { ref, computed, reactive } from 'vue'
import { getGlobalConfigService } from '@/services/globalConfigService'
import { getModelListService, type ModelInfo } from '@/services/modelListService'
import type { ApiPreset, CustomApiConfig } from '@/types/globalConfig'
import type {
  ApiConfigFormData,
  TestResult,
  PresetTemplate,
} from '../types'
import {
  createDefaultFormData,
  presetToFormData,
  formDataToApiConfig,
  PRESET_TEMPLATES,
} from '../types'

/**
 * API 管理器 Composable
 */
export function useApiManager() {
  const configService = getGlobalConfigService()
  
  // ==================== 状态 ====================
  
  /** 所有预设列表 */
  const presets = ref<ApiPreset[]>([])
  
  /** 当前激活的预设ID */
  const activePresetId = ref<string | null>(null)
  
  /** 是否启用自定义API */
  const isCustomApiEnabled = ref(false)
  
  /** 当前编辑的表单数据 */
  const formData = reactive<ApiConfigFormData>(createDefaultFormData())
  
  /** 当前编辑的预设ID（null表示新建） */
  const editingPresetId = ref<string | null>(null)
  
  /** 是否显示编辑器 */
  const showEditor = ref(false)
  
  /** 测试结果 */
  const testResult = ref<TestResult>({ status: 'idle' })
  
  /** 是否正在保存 */
  const isSaving = ref(false)
  
  // ==================== 计算属性 ====================
  
  /** 当前激活的预设 */
  const activePreset = computed(() => {
    if (!activePresetId.value) return null
    return presets.value.find(p => p.id === activePresetId.value) ?? null
  })
  
  /** 是否有预设 */
  const hasPresets = computed(() => presets.value.length > 0)
  
  /** 是否正在编辑现有预设 */
  const isEditing = computed(() => editingPresetId.value !== null)
  
  /** 预设模板列表 */
  const presetTemplates = computed(() => PRESET_TEMPLATES)
  
  // ==================== 方法 ====================
  
  /**
   * 加载配置
   */
  function loadConfig() {
    const config = configService.getOrCreateConfig()
    presets.value = config.apiPresets
    activePresetId.value = config.activePresetId
    isCustomApiEnabled.value = config.customApi.enabled
  }
  
  /**
   * 刷新预设列表
   */
  function refreshPresets() {
    presets.value = configService.getApiPresets()
    activePresetId.value = configService.getOrCreateConfig().activePresetId
  }
  
  /**
   * 开始新建预设
   */
  function startNewPreset(template?: PresetTemplate) {
    editingPresetId.value = null
    Object.assign(formData, createDefaultFormData())
    
    if (template) {
      Object.assign(formData, template.config)
      formData.name = template.name
      formData.description = template.description
    }
    
    testResult.value = { status: 'idle' }
    showEditor.value = true
  }
  
  /**
   * 开始编辑预设
   */
  function startEditPreset(preset: ApiPreset) {
    editingPresetId.value = preset.id
    Object.assign(formData, presetToFormData(preset))
    testResult.value = { status: 'idle' }
    showEditor.value = true
  }
  
  /**
   * 取消编辑
   */
  function cancelEdit() {
    editingPresetId.value = null
    showEditor.value = false
    testResult.value = { status: 'idle' }
  }
  
  /**
   * 保存预设
   */
  async function savePreset(): Promise<boolean> {
    if (!formData.name.trim()) {
      return false
    }
    
    isSaving.value = true
    
    try {
      const apiConfig = formDataToApiConfig(formData)
      
      if (editingPresetId.value) {
        // 更新现有预设
        configService.updatePreset(editingPresetId.value, {
          name: formData.name,
          description: formData.description,
          config: apiConfig,
        })
      } else {
        // 创建新预设
        configService.addPreset({
          name: formData.name,
          description: formData.description,
          config: apiConfig,
        })
      }
      
      refreshPresets()
      showEditor.value = false
      editingPresetId.value = null
      
      return true
    } finally {
      isSaving.value = false
    }
  }
  
  /**
   * 删除预设
   */
  function deletePreset(presetId: string) {
    configService.removePreset(presetId)
    refreshPresets()
    
    if (editingPresetId.value === presetId) {
      cancelEdit()
    }
  }
  
  /**
   * 激活预设
   */
  function activatePreset(presetId: string) {
    configService.setActivePreset(presetId)
    
    // 同时启用自定义API
    const preset = presets.value.find(p => p.id === presetId)
    if (preset) {
      configService.enableCustomApi(preset.config)
    }
    
    activePresetId.value = presetId
    isCustomApiEnabled.value = true
  }
  
  /**
   * 取消激活（使用酒馆默认API）
   */
  function deactivatePreset() {
    configService.setActivePreset(null)
    configService.disableCustomApi()
    activePresetId.value = null
    isCustomApiEnabled.value = false
  }
  
  /** 模型列表服务 */
  const modelListService = getModelListService()

  /** 模型列表 */
  const modelList = ref<ModelInfo[]>([])

  /** 是否正在加载模型列表 */
  const isLoadingModels = ref(false)

  /** 模型列表错误信息 */
  const modelListError = ref<string | null>(null)

  /**
   * 获取模型列表
   * @param forceRefresh 是否强制刷新（忽略缓存）
   * @param customConfig 可选的自定义配置（覆盖 formData）
   */
  async function fetchModels(
    forceRefresh = false,
    customConfig?: { apiUrl?: string; apiKey?: string; source?: 'openai' | 'anthropic' | 'google' | 'custom' }
  ): Promise<string[]> {
    // 使用自定义配置或 formData
    const config = {
      apiUrl: customConfig?.apiUrl || formData.apiUrl,
      apiKey: customConfig?.apiKey || formData.apiKey,
      source: customConfig?.source || formData.source,
    }

    // 对于 Anthropic，不需要 API Key 也可以获取预定义列表
    if (config.source !== 'anthropic' && (!config.apiUrl || !config.apiKey)) {
      modelList.value = []
      modelListError.value = null
      return []
    }

    isLoadingModels.value = true
    modelListError.value = null

    try {
      const result = await modelListService.getModels(
        {
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          source: config.source,
        },
        {
          forceRefresh,
          chatModelsOnly: false, // 先获取全部，让用户看到完整列表
        }
      )

      if (result.success) {
        modelList.value = result.models
        return result.models.map((m) => m.id)
      } else {
        modelListError.value = result.error || '获取模型列表失败'
        console.error('获取模型列表失败:', result.error)
        return []
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      modelListError.value = message
      console.error('获取模型列表失败:', error)
      return []
    } finally {
      isLoadingModels.value = false
    }
  }

  /**
   * 测试API连接
   */
  async function testConnection(): Promise<TestResult> {
    testResult.value = { status: 'testing' }
    
    const startTime = Date.now()
    
    try {
      const apiConfig = formDataToApiConfig(formData)
      
      // 根据API类型构建请求
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      let endpoint = ''
      let body: any = {}
      const baseUrl = apiConfig.apiUrl.replace(/\/$/, '')

      if (apiConfig.source === 'anthropic') {
        // Anthropic
        if (apiConfig.apiKey) {
          headers['x-api-key'] = apiConfig.apiKey
          headers['anthropic-version'] = '2023-06-01'
        }
        endpoint = `${baseUrl}/messages`
        body = {
          model: apiConfig.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }
      } else if (apiConfig.source === 'google') {
        // Google Native
        // Google API key 在 URL 中传递
        endpoint = `${baseUrl}/models/${apiConfig.model}:generateContent?key=${apiConfig.apiKey}`
        body = {
          contents: [{
            parts: [{ text: 'Hi' }]
          }],
          generationConfig: {
            maxOutputTokens: 10,
          }
        }
      } else {
        // OpenAI Compatible
        if (apiConfig.apiKey) {
          headers['Authorization'] = `Bearer ${apiConfig.apiKey}`
        }
        endpoint = `${baseUrl}/chat/completions`
        body = {
          model: apiConfig.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      
      const responseTime = Date.now() - startTime
      
      if (response.ok) {
        testResult.value = {
          status: 'success',
          message: `连接成功！响应时间: ${responseTime}ms`,
          responseTime,
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        testResult.value = {
          status: 'error',
          message: `错误 ${response.status}: ${errorData.error?.message || response.statusText}`,
          responseTime,
        }
      }
    } catch (error) {
      testResult.value = {
        status: 'error',
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
    
    return testResult.value
  }
  
  /**
   * 复制预设
   */
  function duplicatePreset(preset: ApiPreset) {
    const newPreset = configService.addPreset({
      name: `${preset.name} (副本)`,
      description: preset.description,
      config: { ...preset.config },
    })
    
    refreshPresets()
    startEditPreset(newPreset)
  }
  
  /**
   * 导出预设为JSON
   */
  function exportPreset(preset: ApiPreset): string {
    const exportData = {
      name: preset.name,
      description: preset.description,
      config: {
        ...preset.config,
        // 不导出API Key
        apiKey: undefined,
      },
    }
    return JSON.stringify(exportData, null, 2)
  }
  
  /**
   * 导入预设
   */
  function importPreset(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString)
      
      if (!data.name || !data.config) {
        throw new Error('无效的预设格式')
      }
      
      configService.addPreset({
        name: data.name,
        description: data.description || '',
        config: data.config,
      })
      
      refreshPresets()
      return true
    } catch (error) {
      console.error('导入预设失败:', error)
      return false
    }
  }
  
  // 初始加载
  loadConfig()
  
  return {
    // 状态
    presets,
    activePresetId,
    isCustomApiEnabled,
    formData,
    editingPresetId,
    showEditor,
    testResult,
    isSaving,
    modelList,
    isLoadingModels,
    modelListError,
    
    // 计算属性
    activePreset,
    hasPresets,
    isEditing,
    presetTemplates,
    
    // 方法
    loadConfig,
    refreshPresets,
    startNewPreset,
    startEditPreset,
    cancelEdit,
    savePreset,
    deletePreset,
    activatePreset,
    deactivatePreset,
    fetchModels,
    testConnection,
    duplicatePreset,
    exportPreset,
    importPreset,
  }
}
