/**
 * 主题系统组合式函数
 * 管理主题的应用、切换和持久化
 */

import { ref, computed, watch } from 'vue'
import type { Theme, ThemeConfig, ThemePreview } from '@/types/theme'
import { presetThemes, getPresetThemeList, getDefaultTheme, DEFAULT_THEME_ID } from '@/themes/presets'

// 存储键名
const THEME_STORAGE_KEY = 'phone-sim-theme'
const CUSTOM_THEMES_STORAGE_KEY = 'phone-sim-custom-themes'

// 单例状态
const currentTheme = ref<Theme>(getDefaultTheme())
const customThemes = ref<Theme[]>([])
const isInitialized = ref(false)

/**
 * 将 camelCase 转换为 kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * 应用主题到 DOM
 */
function applyThemeToDOM(theme: Theme): void {
  const root = document.documentElement

  // 注入颜色变量
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${toKebabCase(key)}`, value)
  })

  // 注入设备变量
  root.style.setProperty('--device-radius', `${theme.device.borderRadius}px`)
  root.style.setProperty('--device-frame-color', theme.device.frameColor)
  root.style.setProperty('--device-notch-style', theme.device.notchStyle)
  root.style.setProperty('--device-shadow-intensity', theme.device.shadowIntensity)

  // 注入字体变量
  root.style.setProperty('--font-family', theme.typography.fontFamily)
  root.style.setProperty('--font-size-base', `${theme.typography.baseFontSize}px`)
  root.style.setProperty('--font-weight', theme.typography.fontWeight)

  // 注入壁纸变量
  if (theme.wallpapers.homescreen) {
    root.style.setProperty('--wallpaper-homescreen', theme.wallpapers.homescreen)
  }
  if (theme.wallpapers.lockscreen) {
    root.style.setProperty('--wallpaper-lockscreen', theme.wallpapers.lockscreen)
  }
  if (theme.wallpapers.chatBackground) {
    root.style.setProperty('--wallpaper-chat', theme.wallpapers.chatBackground)
  }

  // 设置主题标识属性
  root.setAttribute('data-theme', theme.id)

  // 设置阴影样式
  const shadowMap = {
    none: 'none',
    light: '0 2px 8px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 16px rgba(0, 0, 0, 0.15)',
    heavy: '0 8px 32px rgba(0, 0, 0, 0.25)',
  }
  root.style.setProperty('--device-shadow', shadowMap[theme.device.shadowIntensity])

  console.info(`[小手机] 主题已应用: ${theme.name}`)
}

/**
 * 保存主题 ID 到本地存储
 */
function saveThemeId(themeId: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
  } catch (error) {
    console.warn('[小手机] 保存主题ID失败:', error)
  }
}

/**
 * 从本地存储加载主题 ID
 */
function loadThemeId(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch (error) {
    console.warn('[小手机] 读取主题ID失败:', error)
    return null
  }
}

/**
 * 保存自定义主题列表
 */
function saveCustomThemes(themes: Theme[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(themes))
  } catch (error) {
    console.warn('[小手机] 保存自定义主题失败:', error)
  }
}

/**
 * 加载自定义主题列表
 */
function loadCustomThemes(): Theme[] {
  try {
    const saved = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.warn('[小手机] 读取自定义主题失败:', error)
  }
  return []
}

/**
 * 主题系统组合式函数
 */
export function useTheme() {
  /**
   * 所有可用主题（预设 + 自定义）
   */
  const allThemes = computed<Theme[]>(() => {
    return [...getPresetThemeList(), ...customThemes.value]
  })

  /**
   * 主题预览列表（用于选择器显示）
   */
  const themePreviews = computed<ThemePreview[]>(() => {
    return allThemes.value.map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      primaryColor: theme.colors.primary,
      backgroundColor: theme.colors.background,
      isBuiltin: theme.isBuiltin ?? false,
    }))
  })

  /**
   * 当前是否为深色主题
   */
  const isDarkTheme = computed(() => {
    // 通过背景色亮度判断
    const bg = currentTheme.value.colors.background
    if (bg.startsWith('#')) {
      const hex = bg.slice(1)
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      return luminance < 0.5
    }
    return false
  })

  /**
   * 初始化主题系统
   */
  function initTheme(): void {
    if (isInitialized.value) return

    // 加载自定义主题
    customThemes.value = loadCustomThemes()

    // 加载保存的主题
    const savedThemeId = loadThemeId()
    if (savedThemeId) {
      const savedTheme =
        presetThemes[savedThemeId] || customThemes.value.find((t) => t.id === savedThemeId)
      if (savedTheme) {
        currentTheme.value = savedTheme
      }
    }

    // 应用主题
    applyThemeToDOM(currentTheme.value)
    isInitialized.value = true

    console.info('[小手机] 主题系统已初始化')
  }

  /**
   * 应用指定主题
   */
  function applyTheme(theme: Theme): void {
    currentTheme.value = theme
    applyThemeToDOM(theme)
    saveThemeId(theme.id)
  }

  /**
   * 通过 ID 切换主题
   */
  function setThemeById(themeId: string): boolean {
    const theme =
      presetThemes[themeId] || customThemes.value.find((t) => t.id === themeId)
    if (theme) {
      applyTheme(theme)
      return true
    }
    console.warn(`[小手机] 未找到主题: ${themeId}`)
    return false
  }

  /**
   * 添加自定义主题
   */
  function addCustomTheme(theme: Omit<Theme, 'id' | 'isBuiltin'>): Theme {
    const newTheme: Theme = {
      ...theme,
      id: `custom-${Date.now()}`,
      isBuiltin: false,
    }
    customThemes.value.push(newTheme)
    saveCustomThemes(customThemes.value)
    return newTheme
  }

  /**
   * 更新自定义主题
   */
  function updateCustomTheme(themeId: string, updates: Partial<Theme>): boolean {
    const index = customThemes.value.findIndex((t) => t.id === themeId)
    if (index === -1) return false

    customThemes.value[index] = {
      ...customThemes.value[index],
      ...updates,
      id: themeId, // 保持 ID 不变
      isBuiltin: false, // 确保不会变成内置
    }
    saveCustomThemes(customThemes.value)

    // 如果更新的是当前主题，重新应用
    if (currentTheme.value.id === themeId) {
      applyTheme(customThemes.value[index])
    }

    return true
  }

  /**
   * 删除自定义主题
   */
  function deleteCustomTheme(themeId: string): boolean {
    const index = customThemes.value.findIndex((t) => t.id === themeId)
    if (index === -1) return false

    customThemes.value.splice(index, 1)
    saveCustomThemes(customThemes.value)

    // 如果删除的是当前主题，切回默认
    if (currentTheme.value.id === themeId) {
      applyTheme(getDefaultTheme())
    }

    return true
  }

  /**
   * 复制主题（用于基于现有主题创建新主题）
   */
  function duplicateTheme(themeId: string, newName: string): Theme | null {
    const sourceTheme =
      presetThemes[themeId] || customThemes.value.find((t) => t.id === themeId)
    if (!sourceTheme) return null

    const newTheme: Theme = {
      ...JSON.parse(JSON.stringify(sourceTheme)),
      id: `custom-${Date.now()}`,
      name: newName,
      isBuiltin: false,
      author: undefined,
    }

    customThemes.value.push(newTheme)
    saveCustomThemes(customThemes.value)
    return newTheme
  }

  /**
   * 导出主题配置
   */
  function exportTheme(themeId: string): string | null {
    const theme =
      presetThemes[themeId] || customThemes.value.find((t) => t.id === themeId)
    if (!theme) return null

    return JSON.stringify(theme, null, 2)
  }

  /**
   * 导入主题配置
   */
  function importTheme(jsonString: string): Theme | null {
    try {
      const theme = JSON.parse(jsonString) as Theme

      // 验证必要字段
      if (!theme.name || !theme.colors || !theme.device || !theme.typography) {
        throw new Error('主题配置缺少必要字段')
      }

      // 生成新 ID 避免冲突
      const newTheme: Theme = {
        ...theme,
        id: `imported-${Date.now()}`,
        isBuiltin: false,
      }

      customThemes.value.push(newTheme)
      saveCustomThemes(customThemes.value)
      return newTheme
    } catch (error) {
      console.error('[小手机] 导入主题失败:', error)
      return null
    }
  }

  /**
   * 导出所有主题配置
   */
  function exportAllThemes(): string {
    const config: ThemeConfig = {
      activeThemeId: currentTheme.value.id,
      customThemes: customThemes.value,
      _meta: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
      },
    }
    return JSON.stringify(config, null, 2)
  }

  /**
   * 导入所有主题配置
   */
  function importAllThemes(jsonString: string): boolean {
    try {
      const config = JSON.parse(jsonString) as ThemeConfig

      if (!config.customThemes || !Array.isArray(config.customThemes)) {
        throw new Error('无效的主题配置格式')
      }

      customThemes.value = config.customThemes
      saveCustomThemes(customThemes.value)

      // 尝试应用保存的活动主题
      if (config.activeThemeId) {
        setThemeById(config.activeThemeId)
      }

      return true
    } catch (error) {
      console.error('[小手机] 导入主题配置失败:', error)
      return false
    }
  }

  /**
   * 重置为默认主题
   */
  function resetToDefault(): void {
    applyTheme(getDefaultTheme())
  }

  return {
    // 状态
    currentTheme,
    customThemes,
    allThemes,
    themePreviews,
    isDarkTheme,
    isInitialized,

    // 方法
    initTheme,
    applyTheme,
    setThemeById,
    addCustomTheme,
    updateCustomTheme,
    deleteCustomTheme,
    duplicateTheme,
    exportTheme,
    importTheme,
    exportAllThemes,
    importAllThemes,
    resetToDefault,

    // 常量
    presetThemes,
    DEFAULT_THEME_ID,
  }
}