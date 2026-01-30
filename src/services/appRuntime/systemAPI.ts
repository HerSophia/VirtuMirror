/**
 * 系统 API 实现
 *
 * 提供基础的系统功能，如时间、UUID、Toast 等
 */

import type { SystemAPI } from './types'
import { loggerService } from '@/services/logger/loggerService'

// Toast 回调函数类型
type ToastCallback = (
  message: string,
  type: 'info' | 'success' | 'error',
  source: string
) => void

// 全局 Toast 回调
let globalToastCallback: ToastCallback | null = null

/**
 * 注册全局 Toast 回调
 * 由 NotificationStore 调用来注册
 */
export function registerToastCallback(callback: ToastCallback): void {
  globalToastCallback = callback
}

/**
 * 创建系统 API 实例
 */
export function createSystemAPI(appId: string): SystemAPI {
  return {
    now(): number {
      return Date.now()
    },

    uuid(): string {
      return crypto.randomUUID()
    },

    toast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
      if (globalToastCallback) {
        globalToastCallback(message, type, appId)
      } else {
        // 降级处理：使用 loggerService
        switch (type) {
          case 'error':
            loggerService.error(appId, message)
            break
          case 'success':
            loggerService.info(appId, `✓ ${message}`)
            break
          default:
            loggerService.info(appId, message)
        }
      }
    },
  }
}
