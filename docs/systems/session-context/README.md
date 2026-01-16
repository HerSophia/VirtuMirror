# 会话上下文服务

> **状态**: 📋 设计完成  
> **版本**: v1.0  
> **最后更新**: 2026-01-08

## 概述

会话上下文服务是一个**系统级服务**，为所有 App 提供统一的酒馆会话/楼层/Swipe 上下文管理和数据隔离能力。

### 核心能力

* **会话状态管理**：统一管理 sessionId / messageId / swipeId
* **来源追踪**：为 App 数据附加来源信息，支持数据溯源
* **数据过滤**：按会话/楼层/Swipe 级别过滤数据
* **Bridge 集成**：自动响应酒馆事件，保持状态同步

### 设计目标

| 维度       | 说明                                      |
| ---------- | ----------------------------------------- |
| 通用性     | 任何 App 都可以使用，无需重复实现         |
| 数据隔离   | 不同角色卡/聊天的数据互不干扰             |
| 低侵入性   | App 只需调用简单 API，无需理解底层细节    |
| 向后兼容   | 历史数据（无 source 字段）默认显示        |

---

## 文档导航

| 文档                              | 说明                                     |
| --------------------------------- | ---------------------------------------- |
| [架构设计](./architecture.md)     | 分层架构、核心组件、数据流               |
| [类型定义](./types.md)            | SessionContext、ContentSourceTracking 等 |
| [使用示例](./usage.md)            | 初始化、写入数据、读取数据、响应式 UI    |
| [系统集成](./integration.md)      | 与 Bridge、AccountService 的交互         |
| [设计决策](./design-decisions.md) | 过滤策略、状态来源、微博兼容等决策       |
| [测试指南](./testing.md)          | 单元测试用例、边缘情况、覆盖率目标       |

---

## 快速开始

### 1. 初始化（应用启动时）

```typescript
// src/main.ts 或 src/App.vue
import { initSessionContextListeners } from '@/services/sessionContext';
import { useAdapter } from '@/composables/useAdapter';

onMounted(() => {
  const adapter = useAdapter();
  initSessionContextListeners(adapter);
});
```

### 2. 写入数据时附加来源

```typescript
import { sessionContextService } from '@/services/sessionContext';

async function savePost(postData: PostInput) {
  // 获取当前来源追踪信息
  const source = sessionContextService.getCurrentSourceTracking();
  
  const post = {
    id: generateId(),
    ...postData,
    source, // 附加来源
  };
  
  await db.posts.add(post);
}
```

### 3. 读取数据时过滤

```typescript
import { sessionContextService } from '@/services/sessionContext';

async function loadPosts() {
  // 构建过滤器（默认按会话过滤）
  const filter = sessionContextService.buildSourceFilter('session');
  
  const posts = await db.posts
    .where('platformId').equals('myapp')
    .filter(filter) // 只返回当前会话的数据
    .toArray();
    
  return posts;
}
```

### 4. 在组件中使用

```vue
<template>
  <div>
    <span v-if="isConnected">已连接: {{ context.characterName }}</span>
    <span v-else>未连接到酒馆</span>
  </div>
</template>

<script setup>
import { sessionContextService } from '@/services/sessionContext';

const context = sessionContextService.context;
const isConnected = sessionContextService.isConnected;
</script>
```

---

## 核心概念

### 会话层级

```text
┌─────────────────────────────────────────────────────────────┐
│ Session (会话)                                               │
│ └── 由 sessionId 标识，对应一个聊天文件                       │
│                                                              │
│     ┌─────────────────────────────────────────────────────┐  │
│     │ Message (楼层)                                       │  │
│     │ └── 由 messageId 标识，对应一条用户/AI 消息           │  │
│     │                                                      │  │
│     │     ┌─────────────────────────────────────────────┐  │  │
│     │     │ Swipe (消息页)                               │  │  │
│     │     │ └── 由 swipeId 标识，同一楼层的不同版本       │  │  │
│     │     └─────────────────────────────────────────────┘  │  │
│     └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 过滤模式

| 模式      | 说明             | 适用场景           |
| --------- | ---------------- | ------------------ |
| `all`     | 显示所有数据     | 跨会话查看         |
| `session` | 按会话过滤       | **默认推荐**       |
| `message` | 按楼层过滤       | 精确到楼层         |
| `swipe`   | 按消息页过滤     | 最后楼层的分支数据 |

---

## 与微博实现的关系

```text
┌─────────────────────────────────────────────────────────────┐
│                 SessionContextService                        │
│                    (系统服务)                                │
└─────────────────────────────────────────────────────────────┘
                            ↑
          ┌─────────────────┼─────────────────┐
          │                 │                 │
  ┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐
  │   WeiboApp    │ │  DouYinApp    │ │  其他 App     │
  │  (保持现有)    │ │  (使用新服务)  │ │  (使用新服务)  │
  │               │ │               │ │               │
  │ 内部实现      │ │ 直接调用      │ │ 直接调用       │
  │ (可选迁移)    │ │ 系统服务      │ │ 系统服务       │
  └───────────────┘ └───────────────┘ └───────────────┘
```

- **微博保持现有实现**：避免迁移风险
- **新 App 使用系统服务**：开箱即用
- **微博可选迁移**：未来可逐步迁移

---

## 实施状态

| Phase   | 内容           | 工作量 | 状态       |
| ------- | -------------- | ------ | ---------- |
| Phase 1 | 基础服务实现   | 2-3h   | 📋 待实现  |
| Phase 2 | Bridge 集成    | 1h     | 📋 待实现  |
| Phase 3 | 文档与测试     | 1h     | 📋 待实现  |
| Phase 4 | 新 App 验证    | -      | 📋 待实现  |

---

## 参考资料

* [服务开发指南](../service-development-guide.md)
* [账号会话绑定](../../dev/Security/account-session-binding.md)
* [Socket Bridge 设计](../../dev/socket-bridge-design.md)
* [社交内容平台架构](../architecture/Service-for-social-media-platform.md)
