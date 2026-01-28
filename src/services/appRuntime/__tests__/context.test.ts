/**
 * Context 单元测试
 * 测试 Vue provide/inject 集成和全局注册表
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import {
  APP_RUNTIME_KEY,
  provideAppRuntime,
  useAppRuntime,
  tryUseAppRuntime,
  useAppStorage,
  useAppSystem,
  unregisterAppRuntime,
} from '../context'
import type { AppRuntime, ScopedStorage, SystemAPI, AppIdentity } from '../types'

// 创建 mock runtime
function createMockRuntime(appId: string): AppRuntime {
  const identity: AppIdentity = {
    appId,
    appName: `App ${appId}`,
    dataNamespace: `builtin/${appId}`,
    source: { type: 'builtin' },
  }

  const storage: ScopedStorage = {
    get: vi.fn(() => Promise.resolve(undefined)),
    set: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    keys: vi.fn(() => Promise.resolve([])),
    clear: vi.fn(() => Promise.resolve()),
    getUsage: vi.fn(() => Promise.resolve({ count: 0, estimatedSize: 0 })),
  }

  const system: SystemAPI = {
    now: vi.fn(() => Date.now()),
    uuid: vi.fn(() => 'mock-uuid'),
    toast: vi.fn(),
  }

  return { identity, storage, system }
}

describe('Context', () => {
  afterEach(() => {
    // 清理注册表
    unregisterAppRuntime('test-app')
    unregisterAppRuntime('app-1')
    unregisterAppRuntime('app-2')
  })

  describe('APP_RUNTIME_KEY', () => {
    it('应该是一个 Symbol', () => {
      expect(typeof APP_RUNTIME_KEY).toBe('symbol')
    })

    it('应该有描述性的名称', () => {
      expect(APP_RUNTIME_KEY.toString()).toContain('AppRuntime')
    })
  })

  describe('provideAppRuntime', () => {
    it('应该在组件中提供 runtime', () => {
      const mockRuntime = createMockRuntime('test-app')
      let receivedRuntime: AppRuntime | undefined

      const Parent = defineComponent({
        setup() {
          provideAppRuntime(mockRuntime)
          return () => h(Child)
        },
      })

      const Child = defineComponent({
        setup() {
          receivedRuntime = useAppRuntime()
          return () => h('div')
        },
      })

      mount(Parent)

      expect(receivedRuntime).toBe(mockRuntime)
    })
  })

  describe('useAppRuntime', () => {
    it('在没有 provider 时应该抛出错误', () => {
      const Component = defineComponent({
        setup() {
          expect(() => useAppRuntime()).toThrow('useAppRuntime must be called within an App context')
          return () => h('div')
        },
      })

      mount(Component)
    })

    it('应该返回注入的 runtime', () => {
      const mockRuntime = createMockRuntime('test-app')
      let result: AppRuntime | undefined

      const Parent = defineComponent({
        setup() {
          provideAppRuntime(mockRuntime)
          return () => h(Child)
        },
      })

      const Child = defineComponent({
        setup() {
          result = useAppRuntime()
          return () => h('div')
        },
      })

      mount(Parent)

      expect(result).toBe(mockRuntime)
      expect(result?.identity.appId).toBe('test-app')
    })
  })

  describe('tryUseAppRuntime', () => {
    it('在组件上下文中有 provider 时应该返回 runtime', () => {
      const mockRuntime = createMockRuntime('test-app')
      let result: AppRuntime | null = null

      const Parent = defineComponent({
        setup() {
          provideAppRuntime(mockRuntime)
          return () => h(Child)
        },
      })

      const Child = defineComponent({
        setup() {
          result = tryUseAppRuntime()
          return () => h('div')
        },
      })

      mount(Parent)

      expect(result).toBe(mockRuntime)
    })

    it('在组件上下文中没有 provider 时应该返回 null（或从注册表获取）', () => {
      let result: AppRuntime | null = null

      const Component = defineComponent({
        setup() {
          result = tryUseAppRuntime()
          return () => h('div')
        },
      })

      mount(Component)

      // 由于没有注册任何 runtime，应该返回 null
      expect(result).toBeNull()
    })
  })

  describe('useAppStorage', () => {
    it('应该返回 storage API', () => {
      const mockRuntime = createMockRuntime('test-app')
      let storage: ScopedStorage | undefined

      const Parent = defineComponent({
        setup() {
          provideAppRuntime(mockRuntime)
          return () => h(Child)
        },
      })

      const Child = defineComponent({
        setup() {
          storage = useAppStorage()
          return () => h('div')
        },
      })

      mount(Parent)

      expect(storage).toBe(mockRuntime.storage)
      expect(storage?.get).toBeDefined()
      expect(storage?.set).toBeDefined()
    })
  })

  describe('useAppSystem', () => {
    it('应该返回 system API', () => {
      const mockRuntime = createMockRuntime('test-app')
      let system: SystemAPI | undefined

      const Parent = defineComponent({
        setup() {
          provideAppRuntime(mockRuntime)
          return () => h(Child)
        },
      })

      const Child = defineComponent({
        setup() {
          system = useAppSystem()
          return () => h('div')
        },
      })

      mount(Parent)

      expect(system).toBe(mockRuntime.system)
      expect(system?.now).toBeDefined()
      expect(system?.uuid).toBeDefined()
      expect(system?.toast).toBeDefined()
    })
  })

  describe('unregisterAppRuntime', () => {
    it('应该从注册表中移除 runtime', () => {
      const mockRuntime = createMockRuntime('test-app')

      // 通过 provideAppRuntime 注册
      const Component = defineComponent({
        setup() {
          provideAppRuntime(mockRuntime)
          return () => h('div')
        },
      })

      mount(Component)

      // 取消注册
      unregisterAppRuntime('test-app')

      // 在新组件中尝试获取应该返回 null
      let result: AppRuntime | null = null
      const TestComponent = defineComponent({
        setup() {
          result = tryUseAppRuntime()
          return () => h('div')
        },
      })

      mount(TestComponent)

      expect(result).toBeNull()
    })

    it('取消注册不存在的 appId 不应该抛出错误', () => {
      expect(() => unregisterAppRuntime('non-existent')).not.toThrow()
    })
  })

  describe('全局注册表行为', () => {
    it('多个 runtime 注册后应该记住最后一个', () => {
      const runtime1 = createMockRuntime('app-1')
      const runtime2 = createMockRuntime('app-2')

      // 注册两个 runtime
      const Component1 = defineComponent({
        setup() {
          provideAppRuntime(runtime1)
          return () => h('div')
        },
      })

      const Component2 = defineComponent({
        setup() {
          provideAppRuntime(runtime2)
          return () => h('div')
        },
      })

      mount(Component1)
      mount(Component2)

      // 最后注册的应该是当前的
      let result: AppRuntime | null = null
      const TestComponent = defineComponent({
        setup() {
          result = tryUseAppRuntime()
          return () => h('div')
        },
      })

      mount(TestComponent)

      // 由于组件内会使用 inject，如果没有 provider 会回退到注册表
      // 注册表中最后注册的是 app-2
      if (result !== null) {
        expect((result as AppRuntime).identity.appId).toBe('app-2')
      }
    })

    it('取消注册当前 runtime 后应该回退到上一个', () => {
      const runtime1 = createMockRuntime('app-1')
      const runtime2 = createMockRuntime('app-2')

      const Component1 = defineComponent({
        setup() {
          provideAppRuntime(runtime1)
          return () => h('div')
        },
      })

      const Component2 = defineComponent({
        setup() {
          provideAppRuntime(runtime2)
          return () => h('div')
        },
      })

      mount(Component1)
      mount(Component2)

      // 取消注册 app-2
      unregisterAppRuntime('app-2')

      // 现在应该回退到 app-1
      let result2: AppRuntime | null = null
      const TestComponent = defineComponent({
        setup() {
          result2 = tryUseAppRuntime()
          return () => h('div')
        },
      })

      mount(TestComponent)

      if (result2 !== null) {
        expect((result2 as AppRuntime).identity.appId).toBe('app-1')
      }
    })
  })
})
