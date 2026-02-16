# 设计决策

## 1. 状态数据来源

**决策**：✅ **单一数据源（Bridge 事件）**

| 方案 | 优点 | 缺点 |
| ------------------ | -------------------- | ---------------------- |
| 多重回退（微博） | 容错性强 | 复杂、数据可能不一致 |
| **单一来源** ✅ | 简单、数据一致 | 依赖 Bridge 可靠性 |
| 混合（带优先级） | 灵活 | 实现复杂 |

### 理由

* 微博的多重回退是为了应对初始化顺序不确定的问题
* 系统服务可以在更早的时机初始化，确保 Bridge 事件到达时服务已就绪
* 单一数据源避免了多个来源数据不一致的问题

### 实施要点

```typescript
// 状态更新只来自 Bridge 事件
adapter.on('sync', (data) => {
  sessionContextService.updateContext({
    sessionId: data.sessionId,
    messageId: data.lastMessageId,
    swipeId: data.lastSwipeId,
  });
});

// 不再需要多重回退
// ❌ if (!sessionId) sessionId = accountStore.sessionContext?.sessionId;
// ❌ if (!sessionId) sessionId = narrativeCache.metadata?.sessionId;
```

---

## 2. 与微博的兼容策略

**决策**：✅ **并行运行，微博保持现有实现**

| 方案 | 优点 | 缺点 |
| ------------------ | -------------------- | ---------------------- |
| 强制迁移 | 代码统一 | 风险高、工作量大 |
| **并行运行** ✅ | 零风险、渐进式 | 两套代码并存 |
| 适配器包装 | 接口统一 | 额外抽象层 |

### 理由

* 微博功能已稳定，强制迁移可能引入 bug
* 新 App 直接使用系统服务，获得开箱即用的体验
* 微博可以在未来版本逐步迁移（可选）

### 架构图

```text
┌─────────────────────────────────────────┐
│           系统服务层                      │
│  SessionContextService (新)              │
└─────────────────────────────────────────┘
              ↑                ↑
      ┌───────┘                └───────┐
      │                                │
┌─────┴─────┐                    ┌─────┴─────┐
│  新 App   │                    │  微博 App  │
│ 直接使用   │                    │ 保持现有   │
│ 系统服务   │                    │ 内部实现   │
└───────────┘                    └───────────┘
```

---

## 3. 历史数据兼容

**决策**：✅ **无 source 字段的记录默认显示**

| 方案 | 优点 | 缺点 |
| ------------------ | -------------------- | ---------------------- |
| 过滤掉历史数据 | 数据干净 | 丢失历史内容 |
| **默认显示** ✅ | 向后兼容 | 可能混入其他会话数据 |
| 迁移填充 source | 完整支持 | 需要迁移脚本 |

### 实施要点

```typescript
buildSourceFilter(mode: FilterMode) {
  return (record: Sourceable) => {
    // 无 source 的记录（历史数据）默认显示
    if (!record.source) return true;
    
    // 有 source 的记录按模式过滤
    // ...
  };
}
```

### 未来改进

可以提供数据迁移工具，为历史数据补充 source 字段：

```typescript
async function migrateHistoricalData(defaultSessionId: string) {
  const records = await db.socialPosts
    .filter(r => !r.source)
    .toArray();
  
  for (const record of records) {
    await db.socialPosts.update(record.id, {
      source: {
        sessionId: defaultSessionId,
        generatedAt: record.timestamp,
      },
    });
  }
}
```

---

## 4. 过滤器设计

**决策**：✅ **四级过滤模式**

| 模式 | 过滤粒度 | 适用场景 |
| --------- | ---------- | ---------------------- |
| `all` | 无过滤 | 管理界面、数据导出 |
| `session` | 会话级 | **日常使用（默认）** |
| `message` | 楼层级 | 时间线视图 |
| `swipe` | 消息页级 | 分支数据精确匹配 |

### 过滤逻辑详解

```typescript
buildSourceFilter(mode: FilterMode = 'session') {
  const ctx = this._context.value;
  
  return (record: Sourceable): boolean => {
    // ===== 全局通过条件 =====
    if (mode === 'all') return true;
    if (!ctx.sessionId) return true;  // 无会话时不过滤
    if (!record.source) return true;  // 历史数据默认显示
    
    // ===== 会话级过滤 =====
    if (record.source.sessionId && 
        record.source.sessionId !== ctx.sessionId) {
      return false;  // 不属于当前会话
    }
    if (mode === 'session') return true;
    
    // ===== 楼层级过滤 =====
    if (mode === 'message' && ctx.messageId !== null) {
      if (record.source.sourceMessageId === undefined) return true;
      return record.source.sourceMessageId <= ctx.messageId;
    }
    
    // ===== Swipe 级过滤 =====
    if (mode === 'swipe' && ctx.messageId !== null) {
      if (record.source.sourceMessageId === undefined) return true;
      if (record.source.sourceMessageId < ctx.messageId) return true;
      if (record.source.sourceMessageId === ctx.messageId) {
        if (record.source.sourceSwipeId === undefined) return true;
        return record.source.sourceSwipeId === ctx.swipeId;
      }
      return false;
    }
    
    return true;
  };
}
```

### 为什么需要 Swipe 级过滤？

```text
楼层 1: 固定内容
楼层 2: 固定内容  
楼层 3: [Swipe 0] [Swipe 1] [Swipe 2]  ← 用户可能在不同 Swipe 生成不同数据
              ↑
          当前位置
```

当用户切换到 Swipe 1 时，应该只看到 Swipe 1 生成的数据，而不是 Swipe 0 或 Swipe 2 的。

---

## 5. 响应式状态管理

**决策**：✅ **使用 Vue `ref()` + 只读暴露**

| 方案 | 优点 | 缺点 |
| ------------------ | -------------------- | ---------------------- |
| 纯 JS 状态 | 简单 | 组件需要手动刷新 |
| **Vue ref()** ✅ | 自动响应式 | 依赖 Vue |
| Pinia Store | 统一状态管理 | 过度设计 |

### 实施要点

```typescript
class SessionContextService {
  // 内部使用 ref
  private _context = ref<SessionContext>({ ... });
  private _isConnected = ref(false);
  
  // 暴露只读引用，防止外部直接修改
  get context(): Readonly<Ref<SessionContext>> {
    return this._context;
  }
  
  get isConnected(): Readonly<Ref<boolean>> {
    return this._isConnected;
  }
  
  // 提供快照方法（非响应式）
  getContext(): SessionContext {
    return { ...this._context.value };
  }
}
```

### 为什么不用 Pinia Store？

* 服务本身就是单例，不需要额外的 Store 包装
* 减少一层抽象，使用更简单
* 服务可以在非组件代码中使用

---

## 6. 叙事内容管理

**决策**：✅ **叙事内容独立于会话上下文服务**

| 方案 | 优点 | 缺点 |
| ------------------ | -------------------- | ---------------------- |
| 集成在一起（微博） | 一站式 | 职责不清、耦合度高 |
| **独立服务** ✅ | 职责清晰、可复用 | 需要协调两个服务 |

### 职责划分

```text
SessionContextService         NarrativeService
├── sessionId                 ├── 叙事内容获取
├── messageId                 ├── 叙事内容缓存  
├── swipeId                   ├── 叙事内容订阅
├── 来源追踪                   └── 叙事元数据
└── 数据过滤
```

### 协作方式

```typescript
// NarrativeService 可以使用 SessionContextService
class NarrativeService {
  getForCurrentSession() {
    const sessionId = sessionContextService.getContext().sessionId;
    return this.cache.get(sessionId);
  }
}

// App 需要两者时分别调用
const context = sessionContextService.getContext();
const narrative = await narrativeService.getCurrentNarrative();
```

---

## 7. 错误处理策略

**决策**：✅ **静默降级，不阻断业务**

| 场景 | 处理方式 |
| ------------------ | ------------------------------ |
| 无会话连接 | `getCurrentSourceTracking()` 返回 undefined |
| 无会话连接 | `buildSourceFilter()` 返回全通过函数 |
| Bridge 事件缺失字段 | 只更新有值的字段 |
| 初始化重复调用 | 跳过并警告 |

### 实施要点

```typescript
getCurrentSourceTracking(): ContentSourceTracking | undefined {
  const ctx = this._context.value;
  
  // 无会话时返回 undefined，而不是抛异常
  if (!ctx.sessionId) {
    return undefined;
  }
  
  return {
    sessionId: ctx.sessionId,
    sourceMessageId: ctx.messageId ?? undefined,
    sourceSwipeId: ctx.swipeId ?? undefined,
    generatedAt: Date.now(),
  };
}

updateContext(partial: Partial<SessionContext>): void {
  // 只更新提供的字段
  Object.entries(partial).forEach(([key, value]) => {
    if (value !== undefined) {
      (this._context.value as any)[key] = value;
    }
  });
  
  // 更新连接状态
  this._isConnected.value = !!this._context.value.sessionId;
}
```

---

## 8. 单例模式

**决策**：✅ **模块级单例**

```typescript
// src/services/sessionContext/SessionContextService.ts

class SessionContextService {
  // 私有构造函数
  private constructor() {}
  
  // 单例实例
  private static _instance: SessionContextService | null = null;
  
  static getInstance(): SessionContextService {
    if (!this._instance) {
      this._instance = new SessionContextService();
    }
    return this._instance;
  }
  
  // 测试用：重置实例
  static resetInstance(): void {
    this._instance = null;
  }
}

// 导出便捷实例
export const sessionContextService = SessionContextService.getInstance();
```

### 为什么用单例？

* **全局状态**：会话上下文是全局唯一的
* **简单访问**：`sessionContextService.xxx` 比 `getInstance().xxx` 更简洁
* **测试支持**：提供 `resetInstance()` 方法支持测试隔离

---

## 9. API 命名规范

**决策**：与微博保持一致的命名

| API | 说明 |
| -------------------------- | ---------------------- |
| `context` | 响应式上下文引用 |
| `isConnected` | 响应式连接状态 |
| `getContext()` | 获取快照 |
| `updateContext()` | 更新上下文 |
| `clearContext()` | 清空上下文 |
| `getCurrentSourceTracking()` | 获取来源追踪 |
| `buildSourceFilter()` | 构建过滤函数 |

### 为什么保持一致？

* 微博开发者已熟悉这套命名
* 减少学习成本
* 未来微博迁移时代码改动更小

---

## 10. 未来扩展考虑

### 可能的扩展点

| 扩展 | 说明 | 优先级 |
| ------------------ | ------------------------------ | ------ |
| 上下文持久化 | 页面刷新后恢复上下文 | 低 |
| 多会话支持 | 同时管理多个会话的数据 | 低 |
| 上下文历史 | 记录上下文变化历史 | 低 |
| 事件钩子 | 上下文变化时的回调 | 中 |

### 预留的扩展接口

```typescript
interface SessionContextServiceExtensions {
  // 事件监听（未来可能添加）
  on?(event: 'change' | 'connect' | 'disconnect', callback: Function): void;
  
  // 上下文历史（未来可能添加）
  getHistory?(): SessionContext[];
  
  // 调试模式（已预留）
  setDebug?(enabled: boolean): void;
}
```
