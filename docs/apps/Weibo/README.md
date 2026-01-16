# Weibo App 文档

## 概述

微博 App 是一个基于 **社交媒体模拟引擎 (Social Simulation Engine)** 的社交媒体模拟器前端。它不仅模拟了真实微博的界面交互（信息流、热搜榜、消息通知等），还通过底层引擎实现了数据的动态生成与演化。

当前版本已完成与核心引擎的深度集成：

* **内容生成**: 博文与评论由 LLM 实时生成，支持"惰性加载"。
* **热搜系统**: 热搜榜单由 `TrendService` 驱动，支持 LLM 生成并自动应用。
* **世界事件**: 支持由 `DirectorService` 触发的后台世界事件，自动生成相关热搜与博文。
* **账号系统**: 完整的玩家多重身份机制，支持资料编辑、认证、画像配置和账号切换。
* **LLM 任务管理**: 基于系统服务的任务系统，支持一键生成内容和自动循环执行。
* **草稿箱**: 支持保存、管理和编辑草稿，发布时自动清理。
* **博文互动**: 发布博文后自动生成评论、点赞和转发数据。
* **用户行为**: 点赞、收藏、浏览历史的持久化存储。

## 文档导航

* [架构设计](architecture.md): 系统架构、数据流向与集成点
* [核心功能](features.md): 热搜算法生成、账号系统、叙事订阅
* [组件说明](components.md): 主要视图和组件的功能说明
* [状态管理](state-management.md): Pinia Stores 详解（模块化架构）
* [AI 提示词工程](prompt-engineering.md): 提示词定义、链式调用与上下文注入
* [数据类型](types.md): 核心数据模型定义（Phase 3 重构）

## 快速开始

### 目录结构

```text
src/apps/weibo/
├── WeiboApp.vue              # 主应用入口
├── index.ts                  # 导出入口
├── manifest.ts               # 应用清单（App 注册、提示词、链注册）
├── prompts.ts                # 提示词定义
├── chains.ts                 # 提示词链定义
├── types.ts                  # UI 类型定义
├── components/               # 组件目录
│   ├── ComposePostDialog.vue # 发布对话框
│   ├── CreateAccountDialog.vue # 创建账号（薄封装）
│   ├── DraftsDialog.vue      # 草稿箱
│   ├── EditFollowersDialog.vue # 粉丝数编辑
│   ├── EditProfileDialog.vue # 资料编辑
│   ├── PostActionSheet.vue   # 博文操作菜单
│   ├── VerificationDialog.vue # 认证对话框
│   ├── WeiboPoll.vue         # 投票帖组件
│   ├── WeiboPost.vue         # 博文卡片
│   ├── WeiboRepost.vue       # 转发帖组件
│   └── WeiboVideo.vue        # 视频帖组件
├── composables/              # 组合式函数
│   ├── index.ts
│   ├── useNarrativeSubscription.ts  # 叙事订阅
│   └── usePostDisplay.ts     # 博文展示逻辑（Phase 3）
├── views/                    # 页面视图
│   ├── LLMTaskManager.vue    # LLM 任务管理
│   ├── WeiboFavorites.vue    # 收藏列表
│   ├── WeiboHistory.vue      # 浏览历史
│   ├── WeiboHome.vue         # 首页信息流
│   ├── WeiboHot.vue          # 热搜榜
│   ├── WeiboLikes.vue        # 点赞列表
│   ├── WeiboMessage.vue      # 消息页
│   ├── WeiboPostDetail.vue   # 博文详情
│   ├── WeiboProfile.vue      # 个人主页
│   ├── WeiboSettings.vue     # 设置页
│   └── WeiboUserPosts.vue    # 用户博文列表
├── stores/                   # 状态管理（模块化）
│   ├── index.ts              # Store 入口
│   ├── hotSearchStore.ts     # 热搜榜管理
│   ├── feedStore.ts          # 信息流、博文、评论
│   ├── composeStore.ts       # 发布、草稿、AI 扩展
│   ├── userActionStore.ts    # 用户行为（点赞、收藏、历史）
│   ├── llmTaskStore.ts       # LLM 任务管理（调用系统服务）
│   └── llm/                  # LLM 工具模块
│       ├── index.ts          # 模块统一导出
│       ├── narrativeIntegration.ts  # 叙事集成
│       ├── outputHandlers.ts # 输出处理器工具函数
│       ├── postTransformer.ts # LLM 输出转换层（Phase 4）
│       └── parsers/          # 解析器分发架构（Phase 5）
│           ├── index.ts
│           ├── dispatcher.ts # 内容分发器
│           ├── postParser.ts # 博文解析器
│           ├── commentParser.ts # 评论解析器
│           ├── hotSearchParser.ts # 热搜解析器
│           ├── repostParser.ts # 转发解析器
│           └── types.ts
├── llmTask/                  # LLM 任务扩展（注册到系统服务）
│   ├── index.ts              # 扩展注册入口
│   ├── weiboTaskDefinitions.ts # 任务定义
│   ├── weiboContextProviders.ts # 上下文提供器
│   └── weiboOutputHandlers.ts # 输出处理器
├── types/                    # 类型定义
│   ├── index.ts
│   └── llmTask.ts            # LLM 任务类型
├── data/                     # 数据层 (Mock)
│   └── mockData.ts
└── __tests__/                # 单元测试
    ├── composables/
    ├── stores/
    └── ...
```

### Store 架构

微博 App 的状态管理已分离为专用 stores，以提高可维护性：

| Store | 文件 | 职责 |
| ----- | ---- | ---- |
| `useHotSearchStore` | `hotSearchStore.ts` | 热搜榜管理、热度计算、LLM 热搜生成 |
| `useFeedStore` | `feedStore.ts` | 信息流、博文、评论、互动生成 |
| `useComposeStore` | `composeStore.ts` | 草稿管理、发布博文、AI 内容扩展 |
| `useUserActionStore` | `userActionStore.ts` | 点赞、收藏、浏览历史 |
| `useLLMTaskStore` | `llmTaskStore.ts` | LLM 任务管理（调用系统服务） |

#### LLM 任务架构

微博 App 的 LLM 任务系统基于全局 `LLMTaskService` 实现，通过扩展机制注册微博专用功能：

| 模块 | 文件 | 职责 |
| ---- | ---- | ---- |
| 任务定义 | `llmTask/weiboTaskDefinitions.ts` | 7 个预配置任务 + 2 个模板 |
| 上下文提供器 | `llmTask/weiboContextProviders.ts` | 叙事内容、现有内容注入 |
| 输出处理器 | `llmTask/weiboOutputHandlers.ts` | 博文/热搜/评论/复合内容保存 |
| 叙事集成 | `stores/llm/narrativeIntegration.ts` | 酒馆叙事订阅、缓存管理 |
| 输出转换 | `stores/llm/postTransformer.ts` | LLM 输出转换为 UniversalPost |
| 解析器 | `stores/llm/parsers/` | Phase 5 解析器分发架构 |

**使用方式**：

```typescript
// 推荐：直接使用分离后的 stores
import {
  useHotSearchStore,
  useFeedStore,
  useComposeStore,
  useUserActionStore,
  useLLMTaskStore
} from '@/apps/weibo/stores';

const hotSearchStore = useHotSearchStore();
const feedStore = useFeedStore();
const composeStore = useComposeStore();
const userActionStore = useUserActionStore();
const llmTaskStore = useLLMTaskStore();

// LLM 任务初始化（在 WeiboApp.vue onMounted 中自动调用）
llmTaskStore.initializeBuiltinTasks();

// 执行任务
await llmTaskStore.executeTask(taskId);
```

**直接使用子模块**（高级用法）：

```typescript
// 叙事集成
import { getNarrativeContext, getExistingContentContext } from '@/apps/weibo/stores/llm';

// LLM 输出转换（Phase 4）
import { transformLLMOutputToUniversalPost, transformBatchLLMOutput } from '@/apps/weibo/stores/llm';

// 解析器（Phase 5）
import { ContentDispatcher, getDispatcher, parseCompositeOutput } from '@/apps/weibo/stores/llm';
```

### 开发计划

#### 已完成

* [x] **叙事内容订阅**: 订阅来自酒馆的叙事内容，使用 LLM 分析并自动生成微博帖子
* [x] **多楼层叙事拼接**: 将同步的所有消息（默认10层）按顺序拼接为完整叙事上下文
* [x] **叙事自动注入**: LLM 任务中的 `{{narrative}}` 变量自动注入酒馆叙事内容（支持所有任务类型）
* [x] **叙事防重复机制**: 自动检测系统提示词中是否已包含叙事内容，避免重复注入
* [x] **用户自定义人设**: 允许玩家创建自己的微博账号并发帖互动
* [x] **账号编辑**: 支持修改头像、昵称、简介等
* [x] **粉丝数修改**: 点击粉丝数可自定义修改
* [x] **账号认证**: 支持多种大V认证类型
* [x] **用户画像扩展**: 支持设置年龄段、职业、所在地、兴趣领域、个性标签等完整画像
* [x] **随机生成资料**: 创建账号时支持一键随机生成完整画像
* [x] **画像展示**: 个人主页展示标语、标签、兴趣领域等画像信息
* [x] **设置页面**: LLM 请求管理、账号切换、认证入口
* [x] **LLM 任务管理页面**: 完整的任务管理功能
* [x] **内置任务系统**: 7 个预配置的常用任务（含博文互动生成、完整热点生成）
* [x] **自动执行模式**: 支持定时循环执行任务
* [x] **热搜 LLM 生成**: 通过任务生成热搜并自动应用
* [x] **热度算法集成**: 使用 TrafficEngine 计算实时热度，支持热度格式化和标签判定
* [x] **热搜持久化**: 热搜数据保存到 IndexedDB，页面刷新后保留
* [x] **数据删除修复**: 使用 bulkDelete 可靠删除热搜和博文数据
* [x] **任务调试输出**: 执行 LLM 任务时输出完整提示词到控制台，方便调试
* [x] **数据库索引优化**: 修复 socialTopics 表索引，支持 platformId 查询
* [x] **提示词链执行**: LLMTaskStore 支持 `type: 'chain'` 任务，调用 `promptChainExecutor` 执行多步骤链
* [x] **博文持久化**: TrendService.ensureTopicContent 和 useNarrativeSubscription 生成的博文保存到 db.socialPosts
* [x] **评论持久化**: feedStore.getCommentsForPost 生成的评论保存到 db.socialComments，与 postId 关联
* [x] **自动生成可控化**: 首页空白自动填充、评论自动生成等功能默认关闭，避免无意中消耗 API 调用
* [x] **草稿箱**: 发布微博时可保存草稿，支持草稿管理和编辑
* [x] **发布微博**: 玩家发布微博功能（支持文字/投票/视频三种类型）
* [x] **博文账号归属**: 发布博文时正确关联到玩家的微博账号
* [x] **博文互动生成**: 发布后自动生成评论、点赞、转发等互动数据
* [x] **LLMTaskStore 模块化**: 将单文件拆分为多个功能模块
* [x] **我的微博列表**: "我的"页面显示真实博文数量，点击可查看该账号发布的所有微博
* [x] **投票帖UI组件**: `WeiboPoll.vue` 组件，支持单选/多选投票、进度显示、剩余时间、投票交互
* [x] **视频帖UI组件**: `WeiboVideo.vue` 组件，显示视频封面占位符、时长、描述
* [x] **转发帖UI组件**: `WeiboRepost.vue` 组件，显示转发内容和原文
* [x] **点赞持久化**: 点赞状态保存到本地存储，支持取消点赞，点赞后按钮变红
* [x] **收藏功能**: 收藏博文到本地，可在「我的」→「收藏」中查看收藏列表
* [x] **浏览历史**: 自动记录浏览过的博文，可在「我的」→「浏览历史」中查看和清空
* [x] **我的页面入口**: 收藏、赞、浏览历史菜单项显示真实数量，点击可进入对应列表
* [x] **Phase 3 类型重构**: 统一使用 `DisplayPost` 类型，支持 `primaryType`、`media`、`contentFlags` 字段
* [x] **Phase 4 输出转换**: `postTransformer.ts` 实现 LLM 输出到 UniversalPost 的转换
* [x] **Phase 5 解析器架构**: `ContentDispatcher` 和多个解析器支持复合输出处理
* [x] **系统服务集成**: LLM 任务系统重构为使用全局 `LLMTaskService`

#### 待开发

* [ ] **图片生成对接**: 目前图片仅为描述文本或占位符，需对接 `ImageGenerationService`
* [ ] **消息通知**: 对接 `NotificationSystem`，让模拟的点赞/评论产生真实的通知
* [ ] **超话/粉丝群**: 模拟微博的社群功能
* [ ] **热搜买榜**: 模拟商业推广的热搜机制
* [ ] **关注系统持久化**: 关注状态写入数据库，影响 `TrafficEngine` 算法参数

## 发布微博功能

### 支持的博文类型

1. **纯文字帖** (`primaryType: 'text'`): 普通文字内容，少于 4 张图片
2. **图集帖** (`primaryType: 'gallery'`): 4 张及以上图片
3. **投票帖** (`primaryType: 'poll'`): 发起投票，支持多选、设置时长
4. **视频帖** (`primaryType: 'video'`): 视频内容，由 LLM 扩展为详细描述
5. **转发帖** (`primaryType: 'repost'`): 转发他人内容并添加评论

### 博文类型 UI 展示

博文在首页和详情页会根据 `primaryType` 字段自动渲染对应的 UI 组件：

| 类型 | 组件 | 说明 |
| --- | --- | --- |
| `text` | 默认文字+图片 | 显示文字内容和图片（1-3张） |
| `gallery` | 九宫格图片 | 显示图集（4-9张） |
| `poll` | `WeiboPoll.vue` | 显示投票卡片，支持投票交互 |
| `video` | `WeiboVideo.vue` | 显示视频播放器占位符 |
| `repost` | `WeiboRepost.vue` | 显示转发卡片和原文 |

### UniversalPost 新架构（Phase 3+）

```typescript
interface UniversalPost {
  id: string;
  platformId: string;         // 'weibo'
  authorId: string;
  timestamp: number;
  
  // 新字段（Phase 3）
  primaryType: PrimaryContentType;  // 'text' | 'gallery' | 'poll' | 'video' | 'repost' | 'article'
  contentFlags: ContentFlags;       // 内容特征标志
  media: MediaAsset[];              // 统一的媒体资源数组
  topicTags?: string[];             // 话题标签
  
  // 保留的旧字段（向后兼容）
  payload: PostPayload;
  stats: PostStats;
  meta?: PostMeta;
}

interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  description?: string;
  expandedDescription?: string;
  url?: string;
  coverDescription?: string;  // 视频封面
  duration?: number;          // 视频/音频时长
  order?: number;             // 排序
}
```

### LLM 生成博文格式（Phase 4）

LLM 输出可以使用新格式或旧格式，系统会自动转换：

**新格式（推荐）**：

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

**旧格式（仍支持）**：

```json
{
  "type": "text",
": "微博正文",
  "images": ["图片描述1", "图片描述2"],
  "authorName": "用户昵称"
}
```

## 用户画像系统

### 概述

用户画像系统允许玩家为自己的微博账号配置完整的人设，这些信息将用于：

* LLM 生成更贴合人设的内容
* 涨粉引擎匹配合适的粉丝
* 个人主页的展示

> **类型定义**: 完整的 `CharacterProfile` 接口定义在 `src/types/account.ts`
> **公共组件**: 创建账号功能使用公共组件 `src/components/common/CreateAccountDialog.vue`

### 画像字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| 一句话介绍 | `tagline` | 显示在昵称下方的简短标语 |
| 年龄段 | `ageRange` | teen/young/adult/middle/mature/senior |
| 职业 | `occupation` | 程序员、学生、设计师等 |
| 所在地 | `location` | 北京、上海、杭州等 |
| 兴趣领域 | `interests[]` | 科技、游戏、美食等（最多5个） |
| 个性标签 | `tags[]` | 自定义标签（最多5个） |

## LLM 内置任务

微博 App 提供了 7 个预配置的内置任务（注册到 `LLMTaskService`）：

| 任务名称 | 任务 ID | 类型 | 说明 |
| -------- | ------- | ---- | ---- |
| 🔥 生成微博博文 | `weibo:generate-post` | prompt | 根据话题生成单条微博（支持多种类型） |
| 📊 更新热榜 | `weibo:update-trending` | manual | 根据叙事生成热搜话题 |
| 💬 生成评论 | `weibo:generate-comments` | prompt | 为微博生成评论 |
| 📝 批量生成博文 | `weibo:batch-posts` | manual | 一次生成多条微博（支持混合类型） |
| 💬 生成博文互动 | `weibo:generate-engagement` | prompt | 为博文生成评论、点赞、转发 |
| 👤 生成用户资料 | `weibo:generate-user` | prompt | 生成虚拟用户画像 |
| 🔥 完整热点生成 | `weibo:complete-hot-topic` | manual | 一次性生成热搜+博文+评论+转发（Phase 5） |
| 🔗 热点内容流水线 | `weibo:hot-topic-pipeline` | chain | 完整的热点内容生成流程（默认隐藏） |

### 完整热点生成任务（Phase 5）

`weibo:complete-hot-topic` 使用解析器分发架构，一次性生成复合内容：

```json
{
  "hotSearches": [...],  // 热搜话题
  "posts": [...],        // 相关博文（带 tempId）
  "comments": [...],     // 评论（引用 post tempId）
  "reposts": [...]       // 转发（引用 post tempId）
}
```

系统会使用 `ContentDispatcher` 分发给不同的解析器处理：

* `HotSearchParser`: 处理热搜话题
* `PostParser`: 处理博文，返回 postId 映射
* `CommentParser`: 处理评论，使用 postId 映射关联
* `RepostParser`: 处理转发，使用 postId 映射关联

## 系统提示词集成

### 架构说明

微博 App 的所有 LLM 请求现在都会自动注入全局和 App 级系统提示词：

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

---

详细文档请参阅各分页。
