# Context Sharing Service（上下文共享服务）

> **版本**: 1.0  
> **状态**: ✅ v1.0 已实现（核心能力已落地）  
> **最后更新**: 2026-02-08  
> **优先级**: 🟡 中（平台化增强）
> **说明**: 文档中的部分实施计划章节仍为历史设计草案，当前实现以 `src/services/contextSharing/` 为准。

## 1. 概述

### 1.1 什么是 Context Sharing Service？

Context Sharing Service 是一个**跨应用上下文共享**的系统服务，允许不同 App 之间发布和订阅上下文数据，实现信息的解耦传递。

**核心价值**：

| 能力 | 说明 |
| ---- | ---- |
| 📤 **发布/订阅模式** | App 发布上下文，其他 App 按需订阅 |
| 🔗 **解耦通信** | 发布者无需知道谁在订阅 |
| 🎯 **智能聚合** | 支持按需聚合多个上下文源 |
| 🧠 **LLM 增强** | 为 LLM 任务提供丰富的上下文信息 |
| ⚡ **缓存优化** | 支持 TTL 缓存，减少重复计算 |

### 1.2 与现有服务的关系

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           Context Sharing Service                        │
│                          （跨应用上下文共享）                              │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Session Context │       │   Narrative     │       │    Event Bus    │
│    Service      │       │    Service      │       │     Service     │
│ （会话隔离）     │       │ （酒馆叙事）     │       │  （事件通信）    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

**服务定位对比**：

| 服务 | 职责 | 数据流向 | 生命周期 | 数据特点 |
| ---- | ---- | -------- | -------- | -------- |
| **Session Context** | 会话/消息/刷卡隔离 | Bridge → 内部 | 随会话变化 | 结构化状态 |
| **Narrative Service** | 酒馆叙事获取 | SillyTavern → 内部 | 实时获取 | 纯文本内容 |
| **Event Bus** | 事件通信 | 任意方向 | 瞬时事件 | 一次性消息 |
| **Context Sharing** | 跨应用状态共享 | App ↔ App | 持续状态 | 任意类型 |

### 1.3 设计原则

1. **发布者无感知**：发布上下文时无需知道谁会订阅
2. **订阅者按需**：只获取需要的上下文，避免信息过载
3. **类型安全**：预定义上下文类型，提供类型提示
4. **缓存友好**：支持 TTL 缓存，减少重复计算
5. **权限控制**：支持上下文的可见性配置

---

## 2. 文档索引

| 文档 | 说明 |
| ---- | ---- |
| [核心概念](./concepts.md) | SharedContext、ContextType、Visibility 等 |
| [API 参考](./api-reference.md) | 完整的服务接口文档 |
| [使用指南](./usage-guide.md) | 发布、订阅、聚合的使用示例 |
| [实现方案](./implementation.md) | 技术实现细节 |
| [与 LLM 集成](./llm-integration.md) | 在 LLM 任务中使用上下文 |
| [集成设计](./integration-design.md) | 与 LLM Task Service、Prompt Service 的集成接口设计 |

---

## 3. 快速开始

### 3.1 发布上下文

```typescript
import { contextSharingService } from '@/services/contextSharing';

// 微博 App 发布热搜上下文
contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  value: trendStore.trendingList,
  visibility: { level: 'public' },
  cache: { ttl: 5 * 60 * 1000 },  // 缓存 5 分钟
});
```

### 3.2 订阅上下文

```typescript
import { contextSharingService } from '@/services/contextSharing';

// 订阅热搜更新
const unsubscribe = contextSharingService.subscribe<TrendItem[]>(
  'weibo:trending',
  (trending) => {
    console.log('热搜更新:', trending);
  }
);

// 组件卸载时取消订阅
onUnmounted(() => unsubscribe());
```

### 3.3 在 Vue 组件中使用

```vue
<template>
  <div v-if="loading">加载中...</div>
  <div v-else>
    <div v-for="item in trending" :key="item.id">{{ item.title }}</div>
  </div>
</template>

<script setup>
import { useContext } from '@/composables/useContextSharing';

const { value: trending, loading } = useContext<TrendItem[]>('weibo:trending');
</script>
```

### 3.4 聚合上下文（用于 LLM）

```typescript
// 在博文生成任务中聚合多个上下文
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: [
    'narrative:content',     // 酒馆叙事
    'social:trending',       // 热搜
    'user:currentAccount',   // 当前账号
  ],
  format: 'xml',
  maxTokens: 2000,
});

// 使用格式化后的上下文
const prompt = `${systemPrompt}\n\n${aggregated.formatted}`;
```

---

## 4. 典型使用场景

### 4.1 跨 App 共享叙事内容

```typescript
// Narrative Service 发布当前叙事
contextSharingService.publish({
  id: 'narrative:current',
  type: 'narrative:content',
  description: '当前酒馆叙事内容',
  getter: async () => {
    const narrative = await narrativeService.getCurrentNarrative();
    return narrative?.content || '';
  },
  cache: { ttl: 30 * 1000 },
});

// 论坛 App 订阅叙事
contextSharingService.subscribe('narrative:current', (content) => {
  // 使用叙事内容生成论坛帖子
});
```

### 4.2 热搜数据共享

```typescript
// 微博发布热搜
contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  value: trendStore.trendingList,
  visibility: {
    level: 'public',
    excludedApps: ['admin'],  // 管理后台不需要
  },
});

// B站可以参考微博热搜生成自己的热门
const weiboTrending = contextSharingService.get<TrendItem[]>('weibo:trending');
```

### 4.3 为 LLM 任务提供丰富上下文

```typescript
// LLM 任务的 ContextProvider
const crossAppContextProvider: ContextProvider = {
  id: 'cross-app-context',
  appId: 'system',
  name: '跨应用上下文',
  
  async getContext() {
    const aggregated = await contextSharingService.aggregate({
      requesterId: 'llm-task',
      types: [
        'narrative:content',
        'social:trending',
        'chat:lastMessage',
      ],
      format: 'text',
      maxTokens: 1500,
    });
    
    return {
      crossAppContext: aggregated.formatted,
    };
  },
};
```

### 4.4 用户状态共享

```typescript
// 账号服务发布当前用户
contextSharingService.publish({
  id: 'user:current',
  type: 'user:currentAccount',
  description: '当前操作的账号',
  getter: () => accountService.getCurrentAccount(),
});

// 任何 App 都可以获取当前用户
const currentUser = await contextSharingService.getAsync('user:current');
```

---

## 5. 架构设计

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Context Sharing Service                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Publishers (发布者)                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Weibo App   │  │ Chat App    │  │ Narrative   │  │ System      │     │
│  │ - trending  │  │ - lastMsg   │  │ - content   │  │ - time      │     │
│  │ - posts     │  │ - history   │  │ - chars     │  │ - session   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │                │             │
│         ▼                ▼                ▼                ▼             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Shared Context Registry                       │    │
│  │                                                                  │    │
│  │  "weibo:trending"    → { value, meta, cache }                   │    │
│  │  "chat:lastMessage"  → { value, meta, cache }                   │    │
│  │  "narrative:content" → { getter, meta, cache }                  │    │
│  │  "system:time"       → { value, meta }                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│         │                │                │                │             │
│         ▼                ▼                ▼                ▼             │
│  Subscribers (订阅者)                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Forum App   │  │ Email App   │  │ LLM Task    │  │ Bilibili    │     │
│  │ subscribes: │  │ subscribes: │  │ aggregates: │  │ subscribes: │     │
│  │ - narrative │  │ - time      │  │ - all       │  │ - trending  │     │
│  │ - trending  │  │             │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 预定义上下文类型

```typescript
type WellKnownContextType =
  // === 系统级 ===
  | 'system:time'              // 当前时间状态
  
  // === 叙事相关 ===
  | 'narrative:content'        // 当前叙事内容
  
  // === 社交内容 ===
  | 'social:trending'          // 热搜/热点
  | 'social:hotTopics'         // 热门话题
  
  // === 聊天相关(一般不考虑共享) ===
  | 'chat:lastMessage'         // 最新聊天消息
  | 'chat:recentHistory'       // 最近聊天历史
  | 'chat:participants'        // 聊天参与者
  
  // === 知识库 ===
  | 'archive:pinned'           // 置顶档案
  | 'archive:relevant'         // 相关档案
  | 'archive:characters';      // 角色档案
```

---

## 7. 与其他服务的关系

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           应用层 (Apps)                                  │
│    微博  │  B站  │  知乎  │  Gallery  │  Chat  │  Forum  │  ...         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
              发布/订阅/聚合上下文
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Context Sharing Service                             │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Narrative Service│   │ Session Context  │   │   Event Bus      │
│ (叙事内容源)      │   │ (会话状态源)      │   │ (变更事件)       │
└──────────────────┘   └──────────────────┘   └──────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LLM Task Service                                 │
│                    (使用聚合上下文增强提示词)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**依赖关系**：

| 服务 | 关系 |
| ---- | ---- |
| **Narrative Service** | 可以将叙事内容发布为共享上下文 |
| **Session Context** | 可以发布会话状态供其他 App 使用 |
| **Event Bus** | 用于通知上下文变更事件 |
| **LLM Task Service** | 使用聚合上下文增强 LLM 提示词 |
| **Account Service** | 发布用户相关上下文 |

---

## 8. 实施计划

| Phase | 内容 | 预估工作量 | 状态 |
| ----- | ---- | ---------- | ---- |
| Phase 1 | 核心服务实现（发布/订阅/获取） | 3-4h | ✅ 已完成 |
| Phase 2 | 聚合功能实现 | 2-3h | ✅ 已完成 |
| Phase 3 | Vue Composables | 1-2h | ✅ 已完成 |
| Phase 4 | 与 LLM Task 集成 | 2-3h | ✅ 已完成 |
| Phase 5 | 文档与测试 | 1-2h | 🟡 持续维护 |

**总预估工作量**：9-14 小时（历史估算）

---

## 9. 参考资料

- [系统服务架构总览](../architecture/Service-for-social-media-platform.md)
- [LLM 任务服务](../llm-task-service/README.md)
- [会话上下文服务](../session-context/README.md)
- [叙事服务](../narrative-service/README.md)
- [事件总线服务](../eventBus-service/README.md)
- [服务开发指南](../service-development-guide.md)
