/**
 * 应用数据服务
 *
 * 提供按命名空间隔离的数据存储服务
 * 每个应用根据其来源获得独立的数据空间
 *
 * 注意：此服务主要供 ScopedStorage 内部使用
 * App 开发者应通过 AppRuntime.storage 接口访问数据
 */

import { db, type AppDataRecord } from '@/services/database'

/**
 * 应用数据服务
 * 封装对特定命名空间的数据操作
 */
export class AppDataService {
  constructor(private namespace: string) {}

  /**
   * 获取数据
   */
  async get<T>(key: string): Promise<T | undefined> {
    const record = await db.appData.get([this.namespace, key])
    return record?.value as T | undefined
  }

  /**
   * 设置数据
   */
  async set<T>(key: string, value: T): Promise<void> {
    await db.appData.put({
      namespace: this.namespace,
      key,
      value,
      version: 1,
      updatedAt: Date.now(),
    })
  }

  /**
   * 删除数据
   */
  async delete(key: string): Promise<void> {
    await db.appData.delete([this.namespace, key])
  }

  /**
   * 列出所有键
   */
  async list(): Promise<string[]> {
    const records = await db.appData.where('namespace').equals(this.namespace).toArray()
    return records.map((r) => r.key)
  }

  /**
   * 清空命名空间下的所有数据
   */
  async clear(): Promise<void> {
    await db.appData.where('namespace').equals(this.namespace).delete()
  }

  /**
   * 获取命名空间下的所有数据
   */
  async getAll(): Promise<Record<string, unknown>> {
    const records = await db.appData.where('namespace').equals(this.namespace).toArray()
    return Object.fromEntries(records.map((r) => [r.key, r.value]))
  }

  /**
   * 检查键是否存在
   */
  async has(key: string): Promise<boolean> {
    const record = await db.appData.get([this.namespace, key])
    return record !== undefined
  }

  /**
   * 批量设置数据
   */
  async setMany(entries: Record<string, unknown>): Promise<void> {
    const records: AppDataRecord[] = Object.entries(entries).map(([key, value]) => ({
      namespace: this.namespace,
      key,
      value,
      version: 1,
      updatedAt: Date.now(),
    }))
    await db.appData.bulkPut(records)
  }

  /**
   * 批量获取数据
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T | undefined>> {
    const result = new Map<string, T | undefined>()
    for (const key of keys) {
      result.set(key, await this.get<T>(key))
    }
    return result
  }

  /**
   * 获取数据记录数量
   */
  async count(): Promise<number> {
    return db.appData.where('namespace').equals(this.namespace).count()
  }
}

/**
 * 创建应用数据服务实例
 */
export function createAppDataService(namespace: string): AppDataService {
  return new AppDataService(namespace)
}
