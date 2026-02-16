import './setup'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accountService } from '@/services/account'
import { db } from '@/services/database'
import { SocialGraphError, getSocialGraphService, resetSocialGraphService } from '../socialGraphService'

describe('SocialGraphService', () => {
  const platformId = 'weibo'

  beforeEach(async () => {
    await db.socialRelations.clear()
    await db.platformAccounts.clear()
    await db.characterEntities.clear()
    resetSocialGraphService()
  })

  afterEach(async () => {
    await db.socialRelations.clear()
    await db.platformAccounts.clear()
    await db.characterEntities.clear()
  })

  async function createAccount(name: string, handle: string): Promise<string> {
    const entity = await accountService.createEntity({
      type: 'npc',
      displayName: name,
      source: 'system',
      scope: 'global',
    })

    const account = await accountService.createPlatformAccount(entity.id, platformId, {
      handle,
      scope: 'global',
    })

    return account.id
  }

  it('supports follow / followers / following query', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')
    const bob = await createAccount('Bob', 'bob')

    await socialGraphService.follow(alice, bob, { platformId })
    await socialGraphService.follow(alice, bob, { platformId })

    const followers = await socialGraphService.getFollowers(bob, { platformId })
    const following = await socialGraphService.getFollowing(alice, { platformId })

    expect(followers.items.map((item) => item.accountId)).toEqual([alice])
    expect(following.items.map((item) => item.accountId)).toEqual([bob])
    expect(await socialGraphService.isFollowing(alice, bob, platformId)).toBe(true)
  })

  it('rejects self follow', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')

    await expect(socialGraphService.follow(alice, alice, { platformId })).rejects.toMatchObject({
      code: 'SELF_FOLLOW_NOT_ALLOWED',
    })
  })

  it('applies block and prevents follow while blocked', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')
    const bob = await createAccount('Bob', 'bob')

    await socialGraphService.follow(alice, bob, { platformId })
    await socialGraphService.block(alice, bob, { platformId })

    expect(await socialGraphService.isFollowing(alice, bob, platformId)).toBe(false)
    expect(await socialGraphService.isBlocked(alice, bob, platformId)).toBe(true)

    await expect(socialGraphService.follow(alice, bob, { platformId })).rejects.toBeInstanceOf(
      SocialGraphError
    )

    await socialGraphService.unblock(alice, bob, { platformId })
    expect(await socialGraphService.isBlocked(alice, bob, platformId)).toBe(false)
  })

  it('supports mute / unmute and expiration check', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')
    const bob = await createAccount('Bob', 'bob')

    await socialGraphService.mute(alice, bob, { platformId, durationMs: 50 })
    expect(await socialGraphService.isMuted(alice, bob, platformId)).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 70))
    expect(await socialGraphService.isMuted(alice, bob, platformId)).toBe(false)

    await socialGraphService.mute(alice, bob, { platformId })
    await socialGraphService.unmute(alice, bob, { platformId })
    expect(await socialGraphService.isMuted(alice, bob, platformId)).toBe(false)
  })

  it('calculates mutual follows and relationship stats', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')
    const bob = await createAccount('Bob', 'bob')
    const carol = await createAccount('Carol', 'carol')

    await socialGraphService.follow(alice, bob, { platformId })
    await socialGraphService.follow(bob, alice, { platformId })
    await socialGraphService.follow(alice, carol, { platformId })

    const mutual = await socialGraphService.getMutualFollows(alice, { platformId })
    const stats = await socialGraphService.getRelationshipStats(alice, platformId)

    expect(mutual.map((item) => item.accountId)).toEqual([bob])
    expect(stats.following).toBe(2)
    expect(stats.followers).toBe(1)
    expect(stats.mutualFollows).toBe(1)
  })

  it('returns follow recommendations from second-degree relations', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')
    const bob = await createAccount('Bob', 'bob')
    const carol = await createAccount('Carol', 'carol')
    const dave = await createAccount('Dave', 'dave')

    await socialGraphService.follow(alice, bob, { platformId })
    await socialGraphService.follow(bob, carol, { platformId })
    await socialGraphService.follow(dave, carol, { platformId })

    const recommendations = await socialGraphService.getRecommendedFollows(alice, {
      platformId,
      limit: 5,
    })

    const recommendationIds = recommendations.map((item) => item.accountId)
    expect(recommendationIds).toContain(carol)
    expect(recommendationIds).not.toContain(alice)
    expect(recommendationIds).not.toContain(bob)
  })

  it('supports batch follow with partial failures', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')
    const bob = await createAccount('Bob', 'bob')
    const carol = await createAccount('Carol', 'carol')

    const result = await socialGraphService.batchFollow(alice, [bob, carol, 'missing-account'], {
      platformId,
      stopOnError: false,
    })

    expect(result.successIds).toEqual([bob, carol])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].toId).toBe('missing-account')
  })

  it('emits relation change events', async () => {
    const socialGraphService = getSocialGraphService()
    const alice = await createAccount('Alice', 'alice')
    const bob = await createAccount('Bob', 'bob')

    const events: string[] = []
    const off = socialGraphService.onRelationChange((event) => {
      events.push(event.type)
    })

    await socialGraphService.follow(alice, bob, { platformId })
    off()

    expect(events).toContain('social:relation:followed')
    expect(events).toContain('social:stats:updated')
  })
})
