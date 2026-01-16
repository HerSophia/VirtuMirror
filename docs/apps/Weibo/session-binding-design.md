# 微博数据与酒馆会话绑定设计

> 目标：让微博 App 的 LLM 生成内容、用户行为和浏览历史与酒馆的会话/楼层/Swipe 绑定，切换时自动切换对应数据。

## 1. 背景与需求

### 1.1 现有架构

当前已有的基础设施：

| 模块 | 文件 | 功能 |
|------|------|------|
| Swipe 类型定义 | `src/types/swipe.ts` | `PhoneDataItem`、`TrackedDataItem`、`SourceTracking` 等 |
| Swipe 状态管理 | `src/stores/swipeStore.ts` | 分层存储（permanentData + lastFloor.swipeData） |
| 叙事订阅 | `src/apps/weibo/composables/useNarrativeSubscription.ts` | 已追踪 `source: { messageId, swipeId, sessionId }` |
| 叙事集成 | `src/apps/weibo/stores/llm/narrativeIntegration.ts` | 缓存叙事元数据 |

### 1.2 当前问题

1. **数据模型缺失追踪字段**：`UniversalPost`/`UniversalComment`/`TrendingTopic` 没有 `sourceMessageId`/`sourceSwipeId`
2. **切换无响应**：切换 swipe 时，微博 App 没有过滤/切换显示的数据
3. **用户行为无隔离**：点赞、收藏、浏览历史存储在 ScopedStorage 中，没有按会话/swipe 隔离

### 1.3 目标行为

```
┌─────────────────────────────────────────────────────────────────┐
│                    酒馆聊天 A（角色卡 X）                         │
├─────────────────────────────────────────────────────────────────┤
│  楼层 1     楼层 2     楼层 3 (最后楼层)                          │
│  ┌─────┐   ┌─────┐   ┌───────────────────────────────┐          │
│  │     │   │     │   │ Swipe 0  │ Swipe 1  │ Swipe 2 │          │
│  │ 固化 │   │ 固化 │   │ 当前显示 │          │          │          │
│  └─────┘   └─────┘   └───────────────────────────────┘          │
│    ↓         ↓              ↓                                    │
│  博文 A    博文 B       博文 C (Swipe 0)                          │
│搜 1    热搜 2       热搜 3 (Swipe 0)                          │
│  评论 X    评论 Y       评论 Z (Swipe 0)                          │
└─────────────────────────────────────────────────────────────────┘

切换到 Swipe 1 时：
- 隐藏 博文 C、热搜 3、评论 Z（Swipe 0 的数据）
- 显示 博文 D、热搜 4、评论 W（Swipe 1 的数据，如有）
- 用户点赞/收藏记录也按 Swipe 隔离
```

---

## 2. 数据模型扩展

### 2.1 来源追踪类型

```typescript
// src/types/social.ts 新增

/**
 * 内容来源追踪
 * 记录内容生成时的酒馆上下文
 */
export interface ContentSourceTracking {
  /** 来源会话 ID (sessionId) */
  sessionId?: string;
  
  /** 来源楼层（酒馆 message_id） */
  sourceMessageId?: number;
  
  /** 来源消息页（swipe_id） */
  sourceSwipeId?: number;
  
  /** 生成时间戳 */
  generatedAt?: number;
}
```

### 2.2 扩展 UniversalPost

```typescript
// src/types/social.ts 修改 UniversalPost

export interface UniversalPost {
  // ... 现有字段 ...
  
  // === 新增：来源追踪 ===
  /** 内容来源追踪 */
  source?: ContentSourceTracking;
}
```

### 2.3 扩展 UniversalComment

```typescript
export interface UniversalComment {
  // ... 现有字段 ...
  
  // === 新增：来源追踪 ===
  source?: ContentSourceTracking;
}
```

### 2.4 扩展 TrendingTopic

```typescript
export interface TrendingTopic {
  // ... 现有字段 ...
  
  // === 新增：来源追踪 ===
  source?: ContentSourceTracking;
}
```

---

## 3. 数据库 Schema 扩展

### 3.1 版本 8：添加来源追踪索引

```typescript
// src/services/database/schema.ts

this.version(8).stores({
  // ... 继承之前的表 ...
  
  // 社交表添加来源追踪索引
  socialPosts: 'id, platformId, namespace, [platformId+timestamp], *topicTags, authorId, ' +
    '[source.sessionId], [source.sessionId+source.sourceMessageId], ' +
    '[source.sessionId+source.sourceMessageId+source.sourceSwipeId]',
    
  socialComments: 'id, [postId+timestamp], platformId, namespace, authorId, ' +
    '[source.sessionId], [source.sessionId+source.sourceMessageId+source.sourceSwipeId]',
    
  socialTopics: 'id, platformId, namespace, [platformId+isHot], [platformId+isNew], ' +
    '[platformId+createdAt], *categories, createdAt, ' +
    '[source.sessionId], [source.sessionId+source.sourceMessageId+source.sourceSwipeId]',
});
```

> **注意**：Dexie 的嵌套字段索引使用点号表示法，如 `source.sessionId`

---

## 4. 会话上下文管理

### 4.1 SessionContext 服务

```typescript
// src/apps/weibo/services/sessionContext.ts

import { ref, computed } from 'vue';
import { narrativeCache, getNarrativeCacheMetadata } from '../stores/llm/narrativeIntegration';

/**
 * 微博会话上下文
 * 管理当前显示数据的过滤条件
 */
export interface WeiboSessionContext {
  /** 当前会话 ID */
  sessionId: string | null;
  
  /** 当前最后楼层 ID（从叙事缓存获取） */
  lastMessageId: number | null;
  
  /** 当前 swipe ID（从叙事缓存获取） */
  currentSwipeId: number | null;
  
  /** 数据过滤模式 */
  filterMode: 'all' | 'session' | 'message' | 'swipe';
}

// 当前上下文
const context = ref<WeiboSessionContext>({
  sessionId: null,
  lastMessageId: null,
  currentSwipeId: null,
  filterMode: 'session', // 默认按会话过滤
});

/**
 * 从叙事缓存同步上下文
 */
export function syncContextFromNarrative(): void {
  const metadata = getNarrativeCacheMetadata();
  if (metadata) {
    context.value = {
      sessionId: metadata.sessionId ?? null,
      lastMessageId: metadata.messageId ?? null,
      currentSwipeId: metadata.swipeId ?? null,
      filterMode: context.value.filterMode,
    };
  }
}

/**
 * 获取当前会话上下文
 */
export function getSessionContext(): WeiboSessionContext {
  return context.value;
}

/**
 * 获取当前来源追踪数据（用于写入新内容）
 */
export function getCurrentSourceTracking(): ContentSourceTracking | undefined {
  const metadata = getNarrativeCacheMetadata();
  if (!metadata?.sessionId) return undefined;
  
  return {
    sessionId: metadata.sessionId,
    sourceMessageId: metadata.messageId,
    sourceSwipeId: metadata.swipeId,
    generatedAt: Date.now(),
  };
}

/**
 * 设置过滤模式
 */
export function setFilterMode(mode: WeiboSessionContext['filterMode']): void {
  context.value.filterMode = mode;
}

/**
 * 构建数据库查询过滤条件
 */
export function buildSourceFilter(ctx: WeiboSessionContext) {
  return (record: { source?: ContentSourceTracking }) => {
    if (ctx.filterMode === 'all') return true;
    if (!ctx.sessionId) return true; // 无会话时不过滤
    
    const source = record.source;
    if (!source) {
      // 无来源的记录：历史数据，默认显示
      return true;
    }
    
    // 会话级过滤
    if (source.sessionId !== ctx.sessionId) return false;
    
    if (ctx.filterMode === 'session') return true;
    
    // 楼层级过滤
    if (ctx.filterMode === 'message' && ctx.lastMessageId !== null) {
      // 显示所有已确定楼层 + 当前楼层
      return source.sourceMessageId === undefined || 
             source.sourceMessageId <= ctx.lastMessageId;
    }
    
    // Swipe 级过滤
    if (ctx.filterMode === 'swipe' && ctx.lastMessageId !== null) {
      // 非最后楼层的数据：直接显示
      if (source.sourceMessageId !== ctx.lastMessageId) return true;
      
      // 最后楼层的数据：只显示当前 swipe 的
      return source.sourceSwipeId === ctx.currentSwipeId;
    }
    
    return true;
  };
}
```

---

## 5. 数据写入改造

### 5.1 获取来源追踪的工具函数

```typescript
// src/apps/weibo/stores/llm/sourceTracking.ts

import { getNarrativeCacheMetadata } from './narrativeIntegration';
import type { ContentSourceTracking } from '@/types/social';

/**
 * 获取当前的来源追踪数据
 * 在生成内容时调用，记录内容来自哪个会话/楼层/Swipe
 */
export function getCurrentSourceTracking(): ContentSourceTracking | undefined {
  const metadata = getNarrativeCacheMetadata();
  
  if (!metadata?.sessionId) {
    console.warn('[SourceTracking] 无法获取会话信息，内容将不带来源追踪');
    return undefined;
  }
  
  return {
    sessionId: metadata.sessionId,
    sourceMessageId: metadata.messageId,
    sourceSwipeId: metadata.swipeId,
    generatedAt: Date.now(),
  };
}

/**
 * 验证来源追踪数据是否完整
 */
export function isValidSourceTracking(source?: ContentSourceTracking): boolean {
  return !!(source?.sessionId && source.sourceMessageId !== undefined);
}
```

### 5.2 修改 outputHandlers.ts

```typescript
// src/apps/weibo/stores/llm/outputHandlers.ts 修改

import { getCurrentSourceTracking } from './sourceTracking';

export async function saveSinglePost(postData: any): Promise<string | null> {
  // ... 现有逻辑 ...
  
  // 获取来源追踪
  const source = getCurrentSourceTracking();
  
  const post: UniversalPost = {
    id: uuidv4(),
    platformId: 'weibo',
    namespace,
    // ... 其他字段 ...
    
    // 新增：来源追踪
    source,
  };
  
  await writeQueue.enqueue('app', namespace || 'weibo', async () => {
    await db.socialPosts.add(post);
  });
  
  return post.id;
}
```

### 5.3 修改 parsers/postParser.ts

```typescript
// src/apps/weibo/stores/llm/parsers/postParser.ts 修改

import { getCurrentSourceTracking } from '../sourceTracking';

export class PostParser implements ContentParser<ParsedPostResult> {
  async parse(data: any[], context: ParseContext): Promise<ParsedPostResult> {
    const source = getCurrentSourceTracking();
    
    const posts = data.map(item => ({
      // ... 现有转换逻辑 ...
      source, // 附加来源追踪
    }));
    
    // ...
  }
}
```

---

## 6. 数据读取改造

### 6.1 修改 feedStore.ts

```typescript
// src/apps/weibo/stores/feedStore.ts 修改

import { 
  getSessionContext, 
  buildSourceFilter,
  syncContextFromNarrative 
} from '../services/sessionContext';

async function refreshFeed() {
  isLoading.value = true;

  // 同步会话上下文
  syncContextFromNarrative();
  
  const runtime = tryUseAppRuntime();
  const namespace = runtime?.identity.dataNamespace;
  const ctx = getSessionContext();
  const sourceFilter = buildSourceFilter(ctx);
  
  // 获取最新的 UniversalPost（按平台 + 命名空间 + 来源过滤）
  const storedPosts = await db.socialPosts
    .where('platformId')
    .equals('weibo')
    .filter(p => 
      (!namespace || p.namespace === namespace) && 
      sourceFilter(p)
    )
    .reverse()
    .sortBy('timestamp')
    .then(posts => posts.slice(0, 20));

  // ... 后续逻辑 ...
}
```

### 6.2 修改 hotSearchStore.ts

```typescript
// src/apps/weibo/stores/hotSearchStore.ts 修改

import { getSessionContext, buildSourceFilter } from '../services/sessionContext';

async function refreshHotSearch() {
  const ctx = getSessionContext();
  const sourceFilter = buildSourceFilter(ctx);
  
  const topics = await TrendService.getInstance().getTrendingList('weibo');
  
  // 按来源过滤
  const filteredTopics = topics.filter(topic => {
    // 平台过滤
    if (topic.platformId && topic.platformId !== 'weibo') return false;
    // namespace 过滤
    const namespace = tryUseAppRuntime()?.identity.dataNamespace;
    if (namespace && topic.namespace && topic.namespace !== namespace) return false;
    // 来源过滤
    return sourceFilter(topic);
  });
  
  // ... 后续逻辑 ...
}
```

---

## 7. Swipe 切换处理

### 7.1 监听 swipe_changed 事件

```typescript
// src/apps/weibo/WeiboApp.vue 修改

import { useAdapter } from '@/composables/useAdapter';
import { syncContextFromNarrative, setFilterMode } from './services/sessionContext';

onMounted(async () => {
  // ... 现有初始化 ...
  
  // 监听 swipe 切换
  const adapter = useAdapter();
  adapter.on('swipe_changed', handleSwipeChanged);
  adapter.on('sync', handleSync);
});

async function handleSwipeChanged(event: SwipeChangedEvent) {
  console.log('[WeiboApp] Swipe 切换:', event);
  
  // 同步上下文
  syncContextFromNarrative();
  
  // 刷新数据（会自动按新的 swipe 过滤）
  await feedStore.refreshFeed();
  await hotSearchStore.refreshHotSearch();
  
  // 重新加载用户行为数据
  await userActionStore.initialize();
}

async function handleSync(event: SyncEvent) {
  // 完整同步时也更新上下文
  syncContextFromNarrative();
}
```

---

## 8. 用户行为隔离

### 8.1 修改 userActionStore.ts

```typescript
// src/apps/weibo/stores/userActionStore.ts 修改

import { getSessionContext } from '../services/sessionContext';

/**
 * 用户行为数据结构
 * 按 sessionId 分组存储
 */
interface UserActionsData {
  /** 全局数据（跨会话共享） */
  global: {
    likes: string[];
    favorites: string[];
  };
  
  /** 按会话隔离的数据 */
  sessions: {
    [sessionId: string]: {
      likes: string[];
      favorites: string[];
      viewHistory: ViewHistoryItem[];
    };
  };
}

/**
 * 获取当前会话的存储键
 */
function getSessionKey(): string {
  const ctx = getSessionContext();
  return ctx.sessionId || 'default';
}

/**
 * 获取当前会话的用户行为
 */
function getCurrentSessionActions(): SessionActions {
  const key = getSessionKey();
  if (!data.sessions[key]) {
    data.sessions[key] = {
      likes: [],
      favorites: [],
      viewHistory: [],
    };
  }
  return data.sessions[key];
}

// 点赞操作
async function toggleLike(postId: string): Promise<boolean> {
  const sessionActions = getCurrentSessionActions();
  const index = sessionActions.likes.indexOf(postId);
  
  if (index === -1) {
    sessionActions.likes.push(postId);
  } else {
    sessionActions.likes.splice(index, 1);
  }
  
  await saveToStorage();
  return index === -1;
}

// 浏览历史
async function addViewHistory(item: ViewHistoryItem): Promise<void> {
  const sessionActions = getCurrentSessionActions();
  
  // 添加来源追踪
  const ctx = getSessionContext();
  item.source = {
    sessionId: ctx.sessionId,
    sourceMessageId: ctx.lastMessageId,
    sourceSwipeId: ctx.currentSwipeId,
    generatedAt: Date.now(),
  };
  
  sessionActions.viewHistory.unshift(item);
  // 限制历史记录数量
  if (sessionActions.viewHistory.length > 100) {
    sessionActions.viewHistory = sessionActions.viewHistory.slice(0, 100);
  }
  
  await saveToStorage();
}
```

---

## 9. 设置页面扩展

### 9.1 添加过滤模式设置

```vue
<!-- src/apps/weibo/views/WeiboSettings.vue 添加 -->

<template>
  <div class="setting-section">
    <h3>数据过滤模式</h3>
    <p class="text-sm text-gray-500">控制微博数据如何与酒馆聊天关联</p>
    
    <select v-model="filterMode" @change="onFilterModeChange">
      <option value="all">显示所有数据</option>
      <option value="session">按会话过滤（推荐）</option>
      <option value="message">按楼层过滤</option>
      <option value="swipe">按消息页过滤</option>
    </select>
    
    <div class="hint">
      <p v-if="filterMode === 'all'">显示所有微博数据，不区分来源</p>
      <p v-if="filterMode === 'session'">只显示当前聊天会话产生的微博数据</p>
      <p v-if="filterMode === 'message'">只显示当前及之前楼层产生的微博数据</p>
      <p v-if="filterMode === 'swipe'">精确匹配：最后楼层只显示当前消息页的数据</p>
    </div>
  </div>
</template>

<script setup>
import { setFilterMode, getSessionContext } from '../services/sessionContext';

const filterMode = ref(getSessionContext().filterMode);

function onFilterModeChange() {
  setFilterMode(filterMode.value);
  // 刷新数据
  feedStore.refreshFeed();
  hotSearchStore.refreshHotSearch();
}
</script>
```

---

## 10. 实施步骤

### Phase 1：数据模型（预计 2h）

- [ ] 在 `src/types/social.ts` 添加 `ContentSourceTracking` 类型
- [ ] 扩展 `UniversalPost`、`UniversalComment`、`TrendingTopic` 添加 `source` 字段
- [ ] 更新数据库 schema（版本 8）

### Phase 2：会话上下文服务（预计 2h）

- [ ] 创建 `src/apps/weibo/services/sessionContext.ts`
- [ ] 创建 `src/apps/weibo/stores/llm/sourceTracking.ts`
- [ ] 集成到叙事订阅流程

### Phase 3：写入追踪（预计 3h）

- [ ] 修改 `outputHandlers.ts` 添加来源追踪
- [ ] 修改 `postParser.ts`、`commentParser.ts`、`hotSearchParser.ts` 等
- [ ] 修改 `useNarrativeSubscription.ts`
- [ ] 修改 `composeStore.ts` 用户发布博文时的追踪

### Phase 4：读取过滤（预计 3h）

- [ ] 修改 `feedStore.ts` 的查询逻辑
- [ ] 修改 `hotSearchStore.ts` 的查询逻辑
- [ ] 修改 `narrativeIntegration.ts` 的现有内容查询

### Phase 5：用户行为（预计 2h）

- [ ] 修改 `userActionStore.ts` 按会话隔离
- [ ] 浏览历史添加来源追踪

### Phase 6：事件处理（预计 2h）

- [ ] 在 `WeiboApp.vue` 添加 swipe_changed 监听
- [ ] 添加 sync 事件处理
- [ ] 设置页面添加过滤模式选项

### Phase 7：测试与文档（预计 2h）

- [ ] 编写单元测试
- [ ] 手动测试 swipe 切换场景
- [ ] 更新 README 和 TODO 文档

---

## 11. 向后兼容

### 11.1 旧数据处理

没有 `source` 字段的历史数据：
- 在过滤时默认通过（`if (!source) return true`）
- 可选：提供迁移脚本补充 `source` 字段

### 11.2 无会话场景

当用户在非桥接模式（Mock 适配器）下使用：
- `getSessionContext()` 返回 `sessionId: null`
- 过滤器返回 true，显示所有数据
- 用户行为存储在 "default" 会话下

---

## 12. 未来扩展

### 12.1 云同步支持

`source` 字段可作为冲突检测的依据：
- 同一 sessionId + messageId + swipeId 的数据只保留一份
- 不同 swipe 的数据可并存

### 12.2 多设备同步

设备 A 切换到 Swipe 1，设备 B 仍在 Swipe 0：
- 各自显示对应 swipe 的数据
- 用户行为需要合并策略

### 12.3 回溯功能

支持用户查看历史 swipe 的数据：
- "时间线" 视图显示所有 swipe 的内容
- 标记当前活跃的 swipe
