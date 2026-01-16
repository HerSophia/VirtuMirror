/**
 * 图标系统类型定义
 */
import type { AppIconId } from '@/types/theme'
import type { AppIconConfig as PackageIconConfig } from '@/types/appPackage'

/**
 * App 分类
 * 注意：这里融合了 appPackage 和 useDesktopOrganize 的定义，以兼容现有代码
 */
export type AppCategory = 
  | 'social' 
  | 'tool' 
  | 'tools'
  | 'entertainment' 
  | 'productivity' 
  | 'system' 
  | 'lifestyle'
  | 'games'
  | 'other'

/**
 * 快捷操作配置
 */
export interface QuickActionConfig {
  id: string
  label: string
  icon?: string
  route?: string
  action?: () => void
}

/**
 * 注册的 App 图标信息
 */
export interface RegisteredAppIcon {
  /** 唯一标识（通常与路由相关，如 'wechat', 'email'） */
  id: string
  /** 图标 ID（用于主题图标映射） */
  iconId?: AppIconId | string
  /** 显示名称 */
  name: string
  /** 路由路径 */
  route: string
  /** 自定义图标配置（优先级高于 iconId） */
  icon?: PackageIconConfig
  /** App 分类（用于一键整理） */
  category?: AppCategory
  /** 是否为内置 App */
  isBuiltin?: boolean
  /** 获取 badge 数量的函数 */
  getBadge?: () => number
  /** 快捷操作配置 */
  quickActions?: QuickActionConfig[]
}

/**
 * 图标注册选项
 */
export interface IconRegistrationOptions {
  /** 是否覆盖已存在的注册 */
  override?: boolean
}

// Re-export common types for convenience
export type { AppIconId, PackageIconConfig }
