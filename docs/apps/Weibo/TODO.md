# Weibo App 数据隔离与安全改造 TODO

> 目标：让微博 App 完全符合安全模块的数据隔离、写入保护和多设备同步设计。
>
> 相关文档：
>
> - `docs/dev/Security/README.md`
> - `docs/dev/Security/data-isolation.md`
> - `docs/dev/Security/write-queue.md`
> - `docs/dev/Security/multi-device-sync.md`
> - `docs/apps/Weibo/README.md`

---

## 1. AppRuntime 集成与命名空间

- [x] 确认微博 App 的 appId / source 配置
  - 位置：`src/apps/weibo/manifest.ts`（使用 `weibo` 作为内置应用 ID）
  - 规范：内置应用使用 `builtin/{appId}` 命名空间，例如 `builtin/weibo`

- [x] 在微博应用入口中创建并提供 AppRuntime
  - 位置：`src/apps/weibo/WeiboApp.vue`
  - 方案：
    - 使用 `createBuiltinAppRuntime('weibo', '微博')`
    - 在根组件 setup 中调用 `provideAppRuntime(runtime)`
    - 在 `onUnmounted` 中调用 `unregisterAppRuntime('weibo')` 清理全局注册表

- [x] 全局注册表机制（解决非组件上下文问题）
  - 位置：`src/services/appRuntime/context.ts`
  - 问题：在 Pinia store actions、LLM 处理器等非组件上下文中调用 `inject()` 会触发 Vue 警告
  - 方案：
    - 添加 `registerAppRuntime(appId, runtime)` / `unregisterAppRuntime(appId)` 函数
    - `tryUseAppRuntime()` 优先使用 `inject()`，失败时回退到全局注册表
    - 应用挂载时自动注册，卸载时自动清理

- [x] 在微博内部使用 AppRuntime 获取 namespace（store 中使用 tryUseAppRuntime）
  - 位置：
    - `src/apps/weibo/stores/composeStore.ts`
    - `src/apps/weibo/stores/feedStore.ts`
    - `src/apps/weibo/stores/hotSearchStore.ts`
    - `src/apps/weibo/stores/llm/outputHandlers.ts`
    - `src/apps/weibo/stores/llm/parsers/*.ts`
    - `src/apps/weibo/llmTask/weiboOutputHandlers.ts`
    - `src/apps/weibo/composables/useNarrativeSubscription.ts`
  - 要求：
    - 从 `tryUseAppRuntime()` 中拿到可选的 `namespace`
    - 运行在 App 上下文时使用真实 `dataNamespace`，否则退化为仅按 `platformId` 隔离

---

## 2. 类型与数据库 Schema 扩展

> 目标：让微博使用的所有业务表都支持 `platformId + namespace` 级别的隔离。

- [x] 为微博相关数据类型增加 `namespace: string | undefined`
  - 位置：`src/types/social.ts`
  - 对象：
    - `UniversalPost`：新增可选字段 `namespace?: string`
    - `UniversalComment`：新增可选字段 `namespace?: string`
    - `TrendingTopic`：新增可选字段 `namespace?: string`

- [x] 更新 Dexie schema，确保表中包含 `namespace`
  - 位置：`src/services/database/schema.ts`
  - 表：
    - `socialPosts: 'id, platformId, namespace, [platformId+timestamp], *topicTags, authorId'`
    - `socialComments: 'id, [postId+timestamp], platformId, namespace, authorId'`
    - `socialTopics: 'id, platformId, namespace, [platformId+isHot], [platformId+isNew], *categories'` 及带 `createdAt` 版本
  - 说明：
    - 目前仅引入 `namespace` 字段及简单索引，后续可按需求增加 `[platformId+namespace]` 组合索引

- [x] 旧数据迁移策略（如已存在无 namespace 的微博数据）
  - 实现：`src/apps/weibo/stores/dataMigration.ts`
  - 在 `WeiboApp.vue` 的 `onMounted` 中自动执行迁移
  - 对 `platformId = 'weibo'` 且无 `namespace` 的记录补上默认 `builtin/weibo`
  - 迁移完成后在 `appSettings` 表中记录状态，避免重复执行

---

## 3. 读操作隔离改造

> 目标：所有微博数据读取都按 `platformId = 'weibo'` 且（在有 runtime 时）`namespace = runtime.identity.dataNamespace` 过滤。

### 3.1 Feed / 博文与评论

- [x] 文件：`src/apps/weibo/stores/feedStore.ts`
  - 已完成：
    - `refreshFeed`：按 `platformId = 'weibo'` + 可选 `namespace` 过滤信息流
    - 首页空时 Director 触发后的重试查询同样按 namespace 过滤
    - `getCommentsForPost`：读取评论时按 `postId` + 可选 `namespace` 过滤
    - `getPostsByAuthor` / `getPostCountByAuthor`：按 `authorId` + 平台 + namespace 过滤
    - `getPostStats`：统计时仅计算当前 namespace 的微博帖子与评论

### 3.2 热搜数据

- [x] 文件：`src/apps/weibo/stores/hotSearchStore.ts`
  - 已完成：
    - `refreshHotSearch`：从 `TrendService` 获取话题后，只保留 `platformId = 'weibo'` 且（若存在）`topic.namespace === namespace` 的话题
    - `getHotSearchCount`：统计仅包含当前 namespace 的微博热搜

### 3.3 用户行为（点赞 / 收藏 / 历史）

- [x] 文件：`src/apps/weibo/stores/userActionStore.ts`
  - 已完成：
    - 从 localStorage 迁移到 ScopedStorage，按 App namespace 隔离
    - 支持从 localStorage 自动迁移旧数据（标记：`data_migrated_v1`）
    - 方法改为异步：`initialize()`、`toggleLike()`、`toggleFavorite()`、`addViewHistory()` 等
    - 在 `WeiboApp.vue` 的 `onMounted` 中初始化

### 3.4 其他数据读取

- [x] 搜索所有 `db.social*` 相关调用，逐一检查是否需要增加微博专用过滤
  - `narrativeIntegration.ts`：`getExistingPostsSummary()` 和 `getExistingHotSearchesSummary()` 已添加 namespace 过滤
  - 其他模块已在之前的改造中完成

---

## 4. 写操作统一使用 WriteQueue

> 目标：微博所有写操作通过 `writeQueue` 串行化，使用 `source = 'app'` 且 `key = namespace || 'weibo'`。

### 4.1 博文发布与草稿

- [x] 文件：`src/apps/weibo/stores/composeStore.ts`
  - 已完成：
    - 发布微博：
      - 使用 `tryUseAppRuntime()` 获取命名空间
      - 构造 `UniversalPost` 时写入 `platformId: 'weibo', namespace`
      - 通过 `('app', namespace || 'weibo', ...)` 写入 `db.socialPosts`
    - 草稿存储：
      - 从 localStorage 迁移到 ScopedStorage，按 App namespace 隔离
      - 支持从 localStorage 自动迁移旧数据（标记：`drafts_migrated_v1`）
      - 方法改为异步：`loadDrafts()`、`saveDraft()`、`deleteDraft()`、`clearAllDrafts()`
      - 在 `WeiboApp.vue` 的 `onMounted` 中调用 `loadDrafts()` 初始化

### 4.2 信息流与评论写入

- [x] 文件：`src/apps/weibo/stores/feedStore.ts`
  - 已完成：
    - `clearAllPosts`：
      - 仅删除 `platformId = 'weibo'` 且（若有）`namespace` 匹配的帖子和评论
      - 通过 `writeQueue.enqueue('app', namespace || 'weibo', ...)` 执行批量删除
    - `deletePost`：
      - 使用 `tryUseAppRuntime()` 获取 namespace
      - 删除单条博文及其同 namespace 的评论，写入通过 `writeQueue`
    - `updatePost`：
      - 更新 payload 时通过 `writeQueue` 包裹
    - `generateCommentsForPost`：
      - LLM 生成评论写入 `socialComments` 时附带 `platformId: 'weibo', namespace`
      - 更新帖子 `stats.comments` 时使用 `writeQueue`
    - `generatePostEngagement`：
      - 更新博文统计写入使用 `writeQueue`

### 4.3 热搜写入

- [x] 文件：`src/apps/weibo/stores/hotSearchStore.ts`
  - 已完成：
    - `applyGeneratedHotSearch`：
      - 构造 `TrendingTopic` 时写入 `platformId: 'weibo', namespace`
      - 通过 `writeQueue.enqueue('app', namespace || 'weibo', ...)` 写入 `db.socialTopics`
    - `clearHotSearches`：
      - 仅删除 `platformId = 'weibo'` 且（若有）`namespace` 匹配的话题
      - 写入通过 `writeQueue`

### 4.4 LLM 输出写入

- [x] 文件：`src/apps/weibo/stores/llm/outputHandlers.ts`
  - 已完成：
    - 使用 `tryUseAppRuntime()` 获取可选 namespace
    - 单条博文保存：`UniversalPost` 中写入 `namespace`，写操作通过 `writeQueue.enqueue('app', namespace || 'weibo', ...)`
    - 批量博文保存：同上
    - 互动统计更新：通过 `writeQueue` 更新 `socialPosts.stats`
    - 评论保存：构造 `UniversalComment` 时写入 `namespace`，并通过 `writeQueue` 写入

### 4.5 解析器架构（Parser Dispatcher）

- [x] 文件：`src/apps/weibo/stores/llm/parsers/`
  - 已完成：
    - `types.ts`：`ParseContext` 新增 `namespace?: string` 字段
    - `postParser.ts`：
      - 构造 `UniversalPost` 时写入 `namespace`
      - `persist()` 通过 `writeQueue.enqueue('app', namespace || 'weibo', ...)` 串行化写入
    - `commentParser.ts`：
      - `persist()` 通过 `writeQueue` 写入评论和更新博文评论计数
    - `repostParser.ts`：
      - 构造转发博文时写入 `namespace`
      - `persist()` 通过 `writeQueue` 串行化写入
    - `index.ts`：
      - `parseCompositeOutput()` 支持 `namespace` 参数

- [x] 文件：`src/apps/weibo/llmTask/weiboOutputHandlers.ts`
  - 已完成：
    - `compositeHandler` 从 `tryUseAppRuntime()` 获取 namespace 并传递给 `parseCompositeOutput()`

### 4.6 叙事订阅

- [x] 文件：`src/apps/weibo/composables/useNarrativeSubscription.ts`
  - 已完成：
    - `createWeiboPost()`：
      - 使用 `tryUseAppRuntime()` 获取可选 namespace
      - 构造 `UniversalPost` 时写入 `namespace`
      - 通过 `writeQueue.enqueue('app', namespace || 'weibo', ...)` 串行化写入

---

## 5. AppRuntime Scoped Storage 的使用

> 在微博内部使用 `useAppStorage()` / `ScopedStorage` 来存储与微博强相关但不适合放入全局 social 表的小型配置。

- [x] 场景梳理：
  - 用户个性化设置（微博功能开关、默认过滤选项）
  - 草稿（当前存于 localStorage）
  - 用户行为（点赞、收藏、浏览历史）
  - 微博 App 内部的 UI 状态缓存

- [x] 实施 - 用户行为 Store（userActionStore.ts）：
  - 点赞、收藏、浏览历史从 localStorage 迁移到 ScopedStorage
  - 支持从 localStorage 自动迁移旧数据
  - 存储键：`user_likes`、`user_favorites`、`view_history`、`data_migrated_v1`
  - 方法改为异步：`toggleLike()`、`toggleFavorite()`、`addViewHistory()` 等

- [x] 实施 - 草稿 Store（composeStore.ts）：
  - 草稿从 localStorage 迁移到 ScopedStorage
  - 支持从 localStorage 自动迁移旧数据
  - 存储键：`compose_drafts`、`drafts_migrated_v1`
  - 方法改为异步：`loadDrafts()`、`saveDraft()`、`deleteDraft()`、`clearAllDrafts()`
  - 不再在 store 定义时自动加载，而是在 WeiboApp.vue `onMounted` 中调用

- [x] 组件更新：
  - `WeiboApp.vue`：在 `onMounted` 中初始化 composeStore 和 userActionStore
  - `ComposePostDialog.vue`：使用 composeStore 替代 weiboStore
  - `DraftsDialog.vue`：使用 composeStore 替代 weiboStore

- [x] 实施 - 用户设置（settingsStore.ts）：
  - 自动生成配置（onEmptyFeed、onFewComments）
  - 自动叙事分析开关
  - LLM 设置（useGlobalAsDefault、defaultPresetId、defaultOverrides）
  - 支持从 localStorage 自动迁移旧数据
  - 存储键：`weibo_settings`、`settings_migrated_v1`
  - 在 `WeiboApp.vue` 的 `onMounted` 中调用 `settingsStore.initialize()`
  - 已更新：`WeiboSettings.vue` 使用 settingsStore
  - 已更新：`feedStore.ts` 的 autoGenerateConfig 代理到 settingsStore
  - 已更新：`llmTaskStore.ts` 的 autoNarrativeAnalysisEnabled 代理到 settingsStore

---

## 6. 多设备同步集成（规划中）

> 目标：将微博数据纳入云同步，支持多设备间的数据同步与冲突检测。

### 6.1 需要同步的数据类型

| 数据类型 | 表名 | 同步优先级 | 说明 |
| --- | --- | --- | --- |
| 用户设置 | ScopedStorage | 高 | 自动生成配置、LLM 设置 |
| 草稿 | ScopedStorage | 高 | 用户创建的草稿不应丢失 |
| 用户行为 | ScopedStorage | 中 | 点赞、收藏状态 |
| 浏览历史 | ScopedStorage | 低 | 可选同步，数据量大 |
| 博文 | socialPosts | 低 | LLM 生成的内容，可重新生成 |
| 评论 | socialComments | 低 | LLM 生成的内容 |
| 热搜 | socialTopics | 低 | LLM 生成的内容 |

### 6.2 实现步骤

- [ ] **阶段 1：ScopedStorage 同步支持**
  - [ ] 在 `ScopedStorage` 中添加变更追踪接口
  - [ ] 实现 `getChangedKeys(since: number)` 方法
  - [ ] 集成到 `ChangeTracker` 注册机制

- [ ] **阶段 2：设置与草稿同步**
  - [ ] 注册 `weibo_settings` 到 ChangeTracker
  - [ ] 注册 `compose_drafts` 到 ChangeTracker
  - [ ] 在 Sync 管道中处理 ScopedStorage 数据
  - [ ] 测试多设备间设置同步

- [ ] **阶段 3：用户行为同步**
  - [ ] 注册 `user_likes`、`user_favorites` 到 ChangeTracker
  - [ ] 实现增量同步（避免全量传输）
  - [ ] 处理点赞/取消点赞的冲突

- [ ] **阶段 4：生成内容同步（可选）**
  - [ ] 评估是否需要同步 LLM 生成的博文/评论
  - [ ] 如需同步，按 `platformId + namespace` 过滤
  - [ ] 与服务端的 `SessionWriteQueue` / `ConflictDetector` 对齐

### 6.3 冲突处理策略

| 数据类型 | 冲突策略 | 说明 |
| --- | --- | --- |
| 设置 | Latest Wins | 最后修改的设置生效 |
| 草稿 | 保留两份 | 冲突时创建新草稿，用户决定 |
| 点赞/收藏 | 合并 | 只添加不删除，或使用最新状态 |
| 生成内容 | Latest Wins | 本地优先，服务端数据可覆盖 |

### 6.4 API 设计草案

```typescript
// 微博同步配置
interface WeiboSyncConfig {
  /** 是否同步设置 */
  syncSettings: boolean;
  /** 是否同步草稿 */
  syncDrafts: boolean;
  /** 是否同步用户行为 */
  syncUserActions: boolean;
  /** 是否同步浏览历史 */
  syncHistory: boolean;
  /** 是否同步生成内容 */
  syncGeneratedContent: boolean;
}

// 注册到 ChangeTracker
changeTracker.registerTable({
  table: 'appData',
  filter: (record) => record.namespace?.startsWith('builtin/weibo'),
  priority: 'high',
});
```

---

## 7. 验证与回归测试

- [ ] 本地验证
  - 单实例运行微博，验证发布、热搜、点赞、收藏、历史、LLM 任务在 namespace 改造后仍能正常工作

- [ ] 多 App 共存验证
  - 与其他使用 social 表的 App 同时安装并使用，确认互不干扰

- [ ] 未来：多设备同步验证
  - 两个设备同时操作微博数据，验证写入串行化与冲突提示是否符合设计

---

## 进度总结

### ✅ 已完成

1. **AppRuntime 集成**
   - 微博应用入口正确创建和提供 AppRuntime
   - 添加全局注册表机制，解决非组件上下文中 `inject()` 警告问题
   - 应用卸载时正确清理全局注册表

2. **数据库 Schema**
   - `socialPosts`/`socialComments`/`socialTopics` 已引入 `namespace` 字段

3. **读操作隔离**
   - 信息流、评论、热搜等核心读取路径按 `platformId + namespace` 过滤
   - `narrativeIntegration.ts` 的查询方法已添加 namespace 过滤

4. **写操作统一**
   - 所有核心 Store（composeStore、feedStore、hotSearchStore）使用 `writeQueue`
   - LLM 输出处理器（outputHandlers.ts）使用 `writeQueue`
   - 解析器架构（postParser、commentParser、repostParser）使用 `writeQueue`
   - 叙事订阅（useNarrativeSubscription）使用 `writeQueue`
   - 任务输出处理器（weiboOutputHandlers.ts）正确传递 `namespace`

5. **ScopedStorage 集成**
   - 用户行为（点赞/收藏/历史）已迁移到 ScopedStorage
   - 草稿存储已迁移到 ScopedStorage
   - 支持从 localStorage 自动迁移旧数据
   - 相关组件已更新使用新的异步 API
   - 组件更新：`ComposePostDialog.vue`、`DraftsDialog.vue` 使用 composeStore

6. **用户设置 ScopedStorage 集成**
   - 新增 `settingsStore.ts` 管理所有微博设置
   - 自动生成配置迁移到 ScopedStorage
   - 自动叙事分析开关迁移到 ScopedStorage
   - LLM 设置迁移到 ScopedStorage
   - 支持从 localStorage 自动迁移旧数据
   - `WeiboSettings.vue` 更新使用 settingsStore
   - `feedStore.ts` 的 autoGenerateConfig 代理到 settingsStore
   - `llmTaskStore.ts` 的 autoNarrativeAnalysisEnabled 代理到 settingsStore
   - `WeiboApp.vue` 在 onMounted 中初始化 settingsStore

7. **旧数据迁移**
   - 新增 `dataMigration.ts` 模块处理旧数据迁移
   - 自动为 `platformId = 'weibo'` 且无 `namespace` 的记录补充 `builtin/weibo`
   - 在 `WeiboApp.vue` 启动时自动执行迁移
   - 迁移完成后记录状态，避免重复执行

### 🔄 进行中 / 待完成

1. ~~旧数据迁移脚本（social 表数据）~~ ✅ 已完成
2. 多设备同步集成（已规划，见第 6 节）- 需要服务端支持后实施
3. 完整回归测试 - 需要手动验证

---

## 8. 会话/楼层/Swipe 绑定（进行中）

> 目标：让微博 App 的 LLM 生成内容、用户行为和浏览历史与酒馆的会话/楼层/Swipe 绑定。
>
> 相关文档：`docs/apps/Weibo/session-binding-design.md`

### 8.1 Phase 1：数据模型（✅ 已完成）

- [x] 在 `src/types/social.ts` 添加 `ContentSourceTracking` 类型
- [x] 扩展 `UniversalPost`、`UniversalComment`、`TrendingTopic` 添加 `source` 字段
- [x] 更新数据库 schema（版本 8）- 已添加 `db.version(8)` 结构声明（`source` 为嵌套对象，不额外建立索引）

### 8.2 Phase 2：会话上下文服务（✅ 已完成）

- [x] 创建 `src/apps/weibo/services/sessionContext.ts`
- [x] 创建 `src/apps/weibo/stores/llm/sourceTracking.ts`
- [x] 更新 `llm/index.ts` 导出新模块

### 8.3 Phase 3：写入追踪（✅ 已完成）

- [x] 修改 `outputHandlers.ts` 添加来源追踪
  - 单条博文保存
  - 批量博文保存
  - 评论保存
- [x] 修改 `hotSearchStore.ts` 热搜生成时添加来源追踪
- [x] 修改 `postParser.ts`、`commentParser.ts` 等
  - `postParser.ts`: 添加 `source` 字段和 `getCurrentSourceTracking` 调用
  - `commentParser.ts`: 添加 `source` 字段、`namespace` 字段和 `getCurrentSourceTracking` 调用
- [x] 修改 `useNarrativeSubscription.ts`
  - 使用标准的 `ContentSourceTracking` 类型替代自定义 `SourceTracking`
  - 将来源追踪从 `payload._source` 改为使用标准的 `source` 字段
  - 添加 `namespace` 字段支持（从 `tryUseAppRuntime()` 获取）
  - 正确处理 `TavernEvent` 类型到 `WeiboNarrativeEvent` 的转换
  - 使用 `getCurrentSourceTracking()` 获取来源追踪信息
- [x] 修改 `composeStore.ts` 用户发布博文时的追踪
  - 用户发布微博时也会附带当前会话上下文的来源追踪

### 8.4 Phase 4：读取过滤（✅ 已完成）

- [x] 修改 `feedStore.ts` 的查询逻辑
  - `refreshFeed()` 使用 `buildSourceFilter`
  - 同步上下文 `syncContextFromNarrative()`
- [x] 修改 `hotSearchStore.ts` 的查询逻辑
  - `refreshHotSearch()` 使用 `buildSourceFilter`

### 8.5 Phase 5：用户行为（✅ 已完成）

- [x] 修改 `userActionStore.ts` 按会话隔离
  - `UserActionWithSource` 和 `ViewHistoryWithSource` 类型包含 `source?: ContentSourceTracking`
  - `filterBySession` 状态控制是否按会话过滤
  - `setFilterBySession()` 和 `syncSessionContext()` 方法
  - `getLikedPostIds/getFavoritedPostIds/getViewHistoryPostIds` 支持会话过滤
- [x] 浏览历史添加来源追踪
  - `addViewHistory()` 调用 `getCurrentSourceTracking()` 记录来源
  - `toggleLike()` 和 `toggleFavorite()` 也添加来源追踪

### 8.6 Phase 6：事件处理（✅ 已完成）

- [x] 在 `WeiboApp.vue` 添加 `swipe_changed` 监听
- [x] 添加 `sync` 事件处理
- [x] 设置页面添加过滤模式选项（`WeiboSettings.vue`）
  - 支持 4 种模式：显示全部 / 按会话 / 按楼层 / 按消息页
  - 显示会话连接状态和绑定统计
  - 支持手动绑定数据到当前会话
  - 添加帮助弹窗，详细解释会话/楼层/消息页等名词含义

### 8.7 待测试

- [ ] 切换 swipe 时数据正确过滤
- [ ] 新生成的内容包含来源追踪
- [ ] 旧数据（无 source）正常显示
- [ ] 叙事订阅创建的微博包含正确的 source 和 namespace

---

## 更新日志

### 2026-01-08

- 过滤模式 UI 完善
  - 添加「按楼层」过滤模式选项（共 4 种：显示全部/按会话/按楼层/按消息页）
  - 添加过滤模式帮助弹窗
    - 名词解释：会话 (Session)、楼层 (Message)、消息页 (Swipe)
    - 各过滤模式的详细说明和使用建议
    - 点击问号按钮打开帮助弹窗

- 账号会话绑定 (Phase 3 完成)
  - `sessionContext.ts` 重构：使用 accountStore 作为会话信息主要来源
  - 新增 `bindWeiboAccountToCurrentSession()` 绑定账号到当前会话
  - 新增 `getAccountBindingStatus()` 查询绑定状态
  - 新增 `autoBindAccountToCurrentSession()` 自动绑定
  - 设置页面添加账号会话绑定 UI 区块
  - 创建一次性绑定脚本 `scripts/bindAccountToSession.ts`
  - 相关文档：`docs/dev/Security/account-session-binding.md`

### 2026-01-07

- 完成 `useNarrativeSubscription.ts` 的类型修复
  - 正确处理 `TavernEvent` 到 `WeiboNarrativeEvent` 的转换
  - 添加 `namespace` 字段支持
  - 使用 `getCurrentSourceTracking()` 获取来源追踪信息

- 会话/楼层/Swipe 绑定补齐收尾
  - 数据库 schema 增加 `db.version(8)`（结构兼容，`source` 不建索引）
  - 设置页增加过滤模式选项（按会话/按 Swipe/显示全部）
