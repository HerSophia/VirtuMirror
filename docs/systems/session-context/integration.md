# 系统集成

## 依赖关系

```text
SessionContextService
    ├── depends on → Bridge Adapter (事件来源)
    ├── used by → App Stores (数据读写)
    ├── used by → AccountService (账号绑定)
    └── used by → LLM Task Service (上下文注入)
```

---

## 与 Bridge Adapter 的交互

`bridgeIntegration.ts` 负责监听 Bridge 事件并更新服务状态。

### 事件监听初始化

```typescript
// src/services/sessionContext/bridgeIntegration.ts

import { sessionContextService } from './SessionContextService';
import type { Adapter } from '@/adapters';

let cleanupFn: (() => void) | null = null;

/**
 * 初始化 Bridge 事件监听
 * 在应用启动时调用一次
 */
export function initSessionContextListeners(adapter: Adapter): void {
  if (cleanupFn) {
    console.warn('[SessionContext] 已初始化，跳过重复调用');
    return;
  }
  
  const listeners: Array<() => void> = [];
  
  // 监听 sync 事件
  const unsubSync = adapter.on('sync', (data) => {
    sessionContextService.updateContext({
      sessionId: data.sessionId,
      messageId: data.lastMessageId,
      swipeId: data.lastSwipeId,
      characterName: data.characterName,
      playerName: data.playerName,
    });
  });
  listeners.push(unsubSync);
  
  // 监听 swipe_changed 事件
  const unsubSwipe = adapter.on('swipe_changed', (data) => {
    sessionContextService.updateContext({
      messageId: data.messageId,
      swipeId: data.newSwipeId,
    });
  });
  listeners.push(unsubSwipe);
  
  // 监听 platform_connected 事件
  const unsubConnect = adapter.on('platform_connected', (data) => {
    sessionContextService.updateContext({
      characterName: data.characterName,
      playerName: data.playerName,
    });
  });
  listeners.push(unsubConnect);
  
  // 监听 disconnect 事件
  const unsubDisconnect = adapter.on('disconnect', () => {
    sessionContextService.clearContext();
  });
  listeners.push(unsubDisconnect);
  
  // 保存清理函数
  cleanupFn = () => {
    listeners.forEach(unsub => unsub());
    cleanupFn = null;
  };
  
  console.log('[SessionContext] Bridge 事件监听已初始化');
}

/**
 * 销毁事件监听
 */
export function destroySessionContextListeners(): void {
  if (cleanupFn) {
    cleanupFn();
    console.log('[SessionContext] Bridge 事件监听已销毁');
  }
}
```

### 事件映射表

| Bridge 事件           | 触发时机             | 更新字段                                        |
| --------------------- | -------------------- | ----------------------------------------------- |
| `sync`                | 初始连接、刷新同步   | sessionId, messageId, swipeId, names            |
| `swipe_changed`       | 用户切换 Swipe       | messageId, swipeId                              |
| `platform_connected`  | 平台连接成功         | characterName, playerName                       |
| `disconnect`          | 连接断开             | 清空所有字段                                    |
| `message_received`    | 新消息（可选监听）   | messageId（递增）                               |

---

## 与 AccountService 的交互

`AccountService` 负责账号与会话的绑定关系。

### 获取当前会话

```typescript
// src/services/account/accountService.ts

import { sessionContextService } from '@/services/sessionContext';

class AccountService {
  /**
   * 绑定账号到当前会话
   */
  async bindAccountToCurrentSession(accountId: string): Promise<void> {
    const ctx = sessionContextService.getContext();
    
    if (!ctx.sessionId) {
      throw new Error('未连接到会话，无法绑定');
    }
    
    await this.createBinding({
      accountId,
      sessionId: ctx.sessionId,
      boundAt: Date.now(),
    });
  }
  
  /**
   * 获取当前会话绑定的账号
   */
  async getAccountsForCurrentSession(): Promise<Account[]> {
    const ctx = sessionContextService.getContext();
    
    if (!ctx.sessionId) {
      return [];
    }
    
    return this.getAccountsBySessionId(ctx.sessionId);
  }
  
  /**
   * 检查账号是否属于当前会话
   */
  isAccountInCurrentSession(account: Account): boolean {
    const ctx = sessionContextService.getContext();
    
    if (!ctx.sessionId) {
      return true; // 无会话时不限制
    }
    
    return account.sessionId === ctx.sessionId;
  }
}
```

### 会话切换时的处理

```typescript
import { watch } from 'vue';
import { sessionContextService } from '@/services/sessionContext';
import { useAccountStore } from '@/stores/accountStore';

// 监听会话切换，更新 AccountStore
watch(
  () => sessionContextService.context.value.sessionId,
  (newSessionId) => {
    const accountStore = useAccountStore();
    
    // 更新 store 中的会话上下文
    accountStore.setSessionContext({
      sessionId: newSessionId,
      characterName: sessionContextService.context.value.characterName,
      playerName: sessionContextService.context.value.playerName,
    });
    
    // 刷新当前会话的账号列表
    accountStore.loadSessionAccounts();
  }
);
```

---

## 与 LLM Task Service 的交互

`LLMTaskService` 可以注册上下文提供器，注入会话信息。

### 注册会话上下文提供器

```typescript
// src/services/llmTask/builtinProviders.ts

import { sessionContextService } from '@/services/sessionContext';
import type { ContextProvider } from './types';

export const sessionContextProvider: ContextProvider = {
  id: 'system:session',
  appId: 'system',
  name: '会话上下文提供器',
  description: '注入当前酒馆会话信息',
  priority: 5, // 高优先级
  
  async getContext() {
    const ctx = sessionContextService.getContext();
    
    return {
      sessionId: ctx.sessionId || '',
      messageId: ctx.messageId?.toString() || '',
      swipeId: ctx.swipeId?.toString() || '',
      characterName: ctx.characterName || '',
      playerName: ctx.playerName || '',
      isConnected: sessionContextService.isConnected.value ? 'true' : 'false',
    };
  },
  
  getMetadata() {
    return {
      connected: sessionContextService.isConnected.value,
      context: sessionContextService.getContext(),
    };
  },
};
```

### 在任务提示词中使用

```typescript
// 任务定义中引用会话上下文
const taskDefinition: LLMTaskDefinition = {
  id: 'myapp:generate-content',
  // ...
  
  promptTemplate: `
当前角色：{{characterName}}
当前玩家：{{playerName}}

请根据以上角色信息生成内容...
`,
  
  contextProviders: ['system:session', 'system:time'],
};
```

---

## 与数据库的交互

数据库查询时使用过滤器进行会话隔离。

### 通用查询模式

```typescript
// src/services/database/queryHelpers.ts

import { sessionContextService } from '@/services/sessionContext';
import type { FilterMode, Sourceable } from '@/services/sessionContext/types';

/**
 * 创建带会话过滤的查询
 */
export function withSessionFilter<T extends Sourceable>(
  query: Dexie.Collection<T, any>,
  mode: FilterMode = 'session'
): Dexie.Collection<T, any> {
  const filter = sessionContextService.buildSourceFilter(mode);
  return query.filter(filter);
}

// 使用示例
async function loadPosts() {
  return withSessionFilter(
    db.socialPosts.where('platformId').equals('myapp')
  ).toArray();
}
```

### 批量操作时附加来源

```typescript
// src/services/database/writeHelpers.ts

import { sessionContextService } from '@/services/sessionContext';
import type { Sourceable, ContentSourceTracking } from '@/services/sessionContext/types';

/**
 * 为记录附加来源追踪
 */
export function attachSourceTracking<T extends Partial<Sourceable>>(
  record: T
): T & Sourceable {
  const source = sessionContextService.getCurrentSourceTracking();
  return {
    ...record,
    source,
  };
}

/**
 * 批量附加来源追踪
 */
export function attachSourceTrackingBatch<T extends Partial<Sourceable>>(
  records: T[]
): Array<T & Sourceable> {
  const source = sessionContextService.getCurrentSourceTracking();
  return records.map(record => ({
    ...record,
    source,
  }));
}
```

---

## 与 NarrativeService 的关系

`NarrativeService` 负责获取酒馆的叙事内容，与 `SessionContextService` 职责分离。

### 职责划分

| 服务                    | 职责                           |
| ----------------------- | ------------------------------ |
| SessionContextService   | 会话状态管理、数据过滤         |
| NarrativeService        | 叙事内容获取、订阅、缓存       |

### 协作模式

```typescript
// NarrativeService 可以使用 SessionContextService 获取会话 ID
import { sessionContextService } from '@/services/sessionContext';

class NarrativeService {
  /**
   * 获取当前会话的叙事内容
   */
  async getNarrativeForCurrentSession(): Promise<NarrativeContent | null> {
    const ctx = sessionContextService.getContext();
    
    if (!ctx.sessionId) {
      return null;
    }
    
    return this.cache.get(ctx.sessionId);
  }
  
  /**
   * 检查缓存是否属于当前会话
   */
  isCacheValid(): boolean {
    const ctx = sessionContextService.getContext();
    const cache = this.cache.current;
    
    return cache?.sessionId === ctx.sessionId;
  }
}
```

---

## 微博内部实现参考

微博 App 已有完整的会话上下文实现，可作为参考。

### 文件结构

```text
src/apps/weibo/
├── services/
│   └── sessionContext.ts       # 会话上下文管理
└── stores/llm/
    ├── sourceTracking.ts       # 来源追踪工具
    └── narrativeIntegration.ts # 叙事内容订阅
```

### 关键设计模式

#### 1. 多数据源回退

```typescript
// 微博的 getCurrentSourceTracking 使用多重回退：
// 1. context.value.sessionId（本地缓存）
// 2. accountStore.sessionContext?.sessionId（账号服务）
// 3. narrativeCache.metadata?.sessionId（叙事缓存）
```

#### 2. 分层同步

```typescript
// 三个同步函数，按需调用：
syncSessionIdFromAccountStore()  // 从账号服务同步
syncFromNarrativeCache()         // 从叙事缓存同步
syncContextFromNarrative()       // 完整同步
```

#### 3. 现有内容查询

```typescript
// 用于 LLM 生成时避免重复：
getExistingPostsSummary(limit)
getExistingHotSearchesSummary(limit)
getExistingContentContext()
```

---

## 集成检查清单

新 App 集成 SessionContextService 时的检查项：

### 初始化

- [ ] 在应用启动时调用 `initSessionContextListeners(adapter)`
- [ ] 确保只初始化一次（避免重复监听）

### 数据写入

- [ ] 所有持久化数据都附加 `source` 字段
- [ ] 使用 `getCurrentSourceTracking()` 获取来源

### 数据读取

- [ ] 列表查询使用 `buildSourceFilter()` 过滤
- [ ] 选择合适的 `FilterMode`（通常是 `'session'`）

### UI 响应

- [ ] 显示连接状态（使用 `isConnected`）
- [ ] 监听会话变化并刷新数据

### 可选集成

- [ ] 与 AccountService 协作（账号绑定）
- [ ] 注册 LLM 上下文提供器（如需要）
