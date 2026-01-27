/**
 * App 运行时上下文
 *
 * 使用 Vue 的 provide/inject 机制在组件树中传递 AppRuntime
 * 同时支持在非组件上下文中通过全局注册表访问
 */

import { provide, inject, getCurrentInstance, type InjectionKey } from 'vue'
import type { AppRuntime, ScopedStorage } from './types'

export const APP_RUNTIME_KEY: InjectionKey<AppRuntime> = Symbol('AppRuntime')

// ==================== 全局注册表 ====================
// 用于在非组件上下文中访问 AppRuntime

const runtimeRegistry = new Map<string, AppRuntime>()
let currentRuntimeId: string | null = null

/**
 * 注册 AppRuntime 到全局注册表
 * @internal 由 provideAppRuntime 内部调用
 */
function registerRuntime(runtime: AppRuntime): void {
  const appId = runtime.identity.appId
  runtimeRegistry.set(appId, runtime)
  currentRuntimeId = appId
}

/**
 * 从全局注册表取消注册
 */
export function unregisterAppRuntime(appId: string): void {
  runtimeRegistry.delete(appId)
  if (currentRuntimeId === appId) {
    // 回退到最近注册的 runtime
    const keys = Array.from(runtimeRegistry.keys())
    currentRuntimeId = keys.length > 0 ? keys[keys.length - 1] : null
  }
}

/**
 * 获取当前活动的 runtime（从全局注册表）
 */
function getCurrentRuntimeFromRegistry(): AppRuntime | null {
  if (!currentRuntimeId) return null
  return runtimeRegistry.get(currentRuntimeId) || null
}

// ==================== Vue Context API ====================

/**
 * 在 App 容器中提供 runtime
 * 同时注册到全局注册表，以便在非组件上下文中访问
 */
export function provideAppRuntime(runtime: AppRuntime): void {
  provide(APP_RUNTIME_KEY, runtime)
  registerRuntime(runtime)
}

/**
 * 在 App 组件中使用 runtime
 * @throws 如果在非 App 上下文中调用
 */
export function useAppRuntime(): AppRuntime {
  const runtime = inject(APP_RUNTIME_KEY)
  if (!runtime) {
    throw new Error('useAppRuntime must be called within an App context')
  }
  return runtime
}

/**
 * 获取存储 API（便捷方法）
 */
export function useAppStorage(): ScopedStorage {
  return useAppRuntime().storage
}

/**
 * 获取系统 API（便捷方法）
 */
export function useAppSystem() {
  return useAppRuntime().system
}

/**
 * 尝试获取 AppRuntime，如果不存在返回 null
 * 
 * 安全地在任何上下文中使用：
 * - 在组件上下文中：优先使用 inject()
 * - 在非组件上下文中（如 Pinia store action）：回退到全局注册表
 */
export function tryUseAppRuntime(): AppRuntime | null {
  // 检查是否在 Vue 组件上下文中
  const instance = getCurrentInstance()
  
  if (instance) {
    // 在组件上下文中，使用 inject
    const runtime = inject(APP_RUNTIME_KEY, null)
    if (runtime) return runtime
  }
  
  // 回退到全局注册表
  return getCurrentRuntimeFromRegistry()
}
