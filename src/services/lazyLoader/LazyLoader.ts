/**
 * LazyLoader 核心实现
 * 通用的惰性加载框架
 */

import type {
  LazyLoader as ILazyLoader,
  LazyLoaderOptions,
  LazyLoaderStats,
  CacheOptions,
} from './types';
import { LRUCache, FIFOCache } from './LRUCache';
import { ConcurrencyLimiter } from './ConcurrencyLimiter';
import { RequestDeduplicator } from './RequestDeduplicator';

/**
 * 默认缓存配置
 */
const DEFAULT_CACHE_OPTIONS: Required<CacheOptions> = {
  maxSize: 1000,
  ttl: 0,
  strategy: 'lru',
  autoCleanup: true,
  cleanupInterval: 60000,
};

/**
 * LazyLoader 实现类
 */
export class LazyLoader<T> implements ILazyLoader<T> {
  private cache: LRUCache<T> | FIFOCache<T>;
  private limiter: ConcurrencyLimiter;
  private deduplicator: RequestDeduplicator<T>;
  private options: LazyLoaderOptions<T>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private failedKeys = new Set<string>();

  // 统计信息
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(options: LazyLoaderOptions<T>) {
    this.options = options;

    // 初始化缓存
    const cacheOptions = { ...DEFAULT_CACHE_OPTIONS, ...options.cache };
    if (cacheOptions.strategy === 'fifo') {
      this.cache = new FIFOCache<T>(cacheOptions.maxSize, cacheOptions.ttl);
    } else {
      this.cache = new LRUCache<T>(cacheOptions.maxSize, cacheOptions.ttl);
    }

    // 初始化并发控制器
    this.limiter = new ConcurrencyLimiter(options.concurrency ?? 5);

    // 初始化请求去重器
    this.deduplicator = new RequestDeduplicator<T>();

    // 设置自动清理
    if (cacheOptions.autoCleanup && cacheOptions.ttl > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, cacheOptions.cleanupInterval);
    }
  }

  /**
   * 获取单个 key 对应的数据
   */
  async get(key: string): Promise<T | undefined> {
    // 检查缓存
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.stats.hits++;
      this.options.onCacheHit?.(key);
      return cached;
    }

    // 检查是否是已知的失败 key
    if (this.options.cacheFailures && this.failedKeys.has(key)) {
      return undefined;
    }

    this.stats.misses++;

    // 是否启用去重
    if (this.options.deduplication !== false) {
      return this.deduplicator.dedupe(key, () => this.load(key));
    }

    return this.load(key);
  }

  /**
   * 批量获取多个 key 的数据
   */
  async getMany(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const missingKeys: string[] = [];

    // 检查缓存
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached !== undefined) {
        this.stats.hits++;
        this.options.onCacheHit?.(key);
        result.set(key, cached);
      } else if (!this.options.cacheFailures || !this.failedKeys.has(key)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length === 0) {
      return result;
    }

    this.stats.misses += missingKeys.length;

    // 如果有批量加载函数，使用它
    if (this.options.batchLoader) {
      try {
        const loaded = await this.limiter.run(() =>
          this.options.batchLoader!(missingKeys)
        );

        for (const [key, value] of loaded) {
          this.cache.set(key, value);
          result.set(key, value);
        }
      } catch (error) {
        // 批量加载失败，回退到单个加载
        for (const key of missingKeys) {
          try {
            const value = await this.get(key);
            if (value !== undefined) {
              result.set(key, value);
            }
          } catch {
            // 忽略单个失败
          }
        }
      }
    } else {
      // 并行加载所有缺失的 key
      const loadPromises = missingKeys.map(async (key) => {
        try {
          const value = await this.get(key);
          if (value !== undefined) {
            result.set(key, value);
          }
        } catch {
          // 忽略单个失败
        }
      });

      await Promise.all(loadPromises);
    }

    return result;
  }

  /**
   * 检查 key 是否已加载（且未过期）
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 检查 key 是否正在加载中
   */
  isLoading(key: string): boolean {
    return this.deduplicator.isPending(key);
  }

  /**
   * 获取缓存中的数据（不触发加载）
   */
  peek(key: string): T | undefined {
    return this.cache.peek(key);
  }

  /**
   * 后台预加载指定 keys
   */
  async preload(keys: string[]): Promise<void> {
    const missingKeys = keys.filter((key) => !this.cache.has(key));

    if (missingKeys.length === 0) return;

    // 低优先级加载，不阻塞
    const loadPromises = missingKeys.map(async (key) => {
      try {
        await this.get(key);
      } catch {
        // 预加载失败不抛出错误
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * 预热缓存（手动设置缓存值）
   */
  prime(key: string, value: T): void {
    this.cache.set(key, value);
    // 如果之前标记为失败，移除标记
    this.failedKeys.delete(key);
  }

  /**
   * 使单个 key 的缓存失效
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.failedKeys.delete(key);
  }

  /**
   * 使所有缓存失效
   */
  invalidateAll(): void {
    this.cache.clear();
    this.failedKeys.clear();
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    this.cache.cleanup();
  }

  /**
   * 获取缓存统计
   */
  getStats(): LazyLoaderStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      pendingCount: this.deduplicator.pendingCount,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * 销毁加载器，清理资源
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
    this.deduplicator.clear();
    this.limiter.clear();
    this.failedKeys.clear();
  }

  /**
   * 内部加载方法
   */
  private async load(key: string): Promise<T | undefined> {
    this.options.onLoadStart?.(key);

    let lastError: Error | undefined;
    const retryCount = this.options.retryCount ?? 0;
    const retryDelay = this.options.retryDelay ?? 1000;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const value = await this.limiter.run(() => this.options.loader(key));

        // 缓存结果
        this.cache.set(key, value);
        this.options.onLoadEnd?.(key, value);

        return value;
      } catch (error) {
        lastError = error as Error;

        // 如果还有重试机会，等待后重试
        if (attempt < retryCount) {
          await this.delay(retryDelay);
        }
      }
    }

    // 所有重试都失败了
    this.options.onError?.(key, lastError!);
    this.options.onLoadEnd?.(key, undefined, lastError);

    // 如果配置了缓存失败，标记此 key
    if (this.options.cacheFailures) {
      this.failedKeys.add(key);
    }

    return undefined;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
