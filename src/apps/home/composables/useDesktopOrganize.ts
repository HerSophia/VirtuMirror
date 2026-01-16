/**
 * 桌面整理功能
 * 提供自动整理和分类摆放能力
 */
import type { DesktopItem, AppItem, DesktopPage } from '../types'
import { getIconRegistryService, type AppCategory } from '@/services/iconRegistryService'

/**
 * App 分类配置（静态配置，作为后备）
 * 优先使用图标注册服务中的分类信息
 */
export const APP_CATEGORIES: Record<string, AppCategory> = {
  // 社交通讯
  'wechat': 'social',
  'chat': 'social',
  'email': 'social',
  
  // 工具
  'browser': 'tool',
  'settings': 'system',
  'appstore': 'tool',
  'gallery': 'tool',
  
  // 娱乐
  'live': 'entertainment',
  
  // 效率办公
  'prompts': 'productivity',
  'pathfinder-student': 'productivity',
  'api-manager': 'productivity',
  'bridge': 'productivity',
  
  // 系统
  'tutorial': 'system',
}

/**
 * 分类显示顺序和名称
 */
export const CATEGORY_ORDER: { key: AppCategory; name: string }[] = [
  { key: 'social', name: '社交通讯' },
  { key: 'productivity', name: '效率办公' },
  { key: 'tool', name: '工具' },
  { key: 'entertainment', name: '娱乐' },
  { key: 'system', name: '系统' },
  { key: 'other', name: '其他' },
]

/**
 * 获取 App 的分类
 * 优先从图标注册服务获取，回退到静态配置，最后按路由推断
 */
export function getAppCategory(item: DesktopItem): AppCategory {
  if (item.type !== 'app') return 'other'
  
  const appItem = item as AppItem
  const iconId = appItem.iconId as string
  
  // 1. 优先从图标注册服务获取分类
  const iconRegistry = getIconRegistryService()
  const registered = iconRegistry.get(iconId)
  if (registered?.category) {
    return registered.category
  }
  
  // 2. 回退到静态配置
  if (APP_CATEGORIES[iconId]) {
    return APP_CATEGORIES[iconId]
  }
  
  // 3. 按 route 关键词推断
  const route = appItem.route.toLowerCase()
  if (route.includes('chat') || route.includes('email') || route.includes('message')) {
    return 'social'
  }
  if (route.includes('live') || route.includes('video') || route.includes('music')) {
    return 'entertainment'
  }
  if (route.includes('setting') || route.includes('tutorial') || route.includes('help')) {
    return 'system'
  }
  if (route.includes('browser') || route.includes('store') || route.includes('gallery')) {
    return 'tool'
  }
  if (route.includes('prompt') || route.includes('api') || route.includes('bridge')) {
    return 'productivity'
  }
  
  return 'other'
}

/**
 * 桌面整理 Composable
 */
export function useDesktopOrganize() {
  /**
   * 查找第一个空位
   * @param pages 桌面页面列表
   * @param columns 每行列数
   * @param maxRows 每页最大行数
   * @returns 空位信息 { pageIndex, x, y } 或 null（需要新建页面）
   */
  function findFirstEmptySlot(
    pages: DesktopPage[],
    columns: number = 4,
    maxRows: number = 5
  ): { pageIndex: number; x: number; y: number } | null {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex]
      const occupied = new Set<string>()
      
      // 标记已占用的位置
      page.items.forEach(item => {
        if (item.x !== undefined && item.y !== undefined) {
          for (let dx = 0; dx < item.w; dx++) {
            for (let dy = 0; dy < item.h; dy++) {
              occupied.add(`${item.x + dx},${item.y + dy}`)
            }
          }
        }
      })
      
      // 如果没有位置信息，按顺序分配
      if (page.items.every(item => item.x === undefined)) {
        const usedCount = page.items.length
        if (usedCount < columns * maxRows) {
          const x = usedCount % columns
          const y = Math.floor(usedCount / columns)
          return { pageIndex, x, y }
        }
        continue
      }
      
      // 查找空位
      for (let y = 0; y < maxRows; y++) {
        for (let x = 0; x < columns; x++) {
          if (!occupied.has(`${x},${y}`)) {
            return { pageIndex, x, y }
          }
        }
      }
    }
    
    // 所有页面都满了，返回 null 表示需要新建页面
    return null
  }
  
  /**
   * 自动添加新 App 到桌面
   * @param pages 桌面页面列表（会被修改）
   * @param newItem 要添加的新项目
   * @param columns 每行列数
   * @param maxRows 每页最大行数
   * @returns 添加到的页面索引
   */
  function autoAddApp(
    pages: DesktopPage[],
    newItem: DesktopItem,
    columns: number = 4,
    maxRows: number = 5
  ): number {
    const slot = findFirstEmptySlot(pages, columns, maxRows)
    
    if (slot) {
      // 找到空位，添加到该位置
      const itemWithPosition: DesktopItem = {
        ...newItem,
        x: slot.x,
        y: slot.y,
      }
      pages[slot.pageIndex].items.push(itemWithPosition)
      console.log('[useDesktopOrganize] 添加 App 到页面', slot.pageIndex, '位置:', slot.x, slot.y)
      return slot.pageIndex
    } else {
      // 需要新建页面
      const newPageId = `page-${Date.now()}`
      const newPage: DesktopPage = {
        id: newPageId,
        items: [{ ...newItem, x: 0, y: 0 }]
      }
      pages.push(newPage)
      console.log('[useDesktopOrganize] 创建新页面添加 App')
      return pages.length - 1
    }
  }
  
  /**
   * 一键整理桌面
   * 按照 App 功能分类重新排列
   * @param pages 桌面页面列表
   * @param columns 每行列数
   * @param maxRows 每页最大行数
   * @returns 整理后的页面列表
   */
  function organizeDesktop(
    pages: DesktopPage[],
    columns: number = 4,
    maxRows: number = 5
  ): DesktopPage[] {
    // 收集所有 App
    const allApps: DesktopItem[] = []
    pages.forEach(page => {
      page.items.forEach(item => {
        allApps.push(item)
      })
    })
    
    // 按分类分组
    const categorizedApps: Partial<Record<AppCategory, DesktopItem[]>> = {}
    
    // 初始化已知分类
    CATEGORY_ORDER.forEach(({ key }) => {
      categorizedApps[key] = []
    })
    
    allApps.forEach(app => {
      const category = getAppCategory(app)
      if (!categorizedApps[category]) {
        // 如果是未知分类（不在 CATEGORY_ORDER 中），放入 other
        if (!categorizedApps['other']) categorizedApps['other'] = []
        categorizedApps['other']!.push(app)
      } else {
        categorizedApps[category]!.push(app)
      }
    })
    
    // 按分类顺序重新排列
    const sortedApps: DesktopItem[] = []
    CATEGORY_ORDER.forEach(({ key }) => {
      if (categorizedApps[key]) {
        sortedApps.push(...categorizedApps[key]!)
      }
    })
    
    // 重新分配到页面
    const newPages: DesktopPage[] = []
    const itemsPerPage = columns * maxRows
    
    for (let i = 0; i < sortedApps.length; i += itemsPerPage) {
      const pageItems = sortedApps.slice(i, i + itemsPerPage)
      const pageId = i === 0 ? 'page-1' : `page-${Date.now()}-${Math.floor(i / itemsPerPage)}`
      
      // 为每个 item 分配位置
      const itemsWithPosition = pageItems.map((item, index) => ({
        ...item,
        x: index % columns,
        y: Math.floor(index / columns),
      }))
      
      newPages.push({
        id: pageId,
        items: itemsWithPosition,
      })
    }
    
    // 确保至少有一页
    if (newPages.length === 0) {
      newPages.push({ id: 'page-1', items: [] })
    }
    
    console.log('[useDesktopOrganize] 整理完成，共', sortedApps.length, '个 App，分布在', newPages.length, '页')
    
    return newPages
  }
  
  /**
   * 获取整理预览信息
   * @param pages 当前桌面页面
   * @returns 分类统计信息
   */
  function getOrganizePreview(pages: DesktopPage[]): { category: string; count: number }[] {
    const counts: Partial<Record<AppCategory, number>> = {}
    
    // 初始化
    CATEGORY_ORDER.forEach(({ key }) => {
      counts[key] = 0
    })
    
    pages.forEach(page => {
      page.items.forEach(item => {
        const category = getAppCategory(item)
        // 确保 key 存在，或者归类到 other
        const targetKey = counts[category] !== undefined ? category : 'other'
        if (counts[targetKey] !== undefined) {
           counts[targetKey]!++
        } else {
           counts['other'] = (counts['other'] || 0) + 1
        }
      })
    })
    
    return CATEGORY_ORDER
      .filter(({ key }) => (counts[key] || 0) > 0)
      .map(({ key, name }) => ({
        category: name,
        count: counts[key] || 0,
      }))
  }
  
  return {
    findFirstEmptySlot,
    autoAddApp,
    organizeDesktop,
    getOrganizePreview,
    getAppCategory,
  }
}
