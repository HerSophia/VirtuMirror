import { db } from '@/services/database'
import type {
  ArchiveConfig,
  ArchiveQueryFilter,
  ArchiveRecord,
  ArchiveStatus,
  EventImportance,
} from '@/types/archive'

const DEFAULT_INJECTION_PRIORITY = 50

const DEFAULT_ARCHIVE_CONFIG: Omit<ArchiveConfig, 'sessionId' | 'updatedAt'> = {
  autoExtract: {
    enabled: false,
    floorInterval: 8,
    requireConfirmation: true,
  },
  injection: {
    enabledScenes: [
      'social.post.generate',
      'social.comment.batch',
      'social.post.generate.weibo',
      'social.comment.batch.weibo',
      'social.post.generate.bilibili',
      'social.comment.batch.bilibili',
      'social.post.generate.zhihu',
      'social.comment.batch.zhihu',
      'social.post.generate.redbook',
      'social.comment.batch.redbook',
    ],
    coreKnowledgeMaxTokens: 500,
    accountContextMaxTokens: 300,
    contextualMaxTokens: 400,
    maxPinnedArchives: 10,
    maxContextualMatches: 12,
    enableSemanticMatch: true,
    deduplicationWindow: 3,
  },
  lastExtractFloor: 0,
  lastExtractTime: 0,
  totalExtractCount: 0,
}

function normalizeStringArray(
  values: string[] | undefined,
  options: { lowerCase?: boolean } = {}
): string[] {
  if (!values || values.length === 0) {
    return []
  }

  return Array.from(
    new Set(
      values
        .map((value) => (options.lowerCase ? value.trim().toLowerCase() : value.trim()))
        .filter((value) => value.length > 0)
    )
  )
}

function normalizeArchiveForSave(archive: ArchiveRecord, createdAt: number, now: number): ArchiveRecord {
  const keywords = normalizeStringArray(archive.keywords, { lowerCase: true })
  const boundAccountIds = normalizeStringArray(archive.boundAccountIds)

  const normalized: ArchiveRecord = {
    ...archive,
    keywords,
    boundAccountIds: boundAccountIds.length > 0 ? boundAccountIds : undefined,
    createdAt,
    lastUpdated: now,
    contentHash: computeContentHash({
      ...archive,
      keywords,
      boundAccountIds,
      createdAt,
      lastUpdated: now,
    }),
  }

  return normalized
}

function getHashContent(record: ArchiveRecord): string {
  switch (record.type) {
    case 'event':
      return [
        record.title,
        record.summary,
        record.subType,
        record.importance,
        record.location ?? '',
        record.participants.join(','),
        record.keyQuotes?.join('\n') ?? '',
      ].join('\n')
    case 'character':
      return [
        record.name,
        record.baseDescription ?? '',
        record.role,
        record.traits.join(','),
        record.abilities?.join(',') ?? '',
        record.knownFacts.map((fact) => fact.fact).join('\n'),
      ].join('\n')
    case 'world':
      return [
        record.name,
        record.description,
        record.category,
        Object.values(record.details ?? {}).join('\n'),
      ].join('\n')
  }
}

function computeContentHash(record: ArchiveRecord): string {
  const source = [record.sessionId, record.type, getHashContent(record), record.keywords.join(',')]
    .join('\n')
    .trim()

  let hash = 2166136261
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }

  return `h${(hash >>> 0).toString(16)}`
}

function toSet<T extends string>(value: T | T[] | undefined): Set<T> | null {
  if (!value) {
    return null
  }

  return new Set(Array.isArray(value) ? value : [value])
}

function resolveImportance(record: ArchiveRecord): EventImportance | undefined {
  if (record.type !== 'event') {
    return undefined
  }
  return record.importance
}

function resolveStatus(record: ArchiveRecord): ArchiveStatus | undefined {
  return record.status
}

function sortArchives(records: ArchiveRecord[], filter: ArchiveQueryFilter): ArchiveRecord[] {
  const sortBy = filter.sortBy ?? 'lastUpdated'
  const direction = filter.sortOrder === 'asc' ? 1 : -1

  const sorted = [...records].sort((left, right) => {
    if (sortBy === 'injectionPriority') {
      const leftPriority = left.injectionPriority ?? DEFAULT_INJECTION_PRIORITY
      const rightPriority = right.injectionPriority ?? DEFAULT_INJECTION_PRIORITY
      return (leftPriority - rightPriority) * direction
    }

    if (sortBy === 'createdAt') {
      return (left.createdAt - right.createdAt) * direction
    }

    return (left.lastUpdated - right.lastUpdated) * direction
  })

  const offset = Math.max(filter.offset ?? 0, 0)
  if (typeof filter.limit !== 'number') {
    return sorted.slice(offset)
  }

  const limit = Math.max(filter.limit, 0)
  return sorted.slice(offset, offset + limit)
}

function removeValue(values: string[] | undefined, value: string): string[] | undefined {
  const next = normalizeStringArray(values).filter((item) => item !== value)
  return next.length > 0 ? next : undefined
}

export function createDefaultArchiveConfig(sessionId: string, now = Date.now()): ArchiveConfig {
  return {
    ...DEFAULT_ARCHIVE_CONFIG,
    autoExtract: { ...DEFAULT_ARCHIVE_CONFIG.autoExtract },
    initialContext: undefined,
    injection: { ...DEFAULT_ARCHIVE_CONFIG.injection },
    sessionId,
    updatedAt: now,
  }
}

function mergeArchiveConfig(base: ArchiveConfig, incoming: Partial<ArchiveConfig>, now: number): ArchiveConfig {
  return {
    ...base,
    ...incoming,
    autoExtract: {
      ...base.autoExtract,
      ...(incoming.autoExtract ?? {}),
    },
    initialContext: {
      ...(base.initialContext ?? {}),
      ...(incoming.initialContext ?? {}),
    },
    injection: {
      ...base.injection,
      ...(incoming.injection ?? {}),
    },
    updatedAt: now,
  }
}

export class ArchiveRepository {
  async getArchive(id: string): Promise<ArchiveRecord | null> {
    const archive = await db.archives.get(id)
    return archive ?? null
  }

  async saveArchive(archive: ArchiveRecord): Promise<ArchiveRecord> {
    const now = Date.now()
    const existing = await db.archives.get(archive.id)
    const createdAt = existing?.createdAt ?? archive.createdAt ?? now

    const normalized = normalizeArchiveForSave(archive, createdAt, now)
    await db.archives.put(normalized)
    return normalized
  }

  async deleteArchive(id: string): Promise<void> {
    await db.transaction('rw', [db.archives, db.platformAccounts, db.archiveInjectionHistory], async () => {
      const archive = await db.archives.get(id)
      if (!archive) {
        return
      }

      for (const accountId of normalizeStringArray(archive.boundAccountIds)) {
        const account = await db.platformAccounts.get(accountId)
        if (!account) {
          continue
        }

        await db.platformAccounts.put({
          ...account,
          boundArchiveIds: removeValue(account.boundArchiveIds, id),
          updatedAt: Date.now(),
        })
      }

      const relatedHistories = await db.archiveInjectionHistory.where('archiveIds').equals(id).toArray()
      for (const history of relatedHistories) {
        const archiveIds = history.archiveIds.filter((archiveId) => archiveId !== id)
        if (archiveIds.length === 0) {
          await db.archiveInjectionHistory.delete(history.id)
          continue
        }

        await db.archiveInjectionHistory.put({
          ...history,
          archiveIds,
        })
      }

      await db.archives.delete(id)
    })
  }

  async queryArchives(filter: ArchiveQueryFilter = {}): Promise<ArchiveRecord[]> {
    let collection = db.archives.toCollection()

    if (filter.sessionId && filter.type) {
      collection = db.archives.where('[sessionId+type]').equals([filter.sessionId, filter.type])
    } else if (filter.sessionId) {
      collection = db.archives.where('sessionId').equals(filter.sessionId)
    } else if (filter.type) {
      collection = db.archives.where('type').equals(filter.type)
    }

    if (filter.injectionLevel) {
      const injectionLevel = filter.injectionLevel
      collection = collection.and((archive) => archive.injectionLevel === injectionLevel)
    }

    const keywordSet = normalizeStringArray(filter.keywords, { lowerCase: true })
    if (keywordSet.length > 0) {
      const matchMode = filter.keywordMatchMode ?? 'any'
      collection = collection.and((archive) => {
        const archiveKeywords = normalizeStringArray(archive.keywords, { lowerCase: true })
        if (archiveKeywords.length === 0) {
          return false
        }

        if (matchMode === 'all') {
          return keywordSet.every((keyword) => archiveKeywords.includes(keyword))
        }

        return keywordSet.some((keyword) => archiveKeywords.includes(keyword))
      })
    }

    const importanceSet = toSet(filter.importance)
    if (importanceSet) {
      collection = collection.and((archive) => {
        const importance = resolveImportance(archive)
        return importance ? importanceSet.has(importance) : false
      })
    }

    const statusSet = toSet(filter.status)
    if (statusSet) {
      collection = collection.and((archive) => {
        const status = resolveStatus(archive)
        return status ? statusSet.has(status) : false
      })
    }

    const accountIds = normalizeStringArray(filter.boundAccountIds)
    if (accountIds.length > 0) {
      const matchMode = filter.boundAccountMatchMode ?? 'any'
      collection = collection.and((archive) => {
        const boundAccounts = normalizeStringArray(archive.boundAccountIds)
        if (boundAccounts.length === 0) {
          return false
        }

        if (matchMode === 'all') {
          return accountIds.every((accountId) => boundAccounts.includes(accountId))
        }

        return accountIds.some((accountId) => boundAccounts.includes(accountId))
      })
    }

    const archives = await collection.toArray()
    return sortArchives(archives, filter)
  }

  async getConfig(sessionId: string): Promise<ArchiveConfig> {
    const stored = await db.archiveConfigs.get(sessionId)
    const defaults = createDefaultArchiveConfig(sessionId)
    if (!stored) {
      return defaults
    }

    return mergeArchiveConfig(defaults, stored, stored.updatedAt ?? Date.now())
  }

  async saveConfig(config: ArchiveConfig): Promise<ArchiveConfig> {
    const now = Date.now()
    const current = await db.archiveConfigs.get(config.sessionId)
    const base = current
      ? mergeArchiveConfig(createDefaultArchiveConfig(config.sessionId), current, now)
      : createDefaultArchiveConfig(config.sessionId, now)

    const merged = mergeArchiveConfig(base, config, now)
    await db.archiveConfigs.put(merged)
    return merged
  }
}
