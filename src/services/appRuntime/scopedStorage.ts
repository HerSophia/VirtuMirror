/**
 * 隔离存储实现
 *
 * 为每个 App 提供独立的存储空间，通过命名空间实现数据隔离
 */

import { db } from '@/services/database'
import { writeQueue } from '@/services/database/writeQueue'
import type { ScopedStorage } from './types'

/**
 * 创建隔离存储实例
 */
export function createScopedStorage(
  namespace: string,
  appId: string
): ScopedStorage {
  // 验证 key 格式
  const validateKey = (key: string) => {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string')
    }
    if (key.includes(':')) {
      throw new Error('Invalid key: cannot contain ":"')
    }
  }

  return {
    async get<T>(key: string): Promise<T | undefined> {
      validateKey(key)
      const record = await db.appData
        .where('[namespace+key]')
        .equals([namespace, key])
        .first()
      return record?.value as T | undefined
    },

    async set<T>(key: string, value: T): Promise<void> {
      validateKey(key)

      // 通过写入队列执行
      await writeQueue.enqueue('app', appId, async () => {
        const existing = await db.appData
          .where('[namespace+key]')
          .equals([namespace, key])
          .first()

        if (existing) {
          await db.appData.update([namespace, key], {
            value,
            version: (existing.version || 0) + 1,
            updatedAt: Date.now(),
          })
        } else {
          await db.appData.add({
            namespace,
            key,
            value,
            version: 1,
            updatedAt: Date.now(),
          })
        }
      })
    },

    async delete(key: string): Promise<void> {
      validateKey(key)

      await writeQueue.enqueue('app', appId, async () => {
        await db.appData.where('[namespace+key]').equals([namespace, key]).delete()
      })
    },

    async keys(): Promise<string[]> {
      const records = await db.appData.where('namespace').equals(namespace).toArray()
      return records.map((r) => r.key)
    },

    async clear(): Promise<void> {
      await writeQueue.enqueue('app', appId, async () => {
        await db.appData.where('namespace').equals(namespace).delete()
      })
    },

    async getUsage(): Promise<{ count: number; estimatedSize: number }> {
      const records = await db.appData.where('namespace').equals(namespace).toArray()

      const estimatedSize = records.reduce((acc, r) => {
        return acc + JSON.stringify(r.value).length * 2
      }, 0)

      return { count: records.length, estimatedSize }
    },
  }
}
