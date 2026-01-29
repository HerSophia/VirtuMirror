# 使用指南

> 本文档提供 Context Sharing Service 的详细使用示例和最佳实践。

## 1. 初始化

### 1.1 服务导入

```typescript
import { contextSharingService } from '@/services/contextSharing';
```

### 1.2 服务自动初始化

Context Sharing Service 是单例服务，导入时自动初始化，无需手动初始化。

---

## 2. 发布上下文

### 2.1 发布静态值

```typescript
// 发布热搜列表
contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  value: [
    { id: '1', title: '热搜话题1', heat: 1000000 },
    { id: '2', title: '热搜话题2', heat: 800000 },
  ],
  visibility: { level: 'public' },
});
```

### 2.2 发布动态值（惰性获取器）

```typescript
// 使用 getter 进行惰性求值
contextSharingService.publish({
  id: 'narrative:current',
  type: 'narrative:content',
  description: '当前叙事内容',
  getter: async () => {
    // 只有在获取时才执行
    const narrative = await narrativeService.getCurrentNarrative();
    return narrative?.content || '';
  },
  cache: {
    ttl: 30 * 1000,  // 缓存 30 秒
    staleWhileRevalidate: true,
  },
});
```

### 2.3 发布带缓存的上下文

```typescript
// 带缓存的热搜
contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  getter: async () => {
    return await trendService.fetchTrending();
  },
  cache: {
    ttl: 5 * 60 * 1000,  // 5 分钟缓存
  },
});
```

### 2.4 发布带权限控制的上下文

```typescript
// 仅特定 App 可见
contextSharingService.publish({
  id: 'internal:debug-info',
  type: 'custom:debug',
  description: '调试信息',
  value: { version: '1.0.0', buildTime: Date.now() },
  visibility: {
    level: 'restricted',
    allowedApps: ['dev-tools', 'admin'],
  },
});

// 排除特定 App
contextSharingService.publish({
  id: 'user:activity',
  type: 'user:recentActions',
  description: '用户最近活动',
  value: userActions,
  visibility: {
    level: 'public',
    excludedApps: ['analytics'],  // 分析工具不需要
  },
});
```

### 2.5 更新上下文

```typescript
// 部分更新（合并）
contextSharingService.update('user:status', {
  online: true,
  lastSeen: Date.now(),
});

// 完全替换
contextSharingService.replace('weibo:trending', newTrendingList);
```

### 2.6 取消发布

```typescript
// 取消发布
contextSharingService.unpublish('weibo:trending');
```

---

## 3. 订阅上下文

### 3.1 订阅单个上下文

```typescript
const unsubscribe = contextSharingService.subscribe<TrendItem[]>(
  'weibo:trending',
  (trending) => {
    console.log('热搜更新:', trending);
    // 处理更新...
  }
);

// 取消订阅
onUnmounted(() => unsubscribe());
```

### 3.2 订阅某类型的所有上下文

```typescript
const unsubscribe = contextSharingService.subscribeByType<TrendItem[]>(
  'social:trending',
  (allTrending) => {
    // allTrending 包含所有发布者的热搜
    for (const [id, trending] of allTrending) {
      console.log(`${id}:`, trending.length, '条热搜');
    }
  }
);
```

### 3.3 在 Vue 组件中使用

```vue
<template>
  <div class="trending-list">
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else-if="trending">
      <div v-for="item in trending" :key="item.id" class="trending-item">
        <span class="rank">{{ item.rank }}</span>
        <span class="title">{{ item.title }}</span>
        <span class="heat">{{ formatHeat(item.heat) }}</span>
      </div>
    </template>
    <div v-else class="empty">暂无热搜</div>
  </div>
</template>

<script setup lang="ts">
import { useContext } from '@/composables/useContextSharing';

interface TrendItem {
  id: string;
  rank: number;
  title: string;
  heat: number;
}

const { value: trending, loading } = useContext<TrendItem[]>('weibo:trending');

function formatHeat(heat: number): string {
  if (heat >= 10000) return `${(heat / 10000).toFixed(1)}万`;
  return heat.toString();
}
</script>
```

---

## 4. 获取上下文

### 4.1 同步获取

```typescript
// 同步获取（如果有缓存）
const trending = contextSharingService.get<TrendItem[]>('weibo:trending');
if (trending) {
  console.log('热搜数量:', trending.length);
}
```

### 4.2 异步获取

```typescript
// 异步获取（支持 getter 惰性求值）
const narrative = await contextSharingService.getAsync<string>('narrative:current');
if (narrative) {
  console.log('叙事内容:', narrative.substring(0, 100));
}
```

### 4.3 按类型获取

```typescript
// 获取所有社交热点
const allTrending = contextSharingService.getByType<TrendItem[]>('social:trending');

// 合并所有热搜
const mergedTrending: TrendItem[] = [];
for (const [, trending] of allTrending) {
  mergedTrending.push(...trending);
}
```

### 4.4 按发布者获取

```typescript
// 获取微博发布的所有上下文
const weiboContexts = contextSharingService.getByPublisher('weibo');
for (const ctx of weiboContexts) {
  console.log(`${ctx.id}: ${ctx.description}`);
}
```

---

## 5. 聚合上下文

### 5.1 基本聚合

```typescript
const aggregated = await contextSharingService.aggregate({
  requesterId: 'my-app',
  types: [
    'narrative:content',
    'social:trending',
  ],
});

// 访问原始数据
for (const [type, items] of aggregated.contexts) {
  console.log(`${type}:`, items);
}
```

### 5.2 格式化聚合

```typescript
// XML 格式（适合 LLM）
const xmlAggregated = await contextSharingService.aggregate({
  requesterId: 'llm-task',
  types: [
    'narrative:content',
    'social:trending',
    'user:currentAccount',
  ],
  format: 'xml',
});

console.log(xmlAggregated.formatted);
// 输出:
// <context type="narrative:content">
//   <item id="narrative:current">叙事内容...</item>
// </context>
// ...
```

### 5.3 带 token 限制的聚合

```typescript
// 限制 token 数量
const limitedAggregated = await contextSharingService.aggregate({
  requesterId: 'llm-task',
  types: [
    'narrative:content',
    'social:trending',
    'chat:recentHistory',
    'archive:pinned',
  ],
  format: 'text',
  maxTokens: 2000,
  priority: ['narrative:content', 'social:trending'],  // 优先保留
});

if (limitedAggregated.meta.truncated) {
  console.warn('上下文被截断');
}
```

### 5.4 在 LLM 任务中使用

```typescript
import { contextSharingService } from '@/services/contextSharing';
import { AIGenerateService } from '@/services/aiGenerateService';

async function generatePost() {
  // 聚合上下文
  const aggregated = await contextSharingService.aggregate({
    requesterId: 'weibo',
    types: [
      'narrative:content',
      'social:trending',
      'user:currentAccount',
    ],
    format: 'xml',
    maxTokens: 1500,
  });
  
  // 构建提示词
  const systemPrompt = `你是一个社交媒体内容生成助手。

${aggregated.formatted}

请根据以上上下文，生成一条微博帖子。`;
  
  // 调用 LLM
  const result = await AIGenerateService.generate({
    systemPrompt,
    userPrompt: '请生成帖子',
    options: { temperature: 0.7 },
  });
  
  return result;
}
```

---

## 6. 最佳实践

### 6.1 命名规范

```typescript
// 推荐的 ID 格式: {appId}:{contextName}
contextSharingService.publish({
  id: 'weibo:trending',      // 微博热搜
  id: 'bilibili:hot-videos', // B站热门视频
  id: 'system:time',         // 系统时间
  id: 'narrative:current',   // 当前叙事
});
```

### 6.2 缓存策略

```typescript
// 高频变化数据：短缓存 + staleWhileRevalidate
contextSharingService.publish({
  id: 'chat:lastMessage',
  type: 'chat:lastMessage',
  getter: () => chatStore.lastMessage,
  cache: {
    ttl: 5 * 1000,  // 5 秒
    staleWhileRevalidate: true,
  },
});

// 低频变化数据：长缓存
contextSharingService.publish({
  id: 'user:preferences',
  type: 'user:preferences',
  getter: () => userStore.preferences,
  cache: {
    ttl: 60 * 60 * 1000,  // 1 小时
  },
});
```

### 6.3 清理资源

```typescript
// 在组件/模块卸载时清理
onUnmounted(() => {
  // 取消订阅
  unsubscribe();
  
  // 取消发布（如果是该组件发布的）
  contextSharingService.unpublish('my-context');
});
```

### 6.4 错误处理

```typescript
// getter 中的错误处理
contextSharingService.publish({
  id: 'external:data',
  type: 'custom:external',
  getter: async () => {
    try {
      return await fetchExternalData();
    } catch (error) {
      console.error('获取外部数据失败:', error);
      return null;  // 返回默认值
    }
  },
});
```

### 6.5 类型安全

```typescript
// 定义上下文值类型
interface TrendItem {
  id: string;
  title: string;
  heat: number;
  category?: string;
}

// 发布时使用泛型
contextSharingService.publish<TrendItem[]>({
  id: 'weibo:trending',
  type: 'social:trending',
  value: trendingList,  // 类型检查
});

// 获取时使用泛型
const trending = contextSharingService.get<TrendItem[]>('weibo:trending');
// trending 类型为 TrendItem[] | undefined
```

---

## 7. 常见问题

### Q: 上下文不更新怎么办？

**A**: 检查以下几点：
1. 确认已调用 `update` 或 `replace` 更新值
2. 如果使用 getter，检查缓存是否过期
3. 确认订阅回调没有抛出错误

### Q: 如何调试上下文？

**A**: 使用以下方法：

```typescript
// 列出所有公开上下文
const allContexts = contextSharingService.listPublic();
console.log('所有上下文:', allContexts);

// 搜索特定上下文
const found = contextSharingService.search({ keyword: 'trending' });
console.log('搜索结果:', found);
```

### Q: getter 和 value 如何选择？

**A**: 
- 使用 `value`：数据已知、静态数据、简单数据
- 使用 `getter`：需要计算、异步获取、动态数据

### Q: 缓存过期后会发生什么？

**A**: 
- 默认：下次获取时重新执行 getter
- `staleWhileRevalidate: true`：返回旧值，后台更新
