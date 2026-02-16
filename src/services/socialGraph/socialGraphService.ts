import { v4 as uuidv4 } from 'uuid'
import { accountService } from '@/services/account'
import { db } from '@/services/database'
import { eventBus } from '@/services/eventBus'
import { loggerService } from '@/services/logger'
import type { PlatformAccount, RelationType, SocialRelation as AccountRelation } from '@/types/account'
import type {
  BatchFollowOptions,
  BatchFollowResult,
  BlockOptions,
  FollowOptions,
  FollowRecommendation,
  GraphAccountNode,
  ISocialGraphService,
  MuteOptions,
  RecommendationOptions,
  RecommendationReason,
  RelationshipStats,
  SocialGraphErrorCode,
  SocialGraphEvent,
  SocialGraphQueryOptions,
  SocialGraphRelationScope,
  SocialGraphRelationStatus,
  SocialGraphRelationType,
  SocialGraphPageResult,
} from '@/types/socialGraph'

interface RelationMetadata {
  platformId?: string
  scope?: SocialGraphRelationScope
  status?: SocialGraphRelationStatus
  updatedAt?: number
  reason?: string
  durationMs?: number
  expiresAt?: number
  [key: string]: unknown
}

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 200

const writeLogger = loggerService.child('social-graph:write')
const queryLogger = loggerService.child('social-graph:query')
const recommendationLogger = loggerService.child('social-graph:recommend')

export class SocialGraphError extends Error {
  readonly code: SocialGraphErrorCode

  constructor(code: SocialGraphErrorCode, message: string) {
    super(message)
    this.name = 'SocialGraphError'
    this.code = code
  }
}

export class SocialGraphService implements ISocialGraphService {
  private listeners = new Set<(event: SocialGraphEvent) => void>()

  async follow(fromId: string, toId: string, options: FollowOptions): Promise<void> {
    if (fromId === toId) {
      throw this.createError('SELF_FOLLOW_NOT_ALLOWED', 'Cannot follow self')
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.requireAccount(fromId),
      this.requireAccount(toId),
    ])

    this.assertPlatformConsistency(fromAccount, toAccount, options.platformId)

    if (
      (await this.isBlocked(fromId, toId, options.platformId)) ||
      (await this.isBlocked(toId, fromId, options.platformId))
    ) {
      throw this.createError('RELATION_BLOCKED', 'Relation is blocked')
    }

    const existing = await this.findRelation(fromId, toId, 'follow', options.platformId)
    if (existing) {
      return
    }

    await this.createRelation('follow', fromId, toId, {
      platformId: options.platformId,
      scope: 'platform',
      metadata: options.metadata,
    })

    writeLogger.info('follow created', { fromId, toId, platformId: options.platformId })

    this.emitEvent({
      type: 'social:relation:followed',
      fromId,
      toId,
      platformId: options.platformId,
      timestamp: Date.now(),
    })

    await this.emitStatsUpdatedForPair(fromAccount, toAccount)
  }

  async unfollow(fromId: string, toId: string, platformId: string): Promise<void> {
    const [fromAccount, toAccount] = await Promise.all([
      this.requireAccount(fromId),
      this.requireAccount(toId),
    ])

    this.assertPlatformConsistency(fromAccount, toAccount, platformId)

    const deleted = await this.removeRelations(fromId, toId, 'follow', platformId)
    if (deleted === 0) {
      return
    }

    writeLogger.info('follow removed', { fromId, toId, platformId })

    this.emitEvent({
      type: 'social:relation:unfollowed',
      fromId,
      toId,
      platformId,
      timestamp: Date.now(),
    })

    await this.emitStatsUpdatedForPair(fromAccount, toAccount)
  }

  async block(fromId: string, toId: string, options: BlockOptions = {}): Promise<void> {
    const [fromAccount, toAccount] = await Promise.all([
      this.requireAccount(fromId),
      this.requireAccount(toId),
    ])

    const scope = options.scope ?? 'platform'
    const platformId = this.resolvePlatformId(fromAccount, toAccount, scope, options.platformId)
    const autoUnfollow = options.autoUnfollow ?? true

    const existing = await this.findRelation(fromId, toId, 'block', platformId, scope)
    if (!existing) {
      await this.createRelation('block', fromId, toId, {
        platformId,
        scope,
        metadata: options.reason ? { reason: options.reason } : undefined,
      })
    }

    if (autoUnfollow) {
      await this.removeRelations(fromId, toId, 'follow', platformId)
      await this.removeRelations(toId, fromId, 'follow', platformId)
    }

    writeLogger.info('block applied', { fromId, toId, platformId, scope, autoUnfollow })

    this.emitEvent({
      type: 'social:relation:blocked',
      fromId,
      toId,
      platformId,
      timestamp: Date.now(),
      payload: {
        scope,
        autoUnfollow,
      },
    })

    await this.emitStatsUpdatedForPair(fromAccount, toAccount)
  }

  async unblock(fromId: string, toId: string, options: BlockOptions = {}): Promise<void> {
    const [fromAccount, toAccount] = await Promise.all([
      this.requireAccount(fromId),
      this.requireAccount(toId),
    ])

    const scope = options.scope ?? 'platform'
    const platformId = this.resolvePlatformId(fromAccount, toAccount, scope, options.platformId)

    const deleted = await this.removeRelations(fromId, toId, 'block', platformId, scope)
    if (deleted === 0) {
      return
    }

    writeLogger.info('block removed', { fromId, toId, platformId, scope })

    this.emitEvent({
      type: 'social:relation:unblocked',
      fromId,
      toId,
      platformId,
      timestamp: Date.now(),
      payload: { scope },
    })

    await this.emitStatsUpdatedForPair(fromAccount, toAccount)
  }

  async mute(fromId: string, toId: string, options: MuteOptions = {}): Promise<void> {
    const [fromAccount, toAccount] = await Promise.all([
      this.requireAccount(fromId),
      this.requireAccount(toId),
    ])

    const scope = options.scope ?? 'platform'
    const platformId = this.resolvePlatformId(fromAccount, toAccount, scope, options.platformId)

    await this.removeRelations(fromId, toId, 'mute', platformId, scope)

    const metadata: Record<string, unknown> = {}
    if (options.reason) {
      metadata.reason = options.reason
    }
    if (typeof options.durationMs === 'number' && options.durationMs > 0) {
      metadata.durationMs = options.durationMs
      metadata.expiresAt = Date.now() + options.durationMs
    }

    await this.createRelation('mute', fromId, toId, {
      platformId,
      scope,
      metadata,
    })

    writeLogger.info('mute applied', { fromId, toId, platformId, scope })

    this.emitEvent({
      type: 'social:relation:muted',
      fromId,
      toId,
      platformId,
      timestamp: Date.now(),
      payload: { scope, ...metadata },
    })

    await this.emitStatsUpdatedForPair(fromAccount, toAccount)
  }

  async unmute(fromId: string, toId: string, options: MuteOptions = {}): Promise<void> {
    const [fromAccount, toAccount] = await Promise.all([
      this.requireAccount(fromId),
      this.requireAccount(toId),
    ])

    const scope = options.scope ?? 'platform'
    const platformId = this.resolvePlatformId(fromAccount, toAccount, scope, options.platformId)

    const deleted = await this.removeRelations(fromId, toId, 'mute', platformId, scope)
    if (deleted === 0) {
      return
    }

    writeLogger.info('mute removed', { fromId, toId, platformId, scope })

    this.emitEvent({
      type: 'social:relation:unmuted',
      fromId,
      toId,
      platformId,
      timestamp: Date.now(),
      payload: { scope },
    })

    await this.emitStatsUpdatedForPair(fromAccount, toAccount)
  }

  async getFollowers(
    accountId: string,
    options: SocialGraphQueryOptions = {}
  ): Promise<SocialGraphPageResult> {
    await this.requireAccount(accountId)

    if (options.type && options.type !== 'follow') {
      return this.emptyPageResult(options)
    }

    const relations = await db.socialRelations
      .where('[toAccountId+type]')
      .equals([accountId, 'follow'])
      .toArray()

    const relatedIds = relations.map((relation) => relation.fromAccountId)
    const accountMap = await this.getAccountsMap(relatedIds)
    const items = this.filterAndMapRelationsToNodes(relations, accountMap, options, 'fromAccountId')

    queryLogger.debug('followers queried', {
      accountId,
      platformId: options.platformId,
      total: items.length,
    })

    return this.toPageResult(items, options)
  }

  async getFollowing(
    accountId: string,
    options: SocialGraphQueryOptions = {}
  ): Promise<SocialGraphPageResult> {
    await this.requireAccount(accountId)

    if (options.type && options.type !== 'follow') {
      return this.emptyPageResult(options)
    }

    const relations = await db.socialRelations
      .where('[fromAccountId+type]')
      .equals([accountId, 'follow'])
      .toArray()

    const relatedIds = relations.map((relation) => relation.toAccountId)
    const accountMap = await this.getAccountsMap(relatedIds)
    const items = this.filterAndMapRelationsToNodes(relations, accountMap, options, 'toAccountId')

    queryLogger.debug('following queried', {
      accountId,
      platformId: options.platformId,
      total: items.length,
    })

    return this.toPageResult(items, options)
  }

  async getMutualFollows(
    accountId: string,
    options: SocialGraphQueryOptions = {}
  ): Promise<GraphAccountNode[]> {
    await this.requireAccount(accountId)

    const platformId = options.platformId
    const [followingIds, followerIds] = await Promise.all([
      this.getFollowTargetIds(accountId, platformId),
      this.getFollowerSourceIds(accountId, platformId),
    ])

    const mutualIds = this.intersectSets(followingIds, followerIds)
    const accountMap = await this.getAccountsMap(Array.from(mutualIds))
    const nodes = Array.from(mutualIds)
      .map((id) => accountMap.get(id))
      .filter((account): account is PlatformAccount => Boolean(account))
      .map((account) => ({
        accountId: account.id,
        platformId: account.platformId,
        reason: 'mutual follow',
      }))

    return this.sliceNodes(nodes, options)
  }

  async isFollowing(fromId: string, toId: string, platformId: string): Promise<boolean> {
    const relation = await this.findRelation(fromId, toId, 'follow', platformId)
    return Boolean(relation)
  }

  async isBlocked(fromId: string, toId: string, platformId?: string): Promise<boolean> {
    const relations = await this.findRelations(fromId, toId, 'block')

    for (const relation of relations) {
      if (this.isRelationExpired(relation)) {
        continue
      }

      const metadata = this.getMetadata(relation)
      if (metadata.scope === 'global') {
        return true
      }

      if (!platformId) {
        return true
      }

      if (metadata.platformId === platformId) {
        return true
      }
    }

    return false
  }

  async isMuted(fromId: string, toId: string, platformId?: string): Promise<boolean> {
    const relations = await this.findRelations(fromId, toId, 'mute')

    for (const relation of relations) {
      if (this.isRelationExpired(relation)) {
        await db.socialRelations.delete(relation.id)
        continue
      }

      const metadata = this.getMetadata(relation)
      if (metadata.scope === 'global') {
        return true
      }

      if (!platformId) {
        return true
      }

      if (metadata.platformId === platformId) {
        return true
      }
    }

    return false
  }

  async getRelationshipStats(accountId: string, platformId: string): Promise<RelationshipStats> {
    await this.requireAccount(accountId)

    const [followingIds, followerIds, blocks, mutes] = await Promise.all([
      this.getFollowTargetIds(accountId, platformId),
      this.getFollowerSourceIds(accountId, platformId),
      this.countRelations(accountId, 'block', platformId),
      this.countRelations(accountId, 'mute', platformId),
    ])

    return {
      accountId,
      platformId,
      followers: followerIds.size,
      following: followingIds.size,
      mutualFollows: this.intersectSets(followingIds, followerIds).size,
      blocks,
      mutes,
      updatedAt: Date.now(),
    }
  }

  async getRecommendedFollows(
    accountId: string,
    options: RecommendationOptions
  ): Promise<FollowRecommendation[]> {
    const startTime = Date.now()
    await this.requireAccount(accountId)

    const platformId = options.platformId
    const limit = Math.max(1, Math.min(options.limit ?? 10, 100))
    const minScore = Math.max(0, Math.min(options.minScore ?? 0, 1))
    const excludeIds = new Set(options.excludeIds ?? [])

    const [followingIds, followerIds] = await Promise.all([
      this.getFollowTargetIds(accountId, platformId),
      this.getFollowerSourceIds(accountId, platformId),
    ])

    const relationSeedIds = new Set<string>([...followingIds, ...followerIds])
    const candidateIds = new Set<string>()

    for (const seedId of relationSeedIds) {
      const [seedFollowing, seedFollowers] = await Promise.all([
        this.getFollowTargetIds(seedId, platformId),
        this.getFollowerSourceIds(seedId, platformId),
      ])

      seedFollowing.forEach((id) => candidateIds.add(id))
      seedFollowers.forEach((id) => candidateIds.add(id))
    }

    candidateIds.delete(accountId)
    followingIds.forEach((id) => candidateIds.delete(id))
    excludeIds.forEach((id) => candidateIds.delete(id))

    const blockedByCurrent = await Promise.all(
      Array.from(candidateIds).map((id) => this.isBlocked(accountId, id, platformId))
    )
    const blockedCurrent = await Promise.all(
      Array.from(candidateIds).map((id) => this.isBlocked(id, accountId, platformId))
    )
    const mutedByCurrent = await Promise.all(
      Array.from(candidateIds).map((id) => this.isMuted(accountId, id, platformId))
    )

    const candidateArray = Array.from(candidateIds).filter(
      (_, index) => !blockedByCurrent[index] && !blockedCurrent[index] && !mutedByCurrent[index]
    )

    const accountMap = await this.getAccountsMap(candidateArray)
    const recommendations: FollowRecommendation[] = []

    for (const candidateId of candidateArray) {
      const account = accountMap.get(candidateId)
      if (!account || account.platformId !== platformId) {
        continue
      }

      const [candidateFollowing, candidateFollowers] = await Promise.all([
        this.getFollowTargetIds(candidateId, platformId),
        this.getFollowerSourceIds(candidateId, platformId),
      ])

      const mutualFollowIds = this.intersectSets(followingIds, candidateFollowing)
      const mutualFollowerIds = this.intersectSets(followerIds, candidateFollowers)

      const mutualFollowScore = this.normalizeCount(mutualFollowIds.size)
      const mutualFollowerScore = this.normalizeCount(mutualFollowerIds.size)
      const interactionSimilarity = 0
      const recencyBoost = this.calculateRecencyBoost(account.createdAt)

      const score =
        0.45 * mutualFollowScore +
        0.25 * mutualFollowerScore +
        0.2 * interactionSimilarity +
        0.1 * recencyBoost

      if (score < minScore) {
        continue
      }

      const reasons: RecommendationReason[] = []
      if (mutualFollowIds.size > 0) {
        reasons.push({
          type: 'mutual_follow',
          description: `共同关注 ${mutualFollowIds.size} 人`,
          relatedIds: Array.from(mutualFollowIds).slice(0, 5),
        })
      }
      if (mutualFollowerIds.size > 0) {
        reasons.push({
          type: 'mutual_follower',
          description: `共同粉丝 ${mutualFollowerIds.size} 人`,
          relatedIds: Array.from(mutualFollowerIds).slice(0, 5),
        })
      }
      if (recencyBoost > 0.6) {
        reasons.push({
          type: 'platform_boost',
          description: '近期活跃账号',
        })
      }

      recommendations.push({
        accountId: candidateId,
        platformId,
        score: Number(score.toFixed(4)),
        reasons,
      })
    }

    const sorted = recommendations.sort((a, b) => b.score - a.score).slice(0, limit)

    recommendationLogger.info('recommendation calculated', {
      accountId,
      platformId,
      candidateCount: candidateArray.length,
      recommendationCount: sorted.length,
      durationMs: Date.now() - startTime,
    })

    return sorted
  }

  async batchFollow(
    fromId: string,
    toIds: string[],
    options: BatchFollowOptions
  ): Promise<BatchFollowResult> {
    const deduplicate = options.deduplicate ?? true
    const stopOnError = options.stopOnError ?? false
    const targetIds = deduplicate ? Array.from(new Set(toIds)) : [...toIds]

    const result: BatchFollowResult = {
      successIds: [],
      failed: [],
    }

    for (const toId of targetIds) {
      try {
        await this.follow(fromId, toId, { platformId: options.platformId })
        result.successIds.push(toId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        result.failed.push({ toId, error: message })

        if (stopOnError) {
          break
        }
      }
    }

    if (result.failed.length > 0) {
      writeLogger.warn('batch follow partial failed', {
        fromId,
        platformId: options.platformId,
        success: result.successIds.length,
        failed: result.failed.length,
      })
    }

    return result
  }

  onRelationChange(callback: (event: SocialGraphEvent) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private createError(code: SocialGraphErrorCode, message: string): SocialGraphError {
    return new SocialGraphError(code, message)
  }

  private async requireAccount(accountId: string): Promise<PlatformAccount> {
    const account = await accountService.getPlatformAccount(accountId)
    if (!account) {
      throw this.createError('ACCOUNT_NOT_FOUND', `Account not found: ${accountId}`)
    }
    return account
  }

  private assertPlatformConsistency(
    fromAccount: PlatformAccount,
    toAccount: PlatformAccount,
    platformId: string
  ): void {
    if (
      fromAccount.platformId !== platformId ||
      toAccount.platformId !== platformId ||
      fromAccount.platformId !== toAccount.platformId
    ) {
      throw this.createError('INVALID_PLATFORM', `Invalid platform context: ${platformId}`)
    }
  }

  private resolvePlatformId(
    fromAccount: PlatformAccount,
    toAccount: PlatformAccount,
    scope: SocialGraphRelationScope,
    platformId?: string
  ): string {
    if (scope === 'global') {
      return platformId ?? fromAccount.platformId
    }

    const resolved = platformId ?? fromAccount.platformId
    this.assertPlatformConsistency(fromAccount, toAccount, resolved)
    return resolved
  }

  private getMetadata(relation: AccountRelation): RelationMetadata {
    const metadata = relation.metadata as RelationMetadata | undefined
    return metadata ?? {}
  }

  private isRelationExpired(relation: AccountRelation): boolean {
    const metadata = this.getMetadata(relation)
    if (typeof metadata.expiresAt !== 'number') {
      return false
    }
    return metadata.expiresAt <= Date.now()
  }

  private isRelationActive(relation: AccountRelation, includeInactive = false): boolean {
    const metadata = this.getMetadata(relation)
    if (metadata.status === 'inactive') {
      return includeInactive
    }

    if (this.isRelationExpired(relation)) {
      return includeInactive
    }

    return true
  }

  private relationMatchesContext(
    relation: AccountRelation,
    platformId?: string,
    scope?: SocialGraphRelationScope
  ): boolean {
    const metadata = this.getMetadata(relation)

    if (scope && metadata.scope && metadata.scope !== scope) {
      return false
    }

    if (!platformId) {
      return true
    }

    if (metadata.scope === 'global') {
      return true
    }

    if (!metadata.platformId) {
      return true
    }

    return metadata.platformId === platformId
  }

  private async findRelations(
    fromId: string,
    toId: string,
    type: SocialGraphRelationType
  ): Promise<AccountRelation[]> {
    return db.socialRelations
      .where('[fromAccountId+type]')
      .equals([fromId, this.toAccountRelationType(type)])
      .filter((relation) => relation.toAccountId === toId)
      .toArray()
  }

  private async findRelation(
    fromId: string,
    toId: string,
    type: SocialGraphRelationType,
    platformId?: string,
    scope?: SocialGraphRelationScope
  ): Promise<AccountRelation | null> {
    const relations = await this.findRelations(fromId, toId, type)

    for (const relation of relations) {
      if (!this.isRelationActive(relation)) {
        continue
      }

      if (this.relationMatchesContext(relation, platformId, scope)) {
        return relation
      }
    }

    return null
  }

  private async createRelation(
    type: SocialGraphRelationType,
    fromId: string,
    toId: string,
    options: {
      platformId: string
      scope: SocialGraphRelationScope
      metadata?: Record<string, unknown>
    }
  ): Promise<void> {
    const now = Date.now()
    const relation: AccountRelation = {
      id: uuidv4(),
      fromAccountId: fromId,
      toAccountId: toId,
      type: this.toAccountRelationType(type),
      createdAt: now,
      metadata: {
        platformId: options.platformId,
        scope: options.scope,
        status: 'active',
        updatedAt: now,
        ...(options.metadata ?? {}),
      },
    }

    await db.socialRelations.add(relation)
  }

  private async removeRelations(
    fromId: string,
    toId: string,
    type: SocialGraphRelationType,
    platformId?: string,
    scope?: SocialGraphRelationScope
  ): Promise<number> {
    const relations = await this.findRelations(fromId, toId, type)
    const toDelete = relations.filter(
      (relation) =>
        this.isRelationActive(relation, true) && this.relationMatchesContext(relation, platformId, scope)
    )

    await Promise.all(toDelete.map((relation) => db.socialRelations.delete(relation.id)))
    return toDelete.length
  }

  private toPageResult(items: GraphAccountNode[], options: SocialGraphQueryOptions): SocialGraphPageResult {
    const total = items.length
    const { offset, limit } = this.resolvePaging(options)
    const paged = items.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    return {
      items: paged,
      hasMore,
      nextCursor: hasMore ? String(offset + limit) : undefined,
      total,
    }
  }

  private emptyPageResult(options: SocialGraphQueryOptions): SocialGraphPageResult {
    const { offset, limit } = this.resolvePaging(options)
    return {
      items: [],
      hasMore: false,
      nextCursor: undefined,
      total: 0,
    }
  }

  private resolvePaging(options: SocialGraphQueryOptions): { offset: number; limit: number } {
    const cursorOffset = options.cursor ? Number.parseInt(options.cursor, 10) : Number.NaN
    const offset = Number.isFinite(cursorOffset)
      ? Math.max(0, cursorOffset)
      : Math.max(0, options.offset ?? 0)

    const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT))
    return { offset, limit }
  }

  private sliceNodes(nodes: GraphAccountNode[], options: SocialGraphQueryOptions): GraphAccountNode[] {
    const { offset, limit } = this.resolvePaging(options)
    return nodes.slice(offset, offset + limit)
  }

  private async getAccountsMap(accountIds: string[]): Promise<Map<string, PlatformAccount>> {
    const uniqueIds = Array.from(new Set(accountIds))
    if (uniqueIds.length === 0) {
      return new Map()
    }

    const accounts = await db.platformAccounts.where('id').anyOf(uniqueIds).toArray()
    return new Map(accounts.map((account) => [account.id, account]))
  }

  private filterAndMapRelationsToNodes(
    relations: AccountRelation[],
    accountMap: Map<string, PlatformAccount>,
    options: SocialGraphQueryOptions,
    accountField: 'fromAccountId' | 'toAccountId'
  ): GraphAccountNode[] {
    const includeInactive = options.includeInactive ?? false

    return relations
      .filter((relation) => this.isRelationActive(relation, includeInactive))
      .filter((relation) => this.relationMatchesContext(relation, options.platformId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((relation) => accountMap.get(relation[accountField]))
      .filter((account): account is PlatformAccount => Boolean(account))
      .filter((account) => (options.platformId ? account.platformId === options.platformId : true))
      .map((account) => ({
        accountId: account.id,
        platformId: account.platformId,
      }))
  }

  private async getFollowTargetIds(accountId: string, platformId?: string): Promise<Set<string>> {
    const relations = await db.socialRelations
      .where('[fromAccountId+type]')
      .equals([accountId, 'follow'])
      .toArray()

    const accountMap = await this.getAccountsMap(relations.map((relation) => relation.toAccountId))
    const targets = this.filterAndMapRelationsToNodes(
      relations,
      accountMap,
      {
        platformId,
      },
      'toAccountId'
    )

    return new Set(targets.map((target) => target.accountId))
  }

  private async getFollowerSourceIds(accountId: string, platformId?: string): Promise<Set<string>> {
    const relations = await db.socialRelations
      .where('[toAccountId+type]')
      .equals([accountId, 'follow'])
      .toArray()

    const accountMap = await this.getAccountsMap(relations.map((relation) => relation.fromAccountId))
    const sources = this.filterAndMapRelationsToNodes(
      relations,
      accountMap,
      {
        platformId,
      },
      'fromAccountId'
    )

    return new Set(sources.map((source) => source.accountId))
  }

  private async countRelations(
    accountId: string,
    type: SocialGraphRelationType,
    platformId: string
  ): Promise<number> {
    const relations = await db.socialRelations
      .where('[fromAccountId+type]')
      .equals([accountId, this.toAccountRelationType(type)])
      .toArray()

    return relations.filter((relation) => this.relationMatchesContext(relation, platformId)).length
  }

  private intersectSets(left: Set<string>, right: Set<string>): Set<string> {
    const result = new Set<string>()
    for (const value of left) {
      if (right.has(value)) {
        result.add(value)
      }
    }
    return result
  }

  private normalizeCount(count: number): number {
    if (count <= 0) {
      return 0
    }
    return Math.min(1, count / 5)
  }

  private calculateRecencyBoost(createdAt: number): number {
    const ageDays = (Date.now() - createdAt) / (24 * 60 * 60 * 1000)
    return Math.max(0, Math.min(1, 1 - ageDays / 30))
  }

  private async emitStatsUpdatedForPair(
    fromAccount: PlatformAccount,
    toAccount: PlatformAccount
  ): Promise<void> {
    await Promise.all([
      this.emitStatsUpdated(fromAccount.id, fromAccount.platformId),
      this.emitStatsUpdated(toAccount.id, toAccount.platformId),
    ])
  }

  private async emitStatsUpdated(accountId: string, platformId: string): Promise<void> {
    const stats = await this.getRelationshipStats(accountId, platformId)
    this.emitEvent({
      type: 'social:stats:updated',
      accountId,
      platformId,
      timestamp: Date.now(),
      payload: {
        stats,
      },
    })
  }

  private emitEvent(event: SocialGraphEvent): void {
    eventBus.emit(event.type, event)

    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        writeLogger.error('relation listener failed', error)
      }
    })
  }

  private toAccountRelationType(type: SocialGraphRelationType): RelationType {
    return type
  }
}

let socialGraphServiceInstance: SocialGraphService | null = null

export function getSocialGraphService(): SocialGraphService {
  if (!socialGraphServiceInstance) {
    socialGraphServiceInstance = new SocialGraphService()
  }
  return socialGraphServiceInstance
}

export function resetSocialGraphService(): void {
  socialGraphServiceInstance = null
}
