/**
 * ScopedStorage 单元测试
 * 测试隔离存储功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createScopedStorage } from '../scopedStorage'
import type { ScopedStorage } from '../types'

// Mock 数据库和写入队列
const mockDbData: Map<string, { namespace: string; key: string; value: unknown; version: number; updatedAt: number }> = new Map()

vi.mock('@/services/database', () => ({
  db: {
    appData: {
      where: vi.fn((indexName: string) => ({
        equals: vi.fn((value: unknown) => {
          if (indexName === '[namespace+key]') {
            const [namespace, key] = value as [string, string]
            return {
              first: vi.fn(() => {
                const mapKey = `${namespace}:${key}`
                return Promise.resolve(mockDbData.get(mapKey))
              }),
              delete: vi.fn(() => {
                const mapKey = `${namespace}:${key}`
                mockDbData.delete(mapKey)
                return Promise.resolve()
              }),
            }
          }
          if (indexName === 'namespace') {
            const namespace = value as string
            return {
              toArray: vi.fn(() => {
                const results: unknown[] = []
                mockDbData.forEach((v, k) => {
                  if (k.startsWith(`${namespace}:`)) {
                    results.push(v)
                  }
                })
                return Promise.resolve(results)
              }),
              delete: vi.fn(() => {
                const keysToDelete: string[] = []
                mockDbData.forEach((_, k) => {
                  if (k.startsWith(`${namespace}:`)) {
                    keysToDelete.push(k)
                  }
                })
                keysToDelete.forEach((k) => mockDbData.delete(k))
                return Promise.resolve(keysToDelete.length)
              }),
            }
          }
          return {
            first: vi.fn(() => Promise.resolve(undefined)),
            toArray: vi.fn(() => Promise.resolve([])),
            delete: vi.fn(() => Promise.resolve()),
          }
        }),
      })),
      add: vi.fn((record: { namespace: string; key: string; value: unknown; version: number; updatedAt: number }) => {
        const mapKey = `${record.namespace}:${record.key}`
        mockDbData.set(mapKey, record)
        return Promise.resolve()
      }),
      update: vi.fn((_key: [string, string], updates: Partial<{ value: unknown; version: number; updatedAt: number }>) => {
        const [namespace, key] = _key
        const mapKey = `${namespace}:${key}`
        const existing = mockDbData.get(mapKey)
        if (existing) {
          mockDbData.set(mapKey, { ...existing, ...updates })
        }
        return Promise.resolve()
      }),
    },
  },
}))

vi.mock('@/services/database/writeQueue', () => ({
  writeQueue: {
    enqueue: vi.fn((_type: string, _appId: string, fn: () => Promise<void>) => fn()),
  },
}))

describe('ScopedStorage', () => {
  let storage: ScopedStorage
  const testNamespace = 'test-namespace'
  const testAppId = 'test-app'

  beforeEach(() => {
    mockDbData.clear()
    storage = createScopedStorage(testNamespace, testAppId)
    vi.clearAllMocks()
  })

  describe('createScopedStorage', () => {
    it('应该返回包含所有必需方法的对象', () => {
      expect(storage).toHaveProperty('get')
      expect(storage).toHaveProperty('set')
      expect(storage).toHaveProperty('delete')
      expect(storage).toHaveProperty('keys')
      expect(storage).toHaveProperty('clear')
      expect(storage).toHaveProperty('getUsage')
    })

    it('所有方法都应该是函数', () => {
      expect(typeof storage.get).toBe('function')
      expect(typeof storage.set).toBe('function')
      expect(typeof storage.delete).toBe('function')
      expect(typeof storage.keys).toBe('function')
      expect(typeof storage.clear).toBe('function')
      expect(typeof storage.getUsage).toBe('function')
    })
  })

  describe('key 验证', () => {
    it('空 key 应该抛出错误', async () => {
      await expect(storage.get('')).rejects.toThrow('Invalid key')
      await expect(storage.set('', 'value')).rejects.toThrow('Invalid key')
      await expect(storage.delete('')).rejects.toThrow('Invalid key')
    })

    it('包含冒号的 key 应该抛出错误', async () => {
      await expect(storage.get('key:with:colons')).rejects.toThrow('Invalid key')
      await expect(storage.set('key:value', 'data')).rejects.toThrow('Invalid key')
    })

    it('非字符串 key 应该抛出错误', async () => {
      // @ts-expect-error 测试非法输入
      await expect(storage.get(null)).rejects.toThrow('Invalid key')
      // @ts-expect-error 测试非法输入
      await expect(storage.get(undefined)).rejects.toThrow('Invalid key')
      // @ts-expect-error 测试非法输入
      await expect(storage.get(123)).rejects.toThrow('Invalid key')
    })
  })

  describe('get', () => {
    it('不存在的 key 应该返回 undefined', async () => {
      const result = await storage.get('non-existent')
      expect(result).toBeUndefined()
    })

    it('应该返回存储的值', async () => {
      // 预设数据
      mockDbData.set(`${testNamespace}:my-key`, {
        namespace: testNamespace,
        key: 'my-key',
        value: { foo: 'bar' },
        version: 1,
        updatedAt: Date.now(),
      })

      const result = await storage.get<{ foo: string }>('my-key')
      expect(result).toEqual({ foo: 'bar' })
    })

    it('应该支持泛型类型', async () => {
      mockDbData.set(`${testNamespace}:typed-key`, {
        namespace: testNamespace,
        key: 'typed-key',
        value: 42,
        version: 1,
        updatedAt: Date.now(),
      })

      const result = await storage.get<number>('typed-key')
      expect(result).toBe(42)
    })
  })

  describe('set', () => {
    it('应该存储新值', async () => {
      await storage.set('new-key', 'new-value')

      const stored = mockDbData.get(`${testNamespace}:new-key`)
      expect(stored).toBeDefined()
      expect(stored?.value).toBe('new-value')
      expect(stored?.version).toBe(1)
    })

    it('应该更新已存在的值', async () => {
      // 预设数据
      mockDbData.set(`${testNamespace}:existing-key`, {
        namespace: testNamespace,
        key: 'existing-key',
        value: 'old-value',
        version: 1,
        updatedAt: Date.now() - 1000,
      })

      await storage.set('existing-key', 'updated-value')

      const stored = mockDbData.get(`${testNamespace}:existing-key`)
      expect(stored?.value).toBe('updated-value')
      expect(stored?.version).toBe(2)
    })

    it('应该支持复杂对象', async () => {
      const complexValue = {
        name: 'test',
        count: 42,
        nested: { a: 1, b: [1, 2, 3] },
      }

      await storage.set('complex-key', complexValue)

      const stored = mockDbData.get(`${testNamespace}:complex-key`)
      expect(stored?.value).toEqual(complexValue)
    })

    it('应该支持数组', async () => {
      const arrayValue = [1, 2, 3, 'four', { five: 5 }]

      await storage.set('array-key', arrayValue)

      const stored = mockDbData.get(`${testNamespace}:array-key`)
      expect(stored?.value).toEqual(arrayValue)
    })
  })

  describe('delete', () => {
    it('应该删除存在的 key', async () => {
      mockDbData.set(`${testNamespace}:to-delete`, {
        namespace: testNamespace,
        key: 'to-delete',
        value: 'will be deleted',
        version: 1,
        updatedAt: Date.now(),
      })

      await storage.delete('to-delete')

      expect(mockDbData.has(`${testNamespace}:to-delete`)).toBe(false)
    })

    it('删除不存在的 key 不应该抛出错误', async () => {
      await expect(storage.delete('non-existent-key')).resolves.toBeUndefined()
    })
  })

  describe('keys', () => {
    it('空存储应该返回空数组', async () => {
      const keys = await storage.keys()
      expect(keys).toEqual([])
    })

    it('应该返回所有 key', async () => {
      mockDbData.set(`${testNamespace}:key1`, {
        namespace: testNamespace,
        key: 'key1',
        value: 'v1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:key2`, {
        namespace: testNamespace,
        key: 'key2',
        value: 'v2',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:key3`, {
        namespace: testNamespace,
        key: 'key3',
        value: 'v3',
        version: 1,
        updatedAt: Date.now(),
      })

      const keys = await storage.keys()

      expect(keys).toHaveLength(3)
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toContain('key3')
    })

    it('应该只返回当前命名空间的 key', async () => {
      mockDbData.set(`${testNamespace}:my-key`, {
        namespace: testNamespace,
        key: 'my-key',
        value: 'v1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set('other-namespace:other-key', {
        namespace: 'other-namespace',
        key: 'other-key',
        value: 'v2',
        version: 1,
        updatedAt: Date.now(),
      })

      const keys = await storage.keys()

      expect(keys).toHaveLength(1)
      expect(keys).toContain('my-key')
      expect(keys).not.toContain('other-key')
    })
  })

  describe('clear', () => {
    it('应该清空所有数据', async () => {
      mockDbData.set(`${testNamespace}:key1`, {
        namespace: testNamespace,
        key: 'key1',
        value: 'v1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:key2`, {
        namespace: testNamespace,
        key: 'key2',
        value: 'v2',
        version: 1,
        updatedAt: Date.now(),
      })

      await storage.clear()

      expect(mockDbData.has(`${testNamespace}:key1`)).toBe(false)
      expect(mockDbData.has(`${testNamespace}:key2`)).toBe(false)
    })

    it('不应该影响其他命名空间的数据', async () => {
      mockDbData.set(`${testNamespace}:my-key`, {
        namespace: testNamespace,
        key: 'my-key',
        value: 'v1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set('other-namespace:other-key', {
        namespace: 'other-namespace',
        key: 'other-key',
        value: 'v2',
        version: 1,
        updatedAt: Date.now(),
      })

      await storage.clear()

      expect(mockDbData.has(`${testNamespace}:my-key`)).toBe(false)
      expect(mockDbData.has('other-namespace:other-key')).toBe(true)
    })
  })

  describe('getUsage', () => {
    it('空存储应该返回零', async () => {
      const usage = await storage.getUsage()

      expect(usage.count).toBe(0)
      expect(usage.estimatedSize).toBe(0)
    })

    it('应该返回正确的记录数量', async () => {
      mockDbData.set(`${testNamespace}:key1`, {
        namespace: testNamespace,
        key: 'key1',
        value: 'v1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:key2`, {
        namespace: testNamespace,
        key: 'key2',
        value: 'v2',
        version: 1,
        updatedAt: Date.now(),
      })

      const usage = await storage.getUsage()

      expect(usage.count).toBe(2)
    })

    it('应该估算存储大小', async () => {
      mockDbData.set(`${testNamespace}:key1`, {
        namespace: testNamespace,
        key: 'key1',
        value: 'short',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:key2`, {
        namespace: testNamespace,
        key: 'key2',
        value: 'a much longer string value that takes more space',
        version: 1,
        updatedAt: Date.now(),
      })

      const usage = await storage.getUsage()

      expect(usage.estimatedSize).toBeGreaterThan(0)
    })
  })

  describe('命名空间隔离', () => {
    it('不同命名空间应该有独立的存储', async () => {
      const storage1 = createScopedStorage('namespace-1', 'app-1')
      const storage2 = createScopedStorage('namespace-2', 'app-2')

      await storage1.set('shared-key', 'value-1')
      await storage2.set('shared-key', 'value-2')

      expect(mockDbData.get('namespace-1:shared-key')?.value).toBe('value-1')
      expect(mockDbData.get('namespace-2:shared-key')?.value).toBe('value-2')
    })

    it('清空一个命名空间不影响另一个', async () => {
      const storage1 = createScopedStorage('namespace-1', 'app-1')
      const storage2 = createScopedStorage('namespace-2', 'app-2')

      mockDbData.set('namespace-1:key', {
        namespace: 'namespace-1',
        key: 'key',
        value: 'v1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set('namespace-2:key', {
        namespace: 'namespace-2',
        key: 'key',
        value: 'v2',
        version: 1,
        updatedAt: Date.now(),
      })

      await storage1.clear()

      expect(mockDbData.has('namespace-1:key')).toBe(false)
      expect(mockDbData.has('namespace-2:key')).toBe(true)
    })
  })
})
