import { ref, shallowRef, computed, type Ref } from 'vue'

export type SettingsCategory = 
  | 'connectivity'  // 网络与连接
  | 'personalization' // 个性化
  | 'apps'           // 应用管理
  | 'system'         // 系统
  | 'privacy'        // 隐私与安全
  | 'other'          // 其他

export interface SettingsEntry {
  /** 唯一标识符 */
  id: string
  
  /** 显示标题 */
  title: string
  
  /** 副标题/当前状态描述 (可选) */
  subtitle?: string | Ref<string>
  
  /** 图标配置 */
  icon?: {
    type: 'fontawesome' | 'image' | 'text'
    value: string
    color?: string
    backgroundColor?: string
  }
  
  /** 所属分类 */
  category: SettingsCategory
  
  /** 优先级 (数字越小越靠前) */
  priority?: number
  
  /** 交互行为 (二选一) */
  action?: {
    type: 'route' | 'click' | 'toggle'
    value: string | (() => void) | Ref<boolean>
  }
  
  /** 权限控制 (可选) */
  permissions?: string[]
}

export interface CategoryDef {
  id: SettingsCategory
  title: string
  priority: number
}

class SettingsRegistryService {
  private entries = shallowRef<SettingsEntry[]>([])
  
  private categories: CategoryDef[] = [
    { id: 'connectivity', title: '网络与连接', priority: 10 },
    { id: 'personalization', title: '个性化', priority: 20 },
    { id: 'apps', title: '应用管理', priority: 30 },
    { id: 'privacy', title: '隐私与安全', priority: 40 },
    { id: 'system', title: '系统', priority: 50 },
    { id: 'other', title: '其他', priority: 100 }
  ]

  /**
   * 注册一个新的设置项
   * @param entry 设置项配置
   */
  register(entry: SettingsEntry) {
    // 检查是否存在同名 ID，如果存在则更新
    const existingIndex = this.entries.value.findIndex(e => e.id === entry.id)
    if (existingIndex >= 0) {
      this.entries.value[existingIndex] = entry
    } else {
      this.entries.value.push(entry)
    }
  }

  /**
   * 移除设置项
   * @param id 设置项 ID
   */
  unregister(id: string) {
    const index = this.entries.value.findIndex(e => e.id === id)
    if (index >= 0) {
      this.entries.value.splice(index, 1)
    }
  }

  /**
   * 获取按分类分组的设置项
   */
  getGroupedEntries() {
    return computed(() => {
      const grouped = new Map<SettingsCategory, SettingsEntry[]>()
      
      // 初始化 Map
      this.categories.forEach(cat => {
        grouped.set(cat.id, [])
      })
      
      // 填充数据
      this.entries.value.forEach(entry => {
        const list = grouped.get(entry.category)
        if (list) {
          list.push(entry)
        } else {
          // 如果分类不存在，放入 other
          const other = grouped.get('other')
          other?.push(entry)
        }
      })
      
      // 排序
      for (const [key, list] of grouped) {
        list.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50))
      }
      
      return grouped
    })
  }

  /**
   * 获取所有分类定义（按优先级排序）
   */
  getCategories() {
    return this.categories.sort((a, b) => a.priority - b.priority)
  }
  
  /**
   * 根据分类ID获取分类标题
   */
  getCategoryTitle(id: string): string {
    return this.categories.find(c => c.id === id)?.title || '其他'
  }
}

export const settingsRegistry = new SettingsRegistryService()
