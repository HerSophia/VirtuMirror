# 上下文共享服务

> **状态**: ✅ 设计完成  
> **详细文档**: [context-sharing-service](../context-sharing-service/README.md)  
> **集成设计**: [integration-design](../context-sharing-service/integration-design.md)  
> **依赖**: LLM 任务服务完成后实施

## 概述

设计一个中心化的「上下文共享服务」，允许 App 发布和订阅上下文数据。

---

## 核心概念

```text
┌─────────────────────────────────────────────────────────────┐
│                  ContextSharingService                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Publishers (发布者)                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Weibo App   │  │ Chat App    │  │ System      │         │
│  │ - narrative │  │ - lastMsg   │  │ - time      │         │
│  │ - trending  │  │ - context   │  │ - user      │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Shared Context Registry                 │   │
│  │                                                      │   │
│  │  "weibo:narrative" → { content, timestamp, ... }    │   │
│  │  "weibo:trending"  → { topics, ... }                │   │
│  │  "chat:lastMessage" → { message, ... }              │   │
│  │  "system:time"     → { now, period, ... }           │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  Subscribers (订阅者)                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Forum App   │  │ Email App   │  │ Weibo App   │         │
│  │ subscribes: │  │ subscribes: │  │ subscribes: │       │
│  │ - narrative │  │ - time      │  │ - time      │         │
│  │ - time      │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 初步接口设计

```typescript
// src/services/contextSharing/types.ts

/** 可共享的上下文 */
interface SharedContext {
  /** 上下文 ID（格式：appId:contextId） */
  id: string;
  /** 发布者 App ID */
  publisherAppId: string;
  /** 上下文名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 当前值 */
  value: Record<string, any>;
  /** 最后更新时间 */
  updatedAt: number;
  /** 是否公开（其他 App 可见） */
  isPublic: boolean;
}

/** 上下文共享服务 */
interface IContextSharingService {
  // === 发布 ===
  
  /** 发布上下文（使其对其他 App 可见） */
  publish(context: SharedContext): void;
  
  /** 更新已发布的上下文值 */
  updateContext(id: string, value: Record<string, any>): void;
  
  /** 取消发布 */
  unpublish(id: string): void;
  
  // === 订阅 ===
  
  /** 订阅上下文变更 */
  subscribe(
    contextId: string, 
    callback: (value: Record<string, any>) => void
  ): () => void;  // 返回取消订阅函数
  
  /** 获取当前上下文值 */
  getContext(id: string): Record<string, any> | undefined;
  
  // === 查询 ===
  
  /** 获取所有公开的上下文 */
  getPublicContexts(): SharedContext[];
  
  /** 获取指定 App 发布的上下文 */
  getContextsByPublisher(appId: string): SharedContext[];
}
```

---

## 与 LLM 任务服务的集成

### 方式一：使用 sharedContextConfig（推荐）

在任务定义中直接配置需要的共享上下文，无需手动编写 ContextProvider：

```typescript
const weiboPostTask: LLMTaskDefinition = {
  id: 'weibo:generate-post',
  appId: 'weibo',
  name: '生成微博帖子',
  type: 'manual',
  executionMode: 'repeatable',

  // 使用共享上下文配置
  sharedContextConfig: {
    types: ['narrative:content', 'social:trending'],
    format: 'xml',
    maxTokens: 1500,
    priority: ['narrative:content'], // 叙事内容优先
    variableName: 'crossAppContext',
  },

  // 提示词模板中使用共享上下文
  promptTemplate: `以下是当前的上下文信息：
{{crossAppContext}}

请根据以上上下文生成微博帖子。`,

  inputSchema: [],
  defaultInput: {},
  outputHandlerId: 'weibo:post-handler',
};
```

### 方式二：自定义 ContextProvider

ContextProvider 可以从 ContextSharingService 获取数据：

```typescript
const crossAppNarrativeProvider: ContextProvider = {
  id: 'forum:narrative-subscriber',
  appId: 'forum',
  name: '叙事订阅者',
  
  async getContext() {
    const sharingService = getContextSharingService();
    
    // 订阅微博发布的叙事内容
    const narrative = sharingService.getContext('weibo:narrative');
    
    return {
      sharedNarrative: narrative?.content || '',
    };
  },
};
```

---

## 实施计划

| 阶段    | 内容                                        |
| ------- | ------------------------------------------- |
| Phase 1 | LLM 任务服务完成，内置 `system:time` 提供器 |
| Phase 2 | 设计并实现 ContextSharingService            |
| Phase 3 | 微博 App 发布 `weibo:narrative`             |
| Phase 4 | 其他 App 订阅并使用                         |

---

## 使用场景

### 场景 1：论坛 App 使用微博的叙事内容

```typescript
// 微博 App 发布
sharingService.publish({
  id: 'weibo:narrative',
  publisherAppId: 'weibo',
  name: '叙事内容',
  value: { content: '...' },
  isPublic: true,
});

// 论坛 App 订阅
const unsubscribe = sharingService.subscribe('weibo:narrative', (value) => {
  console.log('叙事内容更新:', value.content);
});
```

### 场景 2：聊天 App 共享最新消息

```typescript
// 聊天 App 发布
sharingService.publish({
  id: 'chat:lastMessage',
  publisherAppId: 'chat',
  name: '最新消息',
  value: { 
    role: 'assistant',
    content: '...',
  },
  isPublic: true,
});

// 任何 App 的 LLM 任务可以使用
const chatContextProvider: ContextProvider = {
  id: 'myapp:chat-context',
  appId: 'myapp',
  
  async getContext() {
    const lastMsg = sharingService.getContext('chat:lastMessage');
    return {
      lastChatMessage: lastMsg?.content || '',
    };
  },
};
```
