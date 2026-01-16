# 使用示例

## 服务初始化

在应用启动时初始化 Bridge 事件监听。

```typescript
// src/main.ts 或 src/App.vue

import { initSessionContextListeners } from '@/services/sessionContext';
import { useAdapter } from '@/composables/useAdapter';
import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  const adapter = useAdapter();
  
  // 初始化 Bridge 事件监听
  // 服务会自动响应 sync、swipe_changed 等事件
  initSessionContextListeners(adapter);
});

onUnmounted(() => {
  // 可选：销毁事件监听
  destroySessionContextListeners();
});
```

---

## 写入数据时附加来源

保存数据时，调用 `getCurrentSourceTracking()` 获取来源信息。

### 基础用法

```typescript
// src/apps/myapp/stores/postStore.ts

import { sessionContextService } from '@/services/sessionContext';
import { db } from '@/services/database';

export async function savePost(postData: PostInput) {
  // 1. 获取当前来源追踪信息
  const source = sessionContextService.getCurrentSourceTracking();
  
  // 2. 构建完整记录
  const post = {
    id: generateId(),
    platformId: 'myapp',
    ...postData,
    source, // 附加来源（可能为 undefined）
  };
  
  // 3. 保存到数据库
  await db.socialPosts.add(post);
  
  return post;
}
```

### 批量保存

```typescript
export async function savePosts(postsData: PostInput[]) {
  // 获取一次来源信息，用于所有记录
  const source = sessionContextService.getCurrentSourceTracking();
  
  const posts = postsData.map(data => ({
    id: generateId(),
    platformId: 'myapp',
    ...data,
    source,
  }));
  
  await db.socialPosts.bulkAdd(posts);
  
  return posts;
}
```

### 条件附加来源

```typescript
export async function savePostWithOptions(
  postData: PostInput,
  options?: { skipSourceTracking?: boolean }
) {
  const post = {
    id: generateId(),
    platformId: 'myapp',
    ...postData,
  };
  
  // 根据选项决定是否附加来源
  if (!options?.skipSourceTracking) {
    post.source = sessionContextService.getCurrentSourceTracking();
  }
  
  await db.socialPosts.add(post);
  return post;
}
```

---

## 读取数据时过滤

加载数据时，使用 `buildSourceFilter()` 构建过滤函数。

### 基础用法（会话级过滤）

```typescript
import { sessionContextService } from '@/services/sessionContext';
import { db } from '@/services/database';

export async function loadPosts() {
  // 构建过滤器（默认按会话过滤）
  const filter = sessionContextService.buildSourceFilter('session');
  
  const posts = await db.socialPosts
    .where('platformId').equals('myapp')
    .filter(filter)
    .toArray();
  
  return posts;
}
```

### 不同过滤模式

```typescript
// 按会话过滤（推荐）
const sessionFilter = sessionContextService.buildSourceFilter('session');

// 按楼层过滤（显示到当前楼层为止的数据）
const messageFilter = sessionContextService.buildSourceFilter('message');

// 按 Swipe 过滤（最后楼层精确匹配）
const swipeFilter = sessionContextService.buildSourceFilter('swipe');

// 不过滤（显示所有数据）
const allFilter = sessionContextService.buildSourceFilter('all');
```

### 结合其他查询条件

```typescript
export async function loadPostsByAuthor(authorId: string) {
  const filter = sessionContextService.buildSourceFilter('session');
  
  // 先按作者过滤，再按会话过滤
  const posts = await db.socialPosts
    .where('authorId').equals(authorId)
    .filter(filter)
    .toArray();
  
  return posts;
}
```

### 内存数组过滤

```typescript
export function filterPostsInMemory(posts: Post[]) {
  const filter = sessionContextService.buildSourceFilter('session');
  
  return posts.filter(filter);
}
```

---

## 响应式 UI

在 Vue 组件中使用响应式状态。

### 显示连接状态

```vue
<template>
  <div class="connection-status">
    <span v-if="isConnected" class="connected">
      ✅ 已连接: {{ context.characterName }}
    </span>
    <span v-else class="disconnected">
      ⚠️ 未连接到酒馆
    </span>
  </div>
</template>

<script setup lang="ts">
import { sessionContextService } from '@/services/sessionContext';

const context = sessionContextService.context;
const isConnected = sessionContextService.isConnected;
</script>
```

### 显示详细上下文

```vue
<template>
  <div class="context-info">
    <div>会话: {{ context.sessionId || '无' }}</div>
    <div>楼层: {{ context.messageId ?? '无' }}</div>
    <div>Swipe: {{ context.swipeId ?? '无' }}</div>
    <div>角色: {{ context.characterName || '未知' }}</div>
    <div>玩家: {{ context.playerName || '未知' }}</div>
  </div>
</template>

<script setup lang="ts">
import { sessionContextService } from '@/services/sessionContext';

const context = sessionContextService.context;
</script>
```

### 计算属性

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { sessionContextService } from '@/services/sessionContext';

const context = sessionContextService.context;

// 格式化显示
const contextSummary = computed(() => {
  if (!context.value.sessionId) {
    return '未连接';
  }
  return `${context.value.characterName} - 楼层 ${context.value.messageId}`;
});

// 是否在特定会话
const isInSession = computed(() => 
  context.value.sessionId === 'target_session_id'
);
</script>
```

---

## 监听上下文变化

使用 Vue watch 监听上下文变化，触发数据刷新。

### 监听 Session 切换

```typescript
import { watch } from 'vue';
import { sessionContextService } from '@/services/sessionContext';

// 会话切换时刷新数据
watch(
  () => sessionContextService.context.value.sessionId,
  (newSessionId, oldSessionId) => {
    if (newSessionId !== oldSessionId) {
      console.log('会话切换:', oldSessionId, '->', newSessionId);
      refreshData();
    }
  }
);
```

### 监听 Swipe 切换

```typescript
// Swipe 切换时刷新数据（最后楼层的分支变化）
watch(
  () => sessionContextService.context.value.swipeId,
  (newSwipeId, oldSwipeId) => {
    if (newSwipeId !== oldSwipeId) {
      console.log('Swipe 切换:', oldSwipeId, '->', newSwipeId);
      refreshLastFloorData();
    }
  }
);
```

### 监听多个字段

```typescript
// 监听 messageId 或 swipeId 变化
watch(
  () => ({
    messageId: sessionContextService.context.value.messageId,
    swipeId: sessionContextService.context.value.swipeId,
  }),
  (newValue, oldValue) => {
    if (
      newValue.messageId !== oldValue.messageId ||
      newValue.swipeId !== oldValue.swipeId
    ) {
      console.log('楼层/Swipe 变化:', oldValue, '->', newValue);
      refreshData();
    }
  },
  { deep: true }
);
```

### 在 Store 中监听

```typescript
// src/apps/myapp/stores/myStore.ts

import { defineStore } from 'pinia';
import { watch, ref } from 'vue';
import { sessionContextService } from '@/services/sessionContext';

export const useMyStore = defineStore('myapp', () => {
  const posts = ref<Post[]>([]);
  
  // 自动响应会话变化
  watch(
    () => sessionContextService.context.value.sessionId,
    () => {
      loadPosts();
    },
    { immediate: true }
  );
  
  async function loadPosts() {
    const filter = sessionContextService.buildSourceFilter('session');
    posts.value = await db.socialPosts
      .where('platformId').equals('myapp')
      .filter(filter)
      .toArray();
  }
  
  return { posts, loadPosts };
});
```

---

## 完整 Store 示例

一个完整的 Store 实现，展示所有使用模式。

```typescript
// src/apps/myapp/stores/contentStore.ts

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { sessionContextService } from '@/services/sessionContext';
import { db } from '@/services/database';
import type { Post, PostInput, FilterMode } from '../types';

export const useContentStore = defineStore('myapp-content', () => {
  // ========== 状态 ==========
  const posts = ref<Post[]>([]);
  const filterMode = ref<FilterMode>('session');
  const isLoading = ref(false);
  
  // ========== 计算属性 ==========
  
  // 获取连接状态
  const isConnected = computed(() => 
    sessionContextService.isConnected.value
  );
  
  // 获取当前会话信息
  const currentSession = computed(() => 
    sessionContextService.context.value
  );
  
  // ========== 数据加载 ==========
  
  async function loadPosts() {
    isLoading.value = true;
    
    try {
      const filter = sessionContextService.buildSourceFilter(filterMode.value);
      
      posts.value = await db.socialPosts
        .where('platformId').equals('myapp')
        .reverse()
        .filter(filter)
        .limit(100)
        .toArray();
    } finally {
      isLoading.value = false;
    }
  }
  
  // ========== 数据写入 ==========
  
  async function createPost(input: PostInput): Promise<Post> {
    const source = sessionContextService.getCurrentSourceTracking();
    
    const post: Post = {
      id: `post_${Date.now()}`,
      platformId: 'myapp',
      content: input.content,
      authorId: input.authorId,
      timestamp: Date.now(),
      source,
    };
    
    await db.socialPosts.add(post);
    
    // 刷新列表
    await loadPosts();
    
    return post;
  }
  
  // ========== 过滤模式切换 ==========
  
  function setFilterMode(mode: FilterMode) {
    filterMode.value = mode;
    loadPosts();
  }
  
  // ========== 自动响应会话变化 ==========
  
  watch(
    () => sessionContextService.context.value.sessionId,
    () => {
      loadPosts();
    }
  );
  
  // Swipe 切换时也刷新（如果使用 swipe 过滤模式）
  watch(
    () => sessionContextService.context.value.swipeId,
    () => {
      if (filterMode.value === 'swipe') {
        loadPosts();
      }
    }
  );
  
  // ========== 导出 ==========
  
  return {
    // 状态
    posts,
    filterMode,
    isLoading,
    isConnected,
    currentSession,
    
    // 方法
    loadPosts,
    createPost,
    setFilterMode,
  };
});
```

---

## 调试技巧

### 在控制台查看上下文

```typescript
// 导入服务
import { sessionContextService } from '@/services/sessionContext';

// 查看当前状态
console.log('Context:', sessionContextService.getContext());
console.log('Connected:', sessionContextService.isConnected.value);

// 查看来源追踪
console.log('Source:', sessionContextService.getCurrentSourceTracking());
```

### 测试过滤器

```typescript
const filter = sessionContextService.buildSourceFilter('session');

// 测试记录
const testRecord = {
  id: 'test',
  source: {
    sessionId: 'abc',
    sourceMessageId: 10,
  },
};

console.log('通过过滤:', filter(testRecord)); // true 或 false
```

### 开启调试模式

```typescript
// 如果服务支持调试模式
sessionContextService.setDebug(true);

// 之后的状态变更会输出日志
// [SessionContext] updateContext: { sessionId: 'abc', ... }
```
