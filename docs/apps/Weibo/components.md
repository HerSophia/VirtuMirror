# 组件说明

## 页面视图 (Views)

### WeiboApp.vue

主入口组件，负责：

* **状态维护**: `currentTab`（首页/视频/发现/消息/我）、`viewMode`（主页/设置/任务管理/用户博文/详情等）。
* **弹窗管理**: 统一管理创建账号、编辑资料、粉丝数修改、认证、草稿箱、发布等弹窗。
* **初始化**: 挂载时初始化账号系统、注册 LLM 扩展、初始化内置任务和叙事订阅。
* **叙事分析控制**: 监听 `autoNarrativeAnalysisEnabled` 开关，控制自动内容生成。

**初始化流程**:

```typescript
onMounted(async () => {
  // 1. 确保账号系统已初始化
  if (!accountStore.isInitialized) {
    await accountStore.initialize('玩家', defaultContext);
  }
  
  // 2. 注册微博 LLM 任务扩展到系统服务
  registerWeiboLLMExtensions();
  
  // 3. 初始化内置任务实例
  await llmTaskStore.initializeBuiltinTasks();
  
  // 4. 初始化用户行为 store
  userActionStore.initialize(playerAccount.id);
  
  // 5. 按需启动叙事订阅
  if (llmTaskStore.autoNarrativeAnalysisEnabled) {
    startSubscription();
  }
});
```

### WeiboHome.vue

首页信息流 (Feed)。

* **数据加载**: 挂载时调用 `feedStore.refreshFeed()`。
* **渲染**: 使用 `DisplayPost` 类型渲染博文列表。
* **批量生成**: 顶部提供"生成博文"按钮，触发 `weibo:batch-posts` 任务。
* **博文类型**: 根据 `primaryType` 自动选择渲染组件（投票/视频/转发/普通）。

### WeiboHot.vue

发现页/热搜榜。

* **分类标签**: 我的、热搜、文娱、生活、社会等。
* **动态 Banner**: 根据分类显示不同的渐变色和图标。
* **热度可视化**: 展示热度数值和标签（新/爆/热/沸）。
* **生成热搜**: 提供手动触发 `weibo:update-trending` 任务的入口。

### WeiboProfile.vue

"我的"个人主页。

* **账号检测**: 自动检测玩家是否有微博账号，无账号时显示创建引导。
* **资料展示**: 头像、昵称、简介、粉丝数、认证标识、画像信息。
* **交互入口**: 编辑资料、粉丝数修改、设置入口。
* **数据统计**: 显示微博数、收藏数、点赞数、浏览历史数。

### WeiboUserPosts.vue

用户博文列表页。

* **路由**: 从个人主页点击"微博"进入。
* **数据加载**: 调用 `feedStore.getDisplayPostsByAuthor(authorId)`。
* **展示**: 使用 `DisplayPost` 类型渲染用户发布的所有博文。

### WeiboFavorites.vue

收藏列表页。

* **数据来源**: `userActionStore.getFavoritedPostIds` + `feedStore.getDisplayPostById()`。
* **功能**: 展示所有收藏的博文，支持取消收藏。

### WeiboLikes.vue

点赞列表页。

* **数据来源**: `userActionStore.getLikedPostIds()` + `feedStore.getDisplayPostById()`。
* **功能**: 展示所有点赞的博文。

### WeiboHistory.vue

浏览历史页。

* **数据来源**: `userActionStore.getViewHistoryPostIds()`。
* **功能**: 展示浏览历史，支持清空。

### WeiboSettings.vue

设置页面。

* **自动叙事分析**: 开关控制是否自动分析酒馆消息。
* **自动内容生成**: 控制空首页填充和评论自动生成。
* **LLM 请求管理**: 查看和取消进行中的请求。
* **账号切换**: 在不同角色卡或身份间切换。
* **缓存清理**: 清除博文、热搜缓存。
* **任务管理入口**: 跳转到 LLMTaskManager。

### LLMTaskManager.vue

LLM 任务管理中心。

* **任务列表**: 查看所有任务状态、进度和日志。
* **任务详情**: 编辑任务配置、查看提示词预览、重试失败任务。
* **创建任务**: 支持从模板创建或完全自定义。
* **自动执行**: 配置定时循环执行任务。
* **内置任务**: 显示 7 个预配置任务，支持一键执行。

### WeiboPostDetail.vue

博文详情页。

* **路由**: 点击博文卡片进入。
* **评论加载**: 进入页面时自动加载评论，不足时可触发自动生成（需开启配置）。
* **互动功能**: 点赞、收藏、评论、转发。
* **博文类型**: 根据 `primaryType` 渲染对应内容（投票/视频/转发）。
* **浏览历史**: 自动记录到 `userActionStore`。

### WeiboMessage.vue

消息页面。

* **消息类型**: @我、评论、点赞、通知、私信。
* **布局**: 网格图标 + 消息列表。

## 核心组件 (Components)

### WeiboPost.vue

单条博文展示组件。

* **Props**: 接收 `DisplayPost` 类型数据。
* **功能**: 展示用户信息、博文内容（支持话题高亮）、媒体内容、互动数据（转评赞）。
* **类型判断**: 使用 `usePostDisplay` composable，根据 `primaryType` 决定渲染投票/视频/转发/普通内容。
* **交互**: 点击跳转详情页，点击关注/点赞/收藏。
* **操作菜单**: 长按显示 `PostActionSheet`。

### WeiboPoll.vue

投票帖展示组件。

* **Props**: `poll: PollPayload`
***功能**:
  * 显示投票问题和选项
  * 支持单选/多选投票交互
  * 显示投票进度条和百分比
  * 显示剩余时间
  * 投票后显示结果

### WeiboVideo.vue

视频帖展示组件。

* **Props**: `video: VideoPayload`, `text?: string`
* **功能**:
  * 显示视频封面占位符
  * 显示视频时长
  * 显示视频描述
  * 播放按钮（模拟）

### WeiboRepostn
转发帖展示组件。

* **Props**: `repost: RepostSnapshot`
* **功能**:
  * 显示转发评论
  * 显示原文卡片（包含原作者、原内容）
  * 点击原文卡片跳转原博文详情

### PostActionSheet.vue

博文操作菜单。

* **触发**: 长按博文卡片。
* **功能**:
  * 复制内容
  * 收藏/取消收藏
  * 删除（仅自己的博文）
  * 编辑（仅自己的博文）
  * 生成评论
  * 举报

### ComposePostDialog.vue

发布博文对话框。

* **功能**:
  * 支持三种博文类型切换（文字/投票/视频）
  * 正文编辑，支持 AI 扩展
  * 图片描述添加，支持 AI 扩展
  * 话题标签添加
  * 投票问题和选项设置
  *视频描述设置
  * 保存草稿
  * 发布到微博

### DraftsDialog.vue

草稿箱对话框。

* **功能**:
  * 显示所有草稿列表
  * 点击草稿加载到发布对话框
  * 删除单个草稿
  * 清空所有草稿

### CreateAccountDialog.vue

创建账号对话框（薄封装）。

* **实现**: 封装公共组件 `src/components/common/CreateAccountDialog.vue`
* **配置**:
  * `platformId="weibo"`
  * `themeColor="#E6162D"`
  * `defaultScope="character"`
* **功能**:
  * 随机生成资料（调用 UserPool）
  * 基础信息填写
  * 高级设置（职业、所在地、兴趣领域）
  * 头像选择

### EditProfileDialog.vue

资料编辑对话框。

* **Tab 1 - 基本信息**:
  * 头像选择（6个预设）
  * 昵称、标语、微博号
  * 性别、生日、简介
* **Tab 2 - 详细画像**:
  * 职业、所在地、年龄段
  * 兴趣领域（多选，最多5个）
  * 个性标签（自定义，最多5个）

### EditFollowersDialog.vue

粉丝数修改对话框。

* **功能**:
  * 快捷选项：1K、1W、10W、100W、1000W
  * 自定义输入
  * 实时预览格式化显示

### VerificationDialog.vue

账号认证对话框。

* **认证类型**（11种）:
  * 个人认证：名人、博主、专业人士、作家、艺术家
  * 机构认证：企业、媒体、政务、校园、公益
  * 特殊认证：超话主持人
* **功能**:
  * 选择认证类型
  * 填写认证描述
  * 预览认证效果

## Composables

### usePostDisplay

博文展示逻辑组合式函数（Phase 3）。

```typescript
import { usePostDisplay } from '@/apps/weibo/composables';

const props = defineProps<{ post: DisplayPost }>();

const { 
  primaryType,       // 主类型
  content,           // 正文内容
  formattedContent,  // 带话题高亮的 HTML
  poll,              // 投票数据
  video,             // 视频数据
  repost,            // 转发快照
  isPoll,            // 是否是投票帖
  isVideo,           // 是否是视频帖
  isRepost,          // 是否是转发帖
} = usePostDisplay(toRef(props, 'post'));
```

### useNarrativeSubscription

叙事订阅组合式函数。

```typescript
import { useNarrativeSubscription } from '@/apps/weibo/composables';

const { 
  isSubscribed,      // 是否已订阅
  isProcessing,      // 是否正在处理
  startSubscription, // 启动订阅
  stopSubscription,  // 停止订阅
} = useNarrativeSubscription();

// 在组件挂载时订阅
onMounted(() => {
  if (shouldAutoAnalyze) {
    startSubscription();
  }
});

// 在组件卸载时取消订阅
onUnmounted(() => {
  stopSubscription();
});
```
