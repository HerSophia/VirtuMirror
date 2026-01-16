# 数据模型

## 1. 概述

社交引擎使用 IndexedDB（通过 Dexie.js）存储所有持久化数据。本文档定义了核心数据模型。

> **类型定义位置**: `src/types/social.ts`

## 2. 统一博文 (UniversalPost)

存储于 `socialPosts` 表。

```typescript
interface UniversalPost {
  // === 基础标识 ===
  id: string;
  platformId: string;           // 'weibo' | 'bilibili' | 'zhihu' | 'tieba'
  authorId: string;             // 关联 platformAccounts 表
  timestamp: number;            // 发布时间戳
  
  // === 类型系统（可选，兼容旧数据）===
  primaryType?: PrimaryContentType;
  contentFlags?: ContentFlags;
  
  // === 媒体资源（可选）===
  media?: MediaAsset[];
  
  // === 话题/标签 ===
  topicTags: string[];          // #话题#
  mentionedUsers?: string[];    // @用户
  
  // === 关联 ===
  superTopicId?: string;        // 超话 ID
  
  // === 统计数据 ===
  stats: UniversalStats;
  
  // === 通用载荷 ===
  payload: PostPayload;
  
  // === 平台特有数据 ===
  platformData?: Record<string, any>;
  
  // === 元信息 ===
  meta?: {
    source?: string;           // 发布来源
    editedAt?: number;         // 编辑时间
    isTop?: boolean;           // 置顶
    isPinned?: boolean;        // 精华
    visibility?: ContentVisibility;
  };
}
```

### 2.1 载荷结构 (PostPayload)

```typescript
interface PostPayload {
  // 文字内容（几乎所有类型都有）
  text?: string;
  
  // 标题（文章、视频、问题）
  title?: string;
  
  // 投票配置
  poll?: PollPayload;
  
  // 转发快照
  repost?: RepostSnapshot;
  
  // 外链卡片
  link?: LinkPayload;
  
  // 文章/长文
  article?: ArticlePayload;
  
  // 问答结构（知乎）
  question?: QuestionPayload;
  
  // === 兼容旧格式（逐步废弃）===
  /** @deprecated 使用 primaryType */
  type?: string;
  /** @deprecated 使用 primaryType */
  postType?: string;
  /** @deprecated 使用 media[] */
  images?: any[];
}
```

### 2.2 投票载荷 (PollPayload)

```typescript
interface PollPayload {
  question: string;
  options: {
    id: string;
    text: string;
    votes: number;
  }[];
  endTime: number;         // 截止时间戳
  multiSelect: boolean;    // 是否多选
  totalVotes?: number;     // 总票数
}
```

### 2.3 链接载荷 (LinkPayload)

```typescript
interface LinkPayload {
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;      // 缩略图描述
  source: string;          // 来源域名
}
```

### 2.4 文章载荷 (ArticlePayload)

```typescript
interface ArticlePayload {
  cover?: string;          // 封面图描述
  content: string;         // 正文（Markdown 或富文本）
  wordCount?: number;      // 字数
  readTime?: number;       // 预计阅读时间（分钟）
}
```

### 2.5 元信息 (PostMeta)

```typescript
interface PostMeta {
  source?: string;           // 发布来源（iPhone/Android/网页版）
  editedAt?: number;         // 最后编辑时间
  isTop?: boolean;           // 是否置顶
  isPinned?: boolean;        // 是否精华
  visibility?: ContentVisibility;
}

type ContentVisibility =
  | 'public'      // 公开
  | 'followers'   // 仅粉丝可见
  | 'mutual'      // 仅互关可见
  | 'private'     // 仅自己可见
  | 'members';    // 仅会员/付费可见
```

## 3. 统一评论 (UniversalComment)

存储于 `socialComments` 表。

```typescript
interface UniversalComment {
  id: string;
  postId: string;              // 关联的帖子 ID
  platformId: string;
  authorId: string;
  timestamp: number;
  
  // === 内容 ===
  text: string;
  media?: MediaAsset[];        // 评论带图/视频
  
  // === 回复关系 ===
  parentId?: string;           // 父评论 ID（楼中楼）
  replyToUserId?: string;      // 回复的用户 ID
  replyToUserName?: string;    // 回复的用户昵称（快照）
  
  // === 统计 ===
  stats: {
    likes: number;
    dislikes?: number;         // 踩（B站、知乎）
    replies?: number;          // 子回复数
  };
  
  // === 状态 ===
  isAuthorReply?: boolean;     // 是否是作者回复
  isTop?: boolean;             // 是否置顶
  isHot?: boolean;             // 是否热评
}
```

## 4. 热搜话题 (TrendingTopic)

存储于 `socialTopics` 表。

```typescript
interface TrendingTopic {
  id: string;
  platformId?: string;        // 可选，null 表示全平台
  keyword: string;            // "#某话题#"
  summary: string;            // 给 LLM 的背景描述
  
  // === 分类与标签 ===
  categories: TrendingCategory[];  // ['general', 'entertainment', ...]
  location?: string;               // 同城榜专用
  
  // === 热度参数 ===
  baseScore: number;          // 1-100，事件量级
  velocity: number;           // 增速系数
  peakTime: number;           // 预计峰值时间戳
  createdAt: number;          // 创建时间戳
  
  // === 显示属性（持久化）===
  isNew: boolean;             // "新" 标签
  isHot: boolean;             // "爆" 标签
  
  // === 运行时属性（计算得出，不持久化）===
  currentHeat?: number;       // 当前热度（由 TrafficEngine 计算）
}

type TrendingCategory = 
  | 'general' 
  | 'entertainment' 
  | 'game' 
  | 'tech' 
  | 'politics' 
  | 'life' 
  | 'sports';
```

## 5. 展示层类型 (DisplayPost)

用于 UI 渲染，继承 UniversalPost 并添加展示属性。

```typescript
/**
 * 带作者信息的展示帖子
 * 用于 UI 组件，无需再查询作者信息
 */
interface DisplayPost extends UniversalPost {
  // === 作者信息（展开后的）===
  author: PostAuthor;
  
  // === UI 展示属性 ===
  displayTime: string;         // 格式化后的时间
  imageUrls: string[];         // 图片 URL 或描述
  
  // === 交互状态 ===
  isFollowing?: boolean;       // 是否已关注
  isLiked?: boolean;           // 是否已点赞
  isFavorited?: boolean;       // 是否已收藏
}

/**
 * 帖子作者信息
 */
interface PostAuthor {
  id: string;
  name: string;
  avatar?: string;
  verified?: boolean;
  verifiedType?: 'personal' | 'org';
  vipLevel?: number;
}
```

## 6. 索引设计

### 6.1 socialPosts 表

```typescript
// Dexie schema
socialPosts: '++id, platformId, authorId, timestamp, [platformId+timestamp]'
```

| 索引 | 用途 |
| ---- | ---- |
| `id` | 主键查询 |
| `platformId` | 按平台筛选 |
| `authorId` | 查询用户的博文 |
| `timestamp` | 时间排序 |
| `[platformId+timestamp]` | 平台内时间排序 |

### 6.2 socialComments 表

```typescript
socialComments: '++id, postId, platformId, timestamp, [postId+timestamp]'
```

| 索引 | 用途 |
| ---- | ---- |
| `postId` | 获取帖子的评论 |
| `[postId+timestamp]` | 帖子评论按时间排序 |

### 6.3 socialTopics 表

```typescript
socialTopics: '++id, platformId, createdAt, [platformId+createdAt]'
```

| 索引 | 用途 |
| ---- | ---- |
| `platformId` | 按平台筛选热搜 |
| `createdAt` | 按创建时间排序 |

## 7. 查询模式

### 7.1 推荐：内存过滤

由于 Dexie 索引查询的兼容性问题，推荐使用内存过滤：

```typescript
// ✅ 推荐
const allTopics = await db.socialTopics.toArray();
const weiboTopics = allTopics.filter(t => t.platformId === 'weibo');

// ❌ 可能有问题
const topics = await db.socialTopics
  .where('platformId').equals('weibo')
  .toArray();
```

### 7.2 批量删除

```typescript
// 获取所有数据
const allTopics = await db.socialTopics.toArray();

// 过滤出目标 ID
const targetIds = allTopics
  .filter(t => t.platformId === 'weibo')
  .map(t => t.id);

// 批量删除
if (targetIds.length > 0) {
  await db.socialTopics.bulkDelete(targetIds);
}
```

### 7.3 分页查询

```typescript
async function getPostsPaginated(
  platformId: string,
  page: number,
  pageSize: number
): Promise<UniversalPost[]> {
  const allPosts = await db.socialPosts.toArray();
  
  return allPosts
    .filter(p => p.platformId === platformId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice((page - 1) * pageSize, page * pageSize);
}
```

## 8. 数据迁移

### 8.1 旧格式兼容

读取数据时需要兼容旧格式：

```typescript
/** 获取帖子的 primaryType */
function getPrimaryTypeFromPost(post: UniversalPost): PrimaryContentType {
  // 优先使用新字段
  if (post.primaryType) return post.primaryType;
  
  // 兼容旧字段
  const payload = post.payload as any;
  const legacyType = payload?.type || payload?.postType;
  
  if (legacyType) {
    return legacyType as PrimaryContentType;
  }
  
  // 根据内容推断
  if (payload?.poll) return 'poll';
  if (payload?.video) return 'video';
  if (payload?.repost) return 'repost';
  
  return 'text';
}

/** 获取帖子的图片列表 */
function getImagesFromPost(post: UniversalPost): string[] {
  // 优先使用新字段
  if (post.media?.length) {
    return post.media
      .filter(m => m.type === 'image')
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(m => m.url || m.description || '');
  }
  
  // 兼容旧格式
  const payload = post.payload as any;
  if (payload?.images) {
    return payload.images.map((img: any) =>
      typeof img === 'string' ? img : (img.url || img.description || '')
    );
  }
  
  return [];
}
```

### 8.2 写入时使用新格式

```typescript
const post: UniversalPost = {
  id: uuidv4(),
  platformId: 'weibo',
  authorId,
  timestamp: Date.now(),
  
  // 使用新字段
  primaryType: 'gallery',
  contentFlags: buildContentFlags(payload, media),
  media: [
    { id: 'img_0', type: 'image', description: '图片1', order: 0 },
    { id: 'img_1', type: 'image', description: '图片2', order: 1 },
  ],
  
  topicTags: ['#话题#'],
  stats: createDefaultStats(),
  
  // payload 中也保留（向后兼容）
  payload: {
    text: '博文内容',
    images: ['图片1', '图片2'],  // 兼容旧代码
  },
};
```
