/**
 * AccountService 社交关系相关测试
 * 测试关注、好友、拉黑等社交关系的管理功能
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

describe('AccountService - 社交关系管理', () => {
  let service: AccountService
  let entity1: any
  let entity2: any
  let entity3: any
  let account1: any
  let account2: any
  let account3: any

  beforeEach(async () => {
    await db.characterEntities.clear()
    await db.platformAccounts.clear()
    await db.socialRelations.clear()
    
    service = AccountService.getInstance()
    service.setSessionContext({
      sessionId: 'session-1',
      characterCardId: 'card-1',
    })

    // 创建测试用的实体和账号
    entity1 = await service.createEntity({
      type: 'npc',
      displayName: 'User1',
      source: 'system',
      scope: 'global',
    })
    entity2 = await service.createEntity({
      type: 'npc',
      displayName: 'User2',
      source: 'system',
      scope: 'global',
    })
    entity3 = await service.createEntity({
      type: 'npc',
      displayName: 'User3',
      source: 'system',
      scope: 'global',
    })

    account1 = await service.createPlatformAccount(entity1.id, 'weibo', {
      handle: 'user1',
      scope: 'global',
    })
    account2 = await service.createPlatformAccount(entity2.id, 'weibo', {
      handle: 'user2',
      scope: 'global',
    })
    account3 = await service.createPlatformAccount(entity3.id, 'weibo', {
      handle: 'user3',
      scope: 'global',
    })
  })

  afterEach(async () => {
    await db.characterEntities.clear()
    await db.platformAccounts.clear()
    await db.socialRelations.clear()
  })

  describe('followAccount', () => {
    it('应该创建关注关系', async () => {
      const relation = await service.followAccount(account1.id, account2.id)

      expect(relation.id).toBeDefined()
      expect(relation.fromAccountId).toBe(account1.id)
      expect(relation.toAccountId).toBe(account2.id)
      expect(relation.type).toBe('follow')
    })

    it('应该避免重复关注', async () => {
      const first = await service.followAccount(account1.id, account2.id)
      const second = await service.followAccount(account1.id, account2.id)

      expect(first.id).toBe(second.id) // 返回相同的关系
    })
  })

  describe('unfollowAccount', () => {
    it('应该取消关注', async () => {
      await service.followAccount(account1.id, account2.id)
      await service.unfollowAccount(account1.id, account2.id)

      const isFollowing = await service.hasAccountRelation(
        account1.id,
        account2.id,
        'follow'
      )
      expect(isFollowing).toBe(false)
    })

    it('应该对不存在的关系静默处理', async () => {
      // 不应该抛出错误
      await expect(
        service.unfollowAccount(account1.id, account2.id)
      ).resolves.not.toThrow()
    })
  })

  describe('addFriendAccounts', () => {
    it('应该创建双向好友关系', async () => {
      await service.addFriendAccounts(account1.id, account2.id)

      // 检查双向关系
      expect(
        await service.hasAccountRelation(account1.id, account2.id, 'friend')
      ).toBe(true)
      expect(
        await service.hasAccountRelation(account2.id, account1.id, 'friend')
      ).toBe(true)
    })

    it('应该避免重复添加好友', async () => {
      await service.addFriendAccounts(account1.id, account2.id)
      // 再次添加不应该抛出错误
      await expect(
        service.addFriendAccounts(account1.id, account2.id)
      ).resolves.not.toThrow()
    })
  })

  describe('removeFriendAccounts', () => {
    it('应该删除双向好友关系', async () => {
      await service.addFriendAccounts(account1.id, account2.id)
      await service.removeFriendAccounts(account1.id, account2.id)

      expect(
        await service.hasAccountRelation(account1.id, account2.id, 'friend')
      ).toBe(false)
      expect(
        await service.hasAccountRelation(account2.id, account1.id, 'friend')
      ).toBe(false)
    })
  })

  describe('getFollowingAccounts', () => {
    it('应该获取关注列表', async () => {
      await service.followAccount(account1.id, account2.id)
      await service.followAccount(account1.id, account3.id)

      const following = await service.getFollowingAccounts(account1.id)

      expect(following.length).toBe(2)
      expect(following.map(a => a.id)).toContain(account2.id)
      expect(following.map(a => a.id)).toContain(account3.id)
    })

    it('应该返回空数组当没有关注', async () => {
      const following = await service.getFollowingAccounts(account1.id)
      expect(following).toEqual([])
    })
  })

  describe('getFollowerAccounts', () => {
    it('应该获取粉丝列表', async () => {
      await service.followAccount(account2.id, account1.id)
      await service.followAccount(account3.id, account1.id)

      const followers = await service.getFollowerAccounts(account1.id)

      expect(followers.length).toBe(2)
      expect(followers.map(a => a.id)).toContain(account2.id)
      expect(followers.map(a => a.id)).toContain(account3.id)
    })

    it('应该返回空数组当没有粉丝', async () => {
      const followers = await service.getFollowerAccounts(account1.id)
      expect(followers).toEqual([])
    })
  })

  describe('getFriendAccounts', () => {
    it('应该获取好友列表', async () => {
      await service.addFriendAccounts(account1.id, account2.id)
      await service.addFriendAccounts(account1.id, account3.id)

      const friends = await service.getFriendAccounts(account1.id)

      expect(friends.length).toBe(2)
      expect(friends.map(a => a.id)).toContain(account2.id)
      expect(friends.map(a => a.id)).toContain(account3.id)
    })
  })

  describe('hasAccountRelation', () => {
    it('应该正确检查关注关系', async () => {
      await service.followAccount(account1.id, account2.id)

      expect(
        await service.hasAccountRelation(account1.id, account2.id, 'follow')
      ).toBe(true)
      expect(
        await service.hasAccountRelation(account2.id, account1.id, 'follow')
      ).toBe(false)
    })

    it('应该正确检查好友关系', async () => {
      await service.addFriendAccounts(account1.id, account2.id)

      expect(
        await service.hasAccountRelation(account1.id, account2.id, 'friend')
      ).toBe(true)
      expect(
        await service.hasAccountRelation(account2.id, account1.id, 'friend')
      ).toBe(true)
      expect(
        await service.hasAccountRelation(account1.id, account3.id, 'friend')
      ).toBe(false)
    })
  })

  describe('互关/互粉场景', () => {
    it('应该正确处理互关', async () => {
      await service.followAccount(account1.id, account2.id)
      await service.followAccount(account2.id, account1.id)

      // account1 关注 account2
      expect(
        await service.hasAccountRelation(account1.id, account2.id, 'follow')
      ).toBe(true)

      // account2 关注 account1
      expect(
        await service.hasAccountRelation(account2.id, account1.id, 'follow')
      ).toBe(true)

      // 获取 account1 的关注
      const following1 = await service.getFollowingAccounts(account1.id)
      expect(following1.map(a => a.id)).toContain(account2.id)

      // 获取 account1 的粉丝
      const followers1 = await service.getFollowerAccounts(account1.id)
      expect(followers1.map(a => a.id)).toContain(account2.id)
    })
  })

  describe('复杂关系场景', () => {
    it('应该支持同时拥有关注和好友关系', async () => {
      // 关注 + 好友
      await service.followAccount(account1.id, account2.id)
      await service.addFriendAccounts(account1.id, account2.id)

      expect(
        await service.hasAccountRelation(account1.id, account2.id, 'follow')
      ).toBe(true)
      expect(
        await service.hasAccountRelation(account1.id, account2.id, 'friend')
      ).toBe(true)
    })

    it('应该正确计算关注/粉丝/好友数量', async () => {
      // account1 关注 account2, account3
      await service.followAccount(account1.id, account2.id)
      await service.followAccount(account1.id, account3.id)

      // account2 关注 account1
      await service.followAccount(account2.id, account1.id)

      // account1 和 account3 是好友
      await service.addFriendAccounts(account1.id, account3.id)

      const following1 = await service.getFollowingAccounts(account1.id)
      const followers1 = await service.getFollowerAccounts(account1.id)
      const friends1 = await service.getFriendAccounts(account1.id)

      expect(following1.length).toBe(2) // 关注 2 人
      expect(followers1.length).toBe(1) // 1 个粉丝
      expect(friends1.length).toBe(1) // 1 个好友
    })
  })
})
