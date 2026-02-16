# 核心概念

> 本文档详细说明 Context Sharing Service 的核心概念和类型定义。

## 1. SharedContext（共享上下文）

### 1.1 结构定义

```typescript
/**
 * 共享上下文的元信息
 */
interface SharedContextMeta {
  /** 上下文唯一标识 */
  id: string;
  
  /** 发布者 App ID */
  publisherId: string;
  
  /** 上下文类型（预定义或自定义）*/
  type: ContextType;
  
  /** 人类可读的描述 */
  description: string;
  
  /** 可见性策略 */
  visibility: ContextVisibility;
  
  /** 更新时间戳 */
  updatedAt: number;
  
  /** 缓存配置 */
  cache?: {
    ttl: number;                    // 缓存时间（ms）
    staleWhileRevalidate?: boolean; // 过期时仍返回旧值
  };
}

/**
 * 共享上下文完整结构
 */
interface SharedContext<T = any> extends SharedContextMeta {
  /** 上下文值 */
  value: T;
  
  /** 获取器函数（惰性求值）*/
  getter?: () => T | Promise<T>;
}
```

### 1.2 值与获取器

上下文可以通过两种方式提供数据：

| 方式 | 说明 | 适用场景 |
| ------ | ------ | ---------- |
| **value** | 直接提供值 | 静态数据、已知数据 |
| **getter** | 惰性求值函数 | 动态数据、需要计算的数据 |

```typescript
// 直接值
contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  value: trendStore.trendingList,  // 直接提供值
});

// 惰性获取器
contextSharingService.publish({
  id: 'narrative:current',
  type: 'narrative:content',
  description: '当前叙事内容',
  getter: async () => {  // 调用时才执行
    return await narrativeService.getCurrentNarrative();
  },
});
```

---

## 2. ContextType（上下文类型）

### 2.1 预定义类型

```typescript
/**
 * 预定义的上下文类型
 */
type WellKnownContextType =
  // === 系统级 ===
  | 'system:time'              // 当前时间状态
  | 'system:session'           // 会话信息
  | 'system:player'            // 玩家信息
  
  // === 叙事相关 ===
  | 'narrative:content'        // 当前叙事内容
  | 'narrative:characters'     // 当前场景角色
  | 'narrative:location'       // 当前场景地点
  | 'narrative:mood'           // 当前氛围/情绪
  
  // === 社交内容 ===
  | 'social:trending'          // 热搜/热点
  | 'social:recentPosts'       // 最近发布的内容
  | 'social:hotTopics'         // 热门话题
  
  // === 聊天相关 ===
  | 'chat:lastMessage'         // 最新聊天消息
  | 'chat:recentHistory'       // 最近聊天历史
  | 'chat:participants'        // 聊天参与者
  
  // === 用户状态 ===
  | 'user:currentAccount'      // 当前操作账号
  | 'user:recentActions'       // 最近用户操作
  | 'user:preferences'         // 用户偏好
  
  // === 知识库 ===
  | 'archive:pinned'           // 置顶档案
  | 'archive:relevant'         // 相关档案
  | 'archive:characters';      // 角色档案

/**
 * 上下文类型（预定义 + 自定义）
 */
type ContextType = WellKnownContextType | `custom:${string}`;
```

### 2.2 类型说明

#### 系统级

| 类型 | 说明 | 典型值 |
| ------ | ------ | -------- |
| `system:time` | 当前时间状态 | `{ now: number, period: string, formatted: string }` |
| `system:session` | 会话信息 | `{ sessionId, characterName, playerName }` |
| `system:player` | 玩家信息 | `{ name, avatar, settings }` |

#### 叙事相关

| 类型 | 说明 | 典型值 |
| ------ | ------ | -------- |
| `narrative:content` | 叙事内容 | 纯文本故事内容 |
| `narrative:characters` | 场景角色 | `[{ name, role, status }]` |
| `narrative:location` | 场景地点 | `{ name, description }` |
| `narrative:mood` | 氛围/情绪 | `'tense' \ | 'relaxed' \ | 'romantic'` |

#### 社交内容

| 类型 | 说明 | 典型值 |
| ------ | ------ | -------- |
| `social:trending` | 热搜榜 | `[{ id, title, heat, category }]` |
| `social:recentPosts` | 最近帖子 | `[{ id, content, author, timestamp }]` |
| `social:hotTopics` | 热门话题 | `[{ tag, postCount, trending }]` |

#### 聊天相关

| 类型 | 说明 | 典型值 |
| ------ | ------ | -------- |
| `chat:lastMessage` | 最新消息 | `{ role, content, timestamp }` |
| `chat:recentHistory` | 聊天历史 | `[{ role, content, timestamp }]` |
| `chat:participants` | 参与者 | `[{ id, name, avatar }]` |

#### 用户状态

| 类型 | 说明 | 典型值 |
| ------ | ------ | -------- |
| `user:currentAccount` | 当前账号 | `{ id, name, avatar, platformId }` |
| `user:recentActions` | 最近操作 | `[{ action, target, timestamp }]` |
| `user:preferences` | 用户偏好 | `{ theme, language, notifications }` |

#### 知识库

| 类型 | 说明 | 典型值 |
| ------ | ------ | -------- |
| `archive:pinned` | 置顶档案 | `[{ id, title, content, type }]` |
| `archive:relevant` | 相关档案 | `[{ id, title, relevance }]` |
| `archive:characters` | 角色档案 | `[{ id, name, description, traits }]` |

### 2.3 自定义类型

对于预定义类型未覆盖的场景，可以使用自定义类型：

```typescript
// 自定义类型必须以 'custom:' 为前缀
contextSharingService.publish({
  id: 'myapp:special-data',
  type: 'custom:myapp:specialData',
  description: '我的应用特殊数据',
  value: { ... },
});
```

---

## 3. ContextVisibility（可见性策略）

### 3.1 结构定义

```typescript
/**
 * 上下文可见性配置
 */
interface ContextVisibility {
  /** 公开级别 */
  level: 'public' | 'restricted' | 'private';
  
  /** 允许访问的 App ID 列表（restricted 时使用）*/
  allowedApps?: string[];
  
  /** 排除的 App ID 列表 */
  excludedApps?: string[];
}
```

### 3.2 可见性级别

| 级别 | 说明 | 典型场景 |
| ------ | ------ | ---------- |
| `public` | 所有 App 可访问 | 热搜、叙事内容 |
| `restricted` | 仅指定 App 可访问 | 敏感数据、内部数据 |
| `private` | 仅发布者可访问 | 临时数据、调试数据 |

### 3.3 快捷可见性

```typescript
const Visibility = {
  /** 所有 App 可访问 */
  PUBLIC: { level: 'public' } as ContextVisibility,
  
  /** 仅发布者可访问 */
  PRIVATE: { level: 'private' } as ContextVisibility,
  
  /** 指定 App 可访问 */
  only: (...appIds: string[]): ContextVisibility => ({
    level: 'restricted',
    allowedApps: appIds,
  }),
  
  /** 排除指定 App */
  except: (...appIds: string[]): ContextVisibility => ({
    level: 'public',
    excludedApps: appIds,
  }),
};

// 使用示例
contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  value: trendingList,
  visibility: Visibility.PUBLIC,
});

contextSharingService.publish({
  id: 'internal:debug',
  type: 'custom:debug',
  description: '调试数据',
  value: debugInfo,
  visibility: Visibility.only('dev-tools', 'admin'),
});

contextSharingService.publish({
  id: 'user:sensitive',
  type: 'user:preferences',
  description: '用户敏感偏好',
  value: sensitivePrefs,
  visibility: Visibility.except('public-app'),
});
```

---

## 4. 缓存机制

### 4.1 缓存配置

```typescript
interface CacheConfig {
  /** 缓存时间（毫秒）*/
  ttl: number;
  
  /** 过期时是否仍返回旧值（同时触发更新）*/
  staleWhileRevalidate?: boolean;
}
```

### 4.2 缓存行为

| 配置 | 行为 |
| ------ | ------ |
| 无缓存配置 | 每次获取都执行 getter（如有） |
| 仅 `ttl` | TTL 内返回缓存，过期后重新获取 |
| `staleWhileRevalidate: true` | 过期时返回旧值，后台异步更新 |

```typescript
// 标准缓存
contextSharingService.publish({
  id: 'weibo:trending',
  type: 'social:trending',
  description: '微博热搜榜',
  getter: () => fetchTrending(),
  cache: { ttl: 5 * 60 * 1000 },  // 5 分钟缓存
});

// 过期时返回旧值
contextSharingService.publish({
  id: 'narrative:current',
  type: 'narrative:content',
  description: '当前叙事',
  getter: async () => await narrativeService.getCurrent(),
  cache: {
    ttl: 30 * 1000,
    staleWhileRevalidate: true,  // 过期时仍返回旧值
  },
});
```

---

## 5. 聚合请求

### 5.1 聚合请求结构

```typescript
/**
 * 聚合请求
 */
interface AggregationRequest {
  /** 请求者 App ID */
  requesterId: string;
  
  /** 需要的上下文类型 */
  types?: ContextType[];
  
  /** 需要的特定上下文 ID */
  ids?: string[];
  
  /** 格式化选项 */
  format?: AggregationFormat;
  
  /** 最大 token 数（用于 LLM）*/
  maxTokens?: number;
  
  /** 优先级排序（优先包含的类型）*/
  priority?: ContextType[];
}

/**
 * 聚合格式
 */
type AggregationFormat = 
  | 'raw'          // 返回原始对象
  | 'text'         // 格式化为文本
  | 'xml'          // 格式化为 XML 标签
  | 'markdown';    // 格式化为 Markdown
```

### 5.2 聚合结果

```typescript
/**
 * 聚合结果
 */
interface AggregatedContext {
  /** 聚合后的上下文（按类型分组）*/
  contexts: Map<ContextType, any[]>;
  
  /** 格式化后的文本（如果请求了 format）*/
  formatted?: string;
  
  /** 元信息 */
  meta: {
    totalContexts: number;
    types: ContextType[];
    estimatedTokens?: number;
    truncated?: boolean;
  };
}
```

### 5.3 格式化输出示例

#### XML 格式

```xml
<context type="narrative:content">
  <item id="narrative:current">当前叙事内容...</item>
</context>
<context type="social:trending">
  <item id="weibo:trending">[{"title":"热搜1"},{"title":"热搜2"}]</item>
</context>
```

#### Markdown 格式

```markdown
## narrative:content

### 当前酒馆叙事内容
```json
"当前叙事内容..."
```

## social:trending

### 微博热搜榜
```json
[{"title":"热搜1"},{"title":"热搜2"}]
```
```

#### Text 格式

```text
[narrative:content]
- 当前酒馆叙事内容: "当前叙事内容..."

[social:trending]
- 微博热搜榜: [{"title":"热搜1"},{"title":"热搜2"}]
```

---

## 6. 事件通知

服务通过 Event Bus 发布以下事件：

| 事件 | 触发时机 | 载荷 |
| ------ | ---------- | ------ |
| `contextSharing:published` | 发布新上下文 | `{ id, type }` |
| `contextSharing:updated` | 更新上下文 | `{ id }` |
| `contextSharing:unpublished` | 取消发布 | `{ id, type }` |

```typescript
import { eventBus } from '@/services/eventBus';

eventBus.on('contextSharing:published', ({ id, type }) => {
  console.log(`新上下文发布: ${id} (${type})`);
});

eventBus.on('contextSharing:updated', ({ id }) => {
  console.log(`上下文更新: ${id}`);
});
```
