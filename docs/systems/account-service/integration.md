# 系统集成

## 与 Bridge Adapter 的集成

### 会话上下文自动管理

AccountStore 会自动从 Bridge Adapter 获取会话信息，并监听会话切换事件：

```text
┌─────────────────────────────────────────────────────────────────────┐
│                       Bridge Adapter                                  │
│                                                                      │
│  事件:                                                               │
│  - chat_changed (会话切换)                                           │
│  - bridge:full_sync (完整数据同步)                                   │
│  - bridge:platform_changed (平台连接状态变化)                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ 事件监听
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AccountStore                                   │
│                                                                      │
│  自动响应:                                                           │
│  - getSessionContextFromBridge() 获取当前会话                        │
│  - switchSession() 切换上下文                                        │
│  - refreshVisibleData() 刷新可见数据                                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ 设置上下文
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AccountService                                  │
│                                                                      │
│  使用上下文:                                                         │
│  - 判断实体/账号可见性                                               │
│  - 自动设置新创建数据的作用域                                        │
│  - 查询当前会话可见的数据                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 实现代码

```typescript
// src/stores/accountStore.ts

/**
 * 从 Bridge Adapter 获取当前会话上下文
 * 如果没有连接，返回独立模式的回退值
 */
function getSessionContextFromBridge(): SessionContext {
  const adapter = getBridgeAdapter();
  
  if (adapter) {
    const status = adapter.getStatus();
    if (status.currentSessionId) {
      return {
        sessionId: status.currentSessionId,
        characterCardId: undefined,  // 需要酒馆扩展支持
      };
    }
  }
  
  // 独立模式回退
  return {
    sessionId: 'standalone-session',
    characterCardId: undefined,
  };
}

/**
 * 设置事件监听，自动响应会话切换
 */
function setupEventListeners(): void {
  const adapter = getBridgeAdapter();
  if (!adapter) return;
  
  // 清理旧的监听器
  cleanupEventListeners();
  
  // 监听会话切换
  const unsubChatChanged = adapter.on('chat_changed', async () => {
    console.log('[AccountStore] 检测到会话切换，自动更新上下文');
    const newContext = getSessionContextFromBridge();
    await switchSession(newContext);
  });
  eventUnsubscribers.value.push(unsubChatChanged);
  
  // 监听完整同步
  const unsubSync = adapter.on('bridge:full_sync', async () => {
    const newContext = getSessionContextFromBridge();
    if (newContext.sessionId !== sessionContext.value?.sessionId) {
      console.log('[AccountStore] 同步数据包含新会话，更新上下文');
      await switchSession(newContext);
    }
  });
  eventUnsubscribers.value.push(unsubSync);
}
```

### 独立模式

当没有连接到 SillyTavern 时，系统会使用 `'standalone-session'` 作为会话 ID：

```typescript
// 独立模式下的会话上下文
const standaloneContext: SessionContext = {
  sessionId: 'standalone-session',
  characterCardId: undefined,
};
```

---

## 与微博 App 的集成

### 集成架构

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          WeiboApp                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 微博内部                                                     │    │
│  │ - weiboStore.ts (微博数据存储)                               │    │
│  │ - WeiboSettings.vue (设置页面)                               │    │
│  │ - VerificationDialog.vue (认证弹窗)                          │    │
│  │ - EditFollowersDialog.vue (粉丝编辑弹窗)                      │    │
│  └─────────────────────────────┬───────────────────────────────┘    │
│                                │                                     │
│                                │ 调用                                │
│                                ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ AccountService / AccountStore                                │    │
│  │ - 获取可见用户列表                                           │    │
│  │ - 获取/创建玩家账号                                          │    │
│  │ - 管理关注关系                                               │    │
│  │ - 获取完整档案                                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 微博用户数据来源

```typescript
// src/apps/weibo/stores/weiboStore.ts

import { accountService } from '@/services/account';
import type { PlatformAccount, FullProfile } from '@/types/account';

// 获取当前会话可见的所有微博用户
async function loadVisibleUsers(): Promise<PlatformAccount[]> {
  return accountService.getVisibleAccounts('weibo');
}

// 获取玩家的微博账号
async function getPlayerWeiboAccount(): Promise<PlatformAccount | null> {
  return accountService.findPlayerAccountForContext('weibo');
}

// 获取用户完整档案
async function getUserProfile(accountId: string): Promise<FullProfile | null> {
  return accountService.getFullProfile(accountId);
}
```

### 微博账号创建流程

```typescript
// src/apps/weibo/WeiboApp.vue

import { accountService } from '@/services/account';
import { useAccountStore } from '@/stores/accountStore';
import type { MissingAccountInfo, PlatformAccount } from '@/types/account';

const accountStore = useAccountStore();
const showCreateDialog = ref(false);
const missingAccountInfo = ref<MissingAccountInfo | null>(null);

onMounted(async () => {
  // 检查是否需要创建账号
  const result = await accountStore.ensurePlayerAccount('weibo');
  
  if ('platformId' in result) {
    // 需要创建账号
    missingAccountInfo.value = result;
    showCreateDialog.value = true;
  } else {
    // 已有账号，加载数据
    await loadWeiboData();
  }
});

async function handleAccountCreated(account: PlatformAccount) {
  showCreateDialog.value = false;
  await loadWeiboData();
}
```

### 微博关注关系管理

```typescript
// 关注用户
async function followUser(targetAccountId: string) {
  const playerAccount = await accountService.findPlayerAccountForContext('weibo');
  if (playerAccount) {
    await accountService.followAccount(playerAccount.id, targetAccountId);
  }
}

// 取消关注
async function unfollowUser(targetAccountId: string) {
  const playerAccount = await accountService.findPlayerAccountForContext('weibo');
  if (playerAccount) {
    await accountService.unfollowAccount(playerAccount.id, targetAccountId);
  }
}

// 获取玩家的关注列表
async function getFollowingList(): Promise<PlatformAccount[]> {
  const playerAccount = await accountService.findPlayerAccountForContext('weibo');
  if (playerAccount) {
    return accountService.getFollowingAccounts(playerAccount.id);
  }
  return [];
}

// 获取玩家的粉丝列表
async function getFollowersList(): Promise<PlatformAccount[]> {
  const playerAccount = await accountService.findPlayerAccountForContext('weibo');
  if (playerAccount) {
    return accountService.getFollowerAccounts(playerAccount.id);
  }
  return [];
}
```

---

## 与账号管理 App 的集成

### 数据流

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      AccountManagerApp                               │
│                                                                      │
│  展示：                                                              │
│  - 玩家所有平台账号（按平台分组）                                    │
│  - 账号作用域标签（全局/角色卡级/会话级）                            │
│  - 每个世界的账号数量                                                │
│  - 关注数/粉丝数等统计                                               │
│                                                                      │
│  操作：                                                              │
│  - 编辑账号信息                                                      │
│  - 创建新账号                                                        │
│  - 删除账号                                                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ 调用
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AccountService                                 │
│                                                                      │
│  提供：                                                              │
│  - getPlayerAllAccounts() - 获取玩家所有账号                         │
│  - getAccountsByEntity() - 获取实体的所有账号                        │
│  - updatePlatformAccount() - 更新账号                               │
│  - deletePlatformAccount() - 删除账号                               │
│  - createPlatformAccount() - 创建账号                               │
│  - getStats() - 获取统计信息                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 账号列表获取

```typescript
// src/apps/account-manager/AccountManagerApp.vue

import { accountService } from '@/services/account';
import { useAccountStore } from '@/stores/accountStore';

const accountStore = useAccountStore();

// 获取玩家所有账号（跨所有世界）
async function loadAllAccounts() {
  const allAccounts = await accountStore.getPlayerAllAccounts();
  
  // 按平台分组
  const accountsByPlatform = allAccounts.reduce((acc, account) => {
    const platform = account.platformId;
    if (!acc[platform]) {
      acc[platform] = [];
    }
    acc[platform].push(account);
    return acc;
  }, {} as Record<string, PlatformAccount[]>);
  
  return accountsByPlatform;
}

// 获取统计信息
async function loadStats() {
  return accountStore.getStats();
}
```

---

## 与 UserPool 的集成

### UserPool 的职责

重构后，UserPool 是纯粹的用户数据生成器，不负责存储：

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         UserPool                                      │
│                        (Singleton)                                    │
│                                                                      │
│  职责：                                                              │
│  - 生成随机用户信息（姓名、头像、简介等）                            │
│  - 生成完整用户画像（兴趣、性格、活跃度等）                          │
│  - 生成特定角色的用户（粉丝、KOL、路人等）                          │
│  - 不存储任何数据                                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ 生成数据
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AccountStore                                    │
│                                                                      │
│  调用 UserPool 生成数据，然后：                                      │
│  - 创建 CharacterEntity                                              │
│  - 创建 PlatformAccount                                              │
│  - 存储到 IndexedDB                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 生成随机用户的流程

```typescript
// src/stores/accountStore.ts

import { userPool } from '@/services/account/userPool';

/**
 * 获取或创建随机用户（用于社交媒体内容生成）
 */
async function getOrCreateRandomUser(
  platformId: string,
  context?: GenerationContext
): Promise<FullProfile> {
  // 1. 先尝试获取已有的随机账号
  let account = await accountService.getRandomAccountForPlatform(platformId);
  
  if (!account) {
    // 2. 使用 UserPool 生成新用户数据
    const profile = userPool.generateRandomProfile({ ...context, platform: platformId });
    
    // 3. 创建会话级实体
    const entity = await accountService.createEntity({
      type: 'npc',
      source: 'social',
      displayName: profile.displayName,
      avatar: profile.avatar,
      bio: profile.bio,
      gender: profile.gender,
      // 会自动推断为 session 级别
    });
    entities.value.set(entity.id, entity);
    
    // 4. 创建平台账号
    account = await accountService.createPlatformAccount(entity.id, platformId, {
      handle: profile.handle,
      nickname: profile.nickname,
      scope: 'session',
      scopeSessionId: sessionContext.value?.sessionId,
    });
    accounts.value.set(account.id, account);
  }
  
  // 5. 返回完整档案
  const fullProfile = await accountService.getFullProfile(account.id);
  return fullProfile!;
}
```

### UserPool API 示例

```typescript
import { userPool } from '@/services/account';

// 生成基础用户数据
const basicProfile = userPool.generateRandomProfile({ platform: 'weibo' });
// { displayName, nickname, avatar, bio, handle, gender }

// 生成带完整画像的用户
const richProfile = userPool.generateRichProfile({ topic: 'tech' });
// { ...basicProfile, tagline, profile: { ageRange, occupation, interests, ... } }

// 生成完整角色画像（不含基础信息）
const characterProfile = userPool.generateFullProfile({ topic: 'entertainment' });
// { ageRange, occupation, location, interests, personality, activityLevel, ... }

// 根据角色类型生成
const fanProfile = userPool.generateByRole('fan', { topic: '明星' });
const kolProfile = userPool.generateByRole('kol', { platform: 'weibo' });

// 批量生成
const batch = userPool.generateBatch(10, { platform: 'weibo' });

// 工具方法
const randomName = userPool.randomName('female');
const randomGender = userPool.randomGender();
const followers = userPool.getFollowersByLevel('small_v');  // 10000-100000
```

---

## 与聊天 App 的集成（规划中）

### 联系人来源

```typescript
// src/apps/chat/stores/contactStore.ts (规划)

import { accountService } from '@/services/account';

export const useContactStore = defineStore('contact', () => {
  // 从 AccountService 获取聊天联系人
  async function loadContacts() {
    // 获取 chat 平台的可见账号
    const accounts = await accountService.getVisibleAccounts('chat');
    
    // 获取好友关系的账号
    const playerAccount = await accountService.findPlayerAccountForContext('chat');
    if (playerAccount) {
      const friends = await accountService.getFriendAccounts(playerAccount.id);
      return friends;
    }
    
    return accounts;
  }
});
```

### 迁移计划

| 阶段 | 内容                             | 状态       |
| ---- | -------------------------------- | ---------- |
| 1    | 聊天联系人读取从 AccountService  | ⏳ 待实现  |
| 2    | 聊天中新建联系人写入 AccountService | ⏳ 待实现  |
| 3    | 历史数据迁移                     | ⏳ 待实现  |
| 4    | 移除旧的 contactStore 数据       | ⏳ 待实现  |

---

## 与通知系统的集成

### 通知中的用户信息

```typescript
import { notificationService } from '@/services/notification';
import { accountService } from '@/services/account';

// 发送新粉丝通知
async function notifyNewFollower(followerAccountId: string) {
  const profile = await accountService.getFullProfile(followerAccountId);
  
  if (profile) {
    notificationService.push({
      appId: 'weibo',
      type: 'social',
      title: '新粉丝',
      body: `${profile.displayName} 关注了你`,
      icon: profile.avatar,
      data: {
        action: 'view_profile',
        accountId: followerAccountId,
      },
    });
  }
}
```

---

## 集成检查清单

### 新 App 集成 AccountService

1. **初始化依赖**
   - [ ] 确保 AccountStore 已初始化（`accountStore.isInitialized`）
   - [ ] 如果需要，等待初始化完成

2. **用户数据来源**
   - [ ] 从 `accountService.getVisibleAccounts(platformId)` 获取用户
   - [ ] 使用 `accountService.findPlayerAccountForContext(platformId)` 获取玩家账号
   - [ ] 使用 `accountService.getFullProfile(accountId)` 获取完整档案

3. **账号创建**
   - [ ] 使用 `accountStore.ensurePlayerAccount(platformId)` 检查并提示创建
   - [ ] 使用 `CreateAccountDialog` 组件或自定义弹窗
   - [ ] 调用 `accountService.createPlatformAccount()` 创建

4. **关系管理**
   - [ ] 使用 `accountService.followAccount()` 等 API
   - [ ] 关系绑定在账号（而非实体）

5. **作用域处理**
   - [ ] 理解并正确使用作用域
   - [ ] 新用户默认 `session` 级
   - [ ] 玩家账号推荐 `character` 级

6. **清理**
   - [ ] 组件卸载时调用 `accountStore.cleanup()`（可选）

### 平台 ID 约定

| 平台       | platformId  | 说明           |
| ---------- | ----------- | -------------- |
| 微博       | `weibo`     | 已集成         |
| B站        | `bilibili`  | 规划中         |
| 聊天       | `chat`      | 规划中         |
| 朋友圈     | `moments`   | 规划中         |
