/**
 * AlgorithmRegistry 算法注册表测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AlgorithmRegistry, DEFAULT_ALGORITHM_CONFIG } from '../AlgorithmRegistry'
import type { AlgorithmConfig } from '@/types/feed'

describe('AlgorithmRegistry', () => {
  let registry: AlgorithmRegistry

  beforeEach(() => {
    registry = new AlgorithmRegistry()
  })

  describe('register 注册算法配置', () => {
    it('应该成功注册平台算法配置', () => {
      const config: AlgorithmConfig = {
        weights: {
          recency: 0.3,
          engagement: 0.4,
          relevance: 0.2,
          social: 0.1,
        },
        decayHalfLife: 6,
      }

      registry.register('weibo', config)

      expect(registry.has('weibo')).toBe(true)
      expect(registry.get('weibo')).toEqual(config)
    })

    it('应该自动归一化权重', () => {
      const config: AlgorithmConfig = {
        weights: {
          recency: 0.2,
          engagement: 0.2,
          relevance: 0.2,
          social: 0.2,
        },
        decayHalfLife: 6,
      }

      registry.register('weibo', config)

      const registered = registry.get('weibo')
      const sum =
        registered.weights.recency +
        registered.weights.engagement +
        registered.weights.relevance +
        registered.weights.social

      expect(Math.abs(sum - 1)).toBeLessThan(0.001)
    })

    it('应该覆盖已存在的配置', () => {
      const config1: AlgorithmConfig = {
        weights: {
          recency: 0.3,
          engagement: 0.3,
          relevance: 0.2,
          social: 0.2,
        },
        decayHalfLife: 6,
      }

      const config2: AlgorithmConfig = {
        weights: {
          recency: 0.2,
          engagement: 0.5,
          relevance: 0.2,
          social: 0.1,
        },
        decayHalfLife: 12,
      }

      registry.register('weibo', config1)
      registry.register('weibo', config2)

      const registered = registry.get('weibo')
      expect(registered.decayHalfLife).toBe(12)
    })
  })

  describe('get 获取算法配置', () => {
    it('应该返回已注册的配置', () => {
      const config: AlgorithmConfig = {
        weights: {
          recency: 0.25,
          engagement: 0.25,
          relevance: 0.25,
          social: 0.25,
        },
        decayHalfLife: 8,
      }

      registry.register('bilibili', config)

      expect(registry.get('bilibili').decayHalfLife).toBe(8)
    })

    it('未注册的平台应该返回默认配置', () => {
      const config = registry.get('unknown_platform')

      expect(config).toEqual(DEFAULT_ALGORITHM_CONFIG)
    })
  })

  describe('has 检查平台是否已注册', () => {
    it('已注册的平台应该返回 true', () => {
      registry.register('weibo', {
        weights: { recency: 0.25, engagement: 0.25, relevance: 0.25, social: 0.25 },
        decayHalfLife: 6,
      })

      expect(registry.has('weibo')).toBe(true)
    })

    it('未注册的平台应该返回 false', () => {
      expect(registry.has('unknown')).toBe(false)
    })
  })

  describe('updateWeights 更新权重', () => {
    it('应该更新部分权重', () => {
      registry.register('weibo', {
        weights: {
          recency: 0.25,
          engagement: 0.25,
          relevance: 0.25,
          social: 0.25,
        },
        decayHalfLife: 6,
      })

      registry.updateWeights('weibo', { engagement: 0.5 })

      const config = registry.get('weibo')
      expect(config.weights.engagement).toBeCloseTo(0.5 / 1.25, 3)
    })

    it('未注册的平台更新权重应该使用默认配置', () => {
      registry.updateWeights('new_platform', { recency: 0.5 })

      const config = registry.get('new_platform')
      expect(config.weights.recency).toBeGreaterThan(0)
    })
  })

  describe('remove 移除平台配置', () => {
    it('应该成功移除已注册的平台', () => {
      registry.register('weibo', {
        weights: { recency: 0.25, engagement: 0.25, relevance: 0.25, social: 0.25 },
        decayHalfLife: 6,
      })

      expect(registry.has('weibo')).toBe(true)

      const removed = registry.remove('weibo')

      expect(removed).toBe(true)
      expect(registry.has('weibo')).toBe(false)
    })

    it('移除未注册的平台应该返回 false', () => {
      const removed = registry.remove('unknown')

      expect(removed).toBe(false)
    })
  })

  describe('getPlatformIds 获取所有平台 ID', () => {
    it('应该返回所有已注册的平台 ID', () => {
      registry.register('weibo', {
        weights: { recency: 0.25, engagement: 0.25, relevance: 0.25, social: 0.25 },
        decayHalfLife: 6,
      })
      registry.register('bilibili', {
        weights: { recency: 0.2, engagement: 0.5, relevance: 0.2, social: 0.1 },
        decayHalfLife: 12,
      })

      const ids = registry.getPlatformIds()

      expect(ids).toContain('weibo')
      expect(ids).toContain('bilibili')
      expect(ids.length).toBe(2)
    })

    it('没有注册时应该返回空数组', () => {
      const ids = registry.getPlatformIds()

      expect(ids).toEqual([])
    })
  })

  describe('clear 清除所有配置', () => {
    it('应该清除所有已注册的配置', () => {
      registry.register('weibo', {
        weights: { recency: 0.25, engagement: 0.25, relevance: 0.25, social: 0.25 },
        decayHalfLife: 6,
      })
      registry.register('bilibili', {
        weights: { recency: 0.2, engagement: 0.5, relevance: 0.2, social: 0.1 },
        decayHalfLife: 12,
      })

      registry.clear()

      expect(registry.getPlatformIds()).toEqual([])
      expect(registry.has('weibo')).toBe(false)
      expect(registry.has('bilibili')).toBe(false)
    })
  })
})
