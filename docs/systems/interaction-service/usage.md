# 交互服务使用示例

> **版本**: v1.0  
> **最后更新**: 2026-01-16

本文档提供交互服务的详细使用示例。

---

## 1. 服务初始化

### 1.1 获取服务实例

```typescript
import { interactionService } from '@/services/interaction';

// 服务是单例，直接导入使用
// 初始化在应用启动时自动完成
```

### 1.2 手动初始化（可选）

```typescript
import { InteractionService } from '@/services/interaction';

// 创建自定义实例（用于测试）
const service = new InteractionService({
  enableEventBroadcast: true,
  maxViewHistoryItems: 500,
  statsCacheTtlMs: 3 * 60 * 1000,
});

await service.initialize();
```

---

## 2. 点赞操作

### 2.1 基础点赞

```typescript
import { interactionService } from '@/services/interaction';

const contentId = 'post_12345';
const userId = 'user_001';

// 点赞
await interactionService.like(contentId, userId);

// 取消点赞
await interactionService.unlike(contentId, userId);

// 切换点赞状态
async function toggleLike(contentId: string, userId: string) {
  const isLiked = await interactionService.isLiked(contentId, userId);
  if (isLiked) {
    await interactionService.unlike(contentId, userId);
  } else {
    await interactionService.like(contentId, userId);
  }
  return !isLiked;
}
```

### 2.2 检查点赞状态

```typescript
// 单个检查
const isLiked = await interactionService.isLiked(contentId, userId);

// 批量检查
const contentIds = ['post_001', 'post_002', 'post_003'];
const likeStatus = await interactionService.batchCheckLiked(contentIds, userId);
// 返回: Map<string, boolean>
// { 'post_001' => true, 'post_002' => false, 'post_003' => true }
```

### 2.3 获取用户点赞列表

```typescript
// 获取所有点赞
const allLikes = await interactionService.getUserLikes(userId);

// 获取特定平台的点赞
const weiboLikes = await interactionService.getUserLikes(userId, 'weibo');

// 分页获取
const pagedLikes = await interactionService.getUserLikes(userId, {
  platformId: 'weibo',
  limit: 20,
  offset: 0,
  sortBy: 'likedAt',
  sortOrder: 'desc',
});
```

### 2.4 在 Vue 组件中使用

```vue
<template>
  <button 
    @click="handleLike"
    :class="{ 'text-red-500': isLiked }"
  >
    <HeartIcon :filled="isLiked" />
    {{ likeCount }}
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { interactionService } from '@/services/interaction';

const props = defineProps<{
  contentId: string;
  userId: string;
  initialLikeCount: number;
}>();

const isLiked = ref(false);
const likeCount = ref(props.initialLikeCount);
const isLoading = ref(false);

onMounted(async () => {
  isLiked.value = await interactionService.isLiked(props.contentId, props.userId);
});

async function handleLike() {
  if (isLoading.value) return;
  
  isLoading.value = true;
  
  // 乐观更新
  const wasLiked = isLiked.value;
  isLiked.value = !wasLiked;
  likeCount.value += wasLiked ? -1 : 1;
  
  try {
    if (wasLiked) {
      await interactionService.unlike(props.contentId, props.userId);
    } else {
      await interactionService.like(props.contentId, props.userId);
    }
  } catch (error) {
    // 回滚
    isLiked.value = wasLiked;
    likeCount.value += wasLiked ? 1 : -1;
    console.error('点赞失败:', error);
  } finally {
    isLoading.value = false;
  }
}
</script>
```

---

## 3. 收藏操作

### 3.1 基础收藏

```typescript
import { interactionService } from '@/services/interaction';

const contentId = 'post_12345';
const userId = 'user_001';

// 收藏到默认收藏夹
await interactionService.favorite(contentId, userId);

// 收藏到指定收藏夹
await interactionService.favorite(contentId, userId, 'collection_tech');

// 取消收藏
await interactionService.unfavorite(contentId, userId);

// 检查是否已收藏
const isFavorited = await interactionService.isFavorited(contentId, userId);
```

### 3.2 收藏夹管理

```typescript
// 获取用户的收藏夹列表
const collections = await interactionService.getFavoriteCollections(userId);

// 创建收藏夹
const newCollection = await interactionService.createCollection(userId, '技术文章', {
  description: '收藏技术相关的好文章',
  isPublic: false,
});

// 更新收藏夹
await interactionService.updateCollection(newCollection.id, {
  name: '编程技术',
  description: '编程和技术相关文章',
});

// 删除收藏夹（内容会移动到默认收藏夹）
await interactionService.deleteCollection(newCollection.id);

// 获取收藏夹中的内容
const items = await interactionService.getCollectionItems('collection_tech', {
  limit: 20,
  offset: 0,
});
```

### 3.3 移动收藏

```typescript
// 将收藏从一个收藏夹移动到另一个
await interactionService.moveToCollection(
  contentId,
  userId,
  'target_collection_id'
);
```

### 3.4 收藏组件示例

```vue
<template>
  <div class="relative">
    <button @click="showMenu = !showMenu">
      <StarIcon :filled="isFavorited" />
    </button>
    
    <!-- 收藏夹选择菜单 -->
    <div v-if="showMenu" class="absolute top-full mt-2 bg-white shadow-lg rounded">
      <div 
        v-for="collection in collections" 
        :key="collection.id"
        @click="handleFavorite(collection.id)"
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer"
      >
        {{ collection.name }}
        <span class="text-gray-400 text-sm">({{ collection.itemCount }})</span>
      </div>
      
      <div 
        @click="showCreateDialog = true"
        class="px-4 py-2 border-t hover:bg-gray-100 cursor-pointer"
      >
        + 创建新收藏夹
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { interactionService } from '@/services/interaction';

const props = defineProps<{
  contentId: string;
  userId: string;
}>();

const isFavorited = ref(false);
const collections = ref<FavoriteCollection[]>([]);
const showMenu = ref(false);
const showCreateDialog = ref(false);

onMounted(async () => {
  isFavorited.value = await interactionService.isFavorited(props.contentId, props.userId);
  collections.value = await interactionService.getFavoriteCollections(props.userId);
});

async function handleFavorite(collectionId: string) {
  if (isFavorited.value) {
    // 如果已收藏，移动到新收藏夹
    await interactionService.moveToCollection(props.contentId, props.userId, collectionId);
  } else {
    // 否则添加收藏
    await interactionService.favorite(props.contentId, props.userId, collectionId);
    isFavorited.value = true;
  }
  showMenu.value = false;
}
</script>
```

---

## 4. 评论操作

### 4.1 发表评论

```typescript
import { interactionService } from '@/services/interaction';

// 发表顶级评论
const comment = await interactionService.comment(
  'post_12345',
  'user_001',
  '这篇文章写得真好！'
);
console.log('评论 ID:', comment.id);

// 回复评论
const reply = await interactionService.comment(
  'post_12345',
  'user_002',
  '同意楼上的观点！',
  comment.id // 父评论 ID
);
```

### 4.2 获取评论列表

```typescript
// 获取顶级评论
const comments = await interactionService.getComments('post_12345', {
  parentId: undefined,
  sortBy: 'hot',
  limit: 20,
});

// 获取某评论的回复
const replies = await interactionService.getComments('post_12345', {
  parentId: 'comment_001',
  sortBy: 'time',
  limit: 10,
});

// 获取评论树（带部分回复）
const threads = await interactionService.getCommentThreads('post_12345', {
  limit: 20,
  repliesPerThread: 3,
});
```

### 4.3 评论互动

```typescript
// 点赞评论
await interactionService.likeComment('comment_001', 'user_001');

// 取消点赞
await interactionService.unlikeComment('comment_001', 'user_001');

// 删除评论（仅作者可删除）
await interactionService.deleteComment('comment_001', 'user_001');
```

### 4.4 评论列表组件示例

```vue
<template>
  <div class="space-y-4">
    <!-- 评论输入框 -->
    <div class="flex gap-2">
      <input 
        v-model="newComment" 
        placeholder="写下你的评论..."
        class="flex-1 border rounded px-3 py-2"
      />
      <button 
        @click="submitComment" 
        :disabled="!newComment.trim()"
        class="px-4 py-2 bg-blue-500 text-white rounded"
      >
        发送
      </button>
    </div>
    
    <!-- 评论列表 -->
    <div v-for="thread in commentThreads" :key="thread.root.id" class="border-b pb-4">
      <!-- 根评论 -->
      <CommentItem 
        :comment="thread.root" 
        @reply="handleReply"
        @like="handleLikeComment"
      />
      
      <!-- 回复列表 -->
      <div class="ml-8 mt-2 space-y-2">
        <CommentItem 
          v-for="reply in thread.replies" 
          :key="reply.id"
          :comment="reply"
          @reply="handleReply"
          @like="handleLikeComment"
        />
        
        <!-- 展开更多回复 -->
        <button 
          v-if="thread.hasMoreReplies"
          @click="loadMoreReplies(thread.root.id)"
          class="text-blue-500 text-sm"
        >
          查看全部 {{ thread.totalReplies }} 条回复
        </button>
      </div>
    </div>
    
    <!-- 加载更多 -->
    <button 
      v-if="hasMore" 
      @click="loadMoreComments"
      class="w-full py-2 text-gray-500"
    >
      加载更多评论
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { interactionService } from '@/services/interaction';
import type { CommentThread } from '@/types/interaction';

const props = defineProps<{
  contentId: string;
  userId: string;
}>();

const commentThreads = ref<CommentThread[]>([]);
const newComment = ref('');
const replyingTo = ref<string | null>(null);
const hasMore = ref(true);
const offset = ref(0);
const limit = 20;

onMounted(async () => {
  await loadComments();
});

async function loadComments() {
  const threads = await interactionService.getCommentThreads(props.contentId, {
    limit,
    repliesPerThread: 3,
  });
  commentThreads.value = threads;
  hasMore.value = threads.length === limit;
}

async function loadMoreComments() {
  offset.value += limit;
  const moreThreads = await interactionService.getCommentThreads(props.contentId, {
    limit,
    offset: offset.value,
    repliesPerThread: 3,
  });
  commentThreads.value.push(...moreThreads);
  hasMore.value = moreThreads.length === limit;
}

async function submitComment() {
  if (!newComment.value.trim()) return;
  
  const comment = await interactionService.comment(
    props.contentId,
    props.userId,
    newComment.value,
    replyingTo.value ?? undefined
  );
  
  // 刷新评论列表
  await loadComments();
  newComment.value = '';
  replyingTo.value = null;
}

function handleReply(commentId: string) {
  replyingTo.value = commentId;
  // 滚动到输入框
}

async function handleLikeComment(commentId: string) {
  // 点赞评论逻辑
}

async function loadMoreReplies(parentId: string) {
  const replies = await interactionService.getComments(props.contentId, {
    parentId,
    sortBy: 'time',
    limit: 50,
  });
  
  // 更新对应的 thread
  const thread = commentThreads.value.find(t => t.root.id === parentId);
  if (thread) {
    thread.replies = replies;
    thread.hasMoreReplies = false;
  }
}
</script>
```

---

## 5. 浏览记录

### 5.1 记录浏览

```typescript
import { interactionService } from '@/services/interaction';

// 基础记录
await interactionService.recordView('post_12345', 'user_001');

// 带详细信息
await interactionService.recordView('post_12345', 'user_001', {
  duration: 120,      // 停留 120 秒
  scrollDepth: 0.85,  // 滚动到 85%
  source: 'feed',     // 来源：信息流
  contentSnapshot: {
    title: '如何成为更好的程序员',
    summary: '本文介绍了成为优秀程序员的 10 个习惯...',
    authorName: '技术小王',
    coverImage: 'https://example.com/cover.jpg',
  },
});
```

### 5.2 自动追踪浏览时长

```typescript
// 使用 composable 自动追踪
import { useViewTracker } from '@/composables/useViewTracker';

// 在组件中
const { startTracking, stopTracking } = useViewTracker(
  props.contentId,
  props.userId
);

onMounted(() => {
  startTracking();
});

onUnmounted(() => {
  stopTracking(); // 自动记录浏览时长
});
```

```typescript
// useViewTracker 实现
import { ref, onMounted, onUnmounted } from 'vue';
import { interactionService } from '@/services/interaction';

export function useViewTracker(contentId: string, userId: string) {
  const startTime = ref(0);
  const scrollDepth = ref(0);
  
  function startTracking() {
    startTime.value = Date.now();
    
    // 监听滚动深度
    window.addEventListener('scroll', updateScrollDepth);
  }
  
  function updateScrollDepth() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollDepth.value = Math.max(scrollDepth.value, scrollTop / docHeight);
  }
  
  async function stopTracking() {
    window.removeEventListener('scroll', updateScrollDepth);
    
    const duration = Math.floor((Date.now() - startTime.value) / 1000);
    
    if (duration >= 3) { // 至少停留 3 秒才记录
      await interactionService.recordView(contentId, userId, {
        duration,
        scrollDepth: scrollDepth.value,
      });
    }
  }
  
  return { startTracking, stopTracking };
}
```

### 5.3 获取浏览历史

```typescript
// 获取最近浏览
const history = await interactionService.getViewHistory('user_001', {
  limit: 50,
});

// 按平台过滤
const weiboHistory = await interactionService.getViewHistory('user_001', {
  platformId: 'weibo',
  limit: 50,
});

// 按时间范围
const todayHistory = await interactionService.getViewHistory('user_001', {
  timeRange: {
    start: Date.now() - 24 * 60 * 60 * 1000,
    end: Date.now(),
  },
});

// 只获取深度阅读的内容
const deepReads = await interactionService.getViewHistory('user_001', {
  minDuration: 60, // 至少阅读 1 分钟
});
```

### 5.4 清除浏览历史

```typescript
// 清除全部
await interactionService.clearViewHistory('user_001');

// 清除 7 天前的
await interactionService.clearViewHistory('user_001', {
  before: Date.now() - 7 * 24 * 60 * 60 * 1000,
});

// 清除特定平台的
await interactionService.clearViewHistory('user_001', {
  platformId: 'weibo',
});
```

---

## 6. 互动统计

### 6.1 获取单个内容统计

```typescript
const stats = await interactionService.getStats('post_12345');

console.log('点赞数:', stats.likes);
console.log('评论数:', stats.comments);
console.log('转发数:', stats.reposts);
console.log('浏览数:', stats.views);
console.log('互动率:', stats.engagementRate);
```

### 6.2 批量获取统计

```typescript
const contentIds = ['post_001', 'post_002', 'post_003'];
const statsMap = await interactionService.batchGetStats(contentIds);

for (const [contentId, stats] of statsMap) {
  console.log(`${contentId}: ${stats.likes} 赞, ${stats.comments} 评论`);
}
```

### 6.3 在列表中使用

```vue
<template>
  <div v-for="post in posts" :key="post.id" class="post-card">
    <div class="content">{{ post.content }}</div>
    
    <div class="stats flex gap-4">
      <span>{{ getStats(post.id).likes }} 赞</span>
      <span>{{ getStats(post.id).comments }} 评论</span>
      <span>{{ getStats(post.id).reposts }} 转发</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { interactionService } from '@/services/interaction';

const props = defineProps<{ posts: Post[] }>();

const statsMap = ref(new Map<string, InteractionStats>());

onMounted(async () => {
  const ids = props.posts.map(p => p.id);
  statsMap.value = await interactionService.batchGetStats(ids);
});

function getStats(contentId: string): InteractionStats {
  return statsMap.value.get(contentId) ?? {
    contentId,
    likes: 0,
    comments: 0,
    reposts: 0,
    views: 0,
    favorites: 0,
    shares: 0,
    updatedAt: 0,
  };
}
</script>
```

---

## 7. 事件订阅

### 7.1 订阅所有事件

```typescript
import { interactionService } from '@/services/interaction';

// 订阅所有互动事件
const unsubscribe = interactionService.onInteraction((event) => {
  console.log(`[${event.type}] 用户 ${event.userId} 对 ${event.contentId} 进行了互动`);
  
  switch (event.type) {
    case 'like':
      console.log('用户点赞了内容');
      break;
    case 'comment':
      console.log('用户评论:', event.metadata?.commentText);
      break;
    case 'view':
      console.log('浏览时长:', event.metadata?.viewDuration, '秒');
      break;
  }
});

// 取消订阅
unsubscribe();
```

### 7.2 订阅特定类型事件

```typescript
// 只订阅点赞事件
const unsubscribeLike = interactionService.on('like', (event) => {
  console.log(`${event.userId} 点赞了 ${event.contentId}`);
});

// 只订阅评论事件
const unsubscribeComment = interactionService.on('comment', (event) => {
  console.log(`${event.userId} 评论了: ${event.metadata?.commentText}`);
});
```

### 7.3 在服务中使用事件

```typescript
// 粉丝服务订阅互动事件
class FansService {
  constructor(private interactionService: InteractionService) {
    // 订阅互动事件用于计算涨粉
    this.interactionService.onInteraction((event) => {
      this.processInteraction(event);
    });
  }
  
  private processInteraction(event: InteractionEvent) {
    // 根据互动类型计算涨粉
    const weights = {
      like: 0.1,
      comment: 0.5,
      repost: 1.0,
      favorite: 0.3,
    };
    
    const weight = weights[event.type] ?? 0;
    if (weight > 0) {
      this.calculateFollowerGrowth(event.contentId, weight);
    }
  }
}
```

```typescript
// 通知服务订阅互动事件
class NotificationService {
  constructor(private interactionService: InteractionService) {
    // 点赞通知
    this.interactionService.on('like', async (event) => {
      const authorId = await this.getContentAuthor(event.contentId);
      if (authorId !== event.userId) {
        this.sendNotification(authorId, {
          type: 'new_like',
          message: '有人赞了你的内容',
          data: { contentId: event.contentId, userId: event.userId },
        });
      }
    });
    
    // 评论通知
    this.interactionService.on('comment', async (event) => {
      const authorId = await this.getContentAuthor(event.contentId);
      if (authorId !== event.userId) {
        this.sendNotification(authorId, {
          type: 'new_comment',
          message: event.metadata?.commentText ?? '有人评论了你的内容',
          data: { contentId: event.contentId, commentId: event.metadata?.commentId },
        });
      }
    });
  }
}
```

### 7.4 事件过滤

```typescript
import { interactionService } from '@/services/interaction';

// 使用过滤器订阅
const unsubscribe = interactionService.onInteraction(
  (event) => {
    console.log('收到过滤后的事件:', event);
  },
  {
    types: ['like', 'comment'],      // 只订阅点赞和评论
    platforms: ['weibo'],            // 只订阅微博平台
    contentIds: ['post_001'],        // 只订阅特定内容
  }
);
```

---

## 8. 使用 Pinia Store

### 8.1 InteractionStore

```typescript
// stores/interactionStore.ts
import { defineStore } from 'pinia';
import { interactionService } from '@/services/interaction';
import type { InteractionStats } from '@/types/interaction';

export const useInteractionStore = defineStore('interaction', {
  state: () => ({
    likedPosts: new Set<string>(),
    favoritedPosts: new Set<string>(),
    statsCache: new Map<string, InteractionStats>(),
  }),
  
  getters: {
    isLiked: (state) => (contentId: string) => state.likedPosts.has(contentId),
    isFavorited: (state) => (contentId: string) => state.favoritedPosts.has(contentId),
    getStats: (state) => (contentId: string) => state.statsCache.get(contentId),
  },
  
  actions: {
    async toggleLike(contentId: string, userId: string) {
      const wasLiked = this.likedPosts.has(contentId);
      
      // 乐观更新
      if (wasLiked) {
        this.likedPosts.delete(contentId);
      } else {
        this.likedPosts.add(contentId);
      }
      this.updateStatsDelta(contentId, 'likes', wasLiked ? -1 : 1);
      
      try {
        if (wasLiked) {
          await interactionService.unlike(contentId, userId);
        } else {
          await interactionService.like(contentId, userId);
        }
      } catch (error) {
        // 回滚
        if (wasLiked) {
          this.likedPosts.add(contentId);
        } else {
          this.likedPosts.delete(contentId);
        }
        this.updateStatsDelta(contentId, 'likes', wasLiked ? 1 : -1);
        throw error;
      }
    },
    
    async toggleFavorite(contentId: string, userId: string) {
      // 类似 toggleLike
    },
    
    async loadUserInteractions(userId: string, contentIds: string[]) {
      // 批量加载用户的互动状态
      const likes = await interactionService.batchCheckLiked(contentIds, userId);
      const favorites = await interactionService.batchCheckFavorited(contentIds, userId);
      
      for (const [id, isLiked] of likes) {
        if (isLiked) this.likedPosts.add(id);
      }
      for (const [id, isFavorited] of favorites) {
        if (isFavorited) this.favoritedPosts.add(id);
      }
    },
    
    async loadStats(contentIds: string[]) {
      const stats = await interactionService.batchGetStats(contentIds);
      for (const [id, stat] of stats) {
        this.statsCache.set(id, stat);
      }
    },
    
    updateStatsDelta(contentId: string, field: keyof InteractionStats, delta: number) {
      const stats = this.statsCache.get(contentId);
      if (stats && typeof stats[field] === 'number') {
        (stats[field] as number) += delta;
      }
    },
  },
});
```

### 8.2 在组件中使用 Store

```vue
<template>
  <button @click="store.toggleLike(contentId, userId)">
    <HeartIcon :filled="store.isLiked(contentId)" />
    {{ store.getStats(contentId)?.likes ?? 0 }}
  </button>
</template>

<script setup lang="ts">
import { useInteractionStore } from '@/stores/interactionStore';

const props = defineProps<{ contentId: string; userId: string }>();
const store = useInteractionStore();
</script>
```

---

## 9. 错误处理

### 9.1 统一错误处理

```typescript
import { interactionService } from '@/services/interaction';

try {
  await interactionService.like(contentId, userId);
} catch (error) {
  if (error instanceof InteractionError) {
    switch (error.code) {
      case 'ALREADY_LIKED':
        // 幂等操作，忽略
        break;
      case 'CONTENT_NOT_FOUND':
        console.error('内容不存在');
        break;
      case 'PERMISSION_DENIED':
        console.error('没有权限');
        break;
      default:
        console.error('互动失败:', error.message);
    }
  } else {
    console.error('未知错误:', error);
  }
}
```

### 9.2 重试机制

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

// 使用
await withRetry(() => interactionService.like(contentId, userId));
```

---

## 相关文档

* [类型定义](./types.md)
* [架构设计](./architecture.md)
* [平台扩展](./platform-extension.md)
* [系统集成](./integration.md)
