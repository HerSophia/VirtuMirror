import type {
  ArchiveConfig,
  ArchiveFloorData,
  ArchiveQueryFilter,
  ArchiveRecord,
  ExtractOptions,
  ExtractResult,
  InjectionRequest,
  InjectionResult,
} from '@/types/archive'

export type ArchiveCandidateSource = 'core' | 'account' | 'contextual'

export interface ArchiveCandidate {
  archive: ArchiveRecord
  source: ArchiveCandidateSource
  priority: number
}

export interface DeduplicationDetail {
  archiveId: string
  reason: 'id_duplicate' | 'semantic_duplicate' | 'recently_injected'
}

export interface DeduplicationResult {
  candidates: ArchiveCandidate[]
  deduplicatedCount: number
  details: DeduplicationDetail[]
}

export interface ArchiveRepositoryLike {
  getArchive(id: string): Promise<ArchiveRecord | null>
  saveArchive(archive: ArchiveRecord): Promise<ArchiveRecord>
  getConfig(sessionId: string): Promise<ArchiveConfig>
  saveConfig(config: ArchiveConfig): Promise<ArchiveConfig>
  deleteArchive(id: string): Promise<void>
  queryArchives(filter?: ArchiveQueryFilter): Promise<ArchiveRecord[]>
}

export interface ArchiveDeduplicationServiceLike {
  deduplicate(candidates: ArchiveCandidate[], sessionId: string, windowSize?: number): Promise<DeduplicationResult>
  recordInjection(sessionId: string, archiveIds: string[]): Promise<void>
  getRecentlyInjected(sessionId: string, windowSize: number): Promise<string[]>
}

export interface ArchiveInjectionServiceLike {
  getInjection(request: InjectionRequest): Promise<InjectionResult>
  getPinnedArchives(sessionId: string): Promise<ArchiveRecord[]>
  matchByKeywords(keywords: string[], sessionId: string): Promise<ArchiveRecord[]>
}

export interface ArchiveBindingServiceLike {
  bindToAccount(archiveId: string, accountId: string): Promise<void>
  unbindFromAccount(archiveId: string, accountId: string): Promise<void>
  getAccountArchives(accountId: string): Promise<ArchiveRecord[]>
}

export interface ArchiveExtractionServiceLike {
  extractFromChat(floors: ArchiveFloorData[], options?: ExtractOptions): Promise<ExtractResult>
}

export type ArchiveTokenEstimator = (text: string) => number

export interface ArchiveServiceDependencies {
  repository: ArchiveRepositoryLike
  deduplicationService: ArchiveDeduplicationServiceLike
  injectionService: ArchiveInjectionServiceLike
  bindingService: ArchiveBindingServiceLike
  extractionService: ArchiveExtractionServiceLike
}
