# Trending Service 架构设计

> **版本**: v1.0  
> **最后更新**: 2026-02-07

## 1. 整体架构

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           应用层 (App Skins)                             │
│   Weibo / Bilibili / Zhihu / Forum / ...                               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Trending Service (Core)                           │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ TopicLifecycle   │  │ RankingEngine    │  │ PlatformConfigReg    │  │
│  │ 话题生命周期管理    │  │ 热度排序聚合       │  │ 平台配置注册表         │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ SharePolicyMgr   │  │ TopicContentGate │  │ TrendingEventBridge  │  │
│  │ 共享策略控制       │  │ 惰性内容填充       │  │ 事件发布/订阅桥接       │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
          ┌─────────────────────┼──────────────────────┬─────────────────┐
          ▼                     ▼                      ▼                 ▼
   TrafficEngine         ContentFactory          IndexedDB         EventBus/Logger
  (热度计算算法)           (内容生成)              socialTopics      (事件与可观测)
                                                socialPosts
```

## 2. 组件职责

### 2.1 TopicLifecycle

- 接收 `WorldEvent` 并创建 `TrendingTopic`
- 处理话题创建、更新、归档
- 管理 `isNew`、`isHot` 的运行时状态

### 2.2 RankingEngine

- 使用 `TrafficEngine.calculateTopicHeat` 计算实时热度
- 按平台配置执行排序、过滤和截断
- 输出统一榜单项

### 2.3 PlatformConfigRegistry

- 存储平台配置（榜单长度、分类、阈值、刷新间隔）
- 支持默认配置和平台覆盖配置
- 为 Feed/Trending 统一提供热点参数来源

### 2.4 SharePolicyManager

- 决定平台热搜是否可被其他 App 读取
- 支持 `allowedConsumers` 白名单和分类排除
- 为跨 App 的热搜聚合提供权限控制

### 2.5 TopicContentGateway

- 复用 `topicContentLoader` 的惰性填充能力
- 统一暴露 `ensureTopicContent` 与预加载能力
- 记录生成命中率、并发负载等指标

### 2.6 TrendingEventBridge

- 发布 `content:trending:updated`、`trending:topic:created` 等事件
- 供通知、Feed、Context Sharing 等服务订阅
- 与 Logger Service 集成，记录关键链路日志

## 3. 关键数据流

### 3.1 世界事件生成热搜

1. DirectorService 产出 `WorldEvent`
2. Trending Service 创建一组平台话题
3. 写入 `socialTopics`
4. 发布 `trending:topic:created`

### 3.2 App 刷新热搜榜

1. App 调用 `getTrending(platformId, options)`
2. RankingEngine 查询并计算实时热度
3. 应用平台配置与分类过滤
4. 返回榜单并按需触发 `content:trending:updated`

### 3.3 用户点击话题

1. App 调用 `ensureTopicContent(topicId)`
2. TopicContentGateway 走惰性加载（缓存命中则直接返回）
3. 缺失内容时调用 ContentFactory 生成帖子并落库
4. 返回内容并更新统计指标

## 4. 存储模型

| 表 | 说明 | 核心字段 |
| ---- | ---- | ---- |
| `socialTopics` | 热搜话题表 | `id`, `platformId`, `keyword`, `baseScore`, `createdAt`, `peakTime` |
| `socialPosts` | 话题内容表 | `id`, `platformId`, `topicTags`, `authorId`, `timestamp` |

建议索引：

- `socialTopics.[platformId+createdAt]`
- `socialTopics.createdAt`
- `socialPosts.topicTags`

## 5. 可扩展点

- 热度策略扩展：支持平台特定打分修正
- 分类策略扩展：支持动态分类映射
- 共享策略扩展：支持按会话上下文可见性控制
- 榜单类型扩展：支持 `hot`, `rising`, `local`, `friends` 多榜单

## 6. 非目标（v1）

- 不引入向量语义热搜聚类
- 不实现广告竞价系统
- 不替代 Feed Service 的个性化排序能力
