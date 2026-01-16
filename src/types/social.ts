// 社交媒体模拟引擎核心类型定义
// 对应文档: docs/systems/social-media-engine.md
// 对应文档: docs/systems/social-content-types.md
// 对应文档: docs/apps/Weibo/session-binding-design.md

import { z } from 'zod';

// ==========================================
// 1. 内容类型系统 (Content Type System)
// ==========================================

/**
 * 主内容类型
 * 用于 UI 展示、筛选、统计
 * 由各平台根据自己的规则判定
 */
export type PrimaryContentType =
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

/**
 * 内容组件标记
 * 表示帖子实际包含哪些类型的内容
 */
export interface ContentFlags {
  hasText: boolean;      // 有文字内容
  hasImages: boolean;    // 有图片
  hasVideo: boolean;     // 有视频
  hasAudio: boolean;     // 有音频
  hasPoll: boolean;      // 有投票
  hasLink: boolean;      // 有外链
  hasRepost: boolean;    // 是转发
  hasArticle: boolean;   // 是长文
}

/**
 * 创建默认的 ContentFlags
 */
export function createDefaultContentFlags(): ContentFlags {
  return {
    hasText: false,
    hasImages: false,
    hasVideo: false,
    hasAudio: false,
    hasPoll: false,
    hasLink: false,
    hasRepost: false,
    hasArticle: false,
  };
}

/** 内容可见性 */
export type ContentVisibility =
  | 'public'      // 公开
  | 'followers'   // 仅粉丝可见
  | 'mutual'      // 仅互关可见
  | 'private'     // 仅自己可见
  | 'members';    // 仅会员/付费可见

// ==========================================
// 2. 内容来源追踪 (ContentSourceTracking)
// ==========================================

/**
 * 内容来源追踪
 * 记录内容生成时的酒馆上下文，用于数据与会话/楼层/Swipe 绑定
 * 
 * 设计文档: docs/apps/Weibo/session-binding-design.md
 */
export interface ContentSourceTracking {
  /** 来源会话 ID (sessionId) */
  sessionId?: string;
  
  /** 来源楼层（酒馆 message_id） */
  sourceMessageId?: number;
  
  /** 来源消息页（swipe_id） */
  sourceSwipeId?: number;
  
  /** 生成时间戳 */
  generatedAt?: number;
}

// ==========================================
// 3. 统一媒体资源 (MediaAsset)
// ==========================================

/**
 * 统一媒体资源
 * 图片、视频、音频使用同一结构
 */
export interface MediaAsset {
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

// ==========================================
// 3. 统一互动数据 (UniversalStats)
// ==========================================

/**
 * 统一互动统计
 * 通用字段 + 可选的平台特有字段
 */
export interface UniversalStats {
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

/**
 * 创建默认的统计数据
 */
export function createDefaultStats(): UniversalStats {
  return {
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
  };
}

// ==========================================
// 4. 转发快照 (RepostSnapshot)
// ==========================================

/**
 * 转发内容快照
 * 扁平化设计：只保存一层，不递归引用
 * 
 * 设计决策：
 * - 微博的「转发的转发」本质是纯文字内容
 * - 不允许通过转发回溯获取上层账号的其他信息
 * - 保存的是快照，原帖删除后仍可显示
 */
export interface RepostSnapshot {
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

// ==========================================
// 5. 统一载荷结构 (PostPayload)
// ==========================================

/**
 * 投票选项
 */
export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

/**
 * 投票载荷
 */
export interface PollPayload {
  question: string;
  options: PollOption[];
  endTime: number;         // 截止时间戳
  multiSelect: boolean;    // 是否多选
  totalVotes?: number;     // 总票数
  duration?: number;       // 持续时间（小时）- 兼容旧格式
}

/**
 * 视频载荷
 */
export interface VideoPayload {
  description: string;
  expandedDescription?: string;
  duration?: number;        // 时长（秒）
  coverDescription?: string;
}

/**
 * 外链载荷
 */
export interface LinkPayload {
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;      // 缩略图描述
  source: string;          // 来源域名
}

/**
 * 文章载荷
 */
export interface ArticlePayload {
  cover?: string;          // 封面图描述
  content: string;         // 正文（Markdown 或富文本）
  wordCount?: number;      // 字数
  readTime?: number;       // 预计阅读时间（分钟）
}

/**
 *答结构（知乎）
 */
export interface QuestionPayload {
  questionId: string;      // 关联的问题 ID
  questionTitle: string;   // 问题标题
}

/**
 * 统一的帖子载荷
 * 替代之前松散的 Record<string, any>
 */
export interface PostPayload {
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
  
  // 视频配置
  video?: VideoPayload;
  
  // === 兼容旧格式（逐步废弃） ===
  /** @deprecated 使用 UniversalPost.primaryType */
  type?: string;
  /** @deprecated 使用 UniversalPost.primaryType */
  postType?: string;
  /** @deprecated 使用 UniversalPost.media */
  images?: (string | { description: string; expandedDescription?: string })[];
}

// ==========================================
// 6. 平台注册表 (Platform Registry)
// ==========================================

export interface PlatformConfig {
  id: string;               // e.g., 'weibo', 'bilibili'
  name: string;             // e.g., '微博'
  
  // 内容形态 DNA
  content: {
    hasTitle: boolean;      // 微博 False, B站 True
    mediaType: 'text_image' | 'video' | 'article' | 'qa';
    maxLength: number;      // 字数限制
  };
  
  // LLM 人设偏置 (System Prompt Injection)
  aiSetting: {
    tone: string;           // e.g., "Gossip, Emotional, Short sentences"
    roles: string[];        // e.g., ["Fan", "Hater", "Passerby"]
    slang: string[];        // e.g., ["yyds", "绝绝子"]
    promptTemplate: string; // 对应的 Prompt 模板 ID
  };
  
  // 交互拓扑
  interaction: {
    actions: ('like' | 'dislike' | 'coin' | 'repost' | 'favorite')[];
    commentStructure: 'flat' | 'nested' | 'bullet'; // 楼中楼 vs 弹幕
  };
  
  // 私信策略
  dmStrategy: {
    allowStranger: boolean;      // 是否允许陌生人私信
    autoReply?: string;          // 自动回复模板 (如商务联系方式)
    foldUnknown: boolean;        // 是否折叠未关注人消息
  };
}

// ==========================================
// 7. 账号系统 (Identity & Accounts)
// ==========================================

// 1. 实体层 (背后的"人")
export interface SocialIdentity {
  id: string;
  name: string;          // e.g., "雷军", "某游戏官方"
  type: 'user' | 'celebrity' | 'official' | 'brand';
  
  // 跨平台同步策略
  syncStrategy: {
    enable: boolean;
    platforms: string[]; // ['weibo', 'bilibili']
  };
}

// 2. 账号层 (App 里的号)
// @deprecated 请使用 src/types/account.ts 中的 PlatformAccount
export interface PlatformAccount {
  id: string;
  platformId: string;    // 'weibo'
  identityId?: string;   // 关联实体，可为空(纯路人小号)
  
  handle: string;        // @雷军
  nickname: string;
  avatar?: string;
  
  persona: {             // 账号专属人设
    prompt: string;      // "你是雷军，喜欢发自拍，语气亲切"
    tone: 'official' | 'casual';
  };

  // 影子账号演化数据
  origin: 'system_preset' | 'user_created' | 'llm_generated';
  persistence: 'ephemeral' | 'permanent'; // ephemeral: 仅存在于内存/缓存，重启丢失
  
  evolution?: {
    firstAppearanceTime: number;
    appearanceCount: number; // 登场次数，越高越容易被复用
    interactionHistory: string[]; // 简要记录："喷过雷军", "赞过原神"
    semanticTags: string[];      // e.g. ["tech_enthusiast", "cynical"]
    vectorSignature?: number[];  // 发言内容的平均向量，用于聚类
  };
}

// ==========================================
// 8. 热搜榜单系统 (Trending System)
// ==========================================

export type TrendingCategory = 'general' | 'entertainment' | 'game' | 'tech' | 'politics' | 'life' | 'sports';

export interface TrendingTopic {
  id: string;
  platformId?: string;     // 如果为空，则为全网通用话题；如果指定，则仅在该平台显示
  /**
   * 数据命名空间
   * 用于在同一平台内按应用/安装实例隔离数据（例如 builtin/weibo, repo/... 等）
   */
  namespace?: string;
  keyword: string;         // "#某明星塌房#"
  summary: string;         // 给 LLM 的背景描述，用于生成后续博文
  
  // 分类与标签
  categories: TrendingCategory[];
  location?: string;               // 同城榜专用
  
  // 显示属性
  isNew: boolean;          // "新" 标签
  isHot: boolean;          // "爆" 标签
  
  // 热度计算参数
  baseScore: number;       // 1-100，事件量级
  velocity: number;        // 增速系数
  createdAt: number;
  peakTime: number;        // 预计峰值时间
  
  // Runtime Only
  currentHeat?: number;
  
  // === 来源追踪（用于会话/楼层/Swipe 绑定） ===
  /** 内容来源追踪，记录生成时的酒馆上下文 */
  source?: ContentSourceTracking;
}

// ==========================================
// 9. 超话系统 (Super Topic)
// ==========================================

export interface SuperTopic {
  id: string;
  name: string;              // "原神", "每日撸猫"
  coverImage: string;
  description: string;
  
  category: TrendingCategory | 'anime';
  followersCount: number;
  postCount: number;
  
  // AI 上下文控制
  aiSetting: {
    vibe: string;            // "狂热、排外" 或 "温馨、互助"
    keywords: string[];      // 高频词
    userRoles: string[];     // 典型用户画像
  };
}

export interface UserSuperTopicRelation {
  userId: string;
  superTopicId: string;
  level: number;         // 1-12级
  experience: number;
  isSignedToday: boolean;
  joinedAt: number;
}

// ==========================================
// 10. Legacy / Private Social (WeChat Moments)
// ==========================================

export interface MomentComment {
  id: string;
  authorId: string;
  content: string;
  replyTo?: string; // userId
  timestamp: number;
}

export interface Moment {
  id: string;
  authorId: string;
  content: string;
  images?: string[];
  likes: string[]; // userIds
  comments: MomentComment[];
  timestamp: number;
}

// ==========================================
// 11. 世界事件 (Event Bus)
// ==========================================

export interface WorldEvent {
  id: string;
  source: 'chat' | 'director' | 'user_action';
  topic: string;
  summary: string;
  priority: 'breaking' | 'normal' | 'background';
  affectedPlatforms: string[];  // ['weibo', 'zhihu']
  timestamp: number;
  metadata?: Record<string, any>;
}

// ==========================================
// 12. 帖子作者信息（UI 展示层）
// ==========================================

/**
 * 帖子作者信息（UI 展示层）
 * 用于预解析的作者信息，避免组件异步获取
 */
export interface PostAuthor {
  id: string;
  name: string;
  avatar: string;
  verified?: boolean;
  /** 简化的认证类型，用于 UI 展示 */
  verifiedType?: 'personal' | 'org';
  vipLevel?: number;
}

// ==========================================
// 13. 统一帖子结构 (UniversalPost)
// ==========================================

/**
 * 统一帖子/动态/博文结构
 * 存储于 IndexedDB socialPosts 表
 */
export interface UniversalPost {
  // === 基础标识 ===
  id: string;
  platformId: string;           // 'weibo' | 'bilibili' | 'zhihu' | 'tieba'
  /**
   * 数据命名空间
   * 用于在同一平台内按应用/安装实例隔离数据（例如 builtin/weibo, repo/... 等）
   */
  namespace?: string;
  authorId: string;             // 关联账号系统
  timestamp: number;            // 发布时间戳
  
  // === 类型系统（新增） ===
  /** 主内容类型 */
  primaryType?: PrimaryContentType;
  /** 内容组件标记 */
  contentFlags?: ContentFlags;
  
  // === 媒体资源（新增） ===
  /** 统一媒体资源数组 */
  media?: MediaAsset[];
  
  // === 话题/标签 ===
  topicTags: string[];          // #话题#
  mentionedUsers?: string[];    // @用户
  
  // 关联
  superTopicId?: string;
  
  // === 统计数据 ===
  stats: UniversalStats;
  
  // === 内容载荷 ===
  payload: PostPayload;
  
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
  
  // === 来源追踪（用于会话/楼层/Swipe 绑定） ===
  /** 内容来源追踪，记录生成时的酒馆上下文 */
  source?: ContentSourceTracking;
}

// ==========================================
// 13. 统一评论结构 (UniversalComment)
// ==========================================

/**
 * 统一评论/回复结构
 * 存储于 IndexedDB socialComments 表
 */
export interface UniversalComment {
  id: string;
  postId: string;              // 关联的帖子 ID
  platformId: string;
  /**
   * 数据命名空间，与对应帖子保持一致
   */
  namespace?: string;
  authorId: string;            // 对应账号系统
  timestamp: number;
  
  // === 内容 ===
  content: string;
  /** 评论带图/视频（部分平台支持） */
  media?: MediaAsset[];
  
  // === 回复关系 ===
  parentId?: string;           // 父评论 ID（楼中楼）
  rootId?: string;             // 根评论 ID (如果 nested)
  replyToUserId?: string;      // 回复的用户 ID
  replyToUserName?: string;    // 回复的用户昵称（快照）
  
  // === 统计 ===
  likes: number;
  /** 踩（B站、知乎） */
  dislikes?: number;
  /** 子回复数 */
  replies?: number;
  
  // === 状态 ===
  isAuthorReply?: boolean;     // 是否是作者回复
  isTop?: boolean;             // 是否置顶
  isHot?: boolean;             // 是否热评
  
  // === 来源追踪（用于会话/楼层/Swipe 绑定） ===
  /** 内容来源追踪，记录生成时的酒馆上下文 */
  source?: ContentSourceTracking;
}

// ==========================================
// 14. 成本控制 (Cost Control)
// ==========================================

export interface TokenBudget {
  daily: {
    limit: number;       // 每日上限
    used: number;        // 已使用
    resetAt: number;     // 重置时间
  };
  
  perTask: {
    director: number;    // 单次 Director 上限
    post: number;        // 单条博文上限
    comment: number;     // 单条评论上限
  };
}

// ==========================================
// 15. 工具函数
// ==========================================

/**
 * 根据内容自动判定微博的主类型
 */
export function getWeiboPrimaryType(flags: ContentFlags, media: MediaAsset[]): PrimaryContentType {
  if (flags.hasPoll) return 'poll';
  if (flags.hasRepost) return 'repost';
  if (flags.hasArticle) return 'article';
  if (flags.hasVideo) return 'video';
  
  const imageCount = media.filter(m => m.type === 'image').length;
  if (imageCount >= 4) return 'gallery';  // 4张及以上算图片帖
  
  return 'text';
}

/**
 * 根据内容自动判定 B站 的主类型
 */
export function getBilibiliPrimaryType(flags: ContentFlags): PrimaryContentType {
  if (flags.hasVideo) return 'video';     // 视频优先级最高
  if (flags.hasArticle) return 'article'; // 专栏
  if (flags.hasRepost) return 'repost';
  if (flags.hasImages) return 'gallery';
  return 'text';
}

/**
 * 根据内容自动判定知乎的主类型
 */
export function getZhihuPrimaryType(flags: ContentFlags, isAnswer: boolean): PrimaryContentType {
  if (isAnswer) {
    // 回答可能是复合类型
    if (flags.hasVideo && flags.hasImages) return 'mixed';
    if (flags.hasVideo) return 'video';
    return 'answer';
  }
  
  if (flags.hasArticle) return 'article';  // 专栏文章
  return 'text';  // 想法
}

/**
 * 从 PostPayload 构建 ContentFlags
 */
export function buildContentFlags(payload: PostPayload, media?: MediaAsset[]): ContentFlags {
  const flags = createDefaultContentFlags();
  
  flags.hasText = !!(payload.text && payload.text.trim().length > 0);
  flags.hasImages = !!(media && media.some(m => m.type === 'image'));
  flags.hasVideo = !!(payload.video || (media && media.some(m => m.type === 'video')));
  flags.hasAudio = !!(media && media.some(m => m.type === 'audio'));
  flags.hasPoll = !!payload.poll;
  flags.hasLink = !!payload.link;
  flags.hasRepost = !!payload.repost;
  flags.hasArticle = !!payload.article;
  
  return flags;
}

/**
 * 将旧格式的 images 转换为 MediaAsset[]
 */
export function convertImagesToMediaAssets(
  images: (string | { description: string; expandedDescription?: string })[] | undefined
): MediaAsset[] {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map((img, index) => {
    if (typeof img === 'string') {
      return {
        id: `img_${index}`,
        type: 'image' as const,
        description: img,
        order: index,
      };
    }
    return {
      id: `img_${index}`,
      type: 'image' as const,
      description: img.description,
      expandedDescription: img.expandedDescription,
      order: index,
    };
  });
}

// ==========================================
// 16. 带作者信息的展示帖子 (DisplayPost)
// ==========================================

/**
 * 带作者信息的展示帖子
 * 用于 UI 层展示，预解析作者信息避免组件异步获取
 * 
 * Phase 3 重构：替代 WeiboPostUI 等平台特定 UI 类型
 */
export interface DisplayPost extends UniversalPost {
  /** 预解析的作者信息 */
  author: PostAuthor;
  
  /** 格式化的时间显示（如「5分钟前」） */
  displayTime: string;
  
  /** 预解析的图片 URL 列表（用于直接渲染） */
  imageUrls: string[];
  
  /** 是否正在关注作者 */
  isFollowing?: boolean;
}

/**
 * 带作者信息的展示评论
 */
export interface DisplayComment extends UniversalComment {
  /** 预解析的作者信息 */
  author: PostAuthor;
  
  /** 格式化的时间显示 */
  displayTime: string;
  
  /** 子回复列表（已解析作者信息） */
  displayReplies?: DisplayComment[];
}

// ==========================================
// 17. 展示层工具函数
// ==========================================

/**
 * 格式化时间戳为相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 从 MediaAsset 数组生成图片 URL 列表
 */
export function getImageUrlsFromMedia(media?: MediaAsset[]): string[] {
  if (!media || media.length === 0) return [];
  
  return media
    .filter(m => m.type === 'image')
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(m => {
      // 如果有实际 URL，使用 URL
      if (m.url) return m.url;
      // 否则生成占位图
      const desc = m.expandedDescription || m.description || '图片';
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(desc.slice(0, 20))}`;
    });
}

/**
 * 从旧格式 payload.images 生成图片 URL 列表
 * @deprecated 优先使用 getImageUrlsFromMedia
 */
export function normalizeImagesFromPayload(
  images: (string | { description: string; expandedDescription?: string })[] | undefined
): string[] {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map((img) => {
    if (typeof img === 'string') {
      return img.startsWith('http') 
        ? img 
        : `https://via.placeholder.com/400x300?text=${encodeURIComponent(img.slice(0, 10))}`;
    }
    if (typeof img === 'object' && img !== null) {
      const desc = img.expandedDescription || img.description || '图片';
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(desc.slice(0, 20))}`;
    }
    return 'https://via.placeholder.com/400x300?text=图片';
  });
}

/**
 * 从 UniversalPost 获取主类型
 * 优先使用 primaryType，兼容 payload.type/postType
 */
export function getPrimaryTypeFromPost(post: UniversalPost): PrimaryContentType {
  // 优先使用新字段
  if (post.primaryType) {
    return post.primaryType;
  }
  
  // 兼容旧字段
  const legacyType = post.payload.type || post.payload.postType;
  if (legacyType) {
    if (['text', 'gallery', 'video', 'article', 'poll', 'repost', 'link', 'audio', 'live', 'question', 'answer', 'mixed'].includes(legacyType)) {
      return legacyType as PrimaryContentType;
    }
  }
  
  // 如果有 contentFlags 和 media，使用工具函数计算
  if (post.contentFlags && post.media) {
    return getWeiboPrimaryType(post.contentFlags, post.media);
  }
  
  // 最后根据 payload 内容推断
  if (post.payload.poll) return 'poll';
  if (post.payload.video) return 'video';
  if (post.payload.repost) return 'repost';
  if (post.payload.article) return 'article';
  if (post.payload.link) return 'link';
  
  return 'text';
}

/**
 * 从 UniversalPost 获取图片列表
 * 优先使用 media 字段，兼容 payload.images
 */
export function getImagesFromPost(post: UniversalPost): string[] {
  // 优先使用新的 media 字段
  if (post.media && post.media.length > 0) {
    return getImageUrlsFromMedia(post.media);
  }
  
  // 兼容旧的 payload.images
  return normalizeImagesFromPayload(post.payload.images);
}
