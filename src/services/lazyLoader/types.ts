/**
 * Lazy Loader 服务类型定义
 */

/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  /** 缓存的值 */
  value: T;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间（LRU 用）*/
  accessedAt: number;
  /** 访问次数 */
  accessCount: number;
}

/**
 * 待处理请求
 */
export interface PendingRequest<T> {
  /** Promise 对象 */
  promise: Promise<T | undefined>;
  /** 等待此请求的回调列表 */
  waiters: Array<{
    resolve: (value: T | undefined) => void;
    reject: (error: Error) => void;
  }>;
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

/**
 * 缓存配置
 */
export interface CacheOptions {
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
}

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

  cache?: CacheOptions;

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

  // === 生命周期 ===

  /**
   * 销毁加载器，清理资源
   */
  destroy(): void;
}
