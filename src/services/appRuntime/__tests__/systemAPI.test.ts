/**
 * SystemAPI 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSystemAPI, registerToastCallback } from '../systemAPI'

describe('SystemAPI', () => {
  describe('createSystemAPI', () => {
    it('应该返回一个包含所有必需方法的对象', () => {
      const api = createSystemAPI('test-app')
      
      expect(api).toHaveProperty('now')
      expect(api).toHaveProperty('uuid')
      expect(api).toHaveProperty('toast')
      expect(typeof api.now).toBe('function')
      expect(typeof api.uuid).toBe('function')
      expect(typeof api.toast).toBe('function')
    })
  })

  describe('now()', () => {
    it('应该返回当前时间戳', () => {
      const api = createSystemAPI('test-app')
      const before = Date.now()
      const result = api.now()
      const after = Date.now()
      
      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })

    it('多次调用应该返回递增的时间戳', async () => {
      const api = createSystemAPI('test-app')
      const first = api.now()
      await new Promise(resolve => setTimeout(resolve, 10))
      const second = api.now()
      
      expect(second).toBeGreaterThan(first)
    })
  })

  describe('uuid()', () => {
    it('应该返回有效的 UUID 格式', () => {
      const api = createSystemAPI('test-app')
      const uuid = api.uuid()
      
      // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(uuid).toMatch(uuidRegex)
    })

    it('每次调用应该返回唯一的 UUID', () => {
      const api = createSystemAPI('test-app')
      const uuids = new Set<string>()
      
      for (let i = 0; i < 100; i++) {
        uuids.add(api.uuid())
      }
      
      expect(uuids.size).toBe(100)
    })
  })

  describe('toast()', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
      // 重置回调
      registerToastCallback(null as any)
    })

    describe('无回调时的降级处理', () => {
      it('info 类型应该使用 console.log', () => {
        const api = createSystemAPI('my-app')
        api.toast('测试消息', 'info')
        
        expect(console.log).toHaveBeenCalledWith('[my-app]', '测试消息')
      })

      it('success 类型应该使用 console.log 并带有 ✓', () => {
        const api = createSystemAPI('my-app')
        api.toast('成功消息', 'success')
        
        expect(console.log).toHaveBeenCalledWith('[my-app]', '✓', '成功消息')
      })

      it('error 类型应该使用 console.error', () => {
        const api = createSystemAPI('my-app')
        api.toast('错误消息', 'error')
        
        expect(console.error).toHaveBeenCalledWith('[my-app]', '错误消息')
      })

      it('默认类型应该是 info', () => {
        const api = createSystemAPI('my-app')
        api.toast('默认消息')
        
        expect(console.log).toHaveBeenCalledWith('[my-app]', '默认消息')
      })
    })

    describe('有回调时的处理', () => {
      it('应该调用注册的回调函数', () => {
        const callback = vi.fn()
        registerToastCallback(callback)
        
        const api = createSystemAPI('test-app')
        api.toast('测试消息', 'success')
        
        expect(callback).toHaveBeenCalledWith('测试消息', 'success', 'test-app')
      })

      it('应该传递正确的 appId', () => {
        const callback = vi.fn()
        registerToastCallback(callback)
        
        const api1 = createSystemAPI('app-1')
        const api2 = createSystemAPI('app-2')
        
        api1.toast('消息1', 'info')
        api2.toast('消息2', 'error')
        
        expect(callback).toHaveBeenCalledWith('消息1', 'info', 'app-1')
        expect(callback).toHaveBeenCalledWith('消息2', 'error', 'app-2')
      })
    })
  })

  describe('registerToastCallback', () => {
    afterEach(() => {
      registerToastCallback(null as any)
    })

    it('应该能注册回调', () => {
      const callback = vi.fn()
      
      // 不应该抛出错误
      expect(() => registerToastCallback(callback)).not.toThrow()
    })

    it('后注册的回调应该覆盖之前的', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      registerToastCallback(callback1)
      registerToastCallback(callback2)
      
      const api = createSystemAPI('test-app')
      api.toast('消息', 'info')
      
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalledTimes(1)
    })
  })
})
