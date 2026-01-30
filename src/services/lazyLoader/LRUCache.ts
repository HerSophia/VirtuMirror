/**
 * LRU 缓存实现
 */

import type { CacheEntry } from './types';

/**
 * LRU (Least Recently Used) 缓存
 * 当缓存满时，淘汰最近最少使用的条目
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttl: number = 0) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新访问时间
    entry.accessedAt = Date.now();
    entry.accessCount++;

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T): void {
    // 如果 key 已存在，更新值
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.accessedAt = Date.now();
      entry.accessCount++;
      return;
    }

    // 检查是否需要淘汰
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      createdAt: now,
      accessedAt: now,
      accessCount: 1,
    });
  }

  /**
   * 检查 key 是否存在（且未过期）
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 查看缓存值（不更新访问时间）
   */
  peek(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * 删除缓存条目
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    if (this.ttl === 0) return 0;

    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 获取所有 keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (this.ttl === 0) return false;
    return Date.now() - entry.createdAt > this.ttl;
  }

  /**
   * 淘汰最近最少使用的条目
   */
  private evict(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldest = key;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }
}

/**
 * FIFO (First In First Out) 缓存
 * 当缓存满时，淘汰最早添加的条目
 */
export class FIFOCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttl: number = 0) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    entry.accessCount++;
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.accessCount++;
      return;
    }

    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      createdAt: now,
      accessedAt: now,
      accessCount: 1,
    });
  }

  /**
   * 检查 key 是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 查看缓存值
   */
  peek(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * 删除缓存条目
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    if (this.ttl === 0) return 0;

    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 获取所有 keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    if (this.ttl === 0) return false;
    return Date.now() - entry.createdAt > this.ttl;
  }

  /**
   * 淘汰最早添加的条目
   */
  private evict(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldest = key;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }
}
