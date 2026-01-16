/**
 * Home App 类型定义
 * 使用 GridStack.js 实现桌面布局
 */
import type { AppIconId } from '@/types/theme'
import type { IconConfig } from '@/types/appPackage'

/**
 * 桌面项类型
 */
export type DesktopItemType = 'app' | 'widget' | 'group'

/**
 * 基础桌面项配置
 */
export interface BaseDesktopItem {
  /** 唯一标识 */
  id: string
  /** 项类型 */
  type: DesktopItemType
  /** 网格宽度 (1-4) */
  w: number
  /** 网格高度 */
  h: number
  /** X 坐标 (可选，GridStack 会自动计算) */
  x?: number
  /** Y 坐标 (可选，GridStack 会自动计算) */
  y?: number
}

/**
 * 桌面 App 项配置
 */
export interface AppItem extends BaseDesktopItem {
  type: 'app'
  /** App 图标 ID */
  iconId: AppIconId | string
  /** 显示名称 */
  name: string
  /** 路由路径 */
  route: string
  /** 徽章数量（未读消息等） */
  badge?: number
  /** 自定义图标配置 */
  icon?: IconConfig
}

/**
 * 桌面小组件配置
 */
export interface WidgetItem extends BaseDesktopItem {
  type: 'widget'
  /** 小组件类型 */
  widgetType: string
  /** 小组件内容 */
  content?: string
}

/**
 * 分组框配置
 */
export interface GroupItem extends BaseDesktopItem {
  type: 'group'
  /** 分组标题 */
  title: string
  /** 子项（App 列表） */
  children: AppItem[]
}

/**
 * 桌面项联合类型
 */
export type DesktopItem = AppItem | WidgetItem | GroupItem

/**
 * 图标网格配置
 */
export interface GridConfig {
  /** 每行列数 */
  columns: number
  /** 行间距 (px) */
  rowGap: number
  /** 列间距 (px) */
  columnGap: number
}

/**
 * 图标位置信息（用于 zoom 动画）
 */
export interface IconPosition {
  /** 相对于容器的 x 坐标（百分比 0-100） */
  x: number
  /** 相对于容器的 y 坐标（百分比 0-100） */
  y: number
}

/**
 * 桌面页配置
 */
export interface DesktopPage {
  /** 页面唯一标识 */
  id: string
  /** 页面内的项目列表 */
  items: DesktopItem[]
}

/**
 * 多页桌面布局配置
 */
export interface DesktopLayout {
  /** 桌面页列表 */
  pages: DesktopPage[]
  /** 当前页索引 */
  currentPage?: number
}

// ======== 快捷操作相关类型 ========

/**
 * App 快捷操作类型
 */
export type AppQuickActionType = 'share' | 'uninstall' | 'remove' | 'shortcut'

/**
 * App 快捷操作配置
 */
export interface AppQuickAction {
  /** 操作唯一标识 */
  id: string
  /** 操作类型 */
  type: AppQuickActionType
  /** 显示标签 */
  label: string
  /** 图标（可选） */
  icon?: string
  /** 是否为危险操作 */
  danger?: boolean
  /** 快捷入口路由（仅 shortcut 类型） */
  route?: string
}

/**
 * 默认的系统快捷操作（分享、卸载）
 */
export const DEFAULT_SYSTEM_ACTIONS: AppQuickAction[] = [
  { id: 'share', type: 'share', label: '分享', icon: 'share' },
  { id: 'uninstall', type: 'uninstall', label: '卸载', icon: 'trash', danger: true },
]

/**
 * App 快捷入口配置
 * 根据 appId 返回快捷入口列表
 */
export const APP_SHORTCUTS: Record<string, AppQuickAction[]> = {
  wechat: [
    { id: 'wechat-scan', type: 'shortcut', label: '扫一扫', icon: 'scan', route: '/chat?action=scan' },
    { id: 'wechat-pay', type: 'shortcut', label: '收付款', icon: 'wallet', route: '/chat?action=pay' },
  ],
  browser: [
    { id: 'browser-new-tab', type: 'shortcut', label: '新建标签页', icon: 'plus', route: '/browser?action=new' },
    { id: 'browser-history', type: 'shortcut', label: '历史记录', icon: 'history', route: '/browser/history' },
    { id: 'browser-search', type: 'shortcut', label: '搜索', icon: 'search', route: '/browser?action=search' },
  ],
  email: [
    { id: 'email-compose', type: 'shortcut', label: '写邮件', icon: 'edit', route: '/email?action=compose' },
    { id: 'email-inbox', type: 'shortcut', label: '收件箱', icon: 'inbox', route: '/email' },
  ],
  settings: [
    { id: 'settings-theme', type: 'shortcut', label: '主题设置', icon: 'palette', route: '/settings/theme' },
    { id: 'settings-about', type: 'shortcut', label: '关于手机', icon: 'info', route: '/settings/about' },
  ],
  live: [
    { id: 'live-popular', type: 'shortcut', label: '热门直播', icon: 'fire', route: '/live?tab=popular' },
    { id: 'live-follow', type: 'shortcut', label: '关注', icon: 'heart', route: '/live?tab=follow' },
  ],
}

/**
 * 获取 App 的快捷操作列表（快捷入口 + 系统操作）
 */
export function getAppQuickActions(appId: string): AppQuickAction[] {
  const shortcuts = APP_SHORTCUTS[appId] || []
  return [...shortcuts, ...DEFAULT_SYSTEM_ACTIONS]
}

// ======== Dock 栏类型 ========

/**
 * Dock 栏 App 项（简化版本，用于 Dock 栏显示）
 * 不需要完整的网格布局信息
 */
export interface DockAppItem {
  /** App ID（用于图标映射） */
  id: AppIconId | string
  /** 图标 ID（可选，默认使用 id） */
  iconId?: AppIconId | string
  /** 显示名称 */
  name: string
  /** 路由路径 */
  route: string
  /** 徽章数量 */
  badge?: number
  /** 自定义图标配置 */
  icon?: IconConfig
}

/**
 * 将 AppItem 转换为 DockAppItem
 */
export function toDockAppItem(item: AppItem): DockAppItem {
  return {
    id: item.id,
    iconId: item.iconId,
    name: item.name,
    route: item.route,
    badge: item.badge,
    icon: item.icon,
  }
}

// ======== 兼容旧接口（逐步废弃）========

/**
 * @deprecated 使用 AppItem 替代
 */
export interface LegacyAppItem {
  id: AppIconId | string
  name: string
  route: string
  badge?: number
}

/**
 * 将旧的 AppItem 转换为新格式
 */
export function convertLegacyAppItem(item: LegacyAppItem, index: number): AppItem {
  return {
    id: `app-${item.id}`,
    type: 'app',
    iconId: item.id,
    name: item.name,
    route: item.route,
    badge: item.badge,
    w: 1,
    h: 1,
  }
}