# 搜索服务系统集成

## 1. 集成总览

| 角色 | 服务 | 交互方式 |
| ---- | ---- | ---- |
| 索引生产者 | Social Media Engine | 发帖/删帖/改帖后触发 `index/remove` |
| 索引生产者 | Account Service | 账号创建/更新后同步索引 |
| 索引生产者 | Archive Service | 档案保存后同步索引 |
| 索引消费者 | Feed/Weibo App | 调用 `search` 进行内容检索 |
| 索引消费者 | 全局搜索入口 | 调用 `suggest + search` |
| 基础依赖 | Event Bus / Logger / Scheduler | 事件联动、可观测、定时重建 |

## 2. 事件驱动接入（推荐）

建议通过 Event Bus 订阅业务事件，统一驱动索引更新：

- `content:post:created` -> `search.index(postDoc)`
- `content:post:updated` -> `search.index(postDoc)`
- `content:post:deleted` -> `search.remove(postId, 'post')`
- `account:updated` -> `search.index(accountDoc)`
- `archive:saved` -> `search.index(archiveDoc)`

```typescript
import { eventBus } from '@/services/eventBus';
import { searchService } from '@/services/search';

eventBus.on('content:post:created', async ({ post }) => {
  await searchService.index({
    id: post.id,
    type: 'post',
    content: `${post.payload.title ?? ''} ${post.payload.text ?? ''}`.trim(),
    metadata: {
      platformId: post.platformId,
      authorId: post.authorId,
      timestamp: post.timestamp,
      tags: post.topicTags,
    },
  });
});
```

## 3. 与 Social Media Engine 集成

- 写入侧：帖子生命周期事件驱动增量索引
- 读取侧：搜索命中 `postId` 后，由业务服务拉取完整 `UniversalPost`
- 注意点：搜索结果排序要以搜索分数为主，展示层按结果顺序拼装

## 4. 与 Account Service 集成

- 建议索引字段：`name`、`username`、`bio`、`tags`
- 推荐过滤字段：`platformId`、`verified`、`followerCount`
- 典型场景：@提及、用户搜索、推荐关注页补充检索

## 5. 与 Archive Service 集成

- MVP 先接全文检索（标题/摘要/关键词）
- 后续可扩展语义检索（依赖 Vector Store）
- 典型场景：Prompt 注入前的相关档案召回

## 6. 与 Feed/Trending 集成

- Feed 可使用 `search` 做主题检索流（topic feed）
- Trending 可使用 `suggest` 提供热词联想
- 建议加 `platformId` 和时间窗口过滤，避免跨平台噪音

## 7. 与 Scheduler 集成（可选）

用于低频维护任务：

- 每日离峰执行 `reindex('post')` 对账
- 每小时清理无引用建议词
- 索引统计快照落库（用于观察趋势）

## 8. 可观测性约定

- Logger 字段建议：`query`, `types`, `total`, `took`, `source`
- 关键指标：P50/P95 耗时、空结果率、索引文档总量、重建耗时
- 异常兜底：搜索失败返回空结果并记录 `search:failed`
