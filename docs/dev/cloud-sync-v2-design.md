# 云同步 V2 设计

> 状态: 进行中 | 最后更新: 2026-01-07

## 概述

云同步服务负责将本地 IndexedDB 数据备份到服务器，并支持跨设备恢复。

## V2.1 更新：按应用分类存储

### 新的存储结构

```
storage/{sessionId}/
├── meta.json                    # 会话元信息
├── apps/                        # 应用数据目录
│   ├── contacts/               # 通讯录应用
│   │   └── data.json
│   ├── messages/               # 短信应用
│   │   └── data.json
│   ├── moments/                # 朋友圈应用
│   │   └── data.json
│   ├── phone/                  # 电话应用（通话记录）
│   │   └── data.json
│   ├── email/                  # 邮件应用
│   │   └── data.json
│   ├── forum/                  # 论坛应用
│   │   └── data.json
│   ├── browser/                # 浏览器应用
│   │   └── data.json
│   ├── live/                   # 直播应用
│   │   └── data.json
│   ├── weibo/                  # 微博应用
│   │   └── data.json
│   └── {namespace}/            # 其他应用私有数据
│       └── data.json
├── global/                      # 全局数据
│   ├── settings.json           # 应用设置
│   └── desktop.json            # 桌面布局
├── accounts/                    # 账号系统
│   ├── entities.json           # 角色实体
│   ├── platform-accounts.json  # 平台账号
│   └── relations.json          # 社交关系
├── prompt-chains/               # 提示词链
│   ├── chains.json             # 提示词链定义
│   └── history.json            # 执行历史
├── changelog/                   # 变更日志（增量同步）
│   └── 2026-01-07.jsonl
└── backup/                      # 完整备份
    └── latest.json
```

### 应用到数据表的映射

| 应用ID | 包含的数据表 | 说明 |
| -------- | ------------- | ------ |
| contacts | contacts | 通讯录 |
| messages | messages | 短信 |
| moments | moments | 朋友圈 |
| phone | calls | 通话记录 |
| email | emails | 邮件 |
| forum | forumBoards, forumPosts | 论坛 |
| browser | bookmarks, browsingHistory | 浏览器 |
| live | liveStreams | 直播 |
| weibo | socialPosts, socialComments, socialTopics, socialAccounts, socialIdentities, socialSuperTopics | 微博 |

### 实现文件

- `server/src/storage/types.ts` - 类型定义
- `server/src/storage/appStorage.ts` - 按应用分类的存储实现
- `server/src/storage/tableStorage.ts` - 兼容层（旧版 API）
- `server/src/storage/storageV2.ts` - 存储管理器

## 当前实现

### 已实现

- ✅ 基于 session 的数据备份/恢复
- ✅ 服务端分表存储 (V2)
- ✅ 多设备检测
- ✅ 写入队列保护
- ✅ **按应用分类存储 (V2.1)**
- ✅ **旧版 API 兼容层**

### 存在的问题

当前 `cloudSyncService.ts` 的备份逻辑只备份 **带有 sessionId 的表**，导致大量数据丢失：

```typescript
// 当前过滤逻辑
filter: (table, value) => {
  // ❌ 全局表不备份
  if (table === 'appSettings' || table === 'trustedRepositories') {
    return false
  }
  // ❌ 应用数据暂不备份  
  if (table === 'appData') {
    return false
  }
  // 只备份匹配 sessionId 的记录
  return (value as any).sessionId === sessionId
}
```

## TODO: 数据备份完整性

### 需要支持备份的数据类型

| 类型 | 应用/表 | 当前状态 | 备份策略 |
| ------ | --------- | ---------- | ---------- |
| **应用数据** | contacts, messages, moments, phone, email, forum, browser, live, weibo | ✅ 已支持 | 按应用分类存储 |
| **全局设置** | global/settings | 🔄 进行中 | 全量备份 |
| **桌面布局** | global/desktop | 🔄 进行中 | 全量备份 |
| **账号系统** | accounts/* | 🔄 进行中 | 全量备份 |
| **提示词链** | prompt-chains/* | 🔄 进行中 | 全量备份 |
| **应用私有数据** | apps/{namespace} | 🔄 进行中 | 按 namespace 备份 |
| **信任仓库** | trustedRepositories | ❌ 不备份 | 全量备份 |

### 改进方案

#### 方案 A: 分层备份（已采用）

将备份分为多个层级：

```typescript
interface BackupOptions {
  /** 包含的应用列表（空表示全部） */
  includeApps?: string[]
  /** 排除的应用列表 */
  excludeApps?: string[]
  /** 是否包含全局数据 */
  includeGlobal?: boolean
  /** 是否包含账号系统 */
  includeAccounts?: boolean
  /** 是否包含提示词链 */
  includePromptChains?: boolean
}
```

#### 方案 B: 完整快照

备份整个数据库，但提供恢复选项：

```typescript
interface RestoreOptions {
  /** 是否覆盖全局设置 */
  overwriteGlobalSettings?: boolean
  /** 应用数据策略 */
  appDataStrategy?: 'merge' | 'overwrite'
  /** 只恢复指定应用 */
  onlyApps?: string[]
}
```

### 实现步骤

- [x] 1. 定义新的存储结构
  - 按应用分类的目录结构
  - 应用到数据表的映射

- [x] 2. 实现 `appStorage.ts`
  - 应用数据读写
  - 全局数据读写
  - 账号系统数据读写
  - 提示词链数据读写

- [x] 3. 更新 `tableStorage.ts` 兼容层
  - 保持旧版 API 不变
  - 内部委托给 appStorage

- [ ] 4. 更新客户端 `cloudSyncService.ts`
  - 添加 `BackupOptions` 参数
  - 实现分层过滤逻辑
  - 处理无 sessionId 的表

- [ ] 5. 更新 CloudSyncSettings UI
  - 添加备份选项复选框
  - 显示各应用的数据统计

- [ ] 6. 处理冲突
  - 全局数据的版本冲突
  - 提示词链的合并策略

## 数据表清单

### 会话相关表（有 sessionId）→ 按应用分类

| 旧表名 | 应用ID | 说明 |
| -------- | -------- | ------ |
| contacts | contacts | 联系人 |
| messages | messages | 消息 |
| moments | moments | 朋友圈 |
| calls | phone | 通话记录 |
| emails | email | 邮件 |
| forumBoards | forum | 论坛板块 |
| forumPosts | forum | 论坛帖子 |
| liveStreams | live | 直播 |
| bookmarks | browser | 书签 |
| browsingHistory | browser | 浏览历史 |
| socialPosts | weibo | 微博帖子 |
| socialComments | weibo | 微博评论 |
| socialTopics | weibo | 微博话题 |
| socialAccounts | weibo | 微博账号 |
| socialIdentities | weibo | 微博身份 |
| socialSuperTopics | weibo | 微博超话 |

### 全局表（无 sessionId）→ global/

```
appSettings        → global/settings.json
desktopLayouts     → global/desktop.json
trustedRepositories → global/trusted-repos.json
```

### 账号系统表 → accounts/

```
characterEntities  → accounts/entities.json
platformAccounts   → accounts/platform-accounts.json
socialRelations    → accounts/relations.json
```

### 提示词链表 → prompt-chains/

```
promptChains           → prompt-chains/chains.json
chainExecutionHistory  → prompt-chains/history.json
```

### 应用数据表（按 namespace 隔离）→ apps/{namespace}/

```
appData  → apps/{namespace}/data.json
  - namespace: "builtin/notes"
  - namespace: "builtin/calculator"
  - etc.
```

## 相关文件

- `src/services/cloudSyncService.ts` - 云同步服务（客户端）
- `src/services/database/schema.ts` - 数据库 Schema
- `src/apps/settings/pages/CloudSyncSettings.vue` - 同步设置页面
- `server/src/storage/` - 服务端存储模块
  - `types.ts` - 类型定义
  - `appStorage.ts` - 按应用分类存储
  - `tableStorage.ts` - 兼容层
  - `storageV2.ts` - 存储管理器

## 参考

- [数据隔离设计](./Security/data-isolation.md)
- [应用沙箱设计](./app-sandbox-design.md)
