# 事件总线服务 - 实现方案

> 本文档描述事件总线服务的技术实现细节。

## 1. 整体架构

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         EventBus Service                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      EventBus (单例)                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │ listeners   │  │ channels    │  │ debugMode   │          │   │
│  │  │ Map<event,  │  │ Map<name,   │  │ boolean     │          │   │
│  │  │   Set<fn>>  │  │   Channel>  │  │             │          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    EventChannel                              │   │
│  │  ┌─────────────┐  ┌─────────────┐                           │   │
│  │  │ name        │  │ parent      │  (引用 EventBus)           │   │
│  │  │ string      │  │ EventBus    │                           │   │
│  │  └─────────────┘  └─────────────┘                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心实现

### 2.1 EventBus 类

```typescript
// src/services/eventBus/EventBus.ts

type EventHandler<T = any> = (payload: T) => void;
type Unsubscribe = () => void;

export class EventBus {
  /** 事件监听器映射: event -> Set<handler> */
  private listeners = new Map<string, Set<EventHandler>>();
  
  /** 命名通道缓存 */
  private channels = new Map<string, EventChannel>();
  
  /** 调试模式 */
  private debugMode = false;
  
  /**
   * 发布事件
   */
  emit<T>(event: string, payload: T): void {
    if (this.debugMode) {
      console.log(`[EventBus] emit: ${event}`, payload);
    }
    
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) {
      if (this.debugMode) {
        console.log(`[EventBus] no listeners for: ${event}`);
      }
      return;
    }
    
    // 遍历所有处理函数
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        // 捕获错误，不影响其他处理函数
        console.error(`[EventBus] handler error for ${event}:`, error);
      }
    });
    
    if (this.debugMode) {
      console.log(`[EventBus] handled by ${handlers.size} listeners`);
    }
  }
  
  /**
   * 订阅事件
   */
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const handlers = this.listeners.get(event)!;
    handlers.add(handler);
    
    // 返回取消
    return () => {
      handlers.delete(handler);
      // 如果没有监听器了，清理 Map 条目
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    };
  }
  
  /**
   * 一次性订阅
   */
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    const wrappedHandler: EventHandler<T> = (payload) => {
      unsubscribe();
      handler(payload);
    };
    
    const unsubscribe = this.on(event, wrappedHandler);
    return unsubscribe;
  }
  
  /**
   * 取消订阅
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      // 取消该事件的所有订阅
      this.listeners.delete(event);
      return;
    }
    
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
  
  /**
   * 获取或创建命名通道
   */
  channel(name: string): EventChannel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new EventChannel(name, this));
    }
    return this.channels.get(name)!;
  }
  
  /**
   * 获取监听器数量
   */
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
  
  /**
   * 获取所有已注册事件
   */
  getAllEvents(): string[] {
    return Array.from(this.listeners.keys());
  }
  
  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
    this.channels.clear();
  }
  
  /**
   * 设置调试模式
   */
  setDebug(enabled: boolean): void {
    this.debugMode = enabled;
  }
}
```

### 2.2 EventChannel 类

```typescript
// src/services/eventBus/EventChannel.ts

export class EventChannel {
  constructor(
    public readonly name: string,
    private parent: EventBus
  ) {}
  
  /**
   * 生成带通道前缀的事件名
   */
  private prefixEvent(event: string): string {
    return `${this.name}:${event}`;
  }
  
  emit<T>(event: string, payload: T): void {
    this.parent.emit(this.prefixEvent(event), payload);
  }
  
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    return this.parent.on(this.prefixEvent(event), handler);
  }
  
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    return this.parent.once(this.prefixEvent(event), handler);
  }
  
  off(event: string, handler?: EventHandler): void {
    this.parent.off(this.prefixEvent(event), handler);
  }
  
  getListenerCount(event: string): number {
    return this.parent.getListenerCount(this.prefixEvent(event));
  }
  
  /**
   * 清除通道内所有监听器
   */
  clear(): void {
    const prefix = `${this.name}:`;
    const events = this.parent.getAllEvents();
    
    events.forEach(event => {
      if (event.startsWith(prefix)) {
        this.parent.off(event);
      }
    });
  }
}
```

### 2.3 导出与单例

```typescript
// src/services/eventBus/index.ts

import { EventBus } from './EventBus';
import { EventChannel } from './EventChannel';

export { EventBus, EventChannel };
export * from './types';

// 导出全局单例
export const eventBus = new EventBus();
```

---

## 3. 类型定义

### 3.1 基础类型

```typescript
// src/services/eventBus/types.ts

/** 事件处理函数 */
export type EventHandler<T = any> = (payload: T) => void;

/** 取消订阅函数 */
export type Unsubscribe = () => void;

/** 事件总线接口 */
export interface IEventBus {
  emit<T>(event: string, payload: T): void;
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe;
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe;
  off(event: string, handler?: EventHandler): void;
  channel(name: string): IEventChannel;
  getListenerCount(event: string): number;
  getAllEvents(): string[];
  clear(): void;
}

/** 事件通道接口 */
export interface IEventChannel {
  readonly name: string;
  emit<T>(event: string, payload: T): void;
  on<T>(event: string,handler: EventHandler<T>): Unsubscribe;
  once<T>(event: string, handler: EventHandler<T>): Unsubscribe;
  off(event: string, handler?: EventHandler): void;
  getListenerCount(event: string): number;
  clear(): void;
}
```

### 3.2 类型安全的事件映射

```typescript
// src/services/eventBus/eventMap.ts

/**
 * 事件类型映射
 * 扩展此接口以添加新的类型安全事件
 */
export interface EventMap {
  // 会话事件
  'session:changed': SessionChangedEvent;
  'session:message:new': SessionMessageNewEvent;
  
  // 内容事件
  'content:post:created': PostCreatedEvent;
  'content:comment:created': CommentCreatedEvent;
  'content:trending:updated': TrendingUpdatedEvent;
  
  // 互动事件
  'interaction:like': LikeEvent;
  'interaction:unlike': UnlikeEvent;
  'interaction:favorite': FavoriteEvent;
  'interaction:follow': FollowEvent;
  
  // 系统事件
  'llm:task:completed': LLMTaskCompletedEvent;
  'notification:created': NotificationCreatedEvent;
  'app:ready': AppReadyEvent;
}

// 事件名称联合类型
export type EventName = keyof EventMap;

// 类型安全的 emit
export function typedEmit<K extends EventName>(
  bus: IEventBus,
  event: K,
  payload: EventMap[K]
): void {
  bus.emit(event, payload);
}

// 类型安全的 on
export function typedOn<K extends EventName>(
  bus: IEventBus,
  event: K,
  handler: (payload: EventMap[K]) => void
): Unsubscribe {
  return bus.on(event, handler);
}
```

---

## 4. 文件结构

```text
src/services/eventBus/
├── index.ts              # 导出入口
├── EventBus.ts           # 核心 EventBus 类
├── EventChannel.ts       # EventChannel 类
├── types.ts              # 基础类型定义
├── eventMap.ts           # 事件类型映射
└── events/               # 事件 Payload 类型
    ├── session.ts
    ├── content.ts
    ├── interaction.ts
    ├── account.ts
    └── system.ts
```

---

## 5. 性能优化

### 5.1 使用 Set 存储监听器

```typescript
// ✅ 使用 Set：O(1) 添加/删除
private listeners = new Map<string, Set<EventHandler>>();

// ❌ 避免使用数组：O(n) 删除
private listeners = new Map<string, EventHandler[]>();
```

### 5.2 惰性创建

```typescript
// 只在需要时创建 Set
on<T>(event: string, handler: EventHandler<T>): Unsubscribe {
  if (!this.listeners.has(event)) {
    this.listeners.set(event, new Set());
  }
  // ...
}
```

### 5.3 自动清理空集合

```typescript
// 取消订阅时清理空 Set
return () => {
  handlers.delete(handler);
  if (handlers.size === 0) {
    this.listeners.delete(event);
  }
};
```

---

## 6. 内存安全

### 6.1 监听器泄漏检测

```typescript
class EventBus {
  private readonly MAX_LISTENERS = 100;
  
  on<T>(event: string, handler: EventHandler<T>): Unsubscribe {
    // ...
    
    // 开发环境下检测可能的内存泄漏
    if (import.meta.env.DEV) {
      const count = handlers.size;
      if (count > this.MAX_LISTENERS) {
        console.warn(
          `[EventBus] 事件 "${event}" 有 ${count} 个监听器，可能存在内存泄漏`
        );
      }
    }
    
    // ...
  }
}
```

### 6.2 WeakRef 优化（可选）

对于需要自动清理的场景，可以使用 WeakRef：

```typescript
class WeakEventBus {
  private listeners = new Map<string, Set<WeakRef<EventHandler>>>();
  private registry = new FinalizationRegistry<string>((event) => {
    // 当处理函数被垃圾回收时清理
    this.cleanup(event);
  });
  
  private cleanup(event: string): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(ref => {
        if (!ref.deref()) {
          handlers.delete(ref);
        }
      });
    }
  }
}
```

---

## 7. 测试方案

### 7.1 单元测试

```typescript
// tests/services/eventBus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@/services/eventBus';

describe('EventBus', () => {
  let eventBus: EventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
  });
  
  describe('emit/on', () => {
    it('should call handler with correct payload', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      
      eventBus.emit('test', { data: 123 });
      
      expect(handler).toHaveBeenCalledWith({ data: 123 });
    });
    
    it('should call multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      eventBus.emit('test', 'payload');
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
    
    it('should not call handler after unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test', handler);
      
      unsubscribe();
      eventBus.emit('test', 'payload');
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('once', () => {
    it('should call handler only once', () => {
      const handler = vi.fn();
      eventBus.once('test', handler);
      
      eventBus.emit('test', 'first');
      eventBus.emit('test', 'second');
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('first');
    });
  });
  
  describe('channel', () => {
    it('should isolate events by channel', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      const channel1 = eventBus.channel('app1');
      const channel2 = eventBus.channel('app2');
      
      channel1.on('event', handler1);
      channel2.on('event', handler2);
      
      channel1.emit('event', 'data1');
      
      expect(handler1).toHaveBeenCalledWith('data1');
      expect(handler2).not.toHaveBeenCalled();
    });
  });
  
  describe('error handling', () => {
    it('should continue calling handlers after error', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('test error');
      });
      const normalHandler = vi.fn();
      
      eventBus.on('test', errorHandler);
      eventBus.on('test', normalHandler);
      
      eventBus.emit('test', 'payload');
      
      expect(normalHandler).toHaveBeenCalled();
    });
  });
});
```

### 7.2 集成测试示例

```typescript
describe('EventBus Integration', () => {
  it('should work with notification service', async () => {
    const eventBus = new EventBus();
    const notifications: any[] = [];
    
    // 模拟通知服务
    eventBus.on('interaction:like', (data) => {
      notifications.push({
        type: 'like',
        from: data.userId,
        content: data.contentId,
      });
    });
    
    // 触发点赞事件
    eventBus.emit('interaction:like', {
      contentId: 'post_123',
      userId: 'user_456',
      platformId: 'weibo',
      timestamp: Date.now(),
      type: 'like',
    });
    
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('like');
  });
});
```

---

## 8. 实现计划

| 阶段 | 内容 | 预估工作量 | 状态 |
|------|------|------------|------|
| Phase 1 | 核心 EventBus 类实现 | 2h | 📋 待实现 |
| Phase 2 | EventChannel 实现 | 1h | 📋 待实现 |
| Phase 3 | 类型定义与事件映射 | 1h | 📋 待实现 |
| Phase 4 | 调试工具与泄漏检测 | 1h | 📋 待实现 |
| Phase 5 | 单元测试 | 2h | 📋 待实现 |
| Phase 6 | 文档与示例 | 1h | ✅ 已完成 |

**总预估工作量**：8 小时

---

## 9. 未来扩展

### 9.1 异步事件支持

```typescript
// 支持异步处理函数
async emitAsync<T>(event: string, payload: T): Promise<void> {
  const handlers = this.listeners.get(event);
  if (!handlers) return;
  
  await Promise.all(
    Array.from(handlers).map(handler => handler(payload))
  );
}
```

### 9.2 事件历史记录

```typescript
interface EventRecord {
  event: string;
  payload: any;
  timestamp: number;
}

class EventBusWithHistory extends EventBus {
  private history: EventRecord[] = [];
  private maxHistory = 100;
  
  emit<T>(event: string, payload: T): void {
    this.history.push({
      event,
      payload,
      timestamp: Date.now(),
    });
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    super.emit(event, payload);
  }
  
  getHistory(): EventRecord[] {
    return [...this.history];
  }
}
```

### 9.3 事件过滤器

```typescript
// 支持条件过滤
onFiltered<T>(
  event: string,
  filter: (payload: T) => boolean,
  handler: EventHandler<T>
): Unsubscribe {
  return this.on(event, (payload: T) => {
    if (filter(payload)) {
      handler(payload);
    }
  });
}

// 使用示例
eventBus.onFiltered(
  'content:post:created',
  (data) => data.platformId === 'weibo',
  (data) => console.log('微博新帖子:', data)
);
```

---

## 10. 相关文档

- [README](./README.md) - 服务概述
- [API 参考](./api-reference.md) - 完整 API
- [事件类型](./event-types.md) - 预定义事件
- [使用指南](./usage-guide.md) - 使用示例
