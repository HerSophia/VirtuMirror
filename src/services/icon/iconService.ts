import { type Ref, isRef } from 'vue'
import type { RegisteredAppIcon, IconRegistrationOptions, AppCategory } from '@/types/icon'
import { loggerService } from '@/services/logger/loggerService'

/**
 * 图标服务 - 核心逻辑层
 * 负责图标的注册、验证和管理，但不直接持有状态（状态由 Store 注入）
 */
export class IconService {
  private static instance: IconService
  
  /** 注入的响应式状态 */
  private _icons: Ref<Map<string, RegisteredAppIcon>> | null = null
  
  /** 监听器列表 (用于向后兼容) */
  private _listeners: Set<() => void> = new Set()

  /**
   * 获取单例
   */
  static getInstance(): IconService {
    if (!this.instance) this.instance = new IconService()
    return this.instance
  }

  /**
   * 初始化服务，注入状态
   * @param state 包含图标 Map 的 Ref
   */
  init(state: { icons: Ref<Map<string, RegisteredAppIcon>> }) {
    this._icons = state.icons
    loggerService.info('IconService', 'Initialized with store state')
  }

  /**
   * 注册一个 App 图标
   */
  register(icon: RegisteredAppIcon, options: IconRegistrationOptions = {}): boolean {
    if (!this._icons) {
      loggerService.warn('IconService', 'Service not initialized, caching registration or failing...')
      // 在实际生产中，这里可能需要一个临时队列，等 init 后再应用。
      // 但现在我们假设 Store 会在 App 启动最早阶段初始化。
      return false
    }
    
    const { override = false } = options
    const iconsMap = this._icons.value
    
    if (iconsMap.has(icon.id) && !override) {
      loggerService.warn('IconService', `图标 ${icon.id} 已存在，跳过注册。使用 override: true 覆盖。`)
      return false
    }
    
    // 验证必要字段
    if (!icon.id || !icon.name) {
      loggerService.error('IconService', '注册失败：缺少 id 或 name', icon)
      return false
    }
    
    iconsMap.set(icon.id, icon)
    this._notifyListeners()
    loggerService.debug('IconService', `已注册图标: ${icon.id} (${icon.name})`)
    return true
  }
  
  /**
   * 批量注册图标
   */
  registerAll(icons: RegisteredAppIcon[], options: IconRegistrationOptions = {}): void {
    icons.forEach(icon => this.register(icon, options))
  }
  
  /**
   * 取消注册图标
   */
  unregister(id: string): boolean {
    if (!this._icons) return false
    
    const success = this._icons.value.delete(id)
    if (success) {
      this._notifyListeners()
      loggerService.debug('IconService', `已取消注册图标: ${id}`)
    }
    return success
  }
  
  /**
   * 获取单个图标配置
   */
  get(id: string): RegisteredAppIcon | undefined {
    return this._icons?.value.get(id)
  }
  
  /**
   * 获取所有已注册的图标
   */
  getAll(): RegisteredAppIcon[] {
    if (!this._icons) return []
    return Array.from(this._icons.value.values())
  }

  /**
   * 检查图标是否已注册
   */
  has(id: string): boolean {
    return this._icons?.value.has(id) ?? false
  }

  /**
   * 清除所有注册
   */
  clear(): void {
    if (!this._icons) return
    this._icons.value.clear()
    this._notifyListeners()
  }

  /**
   * 订阅图标变化 (兼容旧 API)
   */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }
  
  private _notifyListeners(): void {
    this._listeners.forEach(listener => {
      try {
        listener()
      } catch (e) {
        loggerService.error('IconService', '监听器执行出错:', e)
      }
    })
  }
}

export const iconService = IconService.getInstance()
