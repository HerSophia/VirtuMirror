# 内容类型系统

## 1. 概述

本文档定义了跨平台统一的社交内容数据模型。目标是让微博、B站、知乎、贴吧等不同平台共享同一套核心数据结构，同时保留各平台的特性扩展能力。

### 1.1 设计原则

1. **主类型 + 组合标记**：用 `primaryType` 标识主要展示形态，用 `contentFlags` 标记实际包含的组件
2. **平台特性下沉**：通用字段放顶层，平台特有字段放 `platformData`
3. **转发扁平化**：转发只保存一层快照，不递归引用
4. **媒体统一抽象**：图片、视频、音频使用统一的 `MediaAsset` 结构

## 2. 跨平台内容类型对照

| 类型 | 微博 | B站 | 知乎 | 贴吧 | 说明 |
| ---- | ---- | --- | ---- | ---- | ---- |
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

* `primaryType` 是「这条内容主要是什么」，用于 UI 展示模式选择
* `contentFlags` 是「这条内容包含什么」，用于精确判断需要渲染哪些组件
* 两者配合解决了「知乎回答可能同时有图片和视频」的复合类型问题

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

### 3.5 互动数据对照

| 互动类型 | 微博 | B站 | 知乎 | 贴吧 |
| -------- | ---- | --- | ---- | ---- |
| 点赞 | ✅ | ✅ | ✅ 赞同 | ✅ |
| 踩/反对 | ❌ | ✅ | ✅ | ❌ |
| 评论 | ✅ | ✅ | ✅ | ✅ 回复 |
| 转发/分享 | ✅ | ✅ | ❌ | ❌ |
| 收藏 | ✅ | ✅ | ✅ | ❌（不显示） |
| 投币 | ❌ | ✅ | ❌ | ❌ |
| 弹幕 | ❌ | ✅ | ❌ | ❌ |
| 播放量 | ✅ | ✅ | ✅ | ❌ |
| 阅读量 | ✅ 文章 | ✅ 专栏 | ✅ | ❌ |

## 4. 转发快照设计

### 4.1 RepostSnapshot 结构

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

### 4.2 扁平化示例

```text
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

## 5. 平台类型判定规则

各平台根据内容自动判定 `primaryType` 的参考逻辑：

### 5.1 微博

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

### 5.2 B站

```typescript
function getBilibiliPrimaryType(flags: ContentFlags): PrimaryContentType {
  if (flags.hasVideo) return 'video';     // 视频优先级最高
  if (flags.hasArticle) return 'article'; // 专栏
  if (flags.hasRepost) return 'repost';
  if (flags.hasImages) return 'gallery';
  return 'text';
}
```

### 5.3 知乎

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

## 6. 工具函数

### 6.1 创建默认值

```typescript
/** 创建默认 ContentFlags */
function createDefaultContentFlags(): ContentFlags {
  return {
    hasText: true,
    hasImages: false,
    hasVideo: false,
    hasAudio: false,
    hasPoll: false,
    hasLink: false,
    hasRepost: false,
    hasArticle: false,
  };
}

/** 创建默认统计 */
function createDefaultStats(): UniversalStats {
  return {
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    favorites: 0,
  };
}
```

### 6.2 从 payload 构建标记

```typescript
/** 从 payload 和 media 构建 ContentFlags */
function buildContentFlags(payload: any, media: MediaAsset[]): ContentFlags {
  return {
    hasText: !!payload?.text,
    hasImages: media.some(m => m.type === 'image'),
    hasVideo: media.some(m => m.type === 'video'),
    hasAudio: media.some(m => m.type === 'audio'),
    hasPoll: !!payload?.poll,
    hasLink: !!payload?.link,
    hasRepost: !!payload?.repost,
    hasArticle: !!payload?.article,
  };
}
```

### 6.3 旧格式转换

```typescript
/** 将旧格式图片数组转换为 MediaAsset */
function convertImagesToMediaAssets(
  images: (string | { description?: string })[] | undefined
): MediaAsset[] {
  if (!images) return [];
  
  return images.map((img, index) => {
    const description = typeof img === 'string' ? img : (img.description || '');
    return {
      id: `img_${index}`,
      type: 'image',
      description,
      order: index,
    };
  });
}
```

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
