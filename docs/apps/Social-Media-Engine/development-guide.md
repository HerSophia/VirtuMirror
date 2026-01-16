# 开发指南

## 1. 概述

本文档面向希望扩展社交媒体引擎的开发者，介绍如何：

* 添加新的社交平台（皮肤）
* 自定义内容生成提示词
* 扩展内容类型
* 集成解析器

## 2. 添加新平台

### 2.1 步骤概览

1. 在 `PlatformRegistry` 注册平台配置
2. 定义平台专用提示词
3. 创建 App 目录和组件
4. 实现 Store 层
5. 注册 App Manifest

### 2.2 注册平台配置

```typescript
// src/services/social/platforms/bilibili.ts
import { PlatformRegistry } from '../registry';

export function registerBilibiliPlatform() {
  PlatformRegistry.getInstance().registerPlatform({
    id: 'bilibili',
    name: 'B站',
    culture: '二次元、鬼畜、科技区、学习区，用语活泼，常用 emoji 和颜文字',
    postTypes: ['text', 'video', 'article', 'gallery'],
    verifyTypes: [
      { type: 'personal', label: '个人认证', icon: '✓' },
      { type: 'org', label: '机构认证', icon: '⚡' },
    ],
  });
}
```

### 2.3 定义平台提示词

```typescript
// src/apps/bilibili/prompts.ts
import type { PromptDefinition } from '@/types/prompts';

export const bilibiliPrompts: PromptDefinition[] = [
  {
    id: 'social.post.generate.bilibili',
    scene: 'social.post.generate',
    appId: 'bilibili',
    name: '生成B站动态',
    systemPrompt: `你是一个B站老用户，熟悉B站文化。

请根据话题生成一条动态，要求：
1. 使用B站特有用语（如：awsl、yyds、前方高能）
2. 可以使用颜文字和 emoji
3. 话题通常用 # 包裹

输出 JSON 格式：
{
  "primaryType": "text|video|gallery",
  "payload": {
    "text": "动态正文"
  },
  "media": [],
  "authorName": "UP主昵称"
}`,
    userPromptTemplate: `话题：{{topic}}`,
  },
  {
    id: 'social.comment.batch.bilibili',
    scene: 'social.comment.batch',
    appId: 'bilibili',
    name: '生成B站评论',
    systemPrompt: `你是多个B站用户。

请为以下内容生成 {{count}} 条评论，要求：
1. 使用B站弹幕/评论风格
2. 可以有梗、玩梗
3. 部分评论可以是复读机（重复热门评论的变体）

输出 JSON 数组：
[
  {
    "content": "评论内容",
    "nickname": "用户昵称",
    "isUp": false
  }
]`,
    userPromptTemplate: `原帖内容：
{{postContent}}`,
  },
];
```

### 2.4 创建 App 目录

```text
src/apps/bilibili/
├── BilibiliApp.vue         # 主应用
├── index.ts                # 导出入口
├── manifest.ts             # 应用清单
├── prompts.ts              # 提示词定义
├── chains.ts               # 提示词链（可选）
├── types.ts                # 类型定义
├── components/
│   ├── BilibiliPost.vue    # 动态卡片
│   ├── BilibiliVideo.vue   # 视频卡片
│   └── ...
├── views/
│   ├── BilibiliHome.vue    # 首页
│   ├── BilibiliDynamic.vue # 动态页
│   └── ...
└── stores/
    ├── index.ts
    ├── feedStore.ts
    └── ...
```

### 2.5 实现 App Manifest

```typescript
// src/apps/bilibili/manifest.ts
import type { AppManifest } from '@/types/appPackage';
import { bilibiliPrompts } from './prompts';
import { bilibiliChains } from './chains';
import { registerBilibiliPlatform } from '@/services/social/platforms/bilibili';

export const bilibiliManifest: AppManifest = {
  id: 'bilibili',
  name: 'B站',
  icon: 'bilibili',
  version: '1.0.0',
  description: 'B站动态模拟器',
  
  // 提示词和链
  prompts: bilibiliPrompts,
  chains: bilibiliChains,
  
  // 生命周期
  onMount() {
    // 注册平台
    registerBilibiliPlatform();
    
    // 注册提示词
    promptService.registerPrompts('bilibili', this.prompts);
    
    // 注册提示词链
    if (this.chains) {
      promptChainService.registerAppChains('bilibili', this.chains);
    }
  },
  
  onUnmount() {
    // 清理资源
  },
};
```

### 2.6 注册到 App Store

```typescript
// src/services/appRegistryService.ts
import { bilibiliManifest } from '@/apps/bilibili/manifest';

export const builtinApps: AppManifest[] = [
  weiboManifest,
  bilibiliManifest,  // 添加新平台
  // ...
];
```

## 3. 扩展内容类型

### 3.1 添加新的 PrimaryContentType

```typescript
// src/types/social.ts
type PrimaryContentType =
  | 'text'
  | 'gallery'
  | 'video'
  | 'article'
  | 'poll'
  | 'repost'
  | 'link'
  | 'audio'
  | 'live'
  | 'question'
  | 'answer'
  | 'mixed'
  | 'column';    // 新增：B站专栏
```

### 3.2 更新 ContentFlags

```typescript
interface ContentFlags {
  hasText: boolean;
  hasImages: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  hasPoll: boolean;
  hasLink: boolean;
  hasRepost: boolean;
  hasArticle: boolean;
  hasColumn?: boolean;  // 新增
}
```

### 3.3 创建对应 UI 组件

```vue
<!-- src/apps/bilibili/components/BilibiliColumn.vue -->
<template>
  <div class="bilibili-column">
    <div class="cover">
      <img v-if="post.payload.article?.cover" :src="post.payload.article.cover" />
      <div v-else class="placeholder">{{ post.payload.article?.cover || '专栏封面' }}</div>
    </div>
    <div class="info">
      <h3>{{ post.payload.title }}</h3>
      <p>{{ post.payload.article?.wordCount }} 字 · {{ post.payload.article?.readTime }} 分钟阅读</p>
    </div>
  </div>
</template>
```

## 4. 集成解析器

### 4.1 解析器架构

社交引擎使用解析器分发架构处理 LLM 的复合输出：

```text
LLM 复合输出 → ContentDispatcher → 各解析器 → 数据库
```

### 4.2 创建新解析器

```typescript
// src/apps/bilibili/stores/llm/parsers/videoParser.ts
import type { ContentParser, ParseContext, ValidationResult, PersistResult } from './types';
import type { UniversalPost } from '@/types/social';

export const VideoParser: ContentParser<any, UniversalPost> = {
  key: 'videos',
  aliases: ['videos', 'video', 'bvideo'],
  dependencies: ['users'],
  
  validate(input): ValidationResult {
    const items = Array.isArray(input) ? input : [input];
    const errors: string[] = [];
    
    items.forEach((item, i) => {
      if (!item.title) {
        errors.push(`videos[${i}]: 缺少 title`);
      }
      if (!item.description) {
        errors.push(`videos[${i}]: 缺少 description`);
      }
    });
    
    return { valid: errors.length === 0, errors };
  },
  
  async transform(input, context): Promise<UniversalPost[]> {
    const items = Array.isArray(input) ? input : [input];
    
    return Promise.all(items.map(async (item) => {
      // 处理作者
      const authorName = item.authorName || item.uploader || '未知UP主';
      let authorId = context.resolved.users.get(authorName);
      
      if (!authorId) {
        authorId = await ensureAuthorAccount(context.platformId, authorName);
        context.resolved.users.set(authorName, authorId);
      }
      
      const postId = uuidv4();
      
      return {
        id: postId,
        platformId: context.platformId,
        authorId,
        timestamp: context.timestamp - Math.random() * 3600000,
        primaryType: 'video',
        contentFlags: {
          hasText: true,
          hasImages: false,
          hasVideo: true,
          hasAudio: false,
          hasPoll: false,
          hasLink: false,
          hasRepost: false,
          hasArticle: false,
        },
        media: [
          {
            id: 'video_0',
            type: 'video',
            description: item.description,
            coverDescription: item.cover,
            duration: item.duration || 180,
          },
        ],
        payload: {
          title: item.title,
          text: item.description,
        },
        topicTags: extractTopicTags(item.title + ' ' + item.description),
        stats: {
          likes: 0,
          comments: 0,
          shares: 0,
          views: Math.floor(Math.random() * 10000),
          coins: Math.floor(Math.random() * 100),
          danmaku: Math.floor(Math.random() * 500),
        },
      };
    }));
  },
  
  async persist(items, context): Promise<PersistResult> {
    await db.socialPosts.bulkAdd(items);
    return {
      ids: items.map(p => p.id),
      count: items.length,
    };
  },
};
```

### 4.3 注册解析器

```typescript
// src/apps/bilibili/stores/llm/parsers/index.ts
import { ContentDispatcher } from './dispatcher';
import { VideoParser } from './videoParser';
import { PostParser, CommentParser, HotSearchParser } from '@/apps/weibo/stores/llm/parsers';

export function initializeBilibiliParsers(): ContentDispatcher {
  const dispatcher = ContentDispatcher.getInstance();
  
  // 复用通用解析器
  dispatcher.register(PostParser);
  dispatcher.register(CommentParser);
  dispatcher.register(HotSearchParser);
  
  // 注册 B站 特有解析器
  dispatcher.register(VideoParser);
  
  return dispatcher;
}
```

## 5. 自定义提示词

### 5.1 提示词设计原则

1. **结构化输出**：要求 LLM 输出 JSON
2. **明确字段**：列出所有必需和可选字段
3. **提供示例**：给出完整的输出示例
4. **处理边界**：说明异常情况的处理

### 5.2 提示词模板

```typescript
const myCustomPrompt: PromptDefinition = {
  id: 'my.custom.prompt',
  scene: 'my.custom.scene',
  appId: 'my-app',
  name: '我的自定义提示词',
  
  systemPrompt: `你是一个 [角色描述]。

任务：[具体任务]

要求：
1. [要求1]
2. [要求2]
3. [要求3]

输出 JSON 格式：
{
  "field1": "说明",
  "field2": "说明",
  "field3": []
}

示例输出：
{
  "field1": "示例值",
  "field2": "示例值",
  "field3": ["item1", "item2"]
}`,
  
  userPromptTemplate: `[用户输入的变量]
{{variable1}}
{{variable2}}`,
};
```

### 5.3 变量使用

| 变量语法 | 说明 |
| -------- | ---- |
| `{{variableName}}` | 简单变量替换 |
| `{{object.field}}` | 嵌套对象访问 |
| `{{array[0]}}` | 数组索引访问 |
| `{{inputs.xxx}}` | 链输入变量 |
| `{{step1.result}}` | 前一步骤结果 |

## 6. 最佳实践

### 6.1 代码组织

```text
✅ 推荐
src/apps/my-app/
├── manifest.ts       # 入口，注册逻辑
├── prompts.ts        # 提示词定义
├── chains.ts         # 提示词链
├── types.ts          # 类型定义
├── stores/           # 状态管理
└── components/       # UI 组件

❌ 避免
- 将提示词硬编码在组件中
- 在多个地方重复定义类型
- Store 之间循环依赖
```

### 6.2 类型安全

```typescript
// ✅ 使用类型守卫
function isVideoPost(post: UniversalPost): boolean {
  return post.primaryType === 'video' || post.contentFlags?.hasVideo;
}

// ✅ 使用类型断言
const videoMedia = post.media.find(m => m.type === 'video') as MediaAsset | undefined;

// ❌ 避免 any
const data: any = await fetchData();
```

### 6.3 错误处理

```typescript
// ✅ 优雅降级
async function generatePost(topic: string): Promise<UniversalPost | null> {
  try {
    const result = await contentFactory.generatePost('bilibili', topic);
    return result;
  } catch (error) {
    console.error('[BilibiliApp] 生成博文失败:', error);
    // 返回 null 或使用备选方案
    return null;
  }
}

// ✅ 用户友好提示
catch (error) {
  toast.error('内容生成失败，请稍后重试');
  addLog('error', `生成失败: ${error.message}`);
}
```

### 6.4 性能优化

```typescript
// ✅ 使用内存过滤而非索引查询
const posts = (await db.socialPosts.toArray())
  .filter(p => p.platformId === 'bilibili')
  .slice(0, 20);

// ✅ 批量操作
await db.socialPosts.bulkAdd(newPosts);
await db.socialComments.bulkAdd(newComments);

// ✅ 懒加载
const comments = computed(() => {
  if (!showComments.value) return [];
  return feedStore.getCommentsForPost(postId);
});
```

## 7. 调试技巧

### 7.1 LLM 调试

```typescript
// 开启任务调试输出
console.log('[LLM Task] 执行任务:', task.name);
console.log('[LLM Task] 系统提示词:', finalSystemPrompt);
console.log('[LLM Task] 用户提示词:', finalUserPrompt);
console.log('[LLM Task] 原始输出:', rawOutput);
console.log('[LLM Task] 解析结果:', parsedResult);
```

### 7.2 数据库调试

```typescript
// 在控制台查看数据
import { db } from '@/services/database';

// 查看所有博文
db.socialPosts.toArray().then(console.log);

// 查看特定平台
db.socialPosts.toArray().then(posts => {
  console.log(posts.filter(p => p.platformId === 'bilibili'));
});
```

### 7.3 提示词链调试

```typescript
// 使用 onStepComplete 回调
const result = await executor.execute(chain, inputs, {
  onStepStart: (step) => console.log(`开始: ${step.name}`),
  onStepComplete: (step, result) => console.log(`完成: ${step.name}`, result),
  onStepError: (step, error) => console.error(`失败: ${step.name}`, error),
});
```
