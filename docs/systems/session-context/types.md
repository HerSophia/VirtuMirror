# 类型定义

> 会话上下文服务的 TypeScript 类型定义

## 核心上下文类型

### SessionContext

已连接状态的会话上下文。

```typescript
interface SessionContext {
  /** 会话 ID (UUID) - 唯一标识一个聊天文件 */
  sessionId: string
  /** 当前楼层号 (message_id) */
  messageId: number
  /** 当前 Swipe ID */
  swipeId: number
  /** 角色名称 */
  characterName: string
  /** 玩家名称 */
  playerName: string
  /** 平台标识 */
  platform: string
  /** 最后更新时间 */
  lastUpdatedAt: number
}
```

### EmptySessionContext

未连接状态的空上下文。

```typescript
interface EmptySessionContext {
  sessionId: null
  messageId: null
  swipeId: null
  characterName: null
  playerName: null
  platform: null
  lastUpdatedAt: null
}
```

### SessionContextState

上下文状态的联合类型。

```typescript
type SessionContextState = SessionContext | EmptySessionContext
```

---

## 来源追踪类型

### ContentSourceTracking

内容来源追踪信息，用于附加到 App 数据上。

```typescript
interface ContentSourceTracking {
  /** 所属会话 ID */
  sessionId: string
  /** 创建时的楼层号 */
  messageId: number
  /** 创建时的 Swipe ID */
  swipeId: number
  /** 创建时间戳 */
  createdAt: number
}
```

### TrackedContent

带来源追踪的数据项基类。App 数据应扩展此接口以支持过滤。

```typescript
interface TrackedContent {
  /** 来源追踪信息（可选，兼容历史数据） */
  source?: ContentSourceTracking
}
```

**使用示例**：

```typescript
// 微博帖子扩展 TrackedContent
interface WeiboPost extends TrackedContent {
  id: string
  content: string
  authorId: string
  likes: number
  // ... 其他字段
}
```

---

## 过滤相关类型

### FilterMode

过滤模式枚举。

```typescript
type FilterMode = 'all' | 'session' | 'message' | 'swipe'
```

| 模式 | 说明 | 适用场景 |
| --------- | ------------------ | ------------------ |
| `all` | 显示所有数据 | 跨会话查看 |
| `session` | 按会话过滤 | **默认推荐** |
| `message` | 按楼层过滤 | 精确到楼层 |
| `swipe` | 按消息页过滤 | 最后楼层的分支数据 |

### FilterConfig

过滤器配置。

```typescript
interface FilterConfig {
  /** 过滤模式 */
  mode: FilterMode
  /** 是否包含无来源数据（历史兼容） */
  includeUntracked: boolean
}
```

### SourceFilter

过滤器函数类型。

```typescript
type SourceFilter<T extends TrackedContent = TrackedContent> = (item: T) => boolean
```

---

## 服务接口

### ISessionContextService

会话上下文服务的完整接口定义。

```typescript
interface ISessionContextService {
  // ==================== 状态访问 ====================

  /** 当前上下文（响应式） */
  readonly context: SessionContextState

  /** 是否已连接 */
  readonly isConnected: boolean

  // ==================== 上下文操作 ====================

  /** 更新会话信息 */
  updateSession(
    sessionId: string,
    characterName: string,
    playerName: string,
    platform: string
  ): void

  /** 更新楼层信息 */
  updateMessage(messageId: number): void

  /** 更新 Swipe 信息 */
  updateSwipe(swipeId: number): void

  /** 清除上下文 */
  clearContext(): void

  // ==================== 来源追踪 ====================

  /** 获取当前来源追踪信息 */
  getCurrentSourceTracking(): ContentSourceTracking | null

  // ==================== 数据过滤 ====================

  /** 构建来源过滤器 */
  buildSourceFilter<T extends TrackedContent>(
    mode?: FilterMode,
    config?: Partial<FilterConfig>
  ): SourceFilter<T>

  /** 检查数据项是否属于当前会话 */
  belongsToCurrentSession<T extends TrackedContent>(item: T): boolean

  /** 检查数据项是否属于当前楼层 */
  belongsToCurrentMessage<T extends TrackedContent>(item: T): boolean

  /** 检查数据项是否属于当前 Swipe */
  belongsToCurrentSwipe<T extends TrackedContent>(item: T): boolean
}
```

---

## 事件类型

### SessionContextChangedEvent

上下文变更事件。

```typescript
interface SessionContextChangedEvent {
  /** 变更类型 */
  type: 'session' | 'message' | 'swipe' | 'clear'
  /** 旧上下文 */
  previousContext: SessionContextState
  /** 新上下文 */
  newContext: SessionContextState
  /** 时间戳 */
  timestamp: number
}
```

---

## 工具函数

### createEmptyContext

创建空上下文。

```typescript
function createEmptyContext(): EmptySessionContext
```

### DEFAULT_FILTER_CONFIG

默认过滤器配置常量。

```typescript
const DEFAULT_FILTER_CONFIG: FilterConfig = {
  mode: 'session',
  includeUntracked: true,
}
```
