# 类型定义

## 会话上下文

```typescript
// src/services/sessionContext/types.ts

/**
 * 会话上下文
 * 描述当前酒馆会话的状态
 */
export interface SessionContext {
  /** 
   * 酒馆会话 ID
   * 对应一个聊天文件，角色卡切换时会改变
   */
  sessionId: string | null;
  
  /** 
   * 当前楼层 ID
   * 最后一条消息的 message_id
   */
  messageId: number | null;
  
  /** 
   * 当前消息页 ID
   * 最后楼层的 swipe_id（同一楼层可以有多个版本）
   */
  swipeId: number | null;
  
  /** 
   * 角色名
   * 当前对话的 AI 角色名称
   */
  characterName?: string;
  
  /** 
   * 玩家名
   * 当前用户的名称
   */
  playerName?: string;
}
```

---

## 来源追踪

```typescript
/**
 * 内容来源追踪
 * 附加到每条 App 数据上，记录其生成时的上下文
 */
export interface ContentSourceTracking {
  /** 
   * 会话 ID
   * 记录数据属于哪个聊天会话
   */
  sessionId?: string;
  
  /** 
   * 来源楼层 ID
   * 记录数据是在哪个楼层生成的
   */
  sourceMessageId?: number;
  
  /** 
   * 来源消息页 ID
   * 记录数据是在哪个 Swipe 版本生成的
   */
  sourceSwipeId?: number;
  
  /** 
   * 生成时间戳
   * 记录数据的生成时间
   */
  generatedAt?: number;
}
```

---

## 可追踪记录

```typescript
/**
 * 可追踪来源的记录接口
 * App 数据需要实现此接口才能被过滤
 */
export interface Sourceable {
  /** 来源追踪信息（可选） */
  source?: ContentSourceTracking;
}
```

### 使用示例

```typescript
// 微博帖子实现 Sourceable 接口
interface WeiboPost extends Sourceable {
  id: string;
  content: string;
  authorId: string;
  timestamp: number;
  // source 字段继承自 Sourceable
}

// 保存时附加来源
const post: WeiboPost = {
  id: 'post_001',
  content: '今天天气真好',
  authorId: 'user_001',
  timestamp: Date.now(),
  source: {
    sessionId: 'session_abc',
    sourceMessageId: 10,
    sourceSwipeId: 0,
    generatedAt: Date.now(),
  },
};
```

---

## 过滤模式

```typescript
/**
 * 数据过滤模式
 * 决定 buildSourceFilter 的过滤粒度
 */
export type FilterMode = 
  | 'all'      // 不过滤，显示所有数据
  | 'session'  // 按会话过滤（推荐默认值）
  | 'message'  // 按楼层过滤
  | 'swipe';   // 按消息页过滤（最精确）
```

### 过滤模式详解

| 模式      | 过滤条件                                     | 适用场景               |
| --------- | -------------------------------------------- | ---------------------- |
| `all`     | 无过滤                                       | 管理界面、数据导出     |
| `session` | `source.sessionId === current.sessionId`     | **日常使用（推荐）**   |
| `message` | 上述 + `source.messageId <= current.messageId` | 时间线视图             |
| `swipe`   | 上述 + 最后楼层需匹配 swipeId                 | 分支数据（精确匹配）   |

---

## 过滤函数类型

```typescript
/**
 * 来源过滤函数
 * 由 buildSourceFilter 返回，用于 Array.filter 或 Dexie.filter
 */
export type SourceFilterFunction = (record: Sourceable) => boolean;
```

### 使用示例

```typescript
// 获取过滤函数
const filter: SourceFilterFunction = 
  sessionContextService.buildSourceFilter('session');

// 用于数组过滤
const filtered = allPosts.filter(filter);

// 用于 Dexie 查询
const posts = await db.posts
  .where('platformId').equals('weibo')
  .filter(filter)
  .toArray();
```

---

## Bridge 事件类型

```typescript
/**
 * Bridge sync 事件数据
 */
export interface BridgeSyncEventData {
  sessionId: string;
  lastMessageId: number;
  lastSwipeId: number;
  characterName?: string;
  playerName?: string;
}

/**
 * Bridge swipe_changed 事件数据
 */
export interface BridgeSwipeChangedEventData {
  messageId: number;
  oldSwipeId: number;
  newSwipeId: number;
}

/**
 * Bridge platform_connected 事件数据
 */
export interface BridgePlatformConnectedEventData {
  characterName: string;
  playerName: string;
}
```

---

## 服务配置

```typescript
/**
 * 服务初始化配置（可选）
 */
export interface SessionContextServiceConfig {
  /** 
   * 默认过滤模式
   * @default 'session'
   */
  defaultFilterMode?: FilterMode;
  
  /** 
   * 是否在无会话时返回空 source
   * true: 返回 undefined
   * false: 返回包含 generatedAt 的对象
   * @default true
   */
  strictSourceTracking?: boolean;
  
  /** 
   * 调试模式
   * 开启后会输出状态变更日志
   * @default false
   */
  debug?: boolean;
}
```

---

## 服务接口

```typescript
/**
 * 会话上下文服务接口
 */
export interface ISessionContextService {
  // ========== 状态访问 ==========
  
  /** 获取当前上下文（响应式 Ref） */
  readonly context: Readonly<Ref<SessionContext>>;
  
  /** 是否已连接到酒馆（响应式 Ref） */
  readonly isConnected: Readonly<Ref<boolean>>;
  
  /** 获取当前上下文快照（非响应式） */
  getContext(): SessionContext;
  
  // ========== 状态更新 ==========
  
  /** 更新上下文 */
  updateContext(partial: Partial<SessionContext>): void;
  
  /** 清空上下文 */
  clearContext(): void;
  
  // ========== 来源追踪 ==========
  
  /** 获取当前来源追踪数据 */
  getCurrentSourceTracking(): ContentSourceTracking | undefined;
  
  // ========== 过滤器 ==========
  
  /** 构建数据过滤函数 */
  buildSourceFilter(mode?: FilterMode): SourceFilterFunction;
}
```

---

## 完整类型文件

```typescript
// src/services/sessionContext/types.ts

import type { Ref } from 'vue';

// ========== 核心类型 ==========

export interface SessionContext {
  sessionId: string | null;
  messageId: number | null;
  swipeId: number | null;
  characterName?: string;
  playerName?: string;
}

export interface ContentSourceTracking {
  sessionId?: string;
  sourceMessageId?: number;
  sourceSwipeId?: number;
  generatedAt?: number;
}

export interface Sourceable {
  source?: ContentSourceTracking;
}

export type FilterMode = 'all' | 'session' | 'message' | 'swipe';

export type SourceFilterFunction = (record: Sourceable) => boolean;

// ========== Bridge 事件 ==========

export interface BridgeSyncEventData {
  sessionId: string;
  lastMessageId: number;
  lastSwipeId: number;
  characterName?: string;
  playerName?: string;
}

export interface BridgeSwipeChangedEventData {
  messageId: number;
  oldSwipeId: number;
  newSwipeId: number;
}

export interface BridgePlatformConnectedEventData {
  characterName: string;
  playerName: string;
}

// ========== 配置 ==========

export interface SessionContextServiceConfig {
  defaultFilterMode?: FilterMode;
  strictSourceTracking?: boolean;
  debug?: boolean;
}

// ========== 服务接口 ==========

export interface ISessionContextService {
  readonly context: Readonly<Ref<SessionContext>>;
  readonly isConnected: Readonly<Ref<boolean>>;
  getContext(): SessionContext;
  updateContext(partial: Partial<SessionContext>): void;
  clearContext(): void;
  getCurrentSourceTracking(): ContentSourceTracking | undefined;
  buildSourceFilter(mode?: FilterMode): SourceFilterFunction;
}
```
