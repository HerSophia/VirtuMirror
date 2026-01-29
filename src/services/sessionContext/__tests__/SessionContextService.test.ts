/**
 * SessionContextService 单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SessionContextService } from '../SessionContextService'
import { eventBus } from '@/services/eventBus'
import type { ContentSourceTracking, TrackedContent } from '@/types/sessionContext'

// Mock eventBus
vi.mock('@/services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}))

// Mock loggerService
vi.mock('@/services/logger', () => ({
  loggerService: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

describe('SessionContextService', () => {
  let service: SessionContextService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SessionContextService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始状态', () => {
    it('应该初始化为空上下文', () => {
      expect(service.context.sessionId).toBeNull()
      expect(service.context.messageId).toBeNull()
      expect(service.context.swipeId).toBeNull()
      expect(service.context.characterName).toBeNull()
      expect(service.context.playerName).toBeNull()
      expect(service.context.platform).toBeNull()
      expect(service.context.lastUpdatedAt).toBeNull()
    })

    it('isConnected 应该为 false', () => {
      expect(service.isConnected).toBe(false)
    })
  })

  describe('updateSession', () => {
    it('应该正确更新会话信息', () => {
      service.updateSession('session-123', 'Alice', 'Player', 'sillytavern')

      expect(service.context.sessionId).toBe('session-123')
      expect(service.context.characterName).toBe('Alice')
      expect(service.context.playerName).toBe('Player')
      expect(service.context.platform).toBe('sillytavern')
      expect(service.isConnected).toBe(true)
    })

    it('新会话应该重置楼层和 Swipe', () => {
      // 先设置一个会话
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateMessage(5)
      service.updateSwipe(2)

      // 切换到新会话
      service.updateSession('session-2', 'Bob', 'Player2', 'test')

      expect(service.context.messageId).toBe(0)
      expect(service.context.swipeId).toBe(0)
    })

    it('同一会话更新应该保持楼层和 Swipe', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateMessage(5)
      service.updateSwipe(2)

      // 同一会话更新角色名
      service.updateSession('session-1', 'Alice Updated', 'Player', 'test')

      expect(service.context.messageId).toBe(5)
      expect(service.context.swipeId).toBe(2)
    })

    it('应该发布 session-context:changed 事件', () => {
      service.updateSession('session-123', 'Alice', 'Player', 'test')

      expect(eventBus.emit).toHaveBeenCalledWith(
        'session-context:changed',
        expect.objectContaining({
          type: 'session',
        })
      )
    })

    it('应该发布 session:changed 事件', () => {
      service.updateSession('session-123', 'Alice', 'Player', 'test')

      expect(eventBus.emit).toHaveBeenCalledWith(
        'session:changed',
        expect.objectContaining({
          sessionId: 'session-123',
          characterName: 'Alice',
        })
      )
    })
  })

  describe('updateMessage', () => {
    it('已连接时应该更新楼层', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateMessage(10)

      expect(service.context.messageId).toBe(10)
    })

    it('未连接时不应该更新楼层', () => {
      service.updateMessage(10)

      expect(service.context.messageId).toBeNull()
    })

    it('应该发布 session-context:changed 事件', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      vi.clearAllMocks()

      service.updateMessage(10)

      expect(eventBus.emit).toHaveBeenCalledWith(
        'session-context:changed',
        expect.objectContaining({
          type: 'message',
        })
      )
    })
  })

  describe('updateSwipe', () => {
    it('已连接时应该更新 Swipe', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateSwipe(3)

      expect(service.context.swipeId).toBe(3)
    })

    it('未连接时不应该更新 Swipe', () => {
      service.updateSwipe(3)

      expect(service.context.swipeId).toBeNull()
    })

    it('应该发布 session-context:changed 事件', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      vi.clearAllMocks()

      service.updateSwipe(3)

      expect(eventBus.emit).toHaveBeenCalledWith(
        'session-context:changed',
        expect.objectContaining({
          type: 'swipe',
        })
      )
    })
  })

  describe('clearContext', () => {
    it('应该清除所有上下文信息', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateMessage(5)
      service.updateSwipe(2)

      service.clearContext()

      expect(service.context.sessionId).toBeNull()
      expect(service.context.messageId).toBeNull()
      expect(service.context.swipeId).toBeNull()
      expect(service.isConnected).toBe(false)
    })

    it('应该发布 session-context:changed 事件', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      vi.clearAllMocks()

      service.clearContext()

      expect(eventBus.emit).toHaveBeenCalledWith(
        'session-context:changed',
        expect.objectContaining({
          type: 'clear',
        })
      )
    })
  })

  describe('getCurrentSourceTracking', () => {
    it('已连接时应该返回来源追踪信息', () => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateMessage(5)
      service.updateSwipe(2)

      const source = service.getCurrentSourceTracking()

      expect(source).not.toBeNull()
      expect(source?.sessionId).toBe('session-1')
      expect(source?.messageId).toBe(5)
      expect(source?.swipeId).toBe(2)
      expect(source?.createdAt).toBeDefined()
    })

    it('未连接时应该返回 null', () => {
      const source = service.getCurrentSourceTracking()

      expect(source).toBeNull()
    })
  })

  describe('buildSourceFilter', () => {
    // 创建测试数据
    const createTrackedItem = (source?: ContentSourceTracking): TrackedContent => ({
      source,
    })

    beforeEach(() => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateMessage(5)
      service.updateSwipe(2)
    })

    describe('all 模式', () => {
      it('应该通过所有数据', () => {
        const filter = service.buildSourceFilter('all')

        expect(filter(createTrackedItem())).toBe(true)
        expect(
          filter(
            createTrackedItem({
              sessionId: 'other-session',
              messageId: 1,
              swipeId: 1,
              createdAt: Date.now(),
            })
          )
        ).toBe(true)
      })
    })

    describe('session 模式', () => {
      it('应该只通过当前会话的数据', () => {
        const filter = service.buildSourceFilter('session')

        expect(
          filter(
            createTrackedItem({
              sessionId: 'session-1',
              messageId: 1,
              swipeId: 1,
              createdAt: Date.now(),
            })
          )
        ).toBe(true)

        expect(
          filter(
            createTrackedItem({
              sessionId: 'other-session',
              messageId: 1,
              swipeId: 1,
              createdAt: Date.now(),
            })
          )
        ).toBe(false)
      })

      it('默认应该包含无来源数据', () => {
        const filter = service.buildSourceFilter('session')

        expect(filter(createTrackedItem())).toBe(true)
      })

      it('可以配置排除无来源数据', () => {
        const filter = service.buildSourceFilter('session', {
          includeUntracked: false,
        })

        expect(filter(createTrackedItem())).toBe(false)
      })
    })

    describe('message 模式', () => {
      it('应该只通过当前楼层的数据', () => {
        const filter = service.buildSourceFilter('message')

        expect(
          filter(
            createTrackedItem({
              sessionId: 'session-1',
              messageId: 5,
              swipeId: 1,
              createdAt: Date.now(),
            })
          )
        ).toBe(true)

        expect(
          filter(
            createTrackedItem({
              sessionId: 'session-1',
              messageId: 4,
              swipeId: 1,
              createdAt: Date.now(),
            })
          )
        ).toBe(false)
      })
    })

    describe('swipe 模式', () => {
      it('应该只通过当前 Swipe 的数据', () => {
        const filter = service.buildSourceFilter('swipe')

        expect(
          filter(
            createTrackedItem({
              sessionId: 'session-1',
              messageId: 5,
              swipeId: 2,
              createdAt: Date.now(),
            })
          )
        ).toBe(true)

        expect(
          filter(
            createTrackedItem({
              sessionId: 'session-1',
              messageId: 5,
              swipeId: 1,
              createdAt: Date.now(),
            })
          )
        ).toBe(false)
      })
    })

    describe('未连接状态', () => {
      it('应该返回全通过滤器', () => {
        const disconnectedService = new SessionContextService()
        const filter = disconnectedService.buildSourceFilter('session')

        expect(
          filter(
            createTrackedItem({
              sessionId: 'any-session',
              messageId: 1,
              swipeId: 1,
              createdAt: Date.now(),
            })
          )
        ).toBe(true)
      })
    })
  })

  describe('belongsTo 方法', () => {
    const createTrackedItem = (source?: ContentSourceTracking): TrackedContent => ({
      source,
    })

    beforeEach(() => {
      service.updateSession('session-1', 'Alice', 'Player', 'test')
      service.updateMessage(5)
      service.updateSwipe(2)
    })

    describe('belongsToCurrentSession', () => {
      it('同会话应该返回 true', () => {
        const item = createTrackedItem({
          sessionId: 'session-1',
          messageId: 1,
          swipeId: 1,
          createdAt: Date.now(),
        })

        expect(service.belongsToCurrentSession(item)).toBe(true)
      })

      it('不同会话应该返回 false', () => {
        const item = createTrackedItem({
          sessionId: 'other-session',
          messageId: 1,
          swipeId: 1,
          createdAt: Date.now(),
        })

        expect(service.belongsToCurrentSession(item)).toBe(false)
      })

      it('无来源数据应该返回 true', () => {
        expect(service.belongsToCurrentSession(createTrackedItem())).toBe(true)
      })
    })

    describe('belongsToCurrentMessage', () => {
      it('同楼层应该返回 true', () => {
        const item = createTrackedItem({
          sessionId: 'session-1',
          messageId: 5,
          swipeId: 1,
          createdAt: Date.now(),
        })

        expect(service.belongsToCurrentMessage(item)).toBe(true)
      })

      it('不同楼层应该返回 false', () => {
        const item = createTrackedItem({
          sessionId: 'session-1',
          messageId: 4,
          swipeId: 1,
          createdAt: Date.now(),
        })

        expect(service.belongsToCurrentMessage(item)).toBe(false)
      })
    })

    describe('belongsToCurrentSwipe', () => {
      it('同 Swipe 应该返回 true', () => {
        const item = createTrackedItem({
          sessionId: 'session-1',
          messageId: 5,
          swipeId: 2,
          createdAt: Date.now(),
        })

        expect(service.belongsToCurrentSwipe(item)).toBe(true)
      })

      it('不同 Swipe 应该返回 false', () => {
        const item = createTrackedItem({
          sessionId: 'session-1',
          messageId: 5,
          swipeId: 1,
          createdAt: Date.now(),
        })

        expect(service.belongsToCurrentSwipe(item)).toBe(false)
      })
    })
  })

  describe('响应式状态', () => {
    it('context 应该是响应式的', () => {
      // 获取初始引用
      const contextRef = service.context

      // 更新会话
      service.updateSession('session-1', 'Alice', 'Player', 'test')

      // 同一引用应该反映变化（响应式）
      expect(contextRef.sessionId).toBe('session-1')
    })
  })
})
