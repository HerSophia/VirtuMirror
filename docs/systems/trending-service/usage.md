# Trending Service 使用示例

## 1. 在微博热搜 Store 中使用

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { trendingService } from '@/services/trending';

export const useHotSearchStore = defineStore('hotSearch', () => {
  const list = ref([]);
  const loading = ref(false);

  async function refresh() {
    loading.value = true;
    try {
      list.value = await trendingService.getTrending('weibo', {
        limit: 50,
      });
    } finally {
      loading.value = false;
    }
  }

  async function enterTopic(topicId: string) {
    await trendingService.ensureTopicContent(topicId);
  }

  return { list, loading, refresh, enterTopic };
});
```

## 2. 平台配置注册

```typescript
import { trendingService } from '@/services/trending';

trendingService.registerPlatformConfig('weibo', {
  maxItems: 50,
  categories: ['娱乐', '社会', '科技', '体育'],
  refreshInterval: 300000,
  hotThreshold: 10000,
  allowSponsored: true,
});

trendingService.registerPlatformConfig('bilibili', {
  maxItems: 10,
  categories: ['动画', '游戏', '生活'],
  refreshInterval: 600000,
  hotThreshold: 8000,
  allowSponsored: false,
});
```

## 3. 与 DirectorService 联动

```typescript
import { directorService } from '@/services/social/directorService';
import { trendingService } from '@/services/trending';

const event = await directorService.generateGlobalEvent(Date.now());
if (event) {
  await trendingService.createFromEvent(event, {
    categories: ['general'],
  });
}
```

## 4. 跨 App 热搜共享

```typescript
import { trendingService } from '@/services/trending';

trendingService.setSharePolicy('weibo', {
  enabled: true,
  allowedConsumers: ['*'],
  excludeCategories: ['广告'],
});

const shared = await trendingService.getSharedTrending('forum', {
  limit: 15,
});
```

## 5. 订阅热搜更新事件

```typescript
const unsubscribe = trendingService.onTrendingUpdate((event) => {
  if (event.type === 'ranking_updated' && event.platformId === 'weibo') {
    // 刷新当前 UI
  }
});

// 页面卸载时
unsubscribe();
```

## 6. 预加载热门话题内容

```typescript
const topics = await trendingService.getTrending('weibo', { limit: 10 });
await trendingService.preloadTopicContent(topics.slice(0, 3).map((t) => t.id));
```
