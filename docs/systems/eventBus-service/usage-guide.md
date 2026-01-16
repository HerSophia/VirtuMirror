# 事件总线服务 - 使用指南

> 本文档提供事件总线服务的详细使用示例和最佳实践。

## 1. 基础用法

### 1.1 导入服务

```typescript
import { eventBus } from '@/services/eventBus';
```

### 1.2 发布事件

```typescript
// 简单事件
eventBus.emit('user:login', { userId: 'user_123' });

// 带完整数据的事件
eventBus.emit('content:post:created', {
  postId: 'post_456',
  authorId: 'user_123',
  platformId: 'weibo',
  timestamp: Date.now(),
  contentType: 'text',
});
```

### 1.3 订阅事件

```typescript
// 订阅并获取取消函数
const unsubscribe = eventBus.on('user:login', (payload) => {
  console.log(`用户 ${payload.userId} 已登录`);
});

// 不再需要时取消订阅
unsubscribe();
```

### 1.4 一次性订阅

```typescript
// 只触发一次
eventBus.once('app:initialized', () => {
  console.log('应用初始化完成');
  startMainProcess();
});
```

---

## 2. 在 Vue 组件中使用

### 2.1 基础用法

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { eventBus } from '@/services/eventBus';

const notifications = ref<Notification[]>([]);
const unsubscribers: (() => void)[] = [];

onMounted(() => {
  // 订阅通知事件
  unsubscribers.push(
    eventBus.on('notification:created', (data) => {
      notifications.value.push(data);
    })
  );
  
  // 订阅帖子更新事件
  unsubscribers.push(
    eventBus.on('content:post:updated', (data) => {
      handlePostUpdate(data);
    })
  );
});

onUnmounted(() => {
  // 清理所有订阅
  unsubscribers.forEach(unsub => unsub());
});

function handlePostUpdate(data) {
  // 处理更新逻辑
}
</script>
```

### 2.2 封装为 Composable

```typescript
// composables/useEventBus.ts
import { onUnmounted } from 'vue';
import { eventBus } from '@/services/eventBus';
import type { EventMap } from '@/services/eventBus';

export function useEventBus() {
  const unsubscribers: (() => void)[] = [];
  
  function on<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ) {
    const unsub = eventBus.on(event, handler);
    unsubscribers.push(unsub);
    return unsub;
  }
  
  function once<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ) {
    const unsub = eventBus.once(event, handler);
    unsubscribers.push(unsub);
    return unsub;
  }
  
  function emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K]
  ) {
    eventBus.emit(event, payload);
  }
  
  // 自动清理
  onUnmounted(() => {
    unsubscribers.forEach(unsub => unsub());
  });
  
  return { on, once, emit };
}
```

**使用封装后的 Composable**：

```vue
<script setup lang="ts">
import { useEventBus } from '@/composables/usen
const { on, emit } = useEventBus();

// 订阅（无需手动清理）
on('content:post:created', (data) => {
  console.log('新帖子:', data.postId);
});

// 发布
function createPost() {
  // 创建帖子逻辑...
  emit('content:post:created', {
    postId: 'new_post',
    authorId: 'user_123',
    platformId: 'weibo',
    timestamp: Date.now(),
  });
}
</script>
```

---

## 3. 在 Pinia Store 中使用

### 3.1 监听事件更新状态

```typescript
// stores/weiboStore.ts
import { defineStore } from 'pinia';
import { eventBus } from '@/services/eventBus';

export const useWeiboStore = defineStore('weibo', {
  state: () => ({
    posts: [] as Post[],
    trending: [] as TrendItem[],
  }),
  
  actions: {
    // 初始化事件监听
    initEventListeners() {
      // 监听热搜更新
      eventBus.on('content:trending:updated', (data) => {
        if (data.platformId === 'weibo') {
          this.refreshTrending();
        }
      });
      
      // 监听新帖子
      eventBus.on('content:post:created', (data) => {
        if (data.platformId === 'weibo') {
          this.addPost(data.postId);
        }
      });
      
      // 监听会话切换（清理数据）
      eventBus.on('session:changed', () => {
        this.clearSessionData();
      });
    },
    
    // 发布事件通知其他服务
    async likePost(postId: string, userId: string) {
      // 执行点赞逻辑...
      
      // 发布互动事件
      eventBus.emit('interaction:like', {
        contentId: postId,
        userId,
        platformId: 'weibo',
        timestamp: Date.now(),
        type: 'like',
      });
    },
  },
});
```

### 3.2 Store 初始化时机

```typescript
// main.ts 或 App.vue
import { useWeiboStore } from '@/stores/weiboStore';

// 应用启动时初始化
const weiboStore = useWeiboStore();
weiboStore.initEventListeners();
```

---

## 4. 服务间通信

### 4.1 涨粉引擎监听互动

```typescript
// services/growthEngine.ts
import { eventBus } from '@/services/eventBus';

class GrowthEngine {
  private unsubscribers: (() => void)[] = [];
  
  init() {
    // 监听点赞事件
    this.unsubscribers.push(
      eventBus.on('interaction:like', (data) => {
        this.processInteraction('like', data);
      })
    );
    
    // 监听评论事件
    this.unsubscribers.push(
      eventBus.on('content:comment:created', (data) => {
        this.processInteraction('comment', data);
      })
    );
    
    // 监听转发事件
    this.unsubscribers.push(
      eventBus.on('interaction:repost', (data) => {
        this.processInteraction('repost', data);
      })
    );
  }
  
  private processInteraction(type: string, data: any) {
    // 计算涨粉逻辑
    const followerGain = this.calculateFollowerGain(type, data);
    
    if (followerGain > 0) {
      // 发布粉丝变化事件
      eventBus.emit('account:stats:changed', {
        accountId: data.contentId,
        platformId: data.platformId,
        statType: 'followers',
        oldValue: 0,
        newValue: followerGain,
        delta: followerGain,
      });
    }
  }
  
  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
  }
}
```

### 4.2 通知系统监听多种事件

```typescript
// services/notification/notificationService.ts
import { eventBus } from '@/services/eventBus';

class NotificationService {
  init() {
    // 新评论 → 通知帖子作者
    eventBus.on('content:comment:created', async (data) => {
      await this.createNotification({
        type: 'new_comment',
        targetUserId: await this.getPostAuthor(data.postId),
        fromUserId: data.authorId,
        relatedId: data.commentId,
      });
    });
    
    // 新粉丝 → 通知被关注者
    eventBus.on('interaction:follow', async (data) => {
      await this.createNotification({
        type: 'new_follower',
        targetUserId: data.followeeId,
        fromUserId: data.followerId,
      });
    });
    
    // 点赞 → 通知内容作者
    eventBus.on('interaction:like', async (data) => {
      await this.createNotification({
        type: 'like',
        targetUserId: await this.getContentAuthor(data.contentId),
        fromUserId: data.userId,
        relatedId: data.contentId,
      });
    });
  }
  
  private async createNotification(params: NotificationParams) {
    // 创建通知...
    
    // 发布通知创建事件
    eventBus.emit('notification:created', {
      notificationId: 'notif_xxx',
      type: params.type,
      appId: 'notification',
      priority: 'normal',
    });
  }
}
```

---

## 5. 通道隔离

### 5.1 应用专属通道

```typescript
// apps/weibo/weiboEvents.ts
import { eventBus } from '@/services/eventBus';

// 创建微博专属通道
const weiboChannel = eventBus.channel('weibo');

export function useWeiboEvents() {
  return {
    // 发布微博内部事件
    emitFeedRefresh: (count: number) => {
      weiboChannel.emit('feed:refreshed', { count });
    },
    
    // 监听微博内部事件
    onFeedRefresh: (handler: (data: { count: number }) => void) => {
      return weiboChannel.on('feed:refreshed', handler);
    },
    
    // 发布话题点击事件
    emitTopicClick: (topicId: string) => {
      weiboChannel.emit('topic:clicked', { topicId });
    },
  };
}
```

### 5.2 通道 vs 全局事件

| 场景 | 推荐方式 | 说明 |
|------|----------|------|
| App 内部通信 | 通道 | 避免污染全局事件空间 |
| 跨 App 通信 | 全局事件 | 使用标准系统事件 |
| 服务间通信 | 全局事件 | 便于多个服务订阅 |

---

## 6. 最佳实践

### 6.1 事件命名规范

```typescript
// ✅ 好的命名
'content:post:created'     // domain:entity:action
'interaction:like'         // domain:action
'session:changed'          // domain:action

// ❌ 避免的命名
'postCreated'              // 缺少域前缀
'CONTENT_POST_CREATED'     // 不要用大写
'content-post-created'     // 不要用连字符
```

### 6.2 Payload 设计原则

```typescript
// ✅ 好的 Payload：包含足够的上下文
eventBus.emit('content:post:created', {
  postId: 'post_123',
  authorId: 'user_456',
  platformId: 'weibo',
  timestamp: Date.now(),
  contentType: 'text',
});

// ❌ 避免：信息不足
eventBus.emit('content:post:created', {
  id: 'post_123',  // 缺少其他必要信息
});

// ❌ 避免：传递过大对象
eventBus.emit('content:post:created', {
  post: entirePostObject,  // 不要传递整个对象
  author: entireAuthorObject,
});
```

### 6.3 避免内存泄漏

```typescript
// ✅ 正确：保存取消函数并在适当时机调用
const unsubscribe = eventBus.on('event', handler);
// 在组件卸载或不再需要时
unsubscribe();

// ✅ 正确：使用 composable 自动管理
const { on } = useEventBus();
on('event', handler);  // 自动在 unmounted 时清理

// ❌ 错误：忘记取消订阅
eventBus.on('event', handler);  // 永远不会被清理！
```

### 6.4 避免循环触发

```typescript
// ❌ 危险：可能导致无限循环
eventBus.on('data:updated', (data) => {
  processData(data);
  eventBus.emit('data:updated', data);  // 又触发自己！
});

// ✅ 正确：使用不同的事件名
eventBus.on('data:received', (data) => {
  const processed = processData(data);
  eventBus.emit('data:processed', processed);  // 不同的事件
});
```

### 6.5 错误处理

```typescript
// 事件处理函数中的错误不会影响其他处理函数
eventBus.on('event', (data) => {
  try {
    riskyOperation(data);
  } catch (error) {
    console.error('处理事件失败:', error);
    // 可以发布错误事件
    eventBus.emit('app:error', {
      appId: 'myApp',
      errorCode: 'EVENT_HANDLER_ERROR',
      message: error.message,
    });
  }
});
```

---

## 7. 调试技巧

### 7.1 查看已注册事件

```typescript
// 查看所有已注册的事件
console.log('已注册事件:', eventBus.getAllEvents());

// 查看特定事件的监听器数量
console.log('监听器数量:', eventBus.getListenerCount('content:post:created'));
```

### 7.2 事件追踪

```typescript
// 开发环境下追踪所有事件
if (import.meta.env.DEV) {
  const originalEmit = eventBus.emit.bind(eventBus);
  eventBus.emit = (event, payload) => {
    console.log(`[EventBus] ${event}`, payload);
    originalEmit(event, payload);
  };
}
```

### 7.3 在 DevTools 中调试

```typescript
// 将 eventBus 暴露到 window 对象
if (import.meta.env.DEV) {
  (window as any).__eventBus = eventBus;
}

// 然后在控制台中：
// __eventBus.getAllEvents()
// __eventBus.getListenerCount('content:post:created')
```

---

## 8. 常见问题

### Q1: 事件没有被触发？

**检查清单**：

1. 确认事件名拼写正确
2. 确认订阅在发布之前完成
3. 确认没有被提前取消订阅
4. 使用 `getListenerCount()` 检查是否有监听器

### Q2: 事件被多次触发？

**可能原因**：

1. 重复订阅（如组件重新挂载时）
2. 多个地方发布了相同事件
3. 忘记在合适时机取消订阅

**解决方案**：

```typescript
// 使用 ref 避免重复订阅
const isSubscribed = ref(false);

onMounted(() => {
  if (!isSubscribed.value) {
    eventBus.on('event', handler);
    isSubscribed.value = true;
  }
});
```

### Q3: 如何等待某个事件？

```typescript
// 将事件转换为 Promise
function waitForEvent<T>(eventName: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cancel();
      reject(new Error(`等待事件 ${eventName} 超时`));
    }, timeout);
    
    const cancel = eventBus.once(eventName, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// 使用
const data = await waitForEvent('data:loaded', 3000);
```

---

## 9. 相关文档

- [API 参考](./api-reference.md) - 完整 API 文档
- [事件类型](./event-types.md) - 预定义事件
- [实现方案](./implementation.md) - 技术实现
- [README](./README.md) - 服务概述
