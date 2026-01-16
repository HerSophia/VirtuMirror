# 状态管理

微博 App 的状态管理采用模块化架构，将原来的巨型 store 分离为多个专用 stores。

## Store 架构概览

```text
src/apps/weibo/stores/
├── index.ts              # 统一导出入口
├── hotSearchStore.ts     # 热搜榜管理
├── feedStore.ts          # 信息流、博文、评论
├── composeStore.ts       # 发布、草稿、AI 扩展
├── userActionStore.ts    # 用户行为（点赞、收藏、历史）
├── llmTaskStore.ts       # LLM 任务管理（调用系统服务）
└── llm/                  # LLM 工具模块
    ├── index.ts
    ├── narrativeIntegration.ts
    ├── outputHandlers.ts
    ├── postTransformer.ts
    └── parsers/
```

## 1. HotSearchStore (`hotSearchStore.ts`)

热搜榜管理。

### State

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `hotSearches` | `Record<string, HotSearchItem[]>` | 热搜榜数据（按分类存储） |
| `currentCategory` | `string` | 当前选中的热搜分类 |
| `isLoading` | `boolean` | 是否正在加载 |

### 计算属性

| 属性 | 说明 |
| ---- | ---- |
| `currentHotSearch` | 当前分类的热搜列表 |
| `totalCount` | 热搜总数 |

### Actions

| 方法 | 说明 |
| ---- | ---- |
| `setCategory(category)` | 设置热搜分类 |
| `refreshHotSearch()` | 刷新热搜榜（从 TrendService 获取） |
| `applyGeneratedHotSearch(items, mode)` | 应用 LLM 生成的热搜 |
| `applyHotSearchFromJSON(json, mode)` | 从 JSON 字符串解析并应用热搜 |
| `clearHotSearches()` | 清除所有热搜数据 |
| `getHotSearchCount()` | 获取热搜数量 |

## 2. FeedStore (`feedStore.ts`)

信息流、博文、评论管理。Phase 3 重构后统一使用 `DisplayPost` 类型。

### State

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `displayPosts` | `DisplayPost[]` | 博文列表（Phase 3 新类型） |
| `stories` | `StoryItem[]` | Stories 列表 |
| `messages` | `MessageItem[]` | 消息列表 |
| `isLoading` | `boolean` | 是否正在加载 |
| `autoGenerateConfig` | `object` | 自动生成配置 |

### Actions

| 方法 | 说明 |
| ---- | ---- |
| `refreshFeed()` | 刷新信息流 |
| `loadMore()` | 加载更多博文 |
| `getPostById(id)` | 根据 ID 获取博文（返回 DisplayPost） |
| `getDisplayPostById(id)` | 获取 DisplayPost（Phase 3） |
| `getCommentsForPost(postId)` | 获取博文评论列表 |
| `getPostsByAuthor(authorId)` | 获取用户发布的博文 |
| `getDisplayPostsByAuthor(authorId)` | 获取用户博文（Phase 3） |
| `getPostCountByAuthor(authorId)` | 获取用户博文数量 |
| `likePost(postId)` | 点赞博文 |
| `followUser(userId)` | 关注用户 |
| `generatePostEngagement(postId, ...)` | 生成博文互动数据 |
| `generateCommentsForPost(postId, count)` | 生成评论 |
| `deletePost(postId)` | 删除博文 |
| `updatePost(postId, updates)` | 更新博文 |
| `clearAllPosts()` | 清除所有博文 |
| `setAutoGenerateConfig(config)` | 设置自动生成配置 |

### 自动生成配置

```typescript
autoGenerateConfig: {
  onEmptyFeed: false,    // 首页无内容时自动生成（默认关闭）
  onFewComments: false,  // 评论不足时自动生成（默认关闭）
}
```

## 3. ComposeStore (`composeStore.ts`)

发布、草稿、AI 扩展管理。

### State

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `drafts` | `WeiboDraft[]` | 草稿列表 |
| `isPublishing` | `boolean` | 是否正在发布 |
| `isExpanding` | `boolean` | 是否正在 AI 扩展 |

### 草稿管理 Actions

| 方法 | 说明 |
| ---- | ---- |
| `loadDrafts()` | 从 localStorage 加载草稿 |
| `saveDraft(data, draftId?)` | 保存/更新草稿 |
| `getDraftById(id)` | 获取单个草稿 |
| `deleteDraft(id)` | 删除草稿 |
| `clearAllDrafts()` | 清空所有草稿 |
| `getDraftCount()` | 获取草稿数量 |

### AI 扩展 Actions

| 方法 | 说明 |
| ---- | ---- |
| `expandPostContent(content)` | AI 扩展博文内容 |
| `expandImageDescription(desc)` | AI 扩展图片描述 |
| `expandVideoDescription(desc)` | AI 扩展视频描述 |

### 发布 Actions

| 方法 | 说明 |
| ---- | ---- |
| `publishPost(postData, options?)` | 发布微博 |

发布流程：
1. 确保账号系统初始化
2. 获取/创建玩家微博账号
3. 构建 `UniversalPost`（使用新的 primaryType + media 格式）
4. 保存到数据库
5. 刷新首页
6. 异步生成互动数据（可选）

## 4. UserActionStore (`userActionStore.ts`)

用户行为管理（点赞、收藏、浏览历史）。

### State

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `likes` | `UserAction[]` | 点赞记录列表 |
| `favorites` | `UserAction[]` | 收藏记录列表 |
| `viewHistory` | `ViewHistory[]` | 浏览历史列表 |
| `currentUserId` | `string | null` | 当前用户 ID |

### 计算属性

| 属性 | 说明 |
| ---- | ---- |
| `likeCount` | 点赞数量 |
| `favoriteCount` | 收藏数量 |
| `viewHistoryCount` | 浏览历史数量 |

### Actions

| 方法 | 说明 |
| ---- | ---- |
| `initialize(userId)` | 初始化（加载本地数据，过滤当前用户） |
| `isLiked(postId)` | 检查是否已点赞 |
| `toggleLike(postId)` | 切换点赞状态 |
| `isFavorited(postId)` | 检查是否已收藏 |
| `toggleFavorite(postId)` | 切换收藏状态 |
| `addViewHistory(postId)` | 添加到浏览历史 |
| `clearViewHistory()` | 清空浏览历史 |
| `getLikedPostIds()` | 获取点赞的博文 ID 列表 |
| `getFavoritedPostIds()` | 获取收藏的博文 ID 列表 |
| `getViewHistoryPostIds()` | 获取浏览历史 ID 列表 |

## 5. LLMTaskStore (`llmTaskStore.ts`)

LLM 任务管理 Store，封装对 `LLMTaskService` 的调用。

### State

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `isInitialized` | `boolean` | 是否已初始化 |
| `autoNarrativeAnalysisEnabled` | `boolean` | 是否启用自动叙事分析 |

### 核心 Actions

| 方法 | 说明 |
| ---- | ---- |
| `initializeBuiltinTasks()` | 初始化内置任务（调用 LLMTaskService） |
| `executeTask(taskId)` | 执行任务 |
| `cancelTask(taskId)` | 取消任务 |
| `deleteTask(taskId)` | 删除任务 |
| `retryTask(taskId)` | 重试失败任务 |
| `getTaskById(id)` | 获取任务详情 |
| `getAllTasks()` | 获取所有任务 |
| `getWeiboTasks()` | 获取微博相关任务 |

### 叙事相关

| 方法 | 说明 |
| ---- | ---- |
| `getNarrativeContext()` | 获取叙事上下文 |
| `setAutoNarrativeAnalysis(enabled)` | 设置自动叙事分析开关 |

## LLM 工具模块 (`stores/llm/`)

### narrativeIntegration.ts

叙事集成，提供给上下文提供器使用。

* `narrativeCache`: 叙事缓存对象
* `initializeNarrativeSubscription(log)`: 初始化订阅
* `destroyNarrativeSubscription()`: 销毁订阅
* `getNarrativeContext()`: 获取叙事上下文
* `getNarrativeCacheMetadata()`: 获取缓存元数据
* `getExistingPostsSummary()`: 获取现有博文摘要
* `getExistingHotSearchesSummary()`: 获取现有热搜摘要
* `getExistingContentContext()`: 获取完整现有内容上下文

### outputHandlers.ts

输出处理器工具函数，供 `weiboOutputHandlers.ts` 使用。

* `saveSinglePostToDatabase(data)`: 保存单条博文
* `saveBatchPostsToDatabase(data)`: 保存批量博文
* `saveEngagementToDatabase(data, postId)`: 保存互动数据
* `preprocessEngagementInput(input)`: 预处理互动输入
* `cleanJsonOutput(output)`: 清理 JSON 输出

### postTransformer.ts (Phase 4)

LLM 输出转换层。

* `transformLLMOutputToUniversalPost(output, context)`: 转换单条输出
* `transformBatchLLMOutput(outputs, context)`: 批量转换
* `validateLLMOutput(output)`: 验证输出格式
* `convertLegacyImages(images)`: 转换旧格式图片
* `convertLegacyPoll(poll)`: 转换旧格式投票
* `convertLegacyVideo(video)`: 转换旧格式视频
* `extractTopicTags(text)`: 提取话题标签
* `generateRandomStats()`: 生成随机统计数据

### parsers/ (Phase 5)

解析器分发架构。

**dispatcher.ts**:
* `ContentDispatcher`: 内容分发器类
* `getDispatcher()`: 获取分发器实例

**postParser.ts**:
* `PostParser`: 博文解析器
* 返回 `tempId → postId` 映射

**commentParser.ts**:
* `CommentParser`: 评论解析器
* 使用 postId 映射关联评论

**hotSearchParser.ts**:
* `HotSearchParser`: 热搜解析器

**repostParser.ts**:
* `RepostParser`: 转发解析器

## 调试支持

`LLMTaskService` 在执行任务时会在控制台输出详细的分组日志：

```text
[LLMTask] 任务执行调试 - 🔥 生成微博博文
  📋 任务信息: { ... }
  ⚙️ LLM 配置: { temperature: 0.9, ... }
  📥 输入变量: { topic: "..." }
  🔧 系统提示词: ...
  📝 用户提示词: [绿色高亮] ...
  📚 注入的现有内容: { posts: 10, topics: 20 }
```

## 使用示例

```typescript
import {
  useHotSearchStore,
  useFeedStore,
  useComposeStore,
  useUserActionStore,
  useLLMTaskStore,
} from '@/apps/weibo/stores';

// 在组件中使用
const hotSearchStore = useHotSearchStore();
const feedStore = useFeedStore();
const composeStore = useComposeStore();
const actionStore = useUserActionStore();
const llmTaskStore = useLLMTaskStore();

// 刷新数据
await feedStore.refreshFeed();
await hotSearchStore.refreshHotSearch();

// 发布博文
const result = await composeStore.publishPost({
  type: 'text',
  content: '这是一条测试微博 #测试#',
  topics: ['测试'],
  images: [],
});

// 点赞
actionStore.toggleLike(postId);

// 执行 LLM 任务
await llmTaskStore.executeTask('weibo:generate-post');
```
