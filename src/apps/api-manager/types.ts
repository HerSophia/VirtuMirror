/**
 * API 管理器类型定义
 */

import type { CustomApiConfig, ApiPreset } from '@/types/globalConfig'

/**
 * API 配置表单数据
 */
export interface ApiConfigFormData {
  /** 配置名称 */
  name: string
  /** 配置描述 */
  description: string
  /** API 地址 */
  apiUrl: string
  /** API 密钥 */
  apiKey: string
  /** 模型名称 */
  model: string
  /** API 来源类型 */
  source: 'openai' | 'anthropic' | 'google' | 'custom'
  /** 最大 token 数 */
  maxTokens: number
  /** 温度参数 */
  temperature: number
  /** 频率惩罚 */
  frequencyPenalty: number
  /** 存在惩罚 */
  presencePenalty: number
  /** Top P 采样 */
  topP: number
}

/**
 * API 测试状态
 */
export type TestStatus = 'idle' | 'testing' | 'success' | 'error'

/**
 * API 测试结果
 */
export interface TestResult {
  status: TestStatus
  message?: string
  responseTime?: number
}

/**
 * 预设模板
 */
export interface PresetTemplate {
  id: string
  name: string
  description: string
  icon: string
  config: Partial<ApiConfigFormData>
}

/**
 * API 来源选项
 */
export const API_SOURCE_OPTIONS = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'custom', label: '自定义' },
] as const

/**
 * 预设模板列表
 */
export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5-Turbo 等',
    icon: '🤖',
    config: {
      apiUrl: 'https://api.openai.com/v1',
      source: 'openai',
      model: 'gpt-4',
      maxTokens: 4096,
      temperature: 0.7,
    },
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3 系列',
    icon: '🎭',
    config: {
      apiUrl: 'https://api.anthropic.com/v1',
      source: 'anthropic',
      model: 'claude-3-5-sonnet-20240620',
      maxTokens: 4096,
      temperature: 0.7,
    },
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro/Flash (Native)',
    icon: '💎',
    config: {
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      source: 'google',
      model: 'gemini-1.5-flash',
      maxTokens: 8192,
      temperature: 0.7,
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Chat & Coder',
    icon: '🔍',
    config: {
      apiUrl: 'https://api.deepseek.com/v1',
      source: 'openai',
      model: 'deepseek-chat',
      maxTokens: 4096,
      temperature: 0.7,
    },
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    description: 'Kimi 系列模型',
    icon: '🌙',
    config: {
      apiUrl: 'https://api.moonshot.cn/v1',
      source: 'openai',
      model: 'moonshot-v1-8k',
      maxTokens: 4096,
      temperature: 0.7,
    },
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    description: '本地部署的模型',
    icon: '🦙',
    config: {
      apiUrl: 'http://localhost:11434/v1',
      source: 'openai',
      model: 'llama3',
      maxTokens: 2048,
      temperature: 0.7,
    },
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    description: '硅基流动 (Qwen, Yi, GLM)',
    icon: '🌊',
    config: {
      apiUrl: 'https://api.siliconflow.cn/v1',
      source: 'openai',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      maxTokens: 4096,
      temperature: 0.7,
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '聚合所有主流模型',
    icon: '🌐',
    config: {
      apiUrl: 'https://openrouter.ai/api/v1',
      source: 'openai',
      model: 'anthropic/claude-3.5-sonnet',
      maxTokens: 4096,
      temperature: 0.7,
    },
  },
  {
    id: 'groq',
    name: 'Groq',
    description: '超极速推理',
    icon: '⚡',
    config: {
      apiUrl: 'https://api.groq.com/openai/v1',
      source: 'openai',
      model: 'llama3-70b-8192',
      maxTokens: 8192,
      temperature: 0.7,
    },
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'Mistral AI 官方 API',
    icon: '🌪️',
    config: {
      apiUrl: 'https://api.mistral.ai/v1',
      source: 'openai',
      model: 'mistral-large-latest',
      maxTokens: 4096,
      temperature: 0.7,
    },
  },
  {
    id: 'custom',
    name: '自定义',
    description: '自定义 API 配置',
    icon: '⚙️',
    config: {
      source: 'custom',
      maxTokens: 2048,
      temperature: 0.7,
    },
  },
]

/**
 * 创建默认的表单数据
 */
export function createDefaultFormData(): ApiConfigFormData {
  return {
    name: '',
    description: '',
    apiUrl: '',
    apiKey: '',
    model: '',
    source: 'openai',
    maxTokens: 2048,
    temperature: 0.7,
    frequencyPenalty: 0,
    presencePenalty: 0,
    topP: 1,
  }
}

/**
 * 从 ApiPreset 转换为表单数据
 */
export function presetToFormData(preset: ApiPreset): ApiConfigFormData {
  return {
    name: preset.name,
    description: preset.description || '',
    apiUrl: preset.config.apiUrl,
    apiKey: preset.config.apiKey || '',
    model: preset.config.model,
    source: preset.config.source || 'openai',
    maxTokens: preset.config.maxTokens || 2048,
    temperature: preset.config.temperature || 0.7,
    frequencyPenalty: preset.config.frequencyPenalty || 0,
    presencePenalty: preset.config.presencePenalty || 0,
    topP: preset.config.topP || 1,
  }
}

/**
 * 从表单数据转换为 CustomApiConfig
 */
export function formDataToApiConfig(formData: ApiConfigFormData): CustomApiConfig {
  return {
    apiUrl: formData.apiUrl,
    apiKey: formData.apiKey || undefined,
    model: formData.model,
    source: formData.source,
    maxTokens: formData.maxTokens,
    temperature: formData.temperature,
    frequencyPenalty: formData.frequencyPenalty || undefined,
    presencePenalty: formData.presencePenalty || undefined,
    topP: formData.topP !== 1 ? formData.topP : undefined,
  }
}
