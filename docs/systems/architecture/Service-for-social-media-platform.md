# 社交内容平台系统服务架构

> **版本**: 1.0
> **状态**: 规划中
> **最后更新**: 2026-01-08
> **目标**: 让小手机模拟器实现平台化和通用化

## 1. 概述

本文档分析社交内容平台（微博、B站、知乎、抖音等）所需的系统服务，目标是通过 **"Core & Skin"** 架构实现平台化：各 App 仅作为渲染层（Skin），共享底层的内容模型、算法、用户系统（Core）。

### 1.1 设计原则

1. **引擎与皮肤分离**：核心逻辑下沉到系统服务，App 只负责 UI 渲染
2. **统一数据模型**：跨平台共享同一套数据结构
3. **可插拔扩展**：通过注册机制支持平台特定功能
4. **按需加载**：服务懒加载，避免不必要的资源占用

---

## 2. 当前架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           应用层 (App Skins)                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  微博   │  │  B站    │  │  抖音   │  │  知乎   │  │ 朋友圈  │ ...    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │            │
        └────────────┴─────┬──────┴────────────┴────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      系统服务层 (System Services)                         │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ Social Media     │  │ Account Service  │  │ LLM Task Service │       │
│  │ Engine (核心引擎) │  │ (账号服务)        │  │ (LLM任务服务)     │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ Notification     │  │ Media Service    │  │ Time Service     │       │
│  │ System (通知)     │  │ (媒体服务)        │  │ (时间服务)        │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ Narrative        │  │ Session Context  │  │ IM Service       │       │
│  │ Service (叙事)    │  │ Service (会话)    │  │ (即时通讯)        │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 服务状态总览

### 3.1 已实现服务

| 服务 | 文档位置 | 状态 | 说明 |
|------|----------|------|------|
| **Social Media Engine** | `social-media-engine.md` | ✅ Phase 1-3 | TrendService、ContentFactory、TrafficEngine |
| **Account Service** | `account-service.md` | ✅ Phase 1-4 | 双层作用域、玩家多重身份 |
| **LLM Task Service** | `llm-task-service/` | ✅ v1.0 | 任务定义、执行、扩展点 |
| **Notification System** | `notification-system.md` | ✅ 已实现 | 通知推送、勿扰模式 |
| **Time Service** | `time-service.md` | ✅ 已实现 | 多时间源、模拟时间 |
| **Narrative Service** | `narrative-service.md` | ✅ 已实现 | 酒馆叙事分发 |
| **统一内容模型** | `已完成的/social-content-types.md` | ✅ Phase 1-5 | UniversalPost、MediaAsset、解析器架构 |

### 3.2 已设计未实现服务

| 服务 | 文档位置 | 状态 | 说明 |
|------|----------|------|------|
| **Session Context Service** | `session-context-service.md` | 📋 设计完成 | 会话隔离、来源追踪 |
| **Media Service** | `media-service.md` | 📋 设计完成 | 统一媒体库、跨应用共享 |
| **Follower Growth Engine** | `follower-growth-engine.md` | 📋 设计完成 | 六大涨粉渠道、数值算法 |
| **IM Service** | `im-service.md` | 📋 设计完成 | 私信引擎、Private Director |
| **User Profile Extension** | `user-profile-extension.md` | 📋 设计完成 | 详细画像、平台差异化 |

### 3.3 需要新增的服务

| 服务 | 优先级 | 说明 |
|------|--------|------|
| **Interaction Service** | 🔴 高 | 统一互动行为（点赞、收藏、评论） |
| **Social Graph Service** | 🟡 中 | 社交图谱管理（关注、粉丝） |
| **Feed Algorithm Service** | 🟡 中 | 信息流推荐算法 |
| **Image Generation Service** | 🟢 低 | AI 配图生成 |
| **Context Sharing Service** | 🟢 低 | 跨 App 上下文共享 |

---

## 4. 核心服务详解

### 4.1 内容层服务

#### 统一内容模型 ✅ 已实现

> 详见 [social-content-types.md](../已完成的/social-content-types.md)

**核心类型**：

```typescript
// 主内容类型
type PrimaryContentType =
  | 'text' | 'gallery' | 'video' | 'article'
  | 'poll' | 'repost' | 'link' | 'audio'
  | 'live' | 'question' | 'answer' | 'mixed';

// 统一帖子结构
interface UniversalPost {
  id: string;
  platformId: string;           // 'weibo' | 'bilibili' | 'zhihu'
  authorId: string;
  timestamp: number;
  primaryType: PrimaryContentType;
  contentFlags: ContentFlags;
  media: MediaAsset[];
  payload: PostPayload;
  stats: UniversalStats;
  topicTags: string[];
  platformData?: Record<string, any>;
}
```

**已完成能力**：
- Phase 1: 统一 payload 结构 ✅
- Phase 2: 社交引擎迁移到新账号系统 ✅
- Phase 3: 消除 UI 类型，使用 DisplayPost ✅
- Phase 4: 提示词适配重构 ✅
- Phase 5: 解析器分发架构（总部-分部） ✅

---

#### 互动系统服务 🆕 建议开发

**目的**：统一管理点赞、收藏、评论等互动行为

**问题背景**：当前微博的 `userActionStore` 实现了点赞/收藏/历史，但与其他 App 无法复用。

```typescript
// src/services/interaction/InteractionService.ts

class InteractionService {
  // 通用互动接口
  async like(contentId: string, userId: string): Promise<void>;
  async unlike(contentId: string, userId: string): Promise<void>;
  async favorite(contentId: string, userId: string): Promise<void>;
  async unfavorite(contentId: string, userId: string): Promise<void>;
  async addComment(contentId: string, userId: string, text: string): Promise<Comment>;
  
  // 互动统计
  async getEngagementStats(contentId: string): Promise<EngagementStats>;
  
  // 用户互动历史
  async getUserLikes(userId: string, platformId?: string): Promise<string[]>;
  async getUserFavorites(userId: string, platformId?: string): Promise<string[]>;
  async getViewHistory(userId: string, limit?: number): Promise<ViewRecord[]>;
  
  // 事件广播（供涨粉引擎等订阅）
  onInteraction(callback: (event: InteractionEvent) => void): () => void;
}

interface InteractionEvent {
  type: 'like' | 'unlike' | 'favorite' | 'comment' | 'view';
  contentId: string;
  userId: string;
  platformId: string;
  timestamp: number;
}
```

**价值**：
- 微博的点赞/收藏逻辑可复用到 B站、知乎
- 涨粉引擎可以统一监听互动事件
- 通知系统可以统一处理互动通知

**实现优先级**：🔴 高（平台化基础）

---

### 4.2 用户/关系层服务

#### Account Service ✅ 已实现

> 详见 [account-service.md](../account-service.md)

**已实现能力**：
- 双层作用域模型（实体级 + 账号级）
- 玩家多重身份
- 平台账号管理
- 社交关系基础管理

**需要扩展**：
- 与 Session Context Service 深度集成
- 账号与会话绑定（见 `session-binding-design.md`）

---

#### Social Graph Service 🆕 建议开发

**目的**：专注于社交关系的管理和图算法

**与 Account Service 的区别**：
- Account Service：管理账号实体和基础数据
- Social Graph Service：专注关系的增删查改和图算法

```typescript
// src/services/socialGraph/SocialGraphService.ts

class SocialGraphService {
  // 关系管理
  async follow(fromId: string, toId: string, platformId: string): Promise<void>;
  async unfollow(fromId: string, toId: string, platformId: string): Promise<void>;
  async block(fromId: string, toId: string): Promise<void>;
  async mute(fromId: string, toId: string): Promise<void>;
  
  // 关系查询
  async getFollowers(accountId: string, options?: QueryOptions): Promise<Account[]>;
  async getFollowing(accountId: string, options?: QueryOptions): Promise<Account[]>;
  async getMutualFollows(accountId: string): Promise<Account[]>;
  async isFollowing(fromId: string, toId: string): Promise<boolean>;
  
  // 推荐算法
  async getRecommendedFollows(accountId: string, limit?: number): Promise<Account[]>;
  async getSimilarUsers(accountId: string): Promise<Account[]>;
  
  // 统计
  async getRelationshipStats(accountId: string): Promise<{
    followers: number;
    following: number;
    mutualFollows: number;
  }>;
  
  // 批量操作
  async batchFollow(fromId: string, toIds: string[]): Promise<void>;
}
```

**实现优先级**：🟡 中

---

### 4.3 分发/算法层服务

#### Feed Algorithm Service 🆕 建议开发

**目的**：为各平台提供可配置的信息流推荐算法

**问题背景**：当前 `TrafficEngine` 只用于热度计算，缺乏完整的信息流推荐能力。

```typescript
// src/services/feed/FeedAlgorithmService.ts

class FeedAlgorithmService {
  // 获取个性化信息流
  async getPersonalizedFeed(
    userId: string,
    platformId: string,
    options?: FeedOptions
  ): Promise<UniversalPost[]>;
  
  // 获取热门内容
  async getTrendingContent(
    platformId: string,
    category?: string,
    limit?: number
  ): Promise<UniversalPost[]>;
  
  // 获取发现页内容
  async getDiscoverContent(
    userId: string,
    platformId: string
  ): Promise<UniversalPost[]>;
  
  // 算法配置（按平台）
  registerAlgorithm(platformId: string, config: AlgorithmConfig): void;
  getAlgorithmConfig(platformId: string): AlgorithmConfig;
}

interface AlgorithmConfig {
  // 权重配置
  weights: {
    recency: number;      // 时效性权重 (0-1)
    engagement: number;   // 互动量权重 (0-1)
    relevance: number;    // 相关性权重 (0-1)
    social: number;       // 社交因素权重 (0-1)
  };
  
  // 衰减参数
  decayHalfLife: number;  // 热度半衰期（小时）
  
  // 多样性控制
  diversityRules?: {
    maxSameAuthor: number;      // 同作者最多几条
    maxSameCategory: number;    // 同类目最多几条
  };
  
  // 平台特定规则
  platformRules?: Record<string, any>;
}

interface FeedOptions {
  limit?: number;
  offset?: number;
  excludeIds?: string[];
  category?: string;
  timeRange?: { start: number; end: number };
}
```

**价值**：
- 微博的 TrafficEngine 可以抽象为通用服务
- 不同平台可以配置不同的算法参数
- 支持用户自定义推荐偏好

**实现优先级**：🟡 中

---

#### Follower Growth Engine 📋 已设计

> 详见 [follower-growth-engine.md](../follower-growth-engine.md)

**设计要点**：
- 六大涨粉渠道（内容曝光、热搜流量、互动转化、转发扩散、大V导流、平台推荐）
- 时间维度模型（冷启动期→增长期→平台期）
- LLM 集成（涨粉故事、粉丝画像生成）

**实现计划**：
| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 基础算法（内容曝光、热搜涨粉） | 📋 待实现 |
| Phase 2 | 互动与扩散 | 📋 待实现 |
| Phase 3 | LLM 增强 | 📋 待实现 |
| Phase 4 | UI 集成 | 📋 待实现 |

**实现优先级**：🟡 中（体验增强）

---

### 4.4 媒体/资源层服务

#### Media Service 📋 已设计

> 详见 [media-service.md](../media-service.md)

**设计要点**：
- 统一媒体库（IndexedDB `media_assets` 表）
- 缩略图自动生成
- 跨应用共享
- 虚拟 URI 系统（`internal://media/images/{id}`）

**实现计划**：
| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | Service 和数据库表 | 📋 待实现 |
| Phase 2 | Gallery 数据迁移 | 📋 待实现 |
| Phase 3 | Store 接入 | 📋 待实现 |
| Phase 4 | UI 适配 | 📋 待实现 |

**实现优先级**：🟡 中

---

#### Image Generation Service 🆕 建议开发

**目的**：为 LLM 生成的内容提供配图能力

**问题背景**：当前博文图片仅为文字描述（`MediaAsset.description`），无法真正展示。

```typescript
// src/services/imageGen/ImageGenerationService.ts

class ImageGenerationService {
  // 根据描述生成图片
  async generateFromDescription(
    description: string,
    options?: GenerationOptions
  ): Promise<MediaAsset>;
  
  // 批量生成
  async generateBatch(
    descriptions: string[],
    options?: GenerationOptions
  ): Promise<MediaAsset[]>;
  
  // 占位图生成（不调用 AI，纯文字描述的占位符）
  generatePlaceholder(description: string, dimensions?: { width: number; height: number }): string;
  
  // 与外部 AI 服务集成
  setProvider(provider: ImageGenProvider): void;
  getAvailableProviders(): ImageGenProvider[];
}

interface GenerationOptions {
  style?: 'realistic' | 'anime' | 'illustration' | 'photo';
  aspectRatio?: '1:1' | '4:3' | '16:9' | '9:16';
  quality?: 'draft' | 'standard' | 'high';
}

type ImageGenProvider = 'dalle' | 'stable-diffusion' | 'midjourney' | 'placeholder';
```

**实现优先级**：🟢 低（锦上添花）

---

### 4.5 通讯层服务

#### IM Service 📋 已设计

> 详见 [im-service.md](../im-service.md)

**设计要点**：
- 统一会话管理
- 拟人化行为模拟（正在输入、延迟回复）
- Private Director（主动社交）
- 多应用隔离

**实现计划**：
| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 核心服务 | 📋 待实现 |
| Phase 2 | 拟人化增强 | 📋 待实现 |
| Phase 3 | 私域导演 | 📋 待实现 |
| Phase 4 | 多应用适配 | 📋 待实现 |

**工作量预估**：10-15h

**实现优先级**：🟢 低（功能完善）

---

### 4.6 上下文/状态层服务

#### Session Context Service 📋 已设计

> 详见 [session-context-service.md](../session-context-service.md)

**设计要点**：
- 统一会话上下文管理（sessionId / messageId / swipeId）
- 来源追踪（`ContentSourceTracking`）
- 多级过滤器（session / message / swipe）
- Bridge 事件自动响应

**与微博现有实现的关系**：
- 微博保持现有实现不变（避免迁移风险）
- 新 App 直接使用系统服务
- 微博可在未来逐步迁移（可选）

**实现计划**：
| Phase | 内容 | 工作量 | 状态 |
|-------|------|--------|------|
| Phase 1 | 基础服务 | 3-4h | 📋 待实现 |
| Phase 2 | Bridge 集成 | 1h | 📋 待实现 |
| Phase 3 | 文档与测试 | 1h | 📋 待实现 |

**实现优先级**：🔴 高（平台化基础）

---

#### Context Sharing Service 🆕 建议开发

**目的**：跨 App 共享 LLM 上下文

```typescript
// src/services/contextSharing/ContextSharingService.ts

class ContextSharingService {
  // 注册上下文提供器
  registerProvider(provider: ContextProvider): void;
  
  // 获取聚合上下文
  async getAggregatedContext(
    requestingId: string,
    scopes: ContextScope[]
  ): Promise<AggregatedContext>;
  
  // 上下文缓存
  getCachedContext(key: string): string | undefined;
  setCachedContext(key: string, value: string, ttl?: number): void;
}

type ContextScope = 
  | 'narrative'           // 酒馆叙事
  | 'recentChatMessages'  // 最近聊天
  | 'userProfile'         // 用户画像
  | 'recentPosts'         // 最近博文
  | 'currentHotTopics';   // 当前热搜

// 使用示例
const context = await contextSharing.getAggregatedContext('weibo', [
  'narrative',
  'userProfile',
]);
```

**实现优先级**：🟢 低

---

### 4.7 AI/生成层服务

#### LLM Task Service ✅ 已实现

> 详见 [llm-task-service/](../llm-task-service/README.md)

**已实现能力**：
- 任务定义与注册
- 任务执行
- 自动执行调度
- 变量替换引擎
- 输出处理机制
- 扩展点（ContextProvider、OutputHandler）

**已接入 App**：微博（8 个任务）

---

## 5. 服务依赖关系

```mermaid
graph TD
    subgraph "应用层"
        Weibo[微博 App]
        Bilibili[B站 App]
        Zhihu[知乎 App]
        WeChat[微信 App]
    end
    
    subgraph "内容服务"
        ContentModel[统一内容模型 ✅]
        Interaction[互动系统 🆕]
        FeedAlgo[信息流算法 🆕]
    end
    
    subgraph "用户服务"
        Account[账号服务 ✅]
        SocialGraph[社交图谱 🆕]
        Profile[用户画像 📋]
        Growth[涨粉引擎 📋]
    end
    
    subgraph "媒体服务"
        Media[媒体服务 📋]
        ImageGen[图片生成 🆕]
    end
    
    subgraph "通讯服务"
        IM[即时通讯 📋]
        Notification[通知系统 ✅]
    end
    
    subgraph "基础服务"
        Time[时间服务 ✅]
        Session[会话上下文 📋]
        Narrative[叙事服务 ✅]
        LLMTask[LLM任务 ✅]
        AI[AI服务 ✅]
    end
    
    %% 应用层依赖
    Weibo --> ContentModel
    Weibo --> Account
    Weibo --> Growth
    Bilibili --> ContentModel
    Bilibili --> Account
    
    %% 服务间依赖
    ContentModel --> Media
    Interaction --> ContentModel
    Interaction --> Notification
    FeedAlgo --> ContentModel
    
    Account --> Session
    SocialGraph --> Account
    Profile --> Account
    Growth --> SocialGraph
    Growth --> Interaction
    Growth --> LLMTask
    
    ImageGen --> AI
    
    IM --> Account
    IM --> Notification
    IM --> LLMTask
    
    LLMTask --> AI
    LLMTask --> Narrative
    Session --> Narrative
```

---

## 6. 实施优先级

### 6.1 高优先级（平台化基础）

| 服务 | 原因 | 预估工作量 |
|------|------|------------|
| **Session Context Service** | 数据隔离基础，多 App 必需 | 4-5h |
| **Interaction Service** | 点赞/收藏/评论的通用化 | 3-4h |

### 6.2 中优先级（体验增强）

| 服务 | 原因 | 预估工作量 |
|------|------|------------|
| **Follower Growth Engine** | 社交模拟真实感 | 8-10h |
| **Media Service** | 图片/视频管理 | 4-6h |
| **Social Graph Service** | 关系管理优化 | 4-5h |
| **Feed Algorithm Service** | 高级推荐 | 6-8h |

### 6.3 低优先级（锦上添花）

| 服务 | 原因 | 预估工作量 |
|------|------|------------|
| **IM Service** | 私信功能完善 | 10-15h |
| **Image Generation Service** | AI 配图 | 4-6h |
| **Context Sharing Service** | 跨 App 上下文 | 3-4h |

---

## 7. 下一步行动建议

### 7.1 短期（1-2 周）

1. **实现 Session Context Service**
   - 参考微博现有实现
   - 提供统一的会话上下文管理
   - 为新 App 开发奠定基础

2. **抽取 Interaction Service**
   - 从微博 `userActionStore` 抽取通用逻辑
   - 定义统一的互动事件类型
   - 支持事件订阅

### 7.2 中期（1 个月）

3. **实现 Follower Growth Engine**
   - 按设计文档逐步实现 Phase 1-2
   - 与 Interaction Service 联动

4. **实现 Media Service**
   - 统一媒体管理
   - 迁移 Gallery 数据

### 7.3 长期

5. **开发第二个社交平台 App（如 B站）**
   - 验证平台化架构
   - 收集反馈，迭代服务设计

6. **完善 IM Service**
   - 支持微信、QQ 等私信应用

---

## 8. 理想服务总览

> 本章从社交内容平台的**本质概念**出发，系统性地分析一个完整的社交内容平台可能涉及的所有通用能力，以及哪些可以被抽象为系统服务。这是一个**理想化的蓝图**，用于指导长期架构演进。

### 8.1 社交平台的核心概念模型

任何社交内容平台，无论是微博、B站、知乎还是抖音，都可以拆解为以下核心概念：

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        社交内容平台的本质模型                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐      创作       ┌─────────────┐      分发       ┌────────┐│
│  │   实体      │ ────────────▶  │   内容      │ ────────────▶  │  消费  ││
│  │  (Entity)   │                │  (Content)  │                │(Consume)││
│  └──────┬──────┘                └──────┬──────┘                └────┬────┘│
│         │                              │                            │      │
│         │ 拥有                          │ 触发                        │ 产生 │
│         ▼                              ▼                            ▼      │
│  ┌─────────────┐                ┌─────────────┐                ┌────────┐│
│  │   身份      │                │   互动      │                │  反馈  ││
│  │ (Identity)  │                │(Interaction)│                │(Feedback)│
│  └──────┬──────┘                └──────┬──────┘                └────┬────┘│
│         │                              │                            │      │
│         │ 建立                          │ 形成                        │ 影响 │
│         ▼                              ▼                            ▼      │
│  ┌─────────────┐                ┌─────────────┐                ┌────────┐│
│  │   关系      │                │   热度      │                │  成长  ││
│  │ (Relation)  │                │  (Heat)     │                │(Growth) ││
│  └─────────────┘                └─────────────┘                └────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 理想服务分层架构

基于上述概念模型，理想的服务分层如下：

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              应用层 (Skin)                                   │
│    微博 │ B站 │ 知乎 │ 抖音 │ 朋友圈 │ 小红书 │ 贴吧 │ 论坛 │ ...           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            领域服务层 (Domain)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 内容域        │ 用户域        │ 社交域        │ 传播域        │ 商业域 │   │
│  │ Content       │ User          │ Social        │ Distribution  │ Business│  │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            能力服务层 (Capability)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 存储    │ 搜索    │ 推荐    │ 通知    │ 媒体    │ AI生成  │ 时间    │   │
│  │ Storage │ Search  │ Recommend│ Notify │ Media   │ AIGen   │ Time    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            基础设施层 (Infrastructure)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 数据库  │ 事件总线 │ 上下文管理 │ 配置中心 │ 日志    │ Bridge       │   │
│  │ IndexedDB│ EventBus│ Context   │ Config  │ Logger  │ SillyTavern  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 领域服务详解

#### 8.3.1 内容域 (Content Domain)

**核心问题**：内容的生命周期管理——创作、存储、展示、归档

| 服务 | 职责 | 通用概念 | 状态 |
|------|------|----------|------|
| **Content Model Service** | 统一内容结构定义 | 帖子、文章、视频、问答 | ✅ 已实现 |
| **Content Factory Service** | 内容生成（LLM） | 博文生成、评论生成 | ✅ 已实现 |
| **Content Parser Service** | 平台特定格式解析 | 微博格式、B站格式 | ✅ 已实现 |
| **Archive Service** | 长期记忆与知识库 | 事件归档、角色档案、世界设定 | 📋 待抽取 |
| **Draft Service** | 草稿管理 | 未发布内容暂存 | 💡 可选 |
| **Template Service** | 内容模板 | 发帖模板、回复模板 | 💡 可选 |

**Archive Service 设计要点**（从 archives.md 抽取）：

```typescript
interface ArchiveService {
  // === 档案 CRUD ===
  getArchive(id: string): Promise<ArchiveBase>;
  saveArchive(archive: ArchiveBase): Promise<void>;
  queryArchives(filter: ArchiveFilter): Promise<ArchiveBase[]>;
  
  // === 知识注入系统（核心能力）===
  getInjection(request: InjectionRequest): Promise<InjectionResult>;
  getPinnedArchives(sessionId: string): Promise<ArchiveBase[]>;  // always 级别
  matchByKeywords(keywords: string[], sessionId: string): Promise<ArchiveBase[]>;
  
  // === 账号绑定 ===
  bindToAccount(archiveId: string, accountId: string): Promise<void>;
  unbindFromAccount(archiveId: string, accountId: string): Promise<void>;
  getAccountArchives(accountId: string): Promise<ArchiveBase[]>;
  
  // === 去重服务 ===
  deduplication: ArchiveDeduplicationService;
  
  // === 提取服务（LLM） ===
  extractFromChat(floors: FloorData[], options?: ExtractOptions): Promise<ExtractResult>;
}

// 注入级别
type InjectionLevel = 'none' | 'contextual' | 'always';

// 档案类型
type ArchiveType = 'event' | 'character' | 'world' | 'dialogue' | 'discovery';
```

---

#### 8.3.2 用户域 (User Domain)

**核心问题**：身份的多重性——一个实体可以有多个平台身份

| 服务 | 职责 | 通用概念 | 状态 |
|------|------|----------|------|
| **Account Service** | 账号实体管理 | 玩家、NPC、账号 | ✅ 已实现 |
| **Identity Service** | 身份与人设 | 角色人设、账号人设 | 📋 部分实现 |
| **Profile Service** | 用户画像 | 兴趣标签、行为特征 | 📋 已设计 |
| **Preference Service** | 用户偏好 | 推荐偏好、隐私设置 | 💡 可选 |
| **Credential Service** | 认证信息 | 蓝V认证、等级徽章 | 💡 可选 |

---

#### 8.3.3 社交域 (Social Domain)

**核心问题**：关系的建立与维护——单向关注、双向好友、群组

| 服务 | 职责 | 通用概念 | 状态 |
|------|------|----------|------|
| **Social Graph Service** | 关系图谱 | 关注、粉丝、好友、拉黑 | 🆕 建议开发 |
| **Interaction Service** | 互动行为 | 点赞、收藏、评论、转发 | 🆕 建议开发 |
| **IM Service** | 即时通讯 | 私信、群聊、@提及 | 📋 已设计 |
| **Group Service** | 群组管理 | 粉丝群、兴趣圈 | 💡 可选 |
| **Mention Service** | @提及系统 | @用户、#话题# | 💡 可选 |

**Interaction Service 通用接口**：

```typescript
interface InteractionService {
  // === 互动行为 ===
  like(contentId: string, userId: string): Promise<void>;
  unlike(contentId: string, userId: string): Promise<void>;
  favorite(contentId: string, userId: string, collection?: string): Promise<void>;
  unfavorite(contentId: string, userId: string): Promise<void>;
  repost(contentId: string, userId: string, comment?: string): Promise<string>;
  comment(contentId: string, userId: string, text: string, replyTo?: string): Promise<Comment>;
  
  // === 查询 ===
  getUserLikes(userId: string, platformId?: string): Promise<string[]>;
  getUserFavorites(userId: string, platformId?: string): Promise<string[]>;
  getContentInteractions(contentId: string): Promise<InteractionStats>;
  
  // === 浏览历史 ===
  recordView(contentId: string, userId: string, duration?: number): Promise<void>;
  getViewHistory(userId: string, limit?: number): Promise<ViewRecord[]>;
  
  // === 事件订阅 ===
  onInteraction(callback: (event: InteractionEvent) => void): () => void;
}
```

---

#### 8.3.4 传播域 (Distribution Domain)

**核心问题**：内容如何触达用户——推荐、搜索、热点

| 服务 | 职责 | 通用概念 | 状态 |
|------|------|----------|------|
| **Feed Service** | 信息流聚合 | 首页流、关注流、推荐流 | 🆕 建议开发 |
| **Trending Service** | 热点管理 | 热搜榜、热门话题 | 🆕 建议抽取 |
| **Search Service** | 搜索能力 | 内容搜索、用户搜索 | 💡 可选 |
| **Traffic Engine** | 流量分配 | 曝光量、热度计算 | ✅ 已实现 |
| **Growth Engine** | 粉丝增长 | 涨粉算法、冷启动 | 📋 已设计 |

**Trending Service 设计要点**：

```typescript
interface TrendingService {
  // === 热搜管理 ===
  getTrending(platformId: string, options?: TrendingOptions): Promise<TrendItem[]>;
  generateTrending(platformId: string, context: TrendingContext): Promise<TrendItem[]>;
  
  // === 平台配置 ===
  registerPlatformConfig(platformId: string, config: TrendingConfig): void;
  
  // === 共享设置（App 级控制）===
  setSharePolicy(platformId: string, policy: SharePolicy): void;
  getSharedTrending(requesterAppId: string): Promise<TrendItem[]>;
  
  // === 事件通知 ===
  onTrendingUpdate(callback: (event: TrendingUpdateEvent) => void): () => void;
}

interface TrendingConfig {
  maxItems: number;              // 榜单长度（微博 50，B站 10）
  categories: string[];          // 分类（娱乐、科技、社会...）
  refreshInterval: number;       // 刷新间隔
  hotValueFormula: string;       // 热度计算公式
  allowSponsored: boolean;       // 是否允许广告位
}

interface SharePolicy {
  enabled: boolean;              // 是否对外共享
  allowedConsumers: string[];    // 允许访问的 App ID（'*' 表示全部）
  excludeCategories?: string[];  // 不共享的分类
}
```

---

#### 8.3.5 商业域 (Business Domain) 💡 可选

**核心问题**：虚拟经济与激励——虚拟货币、打赏、会员

| 服务 | 职责 | 通用概念 | 状态 |
|------|------|----------|------|
| **Wallet Service** | 虚拟钱包 | 余额、收支记录 | 💡 可选 |
| **Reward Service** | 打赏系统 | 赞赏、礼物 | 💡 可选 |
| **Membership Service** | 会员体系 | VIP、等级特权 | 💡 可选 |
| **Ad Service** | 广告系统 | 推广内容、广告位 | 💡 可选 |

---

### 8.4 能力服务详解

#### 8.4.1 存储与状态

| 服务 | 职责 | 状态 |
|------|------|------|
| **Session Context Service** | 会话隔离、来源追踪 | 📋 已设计 |
| **Context Sharing Service** | 跨 App 上下文共享 | 📋 待实现 |
| **Cache Service** | 热数据缓存 | 💡 可选 |
| **Persistence Service** | 数据持久化 | ✅ 已实现 (IndexedDB) |

**Context Sharing Service 设计要点**（优先级提升）：

```typescript
interface ContextSharingService {
  // === 发布上下文 ===
  publish(context: SharedContext): void;
  updateContext(id: string, value: Record<string, any>): void;
  unpublish(id: string): void;
  
  // === 订阅上下文 ===
  subscribe(contextId: string, callback: (value: any) => void): () => void;
  getContext(id: string): any | undefined;
  
  // === 查询 ===
  getPublicContexts(): SharedContext[];
  getContextsByPublisher(appId: string): SharedContext[];
}

// 预定义的共享上下文类型
type WellKnownContext =
  | 'system:time'           // 当前时间
  | 'system:session'        // 会话信息
  | 'narrative:content'     // 酒馆叙事
  | 'narrative:characters'  // 当前角色
  | 'trending:hot'          // 热搜数据
  | 'archive:core'          // 核心档案
  | 'chat:lastMessage';     // 最新聊天
```

---

#### 8.4.2 搜索与发现

| 服务 | 职责 | 状态 |
|------|------|------|
| **Search Service** | 全文搜索与语义搜索 | 🟡 建议开发 |
| **Discovery Service** | 发现推荐 | 💡 可选 |
| **Tag Service** | 标签管理 | 💡 可选 |

**Search Service 设计要点**：

```typescript
interface SearchService {
  // === 搜索接口 ===
  search(query: SearchQuery): Promise<SearchResult>;
  
  // === 索引管理 ===
  index(item: Indexable): Promise<void>;
  indexBatch(items: Indexable[]): Promise<void>;
  remove(id: string, type: IndexableType): Promise<void>;
  reindex(type?: IndexableType): Promise<void>;
  
  // === 建议与补全 ===
  suggest(prefix: string, options?: SuggestOptions): Promise<string[]>;
  
  // === 高级搜索（语义） ===
  semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SearchResult>;
}

interface SearchQuery {
  text: string;                       // 搜索文本
  type?: IndexableType | IndexableType[];  // 搜索范围
  filters?: SearchFilter[];           // 过滤条件
  sort?: SearchSort;                  // 排序方式
  pagination?: { offset: number; limit: number };
  
  // 高级选项
  fuzzy?: boolean;                    // 模糊匹配
  highlight?: boolean;                // 高亮匹配
}

type IndexableType = 
  | 'post'           // 帖子/博文
  | 'comment'        // 评论
  | 'account'        // 用户/账号
  | 'topic'          // 话题/热搜
  | 'archive'        // 档案
  | 'message';       // 私信

interface SearchResult {
  items: SearchResultItem[];
  total: number;
  took: number;                       // 耗时 ms
  suggestions?: string[];             // 搜索建议
}

interface SearchResultItem {
  id: string;
  type: IndexableType;
  score: number;                      // 相关性分数
  highlights?: Record<string, string[]>;  // 高亮片段
  data: any;                          // 原始数据
}
```

**搜索能力分层**：

| 层级 | 能力 | 实现方式 | 适用场景 |
|------|------|----------|----------|
| L1 | 精确匹配 | IndexedDB 索引 | ID/用户名查找 |
| L2 | 全文搜索 | 分词 + 倒排索引 | 内容搜索 |
| L3 | 模糊搜索 | 编辑距离算法 | 纠错、近似匹配 |
| L4 | 语义搜索 | 向量化 + 相似度 | 智能推荐 |

---

#### 8.4.3 通知与触达

| 服务 | 职责 | 状态 |
|------|------|------|
| **Notification Service** | 消息通知 | ✅ 已实现 |
| **Push Service** | 主动推送 | 💡 可选 |
| **Badge Service** | 角标管理 | 💡 可选 |

---

#### 8.4.4 媒体处理

| 服务 | 职责 | 状态 |
|------|------|------|
| **Media Service** | 媒体存储与管理 | 📋 已设计 |
| **Image Gen Service** | AI 图片生成 | 🆕 建议开发 |
| **Thumbnail Service** | 缩略图生成 | 💡 可选 |
| **Audio Service** | 音频处理 | ✅ 已实现 |

---

#### 8.4.5 AI 生成

| 服务 | 职责 | 状态 |
|------|------|------|
| **LLM Task Service** | 任务调度与执行 | ✅ 已实现 |
| **AI Generate Service** | 底层生成接口 | ✅ 已实现 |
| **Prompt Service** | 提示词管理 | ✅ 已实现 |
| **Narrative Service** | 酒馆叙事获取 | ✅ 已实现 |

---

#### 8.4.6 时间与调度

| 服务 | 职责 | 状态 |
|------|------|------|
| **Time Service** | 多时间源管理 | ✅ 已实现 |
| **Scheduler Service** | 定时任务调度 | 🟡 建议开发 |
| **Rate Limiter Service** | 频率控制与限流 | 🟡 建议开发 |

**Scheduler Service 设计要点**：

```typescript
interface SchedulerService {
  // === 任务注册 ===
  register(task: ScheduledTask): string;  // 返回 taskId
  unregister(taskId: string): void;
  
  // === 任务控制 ===
  pause(taskId: string): void;
  resume(taskId: string): void;
  trigger(taskId: string): Promise<void>;  // 立即执行
  
  // === 查询 ===
  getTask(taskId: string): ScheduledTask | undefined;
  getAllTasks(): ScheduledTask[];
  getTasksByApp(appId: string): ScheduledTask[];
  
  // === 生命周期 ===
  start(): void;   // 启动调度器
  stop(): void;    // 停止所有任务
}

interface ScheduledTask {
  id: string;
  appId: string;              // 所属应用
  name: string;
  
  // 触发条件（三选一）
  schedule: 
    | { type: 'interval'; ms: number }           // 固定间隔
    | { type: 'cron'; expression: string }       // Cron 表达式
    | { type: 'event'; eventName: string };      // 事件触发
  
  // 执行配置
  handler: () => Promise<void>;
  retryOnFail?: number;       // 失败重试次数
  timeout?: number;           // 超时时间
  
  // 状态
  enabled: boolean;
  lastRunAt?: number;
  lastResult?: 'success' | 'failed' | 'timeout';
  nextRunAt?: number;
}
```

**典型使用场景**：

| 场景 | 调度类型 | 示例 |
|------|----------|------|
| LLM Task 自动执行 | interval | 每 5 分钟检查待执行任务 |
| 热搜刷新 | interval | 每 10 分钟更新热搜榜 |
| 档案自动归档 | event | 新楼层事件触发检查 |
| 内容过期清理 | cron | 每天凌晨 3 点 |
| 粉丝增长结算 | interval | 每小时结算涨粉 |

---

**Rate Limiter Service 设计要点**：

```typescript
interface RateLimiterService {
  // === 限流检查 ===
  acquire(key: string, cost?: number): Promise<RateLimitResult>;
  tryAcquire(key: string, cost?: number): RateLimitResult;
  
  // === 配额管理 ===
  setQuota(key: string, quota: RateQuota): void;
  getQuota(key: string): RateQuota | undefined;
  resetQuota(key: string): void;
  
  // === 查询 ===
  getRemaining(key: string): number;
  getResetTime(key: string): number;
}

interface RateQuota {
  limit: number;              // 配额上限
  window: number;             // 时间窗口（ms）
  strategy: 'sliding' | 'fixed';  // 滑动窗口 / 固定窗口
}

interface RateLimitResult {
  allowed: boolean;           // 是否允许
  remaining: number;          // 剩余配额
  resetAt: number;            // 重置时间
  retryAfter?: number;        // 建议等待时间
}
```

**典型使用场景**：

| 场景 | Key 格式 | 配额示例 |
|------|----------|----------|
| LLM API 调用 | `llm:${provider}` | 60次/分钟 |
| 内容生成 | `generate:${appId}` | 100次/小时 |
| 用户操作 | `action:${userId}:${type}` | 10次/分钟 |
| 评论发送 | `comment:${postId}` | 5次/分钟 |

---

### 8.5 基础设施层详解

基础设施层提供最底层的通用能力，是所有上层服务的基石。

#### 8.5.1 服务总览

| 服务 | 职责 | 状态 |
|------|------|------|
| **Event Bus** | 跨服务事件通信 | 🟡 建议开发 |
| **Vector Store** | 向量存储与相似度查询 | 🟡 建议开发 |
| **JSON Parser** | 鲁棒的 JSON 解析与修复 | ✅ 已实现 (待抽取) |
| **Lazy Loader** | 惰性加载框架 | ✅ 已实现 (待抽取) |
| **Expression Engine** | 表达式求值引擎 | ✅ 已实现 (待抽取) |
| **Database Service** | IndexedDB 封装 | ✅ 已实现 |
| **Logger Service** | 统一日志 | 💡 可选 |
| **Config Service** | 配置中心 | 💡 可选 |

---

#### 8.5.2 Event Bus（事件总线）

**为什么需要**：当前服务间通信主要通过直接调用，缺乏解耦的事件机制。

```typescript
interface EventBus {
  // === 发布/订阅 ===
  emit<T>(event: string, payload: T): void;
  on<T>(event: string, handler: (payload: T) => void): () => void;
  once<T>(event: string, handler: (payload: T) => void): () => void;
  off(event: string, handler?: Function): void;
  
  // === 通道隔离 ===
  channel(name: string): EventChannel;  // 创建/获取命名通道
  
  // === 调试 ===
  getListenerCount(event: string): number;
  getAllEvents(): string[];
}

// 预定义事件类型
type SystemEvent =
  // 会话相关
  | 'session:changed'           // 会话切换
  | 'session:message:new'       // 新消息
  | 'session:swipe:changed'     // Swipe 切换
  
  // 内容相关
  | 'content:post:created'      // 新帖子
  | 'content:comment:created'   // 新评论
  | 'content:trending:updated'  // 热搜更新
  
  // 互动相关
  | 'interaction:like'          // 点赞
  | 'interaction:favorite'      // 收藏
  | 'interaction:follow'        // 关注
  
  // 用户相关
  | 'account:created'           // 新账号
  | 'account:updated'           // 账号更新
  
  // 系统相关
  | 'time:tick'                 // 时间流逝
  | 'llm:task:completed'        // LLM 任务完成
  | 'archive:extracted';        // 档案提取完成
```

**典型使用场景**：

```typescript
// 涨粉引擎监听互动事件
eventBus.on('interaction:like', ({ contentId, userId }) => {
  growthEngine.processInteraction('like', contentId, userId);
});

// 通知系统监听新评论
eventBus.on('content:comment:created', ({ postId, authorId }) => {
  notificationService.notifyPostAuthor(postId, 'new_comment');
});

// 热搜更新时刷新多个 App
eventBus.on('content:trending:updated', ({ platformId }) => {
  // 所有订阅者自动收到通知
});
```

---

#### 8.5.3 Vector Store（向量存储）

**为什么需要**：语义搜索、相似内容推荐、档案智能匹配都依赖向量化能力。

> 参考 `social-media-engine.md` 中提到的「惰性语义索引」设计思路

```typescript
interface VectorStore {
  // === 向量操作 ===
  upsert(id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
  delete(id: string): Promise<void>;
  
  // === 相似度查询 ===
  query(options: VectorQueryOptions): Promise<VectorQueryResult[]>;
  
  // === 批量操作 ===
  upsertBatch(items: VectorItem[]): Promise<void>;
  deleteBatch(ids: string[]): Promise<void>;
  
  // === 管理 ===
  count(): Promise<number>;
  clear(): Promise<void>;
}

interface VectorQueryOptions {
  vector?: number[];            // 查询向量
  text?: string;                // 文本（自动向量化）
  topK: number;                 // 返回数量
  threshold?: number;           // 相似度阈值 (0-1)
  filter?: Record<string, any>; // 元数据过滤
  includeMetadata?: boolean;
  includeVector?: boolean;
}

interface VectorQueryResult {
  id: string;
  score: number;                // 相似度分数
  metadata?: Record<string, any>;
  vector?: number[];
}
```

**实现方案对比**：

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **IndexedDB + 暴力搜索** | 零依赖 | 性能差 | <1000 条 |
| **HNSW.js** | 纯 JS，高性能 | 需要额外库 | 本地优先 |
| **外部 Embedding API** | 高质量向量 | 需要网络 | 语义搜索 |
| **LLM 辅助匹配** | 无需向量 | 每次调用 LLM | 回退方案 |

**推荐策略**：

```typescript
// 分层向量化策略
const vectorStore = new VectorStore({
  // 主方案：本地 HNSW 索引
  primary: new HNSWIndex({ dimensions: 384 }),
  
  // Embedding 提供器（可选）
  embedder: {
    provider: 'local',  // 'local' | 'openai' | 'voyage'
    model: 'all-MiniLM-L6-v2',  // 本地小模型
  },
  
  // 回退：LLM 语义匹配
  fallback: 'llm-match',
});
```

**典型使用场景**：

| 场景 | 数据类型 | 查询方式 |
|------|----------|----------|
| 相似帖子推荐 | 帖子内容向量 | 「看过这个的还看了」|
| 档案语义搜索 | 档案摘要向量 | 「和主角的冲突」|
| 用户兴趣匹配 | 用户画像向量 | 推荐关注 |
| 话题聚类 | 热搜描述向量 | 合并相似话题 |

---

#### 8.5.4 JSON Parser（鲁棒解析器）

**为什么需要**：LLM 输出的 JSON 经常有格式问题（Markdown 包裹、尾逗号、单引号等）。

> 已在 `ContentFactory.parseAndRepairJSON` 中实现，建议抽取为独立服务

```typescript
interface JsonParserService {
  // === 解析 ===
  parse<T>(text: string, options?: ParseOptions): ParseResult<T>;
  parseStrict<T>(text: string): T;  // 抛出异常
  
  // === 修复 ===
  repair(text: string): string;     // 尝试修复并返回字符串
  
  // === 提取 ===
  extractJson(text: string): string | null;  // 从混合文本中提取 JSON
  extractAllJson(text: string): string[];    // 提取所有 JSON 块
}

interface ParseOptions {
  allowComments?: boolean;      // 允许注释
  allowTrailingComma?: boolean; // 允许尾逗号
  allowSingleQuotes?: boolean;  // 允许单引号
  repairOnFail?: boolean;       // 解析失败时尝试修复
}

interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  repaired?: boolean;           // 是否经过修复
  warnings?: string[];          // 修复过程中的警告
}
```

**修复能力**：

| 问题 | 示例 | 修复方式 |
|------|------|----------|
| Markdown 包裹 | \`\`\`json {...} \`\`\` | 提取内部 JSON |
| 尾逗号 | `{"a": 1,}` | 移除多余逗号 |
| 单引号 | `{'a': 1}` | 转换为双引号 |
| 缺少引号 | `{a: 1}` | 添加键名引号 |
| 多余文本 | `Sure! {...}` | 提取 JSON 部分 |

---

#### 8.5.5 Lazy Loader（惰性加载框架）

**为什么需要**：社交引擎的「惰性内容填充」是核心设计，应抽象为通用能力。

> 已在 `TrendService` 中实现，用于点击话题时才生成相关博文

```typescript
interface LazyLoader<T> {
  // === 获取数据（自动触发加载）===
  get(key: string): Promise<T | undefined>;
  getMany(keys: string[]): Promise<Map<string, T>>;
  
  // === 检查状态 ===
  has(key: string): boolean;          // 是否已加载
  isLoading(key: string): boolean;    // 是否正在加载
  
  // === 预加载 ===
  preload(keys: string[]): Promise<void>;
  
  // === 失效 ===
  invalidate(key: string): void;
  invalidateAll(): void;
}

interface LazyLoaderOptions<T> {
  loader: (key: string) => Promise<T>;    // 加载函数
  batchLoader?: (keys: string[]) => Promise<Map<string, T>>;  // 批量加载
  
  // 缓存策略
  cache?: {
    maxSize?: number;           // 最大缓存数
    ttl?: number;               // 过期时间 ms
    strategy?: 'lru' | 'fifo';  // 淘汰策略
  };
  
  // 并发控制
  concurrency?: number;         // 最大并发数
  deduplication?: boolean;      // 去重相同请求
}
```

**典型使用场景**：

```typescript
// 话题内容惰性加载
const topicPostsLoader = createLazyLoader<Post[]>({
  loader: async (topicId) => {
    return contentFactory.generatePostsForTopic(topicId, 5);
  },
  cache: { maxSize: 50, ttl: 30 * 60 * 1000 },  // 缓存 30 分钟
});

// 评论区惰性加载
const commentsLoader = createLazyLoader<Comment[]>({
  loader: async (postId) => {
    return contentFactory.generateComments(postId, 10);
  },
  concurrency: 3,  // 最多同时生成 3 个帖子的评论
});
```

---

#### 8.5.6 Expression Engine（表达式引擎）

**为什么需要**：提示词链的变量映射、条件判断都需要表达式求值能力。

> 已在 `PromptChainExecutor` 中实现，支持 `{{step1.result}}` 等模板语法

```typescript
interface ExpressionEngine {
  // === 求值 ===
  evaluate(expression: string, context: Record<string, any>): any;
  evaluateTemplate(template: string, context: Record<string, any>): string;
  
  // === 安全模式 ===
  evaluateSafe(expression: string, context: Record<string, any>): EvalResult;
  
  // === 验证 ===
  validate(expression: string): ValidationResult;
  extractVariables(expression: string): string[];  // 提取使用的变量名
}

// 支持的表达式语法
type ExpressionSyntax =
  | '{{variable}}'                    // 简单变量
  | '{{object.property}}'             // 点号访问
  | '{{array[0]}}'                    // 数组访问
  | '{{a || b}}'                      // 逻辑或（默认值）
  | '{{a ? b : c}}'                   // 三元表达式
  | '{{fn(arg)}}'                     // 函数调用（受限）
  | '{{value | filter}}';             // 过滤器

// 内置过滤器
const builtinFilters = {
  json: (v) => JSON.stringify(v),
  uppercase: (v) => String(v).toUpperCase(),
  lowercase: (v) => String(v).toLowerCase(),
  truncate: (v, len) => String(v).slice(0, len),
  default: (v, def) => v ?? def,
};
```

---

#### 8.5.7 Deep Link Service（深度链接服务）

**为什么需要**：内容中经常出现指向其他平台或应用的链接（LLM 生成或开发者预设），点击后应能直接跳转到目标应用的对应页面，而非简单的外部链接。

**典型场景**：

| 场景 | 来源 | 目标 | 示例 |
|------|------|------|------|
| 博文配图管理 | 微博详情页 | 图库 App | 「在图库中查看」|
| 热搜话题讨论 | 热搜列表 | 论坛/知乎 | 「查看更多讨论」|
| 用户主页跳转 | 评论区 @提及 | 该用户在其他平台的主页 | 「@xxx 的B站主页」|
| 相关内容推荐 | 帖子底部 | 其他平台同话题内容 | 「B站相关视频」|
| 档案关联 | 角色档案 | 该角色的社交账号 | 「查看微博动态」|
| 私信入口 | 用户卡片 | IM App | 「发送私信」|

```typescript
interface DeepLinkService {
  // === 链接解析 ===
  parse(url: string): DeepLink | null;
  isDeepLink(url: string): boolean;
  
  // === 链接生成 ===
  generate(target: DeepLinkTarget): string;
  
  // === 导航执行 ===
  navigate(link: DeepLink): Promise<boolean>;
  
  // === 路由注册 ===
  registerApp(appId: string, routes: DeepLinkRoute[]): void;
  
  // === 链接检测（用于内容渲染）===
  extractLinks(content: string): ExtractedLink[];
  renderWithLinks(content: string, options?: RenderOptions): string;
}

// 深度链接结构
interface DeepLink {
  scheme: 'app';              // 固定为 'app'
  appId: string;              // 目标应用 ID
  path: string;               // 应用内路径
  params?: Record<string, string>;  // 参数
  
  // 元信息（用于预览）
  meta?: {
    title?: string;           // 链接标题
    icon?: string;            // 图标
    preview?: string;         // 预览文本
  };
}

// 链接目标快捷构造
interface DeepLinkTarget {
  app: string;
  action: string;
  id?: string;
  params?: Record<string, string>;
}

// 路由定义
interface DeepLinkRoute {
  pattern: string;            // 路径模式，如 '/post/:id'
  handler: (params: Record<string, string>) => void;
  meta?: {
    title: string;
    icon?: string;
  };
}

// 提取的链接
interface ExtractedLink {
  raw: string;                // 原始文本
  deepLink: DeepLink;         // 解析后的链接
  start: number;              // 在内容中的起始位置
  end: number;                // 结束位置
}
```

**链接格式设计**：

```text
标准格式：
app://weibo/post/12345
app://gallery/image/abc?action=edit
app://chat/conversation/user_123
app://archives/character/char_456

简写格式（用于 LLM 生成）：
@weibo:post/12345
@gallery:image/abc
#查看图库(gallery:image/abc)
```

**LLM 提示词集成**：

```typescript
// 在内容生成提示词中说明链接格式
const LINK_INSTRUCTION = `
如果需要引用其他平台的内容，请使用以下格式：
- 微博帖子：@weibo:post/{id}
- B站视频：@bilibili:video/{id}  
- 图片详情：@gallery:image/{id}
- 用户主页：@{platform}:user/{id}

示例："这张照片太美了 @gallery:image/sunset_001 想设为壁纸"
`;
```

**渲染集成**：

```vue
<template>
  <!-- 自动识别并渲染深度链接 -->
  <RichContent :content="post.content" :enable-deep-links="true" />
</template>

<script setup>
// RichContent 组件内部
const renderedContent = computed(() => {
  return deepLinkService.renderWithLinks(props.content, {
    linkClass: 'deep-link',
    onClick: (link) => deepLinkService.navigate(link),
  });
});
</script>
```

**实现优先级**：🟢 低（锦上添花，但对沉浸感提升显著）

---

#### 8.5.8 Logger Service（日志服务）

**为什么需要**：统一的日志系统对开发调试至关重要，当前各模块 `console.log` 散落各处，难以追踪和过滤。

```typescript
interface LoggerService {
  // === 日志输出 ===
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  
  // === 分组日志 ===
  group(label: string): void;
  groupEnd(): void;
  
  // === 性能计时 ===
  time(label: string): void;
  timeEnd(label: string): number;  // 返回耗时 ms
  
  // === 子日志器（带命名空间）===
  child(namespace: string): Logger;
  
  // === 配置 ===
  setLevel(level: LogLevel): void;
  setFilter(filter: LogFilter): void;
  addTransport(transport: LogTransport): void;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LogFilter {
  namespaces?: string[];        // 只显示特定命名空间
  excludeNamespaces?: string[]; // 排除特定命名空间
  minLevel?: LogLevel;          // 最低显示级别
}

interface LogTransport {
  name: string;
  write(entry: LogEntry): void;
}

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  namespace: string;
  message: string;
  args: any[];
  stack?: string;               // 错误堆栈
}
```

**使用方式**：

```typescript
// 创建模块专属日志器
const logger = loggerService.child('weibo:store');

logger.debug('Loading posts for topic', { topicId });
logger.info('Posts loaded', { count: posts.length });
logger.warn('Cache miss, generating content');
logger.error('Failed to generate', error);

// 性能追踪
logger.time('generatePosts');
await contentFactory.generatePosts(topic, 5);
const elapsed = logger.timeEnd('generatePosts');
// [weibo:store] generatePosts: 1234ms
```

**Transport 扩展**：

| Transport | 说明 | 使用场景 |
|-----------|------|----------|
| `ConsoleTransport` | 输出到浏览器控制台 | 开发调试 |
| `MemoryTransport` | 存储到内存环形缓冲区 | 运行时日志查看 |
| `IndexedDBTransport` | 持久化到 IndexedDB | 错误日志留存 |
| `RemoteTransport` | 发送到远程服务 | 生产环境监控 |

**开发者工具集成**（规划中）：

```typescript
// 在设置 App 中提供日志查看器
interface LogViewer {
  // 实时日志流
  subscribe(filter?: LogFilter): Observable<LogEntry>;
  
  // 历史查询
  query(options: LogQueryOptions): Promise<LogEntry[]>;
  
  // 导出
  export(format: 'json' | 'csv'): Promise<Blob>;
  
  // 清理
  clear(): Promise<void>;
}
```

---

### 8.6 服务总览矩阵

下表汇总所有理想服务及其状态：

| 分层 | 服务 | 优先级 | 状态 | 备注 |
|------|------|--------|------|------|
| **内容域** | Content Model | - | ✅ | 统一内容结构 |
| | Content Factory | - | ✅ | LLM 内容生成 |
| | Content Parser | - | ✅ | 平台格式解析 |
| | **Archive Service** | 🟡 | 📋 | 从 archives.md 抽取 |
| **用户域** | Account Service | - | ✅ | 账号管理 |
| | Profile Service | 🟢 | 📋 | 用户画像 |
| **社交域** | **Social Graph** | 🟡 | 🆕 | 关系图谱 |
| | **Interaction** | 🔴 | 🆕 | 互动行为（高优先级）|
| | IM Service | 🟢 | 📋 | 即时通讯 |
| **传播域** | Feed Service | 🟡 | 🆕 | 信息流 |
| | **Trending Service** | 🟡 | 🆕 | 热搜服务（从微博抽取）|
| | Traffic Engine | - | ✅ | 流量引擎 |
| | Growth Engine | 🟡 | 📋 | 涨粉算法 |
| **能力层** | **Session Context** | 🔴 | 📋 | 会话上下文（高优先级）|
| | **Context Sharing** | 🟡 | 📋 | 上下文共享（优先级提升）|
| | **Search Service** | 🟡 | 🆕 | 全文/语义搜索 |
| | **Scheduler Service** | 🟡 | 🆕 | 定时任务调度 |
| | **Rate Limiter** | 🟡 | 🆕 | 频率控制限流 |
| | Media Service | 🟡 | 📋 | 媒体管理 |
| | Notification | - | ✅ | 通知系统 |
| | Time Service | - | ✅ | 时间服务 |
| | LLM Task | - | ✅ | LLM 任务 |
| | Narrative | - | ✅ | 叙事服务 |
| **基础设施** | **Event Bus** | 🟡 | 🆕 | 事件总线 |
| | **Vector Store** | 🟡 | 🆕 | 向量存储与相似度查询 |
| | **Logger Service** | 🟡 | 🆕 | 统一日志与调试 |
| | **Deep Link Service** | 🟢 | 🆕 | 跨应用深度链接导航 |
| | JSON Parser | - | ✅ | 鲁棒 JSON 解析（待抽取）|
| | Lazy Loader | - | ✅ | 惰性加载框架（待抽取）|
| | Expression Engine | - | ✅ | 表达式求值（待抽取）|
| | Database (IndexedDB) | - | ✅ | 数据持久化 |

**图例**：
- ✅ 已实现
- 📋 已设计/待实现
- 🆕 建议新增
- 💡 可选（锦上添花）
- 🔴 高优先级 / 🟡 中优先级 / 🟢 低优先级

**抽取说明**：部分能力已在现有代码中实现，但需要抽取为独立服务：

| 现有位置 | 抽取为 | 说明 |
|----------|--------|------|
| `ContentFactory.parseAndRepairJSON` | JSON Parser Service | LLM 输出修复 |
| `TrendService` 惰性填充 | Lazy Loader Framework | 按需内容生成 |
| `PromptChainExecutor` 变量映射 | Expression Engine | 模板变量求值 |
| 微博 `TrendService` | Trending Service | 热搜管理 |
| archives.md App 设计 | Archive Service | 知识库注入 |

---

### 8.6 平台差异化的处理策略

不同平台有不同的特色功能，如何在统一服务的基础上支持差异化？

#### 策略 1：配置驱动

通过配置注册平台特定参数：

```typescript
// 热搜配置示例
trendingService.registerPlatformConfig('weibo', {
  maxItems: 50,
  categories: ['娱乐', '社会', '科技', '体育'],
  refreshInterval: 300000, // 5分钟
  allowSponsored: true,
});

trendingService.registerPlatformConfig('bilibili', {
  maxItems: 10,
  categories: ['动画', '游戏', '鬼畜', '生活'],
  refreshInterval: 600000, // 10分钟
  allowSponsored: false,
});
```

#### 策略 2：扩展点机制

通过扩展点支持平台特有逻辑：

```typescript
// 内容解析器扩展
contentParser.registerPlatformParser('zhihu', {
  parsePost: (raw) => ({ ...base, isQuestion: raw.type === 'question' }),
  formatPost: (post) => `【${post.title}】${post.content}`,
});

// 互动行为扩展
interactionService.registerPlatformBehavior('bilibili', {
  // B站特有：一键三连
  tripleAction: async (contentId, userId) => {
    await Promise.all([
      interactionService.like(contentId, userId),
      interactionService.favorite(contentId, userId),
      interactionService.coin(contentId, userId, 2),  // 投币
    ]);
  },
});
```

#### 策略 3：平台数据字段

在统一模型中预留平台特定字段：

```typescript
interface UniversalPost {
  // ... 通用字段 ...
  platformData?: Record<string, any>;  // 平台特定数据
}

// 微博特有：超话
post.platformData = { superTopic: '明星超话' };

// B站特有：分P
post.platformData = { parts: [{ title: 'P1', duration: 120 }] };

// 知乎特有：问题信息
post.platformData = { questionId: 'xxx', answerCount: 42 };
```

#### 策略 4：UI 组件注册

平台可以注册自定义渲染组件：

```typescript
// 帖子卡片组件注册
uiRegistry.registerPostCard('weibo', WeiboPostCard);
uiRegistry.registerPostCard('bilibili', BilibiliVideoCard);
uiRegistry.registerPostCard('zhihu', ZhihuAnswerCard);

// 通用渲染时自动选择
<DynamicPostCard :post="post" />  // 根据 post.platformId 选择组件
```

#### 策略汇总

| 策略 | 适用场景 | 示例 |
|------|----------|------|
| **配置驱动** | 数值参数、开关 | 热搜数量、刷新间隔 |
| **扩展点** | 平台特有逻辑 | 一键三连、超话 |
| **platformData** | 特有数据字段 | 分P、问题ID |
| **UI 注册** | 差异化展示 | 视频卡片、问答卡片 |

---

### 8.7 实施路线图

基于当前状态和优先级，建议的实施顺序：

```text
Phase 1: 平台化基础 (1-2周)
├── Session Context Service (🔴 高优先级)
├── Interaction Service (🔴 高优先级)
├── Context Sharing Service (🟡 优先级提升)
└── Event Bus (解耦服务通信)

Phase 2: 核心能力完善 (2-4周)
├── Trending Service (从微博 TrendService 抽取)
├── Archive Service (从 archives.md App 抽取)
├── Search Service (全文搜索)
├── Scheduler Service (定时任务)
├── Social Graph Service
└── Feed Service

Phase 3: 基础设施抽取 (1-2周)
├── JSON Parser Service (从 ContentFactory 抽取)
├── Lazy Loader Framework (从 TrendService 抽取)
├── Expression Engine (从 PromptChainExecutor 抽取)
└── Rate Limiter Service

Phase 4: 体验增强 (1-2月)
├── Growth Engine 实现
├── Media Service 实现
├── Profile Service 实现
└── Vector Store (语义搜索)

Phase 5: 验证与迭代
├── 开发第二个社交平台 App (B站/知乎)
├── 收集反馈，优化服务接口
└── 完善 IM Service
```

**优先级说明**：

| Phase | 目标 | 关键交付 |
|-------|------|----------|
| Phase 1 | 平台化基础 | 新 App 可以开始开发 |
| Phase 2 | 核心能力 | 内容生成、搜索、调度完备 |
| Phase 3 | 代码重构 | 将散落的能力收敛为服务 |
| Phase 4 | 体验提升 | 涨粉、媒体、智能推荐 |
| Phase 5 | 验证迭代 | 通过新 App 验证架构 |

---

### 8.8 参考文档（待集成）

以下文档包含可抽取为系统服务的设计：

| 文档 | 可抽取服务 | 核心能力 |
|------|-----------|----------|
| `apps/archives.md` | Archive Service | 知识库、注入系统、账号绑定、去重 |
| `llm-task-service/context-sharing.md` | Context Sharing Service | 发布/订阅、上下文聚合 |
| 微博 `TrendService` | Trending Service | 热搜生成、平台配置、共享策略 |

---

## 9. 参考文档

### 9.1 系统服务文档

- [社交媒体模拟引擎](../social-media-engine.md)
- [账号服务](../account-service.md)
- [统一内容模型](../已完成的/social-content-types.md)
- [LLM 任务服务](../llm-task-service/README.md)
- [会话上下文服务](../session-context-service.md)
- [涨粉算法引擎](../follower-growth-engine.md)
- [媒体服务](../media-service.md)
- [即时通讯服务](../im-service.md)
- [通知系统](../notification-system.md)
- [时间服务](../time-service.md)
- [叙事服务](../narrative-service.md)
- [用户画像扩展](../user-profile-extension.md)

### 9.2 待集成的设计文档

- [档案 App](../../apps/archives.md) - 待抽取为 Archive Service
- [上下文共享服务](../llm-task-service/context-sharing.md) - 待实现

### 9.3 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 2026-01-08 | 初始版本，服务状态总览 |
| 1.1 | 2026-01-08 | 新增「理想服务总览」章节，补充 Archive/Trending/Context Sharing 服务设计 |
