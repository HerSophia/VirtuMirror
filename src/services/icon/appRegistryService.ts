/**
 * 统一的 App 注册服务
 *
 * 解决之前分散注册的问题：
 * - 图标注册
 * - 桌面布局自动添加
 * - 路由配置（未来可扩展）
 *
 * 使用方式：
 * ```typescript
 * appRegistry.register({
 *   id: 'my-app',
 *   name: '我的应用',
 *   route: '/my-app',
 *   category: 'tool',
 *   icon: { type: 'font', value: 'fas fa-star', background: '#FF5722' },
 *   desktop: { show: true }  // 自动添加到桌面
 * })
 * ```
 */

import { iconService } from './iconService'
import { getGlobalConfigService } from '@/services/globalConfigService'
import type { RegisteredAppIcon, AppCategory, QuickActionConfig } from '@/types/icon'
import type { AppIconConfig } from '@/types/appPackage'
import type { DesktopItem, DesktopPage } from '@/apps/home/types'

/**
 * App 注册配置
 */
export interface AppRegistration {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 路由路径 */
  route: string
  /** 分类 */
  category: AppCategory
  /** 是否内置应用 */
  isBuiltin?: boolean

  // === 图标配置 ===
  /** 图标ID（默认与id相同） */
  iconId?: string
  /** 图标配置 */
  icon?: AppIconConfig

  // === 桌面配置 ===
  desktop?: {
    /** 是否显示在桌面（默认true） */
    show?: boolean
    /** 添加位置：auto=自动找空位, first=第一页开头, last=最后 */
    position?: 'auto' | 'first' | 'last'
    /** 指定添加到哪一页（0-based，默认自动） */
    page?: number
  }

  // === 快捷操作 ===
  quickActions?: QuickActionConfig[]

  // === 动态徽章 ===
  getBadge?: () => number
}

/**
 * 已注册的 App 列表（用于追踪）
 */
const registeredApps = new Map<string, AppRegistration>()

/**
 * 待添加到桌面的 App 队列
 * 在 HomeApp 挂载后会处理这个队列
 */
const pendingDesktopApps: AppRegistration[] = []

/**
 * 桌面布局更新回调
 */
let desktopUpdateCallback: ((apps: AppRegistration[]) => void) | null = null

/**
 * App 注册服务类
 */
class AppRegistryService {
  /**
   * 注册一个 App
   * 同时处理图标注册和桌面布局
   */
  register(config: AppRegistration, options?: { override?: boolean }): void {
    const { override = false } = options || {}

    // 检查是否已注册
    if (registeredApps.has(config.id) && !override) {
      console.warn(`[AppRegistry] App '${config.id}' already registered, skipping`)
      return
    }

    // 保存注册信息
    registeredApps.set(config.id, config)

    // 1. 注册图标
    this.registerIcon(config, { override })

    // 2. 处理桌面布局
    if (config.desktop?.show !== false) {
      this.ensureInDesktop(config)
    }

    console.log(`[AppRegistry] Registered app: ${config.id}`)
  }

  /**
   * 批量注册 App
   */
  registerAll(configs: AppRegistration[], options?: { override?: boolean }): void {
    for (const config of configs) {
      this.register(config, options)
    }
  }

  /**
   * 注册图标到 IconService
   */
  private registerIcon(config: AppRegistration, options?: { override?: boolean }): void {
    const iconConfig: RegisteredAppIcon = {
      id: config.id,
      iconId: config.iconId || config.id,
      name: config.name,
      route: config.route,
      category: config.category,
      isBuiltin: config.isBuiltin ?? true,
      icon: config.icon,
      quickActions: config.quickActions,
      getBadge: config.getBadge,
    }

    iconService.register(iconConfig, options)
  }

  /**
   * 确保 App 在桌面布局中
   */
  private ensureInDesktop(config: AppRegistration): void {
    try {
      const globalConfigService = getGlobalConfigService()
      const layout = globalConfigService.getDesktopLayout()

      if (!layout?.pages || layout.pages.length === 0) {
        // 布局还未初始化，加入待处理队列
        pendingDesktopApps.push(config)
        return
      }

      // 检查是否已存在
      const exists = layout.pages.some((page) =>
        page.items.some((item) => {
          if (item.type !== 'app') return false
          const appItem = item as DesktopItem & { route?: string; iconId?: string }
          return (
            appItem.route === config.route ||
            appItem.iconId === config.id ||
            item.id === `app-${config.id}`
          )
        })
      )

      if (exists) {
        return // 已存在，无需添加
      }

      // 创建桌面项
      const newItem: DesktopItem = {
        id: `app-${config.id}`,
        type: 'app',
        iconId: config.iconId || config.id,
        name: config.name,
        route: config.route,
        w: 1,
        h: 1,
      }

      // 添加到布局
      const updatedPages = this.addItemToLayout(layout.pages, newItem, config.desktop)

      // 保存更新后的布局
      globalConfigService.saveDesktopLayoutPages(
        updatedPages,
        layout.dockAppIds || ['wechat', 'browser', 'email', 'live'],
        layout.currentPageIndex ?? 0
      )

      console.log(`[AppRegistry] Added '${config.id}' to desktop layout`)

      // 通知桌面更新（如果有回调）
      if (desktopUpdateCallback) {
        desktopUpdateCallback([config])
      }
    } catch (error) {
      // GlobalConfigService 可能还未初始化
      pendingDesktopApps.push(config)
      console.log(`[AppRegistry] Queued '${config.id}' for later desktop addition`)
    }
  }

  /**
   * 添加项到布局
   */
  private addItemToLayout(
    pages: DesktopPage[],
    item: DesktopItem,
    desktopConfig?: AppRegistration['desktop']
  ): DesktopPage[] {
    const position = desktopConfig?.position || 'auto'
    const targetPage = desktopConfig?.page

    // 复制页面数组
    const newPages = pages.map((p) => ({ ...p, items: [...p.items] }))

    if (position === 'first') {
      // 添加到第一页开头
      if (newPages.length > 0) {
        newPages[0].items.unshift(item)
      }
    } else if (position === 'last') {
      // 添加到最后一页末尾
      if (newPages.length > 0) {
        newPages[newPages.length - 1].items.push(item)
      }
    } else {
      // auto: 找第一个有空位的页面
      const maxItemsPerPage = 20 // 4列 x 5行
      let added = false

      // 如果指定了页面
      if (targetPage !== undefined && targetPage < newPages.length) {
        if (newPages[targetPage].items.length < maxItemsPerPage) {
          newPages[targetPage].items.push(item)
          added = true
        }
      }

      // 自动找空位
      if (!added) {
        for (const page of newPages) {
          if (page.items.length < maxItemsPerPage) {
            page.items.push(item)
            added = true
            break
          }
        }
      }

      // 如果所有页面都满了，创建新页面
      if (!added) {
        newPages.push({
          id: `page-${newPages.length + 1}`,
          items: [item],
        })
      }
    }

    return newPages
  }

  /**
   * 获取所有已注册的 App
   */
  getAll(): AppRegistration[] {
    return Array.from(registeredApps.values())
  }

  /**
   * 获取指定 App 的注册信息
   */
  get(id: string): AppRegistration | undefined {
    return registeredApps.get(id)
  }

  /**
   * 检查 App 是否已注册
   */
  has(id: string): boolean {
    return registeredApps.has(id)
  }

  /**
   * 处理待添加到桌面的 App 队列
   * 由 HomeApp 在挂载后调用
   */
  processPendingDesktopApps(): AppRegistration[] {
    const pending = [...pendingDesktopApps]
    pendingDesktopApps.length = 0 // 清空队列

    for (const config of pending) {
      this.ensureInDesktop(config)
    }

    return pending
  }

  /**
   * 获取待处理的 App 列表（不清空）
   */
  getPendingDesktopApps(): AppRegistration[] {
    return [...pendingDesktopApps]
  }

  /**
   * 设置桌面更新回调
   * 当有新 App 添加到桌面时会调用
   */
  setDesktopUpdateCallback(callback: (apps: AppRegistration[]) => void): void {
    desktopUpdateCallback = callback
  }

  /**
   * 获取按分类分组的 App 列表
   */
  getByCategory(category: AppCategory): AppRegistration[] {
    return this.getAll().filter((app) => app.category === category)
  }

  /**
   * 获取所有应该显示在桌面的 App
   */
  getDesktopApps(): AppRegistration[] {
    return this.getAll().filter((app) => app.desktop?.show !== false)
  }
}

// 单例
export const appRegistry = new AppRegistryService()

// 导出便捷函数
export function registerApp(config: AppRegistration, options?: { override?: boolean }): void {
  appRegistry.register(config, options)
}

export function registerApps(
  configs: AppRegistration[],
  options?: { override?: boolean }
): void {
  appRegistry.registerAll(configs, options)
}
