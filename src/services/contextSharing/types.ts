/**
 * Context Sharing Service 类型定义
 * @module services/contextSharing/types
 */

/**
 * 预定义的上下文类型
 */
export type WellKnownContextType =
  | 'system:time'
  | 'system:session'
  | 'system:player'
  | 'narrative:content'
  | 'narrative:characters'
  | 'narrative:location'
  | 'narrative:mood'
  | 'social:trending'
  | 'social:recentPosts'
  | 'social:hotTopics'
  | 'chat:lastMessage'
  | 'chat:recentHistory'
  | 'chat:participants'
  | 'user:currentAccount'
  | 'user:recentActions'
  | 'user:preferences'
  | 'archive:pinned'
  | 'archive:relevant'
  | 'archive:characters';

/**
 * 上下文类型（预定义 + 自定义）
 */
export type ContextType = WellKnownContextType | `custom:${string}`;

/**
 * 可见性配置
 */
export interface ContextVisibility {
  /** 可见性级别 */
  level: 'public' | 'restricted' | 'private';
  /** 允许访问的 App 列表（restricted 级别时使用） */
  allowedApps?: string[];
  /** 排除的 App 列表（public 级别时使用） */
  excludedApps?: string[];
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 缓存生存时间（毫秒） */
  ttl: number;
  /** 是否在重新验证时返回过期数据 */
  staleWhileRevalidate?: boolean;
}

/**
 * 共享上下文元信息
 */
export interface SharedContextMeta {
  /** 上下文唯一标识 */
  id: string;
  /** 发布者 ID */
  publisherId: string;
  /** 上下文类型 */
  type: ContextType;
  /** 描述信息 */
  description: string;
  /** 可见性配置 */
  visibility: ContextVisibility;
  /** 最后更新时间 */
  updatedAt: number;
  /** 缓存配置 */
  cache?: CacheConfig;
}

/**
 * 共享上下文完整结构
 */
export interface SharedContext<T = unknown> extends SharedContextMeta {
  /** 静态值 */
  value?: T;
  /** 动态获取器（懒加载） */
  getter?: () => T | Promise<T>;
}

/**
 * 发布上下文选项
 */
export interface PublishContextOptions<T> {
  /** 上下文 ID（可选，不提供则自动生成） */
  id?: string;
  /** 上下文类型 */
  type: ContextType;
  /** 描述信息 */
  description: string;
  /** 静态值 */
  value?: T;
  /** 动态获取器 */
  getter?: () => T | Promise<T>;
  /** 可见性配置 */
  visibility?: ContextVisibility;
  /** 缓存配置 */
  cache?: CacheConfig;
}

/**
 * 聚合格式
 */
export type AggregationFormat = 'raw' | 'text' | 'xml' | 'markdown';

/**
 * 聚合请求
 */
export interface AggregationRequest {
  /** 请求者 ID */
  requesterId: string;
  /** 要聚合的上下文类型 */
  types?: ContextType[];
  /** 要聚合的上下文 ID */
  ids?: string[];
  /** 输出格式 */
  format?: AggregationFormat;
  /** 最大 token 数限制 */
  maxTokens?: number;
  /** 优先级排序（优先保留的类型） */
  priority?: ContextType[];
}

/**
 * 聚合结果
 */
export interface AggregatedContext {
  /** 按类型分组的上下文 */
  contexts: Map<ContextType, ContextItem[]>;
  /** 格式化后的文本 */
  formatted?: string;
  /** 元信息 */
  meta: {
    /** 上下文总数 */
    totalContexts: number;
    /** 包含的类型 */
    types: ContextType[];
    /** 估算的 token 数 */
    estimatedTokens?: number;
    /** 是否被截断 */
    truncated?: boolean;
  };
}

/**
 * 上下文项（用于聚合结果）
 */
export interface ContextItem {
  /** 上下文 ID */
  id: string;
  /** 描述信息 */
  description: string;
  /** 值 */
  value: unknown;
}

/**
 * 搜索查询
 */
export interface ContextSearchQuery {
  /** 按类型筛选 */
  type?: ContextType;
  /** 按发布者筛选 */
  publisherId?: string;
  /** 关键词搜索 */
  keyword?: string;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  /** 缓存的值 */
  value: T;
  /** 缓存时间 */
  cachedAt: number;
  /** 过期时间 */
  expiresAt: number;
}

/**
 * 订阅回调
 */
export type SubscribeCallback<T> = (value: T) => void;

/**
 * 类型订阅回调
 */
export type TypeSubscribeCallback<T> = (contexts: Map<string, T>) => void;
