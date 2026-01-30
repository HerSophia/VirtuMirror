/**
 * 信息流缓存
 * 基于 LRU 缓存实现
 */

import type {
  FeedItem,
  FeedType,
  FeedOptions,
  FeedCacheConfig,
  FeedCacheStats,
} from '@/types/feed';
import { LRUCache } from '@/services/lazyLoader';

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: FeedCacheConfig = {
  maxEntries: 100,
  defaultTTL: 5 * 60 * 1000, // 5 分钟
  ttlOverrides: {
    home: 5 * 60 * 1000, // 首页 5 分钟
    following: 3 * 60 * 1000, // 关注流 3 分钟
    trending: 10 * 60 * 1000, // 热门 10 分钟
    discover: 15 * 60 * 1000, // 发现页 15 分钟
    topic: 10 * 60 * 1000, // 话题 10 分钟
    category: 10 * 60 * 1000, // 分类 10 分钟
  },
};

/**
 * 缓存条目
 */
interface CacheEntry {
  items: FeedItem[];
  createdAt: number;
  expiresAt: number;
}

/**
 * 信息流缓存类
 */
export class FeedCache {
  private cache: LRUCache<CacheEntry>;
  private config: FeedCacheConfig;
  private stats: {
    hits: number;
    misses: number;
  };

  constructor(config: Partial<FeedCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cache = new LRUCache<CacheEntry>(
      this.config.maxEntries,
      this.config.defaultTTL
    );
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 生成缓存键
   */
  generateKey(
    userId: string,
    platformId: string,
    feedType: FeedType,
    options?: FeedOptions
  ): string {
    const parts = [userId, platformId, feedType];
    
    if (options?.offset) {
      parts.push(`offset:${options.offset}`);
    }
    if (options?.limit) {
      parts.push(`limit:${options.limit}`);
    }
    if (options?.cursor) {
      parts.push(`cursor:${options.cursor}`);
    }
    
    return parts.join(':');
  }

  /**
   * 获取缓存
   */
  get(key: string): FeedItem[] | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.items;
  }

  /**
   * 设置缓存
   */
  set(
    key: string,
    items: FeedItem[],
    feedType?: FeedType
  ): void {
    let ttl = this.config.defaultTTL;
    if (feedType && this.config.ttlOverrides?.[feedType]) {
      ttl = this.config.ttlOverrides[feedType]!;
    }

    const now = Date.now();
    const entry: CacheEntry = {
      items,
      createdAt: now,
      expiresAt: now + ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 使缓存失效
   */
  invalidate(keyPattern: string): void {
    // LRUCache 不直接支持模式匹配，需要遍历
    // 这里简化处理，直接删除匹配的键
    const keysToDelete: string[] = [];
    
    // 由于 LRUCache 可能不暴露遍历接口，我们使用 delete
    // 如果需要模式匹配，可以维护一个键的列表
    this.cache.delete(keyPattern);
  }

  /**
   * 使用户的所有缓存失效
   */
  invalidateUser(userId: string, platformId?: string): void {
    // 清除所有缓存（简化实现）
    // 完整实现需要维护键的索引
    this.cache.clear();
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 获取缓存统计
   */
  getStats(): FeedCacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 预热缓存
   */
  prime(key: string, items: FeedItem[], feedType?: FeedType): void {
    this.set(key, items, feedType);
  }

  /**
   * 追加内容到现有缓存
   */
  append(
    key: string,
    newItems: FeedItem[],
    feedType?: FeedType
  ): void {
    const existing = this.get(key);
    if (existing) {
      // 去重合并
      const existingIds = new Set(existing.map(item => item.id));
      const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
      this.set(key, [...existing, ...uniqueNewItems], feedType);
    } else {
      this.set(key, newItems, feedType);
    }
  }

  /**
   * 在缓存头部插入新内容
   */
  prepend(
    key: string,
    newItems: FeedItem[],
    feedType?: FeedType
  ): void {
    const existing = this.get(key);
    if (existing) {
      // 去重合并
      const newIds = new Set(newItems.map(item => item.id));
      const filteredExisting = existing.filter(item => !newIds.has(item.id));
      this.set(key, [...newItems, ...filteredExisting], feedType);
    } else {
      this.set(key, newItems, feedType);
    }
  }
}

/**
 * 默认的缓存实例
 */
export const feedCache = new FeedCache();
