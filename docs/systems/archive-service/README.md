# 档案服务 (Archive Service)

> **版本**: 1.0  
> **状态**: MVP 已实现（服务层 + 最小集成层）  
> **最后更新**: 2026-02-08  
> **依赖**: AccountService, AIGenerateService, TimeService, IndexedDB (Dexie)

## 1. 概述

**档案服务**是一个知识库与记忆系统服务，负责从酒馆聊天记录和社交媒体内容中提取、归档和管理结构化信息。它充当角色扮演世界的「长期记忆」，解决 LLM 上下文窗口有限、聊天记录难以回顾、跨会话记忆困难等问题。

### 1.1 核心能力

```typescript
interface ArchiveService {
  // === 档案 CRUD ===
  getArchive(id: string): Promise<ArchiveBase>;
  saveArchive(archive: ArchiveBase): Promise<void>;
  deleteArchive(id: string): Promise<void>;
  queryArchives(filter: ArchiveFilter): Promise<ArchiveBase[]>;
  
  // === 知识注入系统（核心能力）===
  getInjection(request: InjectionRequest): Promise<InjectionResult>;
  getPinnedArchives(sessionId: string): Promise<ArchiveBase[]>;  // always 级别
  matchByKeywords(keywords: string[], sessionId: string): Promise<ArchiveBase[]>;
  
  // === 账号绑定 ===
  bindToAccount(archiveId: string, accountId: string): Promise<void>;
  unbindFromAccount(archiveId: string, accountId: string): Promise<void>;
  getAccountArchives(accountId: string): Promise<ArchiveBase[]>;
  
  // === 去重服务 ===
  deduplication: ArchiveDeduplicationService;
  
  // === 提取服务（LLM）===
  extractFromChat(floors: FloorData[], options?: ExtractOptions): Promise<ExtractResult>;
}
```

### 1.2 设计原则

1. **会话绑定**：档案与聊天会话（Session）强绑定，不同角色/世界观的档案完全隔离
2. **自动化优先**：定期触发 AI 总结，减少手动整理负担
3. **用户确认**：自动化归档需要用户确认，因为酒馆叙事可能尚未确定（如 swipe 切换）
4. **知识注入**：档案内容可作为变量注入到其他 App 的提示词中，提升 AI 生成的一致性
5. **账号联动**：档案可绑定社交账号，为账号提供持久的角色背景

### 1.3 解决的痛点

| 现状问题 | 档案服务的解决方案 |
| --------- | ------------------- |
| 酒馆聊天记录长了难以回顾 | 自动提取关键事件，生成时间线 |
| 社交引擎产生的内容分散 | 归档整合，形成「世界大事记」 |
| 跨会话记忆困难 | 持久化的角色/世界知识库 |
| LLM 上下文窗口有限 | 压缩总结，作为 Prompt 变量源 |
| 角色设定容易遗忘/矛盾 | 角色档案实时更新，保持一致性 |
| 社交账号生成内容不一致 | 档案绑定账号，注入角色背景 |
| 核心世界观需反复说明 | 标记为「始终注入」，自动加入系统提示词 |

---

## 2. 架构概览

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           输入源 (Input Sources)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │Socket Bridge│  │Social Engine│  │  用户手动   │                       │
│  │  楼层数据    │  │ 微博/事件   │  │  补充信息   │                       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                       │
└─────────┼────────────────┼────────────────┼──────────────────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        档案服务 (Archive Service)                         │
│                                                                          │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐ │
│  │ Archive Extractor│────▶│  Data Processor  │────▶│   IndexedDB      │ │
│  │   (LLM 提取)     │     │   (数据处理)      │     │   (持久化)       │ │
│  └──────────────────┘     └──────────────────┘     └────────┬─────────┘ │
│                                                              │          │
│  ┌──────────────────┐     ┌──────────────────┐              │          │
│  │ Injection System │◀────│ Deduplication    │◀─────────────┘          │
│  │   (注入系统)      │     │   (去重服务)      │                         │
│  └────────┬─────────┘     └──────────────────┘                         │
└───────────┼────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           输出 (Output)                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │{{coreKnowledge}} │  │{{accountContext}}│  │{{relevantArchives}}│     │
│  │  系统提示词       │  │  Content Factory │  │   提示词链        │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 档案类型

档案服务管理以下类型的结构化信息：

| 类型 | 标识 | 说明 | 来源 |
| ---- | ---- | ---- | ---- |
| **事件档案** | `event` | 聊天中的关键事件 | 聊天提取 |
| **事件子类型** | `event.subType` | `plot` / `dialogue` / `discovery` / `decision` | 聊天提取 |
| **角色档案** | `character` | 动态维护的角色信息 | 角色卡/聊天提取 |
| **世界设定** | `world` | 世界观相关设定 | 世界书/聊天提取 |

---

## 4. 注入级别

档案可配置不同的注入级别，控制何时将内容注入到 LLM 提示词中：

| 级别 | 标识 | 触发时机 | 典型用途 | Token 预算 |
| ---- | ---- | -------- | -------- | ---------- |
| **始终注入** | `always` | 每次 LLM 调用 | 核心世界观、主要角色设定、重要规则 | 500 |
| **上下文匹配** | `contextual` | 关键词命中时 | 次要角色、地点、历史事件 | 400 |
| **不注入** | `none` | 不自动注入 | 纯归档记录、已过时信息 | 0 |

---

## 5. 快速开始

### 5.1 获取档案

```typescript
import { archiveService } from '@/services';

// 获取单个档案
const archive = await archiveService.getArchive('archive_123');

// 查询档案
const events = await archiveService.queryArchives({
  sessionId: 'session_abc',
  type: 'event',
  importance: 'critical',
});
```

### 5.2 知识注入

```typescript
// 获取注入内容
const injection = await archiveService.getInjection({
  sessionId: currentSessionId,
  scene: 'social.post.generate',
  accountId: account?.id,
  keywords: ['魔法学院', '导师'],
  maxTotalTokens: 800,
});

// 在提示词中使用
const prompt = `
${injection.coreKnowledge}

${injection.accountContext}

相关背景：
${injection.relevantArchives}
`;
```

### 5.3 账号绑定

```typescript
// 将角色档案绑定到社交账号
await archiveService.bindToAccount('character_eileen', 'account_weibo_123');

// 获取账号绑定的所有档案
const accountArchives = await archiveService.getAccountArchives('account_weibo_123');
```

---

## 6. 文档索引

| 文档 | 说明 |
| ---- | ---- |
| [数据模型](./data-models.md) | 档案类型定义、字段说明 |
| [注入系统](./injection-system.md) | 知识注入机制、变量注册表 |
| [提取服务](./extraction-service.md) | LLM 提取、提示词链 |
| [去重机制](./deduplication.md) | 去重规则、滚动窗口 |
| [账号绑定](./account-binding.md) | 账号关联、级联删除 |
| [集成指南](./integration.md) | 与其他服务的集成方式 |

---

## 7. 实现状态

| 功能模块 | 状态 | 说明 |
| -------- | ---- | ---- |
| 数据模型定义 | ✅ 已实现 | `src/types/archive.ts` 与统一导出已落地 |
| 基础 CRUD | ✅ 已实现 | `get/save/delete/query` 与内容哈希自动维护 |
| 注入系统 | ✅ 已实现 | always/account/contextual 收集、排序、截断与格式化 |
| 去重服务 | ✅ 已实现 | ID/语义/时效 3 层去重 + 注入历史记录 |
| LLM 提取（手动） | ✅ 已实现 | `extractFromChat` + JSON Schema 校验 + pending 结果 |
| 账号绑定 | ✅ 已实现 | 双向绑定、事务一致性、删除级联清理 |
| Prompt/ContextSharing 集成 | ✅ 已实现 | 发布 `archive:pinned/relevant/characters` 并由模板消费 |
| 社交链路最小集成 | ✅ 已实现 | `ContentFactory` 发帖/评论注入，预算默认 800/400 |
| 自动提取调度（v1.1） | 🟡 规划中 | 基于 Bridge 事件阈值提醒，待增强层落地 |

---

## 8. 参考文档

- [档案 App 设计](../../apps/archives.md) - UI 层设计
- [服务架构总览](../architecture/Service-for-social-media-platform.md) - 系统服务全景
- [账号服务](../account-service/README.md) - 账号管理
- [LLM 任务服务](../llm-task-service/README.md) - 提取任务执行
