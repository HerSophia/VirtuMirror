# 社交图谱服务 (Social Graph Service)

> **状态**: ✅ v1.0 已实现（核心能力已落地）  
> **版本**: v1.0  
> **优先级**: 🟡 中  
> **最后更新**: 2026-02-07

## 1. 概述

Social Graph Service 是系统级的关系管理中心，负责统一维护关注、粉丝、互关、拉黑、静音等关系数据，并提供图查询与推荐能力。

它与 Account Service 的边界是：

- Account Service 管账号实体与身份
- Social Graph Service 管账号之间的关系边

## 2. 核心能力

- 关系管理：`follow`、`unfollow`、`block`、`mute`、批量关注
- 关系查询：粉丝列表、关注列表、互关关系、关系判定
- 关系统计：粉丝数/关注数/互关数等聚合查询
- 推荐能力：基于共同关注、共同粉丝、互动信号做关注推荐
- 事件驱动：关系变更通过 Event Bus 广播给 Feed/Fans/Notification
- 平台隔离：同一账号在不同平台的关系网络独立管理

## 3. 设计目标

| 维度 | 目标 |
| ---- | ---- |
| 跨平台复用 | 微博、B站、知乎等统一使用关系服务 |
| 单一事实源 | 关系状态统一由系统服务管理 |
| 高可维护 | App 只调用 API，不关心底层图数据结构 |
| 可扩展 | 支持推荐策略、关系策略插件化扩展 |
| 可观测 | 关系变化有日志和事件可追踪 |

## 4. 问题背景

历史上关系能力分散在多个模块：

1. 关系逻辑与 App 耦合，缺少统一关系 API
2. 关注/粉丝统计口径不一致
3. Feed/Fans 等服务需要关系数据时缺少标准依赖
4. 关系推荐能力没有统一承载层

当前已通过 `SocialGraphService` 完成统一收敛，调用方可直接使用系统服务。

## 5. 文档导航

| 文档 | 说明 |
| ---- | ---- |
| [架构设计](./architecture.md) | 组件划分、数据流、存储模型 |
| [类型定义](./types.md) | 关系模型、查询参数、事件契约 |
| [API 参考](./api-reference.md) | 方法说明、错误码、约束规则 |
| [使用示例](./usage.md) | 关注/拉黑/推荐等常见调用示例 |
| [系统集成](./integration.md) | 与 Account/Fans/Feed/EventBus 的集成方式 |

## 6. 快速开始

```typescript
import { socialGraphService } from '@/services/socialGraph';

// 1) 关注
await socialGraphService.follow('user_a', 'user_b', {
  platformId: 'weibo',
});

// 2) 查询粉丝
const followers = await socialGraphService.getFollowers('user_b', {
  platformId: 'weibo',
  limit: 20,
});

// 3) 获取推荐关注
const recommendations = await socialGraphService.getRecommendedFollows('user_a', {
  platformId: 'weibo',
  limit: 10,
});

// 4) 监听关系变更
const off = socialGraphService.onRelationChange((event) => {
  console.log(event.type, event.fromId, '->', event.toId);
});

off();
```

## 7. 核心 API 概览

| 方法 | 说明 |
| ---- | ---- |
| `follow(fromId, toId, options)` | 创建关注关系 |
| `unfollow(fromId, toId, platformId)` | 取消关注关系 |
| `block(fromId, toId, options?)` | 拉黑目标账号 |
| `mute(fromId, toId, options?)` | 静音目标账号 |
| `getFollowers(accountId, options?)` | 分页查询粉丝列表 |
| `getFollowing(accountId, options?)` | 分页查询关注列表 |
| `getMutualFollows(accountId, options?)` | 查询互关账号 |
| `isFollowing(fromId, toId, platformId)` | 判断是否关注 |
| `getRelationshipStats(accountId, platformId)` | 查询关系统计 |
| `getRecommendedFollows(accountId, options)` | 获取关注推荐 |
| `batchFollow(fromId, toIds, options)` | 批量关注 |
| `onRelationChange(callback)` | 监听关系事件 |

## 8. 当前实现进展

| 模块 | 状态 | 说明 |
| ---- | ---- | ---- |
| 核心类型与接口 | ✅ 已完成 | `src/types/socialGraph.ts` |
| 关系写入与查询 | ✅ 已完成 | follow/unfollow/block/mute + 分页查询 |
| 关系统计与事件 | ✅ 已完成 | stats 聚合 + `social:*` 事件广播 |
| 推荐引擎 v1 | ✅ 已完成 | 基于二度关系与共同关注/粉丝 |
| Feed 默认接入 | ✅ 已完成 | `FeedService` 默认 `SystemContentProvider` 使用 Social Graph |
| 测试覆盖 | ✅ 已完成 | `src/services/socialGraph/__tests__/socialGraphService.test.ts` |

## 9. 下一步建议

1. 在 Feed/Fans 侧增加基于 `social:relation:*` 的缓存失效策略
2. 将历史 App 内关系写路径逐步切换到 `SocialGraphService`
3. 追加推荐策略（互动相似度、主题相似度、平台特征加权）

## 10. 相关文档

- [社交内容平台系统服务架构](../architecture/Service-for-social-media-platform.md)
- [账号服务](../account-service/README.md)
- [互动服务](../interaction-service/README.md)
- [粉丝服务](../fans-service/README.md)
- [事件总线服务](../eventBus-service/README.md)
- [服务开发指南](../service-development-guide.md)
