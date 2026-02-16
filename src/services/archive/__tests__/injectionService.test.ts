import './setup'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { contextSharingService } from '@/services/contextSharing'
import { db } from '@/services/database'
import { DeduplicationService } from '../deduplicationService'
import { InjectionService } from '../injectionService'
import { ArchiveRepository } from '../repository'
import { createCharacterArchive, createEventArchive, createWorldArchive } from './fixtures'

async function clearTables(): Promise<void> {
  await db.archives.clear()
  await db.archiveConfigs.clear()
  await db.archiveInjectionHistory.clear()
  await db.platformAccounts.clear()
  await db.characterEntities.clear()
}

async function createAccount(options: {
  id: string
  boundArchiveIds?: string[]
  archiveInjection?: {
    enabled: boolean
    maxTokens: number
    includeRelated: boolean
  }
}): Promise<void> {
  const now = Date.now()

  await db.characterEntities.put({
    id: `entity-${options.id}`,
    type: 'npc',
    displayName: `Entity ${options.id}`,
    source: 'manual',
    scope: 'session',
    scopeSessionId: 'session-test',
    createdAt: now,
    updatedAt: now,
  })

  await db.platformAccounts.put({
    id: options.id,
    entityId: `entity-${options.id}`,
    platformId: 'weibo',
    scope: 'session',
    scopeSessionId: 'session-test',
    boundArchiveIds: options.boundArchiveIds,
    archiveInjection: options.archiveInjection,
    createdAt: now,
    updatedAt: now,
  })
}

describe('InjectionService', () => {
  const repository = new ArchiveRepository()
  const deduplicationService = new DeduplicationService()
  const injectionService = new InjectionService(repository, deduplicationService)

  beforeEach(async () => {
    await clearTables()
    contextSharingService.unpublish('archive:pinned')
    contextSharingService.unpublish('archive:relevant')
    contextSharingService.unpublish('archive:characters')
  })

  afterEach(async () => {
    await clearTables()
    contextSharingService.unpublish('archive:pinned')
    contextSharingService.unpublish('archive:relevant')
    contextSharingService.unpublish('archive:characters')
  })

  it('应组合 core/account/contextual 三类注入并发布 shared-context', async () => {
    const sessionId = 'session-injection-1'
    const accountId = 'account-injection-1'

    const coreArchive = createWorldArchive({
      id: 'core-world-1',
      sessionId,
      name: '中央学院',
      description: '学院遵循严格的魔法契约规则。',
      injectionLevel: 'always',
      injectionPriority: 95,
      keywords: ['学院', '契约'],
    })

    const accountArchive = createCharacterArchive({
      id: 'account-character-1',
      sessionId,
      name: '艾琳',
      traits: ['克制', '严谨'],
      injectionLevel: 'contextual',
      injectionPriority: 90,
      keywords: ['艾琳', '角色'],
      boundAccountIds: [accountId],
    })

    const contextualArchive = createEventArchive({
      id: 'context-event-1',
      sessionId,
      title: '导师宣布期末试炼',
      summary: '学院将提前开放高危试炼场地。',
      injectionLevel: 'contextual',
      keywords: ['试炼', '学院'],
      injectionPriority: 80,
    })

    await repository.saveArchive(coreArchive)
    await repository.saveArchive(accountArchive)
    await repository.saveArchive(contextualArchive)

    await createAccount({
      id: accountId,
      boundArchiveIds: [accountArchive.id],
      archiveInjection: {
        enabled: true,
        maxTokens: 200,
        includeRelated: false,
      },
    })

    const result = await injectionService.getInjection({
      sessionId,
      scene: 'social.post.generate.weibo',
      accountId,
      keywords: ['学院', '试炼'],
    })

    expect(result.coreKnowledge).toContain('中央学院')
    expect(result.accountContext).toContain('艾琳')
    expect(result.relevantArchives).toContain('导师宣布期末试炼')
    expect(result.metadata.injectedArchiveIds).toEqual(
      expect.arrayContaining([coreArchive.id, accountArchive.id, contextualArchive.id])
    )

    expect(contextSharingService.get<string>('archive:pinned')).toBe(result.coreKnowledge)
    expect(contextSharingService.get<string>('archive:relevant')).toBe(result.relevantArchives)
    expect(contextSharingService.get<string>('archive:characters')).toContain('艾琳')
  })

  it('当 account.archiveInjection.enabled=false 时应跳过账号档案注入', async () => {
    const sessionId = 'session-injection-disabled'
    const accountId = 'account-disabled'

    const coreArchive = createWorldArchive({
      id: 'core-world-disabled',
      sessionId,
      name: '基础世界观',
      description: '基础设定。',
      injectionLevel: 'always',
      injectionPriority: 90,
      keywords: ['基础'],
    })

    const accountArchive = createCharacterArchive({
      id: 'account-character-disabled',
      sessionId,
      name: '不应注入的角色',
      injectionLevel: 'contextual',
      keywords: ['私有角色'],
      boundAccountIds: [accountId],
    })

    await repository.saveArchive(coreArchive)
    await repository.saveArchive(accountArchive)

    await createAccount({
      id: accountId,
      boundArchiveIds: [accountArchive.id],
      archiveInjection: {
        enabled: false,
        maxTokens: 120,
        includeRelated: false,
      },
    })

    const result = await injectionService.getInjection({
      sessionId,
      scene: 'social.post.generate.weibo',
      accountId,
      keywords: ['不会命中'],
    })

    expect(result.coreKnowledge).toContain('基础世界观')
    expect(result.accountContext).toBe('')
    expect(result.metadata.injectedArchiveIds).toContain(coreArchive.id)
    expect(result.metadata.injectedArchiveIds).not.toContain(accountArchive.id)
  })

  it('应在总 token 预算下进行截断', async () => {
    const sessionId = 'session-injection-budget'

    const archiveA = createWorldArchive({
      id: 'budget-world-a',
      sessionId,
      injectionLevel: 'always',
      injectionPriority: 100,
      name: '设定A',
      description: 'abcdefghijklmnopqrstuvwxyz1234567890abcd',
      keywords: ['设定A'],
    })

    const archiveB = createWorldArchive({
      id: 'budget-world-b',
      sessionId,
      injectionLevel: 'always',
      injectionPriority: 90,
      name: '设定B',
      description: 'abcdefghijklmnopqrstuvwxyz1234567890efgh',
      keywords: ['设定B'],
    })

    await repository.saveArchive(archiveA)
    await repository.saveArchive(archiveB)

    const result = await injectionService.getInjection({
      sessionId,
      scene: 'social.post.generate',
      keywords: ['设定A', '设定B'],
      maxTotalTokens: 15,
    })

    expect(result.metadata.totalTokens).toBeLessThanOrEqual(15)
    expect(result.metadata.injectedArchiveIds.length).toBe(1)
    expect(result.metadata.injectedArchiveIds[0]).toBe(archiveA.id)
  })
})
