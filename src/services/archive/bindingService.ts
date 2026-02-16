import type { ArchiveRecord } from '@/types/archive'
import { db } from '@/services/database'

function normalizeStringArray(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return []
  }

  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)))
}

function removeItem(values: string[] | undefined, target: string): string[] | undefined {
  const next = normalizeStringArray(values).filter((value) => value !== target)
  return next.length > 0 ? next : undefined
}

function appendItem(values: string[] | undefined, target: string): string[] {
  const current = normalizeStringArray(values)
  if (current.includes(target)) {
    return current
  }

  return [...current, target]
}

export class BindingService {
  async bindToAccount(archiveId: string, accountId: string): Promise<void> {
    await db.transaction('rw', [db.archives, db.platformAccounts], async () => {
      const archive = await db.archives.get(archiveId)
      if (!archive) {
        throw new Error(`Archive not found: ${archiveId}`)
      }

      const account = await db.platformAccounts.get(accountId)
      if (!account) {
        throw new Error(`Platform account not found: ${accountId}`)
      }

      const now = Date.now()
      const nextArchive = {
        ...archive,
        boundAccountIds: appendItem(archive.boundAccountIds, accountId),
        lastUpdated: now,
      }

      const nextAccount = {
        ...account,
        boundArchiveIds: appendItem(account.boundArchiveIds, archiveId),
        updatedAt: now,
      }

      await db.archives.put(nextArchive)
      await db.platformAccounts.put(nextAccount)
    })
  }

  async unbindFromAccount(archiveId: string, accountId: string): Promise<void> {
    await db.transaction('rw', [db.archives, db.platformAccounts], async () => {
      const archive = await db.archives.get(archiveId)
      const account = await db.platformAccounts.get(accountId)

      if (!archive && !account) {
        return
      }

      const now = Date.now()

      if (archive) {
        const nextArchive = {
          ...archive,
          boundAccountIds: removeItem(archive.boundAccountIds, accountId),
          lastUpdated: now,
        }
        await db.archives.put(nextArchive)
      }

      if (account) {
        const nextAccount = {
          ...account,
          boundArchiveIds: removeItem(account.boundArchiveIds, archiveId),
          updatedAt: now,
        }
        await db.platformAccounts.put(nextAccount)
      }
    })
  }

  async getAccountArchives(accountId: string): Promise<ArchiveRecord[]> {
    const account = await db.platformAccounts.get(accountId)
    if (!account) {
      return []
    }

    const archiveIds = normalizeStringArray(account.boundArchiveIds)
    if (archiveIds.length === 0) {
      return []
    }

    const archives = await db.archives.where('id').anyOf(archiveIds).toArray()
    const archiveMap = new Map(archives.map((archive) => [archive.id, archive]))

    const orderedArchives: ArchiveRecord[] = []
    for (const archiveId of archiveIds) {
      const archive = archiveMap.get(archiveId)
      if (archive) {
        orderedArchives.push(archive)
      }
    }

    return orderedArchives
  }
}
