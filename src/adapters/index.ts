/**
 * 适配器模块入口
 * 提供统一的适配器访问接口
 */

export type {
  HostAdapter,
  VariableOption,
  VariableType,
  GenerateOptions,
  ChatMessage,
  UnsubscribeFn,
  AdapterEventType,
} from './types'

export { MockAdapter, createMockAdapter } from './mockAdapter'
export type { MockAdapterOptions } from './mockAdapter'

export { SillyTavernAdapter, createSillyTavernAdapter, isSillyTavernAvailable } from './sillyTavernAdapter'

export {
  BridgeAdapter,
  createBridgeAdapter,
  getBridgeAdapter,
  resetBridgeAdapter,
} from './bridgeAdapter'
export type {
  BridgeAdapterOptions,
  BridgeStatus,
  PlatformInfo,
  SyncMessage,
  SyncPayload,
} from './bridgeAdapter'

import type { HostAdapter } from './types'
import { MockAdapter } from './mockAdapter'
import { SillyTavernAdapter, isSillyTavernAvailable } from './sillyTavernAdapter'

/**
 * 全局适配器实例
 */
let adapterInstance: HostAdapter | null = null

/**
 * 创建适配器实例
 * 根据环境自动选择合适的适配器
 */
export function createAdapter(): HostAdapter {
  // 如果已有实例，直接返回
  if (adapterInstance) {
    return adapterInstance
  }
  
  // 检查是否在 SillyTavern 环境中
  if (isSillyTavernAvailable()) {
    console.log('[Adapter] Using SillyTavern adapter')
    adapterInstance = new SillyTavernAdapter()
  } else {
    console.log('[Adapter] Using Mock adapter (dev mode)')
    adapterInstance = new MockAdapter({
      useLocalStorage: true,
    })
  }
  
  return adapterInstance
}

/**
 * 获取当前适配器实例
 * 如果尚未创建，会自动创建
 */
export function getAdapter(): HostAdapter {
  if (!adapterInstance) {
    return createAdapter()
  }
  return adapterInstance
}

/**
 * 重置适配器实例
 * 主要用于测试
 */
export function resetAdapter(): void {
  adapterInstance = null
}

/**
 * 设置自定义适配器实例
 * 主要用于测试或特殊场景
 */
export function setAdapter(adapter: HostAdapter): void {
  adapterInstance = adapter
}