# 提示词系统

## 1. 分层提示词架构

社交引擎采用**分层提示词架构**，让不同层级的提示词各司其职：

```text
┌─────────────────────────────────────────────────────────────┐
│                      最终系统提示词                           │
├─────────────────────────────────────────────────────────────┤
│ 1. 全局系统提示词 (scope: 'global')                          │
│    - 角色扮演基本规则                                         │
│    - 故事世界观设定                                           │
├─────────────────────────────────────────────────────────────┤
│ 2. 引擎级提示词 (appId: 'social-engine')                     │
│    - 社交媒体模拟通用规则                                      │
│    - 世界事件生成模板                                         │
├─────────────────────────────────────────────────────────────┤
│ 3. App 级系统提示词 (appId: 'weibo' 等)                       │
│    - 平台特定规则和文风                                        │
│    - 语言风格约束                                             │
├─────────────────────────────────────────────────────────────┤
│ 4. 任务/提示词自带的 systemPrompt                            │
│    - 具体任务的指令                                           │
└─────────────────────────────────────────────────────────────┘
```

## 2. 引擎级提示词

注册在 `social-engine` 下的通用提示词（定义在 `src/services/social/prompts.ts`）：

| 场景 ID | 名称 | 描述 | 主要变量 |
| ------- | ---- | ---- | -------- |
| `social.event.generate` | 生成世界事件 | 生成突发新闻或社会热点 | `timeContext`, `eventType`, `intensity` |
| `social.post.generate` | 生成社交博文(通用) | 根据话题生成指定平台的博文 | `platformName`, `platformCulture`, `topic`, `authorIdentity`, `length` |
| `social.comment.batch` | 批量生成评论(通用) | 生成多条不同立场的评论 | `platformName`, `postContent`, `count` |
| `social.user.generate` | 生成虚拟用户(通用) | 生成用户画像 | `platformName`, `context` |

### 2.1 世界事件生成

```typescript
const eventGeneratePrompt: PromptDefinition = {
  id: 'social.event.generate',
  scene: 'social.event.generate',
  appId: 'social-engine',
  name: '生成世界事件',
  systemPrompt: `你是一个虚拟世界的新闻编辑。
根据当前时间和背景，生成一个突发事件或热点话题。

要求：
1. 事件要有新闻价值
2. 符合给定的时间背景
3. 有话题讨论空间

输出 JSON 格式：
{
  "title": "事件标题",
  "summary": "事件概述",
  "category": "entertainment|tech|sports|society|finance",
  "intensity": 1-100,
  "keywords": ["关键词1", "关键词2"]
}`,
  userPromptTemplate: `当前时间：{{timeContext}}
事件类型偏好：{{eventType}}
热度强度：{{intensity}}`,
};
```

### 2.2 博文生成（通用）

```typescript
const postGeneratePrompt: PromptDefinition = {
  id: 'social.post.generate',
  scene: 'social.post.generate',
  appId: 'social-engine',
  name: '生成社交博文（通用）',
  systemPrompt: `你是{{platformName}}的资深用户。

平台文化：{{platformCulture}}

请根据话题生成一条博文，要求：
1. 符合平台用语习惯
2. 自然真实，像真人发帖
3. 可以有 emoji 和话题标签

输出 JSON 格式：
{
  "primaryType": "text|gallery|poll|video",
  "payload": {
    "text": "博文正文"
  },
  "media": [],
  "authorName": "作者昵称"
}`,
  userPromptTemplate: `话题：{{topic}}`,
};
```

### 2.3 评论批量生成

```typescript
const commentBatchPrompt: PromptDefinition = {
  id: 'social.comment.batch',
  scene: 'social.comment.batch',
  appId: 'social-engine',
  name: '批量生成评论',
  systemPrompt: `你是{{platformName}}的多个普通用户。

请为下面的内容生成 {{count}} 条评论，要求：
1. 每条评论来自不同用户
2. 观点多样（支持/反对/中立/调侃）
3. 长度和风格各异
4. 符合平台用语习惯

输出 JSON 数组：
[
  {
    "content": "评论内容",
    "nickname": "评论者昵称",
    "stance": "support|oppose|neutral|joke"
  }
]`,
  userPromptTemplate: `原帖内容：
{{postContent}}`,
};
```

## 3. App 级提示词

各 App 可以定义平台专用的提示词，会**覆盖**同 scene 的通用提示词：

### 3.1 微博专用博文生成

```typescript
// src/apps/weibo/prompts.ts
const weiboPostPrompt: PromptDefinition = {
  id: 'social.post.generate.weibo',
  scene: 'social.post.generate',  // 同一 scene
  appId: 'weibo',                 // 但 appId 不同
  name: '生成微博博文',
  systemPrompt: `你是一个微博资深用户。

请输出纯 JSON 格式，结构如下：

【文字/图文帖】
{
  "primaryType": "text" 或 "gallery"(4张图以上),
  "payload": {
    "text": "博文正文(含emoji和话题)"
  },
  "media": [
    {
      "id": "img_0",
      "type": "image",
      "description": "图片描述",
      "order": 0
    }
  ],
  "authorName": "作者昵称"
}

【投票帖】
{
  "primaryType": "poll",
  "payload": {
    "text": "投票引导文案",
    "poll": {
      "question": "投票问题",
      "options": [
        {"id": "opt_0", "text": "选项1", "votes": 0}
      ],
      "duration": 24,
      "multiSelect": false
    }
  },
  "authorName": "作者昵称"
}

【视频帖】
{
  "primaryType": "video",
  "payload": {
    "text": "视频介绍文案"
  },
  "media": [
    {
      "id": "video_0",
      "type": "video",
      "description": "视频内容描述",
      "coverDescription": "封面画面描述",
      "duration": 60
    }
  ],
  "authorName": "作者昵称"
}`,
  userPromptTemplate: `话题：{{topic}}`,
};
```

### 3.2 提示词优先级

当调用 `social.post.generate` 时：

1. 先查找 `social.post.generate.weibo`（App 专用）
2. 找不到则使用 `social.post.generate`（通用）

```typescript
// ContentFactory 内部逻辑
async generatePost(platformId: string, topic: string) {
  // 优先使用平台专用提示词
  let prompt = promptService.getPrompt(`social.post.generate.${platformId}`);
  
  if (!prompt) {
    // 回退到通用提示词
    prompt = promptService.getPrompt('social.post.generate');
  }
  
  // ...
}
```

## 4. 变量系统

### 4.1 内置变量

| 变量 | 来源 | 说明 |
| ---- | ---- | ---- |
| `{{timeContext}}` | TimeService | 当前游戏内时间 |
| `{{platformName}}` | PlatformRegistry | 平台名称 |
| `{{platformCulture}}` | PlatformRegistry | 平台文化描述 |
| `{{narrative}}` | NarrativeService | 酒馆叙事内容 |
| `{{existingContent}}` | FeedStore | 已有内容（去重用） |

### 4.2 任务变量

任务可以定义自己的变量：

```typescript
const task: LLMTask = {
  id: 'weibo-batch-posts',
  variables: {
    topic: '#今日热点#',
    count: 5,
    style: 'casual',
  },
  prompt: `生成 {{count}} 条关于 {{topic}} 的微博，风格：{{style}}`,
};
```

### 4.3 叙事变量注入

`{{narrative}}` 变量会自动注入酒馆的叙事内容：

```typescript
// llmTaskStore 内部
async executeTask(task: LLMTask) {
  let prompt = task.prompt;
  
  // 检查是否需要叙事
  if (prompt.includes('{{narrative}}')) {
    const narrative = await narrativeService.getCurrentNarrative();
    prompt = prompt.replace('{{narrative}}', narrative);
  }
  
  // ...
}
```

**防重复机制**：系统会检测 systemPrompt 中是否已包含叙事内容，避免重复注入。

## 5. 提示词注册

### 5.1 引擎提示词注册

`PlatformRegistry` 初始化时自动注册：

```typescript
// src/services/social/registry.ts
class PlatformRegistry {
  private static instance: PlatformRegistry;
  
  private constructor() {
    // 注册引擎级提示词
    promptService.registerPrompts('social-engine', socialEnginePrompts);
  }
}
```

### 5.2 App 提示词注册

各 App 在 manifest 中注册：

```typescript
// src/apps/weibo/manifest.ts
export const weiboManifest: AppManifest = {
  id: 'weibo',
  name: '微博',
  
  // 提示词注册
  prompts: weiboPrompts,
  
  // 提示词链注册
  chains: weiboChains,
  
  onMount() {
    // 注册提示词
    promptService.registerPrompts('weibo', this.prompts);
    promptChainService.registerAppChains('weibo', this.chains);
  },
};
```

## 6. 自定义与调试

### 6.1 用户自定义

用户可以在「提示词管理」应用中：

* 查看所有已注册的提示词
* 修改提示词模板
* 测试提示词效果
* 导入/导出提示词

### 6.2 修改影响

* 修改后的提示词会**立即生效**
* 影响后续生成的所有内容
* 不会影响已生成的内容

### 6.3 回退机制

如果删除了某个 Prompt，代码中有硬编码的 Fallback 逻辑保证服务可用性：

```typescript
async generatePost(platformId: string, topic: string) {
  const prompt = promptService.getPrompt(`social.post.generate.${platformId}`)
    ?? promptService.getPrompt('social.post.generate')
    ?? FALLBACK_POST_PROMPT;  // 硬编码的最后防线
  
  // ...
}
```

### 6.4 调试输出

执行 LLM 任务时会输出完整提示词到控制台：

```typescript
console.log('[LLM Task] 执行任务:', task.name);
console.log('[LLM Task] 系统提示词:', finalSystemPrompt);
console.log('[LLM Task] 用户提示词:', finalUserPrompt);
```

## 7. 最佳实践

### 7.1 提示词设计原则

1. **结构化输出**：要求 LLM 输出 JSON，便于解析
2. **明确约束**：说明字段要求、长度限制
3. **提供示例**：给出输出格式的完整示例
4. **处理边界**：说明如何处理异常情况

### 7.2 变量命名规范

* 使用驼峰命名：`{{topicName}}`
* 避免与内置变量冲突
* 在 JSDoc 中说明变量用途

### 7.3 提示词测试

```typescript
// 测试提示词输出
const testOutput = await aiService.generate({
  systemPrompt: prompt.systemPrompt,
  userPrompt: '测试话题',
});

// 验证 JSON 格式
const parsed = JSON.parse(testOutput);
assert(parsed.primaryType, '缺少 primaryType');
assert(parsed.payload?.text, '缺少 payload.text');
```
