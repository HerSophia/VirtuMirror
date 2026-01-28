/**
 * DataService 单元测试
 * 测试应用数据服务
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppDataService, createAppDataService } from '../dataService'

// Mock 数据存储
const mockDbData: Map<string, { namespace: string; key: string; value: unknown; version: number; updatedAt: number }> = new Map()

vi.mock('@/services/database', () => ({
  db: {
    appData: {
      get: vi.fn((key: [string, string]) => {
        const [namespace, k] = key
        const mapKey = `${namespace}:${k}`
        return Promise.resolve(mockDbData.get(mapKey))
      }),
      put: vi.fn((record: { namespace: string; key: string; value: unknown; version: number; updatedAt: number }) => {
        const mapKey = `${record.namespace}:${record.key}`
        mockDbData.set(mapKey, record)
        return Promise.resolve()
      }),
      delete: vi.fn((key: [string, string]) => {
        const [namespace, k] = key
        const mapKey = `${namespace}:${k}`
        mockDbData.delete(mapKey)
        return Promise.resolve()
      }),
      where: vi.fn((indexName: string) => ({
        equals: vi.fn((value: unknown) => {
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
            count: vi.fn(() => {
              let count = 0
              mockDbData.forEach((_, k) => {
                if (k.startsWith(`${namespace}:`)) {
                  count++
                }
              })
              return Promise.resolve(count)
            }),
          }
        }),
      })),
      bulkPut: vi.fn((records: { namespace: string; key: string; value: unknown; version: number; updatedAt: number }[]) => {
        records.forEach((record) => {
          const mapKey = `${record.namespace}:${record.key}`
          mockDbData.set(mapKey, record)
        })
        return Promise.resolve()
      }),
    },
  },
}))

describe('AppDataService', () => {
  const testNamespace = 'test-namespace'
  let service: AppDataService

  beforeEach(() => {
    mockDbData.clear()
    service = new AppDataService(testNamespace)
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeInstanceOf(AppDataService)
    })
  })

  describe('get', () => {
    it('不存在的 key 应该返回 undefined', async () => {
      const result = await service.get('non-existent')
      expect(result).toBeUndefined()
    })

    it('应该返回存储的值', async () => {
      mockDbData.set(`${testNamespace}:my-key`, {
        namespace: testNamespace,
        key: 'my-key',
        value: { foo: 'bar' },
        version: 1,
        updatedAt: Date.now(),
      })

      const result = await service.get<{ foo: string }>('my-key')
      expect(result).toEqual({ foo: 'bar' })
    })

    it('应该支持不同类型的值', async () => {
      mockDbData.set(`${testNamespace}:string-key`, {
        namespace: testNamespace,
        key: 'string-key',
        value: 'hello',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:number-key`, {
        namespace: testNamespace,
        key: 'number-key',
        value: 42,
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:array-key`, {
        namespace: testNamespace,
        key: 'array-key',
        value: [1, 2, 3],
        version: 1,
        updatedAt: Date.now(),
      })

      expect(await service.get<string>('string-key')).toBe('hello')
      expect(await service.get<number>('number-key')).toBe(42)
      expect(await service.get<number[]>('array-key')).toEqual([1, 2, 3])
    })
  })

  describe('set', () => {
    it('应该存储值', async () => {
      await service.set('new-key', 'new-value')

      const stored = mockDbData.get(`${testNamespace}:new-key`)
      expect(stored).toBeDefined()
      expect(stored?.value).toBe('new-value')
      expect(stored?.namespace).toBe(testNamespace)
    })

    it('应该覆盖已存在的值', async () => {
      await service.set('key', 'value1')
      await service.set('key', 'value2')

      const stored = mockDbData.get(`${testNamespace}:key`)
      expect(stored?.value).toBe('value2')
    })

    it('应该支持复杂对象', async () => {
      const complexValue = {
        name: 'test',
        nested: { a: 1, b: [1, 2, 3] },
        date: '2024-01-01',
      }

      await service.set('complex', complexValue)

      const stored = mockDbData.get(`${testNamespace}:complex`)
      expect(stored?.value).toEqual(complexValue)
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

      await service.delete('to-delete')

      expect(mockDbData.has(`${testNamespace}:to-delete`)).toBe(false)
    })

    it('删除不存在的 key 不应该抛出错误', async () => {
      await expect(service.delete('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('list', () => {
    it('空命名空间应该返回空数组', async () => {
      const keys = await service.list()
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

      const keys = await service.list()

      expect(keys).toHaveLength(2)
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
    })
  })

  describe('clear', () => {
    it('应该清空命名空间下的所有数据', async () => {
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

      await service.clear()

      expect(mockDbData.has(`${testNamespace}:key1`)).toBe(false)
      expect(mockDbData.has(`${testNamespace}:key2`)).toBe(false)
    })
  })

  describe('getAll', () => {
    it('空命名空间应该返回空对象', async () => {
      const all = await service.getAll()
      expect(all).toEqual({})
    })

    it('应该返回所有键值对', async () => {
      mockDbData.set(`${testNamespace}:key1`, {
        namespace: testNamespace,
        key: 'key1',
        value: 'value1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:key2`, {
        namespace: testNamespace,
        key: 'key2',
        value: 42,
        version: 1,
        updatedAt: Date.now(),
      })

      const all = await service.getAll()

      expect(all).toEqual({
        key1: 'value1',
        key2: 42,
      })
    })
  })

  describe('has', () => {
    it('存在的 key 应该返回 true', async () => {
      mockDbData.set(`${testNamespace}:exists`, {
        namespace: testNamespace,
        key: 'exists',
        value: 'value',
        version: 1,
        updatedAt: Date.now(),
      })

      expect(await service.has('exists')).toBe(true)
    })

    it('不存在的 key 应该返回 false', async () => {
      expect(await service.has('not-exists')).toBe(false)
    })
  })

  describe('setMany', () => {
    it('应该批量设置多个值', async () => {
      await service.setMany({
        key1: 'value1',
        key2: 42,
        key3: { nested: true },
      })

      expect(mockDbData.get(`${testNamespace}:key1`)?.value).toBe('value1')
      expect(mockDbData.get(`${testNamespace}:key2`)?.value).toBe(42)
      expect(mockDbData.get(`${testNamespace}:key3`)?.value).toEqual({ nested: true })
    })

    it('空对象不应该抛出错误', async () => {
      await expect(service.setMany({})).resolves.toBeUndefined()
    })
  })

  describe('getMany', () => {
    it('应该批量获取多个值', async () => {
      mockDbData.set(`${testNamespace}:key1`, {
        namespace: testNamespace,
        key: 'key1',
        value: 'value1',
        version: 1,
        updatedAt: Date.now(),
      })
      mockDbData.set(`${testNamespace}:key2`, {
        namespace: testNamespace,
        key: 'key2',
        value: 42,
        version: 1,
        updatedAt: Date.now(),
      })

      const result = await service.getMany<string | number>(['key1', 'key2', 'key3'])

      expect(result.get('key1')).toBe('value1')
      expect(result.get('key2')).toBe(42)
      expect(result.get('key3')).toBeUndefined()
    })

    it('空数组应该返回空 Map', async () => {
      const result = await service.getMany([])
      expect(result.size).toBe(0)
    })
  })

  describe('count', () => {
    it('空命名空间应该返回 0', async () => {
      const count = await service.count()
      expect(count).toBe(0)
    })

    it('应该返回正确的数量', async () => {
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

      const count = await service.count()
      expect(count).toBe(3)
    })
  })
})

describe('createAppDataService', () => {
  it('应该返回 AppDataService 实例', () => {
    const service = createAppDataService('test-namespace')
    expect(service).toBeInstanceOf(AppDataService)
  })

  it('不同命名空间应该创建不同的服务实例', () => {
    const service1 = createAppDataService('namespace-1')
    const service2 = createAppDataService('namespace-2')

    expect(service1).not.toBe(service2)
  })
})
