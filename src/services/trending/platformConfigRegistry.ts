import type { TrendingConfig } from './types';

const DEFAULT_CONFIG: TrendingConfig = {
  maxItems: 20,
  categories: ['general'],
  refreshInterval: 5 * 60 * 1000,
  hotThreshold: 10000,
  allowSponsored: false,
  decayHalfLifeHours: 24,
};

const BUILTIN_CONFIGS: Record<string, Partial<TrendingConfig>> = {
  weibo: {
    maxItems: 50,
    categories: ['entertainment', 'society', 'tech', 'sports', 'general'],
    refreshInterval: 5 * 60 * 1000,
    hotThreshold: 10000,
    allowSponsored: true,
  },
  bilibili: {
    maxItems: 10,
    categories: ['anime', 'game', 'life', 'tech', 'general'],
    refreshInterval: 10 * 60 * 1000,
    hotThreshold: 8000,
    allowSponsored: false,
  },
  zhihu: {
    maxItems: 20,
    categories: ['tech', 'life', 'general'],
    refreshInterval: 10 * 60 * 1000,
    hotThreshold: 9000,
    allowSponsored: false,
  },
};

export class PlatformConfigRegistry {
  private readonly configs = new Map<string, TrendingConfig>();

  constructor() {
    for (const [platformId, config] of Object.entries(BUILTIN_CONFIGS)) {
      this.register(platformId, { ...DEFAULT_CONFIG, ...config });
    }
  }

  register(platformId: string, config: TrendingConfig): void {
    this.configs.set(platformId, { ...DEFAULT_CONFIG, ...config });
  }

  get(platformId: string): TrendingConfig {
    return this.configs.get(platformId) ?? DEFAULT_CONFIG;
  }

  has(platformId: string): boolean {
    return this.configs.has(platformId);
  }

  listPlatformIds(): string[] {
    return Array.from(this.configs.keys());
  }

  getAll(): Map<string, TrendingConfig> {
    return new Map(this.configs);
  }

  reset(): void {
    this.configs.clear();
    for (const [platformId, config] of Object.entries(BUILTIN_CONFIGS)) {
      this.register(platformId, { ...DEFAULT_CONFIG, ...config });
    }
  }
}
