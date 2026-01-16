# 核心功能

## 1. 热搜系统 (Trending)

热搜是微博 App 的核心功能之一，支持两种生成方式：

### 方式一：引擎驱动 (TrendService)

* **数据源**: `TrendService.getInstance().getTrendingList('weibo')`
* **流程**:
  1. `DirectorService` 或用户聊天触发 `WorldEvent`
  2. `TrendService` 将事件转化为 `TrendingTopic` 并存入数据库
  3. `TrafficEngine` 实时计算热度

### 方式二：LLM 任务生成 (User Triggered)

* **入口**: 热搜页右上角"生成热搜"按钮，或 LLM 任务管理中的 `weibo:update-trending` 任务。
* **流程**:
  1. LLM 根据当前叙事上下文生成一批热搜话题 JSON。
  2. `hotSearchStore.applyHotSearchFromJSON` 将结果保存到数据库。
  3. `TrafficEngine` 根据生成的热度值反推基础分数。

### 热度算法 (TrafficEngine)

热度计算公式：

```text
Heat = (BaseScore³ × 0.1) × TimeFactor × Jitter
```

* **BaseScore**: 基础分数 (1-100)，决定事件量级。
* **TimeFactor**: 时间衰减因子，包含上升期（正弦曲线）和衰退期（指数衰减）。
* **Jitter**: 随机抖动，让数字看起来更真实。

**热度标签判定**：

| 标签 | 条件 | 显示 |
| ---- | ---- | ---- |
| 沸 | 排名前 3 且热度 ≥ 100 万 | 红色"沸" |
| 爆 | 热度 ≥ 50 万 | 红色"爆" |
| 热 | 热度 ≥ 10 万 | 橙色"热" |
| 新 | 创建时间 < 1小时 | 红色"新" |

## 2. 内容生成 (Content Generation)

### 博文生成

* **触发**:
  * 批量生成任务 (`weibo:batch-posts`)
  * 单条生成任务 (`weibo:generate-post`)
  * 点击空热搜时触发 `TrendService.ensureTopicContent`
  * 叙事内容订阅自动分析（需开启 autoNarrativeAnalysisEnabled）
  * 完整热点生成任务 (`weibo:complete-hot-topic`)
* **去重**: 生成时会自动注入最近 10 条博文作为上下文，要求 LLM 避免重复。
* **类型支持**: 文字/图集/投票/视频/转发

### 评论生成

* **惰性生成 (Lazy Generation)**:
  * 仅当用户进入详情页且评论过少时触发。
  * 需在 feedStore.autoGenerateConfig 中开启 `onFewComments`。
* **主动生成**:
  * 通过 `weibo:generate-comments` 任务手动生成
  * 通过 `feedStore.generateCommentsForPost()` 方法
* **影子账号**: 生成评论时会自动创建或匹配 NPC 账号，使用 `UserPool` 生成随机档案。

### 互动数据生成

* **触发**: 用户发布博文后自动触发（通过 `composeStore.publishPost` 的 `autoGenerateEngagement` 选项），或通过 `weibo:generate-engagement` 任务手动触发
* **内容**:
  * 点赞数（根据粉丝数和内容质量估算）
  * 转发数
  * 评论列表（多样化风格）
* **叙事关联**: 如果有叙事内容，评论会体现对故事情节的反应

## 3. 账号系统集成

微博 App 实现了完整的玩家多重身份机制：

* **作用域 (Scope)**: 账号以 `character` 作用域存储，不同角色卡拥有独立身份。
* **资料编辑**: 支持修改头像、昵称、简介、性别、生日、所在地、标签。
* **粉丝数管理**: 支持自定义修改粉丝数，系统自动格式化显示（万/亿）。
* **认证系统**: 支持 11 种认证类型（名人、博主、企业、媒体等），带V标展示。

### 用户画像

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tagline` | string | 一句话介绍 |
| `ageRange` | enum | 年龄段 |
| `occupation` | string | 职业 |
| `location` | string | 所在地 |
| `interests` | string[] | 兴趣领域（最多5个） |
| `tags` | string[] | 个性标签（最多5个） |

### NPC 账号创建

评论者和转发者使用 `UserPool` 自动生成：

```typescript
// feedStore.ts - ensureCommenterAccount()
const userPool = UserPool.getInstance();
const profile = userPool.generateRandomProfile({ platform: 'weibo' });

const entity = await accountService.createEntity({
  type: 'npc',
  displayName: nickname,
  avatar: profile.avatar,
  bio: profile.bio,
  scope: 'session',
});

const account = await accountService.createPlatformAccount(
  entity.id,
  'weibo',
  { handle, nickname, scope: 'session' }
);
```

## 4. 叙事内容订阅

微博 App 能感知酒馆中的故事进展：

### 工作原理

1. **订阅**: `WeiboApp` 挂载时通过 `useNarrativeSubscription` 订阅 `NarrativeService`。
2. **拼接**: 将 Bridge 同步的多条消息按楼层顺序拼接为完整叙事文本。
3. **缓存**: 存入 `narrativeIntegration.ts` 的 `narrativeCache`。
4. **注入**: 执行 LLM 任务时，上下文提供器 `weibo:narrative` 自动注入缓存内容。

### 自动分析 (可选)

在设置中开启"自动叙事分析"后（`llmTaskStore.autoNarrativeAnalysisEnabled`）：

1. 收到新消息时，自动调用 LLM 分析内容。
2. 判断是否包含发微博、更新动态等行为。
3. 如果是，则提取内容并自动发布微博。

> **默认关闭**: 为避免无意中消耗 API 调用，此功能默认关闭。

## 5. 用户行为系统

### 点赞

* **存储**: localStorage (`weibo_user_likes`)
* **功能**: 点赞/取消点赞，点赞后按钮变红
* **API**: `userActionStore.toggleLike(postId)`

### 收藏

* **存储**: localStorage (`weibo_user_favorites`)
* **功能**: 收藏/取消收藏，可在"我的"页面查看收藏列表
* **API**: `userActionStore.toggleFavorite(postId)`

### 浏览历史

* **存储**: localStorage (`weibo_view_history`)
* **功能**: 自动记录浏览过的博文（最多 200 条），可清空
* **API**: `userActionStore.addViewHistory(postId)`

## 6. 草稿箱

### 功能概述

草稿箱允许用户保存未完成的微博内容，稍后继续编辑或发布。

### 数据存储

草稿保存在 `localStorage` 中，使用 `weibo_drafts` 作为存储键。

```typescript
interface WeiboDraft {
  id: string;
  type: WeiboPostType;     // 博文类型 (text/poll/video)
  content: string;         // 正文内容
  topics: string[];        // 话题标签
  images: WeiboImageConfig[]; // 图片配置
  poll?: WeiboPollConfig;  // 投票配置
  video?: WeiboVideoConfig; // 视频配置
  createdAt: number;
  updatedAt: number;
}
```

### 使用流程

1. 编写微博内容 → 点击保存草稿按钮 → 草稿保存到本地
2. 进入"我的"页面 → 点击「草稿箱」 → 查看所有草稿
3. 选择草稿 → 自动加载到发布对话框 → 继续编辑或发布
4. 发布成功后自动删除对应草稿
5. 关闭发布对话框时，如有未保存内容会询问是否保存草稿

## 7. 博文发布

### 支持的博文类型

| 类型 | primaryType | 说明 |
| --- | --- | --- |
| 纯文字 | `text` | 文字内容，0-3张图片 |
| 图集 | `gallery` | 4-9张图片 |
| 投票 | `poll` | 带投票的博文 |
| 视频 | `video` | 视频内容 |

### 发布流程

```typescript
// composeStore.ts - publishPost()
1. 确保账号系统初始化
2. 获取/创建玩家微博账号
3. 确定 primaryType（根据图片数量和类型）
4. 构建 media 数组（MediaAsset[]）
5. 构建 contentFlags
6. 构建 payload（兼容旧格式）
7. 创建 UniversalPost 并保存到数据库
8. 刷新首页信息流
9. 异步生成互动数据（如启用）
```

### AI 扩展功能

* **内容扩展**: 将简短内容扩展为生动的微博文案（`composeStore.expandPostContent`）
* **图片描述扩展**: 将简短描述扩展为详细的视觉描述（`composeStore.expandImageDescription`）
* **视频描述扩展**: 扩展视频描述，生成封面描述（`composeStore.expandVideoDescription`）

## 8. 完整热点生成 (Phase 5)

### 功能概述

一次性生成完整的热点事件，包含热搜话题、相关博文、评论和转发。

### 输出格式

```json
{
  "hotSearches": [
    {"keyword": "#话题#", "heat": 95, "summary": "..."}
  ],
  "posts": [
    {
      "tempId": "post_1",
      "primaryType": "text",
      "payload": {"text": "..."},
      "media": [...],
      "authorName": "用户"
    }
  ],
  "comments": [
    {"postId": "post_1", "content": "...", "nickname": "..."}
  ],
  "reposts": [
    {"originalPostId": "post_1", "payload": {"text": "..."}, "authorName": "..."}
  ]
}
```

### 解析器分发

系统使用 `ContentDispatcher` 分发给不同的解析器：

1. `HotSearchParser`: 处理 `hotSearches` 数组
2. `PostParser`: 处理 `posts` 数组，返回 `tempId → postId` 映射
3. `CommentParser`: 处理 `comments` 数组，使用映射关联实际 postId
4. `RepostParser`: 处理 `reposts` 数组，使用映射关联原博文
