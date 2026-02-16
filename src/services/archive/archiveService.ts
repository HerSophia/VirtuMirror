import { db } from '@/services/database'
import type {
  ArchiveConfig,
  ArchiveFloorData,
  ArchiveQueryFilter,
  ArchiveRecord,
  CharacterProfile,
  CharacterUpdate,
  ExtractOptions,
  ExtractResult,
  InjectionRequest,
  InjectionResult,
  Keyword,
  UpdateRecord,
} from '@/types/archive'
import { BindingService } from './bindingService'
import { DeduplicationService } from './deduplicationService'
import { ExtractionService } from './extractionService'
import { InjectionService } from './injectionService'
import { ArchiveRepository } from './repository'
import type { ArchiveServiceDependencies } from './types'

interface PersistExtractOptions {
  sessionId?: string
  floorRange?: { start: number; end: number }
}

export interface PersistExtractResult {
  success: boolean
  savedArchives: ArchiveRecord[]
  savedKeywords: Keyword[]
  deduplicatedArchives: number
  deduplicatedKeywords: number
  error?: string
}

export interface ExtractAndPersistResult {
  success: boolean
  extraction: ExtractResult
  persisted: PersistExtractResult
}

function createDefaultDependencies(): ArchiveServiceDependencies {
  const repository = new ArchiveRepository()
  const deduplicationService = new DeduplicationService()

  return {
    repository,
    deduplicationService,
    injectionService: new InjectionService(repository, deduplicationService),
    bindingService: new BindingService(),
    extractionService: new ExtractionService(),
  }
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function uniqueStrings(values: string[] | undefined, options: { lowerCase?: boolean } = {}): string[] {
  if (!values || values.length === 0) {
    return []
  }

  const normalized = values
    .map((value) => (options.lowerCase ? value.trim().toLowerCase() : value.trim()))
    .filter((value) => value.length > 0)

  return Array.from(new Set(normalized))
}

function uniqueUnknownArray<T>(values: T[]): T[] {
  const seen = new Set<string>()
  const output: T[] = []

  for (const value of values) {
    const key = JSON.stringify(value)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(value)
  }

  return output
}

function areEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneUnknown<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildArchiveFingerprint(record: ArchiveRecord): string {
  if (record.type === 'event') {
    return [
      'event',
      normalizeText(record.title),
      normalizeText(record.summary),
      normalizeText(record.subType),
      normalizeText(record.importance),
      uniqueStrings(record.participants, { lowerCase: true }).join('|'),
      normalizeText(record.location),
    ].join('||')
  }

  if (record.type === 'character') {
    return [
      'character',
      normalizeText(record.name),
      normalizeText(record.baseDescription),
      normalizeText(record.role),
      uniqueStrings(record.aliases, { lowerCase: true }).join('|'),
      uniqueStrings(record.traits, { lowerCase: true }).join('|'),
      uniqueStrings(record.abilities, { lowerCase: true }).join('|'),
    ].join('||')
  }

  return [
    'world',
    normalizeText(record.name),
    normalizeText(record.description),
    normalizeText(record.category),
  ].join('||')
}

function buildCharacterLookupKeys(profile: CharacterProfile): string[] {
  return uniqueStrings([profile.name, ...profile.aliases], { lowerCase: true })
}

function ensureCharacterKeywords(profile: CharacterProfile): string[] {
  return uniqueStrings(
    [profile.name, ...profile.aliases, ...profile.traits, ...(profile.abilities ?? []), ...profile.keywords],
    { lowerCase: true }
  ).slice(0, 24)
}

function createUpdateRecord(field: string, oldValue: unknown, newValue: unknown, sourceFloor?: number): UpdateRecord {
  return {
    field,
    oldValue: cloneUnknown(oldValue),
    newValue: cloneUnknown(newValue),
    sourceFloor,
    timestamp: Date.now(),
  }
}

function resolveSessionIdFromExtraction(result: ExtractResult, fallback?: string): string {
  if (fallback) {
    return fallback
  }

  const firstArchive = result.events[0] ?? result.worldEntries[0]
  if (firstArchive) {
    return firstArchive.sessionId
  }

  return 'session:unknown'
}

function createCharacterProfileFromUpdate(
  update: CharacterUpdate,
  sessionId: string,
  now: number,
  sourceFloor?: number,
  index = 0
): CharacterProfile {
  const name = update.name.trim() || `未命名角色-${index + 1}`
  const patch = update.updates

  const aliases = uniqueStrings(patch.aliases)
  const traits = uniqueStrings(patch.traits)
  const abilities = uniqueStrings(patch.abilities)

  const baseProfile: CharacterProfile = {
    id: update.characterId?.trim() || `archive:character:${sessionId}:${now}:${index}`,
    sessionId,
    type: 'character',
    name,
    aliases,
    avatar: patch.avatar,
    role: patch.role ?? 'supporting',
    baseDescription: patch.baseDescription,
    traits,
    abilities,
    knownFacts: uniqueUnknownArray(patch.knownFacts ?? []),
    recentActions: uniqueUnknownArray(patch.recentActions ?? []),
    source: 'chat_extract',
    updateHistory: [createUpdateRecord('created', null, { name }, sourceFloor)],
    injectionLevel: patch.injectionLevel ?? 'contextual',
    injectionPriority: patch.injectionPriority ?? 50,
    keywords: [],
    createdAt: now,
    lastUpdated: now,
  }

  baseProfile.keywords = ensureCharacterKeywords(baseProfile)
  return baseProfile
}

function applyCharacterUpdate(
  profile: CharacterProfile,
  update: CharacterUpdate,
  sourceFloor?: number
): { profile: CharacterProfile; changed: boolean } {
  const next: CharacterProfile = {
    ...profile,
    aliases: [...profile.aliases],
    traits: [...profile.traits],
    abilities: profile.abilities ? [...profile.abilities] : undefined,
    knownFacts: [...profile.knownFacts],
    recentActions: [...profile.recentActions],
    updateHistory: [...profile.updateHistory],
    keywords: [...profile.keywords],
    metadata: profile.metadata ? { ...profile.metadata } : undefined,
  }

  let changed = false
  const patch = update.updates

  const updateField = (field: string, value: unknown) => {
    const mutableRecord = next as unknown as Record<string, unknown>
    const oldValue = mutableRecord[field]
    if (areEqual(oldValue, value)) {
      return
    }

    mutableRecord[field] = value
    next.updateHistory.push(createUpdateRecord(field, oldValue, value, sourceFloor))
    changed = true
  }

  const normalizedName = update.name.trim()
  if (normalizedName.length > 0 && normalizedName !== next.name) {
    const previousName = next.name
    const mergedAliases = uniqueStrings([...next.aliases, previousName])
    updateField('name', normalizedName)
    next.aliases = mergedAliases
  }

  if (patch.aliases) {
    const mergedAliases = uniqueStrings([...next.aliases, ...patch.aliases])
    updateField('aliases', mergedAliases)
  }

  if (patch.role) {
    updateField('role', patch.role)
  }

  if (typeof patch.baseDescription === 'string') {
    updateField('baseDescription', patch.baseDescription)
  }

  if (typeof patch.avatar === 'string') {
    updateField('avatar', patch.avatar)
  }

  if (patch.traits) {
    updateField('traits', uniqueStrings([...next.traits, ...patch.traits]))
  }

  if (patch.abilities) {
    updateField('abilities', uniqueStrings([...(next.abilities ?? []), ...patch.abilities]))
  }

  if (patch.knownFacts && patch.knownFacts.length > 0) {
    updateField('knownFacts', uniqueUnknownArray([...(next.knownFacts ?? []), ...patch.knownFacts]))
  }

  if (patch.recentActions && patch.recentActions.length > 0) {
    updateField('recentActions', uniqueUnknownArray([...(next.recentActions ?? []), ...patch.recentActions]))
  }

  if (patch.injectionLevel) {
    updateField('injectionLevel', patch.injectionLevel)
  }

  if (typeof patch.injectionPriority === 'number') {
    updateField('injectionPriority', patch.injectionPriority)
  }

  if (patch.metadata && typeof patch.metadata === 'object') {
    updateField('metadata', {
      ...(next.metadata ?? {}),
      ...(patch.metadata as Record<string, unknown>),
    })
  }

  const mergedKeywords = ensureCharacterKeywords(next)
  if (!areEqual(next.keywords, mergedKeywords)) {
    next.keywords = mergedKeywords
    changed = true
  }

  if (changed) {
    next.lastUpdated = Date.now()
    next.source = 'chat_extract'
  }

  return { profile: next, changed }
}

function normalizeArchiveForSession<T extends ArchiveRecord>(archive: T, sessionId: string): T {
  return {
    ...archive,
    sessionId,
    keywords: uniqueStrings(archive.keywords, { lowerCase: true }),
  }
}

export class ArchiveService {
  private readonly repository
  private readonly injectionService
  private readonly bindingService
  private readonly extractionService

  constructor(dependencies: Partial<ArchiveServiceDependencies> = {}) {
    const defaults = createDefaultDependencies()

    this.repository = dependencies.repository ?? defaults.repository
    this.injectionService = dependencies.injectionService ?? defaults.injectionService
    this.bindingService = dependencies.bindingService ?? defaults.bindingService
    this.extractionService = dependencies.extractionService ?? defaults.extractionService
  }

  async getArchive(id: string): Promise<ArchiveRecord | null> {
    return this.repository.getArchive(id)
  }

  async saveArchive(archive: ArchiveRecord): Promise<ArchiveRecord> {
    return this.repository.saveArchive(archive)
  }

  async deleteArchive(id: string): Promise<void> {
    await this.repository.deleteArchive(id)
  }

  async queryArchives(filter: ArchiveQueryFilter = {}): Promise<ArchiveRecord[]> {
    return this.repository.queryArchives(filter)
  }

  async getConfig(sessionId: string): Promise<ArchiveConfig> {
    return this.repository.getConfig(sessionId)
  }

  async saveConfig(config: ArchiveConfig): Promise<ArchiveConfig> {
    return this.repository.saveConfig(config)
  }

  async getInjection(request: InjectionRequest): Promise<InjectionResult> {
    return this.injectionService.getInjection(request)
  }

  async getPinnedArchives(sessionId: string): Promise<ArchiveRecord[]> {
    return this.injectionService.getPinnedArchives(sessionId)
  }

  async matchByKeywords(keywords: string[], sessionId: string): Promise<ArchiveRecord[]> {
    return this.injectionService.matchByKeywords(keywords, sessionId)
  }

  async bindToAccount(archiveId: string, accountId: string): Promise<void> {
    await this.bindingService.bindToAccount(archiveId, accountId)
  }

  async unbindFromAccount(archiveId: string, accountId: string): Promise<void> {
    await this.bindingService.unbindFromAccount(archiveId, accountId)
  }

  async getAccountArchives(accountId: string): Promise<ArchiveRecord[]> {
    return this.bindingService.getAccountArchives(accountId)
  }

  async extractFromChat(floors: ArchiveFloorData[], options?: ExtractOptions): Promise<ExtractResult> {
    return this.extractionService.extractFromChat(floors, options)
  }

  async persistExtractResult(result: ExtractResult, options: PersistExtractOptions = {}): Promise<PersistExtractResult> {
    const sessionId = resolveSessionIdFromExtraction(result, options.sessionId)

    if (!result.success) {
      return {
        success: false,
        savedArchives: [],
        savedKeywords: [],
        deduplicatedArchives: 0,
        deduplicatedKeywords: 0,
        error: result.error ?? 'Archive extraction failed',
      }
    }

    const sourceFloor = options.floorRange?.end ?? result.metadata.floorRange?.end

    try {
      return await db.transaction('rw', [db.archives, db.archiveKeywords], async () => {
        const existingArchives = await this.repository.queryArchives({ sessionId })
        const fingerprintSet = new Set(existingArchives.map((archive) => buildArchiveFingerprint(archive)))

        const existingCharacters = existingArchives.filter(
          (archive): archive is CharacterProfile => archive.type === 'character'
        )

        const characterById = new Map(existingCharacters.map((profile) => [profile.id, profile]))
        const characterIdByLookup = new Map<string, string>()

        for (const character of existingCharacters) {
          for (const key of buildCharacterLookupKeys(character)) {
            characterIdByLookup.set(key, character.id)
          }
        }

        let deduplicatedArchives = 0
        const savedArchives: ArchiveRecord[] = []

        for (const event of result.events) {
          const candidate = normalizeArchiveForSession(event, sessionId)
          const fingerprint = buildArchiveFingerprint(candidate)
          if (fingerprintSet.has(fingerprint)) {
            deduplicatedArchives += 1
            continue
          }

          const saved = await this.repository.saveArchive(candidate)
          savedArchives.push(saved)
          fingerprintSet.add(fingerprint)
        }

        for (const world of result.worldEntries) {
          const candidate = normalizeArchiveForSession(world, sessionId)
          const fingerprint = buildArchiveFingerprint(candidate)
          if (fingerprintSet.has(fingerprint)) {
            deduplicatedArchives += 1
            continue
          }

          const saved = await this.repository.saveArchive(candidate)
          savedArchives.push(saved)
          fingerprintSet.add(fingerprint)
        }

        const now = Date.now()
        const touchedCharacters = new Set<string>()

        for (let index = 0; index < result.characterUpdates.length; index += 1) {
          const update = result.characterUpdates[index]
          const updateId = update.characterId?.trim()
          const lookupKey = normalizeText(update.name)

          const matchedId =
            (updateId && characterById.has(updateId) ? updateId : null) ??
            (lookupKey ? characterIdByLookup.get(lookupKey) : undefined)

          const baseline = matchedId
            ? characterById.get(matchedId)
            : createCharacterProfileFromUpdate(update, sessionId, now, sourceFloor, index)

          if (!baseline) {
            continue
          }

          const applied = matchedId
            ? applyCharacterUpdate(baseline, update, sourceFloor)
            : { profile: baseline, changed: true }

          if (!applied.changed) {
            continue
          }

          const fingerprint = buildArchiveFingerprint(applied.profile)
          const isNewCharacter = !matchedId
          if (isNewCharacter && fingerprintSet.has(fingerprint)) {
            deduplicatedArchives += 1
            continue
          }

          const saved = await this.repository.saveArchive({
            ...applied.profile,
            sessionId,
          })

          if (saved.type !== 'character') {
            deduplicatedArchives += 1
            continue
          }

          fingerprintSet.add(fingerprint)
          characterById.set(saved.id, saved)
          touchedCharacters.add(saved.id)

          for (const key of buildCharacterLookupKeys(saved)) {
            characterIdByLookup.set(key, saved.id)
          }
        }

        for (const characterId of touchedCharacters) {
          const saved = characterById.get(characterId)
          if (saved) {
            savedArchives.push(saved)
          }
        }

        const rawKeywordTexts = [
          ...result.keywords.map((keyword) => keyword.text),
          ...savedArchives.flatMap((archive) => archive.keywords),
        ]

        const uniqueKeywordTexts = uniqueStrings(rawKeywordTexts, { lowerCase: true })
        const deduplicatedKeywords = Math.max(0, rawKeywordTexts.length - uniqueKeywordTexts.length)

        const existingKeywords = await db.archiveKeywords.where('sessionId').equals(sessionId).toArray()
        const keywordMap = new Map(existingKeywords.map((keyword) => [normalizeText(keyword.text), keyword]))
        const savedKeywords: Keyword[] = []

        for (let index = 0; index < uniqueKeywordTexts.length; index += 1) {
          const text = uniqueKeywordTexts[index]
          const linked = savedArchives.filter((archive) => archive.keywords.includes(text))
          const linkedArchives = linked.map((archive) => archive.id)
          const linkedCharacters = linked
            .filter((archive): archive is CharacterProfile => archive.type === 'character')
            .map((archive) => archive.id)
          const linkedEntries = linked.filter((archive) => archive.type === 'world').map((archive) => archive.id)

          const existing = keywordMap.get(text)
          if (existing) {
            const merged: Keyword = {
              ...existing,
              usageCount: existing.usageCount + 1,
              linkedArchives: uniqueStrings([...existing.linkedArchives, ...linkedArchives]),
              linkedCharacters: uniqueStrings([...existing.linkedCharacters, ...linkedCharacters]),
              linkedEntries: uniqueStrings([...existing.linkedEntries, ...linkedEntries]),
            }

            await db.archiveKeywords.put(merged)
            keywordMap.set(text, merged)
            savedKeywords.push(merged)
            continue
          }

          const created: Keyword = {
            id: `archive:keyword:${sessionId}:${Date.now()}:${index}`,
            sessionId,
            text,
            category: undefined,
            usageCount: 1,
            linkedArchives,
            linkedCharacters,
            linkedEntries,
            source: 'ai_generated',
            createdAt: Date.now(),
          }

          await db.archiveKeywords.put(created)
          keywordMap.set(text, created)
          savedKeywords.push(created)
        }

        return {
          success: true,
          savedArchives,
          savedKeywords,
          deduplicatedArchives,
          deduplicatedKeywords,
        }
      })
    } catch (error) {
      return {
        success: false,
        savedArchives: [],
        savedKeywords: [],
        deduplicatedArchives: 0,
        deduplicatedKeywords: 0,
        error: error instanceof Error ? error.message : 'Persist extraction result failed',
      }
    }
  }

  async extractAndPersistFromChat(
    floors: ArchiveFloorData[],
    options?: ExtractOptions
  ): Promise<ExtractAndPersistResult> {
    const extraction = await this.extractFromChat(floors, options)
    const persisted = await this.persistExtractResult(extraction, {
      sessionId: options?.sessionId,
      floorRange: extraction.metadata.floorRange,
    })

    return {
      success: extraction.success && persisted.success,
      extraction,
      persisted,
    }
  }
}

let archiveServiceInstance: ArchiveService | null = null

export function getArchiveService(): ArchiveService {
  if (!archiveServiceInstance) {
    archiveServiceInstance = new ArchiveService()
  }

  return archiveServiceInstance
}

export function resetArchiveService(): void {
  archiveServiceInstance = null
}

export const archiveService = getArchiveService()
