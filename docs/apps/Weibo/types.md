# 数据类型定义

## Phase 3 类型重构概述

微博 App 已完成 Phase 3 类型重构：

* 引入 `DisplayPost` 作为 UI 层的统一类型
* 使用 `primaryType` 替代旧的 `payload.type/postType`
* 使用 `media[]` 替代旧的 `payload.images`
* 使用 `contentFlags` 标记内容特征
* 旧类型 `WeiboPostUI` 已标记为 `@deprecated`

## 核心类型

### UniversalPost (`src/types/social.ts`)

数据库存储的博文模型。

```typescript
interface UniversalPost {
  id: string;
  platformId: string;           // 'weibo'
  authorId: string;
  timestamp: number;
  
  // === Phase 3 新字段 ===
  /** 主内容类型 */
  primaryType: PrimaryContentType;
  /** 内容特征标志 */
  contentFlags: ContentFlags;
  /** 统一的媒体资源数组 */
  media: MediaAsset[];
  /** 话题标签 */
  topicTags?: string[];
  
  // === 保留字段 ===
  payload: PostPayload;
  stats: PostStats;
  meta?: PostMeta;
}

/** 主内容类型 */
type PrimaryContentType = 
  | 'text'      // 纯文字或少量图片 (1-3张)
  | 'gallery'   // 图集 (4-9张图片)
  | 'poll'      // 投票
  | 'video'     // 视频
  | 'repost'    // 转发
  | 'article';  // 长文章

/** 内容特征标志 */
interface ContentFlags {
  hasText: boolean;
  hasImages: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  hasPoll: boolean;
  hasArticle: boolean;
  hasRepost: boolean;
  hasLink: boolean;
  hasLocation: boolean;
  hasMention: boolean;
}

/** 媒体资源 */
interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  /** 用户描述 */
  description?: string;
  /** AI 扩展描述 */
  expandedDescription?: string;
  /** 实际 URL（可选） */
  url?: string;
  /** 视频封面描述 */
  coverDescription?: string;
  /** 时长（秒） */
  duration?: number;
  /** 排序 */
  order?: number;
}
```

### DisplayPost (`src/types/social.ts`)

UI 展示层类型，继承 `UniversalPost` 并添加展示字段。

```typescript
interface DisplayPost extends UniversalPost {
  /** 作者信息（已解析） */
  author: PostAuthor;
  /** 格式化的时间显示 */
  displayTime: string;
  /** 图片 URL 列表（已处理） */
  imageUrls: string[];
  /** 是否已关注作者 */
  isFollowing?: boolean;
}

interface PostAuthor {
  id: string;
  name: string;
  avatar: string;
  verified?: boolean;
  verifiedType?: 'personal' | 'org';
  vipLevel?: number;
}
```

### PostPayload (`src/types/social.ts`)

博文负载数据。

```typescript
interface PostPayload {
  /** 正文内容 */
  text?: string;
  /** 兼容旧格式的图片数组 */
  images?: Array<string | { description: string; expandedDescription?: string }>;
  /** 投票数据 */
  poll?: PollPayload;
  /** 视频数据 */
  video?: VideoPayload;
  /** 转发数据 */
  repost?: RepostSnapshot;
  /** 长文章数据 */
  article?: ArticlePayload;
}

interface PollPayload {
  question: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  duration: number;      // 小时
  multiSelect: boolean;
  endTime?: number;
}

interface VideoPayload {
  description: string;
  duration?: number;     // 秒
  coverDescription?: string;
}

interface RepostSnapshot {
  originalPostId: string;
  originalAuthorId?: string;
  originalAuthorName?: string;
  originalContent?: string;
  text?: string;         // 转发评论
}
```

## UI 模型 (`src/apps/weibo/types.ts`)

微博专用的 UI 类型定义。

### WeiboPostUI (已废弃)

```typescript
/**
 * @deprecated Phase 3 重构后，请使用 DisplayPost from '@/types/social'
 */
interface WeiboPostUI {
  id: string;
  user: WeiboUser;
  time: string;
  source?: string;
  content: string;
  images: string[];
  likes: number;
  comments: number;
  shares: number;
  isFollowing?: boolean;
  type?: WeiboPostType;
  poll?: WeiboPollConfig;
  video?: WeiboVideoConfig;
}
```

### HotSearchItem

热搜条目。

```typescript
interface HotSearchItem {
  rank: number;
  title: string;
  tag?: 'hot' | 'new' | 'entertainment' | 'recommend' | 'boil';
  tagType?: 'text' | 'icon';
  tagText?: string;
  /** 原始热度值 */
  heat: number;
  /** 格式化后的热度显示（如 "234.5万"） */
  heatFormatted?: string;
  /** 是否置顶 */
  isTop?: boolean;
  /** 创建时间用于热度计算） */
  createdAt?: number;
  /** 关联的数据库话题 ID */
  topicId?: string;
}
```

### WeiboUser

```typescript
interface WeiboUser {
  id: string;
  name: string;
  avatar: string;
  verified?: boolean;
  verifiedType?: 'personal' | 'org';
  vipLevel?: number;
}
```

### 投票相关

```typescript
interface WeiboPollOption {
  id: string;
  text: string;
  votes: number;
}

interface WeiboPollConfig {
  question: string;
  options: WeiboPollOption[];
  duration: number;      // 小时
  multiSelect: boolean;
  endTime?: number;
}
```

### 视频相关

```typescript
interface WeiboVideoConfig {
  description: string;
  expandedDescription?: string;
  duration?: number;     // 秒
  coverDescription?: string;
}
```

### 草稿

```typescript
interface WeiboDraft {
  id: string;
  type: WeiboPostType;   // 'text' | 'poll' | 'video'
  content: string;
  topics: string[];
  images: WeiboImageConfig[];
  poll?: WeiboPollConfig;
  video?: WeiboVideoConfig;
  createdAt: number;
  updatedAt: number;
}

interface WeiboImageConfig {
  description: string;
  expandedDescription?: string;
}
```

### 用户行为

```typescript
type UserActionType = 'like' | 'favorite' | 'view';

interface UserAction {
  id: string;
  userId: string;
  platformId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  actionType: UserActionType;
  createdAt: number;
}

interface ViewHistory {
  id: string;
  userId: string;
  platformId: string;
  postId: string;
  viewedAt: number;
  duration?: number;
}
```

### 认证类型

```typescript
type WeiboVerifyType =
  | 'personal_celebrity'    // 名人
  | 'personal_kol'          // KOL/博主
  | 'personal_professional' // 专业人士
  | 'personal_writer'       // 作家
  | 'personal_artist'       // 艺术家
  | 'org_enterprise'        // 企业
  | 'org_media'             // 媒体
  | 'org_government'        // 政务
  | 'org_school'            // 校园
  | 'org_ngo'               // 公益
  | 'super_topic_host';     // 超话主持人
```

## LLM 任务类型 (`src/apps/weibo/types/llmTask.ts`)

### LLMTask

```typescript
interface LLMTask {
  /** 任务 ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description?: string;
  /** 任务类型 */
  type: LLMTaskType;  // 'prompt' | 'chain' | 'manual'
  /** 任务状态 */
  status: LLMTaskStatus;  // 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  /** 执行模式 */
  executionMode: TaskExecutionMode;  // 'once' | 'repeatable' | 'auto'
  /** 自动执行配置 */
  autoConfig?: AutoExecutionConfig;
  
  // 提示词配置
  promptId?: string;
  chainId?: string;
  manualPrompt?: string;
  systemPrompt?: string;
  
  // 输入输出
  input: Record<string, any>;
  output?: string;
  chainResult?: { outputs: Record<string, unknown>; stepResults: [...] };
  outputHistory?: Array<{ timestamp: number; output: string; usage?: TokenUsage }>;
  error?: string;
  
  // LLM 配置
  config: LLMTaskConfig;
  priority: RequestPriority;
  
  // 时间戳
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  
  // 统计
  usage?: TokenUsage;
  totalExecutions: number;
  retryCount: number;
  maxRetries: number;
  
  // 来源
  sourceApp?: string;
  isBuiltin?: boolean;
  builtinId?: string;
}
```

### LLMTaskDefinition (`src/services/llmTask/types.ts`)

系统服务使用的任务定义类型。

```typescript
interface LLMTaskDefinition {
  /** 唯一 ID，格式: appId:taskId */
  id: string;
  /** 所属应用 ID */
  appId: string;
  /** 任务名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 分类 */
  category: 'content' | 'trending' | 'user' | 'system';
  /** 任务类型 */
  type: 'prompt' | 'chain' | 'manual';
  /** 执行模式 */
  executionMode: TaskExecutionMode;
  /** 自动执行配置 */
  autoConfig?: Partial<AutoExecutionConfig>;
  
  // 提示词配置（三选一）
  promptId?: string;         // type='prompt'
  chainId?: string;          // type='chain'
  promptTemplate?: string;   // type='manual'
  systemPrompt?: string;
  
  /** 输入 Schema */
  inputSchema: InputFieldSchema[];
  /** 默认输入 */
  defaultInput: Record<string, any>;
  /** LLM 配置 */
  config: Partial<LLMTaskConfig>;
  /** 优先级 */
  priority: RequestPriority;
  /** 输出处理器 ID */
  outputHandlerId: string;
  /** 上下文提供器 ID 列表 */
  contextProviders?: string[];
  /** 是否默认显示 */
  showByDefault?: boolean;
  /** 标签 */
  tags?: string[];
}
```

## Phase 4 转换类型 (`src/apps/weibo/stores/llm/postTransformer.ts`)

```typescript
/** 旧格式 LLM 输出 */
interface LegacyLLMPostOutput {
  type?: string;
  text?: string;
  content?: string;
  images?: (string | { description: string })[];
  poll?: { question: string; options: string[]; ... };
  video?: { description: string; ... };
  authorName?: string;
}

/** 新格式 LLM 输出 */
interface NewLLMPostOutput {
  primaryType: PrimaryContentType;
  payload: PostPayload;
  media?: MediaAsset[];
  authorName?: string;
  tempId?: string;  // 用于复合输出的临时 ID
}

/** 转换上下文 */
interface TransformContext {
  platformId: string;
  defaultAuthorId?: string;
  timestamp?: number;
}

/** 转换结果 */
interface TransformResult {
  success: boolean;
  post?: UniversalPost;
  error?: string;
}
```

## Phase 5 解析器类型 (`src/apps/weibo/stores/llm/parsers/types.ts`)

```typescript
/** 解析上下文 */
interface ParseContext {
  platformId: string;
  defaultAuthorId?: string;
  timestamp?: number;
  /** 临时 ID 到实际 ID 的映射（用于关联评论/转发） */
  postIdMapping?: Map<string, string>;
}

/** 解析结果 */
interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors?: ParseError[];
  /** 返回的映射（PostParser 使用） */
  mapping?: Map<string, string>;
}

/** 持久化结果 */
interface PersistResult {
  success: boolean;
  savedCount: number;
  errors?: string[];
}

/** 内容解析器接口 */
interface ContentParser<TInput, TOutput> {
  name: string;
  parse(input: TInput[], context: ParseContext): Promise<ParseResult<TOutput[]>>;
  persist(data: TOutput[], context: ParseContext): Promise<PersistResult>;
}
```
