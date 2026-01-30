# Feed Service 使用示例

> **版本**: v1.0  
> **最后更新**: 2025-01-19

本文档提供 Feed Service 的详细使用示例。

---

## 基础用法

### 1. 获取首页信息流

```typescript
import { feedService } from '@/services/feed'

// 获取用户的个性化首页信息流
async function loadHomeFeed(userId: string) {
  const result = await feedService.getPersonalizedFeed(userId, 'weibo', {
    limit: 20,
  })
  
  console.log(`加载了 ${result.items.length} 条内容`)
  console.log(`是否有更多: ${result.hasMore}`)
  console.log(`是否来自缓存: ${result.fromCache}`)
  
  return result.items
}

// 在 Vue 组件中使用
const feed = ref<FeedItem[]>([])
const loading = ref(false)
const hasMore = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    const result = await feedService.getPersonalizedFeed(
      currentUserId.value,
      'weibo',
      { limit: 20 }
    )
    feed.value = result.items
    hasMore.value = result.hasMore
  } finally {
    loading.value = false
  }
})
```

### 2. 获取关注流

```typescript
import { feedService } from '@/services/feed'

// 只看关注的人发布的内容
async function loadFollowingFeed(userId: string) {
  const result = await feedService.getFollowingFeed(userId, 'weibo', {
    limit: 20,
    includeRead: false, // 不包含已读内容
  })
  
  // 显示推荐原因
  for (const item of result.items) {
    if (item.reason) {
      console.log(`${item.post.id}: ${item.reason.description}`)
      // 例如: "因为你关注了 @用户名"
    }
  }
  
  return result
}
```

### 3. 获取热门内容

```typescript
import { feedService } from '@/services/feed'

// 获取热门内容（不需要用户 ID）
async function loadTrending(category?: string) {
  const result = await feedService.getTrendingContent('weibo', {
    category,        // 可选：'娱乐' | '科技' | '社会' 等
    limit: 10,
    timeWindow: 24,  // 最近 24 小时
  })
  
  return result.items
}

// 获取各分类热门
const categories = ['娱乐', '科技', '社会', '体育']
const trendingByCategory = await Promise.all(
  categories.map(cat => 
    feedService.getTrendingContent('weibo', { category: cat, limit: 5 })
  )
)
```

### 4. 获取发现页内容

```typescript
import { feedService } from '@/services/feed'

// 发现页：探索新内容
async function loadDiscover(userId: string) {
  const result = await feedService.getDiscoverContent(userId, 'weibo', {
    limit: 30,
  })
  
  // 发现页内容通常按类别分组展示
  const grouped = groupByCategory(result.items)
  
  return grouped
}

function groupByCategory(items: FeedItem[]) {
  const groups = new Map<string, FeedItem[]>()
  
  for (const item of items) {
    const category = item.post.platformData?.category as string || '其他'
    if (!groups.has(category)) {
      groups.set(category, [])
    }
    groups.get(category)!.push(item)
  }
  
  return groups
}
```

---

## 分页与加载更多

### 使用 offset 分页

```typescript
import { feedService } from '@/services/feed'

const PAGE_SIZE = 20
let currentOffset = 0

async function loadNextPage(userId: string) {
  const result = await feedService.getPersonalizedFeed(userId, 'weibo', {
    limit: PAGE_SIZE,
    offset: currentOffset,
  })
  
  currentOffset += result.items.length
  
  return result
}

// 在 Vue 组件中
const feed = ref<FeedItem[]>([])
const offset = ref(0)
const hasMore = ref(true)

async function loadMore() {
  if (!hasMore.value) return
  
  const result = await feedService.getPersonalizedFeed(
    userId.value,
    'weibo',
    { limit: 20, offset: offset.value }
  )
  
  feed.value.push(...result.items)
  offset.value += result.items.length
  hasMore.value = result.hasMore
}
```

### 使用 cursor 分页

```typescript
import { feedService } from '@/services/feed'

let nextCursor: string | undefined

async function loadNextPageWithCursor(userId: string) {
  const result = nextCursor
    ? await feedService.loadMore(userId, 'weibo', nextCursor)
    : await feedService.getPersonalizedFeed(userId, 'weibo', { limit: 20 })
  
  nextCursor = result.nextCursor
  
  return result
}
```

### 下拉刷新

```typescript
import { feedService } from '@/services/feed'

async function onPullToRefresh(userId: string) {
  // 刷新信息流会使缓存失效并获取最新内容
  const result = await feedService.refreshFeed(userId, 'weibo')
  
  // 重置分页状态
  currentOffset = result.items.length
  
  return result
}
```

### 预加载下一页

```typescript
import { feedService } from '@/services/feed'

// 用户滚动到列表底部时预加载
function onScrollNearBottom(userId: string, currentOffset: number) {
  // 后台预加载，不阻塞 UI
  feedService.preloadNextPage(userId, 'weibo', { currentOffset })
    .catch(() => {}) // 预加载失败不影响体验
}

// 在 Vue 组件中使用 IntersectionObserver
const loadMoreTrigger = ref<HTMLElement>()

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        feedService.preloadNextPage(userId.value, 'weibo', {
          currentOffset: feed.value.length,
        })
      }
    },
    { rootMargin: '200px' } // 提前 200px 开始预加载
  )
  
  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
})
```

---

## 话题与分类

### 获取话题信息流

```typescript
import { feedService } from '@/services/feed'

// 通过话题 ID 获取
async function loadTopicFeed(topicId: string) {
  const result = await feedService.getTopicFeed('weibo', {
    topicId,
    limit: 20,
  })
  
  return result
}

// 通过关键词获取
async function searchTopicFeed(keyword: string) {
  const result = await feedService.getTopicFeed('weibo', {
    keyword,
    limit: 20,
  })
  
  return result
}
```

### 获取分类信息流

```typescript
import { feedService } from '@/services/feed'

async function loadCategoryFeed(category: string) {
  const result = await feedService.getCategoryFeed('weibo', {
    category,
    limit: 20,
  })
  
  return result
}

// 子分类
async function loadSubCategoryFeed() {
  const result = await feedService.getCategoryFeed('bilibili', {
    category: '游戏',
    subCategory: '单机游戏',
    limit: 20,
  })
  
  return result
}
```

---

## 算法配置

### 注册平台算法

```typescript
import { feedService } from '@/services/feed'

// 在应用初始化时注册算法配置
function initFeedAlgorithms() {
  // 微博：强调时效性
  feedService.registerAlgorithm('weibo', {
    weights: {
      recency: 0.35,
      engagement: 0.30,
      relevance: 0.20,
      social: 0.15,
    },
    decayHalfLife: 4,
    diversityRules: {
      maxSameAuthor: 3,
      maxSameCategory: 5,
    },
  })
  
  // B站：强调互动量
  feedService.registerAlgorithm('bilibili', {
    weights: {
      recency: 0.20,
      engagement: 0.45,
      relevance: 0.25,
      social: 0.10,
    },
    decayHalfLife: 24,
    diversityRules: {
      maxSameAuthor: 2,
      maxSameCategory: 4,
    },
  })
  
  // 知乎：强调相关性
  feedService.registerAlgorithm('zhihu', {
    weights: {
      recency: 0.15,
      engagement: 0.25,
      relevance: 0.45,
      social: 0.15,
    },
    decayHalfLife: 72,
  })
}
```

### 动态调整权重

```typescript
import { feedService } from '@/services/feed'

// 用户选择"只看最新"时调整权重
function switchToLatestMode(platformId: string) {
  feedService.updateAlgorithmWeights(platformId, {
    recency: 0.8,
    engagement: 0.1,
    relevance: 0.05,
    social: 0.05,
  })
}

// 用户选择"只看热门"时调整权重
function switchToHotMode(platformId: string) {
  feedService.updateAlgorithmWeights(platformId, {
    recency: 0.1,
    engagement: 0.7,
    relevance: 0.1,
    social: 0.1,
  })
}

// 恢复默认
function switchToDefaultMode(platformId: string) {
  feedService.updateAlgorithmWeights(platformId, {
    recency: 0.3,
    engagement: 0.3,
    relevance: 0.2,
    social: 0.2,
  })
}
```

---

## 过滤器

### 添加自定义过滤器

```typescript
import { feedService } from '@/services/feed'

// 过滤广告内容
const adFilterId = feedService.addFilter(
  'weibo',
  (post) => !post.platformData?.isAd,
  { id: 'hideAds', priority: 1 }
)

// 过滤已屏蔽用户
const blockedUsers = new Set(['user1', 'user2'])
feedService.addFilter(
  'weibo',
  (post) => !blockedUsers.has(post.authorId),
  { id: 'hideBlocked', priority: 2 }
)

// 只看带图片的内容
feedService.addFilter(
  'weibo',
  (post) => post.media.length > 0,
  { id: 'onlyWithMedia', priority: 10 }
)
```

### 使用预置过滤器

```typescript
import { feedService } from '@/services/feed'

// 启用预置过滤器
feedService.toggleBuiltinFilter('weibo', 'hideAds', true)
feedService.toggleBuiltinFilter('weibo', 'hideReposts', true)
feedService.toggleBuiltinFilter('weibo', 'onlyOriginal', false)

// 用户设置界面
const filterSettings = reactive({
  hideAds: true,
  hideReposts: false,
  onlyOriginal: false,
  onlyWithMedia: false,
})

watch(filterSettings, (settings) => {
  for (const [key, enabled] of Object.entries(settings)) {
    feedService.toggleBuiltinFilter(
      'weibo',
      key as BuiltinFilterType,
      enabled
    )
  }
})
```

### 移除过滤器

```typescript
import { feedService } from '@/services/feed'

// 移除特定过滤器
feedService.removeFilter('weibo', 'onlyWithMedia')

// 清除所有过滤器
feedService.clearFilters('weibo')
```

---

## 缓存管理

### 手动使缓存失效

```typescript
import { feedService } from '@/services/feed'

// 用户发布新内容后刷新缓存
async function onPostCreated(userId: string) {
  feedService.invalidateCache(userId, 'weibo')
}

// 用户关注/取关后刷新关注流缓存
async function onFollowChanged(userId: string) {
  feedService.invalidateCache(userId, 'weibo', 'following')
}

// 清除所有缓存
feedService.clearCache()
```

### 查看缓存统计

```typescript
import { feedService } from '@/services/feed'

const stats = feedService.getCacheStats()

console.log(`
  缓存命中率: ${(stats.hitRate * 100).toFixed(1)}%
  命中/未命中: ${stats.hits}/${stats.misses}
  缓存大小: ${stats.size}
`)
```

---

## 事件订阅

### 监听信息流事件

```typescript
import { feedService } from '@/services/feed'

// 订阅所有信息流事件
const unsubscribe = feedService.onFeedEvent((event) => {
  switch (event.type) {
    case 'feed:loaded':
      console.log(`信息流加载完成: ${event.data?.itemCount} 条`)
      break
    case 'feed:refreshed':
      console.log('信息流已刷新')
      break
    case 'feed:cacheHit':
      console.log('命中缓存')
      break
  }
})

// 取消订阅
onUnmounted(() => {
  unsubscribe()
})
```

### 结合 Event Bus

```typescript
import { eventBus } from '@/services/eventBus'

// Feed Service 会自动发布事件到 Event Bus
eventBus.on('feed:loaded', (event) => {
  // 更新 UI 状态
  updateLoadingState(false)
})

eventBus.on('feed:itemRead', (event) => {
  // 记录阅读行为
  analytics.trackRead(event.data?.postId)
})
```

---

## Vue 组件示例

### 完整的信息流组件

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { feedService } from '@/services/feed'
import type { FeedItem, FeedResult } from '@/types/feed'

const props = defineProps<{
  userId: string
  platformId: string
}>()

const feed = ref<FeedItem[]>([])
const loading = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const offset = ref(0)

const PAGE_SIZE = 20

// 初始加载
onMounted(async () => {
  await loadFeed()
})

// 加载信息流
async function loadFeed() {
  loading.value = true
  try {
    const result = await feedService.getPersonalizedFeed(
      props.userId,
      props.platformId,
      { limit: PAGE_SIZE }
    )
    feed.value = result.items
    hasMore.value = result.hasMore
    offset.value = result.items.length
  } finally {
    loading.value = false
  }
}

// 下拉刷新
async function onRefresh() {
  refreshing.value = true
  try {
    const result = await feedService.refreshFeed(
      props.userId,
      props.platformId
    )
    feed.value = result.items
    hasMore.value = result.hasMore
    offset.value = result.items.length
  } finally {
    refreshing.value = false
  }
}

// 加载更多
async function onLoadMore() {
  if (!hasMore.value || loading.value) return
  
  loading.value = true
  try {
    const result = await feedService.getPersonalizedFeed(
      props.userId,
      props.platformId,
      { limit: PAGE_SIZE, offset: offset.value }
    )
    feed.value.push(...result.items)
    hasMore.value = result.hasMore
    offset.value += result.items.length
  } finally {
    loading.value = false
  }
}

// 预加载
function onNearBottom() {
  feedService.preloadNextPage(props.userId, props.platformId, {
    currentOffset: offset.value,
  })
}
</script>

<template>
  <div class="feed-container">
    <!-- 下拉刷新区域 -->
    <PullToRefresh @refresh="onRefresh" :refreshing="refreshing">
      <!-- 信息流列表 -->
      <div class="feed-list">
        <FeedCard
          v-for="item in feed"
          :key="item.id"
          :item="item"
        />
      </div>
      
      <!-- 加载更多 -->
      <div
        v-if="hasMore"
        ref="loadMoreTrigger"
        class="load-more"
        @click="onLoadMore"
      >
        <span v-if="loading">加载中...</span>
        <span v-else>加载更多</span>
      </div>
      
      <!-- 没有更多 -->
      <div v-else class="no-more">
        没有更多内容了
      </div>
    </PullToRefresh>
  </div>
</template>
```

### 信息流切换组件

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { feedService } from '@/services/feed'
import type { FeedType } from '@/types/feed'

const props = defineProps<{
  userId: string
  platformId: string
}>()

const currentType = ref<FeedType>('home')
const feed = ref<FeedItem[]>([])

// 切换信息流类型时重新加载
watch(currentType, async (type) => {
  switch (type) {
    case 'home':
      feed.value = (await feedService.getPersonalizedFeed(
        props.userId, props.platformId
      )).items
      break
    case 'following':
      feed.value = (await feedService.getFollowingFeed(
        props.userId, props.platformId
      )).items
      break
    case 'trending':
      feed.value = (await feedService.getTrendingContent(
        props.platformId
      )).items
      break
  }
})
</script>

<template>
  <div class="feed-tabs">
    <button
      :class="{ active: currentType === 'home' }"
      @click="currentType = 'home'"
    >
      推荐
    </button>
    <button
      :class="{ active: currentType === 'following' }"
      @click="currentType = 'following'"
    >
      关注
    </button>
    <button
      :class="{ active: currentType === 'trending' }"
      @click="currentType = 'trending'"
    >
      热门
    </button>
  </div>
  
  <FeedList :items="feed" />
</template>
```

---

## 调试与开发

### 启用调试模式

```typescript
import { feedService } from '@/services/feed'

// 开发模式下启用调试信息
if (import.meta.env.DEV) {
  feedService.onFeedEvent((event) => {
    console.log('[FeedService]', event.type, event.data)
  })
}

// 获取包含调试信息的结果
const result = await feedService.getPersonalizedFeed(userId, 'weibo', {
  limit: 20,
})

if (result.debug) {
  console.log(`
    算法: ${result.debug.algorithm}
    处理耗时: ${result.debug.processingTime}ms
    候选内容: ${result.debug.candidateCount}
    过滤后: ${result.debug.afterFilterCount}
    应用的过滤器: ${result.debug.appliedFilters?.join(', ')}
  `)
}
```

---

## 参考

- [README](./README.md) - Feed Service 概述
- [类型定义](./types.md) - TypeScript 类型
- [架构设计](./architecture.md) - 服务架构
- [算法配置](./algorithm.md) - 算法参数详解
