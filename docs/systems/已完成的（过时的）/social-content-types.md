# 社交内容类型统一设计

> **版本**: 1.2
> **状态**: Phase 4 规划中
> **最后更新**: 2026-01-05
> **父文档**: [社交媒体模拟引擎](social-media-engine.md)

## 1. 概述

本文档定义了跨平台统一的社交内容数据模型。目标是让微博、B站、知乎、贴吧等不同平台共享同一套核心数据结构，同时保留各平台的特性扩展能力。

### 1.1 设计原则

1. **主类型 + 组合标记**：用 `primaryType` 标识主要展示形态，用 `contentFlags` 标记实际包含的组件
2. **平台特性下沉**：通用字段放顶层，平台特有字段放 `platformData`
3. **转发扁平化**：转发只保存一层快照，不递归引用
4. **媒体统一抽象**：图片、视频、音频使用统一的 `MediaAsset` 结构

---

## 2. 内容类型总览

### 2.1 跨平台内容类型对照

| 类型 | 微博 | B站 | 知乎 | 贴吧 | 说明 |
|------|------|-----|------|------|------|
| **图文** | 博文 | 动态 | 想法 | 帖子 | 最基础的类型，文字+可选图片 |
| **视频** | 视频博文 | 视频/动态视频 | 视频回答 | 视频帖 | 以视频为主，配文为辅 |
| **长文** | 头条文章 | 专栏 | 文章/回答 | 精品帖 | 有标题、封面、富文本正文 |
| **投票** | 投票 | 投票动态 | - | 投票帖 | 选项投票，有截止时间 |
| **转发** | 转发 | 转发动态 | - | - | 引用他人内容并评论 |
| **问答** | - | - | 问题+回答 | - | 知乎特有的结构 |
| **链接** | 网页卡片 | 链接动态 | 外链 | - | 分享外部链接 |
| **音频** | 语音动态 | 音频 | - | - | 音频内容 |
| **直播** | 直播预告 | 直播 | 直播 | - | 直播状态/回放 |
| **复合** | - | - | 图文视频混排 | - | 知乎回答常见 |

### 2.2 互动数据对照

| 互动类型 | 微博 | B站 | 知乎 | 贴吧 |
|----------|------|-----|------|------|
| 点赞 | ✅ | ✅ | ✅ 赞同 | ✅ |
| 踩/反对 | ❌ | ✅ | ✅ | ❌ |
| 评论 | ✅ | ✅ | ✅ | ✅ 回复 |
| 转发/分享 | ✅ | ✅ | ❌ | ❌ |
| 收藏 | ✅ | ✅ | ✅ | ❌（不显示） |
| 投币 | ❌ | ✅ | ❌ | ❌ |
| 弹幕 | ❌ | ✅ | ❌ | ❌ |
| 播放量 | ✅ | ✅| ✅ | ❌ |
| 阅读量 | ✅ 文章 | ✅ 专栏 | ✅ | ❌ |

---

## 3. 核心类型定义

### 3.1 主类型枚举 (PrimaryContentType)

```typescript
/**
 * 主内容类型
 * 用于 UI 展示、筛选、统计
 * 由各平台根据自己的规则判定
 */
type PrimaryContentType =
  | 'text'      // 文字为主（可能有少量图片）
  | 'gallery'   // 图片为主（九宫格、相册等）
  | 'video'     // 视频为主
  | 'article'   // 长文/文章
  | 'poll'      // 投票
  | 'repost'    // 转发/引用
  | 'link'      // 链接分享
  | 'audio'     // 音频
  | 'live'      // 直播（预告/进行中/回放）
  | 'question'  // 问题（知乎）
  | 'answer'    // 回答（知乎）
  | 'mixed';    // 复合内容（图文视频混排）
```

### 3.2 内容标记 (ContentFlags)

```typescript
/**
 * 内容组件标记
 * 表示帖子实际包含哪些类型的内容
 */
interface ContentFlags {
  hasText: boolean;      // 有文字内容
  hasImages: boolean;    // 有图片
  hasVideo: boolean;     // 有视频
  hasAudio: boolean;     // 有音频
  hasPoll: boolean;      // 有投票
  hasLink: boolean;      // 有外链
  hasRepost: boolean;    // 是转发
  hasArticle: boolean;   // 是长文
}
```

**设计说明**：

- `primaryType` 是「这条内容主要是什么」，用于 UI 展示模式选择
- `contentFlags` 是「这条内容包含什么」，用于精确判断需要渲染哪些组件
- 两者配合解决了「知乎回答可能同时有图片和视频」的复合类型问题

### 3.3 统一媒体资源 (MediaAsset)

```typescript
/**
 * 统一媒体资源
 * 图片、视频、音频使用同一结构
 */
interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  
  // === 描述层（当前主要使用） ===
  /** 用户输入的简短描述 */
  description: string;
  /** LLM 扩展后的详细描述 */
  expandedDescription?: string;
  /** 封面/缩略图描述（视频、音频用） */
  coverDescription?: string;
  
  // === 元数据 ===
  /** 时长（秒），视频/音频用 */
  duration?: number;
  /** 尺寸信息 */
  dimensions?: {
    width: number;
    height: number;
    aspectRatio?: string;  // 如 "16:9"
  };
  /** 排序索引（多图时） */
  order?: number;
  
  // === 实际资源（未来对接图像生成后使用） ===
  /** 实际 URL */
  url?: string;
  /** 缩略图 URL */
  thumbnailUrl?: string;
  /** 生成配置（对接图像生成服务用） */
  generationConfig?: {
    style?: string;
    seed?: number;
    model?: string;
  };
}
```

### 3.4 统一互动数据 (UniversalStats)

```typescript
/**
 * 统一互动统计
 * 通用字段 + 可选的平台特有字段
 */
interface UniversalStats {
  // === 基础互动（所有平台都有） ===
  likes: number;       // 点赞/喜欢/赞同
  comments: number;    // 评论数
  shares: number;      // 转发/分享数
  
  // === 可选互动（部分平台有） ===
  views?: number;      // 播放量/阅读量
  favorites?: number;  // 收藏数
  dislikes?: number;   // 踩/反对（B站、知乎）
  coins?: number;      // 投币（B站）
  danmaku?: number;    // 弹幕数（B站）
  thanks?: number;     // 感谢（知乎）
  tips?: number;       // 打赏/赞赏金额
}
```

### 3.5 转发快照 (RepostSnapshot)

```typescript
/**
 * 转发内容快照
 * 扁平化设计：只保存一层，不递归引用
 * 
 * 设计决策：
 * - 微博的「转发的转发」本质是纯文字内容
 * - 不允许通过转发回溯获取上层账号的其他信息
 * - 保存的是快照，原帖删除后仍可显示
 */
interface RepostSnapshot {
  /** 原帖 ID（可能已删除/不可访问） */
  originalPostId: string;
  
  /** 原作者快照（复制，非引用） */
  originalAuthor: {
    name: string;
    avatar?: string;       // 头像描述或 URL
    verified?: boolean;    // 是否认证
    verifiedType?: string; // 认证类型
    // 注意：不保存 authorId，不可回溯到账号详情
  };
  
  /** 原帖内容快照 */
  originalContent: {
    text: string;                    // 原文（可截断）
    primaryType: PrimaryContentType; // 原帖类型
    thumbnail?: string;              // 缩略图描述（视频/图片）
    timestamp: number;               // 原帖发布时间
  };
  
  /** 转发链信息（扁平化） */
  repostChain?: {
    depth: number;           // 第几层转发（1=直接转发，2=转发的转发）
    rootAuthorName?: string; // 最初发帖人昵称（可选）
  };
}
```

**扁平化示例**：

```
用户A 发帖: "今天天气真好"
    ↓
用户B 转发: "确实" + 引用A的帖子
    ↓
用户C 转发: "同意" + 引用B的转发
```

用户C的帖子数据：
```json
{
  "primaryType": "repost",
  "payload": {
    "text": "同意",
    "repost": {
      "originalPostId": "post-b",
      "originalAuthor": { "name": "用户B" },
      "originalContent": {
        "text": "确实 // @用户A: 今天天气真好",
        "primaryType": "repost"
      },
      "repostChain": {
        "depth": 2,
        "rootAuthorName": "用户A"
      }
    }
  }
}
```

---

## 4. 统一帖子结构 (UniversalPost)

```typescript
/**
 * 统一帖子/动态/博文结构
 * 存储于 IndexedDB socialPosts 表
 */
interface UniversalPost {
  // === 基础标识 ===
  id: string;
  platformId: string;           // 'weibo' | 'bilibili' | 'zhihu' | 'tieba'
  authorId: string;             // 关联 socialAccounts 表
  timestamp: number;            // 发布时间戳
  
  // === 类型系统 ===
  primaryType: PrimaryContentType;
  contentFlags: ContentFlags;
  
  // === 统计数据 ===
  stats: UniversalStats;
  
  // === 媒体资源 ===
  media: MediaAsset[];
  
  // === 话题/标签 ===
  topicTags: string[];          // #话题#
  mentionedUsers?: string[];    // @用户
  
  // === 通用载荷 ===
  payload: {
    // 文字内容（几乎所有类型都有）
    text?: string;
    
    // 标题（文章、视频、问题）
    title?: string;
    
    // 投票配置
    poll?: {
      question: string;
      options: {
        id: string;
        text: string;
        votes: number;
      }[];
      endTime: number;         // 截止时间戳
      multiSelect: boolean;    // 是否多选
      totalVotes?: number;     // 总票数
    };
    
    // 转发快照
    repost?: RepostSnapshot;
    
    // 外链卡片
    link?: {
      url: string;
      title: string;
      description?: string;
      thumbnail?: string;      // 缩略图描述
      source: string;          // 来源域名
    };
    
    // 文章/长文（富文本）
    article?: {
      cover?: string;          // 封面图描述
      content: string;         // 正文（Markdown 或富文本）
      wordCount?: number;      // 字数
      readTime?: number;       // 预计阅读时间（分钟）
    };
    
    // 问答结构（知乎）
    question?: {
      questionId: string;      // 关联的问题 ID
      questionTitle: string;   // 问题标题
    };
  };
  
  // === 平台特有数据 ===
  platformData?: Record<string, any>;
  
  // === 元信息 ===
  meta?: {
    source?: string;           // 发布来源（iPhone/Android/网页版）
    editedAt?: number;         // 最后编辑时间
    isTop?: boolean;           // 是否置顶
    isPinned?: boolean;        // 是否精华
    visibility?: ContentVisibility;
  };
}

/** 内容可见性 */
type ContentVisibility =
  | 'public'      // 公开
  | 'followers'   // 仅粉丝可见
  | 'mutual'      // 仅互关可见
  | 'private'     // 仅自己可见
  | 'members';    // 仅会员/付费可见
```

---

## 5. 统一评论结构 (UniversalComment)

```typescript
/**
 * 统一评论/回复结构
 * 存储于 IndexedDB socialComments 表
 */
interface UniversalComment {
  id: string;
  postId: string;              // 关联的帖子 ID
  platformId: string;
  authorId: string;
  timestamp: number;
  
  // === 内容 ===
  text: string;
  media?: MediaAsset[];        // 评论带图/视频（部分平台支持）
  
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

---

## 6. 平台类型判定规则

各平台根据内容自动判定 `primaryType` 的参考逻辑：

### 6.1 微博

```typescript
function getWeiboPrimaryType(flags: ContentFlags, media: MediaAsset[]): PrimaryContentType {
  if (flags.hasPoll) return 'poll';
  if (flags.hasRepost) return 'repost';
  if (flags.hasArticle) return 'article';
  if (flags.hasVideo) return 'video';
  
  const imageCount = media.filter(m => m.type === 'image').length;
  if (imageCount >= 4) return 'gallery';  // 4张及以上算图片帖
  
  return 'text';
}
```

### 6.2 B站

```typescript
function getBilibiliPrimaryType(flags: ContentFlags): PrimaryContentType {
  if (flags.hasVideo) return 'video';     // 视频优先级最高
  if (flags.hasArticle) return 'article'; // 专栏
  if (flags.hasRepost) return 'repost';
  if (flags.hasImages) return 'gallery';
  return 'text';
}
```

### 6.3 知乎

```typescript
function getZhihuPrimaryType(flags: ContentFlags, isAnswer: boolean): PrimaryContentType {
  if (isAnswer) {
    // 回答可能是复合类型
    if (flags.hasVideo && flags.hasImages) return 'mixed';
    if (flags.hasVideo) return 'video';
    return 'answer';
  }
  
  if (flags.hasArticle) return 'article';  // 专栏文章
  return 'text';  // 想法
}
```

---

## 7. 待定设计（远期 TODO）

以下功能暂不实现，但预留扩展点：

### 7.1 时效性内容

```typescript
// 📋 TODO: 限时可见、阅后即焚等
interface TemporalConfig {
  expiresAt?: number;          // 过期时间
  visibleDuration?: number;    // 可见时长（秒）
  selfDestruct?: boolean;      // 阅后即焚
}
```

### 7.2 付费内容

```typescript
// 📋 TODO: 付费可见、会员专享等
interface PaywallConfig {
  isPaid: boolean;
  price?: number;
  previewLength?: number;      // 免费预览字数
  purchasedBy?: string[];      // 已购买用户 ID
}
```

### 7.3 地理位置

```typescript
// 📋 TODO: 位置打卡、附近的人等
interface LocationInfo {
  name: string;                // 地点名称
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}
```

---

## 8. 迁移指南

### 8.1 从现有微博类型迁移

当前微博的 `WeiboPostType` 与新类型的对应关系：

| 旧类型 | 新 primaryType | 说明 |
|--------|----------------|------|
| `'text'` | `'text'` 或 `'gallery'` | 根据图片数量判定 |
| `'poll'` | `'poll'` | 直接对应 |
| `'video'` | `'video'` | 直接对应 |

### 8.2 字段映射

| 旧字段 | 新字段 | 说明 |
|--------|--------|------|
| `payload.postType` | `primaryType` | 提升到顶层 |
| `payload.images` | `media[]` | 转为 MediaAsset 数组 |
| `payload.poll` | `payload.poll` | 结构基本不变 |
| `payload.video` | `media[0]` + `payload.text` | 视频信息移到 media |

---

## 9. 现状分析与重构计划

> **分析时间**: 2024-01
> **最后更新**: 2026-01-05 (Phase 1 完成)
> **涉及文件**: `src/types/social.ts`, `src/apps/weibo/types.ts`, `src/apps/weibo/stores/*.ts`

### 9.1 发现的重复与不一致

#### 问题 1：双重类型定义

| 位置 | 类型 | 用途 | 问题 |
|------|------|------|------|
| `src/types/social.ts` | `UniversalPost` | 数据库存储 | payload 结构松散 |
| `src/apps/weibo/types.ts` | `WeiboPostUI` | UI 展示 | 需要手动转换 |
| `src/types/social.ts` | `UniversalComment` | 数据库存储 | 缺少媒体支持 |
| `src/apps/weibo/types.ts` | `WeiboCommentUI` | UI 展示 | 需要手动转换 |

**现状代码**（`feedStore.ts` 第 284-309 行）：
```typescript
// 每次都需要手动映射 UniversalPost → WeiboPostUI
async function mapPostsToUI(universalPosts: UniversalPost[]) {
  for (const p of universalPosts) {
    uiPosts.push({
      id: p.id,
      user: await getUserInfo(p.authorId),  // 额外查询
      time: formatTime(p.timestamp),
      content: p.payload.text || '',
      images: normalizeImages(p.payload.images),  // 格式转换
      likes: p.stats.likes,
      // ... 大量字段映射
    });
  }
}
```

#### 问题 2：payload 字段名不一致

```typescript
// 有时用 type
payload: { type: 'poll', ... }

// 有时用 postType  
payload: { postType: 'video', ... }

// feedStore 被迫做兼容
type: p.payload.type || p.payload.postType || 'text'
```

#### 问题 3：媒体资源格式混乱

```typescript
// 格式 A：字符串数组
payload.images: ['https://...', 'https://...']

// 格式 B：对象数组
payload.images: [{ description: '...', expandedDescription: '...' }]

// feedStore.normalizeImages() 被迫处理两种格式
function normalizeImages(images: any[]): string[] {
  return images.map((img: any) => {
    if (typeof img === 'string') { ... }
    if (typeof img === 'object') { ... }
  });
}
```

#### 问题 4：社交引擎尚未迁移到新账号系统

> **注意**：账号系统架构已完成（见 [account-service.md](account-service.md) Phase 1-4），但社交引擎组件尚未完全迁移。

| 组件 | 当前状态 | 需要迁移到 |
|------|----------|------------|
| `ContentFactory` | 使用 `social.ts` 的 `PlatformAccount` | `account.ts` 的 `PlatformAccount` |
| `UserPool` | 写入 `db.socialAccounts` | 写入 `db.platformAccounts` |
| `feedStore` | 需要 fallback 兼容两个系统 | 仅使用新系统 |

**过渡期兼容代码**（`feedStore.ts` 第 253-279 行）：
```typescript
async function getUserInfo(authorId: string): Promise<WeiboUser> {
  // 先尝试新系统（玩家创建的账号）
  const platformAccount = await accountService.getPlatformAccount(authorId);
  if (platformAccount) { return ...; }
  
  // fallback 到旧系统（LLM 生成的账号，ContentFactory 仍在使用）
  const socialAccount = await db.socialAccounts.get(authorId);
  return { ... };
}
```

**根本原因**：`ContentFactory.generateComments()` 仍然调用 `UserPool.captureShadowAccount()` 写入旧表。

#### 问题 5：微博特有类型分散

| 类型 | 位置 | 说明 |
|------|------|------|
| `WeiboPostType` | `weibo/types.ts` | `'text' \| 'poll' \| 'video'` |
| `WeiboPollConfig` | `weibo/types.ts` | 投票配置 |
| `WeiboVideoConfig` | `weibo/types.ts` | 视频配置 |
| `WeiboImageConfig` | `weibo/types.ts` | 图片配置 |
| `WeiboPlatformData` | `weibo/types.ts` | 平台特有数据 |
| `ComposePostData` | `weibo/types.ts` | 发布数据 |
| `WeiboDraft` | `weibo/types.ts` | 草稿 |

这些类型与 `UniversalPost.payload` 的关系不明确，导致：
- `composeStore.publishPost()` 需要手动构建 payload
- `feedStore.normalizePoll()` 需要处理格式转换

---

### 9.2 重构目标

```
┌─────────────────────────────────────────────────────────────┐
│                     重构前                                   │
├─────────────────────────────────────────────────────────────┤
│  types/social.ts          apps/weibo/types.ts               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ UniversalPost│ ──?──▶  │ WeiboPostUI  │                  │
│  │ (松散payload)│         │ (UI专用)     │                  │
│  └──────────────┘         └──────────────┘                  │
│         │                        │                          │
│         ▼                        ▼                          │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │socialAccounts│         │WeiboUser     │                  │
│  │(旧账号系统)  │         │(UI专用)      │                  │
│  └──────────────┘         └──────────────┘                  │
│         +                                                   │
│  ┌──────────────┐                                           │
│  │platformAccts │                                           │
│  │(新账号系统)  │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     重构后                                   │
├─────────────────────────────────────────────────────────────┤
│  types/social.ts (统一数据层)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ UniversalPost                                        │   │
│  │ ├─ primaryType: PrimaryContentType                   │   │
│  │ ├─ contentFlags: ContentFlags                        │   │
│  │ ├─ media: MediaAsset[]                               │   │
│  │ ├─ stats: UniversalStats                             │   │
│  │ ├─ payload: { text, poll?, repost?, link?, ... }     │   │
│  │ └─ platformData?: { weibo?: WeiboPlatformPayload }   │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  apps/weibo/ (薄 UI 层，只做渲染适配)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 直接使用 UniversalPost，无需 WeiboPostUI              │   │
│  │ 通过 computed 计算 UI 所需的派生属性                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  types/account.ts (统一账号系统)                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CharacterEntity + PlatformAccount                    │   │
│  │ 废弃 socialAccounts/socialIdentities                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

### 9.3 重构步骤（建议顺序）

#### Phase 1：统一 payload 结构（低风险）✅ 已完成

**目标**：确保所有新创建的博文使用一致的 payload 格式

**已完成的工作**：

1. ✅ 在 `types/social.ts` 中定义完整的类型系统：
   - `PrimaryContentType` - 主内容类型枚举
   - `ContentFlags` - 内容组件标记
   - `MediaAsset` - 统一媒体资源
   - `UniversalStats` - 统一互动统计
   - `RepostSnapshot` - 转发快照
   - `PostPayload` - 统一载荷结构
   - `PollPayload`, `VideoPayload`, `LinkPayload`, `ArticlePayload` - 各类型载荷

2. ✅ 更新 `composeStore.publishPost()` 使用新结构：
   - 设置 `UniversalPost.primaryType` 
   - 设置 `UniversalPost.contentFlags`
   - 设置 `UniversalPost.media` (MediaAsset[])
   - 同时保留 `payload.images` 用于向后兼容

3. ✅ 在 `feedStore` 中保留兼容层：
   - `getPrimaryTypeFromPost()` - 优先读取 `primaryType`，兼容 `payload.type/postType`
   - `getImagesFromPost()` - 优先读取 `media`，兼容 `payload.images`
   - `mapSinglePostToUI()` - 统一的转换逻辑

4. ✅ 添加工具函数：
   - `createDefaultContentFlags()` - 创建默认标记
   - `createDefaultStats()` - 创建默认统计
   - `getWeiboPrimaryType()` - 微博类型判定
   - `buildContentFlags()` - 从 payload 构建标记
   - `convertImagesToMediaAssets()` - 旧格式转换

```typescript
// types/social.ts 已实现
interface PostPayload {
  text?: string;
  title?: string;
  poll?: PollPayload;
  video?: VideoPayload;
  repost?: RepostSnapshot;
  link?: LinkPayload;
  article?: ArticlePayload;
  question?: QuestionPayload;
  
  // 兼容旧格式（逐步废弃）
  type?: string;     // @deprecated
  postType?: string; // @deprecated
  images?: ...;      // @deprecated
}

// UniversalPost 新增字段
interface UniversalPost {
  // ... 原有字段 ...
  primaryType?: PrimaryContentType;  // 新增
  contentFlags?: ContentFlags;       // 新增
  media?: MediaAsset[];              // 新增
  meta?: { ... };                    // 新增
}
```

#### Phase 2：社交引擎迁移到新账号系统（中风险）✅ 已完成

> **前置条件**：账号系统架构已完成（见 [account-service.md](account-service.md)）
> **完成时间**: 2026-01-05

**目标**：让社交引擎组件使用新的 `platformAccounts` 表，废弃 `socialAccounts`

**已完成的工作**：

1. ✅ 更新 `ContentFactory` 使用新账号系统：
   - 使用 `accountService.createEntity()` 创建 NPC 实体
   - 使用 `accountService.createPlatformAccount()` 创建平台账号
   - 评论者通过 `ensureCommentAuthorAccount()` 自动创建

2. ✅ 更新 `feedStore.getUserInfo()` 统一使用新系统：
   - 移除对 `db.socialAccounts` 的 fallback
   - 通过 `accountService.getPlatformAccount()` 获取账号
   - 添加 `ensureCommenterAccount()` 辅助函数

3. ✅ 标记旧版 `src/services/social/userPool.ts` 为 deprecated：
   - 所有方法添加废弃警告
   - 转发调用到新的账号系统
   - 计划在 v2.0 删除

4. ✅ 新版 UserPool 位于 `src/services/account/userPool.ts`：
   - 纯粹的用户生成器，不负责存储
   - 支持生成随机用户档案、完整画像、批量生成

| 组件 | 变更内容 |
|------|----------|
| `ContentFactory` | 导入 `account.ts` 的类型，调用 `accountService` |
| `UserPool` | 重构为 `accountService` 的辅助函数，写入 `platformAccounts` |
| `feedStore.getUserInfo()` | 移除 fallback 逻辑，仅使用 `accountService` |
| `db.socialAccounts` | 标记为 deprecated，计划在 v2.0 删除 |

**迁移脚本**（一次性运行）：
```typescript
async function migrateSocialAccounts() {
  const oldAccounts = await db.socialAccounts.toArray();
  for (const old of oldAccounts) {
    // 1. 创建 CharacterEntity (session 级)
    const entity = await accountService.createEntity({
      type: 'npc',
      source: 'social',
      displayName: old.nickname,
      scope: 'session',
      // ...
    });
    // 2. 创建 PlatformAccount
    await accountService.createPlatformAccount(entity.id, old.platformId, {
      handle: old.handle,
      nickname: old.nickname,
      // ...
    });
  }
}
```

#### Phase 3：消除 UI 类型（高收益）✅ 已完成

> **开始时间**: 2026-01-05
> **完成时间**: 2026-01-05
> **状态**: 已完成，`WeiboPostUI` 已废弃

**目标**：移除 `WeiboPostUI`、`WeiboCommentUI`，直接使用 `UniversalPost`

**已完成的工作**：

1. ✅ 在 `types/social.ts` 中添加展示层类型：
   - `PostAuthor` - 帖子作者信息（UI 展示层）
   - `DisplayPost` - 带作者信息的展示帖子
   - `DisplayComment` - 带作者信息的展示评论

2. ✅ 添加展示层工具函数：
   - `formatRelativeTime()` - 格式化相对时间
   - `getImageUrlsFromMedia()` - 从 MediaAsset 生成图片 URL
   - `normalizeImagesFromPayload()` - 兼容旧格式
   - `getPrimaryTypeFromPost()` - 获取帖子主类型
   - `getImagesFromPost()` - 获取帖子图片列表

3. ✅ 创建 `usePostDisplay` composable：
   - 位置：`src/apps/weibo/composables/usePostDisplay.ts`
   - 提供从 `UniversalPost` 到 UI 属性的 computed 转换
   - 支持 `DisplayPost` 输入类型

4. ✅ 修复 `WeiboUser.verifiedType` 类型错误：
   - 移除 `'blue'` 类型，统一为 `'personal' | 'org'`
   - 更新 feedStore 中的映射逻辑

5. ✅ 重构 `feedStore` 完全使用 `DisplayPost`：
   - 移除 `posts` 状态，只保留 `displayPosts`
   - 移除 `mapSinglePostToUI()` 和 `mapPostsToUI()` 函数
   - 使用 `mapSinglePostToDisplay()` 和 `mapPostsToDisplay()`
   - 所有方法改用 `DisplayPost` 属性 (`post.stats.likes`, `post.author.id` 等)

6. ✅ 更新 `WeiboPost.vue` 使用 `DisplayPost` 类型：
   - 组件 props 定义为 `DisplayPost`
   - 使用 `usePostDisplay` composable
   - 直接访问 `post.author.*`, `post.stats.*` 等属性

7. ✅ 更新 `PostActionSheet.vue` 支持 `DisplayPost`：
   - 使用 `post.author.*` 获取作者信息
   - 模板使用 computed 属性

8. ✅ 更新 `WeiboHome.vue` 使用 `displayPosts`：
   - 从 weiboStore 获取 `displayPosts` 而非 `posts`
   - 模板中遍历 `displayPosts`

9. ✅ 更新 `weiboStore.ts`（兼容层）：
   - 代理 `feedStore.displayPosts` 而非 `posts`
   - 移除 `WeiboPostUI` 类型导入

10. ✅ 标记 `WeiboPostUI` 为 @deprecated：
    - 在类型定义中添加废弃注释
    - 保留用于 mockData.ts 遗留代码
    - 计划在 v2.0 完全移除

**类型映射关系**：

| 旧 (WeiboPostUI) | 新 (DisplayPost) |
|------------------|------------------|
| `post.user.id` | `post.author.id` |
| `post.user.name` | `post.author.name` |
| `post.likes` | `post.stats.likes` |
| `post.comments` | `post.stats.comments` |
| `post.shares` | `post.stats.shares` |
| `post.content` | `post.payload.text` |
| `post.images` | `post.imageUrls` |
| `post.time` | `post.displayTime` |

**遗留项**（不影响功能，低优先级清理）：

- [ ] 移除 `mockData.ts` 中的 `WeiboPostUI` 使用
- [ ] 在 v2.0 删除 `WeiboPostUI` 类型定义

**使用示例**：

```typescript
// WeiboPost.vue - 组件直接使用 DisplayPost
import type { DisplayPost } from '@/types/social';
import { usePostDisplay } from '../composables/usePostDisplay';

const props = defineProps<{ post: DisplayPost }>();

// 直接访问 DisplayPost 属性
const authorName = computed(() => props.post.author.name);
const likes = computed(() => props.post.stats.likes);
const content = computed(() => props.post.payload.text || '');
const images = computed(() => props.post.imageUrls);

// 使用 composable 获取派生属性
const { formattedContent, primaryType, poll, video } = usePostDisplay(toRef(props, 'post'));
```

```typescript
// feedStore.ts - Store 返回 DisplayPost
const displayPosts = ref<DisplayPost[]>([]);

async function mapSinglePostToDisplay(p: UniversalPost): Promise<DisplayPost> {
  const userInfo = await getUserInfo(p.authorId);
  
  const author: PostAuthor = {
    id: userInfo.id,
    name: userInfo.name,
    avatar: userInfo.avatar,
    verified: userInfo.verified,
    verifiedType: userInfo.verifiedType,
    vipLevel: userInfo.vipLevel,
  };
  
  return {
    ...p,
    author,
    displayTime: formatTime(p.timestamp),
    imageUrls: getImagesFromPost(p),
    isFollowing: false,
  };
}
```

#### Phase 6：实现转发快照（新功能）

1. 实现 `RepostSnapshot` 结构
2. 添加转发 UI 组件
3. 在 `feedStore` 中添加转发方法

---

### 9.4 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types/social.ts` | **重写** | 实现本文档定义的类型 |
| `src/apps/weibo/types.ts` | **精简** | 只保留 UI 配置类型，移除数据类型 |
| `src/apps/weibo/stores/feedStore.ts` | **重构** | 移除 mapPostsToUI，直接返回 UniversalPost |
| `src/apps/weibo/stores/composeStore.ts` | **更新** | 使用新的 payload 结构 |
| `src/services/social/contentFactory.ts` | **更新** | 生成符合新结构的数据 |
| `src/services/database/schema.ts` | **更新** | 标记旧表 deprecated |
| `src/apps/weibo/components/*.vue` | **更新** | 适配新的数据结构 |

### 9.5 保留的微博特有类型

以下类型保留在 `src/apps/weibo/types.ts`，因为它们是 UI 配置而非数据模型：

```typescript
// UI 展示配置
export interface HotSearchItem { ... }  // 热搜榜 UI
export interface StoryItem { ... }      // Stories UI
export interface MessageItem { ... }    // 消息列表 UI

// 认证系统（微博特有）
export type WeiboVerifyType = ...;
export interface VerifyTypeConfig { ... };
export const VERIFY_TYPE_CONFIGS = [...];

// 草稿（本地存储，不入 DB）
export interface WeiboDraft { ... };

// 发布表单状态（非持久化）
export interface ComposeFormState { ... };
```

---

## 10. Phase 4：提示词适配重构

> **状态**: ✅ 已完成
> **完成时间**: 2026-01-05
> **优先级**: 高（当前提示词与新数据结构存在多处不匹配）
> **涉及文件**: `src/apps/weibo/prompts.ts`, `src/apps/weibo/stores/llm/outputHandlers.ts`, `src/apps/weibo/stores/llm/postTransformer.ts`

### 10.1 问题分析：提示词输出与新架构不匹配

当前微博提示词定义（`src/apps/weibo/prompts.ts`）生成的数据格式与本文档定义的 `UniversalPost` 新结构存在以下不一致：

#### 问题 1：类型字段命名不统一

| 方面 | 提示词当前输出 | 新架构要求 | 差距 |
|------|---------------|-----------|------|
| 类型字段 | `type: 'text'/'poll'/'video'` | `primaryType: PrimaryContentType` | 字段名不同 |
| 类型值 | 只有 3 种 | 支持 12 种 | 缺少 gallery/repost/link 等 |

**当前提示词输出示例**（`social.post.generate.weibo`）:
```json
{
  "type": "text",
  "text": "博文正文",
  "images": [{"description": "图片描述"}],
  "authorName": "作者昵称"
}
```

**应该输出的格式**:
```json
{
  "primaryType": "gallery",
  "payload": {
    "text": "博文正文"
  },
  "media": [
    {
      "id": "img_0",
      "type": "image",
      "description": "图片描述",
      "order": 0
    }
  ],
  "authorName": "作者昵称"
}
```

#### 问题 2：媒体资源格式不匹配

| 当前格式 | 新架构 (MediaAsset) |
|----------|--------------------|
| `images: [{description}]` | `media: MediaAsset[]` |
| 无 `id` 字段 | 必须有 `id` |
| 无 `type` 字段 | 必须指定 `'image'/'video'/'audio'` |
| 无 `order` 字段 | 多图时需要排序 |

#### 问题 3：投票/视频载荷结构差异

**投票 - 当前输出**:
```json
{
  "poll": {
    "question": "问题",
    "options": ["选项A", "选项B"],
    "duration": 24,
    "multiSelect": false
  }
}
```

**投票 - 新架构要求**:
```json
{
  "payload": {
    "poll": {
      "question": "问题",
      "options": [
        {"id": "opt_0", "text": "选项A", "votes": 0},
        {"id": "opt_1", "text": "选项B", "votes": 0}
      ],
      "endTime": 1704067200000,
      "multiSelect": false,
      "totalVotes": 0
    }
  }
}
```

**视频 - 类似问题**: 当前直接放在顶层 `video` 字段，应该放在 `payload.video` 或 `media[0]`。

#### 问题 4：outputHandlers 使用旧账号系统

`src/apps/weibo/stores/llm/outputHandlers.ts` 中的 `saveSinglePostToDatabase` 和 `saveBatchPostsToDatabase` 函数:

```typescript
// ❌ 当前代码 (第 157-178 行)
await db.socialAccounts.add({
  id: authorId,
  platformId: 'weibo',
  nickname: authorName,
  handle: `user_${authorId.slice(0, 8)}`,
  origin: 'llm_generated',
  persistence: 'permanent',
  persona: { prompt: '', tone: 'casual' },
});

// ✅ 应该使用新账号系统
const entity = await accountService.createEntity({
  type: 'npc',
  displayName: authorName,
  source: 'social',
  scope: 'session',
});
const account = await accountService.createPlatformAccount(entity.id, 'weibo', {
  handle: `user_${entity.id.slice(0, 8)}`,
  nickname: authorName,
});
```

#### 问题 5：保存的博文缺少新字段

`outputHandlers.ts` 创建的 `universalPost` 对象:

```typescript
// 当前代码 (第 253-266 行)
const universalPost = {
  id: postId,
  platformId: 'weibo',
  authorId,
  timestamp: now,
  topicTags,
  payload,
  stats: { views, likes, comments, shares },
};

// 缺少的字段:
// - primaryType: PrimaryContentType
// - contentFlags: ContentFlags
// - media: MediaAsset[]
// - meta: { source, visibility, ... }
```

### 10.2 重构步骤

#### Step 1：更新提示词输出格式规范

修改 `src/apps/weibo/prompts.ts`，让 LLM 输出符合新架构的 JSON：

```typescript
// social.post.generate.weibo 的 systemPrompt 应更新为：
systemPrompt: `你是一个微博资深用户。
请输出纯 JSON 格式，结构如下：

【文字/图文帖】
{
  "primaryType": "text" 或 "gallery"(4张图以上),
  "payload": {
    "text": "博文正文(含emoji和话题)"
  },
  "media": [
    {
      "id": "img_0",
      "type": "image",
      "description": "图片描述",
      "order": 0
    }
  ],
  "authorName": "作者昵称"
}

【投票帖】
{
  "primaryType": "poll",
  "payload": {
    "text": "投票引导文案",
    "poll": {
      "question": "投票问题",
      "options": [
        {"id": "opt_0", "text": "选项1", "votes": 0},
        {"id": "opt_1", "text": "选项2", "votes": 0}
      ],
      "duration": 24,
      "multiSelect": false
    }
  },
  "authorName": "作者昵称"
}

【视频帖】
{
  "primaryType": "video",
  "payload": {
    "text": "视频介绍文案"
  },
  "media": [
    {
      "id": "video_0",
      "type": "video",
      "description": "视频内容描述",
      "coverDescription": "封面画面描述",
      "duration": 60
    }
  ],
  "authorName": "作者昵称"
}`
```

#### Step 2：创建提示词输出转换层

在 `src/apps/weibo/stores/llm/` 下新建 `postTransformer.ts`：

```typescript
/**
 * 将 LLM 输出转换为 UniversalPost 格式
 * 支持新旧两种输出格式的兼容
 */
export function transformLLMOutputToUniversalPost(
  output: any,
  authorId: string,
  timestamp: number
): Partial<UniversalPost> {
  // 1. 类型判定
  const primaryType = output.primaryType 
    || legacyTypeMapping[output.type] 
    || 'text';
  
  // 2. 媒体资源转换
  const media = output.media 
    || convertLegacyImages(output.images)
    || [];
  
  // 3. 构建 contentFlags
  const contentFlags = buildContentFlags(output.payload || output, media);
  
  // 4. 载荷标准化
  const payload = normalizePayload(output, primaryType);
  
  return {
    primaryType,
    contentFlags,
    media,
    payload,
    authorId,
    timestamp,
    // ... 其他字段
  };
}

const legacyTypeMapping: Record<string, PrimaryContentType> = {
  'text': 'text',
  'poll': 'poll',
  'video': 'video',
};
```

#### Step 3：迁移 outputHandlers 到新账号系统

```typescript
// src/apps/weibo/stores/llm/outputHandlers.ts

import { accountService } from '@/services/account/accountService';

/**
 * 确保作者账号存在（使用新账号系统）
 */
async function ensureAuthorAccount(
  platformId: string,
  authorName: string
): Promise<string> {
  // 1. 查找现有账号
  const existingAccounts = await accountService.getAccountsByPlatform(platformId);
  const existing = existingAccounts.find(acc => acc.nickname === authorName);
  if (existing) return existing.id;
  
  // 2. 创建新账号
  const entity = await accountService.createEntity({
    type: 'npc',
    displayName: authorName,
    source: 'social',
    scope: 'session',
  });
  
  const account = await accountService.createPlatformAccount(
    entity.iId,
    {
      handle: `user_${entity.id.slice(0, 8)}`,
      nickname: authorName,
    }
  );
  
  return account.id;
}
```

#### Step 4：更新 saveSinglePostToDatabase

```typescript
export async function saveSinglePostToDatabase(
  jsonOutput: string,
  taskId: string,
  addLog: LogFunction
): Promise<SinglePostResult> {
  const parsed = JSON.parse(cleanJsonOutput(jsonOutput));
  
  // 使用转换层
  const authorId = await ensureAuthorAccount('weibo', parsed.authorName);
  const postData = transformLLMOutputToUniversalPost(
    parsed,
    authorId,
    Date.now()
  );
  
  // 补充必要字段
  const universalPost: UniversalPost = {
    id: uuidv4(),
    platformId: 'weibo',
    ...postData,
    topicTags: extractTopicTags(postData.payload?.text),
    stats: createDefaultStats(),
    meta: {
      source: 'llm_generated',
      visibility: 'public',
    },
  };
  
  await db.socialPosts.add(universalPost);
  return { success: true, postId: universalPost.id, type: postData.primaryType };
}
```

### 10.3 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/apps/weibo/prompts.ts` | **更新** | 更新 systemPrompt 指导 LLM 输出新格式 |
| `src/apps/weibo/stores/llm/postTransformer.ts` | **新增** | LLM 输出到 UniversalPost 的转换层 |
| `src/apps/weibo/stores/llm/outputHandlers.ts` | **重构** | 迁移到新账号系统，使用转换层 |
| `src/services/social/contentFactory.ts` | **更新** | 输出格式与提示词保持一致 |
| `src/apps/weibo/chains.ts` | **更新** | 链的后处理使用转换层 |

### 10.5 已完成的工作

1. ✅ 创建 `postTransformer.ts` - LLM 输出转换层：
   - `transformLLMOutputToUniversalPost()` - 统一转换入口
   - `transformBatchLLMOutput()` - 批量转换
   - `convertLegacyImages()` - 旧格式图片转换
   - `convertLegacyPoll()` - 旧格式投票转换
   - `convertLegacyVideo()` - 旧格式视频转换
   - `validateLLMOutput()` - 输出验证
   - `generateRandomStats()` - 随机统计数据生成

2. ✅ 更新 `outputHandlers.ts`：
   - 使用 `accountService` 创建作者账号（`ensureAuthorAccount()`）
   - 使用转换层统一处理 LLM 输出
   - 保存的博文包含 `primaryType`、`contentFlags`、`media` 字段
   - 评论者账号也通过新系统创建
   - 添加回退逻辑，兼容旧系统

3. ✅ 更新 `prompts.ts`：
   - 更新 `social.post.generate.weibo` 提示词输出格式
   - 支持 `primaryType` + `payload` + `media` 新结构
   - 区分 text（少于4图）和 gallery（4图及以上）
   - 投票选项格式改为 `{id, text, votes}` 对象数组

4. ✅ 导出新模块：
   - 在 `stores/llm/index.ts` 导出转换层所有函数和类型

### 10.6 测试检查点

- [x] 新提示词能生成符合 `UniversalPost` 结构的 JSON
- [x] 保存的博文包含 `primaryType`、`contentFlags`、`media` 字段
- [x] 作者账号通过 `accountService` 创建，存在于 `platformAccounts` 表
- [x] `feedStore` 能正确渲染新格式博文（Phase 3 已完成）
- [x] 投票帖的 `endTime` 正确计算
- [x] 视频帖的 `media[0].type === 'video'`
- [x] 兼容旧格式输出（type + text + images）

---

## 11. Phase 5：解析器分发架构（总部-分部）

> **状态**: ✅ 已完成
> **完成时间**: 2026-01-05
> **优先级**: 高（解决复合型 LLM 输出的解析问题）
> **目标**: 一次 LLM 调用生成多种内容（博文+评论+热搜+转发）时，能自动识别并分发到对应解析器

### 11.1 问题背景

当前 `outputHandlers.ts` 使用 switch-case 架构：

```typescript
// ❌ 当前问题
switch (handler) {
  case 'hot-list': /* 只处理热搜 */ break;
  case 'batch-posts': /* 只处理博文 */ break;
  case 'engagement': /* 处理评论+统计，但逻辑固化 */ break;
}
```

**局限性**：
- 每种组合都需要新 handler（组合爆炸）
- 逻辑重复（账号创建、保存博文的代码散落各处）
- 复合输出难处理（一次 LLM 调用生成多种内容）

### 11.2 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM 复合输出                                  │
│  {                                                              │
│    "hotSearches": [...],                                        │
│    "posts": [...],                                              │
│    "comments": [...],                                           │
│    "reposts": [...]                                             │
│  }                                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ContentDispatcher（总部）                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. 解析 JSON                                                ││
│  │ 2. 识别顶层 key（posts/comments/hotSearches/...）           ││
│  │ 3. 拓扑排序（依赖优先：users → posts → comments）           ││
│  │ 4. 分发到对应 Parser                                        ││
│  │ 5. 收集结果 & 处理 tempId 映射                              ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ PostParser    │   │ CommentParser │   │ HotSearchParser│
│ (分部)        │   │ (分部)        │   │ (分部)         │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ aliases:      │   │ aliases:      │   │ aliases:       │
│  posts, weibo │   │  comments     │   │  hotSearches   │
│               │   │               │   │  trending      │
│ deps: [users] │   │ deps: [posts] │   │ deps: []       │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ validate()    │   │ validate()    │   │ validate()     │
│ transform()   │   │ transform()   │   │ transform()    │
│ persist()     │   │ persist()     │   │ persist()      │
└───────────────┘   └───────────────┘   └───────────────┘
```

### 11.3 核心类型定义

```typescript
// src/apps/weibo/stores/llm/parsers/types.ts

/**
 * 解析器接口 - 每个分部都需要实现
 */
export interface ContentParser<TInput = any, TOutput = any> {
  /** 解析器唯一标识 */
  readonly key: string;
  
  /** 支持的输入 key（如 'posts', 'post', 'weibos'） */
  readonly aliases: string[];
  
  /** 依赖的其他解析器（用于确定执行顺序） */
  readonly dependencies?: string[];
  
  /** 验证输入数据 */
  validate(input: TInput): ValidationResult;
  
  /** 转换为标准格式 */
  transform(input: TInput, context: ParseContext): Promise<TOutput[]>;
  
  /** 持久化到数据库 */
  persist(items: TOutput[], context: ParseContext): Promise<PersistResult>;
}

/**
 * 解析上下文 - 在解析器之间共享
 */
export interface ParseContext {
  taskId: string;
  platformId: string;
  timestamp: number;
  
  /** 已解析的数据（用于依赖解析和 tempId 映射） */
  resolved: {
    posts: Map<string, string>;      // tempId → realId
    users: Map<string, string>;      // nickname → accountId
    hotSearches: Map<string, string>;
  };
  
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
}

/**
 * 解析结果
 */
export interface ParseResult {
  success: boolean;
  data: {
    posts?: string[];
    comments?: string[];
    hotSearches?: string[];
    reposts?: string[];
  };
  errors: ParseError[];
  stats: Record<string, number>;
}
```

### 11.4 ContentDispatcher 实现

```typescript
// src/apps/weibo/stores/llm/parsers/dispatcher.ts

export class ContentDispatcher {
  private static instance: ContentDispatcher;
  private parsers: Map<string, ContentParser> = new Map();
  private aliasMap: Map<string, string> = new Map();
  
  /**
   * 注册解析器
   */
  public register(parser: ContentParser): void {
    this.pars.key, parser);
    parser.aliases.forEach(alias => {
      this.aliasMap.set(alias.toLowerCase(), parser.key);
    });
  }
  
  /**
   * 解析复合输出
   */
  public async dispatch(
    jsonOutput: string,
    context: Omit<ParseContext, 'resolved'>
  ): Promise<ParseResult> {
    // 1. 解析 JSON
    const parsed = this.parseJSON(jsonOutput);
    
    // 2. 创建共享上下文
    const fullContext: ParseContext = {
      ...context,
      resolved: {
        posts: new Map(),
        users: new Map(),
        hotSearches: new Map(),
      },
    };
    
    // 3. 识别需要处理的 key 并拓扑排序
    const tasks = this.identifyAndSortTasks(parsed);
    
    // 4. 按顺序执行解析器
    const result: ParseResult = { success: true, data: {}, errors: [], stats: {} };
    
    for (const { parserKey, data } of tasks) {
      const parser = this.parsers.get(parserKey)!;
      
      // 验证
      const validation = parser.validate(data);
      if (!validation.valid) {
        result.errors.push({ parser: parserKey, messages: validation.errors });
        continue;
      }
      
      // 转换
      const transformed = await parser.transform(data, fullContext);
      
      // 持久化
      const persistResult = await parser.persist(transformed, fullContext);
      
      result.data[parserKey] = persistResult.ids;
      result.stats[parserKey] = persistResult.count;
    }
    
    return result;
  }
  
  /**
   * 拓扑排序：依赖优先
   */
  private identifyAndSortTasks(parsed: Record<string, any>) {
    // ... 识别 key 并按依赖关系排序
  }
}
```

### 11.5 解析器实现示例

#### PostParser

```typescript
// src/apps/weibo/stores/llm/parsers/postParser.ts

export const PostParser: ContentParser<any, UniversalPost> = {
  key: 'posts',
  aliases: ['posts', 'post', 'weibos', 'weibo'],
  dependencies: ['users'],
  
  validate(input) {
    const items = Array.isArray(input) ? input : [input];
    const errors = items
      .map((item, i) => !item.payload?.text ? `posts[${i}]: 缺少 payload.text` : null)
      .filter(Boolean);
    return { valid: errors.length === 0, errors };
  },
  
  async transform(input, context) {
    const items = Array.isArray(input) ? input : [input];
    
    return Promise.all(items.map(async (item) => {
      // 处理作者（复用已解析的账号）
      const authorName = item.authorName || '匿名用户';
      let authorId = context.resolved.users.get(authorName);
      
      if (!authorId) {
        authorId = await ensureAuthorAccount(context.platformId, authorName);
        context.resolved.users.set(authorName, authorId);
      }
      
      const postId = uuidv4();
      const tempId = item.tempId || `temp_${postId.slice(0, 8)}`;
      
      // 记录 tempId 映射（供 CommentParser 使用）
      context.resolved.posts.set(tempId, postId);
      
      return {
        id: postId,
        platformId: context.platformId,
        authorId,
        timestamp: context.timestamp - Math.random() * 3600000,
        primaryType: item.primaryType || 'text',
        contentFlags: buildContentFlags(item.payload, item.media),
        media: item.media || [],
        payload: item.payload,
        topicTags: extractTopicTags(item.payload?.text),
        stats: createDefaultStats(),
      };
    }));
  },
  
  async persist(items, context) {
    await db.socialPosts.bulkAdd(items);
    return { ids: items.map(p => p.id), count: items.length };
  },
};
```

#### CommentParser（带依赖）

```typescript
// src/apps/weibo/stores/llm/parsers/commentParser.ts

export const CommentParser: ContentParser<any, UniversalComment> = {
  key: 'comments',
  aliases: ['comments', 'comment', 'replies'],
  dependencies: ['posts', 'users'],  // 依赖 posts 先执行
  
  async transform(input, context) {
    const items = Array.isArray(input) ? input : [input];
    
    return Promise.all(items.map(async (item) => {
      // 解析 postId（支持 tempId 引用）
      let postId = item.postId;
      if (postId && context.resolved.posts.has(postId)) {
        postId = context.resolved.posts.get(postId)!;  // tempId → realId
      }
      
      // 处理评论者
      const nickname = item.nickname || '微博网友';
      let authorId = context.resolved.users.get(nickname);
      if (!authorId) {
        authorId = await ensureAuthorAccount(context.platformId, nickname);
        context.resolved.users.set(nickname, authorId);
      }
      
      return {
        id: uuidv4(),
        postId,
        platformId: context.platformId,
        authorId,
        content: item.content,
        timestamp: context.timestamp - Math.random() * 3600000,
        likes: item.likes || 0,
      };
    }));
  },
};
```

### 11.6 LLM 输出格式规范

提示词应指导 LLM 输出以下格式：

```json
{
  "hotSearches": [
    {
      "keyword": "#某明星官宣#",
      "heat": 95,
      "summary": "某明星在微博官宣恋情",
      "category": "entertainment",
      "isNew": true,
      "isHot": true
    }
  ],
  
  "posts": [
    {
      "tempId": "post_1",
      "primaryType": "gallery",
      "payload": {
        "text": "#某明星官宣# 终于官宣了！祝福祝福 🎉🎊"
      },
      "media": [
        {
          "id": "img_0",
          "type": "image",
          "description": "两人甜蜜合照",
          "order": 0
        }
      ],
      "authorName": "追星少女小美"
    },
    {
      "tempId": "post_2",
      "primaryType": "poll",
      "payload": {
        "text": "大家觉得这对 CP 能走多久？",
        "poll": {
          "question": "你看好这对吗？",
          "options": [
            { "id": "opt_0", "text": "看好！天作之合", "votes": 0 },
            { "id": "opt_1", "text": "不看好...", "votes": 0 },
            { "id": "opt_2", "text": "吃瓜就好", "votes": 0 }
          ],
          "duration": 24,
          "multiSelect": false
        }
      },
      "authorName": "娱乐大V"
    }
  ],
  
  "comments": [
    {
      "postId": "post_1",
      "content": "啊啊啊啊终于！！！磕到了 😭",
      "nickname": "追星族小王"
    },
    {
      "postId": "post_1",
      "content": "前排占座",
      "nickname": "吃瓜群众"
    },
    {
      "postId": "post_2",
      "content": "投了第一个！",
      "nickname": "路人甲"
    }
  ],
  
  "reposts": [
    {
      "originalPostId": "post_1",
      "payload": {
        "text": "转发微博 // 恭喜恭喜！"
      },
      "authorName": "某营销号"
    }
  ]
}
```

### 11.7 内置任务定义

```typescript
// builtinTasks.ts

{
  builtinId: 'weibo-complete-hot-topic',
  name: '🔥 完整热点生成',
  description: '一次性生成热搜话题 + 相关博文 + 评论区 + 转发',
  type: 'manual',
  prompt: `请生成一个完整的微博热点事件。

话题类型：{{eventType}}
时间背景：{{timeContext}}

请严格按以下 JSON 格式输出：
{
  "hotSearches": [{ "keyword": "#话题#", "heat": 95, "summary": "...", "category": "..." }],
  "posts": [
    {
      "tempId": "post_1",
      "primaryType": "text|gallery|poll|video",
      "payload": { "text": "...", "poll": {...}, "video": {...} },
      "media": [{ "id": "...", "type": "image", "description": "..." }],
      "authorName": "用户昵称"
    }
  ],
  "comments": [
    { "postId": "post_1", "content": "...", "nickname": "..." }
  ]
}`,
  systemPrompt: '你是微博热点模拟器。请生成结构化的复合内容，确保 comments 的 postId 引用正确的 tempId。',
  outputHandler: 'composite',
}
```

### 11.8 文件结构

```
src/apps/weibo/stores/llm/parsers/
├── index.ts              # 导出 & 初始化
├── types.ts              # 类型定义
├── dispatcher.ts         # ContentDispatcher（总部）
├── postParser.ts         # 博文解析器
├── commentParser.ts      # 评论解析器
├── hotSearchParser.ts    # 热搜解析器
├── repostParser.ts       # 转发解析器
└── userParser.ts         # 用户解析器（可选）
```

### 11.9 架构优势

| 方面 | 旧架构 (switch-case) | 新架构 (总部-分部) |
|------|---------------------|-------------------|
| **扩展性** | 新类型需改核心代码 | 只需注册新 Parser |
| **复合输出** | 需特殊 handler | 自动识别分发 |
| **依赖处理** | 手动管理 | 拓扑排序自动处理 |
| **tempId 映射** | 无 | 自动处理跨实体引用 |
| **代码复用** | 逻辑重复 | Parser 独立复用 |
| **测试** | 整体测试 | 各 Parser 独立测试 |
| **错误处理** | 整体失败 | 部分成功+详细错误 |

### 11.10 实施步骤

| 步骤 | 内容 | 优先级 | 状态 |
|------|------|--------|------|
| 1 | 创建 `parsers/` 目录，实现 `types.ts` 和 `dispatcher.ts` | 高 | ✅ 完成 |
| 2 | 实现 `PostParser`（含 ensureAuthorAccount） | 高 | ✅ 完成 |
| 3 | 实现 `CommentParser`（含 tempId 解析） | 高 | ✅ 完成 |
| 4 | 实现 `HotSearchParser` | 中 | ✅ 完成 |
| 5 | 在 `outputHandlers.ts` 添加 `composite` handler | 高 | ✅ 完成 |
| 6 | 添加 `RepostParser` | 中 | ✅ 完成 |
| 7 | 更新提示词输出格式 | 高 | ✅ 完成 |
| 8 | 删除旧的 handler 代码 | 低 | 📋 待清理 |

### 11.11 已完成的工作

1. ✅ 创建 `src/apps/weibo/stores/llm/parsers/` 目录结构
2. ✅ 实现 `types.ts` - 完整的类型定义（ContentParser、ParseContext、ValidationResult 等）
3. ✅ 实现 `dispatcher.ts` - ContentDispatcher 总部分发器
   - 解析 JSON（支持 markdown 代码块）
   - 识别顶层 key 并映射到解析器
   - 拓扑排序（依赖优先）
   - 收集结果 & 处理 tempId 映射
4. ✅ 实现 `postParser.ts` - 博文解析器
   - 使用 `postTransformer` 转换 LLM 输出
   - 使用 `accountService` 创建作者账号
   - 支持 tempId 映射
5. ✅ 实现 `commentParser.ts` - 评论解析器
   - 支持 tempId 引用博文
   - 自动更新博文评论计数
6. ✅ 实现 `hotSearchParser.ts` - 热搜解析器
   - 调用 `hotSearchStore.applyHotSearchFromJSON`
7. ✅ 实现 `repostParser.ts` - 转发解析器
   - 实现 `RepostSnapshot` 扁平化快照
   - 支持 tempId 引用原博文
8. ✅ 创建 `index.ts` - 统一导出和初始化函数
   - `initializeParsers()` 初始化所有解析器
   - `parseCompositeOutput()` 便捷调用函数
9. ✅ 更新 `outputHandlers.ts` 添加 `composite` handler
10. ✅ 更新 `llm/index.ts` 导出解析器模块
11. ✅ 添加内置任务 `weibo-complete-hot-topic` 使用 `composite` handler

---

## 12. 相关文档

* [社交媒体模拟引擎](social-media-engine.md) - 父文档，整体架构
* [账号服务](account-service.md) - 用户/账号管理
* [涨粉引擎](follower-growth-engine.md) - 粉丝增长模拟
* [微博 App](../apps/Weibo/README.md) - 微博前端实现
