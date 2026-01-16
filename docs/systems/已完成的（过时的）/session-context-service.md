# 会话上下文服务 (SessionContextService)

> 系统级服务，为所有 App 提供统一的酒馆会话/楼层/Swipe 上下文管理和数据隔离能力。

## 1. 概述

### 1.1 背景

在小手机模拟器中，多个 App（微博、抖音、微信等）都需要将生成的内容与酒馆的聊天会话关联，以实现：

- **数据隔离**：不同角色卡/聊天的数据互不干扰
- **Swipe 切换**：切换消息页时自动切换对应的 App 数据
- **来源追踪**：记录每条数据来自哪个会话/楼层/Swipe

当前微博 App 已在内部实现了这套机制，涉及以下文件：

| 文件 | 职责 |
|------|------|
| `src/apps/weibo/services/sessionContext.ts` | 会话上下文管理、过滤器构建 |
| `src/apps/weibo/stores/llm/sourceTracking.ts` | 来源追踪工具函数 |
| `src/apps/weibo/stores/llm/narrativeIntegration.ts` | 叙事内容订阅、缓存管理 |

该实现与微博强耦合，其他 App 无法复用。

### 1.2 目标

提取通用逻辑为系统服务，让所有 App：

1. **开箱即用**：直接调用服务 API，无需重复实现
2. **统一标准**：使用相同的 `source` 字段格式
3. **自动响应**：Bridge 事件自动更新上下文，App 无需手动监听

### 1.3 与微博实现的关系

```
┌─────────────────────────────────────────────────────────────┐
│                 SessionContextService                        │
│                    (新系统服务)                              │
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

- 微博保持现有实现不变，避免迁移风险
- 新 App 直接使用系统服务
- 微博可在未来逐步迁移（可选）

### 1.4 微博实现的关键细节（参考）

从微博代码中提核心设计模式：

#### 1.4.1 多数据源回退策略

微博的 `getCurrentSourceTracking()` 使用多重回退获取 sessionId：

```typescript
// 优先级从高到低：
// 1. context.value.sessionId（本地缓存）
// 2. accountStore.sessionContext?.sessionId（账号服务）
// 3. narrativeCache.metadata?.sessionId（叙事缓存）
```

这种设计应对了**初始化顺序不确定**的问题。

#### 1.4.2 分层同步机制

```typescript
// sessionContext.ts 中的三个同步函数：
syncSessionIdFromAccountStore()  // 从账号服务同步 sessionId
syncFromNarrativeCache()         // 从叙事缓存同步 messageId/swipeId
syncContextFromNarrative()       // 完整同步（推荐使用）
```

#### 1.4.3 叙事订阅架构

```typescript
// narrativeIntegration.ts
interface NarrativeCache {
  content: string;      // 叙事文本内容
  messageId: number;    // 楼层 ID
  swipeId: number;      // Swipe ID  
  sessionId: string;    // 会话 ID
  timestamp: number;    // 时间戳
}

// 通过 narrativeService.subscribe() 监听酒馆事件
// 缓存最新的叙事内容和元数据
```

#### 1.4.4 现有内容查询（防重复生成）

```typescript
// narrativeIntegration.ts
getExistingPostsSummary(limit)      // 获取已有博文摘要
getExistingHotSearchesSummary(limit) // 获取已有热搜摘要
getExistingContentContext()          // 组合查询
```

这些函数用于在 LLM 生成时提供上下文，避免生成重复内容。

---

## 2. 核心概念

> 💡 **设计原则**：本服务参考微博实现，但做了以下简化：
> - 统一 sessionId 来源（不做多重回退，依赖单一数据源）
> - 分离叙事内容管理（由 `narrativeService` 独立负责）
> - 提供更清晰的 API（避免微博中两套 sourceTracking 的混乱）

### 2.1 会话层级

```
酒馆聊天结构：

┌─────────────────────────────────────────────────────────────┐
│ (会话)                                               │
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

### 2.2 来源追踪 (Source Tracking)

每条 App 数据都可附加来源信息：

```typescript
interface ContentSourceTracking {
  /** 会话 ID */
  sessionId?: string;
  
  /** 来源楼层 */
  sourceMessageId?: number;
  
  /** 来源消息页 */
  sourceSwipeId?: number;
  
  /** 生成时间 */
  generatedAt?: number;
}
```

### 2.3 过滤模式 (Filter Mode)

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `all` | 显示所有数据 | 跨会话查看 |
| `session` | 按会话过滤 | **默认推荐** |
| `message` | 按楼层过滤 | 精确到楼层 |
| `swipe` | 按消息页过滤 | 最后楼层的分支数据 |

---

## 3. API 设计

### 3.1 类型定义

```typescript
// src/services/sessionContext/types.ts

/** 会话上下文 */
export interface SessionContext {
  /** 酒馆会话 ID */
  sessionId: string | null;
  
  /** 当前楼层 (最后一条消息的 message_id) */
  messageId: number | null;
  
  /** 当前消息页 (最后楼层的 swipe_id) */
  swipeId: number | null;
  
  /** 角色名 */
  characterName?: string;
  
  /** 玩家名 */
  playerName?: string;
}

/** 过滤模式 */
export type FilterMode = 'all' | 'session' | 'message' | 'swipe';

/** 可追踪来源的记录 */
export interface Sourceable {
  source?: ContentSourceTracking;
}

/** 来源追踪数据 */
export interface ContentSourceTracking {
  sessionId?: string;
  sourceMessageId?: number;
  sourceSwipeId?: number;
  generatedAt?: number;
}
```

### 3.2 服务接口

```typescript
// src/services/sessionContext/SessionContextService.ts

class SessionContextService {
  // ========== 单例 ==========
  static getInstance(): SessionContextService;
  
  // ========== 状态访问 ==========
  
  /** 获取当前上下文（响应式 Ref） */
  get context(): Ref<SessionContext>;
  
  /** 获取当前上下文快照（非响应式） */
  getContext(): SessionContext;
  
  /** 是否已连接到酒馆（响应式 Ref） */
  get isConnected(): Ref<boolean>;
  
  // ========== 状态更新 ==========
  
  /** 
   * 更新上下文（由 Bridge 事件或 accountStore 触发）
   * 
   * 调用时机：
   * - 收到 sync 事件
   * - 收到 swipe_changed 事件
   * - accountStore.sessionContext 变化
   */
  updateContext(partial: Partial<SessionContext>): void;
  
  /** 清空上下文（断开连接时） */
  clearContext(): void;
  
  // ========== 来源追踪 ==========
  
  /** 
   * 获取当前来源追踪数据
   * 写入数据时调用，附加到记录的 source 字段
   * 
   * 与微博实现的区别：
   * - 微博使用多重回退（context → accountStore → narrativeCache）
   * - 本服务只使用 context（由外部保证 context 已正确更新）
   * 
   * @returns 来源追踪对象，无会话时返回 undefined
   */
  getCurrentSourceTracking(): ContentSourceTracking | undefined;
  
  // ========== 过滤器 ==========
  
  /**
   * 构建数据过滤函数
   * 读取数据时调用，过滤不属于当前上下文的记录
   * @param mode 过滤模式，默认 'session'
   */
  buildSourceFilter(mode?: FilterMode): (record: Sourceable) => boolean;
}

// 导出单例
export const sessionContextService: SessionContextService;
```

### 3.3 Bridge 集成

```typescript
// src/services/sessionContext/bridgeIntegration.ts

/**
 * 初始化 Bridge 事件监听
 * 在应用启动时调用一次（main.ts 或 App.vue）
 */
export function initSessionContextListeners(adapter: Adapter): void;

/**
 * 销毁事件监听
 */
export function destroySessionContextListeners(): void;
```

---

## 4. 使用示例

### 4.1 初始化（应用启动时）

```typescript
// src/main.ts 或 src/App.vue

import { initSessionContextListeners } from '@/services/sessionContext';
import { useAdapter } from '@/composables/useAdapter';

onMounted(() => {
  const adapter = useAdapter();
  initSessionContextListeners(adapter);
});
```

### 4.2 写入数据时附加来源

```typescript
// 任意 App 的 Store

import { sessionContextService } from '@/services/sessionContext';

async function savePost(postData: PostInput) {
  // 获取来源追踪
  const source = sessionContextService.getCurrentSourceTracking();
  
  const post = {
    id: generateId(),
    ...postData,
    source, // 附加来源
  };
  
  await db.posts.add(post);
}
```

### 4.3 读取数据时过滤

```typescript
// 任意 App 的 Store

import { sessionContextService } from '@/services/sessionContext';

async function loadPosts() {
  // 构建过滤器
  const filter = sessionContextService.buildSourceFilter('session');
  
  const posts = await db.posts
    .where('platformId').equals('douyin')
    .filter(filter) // 只返回当前会话的数据
    .toArray();
    
  return posts;
}
```

### 4.4 响应式 UI

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

### 4.5 监听上下文变化

```typescript
import { watch } from 'vue';
import { sessionContextService } from '@/services/sessionContext';

// 监听 Swipe 切换
watch(
  () => sessionContextService.context.value.swipeId,
  (newSwipeId, oldSwipeId) => {
    if (newSwipeId !== oldSwipeId) {
      console.log('Swipe 切换，刷新数据...');
      refreshData();
    }
  }
);
```

---

## 5. 实现细节

### 5.1 过滤器逻辑

微博实现的过滤器考虑了大量边界情况，以下是完整逻辑：

```typescript
buildSourceFilter(mode: FilterMode = 'session') {
  const ctx = this._context.value;
  
  return (record: Sourceable): boolean => {
    // ===== 1. 全局通过条件 =====
    
    // 不过滤模式
    if (mode === 'all') return true;
    
    // 无会话时不过滤（独立运行/Mock 模式）
    if (!ctx.sessionId) return true;
    
    const source = record.source;
    
    // 无来源的记录（历史数据）默认显示
    // 这保证了旧数据的向后兼容
    if (!source) return true;
    
    // ===== 2. 会话级过滤 =====
    
    // source 有 sessionId 但不匹配当前会话：过滤掉
    if (source.sessionId && source.sessionId !== ctx.sessionId) {
      return false;
    }
    
    if (mode === 'session') return true;
    
    // ===== 3. 楼层级过滤 =====
    
    if (mode === 'message' && ctx.messageId !== null) {
      // 无楼层信息的记录：通过（兼容早期数据）
      if (source.sourceMessageId === undefined) return true;
      // 显示所有 ≤ 当前楼层的数据
      return source.sourceMessageId <= ctx.messageId;
    }
    
    // ===== 4. Swipe 级过滤（最精确） =====
    
    if (mode === 'swipe' && ctx.messageId !== null) {
      // 无楼层信息的记录：通过
      if (source.sourceMessageId === undefined) return true;
      
      // 非最后楼层的数据：直接显示（已固化）
      if (source.sourceMessageId < ctx.messageId) return true;
      
      // 最后楼层的数据：只显示当前 swipe 的
      if (source.sourceMessageId === ctx.messageId) {
        // 无 swipe 信息：通过（兼容旧数据）
        if (source.sourceSwipeId === undefined) return true;
        // 匹配当前 swipe
        return source.sourceSwipeId === ctx.swipeId;
      }
      
      // 未来楼层的数据：不显示（理论上不应该存在）
      return false;
    }
    
    return true;
  };
}
```

#### 过滤器决策树

```
record
  ├─ mode === 'all' → ✅ 通过
  ├─ ctx.sessionId 为空 → ✅ 通过（独立模式）
  ├─ record.source 为空 → ✅ 通过（历史数据）
  │
  └─ source.sessionId !== ctx.sessionId → ❌ 过滤
      │
      └─ mode === 'session' → ✅ 通过
          │
          └─ mode === 'message'
          │   ├─ sourceMessageId 未定义 → ✅ 通过
          │   └─ sourceMessageId ≤ ctx.messageId → ✅ 通过
          │
          └─ mode === 'swipe'
              ├─ sourceMessageId 未定义 → ✅ 通过
              ├─ sourceMessageId < ctx.messageId → ✅ 通过（已固化）
              └─ sourceMessageId === ctx.messageId
                  ├─ sourceSwipeId 未定义 → ✅ 通过
                  └─ sourceSwipeId === ctx.swipeId → ✅ 通过
```

### 5.2 Bridge 事件映射

| Bridge 事件 | 服务动作 | 数据来源 |
|------------|----------|----------|
| `sync` | `updateContext()` | `data.sessionId`, `data.lastMessageId`, `data.lastSwipeId` |
| `swipe_changed` | `updateContext()` | `data.messageId`, `data.newSwipeId` |
| `disconnect` | `clearContext()` | - |
| `platform_connected` | `updateContext()` | `data.characterName`, `data.playerName` |

### 5.3 与 accountStore 的关系

微博实现中，`accountStore` 是 sessionId 的**主要来源**：

```typescript
// accountStore 中维护的会话上下文
interface AccountSessionContext {
  sessionId: string;
  characterName?: string;
  playerName?: string;
}

// sessionContext.ts 中的同步逻辑
function syncSessionIdFromAccountStore(): void {
  const accountStore = useAccountStore();
  const sessionContext = accountStore.sessionContext;
  
  if (sessionContext?.sessionId) {
    context.value.sessionId = sessionContext.sessionId;
  }
}
```

**系统服务的设计选择**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| A: 依赖 accountStore | 与微博一致 | 引入额外依赖 |
| B: 只依赖 Bridge 事件 | 更独立 | 需要 Bridge 提供完整数据 |
| C: 同时支持两者 | 灵活 | 复杂度高 |

**建议采用方案 B**：系统服务只依赖 Bridge 事件，由 Bridge Adapter 保证数据完整性。如果 App 需要与 accountStore 协作，可在 App 层实现。

### 5.4 状态注入模式

服务使用 Vue 的 `ref()` 维护响应式状态，符合 `service-development-guide.md` 中的"状态注入"模式：

```typescript
class SessionContextService {
  // 响应式状态
  private _context = ref<SessionContext>({ ... });
  private _isConnected = ref(false);
  
  // 暴露给 UI 的响应式引用
  get context(): Ref<SessionContext> {
    return this._context;
  }
}
```

---

## 6. 目录结构

```
src/services/
├── sessionContext/
│   ├── types.ts                    # 类型定义
│   ├── SessionContextService.ts    # 核心服务实现
│   ├── bridgeIntegration.ts        # Bridge 事件集成
│   └── index.ts                    # 统一导出
└── index.ts                        # 服务总入口（添加导出）
```

---

## 7. 与其他服务的关系

```
┌─────────────────────────────────────────────────────────────┐
│                      Bridge Adapter                          │
│                    (事件来源)                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ sync / swipe_changed
┌─────────────────────────────────────────────────────────────┐
│                  SessionContextService                       │
│                    (本服务)                                  │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  AccountService │ │  Database (db)  │ │  各 App Store   │
│  (账号绑定)      │ │  (数据查询)      │ │  (业务逻辑)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 与 AccountService 的协作

`AccountService` 负责账号与会话的绑定关系：

```typescript
// AccountService 可以使用 SessionContextService 获取当前会话
import { sessionContextService } from '@/services/sessionContext';

class AccountService {
  bindAccountToCurrentSession(accountId: string) {
    const ctx = sessionContextService.getContext();
    if (!ctx.sessionId) throw new Error('未连接到会话');
    
    // 绑定逻辑...
  }
}
```

---

## 8. 实施计划

### Phase 1：基础服务（预计 2h）

- [ ] 创建 `src/services/sessionContext/types.ts`
- [ ] 创建 `src/services/sessionContext/SessionContextService.ts`
- [ ] 创建 `src/services/sessionContext/index.ts`
- [ ] 更新 `src/services/index.ts` 导出

### Phase 2：Bridge 集成（预计 1h）

- [ ] 创建 `src/services/sessionContext/bridgeIntegration.ts`
- [ ] 在 `App.vue` 或 `main.ts` 中初始化

### Phase 3：文档与测试（预计 1h）

- [ ] 补充使用示例
- [ ] 编写单元测试

### Phase 4：新 App 验证（后续）

- [ ] 在新 App（如抖音模拟）中使用本服务
- [ ] 收集反馈，迭代优化

---

## 9. FAQ

### Q: 微博 App 需要迁移吗？

**不需要**。微博保持现有实现，两者并行运行。未来可选择性迁移。

### Q: 无酒馆连接时如何工作？

服务返回 `sessionId: null`，过滤器默认通过所有数据。App 可正常使用，只是不做会话隔离。

### Q: 历史数据（无 source 字段）如何处理？

过滤器对无 `source` 的记录默认返回 `true`，即显示所有历史数据。

### Q: 如何调试上下文状态？

```typescript
// 在控制台查看
import { sessionContextService } from '@/services/sessionContext';
console.log(sessionContextService.getContext());
```

### Q: 为什么微博有两个 getCurrentSourceTracking？

微博代码中存在两个版本：

| 文件 | 特点 |
|------|------|
| `sessionContext.ts` | 多重回退策略，更完善 |
| `sourceTracking.ts` | 只依赖 narrativeCache，较简单 |

这是历史遗留问题。**系统服务只提供一个版本**，避免混乱。

### Q: 叙事内容（narrative）由谁管理？

**叙事内容不属于本服务的职责**。微博的 `narrativeIntegration.ts` 包含：

- 叙事内容订阅（`initializeNarrativeSubscription`）
- 叙事内容缓存（`narrativeCache`）
- 现有内容查询（`getExistingPostsSummary` 等）

这些功能属于「叙事服务」（`narrativeService`）的范畴，本服务只消费其提供的元数据。

---

## 10. 参考

- [系统服务开发指南](./service-development-guide.md)
- [微博会话绑定设计](../apps/Weibo/session-binding-design.md)
- [Socket Bridge 设计](../dev/socket-bridge-design.md)
- [账号会话绑定](../dev/Security/account-session-binding.md)
