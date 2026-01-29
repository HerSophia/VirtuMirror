# 架构设计

> 会话上下文服务的分层架构、核心组件和数据流

## 分层架构

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           应用层 (Apps)                              │
│    微博  │  B站  │  知乎  │  Gallery  │  Chat  │  ...               │
│         调用服务 API，读写带来源追踪的数据                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ 使用服务
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SessionContextService                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • 状态管理: context / isConnected                            │    │
│  │ • 上下文操作: updateSession / updateMessage / updateSwipe    │    │
│  │ • 来源追踪: getCurrentSourceTracking                         │    │
│  │ • 数据过滤: buildSourceFilter / belongsTo*                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │ Event Bus    │     │ Logger       │     │ Bridge       │
    │ Service      │     │ Service      │     │ Adapter      │
    │ (事件通知)    │     │ (日志记录)    │     │ (状态同步)    │
    └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 核心组件

### SessionContextService

**职责**：管理会话上下文状态，提供来源追踪和数据过滤能力。

**实现特点**：
- 使用 Vue 的 `reactive()` 实现响应式状态
- 单例模式，全局唯一实例
- 通过 EventBus 发布状态变更事件

```typescript
class SessionContextService {
  // 响应式状态
  private _state: SessionContextState
  private _isConnected: ComputedRef<boolean>

  // 状态访问
  get context(): SessionContextState
  get isConnected(): boolean

  // 上下文操作
  updateSession(...): void
  updateMessage(messageId: number): void
  updateSwipe(swipeId: number): void
  clearContext(): void

  // 来源追踪
  getCurrentSourceTracking(): ContentSourceTracking | null

  // 数据过滤
  buildSourceFilter<T>(...): SourceFilter<T>
  belongsToCurrentSession<T>(item: T): boolean
  belongsToCurrentMessage<T>(item: T): boolean
  belongsToCurrentSwipe<T>(item: T): boolean
}
```

### initListeners

**职责**：初始化 Bridge 事件监听，自动同步上下文状态。

**监听的事件**：
- `bridge:connected` / `bridge:disconnected`
- `bridge:platform_changed`
- `bridge:sync` / `bridge:full_sync`
- `swipe_changed`
- `chat_changed`

---

## 数据流

### 写入数据时

```text
┌─────────┐      ┌───────────────────────┐      ┌─────────┐
│ App     │ ──▶  │ getCurrentSource      │ ──▶  │ 数据库   │
│         │      │ Tracking()            │      │         │
│ 创建数据 │      │ 获取 source 信息       │      │ 存储带   │
│         │      │                       │      │ source  │
└─────────┘      └───────────────────────┘      └─────────┘
```

### 读取数据时

```text
┌─────────┐      ┌───────────────────────┐      ┌─────────┐
│ 数据库   │ ──▶  │ buildSourceFilter()   │ ──▶  │ App     │
│         │      │                       │      │         │
│ 全部数据 │      │ 按 session/message/   │      │ 过滤后   │
│         │      │ swipe 过滤             │      │ 的数据   │
└─────────┘      └───────────────────────┘      └─────────┘
```

### 上下文同步

```text
┌───────────────┐      ┌─────────────────────┐      ┌───────────────┐
│ Bridge        │ ──▶  │ SessionContext      │ ──▶  │ Event Bus     │
│ Adapter       │      │ Service             │      │               │
│               │      │                     │      │ 发布           │
│ 酒馆事件       │      │ 更新 context 状态    │      │ changed 事件   │
└───────────────┘      └─────────────────────┘      └───────────────┘
                                                            │
                                                            ▼
                                                   ┌───────────────┐
                                                   │ Apps          │
                                                   │ 响应变化       │
                                                   └───────────────┘
```

---

## 会话层级模型

```text
┌─────────────────────────────────────────────────────────────┐
│ Session (会话)                                               │
│ └── sessionId: UUID                                          │
│     对应一个聊天文件，切换角色卡/聊天会产生新的 sessionId      │
│                                                              │
│     ┌─────────────────────────────────────────────────────┐  │
│     │ Message (楼层)                                       │  │
│     │ └── messageId: number                                │  │
│     │     对应酒馆的一条消息（用户/AI），递增的楼层号          │  │
│     │                                                      │  │
│     │     ┌─────────────────────────────────────────────┐  │  │
│     │     │ Swipe (消息页)                               │  │  │
│     │     │ └── swipeId: number                         │  │  │
│     │     │     同一楼层的不同回复版本                     │  │  │
│     │     │     只有最后一楼可以切换 swipe                 │  │  │
│     │     └─────────────────────────────────────────────┘  │  │
│     └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 状态转换

```text
┌─────────────┐                     ┌─────────────┐
│ 未连接       │ ──── 连接酒馆 ────▶ │ 已连接       │
│ (Empty)     │                     │ (Connected) │
│             │ ◀── 断开连接 ─────  │             │
└─────────────┘                     └─────────────┘
       │                                   │
       │                                   │ 切换会话
       │                                   ▼
       │                            ┌─────────────┐
       │                            │ 新会话       │
       │                            │ messageId=0 │
       │                            │ swipeId=0   │
       │                            └─────────────┘
       │                                   │
       │                                   │ 新消息/切换 swipe
       │                                   ▼
       │                            ┌─────────────┐
       │                            │ 更新楼层/    │
       │                            │ Swipe       │
       │                            └─────────────┘
       │                                   │
       └───────────────────────────────────┘
                   断开连接时回到未连接状态
```

---

## 与其他服务的集成

| 服务 | 集成方式 | 说明 |
| ---- | -------- | ---- |
| **EventBus** | 发布事件 | 发布 `session-context:changed` 和 `session:changed` 事件 |
| **Logger** | 日志记录 | 使用 `loggerService.child('session-context')` 记录日志 |
| **BridgeAdapter** | 状态同步 | 监听 Bridge 事件，自动更新上下文 |
| **Database** | 数据过滤 | 提供过滤器用于数据库查询 |

---

## 文件结构

```text
src/services/sessionContext/
├── SessionContextService.ts   # 核心服务实现
├── initListeners.ts           # Bridge 事件监听
├── index.ts                   # 模块导出
└── __tests__/
    └── SessionContextService.test.ts  # 单元测试

src/types/
└── sessionContext.ts          # 类型定义
```
