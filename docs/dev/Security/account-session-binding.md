# 账号系统与会话绑定设计

> **状态**: ✅ 已完成
> **问题**: Account Service 的 SessionContext 与 Bridge Adapter 的会话信息未关联
> **相关**: `docs/systems/account-service.md`, `docs/apps/Weibo/TODO.md`

---

## 1. 问题分析

### 1.1 当前架构中存在三套会话概念

| 模块               | 会话来源                           | 用途                   | 问题                   |
| ------------------ | ---------------------------------- | ---------------------- | ---------------------- |
| **Bridge Adapter** | 酒馆 `_phone_bridge.sessionId`     | 区分不同聊天文件       | 正确获取真实会话ID     |
| **Account Service**| 硬编码 `'default-session'`         | 实体/账号可见性作用域  | 未与真实会话关联       |
| **Weibo SessionContext** | 叙事缓存 `narrativeCache.sessionId` | 内容过滤           | 与 Account Service 不同步 |

### 1.2 具体问题

WeiboApp.vue 第 111-117 行：

```typescript
if (!accountStore.isInitialized) {
  const defaultContext = {
    sessionId: 'default-session',       // 硬编码
    characterCardId: 'default-character', // 硬编码
  };
  await accountStore.initialize('玩家', defaultContext);
}
```

**后果**：

1. **Account Service 的作用域判断失效**
   - `scope: 'session'` 的实体/账号永远可见
   - `scope: 'character'` 的判断也失效

2. **玩家多重身份机制无法工作**
   - 设计目标：玩家在不同角色卡有不同的微博账号
   - 实际效果：所有角色卡共享同一个账号

3. **NPC 隔离失效**
   - 设计目标：某些 NPC 只在特定会话可见
   - 实际效果：所有 NPC 在所有会话都可见

---

## 2. 解决方案

### 2.1 目标架构

创建统一会话服务，桥接 Bridge Adapter 和 Account Service：

```text
Bridge Adapter
│
├── getCurrentSessionId(): string | null
│
▼
统一会话服务 (SessionContextService)
│
├── sessionId: string          // 当前会话 UUID
├── characterCardId?: string   // 角色卡 ID
├── lastMessageId?: number     // 最后楼层
├── currentSwipeId?: number    // 当前 Swipe
│
├─────────────────┬─────────────────┐
▼                 ▼                 ▼
Account Service   Weibo App        其他 Apps
(实体/账号作用域)  (内容过滤)        (按需使用)
```

### 2.2 统一会话上下文接口

```typescript
// src/services/sessionContext/index.ts
export interface UnifiedSessionContext {
  /** 会话 UUID（来自酒馆聊天变量） */
  sessionId: string | null;
  
  /** 角色卡 ID（可选） */
  characterCardId?: string;
  
  /** 当前最后楼层 */
  lastMessageId?: number;
  
  /** 当前 Swipe */
  currentSwipeId?: number;
  
  /** 平台类型 */
  platform: string | null;
}
```

### 2.3 核心函数

- `getSessionContextFromBridge()`: 从 Bridge Adapter 获取会话信息
- `setupEventListeners()`: 设置事件监听，自动响应会话切换
- `cleanupEventListeners()`: 清理事件监听器

---

## 3. 实施计划

### Phase 1: AccountStore 自动会话管理 ✅

- [x] 在 `accountStore.ts` 中添加 `getSessionContextFromBridge()` 函数
- [x] 实现 `setupEventListeners()` 自动监听会话切换
- [x] 添加 `cleanup()` 和 `reset()` 方法

### Phase 2: 修改 App 初始化 ✅

- [x] 修改 `WeiboApp.vue` 不再传入硬编码上下文
- [x] `accountStore.initialize()` 自动从 Bridge Adapter 获取真实会话
- [x] 独立模式回退到 `'standalone-session'`

### Phase 3: 合并 Weibo SessionContext ✅

- [x] 修改 `src/apps/weibo/services/sessionContext.ts`
  - 使用 `accountStore` 作为 sessionId 的主要来源
  - 保留叙事缓存用于获取楼层/Swipe 信息
  - 新增 `syncSessionIdFromAccountStore()` 函数
- [x] 移除重复的 sessionId 管理
  - `getCurrentSourceTracking()` 优先使用 accountStore
- [x] 确保过滤器使用统一的会话信息
- [x] 添加账号会话绑定功能 (`bindWeiboAccountToCurrentSession`)
- [x] 在设置页面添加账号绑定 UI

### Phase 4: 扩展桥接脚本（可选）

- [ ] 扩展 `phone-bridge.js` 发送 characterCardId
- [ ] 更新 Bridge Server 处理新字段

---

## 4. 影响范围

### 需要修改的文件

| 文件 | 修改内容 | 状态 |
| ---- | -------- | ---- |
| `src/stores/accountStore.ts` | 自动会话管理 | ✅ 已完成 |
| `src/apps/weibo/WeiboApp.vue` | 简化初始化 | ✅ 已完成 |
| `src/apps/weibo/services/sessionContext.ts` | 改用统一服务 | ✅ 已完成 |
| `src/apps/weibo/stores/dataMigration.ts` | 添加账号绑定 | ✅ 已完成 |
| `src/apps/weibo/views/WeiboSettings.vue` | 添加绑定 UI | ✅ 已完成 |
| `src/apps/account-manager/AccountManagerApp.vue` | 显示会话上下文 | ✅ 已完成 |
| `src/apps/account-manager/components/AccountCard.vue` | 显示会话绑定信息 | ✅ 已完成 |

### 向后兼容

- **独立模式**：没有 Bridge 连接时使用 `'standalone-session'` 作为回退
- **旧数据**：已有的 `scope: 'session'` 数据如果 sessionId 为空，默认可见
- **API 兼容**：`initialize(playerName, context?)` 仍支持传入 context（向后兼容）

---

## 5. 开发者指南

### 对于 App 开发者

**改进后**：无需关心会话管理，底层自动处理

```typescript
// App 初始化 - 简洁版
onMounted(async () => {
  // accountStore 自动获取真实会话信息
  await accountStore.initialize('玩家');
  
  // 直接使用
  const account = await accountStore.ensurePlayerAccount('weibo');
});
```

### 会话切换自动处理

AccountStore 会自动监听以下事件并更新上下文：

- `chat_changed`: 用户切换聊天
- `bridge:platform_changed`: 平台连接/断开
- `bridge:full_sync`: 完整同步（可能包含新会话）

---

## 6. 技术问题与修复

### 6.1 IndexedDB 序列化问题

**问题**: Vue 的响应式系统将对象/数组包装为 Proxy，IndexedDB 无法序列化这些代理对象。

**症状**:

```text
DataCloneError: Failed to execute 'put' on 'IDBObjectStore': 
[object Array] could not be cloned.
```

**影响场景**:

- 认证弹窗提交
- 修改粉丝数
- 编辑个人资料
- 任何涉及 `platformData` 更新的操作

**解决方案**:

在 `accountService.ts` 的数据写入方法中，对 `platformData` 进行深拷贝：

```typescript
// createPlatformAccount
const sanitizedPlatformData = data.platformData 
  ? JSON.parse(JSON.stringify(data.platformData))
  : undefined;

// updatePlatformAccount  
const sanitizedData = { ...data };
if (sanitizedData.platformData) {
  sanitizedData.platformData = JSON.parse(JSON.stringify(sanitizedData.platformData));
}
```

**修复文件**:

| 文件 | 修改 |
| ---- | ---- |
| `src/services/account/accountService.ts` | `createPlatformAccount()`, `updatePlatformAccount()` |
| `src/apps/weibo/components/VerificationDialog.vue` | 额外防护 |
| `src/apps/weibo/components/EditFollowersDialog.vue` | 额外防护 |

---

## 7. 数据迁移与清理

### 7.1 旧数据清理脚本

位置: `src/apps/weibo/scripts/clearAllWeiboData.ts`

**功能**: 一键清除所有微博相关数据，用于版本升级后重置。

**清理范围**:

| 数据类型   | 表名             | 清理条件                           |
| ---------- | ---------------- | ---------------------------------- |
| 帖子       | socialPosts      | `platformId = 'weibo'`             |
| 评论       | socialComments   | `platformId = 'weibo'`             |
| 热搜       | socialTopics     | `platformId = 'weibo'`             |
| App 数据   | appData          | `namespace` 以 `'builtin/weibo'` 开头 |
| 微博账号   | platformAccounts | `platformId = 'weibo'`             |
| 迁移标记   | appSettings      | 特定的 key                         |

**使用方式**:

```javascript
// 打开微博 App 后，在浏览器控制台执行：

// 查看数据统计
await getWeiboDataStats()
// 输出: { posts: 12, comments: 45, topics: 10, appData: 8, accounts: 2 }

// 清除所有微博数据
await clearAllWeiboData()
// 输出: { postsDeleted: 12, commentsDeleted: 45, ... }
```

### 7.2 自动绑定

`src/apps/weibo/stores/dataMigration.ts` 中的 `autoBindToCurrentSession()` 函数会在首次同步时自动将现有数据绑定到当前会话。
