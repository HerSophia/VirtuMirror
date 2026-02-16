export type InjectionLevel = 'none' | 'contextual' | 'always'

export type ArchiveType = 'event' | 'character' | 'world'

export type EventSubType = 'plot' | 'dialogue' | 'discovery' | 'decision'

export type EventImportance = 'critical' | 'major' | 'normal' | 'minor'

export type EventStatus = 'pending' | 'confirmed' | 'rejected'

export type ArchiveStatus = EventStatus | 'active' | 'archived'

export interface ArchiveBase {
  id: string
  sessionId: string
  type: ArchiveType
  injectionLevel: InjectionLevel
  injectionPriority?: number
  boundAccountIds?: string[]
  keywords: string[]
  importance?: EventImportance
  status?: ArchiveStatus
  createdAt: number
  lastUpdated: number
  contentHash?: string
  metadata?: Record<string, unknown>
}

export interface FloorReference {
  messageId: number
  swipeId: number
  excerpt?: string
}

export interface ChatArchive extends ArchiveBase {
  type: 'event'
  subType: EventSubType
  sourceFloors: FloorReference[]
  extractedAt: number
  confirmedAt?: number
  title: string
  summary: string
  keyQuotes?: string[]
  participants: string[]
  inWorldTime?: string
  inWorldDate?: string
  realTimestamp: number
  location?: string
  importance: EventImportance
  status: EventStatus
}

export type CharacterRole = 'protagonist' | 'main' | 'supporting' | 'npc'

export type FactConfidence = 'certain' | 'likely' | 'uncertain'

export interface FactEntry {
  fact: string
  sourceFloor?: number
  learnedAt: number
  confidence: FactConfidence
}

export interface ActionEntry {
  action: string
  sourceFloor?: number
  timestamp: number
}

export interface UpdateRecord {
  field: string
  oldValue: unknown
  newValue: unknown
  sourceFloor?: number
  timestamp: number
}

export interface CharacterProfile extends ArchiveBase {
  type: 'character'
  name: string
  aliases: string[]
  avatar?: string
  role: CharacterRole
  baseDescription?: string
  traits: string[]
  abilities?: string[]
  knownFacts: FactEntry[]
  recentActions: ActionEntry[]
  source: 'character_card' | 'chat_extract' | 'social_media' | 'manual'
  updateHistory: UpdateRecord[]
}

export type WorldEntryCategory =
  | 'location'
  | 'organization'
  | 'item'
  | 'concept'
  | 'rule'
  | 'history'

export interface WorldEntry extends ArchiveBase {
  type: 'world'
  category: WorldEntryCategory
  name: string
  description: string
  details?: Record<string, string>
  relatedCharacters: string[]
  relatedEntries: string[]
  relatedEvents: string[]
  source: 'worldbook' | 'chat_extract' | 'social_media' | 'manual'
  sourceReference?: string
}

export type ArchiveRecord = ChatArchive | CharacterProfile | WorldEntry

export interface Keyword {
  id: string
  sessionId: string
  text: string
  category?: string
  usageCount: number
  linkedArchives: string[]
  linkedCharacters: string[]
  linkedEntries: string[]
  source: 'ai_generated' | 'user_created'
  createdAt: number
}

export interface ArchiveConfig {
  sessionId: string
  autoExtract: {
    enabled: boolean
    floorInterval: number
    requireConfirmation: boolean
  }
  initialContext?: {
    worldSetting?: string
    mainCharacters?: string[]
    timeline?: string
    customInstructions?: string
  }
  injection: {
    enabledScenes: string[]
    coreKnowledgeMaxTokens: number
    accountContextMaxTokens: number
    contextualMaxTokens: number
    maxPinnedArchives: number
    maxContextualMatches: number
    enableSemanticMatch: boolean
    deduplicationWindow: number
  }
  lastExtractFloor: number
  lastExtractTime: number
  totalExtractCount: number
  updatedAt?: number
}

export interface ArchiveInjectionHistory {
  id: string
  sessionId: string
  round: number
  archiveIds: string[]
  injectedAt: number
  scene?: string
}

export interface InjectionRequest {
  sessionId: string
  scene: string
  accountId?: string
  keywords?: string[]
  maxTotalTokens?: number
}

export interface InjectionResult {
  coreKnowledge: string
  accountContext: string
  relevantArchives: string
  metadata: {
    totalTokens: number
    injectedArchiveIds: string[]
    deduplicatedCount: number
  }
}

export interface ArchiveFloorData {
  messageId: number
  swipeId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface ExtractOptions {
  extractEvents?: boolean
  extractCharacters?: boolean
  extractWorld?: boolean
  generateKeywords?: boolean
  sessionId?: string
  scene?: string
  maxTokens?: number
}

export interface CharacterUpdate {
  characterId?: string
  name: string
  updates: Partial<CharacterProfile>
  isNew: boolean
}

export interface ExtractResult {
  success: boolean
  events: ChatArchive[]
  characterUpdates: CharacterUpdate[]
  worldEntries: WorldEntry[]
  keywords: Keyword[]
  metadata: {
    floorRange?: { start: number; end: number }
    extractedAt: number
    llmTokensUsed: number
  }
  error?: string
}

export interface ArchiveQueryFilter {
  sessionId?: string
  type?: ArchiveType
  injectionLevel?: InjectionLevel
  keywords?: string[]
  keywordMatchMode?: 'any' | 'all'
  importance?: EventImportance | EventImportance[]
  status?: ArchiveStatus | ArchiveStatus[]
  boundAccountIds?: string[]
  boundAccountMatchMode?: 'any' | 'all'
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'lastUpdated' | 'injectionPriority'
  sortOrder?: 'asc' | 'desc'
}
