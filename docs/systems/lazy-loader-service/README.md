# Lazy Loader 服务

> **版本**: 1.0  
> **状态**: ✅ 核心实现完成  
> **最后更新**: 2025-01-09  
> **文档位置**: `docs/systems/lazy-loader-service/`  
> **代码位置**: `src/services/lazyLoader/`

## 1. 概述

Lazy Loader 服务是一个**高级基础设施**，用于实现「按需加载」的内容生成策略。

> ⚠️ **使用提示**：这是一个高级服务，适用于需要处理**大量异步数据加载**且**加载成本较高**的场景。
> 对于简单的数据获取，直接使用 `async/await` 即可，不需要引入此服务。

### 1.1 什么时候应该使用 Lazy Loader？

**✅ 适合使用的场景：**

| 场景特征 | 说明 |
|---------|------|
| 加载成本高 | 需要调用 LLM API、复杂计算、网络请求等 |
| 数据量大 | 无法预先生成所有内容，需要按需加载 |
| 用户可能不访问 | 内容可能永远不会被用户查看 |
| 需要缓存 | 相同请求应该返回缓存结果 |
| 并发问题 | 需要控制同时进行的加载任务数量 |
| 请求去重 | 相同请求不应重复执行 |

**❌ 不需要使用的场景：**

| 场景 | 替代方案 |
|-----|----------|
| 简单的一次性数据获取 | 直接 `await fetch()` 或 `await db.get()` |
| 已有数据的筛选/转换 | 使用 `computed` 或普通函数 |
| 不需要缓存的请求 | 直接调用 API |
| 加载成本很低 | 无需优化，直接加载 |

### 1.2 核心能力

- **延迟生成**：只有当用户真正需要某些内容时才触发生成
- **自动缓存**：加载结果自动缓存，可配置过期时间
- **并发控制**：控制同时进行的加载任务数量，避免资源争抢
- **请求去重**：相同的加载请求只执行一次，多个调用者共享结果

| 能力         | 说明                             |
| ------------ | -------------------------------- |
| **惰性加载** | 首次访问时触发加载函数           |
| **自动缓存** | 加载结果自动缓存，可配置过期时间 |
| **并发控制** | 限制同时进行的加载任务数         |
| **请求去重** | 相同 key 的并发请求只执行一次    |
| **批量加载** | 支持一次性加载多个 key           |
| **预加载**   | 支持后台预先加载                 |
| **失效机制** | 支持手动使缓存失效               |

### 1.3 实际应用场景

在社交媒体模拟系统中，以下场景使用了 Lazy Loader：

| 场景         | 触发时机         | 生成内容     | 为什么需要 Lazy Loader |
| ------------ | ---------------- | ------------ | ---------------------- |
| 热搜话题内容 | 用户点击热搜话题 | 相关博文列表 | 需要调用 LLM 生成，成本高 |
| 帖子评论区   | 用户展开评论     | 评论内容     | 按需生成，避免预加载 |
| 用户主页     | 访问 NPC 主页    | 历史博文     | 历史内容量大，按需加载 |
| 相似推荐     | 滑到推荐区域     | 相似内容     | 推荐算法开销大 |
| 粉丝列表     | 查看粉丝页       | 粉丝账号     | 动态生成 NPC 资料 |

这些场景的共同特点：

1. 数据量大，不可能预先全部生成
2. 用户可能永远不会访问某些内容
3. 需要调用 LLM，成本较高
4. 生成后可以缓存复用

### 1.2 核心能力

| 能力         | 说明                             |
| ------------ | -------------------------------- |
| **惰性加载** | 首次访问时触发加载函数           |
| **自动缓存** | 加载结果自动缓存，可配置过期时间 |
| **并发控制** | 限制同时进行的加载任务数         |
| **请求去重** | 相同 key 的并发请求只执行一次    |
| **批量加载** | 支持一次性加载多个 key           |
| **预加载**   | 支持后台预先加载                 |
| **失效机制** | 支持手动使缓存失效               |

---

## 2. 接口设计

### 2.1 核心接口

```typescript
/**
 * 惰性加载器接口
 */
export interface LazyLoader<T> {
  // === 获取数据（自动触发加载）===
  
  /**
   * 获取单个 key 对应的数据
   * - 如果缓存中存在且未过期，直接返回
   * - 如果正在加载中，等待加载完成
   * - 否则触发 loader 函数
   */
  get(key: string): Promise<T | undefined>;
  
  /**
   * 批量获取多个 key 的数据
   * - 已缓存的直接返回
   * - 未缓存的触发批量加载（如果配置了 batchLoader）
   */
  getMany(keys: string[]): Promise<Map<string, T>>;
  
  // === 状态检查 ===
  
  /**
   * 检查 key 是否已加载（且未过期）
   */
  has(key: string): boolean;
  
  /**
   * 检查 key 是否正在加载中
   */
  isLoading(key: string): boolean;
  
  /**
   * 获取缓存中的数据（不触发加载）
   */
  peek(key: string): T | undefined;
  
  // === 预加载 ===
  
  /**
   * 后台预加载指定 keys
   * - 不阻塞当前流程
   * - 低优先级执行
   */
  preload(keys: string[]): Promise<void>;
  
  /**
   * 预热缓存（手动设置缓存值）
   */
  prime(key: string, value: T): void;
  
  // === 失效与清理 ===
  
  /**
   * 使单个 key 的缓存失效
   */
  invalidate(key: string): void;
  
  /**
   * 使所有缓存失效
   */
  invalidateAll(): void;
  
  /**
   * 清理过期缓存
   */
  cleanup(): void;
  
  // === 统计信息 ===
  
  /**
   * 获取缓存统计
   */
  getStats(): LazyLoaderStats;
}

/**
 * 缓存统计信息
 */
export interface LazyLoaderStats {
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 当前缓存条目数 */
  size: number;
  /** 正在加载的任务数 */
  pendingCount: number;
  /** 命中率 */
  hitRate: number;
}
```

### 2.2 配置选项

```typescript
/**
 * LazyLoader 配置选项
 */
export interface LazyLoaderOptions<T> {
  // === 加载函数（必选）===
  
  /**
   * 单个 key 的加载函数
   */
  loader: (key: string) => Promise<T>;
  
  /**
   * 批量加载函数（可选）
   * - 如果提供，getMany 会优先使用此函数
   * - 适用于可以合并请求的场景
   */
  batchLoader?: (keys: string[]) => Promise<Map<string, T>>;
  
  // === 缓存策略 ===
  
  cache?: {
    /**
     * 最大缓存条目数
     * @default 1000
     */
    maxSize?: number;
    
    /**
     * 缓存过期时间（毫秒）
     * - 0 表示永不过期
     * @default 0
     */
    ttl?: number;
    
    /**
     * 缓存淘汰策略
     * - lru: 最近最少使用
     * - fifo: 先进先出
     * @default 'lru'
     */
    strategy?: 'lru' | 'fifo';
    
    /**
     * 是否在后台自动清理过期缓存
     * @default true
     */
    autoCleanup?: boolean;
    
    /**
     * 自动清理间隔（毫秒）
     * @default 60000 (1分钟)
     */
    cleanupInterval?: number;
  };
  
  // === 并发控制 ===
  
  /**
   * 最大并发加载数
   * @default 5
   */
  concurrency?: number;
  
  /**
   * 是否去重相同的请求
   * - 如果为 true，相同 key 的并发请求只执行一次 loader
   * @default true
   */
  deduplication?: boolean;
  
  // === 错误处理 ===
  
  /**
   * 加载失败时的重试次数
   * @default 0
   */
  retryCount?: number;
  
  /**
   * 重试延迟（毫秒）
   * @default 1000
   */
  retryDelay?: number;
  
  /**
   * 加载失败时的回调
   */
  onError?: (key: string, error: Error) => void;
  
  /**
   * 是否缓存失败的结果
   * - 如果为 true，失败的 key 会被标记，后续直接返回 undefined
   * - 避免反复重试必定失败的请求
   * @default false
   */
  cacheFailures?: boolean;
  
  // === 生命周期钩子 ===
  
  /**
   * 加载开始前的钩子
   */
  onLoadStart?: (key: string) => void;
  
  /**
   * 加载完成后的钩子
   */
  onLoadEnd?: (key: string, value: T | undefined, error?: Error) => void;
  
  /**
   * 缓存命中时的钩子
   */
  onCacheHit?: (key: string) => void;
}
```

### 2.3 工厂函数

```typescript
/**
 * 创建 LazyLoader 实例
 */
export function createLazyLoader<T>(
  options: LazyLoaderOptions<T>
): LazyLoader<T>;

/**
 * 创建带命名空间的 LazyLoader
 * - 自动为 key 添加命名空间前缀
 * - 便于管理和调试
 */
export function createNamespacedLoader<T>(
  namespace: string,
  options: LazyLoaderOptions<T>
): LazyLoader<T>;
```

---

## 3. 使用示例

### 3.1 基础用法：热搜话题内容

```typescript
import { createLazyLoader } from '@/services/lazyLoader';
import { contentFactory } from '@/services/social/contentFactory';
import type { UniversalPost } from '@/types/social';

// 创建话题内容加载器
const topicPostsLoader = createLazyLoader<UniversalPost[]>({
  // 加载函数：为话题生成博文
  loader: async (topicId) => {
    const topic = await db.socialTopics.get(topicId);
    if (!topic) return [];
    
    const posts = await contentFactory.generatePostsForTopic(topic, 5);
    return posts;
  },
  
  // 缓存配置
  cache: {
    maxSize: 50,           // 最多缓存 50 个话题
    ttl: 30 * 60 * 1000,   // 缓存 30 分钟
    strategy: 'lru',
  },
  
  // 并发控制
  concurrency: 3,          // 最多同时生成 3 个话题的内容
});

// 使用：用户点击热搜时
async function onTopicClick(topicId: string) {
  // 自动触发加载，已缓存则直接返回
  const posts = await topicPostsLoader.get(topicId);
  
  if (posts) {
    displayPosts(posts);
  }
}
```

### 3.2 评论区惰性加载

```typescript
import { createLazyLoader } from '@/services/lazyLoader';
import type { Comment } from '@/types/social';

const commentsLoader = createLazyLoader<Comment[]>({
  loader: async (postId) => {
    // 先检查数据库
    const existing = await db.socialComments
      .where('postId').equals(postId)
      .toArray();
    
    // 如果评论太少，生成更多
    if (existing.length < 3) {
      const post = await db.socialPosts.get(postId);
      if (post) {
        const generated = await contentFactory.generateComments(
          post.platformId,
          post.payload.text || '',
          5
        );
        // 保存到数据库
        for (const comment of generated) {
          await db.socialComments.add(comment);
          existing.push(comment);
        }
      }
    }
    
    return existing;
  },
  
  cache: {
    maxSize: 100,
    ttl: 10 * 60 * 1000,  // 10 分钟
  },
  
  concurrency: 2,
  
  // 错误处理
  onError: (postId, error) => {
    console.error(`Failed to load comments for post ${postId}:`, error);
  },
});
```

### 3.3 批量加载优化

```typescript
import { createLazyLoader } from '@/services/lazyLoader';
import type { UserProfile } from '@/types/account';

const userProfileLoader = createLazyLoader<UserProfile>({
  // 单个加载
  loader: async (userId) => {
    return await accountService.getProfile(userId);
  },
  
  // 批量加载（更高效）
  batchLoader: async (userIds) => {
    const profiles = await accountService.getProfiles(userIds);
    return new Map(profiles.map(p => [p.id, p]));
  },
  
  cache: {
    maxSize: 500,
    ttl: 5 * 60 * 1000,
  },
});

// 使用：加载帖子列表时批量获取用户信息
async function enrichPosts(posts: Post[]) {
  const userIds = [...new Set(posts.map(p => p.authorId))];
  
  // 批量加载所有用户资料
  const profiles = await userProfileLoader.getMany(userIds);
  
  return posts.map(post => ({
    ...post,
    author: profiles.get(post.authorId),
  }));
}
```

### 3.4 预加载策略

```typescript
// 用户浏览热搜列表时，预加载前几个话题的内容
function onTrendingListVisible(topics: TrendingTopic[]) {
  // 预加载前 3 个热搜的内容
  const topTopics = topics.slice(0, 3).map(t => t.id);
  
  // 后台预加载，不阻塞 UI
  topicPostsLoader.preload(topTopics).catch(() => {
    // 预加载失败不影响用户体验
  });
}

// 滚动到某个帖子时，预加载评论
function onPostVisible(postId: string) {
  if (!commentsLoader.has(postId)) {
    commentsLoader.preload([postId]);
  }
}
```

### 3.5 缓存预热

```typescript
// 从数据库恢复缓存
async function warmupCache() {
  // 获取最近访问的话题
  const recentTopics = await db.socialTopics
    .orderBy('lastAccessedAt')
    .reverse()
    .limit(10)
    .toArray();
  
  // 预热缓存
  for (const topic of recentTopics) {
    const posts = await db.socialPosts
      .where('topicTags')
      .equals(topic.keyword)
      .toArray();
    
    if (posts.length > 0) {
      topicPostsLoader.prime(topic.id, posts);
    }
  }
}
```

---

## 4. 实现细节

### 4.1 核心数据结构

```typescript
interface CacheEntry<T> {
  /** 缓存的值 */
  value: T;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间（LRU 用）*/
  accessedAt: number;
  /** 访问次数 */
  accessCount: number;
}

interface PendingRequest<T> {
  /** Promise 对象 */
  promise: Promise<T | undefined>;
  /** 等待此请求的回调列表 */
  waiters: Array<{
    resolve: (value: T | undefined) => void;
    reject: (error: Error) => void;
  }>;
}
```

### 4.2 并发控制实现

```typescript
class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];
  
  constructor(private limit: number) {}
  
  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return;
    }
    
    // 等待有空位
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }
  
  release(): void {
    this.running--;
    
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.running++;
      next();
    }
  }
}
```

### 4.3 LRU 缓存淘汰

```typescript
class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  
  constructor(private maxSize: number) {}
  
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // 更新访问时间
    entry.accessedAt = Date.now();
    entry.accessCount++;
    
    return entry.value;
  }
  
  set(key: string, value: T): void {
    // 检查是否需要淘汰
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict();
    }
    
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
    });
  }
  
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
```

### 4.4 请求去重实现

```typescript
class RequestDeduplicator<T> {
  private pending = new Map<string, PendingRequest<T>>();
  
  async dedupe(
    key: string,
    loader: () => Promise<T>
  ): Promise<T> {
    // 检查是否有正在进行的请求
    const existing = this.pending.get(key);
    if (existing) {
      // 等待已有请求完成
      return new Promise((resolve, reject) => {
        existing.waiters.push({ resolve, reject });
      });
    }
    
    // 创建新请求
    const request: PendingRequest<T> = {
      promise: loader(),
      waiters: [],
    };
    
    this.pending.set(key, request);
    
    try {
      const result = await request.promise;
      
      // 通知所有等待者
      for (const waiter of request.waiters) {
        waiter.resolve(result);
      }
      
      return result;
    } catch (error) {
      // 通知所有等待者失败
      for (const waiter of request.waiters) {
        waiter.reject(error as Error);
      }
      throw error;
    } finally {
      this.pending.delete(key);
    }
  }
}
```

---

## 5. 与现有代码的关系

### 5.1 需要迁移的实现

| 现有位置                            | 惰性加载逻辑 | 迁移建议                     |
| ----------------------------------- | ------------ | ---------------------------- |
| `TrendService.ensureTopicContent()` | 话题内容填充 | 使用 `createLazyLoader` 封装 |
| `feedStore.loadComments()`          | 评论惰性生成 | 使用 `createLazyLoader` 封装 |
| 用户主页博文加载                    | 历史内容生成 | 新增 LazyLoader 实例         |

### 5.2 迁移示例：TrendService

迁移前：

```typescript
// TrendService.ts
public async ensureTopicContent(topicId: string): Promise<void> {
  const topic = await db.socialTopics.get(topicId);
  if (!topic || !topic.platformId) return;

  const postCount = await db.socialPosts
    .where('topicTags').equals(topic.keyword)
    .and(p => p.platformId === topic.platformId!)
    .count();

  if (postCount > 0) return; // 已经有内容了

  // 生成内容...
}
```

迁移后：

```typescript
// topicLoader.ts
import { createLazyLoader } from '@/services/lazyLoader';

export const topicContentLoader = createLazyLoader<UniversalPost[]>({
  loader: async (topicId) => {
    const topic = await db.socialTopics.get(topicId);
    if (!topic || !topic.platformId) return [];

    // 检查已有内容
    const existing = await db.socialPosts
      .where('topicTags').equals(topic.keyword)
      .and(p => p.platformId === topic.platformId!)
      .toArray();

    if (existing.length > 0) return existing;

    // 生成新内容
    return await generateTopicPosts(topic);
  },
  cache: {
    maxSize: 50,
    ttl: 30 * 60 * 1000,
  },
  concurrency: 3,
});

// TrendService.ts
export class TrendService {
  public async ensureTopicContent(topicId: string): Promise<UniversalPost[]> {
    return await topicContentLoader.get(topicId) || [];
  }
}
```

---

## 6. 高级功能

### 6.1 分层缓存

```typescript
/**
 * 分层缓存配置
 * - L1: 内存缓存（快速）
 * - L2: IndexedDB 缓存（持久）
 */
export interface TieredCacheOptions {
  l1: {
    maxSize: number;
    ttl: number;
  };
  l2?: {
    tableName: string;
    ttl: number;
  };
}

export function createTieredLoader<T>(
  options: LazyLoaderOptions<T> & { tieredCache: TieredCacheOptions }
): LazyLoader<T>;
```

使用示例：

```typescript
const persistentLoader = createTieredLoader<UserProfile>({
  loader: fetchUserProfile,
  tieredCache: {
    l1: { maxSize: 100, ttl: 5 * 60 * 1000 },  // 内存 5 分钟
    l2: { tableName: 'userProfileCache', ttl: 24 * 60 * 60 * 1000 },  // DB 24 小时
  },
});
```

### 6.2 条件加载

```typescript
interface ConditionalLoaderOptions<T> extends LazyLoaderOptions<T> {
  /**
   * 判断是否需要重新加载
   * - 返回 true 表示缓存仍然有效
   * - 返回 false 表示需要重新加载
   */
  shouldUseCache?: (key: string, cached: T) => boolean | Promise<boolean>;
}
```

使用示例：

```typescript
const dynamicLoader = createLazyLoader<TrendingTopic[]>({
  loader: fetchTrending,
  shouldUseCache: async (key, cached) => {
    // 如果热搜数据超过 10 分钟，重新加载
    const lastUpdate = cached[0]?.updatedAt || 0;
    return Date.now() - lastUpdate < 10 * 60 * 1000;
  },
});
```

### 6.3 依赖加载

```typescript
interface DependentLoaderOptions<T, D> extends LazyLoaderOptions<T> {
  /**
   * 依赖的 LazyLoader
   */
  dependsOn: LazyLoader<D>;
  
  /**
   * 从 key 提取依赖的 key
   */
  extractDependencyKey: (key: string) => string;
  
  /**
   * 带依赖数据的加载函数
   */
  loaderWithDependency: (key: string, dependency: D) => Promise<T>;
}
```

使用示例：

```typescript
// 评论加载依赖帖子信息
const commentsLoader = createDependentLoader<Comment[], Post>({
  dependsOn: postLoader,
  extractDependencyKey: (commentKey) => commentKey.split(':')[0],  // "postId:comments" -> "postId"
  loaderWithDependency: async (key, post) => {
    return generateCommentsForPost(post);
  },
});
```

---

## 7. 服务管理

### 7.1 全局注册表

```typescript
/**
 * LazyLoader 全局管理器
 */
export class LazyLoaderRegistry {
  private static loaders = new Map<string, LazyLoader<any>>();
  
  /**
   * 注册一个 LazyLoader
   */
  static register<T>(name: string, loader: LazyLoader<T>): void {
    this.loaders.set(name, loader);
  }
  
  /**
   * 获取已注册的 LazyLoader
   */
  static get<T>(name: string): LazyLoader<T> | undefined {
    return this.loaders.get(name);
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
   * 获取所有 LazyLoader 的统计信息
   */
  static getAllStats(): Map<string, LazyLoaderStats> {
    const stats = new Map();
    for (const [name, loader] of this.loaders) {
      stats.set(name, loader.getStats());
    }
    return stats;
  }
}
```

### 7.2 会话感知

```typescript
import { sessionContextService } from '@/services/sessionContext';

/**
 * 创建会话感知的 LazyLoader
 * - 会话切换时自动清理缓存
 */
export function createSessionAwareLoader<T>(
  options: LazyLoaderOptions<T>
): LazyLoader<T> {
  const loader = createLazyLoader(options);
  
  // 监听会话切换
  sessionContextService.onSessionChange(() => {
    loader.invalidateAll();
  });
  
  return loader;
}
```

---

## 8. 调试与监控

### 8.1 日志输出

```typescript
const debugLoader = createLazyLoader<Post[]>({
  loader: fetchPosts,
  
  onLoadStart: (key) => {
    console.log(`[LazyLoader] Loading: ${key}`);
  },
  
  onLoadEnd: (key, value, error) => {
    if (error) {
      console.error(`[LazyLoader] Failed: ${key}`, error);
    } else {
      console.log(`[LazyLoader] Loaded: ${key}, items: ${value?.length}`);
    }
  },
  
  onCacheHit: (key) => {
    console.log(`[LazyLoader] Cache hit: ${key}`);
  },
});
```

### 8.2 性能统计

```typescript
// 获取统计信息
const stats = topicPostsLoader.getStats();

console.log(`
  缓存命中率: ${(stats.hitRate * 100).toFixed(1)}%
  命中/未命中: ${stats.hits}/${stats.misses}
  缓存大小: ${stats.size}
  等待中任务: ${stats.pendingCount}
`);
```

---

## 9. 实施计划

### 9.1 Phase 1: 核心实现 ✅ 已完成

- [x] 实现 `LazyLoader` 类 → `src/services/lazyLoader/LazyLoader.ts`
- [x] 实现 LRU 缓存 → `src/services/lazyLoader/LRUCache.ts` (包括 LRU 和 FIFO)
- [x] 实现并发控制 → `src/services/lazyLoader/ConcurrencyLimiter.ts`
- [x] 实现请求去重 → `src/services/lazyLoader/RequestDeduplicator.ts`
- [x] 单元测试 → `src/services/lazyLoader/__tests__/` (4个文件，96个测试用例)

### 9.2 Phase 2: 迁移现有代码 (2-3h)

- [x] 迁移 `TrendService.ensureTopicContent` → `src/services/social/topicContentLoader.ts`
- [ ] 迁移 `feedStore.loadComments`
- [ ] 验证功能正常

### 9.3 Phase 3: 高级功能 (可选, 2h)

- [ ] 分层缓存
- [ ] 条件加载
- [ ] 会话感知
- [x] 全局注册表 → `LazyLoaderRegistry` in `src/services/lazyLoader/index.ts`

### 9.4 工作量预估

| 阶段     | 工作量    | 状态         |
| -------- | --------- | ------------ |
| Phase 1  | 2-3h      | ✅ 已完成    |
| Phase 2  | 2-3h      | 🚧 进行中    |
| Phase 3  | 2h (可选) | 部分完成     |
| **总计** | **4-8h**  |              |

---

## 10. 参考

### 10.1 相关文档

- [服务架构总览](../architecture/Service-for-social-media-platform.md)
- [社交媒体引擎](../social-media-engine/README.md)
- [会话上下文服务](../session-context/README.md)

### 10.2 灵感来源

- [DataLoader](https://github.com/graphql/dataloader) - GraphQL 的批量加载库
- [SWR](https://swr.vercel.app/) - React 的数据获取库
- [TanStack Query](https://tanstack.com/query) - 数据同步库

### 10.3 版本历史

| 版本 | 日期       | 变更内容                               |
| ---- | ---------- | -------------------------------------- |
| 1.0  | 2025-01-08 | 初始版本，从 TrendService 惰性填充抽取 |
