# API Recipes（Step 1-3 · 18/18）

> 本文基于 [api-manifest.json](./api-manifest.json) 与 [API-INDEX.md](./API-INDEX.md) 的 18/18 覆盖结果。

## 清上下文恢复清单

1. 先读 [api-manifest.json](./api-manifest.json)（方法签名与参数权威来源）。
2. 再读 [API-INDEX.md](./API-INDEX.md)（8 字段摘要，快速回忆依赖和副作用）。
3. 最后读本文件，按场景直接套用调用顺序。

## 统一编排约定

- 先订阅再触发：先 `on/subscribe`，后执行写操作，避免漏掉第一个状态事件。
- 链路带上上下文字段：至少透传 `requestId`、`sessionId`、`platformId`。
- 每条链路都要有降级分支：优先回退到只读 API 或缓存 API。
- 对 `beta` 服务（如 `archive`）默认设置超时、重试上限和兜底文案。
- 跨服务串联建议按“上下文 -> 生产 -> 分发 -> 展示”顺序组织，便于定位失败层级。

## Recipe 1: 发帖发布（账号 + 热点 + 分发）

### 前置条件

- 已有 `sessionId`，且玩家上下文可用。
- 平台已在 `PlatformRegistry` 注册。
- 通知服务已执行 `notification.init()`。

### 调用顺序

1. `sessionContext.updateSession(sessionId, characterName, playerName, platform)`。
2. `account.createEntity(...)` + `account.createPlatformAccount(entityId, platformId, ...)`（缺账号时）。
3. `socialMediaEngine.createTopicFromEvent(event)` 或 `trending.createFromEvent(event)`。
4. `socialMediaEngine.generatePost(platformId, topic, account?)`。
5. `feed.refreshFeed(userId, platformId)`。
6. `notification.push({ appId, title, content, ... })`。

### 关键参数

- `event.topic/summary/affectedPlatforms` 决定热点方向。
- `platformId` 必须与账号平台一致。
- `refreshFeed` 的 `userId` 要与当前查看者一致。

### 事件流

- `session-context:changed` -> `trending:topic:created` -> `content:trending:updated` -> `feed:loaded`。

### 失败回滚/降级

- 话题创建失败：回退到 `feed.getPersonalizedFeed(userId, platformId)` 返回旧流。
- 发帖失败：仅推送失败通知，不阻塞会话上下文更新。

## Recipe 2: 互动闭环（浏览 -> 点赞/收藏/评论 -> 统计）

### 前置条件

- `contentId`、`userId`、`platformId` 都可用。
- 互动服务 `interactionService` 已加载。

### 调用顺序

1. `interaction.recordView(contentId, userId, options?)`。
2. `interaction.like(contentId, userId, options?)`。
3. `interaction.favorite(contentId, userId, collectionId?, options?)`。
4. `interaction.comment({ contentId, userId, ... })`。
5. `interaction.getStats(contentId, platformId)`。
6. 可选：`feed.refreshFeed(userId, platformId)` 更新卡片态。

### 关键参数

- 评论建议携带 `parentId` 与 `metadata`，便于线程聚合与来源分析。
- `platformId` 需与内容归属一致，避免统计错桶。

### 事件流

- `interaction:view` / `interaction:like` / `interaction:favorite` / `interaction:comment`。

### 失败回滚/降级

- 点赞或收藏失败：回滚 UI optimistic 状态并延后重试。
- 评论失败：仅回滚本地评论草稿，不影响已完成互动。

## Recipe 3: 热搜刷新（生成 + 查询 + 跨 App 共享）

### 前置条件

- 已有 `WorldEvent` 输入。
- 共享策略可配置或已有默认值。

### 调用顺序

1. `trending.setSharePolicy(platformId, policy)`（首次接入时）。
2. `trending.createFromEvent(event, options?)`。
3. `trending.getTrending(platformId, options?)`。
4. `trending.getSharedTrending(requesterAppId, options?)`。
5. 可选：`feed.getTrendingContent(platformId, options?)`。

### 关键参数

- `policy` 决定能否被其他 App 读取。
- `getTrending` 的 `limit` 建议与 UI 首屏条数一致。

### 事件流

- `trending:topic:created` -> `content:trending:updated` -> `trending:policy:changed`（策略调整时）。

### 失败回滚/降级

- 热搜生成失败：优先使用缓存，或回退到 `feed.getPersonalizedFeed`。
- 共享读取失败：仅展示本平台热搜，不阻塞页面加载。

## Recipe 4: 会话上下文注入 + LLM 任务执行

### 前置条件

- 任务定义可用。
- `contextSharingService` 已启动。
- AI Provider 可正常调用。

### 调用顺序

1. `sessionContext.updateSession(...)` + `sessionContext.updateMessage(messageId)` + `sessionContext.updateSwipe(swipeId)`。
2. `contextSharing.publish({ type, source, value, ... })`（可多次）。
3. `contextSharing.aggregate({ ... })` 产出 `AggregatedContext`。
4. `llmTask.registerTaskDefinition(definition)`（未注册时）。
5. `llmTask.createTask(definitionId, overrides?)`。
6. `llmTask.executeTask(taskId)` 或 `llmTask.startAutoExecution(taskId)`。
7. 订阅 `llmTask.on(event, handler)` 处理结果。

### 关键参数

- `publish` 的 `type/source` 决定聚合过滤行为。
- `overrides` 建议显式覆盖模型、超时、上下文预算。

### 事件流

- `session-context:changed` -> `contextSharing:published/updated` -> `task-created` -> `task-started` -> `task-completed | task-failed`。

### 失败回滚/降级

- 任务执行失败：回退到 `ai.generateText(options)` 执行简化单步生成。
- 自动执行失败：关闭自动执行，仅保留手动触发。

## Recipe 5: Feed 聚合排序（关系图联动）

### 前置条件

- 用户账号已创建。
- 关系图数据可读。

### 调用顺序

1. `socialGraph.follow(fromId, toId, options)`（建立关系）。
2. `socialGraph.getRelationshipStats(accountId, platformId)`（校验关系规模）。
3. `feed.getFollowingFeed(userId, platformId, options?)`。
4. `feed.getPersonalizedFeed(userId, platformId, options?)`。
5. `feed.loadMore(userId, platformId, cursor)`。
6. `feed.onFeedEvent(callback)` 监听缓存命中与加载状态。

### 关键参数

- `options.cursor/limit` 需与前端分页策略一致。
- 首屏建议先拉 `Following`，再异步补 `Personalized`。

### 事件流

- `social:relation:followed` -> `social:stats:updated` -> `feed:cacheHit | feed:cacheMiss` -> `feed:loaded`。

### 失败回滚/降级

- 关系图查询失败：退化到 `feed.getTrendingContent(platformId)`。
- `loadMore` 失败：保留已加载游标，不清空已有列表。

## Recipe 6: 归档抽取与注入（长期记忆）

### 前置条件

- 存在可抽取的楼层数据。
- 账号已存在，可执行绑定。

### 调用顺序

1. `archive.extractFromChat(floors, options?)`。
2. `archive.saveArchive(record)`（对抽取结果逐条落库）。
3. `archive.bindToAccount(archiveId, accountId)`。
4. `archive.queryArchives(filter?)`（校验持久化结果）。
5. `archive.getInjection(request)`（按预算取注入片段）。
6. 可选：`contextSharing.publish({ type: 'memory', value: injection, ... })`。

### 关键参数

- `ExtractOptions` 需控制噪声阈值与去重策略。
- `InjectionRequest.maxTotalTokens` 需与提示词预算对齐。

### 事件流

- 归档服务本身无总线事件，建议在应用层补 `eventBus.emit('archive:updated', payload)`。

### 失败回滚/降级

- 抽取失败：手动构造 `ArchiveRecord` 后走 `saveArchive`。
- 注入失败：继续生成，但禁用记忆增强，避免链路中断。

## 使用建议

- 先订阅事件，再触发动作，避免遗漏首个状态事件。
- 涉及多服务串联时，统一追加 `requestId/sessionId` 方便追踪。
- `archive` 当前为 `beta`，默认开启超时与降级分支。

## 快速排错清单

1. 看 `api-manifest.json`：确认方法名、参数、返回值没有用旧签名。
2. 看事件链：确认上游事件已 emit，下游监听已注册。
3. 看副作用：确认写入点（db/store/cache）是否成功发生。
4. 看降级分支：确认失败时已命中回退 API，而不是直接中断。
5. 看可观测性：日志中是否带有 `requestId/sessionId/platformId`。
