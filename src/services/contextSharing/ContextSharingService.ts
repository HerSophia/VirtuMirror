/**
 * Context Sharing Service 核心实现
 * @module services/contextSharing/ContextSharingService
 */

import { eventBus } from '@/services/eventBus';
import { formatContexts } from './formatters';
import { loggerService } from '@/services/logger';
import type {
  ContextType,
  ContextVisibility,
  SharedContext,
  SharedContextMeta,
  PublishContextOptions,
  AggregationRequest,
  AggregatedContext,
  ContextSearchQuery,
  CacheEntry,
  SubscribeCallback,
  TypeSubscribeCallback,
  ContextItem,
} from './types';

/**
 * Context Sharing Service
 *
 * 提供跨应用的上下文共享能力，支持：
 * - 发布/订阅模式
 * - TTL 缓存
 * - 懒加载 (getter)
 * - 可见性控制
 * - 格式化输出
 */
export class ContextSharingService {
  /** 上下文存储 */
  private contexts: Map<string, SharedContext> = new Map();

  /** 缓存存储（用于 getter 结果） */
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  /** ID 订阅者 */
  private idSubscribers: Map<string, Set<SubscribeCallback<unknown>>> = new Map();

  /** 类型订阅者 */
  private typeSubscribers: Map<ContextType, Set<TypeSubscribeCallback<unknown>>> = new Map();

  /** 当前 App ID（用于可见性检查） */
  private currentAppId: string = 'system';

  /** ID 计数器 */
  private idCounter: number = 0;

  /** 日志实例 */
  private logger = loggerService.child('service:contextSharing');

  constructor() {
    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 60 * 1000);
  }

  /**
   * 设置当前 App ID
   * @param appId App ID
   */
  setCurrentAppId(appId: string): void {
    this.currentAppId = appId;
  }

  /**
   * 获取当前 App ID
   */
  getCurrentAppId(): string {
    return this.currentAppId;
  }

  // ==================== 发布相关 ====================

  /**
   * 发布上下文
   * @param options 发布选项
   * @returns 上下文 ID
   */
  publish<T>(options: PublishContextOptions<T>): string {
    const id = options.id || this.generateId(options.type);

    // 检查是否已存在
    if (this.contexts.has(id)) {
      this.logger.warn(`上下文 ${id} 已存在，将被覆盖`);
    }

    const context: SharedContext<T> = {
      id,
      type: options.type,
      publisherId: this.currentAppId,
      description: options.description,
      value: options.value,
      getter: options.getter,
      visibility: options.visibility || { level: 'public' },
      cache: options.cache,
      updatedAt: Date.now(),
    };

    this.contexts.set(id, context);

    // 发送事件
    eventBus.emit('contextSharing:published', { id, type: options.type });

    // 通知订阅者
    this.notifyIdSubscribers(id);
    this.notifyTypeSubscribers(options.type);

    return id;
  }

  /**
   * 取消发布上下文
   * @param id 上下文 ID
   * @returns 是否成功
   */
  unpublish(id: string): boolean {
    const context = this.contexts.get(id);
    if (!context) {
      return false;
    }

    // 检查权限
    if (context.publisherId !== this.currentAppId && this.currentAppId !== 'system') {
      this.logger.warn(`无权取消发布上下文 ${id}`);
      return false;
    }

    const type = context.type;
    this.contexts.delete(id);
    this.cache.delete(id);

    // 发送事件
    eventBus.emit('contextSharing:unpublished', { id, type });

    // 通知类型订阅者
    this.notifyTypeSubscribers(type);

    return true;
  }

  /**
   * 替换上下文值
   * @param id 上下文 ID
   * @param value 新值
   * @returns 是否成功
   */
  replace<T>(id: string, value: T): boolean {
    const context = this.contexts.get(id);
    if (!context) {
      return false;
    }

    // 检查权限
    if (context.publisherId !== this.currentAppId && this.currentAppId !== 'system') {
      this.logger.warn(`无权更新上下文 ${id}`);
      return false;
    }

    context.value = value;
    context.updatedAt = Date.now();

    // 清除缓存
    this.cache.delete(id);

    // 发送事件
    eventBus.emit('contextSharing:updated', { id });

    // 通知订阅者
    this.notifyIdSubscribers(id);
    this.notifyTypeSubscribers(context.type);

    return true;
  }

  // ==================== 获取相关 ====================

  /**
   * 同步获取上下文值
   * 注意：如果上下文使用 getter，且没有缓存，则返回 undefined
   * @param id 上下文 ID
   * @returns 上下文值或 undefined
   */
  get<T>(id: string): T | undefined {
    const context = this.contexts.get(id);
    if (!context) {
      return undefined;
    }

    // 检查可见性
    if (!this.checkVisibility(context)) {
      return undefined;
    }

    // 如果有静态值，直接返回
    if (context.value !== undefined) {
      return context.value as T;
    }

    // 如果有 getter，尝试从缓存获取
    if (context.getter) {
      const cached = this.getCachedValue<T>(id);
      if (cached !== undefined) {
        return cached;
      }
    }

    return undefined;
  }

  /**
   * 异步获取上下文值
   * 支持 getter 的懒加载
   * @param id 上下文 ID
   * @returns 上下文值或 undefined
   */
  async getAsync<T>(id: string): Promise<T | undefined> {
    const context = this.contexts.get(id);
    if (!context) {
      return undefined;
    }

    // 检查可见性
    if (!this.checkVisibility(context)) {
      return undefined;
    }

    // 如果有静态值，直接返回
    if (context.value !== undefined) {
      return context.value as T;
    }

    // 如果有 getter
    if (context.getter) {
      // 检查缓存
      const cached = this.getCachedValue<T>(id);
      if (cached !== undefined) {
        return cached;
      }

      // 调用 getter
      try {
        const value = await context.getter();

        // 缓存结果
        if (context.cache?.ttl) {
          this.setCachedValue(id, value, context.cache.ttl);
        }

        return value as T;
      } catch (error) {
        this.logger.error(`getter 执行失败 (${id}):`, error);
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * 按类型获取所有上下文
   * @param type 上下文类型
   * @returns 上下文 ID -> 值 的映射
   */
  getByType<T>(type: ContextType): Map<string, T> {
    const result = new Map<string, T>();

    for (const [id, context] of this.contexts) {
      if (context.type !== type) continue;
      if (!this.checkVisibility(context)) continue;

      const value = this.get<T>(id);
      if (value !== undefined) {
        result.set(id, value);
      }
    }

    return result;
  }

  // ==================== 订阅相关 ====================

  /**
   * 订阅指定 ID 的上下文
   * @param id 上下文 ID
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribe<T>(id: string, callback: SubscribeCallback<T>): () => void {
    if (!this.idSubscribers.has(id)) {
      this.idSubscribers.set(id, new Set());
    }

    this.idSubscribers.get(id)!.add(callback as SubscribeCallback<unknown>);

    // 立即触发一次（如果有值）
    const value = this.get<T>(id);
    if (value !== undefined) {
      callback(value);
    }

    // 返回取消订阅函数
    return () => {
      const subscribers = this.idSubscribers.get(id);
      if (subscribers) {
        subscribers.delete(callback as SubscribeCallback<unknown>);
        if (subscribers.size === 0) {
          this.idSubscribers.delete(id);
        }
      }
    };
  }

  /**
   * 订阅指定类型的所有上下文
   * @param type 上下文类型
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribeByType<T>(type: ContextType, callback: TypeSubscribeCallback<T>): () => void {
    if (!this.typeSubscribers.has(type)) {
      this.typeSubscribers.set(type, new Set());
    }

    this.typeSubscribers.get(type)!.add(callback as TypeSubscribeCallback<unknown>);

    // 立即触发一次
    const contexts = this.getByType<T>(type);
    callback(contexts);

    // 返回取消订阅函数
    return () => {
      const subscribers = this.typeSubscribers.get(type);
      if (subscribers) {
        subscribers.delete(callback as TypeSubscribeCallback<unknown>);
        if (subscribers.size === 0) {
          this.typeSubscribers.delete(type);
        }
      }
    };
  }

  // ==================== 聚合相关 ====================

  /**
   * 聚合多个上下文
   * @param request 聚合请求
   * @returns 聚合结果
   */
  async aggregate(request: AggregationRequest): Promise<AggregatedContext> {
    const { types, ids, format = 'xml', maxTokens, priority } = request;

    // 收集符合条件的上下文
    const matchedContexts: SharedContext[] = [];

    for (const context of this.contexts.values()) {
      // 检查可见性
      if (!this.checkVisibility(context, request.requesterId)) {
        continue;
      }

      // 按类型筛选
      if (types && types.length > 0 && !types.includes(context.type)) {
        continue;
      }

      // 按 ID 筛选
      if (ids && ids.length > 0 && !ids.includes(context.id)) {
        continue;
      }

      matchedContexts.push(context);
    }

    // 按优先级排序
    if (priority && priority.length > 0) {
      matchedContexts.sort((a, b) => {
        const aIndex = priority.indexOf(a.type);
        const bIndex = priority.indexOf(b.type);
        // 不在优先级列表中的排在后面
        const aScore = aIndex === -1 ? priority.length : aIndex;
        const bScore = bIndex === -1 ? priority.length : bIndex;
        return aScore - bScore;
      });
    }

    // 获取值并按类型分组
    const groupedContexts = new Map<ContextType, ContextItem[]>();
    const collectedTypes = new Set<ContextType>();

    for (const context of matchedContexts) {
      const value = await this.getAsync(context.id);
      if (value === undefined) continue;

      if (!groupedContexts.has(context.type)) {
        groupedContexts.set(context.type, []);
      }

      groupedContexts.get(context.type)!.push({
        id: context.id,
        description: context.description,
        value,
      });

      collectedTypes.add(context.type);
    }

    // 格式化
    let formatted: string | undefined;
    let truncated = false;
    let estimatedTokens = 0;

    if (format !== 'raw') {
      const formatResult = formatContexts(groupedContexts, format, maxTokens);
      formatted = formatResult.text;
      truncated = formatResult.truncated;
      estimatedTokens = formatResult.estimatedTokens;
    }

    // 计算总数
    let totalContexts = 0;
    for (const items of groupedContexts.values()) {
      totalContexts += items.length;
    }

    return {
      contexts: groupedContexts,
      formatted,
      meta: {
        totalContexts,
        types: Array.from(collectedTypes),
        estimatedTokens,
        truncated,
      },
    };
  }

  // ==================== 查询相关 ====================

  /**
   * 获取所有上下文（受可见性限制）
   * @returns 上下文列表
   */
  getAllContexts(): SharedContextMeta[] {
    const result: SharedContextMeta[] = [];

    for (const context of this.contexts.values()) {
      if (this.checkVisibility(context)) {
        result.push(this.toMeta(context));
      }
    }

    return result;
  }

  /**
   * 按发布者获取上下文
   * @param publisherId 发布者 ID
   * @returns 上下文列表
   */
  getContextsByPublisher(publisherId: string): SharedContextMeta[] {
    const result: SharedContextMeta[] = [];

    for (const context of this.contexts.values()) {
      if (context.publisherId !== publisherId) continue;
      if (this.checkVisibility(context)) {
        result.push(this.toMeta(context));
      }
    }

    return result;
  }

  /**
   * 搜索上下文
   * @param query 搜索条件
   * @returns 上下文列表
   */
  search(query: ContextSearchQuery): SharedContextMeta[] {
    const result: SharedContextMeta[] = [];

    for (const context of this.contexts.values()) {
      // 可见性检查
      if (!this.checkVisibility(context)) continue;

      // 类型筛选
      if (query.type && context.type !== query.type) continue;

      // 发布者筛选
      if (query.publisherId && context.publisherId !== query.publisherId) continue;

      // 关键词搜索
      if (query.keyword) {
        const keyword = query.keyword.toLowerCase();
        const matchesId = context.id.toLowerCase().includes(keyword);
        const matchesDesc = context.description.toLowerCase().includes(keyword);
        if (!matchesId && !matchesDesc) continue;
      }

      result.push(this.toMeta(context));
    }

    return result;
  }

  // ==================== 私有方法 ====================

  /**
   * 生成唯一 ID
   */
  private generateId(type: ContextType): string {
    this.idCounter++;
    return `${type}:${this.idCounter}:${Date.now()}`;
  }

  /**
   * 检查可见性
   */
  private checkVisibility(context: SharedContext, requesterId?: string): boolean {
    const appId = requesterId || this.currentAppId;
    const visibility = context.visibility;

    switch (visibility.level) {
      case 'public':
        // 检查排除列表
        if (visibility.excludedApps?.includes(appId)) {
          return false;
        }
        return true;

      case 'restricted':
        // 检查允许列表
        if (!visibility.allowedApps?.includes(appId)) {
          // 发布者始终可以访问
          return context.publisherId === appId;
        }
        return true;

      case 'private':
        // 仅发布者可访问
        return context.publisherId === appId || appId === 'system';

      default:
        return true;
    }
  }

  /**
   * 从缓存获取值
   */
  private getCachedValue<T>(id: string): T | undefined {
    const entry = this.cache.get(id);
    if (!entry) return undefined;

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(id);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * 设置缓存值
   */
  private setCachedValue(id: string, value: unknown, ttl: number): void {
    const now = Date.now();
    this.cache.set(id, {
      value,
      cachedAt: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(id);
      }
    }
  }

  /**
   * 通知 ID 订阅者
   */
  private notifyIdSubscribers(id: string): void {
    const subscribers = this.idSubscribers.get(id);
    if (!subscribers || subscribers.size === 0) return;

    const value = this.get(id);
    if (value === undefined) return;

    for (const callback of subscribers) {
      try {
        callback(value);
      } catch (error) {
        this.logger.error(`订阅回调执行失败:`, error);
      }
    }
  }

  /**
   * 通知类型订阅者
   */
  private notifyTypeSubscribers(type: ContextType): void {
    const subscribers = this.typeSubscribers.get(type);
    if (!subscribers || subscribers.size === 0) return;

    const contexts = this.getByType(type);

    for (const callback of subscribers) {
      try {
        callback(contexts);
      } catch (error) {
        this.logger.error(`类型订阅回调执行失败:`, error);
      }
    }
  }

  /**
   * 转换为元信息
   */
  private toMeta(context: SharedContext): SharedContextMeta {
    return {
      id: context.id,
      publisherId: context.publisherId,
      type: context.type,
      description: context.description,
      visibility: context.visibility,
      updatedAt: context.updatedAt,
      cache: context.cache,
    };
  }
}

// 导出单例
export const contextSharingService = new ContextSharingService();
