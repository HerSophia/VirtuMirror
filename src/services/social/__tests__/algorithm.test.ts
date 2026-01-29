/**
 * TrafficEngine 单元测试
 * 测试热度计算、格式化和交互概率算法
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TrafficEngine, HeatLevel, HeatDisplay } from '../algorithm'
import type { TrendingTopic } from '@/types/social'

describe('TrafficEngine', () => {
  describe('calculateTopicHeat', () => {
    const baseTime = Date.now()

    function createTopic(overrides: Partial<TrendingTopic> = {}): TrendingTopic {
      return {
        id: 'test-topic-1',
        keyword: '#测试话题#',
        summary: '这是一个测试话题',
        categories: ['general'],
        isNew: true,
        isHot: false,
        baseScore: 50,
        velocity: 0,
        createdAt: baseTime,
        peakTime: baseTime + 1000 * 60 * 60 * 4, // 4小时后到达峰值
        ...overrides,
      }
    }

    it('应该计算上升期的热度', () => {
      const topic = createTopic({
        createdAt: baseTime,
        peakTime: baseTime + 1000 * 60 * 60 * 4, // 4小时后
      })

      // 刚创建时
      const heatAtStart = TrafficEngine.calculateTopicHeat(topic, baseTime)
      expect(heatAtStart).toBeGreaterThan(0)

      // 2小时后（上升期中间）
      const heatMidRise = TrafficEngine.calculateTopicHeat(
        topic,
        baseTime + 1000 * 60 * 60 * 2
      )
      expect(heatMidRise).toBeGreaterThan(heatAtStart)

      // 接近峰值时
      const heatNearPeak = TrafficEngine.calculateTopicHeat(
        topic,
        baseTime + 1000 * 60 * 60 * 3.9
      )
      expect(heatNearPeak).toBeGreaterThan(heatMidRise)
    })

    it('应该计算衰退期的热度', () => {
      const topic = createTopic({
        createdAt: baseTime,
        peakTime: baseTime + 1000 * 60 * 60 * 4, // 4小时后
      })

      // 峰值时刻
      const heatAtPeak = TrafficEngine.calculateTopicHeat(
        topic,
        topic.peakTime
      )

      // 峰值后1小时
      const heatAfter1h = TrafficEngine.calculateTopicHeat(
        topic,
        topic.peakTime + 1000 * 60 * 60 * 1
      )
      expect(heatAfter1h).toBeLessThan(heatAtPeak)

      // 峰值后12小时
      const heatAfter12h = TrafficEngine.calculateTopicHeat(
        topic,
        topic.peakTime + 1000 * 60 * 60 * 12
      )
      expect(heatAfter12h).toBeLessThan(heatAfter1h)

      // 热度不应该降到0（长尾效应）
      const heatAfter48h = TrafficEngine.calculateTopicHeat(
        topic,
        topic.peakTime + 1000 * 60 * 60 * 48
      )
      expect(heatAfter48h).toBeGreaterThan(0)
    })

    it('应该根据 baseScore 差异化热度', () => {
      const lowScoreTopic = createTopic({ baseScore: 30 })
      const highScoreTopic = createTopic({ baseScore: 90 })

      const lowHeat = TrafficEngine.calculateTopicHeat(lowScoreTopic, baseTime)
      const highHeat = TrafficEngine.calculateTopicHeat(highScoreTopic, baseTime)

      // 高分话题应该有更高的热度
      expect(highHeat).toBeGreaterThan(lowHeat)
      // 热度差异应该很大（因为是立方关系）
      expect(highHeat / lowHeat).toBeGreaterThan(10)
    })
  })

  describe('calculateSimpleHeat', () => {
    it('应该使用简化参数计算热度', () => {
      const baseTime = Date.now()
      const heat = TrafficEngine.calculateSimpleHeat(50, baseTime, baseTime)

      expect(heat).toBeGreaterThan(0)
    })

    it('应该支持自定义峰值时间', () => {
      const baseTime = Date.now()
      // 测试在不同时间点的热度差异
      // 峰值时间短的话题在相同时间点应该更接近峰值
      const currentTime = baseTime + 1000 * 60 * 60 // 1小时后
      const heat1 = TrafficEngine.calculateSimpleHeat(50, baseTime, currentTime, 2)
      const heat2 = TrafficEngine.calculateSimpleHeat(50, baseTime, currentTime, 24)

      // 峰值时间 2 小时的话题在 1 小时后更接近峰值，热度应该更高
      expect(heat1).toBeGreaterThan(heat2)
    })
  })

  describe('formatHeat', () => {
    it('应该格式化小于1万的热度', () => {
      expect(TrafficEngine.formatHeat(0)).toBe('0')
      expect(TrafficEngine.formatHeat(100)).toBe('100')
      expect(TrafficEngine.formatHeat(9999)).toBe('9999')
    })

    it('应该格式化万级热度', () => {
      expect(TrafficEngine.formatHeat(10000)).toBe('1.0万')
      expect(TrafficEngine.formatHeat(12345)).toBe('1.2万')
      // 99999 / 10000 = 9.9999，toFixed(1) 四舍五入后为 10.0
      expect(TrafficEngine.formatHeat(99999)).toBe('10.0万')
      expect(TrafficEngine.formatHeat(100000)).toBe('10万')
      expect(TrafficEngine.formatHeat(1234567)).toBe('123万')
    })

    it('应该格式化亿级热度', () => {
      expect(TrafficEngine.formatHeat(100000000)).toBe('1.0亿')
      expect(TrafficEngine.formatHeat(123456789)).toBe('1.2亿')
      expect(TrafficEngine.formatHeat(500000000)).toBe('5.0亿')
    })
  })

  describe('getHeatLevel', () => {
    it('应该返回沸级别', () => {
      // 排名前3且热度超过100万
      expect(TrafficEngine.getHeatLevel(1000000, 1, 120)).toBe('boil')
      expect(TrafficEngine.getHeatLevel(2000000, 3, 120)).toBe('boil')
    })

    it('应该返回爆级别', () => {
      // 热度超过50万，但不满足沸条件
      expect(TrafficEngine.getHeatLevel(500000, 5, 120)).toBe('explode')
      expect(TrafficEngine.getHeatLevel(800000, 10, 120)).toBe('explode')
    })

    it('应该返回新级别', () => {
      // 创建时间在1小时内
      expect(TrafficEngine.getHeatLevel(10000, 20, 30)).toBe('new')
      expect(TrafficEngine.getHeatLevel(50000, 15, 59)).toBe('new')
    })

    it('应该返回热级别', () => {
      // 热度超过10万，但不满足爆条件
      expect(TrafficEngine.getHeatLevel(100000, 10, 120)).toBe('hot')
      expect(TrafficEngine.getHeatLevel(400000, 8, 120)).toBe('hot')
    })

    it('应该返回普通级别', () => {
      // 不满足其他任何条件
      expect(TrafficEngine.getHeatLevel(50000, 20, 120)).toBe('normal')
      expect(TrafficEngine.getHeatLevel(10000, 50, 200)).toBe('normal')
    })
  })

  describe('getHeatDisplay', () => {
    const baseTime = Date.now()

    it('应该返回完整的热度显示信息', () => {
      const display = TrafficEngine.getHeatDisplay(1500000, 1, baseTime - 120 * 60 * 1000)

      expect(display.raw).toBe(1500000)
      expect(display.formatted).toBe('150万')
      expect(display.level).toBe('boil')
      expect(display.tag).toBe('沸')
      expect(display.isNew).toBe(false)
      expect(display.isHot).toBe(true)
    })

    it('应该正确标记新话题', () => {
      const display = TrafficEngine.getHeatDisplay(50000, 10, baseTime - 30 * 60 * 1000)

      expect(display.level).toBe('new')
      expect(display.tag).toBe('新')
      expect(display.isNew).toBe(true)
    })

    it('应该为普通话题返回空标签', () => {
      const display = TrafficEngine.getHeatDisplay(50000, 20, baseTime - 120 * 60 * 1000)

      expect(display.level).toBe('normal')
      expect(display.tag).toBe('')
    })
  })

  describe('generateInitialHeat', () => {
    it('应该生成基于 baseScore 的初始热度', () => {
      const lowHeat = TrafficEngine.generateInitialHeat(30)
      const highHeat = TrafficEngine.generateInitialHeat(90)

      expect(lowHeat).toBeGreaterThan(0)
      expect(highHeat).toBeGreaterThan(lowHeat)
    })

    it('应该包含随机波动', () => {
      const heats: number[] = []
      for (let i = 0; i < 10; i++) {
        heats.push(TrafficEngine.generateInitialHeat(50))
      }

      // 检查是否有变化（概率极高，除非随机数完全相同）
      const uniqueHeats = new Set(heats)
      expect(uniqueHeats.size).toBeGreaterThan(1)
    })
  })

  describe('calculateInteractions', () => {
    it('应该计算基于粉丝数的互动', () => {
      const result = TrafficEngine.calculateInteractions(10000)

      expect(result.views).toBeGreaterThan(0)
      expect(result.likes).toBeGreaterThan(0)
      expect(result.comments).toBeGreaterThanOrEqual(0)
      expect(result.reposts).toBeGreaterThanOrEqual(0)
    })

    it('应该根据热搜热度增加曝光', () => {
      const withoutTopic = TrafficEngine.calculateInteractions(1000, 0)
      const withTopic = TrafficEngine.calculateInteractions(1000, 1000000)

      expect(withTopic.views).toBeGreaterThan(withoutTopic.views)
    })

    it('应该根据超话活跃用户增加曝光', () => {
      const withoutSuperTopic = TrafficEngine.calculateInteractions(1000, 0, 0)
      const withSuperTopic = TrafficEngine.calculateInteractions(1000, 0, 10000)

      expect(withSuperTopic.views).toBeGreaterThan(withoutSuperTopic.views)
    })

    it('应该根据内容质量影响互动', () => {
      const lowQuality = TrafficEngine.calculateInteractions(10000, 0, 0, 0.1)
      const highQuality = TrafficEngine.calculateInteractions(10000, 0, 0, 0.9)

      // 高质量内容应该有更多互动（平均而言）
      // 注意：由于随机性，这里只检查曝光量的差异
      expect(highQuality.views).toBeGreaterThan(lowQuality.views)
    })

    it('应该保持互动转化漏斗', () => {
      const result = TrafficEngine.calculateInteractions(100000, 500000, 5000, 0.7)

      // 转化漏斗：views > likes > comments, reposts
      expect(result.views).toBeGreaterThan(result.likes)
      expect(result.likes).toBeGreaterThan(result.comments)
      expect(result.likes).toBeGreaterThan(result.reposts)
    })
  })
})
