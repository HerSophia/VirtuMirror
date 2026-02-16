export type SocialGraphRelationType = 'follow' | 'block' | 'mute'

export type SocialGraphRelationStatus = 'active' | 'inactive'

export type SocialGraphRelationScope = 'platform' | 'global'

export interface SocialGraphRelation {
  id: string
  fromId: string
  toId: string
  platformId: string
  type: SocialGraphRelationType
  status: SocialGraphRelationStatus
  scope: SocialGraphRelationScope
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export interface SocialGraphQueryOptions {
  platformId?: string
  type?: SocialGraphRelationType
  limit?: number
  offset?: number
  cursor?: string
  includeInactive?: boolean
}

export interface GraphAccountNode {
  accountId: string
  platformId: string
  score?: number
  reason?: string
}

export interface SocialGraphPageResult {
  items: GraphAccountNode[]
  hasMore: boolean
  nextCursor?: string
  total?: number
}

export interface RelationshipStats {
  accountId: string
  platformId: string
  followers: number
  following: number
  mutualFollows: number
  blocks: number
  mutes: number
  updatedAt: number
}

export type RecommendationReasonType =
  | 'mutual_follow'
  | 'mutual_follower'
  | 'interaction_similarity'
  | 'same_topic_interest'
  | 'platform_boost'

export interface RecommendationReason {
  type: RecommendationReasonType
  description: string
  relatedIds?: string[]
}

export interface FollowRecommendation {
  accountId: string
  platformId: string
  score: number
  reasons: RecommendationReason[]
}

export interface RecommendationOptions {
  platformId: string
  limit?: number
  minScore?: number
  excludeIds?: string[]
}

export interface FollowOptions {
  platformId: string
  metadata?: Record<string, unknown>
}

export interface BlockOptions {
  platformId?: string
  scope?: SocialGraphRelationScope
  autoUnfollow?: boolean
  reason?: string
}

export interface MuteOptions {
  platformId?: string
  scope?: SocialGraphRelationScope
  durationMs?: number
  reason?: string
}

export interface BatchFollowOptions {
  platformId: string
  stopOnError?: boolean
  deduplicate?: boolean
}

export interface BatchFollowResult {
  successIds: string[]
  failed: Array<{ toId: string; error: string }>
}

export type SocialGraphEventType =
  | 'social:relation:followed'
  | 'social:relation:unfollowed'
  | 'social:relation:blocked'
  | 'social:relation:unblocked'
  | 'social:relation:muted'
  | 'social:relation:unmuted'
  | 'social:stats:updated'

export interface SocialGraphEvent {
  type: SocialGraphEventType
  fromId?: string
  toId?: string
  accountId?: string
  platformId?: string
  timestamp: number
  payload?: Record<string, unknown>
}

export type SocialGraphErrorCode =
  | 'SELF_FOLLOW_NOT_ALLOWED'
  | 'ALREADY_FOLLOWING'
  | 'RELATION_BLOCKED'
  | 'ACCOUNT_NOT_FOUND'
  | 'INVALID_PLATFORM'
  | 'BATCH_PARTIAL_FAILED'

export interface ISocialGraphService {
  follow(fromId: string, toId: string, options: FollowOptions): Promise<void>
  unfollow(fromId: string, toId: string, platformId: string): Promise<void>

  block(fromId: string, toId: string, options?: BlockOptions): Promise<void>
  unblock(fromId: string, toId: string, options?: BlockOptions): Promise<void>

  mute(fromId: string, toId: string, options?: MuteOptions): Promise<void>
  unmute(fromId: string, toId: string, options?: MuteOptions): Promise<void>

  getFollowers(accountId: string, options?: SocialGraphQueryOptions): Promise<SocialGraphPageResult>
  getFollowing(accountId: string, options?: SocialGraphQueryOptions): Promise<SocialGraphPageResult>
  getMutualFollows(accountId: string, options?: SocialGraphQueryOptions): Promise<GraphAccountNode[]>

  isFollowing(fromId: string, toId: string, platformId: string): Promise<boolean>
  isBlocked(fromId: string, toId: string, platformId?: string): Promise<boolean>
  isMuted(fromId: string, toId: string, platformId?: string): Promise<boolean>

  getRelationshipStats(accountId: string, platformId: string): Promise<RelationshipStats>

  getRecommendedFollows(accountId: string, options: RecommendationOptions): Promise<FollowRecommendation[]>
  batchFollow(fromId: string, toIds: string[], options: BatchFollowOptions): Promise<BatchFollowResult>

  onRelationChange(callback: (event: SocialGraphEvent) => void): () => void
}
