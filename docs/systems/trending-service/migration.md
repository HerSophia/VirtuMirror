# Trending Service 迁移方案

> 目标：从 `src/services/social/trendService.ts` 抽取系统级 `Trending Service`，保证微博功能无回归。

## 1. 迁移范围

### 1.1 现有能力来源

- `src/services/social/trendService.ts`
- `src/services/social/topicContentLoader.ts`
- `src/services/social/algorithm.ts` (`TrafficEngine`)

### 1.2 迁移后目标目录

```text
src/services/trending/
  index.ts
  trendingService.ts
  platformConfigRegistry.ts
  sharePolicyManager.ts
  eventBridge.ts
```

## 2. 分阶段计划

| 阶段 | 目标 | 产出 | 状态 | 风险控制 |
| ---- | ---- | ---- | ---- | ---- |
| Phase 1 | 建立新服务骨架与接口 | `trendingService.ts` + `types.ts` | ✅ 已完成 | 保留旧 `TrendService` 兼容层 |
| Phase 2 | 迁移榜单查询与话题创建 | `getTrending` / `createFromEvent` | ✅ 已完成 | 旧入口反向代理到新服务 |
| Phase 3 | 迁移共享策略与事件桥接 | `setSharePolicy` / `onTrendingUpdate` | ✅ 已完成 | 事件通过 `eventBridge` 发出 |
| Phase 4 | App 侧切换入口 | Weibo Store 改用新服务 | 🔄 进行中 | 保留旧 API 别名 1 个迭代周期 |

### 2.1 当前进度快照

- 已落地代码：`src/services/trending/trendingService.ts`
- 配置与策略组件：`src/services/trending/platformConfigRegistry.ts`、`src/services/trending/sharePolicyManager.ts`
- 事件桥接：`src/services/trending/eventBridge.ts`
- 统一导出：`src/services/trending/index.ts`、`src/services/index.ts`
- 兼容入口：`src/services/social/trendService.ts`（内部代理到新服务）

## 3. 方法映射

| 旧方法 | 新方法 | 说明 |
| ---- | ---- | ---- |
| `createTopicFromEvent(event)` | `createFromEvent(event)` | 命名统一，支持 `CreateOptions` |
| `getTrendingList(platformId, limit)` | `getTrending(platformId, { limit })` | 扩展查询参数 |
| `ensureTopicContent(topicId)` | `ensureTopicContent(topicId)` | 保持一致 |
| `preloadTopics(topicIds)` | `preloadTopicContent(topicIds)` | 命名语义化 |
| `getLoaderStats()` | `getLoaderStats()` | 当前保留原方法名，避免破坏性迁移 |

## 4. 兼容策略

- 保留旧入口 `src/services/social/trendService.ts`，并在内部委托 `getTrendingService()`。
- 新能力统一在 `@/services/trending` 暴露；旧入口仅保证兼容，不扩展新语义。
- 在迁移期允许新旧入口并存，待 App 调用完成切换后再清理旧入口。

## 5. 验收清单

- [x] 微博热搜刷新、点击、内容生成流程与现状一致（回归用例通过）
- [x] 新增平台配置后无需改 App 代码即可生效
- [x] `content:trending:updated` 事件可被 Store 正常订阅
- [x] 迁移后无重复生成、无明显热搜排序波动
- [ ] Weibo Store 全量改为直接依赖 `@/services/trending`

## 6. 回滚方案

- 保留旧 `TrendService` 兼容入口一个版本周期
- 新入口出现异常时可切换回旧入口（通过服务导出开关）
- 迁移期间不改动数据库结构，避免数据回滚成本
