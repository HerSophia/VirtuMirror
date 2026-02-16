# Social Graph Service 使用示例

> **版本**: v1.0  
> **最后更新**: 2026-02-07

## 1. 基础关系操作

### 1.1 关注与取关

```typescript
import { socialGraphService } from '@/services/socialGraph';

await socialGraphService.follow('player_001', 'npc_1001', {
  platformId: 'weibo',
});

const isFollowing = await socialGraphService.isFollowing(
  'player_001',
  'npc_1001',
  'weibo'
);

if (isFollowing) {
  await socialGraphService.unfollow('player_001', 'npc_1001', 'weibo');
}
```

### 1.2 拉黑与静音

```typescript
import { socialGraphService } from '@/services/socialGraph';

// 拉黑并自动取消关注
await socialGraphService.block('player_001', 'npc_spam', {
  platformId: 'weibo',
  scope: 'platform',
  autoUnfollow: true,
  reason: 'spam',
});

// 静音 7 天
await socialGraphService.mute('player_001', 'npc_noisy', {
  platformId: 'weibo',
  durationMs: 7 * 24 * 60 * 60 * 1000,
});
```

## 2. 关系查询

### 2.1 查询粉丝与关注

```typescript
import { socialGraphService } from '@/services/socialGraph';

const followers = await socialGraphService.getFollowers('npc_1001', {
  platformId: 'weibo',
  limit: 20,
});

const following = await socialGraphService.getFollowing('npc_1001', {
  platformId: 'weibo',
  limit: 20,
  cursor: followers.nextCursor,
});

console.log(followers.items.length, following.items.length);
```

### 2.2 查询互关与统计

```typescript
import { socialGraphService } from '@/services/socialGraph';

const mutuals = await socialGraphService.getMutualFollows('player_001', {
  platformId: 'weibo',
  limit: 50,
});

const stats = await socialGraphService.getRelationshipStats('player_001', 'weibo');

console.log('followers:', stats.followers);
console.log('following:', stats.following);
console.log('mutual:', stats.mutualFollows);
```

## 3. 推荐关注

```typescript
import { socialGraphService } from '@/services/socialGraph';

const recommendations = await socialGraphService.getRecommendedFollows('player_001', {
  platformId: 'weibo',
  limit: 10,
  minScore: 0.35,
  excludeIds: ['npc_legacy_1'],
});

for (const item of recommendations) {
  console.log(item.accountId, item.score, item.reasons[0]?.description);
}
```

## 4. 批量关注

```typescript
import { socialGraphService } from '@/services/socialGraph';

const result = await socialGraphService.batchFollow(
  'player_001',
  ['npc_1001', 'npc_1002', 'npc_1003'],
  {
    platformId: 'weibo',
    deduplicate: true,
    stopOnError: false,
  }
);

if (result.failed.length > 0) {
  console.warn('partial failed', result.failed);
}
```

## 5. 事件订阅

```typescript
import { socialGraphService } from '@/services/socialGraph';

const unsubscribe = socialGraphService.onRelationChange((event) => {
  if (event.type === 'social:relation:followed') {
    console.log('new follow', event.fromId, event.toId);
  }

  if (event.type === 'social:stats:updated') {
    console.log('stats updated', event.accountId, event.payload);
  }
});

// 页面销毁时
unsubscribe();
```

## 6. 在 Store 中使用

```typescript
import { defineStore } from 'pinia';
import { socialGraphService } from '@/services/socialGraph';

export const useSocialGraphStore = defineStore('social-graph', {
  state: () => ({
    followers: [] as string[],
    loading: false,
  }),
  actions: {
    async refreshFollowers(accountId: string, platformId: string) {
      this.loading = true;
      try {
        const result = await socialGraphService.getFollowers(accountId, {
          platformId,
          limit: 50,
        });
        this.followers = result.items.map((item) => item.accountId);
      } finally {
        this.loading = false;
      }
    },
  },
});
```
