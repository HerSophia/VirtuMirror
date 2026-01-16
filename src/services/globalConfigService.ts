/**
 * 全局配置服务
 * 管理存储在全局变量中的小手机配置
 */

import { getAdapter } from '@/adapters'
import type { HostAdapter } from '@/adapters/types'
import type {
  PhoneGlobalConfig,
  PartialGlobalConfig,
  CustomApiConfig,
  ApiPreset,
  DefaultGenerateOptions,
  UIConfig,
  DesktopLayoutConfig,
} from '@/types/globalConfig'
import type { DesktopItem, DesktopPage } from '@/apps/home/types'
import { createDefaultGlobalConfig, GLOBAL_CONFIG_KEY } from '@/types/globalConfig'

/**
 * 深度合并对象
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = result[key]
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[typeof key]
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[typeof key]
      }
    }
  }
  
  return result
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 全局配置服务类
 * 提供对全局变量中存储的小手机配置的操作
 */
export class GlobalConfigService {
  private adapter: HostAdapter
  private cache: PhoneGlobalConfig | null = null
  
  constructor(adapter?: HostAdapter) {
    this.adapter = adapter ?? getAdapter()
  }
  
  /**
   * 获取全局配置
   * 如果不存在则返回 null
   */
  getConfig(): PhoneGlobalConfig | null {
    if (this.cache) {
      return this.cache
    }
    
    try {
      const config = this.adapter.getGlobalConfig()
      this.cache = config
      return config
    } catch (error) {
      console.error('[GlobalConfigService] 获取全局配置失败:', error)
      return null
    }
  }
  
  /**
   * 获取配置，如果不存在则创建默认配置
   */
  getOrCreateConfig(): PhoneGlobalConfig {
    const config = this.getConfig()
    if (config) {
      return config
    }
    
    // 创建默认配置
    const defaultConfig = createDefaultGlobalConfig()
    this.saveConfig(defaultConfig)
    return defaultConfig
  }
  
  /**
   * 保存全局配置
   */
  saveConfig(config: PhoneGlobalConfig): void {
    try {
      this.adapter.saveGlobalConfig(config)
      this.cache = config
      console.info('[GlobalConfigService] 全局配置已保存')
    } catch (error) {
      console.error('[GlobalConfigService] 保存全局配置失败:', error)
    }
  }
  
  /**
   * 更新部分配置（深度合并）
   */
  updateConfig(partialConfig: PartialGlobalConfig): void {
    const currentConfig = this.getOrCreateConfig()
    
    // 深度合并配置
    const mergedConfig = deepMerge(currentConfig, partialConfig as Partial<PhoneGlobalConfig>)
    
    // 更新元数据
    mergedConfig._meta = {
      ...mergedConfig._meta,
      lastUpdated: new Date().toISOString(),
    }
    
    this.saveConfig(mergedConfig)
  }
  
  /**
   * 重置为默认配置
   */
  resetConfig(): PhoneGlobalConfig {
    const defaultConfig = createDefaultGlobalConfig()
    this.saveConfig(defaultConfig)
    return defaultConfig
  }
  
  // ==================== 自定义 API 配置 ====================
  
  /**
   * 获取当前激活的 API 配置
   */
  getActiveApiConfig(): CustomApiConfig | null {
    const config = this.getOrCreateConfig()
    
    if (!config.customApi.enabled) {
      return null
    }
    
    // 如果选择了预设，使用预设配置
    if (config.activePresetId) {
      const preset = config.apiPresets.find(p => p.id === config.activePresetId)
      return preset?.config ?? null
    }
    
    // 否则使用直接配置
    return config.customApi.config
  }
  
  /**
   * 启用自定义 API
   */
  enableCustomApi(apiConfig: CustomApiConfig): void {
    this.updateConfig({
      customApi: {
        enabled: true,
        config: apiConfig,
      },
    })
  }
  
  /**
   * 禁用自定义 API
   */
  disableCustomApi(): void {
    this.updateConfig({
      customApi: {
        enabled: false,
        config: null,
      },
    })
  }
  
  /**
   * 检查是否启用了自定义 API
   */
  isCustomApiEnabled(): boolean {
    return this.getOrCreateConfig().customApi.enabled
  }
  
  // ==================== API 预设管理 ====================
  
  /**
   * 获取所有 API 预设
   */
  getApiPresets(): ApiPreset[] {
    return this.getOrCreateConfig().apiPresets
  }
  
  /**
   * 添加 API 预设
   */
  addPreset(preset: Omit<ApiPreset, 'id' | 'createdAt'>): ApiPreset {
    const config = this.getOrCreateConfig()
    
    const newPreset: ApiPreset = {
      ...preset,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    
    config.apiPresets.push(newPreset)
    config._meta.lastUpdated = new Date().toISOString()
    this.saveConfig(config)
    
    return newPreset
  }
  
  /**
   * 更新 API 预设
   */
  updatePreset(presetId: string, updates: Partial<Omit<ApiPreset, 'id'>>): boolean {
    const config = this.getOrCreateConfig()
    const index = config.apiPresets.findIndex(p => p.id === presetId)
    
    if (index === -1) {
      return false
    }
    
    config.apiPresets[index] = {
      ...config.apiPresets[index],
      ...updates,
    }
    
    config._meta.lastUpdated = new Date().toISOString()
    this.saveConfig(config)
    
    return true
  }
  
  /**
   * 删除 API 预设
   */
  removePreset(presetId: string): boolean {
    const config = this.getOrCreateConfig()
    const initialLength = config.apiPresets.length
    
    config.apiPresets = config.apiPresets.filter(p => p.id !== presetId)
    
    // 如果删除的是当前激活的预设，清除激活状态
    if (config.activePresetId === presetId) {
      config.activePresetId = null
    }
    
    if (config.apiPresets.length !== initialLength) {
      config._meta.lastUpdated = new Date().toISOString()
      this.saveConfig(config)
      return true
    }
    
    return false
  }
  
  /**
   * 设置激活的预设
   */
  setActivePreset(presetId: string | null): void {
    const config = this.getOrCreateConfig()
    config.activePresetId = presetId
    config._meta.lastUpdated = new Date().toISOString()
    this.saveConfig(config)
  }
  
  /**
   * 获取激活的预设
   */
  getActivePreset(): ApiPreset | null {
    const config = this.getOrCreateConfig()
    if (!config.activePresetId) {
      return null
    }
    return config.apiPresets.find(p => p.id === config.activePresetId) ?? null
  }
  
  // ==================== 默认生成参数 ====================
  
  /**
   * 获取默认生成参数
   */
  getDefaultGenerateOptions(): DefaultGenerateOptions {
    return this.getOrCreateConfig().defaultGenerateOptions
  }
  
  /**
   * 更新默认生成参数
   */
  updateDefaultGenerateOptions(options: Partial<DefaultGenerateOptions>): void {
    this.updateConfig({
      defaultGenerateOptions: options,
    })
  }
  
  // ==================== UI 配置 ====================
  
  /**
   * 获取 UI 配置
   */
  getUIConfig(): UIConfig {
    return this.getOrCreateConfig().ui
  }
  
  /**
   * 更新 UI 配置
   */
  updateUIConfig(config: Partial<UIConfig>): void {
    this.updateConfig({
      ui: config,
    })
  }
  
  /**
   * 设置主题
   */
  setTheme(themeId: string): void {
    this.updateConfig({
      ui: { themeId } as Partial<UIConfig>,
    })
  }
  
  /**
   * 设置设备模式
   */
  setDeviceMode(mode: 'phone' | 'tablet' | 'desktop'): void {
    this.updateConfig({
      ui: { deviceMode: mode } as Partial<UIConfig>,
    })
  }
  
  // ==================== 桌面布局配置 ====================
  
  /**
   * 获取桌面布局配置
   */
  getDesktopLayout(): DesktopLayoutConfig | null {
    return this.getOrCreateConfig().desktopLayout
  }
  
  /**
   * 保存桌面布局（多页版本）
   * @param pages 桌面页数据
   * @param dockAppIds Dock 栏 App ID 列表
   * @param currentPageIndex 当前页索引
   */
  saveDesktopLayoutPages(pages: DesktopPage[], dockAppIds: string[], currentPageIndex?: number): void {
    const layoutConfig: DesktopLayoutConfig = {
      pages,
      dockAppIds,
      currentPageIndex: currentPageIndex ?? 0,
      lastUpdated: new Date().toISOString(),
    }
    
    this.updateConfig({
      desktopLayout: layoutConfig,
    })
    
    console.info('[GlobalConfigService] 桌面布局已保存', {
      pageCount: pages.length,
      totalItems: pages.reduce((sum, p) => sum + p.items.length, 0),
      dockCount: dockAppIds.length,
    })
  }

  /**
   * 保存桌面布局（兼容旧版单页格式）
   * @param items 桌面项列表
   * @param dockAppIds Dock 栏 App ID 列表
   * @deprecated 使用 saveDesktopLayoutPages 替代
   */
  saveDesktopLayout(items: DesktopItem[], dockAppIds: string[]): void {
    const layoutConfig: DesktopLayoutConfig = {
      items,
      dockAppIds,
      lastUpdated: new Date().toISOString(),
    }
    
    this.updateConfig({
      desktopLayout: layoutConfig,
    })
    
    console.info('[GlobalConfigService] 桌面布局已保存（旧格式）', {
      itemCount: items.length,
      dockCount: dockAppIds.length,
    })
  }
  
  /**
   * 更新桌面布局项（多页版本）
   * @param pages 桌面页数据
   */
  updateDesktopPages(pages: DesktopPage[]): void {
    const currentLayout = this.getDesktopLayout()
    this.saveDesktopLayoutPages(pages, currentLayout?.dockAppIds ?? [], currentLayout?.currentPageIndex)
  }

  /**
   * 更新桌面布局项
   * @param items 桌面项列表
   * @deprecated 使用 updateDesktopPages 替代
   */
  updateDesktopItems(items: DesktopItem[]): void {
    const currentLayout = this.getDesktopLayout()
    this.saveDesktopLayout(items, currentLayout?.dockAppIds ?? [])
  }
  
  /**
   * 更新 Dock 栏
   * @param dockAppIds Dock 栏 App ID 列表
   */
  updateDockApps(dockAppIds: string[]): void {
    const currentLayout = this.getDesktopLayout()
    this.saveDesktopLayout(currentLayout?.items ?? [], dockAppIds)
  }
  
  /**
   * 清除桌面布局（恢复默认）
   */
  clearDesktopLayout(): void {
    this.updateConfig({
      desktopLayout: null,
    })
    console.info('[GlobalConfigService] 桌面布局已清除')
  }
  
  /**
   * 检查是否有自定义桌面布局
   */
  hasCustomDesktopLayout(): boolean {
    return this.getDesktopLayout() !== null
  }
  
  // ==================== 配置导入导出 ====================
  
  /**
   * 导出配置为 JSON 字符串
   */
  exportToJson(): string {
    const config = this.getConfig()
    return JSON.stringify(config, null, 2)
  }
  
  /**
   * 从 JSON 字符串导入配置
   */
  importFromJson(jsonString: string): boolean {
    try {
      const config = JSON.parse(jsonString) as PhoneGlobalConfig
      
      // 基本验证
      if (!config._meta) {
        throw new Error('Invalid config format')
      }
      
      // 更新时间戳
      config._meta.lastUpdated = new Date().toISOString()
      
      this.saveConfig(config)
      return true
    } catch (error) {
      console.error('[GlobalConfigService] 导入配置失败:', error)
      return false
    }
  }
  
  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache = null
  }
}

// ==================== 单例实例 ====================

let globalConfigServiceInstance: GlobalConfigService | null = null

/**
 * 获取 GlobalConfigService 单例实例
 */
export function getGlobalConfigService(): GlobalConfigService {
  if (!globalConfigServiceInstance) {
    globalConfigServiceInstance = new GlobalConfigService()
  }
  return globalConfigServiceInstance
}

/**
 * 重置 GlobalConfigService 实例
 * 主要用于测试
 */
export function resetGlobalConfigService(): void {
  if (globalConfigServiceInstance) {
    globalConfigServiceInstance.clearCache()
    globalConfigServiceInstance = null
  }
}