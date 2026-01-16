# AI 提示词工程

微博 App 采用了自主注册提示词的机制，将 Prompt 定义与业务代码解耦。

## 提示词注册

* **定义文件**: `src/apps/weibo/prompts.ts`
* **注册入口**: `manifest.ts` -> `registerWeiboApp()` -> `PromptService.registerAppPrompts()`

## 专用提示词 (Prompts)

| 场景 ID | 名称 | 说明 |
| :--- | :--- | :--- |
| `social.weibo.analyze.narrative` | 叙事内容分析 | 分析酒馆故事，判断是否需要生成微博内容 |
| `social.post.generate.weibo` | 生成微博博文 | 生成微博风格博文（支持文字/图集/投票/视频） |
| `social.comment.batch.weibo` | 生成微博评论 | 模拟粉丝控评、杠精、路人吃瓜等多样化评论 |
| `social.user.generate.weibo` | 生成微博用户 | 生成带星座、坐标、追星属性的昵称和简介 |
| `social.topic.generate.weibo` | 生成热搜话题 | 将普通事件标题转化为双井号话题格式 |
| `social.post.expand.weibo` | 扩展微博内容 | 将简短内容扩展为生动的微博文案 |
| `social.image.expand.weibo` | 扩展图片描述 | 将简短描述扩展为详细的视觉描述 |
| `social.video.expand.weibo` | 扩展视频描述 | 扩展视频描述，生成封面描述 |
| `social.post.engagement.weibo` | 生成博文互动 | 根据博文和博主信息生成评论、点赞、转发 |
| `social.poll.optimize.weibo` | 优化投票选项 | 优化投票问题和选项 |

## LLM 任务扩展架构

微博 App 通过 `llmTask/` 目录向全局 `LLMTaskService` 注册扩展：

### 任务定义 (`weiboTaskDefinitions.ts`)

定义 7 个预配置任务和 2 个模板：

```typescript
export const weiboTaskDefinitions: LLMTaskDefinition[] = [
  {
    id: 'weibo:generate-post',
    appId: 'weibo',
    name: '🔥 生成微博博文',
    type: 'prompt',
    promptId: 'social.post.generate.weibo',
    outputHandlerId: 'weibo:post-handler',
    contextProviders: ['system:time', 'weibo:narrative', 'weibo:existing-content'],
    // ...
  },
  // ...
];
```

### 上下文提供器 (`weiboContextProviders.ts`)

提供任务执行时的上下文变量：

| ID | 提供的变量 | 说明 |
| -- | --------- | ---- |
| `weibo:narrative` | `narrative` | 酒馆叙事内容 |
| `weibo:existing-content` | `existingPosts`, `existingHotSearches` | 现有内容（用于去重） |

### 输出处理器 (`weiboOutputHandlers.ts`)

处理 LLM 输出并持久化：

| ID | 处理类型 | 说明 |
| -- | -------- | ---- |
| `weibo:post-handler` | 单条博文 | 保存到 db.socialPosts |
| `weibo:batch-posts-handler` | 批量博文 | 解析数组并批量保存 |
| `weibo:hot-list-handler` | 热搜列表 | 保存到 db.socialTopics |
| `weibo:comments-handler` | 评论列表 | 保存到 db.socialComments |
| `weibo:engagement-handler` | 互动数据 | 更新博文统计 + 保存评论 |
| `weibo:composite-handler` | 复合输出 | 分发给各解析器处理 |

## Phase 4: 博文生成格式

博文生成提示词支持两种输出格式，系统会自动处理：

### 新格式（推荐）

使用 `primaryType` + `payload` + `media` 结构：

```json
{
  "primaryType": "text",
  "payload": {
    "text": "微博正文（含#话题#和emoji）"
  },
  "media": [
    {"id": "img_0", "type": "image", "description": "图片描述", "order": 0}
  ],
  "authorName": "用户昵称"
}
```

### 旧格式（仍支持）

```json
{
  "type": "text",
  "text": "微博正文",
  "images": ["图片描述1", "图片描述2"],
  "authorName": "用户昵称"
}
```

### 类型映射

| primaryType | 说明 | media 要求 |
| --- | --- | --- |
| `text` | 纯文字/少量图片 | 0-3 张图片 |
| `gallery` | 图集 | 4-9 张图片 |
| `poll` | 投票 | payload.poll 必填 |
| `video` | 视频 | media 包含 type: 'video' |

## 提示词链 (Chains)

对于复杂的生成任务，使用提示词链将多个 LLM 调用串联起来。

* **定义文件**: `src/apps/weibo/chains.ts`
* **注册入口**: `manifest.ts` -> `promptChainService.registerAppChains()`

### 微博热点内容生成流水线

**ID**: `chain.weibo.微博热点内容生成.0`

**步骤**:

1. **生成世界事件**: 基于时间上下文生成突发事件。
2. **生成话题**: 将事件转化为 #话题#。
3. **批量生成博文**: 围绕话题生成多条不同视角的博文（循环执行）。
4. **生成评论**: 为第一条博文生成评论区。

## 上下文注入机制

LLM 任务执行时，系统会通过上下文提供器自动注入以下变量：

### 1. 叙事上下文 (`{{narrative}}`)

* **提供器**: `weibo:narrative`
* **来源**: `narrativeIntegration.ts` 的 `narrativeCache`
* **内容**: 最近 10 条消息拼接而成的故事文本。
* **用途**: 让生成的微博内容与当前剧情紧密相关。

### 2. 现有内容上下文

* **提供器**: `weibo:existing-content`
* **提供变量**:
  * `existingPosts`: 最近 10 条博文摘要
  * `existingHotSearches`: 最近 20 条热搜
* **去重逻辑**: Prompt 中包含 `{{#if existingPosts}}...{{/if}}` 块，指示 LLM 避开已知内容。

### 3. 时间上下文

* **提供器**: `system:time`（系统内置）
* **变量**: `timeContext`, `fullDateTime`
* **内容**: 当前模拟时间、时段（清晨/深夜）、周末/工作日。

## 系统提示词集成

微博 App 的所有 LLM 请求会自动注入全局和 App 级系统提示词：

```text
┌─────────────────────────────────────────────────────────────┐
│                      最终系统提示词                           │
├─────────────────────────────────────────────────────────────┤
│ 1. 全局系统提示词 (scope: 'global')                          │
│    - 角色扮演基本规则                                         │
│    - 故事世界观设定                                           │
├─────────────────────────────────────────────────────────────┤
│ 2. App 级系统提示词 (scope: 'app', appId: 'weibo')           │
│    - 微博平台特定规则                                         │
│    - 语言风格约束                                             │
├─────────────────────────────────────────────────────────────┤
│ 3. 任务/提示词自带的 systemPrompt                            │
│    - 具体任务的指令                                           │
└─────────────────────────────────────────────────────────────┘
```

## Phase 5: 复合输出格式

`weibo:complete-hot-topic` 任务使用复合输出格式：

```json
{
  "hotSearches": [
    {
      "keyword": "#话题#",
      "heat": 95,
      "summary": "话题简介",
      "category": "娱乐",
      "isNew": true,
      "isHot": true
    }
  ],
  
  "posts": [
    {
      "tempId": "post_1",
      "primaryType": "text",
      "payload": {
        "text": "博文正文(含#话题#和emoji)"
      },
      "media": [
        {"id": "img_0", "type": "image", "description": "图片描述", "order": 0}
      ],
      "authorName": "用户昵称"
    }
  ],
  
  "comments": [
    {
      "postId": "post_1",
      "content": "评论内容",
      "nickname": "评论者昵称"
    }
  ],
  
  "reposts": [
    {
      "originalPostId": "post_1",
      "payload": {"text": "转发文案"},
      "authorName": "转发者昵称"
    }
  ]
}
```

### tempId 映射机制

* `posts` 中的每条博文需要 `tempId` 字段
* `comments` 和 `reposts` 使用 `postId`/`originalPostId` 引用 `tempId`
* 系统解析时会建立 `tempId → 实际postId` 的映射
* 评论和转发会使用映射关联到正确的博文

## 内置任务提示词

### weibo:generate-post

单条博文生成，支持多种类型。

**输入变量**:

* `topic`: 话题关键词
* `postType`: 博文类型 (text/gallery/poll/video)
* `authorIdentity`: 作者身份
* `platformCulture`: 语气风格

### weibo:update-trending

热搜生成（手动提示词）。

**输入变量**:

* `count`: 生成数量
* `timeContext`: 时间背景
* `category`: 话题类型
* `narrative`: 叙事内容（自动注入）
* `existingHotSearches`: 已有热搜（自动注入）

### weibo:batch-posts

批量博文生成，支持混合类型。

**输入变量**:

* `topic`: 话题
* `count`: 生成数量
* `postTypes`: 类型偏好
* `existingPosts`: 已有博文（自动注入）
* `existingHotSearches`: 热搜榜（自动注入）

### weibo:generate-engagement

博文互动生成。

**输入变量**:

* `postId`: 博文 ID（可选，自动获取信息）
* `postContent`: 博文内容
* `authorName`: 博主昵称
* `followerCount`: 粉丝数
* `minComments`: 最少评论数
* `narrative`: 叙事内容（自动注入）

### weibo:complete-hot-topic

完整热点生成（Phase 5）。

**输入变量**:

* `eventType`: 事件类型
* `timeContext`: 时间背景
* `postCount`: 博文数量
* `commentCount`: 每条博文评论数

**输出处理器**: `weibo:composite-handler`

## 调试支持

任务执行时会在控制台输出详细日志：

```text
[LLMTask] 任务执行调试 - 🔥 生成微博博文
  📋 任务信息: { id, type, promptId, ... }
  ⚙️ LLM 配置: { temperature: 0.9, maxTokens: 500, ... }
  📥 输入变量: { topic: "...", postType: "text", ... }
  🔧 系统提示词: [完整内容]
  📝 用户提示词: [绿色高亮，完整内容]
  📚 注入的现有内容: { posts: 10, topics: 20 }
```
