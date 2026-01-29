/**
 * AccountService 单元测试
 * 测试账号系统核心服务的功能
 */

// 必须首先导入 setup 以初始化 fake-indexeddb
import './setup'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AccountService } from '../accountService'
import { db } from '@/services/database'
import type {
  CharacterEntity,
  PlatformAccount,
  SessionContext,
  EntityScope,
  AccountScope,
} from '@/types/account'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}))

describe('AccountService', () => {
  let service: AccountService

  beforeEach(async () => {
    // 清理数据库
    await db.characterEntities.clear()
    await db.platformAccounts.clear()
    await db.socialRelations.clear()
    
    // 获取服务实例（单例）
    service = AccountService.getInstance()
    // 重置会话上下文
    service.setSessionContext(null as unknown as SessionContext)
  })

  afterEach(async () => {
    // 清理数据库
    await db.characterEntities.clear()
    await db.platformAccounts.clear()
    await db.socialRelations.clear()
  })

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = AccountService.getInstance()
      const instance2 = AccountService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('会话上下文管理', () => {
    it('应该正确设置和获取会话上下文', () => {
      const context: SessionContext = {
        sessionId: 'session-1',
        characterCardId: 'card-1',
      }
      
      service.setSessionContext(context)
      expect(service.getSessionContext()).toEqual(context)
    })

    it('应该在没有上下文时返回 null', () => {
      expect(service.getSessionContext()).toBeNull()
    })
  })

  describe('作用域验证', () => {
    it('应该允许 global 实体拥有任意作用域的账号', () => {
      expect(service.validateAccountScope('global', 'global')).toBe(true)
      expect(service.validateAccountScope('global', 'character')).toBe(true)
      expect(service.validateAccountScope('global', 'session')).toBe(true)
    })

    it('应该允许 character 实体拥有 character 或 session 作用域的账号', () => {
      expect(service.validateAccountScope('character', 'character')).toBe(true)
      expect(service.validateAccountScope('character', 'session')).toBe(true)
      expect(service.validateAccountScope('character', 'global')).toBe(false)
    })

    it('应该只允许 session 实体拥有 session 作用域的账号', () => {
      expect(service.validateAccountScope('session', 'session')).toBe(true)
      expect(service.validateAccountScope('session', 'character')).toBe(false)
      expect(service.validateAccountScope('session', 'global')).toBe(false)
    })
  })

  describe('实体可见性判断', () => {
    it('应该判断 global 实体对所有上下文可见', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Global NPC',
        source: 'system',
        scope: 'global',
      })

      const context: SessionContext = {
        sessionId: 'any-session',
        characterCardId: 'any-card',
      }

      expect(service.isEntityVisible(entity, context)).toBe(true)
    })

    it('应该判断 character 实体只对匹配的角色卡可见', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Character NPC',
        source: 'manual',
        scope: 'character',
        scopeCharacterCardId: 'card-1',
      })

      expect(service.isEntityVisible(entity, {
        sessionId: 'session-1',
        characterCardId: 'card-1',
      })).toBe(true)

      expect(service.isEntityVisible(entity, {
        sessionId: 'session-1',
        characterCardId: 'card-2',
      })).toBe(false)
    })

    it('应该判断 session 实体只对匹配的会话可见', async () => {
      service.setSessionContext({
        sessionId: 'session-1',
        characterCardId: 'card-1',
      })

      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Session NPC',
        source: 'social',
      })

      expect(service.isEntityVisible(entity, {
        sessionId: 'session-1',
        characterCardId: 'card-1',
      })).toBe(true)

      expect(service.isEntityVisible(entity, {
        sessionId: 'session-2',
        characterCardId: 'card-1',
      })).toBe(false)
    })
  })

  describe('实体管理', () => {
    describe('createEntity', () => {
      it('应该创建 NPC 实体', async () => {
        const entity = await service.createEntity({
          type: 'npc',
          displayName: 'Test NPC',
          source: 'manual',
          scope: 'global',
        })

        expect(entity.id).toBeDefined()
        expect(entity.type).toBe('npc')
        expect(entity.displayName).toBe('Test NPC')
        expect(entity.scope).toBe('global')
        expect(entity.createdAt).toBeDefined()
        expect(entity.updatedAt).toBeDefined()
      })

      it('应该强制玩家实体为 global 作用域', async () => {
        const entity = await service.createEntity({
          type: 'player',
          displayName: 'Player',
          source: 'system',
          scope: 'session', // 尝试设置为 session
        })

        expect(entity.scope).toBe('global') // 应该被强制为 global
      })

      it('应该根据来源推断默认作用域', async () => {
        service.setSessionContext({
          sessionId: 'session-1',
          characterCardId: 'card-1',
        })

        // system 来源应该是 global
        const systemEntity = await service.createEntity({
          type: 'npc',
          displayName: 'System NPC',
          source: 'system',
        })
        expect(systemEntity.scope).toBe('global')

        // character_card 来源应该是 character
        const cardEntity = await service.createEntity({
          type: 'npc',
          displayName: 'Card NPC',
          source: 'character_card',
        })
        expect(cardEntity.scope).toBe('character')

        // social 来源应该是 session
        const socialEntity = await service.createEntity({
          type: 'npc',
          displayName: 'Social NPC',
          source: 'social',
        })
        expect(socialEntity.scope).toBe('session')
      })
    })

    describe('getEntity', () => {
      it('应该获取存在的实体', async () => {
        const created = await service.createEntity({
          type: 'npc',
          displayName: 'Test',
          source: 'manual',
          scope: 'global',
        })

        const found = await service.getEntity(created.id)
        expect(found).toEqual(created)
      })

      it('应该对不存在的实体返回 null', async () => {
        const found = await service.getEntity('non-existent')
        expect(found).toBeNull()
      })
    })

    describe('updateEntity', () => {
      it('应该更新实体属性', async () => {
        const entity = await service.createEntity({
          type: 'npc',
          displayName: 'Original',
          source: 'manual',
          scope: 'global',
        })

        // 等待一小段时间确保时间戳不同
        await new Promise(resolve => setTimeout(resolve, 10))

        const updated = await service.updateEntity(entity.id, {
          displayName: 'Updated',
          bio: 'New bio',
        })

        expect(updated.displayName).toBe('Updated')
        expect(updated.bio).toBe('New bio')
        expect(updated.updatedAt).toBeGreaterThanOrEqual(entity.updatedAt)
      })

      it('应该禁止更改玩家实体的作用域为非 global', async () => {
        const player = await service.createEntity({
          type: 'player',
          displayName: 'Player',
          source: 'system',
        })

        await expect(
          service.updateEntity(player.id, { scope: 'session' })
        ).rejects.toThrow('Player entity scope must be global')
      })

      it('应该对不存在的实体抛出错误', async () => {
        await expect(
          service.updateEntity('non-existent', { displayName: 'Test' })
        ).rejects.toThrow('Entity not found')
      })
    })

    describe('deleteEntity', () => {
      it('应该删除实体及其所有账号和关系', async () => {
        const entity = await service.createEntity({
          type: 'npc',
          displayName: 'Test',
          source: 'manual',
          scope: 'global',
        })

        const account = await service.createPlatformAccount(
          entity.id,
          'weibo',
          {
            handle: 'test_handle',
            scope: 'global',
          }
        )

        // 创建另一个实体和账号用于测试关系
        const entity2 = await service.createEntity({
          type: 'npc',
          displayName: 'Test2',
          source: 'manual',
          scope: 'global',
        })
        const account2 = await service.createPlatformAccount(
          entity2.id,
          'weibo',
          {
            handle: 'test_handle_2',
            scope: 'global',
          }
        )

        // 创建关系
        await service.followAccount(account.id, account2.id)
        await service.followAccount(account2.id, account.id)

        // 删除第一个实体
        await service.deleteEntity(entity.id)

        // 验证实体被删除
        expect(await service.getEntity(entity.id)).toBeNull()

        // 验证账号被删除
        expect(await service.getPlatformAccount(account.id)).toBeNull()

        // 验证关系被删除
        expect(await service.hasAccountRelation(account2.id, account.id, 'follow')).toBe(false)
      })
    })

    describe('getVisibleEntities', () => {
      it('应该返回当前上下文可见的所有实体', async () => {
        service.setSessionContext({
          sessionId: 'session-1',
          characterCardId: 'card-1',
        })

        // 创建不同作用域的实体
        const globalEntity = await service.createEntity({
          type: 'npc',
          displayName: 'Global',
          source: 'system',
          scope: 'global',
        })

        const characterEntity = await service.createEntity({
          type: 'npc',
          displayName: 'Character',
          source: 'character_card',
          scope: 'character',
          scopeCharacterCardId: 'card-1',
        })

        const sessionEntity = await service.createEntity({
          type: 'npc',
          displayName: 'Session',
          source: 'social',
          scope: 'session',
          scopeSessionId: 'session-1',
        })

        // 创建不可见的实体
        await service.createEntity({
          type: 'npc',
          displayName: 'Other Session',
          source: 'social',
          scope: 'session',
          scopeSessionId: 'session-2',
        })

        const visible = await service.getVisibleEntities()

        expect(visible.length).toBe(3)
        expect(visible.map(e => e.id)).toContain(globalEntity.id)
        expect(visible.map(e => e.id)).toContain(characterEntity.id)
        expect(visible.map(e => e.id)).toContain(sessionEntity.id)
      })
    })

    describe('getPlayerEntity', () => {
      it('应该返回玩家实体', async () => {
        await service.createEntity({
          type: 'player',
          displayName: 'Player',
          source: 'system',
        })

        const player = await service.getPlayerEntity()
        expect(player).not.toBeNull()
        expect(player?.type).toBe('player')
      })

      it('应该在没有玩家实体时返回 null', async () => {
        const player = await service.getPlayerEntity()
        expect(player).toBeNull()
      })
    })

    describe('getOrCreatePlayerEntity', () => {
      it('应该创建新的玩家实体', async () => {
        const player = await service.getOrCreatePlayerEntity('TestPlayer')

        expect(player.type).toBe('player')
        expect(player.displayName).toBe('TestPlayer')
        expect(player.scope).toBe('global')
      })

      it('应该返回已存在的玩家实体', async () => {
        const first = await service.getOrCreatePlayerEntity('Player1')
        const second = await service.getOrCreatePlayerEntity('Player2')

        expect(first.id).toBe(second.id)
        expect(second.displayName).toBe('Player2') // 名称应该被更新
      })
    })
  })

  describe('搜索实体', () => {
    beforeEach(async () => {
      service.setSessionContext({
        sessionId: 'session-1',
        characterCardId: 'card-1',
      })

      await service.createEntity({
        type: 'npc',
        displayName: 'Alice',
        bio: 'A friendly NPC',
        source: 'system',
        scope: 'global',
      })

      await service.createEntity({
        type: 'npc',
        displayName: 'Bob',
        bio: 'A mysterious person',
        source: 'system',
        scope: 'global',
      })

      await service.createEntity({
        type: 'npc',
        displayName: 'Charlie',
        bio: 'A good friend',
        source: 'system',
        scope: 'global',
      })
    })

    it('应该按显示名搜索', async () => {
      const results = await service.searchEntities('Alice')
      expect(results.length).toBe(1)
      expect(results[0].displayName).toBe('Alice')
    })

    it('应该按简介搜索', async () => {
      const results = await service.searchEntities('good friend', { fields: ['bio'] })
      expect(results.length).toBe(1)
      expect(results[0].displayName).toBe('Charlie')
    })

    it('应该支持分页', async () => {
      const results = await service.searchEntities('', {
        limit: 2,
        offset: 0,
      })
      expect(results.length).toBe(2)
    })
  })
})
