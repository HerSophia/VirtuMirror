# 搜索服务使用示例

## 1. 基础搜索

```typescript
import { searchService } from '@/services/search';

const result = await searchService.search({
  text: '科技发布会',
  type: 'post',
  pagination: { offset: 0, limit: 20 },
});

console.log(result.total, result.took);
```

## 2. 带过滤条件的搜索

```typescript
const result = await searchService.search({
  text: '芯片',
  type: 'post',
  filters: [
    { field: 'platformId', operator: 'eq', value: 'weibo' },
    { field: 'timestamp', operator: 'gte', value: Date.now() - 7 * 24 * 60 * 60 * 1000 },
  ],
  sort: { field: 'timestamp', order: 'desc' },
  pagination: { offset: 0, limit: 10 },
});
```

## 3. 搜索建议（Suggest）

```typescript
const suggestions = await searchService.suggest('科', {
  limit: 5,
  types: ['post', 'topic'],
  includePopular: true,
});

// [{ text: '科技发布会', type: 'completion', score: 0.92 }, ...]
```

## 4. 索引单条文档

```typescript
await searchService.index({
  id: 'post_001',
  type: 'post',
  content: '今晚直播讨论 AIGC 与移动端创作工具',
  metadata: {
    platformId: 'weibo',
    authorId: 'acc_001',
    tags: ['AIGC', '直播'],
    timestamp: Date.now(),
  },
});
```

## 5. 批量索引

```typescript
await searchService.indexBatch(
  posts.map((post) => ({
    id: post.id,
    type: 'post',
    content: `${post.payload.title ?? ''} ${post.payload.text ?? ''}`.trim(),
    metadata: {
      platformId: post.platformId,
      authorId: post.authorId,
      timestamp: post.timestamp,
    },
  })),
);
```

## 6. 更新与删除索引

```typescript
// 更新：直接重新 index 同 id 文档（内部会先删旧 postings）
await searchService.index({
  id: 'post_001',
  type: 'post',
  content: '更新后的正文：补充了更多测试结论',
  metadata: { platformId: 'weibo', timestamp: Date.now() },
});

// 删除
await searchService.remove('post_001', 'post');
```

## 7. 重建索引

```typescript
// 仅重建某类型
await searchService.reindex('archive');

// 或全量重建（谨慎）
await searchService.reindex();
```

## 8. 在 UI 中接入搜索框

```typescript
import { debounce } from '@/utils/debounce';

const onInput = debounce(async (keyword: string) => {
  if (!keyword.trim()) return;

  const [suggestions, result] = await Promise.all([
    searchService.suggest(keyword, { limit: 5 }),
    searchService.search({
      text: keyword,
      type: ['post', 'topic'],
      pagination: { offset: 0, limit: 20 },
    }),
  ]);

  renderSuggestions(suggestions);
  renderResult(result.items);
}, 180);
```

## 9. 监控与调试

```typescript
const stats = await searchService.getStats();
console.log('[search stats]', stats);

// 推荐在调用点记录：关键词、类型、耗时、命中数
```
