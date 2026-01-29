# 事件总线服务 (Event Bus Service)

> **版本**: 1.0  
> **状态**: ✅ 已实现  
> **优先级**: 🟡 中（基础设施层核心服务）  
> **最后更新**: 2025-01-16

## 1. 概述

事件总线服务是基础设施层的核心服务，提供跨服务的事件通信机制。通过发布/订阅模式实现服务间的松耦合通信，是平台化架构的重要基础。

### 1.1 为什么需要事件总线？

当前服务间通信主要通过直接调用，存在以下问题：

| 问题 | 描述 | 事件总线解决方案 |
|------|------|------------------|
| **强耦合** | 服务 A 直接调用服务 B，形成硬依赖 | 通过事件解耦，A 只需发布事件 |
| **扩展困难** | 新增订阅者需要修改发布者代码 | 新订阅者直接监听，无需修改发布者 |
| **调试困难** | 调用链路不清晰 | 统一的事件日志和追踪 |
| **测试困难** | 需要 mock 大量依赖 | 只需验证事件发布/监听 |

### 1.2 核心能力

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Event Bus Service                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  发布/订阅   │  │  通道隔离   │  │  调试工具   │                 │
│  │  Pub/Sub    │  │  Channels   │  │  Debug      │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  • emit() / on() / once() / off()                                  │
│  • 命名通道隔离                                                      │
│  • 事件监听统计                                                      │
│  • 类型安全的事件定义                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 设计原则

1. **零依赖**：纯 TypeScript 实现，不依赖外部库
2. **类型安全**：完整的 TypeScript 类型支持
3. **高性能**：高效的事件分发机制
4. **可调试**：内置调试和监控能力
5. **内存安全**：自动清理和泄漏检测

---

## 2. 文档索引

| 文档 | 说明 |
|------|------|
| [API 参考](./api-reference.md) | 完整的 API 接口文档 |
| [事件类型](./event-types.md) | 预定义的系统事件类型 |
| [使用指南](./usage-guide.md) | 使用示例和最佳实践 |
| [实现方案](./implementation.md) | 技术实现细节 |

---

## 3. 快速开始

### 3.1 基础用法

```typescript
import { eventBus } from '@/services/eventBus';

// 订阅事件
const unsubscribe = eventBus.on('content:post:created', (payload) => {
  console.log('新帖子:', payload.postId);
});

// 发布事件
eventBus.emit('content:post:created', {
  postId: 'post_123',
  authorId: 'user_456',
  platformId: 'weibo',
});

// 取消订阅
unsubscribe();
```

### 3.2 一次性监听

```typescript
// 只监听一次
eventBus.once('session:changed', (payload) => {
  console.log('会话已切换:', payload.sessionId);
});
```

### 3.3 通道隔离

```typescript
// 获取命名通道
const weiboChannel = eventBus.channel('weibo');

// 通道内的事件相互隔离
weiboChannel.on('feed:updated', (data) => {
  // 只接收 weibo 通道的事件
});
```

### 3.4 扩展功能

```typescript
import { 
  EventBusExtended, 
  waitForEvent, 
  throttledOn 
} from '@/services/eventBus';

// 使用扩展事件总线
const extBus = new EventBusExtended();
extBus.setHistoryEnabled(true);

// 异步发布，等待所有处理函数完成
await extBus.emitAsync('task:complete', { taskId: '123' });

// 带过滤器订阅，只处理微博平台的事件
extBus.onFiltered(
  'content:post:created',
  (data) => data.platformId === 'weibo',
  (data) => console.log('微博新帖子:', data)
);

// 等待事件，支持超时
const result = await waitForEvent(eventBus, 'llm:task:completed', 5000);

// 节流订阅，100ms 内只触发一次
throttledOn(eventBus, 'scroll:update', handleScroll, 100);
```

---

## 4. 典型使用场景

### 4.1 涨粉引擎监听互动事件

```typescript
eventBus.on('interaction:like', ({ contentId, userId }) => {
  growthEngine.processInteraction('like', contentId, userId);
});
```

### 4.2 通知系统监听新评论

```typescript
eventBus.on('content:comment:created', ({ postId, authorId }) => {
  notificationService.notifyPostAuthor(postId, 'new_comment');
});
```

### 4.3 热搜更新时刷新多个 App

```typescript
eventBus.on('content:trending:updated', ({ platformId }) => {
  // 所有订阅者自动收到通知
  // 微博、B站等 App 各自刷新
});
```

### 4.4 LLM 任务完成通知

```typescript
eventBus.on('llm:task:completed', ({ taskId, result }) => {
  // 更新 UI、保存结果等
});
```

---

## 5. 与其他服务的关系

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           应用层 (Apps)                              │
│    微博  │  B站  │  知乎  │  Gallery  │  Chat  │  ...               │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ 订阅/发布事件
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Event Bus Service                           │
└─────────────────────────────────────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │ Interaction  │     │ Notification │     │ Growth       │
    │ Service      │     │ Service      │     │ Engine       │
    └──────────────┘     └──────────────┘     └──────────────┘
```

**依赖关系**：
- 事件总线是基础设施层服务，不依赖其他业务服务
- 所有需要跨服务通信的服务都可以使用事件总线
- 与 Logger Service 集成，提供事件日志

---

## 6. 实现优先级

| 阶段 | 内容 | 预估工作量 | 状态 |
|------|------|------------|------|
| Phase 1 | 核心发布/订阅机制 | 2-3h | ✅ 已完成 |
| Phase 2 | 通道隔离 | 1-2h | ✅ 已完成 |
| Phase 3 | 调试工具与日志 | 1-2h | ✅ 已完成 |
| Phase 4 | 类型安全增强 | 1h | ✅ 已完成 |

**总预估工作量**：5-8 小时

---

## 7. 参考资料

- [系统服务架构总览](../architecture/Service-for-social-media-platform.md)
- [服务开发指南](../service-development-guide.md)
