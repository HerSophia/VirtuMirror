# 档案 App (Archives)

> **版本**: 2.0
> **状态**: 设计阶段
> **依赖**: Socket Bridge, PromptChainService, NotificationService, TimeService, IndexedDB (Dexie), AccountService

## 1. 概述

**档案 App** 是一个知识库与记忆系统，用于从酒馆聊天记录和社交媒体内容中提取、归档和管理结构化信息。它充当角色扮演世界的"长期记忆"，解决 LLM 上下文窗口有限、聊天记录难以回顾、跨会话记忆困难等问题。

### 1.1 核心理念

1. **会话绑定**：档案与聊天会话（Session）强绑定，不同角色/世界观的档案完全隔离
2. **自动化优先**：定期触发 AI 总结，减少手动整理负担
3. **用户确认**：自动化归档需要用户确认，因为酒馆叙事可能尚未确定（如 swipe 切换）
4. **知识注入**：档案内容可作为变量注入到其他 App 的提示词中，提升 AI 生成的一致性
5. **账号联动**：档案可绑定社交账号，为账号提供持久的角色背景

### 1.2 解决的痛点

| 现状问题 | 档案 App 的解决方案 |
| --------- | ------------------- |
| 酒馆聊天记录长了难以回顾 | 自动提取关键事件，生成时间线 |
| 社交引擎产生的内容分散 | 归档整合，形成"世界大事记" |
| 跨会话记忆困难 | 持久化的角色/世界知识库 |
| LLM 上下文窗口有限 | 压缩总结，作为 Prompt 变量源 |
| 角色设定容易遗忘/矛盾 | 角色档案实时更新，保持一致性 |
| 社交账号生成内容不一致 | 档案绑定账号，注入角色背景 |
| 核心世界观需反复说明 | 标记为"始终注入"，自动加入系统提示词 |

---

## 2. 架构设计

### 2.1 整体架构图

```mermaid
graph TD
    subgraph "Input Sources"
        Bridge[Socket Bridge] -->|楼层数据| Extractor
        Social[Social Engine] -->|微博/事件| Extractor
        Manual[用户手动] -->|补充信息| Extractor
    end

    subgraph "Archive Service"
        Extractor[Archive Extractor] -->|提示词链| LLM[AIGenerate Service]
        LLM -->|结构化数据| Processor[Data Processor]
        
        Processor -->|写入| DB[(IndexedDB)]
        Processor -->|生成| Keywords[关键词系统]
        
        Scheduler[Auto Scheduler] -->|触发| Extractor
        Scheduler -->|通知| Notify[Notification Service]
    end

    subgraph "Injection System"
        DB -->|always 级别| CorePool[核心知识池]
        DB -->|账号绑定| AccountBinding[账号档案绑定]
        DB -->|contextual| KeywordMatch[关键词匹配]
        
        CorePool --> Dedup[去重服务]
        AccountBinding --> Dedup
        KeywordMatch --> Dedup
        
        Dedup --> Variables[变量注册表]
    end

    subgraph "Output"
        Variables -->|{{coreKnowledge}}| SystemPrompt[系统提示词]
        Variables -->|{{accountContext}}| ContentFactory[Content Factory]
        Variables -->|{{relevantArchives}}| PromptChain[提示词链]
        DB -->|查询| UI[Archive App UI]
    end
```

### 2.2 目录结构

```text
src/apps/archives/
├── ArchivesApp.vue              # 主应用入口
├── index.ts                     # 模块导出
├── components/
│   ├── ArchiveCard.vue          # 档案卡片
│   ├── TimelineView.vue         # 时间线视图
│   ├── KeywordTag.vue           # 关键词标签
│   ├── KeywordEditor.vue        # 关键词编辑器
│   ├── ExtractDialog.vue        # 提取确认对话框
│   ├── SupplementDialog.vue     # 补充信息对话框
│   ├── InjectionLevelSelect.vue # 注入级别选择器
│   ├── AccountBindingEditor.vue # 账号绑定编辑器
│   └── index.ts
├── views/
│   ├── ArchivesHome.vue         # 首页：统计 + 快捷入口
│   ├── EventsList.vue           # 事件档案列表
│   ├── EventDetail.vue          # 事件详情
│   ├── CharactersList.vue       # 角色档案列表
│   ├── CharacterDetail.vue      # 角色详情
│   ├── WorldEntries.vue         # 世界设定列表
│   ├── WorldEntryDetail.vue     # 设定详情
│   ├── Timeline.vue             # 时间线总览
│   ├── KeywordsManager.vue      # 关键词管理
│   ├── PinnedArchives.vue       # 核心知识管理（always 级别）
│   └── SearchResults.vue        # 搜索结果
├── composables/
│   ├── useArchiveExtract.ts     # 提取逻辑
│   ├── useArchiveInjection.ts   # 注入逻辑
│   ├── useKeywords.ts           # 关键词管理
│   └── index.ts
├── prompts.ts                   # 档案相关提示词
└── chains.ts                    # 档案提取链
```

### 2.3 路由设计

| 路径 | 组件 | 说明 |
| :--- | :--- | :--- |
| `/archives` | `ArchivesApp` | 根容器 |
| `/archives/` | `ArchivesHome` | 首页 |
| `/archives/events` | `EventsList` | 事件档案列表 |
| `/archives/events/:id` | `EventDetail` | 事件详情 |
| `/archives/characters` | `CharactersList` | 角色档案列表 |
| `/archives/characters/:id` | `CharacterDetail` | 角色详情 |
| `/archives/world` | `WorldEntries` | 世界设定列表 |
| `/archives/world/:id` | `WorldEntryDetail` | 设定详情 |
| `/archives/timeline` | `Timeline` | 时间线总览 |
| `/archives/keywords` | `KeywordsManager` | 关键词管理 |
| `/archives/pinned` | `PinnedArchives` | 核心知识管理 |
| `/archives/search` | `SearchResults` | 搜索结果 |

---

## 3. 数据模型

### 3.1 档案基础类型 (ArchiveBase)

所有档案类型的公共字段。

```typescript
// src/types/archive.ts

/**
 * 注入级别
 * - none: 不自动注入，仅用于查阅
 * - contextual: 根据关键词匹配注入（默认）
 * - always: 始终注入到系统提示词（核心知识）
 */
type InjectionLevel = 'none' | 'contextual' | 'always';

interface ArchiveBase {
  id: string;
  sessionId: string;              // 关联 Bridge Session
  
  // 注入控制
  injectionLevel: InjectionLevel; // 注入级别
  injectionPriority?: number;     // 同级别内的优先级 (0-100，默认 50)
  
  // 账号绑定
  boundAccountIds?: string[];     // 绑定的社交账号 ID
  
  // 元数据
  keywords: string[];             // 关键词（用于 contextual 匹配）
  lastUpdated: number;
  
  // 去重辅助
  contentHash?: string;           // 内容摘要的哈希，用于语义去重
}
```

### 3.2 事件档案 (ChatArchive)

从聊天记录中提取的关键事件。

```typescript
interface ChatArchive extends ArchiveBase {
  type: 'event' | 'dialogue' | 'discovery' | 'decision';
  
  // 来源追踪
  sourceFloors: FloorReference[]; // 来自哪些楼层
  extractedAt: number;            // 提取时间
  confirmedAt?: number;           // 用户确认时间
  
  // 内容
  title: string;                  // AI 生成的标题
  summary: string;                // 摘要
  keyQuotes?: string[];           // 关键引用原文
  participants: string[];         // 参与者 ID
  
  // 时间线
  inWorldTime?: string;           // 世界观内的时间（如："黄昏时分"）
  inWorldDate?: string;           // 世界观内的日期（如："第三天"）
  realTimestamp: number;          // 真实时间戳
  
  // 元数据
  location?: string;              // 发生地点
  importance: 'critical' | 'major' | 'normal' | 'minor';
  
  // 状态
  status: 'pending' | 'confirmed' | 'rejected';
}

interface FloorReference {
  messageId: number;              // 楼层号
  swipeId: number;                // 消息页 ID
  excerpt?: string;               // 摘录片段
}
```

### 3.3 角色档案 (CharacterProfile)

动态维护的角色信息。

```typescript
interface CharacterProfile extends ArchiveBase {
  // 基础信息
  name: string;
  aliases: string[];              // 别名/昵称
  avatar?: string;                // 头像 URL
  role: 'protagonist' | 'main' | 'supporting' | 'npc';
  
  // 静态信息（从角色卡提取或手动填写）
  baseDescription?: string;       // 基础描述
  
  // 动态信息（从聊天中提取，持续更新）
  traits: string[];               // 性格特点
  abilities?: string[];           // 能力/技能
  knownFacts: FactEntry[];        // 已知事实
  recentActions: ActionEntry[];   // 近期行为（滚动窗口）
  
  // 来源追踪
  source: 'character_card' | 'chat_extract' | 'social_media' | 'manual';
  updateHistory: UpdateRecord[];  // 更新历史
}

interface FactEntry {
  fact: string;
  sourceFloor?: number;
  learnedAt: number;
  confidence: 'certain' | 'likely' | 'uncertain';
}

interface ActionEntry {
  action: string;
  sourceFloor: number;
  timestamp: number;
}

interface UpdateRecord {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  sourceFloor?: number;
  timestamp: number;
}
```

### 3.4 世界设定 (WorldEntry)

世界观相关的设定条目。

```typescript
interface WorldEntry extends ArchiveBase {
  // 分类
  category: 'location' | 'organization' | 'item' | 'concept' | 'rule' | 'history';
  
  // 内容
  name: string;
  description: string;
  details?: Record<string, string>;  // 扩展属性
  
  // 关联
  relatedCharacters: string[];    // 关联角色 ID
  relatedEntries: string[];       // 关联词条 ID
  relatedEvents: string[];        // 关联事件 ID
  
  // 来源
  source: 'worldbook' | 'chat_extract' | 'social_media' | 'manual';
  sourceReference?: string;       // 来源说明
}
```

### 3.5 关键词 (Keyword)

统一管理的关键词系统。

```typescript
interface Keyword {
  id: string;
  sessionId: string;
  
  // 内容
  text: string;                   // 关键词文本
  category?: string;              // 分类（如：人物、地点、事件）
  
  // 统计
  usageCount: number;             // 使用次数
  linkedArchives: string[];       // 关联的档案 ID
  linkedCharacters: string[];     // 关联的角色 ID
  linkedEntries: string[];        // 关联的世界设定 ID
  
  // 来源
  source: 'ai_generated' | 'user_created';
  createdAt: number;
}
```

### 3.6 归档配置 (ArchiveConfig)

会话级别的归档配置。

```typescript
interface ArchiveConfig {
  sessionId: string;
  
  // 自动化设置
  autoExtract: {
    enabled: boolean;
    floorInterval: number;        // 每隔多少楼触发一次（默认 5，可自定义 1-50）
    requireConfirmation: boolean; // 是否需要用户确认（默认 true）
  };
  
  // 首次分析补充信息
  initialContext?: {
    worldSetting?: string;        // 世界观背景
    mainCharacters?: string[];    // 主要角色列表
    timeline?: string;            // 时间线说明
    customInstructions?: string;  // 自定义指令
  };
  
  // 知识注入设置
  injection: {
    enabledScenes: string[];      // 启用注入的场景（如 'social.*'）
    
    // Token 预算控制
    coreKnowledgeMaxTokens: number;   // 核心知识最大 token（默认 500）
    accountContextMaxTokens: number;  // 账号上下文最大 token（默认 300）
    contextualMaxTokens: number;      // 关键词匹配最大 token（默认 400）
    
    // 数量限制
    maxPinnedArchives: number;    // 最大 always 级别档案数（默认 10）
    maxContextualMatches: number; // 最大关键词匹配数（默认 5）
    
    // 高级选项
    enableSemanticMatch: boolean; // 是否启用语义匹配（默认 false）
    deduplicationWindow: number;  // 去重窗口（最近 N 轮，默认 3）
  };
  
  // 状态
  lastExtractFloor: number;       // 上次提取的楼层
  lastExtractTime: number;
  totalExtractCount: number;
}
```

### 3.7 社交账号扩展

扩展现有的 `SocialAccount` 类型以支持档案绑定。

```typescript
// 扩展 src/types/social.ts 中的 SocialAccount

interface SocialAccount {
  // ... 现有字段 ...
  
  // 档案绑定（新增）
  boundArchiveIds?: string[];     // 绑定的档案 ID 列表
  
  // 档案注入配置（新增）
  archiveInjection?: {
    enabled: boolean;             // 是否启用档案注入
    maxTokens: number;            // 最大注入 token 数
    includeRelated: boolean;      // 是否包含关联档案
  };
}
```

---

## 4. 注入系统

### 4.1 注入级别详解

| 级别 | 标识 | 触发时机 | 典型用途 | Token 预算 |
| ---- | ---- | -------- | -------- | ---------- |
| **始终注入** | `always` | 每次 LLM 调用 | 核心世界观、主要角色设定、重要规则 | 500 |
| **上下文匹配** | `contextual` | 关键词命中时 | 次要角色、地点、历史事件 | 400 |
| **不注入** | `none` | 不自动注入 | 纯归档记录、已过时信息 | 0 |

### 4.2 变量注册表

档案系统向提示词模板暴露以下标准变量：

```typescript
// src/services/archiveVariables.ts

export const ARCHIVE_VARIABLES = {
  /**
   * 核心知识 - 始终注入的档案
   * 包含所有 injectionLevel='always' 的档案
   */
  coreKnowledge: {
    name: '{{coreKnowledge}}',
    description: '核心世界观和角色设定，始终包含在系统提示词中',
    resolver: (sessionId: string) => archiveService.getPinnedArchives(sessionId),
    format: 'structured', // 结构化格式
  },
  
  /**
   * 账号上下文 - 当前操作账号绑定的档案
   * 用于社交媒体内容生成
   */
  accountContext: {
    name: '{{accountContext}}',
    description: '当前社交账号的角色背景',
    resolver: (accountId: string) => archiveService.getAccountArchives(accountId),
    format: 'narrative', // 叙事格式
  },
  
  /**
   * 相关档案 - 根据关键词匹配
   * 用于增强特定话题的生成
   */
  relevantArchives: {
    name: '{{relevantArchives}}',
    description: '与当前话题相关的档案内容',
    resolver: (keywords: string[], sessionId: string) => 
      archiveService.matchByKeywords(keywords, sessionId),
    format: 'bullet', // 要点格式
  },
  
  /**
   * 时间线摘要 - 近期事件概览
   */
  recentTimeline: {
    name: '{{recentTimeline}}',
    description: '近期发生的关键事件时间线',
    resolver: (sessionId: string, days?: number) => 
      archiveService.getRecentTimeline(sessionId, days ?? 7),
    format: 'timeline',
  },
};
```

### 4.3 注入服务

```typescript
// src/services/archiveInjectionService.ts

interface InjectionRequest {
  sessionId: string;
  scene: string;                  // 当前场景 ID
  accountId?: string;             // 操作的账号（如有）
  keywords?: string[];            // 上下文关键词
  maxTotalTokens?: number;        // 总 token 上限
}

interface InjectionResult {
  coreKnowledge: string;          // 核心知识文本
  accountContext: string;         // 账号上下文文本
  relevantArchives: string;       // 相关档案文本
  
  metadata: {
    totalTokens: number;
    injectedArchiveIds: string[]; // 本次注入的档案 ID
    deduplicatedCount: number;    // 被去重的数量
  };
}

class ArchiveInjectionService {
  /**
   * 获取完整的注入内容
   */
  async getInjection(request: InjectionRequest): Promise<InjectionResult> {
    const config = await this.getConfig(request.sessionId);
    
    // 1. 收集所有候选档案
    const candidates: ArchiveCandidate[] = [];
    
    // 1a. 核心知识（always 级别）
    const pinned = await archiveService.getPinnedArchives(request.sessionId);
    candidates.push(...pinned.map(a => ({
      archive: a,
      source: 'core' as const,
      priority: 100 + (a.injectionPriority ?? 50),
    })));
    
    // 1b. 账号绑定档案
    if (request.accountId) {
      const accountArchives = await archiveService.getAccountArchives(request.accountId);
      candidates.push(...accountArchives.map(a => ({
        archive: a,
        source: 'account' as const,
        priority: 80 + (a.injectionPriority ?? 50),
      })));
    }
    
    // 1c. 关键词匹配档案
    if (request.keywords?.length) {
      const matched = await archiveService.matchByKeywords(
        request.keywords, 
        request.sessionId
      );
      candidates.push(...matched.map(a => ({
        archive: a,
        source: 'contextual' as const,
        priority: 60 + (a.injectionPriority ?? 50),
      })));
    }
    
    // 2. 去重
    const deduplicated = this.deduplicationService.deduplicate(candidates);
    
    // 3. 按优先级排序并截断
    const sorted = deduplicated.sort((a, b) => b.priority - a.priority);
    const truncated = this.truncateToTokenLimit(sorted, request.maxTotalTokens);
    
    // 4. 格式化输出
    return this.formatResult(truncated, config);
  }
}
```

### 4.4 去重机制

防止同一档案在不同来源中重复注入。

```typescript
// src/services/archiveDeduplication.ts

interface DeduplicationContext {
  sessionId: string;
  recentlyInjectedIds: string[];  // 最近 N 轮已注入的 ID
}

class ArchiveDeduplicationService {
  // 会话级别的注入跟踪
  private sessionInjectedIds: Map<string, Set<string>> = new Map();
  
  // 内容哈希缓存（用于语义去重）
  private contentHashes: Map<string, string> = new Map();
  
  // 滚动窗口记录
  private injectionHistory: Map<string, string[][]> = new Map();
  
  /**
   * 对候选档案进行去重
   */
  deduplicate(
    candidates: ArchiveCandidate[],
    context: DeduplicationContext
  ): ArchiveCandidate[] {
    const seen = new Set<string>();
    const seenHashes = new Set<string>();
    
    return candidates.filter(candidate => {
      const archive = candidate.archive;
      
      // 规则 1: ID 去重 - 同一批次内不重复
      if (seen.has(archive.id)) {
        return false;
      }
      seen.add(archive.id);
      
      // 规则 2: 语义去重 - 内容实质相同的跳过
      if (archive.contentHash) {
        if (seenHashes.has(archive.contentHash)) {
          return false;
        }
        seenHashes.add(archive.contentHash);
      }
      
      // 规则 3: 时效去重 - 最近 N 轮已注入的跳过（可选）
      // 注意：always 级别豁免此规则
      if (
        archive.injectionLevel !== 'always' &&
        context.recentlyInjectedIds.includes(archive.id)
      ) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * 记录本轮注入的档案
   */
  recordInjection(sessionId: string, archiveIds: string[]): void {
    const history = this.injectionHistory.get(sessionId) ?? [];
    history.push(archiveIds);
    
    // 保留最近 N 轮
    const windowSize = 3; // 可配置
    if (history.length > windowSize) {
      history.shift();
    }
    
    this.injectionHistory.set(sessionId, history);
  }
  
  /**
   * 获取最近注入的档案 ID
   */
  getRecentlyInjected(sessionId: string): string[] {
    const history = this.injectionHistory.get(sessionId) ?? [];
    return history.flat();
  }
  
  /**
   * 重置会话的去重状态
   */
  resetSession(sessionId: string): void {
    this.sessionInjectedIds.delete(sessionId);
    this.injectionHistory.delete(sessionId);
  }
}
```

### 4.5 注入格式

不同来源的档案使用不同的格式化方式：

```typescript
// 核心知识格式（结构化）
const CORE_KNOWLEDGE_FORMAT = `
【世界背景】
{{worldEntries}}

【主要角色】
{{characters}}

【重要规则】
{{rules}}
`;

// 账号上下文格式（叙事）
const ACCOUNT_CONTEXT_FORMAT = `
你正在扮演「{{accountName}}」，以下是该角色的背景：
{{characterDescription}}

该角色的特点：
{{traits}}

已知事实：
{{knownFacts}}
`;

// 相关档案格式（要点）
const RELEVANT_ARCHIVES_FORMAT = `
相关背景信息：
{{#each archives}}
- {{this.title}}: {{this.summary}}
{{/each}}
`;
```

---

## 5. 核心功能

### 5.1 自动化归档

#### 触发机制

默认每 **5 楼**触发一次归档建议，用户可在设置中自定义（范围 1-50 楼）。

```typescript
// src/services/archiveService.ts

class ArchiveService {
  private static readonly DEFAULT_FLOOR_INTERVAL = 5;
  private static readonly MIN_FLOOR_INTERVAL = 1;
  private static readonly MAX_FLOOR_INTERVAL = 50;
  
  private checkAutoExtract(sessionId: string, currentFloor: number): void {
    const config = this.getConfig(sessionId);
    
    if (!config.autoExtract.enabled) return;
    
    const floorsSinceLastExtract = currentFloor - config.lastExtractFloor;
    
    if (floorsSinceLastExtract >= config.autoExtract.floorInterval) {
      // 触发自动提取
      this.triggerExtraction(sessionId, {
        startFloor: config.lastExtractFloor + 1,
        endFloor: currentFloor,
        requireConfirmation: config.autoExtract.requireConfirmation,
      });
    }
  }
  
  private async triggerExtraction(sessionId: string, range: FloorRange): Promise<void> {
    // 发送通知，等待用户确认
    const notification = await notificationService.push({
      appId: 'archives',
      title: '档案归档建议',
      body: `检测到 ${range.endFloor - range.startFloor + 1} 层新内容，是否进行归档分析？`,
      priority: 'normal',
      category: 'archive-suggestion',
      actions: [
        { id: 'confirm', label: '开始归档' },
        { id: 'later', label: '稍后提醒' },
        { id: 'skip', label: '跳过' },
      ],
      route: '/archives?action=extract',
    });
    
    // 处理用户响应
    notification.onAction((actionId) => {
      switch (actionId) {
        case 'confirm':
          this.performExtraction(sessionId, range);
          break;
        case 'later':
          this.scheduleReminder(sessionId, range);
          break;
        case 'skip':
          this.updateLastExtractFloor(sessionId, range.endFloor);
          break;
      }
    });
  }
}
```

#### 为什么需要确认？

酒馆的叙事可能尚未确定：

- 用户可能会切换最后一楼的 swipe
- 用户可能会删除/重新生成楼层
- AI 生成过程中内容不完整

通过通知确认机制，确保用户在叙事稳定后再进行归档。

### 5.2 账号绑定

#### 绑定操作

```typescript
// 从档案详情页绑定账号
async function bindArchiveToAccount(
  archiveId: string, 
  accountId: string
): Promise<void> {
  // 1. 更新档案的 boundAccountIds
  const archive = await archiveService.get(archiveId);
  archive.boundAccountIds = archive.boundAccountIds ?? [];
  if (!archive.boundAccountIds.includes(accountId)) {
    archive.boundAccountIds.push(accountId);
  }
  await archiveService.save(archive);
  
  // 2. 更新账号的 boundArchiveIds
  const account = await accountService.get(accountId);
  account.boundArchiveIds = account.boundArchiveIds ?? [];
  if (!account.boundArchiveIds.includes(archiveId)) {
    account.boundArchiveIds.push(archiveId);
  }
  await accountService.save(account);
}

// 解绑操作
async function unbindArchiveFromAccount(
  archiveId: string, 
  accountId: string
): Promise<void> {
  // 双向移除引用
  const archive = await archiveService.get(archiveId);
  archive.boundAccountIds = archive.boundAccountIds?.filter(id => id !== accountId);
  await archiveService.save(archive);
  
  const account = await accountService.get(accountId);
  account.boundArchiveIds = account.boundArchiveIds?.filter(id => id !== archiveId);
  await accountService.save(account);
}
```

#### 级联删除

```typescript
// 删除档案时清理绑定关系
async function deleteArchive(archiveId: string): Promise<void> {
  const archive = await archiveService.get(archiveId);
  
  // 清理所有账号的引用
  if (archive.boundAccountIds?.length) {
    for (const accountId of archive.boundAccountIds) {
      const account = await accountService.get(accountId);
      account.boundArchiveIds = account.boundArchiveIds?.filter(id => id !== archiveId);
      await accountService.save(account);
    }
  }
  
  // 删除档案本身
  await db.archives.delete(archiveId);
}
```

### 5.3 核心知识管理

专门的页面管理 `injectionLevel='always'` 的档案。

```text
┌─────────────────────────────────────────┐
│  核心知识                      [+ 添加]  │
├─────────────────────────────────────────┤
│  这些档案会始终包含在 AI 的系统提示词中   │
│  请谨慎添加，避免占用过多上下文空间        │
├─────────────────────────────────────────┤
│  Token 使用: 342 / 500                   │
│  ████████████░░░░░░░░░░░░░░░░░  68%     │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📖 世界观设定           优先级 90 │   │
│  │   这是一个魔法与科技并存的世界...  │   │
│  │   ~120 tokens                     │   │
│  │                [调整] [移除]      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 👤 主角设定             优先级 85 │   │
│  │   艾琳，神秘的大魔法师...         │   │
│  │   ~98 tokens                      │   │
│  │                [调整] [移除]      │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 5.4 关键词系统

#### LLM 自动生成

在每次提取档案时，同时生成关键词：

```typescript
// 在提取提示词中要求生成关键词
const extractPrompt = `
分析以下聊天内容，提取关键信息：

${chatContent}

请返回 JSON 格式：
{
  "events": [...],
  "characters": [...],
  "keywords": [
    { "text": "关键词", "category": "人物|地点|事件|物品|概念" }
  ]
}
`;
```

#### 用户 CRUD

关键词管理页面支持：

```text
┌─────────────────────────────────────────┐
│  关键词管理                    [+ 新建]  │
├─────────────────────────────────────────┤
│  🔍 搜索关键词...                        │
├─────────────────────────────────────────┤
│  分类筛选: [全部▼] [人物] [地点] [事件]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🏷️ 魔法学院        人物  使用: 12 │   │
│  │   关联: 3 事件, 2 角色, 1 设定    │   │
│  │                    [编辑] [删除]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🏷️ 黑暗森林        地点  使用: 8  │   │
│  │   关联: 2 事件, 1 角色           │   │
│  │                    [编辑] [删除]  │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### 关键词合并

当检测到语义相似的关键词时，建议合并：

```typescript
interface KeywordMergeSuggestion {
  source: string[];        // 待合并的关键词
  target: string;          // 合并后的关键词
  reason: string;          // AI 解释
}

// 示例
{
  source: ["魔法学院", "学院", "魔法学校"],
  target: "魔法学院",
  reason: "这些关键词指代同一个地点"
}
```

### 5.5 时间线视图

提供按时间顺序浏览事件的视图：

```text
┌─────────────────────────────────────────┐
│  ← 时间线                      [筛选▼]  │
├─────────────────────────────────────────┤
│                                         │
│  ●─────────────────────────────────●   │
│  第一天                        第三天   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  📅 第一天 - 早晨                        │
│  ├── ⭐ 主角初次来到魔法学院             │
│  │   └── 楼层 1-5 | 参与者: 主角, 导师   │
│  │                                      │
│  ├── 📝 发现神秘符文                     │
│  │   └── 楼层 8 | 地点: 图书馆           │
│  │                                      │
│  📅 第一天 - 傍晚                        │
│  ├── ⚔️ 与守卫发生冲突                   │
│  │   └── 楼层 12-15 | 重要事件           │
│  │                                      │
│  📅 第二天                               │
│  ├── ...                                │
│                                         │
└─────────────────────────────────────────┘
```

### 5.6 语义匹配（高级）

除了基于关键词的精确匹配，档案系统还支持**语义匹配**，用于在没有明确关键词的情况下找到相关内容。

#### 实现方案

参考 [社交媒体引擎](../systems/social-media-engine.md) 的设计思路，采用**惰性语义索引**：

```typescript
// src/services/archiveSemanticService.ts

interface SemanticIndex {
  archiveId: string;
  embedding?: number[];         // 向量嵌入（可选，需要 Embedding API）
  semanticTags: string[];       // LLM 生成的语义标签
  relatedConcepts: string[];    // 相关概念
}

class ArchiveSemanticService {
  /**
   * 语义搜索档案
   * @param query 自然语言查询
   * @param options 搜索选项
   */
  async semanticSearch(query: string, options: SemanticSearchOptions): Promise<ArchiveMatch[]> {
    // 方案 A: 使用 Embedding API（如果可用）
    if (this.embeddingAvailable) {
      return this.searchByEmbedding(query, options);
    }
    
    // 方案 B: LLM 辅助匹配（回退方案）
    return this.searchByLLM(query, options);
  }
  
  /**
   * LLM 辅助匹配
   * 让 LLM 分析查询意图，返回最相关的档案 ID
   */
  private async searchByLLM(query: string, options: SemanticSearchOptions): Promise<ArchiveMatch[]> {
    // 1. 获取档案摘要列表
    const summaries = await this.getArchiveSummaries(options.sessionId);
    
    // 2. 调用 LLM 进行匹配
    const result = await aiGenerateService.generate({
      scene: 'archive.semantic.match',
      variables: {
        query,
        archives: JSON.stringify(summaries),
        maxResults: options.maxResults || 5,
      },
    });
    
    // 3. 解析结果
    return this.parseMatchResult(result);
  }
}
```

#### 使用场景

| 场景 | 关键词匹配 | 语义匹配 |
| ---- | ---------- | -------- |
| "魔法学院" | ✅ 精确命中 | ✅ 命中 |
| "那个学校" | ❌ 无法匹配 | ✅ 理解指代 |
| "主角学习的地方" | ❌ 无法匹配 | ✅ 推理关联 |
| "和导师的冲突" | ⚠️ 部分匹配 | ✅ 语义理解 |

#### 性能考虑

- 语义匹配会消耗 LLM 调用，建议仅在关键词匹配无结果时启用
- 可配置是否启用语义匹配：`injection.enableSemanticMatch`
- 缓存语义索引，避免重复计算

### 5.7 导出功能

支持将档案导出为多种格式，便于备份和分享。

#### 导出格式

| 格式 | 说明 | 用途 |
| ---- | ---- | ---- |
| **JSON** | 完整数据导出 | 备份、迁移、导入到其他会话 |
| **Markdown** | 人类可读格式 | 阅读、分享、打印 |
| **世界书 (Lorebook)** | 酒馆兼容格式 | 导入到酒馆的世界书 |

#### 导出选项

```typescript
interface ExportOptions {
  format: 'json' | 'markdown' | 'lorebook';
  scope: 'all' | 'events' | 'characters' | 'world' | 'pinned' | 'selected';
  selectedIds?: string[];       // scope='selected' 时使用
  
  // Markdown 特有选项
  includeTimeline?: boolean;    // 是否包含时间线视图
  includeSourceRefs?: boolean;  // 是否包含来源引用
  
  // Lorebook 特有选项
  entryPrefix?: string;         // 词条前缀
  keywordsAsKeys?: boolean;     // 是否使用关键词作为触发词
  
  // 新增：含注入配置
  includeInjectionSettings?: boolean;
}
```

---

## 6. 与其他系统的集成

### 6.1 Socket Bridge 集成

通过 Bridge 获取楼层数据：

```typescript
// 在 bridgeAdapter 中添加事件
interface BridgeEvents {
  // 请求楼层内容
  'floors:request': (range: { start: number; end: number }) => void;
  // 接收楼层数据
  'floors:response': (floors: FloorData[]) => void;
  // 楼层变化通知（用于触发自动提取检查）
  'floors:updated': (info: { totalFloors: number; lastFloorId: number }) => void;
}

interface FloorData {
  messageId: number;
  swipeId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
```

### 6.2 社交引擎集成

档案内容自动注入到社交引擎的生成提示词中：

```typescript
// src/services/social/contentFactory.ts

async function generatePost(platformId: string, topic: string, account?: SocialAccount): Promise<Post> {
  // 获取档案注入内容
  const injection = await archiveInjectionService.getInjection({
    sessionId: currentSessionId,
    scene: `social.post.generate.${platformId}`,
    accountId: account?.id,
    keywords: extractKeywords(topic),
    maxTotalTokens: 800,
  });
  
  // 注入到提示词
  const prompt = await promptService.renderPrompt('social.post.generate', {
    platformName: platform.name,
    topic,
    // 注入档案上下文
    coreKnowledge: injection.coreKnowledge,
    accountContext: injection.accountContext,
    relevantArchives: injection.relevantArchives,
  });
  
  return generateWithLLM(prompt);
}
```

#### 社交账号编辑集成

在账号编辑界面添加档案绑定入口：

```text
┌─────────────────────────────────────────┐
│  编辑账号 - @stargazer                   │
├─────────────────────────────────────────┤
│  昵称: [观星者            ]              │
│  简介: [热爱天文的大学生... ]            │
│                                         │
│  ─────────── 档案绑定 ───────────       │
│                                         │
│  已绑定档案:                             │
│  ┌─────────────────────────────────┐   │
│  │ 👤 观星者人设           [解绑]  │   │
│  │ 🌍 天文社设定           [解绑]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [+ 绑定更多档案]                        │
│                                         │
│  ☑ 生成内容时注入绑定档案                │
│    最大 Token: [300      ]              │
│                                         │
│            [取消]     [保存]            │
└─────────────────────────────────────────┘
```

### 6.3 系统提示词集成

核心知识自动注入到系统提示词：

```typescript
// src/services/systemPromptService.ts

async function buildSystemPrompt(context: PromptContext): Promise<string> {
  const parts: string[] = [];
  
  // 1. 基础系统提示词
  parts.push(this.getBasePrompt());
  
  // 2. 注入核心知识（always 级别的档案）
  const coreKnowledge = await archiveInjectionService.getInjection({
    sessionId: context.sessionId,
    scene: 'system.core',
  });
  
  if (coreKnowledge.coreKnowledge) {
    parts.push('\n--- 世界背景 ---\n');
    parts.push(coreKnowledge.coreKnowledge);
  }
  
  // 3. App 级系统提示词
  parts.push(...this.getAppPrompts(context.appId));
  
  return parts.join('\n');
}
```

### 6.4 通知系统集成

参见 [通知系统文档](../systems/notification-system.md)。

档案 App 使用的通知类型：

| 通知类型 | 优先级 | 场景 |
| -------- | ------ | ---- |
| `archive-suggestion` | `normal` | 自动归档建议 |
| `archive-complete` | `low` | 归档完成通知 |
| `archive-error` | `high` | 归档失败警告 |
| `archive-conflict` | `normal` | 档案冲突（同一内容多次归档） |

---

## 7. 提示词与提示词链

### 7.1 核心提示词

以下提示词注册在 `archives` 下：

| 场景 ID | 名称 | 描述 | 变量 |
| :--- | :--- | :--- | :--- |
| `archive.extract.events` | 提取事件 | 从聊天记录中提取关键事件 | `content`, `context` |
| `archive.extract.characters` | 提取角色信息 | 更新角色档案 | `content`, `existingProfile` |
| `archive.extract.world` | 提取世界设定 | 发现新的设定条目 | `content`, `existingEntries` |
| `archive.summarize` | 生成摘要 | 压缩总结档案内容 | `archives` |
| `archive.keywords.generate` | 生成关键词 | 从内容中提取关键词 | `content` |
| `archive.keywords.merge` | 关键词合并建议 | 分析相似关键词 | `keywords` |
| `archive.semantic.match` | 语义匹配 | LLM 辅助查找相关档案 | `query`, `archives` |

### 7.2 提示词链

#### 完整提取链

```typescript
// src/apps/archives/chains.ts

export const fullExtractionChain: PromptChain = {
  id: 'archive.extraction.full',
  name: '完整档案提取',
  description: '从聊天记录中提取事件、角色和世界设定',
  appId: 'archives',
  
  inputs: [
    { name: 'floors', type: 'string', description: '楼层内容' },
    { name: 'context', type: 'object', description: '补充上下文' },
  ],
  
  steps: [
    {
      id: 'step1',
      name: '提取事件',
      promptId: 'archive.extract.events',
      inputMapping: {
        content: '{{input.floors}}',
        context: '{{input.context}}',
      },
      outputKey: 'events',
    },
    {
      id: 'step2',
      name: '提取角色信息',
      promptId: 'archive.extract.characters',
      inputMapping: {
        content: '{{input.floors}}',
        existingProfile: '{{context.characters}}',
      },
      outputKey: 'characterUpdates',
    },
    {
      id: 'step3',
      name: '提取世界设定',
      promptId: 'archive.extract.world',
      inputMapping: {
        content: '{{input.floors}}',
        existingEntries: '{{context.worldEntries}}',
      },
      outputKey: 'worldEntries',
    },
    {
      id: 'step4',
      name: '生成关键词',
      promptId: 'archive.keywords.generate',
      inputMapping: {
        content: '{{input.floors}}',
      },
      outputKey: 'keywords',
    },
  ],
  
  outputs: {
    events: '{{step1.events}}',
    characterUpdates: '{{step2.characterUpdates}}',
    worldEntries: '{{step3.worldEntries}}',
    keywords: '{{step4.keywords}}',
  },
  
  executionMode: 'multi-step',
};
```

---

## 8. UI 设计

### 8.1 首页布局

```text
┌─────────────────────────────────────────┐
│  档案                        [🔍] [⚙️]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │   15    │ │    8    │ │   23    │   │
│  │  事件   │ │  角色   │ │  设定   │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📌 核心知识: 3 条  (342/500 t)   │   │
│  │ ████████████░░░░░░░░░  68%      │   │
│  │                        [管理 →] │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  快捷操作                                │
│  ┌─────────────────────────────────┐   │
│  │ 📋 手动归档                   →  │   │
│  │    选择楼层进行归档分析            │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 📅 时间线                     →  │   │
│  │    按时间顺序浏览事件              │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 🏷️ 关键词管理                 →  │   │
│  │    查看和编辑关键词                │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  最近归档                                │
│  ┌─────────────────────────────────┐   │
│  │ ⭐ 主角获得神秘宝物              │   │
│  │    第一天 · 楼层 45-48            │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 📝 发现隐藏通道                  │   │
│  │    第一天 · 楼层 32-35            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 8.2 档案详情页（含注入设置）

```text
┌─────────────────────────────────────────┐
│  ← 角色档案                    [编辑]   │
├─────────────────────────────────────────┤
│                                         │
│  👤 艾琳                                │
│  别名: 导师, 大魔法师                    │
│  角色类型: 主要角色                      │
│                                         │
│  ─────────── 基础描述 ───────────       │
│  神秘的大魔法师，学院最强的存在之一...    │
│                                         │
│  ─────────── 性格特点 ───────────       │
│  [神秘] [知识渊博] [对主角关注]          │
│                                         │
│  ─────────── 已知事实 ───────────       │
│  • 是学院最强的魔法师之一 (确定)         │
│  • 似乎知道主角的身世秘密 (可能)         │
│                                         │
├─────────────────────────────────────────┤
│  ─────────── 注入设置 ───────────       │
│                                         │
│  注入级别: [始终注入 ▼]                  │
│    ⚠️ 此档案将始终包含在系统提示词中     │
│                                         │
│  优先级: [85] (0-100，数值越大越优先)    │
│                                         │
├─────────────────────────────────────────┤
│  ─────────── 绑定账号 ───────────       │
│                                         │
│  已绑定:                                │
│  ┌─────────────────────────────────┐   │
│  │ 🐦 @archmage_eileen (微博) [×]   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [+ 绑定账号]                           │
│                                         │
├─────────────────────────────────────────┤
│  关键词: [艾琳] [导师] [大魔法师]        │
│  来源: 聊天提取 | 楼层 15-18             │
│  更新: 2025-01-05 12:00                 │
│                                         │
└─────────────────────────────────────────┘
```

### 8.3 归档状态指示

在状态栏显示归档状态：

| 状态 | 图标 | 说明 |
| ---- | ---- | ---- |
| 已同步 | 📗 | 所有内容已归档 |
| 待处理 | 📙 | 有新内容待归档 |
| 处理中 | 🔄 | 正在进行归档分析 |
| 需确认 | 📕 | 有待确认的归档建议 |

---

## 9. Store 依赖

```text
Store 依赖：
├── ArchivesHome → archiveStore, sessionService
├── EventsList → archiveStore
├── CharactersList → archiveStore, characterStore
├── WorldEntries → archiveStore, worldStore
├── Timeline → archiveStore, timeService
├── KeywordsManager → keywordStore
├── PinnedArchives → archiveStore, injectionStore
├── CharacterDetail → archiveStore, accountStore (绑定)
└── ExtractDialog → archiveStore, bridgeAdapter, notificationStore
```

---

## 10. 开发计划

### Phase 1: 基础设施

- [ ] 类型定义 (`src/types/archive.ts`) - 包含注入级别、账号绑定
- [ ] IndexedDB 表 (`chatArchives`, `characterProfiles`, `worldEntries`, `keywords`, `archiveConfigs`)
- [ ] 基础 CRUD 服务 (`ArchiveService`)
- [ ] 核心提示词定义 (`src/apps/archives/prompts.ts`)

### Phase 2: 手动功能

- [ ] 档案首页 (`ArchivesHome.vue`)
- [ ] 手动选择楼层提取 (`ExtractDialog.vue`)
- [ ] 事件/角色/设定的列表和详情页
- [ ] 基础搜索功能

### Phase 3: 注入系统

- [ ] 注入级别选择器组件 (`InjectionLevelSelect.vue`)
- [ ] 去重服务 (`ArchiveDeduplicationService`)
- [ ] 变量注册表 (`archiveVariables.ts`)
- [ ] 注入服务 (`ArchiveInjectionService`)
- [ ] 核心知识管理页 (`PinnedArchives.vue`)

### Phase 4: 账号绑定

- [ ] 账号绑定编辑器 (`AccountBindingEditor.vue`)
- [ ] 扩展 `SocialAccount` 类型
- [ ] 级联删除逻辑
- [ ] 微博账号编辑页集成

### Phase 5: 关键词系统

- [ ] 关键词自动生成
- [ ] 关键词管理页面 (`KeywordsManager.vue`)
- [ ] 关键词合并建议

### Phase 6: 自动化

- [ ] 自动归档触发器
- [ ] 通知集成（归档建议）
- [ ] 首次分析引导流程
- [ ] 分批次处理

### Phase 7: 时间线与高级功能

- [ ] 时间线视图 (`Timeline.vue`)
- [ ] 世界观时间映射
- [ ] 语义匹配（可选）
- [ ] 导出/导入功能

---

## 11. 最佳实践

### ✅ 推荐做法

1. **确认后再归档**：始终让用户确认归档内容，避免归档不稳定的叙事
2. **增量更新**：角色档案采用增量更新，保留历史记录
3. **关键词复用**：优先使用已有关键词，避免重复
4. **注入节制**：控制 always 级别档案数量，避免挤占生成空间
5. **双向绑定**：档案与账号的绑定关系应双向维护
6. **Token 监控**：定期检查核心知识的 token 使用量

### ❌ 避免做法

1. **过度归档**：不是每个对话都值得归档，关注关键事件
2. **忽略来源**：始终追踪数据来源，便于回溯
3. **硬编码注入**：注入逻辑应可配置，允许用户调整
4. **滥用 always**：核心知识应精简，过多会降低 AI 理解效率
5. **忽略去重**：同一档案可能通过多个途径匹配，必须去重

---

## 12. 参考文档

- [App 架构指南](./architecture.md)
- [Socket Bridge 设计](../dev/socket-bridge-design.md)
- [提示词管理 App](./Prompt/README.md)
- [社交媒体引擎](../systems/social-media-engine.md)
- [社交引擎配置 App](./social-engine.md)
- [通知系统](../systems/notification-system.md)
