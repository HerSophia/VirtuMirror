/**
 * Lazy Loader 服务
 *
 * 通用的惰性加载框架，用于实现「按需加载」的内容生成策略。
 *
 * @example
 * ```typescript
 * import { createLazyLoader } from '@/services/lazyLoader';
 *
 * // 创建加载器
 * const postLoader = createLazyLoader<Post[]>({
 *   loader: async (topicId) => {
 *     return await generatePostsForTopic(topicId);
 *   },
 *   cache: {
 *     maxSize: 50,
 *     ttl: 30 * 60 * 1000, // 30 分钟
 *   },
 *   concurrency: 3,
 * });
 *
 * // 使用加载器
 * const posts = await postLoader.get('topic-123');
 *
 * // 批量加载
 * const allPosts = await postLoader.getMany(['topic-1', 'topic-2', 'topic-3']);
 *
 * // 预加载
 * postLoader.preload(['topic-4', 'topic-5']);
 *
 * // 预热缓存
 * postLoader.prime('topic-6', existingPosts);
 *
 * // 查看统计
 * const stats = postLoader.getStats();
 * console.log(`命中率: ${(stats.hitRate * 100).toFixed(1)}%`);
 * ```
 */

import { LazyLoader } from './LazyLoader';
import type { LazyLoader as ILazyLoader, LazyLoaderOptions, LazyLoaderStats } from './types';

// 导出类型
export type { LazyLoader as ILazyLoader, LazyLoaderOptions, LazyLoaderStats, CacheOptions } from './types';

// 导出内部组件（供高级用户使用）
export { LRUCache, FIFOCache } from './LRUCache';
export { ConcurrencyLimiter } from './ConcurrencyLimiter';
export { RequestDeduplicator } from './RequestDeduplicator';
export { LazyLoader } from './LazyLoader';

/**
 * 创建 LazyLoader 实例
 */
export function createLazyLoader<T>(options: LazyLoaderOptions<T>): ILazyLoader<T> {
  return new LazyLoader<T>(options);
}

/**
 * 创建带命名空间的 LazyLoader
 * - 自动为 key 添加命名空间前缀
 * - 便于管理和调试
 */
export function createNamespacedLoader<T>(
  namespace: string,
  options: LazyLoaderOptions<T>
): ILazyLoader<T> {
  const prefixedLoader = createLazyLoader<T>({
    ...options,
    loader: (key) => options.loader(key.replace(`${namespace}:`, '')),
    batchLoader: options.batchLoader
      ? (keys) =>
          options.batchLoader!(keys.map((k) => k.replace(`${namespace}:`, ''))).then((result) => {
            const prefixed = new Map<string, T>();
            for (const [key, value] of result) {
              prefixed.set(`${namespace}:${key}`, value);
            }
            return prefixed;
          })
      : undefined,
    onLoadStart: options.onLoadStart
      ? (key) => options.onLoadStart!(`[${namespace}] ${key}`)
      : undefined,
    onLoadEnd: options.onLoadEnd
      ? (key, value, error) => options.onLoadEnd!(`[${namespace}] ${key}`, value, error)
      : undefined,
    onCacheHit: options.onCacheHit
      ? (key) => options.onCacheHit!(`[${namespace}] ${key}`)
      : undefined,
    onError: options.onError
      ? (key, error) => options.onError!(`[${namespace}] ${key}`, error)
      : undefined,
  });

  // 包装接口，自动添加命名空间前缀
  return {
    get: (key) => prefixedLoader.get(`${namespace}:${key}`),
    getMany: async (keys) => {
      const prefixedKeys = keys.map((k) => `${namespace}:${k}`);
      const result = await prefixedLoader.getMany(prefixedKeys);
      const unprefixed = new Map<string, T>();
      for (const [key, value] of result) {
        unprefixed.set(key.replace(`${namespace}:`, ''), value);
      }
      return unprefixed;
    },
    has: (key) => prefixedLoader.has(`${namespace}:${key}`),
    isLoading: (key) => prefixedLoader.isLoading(`${namespace}:${key}`),
    peek: (key) => prefixedLoader.peek(`${namespace}:${key}`),
    preload: (keys) => prefixedLoader.preload(keys.map((k) => `${namespace}:${k}`)),
    prime: (key, value) => prefixedLoader.prime(`${namespace}:${key}`, value),
    invalidate: (key) => prefixedLoader.invalidate(`${namespace}:${key}`),
    invalidateAll: () => prefixedLoader.invalidateAll(),
    cleanup: () => prefixedLoader.cleanup(),
    getStats: () => prefixedLoader.getStats(),
    destroy: () => prefixedLoader.destroy(),
  };
}

/**
 * LazyLoader 全局注册表
 * 用于管理和监控所有 LazyLoader 实例
 */
export class LazyLoaderRegistry {
  private static loaders = new Map<string, ILazyLoader<unknown>>();

  /**
   * 注册一个 LazyLoader
   */
  static register<T>(name: string, loader: ILazyLoader<T>): void {
    this.loaders.set(name, loader as ILazyLoader<unknown>);
  }

  /**
   * 获取已注册的 LazyLoader
   */
  static get<T>(name: string): ILazyLoader<T> | undefined {
    return this.loaders.get(name) as ILazyLoader<T> | undefined;
  }

  /**
   * 取消注册
   */
  static unregister(name: string): boolean {
    return this.loaders.delete(name);
  }

  /**
   * 清理所有 LazyLoader 的缓存
   */
  static invalidateAll(): void {
    for (const loader of this.loaders.values()) {
      loader.invalidateAll();
    }
  }

  /**
   * 销毁所有 LazyLoader
   */
  static destroyAll(): void {
    for (const loader of this.loaders.values()) {
      loader.destroy();
    }
    this.loaders.clear();
  }

  /**
   * 获取所有 LazyLoader 的统计信息
   */
  static getAllStats(): Map<string, LazyLoaderStats> {
    const stats = new Map<string, LazyLoaderStats>();
    for (const [name, loader] of this.loaders) {
      stats.set(name, loader.getStats());
    }
    return stats;
  }

  /**
   * 获取所有已注册的 loader 名称
   */
  static getNames(): string[] {
    return Array.from(this.loaders.keys());
  }
}
