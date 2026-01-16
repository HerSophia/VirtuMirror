# 交互服务类型定义

> **版本**: v1.0  
> **最后更新**: 2026-01-16

本文档定义交互服务的核心类型。

---

## 1. 互动类型枚举

### 1.1 InteractionType

基础互动类型枚举：

```typescript
/**
 * 互动类型
 */
export type InteractionType =
  | 'like'       // 点赞
  | 'unlike'     // 取消点赞
  | 'favorite'   // 收藏
  | 'unfavorite' // 取消收藏
  | 'comment'    // 评论
  | 'repost'     // 转发
  | 'view'       // 浏览
  | 'share';     // 分享
```

### 1.2 互动类型分组

```typescript
/**
 * 积极互动类型（用于统计和涨粉计算）
 */
export const POSITIVE_INTERACTIONS: InteractionType[] = [
  'like',
  'favorite',
  'comment',
  'repost',
  'share',
];

/**
 * 可撤销的互动类型
 */
export const REVERSIBLE_INTERACTIONS: InteractionType[] = [
  'like',
  'favorite',
];

/**
 * 需要内容的互动类型
 */
export const CONTENT_REQUIRED_INTERACTIONS: InteractionType[] = [
  'comment',
  'repost',
];
```

---

## 2. 互动事件

### 2.1 InteractionEvent

互动事件的标准结构：

```typescript
/**
 * 互动事件
 * 当用户进行任何互动操作时触发
 */
export interface InteractionEvent {
  /** 事件唯一 ID */
  id: string;
  
  /** 互动类型 */
  type: InteractionType;
  
  /** 被互动的内容 ID */
  contentId: string;
  
  /** 内容类型（帖子/评论/文章等） */
  contentType?: ContentType;
  
  /** 执行互动的用户 ID */
  userId: string;
  
  /** 平台 ID */
  platformId: PlatformId;
  
  /** 事件发生时间戳 */
  timestamp: number;
  
  /** 额外元数据 */
  metadata?: InteractionMetadata;
}

/**
 * 内容类型
 */
export type ContentType = 
  | 'post'      // 帖子/博文
  | 'comment'   // 评论
  | 'article'   // 长文章
  | 'video'     // 视频
  | 'answer';   // 问答回答

/**
 * 平台 ID
 */
export type PlatformId = 
  | 'weibo'     // 微博
  | 'bilibili'  // B站
  | 'zhihu'     // 知乎
  | 'douyin'    // 抖音
  | 'wechat';   // 微信
```

### 2.2 InteractionMetadata

不同互动类型的元数据：

```typescript
/**
 * 互动元数据（根据互动类型不同而不同）
 */
export interface InteractionMetadata {
  // === 通用字段 ===
  /** 来源（首页/详情页/通知等） */
  source?: 'feed' | 'detail' | 'notification' | 'search' | 'profile';
  
  // === 评论相关 ===
  /** 评论内容（type = 'comment' 时） */
  commentText?: string;
  /** 回复的评论 ID */
  replyToCommentId?: string;
  /** 评论 ID（创建后填充） */
  commentId?: string;
  
  // === 转发相关 ===
  /** 转发时的附言 */
  repostText?: string;
  /** 转发后的帖子 ID */
  repostId?: string;
  
  // === 浏览相关 ===
  /** 浏览时长（秒） */
  viewDuration?: number;
  /** 滚动深度（0-1） */
  scrollDepth?: number;
  /** 是否完整阅读 */
  isCompleteRead?: boolean;
  
  // === 收藏相关 ===
  /** 收藏夹 ID */
  collectionId?: string;
  /** 收藏夹名称 */
  collectionName?: string;
  
  // === 分享相关 ===
  /** 分享目标 */
  shareTarget?: 'wechat' | 'qq' | 'weibo' | 'copy' | 'other';
  
  // === 平台特定数据 ===
  /** 平台特定的额外数据 */
  platformData?: Record<string, any>;
}
```

---

## 3. 用户互动状态

### 3.1 UserInteraction

用户对某内容的互动状态：

```typescript
/**
 * 用户互动状态
 * 记录某用户对某内容的所有互动情况
 */
export interface UserInteraction {
  /** 复合主键：userId + contentId */
  id: string;
  
  /** 用户 ID */
  userId: string;
  
  /** 内容 ID */
  contentId: string;
  
  /** 平台 ID */
  platformId: PlatformId;
  
  // === 互动状态 ===
  /** 是否已点赞 */
  isLiked: boolean;
  
  /** 点赞时间 */
  likedAt?: number;
  
  /** 是否已收藏 */
  isFavorited: boolean;
  
  /** 收藏时间 */
  favoritedAt?: number;
  
  /** 收藏夹 ID */
  collectionId?: string;
  
  // === 浏览记录 ===
  /** 浏览次数 */
  viewCount: number;
  
  /** 首次浏览时间 */
  firstViewAt?: number;
  
  /** 最后浏览时间 */
  lastViewAt?: number;
  
  /** 总浏览时长（秒） */
  totalViewDuration: number;
  
  // === 评论记录 ===
  /** 评论数量 */
  commentCount: number;
  
  /** 评论 ID 列表 */
  commentIds: string[];
  
  // === 时间戳 ===
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
}
```

### 3.2 UserInteractionSummary

用户互动汇总（用于个人中心）：

```typescript
/**
 * 用户互动汇总
 */
export interface UserInteractionSummary {
  /** 用户 ID */
  userId: string;
  
  /** 平台 ID（可选，不指定则为全平台） */
  platformId?: PlatformId;
  
  /** 点赞总数 */
  totalLikes: number;
  
  /** 收藏总数 */
  totalFavorites: number;
  
  /** 评论总数 */
  totalComments: number;
  
  /** 转发总数 */
  totalReposts: number;
  
  /** 浏览总数 */
  totalViews: number;
  
  /** 最后活跃时间 */
  lastActiveAt: number;
}
```

---

## 4. 内容互动统计

### 4.1 InteractionStats

内容的互动统计数据：

```typescript
/**
 * 内容互动统计
 */
export interface InteractionStats {
  /** 内容 ID */
  contentId: string;
  
  /** 平台 ID */
  platformId: PlatformId;
  
  // === 互动计数 ===
  /** 点赞数 */
  likes: number;
  
  /** 收藏数 */
  favorites: number;
  
  /** 评论数 */
  comments: number;
  
  /** 转发数 */
  reposts: number;
  
  /** 浏览数 */
  views: number;
  
  /** 分享数 */
  shares: number;
  
  // === 衍生指标 ===
  /** 互动率 = (likes + comments + reposts) / views */
  engagementRate?: number;
  
  /** 热度值（由 TrafficEngine 计算） */
  heatValue?: number;
  
  // === 时间戳 ===
  /** 最后更新时间 */
  updatedAt: number;
}
```

### 4.2 StatsDelta

统计增量（用于批量更新）：

```typescript
/**
 * 统计增量
 */
export interface StatsDelta {
  likes?: number;      // +1 或 -1
  favorites?: number;
  comments?: number;
  reposts?: number;
  views?: number;
  shares?: number;
}
```

---

## 5. 评论相关类型

### 5.1 Comment

评论数据结构：

```typescript
/**
 * 评论
 */
export interface Comment {
  /** 评论 ID */
  id: string;
  
  /** 所属内容 ID */
  contentId: string;
  
  /** 平台 ID */
  platformId: PlatformId;
  
  /** 评论者 ID */
  authorId: string;
  
  /** 评论内容 */
  text: string;
  
  // === 回复关系 ===
  /** 父评论 ID（如果是回复） */
  parentId?: string;
  
  /** 被回复的用户 ID */
  replyToUserId?: string;
  
  /** 层级（0 = 顶级评论） */
  depth: number;
  
  /** 回复数量 */
  replyCount: number;
  
  // === 互动数据 ===
  /** 点赞数 */
  likes: number;
  
  /** 是否被当前用户点赞 */
  isLikedByMe?: boolean;
  
  // === 状态 ===
  /** 是否已删除 */
  isDeleted: boolean;
  
  /** 是否置顶 */
  isPinned: boolean;
  
  /** 是否热评 */
  isHot: boolean;
  
  // === 时间戳 ===
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
}
```

### 5.2 CommentThread

评论树结构（用于展示）：

```typescript
/**
 * 评论树
 */
export interface CommentThread {
  /** 根评论 */
  root: Comment;
  
  /** 回复列表 */
  replies: Comment[];
  
  /** 是否有更多回复 */
  hasMoreReplies: boolean;
  
  /** 总回复数 */
  totalReplies: number;
}
```

---

## 6. 浏览记录

### 6.1 ViewRecord

浏览记录：

```typescript
/**
 * 浏览记录
 */
export interface ViewRecord {
  /** 记录 ID */
  id: string;
  
  /** 用户 ID */
  userId: string;
  
  /** 内容 ID */
  contentId: string;
  
  /** 平台 ID */
  platformId: PlatformId;
  
  /** 内容类型 */
  contentType: ContentType;
  
  // === 浏览数据 ===
  /** 浏览时长（秒） */
  duration: number;
  
  /** 滚动深度（0-1） */
  scrollDepth: number;
  
  /** 来源 */
  source: 'feed' | 'detail' | 'search' | 'recommendation' | 'profile';
  
  // === 内容快照 ===
  /** 内容标题（用于历史展示） */
  contentTitle?: string;
  
  /** 内容摘要 */
  contentSummary?: string;
  
  /** 作者名称 */
  authorName?: string;
  
  /** 封面图 */
  coverImage?: string;
  
  // === 时间戳 ===
  /** 浏览时间 */
  viewedAt: number;
}
```

### 6.2 ViewHistoryQuery

浏览历史查询参数：

```typescript
/**
 * 浏览历史查询参数
 */
export interface ViewHistoryQuery {
  /** 用户 ID */
  userId: string;
  
  /** 平台过滤 */
  platformId?: PlatformId;
  
  /** 内容类型过滤 */
  contentType?: ContentType;
  
  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };
  
  /** 最小浏览时长（秒） */
  minDuration?: number;
  
  /** 分页 */
  limit?: number;
  offset?: number;
  
  /** 排序 */
  sortBy?: 'viewedAt' | 'duration';
  sortOrder?: 'asc' | 'desc';
}
```

---

## 7. 收藏夹

### 7.1 FavoriteCollection

收藏夹：

```typescript
/**
 * 收藏夹
 */
export interface FavoriteCollection {
  /** 收藏夹 ID */
  id: string;
  
  /** 用户 ID */
  userId: string;
  
  /** 收藏夹名称 */
  name: string;
  
  /** 描述 */
  description?: string;
  
  /** 封面图 */
  coverImage?: string;
  
  /** 是否默认收藏夹 */
  isDefault: boolean;
  
  /** 是否公开 */
  isPublic: boolean;
  
  /** 收藏数量 */
  itemCount: number;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
}
```

### 7.2 FavoriteItem

收藏项：

```typescript
/**
 * 收藏项
 */
export interface FavoriteItem {
  /** 收藏夹 ID */
  collectionId: string;
  
  /** 内容 ID */
  contentId: string;
  
  /** 平台 ID */
  platformId: PlatformId;
  
  /** 备注 */
  note?: string;
  
  /** 收藏时间 */
  favoritedAt: number;
}
```

---

## 8. 服务配置类型

### 8.1 InteractionServiceConfig

服务配置：

```typescript
/**
 * 交互服务配置
 */
export interface InteractionServiceConfig {
  /** 是否启用事件广播 */
  enableEventBroadcast: boolean;
  
  /** 事件保留时间（毫秒） */
  eventRetentionMs: number;
  
  /** 浏览历史最大条数 */
  maxViewHistoryItems: number;
  
  /** 统计缓存时间（毫秒） */
  statsCacheTtlMs: number;
  
  /** 批量操作最大数量 */
  maxBatchSize: number;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: InteractionServiceConfig = {
  enableEventBroadcast: true,
  eventRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7 天
  maxViewHistoryItems: 1000,
  statsCacheTtlMs: 5 * 60 * 1000, // 5 分钟
  maxBatchSize: 100,
};
```

### 8.2 PlatformBehavior

平台扩展行为：

```typescript
/**
 * 平台扩展行为
 */
export interface PlatformBehavior {
  /** 平台 ID */
  platformId: PlatformId;
  
  /** 自定义互动行为 */
  customActions?: Record<string, CustomAction>;
  
  /** 互动权重配置（用于热度计算） */
  interactionWeights?: Partial<Record<InteractionType, number>>;
  
  /** 平台特定验证规则 */
  validators?: {
    canLike?: (contentId: string, userId: string) => boolean;
    canComment?: (contentId: string, userId: string) => boolean;
    canRepost?: (contentId: string, userId: string) => boolean;
  };
}

/**
 * 自定义互动行为
 */
export interface CustomAction {
  /** 行为名称 */
  name: string;
  
  /** 描述 */
  description: string;
  
  /** 执行函数 */
  execute: (contentId: string, userId: string, params?: any) => Promise<void>;
}
```

---

## 9. 事件订阅类型

### 9.1 InteractionEventHandler

事件处理器：

```typescript
/**
 * 互动事件处理器
 */
export type InteractionEventHandler = (event: InteractionEvent) => void;

/**
 * 类型化事件处理器
 */
export type TypedInteractionHandler<T extends InteractionType> = (
  event: InteractionEvent & { type: T }
) => void;

/**
 * 取消订阅函数
 */
export type Unsubscribe = () => void;
```

### 9.2 EventFilter

事件过滤器：

```typescript
/**
 * 事件过滤器
 */
export interface EventFilter {
  /** 只订阅特定类型 */
  types?: InteractionType[];
  
  /** 只订阅特定平台 */
  platforms?: PlatformId[];
  
  /** 只订阅特定内容 */
  contentIds?: string[];
  
  /** 只订阅特定用户的行为 */
  userIds?: string[];
}
```

---

## 10. 数据库表结构

### 10.1 IndexedDB 表定义

```typescript
/**
 * IndexedDB 表结构
 */
export interface InteractionDBSchema {
  /** 用户互动状态表 */
  user_interactions: UserInteraction;
  
  /** 内容统计表 */
  content_stats: InteractionStats;
  
  /** 评论表 */
  comments: Comment;
  
  /** 浏览记录表 */
  view_history: ViewRecord;
  
  /** 收藏夹表 */
  favorite_collections: FavoriteCollection;
  
  /** 收藏项表 */
  favorite_items: FavoriteItem;
  
  /** 事件日志表（用于调试和回放） */
  interaction_events: InteractionEvent;
}

/**
 * 索引定义
 */
export const DB_INDEXES = {
  user_interactions: [
    'userId',
    'contentId',
    '[userId+platformId]',
    '[userId+isLiked]',
    '[userId+isFavorited]',
  ],
  content_stats: [
    'platformId',
    '[platformId+likes]',
    '[platformId+views]',
  ],
  comments: [
    'contentId',
    'authorId',
    'parentId',
    '[contentId+createdAt]',
  ],
  view_history: [
    'userId',
    '[userId+viewedAt]',
    '[userId+platformId]',
  ],
  favorite_collections: [
    'userId',
    '[userId+isDefault]',
  ],
  favorite_items: [
    'collectionId',
    'contentId',
    '[collectionId+favoritedAt]',
  ],
  interaction_events: [
    'type',
    'contentId',
    'userId',
    'timestamp',
  ],
} as const;
```

---

## 相关文档

* [架构设计](./architecture.md)
* [使用示例](./usage.md)
* [平台扩展](./platform-extension.md)
* [系统集成](./integration.md)
