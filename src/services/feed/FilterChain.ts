/**
 * 过滤器链
 * 支持多个过滤器按优先级执行
 */

import type { UniversalPost } from '@/types/social';
import type { FeedFilter, PrioritizedFilter, BuiltinFilterType } from '@/types/feed';

/**
 * 生成唯一的过滤器 ID
 */
function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 过滤器链类
 */
export class FilterChain {
  private filters: Map<string, PrioritizedFilter[]> = new Map();
  private builtinFilters: Map<string, Map<BuiltinFilterType, PrioritizedFilter>> = new Map();

  /**
   * 添加过滤器
   */
  add(
    platformId: string,
    filter: FeedFilter,
    options?: { id?: string; name?: string; priority?: number }
  ): string {
    const filterId = options?.id || generateFilterId();
    const prioritizedFilter: PrioritizedFilter = {
      id: filterId,
      name: options?.name || `Filter ${filterId}`,
      priority: options?.priority ?? 100, // 默认优先级 100
      filter,
      enabled: true,
    };

    const list = this.filters.get(platformId) || [];
    list.push(prioritizedFilter);
    list.sort((a, b) => a.priority - b.priority);
    this.filters.set(platformId, list);

    return filterId;
  }

  /**
   * 移除过滤器
   */
  remove(platformId: string, filterId: string): boolean {
    const list = this.filters.get(platformId);
    if (!list) return false;

    const index = list.findIndex((f) => f.id === filterId);
    if (index === -1) return false;

    list.splice(index, 1);
    return true;
  }

  /**
   * 启用/禁用过滤器
   */
  toggle(platformId: string, filterId: string, enabled: boolean): boolean {
    const list = this.filters.get(platformId);
    if (!list) return false;

    const filter = list.find((f) => f.id === filterId);
    if (!filter) return false;

    filter.enabled = enabled;
    return true;
  }

  /**
   * 应用过滤器链
   */
  apply(
    platformId: string,
    posts: UniversalPost[]
  ): { filtered: UniversalPost[]; appliedFilters: string[] } {
    const customFilters = this.filters.get(platformId) || [];
    const builtinFiltersMap = this.builtinFilters.get(platformId);
    const builtinList = builtinFiltersMap ? Array.from(builtinFiltersMap.values()) : [];

    // 合并自定义过滤器和内置过滤器
    const allFilters = [...customFilters, ...builtinList]
      .filter((f) => f.enabled)
      .sort((a, b) => a.priority - b.priority);

    const appliedFilters: string[] = [];

    let result = posts;
    for (const filter of allFilters) {
      const before = result.length;
      result = result.filter(filter.filter);
      if (result.length !== before) {
        appliedFilters.push(filter.name);
      }
    }

    return { filtered: result, appliedFilters };
  }

  /**
   * 清除平台的所有过滤器
   */
  clear(platformId: string): void {
    this.filters.delete(platformId);
  }

  /**
   * 获取平台的所有过滤器
   */
  getFilters(platformId: string): PrioritizedFilter[] {
    return [...(this.filters.get(platformId) || [])];
  }

  /**
   * 注册内置过滤器
   */
  registerBuiltinFilter(
    platformId: string,
    type: BuiltinFilterType,
    filter: FeedFilter,
    enabled: boolean = false
  ): void {
    if (!this.builtinFilters.has(platformId)) {
      this.builtinFilters.set(platformId, new Map());
    }

    const prioritizedFilter: PrioritizedFilter = {
      id: `builtin_${type}`,
      name: this.getBuiltinFilterName(type),
      priority: this.getBuiltinFilterPriority(type),
      filter,
      enabled,
    };

    this.builtinFilters.get(platformId)!.set(type, prioritizedFilter);
  }

  /**
   * 启用/禁用内置过滤器
   */
  toggleBuiltinFilter(platformId: string, type: BuiltinFilterType, enabled: boolean): boolean {
    const builtinMap = this.builtinFilters.get(platformId);
    if (!builtinMap) return false;

    const filter = builtinMap.get(type);
    if (!filter) return false;

    filter.enabled = enabled;
    return true;
  }

  /**
   * 检查内置过滤器是否启用
   */
  isBuiltinFilterEnabled(platformId: string, type: BuiltinFilterType): boolean {
    const builtinMap = this.builtinFilters.get(platformId);
    if (!builtinMap) return false;

    const filter = builtinMap.get(type);
    return filter?.enabled || false;
  }

  /**
   * 初始化平台的内置过滤器
   */
  initBuiltinFilters(platformId: string, blockedUsers: string[] = [], mutedUsers: string[] = []): void {
    // 隐藏广告
    this.registerBuiltinFilter(platformId, 'hideAds', (post) => {
      return !(post.platformData?.isAd === true || post.platformData?.isSponsored === true);
    });

    // 隐藏转发
    this.registerBuiltinFilter(platformId, 'hideReposts', (post) => {
      return !post.payload.repost;
    });

    // 隐藏已屏蔽用户
    this.registerBuiltinFilter(platformId, 'hideBlocked', (post) => {
      return !blockedUsers.includes(post.authorId);
    });

    // 隐藏已静音用户
    this.registerBuiltinFilter(platformId, 'hideMuted', (post) => {
      return !mutedUsers.includes(post.authorId);
    });

    // 只看原创
    this.registerBuiltinFilter(platformId, 'onlyOriginal', (post) => {
      return !post.payload.repost;
    });

    // 只看有图/视频
    this.registerBuiltinFilter(platformId, 'onlyWithMedia', (post) => {
      return (
        (post.media && post.media.length > 0) ||
        (post.payload.images && post.payload.images.length > 0) ||
        !!post.payload.video
      );
    });
  }

  /**
   * 获取内置过滤器名称
   */
  private getBuiltinFilterName(type: BuiltinFilterType): string {
    const names: Record<BuiltinFilterType, string> = {
      hideAds: '隐藏广告',
      hideReposts: '隐藏转发',
      hideBlocked: '隐藏已屏蔽用户',
      hideMuted: '隐藏已静音用户',
      hideRead: '隐藏已读内容',
      onlyFollowing: '只看关注',
      onlyOriginal: '只看原创',
      onlyWithMedia: '只看有图/视频',
    };
    return names[type];
  }

  /**
   * 获取内置过滤器优先级
   */
  private getBuiltinFilterPriority(type: BuiltinFilterType): number {
    // 优先级越小越先执行
    const priorities: Record<BuiltinFilterType, number> = {
      hideBlocked: 1, // 最先过滤屏蔽用户
      hideMuted: 2,
      hideAds: 10,
      hideRead: 20,
      hideReposts: 30,
      onlyFollowing: 40,
      onlyOriginal: 50,
      onlyWithMedia: 60,
    };
    return priorities[type];
  }
}

/**
 * 默认的过滤器链实例
 */
export const filterChain = new FilterChain();
