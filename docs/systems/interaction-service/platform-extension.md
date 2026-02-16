# 交互服务平台扩展

> **版本**: v1.0  
> **最后更新**: 2026-01-16

本文档描述如何为交互服务注册平台特有的互动行为。

---

## 1. 概述

不同社交平台有不同的互动特色：

| 平台 | 特色互动 |
| ------ | ---------- |
| **微博** | 超话签到、长微博打赏 |
| **B站** | 一键三连、投币、充电 |
| **知乎** | 赞同、没有帮助、收藏专栏 |
| **抖音** | 合拍、抢评论、表情包回复 |

交互服务通过 **平台扩展机制** 支持这些差异化功能，同时保持核心接口的统一。

---

## 2. 平台行为注册

### 2.1 基本注册

```typescript
import { interactionService } from '@/services/interaction';
import type { PlatformBehavior } from '@/types/interaction';

// 注册 B站平台行为
interactionService.registerPlatformBehavior('bilibili', {
  platformId: 'bilibili',
  
  // 自定义互动行为
  customActions: {
    // 一键三连
    tripleAction: {
      name: '一键三连',
      description: '同时点赞、投币、收藏',
      execute: async (contentId, userId) => {
        await Promise.all([
          interactionService.like(contentId, userId),
          interactionService.favorite(contentId, userId),
          coin(contentId, userId, 2), // 投 2 个币
        ]);
      },
    },
    
    // 投币
    coin: {
      name: '投币',
      description: '给视频投币',
      execute: async (contentId, userId, params) => {
        const count = params?.count ?? 1;
        await recordCoin(contentId, userId, count);
      },
    },
    
    // 充电
    charge: {
      name: '充电',
      description: '给 UP 主充电',
      execute: async (contentId, userId, params) => {
        const amount = params?.amount ?? 10;
        await recordCharge(contentId, userId, amount);
      },
    },
  },
  
  // 互动权重配置（用于热度计算）
  interactionWeights: {
    like: 1,
    favorite: 2,
    comment: 3,
    repost: 5,
    view: 0.1,
    // B站特有
    coin: 4,
    tripleAction: 10,
  },
});
```

### 2.2 调用平台特有行为

```typescript
// 执行一键三连
await interactionService.executePlatformAction(
  'bilibili',
  'tripleAction',
  contentId,
  userId
);

// 投币
await interactionService.executePlatformAction(
  'bilibili',
  'coin',
  contentId,
  userId,
  { count: 2 }
);

// 充电
await interactionService.executePlatformAction(
  'bilibili',
  'charge',
  contentId,
  userId,
  { amount: 50 }
);
```

---

## 3. 平台扩展示例

### 3.1 微博平台扩展

```typescript
// services/interaction/platformBehaviors/weibo.ts

import { interactionService } from '@/services/interaction';

export function registerWeiboBehaviors() {
  interactionService.registerPlatformBehavior('weibo', {
    platformId: 'weibo',
    
    customActions: {
      // 超话签到
      superTopicCheckIn: {
        name: '超话签到',
        description: '在超话中签到',
        execute: async (topicId, userId) => {
          // 记录签到
          await recordSuperTopicCheckIn(topicId, userId);
          
          // 发布事件
          interactionService.emit({
            id: generateId(),
            type: 'superTopicCheckIn' as any,
            contentId: topicId,
            userId,
            platformId: 'weibo',
            timestamp: Date.now(),
          });
        },
      },
      
      // 打赏长微博
      reward: {
        name: '打赏',
        description: '打赏长微博作者',
        execute: async (contentId, userId, params) => {
          const amount = params?.amount ?? 5;
          await recordReward(contentId, userId, amount);
        },
      },
      
      // 微博会员专属表情
      vipEmoji: {
        name: 'VIP表情',
        description: '发送会员专属表情',
        execute: async (contentId, userId, params) => {
          // 检查是否是会员
          const isVip = await checkVipStatus(userId);
          if (!isVip) {
            throw new Error('需要微博会员才能使用专属表情');
          }
          // 发送表情评论
          await interactionService.comment(
            contentId,
            userId,
            params?.emojiCode ?? '[doge]'
          );
        },
      },
    },
    
    interactionWeights: {
      like: 1,
      favorite: 2,
      comment: 3,
      repost: 8,  // 微博转发权重高
      view: 0.05,
    },
    
    // 验证规则
    validators: {
      canRepost: (contentId, userId) => {
        // 检查是否允许转发
        return true;
      },
    },
  });
}
```

### 3.2 知乎平台扩展

```typescript
// services/interaction/platformBehaviors/zhihu.ts

export function registerZhihuBehaviors() {
  interactionService.registerPlatformBehavior('zhihu', {
    platformId: 'zhihu',
    
    customActions: {
      // 赞同（与普通点赞不同的语义）
      upvote: {
        name: '赞同',
        description: '赞同这个回答',
        execute: async (answerId, userId) => {
          // 知乎的赞同本质上也是点赞
          await interactionService.like(answerId, userId);
          
          // 但发布的是专属事件
          interactionService.emit({
            id: generateId(),
            type: 'upvote' as any,
            contentId: answerId,
            userId,
            platformId: 'zhihu',
            timestamp: Date.now(),
          });
        },
      },
      
      // 没有帮助
      downvote: {
        name: '没有帮助',
        description: '认为这个回答没有帮助',
        execute: async (answerId, userId) => {
          await recordDownvote(answerId, userId);
        },
      },
      
      // 收藏到专栏
      saveToColumn: {
        name: '收藏到专栏',
        description: '收藏到我的专栏',
        execute: async (contentId, userId, params) => {
          const columnId = params?.columnId;
          await interactionService.favorite(contentId, userId, columnId);
        },
      },
      
      // 邀请回答
      inviteAnswer: {
        name: '邀请回答',
        description: '邀请某人回答问题',
        execute: async (questionId, fromUserId, params) => {
          const targetUserId = params?.targetUserId;
          await recordInvitation(questionId, fromUserId, targetUserId);
        },
      },
    },
    
    interactionWeights: {
      like: 2,      // 知乎赞同权重高
      favorite: 1,
      comment: 2,
      repost: 3,
      view: 0.1,
    },
  });
}
```

### 3.3 抖音平台扩展

```typescript
// services/interaction/platformBehaviors/douyin.ts

export function registerDouyinBehaviors() {
  interactionService.registerPlatformBehavior('douyin', {
    platformId: 'douyin',
    
    customActions: {
      // 合拍
      duet: {
        name: '合拍',
        description: '与这个视频合拍',
        execute: async (videoId, userId) => {
          // 创建合拍记录
          const duetId = await createDuet(videoId, userId);
          return { duetId };
        },
      },
      
      // 使用同款音乐/特效
      useSame: {
        name: '使用同款',
        description: '使用同款音乐/特效',
        execute: async (videoId, userId, params) => {
          const type = params?.type ?? 'music'; // 'music' | 'effect'
          await recordUseSame(videoId, userId, type);
        },
      },
      
      // 抢热评
      hotComment: {
        name: '抢热评',
        description: '尝试成为热评',
        execute: async (videoId, userId, params) => {
          const text = params?.text;
          const comment = await interactionService.comment(videoId, userId, text);
          // 标记为尝试热评
          await markHotCommentAttempt(comment.id);
          return comment;
        },
      },
      
      // 表情包回复
      emojiReply: {
        name: '表情包回复',
        description: '用表情包回复',
        execute: async (commentId, userId, params) => {
          const emojiId = params?.emojiId;
          await createEmojiReply(commentId, userId, emojiId);
        },
      },
    },
    
    interactionWeights: {
      like: 1,
      favorite: 1,
      comment: 2,
      repost: 3,
      view: 0.2,  // 抖音浏览权重高
      share: 5,   // 分享权重高
    },
  });
}
```

---

## 4. 统一初始化

### 4.1 注册所有平台行为

```typescript
// services/interaction/platformBehaviors/index.ts

import { registerWeiboBehaviors } from './weibo';
import { registerBilibiliBehaviors } from './bilibili';
import { registerZhihuBehaviors } from './zhihu';
import { registerDouyinBehaviors } from './douyin';

export function registerAllPlatformBehaviors() {
  registerWeiboBehaviors();
  registerBilibiliBehaviors();
  registerZhihuBehaviors();
  registerDouyinBehaviors();
}
```

### 4.2 在服务初始化时调用

```typescript
// services/interaction/interactionService.ts

import { registerAllPlatformBehaviors } from './platformBehaviors';

class InteractionService {
  async initialize(): Promise<void> {
    // ... 其他初始化逻辑
    
    // 注册平台特有行为
    registerAllPlatformBehaviors();
  }
}
```

---

## 5. 在组件中使用平台扩展

### 5.1 B站一键三连按钮

```vue
<template>
  <button 
    @click="handleTripleAction"
    :class="{ 'text-pink-500': isTripled }"
    :disabled="isLoading"
  >
    <TripleIcon />
    <span v-if="isTripled">已三连</span>
    <span v-else>一键三连</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { interactionService } from '@/services/interaction';

const props = defineProps<{
  videoId: string;
  userId: string;
}>();

const isTripled = ref(false);
const isLoading = ref(false);

async function handleTripleAction() {
  if (isTripled.value || isLoading.value) return;
  
  isLoading.value = true;
  
  try {
    await interactionService.executePlatformAction(
      'bilibili',
      'tripleAction',
      props.videoId,
      props.userId
    );
    
    isTripled.value = true;
  } catch (error) {
    console.error('一键三连失败:', error);
  } finally {
    isLoading.value = false;
  }
}
</script>
```

### 5.2 知乎赞同/没有帮助按钮

```vue
<template>
  <div class="flex items-center gap-2">
    <!-- 赞同 -->
    <button 
      @click="handleUpvote"
      :class="{ 'text-blue-500 bg-blue-50': voteStatus === 'up' }"
      class="flex items-center gap-1 px-3 py-1 rounded-full border"
    >
      <UpArrowIcon />
      <span>赞同 {{ upvoteCount }}</span>
    </button>
    
    <!-- 没有帮助 -->
    <button 
      @click="handleDownvote"
      :class="{ 'text-gray-500': voteStatus === 'down' }"
      class="px-2 py-1"
    >
      <DownArrowIcon />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { interactionService } from '@/services/interaction';

const props = defineProps<{
  answerId: string;
  userId: string;
  initialUpvotes: number;
}>();

const voteStatus = ref<'up' | 'down' | null>(null);
const upvoteCount = ref(props.initialUpvotes);

async function handleUpvote() {
  if (voteStatus.value === 'up') {
    // 取消赞同
    await interactionService.unlike(props.answerId, props.userId);
    voteStatus.value = null;
    upvoteCount.value--;
  } else {
    // 赞同
    await interactionService.executePlatformAction(
      'zhihu',
      'upvote',
      props.answerId,
      props.userId
    );
    
    if (voteStatus.value === 'down') {
      upvoteCount.value++; // 从反对变赞同
    }
    voteStatus.value = 'up';
    upvoteCount.value++;
  }
}

async function handleDownvote() {
  if (voteStatus.value === 'down') {
    // 取消没有帮助
    voteStatus.value = null;
  } else {
    await interactionService.executePlatformAction(
      'zhihu',
      'downvote',
      props.answerId,
      props.userId
    );
    
    if (voteStatus.value === 'up') {
      upvoteCount.value--; // 从赞同变反对
    }
    voteStatus.value = 'down';
  }
}
</script>
```

---

## 6. 平台权重配置

### 6.1 热度计算中的权重应用

```typescript
// 在 TrafficEngine 中使用平台权重
class TrafficEngine {
  calculateHeatValue(contentId: string, stats: InteractionStats): number {
    const behavior = interactionService.getPlatformBehavior(stats.platformId);
    const weights = behavior?.interactionWeights ?? DEFAULT_WEIGHTS;
    
    let heat = 0;
    heat += stats.likes * (weights.like ?? 1);
    heat += stats.favorites * (weights.favorite ?? 2);
    heat += stats.comments * (weights.comment ?? 3);
    heat += stats.reposts * (weights.repost ?? 5);
    heat += stats.views * (weights.view ?? 0.1);
    heat += stats.shares * (weights.share ?? 3);
    
    return heat;
  }
}
```

### 6.2 涨粉计算中的权重应用

```typescript
// 在粉丝服务中使用
class FansService {
  calculateGrowthFromInteraction(event: InteractionEvent): number {
    const behavior = interactionService.getPlatformBehavior(event.platformId);
    const weight = behavior?.interactionWeights?.[event.type] ?? 1;
    
    // 基础涨粉公式
    const baseGrowth = 0.01; // 基础涨粉率
    return baseGrowth * weight;
  }
}
```

---

## 7. 平台验证规则

### 7.1 定义验证规则

```typescript
interactionService.registerPlatformBehavior('weibo', {
  platformId: 'weibo',
  
  validators: {
    // 验证是否可以点赞
    canLike: async (contentId, userId) => {
      const content = await getContent(contentId);
      
      // 检查内容是否存在
      if (!content) return false;
      
      // 检查是否被作者屏蔽
      const isBlocked = await checkBlocked(content.authorId, userId);
      if (isBlocked) return false;
      
      return true;
    },
    
    // 验证是否可以评论
    canComment: async (contentId, userId) => {
      const content = await getContent(contentId);
      
      // 检查是否允许评论
      if (!content?.allowComment) return false;
      
      // 检查评论频率限制
      const recentComments = await getRecentComments(userId, 60000); // 1分钟内
      if (recentComments.length >= 5) return false; // 限制每分钟 5 条
      
      return true;
    },
    
    // 验证是否可以转发
    canRepost: async (contentId, userId) => {
      const content = await getContent(contentId);
      
      // 检查是否允许转发
      if (content?.visibility === 'private') return false;
      
      return true;
    },
  },
});
```

### 7.2 在操作前验证

```typescript
// interactionService 中的验证逻辑
class InteractionService {
  async like(contentId: string, userId: string): Promise<void> {
    const platformId = await this.getContentPlatform(contentId);
    const behavior = this.getPlatformBehavior(platformId);
    
    // 执行平台验证
    if (behavior?.validators?.canLike) {
      const canLike = await behavior.validators.canLike(contentId, userId);
      if (!canLike) {
        throw new InteractionError('PERMISSION_DENIED', '无法点赞此内容');
      }
    }
    
    // 执行点赞
    await this.likeManager.like(contentId, userId, platformId);
  }
}
```

---

## 8. 扩展点查询

### 8.1 获取平台信息

```typescript
// 获取平台行为配置
const behavior = interactionService.getPlatformBehavior('bilibili');

console.log('可用的自定义行为:', Object.keys(behavior?.customActions ?? {}));
console.log('互动权重:', behavior?.interactionWeights);

// 检查是否支持某个行为
const supportsTriple = !!behavior?.customActions?.tripleAction;
```

### 8.2 列出所有注册的平台

```typescript
const platforms = interactionService.getRegisteredPlatforms();
// ['weibo', 'bilibili', 'zhihu', 'douyin']

for (const platformId of platforms) {
  const behavior = interactionService.getPlatformBehavior(platformId);
  console.log(`${platformId} 自定义行为:`, Object.keys(behavior?.customActions ?? {}));
}
```

---

## 9. 动态注册（运行时扩展）

### 9.1 App 启动时注册

```typescript
// 在 App 入口注册平台行为
// apps/bilibili/main.ts

import { interactionService } from '@/services/interaction';

export async function initBilibiliApp() {
  // 注册 B站特有行为
  interactionService.registerPlatformBehavior('bilibili', {
    // ... B站配置
  });
  
  // App 其他初始化
}
```

### 9.2 动态更新权重

```typescript
// 根据运营策略动态调整权重
function updatePlatformWeights(platformId: string, newWeights: Record<string, number>) {
  const existing = interactionService.getPlatformBehavior(platformId);
  
  if (existing) {
    interactionService.registerPlatformBehavior(platformId, {
      ...existing,
      interactionWeights: {
        ...existing.interactionWeights,
        ...newWeights,
      },
    });
  }
}

// 例：活动期间提高转发权重
updatePlatformWeights('weibo', { repost: 15 });
```

---

## 相关文档

* [类型定义](./types.md)
* [架构设计](./architecture.md)
* [使用示例](./usage.md)
* [系统集成](./integration.md)
