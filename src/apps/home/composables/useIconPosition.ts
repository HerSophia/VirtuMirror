/**
 * 图标位置管理 Composable
 * 用于 zoom 动画的原点计算
 */
import { ref } from 'vue'
import { useAppStateStore, getAppIdFromRoute } from '@/stores/appStateStore'
import type { IconPosition } from '../types'

/**
 * 图标位置管理
 */
export function useIconPosition() {
  const appStateStore = useAppStateStore()
  
  /** 图标元素引用映射 */
  const iconRefs = ref<Map<string, HTMLElement>>(new Map())
  
  /**
   * 设置图标元素引用
   * @param appId App ID
   * @param el 图标 DOM 元素
   */
  function setIconRef(appId: string, el: HTMLElement | null) {
    if (el) {
      iconRefs.value.set(appId, el)
    }
  }
  
  /**
   * 通过路由路径设置图标引用
   * @param route 路由路径
   * @param el 图标 DOM 元素
   */
  function setIconRefByRoute(route: string, el: HTMLElement | null) {
    const appId = getAppIdFromRoute(route)
    setIconRef(appId, el)
  }
  
  /**
   * 注册单个图标位置到 appStateStore
   * @param appId App ID
   * @param element 图标 DOM 元素
   * @param container 容器元素（用于计算相对位置）
   */
  function registerIcon(appId: string, element: HTMLElement, container: HTMLElement) {
    appStateStore.registerIconFromElement(appId, element, container)
  }
  
  /**
   * 批量注册所有已收集的图标位置
   * @param container 容器元素
   */
  function registerAllIcons(container: HTMLElement) {
    for (const [appId, element] of iconRefs.value.entries()) {
      appStateStore.registerIconFromElement(appId, element, container)
    }
    console.log('[useIconPosition] 已注册所有图标位置', appStateStore.appStates)
  }
  
  /**
   * 获取指定 App 的图标位置
   * @param appId App ID
   * @returns 图标位置，如果未注册则返回 null
   */
  function getIconPosition(appId: string): IconPosition | null {
    return appStateStore.getIconPosition(appId)
  }
  
  /**
   * 通过路由路径获取图标位置
   * @param route 路由路径
   * @returns 图标位置
   */
  function getIconPositionByRoute(route: string): IconPosition | null {
    const appId = getAppIdFromRoute(route)
    return getIconPosition(appId)
  }
  
  /**
   * 清除所有图标引用
   */
  function clearIconRefs() {
    iconRefs.value.clear()
  }
  
  return {
    iconRefs,
    setIconRef,
    setIconRefByRoute,
    registerIcon,
    registerAllIcons,
    getIconPosition,
    getIconPositionByRoute,
    clearIconRefs,
  }
}