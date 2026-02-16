# 账号系统服务

> **状态**: ✅ 已实现 (Phase 1-4)  
> **版本**: v2.0  
> **最后更新**: 2026-01-08

## 概述

账号系统服务（Account Service）是系统级的身份与社交关系管理中心。它将分散在各个 App 中的用户/角色数据统一管理，实现"一个人在整个虚拟世界中是同一个人"的核心体验。

### 核心能力

* **统一身份管理**：跨平台的角色实体（CharacterEntity）管理
* **平台账号绑定**：一个实体可拥有多个平台账号（PlatformAccount）
* **双层作用域**：实体和账号各自独立的可见性控制
* **社交关系管理**：基于账号的关注/好友/拉黑关系
* **玩家多重身份**：同一玩家在不同世界可有不同的社交账号
* **用户画像生成**：丰富的随机用户档案生成器（UserPool）

### 设计目标

| 维度 | 说明 |
| ------------ | ------------------------------------------ |
| 统一身份 | 聊天好友"小明"和微博用户"小明"是同一个人 |
| 关系复用 | 聊天好友自动成为朋友圈可见者 |
| 多重身份 | 玩家可以在不同世界有不同的"马甲"账号 |
| 数据一致 | 修改头像一处生效，全平台同步 |
| 职责清晰 | UserPool 只负责生成，不再负责存储 |
| 灵活隔离 | 实体和账号各自有独立的作用域控制 |

---

## 文档导航

| 文档 | 说明 |
| --------------------------------- | ------------------------------------------- |
| [架构设计](./architecture.md) | 分层架构、核心组件、数据流 |
| [类型定义](./types.md) | CharacterEntity、PlatformAccount、SocialRelation 等 |
| [使用示例](./usage.md) | 初始化、账号创建、关系管理、查询示例 |
| [作用域机制](./scope.md) | 双层作用域模型、可见性规则、自动推断 |
| [系统集成](./integration.md) | 与 SessionContext、Bridge、各 App 的交互 |
| [设计决策](./design-decisions.md) | 为什么选择双层作用域、关系绑定在账号等决策 |

---

## 快速开始

### 1. 初始化（应用启动时）

```typescript
// src/main.ts 或 src/App.vue
import { useAccountStore } from '@/stores/accountStore';

onMounted(async () => {
  const accountStore = useAccountStore();
  
  // 初始化账号系统
  // 会话上下文会自动从 Bridge Adapter 获取
  // 如果没有连接，会回退到 'standalone-session'
  await accountStore.initialize('玩家名');
  
  // 或者显式传入会话上下文（向后兼容）
  await accountStore.initialize('玩家名', {
    sessionId: 'session_xxx',
    characterCardId: 'card_xxx',
  });
});
```

### 2. 获取或创建平台账号

```typescript
import { useAccountStore } from '@/stores/accountStore';

async function ensureWeiboAccount() {
  const accountStore = useAccountStore();
  
  // 确保玩家有微博账号
  const result = await accountStore.ensurePlayerAccount('weibo');
  
  if ('platformId' in result) {
    // 返回的是 MissingAccountInfo，需要创建账号
    // 显示账号创建弹窗
    showCreateAccountDialog(result);
  } else {
    // 返回的是已有账号
    console.log('已有账号:', result.handle);
  }
}
```

### 3. 查询当前会话可见的账号

```typescript
import { accountService } from '@/services/account';

async function loadWeiboUsers() {
  // 获取当前会话可见的所有微博账号
  const accounts = await accountService.getVisibleAccounts('weibo');
  
  return accounts;
}
```

### 4. 管理社交关系

```typescript
import { accountService } from '@/services/account';

// 关注某人
await accountService.followAccount(myAccountId, targetAccountId);

// 获取关注列表
const following = await accountService.getFollowingAccounts(myAccountId);

// 获取粉丝列表
const followers = await accountService.getFollowerAccounts(myAccountId);

// 添加好友（双向关系）
await accountService.addFriendAccounts(accountIdA, accountIdB);
```

### 5. 生成随机用户

```typescript
import { userPool } from '@/services/account';

// 生成基础随机用户档案
const profile = userPool.generateRandomProfile({ platform: 'weibo' });

// 生成带完整画像的用户档案
const richProfile = userPool.generateRichProfile({ topic: 'tech' });
console.log(richProfile.profile?.interests);  // ['tech', 'gaming', ...]
console.log(richProfile.profile?.personality); // 'enthusiast'
```

---

## 核心概念

### 三层数据模型

```text
┌─────────────────────────────────────────────────────────────┐
│ CharacterEntity (角色实体)                                   │
│ └── 系统中的"人"，是所有平台账号的源头                        │
│                                                              │
│     ┌─────────────────────────────────────────────────────┐  │
│     │ PlatformAccount (平台账号)                           │  │
│     │ └── 某个实体在某个具体平台上的身份                    │  │
│     │     一个 Entity 可以有多个 Platform Account          │  │
│     │                                                      │  │
│     │     ┌─────────────────────────────────────────────┐  │  │
│     │     │ SocialRelation (社交关系)                    │  │  │
│     │     │ └── 两个平台账号之间的关系                   │  │  │
│     │     │     关注、好友、拉黑等                       │  │  │
│     │     └─────────────────────────────────────────────┘  │  │
│     └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 双层作用域

| 作用域 | 标识 | 说明 | 适用场景 |
| ------------ | ----------- | ---------------------------- | ---------------------------- |
| **会话级** | `session` | 仅在创建它的会话中可见 | 普通 NPC、路人账号、临时角色 |
| **角色卡级** | `character` | 相同角色卡的会话共享 | 玩家的世界专属身份、主角关联 NPC |
| **全局级** | `global` | 所有会话共享 | 玩家实体、系统角色、跨世界 NPC |

**核心规则**：账号作用域不能比实体作用域"更全局"

```text
Entity Scope    │ 允许的 Account Scope
────────────────┼──────────────────────────
global          │ global, character, session
character       │ character, session
session         │ session
```

---

## 核心 API 概览

### AccountService 主要方法

| 方法 | 说明 |
| ------------------------------ | ------------------------------ |
| `setSessionContext()` | 设置当前会话上下文 |
| `getSessionContext()` | 获取当前会话上下文 |
| `createEntity()` | 创建角色实体 |
| `getEntity()` | 获取角色实体 |
| `updateEntity()` | 更新角色实体 |
| `deleteEntity()` | 删除实体（级联删除账号和关系） |
| `getVisibleEntities()` | 获取当前会话可见的实体 |
| `getPlayerEntity()` | 获取玩家实体 |
| `getOrCreatePlayerEntity()` | 获取或创建玩家实体 |
| `createPlatformAccount()` | 为实体创建平台账号 |
| `getPlatformAccount()` | 获取平台账号 |
| `findAccountByHandle()` | 通过 handle 查找账号 |
| `getVisibleAccounts()` | 获取当前会话可见的平台账号 |
| `findPlayerAccountForContext()` | 查找玩家在当前上下文的账号 |
| `checkMissingPlayerAccount()` | 检查是否缺少玩家账号 |
| `followAccount()` | 关注账号 |
| `unfollowAccount()` | 取消关注 |
| `addFriendAccounts()` | 添加好友（双向） |
| `removeFriendAccounts()` | 删除好友 |
| `getFollowingAccounts()` | 获取关注列表 |
| `getFollowerAccounts()` | 获取粉丝列表 |
| `getFriendAccounts()` | 获取好友列表 |
| `getFullProfile()` | 获取完整档案（合并实体和账号） |
| `syncFromCharacterCard()` | 从角色卡同步实体 |
| `getStats()` | 获取统计信息 |

### AccountStore 主要功能

| 功能 | 说明 |
| ------------------------------ | ------------------------------ |
| `initialize()` | 初始化账号系统 |
| `switchSession()` | 切换会话上下文 |
| `ensurePlayerAccount()` | 确保玩家有平台账号 |
| `getOrCreateRandomUser()` | 获取或创建随机用户 |
| `getContactsForPlatform()` | 获取平台联系人（带完整档案） |
| 自动响应 Bridge 会话切换事件 | 无需手动监听 |

### UserPool 主要方法

| 方法 | 说明 |
| -------------------------- | ------------------------------ |
| `generateRandomProfile()` | 生成随机用户基础档案 |
| `generateRichProfile()` | 生成带完整画像的用户档案 |
| `generateFullProfile()` | 生成完整角色画像 |
| `generateByRole()` | 根据角色类型生成用户档案 |
| `generateBatch()` | 批量生成用户档案 |
| `randomName()` | 生成随机中文名 |
| `randomGender()` | 生成随机性别 |
| `randomBio()` | 生成随机简介 |
| `generateHandle()` | 生成平台 handle |
| `getFollowersByLevel()` | 根据影响力等级获取粉丝数 |

---

## 与微博的集成

```text
┌─────────────────────────────────────────────────────────────┐
│                    AccountService                            │
│                    (系统服务)                                │
└─────────────────────────────────────────────────────────────┘
                            ↑
          ┌─────────────────┼─────────────────┐
          │                 │                 │
  ┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐
  │   WeiboApp    │ │  聊天 App     │ │  朋友圈 App   │
  │               │ │               │ │               │
  │ 用户列表来自   │ │ 联系人来自    │ │ 好友来自       │
  │ AccountService│ │ AccountService│ │ AccountService│
  └───────────────┘ └───────────────┘ └───────────────┘
```

**已完成的集成**：

* ✅ 微博 App 完整集成
* ✅ 账号管理 App
* ⏳ 聊天 App 联系人迁移（待完成）
* ⏳ 朋友圈基于好友关系过滤（待完成）

---

## 实施状态

| Phase | 内容 | 状态 |
| ------- | --------------------- | ---------- |
| Phase 1 | 基础架构搭建 | ✅ 已完成 |
| Phase 2 | 双层作用域支持 | ✅ 已完成 |
| Phase 3 | 玩家多重身份 UI | ✅ 已完成 |
| Phase 4 | 账号管理 App | ✅ 已完成 |
| Phase 5 | 完整集成（聊天等） | ⏳ 进行中 |

---

## 文件结构

```text
src/
├── types/
│   └── account.ts              # 类型定义（包含画像扩展类型）
├── services/
│   └── account/
│       ├── index.ts            # 模块入口
│       ├── accountService.ts   # 核心服务（单例）
│       ├── userPool.ts         # 随机用户生成器（单例）
│       └── migrateSocialAccounts.ts  # 数据迁移工具
├── stores/
│   └── accountStore.ts         # Pinia Store（响应式状态管理）
├── components/
│   └── common/
│       └── CreateAccountDialog.vue  # 账号创建弹窗组件
└── apps/
    └── account-manager/        # 账号管理 App
        ├── AccountManagerApp.vue
        └── components/
            └── AccountCard.vue  # 账号卡片组件
```

---

## 参考资料

* [服务开发指南](../service-development-guide.md)
* [会话上下文服务](../session-context/README.md)
* [账号会话绑定设计](../../dev/Security/account-session-binding.md)
* [社交内容平台架构](../architecture/Service-for-social-media-platform.md)
* [账号管理 App 文档](../../apps/account-manager.md)
