/**
 * 全局配置类型定义
 * 定义存储在全局变量中的配置数据结构
 */

import type { DesktopItem, DesktopPage } from '@/apps/home/types'

/**
 * 自定义 API 配置
 * 用于配置自定义的 LLM API
 */
export interface CustomApiConfig {
  /** API 地址 */
  apiUrl: string
  /** API 密钥 */
  apiKey?: string
  /** 模型名称 */
  model: string
  /** API 来源类型 */
  source?: 'openai' | 'anthropic' | 'google' | 'custom'
  /** 最大 token 数 */
  maxTokens?: number
  /** 温度参数 */
  temperature?: number
  /** 频率惩罚 */
  frequencyPenalty?: number
  /** 存在惩罚 */
  presencePenalty?: number
  /** Top P 采样 */
  topP?: number
}

/**
 * API 预设
 */
export interface ApiPreset {
  /** 预设ID */
  id: string
  /** 预设名称 */
  name: string
  /** 预设描述 */
  description?: string
  /** API 配置 */
  config: CustomApiConfig
  /** 是否为内置预设 */
  isBuiltin?: boolean
  /** 创建时间 */
  createdAt?: string
}

/**
 * 默认生成选项
 */
export interface DefaultGenerateOptions {
  /** 最大 token 数 */
  maxTokens?: number
  /** 温度参数 */
  temperature?: number
  /** 频率惩罚 */
  frequencyPenalty?: number
  /** 存在惩罚 */
  presencePenalty?: number
  /** Top P 采样 */
  topP?: number
}

/**
 * UI 配置
 */
export interface UIConfig {
  /** 主题 ID */
  themeId: string
  /** 设备模式 */
  deviceMode: 'phone' | 'tablet' | 'desktop'
  /** 是否启用动画 */
  enableAnimations: boolean
  /** 是否启用声音 */
  enableSounds: boolean
  /** 自定义壁纸 */
  wallpapers?: {
    homescreen?: string
    lockscreen?: string
    chatBackground?: string
  }
}

/**
 * 桌面布局配置
 * 用于持久化桌面图标排列和分组
 */
export interface DesktopLayoutConfig {
  /**
   * 桌面项列表（旧格式，单页布局兼容）
   * @deprecated 使用 pages 替代
   */
  items?: DesktopItem[]
  /** 多页桌面数据 */
  pages?: DesktopPage[]
  /** 当前页索引 */
  currentPageIndex?: number
  /** Dock 栏 App ID 列表 */
  dockAppIds: string[]
  /** 最后更新时间 */
  lastUpdated: string
}

/**
 * 小手机全局配置 - 存储在全局变量中
 * 所有聊天共享的配置
 */
export interface PhoneGlobalConfig {
  /** 自定义 API 配置 */
  customApi: {
    /** 是否启用自定义 API */
    enabled: boolean
    /** 当前配置 */
    config: CustomApiConfig | null
  }
  
  /** API 预设列表 */
  apiPresets: ApiPreset[]
  
  /** 当前激活的预设 ID */
  activePresetId: string | null
  
  /** 默认生成参数 */
  defaultGenerateOptions: DefaultGenerateOptions
  
  /** UI 配置 */
  ui: UIConfig
  
  /** 桌面布局配置 */
  desktopLayout: DesktopLayoutConfig | null
  
  /** 元数据 */
  _meta: GlobalConfigMeta
}

/**
 * 全局配置元信息
 */
export interface GlobalConfigMeta {
  /** 配置版本号 */
  version: string
  /** 最后更新时间 (ISO 8601) */
  lastUpdated: string
}

/**
 * 全局变量中的存储键名
 */
export const GLOBAL_CONFIG_KEY = '小手机_config' as const

/**
 * 创建默认的全局配置
 */
export function createDefaultGlobalConfig(): PhoneGlobalConfig {
  return {
    customApi: {
      enabled: false,
      config: null,
    },
    apiPresets: [],
    activePresetId: null,
    defaultGenerateOptions: {
      maxTokens: 2048,
      temperature: 0.7,
    },
    ui: {
      themeId: 'ios',
      deviceMode: 'phone',
      enableAnimations: true,
      enableSounds: true,
    },
    desktopLayout: null,
    _meta: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
    },
  }
}

/**
 * 部分更新类型
 */
export type PartialGlobalConfig = {
  [K in keyof PhoneGlobalConfig]?: Partial<PhoneGlobalConfig[K]>
}
