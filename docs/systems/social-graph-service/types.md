# Social Graph Service 类型定义

> **版本**: v1.0  
> **最后更新**: 2026-02-07

本文档定义 Social Graph Service 的核心 TypeScript 类型。

## 1. 核心关系模型

```typescript
export type RelationType = 'follow' | 'block' | 'mute';

export type RelationStatus = 'active' | 'inactive';

export type RelationScope = 'platform' | 'global';

export interface SocialRelation {
  id: string;
  fromId: string;
  toId: string;
  platformId: string;
  type: RelationType;
  status: RelationStatus;
  scope: RelationScope;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}
```

## 2. 查询类型

```typescript
export interface RelationQueryOptions {
  platformId?: string;
  type?: RelationType;
  limit?: number;
  offset?: number;
  cursor?: string;
  includeInactive?: boolean;
}

export interface GraphAccountNode {
  accountId: string;
  platformId: string;
  score?: number;
  reason?: string;
}

export interface RelationPageResult {
  items: GraphAccountNode[];
  hasMore: boolean;
  nextCursor?: string;
  total?: number;
}
```

## 3. 统计与推荐类型

```typescript
export interface RelationshipStats {
  accountId: string;
  platformId: string;
  followers: number;
  following: number;
  mutualFollows: number;
  blocks: number;
  mutes: number;
  updatedAt: number;
}

export type RecommendationReasonType =
  | 'mutual_follow'
  | 'mutual_follower'
  | 'interaction_similarity'
  | 'same_topic_interest'
  | 'platform_boost';

export interface RecommendationReason {
  type: RecommendationReasonType;
  description: string;
  relatedIds?: string[];
}

export interface FollowRecommendation {
  accountId: string;
  platformId: string;
  score: number;
  reasons: RecommendationReason[];
}

export interface RecommendationOptions {
  platformId: string;
  limit?: number;
  minScore?: number;
  excludeIds?: string[];
}
```

## 4. 写操作类型

```typescript
export interface FollowOptions {
  platformId: string;
  metadata?: Record<string, unknown>;
}

export interface BlockOptions {
  platformId?: string;
  scope?: RelationScope;
  autoUnfollow?: boolean;
  reason?: string;
}

export interface MuteOptions {
  platformId?: string;
  scope?: RelationScope;
  durationMs?: number;
  reason?: string;
}

export interface BatchFollowOptions {
  platformId: string;
  stopOnError?: boolean;
  deduplicate?: boolean;
}

export interface BatchFollowResult {
  successIds: string[];
  failed: Array<{ toId: string; error: string }>;
}
```

## 5. 事件类型

```typescript
export type SocialRelationEventType =
  | 'social:relation:followed'
  | 'social:relation:unfollowed'
  | 'social:relation:blocked'
  | 'social:relation:unblocked'
  | 'social:relation:muted'
  | 'social:relation:unmuted'
  | 'social:stats:updated';

export interface SocialRelationEvent {
  type: SocialRelationEventType;
  fromId?: string;
  toId?: string;
  accountId?: string;
  platformId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}
```

## 6. 服务接口

```typescript
export interface ISocialGraphService {
  follow(fromId: string, toId: string, options: FollowOptions): Promise<void>;
  unfollow(fromId: string, toId: string, platformId: string): Promise<void>;

  block(fromId: string, toId: string, options?: BlockOptions): Promise<void>;
  unblock(fromId: string, toId: string, options?: BlockOptions): Promise<void>;

  mute(fromId: string, toId: string, options?: MuteOptions): Promise<void>;
  unmute(fromId: string, toId: string, options?: MuteOptions): Promise<void>;

  getFollowers(accountId: string, options?: RelationQueryOptions): Promise<RelationPageResult>;
  getFollowing(accountId: string, options?: RelationQueryOptions): Promise<RelationPageResult>;
  getMutualFollows(accountId: string, options?: RelationQueryOptions): Promise<GraphAccountNode[]>;

  isFollowing(fromId: string, toId: string, platformId: string): Promise<boolean>;
  isBlocked(fromId: string, toId: string, platformId?: string): Promise<boolean>;
  isMuted(fromId: string, toId: string, platformId?: string): Promise<boolean>;

  getRelationshipStats(accountId: string, platformId: string): Promise<RelationshipStats>;

  getRecommendedFollows(accountId: string, options: RecommendationOptions): Promise<FollowRecommendation[]>;
  batchFollow(fromId: string, toIds: string[], options: BatchFollowOptions): Promise<BatchFollowResult>;

  onRelationChange(callback: (event: SocialRelationEvent) => void): () => void;
}
```

## 7. 错误码建议

```typescript
export type SocialGraphErrorCode =
  | 'SELF_FOLLOW_NOT_ALLOWED'
  | 'ALREADY_FOLLOWING'
  | 'RELATION_BLOCKED'
  | 'ACCOUNT_NOT_FOUND'
  | 'INVALID_PLATFORM'
  | 'BATCH_PARTIAL_FAILED';
```
