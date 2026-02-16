# 交互服务 (Interaction Service)

> **状态**: ✅ 已实现  
> **版本**: v1.0  
> **优先级**: 🔴 高  
> **最后更新**: 2025-01-17

## 概述

交互服务（Interaction Service）是系统级的互动行为管理中心。它将分散在各个社交 App 中的点赞、收藏、评论、转发等互动逻辑统一管理，实现跨平台的互动数据共享和事件广播。

### 核心能力

* **统一互动接口**：跨平台的点赞、收藏、评论、转发操作
* **互动统计**：内容的互动数据聚合（点赞数、评论数等）
* **用户互动历史**：用户的点赞列表、收藏列表、浏览历史
* **事件广播**：互动事件的发布/订阅，供粉丝服务等服务使用
* **平台扩展**：支持平台特有互动行为（如 B站一键三连）

### 设计目标

| 维度 | 说明 |
| ---------- | ------------------------------------------- |
| 跨平台复用 | 微博的点赞/收藏逻辑可复用到 B站、知乎 |
| 事件驱动 | 粉丝服务、通知系统可统一监听互动事件 |
| 数据一致 | 点赞状态在所有 App 中保持同步 |
| 可扩展 | 支持平台特定互动行为的注册 |
| 解耦 | App 只调用服务接口，不直接操作底层存储 |

### 问题背景

当前微博的 `userActionStore` 实现了点赞/收藏/历史功能，但存在以下问题：

1. **耦合度高**：逻辑与微博 App 深度绑定，无法复用
2. **缺乏事件机制**：其他服务无法感知互动行为
3. **数据分散**：不同 App 各自管理互动数据
4. **扩展困难**：新增互动类型需要修改多处代码

---

## 文档导航

| 文档 | 说明 |
| ----------------------------------- | -------------------------------------- |
| [架构设计](./architecture.md) | 分层架构、核心组件、数据流 |
| [类型定义](./types.md) | InteractionEvent、InteractionStats 等 |
| [使用示例](./usage.md) | 点赞、收藏、评论、事件订阅示例 |
| [平台扩展](./platform-extension.md) | 如何注册平台特有互动行为 |
| [系统集成](./integration.md) | 与粉丝服务、通知系统、社交引擎的交互 |

---

## 快速开始

### 1. 点赞/取消点赞

```typescript
import { interactionService } from '@/services/interaction'

// 点赞
await interactionService.like(contentId, userId)

// 取消点赞
await interactionService.unlike(contentId, userId)

// 检查是否已点赞
const isLiked = await interactionService.isLiked(contentId, userId)

// 指定平台和内容类型
await interactionService.like(contentId, userId, {
  platformId: 'bilibili',
  contentType: 'video',
})
```

### 2. 收藏管理

```typescript
import { interactionService } from '@/services/interaction'

// 收藏到默认收藏夹
await interactionService.favorite(contentId, userId)

// 收藏到指定收藏夹
await interactionService.favorite(contentId, userId, 'tech-articles')

// 取消收藏
await interactionService.unfavorite(contentId, userId)

// 获取用户收藏列表
const favorites = await interactionService.getUserFavorites(userId, {
  platformId: 'weibo',
})
```

### 3. 评论操作

```typescript
import { interactionService } from '@/services/interaction'

// 发表评论
const comment = await interactionService.comment({
  contentId,
  platformId: 'weibo',
  userId,
  content: '这条微博写得太好了！',
})

// 回复评论
const reply = await interactionService.comment({
  contentId,
  platformId: 'weibo',
  userId,
  content: '同意楼上的观点',
  parentId: parentCommentId,
})

// 获取内容的评论列表
const comments = await interactionService.getComments(contentId)

// 删除评论
await interactionService.deleteComment(commentId, userId)
```

### 4. 转发

```typescript
import { interactionService } from '@/services/interaction'

// 转发内容
const newPostId = await interactionService.repost(contentId, userId, '转发评论')

// 获取转发列表
const reposts = await interactionService.getReposts(contentId)
```

### 5. 浏览历史

```typescript
import { interactionService } from '@/services/interaction'

// 记录浏览
await interactionService.recordView(contentId, userId, {
  duration: 30, // 停留秒数
  scrollDepth: 0.8, // 滚动深度
})

// 获取浏览历史
const history = await interactionService.getViewHistory(userId, {
  limit: 50,
  platformId: 'weibo',
})

// 清除浏览历史
await interactionService.clearViewHistory(userId)
```

### 6. 事件订阅

```typescript
import { interactionService } from '@/services/interaction'

// 订阅所有互动事件
const unsubscribe = interactionService.onInteraction((event) => {
  console.log(`[${event.type}] ${event.userId} -> ${event.contentId}`)

  // 粉丝服务处理
  if (event.type === 'like' || event.type === 'comment') {
    fansService.processInteraction(event)
  }
})

// 订阅特定类型的事件
interactionService.on('like', (event) => {
  notificationService.notifyAuthor(event.contentId, 'new_like')
})

// 取消订阅
unsubscribe()
```

### 7. 平台扩展行为

```typescript
import { interactionService } from '@/services/interaction'
import { registerAllPlatformBehaviors } from '@/services/interaction/platformBehaviors'

// 注册所有平台扩展行为
registerAllPlatformBehaviors()

// 执行 B站 一键三连
await interactionService.executePlatformBehavior(
  'bilibili',
  'tripleAction',
  videoId,
  userId
)

// 执行 B站 投币
await interactionService.executePlatformBehavior(
  'bilibili',
  'coin',
  videoId,
  userId,
  { count: 2 }
)
```

---

## 核心概念

### 互动类型

```typescript
type InteractionType =
  | 'like' // 点赞
  | 'unlike' // 取消点赞
  | 'favorite' // 收藏
  | 'unfavorite' // 取消收藏
  | 'comment' // 评论
  | 'repost' // 转发
  | 'view' // 浏览
  | 'share' // 分享
```

### 互动事件

```typescript
interface InteractionEvent {
  id: string // 事件 ID
  type: InteractionType // 互动类型
  contentId: string // 内容 ID
  contentType: ContentType // 内容类型
  userId: string // 用户 ID
  platformId: string // 平台 ID（weibo/bilibili/zhihu）
  timestamp: number // 时间戳
  metadata?: Record<string, unknown> // 额外数据
}
```

### 互动统计

```typescript
interface InteractionStats {
  contentId: string
  contentType: ContentType
  platformId: string
  likes: number // 点赞数
  favorites: number // 收藏数
  comments: number // 评论数
  reposts: number // 转发数
  views: number // 浏览数
  shares: number // 分享数
  updatedAt: number // 最后更新时间
}
```

### 数据模型

```text
┌─────────────────────────────────────────────────────────────┐
│ InteractionService                                          │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ UserInteraction (用户互动记录)                         │ │
│  │ └── 某用户对某内容的互动状态                           │ │
│  │     isLiked, isFavorited, viewCount, lastViewAt        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ContentStats (内容统计)                                │ │
│  │ └── 某内容的聚合互动数据                               │ │
│  │     likes, favorites, comments, reposts, views         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Comment (评论)                                         │ │
│  │ └── 评论内容、作者、时间、回复关系                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ViewRecord (浏览记录)                                  │ │
│  │ └── 浏览时间、停留时长、滚动深度                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PlatformBehavior (平台扩展行为)                        │ │
│  │ └── 平台特有互动行为（投币、一键三连等）               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心 API 概览

### InteractionService 主要方法

| 方法 | 说明 |
| ---------------------------- | -------------------- |
| **点赞相关** |  |
| `like()` | 点赞内容 |
| `unlike()` | 取消点赞 |
| `isLiked()` | 检查是否已点赞 |
| `getUserLikes()` | 获取用户点赞列表 |
| **收藏相关** |  |
| `favorite()` | 收藏内容 |
| `unfavorite()` | 取消收藏 |
| `isFavorited()` | 检查是否已收藏 |
| `getUserFavorites()` | 获取用户收藏列表 |
| `getFavoriteCollections()` | 获取用户收藏夹列表 |
| **评论相关** |  |
| `comment()` | 发表评论 |
| `deleteComment()` | 删除评论 |
| `getComments()` | 获取内容评论列表 |
| `getUserComments()` | 获取用户发表的评论 |
| **转发相关** |  |
| `repost()` | 转发内容 |
| `getReposts()` | 获取转发列表 |
| **浏览记录** |  |
| `recordView()` | 记录浏览行为 |
| `getViewHistory()` | 获取浏览历史 |
| `clearViewHistory()` | 清除浏览历史 |
| **统计相关** |  |
| `getStats()` | 获取内容互动统计 |
| `batchGetStats()` | 批量获取统计 |
| `incrementStats()` | 增加统计计数 |
| **事件相关** |  |
| `onInteraction()` | 订阅所有互动事件 |
| `on()` | 订阅特定类型事件 |
| `off()` | 取消订阅 |
| **平台扩展** |  |
| `registerPlatformBehavior()` | 注册平台特有互动行为 |
| `getPlatformBehavior()` | 获取平台扩展行为 |
| `getPlatformBehaviors()` | 获取平台所有扩展行为 |
| `executePlatformBehavior()` | 执行平台扩展行为 |

---

## 与其他服务的集成

```text
┌─────────────────────────────────────────────────────────────┐
│                    InteractionService                       │
│                    (交互服务)                               │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Growth      │ │ Notification│ │ Social      │ │ Feed        │
│ Engine      │ │ Service     │ │ Media Engine│ │ Algorithm   │
│ (粉丝服务)  │ │ (通知服务)  │ │ (社交引擎)  │ │ (推荐算法)  │
│             │ │             │ │             │ │             │
│ 监听互动    │ │ 发送通知    │ │ 更新热度    │ │ 计算权重    │
│ 计算涨粉    │ │ 新赞/新评论 │ │ 内容排序    │ │ 个性化推荐  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    各 App (微博/B站/知乎)                   │
│                                                             │
│  点赞按钮 → interactionService.like()                       │
│  收藏按钮 → interactionService.favorite()                   │
│  评论提交 → interactionService.comment()                    │
└─────────────────────────────────────────────────────────────┘
```

**核心集成点**：

* **粉丝服务**：订阅互动事件，计算粉丝增长
* **通知系统**：订阅点赞/评论事件，发送通知
* **社交引擎**：根据互动更新内容热度
* **推荐算法**：根据用户互动历史个性化推荐
* **事件总线**：所有互动事件都会广播到 EventBus

---

## 实施状态

| Phase | 内容 | 状态 |
| ------- | --------------------------- | --------- |
| Phase 1 | 核心接口设计 | ✅ 已完成 |
| Phase 2 | 核心服务实现 | ✅ 已完成 |
| Phase 3 | 事件系统实现 | ✅ 已完成 |
| Phase 4 | 平台扩展机制 | ✅ 已完成 |
| Phase 5 | 单元测试（77 个测试用例） | ✅ 已完成 |
| Phase 6 | 与粉丝服务集成 | ⏳ 待实现 |
| Phase 7 | 从微博 userActionStore 迁移 | ⏳ 待实现 |

---

## 文件结构

```text
src/
├── types/
│   └── interaction.ts              # 类型定义
├── services/
│   └── interaction/
│       ├── index.ts                # 模块入口
│       ├── InteractionService.ts   # 核心服务（单例）
│       ├── platformBehaviors/      # 平台扩展
│       │   ├── index.ts
│       │   ├── weibo.ts            # 微博扩展（超话签到、打赏等）
│       │   ├── bilibili.ts         # B站扩展（投币、一键三连等）
│       │   └── zhihu.ts            # 知乎扩展（赞同、反对等）
│       └── __tests__/              # 单元测试
│           ├── setup.ts
│           ├── InteractionService.like.test.ts
│           ├── InteractionService.favorite.test.ts
│           ├── InteractionService.comment.test.ts
│           ├── InteractionService.view.test.ts
│           ├── InteractionService.repost.test.ts
│           ├── InteractionService.event.test.ts
│           ├── InteractionService.platform.test.ts
│           └── InteractionService.stats.test.ts
```

---

## 已实现的平台扩展行为

### 微博 (Weibo)

| 行为 | 动作名称 | 说明 |
| ----------------- | ------------------ | ---------------- |
| 超话签到 | `superTopicCheckIn` | 超话社区每日签到 |
| 打赏 | `reward` | 对内容进行打赏 |
| 举报 | `report` | 举报违规内容 |
| 快转 | `quickRepost` | 不带评论的转发 |

### B站 (Bilibili)

| 行为 | 动作名称 | 说明 |
| ---------- | --------------- | ---------------------- |
| 投币 | `coin` | 给视频投币（1-2个） |
| 一键三连 | `tripleAction` | 同时点赞、投币、收藏 |
| 发送弹幕 | `danmaku` | 在视频上发送弹幕 |
| 充电 | `charge` | 给UP主充电 |
| 追番 | `followBangumi` | 追番/追剧 |

### 知乎 (Zhihu)

| 行为 | 动作名称 | 说明 |
| ---------- | ---------------- | -------------------- |
| 赞同 | `agree` | 赞同回答 |
| 反对 | `disagree` | 反对回答 |
| 没有帮助 | `notHelpful` | 标记回答没有帮助 |
| 感谢 | `thank` | 感谢作者 |
| 邀请回答 | `inviteAnswer` | 邀请用户回答问题 |
| 关注问题 | `followQuestion` | 关注问题以获取更新 |
| 写回答 | `writeAnswer` | 为问题写回答 |

---

## 参考资料

* [服务开发指南](../service-development-guide.md)
* [社交内容平台架构](../architecture/Service-for-social-media-platform.md)
* [日志服务](../logger-service/README.md)
* [事件总线服务](../eventBus-service/README.md)
* [粉丝服务](../fans-service/README.md)
* [通知系统](../notification-service/README.md)
* [社交媒体引擎](../social-media-engine/README.md)
