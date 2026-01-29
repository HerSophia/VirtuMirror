/**
 * AccountService 平台账号相关测试
 * 测试平台账号的创建、查询、更新、删除等功能
 */

// 必须首先导入 setup 以初始化 fake-indexeddb
import './setup'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AccountService } from '../accountService'
import { db } from '@/services/database'
import type { SessionContext } from '@/types/account'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}))

describe('AccountService - 平台账号管理', () => {
  let service: AccountService

  beforeEach(async () => {
    await db.characterEntities.clear()
    await db.platformAccounts.clear()
    await db.socialRelations.clear()
    
    service = AccountService.getInstance()
    service.setSessionContext({
      sessionId: 'session-1',
      characterCardId: 'card-1',
    })
  })

  afterEach(async () => {
    await db.characterEntities.clear()
    await db.platformAccounts.clear()
    await db.socialRelations.clear()
  })

  describe('createPlatformAccount', () => {
    it('应该为实体创建平台账号', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test NPC',
        source: 'system',
        scope: 'global',
      })

      const account = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'test_user',
          nickname: 'Test User',
          scope: 'global',
        }
      )

      expect(account.id).toBeDefined()
      expect(account.entityId).toBe(entity.id)
      expect(account.platformId).toBe('weibo')
      expect(account.handle).toBe('test_user')
      expect(account.nickname).toBe('Test User')
      expect(account.scope).toBe('global')
    })

    it('应该拒绝为不存在的实体创建账号', async () => {
      await expect(
        service.createPlatformAccount('non-existent', 'weibo', {
          handle: 'test',
          scope: 'global',
        })
      ).rejects.toThrow('Entity not found')
    })

    it('应该拒绝重复的 handle', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      await service.createPlatformAccount(entity.id, 'weibo', {
        handle: 'unique_handle',
        scope: 'global',
      })

      await expect(
        service.createPlatformAccount(entity.id, 'weibo', {
          handle: 'unique_handle',
          scope: 'global',
        })
      ).rejects.toThrow('Handle already exists')
    })

    it('应该为 session 实体强制账号为 session 作用域', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Session NPC',
        source: 'social',
        scope: 'session',
        scopeSessionId: 'session-1',
      })

      const account = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'session_user',
          scope: 'global', // 尝试设置为 global
        }
      )

      expect(account.scope).toBe('session') // 应该被强制为 session
    })

    it('应该拒绝账号作用域比实体更全局', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Character NPC',
        source: 'character_card',
        scope: 'character',
        scopeCharacterCardId: 'card-1',
      })

      await expect(
        service.createPlatformAccount(entity.id, 'weibo', {
          handle: 'test',
          scope: 'global',
        })
      ).rejects.toThrow('cannot be more global')
    })

    it('应该为玩家实体默认推断 character 作用域', async () => {
      const player = await service.createEntity({
        type: 'player',
        displayName: 'Player',
        source: 'system',
      })

      const account = await service.createPlatformAccount(
        player.id,
        'weibo',
        {
          handle: 'player_weibo',
          // 不指定 scope
        } as any
      )

      expect(account.scope).toBe('character')
      expect(account.scopeCharacterCardId).toBe('card-1')
    })

    it('应该正确处理 platformData', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      const account = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'test',
          scope: 'global',
          platformData: {
            followers: 1000,
            verified: true,
            verifyType: 'personal_kol',
          },
        }
      )

      expect(account.platformData?.followers).toBe(1000)
      expect(account.platformData?.verified).toBe(true)
      expect(account.platformData?.verifyType).toBe('personal_kol')
    })
  })

  describe('getPlatformAccount', () => {
    it('应该获取存在的账号', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      const created = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'test',
          scope: 'global',
        }
      )

      const found = await service.getPlatformAccount(created.id)
      expect(found).toEqual(created)
    })

    it('应该对不存在的账号返回 null', async () => {
      const found = await service.getPlatformAccount('non-existent')
      expect(found).toBeNull()
    })
  })

  describe('findAccountByHandle', () => {
    it('应该通过 handle 找到账号', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      const account = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'unique_handle',
          scope: 'global',
        }
      )

      const found = await service.findAccountByHandle('weibo', 'unique_handle')
      expect(found?.id).toBe(account.id)
    })

    it('应该对不存在的 handle 返回 null', async () => {
      const found = await service.findAccountByHandle('weibo', 'not_exist')
      expect(found).toBeNull()
    })
  })

  describe('getAccountsByEntity', () => {
    it('应该获取实体的所有账号', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      await service.createPlatformAccount(entity.id, 'weibo', {
        handle: 'weibo_user',
        scope: 'global',
      })

      await service.createPlatformAccount(entity.id, 'bilibili', {
        handle: 'bili_user',
        scope: 'global',
      })

      const accounts = await service.getAccountsByEntity(entity.id)
      expect(accounts.length).toBe(2)
    })
  })

  describe('getVisibleAccounts', () => {
    it('应该返回当前上下文可见的账号', async () => {
      // 创建 global 实体和账号
      const globalEntity = await service.createEntity({
        type: 'npc',
        displayName: 'Global',
        source: 'system',
        scope: 'global',
      })
      await service.createPlatformAccount(globalEntity.id, 'weibo', {
        handle: 'global_weibo',
        scope: 'global',
      })

      // 创建 character 实体和账号
      const charEntity = await service.createEntity({
        type: 'npc',
        displayName: 'Character',
        source: 'character_card',
        scope: 'character',
        scopeCharacterCardId: 'card-1',
      })
      await service.createPlatformAccount(charEntity.id, 'weibo', {
        handle: 'char_weibo',
        scope: 'character',
        scopeCharacterCardId: 'card-1',
      })

      // 创建不可见的 character 账号
      const otherCharEntity = await service.createEntity({
        type: 'npc',
        displayName: 'Other Character',
        source: 'character_card',
        scope: 'character',
        scopeCharacterCardId: 'card-2',
      })
      await service.createPlatformAccount(otherCharEntity.id, 'weibo', {
        handle: 'other_char_weibo',
        scope: 'character',
        scopeCharacterCardId: 'card-2',
      })

      const visible = await service.getVisibleAccounts('weibo')
      expect(visible.length).toBe(2)
      expect(visible.map(a => a.handle)).toContain('global_weibo')
      expect(visible.map(a => a.handle)).toContain('char_weibo')
      expect(visible.map(a => a.handle)).not.toContain('other_char_weibo')
    })
  })

  describe('findPlayerAccountForContext', () => {
    it('应该找到玩家在当前上下文的账号', async () => {
      const player = await service.getOrCreatePlayerEntity('Player')

      const account = await service.createPlatformAccount(
        player.id,
        'weibo',
        {
          handle: 'player_weibo',
          scope: 'character',
          scopeCharacterCardId: 'card-1',
        }
      )

      const found = await service.findPlayerAccountForContext('weibo')
      expect(found?.id).toBe(account.id)
    })

    it('应该在没有玩家账号时返回 null', async () => {
      const found = await service.findPlayerAccountForContext('weibo')
      expect(found).toBeNull()
    })
  })

  describe('checkMissingPlayerAccount', () => {
    it('应该检测到缺少玩家账号', async () => {
      await service.getOrCreatePlayerEntity('Player')

      const missing = await service.checkMissingPlayerAccount('weibo')
      expect(missing).not.toBeNull()
      expect(missing?.platformId).toBe('weibo')
      expect(missing?.platformName).toBe('微博')
    })

    it('应该在有玩家账号时返回 null', async () => {
      const player = await service.getOrCreatePlayerEntity('Player')
      await service.createPlatformAccount(player.id, 'weibo', {
        handle: 'player_weibo',
        scope: 'character',
        scopeCharacterCardId: 'card-1',
      })

      const missing = await service.checkMissingPlayerAccount('weibo')
      expect(missing).toBeNull()
    })
  })

  describe('updatePlatformAccount', () => {
    it('应该更新账号属性', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      const account = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'original',
          nickname: 'Original Name',
          scope: 'global',
        }
      )

      const updated = await service.updatePlatformAccount(account.id, {
        nickname: 'Updated Name',
        bioOverride: 'New bio',
      })

      expect(updated.nickname).toBe('Updated Name')
      expect(updated.bioOverride).toBe('New bio')
      expect(updated.handle).toBe('original') // handle 不应该变
    })

    it('应该拒绝更新为已存在的 handle', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      await service.createPlatformAccount(entity.id, 'weibo', {
        handle: 'handle_a',
        scope: 'global',
      })

      const accountB = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'handle_b',
          scope: 'global',
        }
      )

      await expect(
        service.updatePlatformAccount(accountB.id, { handle: 'handle_a' })
      ).rejects.toThrow('Handle already exists')
    })

    it('应该拒绝更新作用域为更全局', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'manual',
        scope: 'character',
        scopeCharacterCardId: 'card-1',
      })

      const account = await service.createPlatformAccount(
        entity.id,
        'weibo',
        {
          handle: 'test',
          scope: 'character',
          scopeCharacterCardId: 'card-1',
        }
      )

      await expect(
        service.updatePlatformAccount(account.id, { scope: 'global' })
      ).rejects.toThrow('cannot be more global')
    })
  })

  describe('deletePlatformAccount', () => {
    it('应该删除账号及其相关关系', async () => {
      const entity1 = await service.createEntity({
        type: 'npc',
        displayName: 'Test1',
        source: 'system',
        scope: 'global',
      })
      const entity2 = await service.createEntity({
        type: 'npc',
        displayName: 'Test2',
        source: 'system',
        scope: 'global',
      })

      const account1 = await service.createPlatformAccount(
        entity1.id,
        'weibo',
        { handle: 'user1', scope: 'global' }
      )
      const account2 = await service.createPlatformAccount(
        entity2.id,
        'weibo',
        { handle: 'user2', scope: 'global' }
      )

      // 创建关系
      await service.followAccount(account1.id, account2.id)

      // 删除账号
      await service.deletePlatformAccount(account1.id)

      // 验证账号被删除
      expect(await service.getPlatformAccount(account1.id)).toBeNull()

      // 验证关系被删除
      const followers = await service.getFollowerAccounts(account2.id)
      expect(followers.length).toBe(0)
    })
  })

  describe('getRandomAccountForPlatform', () => {
    it('应该随机返回一个可见账号', async () => {
      const entity = await service.createEntity({
        type: 'npc',
        displayName: 'Test',
        source: 'system',
        scope: 'global',
      })

      await service.createPlatformAccount(entity.id, 'weibo', {
        handle: 'test_user',
        scope: 'global',
      })

      const random = await service.getRandomAccountForPlatform('weibo')
      expect(random).not.toBeNull()
      expect(random?.platformId).toBe('weibo')
    })

    it('应该在没有可见账号时返回 null', async () => {
      const random = await service.getRandomAccountForPlatform('weibo')
      expect(random).toBeNull()
    })
  })
})
