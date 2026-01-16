# 搜索服务使用示例

本文档提供搜索服务（Search Service）的详细使用示例。

---

## 基础搜索

### 简单文本搜索

```typescript
import { searchService } from '@/services/search';

// 最简单的搜索
const result = await searchService.search({
  text: '科技发布会',
});

console.log(`找到 ${result.total} 条结果`);
console.log(`搜索耗时 ${result.took}ms`);

result.items.forEach(item => {
  console.log(`[${item.type}] ${item.id} - 相关度: ${item.score.toFixed(2)}`);
});
```

### 限定类型搜索

```typescript
// 只搜索帖子
const posts = await searchService.search({
  text: '苹果手机',
  type: 'post',
});

// 只搜索用户
const users = await searchService.search({
  text: '小明',
  type: 'account',
});

// 同时搜索多种类型
const mixed = await searchService.search({
  text: '游戏',
  type: ['post', 'topic', 'account'],
});
```

---

## 高级搜索

### 带过滤条件的搜索

```typescript
import { searchService } from '@/services/search';

// 搜索特定平台的内容
const weiboResults = await searchService.search({
  text: '热门话题',
  type: 'post',
  filters: [
    { field: 'platformId', operator: 'eq', value: 'weibo' },
  ],
});

// 搜索最近 24 小时的内容
const recentResults = await searchService.search({
  text: '新闻',
  type: 'post',
  filters: [
    { 
      field: 'timestamp', 
      operator: 'gte', 
      value: Date.now() - 24 * 60 * 60 * 1000 
    },
  ],
});

// 组合多个过滤条件
const filtered = await searchService.search({
  text: '科技',
  type: 'post',
  filters: [
    { field: 'platformId', operator: 'eq', value: 'weibo' },
    { field: 'authorId', operator: 'ne', value: 'blocked_user' },
    { field: 'timestamp', operator: 'gte', value: Date.now() - 7 * 24 * 60 * 60 * 1000 },
  ],
});
```

### 排序

```typescript
// 按时间倒序
const byTime = await searchService.search({
  text: '新闻',
  type: 'post',
  sort: { field: 'timestamp', order: 'desc' },
});

// 按相关度排序（默认）
const byRelevance = await searchService.search({
  text: '新闻',
  type: 'post',
  sort: { field: 'score', order: 'desc' },
});
```

### 分页

```typescript
// 第一页
const page1 = await searchService.search({
  text: '热门',
  type: 'post',
  pagination: { offset: 0, limit: 20 },
});

// 第二页
const page2 = await searchService.search({
  text: '热门',
  type: 'post',
  pagination: { offset: 20, limit: 20 },
});

// 检查是否有更多
if (page1.hasMore) {
  console.log('还有更多结果');
}
```

### 高亮显示

```typescript
const result = await searchService.search({
  text: '苹果发布会',
  type: 'post',
  highlight: true,
});

result.items.forEach(item => {
  if (item.highlights) {
    // highlights 包含匹配的高亮片段
    // 例如: { content: ['今天的<em>苹果发布会</em>非常精彩'] }
    console.log('高亮内容:', item.highlights.content?.[0]);
  }
});
```

---

## 模糊搜索

### 基础模糊搜索

```typescript
import { searchService } from '@/services/search';

// 启用模糊匹配，容错拼写错误
const result = await searchService.search({
  text: '苹果发布回',  // 故意写错
  type: 'post',
  fuzzy: true,
});

// 仍能匹配到「苹果发布会」相关内容
console.log(`找到 ${result.total} 条结果`);
```

### 调整模糊距离

```typescript
// 默认编辑距离为 2，可以调整
const strictFuzzy = await searchService.search({
  text: '苹果',
  type: 'post',
  fuzzy: true,
  fuzzyDistance: 1,  // 只允许 1 个字符的差异
});

const looseFuzzy = await searchService.search({
  text: '苹果',
  type: 'post',
  fuzzy: true,
  fuzzyDistance: 3,  // 允许 3 个字符的差异
});
```

---

## 搜索建议

### 基础自动补全

```typescript
import { searchService } from '@/services/search';

// 获取搜索建议
const suggestions = await searchService.suggest('苹果');
// 返回: ['苹果发布会', '苹果手机', '苹果公司', ...]

// 用于搜索框的自动补全
const handleInput = async (input: string) => {
  if (input.length >= 2) {
    const suggestions = await searchService.suggest(input, { limit: 5 });
    showSuggestionDropdown(suggestions);
  }
};
```

### 包含热门和历史

```typescript
const suggestions = await searchService.suggest('科技', {
  limit: 10,
  includePopular: true,   // 包含热门搜索
  includeHistory: true,   // 包含历史搜索
});

// 结果按类型分类显示
const completions = suggestions.filter(s => s.type === 'completion');
const popular = suggestions.filter(s => s.type === 'popular');
const history = suggestions.filter(s => s.type === 'history');
```

### 限定类型的建议

```typescript
// 只推荐用户名
const userSuggestions = await searchService.suggest('小', {
  types: ['account'],
  limit: 5,
});

// 只推荐话题
const topicSuggestions = await searchService.suggest('热', {
  types: ['topic'],
  limit: 5,
});
```

---

## 语义搜索

语义搜索需要配置向量存储后才能使用。

### 配置向量存储

```typescript
import { searchService } from '@/services/search';
import { IndexedDBVectorStore } from '@/services/search/vectorStore';

// 配置本地向量存储
searchService.setVectorStore(new IndexedDBVectorStore({
  dimensions: 384,
  embedder: {
    type: 'local',
    model: 'all-MiniLM-L6-v2',
  },
}));
```

### 使用语义搜索

```typescript
// 语义搜索 - 理解查询意图
const result = await searchService.semanticSearch('角色之间的冲突', {
  topK: 10,
  threshold: 0.7,
  types: ['archive'],
});

// 结果按语义相似度排序
result.items.forEach(item => {
  console.log(`相似度: ${item.score.toFixed(2)} - ${item.data.title}`);
});
```

### 混合搜索（全文 + 语义）

```typescript
// 先进行全文搜索，如果结果不足再用语义搜索补充
async function hybridSearch(query: string, minResults = 10) {
  // 1. 全文搜索
  const textResults = await searchService.search({
    text: query,
    type: 'post',
    pagination: { offset: 0, limit: minResults },
  });
  
  if (textResults.total >= minResults) {
    return textResults;
  }
  
  // 2. 补充语义搜索结果
  const semanticResults = await searchService.semanticSearch(query, {
    topK: minResults - textResults.total,
    threshold: 0.6,
  });
  
  // 3. 合并去重
  const seenIds = new Set(textResults.items.map(i => i.id));
  const combined = [
    ...textResults.items,
    ...semanticResults.items.filter(i => !seenIds.has(i.id)),
  ];
  
  return {
    items: combined,
    total: combined.length,
    took: textResults.took + semanticResults.took,
    hasMore: false,
  };
}
```

---

## 索引管理

### 索引新内容

```typescript
import { searchService } from '@/services/search';

// 索引单个帖子
await searchService.index({
  id: 'post_123',
  type: 'post',
  content: '今天的科技发布会太精彩了！新产品让人眼前一亮。',
  metadata: {
    authorId: 'user_456',
    platformId: 'weibo',
    timestamp: Date.now(),
    tags: ['科技', '发布会'],
  },
});

// 索引用户
await searchService.index({
  id: 'user_789',
  type: 'account',
  content: '小明 科技博主 数码爱好者',  // 可搜索的文本
  metadata: {
    username: '小明',
    bio: '科技博主，热爱数码产品',
    platformId: 'weibo',
  },
});

// 索引话题
await searchService.index({
  id: 'topic_001',
  type: 'topic',
  content: '苹果发布会 Apple Event iPhone',
  metadata: {
    title: '苹果发布会',
    popularity: 9999,
  },
});
```

### 批量索引

```typescript
// 批量索引效率更高
const posts = await fetchLatestPosts();

await searchService.indexBatch(
  posts.map(post => ({
    id: post.id,
    type: 'post',
    content: `${post.title || ''} ${post.content}`,
    metadata: {
      authorId: post.authorId,
      platformId: post.platformId,
      timestamp: post.timestamp,
    },
  }))
);
```

### 删除索引

```typescript
// 删除单个内容的索引
await searchService.remove('post_123', 'post');

// 删除用户的索引
await searchService.remove('user_789', 'account');
```

### 重建索引

```typescript
// 重建所有帖子索引
await searchService.reindex('post');

// 重建所有索引
await searchService.reindex();
```

### 获取索引统计

```typescript
const stats = await searchService.getStats();

console.log('索引统计:');
console.log(`- 帖子: ${stats.documentCounts.post} 篇`);
console.log(`- 用户: ${stats.documentCounts.account} 个`);
console.log(`- 话题: ${stats.documentCounts.topic} 个`);
console.log(`- 词汇表大小: ${stats.vocabularySize}`);
console.log(`- 索引大小: ${(stats.indexSize / 1024).toFixed(2)} KB`);
console.log(`- 最后更新: ${new Date(stats.lastUpdated).toLocaleString()}`);
```

---

## 与 App 集成

### 微博搜索组件

```vue
<template>
  <div class="search-container">
    <!-- 搜索输入框 -->
    <input
      v-model="searchQuery"
      @input="handleInput"
      @keyup.enter="handleSearch"
      placeholder="搜索微博、用户、话题"
    />
    
    <!-- 搜索建议下拉 -->
    <ul v-if="suggestions.length > 0" class="suggestions">
      <li
        v-for="suggestion in suggestions"
        :key="suggestion.text"
        @click="selectSuggestion(suggestion)"
      >
        <span class="type-badge">{{ suggestion.type }}</span>
        {{ suggestion.text }}
      </li>
    </ul>
    
    <!-- 搜索结果 -->
    <div v-if="results" class="results">
      <p>找到 {{ results.total }} 条结果 ({{ results.took }}ms)</p>
      <div v-for="item in results.items" :key="item.id" class="result-item">
        <WeiboPostCard v-if="item.type === 'post'" :post="item.data" />
        <UserCard v-else-if="item.type === 'account'" :user="item.data" />
        <TopicCard v-else-if="item.type === 'topic'" :topic="item.data" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { searchService } from '@/services/search';
import { useDebounceFn } from '@vueuse/core';

const searchQuery = ref('');
const suggestions = ref<SuggestionItem[]>([]);
const results = ref<SearchResult | null>(null);

// 防抖的输入处理
const handleInput = useDebounceFn(async () => {
  if (searchQuery.value.length < 2) {
    suggestions.value = [];
    return;
  }
  
  suggestions.value = await searchService.suggest(searchQuery.value, {
    limit: 8,
    includePopular: true,
  });
}, 200);

// 执行搜索
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return;
  
  suggestions.value = [];
  results.value = await searchService.search({
    text: searchQuery.value,
    type: ['post', 'account', 'topic'],
    filters: [
      { field: 'platformId', operator: 'eq', value: 'weibo' },
    ],
    pagination: { offset: 0, limit: 20 },
    highlight: true,
  });
};

// 选择建议
const selectSuggestion = (suggestion: SuggestionItem) => {
  searchQuery.value = suggestion.text;
  handleSearch();
};
</script>
```

### 自动索引新内容

```typescript
// 在社交引擎中集成
class SocialMediaEngine {
  async createPost(post: UniversalPost): Promise<void> {
    // 1. 保存帖子
    await this.savePost(post);
    
    // 2. 索引帖子内容
    await searchService.index({
      id: post.id,
      type: 'post',
      content: this.extractSearchableText(post),
      metadata: {
        authorId: post.authorId,
        platformId: post.platformId,
        timestamp: post.timestamp,
        tags: post.topicTags,
      },
    });
  }
  
  private extractSearchableText(post: UniversalPost): string {
    const parts: string[] = [];
    
    if (post.payload.title) parts.push(post.payload.title);
    if (post.payload.text) parts.push(post.payload.text);
    if (post.topicTags) parts.push(...post.topicTags);
    
    return parts.join(' ');
  }
}
```

---

## 错误处理

```typescript
import { searchService } from '@/services/search';

try {
  const result = await searchService.search({
    text: 'test',
    type: 'post',
  });
} catch (error) {
  if (error instanceof SearchIndexError) {
    console.error('索引错误:', error.message);
    // 尝试重建索引
    await searchService.reindex();
  } else if (error instanceof TokenizerError) {
    console.error('分词错误:', error.message);
  } else {
    console.error('搜索失败:', error);
  }
}
```

---

## 性能优化建议

### 1. 使用批量操作

```typescript
// ❌ 不好：逐个索引
for (const post of posts) {
  await searchService.index(post);
}

// ✅ 好：批量索引
await searchService.indexBatch(posts);
```

### 2. 合理使用分页

```typescript
// ❌ 不好：一次获取太多
const result = await searchService.search({
  text: 'query',
  pagination: { offset: 0, limit: 1000 },
});

// ✅ 好：分页加载
const result = await searchService.search({
  text: 'query',
  pagination: { offset: 0, limit: 20 },
});
```

### 3. 缓存搜索结果

```typescript
import { useLocalStorage } from '@vueuse/core';

// 缓存最近的搜索结果
const searchCache = useLocalStorage<Record<string, SearchResult>>('search-cache', {});

async function cachedSearch(query: SearchQuery): Promise<SearchResult> {
  const key = JSON.stringify(query);
  
  if (searchCache.value[key]) {
    return searchCache.value[key];
  }
  
  const result = await searchService.search(query);
  searchCache.value[key] = result;
  return result;
}
```
