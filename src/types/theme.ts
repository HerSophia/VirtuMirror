/**
 * 主题系统类型定义
 */

// ==================== App 图标配置 ====================

/**
 * App 图标 ID 枚举
 */
export type AppIconId =
  | 'wechat'
  | 'email'
  | 'browser'
  | 'live'
  | 'settings'
  | 'contacts'
  | 'gallery'
  | 'notes'
  | 'music'
  | 'video'
  | 'camera'
  | 'calendar'
  | 'clock'
  | 'calculator'
  | 'weather'
  | 'maps'
  | 'wallet'
  | 'prompts'
  | 'tutorial'
  | 'appstore'
  | 'bridge'
  | 'pathfinder-student'
  | 'api-manager'
  | 'weibo'

/**
 * 图标字体库类型
 */
export type IconFontFamily = 'font-awesome' | 'material-icons' | 'phosphor' | 'custom'

/**
 * 图标样式变体
 */
export type IconVariant = 'filled' | 'outlined' | 'rounded' | 'sharp' | 'two-tone'

/**
 * 单个图标配置
 */
export interface ThemeIconConfig {
  /** 图标类名（Font Awesome）或图标名称（Material Icons） */
  icon: string
  /** 背景颜色或渐变 */
  bg: string
  /** 图标颜色（默认白色） */
  color?: string
  /** 自定义圆角 */
  borderRadius?: string
  /** 特效类名（如发光、阴影等） */
  effectClass?: string
}

/**
 * App 图标集配置
 */
export interface AppIconSet {
  /** 图标类型 */
  type: 'font' | 'svg' | 'image'
  /** 图标字体库 */
  fontFamily: IconFontFamily
  /** 图标样式变体（主要用于 Material Icons） */
  variant?: IconVariant
  /** 各 App 图标配置映射 */
  icons: Partial<Record<AppIconId, ThemeIconConfig>>
}

// ==================== 颜色配置 ====================

/**
 * 主题颜色配置
 */
export interface ThemeColors {
  /** 主色调 */
  primary: string
  /** 次要颜色 */
  secondary: string
  /** 背景色 */
  background: string
  /** 表面/卡片背景色 */
  surface: string
  /** 表面变体色 */
  surfaceVariant: string
  /** 主要文字颜色 */
  text: string
  /** 次要文字颜色 */
  textSecondary: string
  /** 边框颜色 */
  border: string
  /** 成功状态颜色 */
  success: string
  /** 警告状态颜色 */
  warning: string
  /** 错误状态颜色 */
  error: string
}

/**
 * 设备外观配置
 */
export interface DeviceAppearance {
  /** 设备边框颜色 */
  frameColor: string
  /** 刘海样式 */
  notchStyle: 'dynamic-island' | 'notch' | 'pill' | 'none'
  /** 边框圆角 */
  borderRadius: number
  /** 阴影强度 */
  shadowIntensity: 'none' | 'light' | 'medium' | 'heavy'
}

/**
 * 壁纸配置
 */
export interface WallpaperConfig {
  /** 主屏幕壁纸 (URL 或 CSS 渐变) */
  homescreen?: string
  /** 锁屏壁纸 */
  lockscreen?: string
  /** 聊天背景 */
  chatBackground?: string
}

/**
 * 字体配置
 */
export interface TypographyConfig {
  /** 字体族 */
  fontFamily: string
  /** 基础字号 */
  baseFontSize: number
  /** 字重 */
  fontWeight: 'light' | 'normal' | 'medium'
}

/**
 * 完整主题定义
 */
export interface Theme {
  /** 主题唯一标识 */
  id: string
  /** 主题显示名称 */
  name: string
  /** 主题描述 */
  description?: string
  /** 颜色配置 */
  colors: ThemeColors
  /** 设备外观配置 */
  device: DeviceAppearance
  /** 壁纸配置 */
  wallpapers: WallpaperConfig
  /** 字体配置 */
  typography: TypographyConfig
  /** App 图标配置 */
  icons?: AppIconSet
  /** 是否为内置主题 */
  isBuiltin?: boolean
  /** 主题作者 */
  author?: string
  /** 主题版本 */
  version?: string
}

/**
 * 主题配置存储结构
 */
export interface ThemeConfig {
  /** 当前激活的主题 ID */
  activeThemeId: string
  /** 自定义主题列表 */
  customThemes: Theme[]
  /** 元数据 */
  _meta: {
    version: string
    lastUpdated: string
  }
}

/**
 * 主题预览信息（用于主题选择器）
 */
export interface ThemePreview {
  id: string
  name: string
  description?: string
  primaryColor: string
  backgroundColor: string
  isBuiltin: boolean
}