# 架构设计

## 分层架构

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           UI Layer                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │ Weibo App       │  │ DouYin App      │  │ Other Apps      │      │
│  │ (内部实现)       │  │ (使用服务)       │  │ (使用服务)       │      │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │
└───────────┼─────────────────────┼─────────────────────┼──────────────┘
            │                     │                     │
            │              ┌──────┴──────┐              │
            │              ▼             ▼              │
┌───────────┼─────────────────────────────────────────────────────────┐
│           │              Service Layer                               │
│           │  ┌───────────────────────────────────────────────────┐  │
│           │  │              SessionContextService                 │  │
│           │  │                    (Singleton)                     │  │
│           │  │                                                    │  │
│           │  │  ┌─────────────┐  ┌─────────────┐                  │  │
│           │  │  │ContextState │  │SourceFilter │                  │  │
│           │  │  │ Management  │  │   Builder   │                  │  │
│           │  │  └─────────────┘  └─────────────┘                  │  │
│           │  │                                                    │  │
│           │  │  ┌─────────────────────────────────┐               │  │
│           │  │  │       Bridge Integration        │               │  │
│           │  │  │  (Event Listener & State Sync)  │               │  │
│           │  │  └─────────────────────────────────┘               │  │
│           │  └───────────────────────────────────────────────────┘  │
│           │                          │                               │
│  ┌────────┴───────────┐              │                               │
│  │ Weibo Internal     │              │                               │
│  │ sessionContext.ts  │              │                               │
│  │ sourceTracking.ts  │              │                               │
│  │ narrativeIntegr... │              │                               │
│  └────────────────────┘              │                               │
└──────────────────────────────────────┼───────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Infrastructure Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │ Bridge Adapter  │  │ Database (db)   │  │ Narrative       │      │
│  │ (事件来源)       │  │ (数据持久化)     │  │ Service         │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

| 组件                      | 职责                           | 类型   |
| ------------------------- | ------------------------------ | ------ |
| `SessionContextService`   | 服务入口，状态管理与 API 暴露  | 单例   |
| `ContextStateManager`     | 管理响应式上下文状态           | 内部   |
| `SourceFilterBuilder`     | 构建数据过滤函数               | 内部   |
| `BridgeIntegration`       | 监听 Bridge 事件，同步状态     | 集成层 |

---

## 目录结构

### 系统服务

```text
src/services/sessionContext/
├── index.ts                    # 统一导出
├── types.ts                    # 类型定义
├── SessionContextService.ts    # 服务主类（单例）
├── bridgeIntegration.ts        # Bridge 事件集成
└── sourceFilter.ts             # 过滤器构建逻辑
```

### 服务导出

```text
src/services/
├── sessionContext/             # 会话上下文服务
│   └── ...
├── index.ts                    # 服务总入口（添加导出）
└── ...
```

### 微博现有实现（保持不变）

```text
src/apps/weibo/
├── services/
│   └── sessionContext.ts       # 会话上下文管理
└── stores/llm/
    ├── sourceTracking.ts       # 来源追踪工具
    └── narrativeIntegration.ts # 叙事内容订阅
```

---

## 数据流

### 状态更新流程

```text
酒馆事件 (Bridge)
       │
       ▼
┌─────────────────┐
│ Bridge Adapter  │
│ emit('sync')    │
│ emit('swipe_   │
│   changed')     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ bridgeIntegra-  │
│ tion.ts         │
│ 监听并解析事件   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SessionContext  │
│ Service         │
│ updateContext() │
└────────┬────────┘
         │
    响应式更新
         │
         ▼
┌─────────────────┐
│ Vue 组件        │
│ 自动重渲染       │
└─────────────────┘
```

### 数据写入流程

```text
App 保存数据
       │
       ▼
┌─────────────────┐
│ App Store       │
│ saveRecord()    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SessionContext  │
│ Service         │
│ getCurrentSour- │
│ ceTracking()    │
└────────┬────────┘
         │
     返回 source
         │
         ▼
┌─────────────────┐
│ 数据记录        │
│ {              │
│   ...data,     │
│   source: {    │
│     sessionId, │
│     messageId, │
│     swipeId,   │
│     generatedAt│
│   }            │
│ }              │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Database        │
│ db.table.add() │
└─────────────────┘
```

### 数据读取流程

```text
App 加载数据
       │
       ▼
┌─────────────────┐
│ App Store       │
│ loadRecords()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SessionContext  │
│ Service         │
│ buildSourceFil- │
│ ter('session')  │
└────────┬────────┘
         │
    返回过滤函数
         │
         ▼
┌─────────────────┐
│ Database Query  │
│ db.table        │
│   .filter(fn)   │
│   .toArray()    │
└────────┬────────┘
         │
   过滤后的数据
         │
         ▼
┌─────────────────┐
│ App UI          │
│ 渲染数据         │
└─────────────────┘
```

---

## 状态管理

### 响应式状态

服务使用 Vue 的 `ref()` 维护响应式状态：

```typescript
class SessionContextService {
  // 内部响应式状态
  private _context = ref<SessionContext>({
    sessionId: null,
    messageId: null,
    swipeId: null,
  });
  
  private _isConnected = ref(false);
  
  // 暴露给外部的只读引用
  get context(): Readonly<Ref<SessionContext>> {
    return this._context;
  }
  
  get isConnected(): Readonly<Ref<boolean>> {
    return this._isConnected;
  }
}
```

### 状态更新时机

| 事件                  | 更新内容                       |
| --------------------- | ------------------------------ |
| `sync`                | sessionId, messageId, swipeId  |
| `swipe_changed`       | messageId, swipeId             |
| `platform_connected`  | characterName, playerName      |
| `disconnect`          | 清空所有状态                   |

---

## 与微博架构的对比

### 微博现有架构

```text
┌─────────────────────────────────────────────┐
│                 WeiboApp                     │
│  ┌───────────────────────────────────────┐  │
│  │ sessionContext.ts                      │  │
│  │ - context (Ref)                        │  │
│  │ - syncFromNarrativeCache()            │  │
│  │ - syncSessionIdFromAccountStore()     │  │
│  │ - getCurrentSourceTracking()          │  │
│  │ - buildSourceFilter()                 │  │
│  └───────────────────────────────────────┘  │
│                     │                        │
│  ┌──────────────────┼──────────────────────┐│
│  │                  ▼                      ││
│  │ sourceTracking.ts  narrativeIntegr...   ││
│  │ (简化版追踪)        (叙事订阅+缓存)       ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 系统服务架构

```text
┌─────────────────────────────────────────────┐
│           SessionContextService              │
│  ┌───────────────────────────────────────┐  │
│  │ 核心 API                               │  │
│  │ - context (Ref)                        │  │
│  │ - isConnected (Ref)                    │  │
│  │ - getCurrentSourceTracking()          │  │
│  │ - buildSourceFilter()                 │  │
│  └───────────────────────────────────────┘  │
│                     │                        │
│  ┌──────────────────┼──────────────────────┐│
│  │                  ▼                      ││
│  │ bridgeIntegration.ts                    ││
│  │ (统一的 Bridge 事件监听)                 ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 关键差异

| 方面         | 微博实现                     | 系统服务                 |
| ------------ | ---------------------------- | ------------------------ |
| 状态来源     | 多重回退（3个数据源）        | 单一数据源（Bridge）     |
| 叙事管理     | 内部集成                     | 独立服务                 |
| 同步机制     | 手动调用 sync 函数           | 自动响应 Bridge 事件     |
| 复用性       | 仅微博可用                   | 所有 App 可用            |
