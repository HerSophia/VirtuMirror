import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/database';
import { PlatformRegistry } from '@/services/social/registry';
import { TrafficEngine } from '@/services/social/algorithm';
import { topicContentLoader } from '@/services/social/topicContentLoader';
import type { TrendingCategory, TrendingTopic, UniversalPost, WorldEvent } from '@/types/social';
import { PlatformConfigRegistry } from './platformConfigRegistry';
import { SharePolicyManager } from './sharePolicyManager';
import { TrendingEventBridge } from './eventBridge';
import type {
  CreateOptions,
  ITrendingService,
  SharePolicy,
  SharedTrendingOptions,
  TrendingConfig,
  TrendingQueryOptions,
  TrendingUpdateEvent,
} from './types';

function normalizeTopicKeyword(topic: string): string {
  if (topic.startsWith('#') && topic.endsWith('#')) {
    return topic;
  }

  const trimmed = topic.replace(/^#+|#+$/g, '');
  return `#${trimmed}#`;
}

function resolveBaseScore(event: WorldEvent, options?: CreateOptions): number {
  if (typeof options?.baseScore === 'number') {
    return options.baseScore;
  }

  if (event.priority === 'breaking') {
    return 90;
  }
  if (event.priority === 'normal') {
    return 60;
  }
  return 30;
}

function normalizeTrendingCategory(category: string): TrendingCategory | undefined {
  switch (category) {
    case 'general':
    case 'entertainment':
    case 'game':
    case 'tech':
    case 'politics':
    case 'life':
    case 'sports':
      return category;
    case 'society':
    case 'social':
      return 'life';
    case 'anime':
      return 'entertainment';
    default:
      return undefined;
  }
}

function normalizeTrendingCategories(categories: string[] | undefined): TrendingCategory[] {
  if (!categories || categories.length === 0) {
    return ['general'];
  }

  const normalized = categories
    .map((category) => normalizeTrendingCategory(category))
    .filter((category): category is TrendingCategory => Boolean(category));

  if (normalized.length === 0) {
    return ['general'];
  }

  return Array.from(new Set(normalized));
}

function isSponsoredTopic(topic: TrendingTopic): boolean {
  const metadata = topic as TrendingTopic & { platformData?: Record<string, unknown> };
  if (metadata.platformData?.sponsored === true) {
    return true;
  }

  return topic.keyword.includes('广告') || topic.summary.includes('广告');
}

export class TrendingService implements ITrendingService {
  private readonly configRegistry = new PlatformConfigRegistry();
  private readonly sharePolicyManager = new SharePolicyManager();
  private readonly eventBridge = new TrendingEventBridge();

  constructor() {
    this.ensureBuiltinPlatformConfigs();
  }

  async createFromEvent(event: WorldEvent, options: CreateOptions = {}): Promise<TrendingTopic[]> {
    const platformIds =
      options.platformIds && options.platformIds.length > 0
        ? options.platformIds
        : event.affectedPlatforms.length > 0
          ? event.affectedPlatforms
          : PlatformRegistry.getInstance()
              .getAllPlatforms()
              .map((platform) => platform.id);

    const categories = normalizeTrendingCategories(
      options.categories && options.categories.length > 0
        ? options.categories
        : (event.metadata?.categories as string[] | undefined)
    );

    const baseScore = resolveBaseScore(event, options);
    const now = Date.now();
    const topics: TrendingTopic[] = platformIds.map((platformId) => ({
      id: uuidv4(),
      platformId,
      keyword: normalizeTopicKeyword(event.topic),
      summary: event.summary,
      categories,
      isNew: true,
      isHot: event.priority === 'breaking',
      baseScore,
      velocity: 0,
      createdAt: now,
      peakTime: now + 1000 * 60 * 60 * (4 + Math.random() * 20),
    }));

    if (topics.length === 0) {
      return [];
    }

    await db.socialTopics.bulkAdd(topics);

    const grouped = new Map<string, string[]>();
    for (const topic of topics) {
      const key = topic.platformId ?? 'global';
      const existing = grouped.get(key) ?? [];
      existing.push(topic.id);
      grouped.set(key, existing);
    }

    for (const [platformId, topicIds] of grouped) {
      this.eventBridge.publish({
        type: 'topic_created',
        platformId,
        topicIds,
        timestamp: Date.now(),
      });
    }

    return topics;
  }

  async upsertTopics(topics: TrendingTopic[]): Promise<void> {
    if (topics.length === 0) {
      return;
    }

    await db.socialTopics.bulkPut(topics);
  }

  async archiveTopic(topicId: string): Promise<void> {
    await db.socialTopics.delete(topicId);
  }

  async getTrending(platformId: string, options: TrendingQueryOptions = {}): Promise<TrendingTopic[]> {
    const config = this.getPlatformConfig(platformId);
    const limit = options.limit ?? config.maxItems;
    const now = Date.now();
    const timeRangeHours = options.timeRangeHours ?? 72;
    const earliest = now - timeRangeHours * 60 * 60 * 1000;

    const allTopics = await db.socialTopics.toArray();
    let topics = allTopics.filter((topic) => topic.platformId === platformId && topic.createdAt >= earliest);

    const normalizedCategory = options.category ? normalizeTrendingCategory(options.category) : undefined;
    if (options.category) {
      topics = normalizedCategory
        ? topics.filter((topic) => topic.categories.includes(normalizedCategory))
        : [];
    }

    if (!options.includeSponsored) {
      topics = topics.filter((topic) => !isSponsoredTopic(topic));
    }

    const ranked = topics
      .map((topic) => {
        const heat = TrafficEngine.calculateTopicHeat(topic, now);
        return { topic, heat };
      })
      .sort((a, b) => b.heat - a.heat)
      .slice(0, limit)
      .map(({ topic, heat }, index) => ({
        ...topic,
        currentHeat: heat,
        isHot: index < 3 && heat >= config.hotThreshold,
        isNew: now - topic.createdAt < 60 * 60 * 1000,
      }));

    this.eventBridge.publish({
      type: 'ranking_updated',
      platformId,
      topicIds: ranked.map((topic) => topic.id),
      timestamp: now,
    });

    return ranked;
  }

  async getTopic(topicId: string): Promise<TrendingTopic | undefined> {
    return db.socialTopics.get(topicId);
  }

  async ensureTopicContent(topicId: string): Promise<UniversalPost[]> {
    const result = await topicContentLoader.get(topicId);
    return result?.posts ?? [];
  }

  async preloadTopicContent(topicIds: string[]): Promise<void> {
    await topicContentLoader.preload(topicIds);
  }

  registerPlatformConfig(platformId: string, config: TrendingConfig): void {
    this.configRegistry.register(platformId, config);
  }

  getPlatformConfig(platformId: string): TrendingConfig {
    return this.configRegistry.get(platformId);
  }

  setSharePolicy(platformId: string, policy: SharePolicy): void {
    this.sharePolicyManager.setPolicy(platformId, policy);
    this.eventBridge.publish({
      type: 'policy_changed',
      platformId,
      policy,
      timestamp: Date.now(),
    });
  }

  async getSharedTrending(
    requesterAppId: string,
    options: SharedTrendingOptions = {}
  ): Promise<TrendingTopic[]> {
    const platformIds = this.configRegistry.listPlatformIds();
    const excludeCategories = new Set(options.excludeCategories ?? []);
    const merged: TrendingTopic[] = [];

    for (const platformId of platformIds) {
      if (!this.sharePolicyManager.canAccess(platformId, requesterAppId)) {
        continue;
      }

      const policy = this.sharePolicyManager.getPolicy(platformId);
      for (const category of policy.excludeCategories ?? []) {
        excludeCategories.add(category);
      }

      const topics = await this.getTrending(platformId, {
        limit: this.getPlatformConfig(platformId).maxItems,
      });

      const visibleTopics = topics.filter(
        (topic) => !topic.categories.some((category) => excludeCategories.has(category))
      );
      merged.push(...visibleTopics);
    }

    const limit = options.limit ?? 20;
    return merged
      .sort((a, b) => (b.currentHeat ?? 0) - (a.currentHeat ?? 0))
      .slice(0, limit);
  }

  onTrendingUpdate(callback: (event: TrendingUpdateEvent) => void): () => void {
    return this.eventBridge.subscribe(callback);
  }

  async createTopicFromEvent(event: WorldEvent): Promise<TrendingTopic[]> {
    return this.createFromEvent(event);
  }

  async getTrendingList(platformId: string, limit: number = 20): Promise<TrendingTopic[]> {
    return this.getTrending(platformId, { limit });
  }

  async getTopicContent(topicId: string) {
    return topicContentLoader.get(topicId);
  }

  async preloadTopics(topicIds: string[]): Promise<void> {
    return this.preloadTopicContent(topicIds);
  }

  hasTopicContent(topicId: string): boolean {
    return topicContentLoader.has(topicId);
  }

  invalidateTopicContent(topicId: string): void {
    topicContentLoader.invalidate(topicId);
  }

  getLoaderStats() {
    return topicContentLoader.getStats();
  }

  private ensureBuiltinPlatformConfigs(): void {
    const platforms = PlatformRegistry.getInstance().getAllPlatforms();
    for (const platform of platforms) {
      if (this.configRegistry.has(platform.id)) {
        continue;
      }

      this.configRegistry.register(platform.id, {
        maxItems: 20,
        categories: ['general'],
        refreshInterval: 5 * 60 * 1000,
        hotThreshold: 10000,
        allowSponsored: false,
      });
    }
  }
}

let trendingServiceInstance: TrendingService | null = null;

export function getTrendingService(): TrendingService {
  if (!trendingServiceInstance) {
    trendingServiceInstance = new TrendingService();
  }
  return trendingServiceInstance;
}

export function resetTrendingService(): void {
  trendingServiceInstance = null;
}
