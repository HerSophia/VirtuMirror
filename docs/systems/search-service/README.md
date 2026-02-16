# 搜索服务 (Search Service)

> **状态**: 📋 设计完成，MVP 待实现（L1/L2 + 增量索引 + Suggest）  
> **版本**: v1.1  
> **优先级**: 🟡 中（跨 App 基础能力）  
> **最后更新**: 2026-02-08

## 1. 概述

Search Service 是系统级检索能力中心，负责为微博、Archive、账号、后续 IM 等模块提供统一搜索接口。

当前目标不是一次做全，而是先落地高复用 MVP：

- L1 精确匹配（ID/用户名/标识符）
- L2 全文搜索（分词 + 倒排索引）
- 索引增量更新（新增/更新/删除）
- 搜索建议（suggest，前缀补全）

## 2. 目标与边界

| 维度 | 目标 |
| ---- | ---- |
| 跨服务复用 | 一套 API 支撑 Feed、Archive、Social Graph、IM 等查询需求 |
| 低耦合接入 | 业务方只负责产出可索引文档，不关心索引内部实现 |
| 渐进增强 | MVP 先做 L1/L2，L3/L4 在后续阶段按需开启 |
| 可观测 | 搜索耗时、命中率、索引变更有日志和统计 |

| Search Service 负责 | Search Service 不负责 |
| ---- | ---- |
| 查询解析、过滤、排序、分页 | 业务对象的最终展示组装 |
| 索引构建与维护 | 业务数据源的 CRUD |
| 搜索建议生成 | 推荐系统个性化排序 |

## 3. 文档索引

| 文档 | 说明 |
| ---- | ---- |
| [架构设计](./architecture.md) | 组件划分、数据流、索引模型 |
| [类型定义](./types.md) | 查询、结果、索引和服务接口类型 |
| [使用示例](./usage.md) | 搜索、索引、建议、重建索引示例 |
| [系统集成](./integration.md) | 与 Social/Account/Archive/Feed 的集成 |
| [搜索策略](./search-strategies.md) | L1-L4 策略说明与演进路径 |

## 4. 快速开始（目标 API）

```typescript
import { searchService } from '@/services/search';

await searchService.index({
  id: 'post_123',
  type: 'post',
  content: '今天的科技发布会讨论了芯片和影像升级',
  metadata: {
    platformId: 'weibo',
    authorId: 'acc_001',
    timestamp: Date.now(),
    tags: ['科技', '发布会'],
  },
});

const result = await searchService.search({
  text: '科技发布会',
  type: 'post',
  filters: [{ field: 'platformId', operator: 'eq', value: 'weibo' }],
  pagination: { offset: 0, limit: 20 },
});

const suggestions = await searchService.suggest('科技', { limit: 5 });
```

## 5. 推荐目录结构（实现目标）

```text
src/services/search/
├── searchService.ts         # 服务入口（单例）
├── queryProcessor.ts        # 查询解析与执行编排
├── indexRepository.ts       # 索引读写与持久化
├── tokenizer.ts             # 分词器（中英文）
├── ranking.ts               # 相关性打分（TF-IDF/BM25-lite）
├── suggestionEngine.ts      # 前缀建议
├── types.ts                 # 模块内部类型
└── index.ts                 # 模块导出
```

## 6. 实施路线图（1-2 周 MVP）

| Phase | 内容 | 预估 |
| ---- | ---- | ---- |
| Phase 1 | 类型定义、索引表结构、基础 index/remove | 1-2d |
| Phase 2 | L1/L2 查询链路、过滤/排序/分页 | 2-3d |
| Phase 3 | suggest、增量更新、事件接入 | 1-2d |
| Phase 4 | 与微博 + Archive 各接入一个调用点，补测试 | 1-2d |

## 7. 验收标准

- 查询延迟：本地 10k 文档规模下，常见查询 P95 < 120ms
- 召回准确率：核心用例（帖子/账号/话题）Top10 结果可用
- 索引一致性：新增、更新、删除后结果可验证
- 跨服务接入：Feed/Archive 各至少 1 个稳定调用点

## 8. 相关文档

- [社交内容平台系统服务架构](../architecture/Service-for-social-media-platform.md)
- [Feed 服务](../feed-service/README.md)
- [Archive 服务](../archive-service/README.md)
- [Social Graph 服务](../social-graph-service/README.md)
- [服务开发指南](../service-development-guide.md)

## 9. 版本历史

| 版本 | 日期 | 变更 |
| ---- | ---- | ---- |
| v1.0 | 2026-01-16 | 初始设计文档 |
| v1.1 | 2026-02-08 | 按系统服务文档结构重写，收敛到 Search MVP 范围 |
