# 交互服务架构设计

> **版本**: v1.0  
> **最后更新**: 2026-01-16

本文档描述交互服务的分层架构、核心组件和数据流设计。

---

## 1. 整体架构

### 1.1 分层架构图

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           应用层 (App Layer)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   微博 App  │  │   B站 App   乎 App  │  │   ... App   │     │
│  │             │  │             │  │             │  │             │     │
│  │ 点赞按钮    │  │ 一键三连    │  │ 赞同按钮    │  │ 互动组件    │     │
│  │ 收藏按钮    │  │ 投币按钮    │  │ 收藏问题    │  │             │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
          └────────────────┴────────┬───────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      交互服务层 (Interaction Service)                    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    InteractionService (核心)                     │    │
│  │                                                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │ LikeManager  │  │ FavoriteManager │ CommentManager │          │    │
│  │  │ (点赞管理)   │  │ (收藏管理)   │  │ (评论管理)   │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  │                                                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │ ViewTracker  │  │ StatsManager │  │ EventEmitter │           │    │
│  │  │ (浏览追踪)   │  │ (统计管理)   │  │ (事件发布)   │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   PlatformBehaviorRegistry                       │    │
│  │                   (平台扩展行为注册)                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        持久层 (Persistence Layer)                        │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ UserInteractions │  │  ContentStats    │  │    Comments      │       │
│  │     (用户互动)   │  │  (内容统计)      │  │    (评论)        │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │   ViewHistory    │  │ FavoriteCollections │ InteractionEvents │      │
│  │   (浏览历史)     │  │   (收藏夹)       │  │  (事件日志)       │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│                          IndexedDB (idb-keyval)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **单一职责** | 每个 Manager 只负责一类互动行为 |
| **事件驱动** | 所有互动触发事件，供其他服务订阅 |
| **平台无关** | 核心逻辑与平台解耦，通过扩展点支持差异 |
| **乐观更新** | 先更新 UI，后同步存储，提升体验 |
| **统计分离** | 互动状态和统计数据独立管理 |

---

## 2. 核心组件

### 2.1 InteractionService

交互服务的核心入口，协调各个 Manager：

```typescript
class InteractionService {
  // === 子管理器 ===
  private likeManager: LikeManager;
  private favoriteManager: FavoriteManager;
  private commentManager: CommentManager;
  private viewTracker: ViewTracker;
  private statsManager: StatsManager;
  private eventEmitter: InteractionEventEmitter;
  private platformRegistry: PlatformBehaviorRegistry;

  // === 初始化 ===
  async initialize(): Promise<void>;
  
  // === 点赞 ===
  async like(contentId: string, userId: string): Promise<void>;
  async unlike(contentId: string, userId: string): Promise<void>;
  async isLiked(contentId: string, userId: string): Promise<boolean>;
  async getUserLikes(userId: string, platformId?: string): Promise<string[]>;
  
  // === 收藏 ===
  async favorite(contentId: string, userId: string, collection?: string): Promise<void>;
  async unfavorite(contentId: string, userId: string): Promise<void>;
  async isFavorited(contentId: string, userId: string): Promise<boolean>;
  async getUserFavorites(userId: string, platformId?: string): Promise<string[]>;
  
  // === 评论 ===
  async comment(contentId: string, userId: string, text: string, replyTo?: string): Promise<Comment>;
  async deleteComment(commentId: string, userId: string): Promise<void>;
  async getComments(contentId: string, options?: CommentQueryOptions): Promise<Comment[]>;
  
  // === 浏览 ===
  async recordView(contentId: string, userId: string, metadata?: ViewMetadata): Promise<void>;
  async getViewHistory(userId: string, options?: ViewHistoryQuery): Promise<ViewRecord[]>;
  
  // === 统计 ===
  async getStats(contentId: string): Promise<InteractionStats>;
  async batchGetStats(contentIds: string[]): Promise<Map<string, InteractionStats>>;
  
  // === 事件 ===
  onInteraction(handler: InteractionEventHandler): Unsubscribe;
  on<T extends InteractionType>(type: T, handler: TypedInteractionHandler<T>): Unsubscribe;
  
  // === 平台扩展 ===
  registerPlatformBehavior(platformId: string, behavior: PlatformBehavior): void;
  executePlatformAction(platformId: string, action: string, ...args: any[]): Promise<any>;
}
```

### 2.2 LikeManager

点赞管理器：

```typescript
class LikeManager {
  constructor(
    private db: InteractionDB,
    private statsManager: StatsManager,
    private eventEmitter: InteractionEventEmitter
  ) {}

  /**
   * 点赞内容
   */
  async like(contentId: string, userId: string, platformId: string): Promise<void> {
    // 1. 检查是否已点赞
    const existing = await this.getUserInteraction(contentId, userId);
    if (existing?.isLiked) {
      return; // 幂等操作
    }

    // 2. 更新用户互动状态
    await this.db.updateUserInteraction(contentId, userId, {
      isLiked: true,
      likedAt: Date.now(),
    });

    // 3. 增加统计计数
    await this.statsManager.increment(contentId, 'likes', 1);

    // 4. 发布事件
    this.eventEmitter.emit({
      id: generateId(),
      type: 'like',
      contentId,
      userId,
      platformId,
      timestamp: Date.now(),
    });
  }

  /**
   * 取消点赞
   */
  async unlike(contentId: string, userId: string, platformId: string): Promise<void> {
    const existing = await this.getUserInteraction(contentId, userId);
    if (!existing?.isLiked) {
      return;
    }

    await this.db.updateUserInteraction(contentId, userId, {
      isLiked: false,
      likedAt: undefined,
    });

    await this.statsManager.increment(contentId, 'likes', -1);

    this.eventEmitter.emit({
      id: generateId(),
      type: 'unlike',
      contentId,
      userId,
      platformId,
      timestamp: Date.now(),
    });
  }

  /**
   * 检查是否已点赞
   */
  async isLiked(contentId: string, userId: string): Promise<boolean> {
    const interaction = await this.getUserInteraction(contentId, userId);
    return interaction?.isLiked ?? false;
  }

  /**
   * 获取用户点赞列表
   */
  async getUserLikes(userId: string, platformId?: string): Promise<string[]> {
    return this.db.queryUserLikes(userId, platformId);
  }
}
```

### 2.3 FavoriteManager

收藏管理器：

```typescript
class FavoriteManager {
  constructor(
    private db: InteractionDB,
    private statsManager: StatsManager,
    private eventEmitter: InteractionEventEmitter
  ) {}

  /**
   * 收藏内容
   */
  async favorite(
    contentId: string,
    userId: string,
    platformId: string,
    collectionId?: string
  ): Promise<void> {
    // 1. 获取或创建默认收藏夹
    const collection = collectionId ?? await this.getDefaultCollection(userId);

    // 2. 更新用户互动状态
    await this.db.updateUserInteraction(contentId, userId, {
      isFavorited: true,
      favoritedAt: Date.now(),
      collectionId: collection,
    });

    // 3. 添加到收藏夹
    await this.db.addToCollection(collection, contentId, platformId);

    // 4. 更新统计和发布事件
    await this.statsManager.increment(contentId, 'favorites', 1);
    
    this.eventEmitter.emit({
      id: generateId(),
      type: 'favorite',
      contentId,
      userId,
      platformId,
      timestamp: Date.now(),
      metadata: { collectionId: collection },
    });
  }

  /**
   * 获取用户收藏夹列表
   */
  async getCollections(userId: string): Promise<FavoriteCollection[]> {
    return this.db.getCollections(userId);
  }

  /**
   * 创建收藏夹
   */
  async createCollection(
    userId: string,
    name: string,
    options?: { description?: string; isPublic?: boolean }
  ): Promise<FavoriteCollection> {
    return this.db.createCollection({
      id: generateId(),
      userId,
      name,
      description: options?.description,
      isDefault: false,
      isPublic: options?.isPublic ?? false,
      itemCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}
```

### 2.4 CommentManager

评论管理器：

```typescript
class CommentManager {
  constructor(
    private db: InteractionDB,
    private statsManager: StatsManager,
    private eventEmitter: InteractionEventEmitter
  ) {}

  /**
   * 发表评论
   */
  async comment(
    contentId: string,
    userId: string,
    text: string,
    platformId: string,
    options?: { replyTo?: string; replyToUserId?: string }
  ): Promise<Comment> {
    // 1. 确定评论层级
    let depth = 0;
    let parentId: string | undefined;
    
    if (options?.replyTo) {
      const parent = await this.db.getComment(options.replyTo);
      if (parent) {
        depth = parent.depth + 1;
        parentId = parent.id;
      }
    }

    // 2. 创建评论
    const comment: Comment = {
      id: generateId(),
      contentId,
      platformId,
      authorId: userId,
      text,
      parentId,
      replyToUserId: options?.replyToUserId,
      depth,
      replyCount: 0,
      likes: 0,
      isDeleted: false,
      isPinned: false,
      isHot: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.saveComment(comment);

    // 3. 更新父评论的回复数
    if (parentId) {
      await this.db.incrementCommentReplyCount(parentId, 1);
    }

    // 4. 更新内容统计
    await this.statsManager.increment(contentId, 'comments', 1);

    // 5. 更新用户互动记录
    await this.db.addUserComment(contentId, userId, comment.id);

    // 6. 发布事件
    this.eventEmitter.emit({
      id: generateId(),
      type: 'comment',
      contentId,
      userId,
      platformId,
      timestamp: Date.now(),
      metadata: {
        commentId: comment.id,
        commentText: text,
        replyToCommentId: parentId,
      },
    });

    return comment;
  }

  /**
   * 获取评论列表（支持分页和排序）
   */
  async getComments(
    contentId: string,
    options?: {
      parentId?: string;      // 获取某评论的回复
      sortBy?: 'time' | 'likes' | 'hot';
      limit?: number;
      offset?: number;
    }
  ): Promise<Comment[]> {
    return this.db.queryComments(contentId, options);
  }

  /**
   * 获取评论树（根评论 + 部分回复）
   */
  async getCommentThreads(
    contentId: string,
    options?: { limit?: number; repliesPerThread?: number }
  ): Promise<CommentThread[]> {
    const rootComments = await this.getComments(contentId, {
      parentId: undefined, // 只获取顶级评论
      sortBy: 'hot',
      limit: options?.limit ?? 20,
    });

    return Promise.all(
      rootComments.map(async (root) => {
        const replies = await this.getComments(contentId, {
          parentId: root.id,
          sortBy: 'time',
          limit: options?.repliesPerThread ?? 3,
        });

        return {
          root,
          replies,
          hasMoreReplies: root.replyCount > replies.length,
          totalReplies: root.replyCount,
        };
      })
    );
  }
}
```

### 2.5 ViewTracker

浏览追踪器：

```typescript
class ViewTracker {
  constructor(
    private db: InteractionDB,
    private statsManager: StatsManager,
    private eventEmitter: InteractionEventEmitter
  ) {}

  /**
   * 记录浏览
   */
  async recordView(
    contentId: string,
    userId: string,
    platformId: string,
    metadata?: {
      duration?: number;
      scrollDepth?: number;
      source?: string;
      contentSnapshot?: {
        title?: string;
        summary?: string;
        authorName?: string;
        coverImage?: string;
      };
    }
  ): Promise<void> {
    // 1. 更新用户互动状态
    const existing = await this.db.getUserInteraction(contentId, userId);
    
    await this.db.updateUserInteraction(contentId, userId, {
      viewCount: (existing?.viewCount ?? 0) + 1,
      firstViewAt: existing?.firstViewAt ?? Date.now(),
      lastViewAt: Date.now(),
      totalViewDuration: (existing?.totalViewDuration ?? 0) + (metadata?.duration ?? 0),
    });

    // 2. 保存浏览记录
    const viewRecord: ViewRecord = {
      id: generateId(),
      userId,
      contentId,
      platformId,
      contentType: 'post', // 从内容中获取
      duration: metadata?.duration ?? 0,
      scrollDepth: metadata?.scrollDepth ?? 0,
      source: (metadata?.source as any) ?? 'feed',
      contentTitle: metadata?.contentSnapshot?.title,
      contentSummary: metadata?.contentSnapshot?.summary,
      authorName: metadata?.contentSnapshot?.authorName,
      coverImage: metadata?.contentSnapshot?.coverImage,
      viewedAt: Date.now(),
    };

    await this.db.saveViewRecord(viewRecord);

    // 3. 更新统计（仅首次浏览计入）
    if (!existing || existing.viewCount === 0) {
      await this.statsManager.increment(contentId, 'views', 1);
    }

    // 4. 发布事件
    this.eventEmitter.emit({
      id: generateId(),
      type: 'view',
      contentId,
      userId,
      platformId,
      timestamp: Date.now(),
      metadata: {
        viewDuration: metadata?.duration,
        scrollDepth: metadata?.scrollDepth,
      },
    });
  }

  /**
   * 获取浏览历史
   */
  async getViewHistory(userId: string, options?: ViewHistoryQuery): Promise<ViewRecord[]> {
    return this.db.queryViewHistory(userId, options);
  }

  /**
   * 清除浏览历史
   */
  async clearViewHistory(
    userId: string,
    options?: { before?: number; platformId?: string }
  ): Promise<void> {
    await this.db.deleteViewHistory(userId, options);
  }
}
```

### 2.6 StatsManager

统计管理器：

```typescript
class StatsManager {
  private cache: Map<string, { stats: InteractionStats; expiresAt: number }> = new Map();
  private cacheTtl: number = 5 * 60 * 1000; // 5 分钟

  constructor(private db: InteractionDB) {}

  /**
   * 获取内容统计
   */
  async getStats(contentId: string): Promise<InteractionStats> {
    // 1. 检查缓存
    const cached = this.cache.get(contentId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.stats;
    }

    // 2. 从数据库加载
    let stats = await this.db.getContentStats(contentId);
    
    if (!stats) {
      stats = this.createEmptyStats(contentId);
    }

    // 3. 更新缓存
    this.cache.set(contentId, {
      stats,
      expiresAt: Date.now() + this.cacheTtl,
    });

    return stats;
  }

  /**
   * 批量获取统计
   */
  async batchGetStats(contentIds: string[]): Promise<Map<string, InteractionStats>> {
    const result = new Map<string, InteractionStats>();
    const missing: string[] = [];

    // 1. 从缓存获取
    for (const id of contentIds) {
      const cached = this.cache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        result.set(id, cached.stats);
      } else {
        missing.push(id);
      }
    }

    // 2. 批量加载缺失的
    if (missing.length > 0) {
      const loaded = await this.db.batchGetContentStats(missing);
      for (const [id, stats] of loaded) {
        result.set(id, stats);
        this.cache.set(id, {
          stats,
          expiresAt: Date.now() + this.cacheTtl,
        });
      }

      // 3. 为未找到的创建空统计
      for (const id of missing) {
        if (!result.has(id)) {
          const emptyStats = this.createEmptyStats(id);
          result.set(id, emptyStats);
        }
      }
    }

    return result;
  }

  /**
   * 增加统计计数
   */
  async increment(
    contentId: string,
    field: keyof StatsDelta,
    delta: number
  ): Promise<void> {
    // 1. 更新数据库
    await this.db.incrementContentStats(contentId, { [field]: delta });

    // 2. 更新缓存
    const cached = this.cache.get(contentId);
    if (cached) {
      (cached.stats[field] as number) += delta;
      cached.stats.updatedAt = Date.now();
      
      // 重新计算互动率
      if (cached.stats.views > 0) {
        cached.stats.engagementRate = 
          (cached.stats.likes + cached.stats.comments + cached.stats.reposts) / cached.stats.views;
      }
    }
  }

  /**
   * 创建空统计
   */
  private createEmptyStats(contentId: string): InteractionStats {
    return {
      contentId,
      platformId: 'weibo', // 从内容获取
      likes: 0,
      favorites: 0,
      comments: 0,
      reposts: 0,
      views: 0,
      shares: 0,
      engagementRate: 0,
      updatedAt: Date.now(),
    };
  }
}
```

### 2.7 InteractionEventEmitter

事件发布器：

```typescript
class InteractionEventEmitter {
  private handlers: Map<string, Set<InteractionEventHandler>> = new Map();
  private allHandlers: Set<InteractionEventHandler> = new Set();
  private eventLog: InteractionEvent[] = [];
  private maxLogSize: number = 1000;

  /**
   * 发布事件
   */
  emit(event: InteractionEvent): void {
    // 1. 记录到日志
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // 2. 通知所有订阅者
    for (const handler of this.allHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[InteractionService] Event handler error:', error);
      }
    }

    // 3. 通知类型特定订阅者
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('[InteractionService] Event handler error:', error);
        }
      }
    }
  }

  /**
   * 订阅所有事件
   */
  onInteraction(handler: InteractionEventHandler): Unsubscribe {
    this.allHandlers.add(handler);
    return () => this.allHandlers.delete(handler);
  }

  /**
   * 订阅特定类型事件
   */
  on(type: InteractionType, handler: InteractionEventHandler): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    
    return () => this.handlers.get(type)?.delete(handler);
  }

  /**
   * 获取最近事件（用于调试）
   */
  getRecentEvents(limit: number = 50): InteractionEvent[] {
    return this.eventLog.slice(-limit);
  }
}
```

---

## 3. 数据流

### 3.1 点赞流程

```text
用户点击点赞 → UI 乐观更新 → InteractionService.like()
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓
  LikeManager.like()    StatsManager.increment()
         ↓                     ↓
  更新 UserInteraction    更新 ContentStats
         ↓                     ↓
         └──────────┬──────────┘
                    ↓
         EventEmitter.emit('like')
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
 粉丝服务       通知服务        社交引擎
 计算涨粉       发送通知        更新热度
```

### 3.2 评论流程

```text
用户提交评论 → CommentManager.comment()
                    ↓
              创建 Comment 对象
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓
   保存到 comments 表    更新 UserInteraction
         ↓                     ↓
  更新父评论回复数       StatsManager.increment()
         ↓                     ↓
         └──────────┬──────────┘
                    ↓
         EventEmitter.emit('comment')
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
 粉丝服务       通知服务        内容生成
 计算涨粉       通知作者        生成回复
```

### 3.3 浏览记录流程

```text
用户浏览内容 → 组件记录浏览时长 → ViewTracker.recordView()
                                        ↓
                           更新 UserInteraction.viewCount
                                        ↓
                           保存 ViewRecord（含快照）
                                        ↓
                           首次浏览时：StatsManager.increment()
                                        ↓
                           EventEmitter.emit('view')
```

---

## 4. 存储设计

### 4.1 IndexedDB 表结构

```typescript
// 数据库初始化
const db = await openDB('interaction-service', 1, {
  upgrade(db) {
    // 用户互动状态表
    const userInteractionsStore = db.createObjectStore('user_interactions', {
      keyPath: 'id', // `${userId}_${contentId}`
    });
    userInteractionsStore.createIndex('userId', 'userId');
    userInteractionsStore.createIndex('contentId', 'contentId');
    userInteractionsStore.createIndex('userId_platformId', ['userId', 'platformId']);
    userInteractionsStore.createIndex('userId_isLiked', ['userId', 'isLiked']);
    userInteractionsStore.createIndex('userId_isFavorited', ['userId', 'isFavorited']);

    // 内容统计表
    const contentStatsStore = db.createObjectStore('content_stats', {
      keyPath: 'contentId',
    });
    contentStatsStore.createIndex('platformId', 'platformId');
    contentStatsStore.createIndex('platformId_likes', ['platformId', 'likes']);

    // 评论表
    const commentsStore = db.createObjectStore('comments', {
      keyPath: 'id',
    });
    commentsStore.createIndex('contentId', 'contentId');
    commentsStore.createIndex('authorId', 'authorId');
    commentsStore.createIndex('parentId', 'parentId');
    commentsStore.createIndex('contentId_createdAt', ['contentId', 'createdAt']);

    // 浏览记录表
    const viewHistoryStore = db.createObjectStore('view_history', {
      keyPath: 'id',
    });
    viewHistoryStore.createIndex('userId', 'userId');
    viewHistoryStore.createIndex('userId_viewedAt', ['userId', 'viewedAt']);
    viewHistoryStore.createIndex('userId_platformId', ['userId', 'platformId']);

    // 收藏夹表
    const collectionsStore = db.createObjectStore('favorite_collections', {
      keyPath: 'id',
    });
    collectionsStore.createIndex('userId', 'userId');
    collectionsStore.createIndex('userId_isDefault', ['userId', 'isDefault']);

    // 收藏项表
    const favoriteItemsStore = db.createObjectStore('favorite_items', {
      keyPath: ['collectionId', 'contentId'],
    });
    favoriteItemsStore.createIndex('collectionId', 'collectionId');
    favoriteItemsStore.createIndex('contentId', 'contentId');
  },
});
```

### 4.2 数据清理策略

```typescript
class InteractionDataCleaner {
  /**
   * 清理过期数据
   */
  async cleanup(): Promise<void> {
    const now = Date.now();

    // 1. 清理超过 30 天的浏览记录
    await this.db.deleteViewHistoryBefore(now - 30 * 24 * 60 * 60 * 1000);

    // 2. 清理已删除内容的统计数据（需要与内容服务联动）
    // await this.cleanupOrphanedStats();

    // 3. 压缩事件日志
    await this.compressEventLog();
  }

  /**
   * 定期执行（每天一次）
   */
  scheduleCleanup(): void {
    setInterval(() => this.cleanup(), 24 * 60 * 60 * 1000);
  }
}
```

---

## 5. 性能优化

### 5.1 缓存策略

| 数据类型 | 缓存策略 | TTL |
|----------|----------|-----|
| 内容统计 | 内存缓存 + 懒加载 | 5 分钟 |
| 用户互动状态 | 按需加载 | 不缓存（直接查询） |
| 评论列表 | 分页查询 | 不缓存 |
| 浏览历史 | 分页查询 | 不缓存 |

### 5.2 批量操作

```typescript
// 批量获取统计（减少数据库查询）
const stats = await interactionService.batchGetStats([
  'post_001',
  'post_002',
  'post_003',
]);

// 批量检查点赞状态
const likeStatus = await interactionService.batchCheckLiked(
  ['post_001', 'post_002', 'post_003'],
  userId
);
```

### 5.3 乐观更新

```typescript
// 在 Store 中实现乐观更新
async function toggleLike(contentId: string) {
  // 1. 先更新 UI
  const currentState = likeState.value[contentId];
  likeState.value[contentId] = !currentState;

  try {
    // 2. 再调用服务
    if (!currentState) {
      await interactionService.like(contentId, userId);
    } else {
      await interactionService.unlike(contentId, userId);
    }
  } catch (error) {
    // 3. 失败时回滚
    likeState.value[contentId] = currentState;
    throw error;
  }
}
```

---

## 6. 相关文档

* [类型定义](./types.md)
* [使用示例](./usage.md)
* [平台扩展](./platform-extension.md)
* [系统集成](./integration.md)
