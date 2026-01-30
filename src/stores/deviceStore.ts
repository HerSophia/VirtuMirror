/**
 * 设备模式状态管理Store
 * 支持手机/平板/桌面三种模式切换
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { loggerService } from '@/services/logger'

const storeLogger = loggerService.child('store:device')

/** 设备模式类型 */
export type DeviceMode = 'phone' | 'tablet' | 'desktop'

/** 屏幕方向类型 */
export type Orientation = 'portrait' | 'landscape'

/** 缩放模式类型 */
export type ScaleMode = 'auto' | 'fit' | 'real' | 'custom'

/** 导航模式类型 */
export type NavigationMode = 'gesture' | 'buttons'

/** 设备尺寸配置 */
export interface DeviceDimensions {
  width: number
  height: number
}

/** 布局配置 */
export interface LayoutConfig {
  /** 应用图标网格列数 */
  columns: number
  /** 应用图标尺寸 */
  iconSize: number
  /** 网格间距 */
  gap: number
  /** 是否启用分屏视图 */
  splitView: boolean
  /** 主面板宽度（分屏模式） */
  masterWidth: number
  /** 刘海样式 */
  notchStyle: 'dynamic-island' | 'notch' | 'pill' | 'none'
  /** 圆角大小 */
  borderRadius: number
}

/** 尺寸预设项 */
export interface SizePreset {
  id: string
  name: string
  width: number
  height: number
  mode: DeviceMode
  description?: string
}

/** 预设尺寸列表 */
export const SIZE_PRESETS: SizePreset[] = [
  // 手机尺寸
  { id: 'iphone-14-pro', name: 'iPhone 14 Pro', width: 393, height: 852, mode: 'phone', description: '6.1英寸' },
  { id: 'iphone-14-pro-max', name: 'iPhone 14 Pro Max', width: 430, height: 932, mode: 'phone', description: '6.7英寸' },
  { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667, mode: 'phone', description: '4.7英寸' },
  { id: 'iphone-12-mini', name: 'iPhone 12 mini', width: 375, height: 812, mode: 'phone', description: '5.4英寸' },
  { id: 'pixel-7', name: 'Pixel 7', width: 412, height: 915, mode: 'phone', description: '6.3英寸' },
  { id: 'samsung-s23', name: 'Samsung S23', width: 360, height: 780, mode: 'phone', description: '6.1英寸' },
  { id: 'samsung-s23-ultra', name: 'Samsung S23 Ultra', width: 384, height: 824, mode: 'phone', description: '6.8英寸' },
  
  // 平板尺寸
  { id: 'ipad-mini', name: 'iPad mini', width: 744, height: 1133, mode: 'tablet', description: '8.3英寸' },
  { id: 'ipad-air', name: 'iPad Air', width: 820, height: 1180, mode: 'tablet', description: '10.9英寸' },
  { id: 'ipad-pro-11', name: 'iPad Pro 11"', width: 834, height: 1194, mode: 'tablet', description: '11英寸' },
  { id: 'ipad-pro-12', name: 'iPad Pro 12.9"', width: 1024, height: 1366, mode: 'tablet', description: '12.9英寸' },
  { id: 'android-tablet', name: 'Android Tablet', width: 800, height: 1280, mode: 'tablet', description: '10.1英寸' },
  
  // 桌面尺寸
  { id: 'desktop-hd', name: '桌面 HD', width: 1280, height: 720, mode: 'desktop', description: '720p' },
  { id: 'desktop-fhd', name: '桌面 FHD', width: 1920, height: 1080, mode: 'desktop', description: '1080p' },
  { id: 'desktop-compact', name: '紧凑桌面', width: 1024, height: 768, mode: 'desktop', description: '4:3' },
]

/** 设备配置映射 */
const DEVICE_CONFIGS: Record<DeviceMode, { dimensions: DeviceDimensions; layout: LayoutConfig }> = {
  phone: {
    dimensions: { width: 375, height: 812 },
    layout: {
      columns: 4,
      iconSize: 60,
      gap: 16,
      splitView: false,
      masterWidth: 0,
      notchStyle: 'dynamic-island',
      borderRadius: 40,
    },
  },
  tablet: {
    dimensions: { width: 768, height: 1024 },
    layout: {
      columns: 6,
      iconSize: 80,
      gap: 24,
      splitView: true,
      masterWidth: 320,
      notchStyle: 'pill',
      borderRadius: 24,
    },
  },
  desktop: {
    dimensions: { width: 1200, height: 800 },
    layout: {
      columns: 8,
      iconSize: 70,
      gap: 20,
      splitView: true,
      masterWidth: 360,
      notchStyle: 'none',
      borderRadius: 12,
    },
  },
}

export const useDeviceStore = defineStore('device', () => {
  // ==================== 状态 ====================
  
  /** 当前设备模式 */
  const mode = ref<DeviceMode>('phone')
  
  /** 是否自动适应窗口大小 */
  const autoFit = ref(true)
  
  /** 缩放模式 */
  const scaleMode = ref<ScaleMode>('auto')
  
  /** 自定义缩放值（仅在 custom 模式下使用） */
  const customScale = ref(1.0)
  
  /** 目标物理宽度（英寸，仅在 real 模式下使用） */
  const targetPhysicalWidth = ref(2.8) // iPhone 标准宽度约 2.8 英寸
  
  /** 分屏模式下当前活跃的面板 */
  const activePane = ref<'master' | 'detail'>('master')
  
  /** 当前选中的预设ID */
  const selectedPresetId = ref<string>('iphone-12-mini')
  
  /** 自定义尺寸（当不使用预设时） */
  const customDimensions = ref<DeviceDimensions | null>(null)
  
  /** 屏幕方向（仅手机和平板支持） */
  const orientation = ref<Orientation>('portrait')
  
  /** 导航模式：手势导航或三键导航 */
  const navigationMode = ref<NavigationMode>('gesture')
  
  // ==================== 计算属性 ====================
  
  /** 当前选中的预设 */
  const selectedPreset = computed(() =>
    SIZE_PRESETS.find(p => p.id === selectedPresetId.value) || SIZE_PRESETS[0]
  )
  
  /** 是否为竖屏 */
  const isPortrait = computed(() => orientation.value === 'portrait')
  
  /** 是否为横屏 */
  const isLandscape = computed(() => orientation.value === 'landscape')
  
  /** 是否支持旋转（桌面模式不支持） */
  const canRotate = computed(() => mode.value !== 'desktop')
  
  /** 当前设备尺寸（考虑横竖屏） */
  const dimensions = computed<DeviceDimensions>(() => {
    let width: number
    let height: number
    
    if (customDimensions.value) {
      width = customDimensions.value.width
      height = customDimensions.value.height
    } else {
      width = selectedPreset.value.width
      height = selectedPreset.value.height
    }
    
    // 横屏模式下交换宽高（仅手机和平板）
    if (isLandscape.value && canRotate.value) {
      return { width: height, height: width }
    }
    
    return { width, height }
  })
  
  /** 当前布局配置 */
  const layout = computed<LayoutConfig>(() => DEVICE_CONFIGS[mode.value].layout)
  
  /** 是否为分屏模式 */
  const isSplitView = computed(() => layout.value.splitView)
  
  /** 是否为手机模式 */
  const isPhone = computed(() => mode.value === 'phone')
  
  /** 是否为平板模式 */
  const isTablet = computed(() => mode.value === 'tablet')
  
  /** 是否为桌面模式 */
  const isDesktop = computed(() => mode.value === 'desktop')
  
  /** 是否使用手势导航 */
  const isGestureNavigation = computed(() => navigationMode.value === 'gesture')
  
  /** 是否使用三键导航 */
  const isButtonNavigation = computed(() => navigationMode.value === 'buttons')
  
  /** 按模式分组的预设 */
  const presetsByMode = computed(() => ({
    phone: SIZE_PRESETS.filter(p => p.mode === 'phone'),
    tablet: SIZE_PRESETS.filter(p => p.mode === 'tablet'),
    desktop: SIZE_PRESETS.filter(p => p.mode === 'desktop'),
  }))
  
  /** CSS变量对象 */
  const cssVariables = computed(() => ({
    '--device-width': `${dimensions.value.width}px`,
    '--device-height': `${dimensions.value.height}px`,
    '--device-radius': `${layout.value.borderRadius}px`,
    '--grid-columns': layout.value.columns,
    '--icon-size': `${layout.value.iconSize}px`,
    '--grid-gap': `${layout.value.gap}px`,
    '--master-width': `${layout.value.masterWidth}px`,
    '--device-orientation': orientation.value,
  }))
  
  /**
   * 计算推荐的缩放值
   * 考虑屏幕 DPI 和用户选择的缩放模式
   */
  const recommendedScale = computed(() => {
    const dpr = window.devicePixelRatio || 1
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const deviceWidth = dimensions.value.width
    const deviceHeight = dimensions.value.height
    const padding = 40
    
    switch (scaleMode.value) {
      case 'fit': {
        // 适应屏幕模式：填满可用空间
        const scaleByHeight = (viewportHeight - padding * 2) / deviceHeight
        const scaleByWidth = (viewportWidth - padding * 2) / deviceWidth
        return Math.min(scaleByHeight, scaleByWidth, 2.0)
      }
      
      case 'real': {
        // 真实尺寸模式：尝试模拟物理尺寸
        // 估算屏幕 PPI：假设标准 96 DPI 基础上乘以 devicePixelRatio
        const estimatedPPI = 96 * dpr
        // 目标物理宽度转为 CSS 像素
        const targetCSSWidth = targetPhysicalWidth.value * estimatedPPI / dpr
        return targetCSSWidth / deviceWidth
      }
      
      case 'custom': {
        return customScale.value
      }
      
      case 'auto':
      default: {
        // 自动模式：根据 DPI 智能调整
        // 高 DPI 屏幕使用较小的缩放，避免手机看起来太大
        const scaleByHeight = (viewportHeight - padding * 2) / deviceHeight
        const scaleByWidth = (viewportWidth - padding * 2) / deviceWidth
        let fitScale = Math.min(scaleByHeight, scaleByWidth)
        
        // 在高 DPI 屏幕上降低最大缩放值
        // DPR 1.0 -> maxScale 1.2
        // DPR 1.5 -> maxScale 0.9
        // DPR 2.0 -> maxScale 0.7
        // DPR 2.5 -> maxScale 0.6
        const maxScale = Math.max(0.5, 1.4 - (dpr - 1) * 0.4)
        
        return Math.min(fitScale, maxScale)
      }
    }
  })
  
  // ==================== 操作 ====================
  
  /**
   * 设置设备模式
   */
  function setMode(newMode: DeviceMode) {
    mode.value = newMode
    // 清除自定义尺寸
    customDimensions.value = null
    // 桌面模式强制竖屏（实际上是正常比例）
    if (newMode === 'desktop') {
      orientation.value = 'portrait'
    }
    // 选择该模式的第一个预设
    const firstPreset = SIZE_PRESETS.find(p => p.mode === newMode)
    if (firstPreset) {
      selectedPresetId.value = firstPreset.id
    }
    // 更新 HTML 属性用于全局 CSS 选择器
    document.documentElement.setAttribute('data-device', newMode)
    document.documentElement.setAttribute('data-orientation', orientation.value)
    // 应用 CSS 变量
    applyCssVariables()
  }
  
  /**
   * 设置屏幕方向
   */
  function setOrientation(newOrientation: Orientation) {
    if (!canRotate.value) return
    orientation.value = newOrientation
    document.documentElement.setAttribute('data-orientation', newOrientation)
    applyCssVariables()
  }
  
  /**
   * 切换横竖屏
   */
  function toggleOrientation() {
    if (!canRotate.value) return
    const newOrientation = orientation.value === 'portrait' ? 'landscape' : 'portrait'
    setOrientation(newOrientation)
  }
  
  /**
   * 选择尺寸预设
   */
  function selectPreset(presetId: string) {
    const preset = SIZE_PRESETS.find(p => p.id === presetId)
    if (preset) {
      selectedPresetId.value = presetId
      mode.value = preset.mode
      customDimensions.value = null
      document.documentElement.setAttribute('data-device', preset.mode)
      applyCssVariables()
    }
  }
  
  /**
   * 设置自定义尺寸
   */
  function setCustomDimensions(width: number, height: number) {
    customDimensions.value = { width, height }
    // 根据尺寸自动判断模式
    if (width <= 500) {
      mode.value = 'phone'
    } else if (width <= 1024) {
      mode.value = 'tablet'
    } else {
      mode.value = 'desktop'
    }
    document.documentElement.setAttribute('data-device', mode.value)
    applyCssVariables()
  }
  
  /**
   * 切换到下一个模式
   */
  function cycleMode() {
    const modes: DeviceMode[] = ['phone', 'tablet', 'desktop']
    const currentIndex = modes.indexOf(mode.value)
    const nextIndex = (currentIndex + 1) % modes.length
    setMode(modes[nextIndex])
  }
  
  /**
   * 切换自动适应
   */
  function toggleAutoFit() {
    autoFit.value = !autoFit.value
  }
  
  /**
   * 设置缩放模式
   */
  function setScaleMode(newMode: ScaleMode) {
    scaleMode.value = newMode
    localStorage.setItem('phone-sim-scale-mode', newMode)
  }
  
  /**
   * 设置自定义缩放值
   */
  function setCustomScale(scale: number) {
    customScale.value = Math.max(0.3, Math.min(3.0, scale))
    localStorage.setItem('phone-sim-custom-scale', String(customScale.value))
  }
  
  /**
   * 设置目标物理宽度
   */
  function setTargetPhysicalWidth(width: number) {
    targetPhysicalWidth.value = Math.max(1.5, Math.min(6.0, width))
    localStorage.setItem('phone-sim-target-width', String(targetPhysicalWidth.value))
  }
  
  /**
   * 设置导航模式
   */
  function setNavigationMode(mode: NavigationMode) {
    navigationMode.value = mode
    localStorage.setItem('phone-sim-navigation-mode', mode)
  }
  
  /**
   * 切换导航模式
   */
  function toggleNavigationMode() {
    const newMode = navigationMode.value === 'gesture' ? 'buttons' : 'gesture'
    setNavigationMode(newMode)
  }
  
  /**
   * 设置活跃面板（分屏模式）
   */
  function setActivePane(pane: 'master' | 'detail') {
    activePane.value = pane
  }
  
  /**
   * 切换活跃面板
   */
  function toggleActivePane() {
    activePane.value = activePane.value === 'master' ? 'detail' : 'master'
  }
  
  /**
   * 应用 CSS 变量到根元素
   */
  function applyCssVariables() {
    const root = document.documentElement
    const vars = cssVariables.value
    
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, String(value))
    })
  }
  
  /**
   * 初始化设备设置
   */
  function initialize() {
    // 从本地存储恢复设置
    const savedMode = localStorage.getItem('phone-sim-device-mode') as DeviceMode | null
    const savedPresetId = localStorage.getItem('phone-sim-device-preset')
    const savedOrientation = localStorage.getItem('phone-sim-device-orientation') as Orientation | null
    const savedScaleMode = localStorage.getItem('phone-sim-scale-mode') as ScaleMode | null
    const savedCustomScale = localStorage.getItem('phone-sim-custom-scale')
    const savedTargetWidth = localStorage.getItem('phone-sim-target-width')
    const savedNavigationMode = localStorage.getItem('phone-sim-navigation-mode') as NavigationMode | null
    
    if (savedPresetId) {
      const preset = SIZE_PRESETS.find(p => p.id === savedPresetId)
      if (preset) {
        selectedPresetId.value = savedPresetId
        mode.value = preset.mode
      }
    } else if (savedMode && DEVICE_CONFIGS[savedMode]) {
      mode.value = savedMode
    }
    
    // 恢复屏幕方向
    if (savedOrientation && mode.value !== 'desktop') {
      orientation.value = savedOrientation
    }
    
    // 恢复缩放设置
    if (savedScaleMode) {
      scaleMode.value = savedScaleMode
    }
    if (savedCustomScale) {
      customScale.value = parseFloat(savedCustomScale)
    }
    if (savedTargetWidth) {
      targetPhysicalWidth.value = parseFloat(savedTargetWidth)
    }
    
    // 恢复导航模式
    if (savedNavigationMode) {
      navigationMode.value = savedNavigationMode
    }
    
    // 应用初始设置
    document.documentElement.setAttribute('data-device', mode.value)
    document.documentElement.setAttribute('data-orientation', orientation.value)
    applyCssVariables()
    
    storeLogger.info('设备设置已初始化', {
      mode: mode.value,
      preset: selectedPresetId.value,
      orientation: orientation.value,
      scaleMode: scaleMode.value,
      navigationMode: navigationMode.value
    })
  }
  
  // 监听状态变化，保存到本地存储
  watch(mode, (newMode) => {
    localStorage.setItem('phone-sim-device-mode', newMode)
  })
  
  watch(selectedPresetId, (newPresetId) => {
    localStorage.setItem('phone-sim-device-preset', newPresetId)
  })
  
  watch(orientation, (newOrientation) => {
    localStorage.setItem('phone-sim-device-orientation', newOrientation)
  })
  
  watch(navigationMode, (newMode) => {
    localStorage.setItem('phone-sim-navigation-mode', newMode)
  })
  
  return {
    // 状态
    mode,
    autoFit,
    activePane,
    selectedPresetId,
    customDimensions,
    orientation,
    scaleMode,
    customScale,
    targetPhysicalWidth,
    navigationMode,
    
    // 计算属性
    dimensions,
    layout,
    isSplitView,
    isPhone,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    canRotate,
    isGestureNavigation,
    isButtonNavigation,
    cssVariables,
    selectedPreset,
    presetsByMode,
    recommendedScale,
    
    // 常量
    SIZE_PRESETS,
    
    // 操作
    setMode,
    selectPreset,
    setCustomDimensions,
    setOrientation,
    toggleOrientation,
    cycleMode,
    toggleAutoFit,
    setScaleMode,
    setCustomScale,
    setTargetPhysicalWidth,
    setNavigationMode,
    toggleNavigationMode,
    setActivePane,
    toggleActivePane,
    applyCssVariables,
    initialize,
  }
})