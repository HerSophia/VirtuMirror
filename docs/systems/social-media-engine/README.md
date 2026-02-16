# 社交媒体模拟引擎 - 服务文档

> 本目录包含社交媒体模拟引擎 (Social Media Engine) 各服务模块的详细文档。
>
> 引擎概述文档请参阅: [social-media-engine.md](../social-media-engine.md)

## 服务模块列表

| 服务 | 文档 | 代码位置 | 说明 |
| ------ | ------ | ---------- | ------ |
| **TrendService** | [trend-service.md](./trend-service.md) | `trendService.ts` | 热搜话题管理、惰性内容填充 |
| **TrafficEngine** | [traffic-engine.md](./traffic-engine.md) | `algorithm.ts` | 热度计算、互动概率算法 |
| **ContentFactory** | [content-factory.md](./content-factory.md) | `contentFactory.ts` | LLM 内容生成、JSON 解析修复 |
| **DirectorService** | [director-service.md](./director-service.md) | `directorService.ts` | 世界事件导演、自动热搜生成 |
| **PlatformRegistry** | [platform-registry.md](./platform-registry.md) | `registry.ts` | 平台配置管理、提示词注册 |
| **Prompts** | [prompts.md](./prompts.md) | `prompts.ts` | 社交引擎专用提示词定义 |

## 架构概览

```text
┌─────────────────────────────────────────────────────────────────┐
│                        应用层 (Skins)                            │
│     微博 App  │  B站 App  │  知乎 App  │  小红书 App  │ ...      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Social Media Engine (Core)                     │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ TrendService │◄───│DirectorService│───►│ContentFactory│       │
│  │  (热搜管理)   │    │  (世界导演)   │    │  (内容生成)  │       │
│  └──────┬───────┘    └──────────────┘    └──────┬───────┘       │
│         │                                        │               │
│         ▼                                        ▼               │
│  ┌──────────────┐                        ┌──────────────┐       │
│  │TrafficEngine │                        │PlatformRegistry│      │
│  │  (热度算法)   │                        │  (平台配置)   │       │
│  └──────────────┘                        └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        基础服务层                                 │
│   TimeService  │  AIGenerateService  │  PromptService  │ DB     │
└─────────────────────────────────────────────────────────────────┘
```

## 数据流向

### 1. 世界事件 → 热搜话题

```text
TimeService.tick
    │
    ▼
DirectorService.onTick()
    │ (检查时间间隔)
    ▼
DirectorService.generateGlobalEvent()
    │ (调用 LLM)
    ▼
TrendService.createTopicFromEvent()
    │
    ▼
IndexedDB.socialTopics
```

### 2. 用户查看热搜 → 内容填充

```text
用户打开微博
    │
    ▼
WeiboStore.getTrendingList()
    │
    ▼
TrendService.getTrendingList()
    │ (实时计算热度)
    ▼
TrafficEngine.calculateTopicHeat()
    │
    ▼
返回排序后的热搜榜


用户点击某话题
    │
    ▼
TrendService.ensureTopicContent()
    │ (检查是否有内容)
    ▼
ContentFactory.generatePost()
    │ (调用 LLM)
    ▼
IndexedDB.socialPosts
```

## 快速导航

### 按功能查找

- **热搜管理**: [TrendService](./trend-service.md)
- **热度计算**: [TrafficEngine](./traffic-engine.md)
- **内容生成**: [ContentFactory](./content-factory.md)
- **自动事件**: [DirectorService](./director-service.md)
- **平台配置**: [PlatformRegistry](./platform-registry.md)
- **提示词**: [Prompts](./prompts.md)

### 按调用关系查找

- 谁调用 LLM？→ [ContentFactory](./content-factory.md), [DirectorService](./director-service.md)
- 谁计算热度？→ [TrafficEngine](./traffic-engine.md)
- 谁管理平台？→ [PlatformRegistry](./platform-registry.md)
- 谁生成话题？→ [TrendService](./trend-service.md)

## 相关文档

| 文档 | 说明 |
| ------ | ------ |
| [social-media-engine.md](../social-media-engine.md) | 引擎总体设计 |
| [account-service.md](../account-service.md) | 账号系统（UserPool 所在） |
| [架构概览](../architecture/Service-for-social-media-platform.md) | 社交平台系统服务架构 |

## 版本历史

| 版本 | 日期 | 变更内容 |
| ------ | ------ | ---------- |
| 1.0 | 2026-01-16 | 创建服务文档目录，包含 6 个服务模块文档 |
