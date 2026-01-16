# 核心服务实现

> 本文档详细说明 NarrativeService 类的实现细节。

## 1. 类结构

```typescript
class NarrativeService {
  private subscribers = new Set<NarrativeCallback>()
  private _initialized = false
  private _pendingSetup = false
  private _unsubscribers: Array<() => void> = []

  // 订阅管理
  subscribe(callback: NarrativeCallback): () => void
  publish(event: NarrativeEvent): void

  // Bridge 集成
  setupBridgeListener(): void
  private _setupListeners(adapter): void
  private _buildNarrativeFromMessages(messages): string

  // 生命周期
  cleanup(): void
  get initialized(): boolean
}
```

## 2. 发布-订阅机制

### 2.1 订阅叙事内容

```typescript
subscribe(callback: NarrativeCallback): () => void {
  this.subscribers.add(callback)
  return () => this.subscribers.delete(callback)
}
```

**特点**：
- 使用 `Set` 存储回调，自动去重
- 返回取消订阅函数，便于清理
- 无需指定事件类型，所有订阅者收到相同内容

### 2.2 发布叙事内容

```typescript
publish(event: NarrativeEvent): void {
  console.log('[NarrativeService] 发布叙事:', {
    messageId: event.messageId,
    swipeId: event.swipeId,
    isSwipe: event.isSwipeChange || false,
    contentLength: event.content.length,
    subscriberCount: this.subscribers.size,
  })
  
  this.subscribers.forEach((cb) => {
    try {
      cb(event)
    } catch (error) {
      console.error('[NarrativeService] Subscriber error:', error)
    }
  })
}
```

**特点**：
- 遍历所有订阅者，逐个调用
- 每个订阅者独立处理，互不影响
- 错误隔离：单个订阅者出错不影响其他订阅者
- 详细的日志输出，便于调试

## 3. Bridge 集成

### 3.1 设置监听器

```typescript
setupBridgeListener(): void {
  if (this._initialized) {
    console.warn('[NarrativeService] Already initialized')
    return
  }

  const adapter = getBridgeAdapter()
  if (!adapter) {
    console.log('[NarrativeService] Bridge adapter not available yet')
    this._pendingSetup = true
    return
  }
  
  this._setupListeners(adapter)
}
```

**防重复初始化**：使用 `_initialized` 标志防止重复设置监听器。

### 3.2 监听的事件类型

| 事件 | 触发时机 | 处理方式 |
|------|----------|----------|
| `bridge:full_sync` | 首次加载或刷新 | 拼接所有消息为完整叙事 |
| `message_received` | 收到新消息 | 发布单条消息内容 |
| `swipe_changed` | 切换消息页 | 发布新 Swipe 内容，标记 `isSwipeChange` |

### 3.3 full_sync 处理

```typescript
adapter.on('bridge:full_sync', (payload: SyncPayload) => {
  if (syncPayload.messages && syncPayload.messages.length > 0) {
    // 拼接所有消息为完整叙事
    const narrativeContent = this._buildNarrativeFromMessages(syncPayload.messages)
    const lastMsg = syncPayload.messages[syncPayload.messages.length - 1]
    
    this.publish({
      sessionId: lastMsg.sessionId || adapter.getCurrentSessionId() || '',
      messageId: lastMsg.message_id,
      swipeId: lastMsg.swipe_id ?? 0,
      content: narrativeContent,
      timestamp: Date.now(),
    })
  }
})
### 3.4 消息拼接逻辑

```typescript
private _buildNarrativeFromMessages(messages: SyncedMessage[]): string {
  if (!messages || messages.length === 0) {
    return ''
  }
  
  // 按楼层号排序（升序）
  const sorted = [...messages].sort((a, b) => a.message_id - b.message_id)
  
  // 过滤掉空消息和隐藏消息，拼接内容
  const contents = sorted
    .filter(msg => msg.message && !msg.is_hidden)
    .map(msg => msg.message.trim())
    .filter(content => content.length > 0)
  
  // 使用双换行分隔不同楼层
  return contents.join('\n\n')
}
```

**处理逻辑**：
1. 按楼层号升序排序
2. 过滤隐藏消息和空消息
3. 去除首尾空白
4. 用双换行符拼接

### 3.5 Swipe 切换处理

```typescript
adapter.on('swipe_changed', (payload: SwipeChangedEvent) => {
  this.publish({
    sessionId: adapter.getCurrentSessionId() || '',
    messageId: swipeEvent.messageId,
    swipeId: swipeEvent.newSwipeId,
    content: swipeEvent.content,
    isSwipeChange: true,  // 标记为 Swipe 切换
    timestamp: Date.now(),
  })
})
```

**关键点**：`isSwipeChange` 标志让订阅者知道这是 Swipe 切换触发的，可以做特殊处理。

## 4. 生命周期管理

### 4.1 清理监听器

```typescript
cleanup(): void {
  this._unsubscribers.forEach((unsub) => unsub())
  this._unsubscribers = []
  this._initialized = false
}
```

**调用时机**：
- 应用卸载时
- 需要重新初始化时

### 4.2 状态查询

```typescript
get initialized(): boolean {
  return this._initialized
}
```

## 5. 单例导出

```typescript
export const narrativeService = new NarrativeService()
```

使用单例模式确保全局只有一个 NarrativeService 实例。

## 6. 错误处理

### 订阅者错误隔离

每个订阅者的回调都在 try-catch 中执行，确保：
- 单个订阅者出错不会阻止其他订阅者
- 错误会被记录到控制台
- 服务本身不会崩溃

```typescript
this.subscribers.forEach((cb) => {
  try {
    cb(event)
  } catch (error) {
    console.error('[NarrativeService] Subscriber error:', error)
  }
})
```

## 7. 日志输出

服务在关键节点输出日志，便于调试：

| 日志 | 说明 |
|------|------|
| `发布叙事` | 每次发布时输出消息 ID、内容长度、订阅者数量 |
| `收到 full_sync` | 完整同步时输出消息数量 |
| `收到 message_received` | 新消息时输出消息数量 |
| `收到 swipe_changed` | Swipe 切换时输出楼层号 |
| `Bridge listener setup complete` | 监听器设置完成 |
