import { db } from '@/services/database'
import type { ArchiveCandidate, DeduplicationDetail, DeduplicationResult } from './types'

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function sortCandidates(candidates: ArchiveCandidate[]): ArchiveCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }

    if (right.archive.lastUpdated !== left.archive.lastUpdated) {
      return right.archive.lastUpdated - left.archive.lastUpdated
    }

    return right.archive.createdAt - left.archive.createdAt
  })
}

export class DeduplicationService {
  async deduplicate(
    candidates: ArchiveCandidate[],
    sessionId: string,
    windowSize = 3
  ): Promise<DeduplicationResult> {
    const sortedCandidates = sortCandidates(candidates)
    const recentlyInjectedSet = new Set(await this.getRecentlyInjected(sessionId, windowSize))
    const seenIds = new Set<string>()
    const seenHashes = new Set<string>()
    const details: DeduplicationDetail[] = []
    const results: ArchiveCandidate[] = []

    for (const candidate of sortedCandidates) {
      const archive = candidate.archive

      if (seenIds.has(archive.id)) {
        details.push({
          archiveId: archive.id,
          reason: 'id_duplicate',
        })
        continue
      }
      seenIds.add(archive.id)

      if (archive.contentHash) {
        if (seenHashes.has(archive.contentHash)) {
          details.push({
            archiveId: archive.id,
            reason: 'semantic_duplicate',
          })
          continue
        }

        seenHashes.add(archive.contentHash)
      }

      if (archive.injectionLevel !== 'always' && recentlyInjectedSet.has(archive.id)) {
        details.push({
          archiveId: archive.id,
          reason: 'recently_injected',
        })
        continue
      }

      results.push(candidate)
    }

    return {
      candidates: results,
      deduplicatedCount: details.length,
      details,
    }
  }

  async recordInjection(sessionId: string, archiveIds: string[]): Promise<void> {
    const uniqueArchiveIds = uniqueStrings(archiveIds)
    if (uniqueArchiveIds.length === 0) {
      return
    }

    const latestRecord = await db.archiveInjectionHistory
      .where('[sessionId+round]')
      .between([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
      .last()

    const round = (latestRecord?.round ?? 0) + 1
    const injectedAt = Date.now()

    await db.archiveInjectionHistory.put({
      id: `archive-injection:${sessionId}:${round}:${injectedAt}`,
      sessionId,
      round,
      archiveIds: uniqueArchiveIds,
      injectedAt,
    })
  }

  async getRecentlyInjected(sessionId: string, windowSize: number): Promise<string[]> {
    if (windowSize <= 0) {
      return []
    }

    const recentRecords = await db.archiveInjectionHistory
      .where('[sessionId+round]')
      .between([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
      .reverse()
      .limit(windowSize)
      .toArray()

    return uniqueStrings(recentRecords.flatMap((record) => record.archiveIds))
  }
}
