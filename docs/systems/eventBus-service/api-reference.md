# 事件总线服务 - API 参考

> 本文档详细描述事件总线服务的完整 API 接口。

## 1. 核心接口定义

### 1.1 EventBus 主接口

```typescript
interface EventBus {
  // === 发布/订阅 ===
  
  /**
   * 发布事件
   * @param event 事件名称
   * @param payload 事件数据
   */
  emit<T>(event: string, payload: T): void;
  
  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  on<T>(event: string, handler: (payload: T) => void): () => void;
  
  /**
   * 一事件（触发一次后自动取消）
   * @param event 事件名称
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  once<T>(event: string, handler: (payload: T) => void): () => void;
  
  /**
   * 取消订阅
   * @param event 事件名称
   * @param handler 可选，指定要取消的处理函数；不传则取消该事件的所有订阅
   */
  off(event: string, handler?: Function): void;
  
  // === 通道隔离 ===
  
  /**
   * 获取或创建命名通道
   * @param name 通道名称
   * @returns 隔离的事件通道
   */
  channel(name: string): EventChannel;
  
  // === 调试 ===
  
  /**
   * 获取指定事件的监听器数量
   * @param event 事件名称
   */
  getListenerCount(event: string): number;
  
  /**
   * 获取所有已注册的事件名称
   */
  getAllEvents(): string[];
  
  /**
   * 清除所有事件监听器
   */
  clear(): void;
}
```

### 1.2 EventChannel 通道接口

```typescript
interface EventChannel {
  /** 通道名称 */
  readonly name: string;
  
  /** 发布事件（自动添加通道前缀） */
  emit<T>(event: string, payload: T): void;
  
  /** 订阅事件 */
  on<T>(event: string, handler: (payload: T) => void): () => void;
  
  /** 一次性订阅 */
  once<T>(event: string, handler: (payload: T) => void): () => void;
  
  /** 取消订阅 */
  off(event: string, handler?: Function): void;
  
  /** 获取监听器数量 */
  getListenerCount(event: string): number;
  
  /** 清除通道内所有监听器 */
  clear(): void;
}
```

---

## 2. 方法详解

### 2.1 emit(event, payload)

发布一个事件，通知所有订阅者。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| event | `string` | ✅ | 事件名称，建议使用 `domain:action` 格式 |
| payload | `T` | ✅ | 事件携带的数据 |

**返回值**：`void`

**示例**：

```typescript
// 发布帖子创建事件
eventBus.emit('content:post:created', {
  postId: 'post_123',
  authorId: 'user_456',
  platformId: 'weibo',
  timestamp: Date.now(),
});

// 发布简单事件
eventBus.emit('app:ready', { appId: 'weibo' });
```

**注意事项**：
- 事件是同步分发的，所有处理函数按注册顺序执行
- 如果处理函数抛出异常，不会影响其他处理函数的执行
- 没有订阅者时发布事件不会报错

---

### 2.2 on(event, handler)

订阅事件，注册一个持久的事件处理函数。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| event | `string` | ✅ | 事件名称 |
| handler | `(payload: T) => void` | ✅ | 事件处理函数 |

**返回值**：`() => void` - 取消订阅的函数

**示例**：

```typescript
// 订阅事件
const unsubscribe = eventBus.on('interaction:like', (payload) => {
  console.log(`用户 ${payload.userId} 点赞了 ${payload.contentId}`);
});

// 在组件卸载时取消订阅
onUnmounted(() => {
  unsubscribe();
});
```

**Vue 组合式 API 用法**：

```typescript
import { onUnmounted } from 'vue';
import { eventBus } from '@/services/eventBus';

export function usePostEvents() {
  const unsubscribers: (() => void)[] = [];
  
  const onPostCreated = (handler: (payload: PostCreatedEvent) => void) => {
    const unsub = eventBus.on('content:post:created', handler);
    unsubscribers.push(unsub);
  };
  
  onUnmounted(() => {
    unsubscribers.forEach(unsub => unsub());
  });
  
  return { onPostCreated };
}
```

---

### 2.3 once(event, handler)

一次性订阅事件，处理函数执行一次后自动取消订阅。

**参数**：同 `on()`

**返回值**：`() => void` - 取消订阅的函数（可在事件触发前手动取消）

**示例**：

```typescript
// 等待初始化完成
eventBus.once('system:initialized', () => {
  console.log('系统初始化完成');
  startApp();
});

// 带超时的一次性监听
const cancel = eventBus.once('data:loaded', (data) => {
  processData(data);
});

setTimeout(() => {
  cancel(); // 超时后取消等待
  showTimeout();
}, 5000);
```

---

### 2.4 off(event, handler?)

取消事件订阅。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| event | `string` | ✅ | 事件名称 |
| handler | `Function` | ❌ | 要取消的处理函数；不传则取消该事件的所有订阅 |

**返回值**：`void`

**示例**：

```typescript
// 取消特定处理函数
const handler = (data) => console.log(data);
eventBus.on('test', handler);
eventBus.off('test', handler);

// 取消事件的所有订阅
eventBus.off('test');
```

---

### 2.5 channel(name)

获取或创建一个命名通道，实现事件隔离。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | `string` | ✅ | 通道名称 |

**返回值**：`EventChannel` - 隔离的事件通道

**示例**：

```typescript
// 微博应用使用独立通道
const weiboChannel = eventBus.channel('weibo');

weiboChannel.on('feed:refreshed', (data) => {
  // 只接收 weibo 通道的事件
});

weiboChannel.emit('feed:refreshed', { count: 10 });

// B站应用使用另一个通道
const biliChannel = eventBus.channel('bilibili');

biliChannel.on('feed:refreshed', (data) => {
  // 只接收 bilibili 通道的事件
});
```

**内部实现**：
- 通道事件名格式：`${channelName}:${eventName}`
- 例如：`weibo:feed:refreshed`

---

### 2.6 getListenerCount(event)

获取指定事件的监听器数量。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| event | `string` | ✅ | 事件名称 |

**返回值**：`number` - 监听器数量

**示例**：

```typescript
const count = eventBus.getListenerCount('content:post:created');
console.log(`有 ${count} 个监听器`); // 有 3 个监听器
```

---

### 2.7 getAllEvents()

获取所有已注册事件的名称列表。

**参数**：无

**返回值**：`string[]` - 事件名称数组

**示例**：

```typescript
const events = eventBus.getAllEvents();
console.log('已注册事件:', events);
// ['content:post:created', 'interaction:like', 'session:changed', ...]
```

---

### 2.8 clear()

清除所有事件监听器。

**参数**：无

**返回值**：`void`

**示例**：

```typescript
// 在测试清理阶段使用
afterEach(() => {
  eventBus.clear();
});
```

**注意**：此方法会清除所有通道的所有事件，谨慎使用。

---

## 3. 类型定义

### 3.1 事件处理函数类型

```typescript
/** 事件处理函数 */
type EventHandler<T = any> = (payload: T) => void;

/** 取消订阅函数 */
type Unsubscribe = () => void;
```

### 3.2 类型安全的事件定义

```typescript
// 定义事件映射
interface EventMap {
  'content:post:created': PostCreatedEvent;
  'content:comment:created': CommentCreatedEvent;
  'interaction:like': LikeEvent;
  'interaction:unlike': UnlikeEvent;
  'session:changed': SessionChangedEvent;
  // ... 更多事件
}

// 类型安全的 EventBus
interface TypedEventBus {
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): () => void;
  once<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): () => void;
}
```

### 3.3 常用事件 Payload 类型

```typescript
// 帖子创建事件
interface PostCreatedEvent {
  postId: string;
  authorId: string;
  platformId: string;
  timestamp: number;
}

// 点赞事件
interface LikeEvent {
  contentId: string;
  userId: string;
  platformId: string;
  timestamp: number;
}

// 会话切换事件
interface SessionChangedEvent {
  sessionId: string;
  previousSessionId?: string;
}

// LLM 任务完成事件
interface LLMTaskCompletedEvent {
  taskId: string;
  result: any;
  duration: number;
}
```

---

## 4. 使用示例

### 4.1 基础发布/订阅

```typescript
import { eventBus } from '@/services/eventBus';

// 订阅
eventBus.on('user:login', (user) => {
  console.log(`用户 ${user.name} 已登录`);
});

// 发布
eventBus.emit('user:login', { id: '123', name: 'Alice' });
```

### 4.2 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { eventBus } from '@/services/eventBus';

const unsubscribers: (() => void)[] = [];

onMounted(() => {
  unsubscribers.push(
    eventBus.on('content:updated', handleContentUpdate)
  );
});

onUnmounted(() => {
  unsubscribers.forEach(unsub => unsub());
});

function handleContentUpdate(data) {
  // 处理更新
}
</script>
```

### 4.3 在 Pinia Store 中使用

```typescript
import { defineStore } from 'pinia';
import { eventBus } from '@/services/eventBus';

export const useWeiboStore = defineStore('weibo', {
  actions: {
    initEventListeners() {
      eventBus.on('content:trending:updated', (data) => {
        this.updateTrending(data);
      });
    },
    
    createPost(post: Post) {
      // 创建帖子逻辑...
      
      // 发布事件通知其他服务
      eventBus.emit('content:post:created', {
        postId: post.id,
        authorId: post.authorId,
        platformId: 'weibo',
        timestamp: Date.now(),
      });
    },
  },
});
```

---

## 5. 错误处理

### 5.1 处理函数异常

事件总线内部会捕获处理函数的异常，确保一个处理函数的错误不会影响其他处理函数：

```typescript
eventBus.on('test', () => {
  throw new Error('Handler 1 error');
});

eventBus.on('test', () => {
  console.log('Handler 2 still runs'); // 仍会执行
});

eventBus.emit('test', {}); // 两个处理函数都会被调用
```

### 5.2 调试模式

开启调试模式可以查看事件流：

```typescript
// 开启调试
eventBus.setDebug(true);

// 之后的所有事件都会打印日志
eventBus.emit('test', { data: 1 });
// [EventBus] emit: test { data: 1 }
// [EventBus] handled by 2 listeners
```

---

## 6. 扩展功能 API

### 6.1 EventBusExtended

扩展事件总线，提供异步事件、历史记录和过滤器功能。

#### emitAsync(event, payload)

异步发布事件，等待所有处理函数完成（包括返回 Promise 的处理函数）。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| event | `string` | ✅ | 事件名称 |
| payload | `T` | ✅ | 事件数据 |

**返回值**：`Promise<void>`

**示例**：

```typescript
import { EventBusExtended } from '@/services/eventBus';

const extBus = new EventBusExtended();

extBus.on('async:task', async (data) => {
  await processData(data);
});

// 等待所有处理函数完成
await extBus.emitAsync('async:task', { id: '123' });
console.log('所有处理函数已完成');
```

#### onFiltered(event, filter, handler)

带过滤器的订阅，只有当 payload 满足过滤条件时才调用处理函数。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| event | `string` | ✅ | 事件名称 |
| filter | `(payload: T) => boolean` | ✅ | 过滤器函数 |
| handler | `(payload: T) => void` | ✅ | 事件处理函数 |

**返回值**：`() => void` - 取消订阅的函数

**示例**：

```typescript
// 只处理微博平台的事件
extBus.onFiltered(
  'content:post:created',
  (data) => data.platformId === 'weibo',
  (data) => console.log('微博新帖子:', data)
);
```

#### 历史记录相关方法

```typescript
// 启用历史记录
extBus.setHistoryEnabled(true);

// 设置最大历史记录数
extBus.setMaxHistory(200);

// 获取历史记录
const history = extBus.getHistory();
// 返回: EventRecord[]

// 清除历史记录
extBus.clearHistory();
```

### 6.2 工具函数

#### waitForEvent(bus, event, timeout?)

创建一个 Promise，在事件触发时 resolve。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| bus | `IEventBus` | ✅ | 事件总线实例 |
| event | `string` | ✅ | 事件名称 |
| timeout | `number` | ❌ | 超时时间（毫秒），0 表示不超时 |

**返回值**：`Promise<T>` - 事件 payload

**示例**：

```typescript
import { eventBus, waitForEvent } from '@/services/eventBus';

try {
  const result = await waitForEvent(eventBus, 'llm:task:completed', 5000);
  console.log('任务完成:', result);
} catch (error) {
  console.log('等待超时');
}
```

#### collectEvents(bus, event, duration)

收集指定时间内的所有事件。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| bus | `IEventBus` | ✅ | 事件总线实例 |
| event | `string` | ✅ | 事件名称 |
| duration | `number` | ✅ | 收集时长（毫秒） |

**返回值**：`Promise<T[]>` - 收集到的事件数组

**示例**：

```typescript
// 收集 1 秒内的所有点赞事件
const likes = await collectEvents(eventBus, 'interaction:like', 1000);
console.log(`收集到 ${likes.length} 个点赞事件`);
```

#### throttledOn(bus, event, handler, wait)

节流订阅，在指定时间内只触发一次。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| bus | `IEventBus` | ✅ | 事件总线实例 |
| event | `string` | ✅ | 事件名称 |
| handler | `(payload: T) => void` | ✅ | 事件处理函数 |
| wait | `number` | ✅ | 节流时间（毫秒） |

**返回值**：`() => void` - 取消订阅的函数

**示例**：

```typescript
// 滚动事件节流，100ms 内只处理一次
throttledOn(eventBus, 'scroll:update', handleScroll, 100);
```

#### debouncedOn(bus, event, handler, wait)

防抖订阅，连续触发时只在最后一次触发后执行。

**参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| bus | `IEventBus` | ✅ | 事件总线实例 |
| event | `string` | ✅ | 事件名称 |
| handler | `(payload: T) => void` | ✅ | 事件处理函数 |
| wait | `number` | ✅ | 防抖时间（毫秒） |

**返回值**：`() => void` - 取消订阅的函数

**示例**：

```typescript
// 搜索输入防抖，300ms 后执行
const unsubscribe = debouncedOn(eventBus, 'search:input', handleSearch, 300);

// 取消订阅时会清除待执行的防抖
unsubscribe();
```

---

## 7. 相关文档

- [事件类型](./event-types.md) - 预定义的系统事件
- [使用指南](./usage-guide.md) - 详细使用示例
- [实现方案](./implementation.md) - 技术实现细节
