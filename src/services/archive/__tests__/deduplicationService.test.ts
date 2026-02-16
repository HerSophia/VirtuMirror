import './setup'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/services/database'
import { DeduplicationService } from '../deduplicationService'
import { createEventArchive } from './fixtures'
import type { ArchiveCandidate } from '../types'

async function clearTables(): Promise<void> {
  await db.archiveInjectionHistory.clear()
}

function toCandidate(
  archive: ReturnType<typeof createEventArchive>,
  priority: number,
  source: ArchiveCandidate['source']
): ArchiveCandidate {
  return {
    archive,
    priority,
    source,
  }
}

describe('DeduplicationService', () => {
  const service = new DeduplicationService()

  beforeEach(async () => {
    await clearTables()
  })

  afterEach(async () => {
    await clearTables()
  })

  it('应应用 ID/语义/时效三层去重，并保留 always 豁免项', async () => {
    const sessionId = 'session-dedup-1'

    await service.recordInjection(sessionId, ['recent-context', 'recent-always'])

    const sameIdHigh = createEventArchive({
      id: 'dup-id',
      contentHash: 'hash-dup-id-1',
      title: '高优先级重复项',
    })
    const sameIdLow = createEventArchive({
      id: 'dup-id',
      contentHash: 'hash-dup-id-1',
      title: '低优先级重复项',
    })

    const semanticA = createEventArchive({
      id: 'semantic-a',
      contentHash: 'hash-semantic',
      title: '语义重复 A',
    })
    const semanticB = createEventArchive({
      id: 'semantic-b',
      contentHash: 'hash-semantic',
      title: '语义重复 B',
    })

    const recentContext = createEventArchive({
      id: 'recent-context',
      contentHash: 'hash-recent-context',
      injectionLevel: 'contextual',
      title: '最近注入的上下文档案',
    })
    const recentAlways = createEventArchive({
      id: 'recent-always',
      contentHash: 'hash-recent-always',
      injectionLevel: 'always',
      title: '最近注入但始终注入档案',
    })

    const result = await service.deduplicate(
      [
        toCandidate(sameIdHigh, 220, 'core'),
        toCandidate(sameIdLow, 120, 'contextual'),
        toCandidate(semanticA, 200, 'account'),
        toCandidate(semanticB, 180, 'contextual'),
        toCandidate(recentContext, 160, 'contextual'),
        toCandidate(recentAlways, 140, 'core'),
      ],
      sessionId,
      3
    )

    expect(result.candidates.map((item) => item.archive.id)).toEqual([
      'dup-id',
      'semantic-a',
      'recent-always',
    ])
    expect(result.deduplicatedCount).toBe(3)
    expect(result.details).toEqual(
      expect.arrayContaining([
        { archiveId: 'dup-id', reason: 'id_duplicate' },
        { archiveId: 'semantic-b', reason: 'semantic_duplicate' },
        { archiveId: 'recent-context', reason: 'recently_injected' },
      ])
    )
  })

  it('getRecentlyInjected 应只返回最近窗口内的注入记录', async () => {
    const sessionId = 'session-dedup-window'

    await service.recordInjection(sessionId, ['a-1'])
    await service.recordInjection(sessionId, ['b-1'])
    await service.recordInjection(sessionId, ['c-1', 'c-2'])

    const recent = await service.getRecentlyInjected(sessionId, 2)

    expect(recent).toEqual(expect.arrayContaining(['b-1', 'c-1', 'c-2']))
    expect(recent).not.toContain('a-1')
  })
})
