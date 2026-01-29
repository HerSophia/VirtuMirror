# API 参考

> 本文档提供 Context Sharing Service 的完整 API 接口文档。

## 1. 核心接口

### IContextSharingService

```typescript
/**
 * Context Sharing Service 主接口
 */
interface IContextSharingService {
  // ============ 发布上下文 ============
  
  /**
   * 发布一个共享上下文
   * @param context 上下文定义
   * @returns 上下文 ID
   */
  publish<T>(context: PublishContextOptions<T>): string;
  
  /**
   * 更新已发布的上下文值（部分更新）
   * @param id 上下文 ID
   * @param value 新值（部分更新）
   */
  update<T>(id: string, value: Partial<T>): void;
  
  /**
   * 替换上下文值（完全替换）
   * @param id 上下文 ID
   * @param value 新值
   */
  replace<T>(id: string, value: T): void;
  
  /**
   * 取消发布上下文
   * @param id 上下文 ID
   */
  unpublish(id: string): void;
  
  // ============ 订阅上下文 ============
  
  /**
   * 订阅单个上下文
   * @param id 上下文 ID
   * @param callback 值变化回调
   * @returns 取消订阅函数
   */
  subscribe<T>(id: string, callback: (value: T) => void): () => void;
  
  /**
   * 订阅某类型的所有上下文
   * @param type 上下文类型
   * @param callback 值变化回调
   * @returns 取消订阅函数
   */
  subscribeByType<T>(
    type: ContextType,
    callback: (contexts: Map<string, T>) => void
  ): () => void;
  
  // ============ 获取上下文 ============
  
  /**
   * 获取单个上下文当前值（同步）
   * @param id 上下文 ID
   * @returns 上下文值，不存在时返回 undefined
   */
  get<T>(id: string): T | undefined;
  
  /**
   * 异步获取上下文值（支持惰性求值）
   * @param id 上下文 ID
   * @returns 上下文值
   */
  getAsync<T>(id: string): Promise<T | undefined>;
  
  /**
   * 获取某类型的所有上下文
   * @param type 上下文类型
   * @returns 上下文 Map
   */
  getByType<T>(type: ContextType): Map<string, T>;
  
  /**
   * 获取指定发布者的所有上下文
   * @param publisherId 发布者 App ID
   * @returns 上下文元信息数组
   */
  getByPublisher(publisherId: string): SharedContextMeta[];
  
  // ============ 聚合查询 ============
  
  /**
   * 聚合多个上下文（用于 LLM 提示词构建）
   * @param request 聚合请求
   * @returns 聚合结果
   */
  aggregate(request: AggregationRequest): Promise<AggregatedContext>;
  
  // ============ 查询与发现 ============
  
  /**
   * 获取所有公开上下文的元信息
   * @returns 公开上下文元信息数组
   */
  listPublic(): SharedContextMeta[];
  
  /**
   * 搜索上下文
   * @param query 搜索条件
   * @returns 匹配的上下文元信息数组
   */
  search(query: ContextSearchQuery): SharedContextMeta[];
}
```

---

## 2. 发布相关

### publish

发布一个共享上下文。

```typescript
publish<T>(context: PublishContextOptions<T>): string
```

**参数**：

```typescript
interface PublishContextOptions<T> {
  /** 上下文 ID（可选，自动生成）*/
  id?: string;
  
  /** 上下文类型 */
  type: ContextType;
  
  /** 描述 */
  description: string;
  
  /** 初始值 */
  value?: T;
  
  /** 惰性获取器（与 value 二选一）*/
  getter?: () => T | Promise<T>;
  
  /** 可见性（默认 public）*/
  visibility?: ContextVisibility;
  
  /** 缓存配置 */
  cache?: {
    ttl?: number;
    staleWhileRevalidate?: boolean;
  };
}
```

**返回值**：上下文 ID

**示例**：

```typescript
// 直接值
const id = contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  value: trendStore.trendingList,
  visibility: { level: 'public' },
  cache: { ttl: 5 * 60 * 1000 },
});

// 惰性获取器
contextSharingService.publish({
  type: 'narrative:content',
  description: '当前叙事',
  getter: async () => await narrativeService.getCurrent(),
  cache: { ttl: 30 * 1000, staleWhileRevalidate: true },
});
```

### update

更新已发布的上下文值（部分更新）。

```typescript
update<T>(id: string, value: Partial<T>): void
```

**示例**：

```typescript
// 部分更新
contextSharingService.update('user:status', {
  online: true,
  lastSeen: Date.now(),
});
```

### replace

替换上下文值（完全替换）。

```typescript
replace<T>(id: string, value: T): void
```

**示例**：

```typescript
// 完全替换
contextSharingService.replace('weibo:trending', newTrendingList);
```

### unpublish

取消发布上下文。

```typescript
unpublish(id: string): void
```

**示例**：

```typescript
contextSharingService.unpublish('weibo:trending');
```

---

## 3. 订阅相关

### subscribe

订阅单个上下文的变化。

```typescript
subscribe<T>(id: string, callback: (value: T) => void): () => void
```

**返回值**：取消订阅函数

**示例**：

```typescript
const unsubscribe = contextSharingService.subscribe<TrendItem[]>(
  'weibo:trending',
  (trending) => {
    console.log('热搜更新:', trending);
    refreshUI(trending);
  }
);

// 取消订阅
onUnmounted(() => unsubscribe());
```

### subscribeByType

订阅某类型的所有上下文。

```typescript
subscribeByType<T>(
  type: ContextType,
  callback: (contexts: Map<string, T>) => void
): () => void
```

**示例**：

```typescript
// 订阅所有社交热点
const unsubscribe = contextSharingService.subscribeByType<TrendItem[]>(
  'social:trending',
  (allTrending) => {
    // allTrending 是 Map<string, TrendItem[]>
    // 包含所有发布者的热搜
    for (const [id, trending] of allTrending) {
      console.log(`${id}:`, trending);
    }
  }
);
```

---

## 4. 获取相关

### get

同步获取上下文当前值。

```typescript
get<T>(id: string): T | undefined
```

**注意**：如果上下文使用 getter 且缓存已过期，返回 undefined。

**示例**：

```typescript
const trending = contextSharingService.get<TrendItem[]>('weibo:trending');
if (trending) {
  console.log('热搜数量:', trending.length);
}
```

### getAsync

异步获取上下文值（支持惰性求值）。

```typescript
getAsync<T>(id: string): Promise<T | undefined>
```

**示例**：

```typescript
const narrative = await contextSharingService.getAsync<string>('narrative:current');
if (narrative) {
  console.log('叙事内容:', narrative);
}
```

### getByType

获取某类型的所有上下文。

```typescript
getByType<T>(type: ContextType): Map<string, T>
```

**示例**：

```typescript
const allTrending = contextSharingService.getByType<TrendItem[]>('social:trending');
for (const [id, trending] of allTrending) {
  console.log(`${id}:`, trending.length, '条热搜');
}
```

### getByPublisher

获取指定发布者的所有上下文。

```typescript
getByPublisher(publisherId: string): SharedContextMeta[]
```

**示例**：

```typescript
const weiboContexts = contextSharingService.getByPublisher('weibo');
console.log('微博发布的上下文:', weiboContexts.map(c => c.id));
```

---

## 5. 聚合相关

### aggregate

聚合多个上下文，用于构建 LLM 提示词。

```typescript
aggregate(request: AggregationRequest): Promise<AggregatedContext>
```

**参数**：

```typescript
interface AggregationRequest {
  /** 请求者 App ID */
  requesterId: string;
  
  /** 需要的上下文类型 */
  types?: ContextType[];
  
  /** 需要的特定上下文 ID */
  ids?: string[];
  
  /** 格式化选项 */
  format?: 'raw' | 'text' | 'xml' | 'markdown';
  
  /** 最大 token 数（用于 LLM）*/
  maxTokens?: number;
  
  /** 优先级排序 */
  priority?: ContextType[];
}
```

**返回值**：

```typescript
interface AggregatedContext {
  contexts: Map<ContextType, any[]>;
  formatted?: string;
  meta: {
    totalContexts: number;
    types: ContextType[];
    estimatedTokens?: number;
    truncated?: boolean;
  };
}
```

**示例**：

```typescript
const aggregated = await contextSharingService.aggregate({
  requesterId: 'weibo',
  types: [
    'narrative:content',
    'social:trending',
    'user:currentAccount',
  ],
  format: 'xml',
  maxTokens: 2000,
  priority: ['narrative:content'],  // 叙事优先
});

console.log('聚合上下文:', aggregated.formatted);
console.log('预估 tokens:', aggregated.meta.estimatedTokens);
```

---

## 6. 查询相关

### listPublic

获取所有公开上下文的元信息。

```typescript
listPublic(): SharedContextMeta[]
```

**示例**：

```typescript
const publicContexts = contextSharingService.listPublic();
for (const ctx of publicContexts) {
  console.log(`${ctx.id}: ${ctx.description}`);
}
```

### search

搜索上下文。

```typescript
search(query: ContextSearchQuery): SharedContextMeta[]
```

**参数**：

```typescript
interface ContextSearchQuery {
  /** 按类型筛选 */
  type?: ContextType;
  
  /** 按发布者筛选 */
  publisherId?: string;
  
  /** 按关键词筛选（匹配 id 或 description）*/
  keyword?: string;
}
```

**示例**：

```typescript
// 搜索所有叙事相关上下文
const narrativeContexts = contextSharingService.search({
  type: 'narrative:content',
});

// 搜索微博发布的上下文
const weiboContexts = contextSharingService.search({
  publisherId: 'weibo',
});

// 按关键词搜索
const trendingContexts = contextSharingService.search({
  keyword: 'trending',
});
```

---

## 7. Vue Composables

### useContext

订阅单个上下文的响应式值。

```typescript
function useContext<T>(id: string): {
  value: Ref<T | undefined>;
  loading: Ref<boolean>;
}
```

**示例**：

```vue
<template>
  <div v-if="loading">加载中...</div>
  <div v-else-if="trending">
    <div v-for="item in trending" :key="item.id">{{ item.title }}</div>
  </div>
</template>

<script setup>
import { useContext } from '@/composables/useContextSharing';

const { value: trending, loading } = useContext<TrendItem[]>('weibo:trending');
</script>
```

### useContextsByType

订阅某类型的所有上下文。

```typescript
function useContextsByType<T>(type: ContextType): Ref<Map<string, T>>
```

**示例**：

```vue
<script setup>
import { useContextsByType } from '@/composables/useContextSharing';

const allTrending = useContextsByType<TrendItem[]>('social:trending');
</script>
```

### usePublishContext

发布并自动同步上下文。

```typescript
function usePublishContext<T>(
  options: Omit<PublishContextOptions<T>, 'value'>,
  source: () => T
): string
```

**示例**：

```vue
<script setup>
import { computed } from 'vue';
import { usePublishContext } from '@/composables/useContextSharing';
import { useTrendStore } from '@/stores/trendStore';

const trendStore = useTrendStore();

// 自动发布并同步
const contextId = usePublishContext(
  {
    type: 'social:trending',
    description: '微博热搜榜',
    visibility: { level: 'public' },
  },
  () => trendStore.trendingList
);
</script>
```
