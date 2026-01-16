# 搜索服务系统集成

本文档描述搜索服务（Search Service）与其他系统服务的集成方式。

---

## 集成架构

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              应用层                                          │
│   微博 App │ B站 App │ 知乎 App │ 档案 App │ 聊天 App │ 全局搜索            │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SearchService                                      │
│                           (搜索服务)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
          │              │              │              │              │
          ▼              ▼              ▼              ▼              ▼
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│ Social     │  │ Archive    │  │ Account    │  │ IM         │  │ Trending   │
│ Media      │  │ Service    │  │ Service    │  │ Service    │  │ Service    │
│ Engine     │  │ (档案)     │  │ (账号)     │  │ (即时通讯) │  │ (热搜)     │
│            │  │            │  │            │  │            │  │            │
│ 帖子索引   │  │ 档案索引   │  │ 用户索引   │  │ 消息索引   │  │ 话题索引   │
│ 评论索引   │  │ 语义搜索   │  │ 账号搜索   │  │ 聊天搜索   │  │ 热搜联想   │
└────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘
          │              │              │              │              │
          └──────────────┴──────────────┴──────────────┴──────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EventBus (事件总线)                                │
│   content:created │ account:updated │ archive:saved │ message:sent          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 与社交媒体引擎集成

### 自动索引帖子

当社交媒体引擎创建新帖子时，自动索引到搜索服务。

```typescript
// src/services/social/socialMediaEngine.ts
import { searchService } from '@/services/search';
import { eventBus } from '@/services/eventBus';

class SocialMediaEngine {
  async createPost(post: UniversalPost): Promise<void> {
    // 1. 保存帖子到数据库
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
        primaryType: post.primaryType,
      },
    });
    
    // 3. 发布事件
    eventBus.emit('content:post:created', { postId: post.id });
  }
  
  async deletePost(postId: string): Promise<void> {
    // 1. 删除帖子
    await this.removePost(postId);
    
    // 2. 删除索引
    await searchService.remove(postId, 'post');
    
    // 3. 发布事件
    eventBus.emit('content:post:deleted', { postId });
  }
  
  private extractSearchableText(post: UniversalPost): string {
    const parts: string[] = [];
    
    // 标题
    if (post.payload.title) {
      parts.push(post.payload.title);
    }
    
    // 正文
    if (post.payload.text) {
      parts.push(post.payload.text);
    }
    
    // 话题标签
    if (post.topicTags && post.topicTags.length > 0) {
      parts.push(...post.topicTags);
    }
    
    // 作者信息（用于 @搜索）
    const author = await accountService.getAccount(post.authorId);
    if (author) {
      parts.push(author.name);
      if (author.username) parts.push(author.username);
    }
    
    return parts.join(' ');
  }
}
```

### 评论索引

```typescript
class CommentService {
  async addComment(comment: Comment): Promise<void> {
    // 保存评论
    await this.saveComment(comment);
    
    // 索引评论
    await searchService.index({
      id: comment.id,
      type: 'comment',
      content: comment.text,
      metadata: {
        postId: comment.postId,
        authorId: comment.authorId,
        platformId: comment.platformId,
        timestamp: comment.timestamp,
      },
    });
  }
}
```

### 搜索帖子

```typescript
// 在微博 App 中使用
async function searchPosts(query: string): Promise<UniversalPost[]> {
  const result = await searchService.search({
    text: query,
    type: 'post',
    filters: [
      { field: 'platformId', operator: 'eq', value: 'weibo' },
    ],
    pagination: { offset: 0, limit: 20 },
    highlight: true,
  });
  
  // 获取完整的帖子数据
  const postIds = result.items.map(item => item.id);
  const posts = await socialMediaEngine.getPostsByIds(postIds);
  
  // 按搜索结果顺序排列
  const postMap = new Map(posts.map(p => [p.id, p]));
  return result.items
    .map(item => postMap.get(item.id))
    .filter(Boolean) as UniversalPost[];
}
```

---

## 与档案服务集成

### 档案索引

档案服务特别适合使用语义搜索，因为用户可能用不同的词描述相似的概念。

```typescript
// src/services/archive/archiveService.ts
import { searchService } from '@/services/search';

class ArchiveService {
  async saveArchive(archive: Archive): Promise<void> {
    // 保存档案
    await this.persistArchive(archive);
    
    // 索引档案（包含向量化）
    await searchService.index({
      id: archive.id,
      type: 'archive',
      content: this.extractArchiveText(archive),
      metadata: {
        archiveType: archive.type,  // 'event' | 'character' | 'world'
        tags: archive.tags,
        linkedAccounts: archive.linkedAccountIds,
        timestamp: archive.createdAt,
        importance: archive.importance,
      },
    });
  }
  
  private extractArchiveText(archive: Archive): string {
    const parts = [
      archive.title,
      archive.summary,
      archive.content,
    ];
    
    // 添加关键词
    if (archive.keywords) {
      parts.push(...archive.keywords);
    }
    
    return parts.filter(Boolean).join(' ');
  }
}
```

### 语义搜索档案

```typescript
// 在档案 App 中使用语义搜索
async function searchArchives(query: string): Promise<Archive[]> {
  // 使用语义搜索找到相关档案
  const result = await searchService.semanticSearch(query, {
    topK: 20,
    threshold: 0.6,
    types: ['archive'],
  });
  
  // 获取完整的档案数据
  const archiveIds = result.items.map(item => item.id);
  return archiveService.getArchivesByIds(archiveIds);
}

// 示例：搜索「角色之间的冲突」
const conflictArchives = await searchArchives('角色之间的冲突');
// 可以匹配到描述矛盾、争吵、对立的档案
```

### 档案智能关联

```typescript
// 查找与当前内容相关的档案
async function findRelatedArchives(content: string): Promise<Archive[]> {
  // 使用语义搜索找相关档案
  const result = await searchService.semanticSearch(content, {
    topK: 5,
    threshold: 0.7,
    types: ['archive'],
  });
  
  return result.items.map(item => item.data as Archive);
}

// 在 LLM 生成内容时注入相关档案
class ContentFactory {
  async generatePostWithContext(topic: string): Promise<UniversalPost> {
    // 查找相关档案
    const relatedArchives = await findRelatedArchives(topic);
    
    // 构建上下文
    const archiveContext = relatedArchives
      .map(a => `[${a.title}]: ${a.summary}`)
      .join('\n');
    
    // 生成内容（包含档案上下文）
    return this.generate(topic, { archiveContext });
  }
}
```

---

## 与账号服务集成

### 用户索引

```typescript
// src/services/account/accountService.ts
import { searchService } from '@/services/search';

class AccountService {
  async createAccount(account: Account): Promise<void> {
    // 保存账号
    await this.persistAccount(account);
    
    // 索引账号
    await this.indexAccount(account);
  }
  
  async updateAccount(account: Account): Promise<void> {
    await this.persistAccount(account);
    
    // 更新索引
    await this.indexAccount(account);
  }
  
  private async indexAccount(account: Account): Promise<void> {
    await searchService.index({
      id: account.id,
      type: 'account',
      content: this.extractAccountText(account),
      metadata: {
        username: account.username,
        platformId: account.platformId,
        entityId: account.entityId,
        isPlayer: account.isPlayer,
        followerCount: account.stats?.followers || 0,
        verified: account.verified,
      },
    });
  }
  
  private extractAccountText(account: Account): string {
    const parts = [
      account.name,
      account.username,
      account.bio,
    ];
    
    // 添加标签
    if (account.tags) {
      parts.push(...account.tags);
    }
    
    return parts.filter(Boolean).join(' ');
  }
}
```

### 用户搜索

```typescript
// 搜索用户（支持名字、用户名、简介）
async function searchUsers(query: string, platformId?: string): Promise<Account[]> {
  const filters: SearchFilter[] = [];
  
  if (platformId) {
    filters.push({ field: 'platformId', operator: 'eq', value: platformId });
  }
  
  const result = await searchService.search({
    text: query,
    type: 'account',
    filters,
    sort: { field: 'followerCount', order: 'desc' },  // 按粉丝数排序
    pagination: { offset: 0, limit: 20 },
  });
  
  return result.items.map(item => item.data as Account);
}

// @ 提及时的用户搜索
async function searchMentionUsers(prefix: string): Promise<Account[]> {
  // 快速搜索，只搜索用户名和昵称
  const result = await searchService.search({
    text: prefix,
    type: 'account',
    pagination: { offset: 0, limit: 10 },
  });
  
  return result.items.map(item => item.data as Account);
}
```

---

## 与即时通讯服务集成

### 消息索引

```typescript
// src/services/im/imService.ts
import { searchService } from '@/services/search';

class IMService {
  async sendMessage(message: IMMessage): Promise<void> {
    // 保存消息
    await this.persistMessage(message);
    
    // 索引消息内容
    await searchService.index({
      id: message.id,
      type: 'message',
      content: message.content,
      metadata: {
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        timestamp: message.timestamp,
        messageType: message.type,  // 'text' | 'image' | 'voice'
      },
    });
  }
}
```

### 聊天记录搜索

```typescript
// 搜索聊天记录
async function searchMessages(
  query: string,
  conversationId?: string
): Promise<IMMessage[]> {
  const filters: SearchFilter[] = [];
  
  if (conversationId) {
    filters.push({
      field: 'conversationId',
      operator: 'eq',
      value: conversationId,
    });
  }
  
  const result = await searchService.search({
    text: query,
    type: 'message',
    filters,
    sort: { field: 'timestamp', order: 'desc' },
    pagination: { offset: 0, limit: 50 },
    highlight: true,
  });
  
  // 返回消息列表，包含高亮
  return result.items.map(item => ({
    ...item.data,
    highlightedContent: item.highlights?.content?.[0],
  }));
}
```

---

## 与热搜服务集成

### 话题索引

```typescript
// src/services/trending/trendingService.ts
import { searchService } from '@/services/search';

class TrendingService {
  async updateTrending(topics: TrendTopic[]): Promise<void> {
    // 批量索引话题
    await searchService.indexBatch(
      topics.map(topic => ({
        id: topic.id,
        type: 'topic',
        content: `${topic.title} ${topic.description || ''}`,
        metadata: {
          platformId: topic.platformId,
          category: topic.category,
          hotValue: topic.hotValue,
          rank: topic.rank,
          timestamp: Date.now(),
        },
      }))
    );
  }
}
```

### 热搜联想

```typescript
// 搜索框输入时联想热门话题
async function suggestTopics(prefix: string): Promise<TrendTopic[]> {
  const suggestions = await searchService.suggest(prefix, {
    limit: 5,
    types: ['topic'],
    includePopular: true,
  });
  
  // 获取话题详情
  const topicIds = suggestions
    .filter(s => s.contentType === 'topic')
    .map(s => s.text);
  
  return trendingService.getTopicsByTitles(topicIds);
}
```

---

## 事件驱动集成

### 订阅内容事件

搜索服务可以订阅事件总线上的事件，自动维护索引。

```typescript
// src/services/search/searchEventHandler.ts
import { eventBus } from '@/services/eventBus';
import { searchService } from '@/services/search';

class SearchEventHandler {
  init(): void {
    // 监听帖子事件
    eventBus.on('content:post:created', this.handlePostCreated.bind(this));
    eventBus.on('content:post:updated', this.handlePostUpdated.bind(this));
    eventBus.on('content:post:deleted', this.handlePostDeleted.bind(this));
    
    // 监听账号事件
    eventBus.on('account:created', this.handleAccountCreated.bind(this));
    eventBus.on('account:updated', this.handleAccountUpdated.bind(this));
    
    // 监听档案事件
    eventBus.on('archive:saved', this.handleArchiveSaved.bind(this));
    eventBus.on('archive:deleted', this.handleArchiveDeleted.bind(this));
  }
  
  private async handlePostCreated(event: { postId: string }): Promise<void> {
    const post = await socialMediaEngine.getPost(event.postId);
    if (post) {
      await searchService.index({
        id: post.id,
        type: 'post',
        content: this.extractPostText(post),
        metadata: this.extractPostMetadata(post),
      });
    }
  }
  
  private async handlePostDeleted(event: { postId: string }): Promise<void> {
    await searchService.remove(event.postId, 'post');
  }
  
  // ... 其他事件处理器
}

// 应用启动时初始化
const searchEventHandler = new SearchEventHandler();
searchEventHandler.init();
```

---

## 全局搜索

### 跨类型搜索

全局搜索允许一次搜索多种内容类型。

```typescript
// src/apps/global-search/searchController.ts

interface GlobalSearchResult {
  posts: UniversalPost[];
  accounts: Account[];
  topics: TrendTopic[];
  archives: Archive[];
  messages: IMMessage[];
}

async function globalSearch(query: string): Promise<GlobalSearchResult> {
  // 并行搜索所有类型
  const [posts, accounts, topics, archives, messages] = await Promise.all([
    searchPosts(query),
    searchAccounts(query),
    searchTopics(query),
    searchArchives(query),
    searchMessages(query),
  ]);
  
  return { posts, accounts, topics, archives, messages };
}

async function searchPosts(query: string): Promise<UniversalPost[]> {
  const result = await searchService.search({
    text: query,
    type: 'post',
    pagination: { offset: 0, limit: 10 },
  });
  return result.items.map(i => i.data);
}

async function searchAccounts(query: string): Promise<Account[]> {
  const result = await searchService.search({
    text: query,
    type: 'account',
    pagination: { offset: 0, limit: 5 },
  });
  return result.items.map(i => i.data);
}

// ... 其他搜索函数
```

### 搜索结果聚合展示

```vue
<template>
  <div class="global-search">
    <input v-model="query" @keyup.enter="search" placeholder="搜索..." />
    
    <div v-if="results" class="results">
      <!-- 用户结果 -->
      <section v-if="results.accounts.length > 0">
        <h3>用户</h3>
        <UserCard v-for="user in results.accounts" :key="user.id" :user="user" />
      </section>
      
      <!-- 话题结果 -->
      <section v-if="results.topics.length > 0">
        <h3>话题</h3>
        <TopicCard v-for="topic in results.topics" :key="topic.id" :topic="topic" />
      </section>
      
      <!-- 帖子结果 -->
      <section v-if="results.posts.length > 0">
        <h3>帖子</h3>
        <PostCard v-for="post in results.posts" :key="post.id" :post="post" />
      </section>
      
      <!-- 档案结果 -->
      <section v-if="results.archives.length > 0">
        <h3>档案</h3>
        <ArchiveCard v-for="archive in results.archives" :key="archive.id" :archive="archive" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { globalSearch } from './searchController';

const query = ref('');
const results = ref<GlobalSearchResult | null>(null);

async function search() {
  if (!query.value.trim()) return;
  results.value = await globalSearch(query.value);
}
</script>
```

---

## 初始化与启动

### 服务初始化

```typescript
// src/services/search/index.ts
import { SearchService } from './searchService';
import { SearchEventHandler } from './searchEventHandler';
import { IndexedDBVectorStore } from './vectorStore';

// 创建服务实例
export const searchService = new SearchService();

// 初始化函数
export async function initSearchService(): Promise<void> {
  // 1. 配置向量存储（可选，启用语义搜索）
  if (settings.enableSemanticSearch) {
    const vectorStore = new IndexedDBVectorStore({
      dimensions: 384,
      embedder: {
        type: 'local',
        model: 'all-MiniLM-L6-v2',
      },
    });
    await vectorStore.init();
    searchService.setVectorStore(vectorStore);
  }
  
  // 2. 初始化事件处理器
  const eventHandler = new SearchEventHandler();
  eventHandler.init();
  
  // 3. 检查是否需要重建索引
  const stats = await searchService.getStats();
  if (stats.totalDocuments === 0) {
    await rebuildAllIndexes();
  }
}

// 重建所有索引
async function rebuildAllIndexes(): Promise<void> {
  console.log('[SearchService] 开始重建索引...');
  
  // 索引所有帖子
  const posts = await socialMediaEngine.getAllPosts();
  await searchService.indexBatch(
    posts.map(post => ({
      id: post.id,
      type: 'post',
      content: extractPostText(post),
      metadata: extractPostMetadata(post),
    }))
  );
  
  // 索引所有账号
  const accounts = await accountService.getAllAccounts();
  await searchService.indexBatch(
    accounts.map(account => ({
      id: account.id,
      type: 'account',
      content: extractAccountText(account),
      metadata: extractAccountMetadata(account),
    }))
  );
  
  // 索引所有档案
  const archives = await archiveService.getAllArchives();
  await searchService.indexBatch(
    archives.map(archive => ({
      id: archive.id,
      type: 'archive',
      content: extractArchiveText(archive),
      metadata: extractArchiveMetadata(archive),
    }))
  );
  
  console.log('[SearchService] 索引重建完成');
}
```

### 应用启动集成

```typescript
// src/main.ts
import { initSearchService } from '@/services/search';

async function bootstrap() {
  // ... 其他初始化
  
  // 初始化搜索服务
  await initSearchService();
  
  // ... 启动应用
}

bootstrap();
```

---

## 最佳实践

### 1. 延迟索引

对于批量内容创建，使用延迟索引提高性能：

```typescript
class BatchIndexer {
  private queue: Indexable[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize = 50;
  private readonly delay = 1000;  // 1秒
  
  add(item: Indexable): void {
    this.queue.push(item);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.delay);
    }
  }
  
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.queue.length === 0) return;
    
    const items = this.queue.splice(0, this.batchSize);
    await searchService.indexBatch(items);
  }
}

export const batchIndexer = new BatchIndexer();
```

### 2. 索引预热

```typescript
// 应用启动后预热常用搜索
async function warmupSearch(): Promise<void> {
  const commonQueries = ['热门', '推荐', '最新', '关注'];
  
  for (const query of commonQueries) {
    await searchService.search({ text: query, type: 'post' });
  }
}
```

### 3. 错误处理

```typescript
// 索引失败时不影响主流程
async function safeIndex(item: Indexable): Promise<void> {
  try {
    await searchService.index(item);
  } catch (error) {
    console.error('[SearchService] 索引失败:', error);
    // 记录失败项，稍后重试
    failedIndexQueue.push(item);
  }
}
```

---

## 参考资料

* [搜索服务 README](./README.md)
* [类型定义](./types.md)
* [架构设计](./architecture.md)
* [社交媒体引擎](../social-media-engine/README.md)
* [档案服务](../archive-service/README.md)
* [账号服务](../account-service/README.md)
* [事件总线](../eventBus-service/README.md)
