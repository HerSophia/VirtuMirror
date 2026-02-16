# 与 LLM 集成

> 本文档说明如何在 LLM 任务中使用 Context Sharing Service 聚合上下文。

## 1. 概述

Context Sharing Service 的核心价值之一是为 LLM 任务提供丰富的上下文信息。通过聚合功能，可以将多个来源的上下文合并为格式化的提示词内容。

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                            LLM 任务执行流程                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌───────────┐    ┌───────────────────┐    ┌───────────────────┐       │
│   │ App 发起  │ -> │ Context Sharing   │ -> │   LLM Task        │       │
│   │ LLM 任务  │    │ 聚合上下文        │    │   执行生成        │       │
│   └───────────┘    └───────────────────┘    └───────────────────┘       │
│                              │                                           │
│                              ▼                                           │
│                    ┌─────────────────────┐                              │
│                    │ 格式化的上下文       │                              │
│                    │ (XML/Markdown/Text) │                              │
│                    └─────────────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 基本用法

### 2.1 在 LLM 任务中聚合上下文

```typescript
import { contextSharingService } from '@/services/contextSharing';
import { AIGenerateService } from '@/services/aiGenerateService';

async function generateWeiboPost() {
  // 1. 聚合上下文
  const aggregated = await contextSharingService.aggregate({
    requesterId: 'weibo',
    types: [
      'narrative:content',     // 酒馆叙事
      'social:trending',       // 热搜
      'user:currentAccount',   // 当前账号
    ],
    format: 'xml',
    maxTokens: 1500,
  });
  
  // 2. 构建系统提示词
  const systemPrompt = `你是一个社交媒体内容生成助手。

以下是当前的上下文信息：

${aggregated.formatted}

请根据以上上下文，生成一条符合角色人设的微博帖子。`;
  
  // 3. 调用 LLM
  const result = await AIGenerateService.generate({
    systemPrompt,
    userPrompt: '请生成帖子',
    options: { temperature: 0.7 },
  });
  
  return result;
}
```

### 2.2 使用 ContextProvider 扩展点

```typescript
import { contextSharingService } from '@/services/contextSharing';
import type { ContextProvider } from '@/services/llmTask';

/**
 * 跨应用上下文提供器
 */
export const crossAppContextProvider: ContextProvider = {
  id: 'cross-app-context',
  appId: 'system',
  name: '跨应用上下文',
  description: '聚合多个 App 发布的上下文',
  
  async getContext(options) {
    const { appId, taskId } = options;
    
    // 根据任务类型决定需要哪些上下文
    const types = getRequiredContextTypes(appId, taskId);
    
    const aggregated = await contextSharingService.aggregate({
      requesterId: appId,
      types,
      format: 'xml',
      maxTokens: 1500,
    });
    
    return {
      crossAppContext: aggregated.formatted || '',
      contextMeta: {
        types: aggregated.meta.types,
        truncated: aggregated.meta.truncated,
      },
    };
  },
};

function getRequiredContextTypes(appId: string, taskId: string): ContextType[] {
  // 微博的博文生成任务
  if (appId === 'weibo' && taskId.includes('generate')) {
    return [
      'narrative:content',
      'social:trending',
      'user:currentAccount',
    ];
  }
  
  // 论坛的帖子生成任务
  if (appId === 'forum') {
    return [
      'narrative:content',
      'social:hotTopics',
    ];
  }
  
  // 默认
  return ['narrative:content'];
}
```

---

## 3. 格式化选项

### 3.1 XML 格式

推荐用于 LLM，结构清晰，易于解析。

```typescript
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: ['narrative:content', 'social:trending'],
  format: 'xml',
});
```

输出示例：

```xml
<context type="narrative:content">
  <item id="narrative:current" description="当前酒馆叙事内容">
    六月五日的阳光透过酒店厚重的遮光窗帘缝隙，在地毯上切出一道细长的亮斑...
  </item>
</context>
<context type="social:trending">
  <item id="weibo:trending" description="微博热搜榜">
    [{"rank":1,"title":"热搜话题1","heat":1000000},{"rank":2,"title":"热搜话题2","heat":800000}]
  </item>
</context>
```

### 3.2 Markdown 格式

适合需要人类可读的场景。

```typescript
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: ['narrative:content', 'social:trending'],
  format: 'markdown',
});
```

输出示例：

```markdown
## narrative:content

### 当前酒馆叙事内容

```text

"六月五日的阳光透过酒店厚重的遮光窗帘缝隙..."

```

## social:trending

### 微博热搜榜

```json

[{"rank":1,"title":"热搜话题1"},...]

```
```

### 3.3 Text 格式

最简洁的格式，适合 token 紧张的场景。

```typescript
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: ['narrative:content', 'social:trending'],
  format: 'text',
});
```

输出示例：

```text
[narrative:content]
- 当前酒馆叙事内容: 六月五日的阳光透过酒店厚重的遮光窗帘缝隙...

[social:trending]
- 微博热搜榜: [{"rank":1,"title":"热搜话题1"},...]
```

---

## 4. Token 管理

### 4.1 设置 Token 限制

```typescript
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: [
    'narrative:content',
    'social:trending',
    'chat:recentHistory',
    'archive:pinned',
  ],
  format: 'xml',
  maxTokens: 2000,  // 限制最大 token 数
  priority: ['narrative:content', 'social:trending'],  // 优先保留
});

if (aggregated.meta.truncated) {
  console.warn('上下文被截断，实际 tokens:', aggregated.meta.estimatedTokens);
}
```

### 4.2 优先级排序

当 token 有限时，优先级高的上下文会优先保留：

```typescript
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: [
    'narrative:content',
    'social:trending',
    'chat:recentHistory',
    'archive:pinned',
    'user:recentActions',
  ],
  format: 'xml',
  maxTokens: 1500,
  priority: [
    'narrative:content',  // 最重要
    'social:trending',    // 次重要
    // 其他按默认顺序
  ],
});
```

---

## 5. 实战示例

### 5.1 微博博文生成

```typescript
import { contextSharingService } from '@/services/contextSharing';
import { llmTaskService } from '@/services/llmTask';

// 注册 LLM 任务
llmTaskService.registerTask({
  id: 'weibo:generate-post',
  appId: 'weibo',
  name: '生成微博帖子',
  
  // 上下文提供器
  contextProviders: ['cross-app-context'],
  
  // 提示词模板
  promptTemplate: `你是一个社交媒体内容生成助手。

{{crossAppContext}}

请根据以上上下文，为角色 {{characterName}} 生成一条微博帖子。

要求：
1. 符合角色人设
2. 内容自然，不生硬
3. 可以参考热搜话题，但不强制
`,
  
  // 输出处理
  outputHandler: async (result) => {
    const post = parsePost(result);
    await weiboStore.addPost(post);
  },
});
```

### 5.2 论坛帖子生成

```typescript
import { contextSharingService } from '@/services/contextSharing';

async function generateForumPost(topic: string) {
  // 聚合相关上下文
  const aggregated = await contextSharingService.aggregate({
    requesterId: 'forum',
    types: [
      'narrative:content',
      'social:hotTopics',
      'archive:relevant',
    ],
    format: 'xml',
    maxTokens: 2000,
  });
  
  const systemPrompt = `你是一个论坛帖子生成助手。

${aggregated.formatted}

请根据以上上下文，围绕话题「${topic}」生成一篇论坛帖子。`;
  
  // 调用 LLM 生成
  const result = await AIGenerateService.generate({
    systemPrompt,
    userPrompt: `话题：${topic}`,
  });
  
  return result;
}
```

### 5.3 智能回复生成

```typescript
import { contextSharingService } from '@/services/contextSharing';

async function generateReply(postId: string, postContent: string) {
  // 聚合上下文
  const aggregated = await contextSharingService.aggregate({
    requesterId: 'weibo',
    types: [
      'user:currentAccount',
      'chat:recentHistory',
    ],
    format: 'text',
    maxTokens: 500,
  });
  
  const systemPrompt = `你是一个社交媒体回复助手。

${aggregated.formatted}

以下是需要回复的帖子：
${postContent}

请生成一条自然、友好的回复。`;
  
  const result = await AIGenerateService.generate({
    systemPrompt,
    userPrompt: '请生成回复',
    options: { temperature: 0.8 },
  });
  
  return result;
}
```

---

## 6. 最佳实践

### 6.1 选择合适的上下文类型

| 任务类型 | 推荐上下文 |
| ---------- | ------------ |
| 博文生成 | `narrative:content`, `social:trending`, `user:currentAccount` |
| 评论生成 | `chat:recentHistory`, `user:currentAccount` |
| 私信生成 | `narrative:content`, `chat:participants`, `user:currentAccount` |
| 论坛帖子 | `narrative:content`, `social:hotTopics`, `archive:relevant` |

### 6.2 控制 Token 使用

```typescript
// 1. 设置合理的 maxTokens
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: [...],
  maxTokens: 1500,  // 留出空间给其他提示词内容
});

// 2. 使用优先级确保重要上下文不被截断
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: [...],
  maxTokens: 1500,
  priority: ['narrative:content'],  // 叙事最重要
});

// 3. 检查是否被截断
if (aggregated.meta.truncated) {
  // 可以记录日志或调整策略
  console.warn('上下文被截断');
}
```

### 6.3 缓存上下文

对于频繁使用的上下文，使用缓存减少计算：

```typescript
// 发布时设置缓存
contextSharingService.publish({
  id: 'narrative:current',
  type: 'narrative:content',
  description: '当前叙事',
  getter: async () => await narrativeService.getCurrent(),
  cache: {
    ttl: 30 * 1000,  // 30 秒缓存
    staleWhileRevalidate: true,  // 过期时仍返回旧值
  },
});
```

---

## 7. 与 LLM Task Service 的关系

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          LLM Task Service                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ Task Definition │    │ Context         │    │ Output          │      │
│  │ (任务定义)       │    │ Providers       │    │ Handlers        │      │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘      │
│           │                      │                      │                │
│           │                      ▼                      │                │
│           │           ┌─────────────────────┐           │                │
│           │           │ Context Sharing     │           │                │
│           │           │ Service             │           │                │
│           │           │ (上下文聚合)         │           │                │
│           │           └─────────────────────┘           │                │
│           │                      │                      │                │
│           └──────────────────────┼──────────────────────┘                │
│                                  ▼                                       │
│                        ┌─────────────────────┐                          │
│                        │ Prompt Builder      │                          │
│                        │ (提示词构建)         │                          │
│                        └─────────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**集成方式**：

1. **ContextProvider**：LLM Task 通过 ContextProvider 获取 Context Sharing 的聚合结果
2. **变量注入**：聚合的上下文作为变量注入到提示词模板
3. **自动同步**：当上下文变化时，相关任务可以自动更新
