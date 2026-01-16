/**
 * App 运行时类型定义
 *
 * 定义 App 运行时接口，包括身份信息、隔离存储、系统 API
 */

import type { AppSourceInfo } from '@/types/appIdentity'

/**
 * App 身份信息
 */
export interface AppIdentity {
  /** 应用 ID */
  readonly appId: string
  /** 应用名称 */
  readonly appName: string
  /** 数据命名空间 */
  readonly dataNamespace: string
  /** 应用来源信息 */
  readonly source: AppSourceInfo
}

/**
 * 隔离存储接口
 * 每个 App 获得一个独立的存储空间
 */
export interface ScopedStorage {
  /**
   * 获取数据
   */
  get<T>(key: string): Promise<T | undefined>

  /**
   * 设置数据
   */
  set<T>(key: string, value: T): Promise<void>

  /**
   * 删除数据
   */
  delete(key: string): Promise<void>

  /**
   * 获取所有键
   */
  keys(): Promise<string[]>

  /**
   * 清空存储
   */
  clear(): Promise<void>

  /**
   * 获取存储使用情况
   */
  getUsage(): Promise<{ count: number; estimatedSize: number }>
}

/**
 * 系统 API 接口
 * 提供基础的系统功能
 */
export interface SystemAPI {
  /** 获取当前时间戳 */
  now(): number
  /** 生成 UUID */
  uuid(): string
  /** 显示 Toast 提示 */
  toast(message: string, type?: 'info' | 'success' | 'error'): void
}

/**
 * App 运行时接口
 * 每个 App 获得一个独立的 runtime 实例
 */
export interface AppRuntime {
  /** App 身份信息 */
  readonly identity: AppIdentity

  /** 应用私有存储（已隔离的 namespace） */
  readonly storage: ScopedStorage

  /** 系统 API（基础功能） */
  readonly system: SystemAPI
}
