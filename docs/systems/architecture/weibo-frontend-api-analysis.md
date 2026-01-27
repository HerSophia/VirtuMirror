# 微博 App 前端接口统计与解耦分析

> **版本**: 1.0  
> **状态**: 分析完成  
> **最后更新**: 2026-01-16  
> **目标**: 统计微博 App 的接口使用情况，识别已使用的系统服务与内部集成的功能，为后端解耦提供依据

## 1. 概述

本文档分析微博 App (`src/apps/weibo`) 的前端代码，统计其调用的接口和服务，识别哪些功能已对接系统服务，哪些功能仍集成在 App 内部需要解耦。

### 1.1 文件结构

```text
src/apps/weibo/
├── stores/                    # 状态管理
│   ├── feedStore.ts          # 信息流管理
│   ├── hotSearchStore.ts     # 热搜管理
│   ├── userActionStore.ts    # 用户行为（点赞/收藏/历史）
│   ├── composeStore.ts       # 发布与草稿
│   ├── llmTaskStore.ts       # LLM 任务管理
│   ├── settingsStore.ts      # 用户设置
│   └── llm/                   # LLM 相关子模块
│       ├── narrativeIntegration.ts  # 叙事集成
│       ├── outputHandlers.ts        # 输出处理
│       ├── sourceTracking.ts        # 来源追踪
│       └── parsers/                  # 解析器
├── services/
│   └── sessionContext.ts     # 会话上下文服务
├── llmTask/                   # LLM 任务扩展
│   ├── weiboTaskDefinitions.ts
│   ├── weiboContextProviders.ts
│   └── weiboOutputHandlers.ts
├── components/                # UI 组件
└── views/                     # 页面视图
```

---

## 2. 已使用的系统服务

以下是微博 App 已对接的系统级服务，这些服务已实现平台化，可被其他 App 复用。

### 2.1 数据库服务

| 服务 | 导入路径 | 使用位置 | 功能 |
|------|----------|----------|------|
| `db`         | `@/services/database`              | feedStore, hotSearchStore, composeStore | IndexedDB 数据访问 |
| `writeQueue` | `@/services/database/writeQueue`   | feedStore, hotSearchStore, composeStore | 串行化写入队列     |

**使用的数据表**：

- `db.socialPosts` - 博文存储
- `db.socialComments` - 评论存储
- `db.socialTopics` - 热搜话题存储


### 2.2 社交引擎服务

| 服务 | 导入路径 | 使用位置 | 功能 |
|------|----------|----------|------|
| `TrendService`   | `@/services/social/trendService`   | feedStore, hotSearchStore | 热搜榜管理、话题内容生成 |
| `ContentFactory` | `@/services/social/contentFactory` | feedStore | LLM 内容生成（评论等）|
| `DirectorService` | `@/services/social/directorService` | feedStore | 导演服务，触发事件 |
| `TrafficEngine` | `@/services/social/algorithm` | hotSearchStore | 热度计算算法 |

### 2.3 账号服务

| 服务 | 导入路径 | 使用位置 | 功能 |
|------|----------|----------|------|
| `accountService` | `@/services/account/accountService` | feedStore, composeStore | 账号管理（实体、平台账号）|
| `UserPool` | `@/services/account/userPool` | feedStore | 随机用户档案生成 |
| `useAccountStore` | `@/stores/accountStore` | sessionContext, composeStore | 玩家账号状态 |

### 2.4 LLM 任务服务

| 服务 | 导入路径 | 使用位置 | 功能 |
|------|----------|----------|------|
| `getLLMTaskService` | `@/services/llmTask` | llmTaskStore, llmTask/index | 任务管理、执行、调度 |
| `PromptService` | `@/services/promptService` | feedStore, composeStore | 提示词获取 |

### 2.5 运行时服务

| 服务 | 导入路径 | 使用位置 | 功能 |
|------|----------|----------|------|
| `tryUseAppRuntime` | `@/services/appRuntime` | 多处 | 获取 App 运行时上下文 |
| `ScopedStorage` | `@/services/appRuntime/types` | userActionStore, composeStore, settingsStore | 隔离存储 |

### 2.6 AI 服务

| 服务 | 导入路径 | 使用位置 | 功能 |
|------|----------|----------|------|
| `useAIStore` | `@/stores/aiStore` | feedStore, composeStore | AI 生成调用 |
| `getGlobalConfigService` | `@/services/globalConfigService` | llmTaskStore | API 预设配置 |

### 2.7 统一类型系统

| 类型 | 导入路径 | 使用位置 |
|------|----------|----------|
| `UniversalPost` | `@/types/social` | feedStore, composeStore |
| `DisplayPost` | `@/types/social` | feedStore |
| `MediaAsset` | `@/types/social` | composeStore |
| `ContentSourceTracking` | `@/types/social` | sessionContext, userActionStore |
| `TrendingTopic` | `@/types/social` | hotSearchStore |

---

## 3. App 内部集成的功能（需解耦）

以下功能目前集成在微博 App 内部，根据 `Service-for-social-media-platform.md` 的设计，应抽取为系统服务以实现跨平台复用。

### 3.1 用户行为服务 → Interaction Service 🔴 高优先级

**当前位置**: `stores/userActionStore.ts`

**内部实现的功能**：

| 功能 | 方法 | 描述 |
|------|------|------|
| 点赞管理 | `toggleLike()`, `isLiked()` | 点赞/取消点赞 |
| 收藏管理 | `toggleFavorite()`, `isFavorited()` | 收藏/取消收藏 |
| 浏览历史 | `addViewHistory()`, `getViewHistoryPostIds()` | 记录浏览历史 |
| 来源追踪 | `getCurrentSourceTracking()` | 关联会话上下文 |
| 数据持久化 | `saveLikesToStorage()` 等 | ScopedStorage 存储 |

**解耦建议**：
- 抽取为 `InteractionService`
- 提供统一的互动行为接口
- 支持事件广播（供涨粉引擎订阅）

```typescript
// 目标接口
interface InteractionService {
  like(contentId: string, userId: string): Promise<void>;
  unlike(contentId: string, userId: string): Promise<void>;
  favorite(contentId: string, userId: string): Promise<void>;
  unfavorite(contentId: string, userId: string): Promise<void>;
  recordView(contentId: string, userId: string, duration?: number): Promise<void>;
  onInteraction(callback: (event: InteractionEvent) => void): () => void;
}
```

---

### 3.2 会话上下文服务 → Session Context Service 🔴 高优先级

**当前位置**: `services/sessionContext.ts`

**内部实现的功能**：

| 功能 | 方法 | 描述 |
|------|------|------|
| 会话同步 | `syncContextFromNarrative()` | 从 accountStore/叙事缓存同步 |
| 来源追踪 | `getCurrentSourceTracking()` | 获取当前来源信息 |
| 数据过滤 | `buildSourceFilter()` | 按会话/楼层/Swipe 过滤 |
| 过滤模式 | `setFilterMode()` | all/session/message/swipe |

**解耦建议**：
- 抽取为 `SessionContextService`
- 提供统一的会话上下文管理
- 支持 Bridge 事件自动响应

---

### 3.3 信息流算法服务 → Feed Algorithm Service 🟡 中优先级

**当前位置**: `stores/feedStore.ts`

**内部实现的功能**：

| 功能 | 方法 | 描述 |
|------|------|------|
| 信息流获取 | `refreshFeed()` | 获取个性化信息流 |
| 帖子映射 | `mapSinglePostToDisplay()` | UniversalPost → DisplayPost |
| 类型推断 | `getPrimaryTypeFromPost()` | 推断帖子类型 |
| 图片提取 | `getImagesFromPost()` | 从媒体字段提取图片 |
| 用户信息 | `getUserInfo()` | 获取作者信息 |

**解耦建议**：
- 信息流算法抽取为 `FeedAlgorithmService`
- 用户信息获取由 `AccountService` 扩展处理

---

### 3.4 热搜服务 → Trending Service 🟡 中优先级

**当前位置**: `stores/hotSearchStore.ts`

**内部实现的功能**：

| 功能 | 方法 | 描述 |
|------|------|------|
| 热搜刷新 | `refreshHotSearch()` | 获取热搜榜 |
| LLM 热搜应用 | `applyGeneratedHotSearch()` | 应用 LLM 生成的热搜 |
| 热度计算 | 使用 TrafficEngine | 计算热度和标签 |
| 分类管理 | `setCategory()` | 热搜分类切换 |

**解耦建议**：
- 抽取为 `TrendingService`（从 TrendService 扩展）
- 支持平台配置（热搜数量、分类等）
- 支持跨 App 热搜共享

---

### 3.5 草稿服务 → Draft Service 🟢 低优先级

**当前位置**: `stores/composeStore.ts`

**内部实现的功能**：

| 功能 | 方法 | 描述 |
|------|------|------|
| 草稿保存 | `saveDraft()` | 保存草稿到 ScopedStorage |
| 草稿获取 | `getDraftById()`, `loadDrafts()` | 草稿 CRUD |
|除 | `deleteDraft()`, `clearAllDrafts()` | 草稿清理 |

**解耦建议**：
- 可选抽取为 `DraftService`
- 目前优先级较低，App 内部实现即可

---

### 3.6 AI 内容扩展 → Content Expansion Service 🟢 低优先级

**当前位置**: `stores/composeStore.ts`

**内部实现的功能**：

| 功能 | 方法 | 描述 |
|------|------|------|
| 博文扩展 | `expandPostContent()` | AI 扩展博文内容 |
| 图片描述扩展 | `expandImageDescription()` | AI 扩展图片描述 |
| 视频描述扩展 | `expandVideoDescription()` | AI 扩展视频描述 |

**解耦建议**：
- 可整合到 `ContentFactory` 服务
- 提供通用的 AI 内容增强能力

---

### 3.7 互动数据生成 → Engagement Generation Service 🟡 中优先级

**当前位置**: `stores/feedStore.ts`

**内部实现的功能**：

| 功能 | 方法 | 描述 |
|------|------|------|
| 互动生成 | `generatePostEngagement()` | 为博文生成评论、点赞等 |
| 评论生成 | `generateCommentsForPost()` | 单独生成评论 |
| 评论者账号 | `ensureCommenterAccount()` | 创建评论者 NPC 账号 |

**解耦建议**：
- 抽取为 `EngagementService` 或整合到 `ContentFactory`
- 与涨粉引擎联动

---

## 4. 接口依赖关系图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           微博 App (Weibo)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Stores (状态管理)                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │  │
│  │  │feedStore │ │hotSearch │ │userAction│ │compose   │              │  │
│  │  │          │ │Store     │ │Store     │ │Store     │              │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘              │  │
│  └───────┼────────────┼────────────┼────────────┼────────────────────┘  │
└──────────┼────────────┼────────────┼────────────┼────────────────────────┘
           │            │            │            │
           ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        已使用的系统服务                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Database     │  │ Social Engine│  │ Account      │                   │
│  │ ✅ db        │  │ ✅ TrendSvc  │  │ ✅ accountSvc│                   │
│  │ ✅ writeQueue│  │ ✅ ContentFac│  │ ✅ UserPool  │                   │
│  └──────────────┘  │ ✅ DirectorSv│  └──────────────┘                   │
│                    │ ✅ TrafficEng│                                     │
│  ┌──────────────┐  └──────────────┘  ┌──────────────┐                   │
│  │ LLM Task     │                    │ AI Service   │                   │
│  │ ✅ LLMTaskSvc│                    │ ✅ aiStore   │                   │
│  │ ✅ PromptSvc │                    │ ✅ ConfigSvc │                   │
│  └──────────────┘                    └──────────────┘                   │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐                                     │
│  │ Runtime      │  │ Types        │                                     │
│  │ ✅ AppRuntime│  │ ✅ social.ts │                                     │
│  │ ✅ ScopedStor│  │              │                                     │
│  └──────────────┘  └──────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        需要解耦的内部功能                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  🔴 高优先级                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                     │
│  │ Interaction Service  │  │ Session Context Svc  │                     │
│  │ • 点赞/收藏/历史     │  │ • 会话同步           │                     │
│  │ • 来源追踪           │  │ • 数据过滤           │                     │
│  │ • 事件广播           │  │ • Bridge 响应        │                     │
│  └──────────────────────┘  └──────────────────────┘                     │
│                                                                          │
│  🟡 中优先级                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                     │
│  │ Trending Service     │  │ Feed Algorithm Svc   │                     │
│  │ • 热搜刷新           │  │ • 信息流算法         │                     │
│  │ • 平台配置           │  │ • 个性化推荐         │                     │
│  │ • 热搜共享           │  │                      │                     │
│  └──────────────────────┘  └──────────────────────┘                     │
│                                                                          │
│  🟢 低优先级                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                     │
│  │ Draft Service        │  │ Content Expansion    │                     │
│  │ • 草稿管理           │  │ • AI 内容扩展        │                     │
│  └──────────────────────┘  └──────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 解耦优先级与工作量估算

### 5.1 高优先级（平台化基础）

| 服务 | 来源 | 工作量 | 价值 |
|------|------|--------|------|
| **Interaction Service** | userActionStore | 3h | 点赞/收藏逻辑可复用到 B站、知乎 |
| **Session Context Service** | sessionContext.ts | 4-5h | 数据隔离基础，多 App 必需 |

### 5.2 中优先级（体验增强）

| 服务 | 来源 | 工作量 | 价值 |
|------|------|--------|------|
| **Trending Service** | hotSearchStore | 4-5h | 热搜管理通用化，支持跨 App 共享 |
| **Feed Algorithm Service** | feedStore | 6-8h | 信息流推荐通用化 |
| **Engagement Service** | feedStore | 3-4h | 互动生成与涨粉引擎联动 |

### 5.3 低优先级（锦上添花）

| 服务 | 来源 | 工作量 | 价值 |
|------|------|--------|------|
| Draft Service | composeStore | 2-3h | 草稿管理通用化 |
| Content Expansion | composeStore | 2-3h | AI 扩展能力整合 |

---

## 6. 解耦实施建议

### 6.1 第一阶段：平台化基础（1-2周）

1. **抽取 Interaction Service**
   - 从 `userActionStore.ts` 抽取核心逻辑
   - 定义统一的互动事件类型
   - 微博保持现有实现，新服务作为适配层

2. **抽取 Session Context Service**
   - 从 `sessionContext.ts` 抽取
   - 与 accountStore 的会话信息统一
   - 提供 Bridge 事件自动订阅

### 6.2 第二阶段：核心能力完善（2-4周）

3. **扩展 TrendService 为 Trending Service**
   - 增加平台配置能力
   - 增加热搜共享策略
   - 微博热搜逻辑迁移

4. **抽取 Feed Algorithm Service**
   - 信息流算法通用化
   - 支持不同平台的算法配置

### 6.3 第三阶段：验证与迭代

5. **开发第二个社交平台 App（如 B站）**
   - 验证服务复用性
   - 收集反馈，优化接口设计

---

## 7. 现有代码中的关键实现参考

### 7.1 来源追踪实现

```typescript
// stores/llm/sourceTracking.ts
export function getCurrentSourceTracking(): ContentSourceTracking | undefined {
  const metadata = getNarrativeCacheMetadata();
  if (!metadata?.sessionId) return undefined;
  return {
    sessionId: metadata.sessionId,
    sourceMessageId: metadata.messageId,
    sourceSwipeId: metadata.swipeId,
    generatedAt: Date.now(),
  };
}
```

### 7.2 数据过滤实现

```typescript
// services/sessionContext.ts
export function buildSourceFilter(ctx: WeiboSessionContext) {
  return (record: { source?: ContentSourceTracking }) => {
    if (ctx.filterMode === 'all') return true;
    if (!ctx.sessionId) return true;
    const source = record.source;
    if (!source) return true;
    if (source.sessionId && source.sessionId !== ctx.sessionId) return false;
    // ... 更多过滤逻辑
  };
}
```

### 7.3 LLM 任务注册实现

```typescript
// llmTask/index.ts
export function registerWeiboLLMExtensions(): void {
  const service = getLLMTaskService();
  weiboContextProviders.forEach(p => service.registerContextProvider(p));
  weiboOutputHandlers.forEach(h => service.registerOutputHandler(h));
  service.registerTaskDefinitions(weiboTaskDefinitions);
  service.registerTaskTemplates(weiboTaskTemplates);
}
```

---

## 8. 参考文档

- [社交内容平台系统服务架构](../../systems/architecture/Service-for-social-media-platform.md)
- [会话绑定设计](./session-binding-design.md)
- [LLM 任务服务](../../systems/llm-task-service/README.md)
- [账号服务](../../systems/account-service.md)

---

## 9. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 2026-01-16 | 初始版本，完成接口统计与分析 |
