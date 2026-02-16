# 热搜服务 (Trending Service)

> **状态**: ✅ v1.0 已实现，兼容迁移中（从微博 `TrendService` 抽取）  
> **版本**: v1.1  
> **优先级**: 🟡 中（高性价比优先项）  
> **最后更新**: 2026-02-07

## 1. 概述

Trending Service 是系统级热点管理服务，负责跨平台的热搜话题生成、排序、共享和按需内容填充。

当前已完成系统服务抽取，核心入口位于 `src/services/trending/`。旧入口 `src/services/social/trendService.ts` 继续保留，作为兼容层代理到新服务，支持渐进迁移。

## 2. 核心能力

- 热搜生成：将世界事件转换为平台话题
- 热度排序：基于 `TrafficEngine` 实时计算热度
- 平台配置：按平台配置榜单长度、分类、刷新策略
- 共享策略：控制热搜是否对其他 App 可见
- 惰性内容：点击话题时按需生成帖子内容
- 事件广播：热搜变更通过 Event Bus 广播

## 3. 设计目标

| 维度 | 目标 |
| ---- | ---- |
| 跨平台复用 | 微博/B站/知乎使用同一套热搜服务接口 |
| 解耦 | App 侧不再直接依赖 `social/trendService.ts` 内部细节 |
| 可配置 | 平台参数配置化，避免硬编码 |
| 可观测 | 热搜更新、共享读取、内容填充有日志与事件 |
| 渐进迁移 | 保留兼容层，支持从旧 API 平滑迁移 |

## 4. 文档索引

| 文档 | 说明 |
| ---- | ---- |
| [架构设计](./architecture.md) | 组件划分、数据流、存储模型 |
| [API 参考](./api-reference.md) | 接口定义、方法说明、事件契约 |
| [使用示例](./usage.md) | App 调用、配置注册、共享场景 |
| [系统集成](./integration.md) | 与 Director/Feed/EventBus 等服务联动 |
| [迁移方案](./migration.md) | 从 `TrendService` 抽取的分阶段计划 |

## 5. 快速开始（当前 API）

```typescript
import { trendingService } from '@/services/trending';

// 1) 注册平台配置
trendingService.registerPlatformConfig('weibo', {
  maxItems: 50,
  categories: ['娱乐', '社会', '科技', '体育'],
  refreshInterval: 5 * 60 * 1000,
  hotThreshold: 10000,
  allowSponsored: true,
});

// 2) 获取热搜榜
const list = await trendingService.getTrending('weibo', {
  limit: 20,
  category: '科技',
});

// 3) 点击话题时确保有内容
await trendingService.ensureTopicContent(list[0].id);
```

## 6. 当前实现映射

- 系统服务入口：`src/services/trending/trendingService.ts`
- 模块导出：`src/services/trending/index.ts`
- 类型定义：`src/services/trending/types.ts`
- 兼容层：`src/services/social/trendService.ts`（内部代理到新服务）
- 惰性加载：`src/services/social/topicContentLoader.ts`
- 服务总导出：`src/services/index.ts`

迁移策略保持不变：优先保证微博现有行为不变，再逐步将调用方切换到 `@/services/trending`。

## 7. 相关文档

- [社交平台服务架构总览](../architecture/Service-for-social-media-platform.md)
- [社交引擎 TrendService 文档](../social-media-engine/trend-service.md)
- [服务开发指南](../service-development-guide.md)
