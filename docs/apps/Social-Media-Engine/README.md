# 社交媒体模拟引擎 (Social Media Engine)

## 概述

社交媒体模拟引擎（Social Media Engine, SME）是一个与具体 App 解耦的通用内容生成与模拟框架。它的核心目标是构建一个"自律运行"的虚拟互联网环境，不仅能响应用户的聊天互动（反应式），还能自主产生热点事件与社会舆论（自发式）。

### 核心理念

1. **引擎与皮肤分离**：微博、B站、知乎等 App 仅作为"渲染器"（Skin），共享底层的流量算法、用户池与内容生成逻辑（Core）
2. **双驱动架构**：内容源既来自用户的角色扮演聊天（Chat Bridge），也来自后台自主运行的世界导演（Director Service）
3. **真实感量化**：通过数值算法而非纯 LLM 生成来控制热度、排名与交互概率，模拟真实的互联网"沉默"与"爆发"
4. **多账号矩阵**：支持名人/官方号的跨平台矩阵运营，同时允许普通用户（玩家）的多重身份扮演

### 当前状态

> **版本**: 1.5  
> **状态**: Phase 1-5 已实现  
> **依赖**: TimeService, AIGenerateService, IndexedDB (Dexie), PromptService, AccountService

## 文档导航

| 文档 | 说明 |
| ---- | ---- |
| [架构设计](architecture.md) | 系统架构、数据流向与服务依赖 |
| [内容类型系统](content-types.md) | 统一的跨平台内容数据模型 |
| [核心服务](services.md) | TrendService、ContentFactory、DirectorService 等 |
| [提示词系统](prompt-system.md) | 分层提示词架构与模板定义 |
| [数据模型](data-models.md) | UniversalPost、UniversalComment、TrendingTopic 等 |
| [提示词链](prompt-chains.md) | 声明式多步骤 LLM 编排机制 |
| [开发指南](development-guide.md) | 如何扩展新平台、自定义提示词 |

## 快速开始

### 目录结构

```text
src/apps/social-engine/           # 社交引擎配置 App（UI）
├── components/
│   ├── EngineHeader.vue          # 页面头部
│   ├── PlatformCard.vue          # 平台卡片
│   ├── StatCard.vue              # 统计卡片
│   └── index.ts
├── views/
│   ├── OverviewTab.vue           # 概览标签页
│   ├── PlatformsTab.vue          # 平台管理
│   ├── DirectorTab.vue           # 导演服务配置
│   ├── AlgorithmTab.vue          # 算法调参
│   ├── UsersTab.vue              # 用户池管理
│   └── index.ts
├── SocialEngineApp.vue           # 主入口组件
├── manifest.ts                   # App 清单
├── types.ts                      # 本地类型
└── index.ts                      # 导出入口

src/services/social/              # 社交引擎核心服务
├── algorithm.ts                  # 热度算法引擎 (TrafficEngine)
├── contentFactory.ts             # 内容生成工厂
├── directorService.ts            # 世界导演服务
├── prompts.ts                    # 提示词定义 (socialEnginePrompts)
├── registry.ts                   # 平台注册表
├── trendService.ts               # 热搜管理
└── userPool.ts                   # [已废弃] 旧用户池，向后兼容

src/services/account/             # 账号系统服务
├── accountService.ts             # 账号服务
├── userPool.ts                   # 用户生成器（新）
├── migrateSocialAccounts.ts      # 迁移工具
└── index.ts                      # 导出入口

src/types/
├── social.ts                     # 社交内容类型
└── account.ts                    # 账号类型
```

### 核心服务

| 服务 | 文件 | 职责 |
| ---- | ---- | ---- |
| `TrendService` | `trendService.ts` | 热搜管理、话题生成、惰性内容填充 |
| `DirectorService` | `directorService.ts` | 后台静默线程，基于 TimeService 生成世界事件 |
| `ContentFactory` | `contentFactory.ts` | LLM 交互封装、博文/评论生成、JSON 修复 |
| `TrafficEngine` | `algorithm.ts` | 热度计算、交互概率计算（静态方法） |
| `PlatformRegistry` | `registry.ts` | 平台配置管理、提示词自动注册 |
| `UserPool` | `account/userPool.ts` | 用户档案生成、随机路人生成 |
| `AccountService` | `account/accountService.ts` | 统一账号管理 |

### 基本用法

```typescript
import { TrendService } from '@/services/social/trendService';
import { ContentFactory } from '@/services/social/contentFactory';
import { TrafficEngine } from '@/services/social/algorithm';
import { accountService } from '@/services/account';

// 获取热搜列表
const trendService = TrendService.getInstance();
const hotList = await trendService.getTrendingList('weibo');

// 计算热度（静态方法）
const heat = TrafficEngine.calculateTopicHeat(topic, Date.now());
const formatted = TrafficEngine.formatHeat(heat); // "234.5万"

// 生成博文
const factory = ContentFactory.getInstance();
const post = await factory.generatePost('weibo', topic, account);

// 创建账号
const entity = await accountService.createEntity({
  type: 'npc',
  displayName: '路人甲',
  scope: 'session',
  source: 'social',
});
```

## 支持的平台

| 平台 ID | 名称 | 状态 | 说明 |
| ------- | ---- | ---- | ---- |
| `weibo` | 微博 | ✅ 已实现 | 完整的热搜、博文、评论系统 |
| `bilibili` | B站 | 📋 规划中 | 动态、视频、弹幕 |
| `zhihu` | 知乎 | 📋 规划中 | 问答、文章、想法 |
| `redbook` | 小红书 | 📋 规划中 | 笔记、图文 |

## 开发计划

### 已完成

* [x] **Phase 1**: 统一 payload 结构（PrimaryContentType、ContentFlags、MediaAsset）
* [x] **Phase 2**: 社交引擎迁移到新账号系统
* [x] **Phase 3**: 消除 UI 类型（DisplayPost 统一展示层）
* [x] **Phase 4**: 提示词适配重构（postTransformer）
* [x] **Phase 5**: 解析器分发架构（ContentDispatcher）

### 待开发

* [ ] **Phase 6**: 图片生成对接
* [ ] **Phase 7**: 更多平台皮肤（B站、知乎）
* [ ] **Phase 8**: 档案系统深度集成

## 相关文档

* [微博 App](../Weibo/README.md) - 社交引擎的首个前端实现
* [账号服务](../../systems/account-service.md) - 统一账号管理
* [涨粉引擎](../../systems/follower-growth-engine.md) - 粉丝增长模拟
