# API 聚合索引（Step 1-3 · 批次四）

> 承接上一批（15/18）：本批次补齐最后 3 个已实现服务，当前总覆盖 18/18（仅统计可直接调用服务）。

## 0. 如何使用本索引（30 秒）

1. 方法签名和参数类型以 `api-manifest.json` 为准。
2. 依赖关系、事件流、副作用先看本文件的 8 字段摘要。
3. 场景化编排直接看 `API-RECIPES.md`，避免临时拼调用顺序。
4. 新增或调整服务时，同步更新 `api-manifest.json`、本文件和 `API-RECIPES.md`。

- 推荐阅读路径：`api-manifest.json` -> `API-INDEX.md` -> `API-RECIPES.md`。

## 1. 当前覆盖服务（18/18）

| serviceId | 服务 | 架构状态 | 稳定性 | 代码入口（可调用） |
| --- | --- | --- | --- | --- |
| `account` | Account Service | ✅ 已实现 | `stable` | `src/services/account/accountService.ts` |
| `sessionContext` | Session Context Service | ✅ 已实现 | `stable` | `src/services/sessionContext/SessionContextService.ts` |
| `eventBus` | Event Bus Service | ✅ 已实现 | `stable` | `src/services/eventBus/EventBus.ts` |
| `interaction` | Interaction Service | ✅ 已实现 | `stable` | `src/services/interaction/InteractionService.ts` |
| `contextSharing` | Context Sharing Service | ✅ 已实现 | `stable` | `src/services/contextSharing/ContextSharingService.ts` |
| `logger` | Logger Service | ✅ 已实现 | `stable` | `src/services/logger/loggerService.ts` |
| `trending` | Trending Service | ✅ 已实现 | `stable` | `src/services/trending/trendingService.ts` |
| `socialGraph` | Social Graph Service | ✅ 已实现 | `stable` | `src/services/socialGraph/socialGraphService.ts` |
| `feed` | Feed Service | ✅ 已实现 | `stable` | `src/services/feed/FeedService.ts` |
| `scheduler` | Scheduler Service | ✅ 已实现 | `stable` | `src/services/scheduler/schedulerService.ts` |
| `llmTask` | LLM Task Service | ✅ v1.0 | `stable` | `src/services/llmTask/LLMTaskService.ts` |
| `notification` | Notification System | ✅ 已实现 | `stable` | `src/services/notification/notificationService.ts` |
| `time` | Time Service | ✅ 已实现 | `stable` | `src/services/time/timeService.ts` |
| `narrative` | Narrative Service | ✅ 已实现 | `stable` | `src/services/narrative/narrativeService.ts` |
| `archive` | Archive Service | 🟡 MVP | `beta` | `src/services/archive/archiveService.ts` |
| `socialMediaEngine` | Social Media Engine | ✅ Phase 1-3 | `stable` | `src/services/social/directorService.ts` |
| `contentModel` | Content Model Service | ✅ Phase 1-5 | `stable` | `src/types/social.ts` |
| `ai` | AI Service | ✅ 已实现 | `stable` | `src/services/ai/aiService.ts` |

### 1.1 Not Implemented（📋，不可直接调用）

| serviceId | 服务 | 架构状态 | 说明 |
| --- | --- | --- | --- |
| `media` | Media Service | 📋 设计完成，部分实现 | 统一媒体库、跨应用共享 |
| `fans` | Fans Service | 📋 设计完成 | 粉丝管理、增长算法、画像生成 |
| `search` | Search Service | 📋 设计完成 | 全文搜索、模糊匹配、语义搜索 |
| `im` | IM Service | 📋 设计完成 | 私信引擎、Private Director |

- 上述服务仅保留设计能力，不写入 `api-manifest.json` 的可调用 `services[]`，也不进入 `API-RECIPES.md` 的编排链路。

## 2. 服务 API 提取（统一 8 字段）

### `account`

- 入口(文件/类): `src/services/account/accountService.ts` / `AccountService`，默认实例 `accountService`
- 核心方法: `setSessionContext`、`getSessionContext`、`createEntity`、`createPlatformAccount`、`getVisibleAccounts`、`followAccount`、`getStats`
- 请求参数: `SessionContext`、`CreateEntityInput`、`CreatePlatformAccountInput`、`platformId: string`、`fromAccountId/toAccountId`
- 返回类型: `void`、`SessionContext | null`、`Promise<CharacterEntity>`、`Promise<PlatformAccount>`、`Promise<PlatformAccount[]>`、`Promise<SocialRelation>`、`Promise<StatsObject>`
- 事件 emit/on: 当前实现不直接 `eventBus.emit/on` 领域事件（以查询式调用为主）
- 依赖服务: `db.characterEntities`、`db.platformAccounts`、`db.socialRelations`、`db.archives`、`loggerService`、`uuid`
- 副作用(存储/状态): 持久化写入实体/账号/关系；删除账号会联动更新归档绑定；维护内存 `currentContext`
- 稳定性(stable/beta/experimental): `stable`

### `sessionContext`

- 入口(文件/类): `src/services/sessionContext/SessionContextService.ts` / `SessionContextService`，默认实例 `sessionContextService`
- 核心方法: `updateSession`、`updateMessage`、`updateSwipe`、`clearContext`、`getCurrentSourceTracking`、`buildSourceFilter`
- 请求参数: `sessionId: string`、`characterName: string`、`playerName: string`、`platform: string`、`messageId: number`、`swipeId: number`、`mode: FilterMode`、`config: Partial<FilterConfig>`
- 返回类型: `void`、`ContentSourceTracking | null`、`SourceFilter<T>`、状态读取 `SessionContextState` / `boolean`
- 事件 emit/on: emit `session-context:changed`、`session:changed`；on 通过 `eventBus.on(...)` 订阅
- 依赖服务: `eventBus`、`loggerService`、Vue `reactive/computed`
- 副作用(存储/状态): 维护响应式 `_state`，上下文变更时广播事件，不直接落库
- 稳定性(stable/beta/experimental): `stable`

### `eventBus`

- 入口(文件/类): `src/services/eventBus/EventBus.ts` / `EventBus`，默认实例 `eventBus`（`src/services/eventBus/index.ts`）
- 核心方法: `emit`、`on`、`once`、`off`、`channel`、`getListenerCount`、`getAllEvents`、`clear`
- 请求参数: `event: string`、`payload: T`、`handler: EventHandler<T>`、`name: string`
- 返回类型: `void`、`Unsubscribe`、`IEventChannel`、`number`、`string[]`
- 事件 emit/on: 通用发布订阅模型，不限制业务命名空间
- 依赖服务: `EventChannel`、`loggerService`
- 副作用(存储/状态): 维护内存 `listeners/channels` Map，`clear()` 会清空订阅状态
- 稳定性(stable/beta/experimental): `stable`

### `interaction`

- 入口(文件/类): `src/services/interaction/InteractionService.ts` / `InteractionServiceImpl`，默认实例 `interactionService`
- 核心方法: 行为 `like/unlike/favorite/unfavorite/comment/repost/recordView`；查询 `getUserLikes/getUserFavorites/getComments/getViewHistory/getStats`；订阅 `onInteraction/on/off`
- 请求参数: `contentId`、`userId`、`LikeOptions`、`FavoriteOptions`、`CreateCommentParams`、`RepostOptions`、`Get*Options`
- 返回类型: 行为多为 `Promise<void>`，评论 `Promise<Comment>`，转发 `Promise<string>`，统计 `Promise<InteractionStats>`
- 事件 emit/on: emit `interaction:like/unlike/favorite/unfavorite/comment/repost/view/share`；on `onInteraction(handler)` 或 `on(type, handler)`
- 依赖服务: `eventBus`、`loggerService`、`uuid`
- 副作用(存储/状态): 更新多组内存 Map（互动记录/统计/评论/浏览历史/收藏夹/转发），并向总线广播事件
- 稳定性(stable/beta/experimental): `stable`

### `contextSharing`

- 入口(文件/类): `src/services/contextSharing/ContextSharingService.ts` / `ContextSharingService`，默认实例 `contextSharingService`
- 核心方法: `publish`、`unpublish`、`replace`、`get/getAsync/getByType`、`aggregate`、`subscribe/subscribeByType`、`search`
- 请求参数: `PublishContextOptions<T>`、`AggregationRequest`、`ContextSearchQuery`、`SubscribeCallback<T>`、`TypeSubscribeCallback<T>`
- 返回类型: 发布更新 `string/boolean`，读取 `T | undefined`、`Promise<T | undefined>`、`Map<string, T>`，聚合 `Promise<AggregatedContext>`，订阅返回 `() => void`
- 事件 emit/on: emit `contextSharing:published`、`contextSharing:unpublished`、`contextSharing:updated`；内部支持 ID/类型订阅回调
- 依赖服务: `eventBus`、`loggerService`、`formatContexts`
- 副作用(存储/状态): 维护 `contexts/cache/idSubscribers/typeSubscribers`，定时清理 TTL 缓存，发布后触发订阅回调
- 稳定性(stable/beta/experimental): `stable`

### `logger`

- 入口(文件/类): `src/services/logger/loggerService.ts` / `LoggerServiceImpl`，默认实例 `loggerService`
- 核心方法: `debug/info/warn/error`、`child`、`setLevel`、`setFilter`、`addTransport/removeTransport`、`time/timeEnd`
- 请求参数: `message: string`、`args: unknown[]`、`namespace: string`、`level: LogLevel`、`filter: LogFilter`、`transport: LogTransport`
- 返回类型: 大多 `void`，`child(...) => Logger`，`timeEnd(...) => number`，查询类返回 `LogLevel/LogFilter/LogTransport[]`
- 事件 emit/on: 无事件总线依赖；日志分发走 transport 管线
- 依赖服务: `ConsoleTransport`、`Logger`、`LOG_LEVEL_VALUES`
- 副作用(存储/状态): 维护内存 `level/filter/transports/timers`；对 transport 进行写入和 dispose
- 稳定性(stable/beta/experimental): `stable`

### `trending`

- 入口(文件/类): `src/services/trending/trendingService.ts` / `TrendingService`，默认实例 `trendingService`
- 核心方法: `createFromEvent`、`upsertTopics`、`getTrending`、`getTopic`、`getSharedTrending`、`setSharePolicy`、`onTrendingUpdate`
- 请求参数: `WorldEvent`、`CreateOptions`、`TrendingTopic[]`、`TrendingQueryOptions`、`SharedTrendingOptions`、`SharePolicy`
- 返回类型: `Promise<TrendingTopic[]>`、`Promise<void>`、`Promise<TrendingTopic | undefined>`、`void`、`(() => void)`
- 事件 emit/on: 通过桥接 emit `trending:topic:created`、`content:trending:updated`、`trending:policy:changed`；on `onTrendingUpdate(callback)`
- 依赖服务: `db.socialTopics`、`PlatformRegistry`、`TrafficEngine`、`topicContentLoader`、`PlatformConfigRegistry`、`SharePolicyManager`、`eventBus`
- 副作用(存储/状态): 写入/更新/删除 `socialTopics`；触发趋势更新事件；维护平台配置与共享策略
- 稳定性(stable/beta/experimental): `stable`

### `socialGraph`

- 入口(文件/类): `src/services/socialGraph/socialGraphService.ts` / `SocialGraphService`，默认实例 `socialGraphService`
- 核心方法: `follow/unfollow`、`block/unblock`、`mute/unmute`、`getFollowers/getFollowing/getMutualFollows`、`getRelationshipStats`、`getRecommendedFollows`、`batchFollow`
- 请求参数: `fromId/toId/accountId`、`FollowOptions`、`BlockOptions`、`MuteOptions`、`SocialGraphQueryOptions`、`RecommendationOptions`
- 返回类型: 写操作 `Promise<void>`；查询返回 `Promise<SocialGraphPageResult>`、`Promise<GraphAccountNode[]>`、`Promise<RelationshipStats>`、`Promise<FollowRecommendation[]>`
- 事件 emit/on: emit `social:relation:followed/unfollowed/blocked/unblocked/muted/unmuted`、`social:stats:updated`；on `onRelationChange(callback)`
- 依赖服务: `accountService`、`db.socialRelations`、`eventBus`、`loggerService`、`uuid`
- 副作用(存储/状态): 持久化关系图数据；执行跨关系清理（如 block 自动取消 follow）；维护监听器集合并广播变化
- 稳定性(stable/beta/experimental): `stable`

### `feed`

- 入口(文件/类): `src/services/feed/FeedService.ts` / `FeedService`，默认实例 `feedService`
- 核心方法: `getPersonalizedFeed`、`getFollowingFeed`、`getTrendingContent`、`getDiscoverContent`、`getCategoryFeed`、`getTopicFeed`、`refreshFeed`、`loadMore`
- 请求参数: `userId/platformId`、`FeedOptions`、`TrendingOptions`、`CategoryFeedOptions`、`TopicFeedOptions`、`cursor`
- 返回类型: 主查询统一 `Promise<FeedResult>`；管理类返回 `void/boolean/string/FeedCacheStats/(() => void)`
- 事件 emit/on: 内部事件 `feed:loaded`、`feed:cacheHit`、`feed:cacheMiss`（`onFeedEvent` 本地订阅）
- 依赖服务: `AlgorithmRegistry`、`ScoreCalculator`、`DiversityController`、`FilterChain`、`FeedCache`、`SystemContentProvider`、`loggerService`
- 副作用(存储/状态): 维护缓存与过滤器链；聚合内容并生成打分结果；维护本地事件监听集合
- 稳定性(stable/beta/experimental): `stable`

### `scheduler`

- 入口(文件/类): `src/services/scheduler/schedulerService.ts` / `SchedulerService`，默认实例 `schedulerService`
- 核心方法: `register/unregister`、`pause/resume`、`trigger`、`getTask/getAllTasks/getTasksByApp`、`getStatistics`、`start/stop/isStarted`
- 请求参数: `ScheduledTaskInput`、`taskId: string`、`appId: string`
- 返回类型: `string`、`boolean`、`Promise<ExecutionResult | undefined>`、`ScheduledTask | undefined`、`ScheduledTask[]`、`SchedulerStatistics`、`void`
- 事件 emit/on: emit `scheduler:task:registered/unregistered/paused/resumed/started/completed/failed/timeout/skipped`；on 通过 `eventBus.on(...)`
- 依赖服务: `TaskRegistry`、`SchedulerEngine`、`Executor`、`eventBus`、`timeService`、`loggerService`
- 副作用(存储/状态): 维护任务注册表与调度状态；触发定时/事件调度执行；将执行结果广播到全局事件总线
- 稳定性(stable/beta/experimental): `stable`

### `llmTask`

- 入口(文件/类): `src/services/llmTask/LLMTaskService.ts` / `LLMTaskService`，默认入口 `getLLMTaskService`
- 核心方法: `registerTaskDefinition`、`createTask`、`executeTask`、`pauseTask/resumeTask/cancelTask`、`startAutoExecution/stopAutoExecution`、`getStats`
- 请求参数: `LLMTaskDefinition`、`definitionId/taskId`、`Partial<CreateTaskInput>`、`Partial<AutoExecutionConfig>`、`TaskEvent/TaskEventHandler`
- 返回类型: 创建 `LLMTask`，执行 `Promise<ExecutionResult>`，调度控制 `boolean`，统计 `TaskStats`
- 事件 emit/on: emit `task-*`、`auto-execution-*`、`definition-*`；on/off 通过服务内 `eventHandlers`（非全局 eventBus）
- 依赖服务: `TaskRegistry`、`ContextProviderRegistry`、`OutputHandlerRegistry`、`TaskExecutor`、`TaskScheduler`、`useAIStore`、`loggerService`
- 副作用(存储/状态): 维护内存 `tasks/templates/logs`；联动调度器与执行器；运行中任务会触发 `aiStore.abort()`
- 稳定性(stable/beta/experimental): `stable`

### `notification`

- 入口(文件/类): `src/services/notification/notificationService.ts` / `NotificationService`，默认实例 `notificationService`
- 核心方法: `init`、`push`、`showToast/dismissToast`、`markAsRead/markAllAsRead`、`muteApp/unmuteApp`、`updateStatusBarIcon`
- 请求参数: `CreateNotificationParams`、`notificationId`、`appId`、`NotificationIcon`
- 返回类型: `push => Notification`，其余管理方法主要为 `void`
- 事件 emit/on: 当前实现不依赖事件总线，采用 Store Ref 直接驱动 UI
- 依赖服务: `audioService`、Vue `ref`、通知中心相关状态引用
- 副作用(存储/状态): 写入通知列表、Toast 队列、状态栏图标；可播放通知音效；更新已读/静音状态
- 稳定性(stable/beta/experimental): `stable`

### `time`

- 入口(文件/类): `src/services/time/timeService.ts` / `TimeService`，默认实例 `timeService`
- 核心方法: `setMode`、`getCurrentTime`、`formatTime`、`addTickListener`、`syncFromContent`、`set24Hour`
- 请求参数: `mode: TimeMode`、`date: Date`、`content: string`、`callback: (date: Date) => void`
- 返回类型: 读取 `Date/string`，监听注册返回 `() => void`，设置/同步为 `void`
- 事件 emit/on: 无 eventBus；通过 `addTickListener` 提供内部 tick 广播
- 依赖服务: `useChatStore`、Vue `ref/watch`、`loggerService`、`setInterval`
- 副作用(存储/状态): 维护当前时间基线与倍率；模拟模式下解析消息文本并重置虚拟时间基线
- 稳定性(stable/beta/experimental): `stable`

### `narrative`

- 入口(文件/类): `src/services/narrative/narrativeService.ts` / `NarrativeService`，默认实例 `narrativeService`
- 核心方法: `setupBridgeListener`、`subscribe`、`publish`、`cleanup`、`createNarrativeVariables`、`injectNarrativeSafely`
- 请求参数: `NarrativeCallback`、`NarrativeEvent`、`template: string`、`narrativeContent: string`、注入选项 `appendIfMissing/otherTexts/appendFormat`
- 返回类型: 订阅返回 `() => void`；变量映射返回 `NarrativeVariables`；注入返回 `NarrativeInjectionResult`
- 事件 emit/on: 监听 adapter 事件 `bridge:full_sync`/`message_received`/`swipe_changed`，并在服务内发布给订阅者
- 依赖服务: `getBridgeAdapter`、`loggerService`
- 副作用(存储/状态): 维护订阅者集合与 bridge 解绑函数；拼接会话叙事并对外广播
- 稳定性(stable/beta/experimental): `stable`

### `archive`

- 入口(文件/类): `src/services/archive/archiveService.ts` / `ArchiveService`，默认实例 `archiveService`
- 核心方法: `getArchive/saveArchive/deleteArchive/queryArchives`、`getInjection/getPinnedArchives/matchByKeywords`、`bindToAccount/unbindFromAccount`、`extractFromChat`
- 请求参数: `ArchiveRecord`、`ArchiveQueryFilter`、`InjectionRequest`、`archiveId/accountId`、`ArchiveFloorData[]`、`ExtractOptions`
- 返回类型: 查询类 `Promise<ArchiveRecord[]>`，注入 `Promise<InjectionResult>`，抽取 `Promise<ExtractResult>`，绑定/删除 `Promise<void>`
- 事件 emit/on: 当前实现无事件总线发射/订阅
- 依赖服务: `ArchiveRepository`、`InjectionService`、`BindingService`、`ExtractionService`、`DeduplicationService`
- 副作用(存储/状态): 持久化档案与绑定关系；按注入预算聚合相关档案；执行聊天文本抽取
- 稳定性(stable/beta/experimental): `beta`

### `socialMediaEngine`

- 入口(文件/类): `src/services/social/directorService.ts` / `DirectorService`（组合 `TrendService`、`ContentFactory`、`PlatformRegistry`、`TrafficEngine`）
- 核心方法: `setConfig`、`triggerManualEvent`、`createTopicFromEvent/getTrendingList/ensureTopicContent`、`generatePost/generateComments`、`registerPlatform`、`calculateTopicHeat`
- 请求参数: 世界导演配置、`WorldEvent`、`platformId/topicId`、`TrendingTopic`、`postContent`、`PlatformConfig`、`currentTime`
- 返回类型: 导演触发 `Promise<void>`；趋势查询 `Promise<TrendingTopic[]/UniversalPost[]>`；内容生成 `Promise<any/any[]>`；算法 `number`
- 事件 emit/on: 无统一 `eventBus.emit`；on 依赖 `timeService.addTickListener(...)` 进行时间驱动
- 依赖服务: `timeService`、`AIGenerateService`、`PromptService`、`getTrendingService`、`accountService`、`archiveService`、`sessionService`、`PlatformRegistry`、`TrafficEngine`、`loggerService`
- 副作用(存储/状态): 触发世界事件并写入话题/内容；可能创建评论人账号；注入归档上下文并驱动趋势内容预热
- 稳定性(stable/beta/experimental): `stable`

### `contentModel`

- 入口(文件/类): `src/types/social.ts` / `UniversalPost`（类型模块）
- 核心方法: `createDefaultContentFlags`、`createDefaultStats`、`buildContentFlags`、`getWeiboPrimaryType`、`convertImagesToMediaAssets`、`getPrimaryTypeFromPost`、`getImagesFromPost`
- 请求参数: `PostPayload`、`MediaAsset[]`、`ContentFlags`、`UniversalPost`、兼容旧格式 `images`
- 返回类型: `ContentFlags`、`UniversalStats`、`PrimaryContentType`、`MediaAsset[]`、`string[]`
- 事件 emit/on: 无事件发布订阅（纯类型与工具函数模块）
- 依赖服务: `zod`、TypeScript 类型系统、`Date`、`encodeURIComponent`
- 副作用(存储/状态): 主要为纯计算；展示工具会生成占位图 URL 以兼容无媒体资源场景
- 稳定性(stable/beta/experimental): `stable`

### `ai`

- 入口(文件/类): `src/services/ai/aiService.ts` / `AIService`，默认入口 `getAIService`
- 核心方法: `initialize`、`generateText`、`streamText`、`abort/abortAll`、`switchProvider`、`getQueueStatus`、`on`
- 请求参数: `GenerateOptions`、`StreamOptions`、`RequestPriority`、`requestId?`、`presetId`、`EventHandler`
- 返回类型: 生成 `Promise<GenerateResult>`，流式 `StreamHandle`，队列状态 `QueueStatus`，订阅返回 `() => void`
- 事件 emit/on: emit/on `start`、`chunk`、`finish`、`error`、`abort`（服务内事件监听器）
- 依赖服务: `ai` SDK、`ProviderManager`、`RequestManager`、`RequestQueue`、`TavernAdapter`、`rateLimiter`、`loggerService`
- 副作用(存储/状态): 维护请求队列与 Provider 状态；发起外部模型调用；支持取消单请求与全量中断
- 稳定性(stable/beta/experimental): `stable`

## 3. 维护约定

- 单服务变更最少同步 3 处：`api-manifest.json` 方法签名、本文件 8 字段摘要、`API-RECIPES.md` 场景链路。
- 服务稳定性仅允许三档：`stable`、`beta`、`experimental`，并保持索引与 manifest 一致。
- Recipe 中出现的事件名必须可在服务实现或服务文档中定位，避免写入虚构事件。
- 涉及降级策略时，优先写明可直接替换的 API（例如 `feed.getPersonalizedFeed`）。
- 发布前至少完成一次构建验证，确认调用链和类型声明仍可用。

### 3.1 文档更新清单

1. 服务入口文件是否变化（`entry.file`、`entry.symbol`、`singleton`）。
2. 核心方法增删改是否同步到 manifest 与索引。
3. 新增事件和副作用是否写入 Recipe 的事件流与降级分支。
4. 相关系统文档链接是否仍可跳转。

## 4. 来源

- 架构总览: [Service-for-social-media-platform.md](../architecture/Service-for-social-media-platform.md)
- 服务文档: [account-service](../account-service/README.md)、[session-context](../session-context/README.md)、[eventBus-service](../eventBus-service/README.md)、[interaction-service](../interaction-service/README.md)、[context-sharing-service](../context-sharing-service/README.md)
- 批次二新增服务文档: [logger-service](../logger-service/README.md)、[trending-service](../trending-service/README.md)、[social-graph-service](../social-graph-service/README.md)、[feed-service](../feed-service/README.md)、[scheduler-service](../scheduler-service/README.md)
- 批次三新增服务文档: [llm-task-service](../llm-task-service/README.md)、[notification-service](../notification-service/README.md)、[time-service](../time-service/README.md)、[narrative-service](../narrative-service/README.md)、[archive-service](../archive-service/README.md)
- 批次四新增服务文档: [social-media-engine](../social-media-engine/README.md)、[social-content-types](../已完成的（过时的）/social-content-types.md)、[ai-service](../ai-service/README.md)
