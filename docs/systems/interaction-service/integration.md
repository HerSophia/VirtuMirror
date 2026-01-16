# 交互服务系统集成

> **版本**: v1.0  
> **最后更新**: 2026-01-16

本文档描述交互服务与其他系统服务的集成方式。

---

## 1. 集成概览

交互服务作为核心的互动行为管理中心，需要与多个系统服务进行集成：

```text
                    ┌─────────────────────────────────┐
                    │       InteractionService        │
                    │         (交互服务)               │
                    └─────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Fans Service   │      │  Notification   │      │  Social Media   │
│   (粉丝服务)     │      │    Service      │      │     Engine      │
│                 │      │   (通知服务)     │      │   (社交引擎)     │
│ 监听互动事件    │      │ 发送互动通知     │      │ 更新内容热度     │
│ 计算粉丝增长    │      │ 新赞/新评论     │      │ 排序信息流       │
└─────────────────┘      └─────────────────┘      └─────────────────┘
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Account Service │      │  EventBus       │      │  LLM Task       │
│   (账号服务)     │      │  Service        │      │   Service       │
│                 │      │  (事件总线)      │      │  (LLM任务)       │
│ 用户身份验证    │      │ 跨服务事件广播   │      │ 生成评论回复     │
│ 关系查询       │      │                 │      │ 生成互动内容     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 2. 与粉丝服务集成

### 2.1 集成目的

粉丝服务需要监听用户的互动行为，根据互动类型和权重计算内容作者的粉丝增长。

### 2.2 集成方式

```typescript
// services/fans/fansService.ts

import { interactionService } from '@/services/interaction';
import type { InteractionEvent } from '@/types/interaction';

class FansService {
  constructor() {
    this.setupInteractionSubscription();
  }

  private setupInteractionSubscription() {
    // 订阅所有互动事件
    interactionService.onInteraction((event) => {
      this.processInteractionForGrowth(event);
    });
  }

  /**
   * 处理互动事件，计算涨粉
   */
  private async processInteractionForGrowth(event: InteractionEvent) {
    // 只处理正向互动
    const positiveTypes = ['like', 'favorite', 'comment', 'repost', 'share'];
    if (!positiveTypes.includes(event.type)) {
      return;
    }

    // 获取内容作者
    const content = await this.getContent(event.contentId);
    if (!content) return;

    const authorId = content.authorId;
    
    // 不计算自己给自己的互动
    if (authorId === event.userId) return;

    // 获取平台权重配置
    const behavior = interactionService.getPlatformBehavior(event.platformId);
    const weight = behavior?.interactionWeights?.[event.type] ?? 1;

    // 计算涨粉概率和数量
    const growthResult = this.calculateGrowth({
      type: event.type,
      weight,
      authorFollowerCount: await this.getFollowerCount(authorId),
      userInfluence: await this.getUserInfluence(event.userId),
    });

    // 执行涨粉
    if (growthResult.shouldGrow) {
      await this.addFollower(authorId, event.userId, {
        source: 'interaction',
        interactionType: event.type,
        contentId: event.contentId,
      });
    }
  }

  /**
   * 涨粉算法
   */
  private calculateGrowth(params: {
    type: string;
    weight: number;
    authorFollowerCount: number;
    userInfluence: number;
  }): { shouldGrow: boolean; probability: number } {
    // 基础涨粉概率
    const baseProbability = 0.01; // 1%
    
    // 根据权重调整
    let probability = baseProbability * params.weight;
    
    // 根据作者粉丝数调整（粉丝越多，单次涨粉概率越低）
    const followerFactor = Math.max(0.1, 1 - params.authorFollowerCount / 100000);
    probability *= followerFactor;
    
    // 根据用户影响力调整
    probability *= (1 + params.userInfluence * 0.1);
    
    // 随机判定
    const shouldGrow = Math.random() < probability;
    
    return { shouldGrow, probability };
  }
}
```

### 2.3 数据流

```text
用户点赞帖子
     │
     ▼
InteractionService.like()
     │
     ▼
EventEmitter.emit('like')
     │
     ▼
FansService.processInteractionForGrowth()
     │
     ├── 获取帖子作者
     ├── 获取平台权重
     ├── 计算涨粉概率
     │
     ▼
判定是否涨粉
     │
     ├── 是 → 添加粉丝关系
     │        └── 发送涨粉通知
     │
     └── 否 → 结束
```

---

## 3. 与通知服务集成

### 3.1 集成目的

当用户的内容收到点赞、评论、转发等互动时，需要向内容作者发送通知。

### 3.2 集成方式

```typescript
// services/notification/notificationService.ts

import { interactionService } from '@/services/interaction';
import type { InteractionEvent } from '@/types/interaction';

class NotificationService {
  constructor() {
    this.setupInteractionNotifications();
  }

  private setupInteractionNotifications() {
    // 点赞通知
    interactionService.on('like', async (event) => {
      await this.sendLikeNotification(event);
    });

    // 评论通知
    interactionService.on('comment', async (event) => {
      await this.sendCommentNotification(event);
    });

    // 转发通知
    interactionService.on('repost', async (event) => {
      await this.sendRepostNotification(event);
    });

    // 收藏通知（可选，部分平台不通知）
    interactionService.on('favorite', async (event) => {
      if (this.shouldNotifyFavorite(event.platformId)) {
        await this.sendFavoriteNotification(event);
      }
    });
  }

  /**
   * 发送点赞通知
   */
  private async sendLikeNotification(event: InteractionEvent) {
    const content = await this.getContent(event.contentId);
    if (!content) return;

    // 不通知自己
    if (content.authorId === event.userId) return;

    const user = await this.getUser(event.userId);
    
    await this.createNotification({
      recipientId: content.authorId,
      type: 'like',
      title: '收到新的赞',
      message: `${user.displayName} 赞了你的${this.getContentTypeName(content.type)}`,
      data: {
        contentId: event.contentId,
        userId: event.userId,
        platformId: event.platformId,
      },
      icon: user.avatar,
      createdAt: event.timestamp,
    });
  }

  /**
   * 发送评论通知
   */
  private async sendCommentNotification(event: InteractionEvent) {
    const content = await this.getContent(event.contentId);
    if (!content) return;

    const user = await this.getUser(event.userId);
    const commentText = event.metadata?.commentText ?? '';
    
    // 通知内容作者
    if (content.authorId !== event.userId) {
      await this.createNotification({
        recipientId: content.authorId,
        type: 'comment',
        title: '收到新评论',
        message: `${user.displayName}: ${this.truncate(commentText, 50)}`,
        data: {
          contentId: event.contentId,
          commentId: event.metadata?.commentId,
          userId: event.userId,
          platformId: event.platformId,
        },
        icon: user.avatar,
        createdAt: event.timestamp,
      });
    }

    // 如果是回复，还要通知被回复的用户
    if (event.metadata?.replyToCommentId) {
      const parentComment = await this.getComment(event.metadata.replyToCommentId);
      if (parentComment && parentComment.authorId !== event.userId) {
        await this.createNotification({
          recipientId: parentComment.authorId,
          type: 'reply',
          title: '收到新回复',
          message: `${user.displayName} 回复了你: ${this.truncate(commentText, 50)}`,
          data: {
            contentId: event.contentId,
            commentId: event.metadata?.commentId,
            parentCommentId: event.metadata.replyToCommentId,
            userId: event.userId,
            platformId: event.platformId,
          },
          icon: user.avatar,
          createdAt: event.timestamp,
        });
      }
    }
  }

  /**
   * 聚合通知（避免通知轰炸）
   */
  async aggregateLikeNotifications(recipientId: string) {
    const recentLikes = await this.getRecentNotifications(recipientId, {
      type: 'like',
      since: Date.now() - 60000, // 1 分钟内
    });

    if (recentLikes.length >= 3) {
      // 合并为一条通知
      await this.mergeNotifications(recentLikes, {
        title: '收到多个赞',
        message: `${recentLikes.length} 人赞了你的内容`,
      });
    }
  }
}
```

### 3.3 通知类型映射

| 互动类型 | 通知类型 | 通知标题 | 是否聚合 |
|----------|----------|----------|----------|
| `like` | `like` | 收到新的赞 | ✅ 是 |
| `comment` | `comment` | 收到新评论 | ❌ 否 |
| `repost` | `repost` | 被转发了 | ❌ 否 |
| `favorite` | `favorite` | 被收藏了 | 可选 |
| `reply` | `reply` | 收到新回复 | ❌ 否 |

---

## 4. 与社交媒体引擎集成

### 4.1 集成目的

社交媒体引擎需要根据互动数据更新内容热度，用于信息流排序和热搜计算。

### 4.2 集成方式

```typescript
// services/social/trafficEngine.ts

import { interactionService } from '@/services/interaction';
import type { InteractionStats } from '@/types/interaction';

class TrafficEngine {
  /**
   * 计算内容热度
   */
  async calculateHeatValue(contentId: string): Promise<number> {
    // 获取互动统计
    const stats = await interactionService.getStats(contentId);
    
    // 获取平台权重
    const behavior = interactionService.getPlatformBehavior(stats.platformId);
    const weights = behavior?.interactionWeights ?? {
      like: 1,
      favorite: 2,
      comment: 3,
      repost: 5,
      view: 0.1,
      share: 3,
    };

    // 计算基础热度
    let heat = 0;
    heat += stats.likes * weights.like;
    heat += stats.favorites * weights.favorite;
    heat += stats.comments * weights.comment;
    heat += stats.reposts * weights.repost;
    heat += stats.views * weights.view;
    heat += stats.shares * weights.share;

    // 应用时间衰减
    const content = await this.getContent(contentId);
    const age = Date.now() - content.createdAt;
    const decayFactor = this.calculateDecay(age);
    
    return heat * decayFactor;
  }

  /**
   * 时间衰减算法
   */
  private calculateDecay(ageMs: number): number {
    const halfLife = 4 * 60 * 60 * 1000; // 4 小时半衰期
    return Math.pow(0.5, ageMs / halfLife);
  }

  /**
   * 批量更新信息流排序
   */
  async updateFeedRanking(contentIds: string[]): Promise<void> {
    const statsMap = await interactionService.batchGetStats(contentIds);
    
    const rankings = await Promise.all(
      contentIds.map(async (id) => {
        const heat = await this.calculateHeatValue(id);
        return { id, heat };
      })
    );

    // 按热度排序
    rankings.sort((a, b) => b.heat - a.heat);

    // 更新排序缓存
    await this.updateRankingCache(rankings);
  }

  /**
   * 订阅互动事件，实时更新热度
   */
  setupRealtimeUpdates() {
    interactionService.onInteraction(async (event) => {
      // 只处理影响热度的事件
      const heatEvents = ['like', 'favorite', 'comment', 'repost', 'share'];
      if (heatEvents.includes(event.type)) {
        // 标记需要重新计算热度
        await this.markForRecalculation(event.contentId);
      }
    });
  }
}
```

### 4.3 热搜联动

```typescript
// services/social/trendService.ts

import { interactionService } from '@/services/interaction';

class TrendService {
  /**
   * 计算话题热度
   */
  async calculateTopicHeat(topicId: string): Promise<number> {
    // 获取话题下所有内容
    const contentIds = await this.getTopicContents(topicId);
    
    // 批量获取统计
    const statsMap = await interactionService.batchGetStats(contentIds);
    
    // 聚合话题热度
    let totalHeat = 0;
    for (const stats of statsMap.values()) {
      totalHeat += stats.likes + stats.comments * 2 + stats.reposts * 3;
    }
    
    return totalHeat;
  }

  /**
   * 监听互动事件更新热搜
   */
  setupTrendingUpdates() {
    interactionService.onInteraction(async (event) => {
      // 获取内容关联的话题
      const topics = await this.getContentTopics(event.contentId);
      
      for (const topicId of topics) {
        // 标记话题需要重新计算
        await this.markTopicForUpdate(topicId);
      }
    });
  }
}
```

---

## 5. 与账号服务集成

### 5.1 集成目的

交互服务需要账号服务来验证用户身份和查询用户关系。

### 5.2 集成方式

```typescript
// services/interaction/interactionService.ts

import { accountService } from '@/services/account';

class InteractionService {
  /**
   * 点赞前的权限检查
   */
  async like(contentId: string, userId: string): Promise<void> {
    // 验证用户存在
    const user = await accountService.getAccount(userId);
    if (!user) {
      throw new InteractionError('USER_NOT_FOUND', '用户不存在');
    }

    // 获取内容作者
    const content = await this.getContent(contentId);
    if (!content) {
      throw new InteractionError('CONTENT_NOT_FOUND', '内容不存在');
    }

    // 检查是否被作者拉黑
    const isBlocked = await accountService.isBlocked(
      content.authorId,
      userId
    );
    if (isBlocked) {
      throw new InteractionError('BLOCKED', '无法与此用户互动');
    }

    // 执行点赞
    await this.likeManager.like(contentId, userId, content.platformId);
  }

  /**
   * 获取用户信息用于通知和展示
   */
  async enrichInteractionEvent(event: InteractionEvent): Promise<EnrichedInteractionEvent> {
    const user = await accountService.getAccount(event.userId);
    
    return {
      ...event,
      userInfo: {
        displayName: user?.displayName ?? '未知用户',
        avatar: user?.avatar,
        handle: user?.handle,
      },
    };
  }

  /**
   * 检查关注关系（用于互动权重）
   */
  async checkFollowRelation(userId: string, authorId: string): Promise<boolean> {
    return accountService.isFollowing(userId, authorId);
  }
}
```

### 5.3 关系增强的互动

```typescript
// 关注者的互动权重更高
class FansService {
  async processInteractionWithRelation(event: InteractionEvent) {
    const isFollowing = await accountService.isFollowing(
      event.userId,
      await this.getContentAuthorId(event.contentId)
    );

    // 粉丝的互动权重更高
    let weight = this.getBaseWeight(event.type);
    if (isFollowing) {
      weight *= 1.5; // 粉丝互动权重 +50%
    }

    // 继续计算涨粉...
  }
}
```

---

## 6. 与事件总线集成

### 6.1 集成目的

通过事件总线实现与其他服务的松耦合通信。

### 6.2 集成方式

```typescript
// services/interaction/interactionService.ts

import { eventBus } from '@/services/eventBus';

class InteractionService {
  /**
   * 将互动事件广播到全局事件总线
   */
  private broadcastToEventBus(event: InteractionEvent) {
    // 发布到通用事件总线
    eventBus.emit(`interaction:${event.type}`, event);
    
    // 发布聚合事件
    eventBus.emit('interaction:any', event);
  }

  /**
   * 在发布互动事件时同时广播
   */
  emitInteraction(event: InteractionEvent) {
    // 内部事件发布
    this.eventEmitter.emit(event);
    
    // 全局事件总线广播
    this.broadcastToEventBus(event);
  }
}

// 其他服务可以通过事件总线订阅
eventBus.on('interaction:like', (event) => {
  console.log('收到点赞事件（通过事件总线）');
});

eventBus.on('interaction:any', (event) => {
  console.log(`收到互动事件: ${event.type}`);
});
```

### 6.3 事件名称规范

| 事件名称 | 说明 |
|----------|------|
| `interaction:like` | 点赞事件 |
| `interaction:unlike` | 取消点赞事件 |
| `interaction:favorite` | 收藏事件 |
| `interaction:comment` | 评论事件 |
| `interaction:repost` | 转发事件 |
| `interaction:view` | 浏览事件 |
| `interaction:any` | 所有互动事件 |

---

## 7. 与 LLM 任务服务集成

### 7.1 集成目的

LLM 任务服务可以监听评论事件，自动生成 NPC 的回复。

### 7.2 集成方式

```typescript
// services/llmTask/commentReplyTask.ts

import { interactionService } from '@/services/interaction';
import { llmTaskService } from '@/services/llmTask';

class CommentReplyTaskHandler {
  constructor() {
    this.setupAutoReply();
  }

  private setupAutoReply() {
    interactionService.on('comment', async (event) => {
      // 检查是否需要自动回复
      const shouldReply = await this.shouldAutoReply(event);
      if (!shouldReply) return;

      // 创建 LLM 任务生成回复
      await llmTaskService.execute({
        taskId: 'comment-reply',
        input: {
          contentId: event.contentId,
          commentId: event.metadata?.commentId,
          commentText: event.metadata?.commentText,
          userId: event.userId,
        },
        onComplete: async (result) => {
          // 发表 NPC 回复
          const npcId = await this.getNpcForContent(event.contentId);
          await interactionService.comment(
            event.contentId,
            npcId,
            result.replyText,
            event.metadata?.commentId
          );
        },
      });
    });
  }

  /**
   * 判断是否需要自动回复
   */
  private async shouldAutoReply(event: InteractionEvent): Promise<boolean> {
    // 检查内容作者是否是 NPC
    const content = await this.getContent(event.contentId);
    const author = await accountService.getAccount(content.authorId);
    
    if (author?.isPlayer) {
      return false; // 玩家的内容不自动回复
    }

    // 检查回复概率（避免每条都回复）
    const replyProbability = 0.3; // 30% 概率回复
    return Math.random() < replyProbability;
  }
}
```

### 7.3 评论生成任务定义

```typescript
// 注册评论回复任务
llmTaskService.registerTask({
  id: 'comment-reply',
  name: '评论回复生成',
  description: '根据评论内容生成 NPC 的回复',
  
  promptTemplate: `
你是 {{authorName}}，{{authorBio}}。

有人在你的帖子下评论了：
"{{commentText}}"

请用符合你人设的语气回复这条评论。回复要自然、简短（1-2句话）。

直接输出回复内容，不要有任何额外说明。
`,
  
  variables: [
    { name: 'authorName', source: 'input.authorName' },
    { name: 'authorBio', source: 'input.authorBio' },
    { name: 'commentText', source: 'input.commentText' },
  ],
  
  outputHandler: (output) => {
    return {
      replyText: output.trim(),
    };
  },
});
```

---

## 8. 从微博 userActionStore 迁移

### 8.1 当前实现分析

微博的 `userActionStore` 当前实现了：
- 点赞状态管理
- 收藏状态管理
- 浏览历史记录

### 8.2 迁移策略

```typescript
// stores/weiboStore.ts（迁移后）

import { interactionService } from '@/services/interaction';

export const useWeiboStore = defineStore('weibo', {
  // ... 其他状态

  actions: {
    /**
     * 点赞帖子（迁移到 InteractionService）
     */
    async likePost(postId: string) {
      const userId = this.currentUserId;
      
      // 调用统一的交互服务
      await interactionService.like(postId, userId);
      
      // 更新本地状态（乐观更新已在服务中处理）
      this.likedPosts.add(postId);
    },

    /**
     * 取消点赞
     */
    async unlikePost(postId: string) {
      const userId = this.currentUserId;
      await interactionService.unlike(postId, userId);
      this.likedPosts.delete(postId);
    },

    /**
     * 收藏帖子
     */
    async favoritePost(postId: string) {
      const userId = this.currentUserId;
      await interactionService.favorite(postId, userId);
      this.favoritedPosts.add(postId);
    },

    /**
     * 初始化时加载用户互动状态
     */
    async loadUserInteractions(postIds: string[]) {
      const userId = this.currentUserId;
      
      // 批量检查点赞状态
      const likeStatus = await interactionService.batchCheckd(postIds, userId);
      for (const [id, isLiked] of likeStatus) {
        if (isLiked) this.likedPosts.add(id);
      }
      
      // 批量检查收藏状态
      const favoriteStatus = await interactionService.batchCheckFavorited(postIds, userId);
      for (const [id, isFavorited] of favoriteStatus) {
        if (isFavorited) this.favoritedPosts.add(id);
      }
    },
  },
});
```

### 8.3 数据迁移

```typescript
// scripts/migrateUserActions.ts

import { interactionService } from '@/services/interaction';

/**
 * 将旧的 userActionStore 数据迁移到 InteractionService
 */
export async function migrateUserActions() {
  // 读取旧数 oldData = await loadOldUserActionData();
  
  // 迁移点赞数据
  for (const [userId, likedPosts] of oldData.likes) {
    for (const postId of likedPosts) {
      await interactionService.like(postId, userId);
    }
  }
  
  // 迁移收藏数据
  for (const [userId, favorites] of oldData.favorites) {
    for (const postId of favorites) {
      await interactionService.favorite(postId, userId);
    }
  }
  
  // 迁移浏览历史
  for (const record of oldData.viewHistory) {
    await interactionService.recordView(record.postId, record.userId, {
      duration: record.duration,
      contentSnapshot: {
        title: record.title,
        authorName: record.authorName,
      },
    });
  }
  
  console.log('迁移完成');
}
```

### 8.4 迁移检查清单

- [ ] 创建 InteractionService
- [ ] 实现 LikeManager
- [ ] 实现 FavoriteManager
- [ ] 实现 ViewTracker
- [ ] 实现 StatsManager
- [ ] 实现 EventEmitter
- [ ] 修改 weiboStore 调用 InteractionService
- [ ] 编写数据迁移脚本
- [ ] 测试点赞功能
- [ ] 测试收藏功能
- [ ] 测试浏览历史
- [ ] 测试事件订阅
- [ ] 删除旧的 userActionStore 代码

---

## 9. 集成测试

### 9.1 测试场景

```typescript
// tests/integration/interactionService.test.ts

describe('InteractionService Integration', () => {
  describe('与粉丝服务集成', () => {
    it('点赞应触发涨粉计算', async () => {
      const growthSpy = vi.spyOn(fansService, 'processInteractionForGrowth');
      
      await interactionService.like('post_001', 'user_001');
      
      expect(growthSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'like',
          contentId: 'post_001',
          userId: 'user_001',
        })
      );
    });
  });

  describe('与通知服务集成', () => {
    it('评论应发送通知给作者', async () => {
      const notifySpy = vi.spyOn(notificationService, 'sendCommentNotification');
      
      await interactionService.comment(
        'post_001',
        'user_002',
        '好文章！'
      );
      
      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('与社交引擎集成', () => {
    it('互动应更新内容热度', async () => {
      const updateSpy = vi.spyOn(trafficEngine, 'markForRecalculation');
      
      await interactionService.like('post_001', 'user_001');
      
      expect(updateSpy).toHaveBeenCalledWith('post_001');
    });
  });
});
```

---

## 相关文档

* [类型定义](./types.md)
* [架构设计](./architecture.md)
* [使用示例](./usage.md)
* [平台扩展](./platform-extension.md)
* [涨粉服务](../fans-service/README.md)
* [通知服务](../notification-service/README.md)
* [社交媒体引擎](../social-media-engine/README.md)
* [账号服务](../account-service/README.md)
