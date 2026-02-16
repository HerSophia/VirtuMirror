import { db } from '@/services/database'
import { contextSharingService } from '@/services/contextSharing'
import { loggerService } from '@/services/logger'
import type {
  ArchiveConfig,
  ArchiveQueryFilter,
  ArchiveRecord,
  InjectionRequest,
  InjectionResult,
} from '@/types/archive'
import type {
  ArchiveCandidate,
  ArchiveCandidateSource,
  ArchiveDeduplicationServiceLike,
  ArchiveRepositoryLike,
  ArchiveTokenEstimator,
} from './types'

const logger = loggerService.child('service:archive:injection')

const SOURCE_BASE_PRIORITY: Record<ArchiveCandidateSource, number> = {
  core: 100,
  account: 80,
  contextual: 60,
}

const SHARED_CONTEXT_IDS = {
  pinned: 'archive:pinned',
  relevant: 'archive:relevant',
  characters: 'archive:characters',
} as const

const DEFAULT_PRIORITY = 50

interface SelectedSections {
  core: ArchiveCandidate[]
  account: ArchiveCandidate[]
  contextual: ArchiveCandidate[]
  tokens: {
    core: number
    account: number
    contextual: number
  }
  totalTokens: number
}

function normalizeKeywords(keywords: string[] | undefined): string[] {
  if (!keywords || keywords.length === 0) {
    return []
  }

  return Array.from(new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)))
}

function estimateTokensByCharacters(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function isSceneEnabled(scene: string, enabledScenes: string[]): boolean {
  if (enabledScenes.length === 0) {
    return true
  }

  return enabledScenes.some((pattern) => {
    if (pattern === scene) {
      return true
    }

    if (pattern.endsWith('.*')) {
      return scene.startsWith(pattern.slice(0, -1))
    }

    if (pattern.endsWith('*')) {
      return scene.startsWith(pattern.slice(0, -1))
    }

    return false
  })
}

function getArchiveHeadline(archive: ArchiveRecord): string {
  if (archive.type === 'event') {
    return `${archive.title}: ${archive.summary}`
  }

  if (archive.type === 'character') {
    const facts = archive.knownFacts.slice(0, 2).map((fact) => fact.fact)
    const traitText = archive.traits.slice(0, 3).join(' / ')
    const extras = [traitText, ...facts].filter(Boolean).join('；')
    return extras ? `${archive.name}: ${extras}` : archive.name
  }

  return `${archive.name}: ${archive.description}`
}

function formatArchiveForCore(archive: ArchiveRecord): string {
  if (archive.type === 'event') {
    return `- [事件/${archive.subType}] ${archive.title}（${archive.importance}）：${archive.summary}`
  }

  if (archive.type === 'character') {
    const traits = archive.traits.slice(0, 4).join('、')
    return `- [角色] ${archive.name}${traits ? `：${traits}` : ''}`
  }

  return `- [设定/${archive.category}] ${archive.name}：${archive.description}`
}

function formatArchiveForAccount(archive: ArchiveRecord): string {
  if (archive.type === 'character') {
    const traits = archive.traits.slice(0, 4).join('、')
    const facts = archive.knownFacts.slice(0, 2).map((fact) => fact.fact)
    const joinedFacts = facts.join('；')
    return `- ${archive.name}${traits ? `（${traits}）` : ''}${joinedFacts ? `：${joinedFacts}` : ''}`
  }

  if (archive.type === 'event') {
    return `- ${archive.title}：${archive.summary}`
  }

  return `- ${archive.name}：${archive.description}`
}

function formatArchiveForRelevant(archive: ArchiveRecord): string {
  if (archive.type === 'event') {
    return `- ${archive.title}：${archive.summary}`
  }

  if (archive.type === 'character') {
    return `- ${archive.name}：${archive.baseDescription ?? archive.traits.slice(0, 3).join('、')}`
  }

  return `- ${archive.name}：${archive.description}`
}

function toCandidate(archive: ArchiveRecord, source: ArchiveCandidateSource): ArchiveCandidate {
  return {
    archive,
    source,
    priority: SOURCE_BASE_PRIORITY[source] + (archive.injectionPriority ?? DEFAULT_PRIORITY),
  }
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

function emptyInjectionResult(): InjectionResult {
  return {
    coreKnowledge: '',
    accountContext: '',
    relevantArchives: '',
    metadata: {
      totalTokens: 0,
      injectedArchiveIds: [],
      deduplicatedCount: 0,
    },
  }
}

export class InjectionService {
  constructor(
    private readonly repository: ArchiveRepositoryLike,
    private readonly deduplicationService: ArchiveDeduplicationServiceLike,
    private readonly tokenEstimator: ArchiveTokenEstimator = estimateTokensByCharacters
  ) {}

  async getInjection(request: InjectionRequest): Promise<InjectionResult> {
    const startedAt = Date.now()
    const config = await this.repository.getConfig(request.sessionId)

    if (!isSceneEnabled(request.scene, config.injection.enabledScenes)) {
      logger.debug('场景未启用档案注入，直接跳过', {
        scene: request.scene,
        sessionId: request.sessionId,
      })
      return emptyInjectionResult()
    }

    const account = request.accountId ? await db.platformAccounts.get(request.accountId) : null
    const shouldInjectAccount = account?.archiveInjection?.enabled !== false

    const [coreArchives, accountArchives, contextualArchives] = await Promise.all([
      this.getPinnedArchives(request.sessionId),
      shouldInjectAccount && request.accountId ? this.getAccountArchives(request.accountId) : Promise.resolve([]),
      this.matchByKeywords(request.keywords ?? [], request.sessionId),
    ])

    const candidates: ArchiveCandidate[] = [
      ...coreArchives.map((archive) => toCandidate(archive, 'core')),
      ...accountArchives.map((archive) => toCandidate(archive, 'account')),
      ...contextualArchives.map((archive) => toCandidate(archive, 'contextual')),
    ]

    if (candidates.length === 0) {
      await this.publishSharedContexts('', '', '')
      return emptyInjectionResult()
    }

    const dedupResult = await this.deduplicationService.deduplicate(
      candidates,
      request.sessionId,
      config.injection.deduplicationWindow
    )

    const sortedCandidates = sortCandidates(dedupResult.candidates)

    const budget = {
      total:
        request.maxTotalTokens ??
        config.injection.coreKnowledgeMaxTokens +
          config.injection.accountContextMaxTokens +
          config.injection.contextualMaxTokens,
      core: config.injection.coreKnowledgeMaxTokens,
      account: shouldInjectAccount
        ? Math.min(
            config.injection.accountContextMaxTokens,
            account?.archiveInjection?.maxTokens ?? config.injection.accountContextMaxTokens
          )
        : 0,
      contextual: config.injection.contextualMaxTokens,
      maxPinnedArchives: config.injection.maxPinnedArchives,
      maxContextualMatches: config.injection.maxContextualMatches,
    }

    const selected = this.selectCandidates(sortedCandidates, budget)

    const coreKnowledge = selected.core.map((item) => formatArchiveForCore(item.archive)).join('\n')
    const accountContext = selected.account.map((item) => formatArchiveForAccount(item.archive)).join('\n')
    const relevantArchives = selected.contextual
      .map((item) => formatArchiveForRelevant(item.archive))
      .join('\n')

    const injectedArchiveIds = Array.from(
      new Set(
        [...selected.core, ...selected.account, ...selected.contextual].map((candidate) => candidate.archive.id)
      )
    )

    await this.deduplicationService.recordInjection(request.sessionId, injectedArchiveIds)

    const characterContext = this.buildCharacterContext(selected)
    await this.publishSharedContexts(coreKnowledge, relevantArchives, characterContext)

    const duration = Date.now() - startedAt
    logger.info('档案注入完成', {
      sessionId: request.sessionId,
      scene: request.scene,
      candidateCount: candidates.length,
      deduplicatedCount: dedupResult.deduplicatedCount,
      injectedCount: injectedArchiveIds.length,
      totalTokens: selected.totalTokens,
      duration,
    })

    return {
      coreKnowledge,
      accountContext,
      relevantArchives,
      metadata: {
        totalTokens: selected.totalTokens,
        injectedArchiveIds,
        deduplicatedCount: dedupResult.deduplicatedCount,
      },
    }
  }

  async getPinnedArchives(sessionId: string): Promise<ArchiveRecord[]> {
    const config = await this.repository.getConfig(sessionId)

    const filter: ArchiveQueryFilter = {
      sessionId,
      injectionLevel: 'always',
      sortBy: 'injectionPriority',
      sortOrder: 'desc',
      limit: config.injection.maxPinnedArchives,
    }

    return this.repository.queryArchives(filter)
  }

  async matchByKeywords(keywords: string[], sessionId: string): Promise<ArchiveRecord[]> {
    const normalized = normalizeKeywords(keywords)
    if (normalized.length === 0) {
      return []
    }

    const config = await this.repository.getConfig(sessionId)

    return this.repository.queryArchives({
      sessionId,
      injectionLevel: 'contextual',
      keywords: normalized,
      keywordMatchMode: 'any',
      sortBy: 'injectionPriority',
      sortOrder: 'desc',
      limit: config.injection.maxContextualMatches,
    })
  }

  async markInjected(sessionId: string, archiveIds: string[]): Promise<void> {
    await this.deduplicationService.recordInjection(sessionId, archiveIds)
  }

  private async getAccountArchives(accountId: string): Promise<ArchiveRecord[]> {
    const account = await db.platformAccounts.get(accountId)
    if (!account) {
      return []
    }

    const archiveIds = account.boundArchiveIds ?? []
    if (archiveIds.length === 0) {
      return []
    }

    const archives = await this.repository.queryArchives({
      boundAccountIds: [accountId],
      boundAccountMatchMode: 'any',
      sortBy: 'injectionPriority',
      sortOrder: 'desc',
    })

    if (account.archiveInjection?.includeRelated === false) {
      const archiveIdSet = new Set(archiveIds)
      return archives.filter((archive) => archiveIdSet.has(archive.id))
    }

    return archives
  }

  private selectCandidates(
    candidates: ArchiveCandidate[],
    budget: {
      total: number
      core: number
      account: number
      contextual: number
      maxPinnedArchives: number
      maxContextualMatches: number
    }
  ): SelectedSections {
    const selected: SelectedSections = {
      core: [],
      account: [],
      contextual: [],
      tokens: {
        core: 0,
        account: 0,
        contextual: 0,
      },
      totalTokens: 0,
    }

    for (const candidate of candidates) {
      const headline = getArchiveHeadline(candidate.archive)
      const tokenCost = this.tokenEstimator(headline)

      if (selected.totalTokens + tokenCost > budget.total) {
        continue
      }

      if (candidate.source === 'core') {
        if (selected.core.length >= budget.maxPinnedArchives) {
          continue
        }
        if (selected.tokens.core + tokenCost > budget.core) {
          continue
        }

        selected.core.push(candidate)
        selected.tokens.core += tokenCost
      } else if (candidate.source === 'account') {
        if (budget.account <= 0) {
          continue
        }
        if (selected.tokens.account + tokenCost > budget.account) {
          continue
        }

        selected.account.push(candidate)
        selected.tokens.account += tokenCost
      } else {
        if (selected.contextual.length >= budget.maxContextualMatches) {
          continue
        }
        if (selected.tokens.contextual + tokenCost > budget.contextual) {
          continue
        }

        selected.contextual.push(candidate)
        selected.tokens.contextual += tokenCost
      }

      selected.totalTokens += tokenCost
    }

    return selected
  }

  private buildCharacterContext(selected: SelectedSections): string {
    const characterArchives = [...selected.core, ...selected.account, ...selected.contextual]
      .map((candidate) => candidate.archive)
      .filter((archive): archive is Extract<ArchiveRecord, { type: 'character' }> => archive.type === 'character')

    if (characterArchives.length === 0) {
      return ''
    }

    return characterArchives
      .map((archive) => {
        const traits = archive.traits.slice(0, 4).join('、')
        return `- ${archive.name}${traits ? `：${traits}` : ''}`
      })
      .join('\n')
  }

  private async publishSharedContexts(
    coreKnowledge: string,
    relevantArchives: string,
    characters: string
  ): Promise<void> {
    contextSharingService.publish({
      id: SHARED_CONTEXT_IDS.pinned,
      type: 'archive:pinned',
      description: 'Archive 核心知识（always）',
      value: coreKnowledge,
    })

    contextSharingService.publish({
      id: SHARED_CONTEXT_IDS.relevant,
      type: 'archive:relevant',
      description: 'Archive 上下文匹配结果',
      value: relevantArchives,
    })

    contextSharingService.publish({
      id: SHARED_CONTEXT_IDS.characters,
      type: 'archive:characters',
      description: 'Archive 角色背景摘要',
      value: characters,
    })
  }
}
