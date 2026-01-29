# 使用示例

> 会话上下文服务的使用指南和代码示例

## 初始化

### 在应用启动时初始化

在 `App.vue` 或 `main.ts` 中初始化会话上下文监听器：

```typescript
// src/App.vue
import { onMounted, onUnmounted } from 'vue'
import {
  initSessionContextListeners,
  cleanupListeners,
} from '@/services/sessionContext'
import { useAdapter } from '@/composables/useAdapter'

onMounted(() => {
  const adapter = useAdapter()
  initSessionContextListeners(adapter)
})

onUnmounted(() => {
  cleanupListeners()
})
```

---

## 写入数据

### 附加来源追踪信息

在保存数据时，使用 `getCurrentSourceTracking()` 获取当前来源信息并附加到数据上：

```typescript
import { sessionContextService } from '@/services/sessionContext'
import { db } from '@/services/database'

// 微博帖子类型（扩展 TrackedContent）
interface WeiboPost {
  id: string
  content: string
  authorId: string
  likes: number
  source?: ContentSourceTracking  // 来源追踪
}

async function createPost(content: string, authorId: string): Promise<WeiboPost> {
  // 获取当前来源追踪信息
  const source = sessionContextService.getCurrentSourceTracking()

  const post: WeiboPost = {
    id: generateId(),
    content,
    authorId,
    likes: 0,
    source,  // 附加来源信息
  }

  await db.posts.add(post)
  return post
}
```

### 批量创建数据

```typescript
async function createMultiplePosts(
  posts: Array<{ content: string; authorId: string }>
): Promise<WeiboPost[]> {
  // 一次性获取来源（所有帖子使用相同来源）
  const source = sessionContextService.getCurrentSourceTracking()

  const newPosts = posts.map((p) => ({
    id: generateId(),
    content: p.content,
    authorId: p.authorId,
    likes: 0,
    source,
  }))

  await db.posts.bulkAdd(newPosts)
  return newPosts
}
```

---

## 读取数据

### 使用过滤器

使用 `buildSourceFilter()` 构建过滤器，按不同级别过滤数据：

```typescript
import { sessionContextService } from '@/services/sessionContext'

// 按会话过滤（默认）
async function loadSessionPosts(): Promise<WeiboPost[]> {
  const filter = sessionContextService.buildSourceFilter('session')

  return await db.posts
    .where('platformId')
    .equals('weibo')
    .filter(filter)
    .toArray()
}

// 按楼层过滤
async function loadMessagePosts(): Promise<WeiboPost[]> {
  const filter = sessionContextService.buildSourceFilter('message')

  return await db.posts.filter(filter).toArray()
}

// 按 Swipe 过滤
async function loadSwipePosts(): Promise<WeiboPost[]> {
  const filter = sessionContextService.buildSourceFilter('swipe')

  return await db.posts.filter(filter).toArray()
}

// 显示所有数据
async function loadAllPosts(): Promise<WeiboPost[]> {
  const filter = sessionContextService.buildSourceFilter('all')

  return await db.posts.filter(filter).toArray()
}
```

### 排除历史数据

默认情况下，无来源追踪的历史数据会被包含。如需排除：

```typescript
const filter = sessionContextService.buildSourceFilter('session', {
  includeUntracked: false,  // 排除无来源的历史数据
})
```

### 使用便捷方法检查

```typescript
// 检查单个数据项
function shouldShowPost(post: WeiboPost): boolean {
  return sessionContextService.belongsToCurrentSession(post)
}

// 在列表中过滤
const visiblePosts = allPosts.filter((post) =>
  sessionContextService.belongsToCurrentSession(post)
)
```

---

## 在 Vue 组件中使用

### 显示连接状态

```vue
<template>
  <div class="connection-status">
    <template v-if="isConnected">
      <span class="status-dot connected"></span>
      <span>已连接: {{ context.characterName }}</span>
    </template>
    <template v-else>
      <span class="status-dot disconnected"></span>
      <span>未连接到酒馆</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { sessionContextService } from '@/services/sessionContext'
import { computed } from 'vue'

// 响应式访问
const context = sessionContextService.context
const isConnected = computed(() => sessionContextService.isConnected)
</script>
```

### 监听上下文变化

```typescript
import { watch } from 'vue'
import { sessionContextService } from '@/services/sessionContext'

// 监听会话变化
watch(
  () => sessionContextService.context.sessionId,
  (newSessionId, oldSessionId) => {
    if (newSessionId !== oldSessionId) {
      console.log('会话已切换:', newSessionId)
      // 重新加载数据
      loadData()
    }
  }
)

// 监听楼层变化
watch(
  () => sessionContextService.context.messageId,
  (newMessageId) => {
    console.log('楼层已更新:', newMessageId)
  }
)
```

### 使用事件总线监听

```typescript
import { eventBus } from '@/services/eventBus'
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  const unsubscribe = eventBus.on('session-context:changed', (event) => {
    console.log('上下文变化:', event.type)
    console.log('新上下文:', event.newContext)
  })

  onUnmounted(() => {
    unsubscribe()
  })
})
```

---

## 与 Pinia Store 集成

### 在 Store 中使用

```typescript
import { defineStore } from 'pinia'
import { sessionContextService } from '@/services/sessionContext'
import { db } from '@/services/database'

export const useWeiboStore = defineStore('weibo', {
  state: () => ({
    posts: [] as WeiboPost[],
    loading: false,
  }),

  actions: {
    async loadPosts() {
      this.loading = true
      try {
        const filter = sessionContextService.buildSourceFilter('session')
        this.posts = await db.posts.filter(filter).toArray()
      } finally {
        this.loading = false
      }
    },

    async createPost(content: string, authorId: string) {
      const source = sessionContextService.getCurrentSourceTracking()

      const post: WeiboPost = {
        id: generateId(),
        content,
        authorId,
        likes: 0,
        source,
      }

      await db.posts.add(post)
      this.posts.push(post)
    },
  },
})
```

---

## 最佳实践

### 1. 始终在写入时附加来源

```typescript
// ✅ 正确
const post = {
  ...data,
  source: sessionContextService.getCurrentSourceTracking(),
}

// ❌ 错误 - 忘记附加来源
const post = { ...data }
```

### 2. 使用默认的 session 过滤模式

```typescript
// ✅ 推荐 - 按会话过滤
const filter = sessionContextService.buildSourceFilter('session')

// 或使用默认值
const filter = sessionContextService.buildSourceFilter()
```

### 3. 处理未连接状态

```typescript
function saveData() {
  const source = sessionContextService.getCurrentSourceTracking()

  if (!source) {
    // 未连接时的处理
    console.warn('未连接到酒馆，数据将不带来源信息')
  }

  // 继续保存...
}
```

### 4. 保持历史数据兼容

```typescript
// ✅ 推荐 - 包含历史数据
const filter = sessionContextService.buildSourceFilter('session', {
  includeUntracked: true,  // 默认值
})

// 只在明确需要时排除
const strictFilter = sessionContextService.buildSourceFilter('session', {
  includeUntracked: false,
})
```
