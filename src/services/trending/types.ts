import type { TrendingTopic, UniversalPost, WorldEvent } from '@/types/social';

export interface TrendingConfig {
  maxItems: number;
  categories: string[];
  refreshInterval: number;
  hotThreshold: number;
  allowSponsored: boolean;
  decayHalfLifeHours?: number;
  platformRules?: Record<string, unknown>;
}

export interface SharePolicy {
  enabled: boolean;
  allowedConsumers: string[];
  excludeCategories?: string[];
}

export interface TrendingQueryOptions {
  limit?: number;
  category?: string;
  includeSponsored?: boolean;
  timeRangeHours?: number;
}

export interface SharedTrendingOptions {
  limit?: number;
  excludeCategories?: string[];
}

export interface CreateOptions {
  platformIds?: string[];
  categories?: string[];
  baseScore?: number;
}

export type TrendingUpdateType = 'topic_created' | 'ranking_updated' | 'policy_changed';

export interface TrendingUpdateEvent {
  type: TrendingUpdateType;
  platformId?: string;
  topicIds?: string[];
  policy?: SharePolicy;
  timestamp: number;
}

export interface ITrendingService {
  createFromEvent(event: WorldEvent, options?: CreateOptions): Promise<TrendingTopic[]>;
  upsertTopics(topics: TrendingTopic[]): Promise<void>;
  archiveTopic(topicId: string): Promise<void>;
  getTrending(platformId: string, options?: TrendingQueryOptions): Promise<TrendingTopic[]>;
  getTopic(topicId: string): Promise<TrendingTopic | undefined>;
  ensureTopicContent(topicId: string): Promise<UniversalPost[]>;
  preloadTopicContent(topicIds: string[]): Promise<void>;
  registerPlatformConfig(platformId: string, config: TrendingConfig): void;
  getPlatformConfig(platformId: string): TrendingConfig;
  setSharePolicy(platformId: string, policy: SharePolicy): void;
  getSharedTrending(requesterAppId: string, options?: SharedTrendingOptions): Promise<TrendingTopic[]>;
  onTrendingUpdate(callback: (event: TrendingUpdateEvent) => void): () => void;
}
