/**
 * 全局图标注册服务 (Legacy Facade)
 *
 * 这是一个兼容层，将原有逻辑桥接到新的架构：
 * Service (src/services/icon/iconService) + Store (src/stores/iconStore)
 *
 * 新开发请直接使用 useIconStore() 或 iconService
 */
import { computed, type ComputedRef } from 'vue'
import { iconService } from './iconService'
import { useIconStore } from '@/stores/iconStore'
import type {
  RegisteredAppIcon,
  IconRegistrationOptions,
  AppCategory,
  QuickActionConfig,
} from '@/types/icon'
import { loggerService } from '@/services/logger/loggerService'

// 重新导出类型以保持兼容性
export type { RegisteredAppIcon, IconRegistrationOptions, AppCategory, QuickActionConfig }

/**
 * 图标注册服务类 (Facade)
 */
class IconRegistryServiceFacade {
  /**
   * 确保 Store 已初始化
   */
  private _ensureStore() {
    try {
      useIconStore()
    } catch (e) {
      loggerService.warn('IconRegistry', 'Failed to initialize store (Pinia not active?)', e)
    }
  }

  /**
   * 注册一个 App 图标
   */
  register(icon: RegisteredAppIcon, options: IconRegistrationOptions = {}): boolean {
    this._ensureStore()
    return iconService.register(icon, options)
  }

  /**
   * 批量注册图标
   */
  registerAll(icons: RegisteredAppIcon[], options: IconRegistrationOptions = {}): void {
    this._ensureStore()
    iconService.registerAll(icons, options)
  }

  /**
   * 取消注册图标
   */
  unregister(id: string): boolean {
    this._ensureStore()
    return iconService.unregister(id)
  }

  /**
   * 获取单个图标配置
   */
  get(id: string): RegisteredAppIcon | undefined {
    // 即使没初始化 store，service.get 可能返回 undefined，这也是预期的
    return iconService.get(id)
  }

  /**
   * 获取所有已注册的图标
   */
  getAll(): RegisteredAppIcon[] {
    return iconService.getAll()
  }

  /**
   * 获取所有内置 App 图标
   */
  getBuiltinApps(): RegisteredAppIcon[] {
    return this.getAll().filter((icon) => icon.isBuiltin)
  }

  /**
   * 获取指定分类的图标
   */
  getByCategory(category: AppCategory): RegisteredAppIcon[] {
    return this.getAll().filter((icon) => icon.category === category)
  }

  /**
   * 检查图标是否已注册
   */
  has(id: string): boolean {
    return iconService.has(id)
  }

  /**
   * 已注册图标数量
   */
  get size(): number {
    return this.getAll().length
  }

  /**
   * 响应式的图标映射（用于 Vue 组件）
   */
  get icons(): ComputedRef<Map<string, RegisteredAppIcon>> {
    const store = useIconStore()
    return computed(() => store.icons)
  }

  /**
   * 响应式的图标列表
   */
  get iconList(): ComputedRef<RegisteredAppIcon[]> {
    const store = useIconStore()
    return computed(() => store.allIcons)
  }

  /**
   * 订阅图标变化
   */
  subscribe(listener: () => void): () => void {
    return iconService.subscribe(listener)
  }

  /**
   * 清除所有注册（主要用于测试）
   */
  clear(): void {
    this._ensureStore()
    iconService.clear()
  }
}

// 单例实例
const iconRegistryService = new IconRegistryServiceFacade()

/**
 * 获取图标注册服务实例
 */
export function getIconRegistryService(): IconRegistryServiceFacade {
  return iconRegistryService
}

// 也导出默认实例，方便使用
export { iconRegistryService }
export default iconRegistryService
