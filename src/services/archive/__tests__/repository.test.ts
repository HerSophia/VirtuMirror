import './setup'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/services/database'
import { ArchiveRepository } from '../repository'
import { createCharacterArchive, createEventArchive, createWorldArchive } from './fixtures'

async function clearTables(): Promise<void> {
  await db.archives.clear()
  await db.archiveConfigs.clear()
  await db.archiveInjectionHistory.clear()
  await db.platformAccounts.clear()
  await db.characterEntities.clear()
  await db.socialRelations.clear()
}

describe('ArchiveRepository', () => {
  const repository = new ArchiveRepository()

  beforeEach(async () => {
    await clearTables()
  })

  afterEach(async () => {
    await clearTables()
  })

  it('保存档案时应自动维护 createdAt/lastUpdated/contentHash', async () => {
    const archive = createEventArchive()

    const saved = await repository.saveArchive(archive)
    if (saved.type !== 'event') {
      throw new Error('expected event archive')
    }

    expect(saved.createdAt).toBeGreaterThan(0)
    expect(saved.lastUpdated).toBeGreaterThan(0)
    expect(saved.contentHash).toBeDefined()

    await new Promise((resolve) => setTimeout(resolve, 5))
    const updatedInput = {
      ...saved,
      summary: '新的摘要',
    }
    const updated = await repository.saveArchive(updatedInput)

    expect(updated.createdAt).toBe(saved.createdAt)
    expect(updated.lastUpdated).toBeGreaterThan(saved.lastUpdated)
    expect(updated.contentHash).not.toBe(saved.contentHash)
  })

  it('查询应支持 session/type/injectionLevel/关键词/重要性/状态/绑定账号过滤', async () => {
    const accountId = 'acc-query-1'

    const eventA = createEventArchive({
      id: 'event-a',
      sessionId: 's-query',
      injectionLevel: 'always',
      importance: 'critical',
      status: 'confirmed',
      keywords: ['学院', '导师'],
      boundAccountIds: [accountId],
    })
    const eventB = createEventArchive({
      id: 'event-b',
      sessionId: 's-query',
      injectionLevel: 'contextual',
      importance: 'minor',
      status: 'pending',
      keywords: ['森林'],
    })
    const world = createWorldArchive({
      id: 'world-a',
      sessionId: 's-query',
      injectionLevel: 'contextual',
      keywords: ['学院', '地图'],
    })

    await repository.saveArchive(eventA)
    await repository.saveArchive(eventB)
    await repository.saveArchive(world)

    const bySessionType = await repository.queryArchives({
      sessionId: 's-query',
      type: 'event',
    })
    expect(bySessionType.map((item) => item.id)).toEqual(expect.arrayContaining(['event-a', 'event-b']))

    const byInjectionLevel = await repository.queryArchives({
      sessionId: 's-query',
      injectionLevel: 'always',
    })
    expect(byInjectionLevel.map((item) => item.id)).toEqual(['event-a'])

    const byKeywordsAll = await repository.queryArchives({
      sessionId: 's-query',
      keywords: ['学院', '导师'],
      keywordMatchMode: 'all',
    })
    expect(byKeywordsAll.map((item) => item.id)).toEqual(['event-a'])

    const byImportance = await repository.queryArchives({
      sessionId: 's-query',
      importance: 'critical',
    })
    expect(byImportance.map((item) => item.id)).toEqual(['event-a'])

    const byStatus = await repository.queryArchives({
      sessionId: 's-query',
      status: 'confirmed',
    })
    expect(byStatus.map((item) => item.id)).toEqual(['event-a'])

    const byBoundAccount = await repository.queryArchives({
      sessionId: 's-query',
      boundAccountIds: [accountId],
      boundAccountMatchMode: 'any',
    })
    expect(byBoundAccount.map((item) => item.id)).toEqual(['event-a'])
  })

  it('删除档案时应清理账号绑定引用', async () => {
    const accountId = 'acc-delete-1'

    const characterArchive = createCharacterArchive({
      id: 'char-delete',
      boundAccountIds: [accountId],
    })

    await db.characterEntities.add({
      id: 'entity-delete-1',
      type: 'npc',
      displayName: '测试角色',
      source: 'manual',
      scope: 'session',
      scopeSessionId: 'session-test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await db.platformAccounts.add({
      id: accountId,
      entityId: 'entity-delete-1',
      platformId: 'weibo',
      scope: 'session',
      scopeSessionId: 'session-test',
      boundArchiveIds: ['char-delete'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await repository.saveArchive(characterArchive)
    await repository.deleteArchive('char-delete')

    const account = await db.platformAccounts.get(accountId)
    expect(account?.boundArchiveIds).toBeUndefined()
  })
})
