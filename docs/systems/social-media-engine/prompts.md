# Social Engine Prompts 社交引擎提示词

> **版本**: 1.0
> **状态**: ✅ 已实现
> **代码位置**: `src/services/social/prompts.ts`
> **注册 App ID**: `social-engine`

## 1. 概述

社交引擎提示词是一组预定义的 LLM 提示词模板，用于生成世界事件、博文内容、评论和用户画像。这些提示词由 `PlatformRegistry` 在初始化时自动注册到 `PromptService`。

### 1.1 提示词列表

| 场景 ID | 名称 | 用途 |
|---------|------|------|
| `social.event.generate` | 生成世界事件 | DirectorService 调用 |
| `social.post.generate` | 生成社交博文 | ContentFactory 调用 |
| `social.comment.batch` | 批量生成评论 | ContentFactory 调用 |
| `social.user.generate` | 生成虚拟用户 | UserPool 扩展用 |

---

## 2. 提示词详解

### 2.1 social.event.generate

**用途**: 生成世界事件/热搜话题

**调用者**: `DirectorService.generateGlobalEvent()`

#### System Prompt

```text
你是一个虚拟世界的"导演"，负责生成引人注目的突发新闻、科技突破、娱乐八卦或社会热点。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "keyword": "话题关键词(如 #某事发生#)",
  "summary": "事件简述(50字以内)",
  "baseScore": 60-100之间的整数(表示初始热度),
  "category": "tech/entertainment/society/daily"
}
```

#### User Prompt Template

```handlebars
当前世界时间：{{timeContext}}
请生成一个{{eventType}}类型的突发事件。
要求：
1. 事件应具有{{intensity}}的轰动性。
2. 关键词要符合社交媒体热搜风格（简短有力）。
3. 事件内容不要与现实世界完全挂钩，保持虚构感。
```

#### 可用变量

| 变量名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `timeContext` | `string` | ✅ | - | 当前世界时间字符串 |
| `eventType` | `string` | ❌ | `'随机'` | 事件类型 |
| `intensity` | `string` | ❌ | `'中'` | 轰动程度 |

#### 输出示例

```json
{
  "keyword": "#全息手机发布#",
  "summary": "某科技巨头今日召开发布会，推出全球首款消费级全息投影手机",
  "baseScore": 85,
  "category": "tech"
}
```

---

### 2.2 social.post.generate

**用途**: 生成平台风格的博文内容

**调用者**: `ContentFactory.generatePost()`

#### System Prompt

```text
你是一个精通社交媒体运营的内容创作者。请根据指定的平台风格生成博文。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "content": "博文正文",
  "tags": ["tag1", "tag2"],
  "imagePrompt": "用于生成配图的英文提示词(可选)"
}
```

#### User Prompt Template

```handlebars
平台：{{platformName}}
平台文化：{{platformCulture}}
当前话题：{{topic}}
作者身份：{{authorIdentity}}

请生成一条符合上述要求的博文。
要求：
1. 语气口吻必须符合{{platformName}}的用户习惯。
2. {{platformName}}的典型特征：{{platformCulture}}。
3. 字数控制在{{length}}字以内。
4. 内容要有互动性，能引发讨论。
```

#### 可用变量

| 变量名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `platformName` | `string` | ✅ | - | 平台名称 |
| `platformCulture` | `string` | ✅ | - | 平台文化描述 |
| `topic` | `string` | ✅ | - | 关联话题 |
| `authorIdentity` | `string` | ❌ | `'普通路人'` | 作者身份描述 |
| `length` | `number` | ❌ | `140` | 字数限制 |

#### 输出示例

```json
{
  "content": "刚看完发布会直播，这全息手机也太酷了吧！虽然价格有点离谱但是我已经开始存钱了 😭 有没有一起的家人们",
  "tags": ["全息手机", "科技", "剁手"],
  "imagePrompt": "holographic phone display, futuristic technology, product showcase"
}
```

---

### 2.3 social.comment.batch

**用途**: 批量生成多样化评论

**调用者**: `ContentFactory.generateComments()`

#### System Prompt

```text
你是一个社交媒体评论生成器。请模拟真实网友的反应，生成多样化的评论。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
[
  {
    "content": "评论内容",
    "persona": "评论者人设简述(如：杠精/粉丝/路人)",
    "sentiment": "positive/neutral/negative"
  },
  ...
]
```

#### User Prompt Template

```handlebars
平台：{{platformName}}
博文内容：
"""
{{postContent}}
"""

请生成 {{count}} 条评论。
要求：
1. 混合不同的立场（支持、反对、调侃、无关）。
2. 模拟真实口语，包含网络流行语。
3. 针对{{platformName}}风格进行调整。
```

#### 可用变量

| 变量名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `platformName` | `string` | ✅ | - | 平台名称 |
| `postContent` | `string` | ✅ | - | 原博文内容 |
| `count` | `number` | ❌ | `5` | 生成数量 |

#### 输出示例

```json
[
  {
    "content": "已经预约了，冲冲冲！",
    "persona": "数码爱好者",
    "sentiment": "positive"
  },
  {
    "content": "就这？上个月发布会都预热过了，没啥新意",
    "persona": "杠精",
    "sentiment": "negative"
  },
  {
    "content": "路过看看，不明觉厉",
    "persona": "路人",
    "sentiment": "neutral"
  }
]
```

---

### 2.4 social.user.generate

**用途**: 生成虚拟用户画像

**调用者**: 可由 `UserPool` 或其他服务扩展使用

#### System Prompt

```text
你是一个虚拟角色设计师。请生成一个生动立体的社交媒体用户画像。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "nickname": "昵称",
  "handle": "唯一ID(英文数字)",
  "bio": "个人简介",
  "tags": ["标签1", "标签2"]
}
```

#### User Prompt Template

```handlebars
请为{{platformName}}生成一个用户画像。
上下文线索：{{context}}
要求：
1. 昵称要符合平台风格。
2. 简介要体现性格特点。
```

#### 可用变量

| 变量名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `platformName` | `string` | ✅ | - | 平台名称 |
| `context` | `string` | ❌ | `'随机路人'` | 生成上下文 |

#### 输出示例

```json
{
  "nickname": "科技小白兔",
  "handle": "tech_bunny_2024",
  "bio": "数码爱好者 | 喜欢尝鲜各种新玩意 | 偶尔分享开箱",
  "tags": ["数码", "科技", "开箱"]
}
```

---

## 3. 扩展指南

### 3.1 添加平台特定提示词

各 App 可以注册平台特定的提示词覆盖通用版本：

```typescript
// src/apps/weibo/prompts.ts

import { PromptService } from '@/services/promptService';

const weiboPrompts = [
  {
    scene: 'social.post.generate.weibo',
    name: '微博博文生成',
    description: '微博风格的博文生成',
    category: 'weibo',
    systemPrompt: `你是一个微博大V...(更细致的微博风格描述)`,
    template: `...`,
    availableVariables: [...]
  }
];

export function registerWeiboPrompts() {
  PromptService.registerAppPrompts('weibo', weiboPrompts);
}
```

### 3.2 提示词优先级

`ContentFactory` 查找提示词的优先级：

```text
1. social.post.generate.{platformId}  (平台特定)
2. social.post.generate               (通用)
3. 硬编码 fallback                    (代码内置)
```

---

## 4. 使用注意事项

### 4.1 JSON 输出要求

所有提示词都在 System Prompt 中强调：

> 请输出纯 JSON 格式，不要包含 Markdown 代码块标记。

这是因为 LLM 经常输出 `` ```json ... ``` `` 格式，`ContentFactory.parseAndRepairJSON()` 会尝试清理这些标记。

### 4.2 变量默认值

非必填变量都有默认值，调用方可以只传必填参数：

```typescript
PromptService.renderPrompt(prompt, {
  platformName: '微博',
  platformCulture: '吃瓜、短平快',
  topic: '#某话题#'
  // authorIdentity 和 length 使用默认值
});
```

---

## 5. 相关服务

| 服务 | 文档 | 说明 |
|------|------|------|
| **PlatformRegistry** | [platform-registry.md](./platform-registry.md) | 注册这些提示词 |
| **ContentFactory** | [content-factory.md](./content-factory.md) | 使用 post/comment 提示词 |
| **DirectorService** | [director-service.md](./director-service.md) | 使用 event 提示词 |
| **PromptService** | [../prompt-service/](../prompt-service/) | 提示词管理服务 |

---

## 6. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 2026-01-16 | 初始文档，基于代码实现整理 |
