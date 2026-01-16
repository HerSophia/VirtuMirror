# 档案服务 - 注入系统

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 概述

注入系统是档案服务的核心功能，负责将档案内容自动注入到 LLM 提示词中，提升 AI 生成的一致性和上下文感知能力。

### 1.1 工作流程

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           注入请求 (InjectionRequest)                     │
│  sessionId + scene + accountId? + keywords? + maxTotalTokens?           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           收集候选档案                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ 核心知识      │  │ 账号绑定      │  │ 关键词匹配    │                   │
│  │ (always)     │  │ (account)    │  │ (contextual) │                   │
│  │ 优先级 100+   │  │ 优先级 80+    │  │ 优先级 60+    │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           去重 & 排序                                    │
│  1. ID 去重 - 同一档案不重复                                              │
│  2. 语义去重 - 内容相同的跳过                                             │
│  3. 时效去重 - 最近已注入的跳过（always 豁免）                             │
│  4. 按优先级排序                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Token 截断 & 格式化                            │
│  根据 maxTotalTokens 截断，分别格式化为三个输出变量                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           注入结果 (InjectionResult)                     │
│  coreKnowledge + accountContext + relevantArchives + metadata           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 注入级别详解

### 2.1 级别对比

| 级别 | 标识 | 触发时机 | 典型用途 | Token 预算 |
| ---- | ---- | -------- | -------- | ---------- |
| **始终注入** | `always` | 每次 LLM 调用 | 核心世界观、主要角色设定、重要规则 | 500 |
| **上下文匹配** | `contextual` | 关键词命中时 | 次要角色、地点、历史事件 | 400 |
| **不注入** | `none` | 不自动注入 | 纯归档记录、已过时信息 | 0 |

### 2.2 优先级计算

```typescript
// 优先级 = 基础优先级 + 档案自定义优先级 (0-100)

interface ArchiveCandidate {
  archive: ArchiveBase;
  source: 'core' | 'account' | 'contextual';
  priority: number;  // 计算后的优先级
}

// 优先级计算规则
function calculatePriority(archive: ArchiveBase, source: string): number {
  const basePriority = {
    'core': 100,       // always 级别基础优先级
    'account': 80,     // 账号绑定基础优先级
    'contextual': 60,  // 关键词匹配基础优先级
  }[source] ?? 50;
  
  return basePriority + (archive.injectionPriority ?? 50);
}
```

---

## 3. 变量注册表

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

---

## 4. 注入服务接口

### 4.1 请求与响应

```typescript
// src/services/archiveInjectionService.ts

interface InjectionRequest {
  sessionId: string;              // 会话 ID
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
    totalTokens: number;          // 实际使用的 token 数
    injectedArchiveIds: string[]; // 本次注入的档案 ID
    deduplicatedCount: number;    // 被去重的数量
  };
}
```

### 4.2 服务实现

```typescript
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
    const deduplicated = this.deduplicationService.deduplicate(candidates, {
      sessionId: request.sessionId,
      recentlyInjectedIds: this.deduplicationService.getRecentlyInjected(request.sessionId),
    });
    
    // 3. 按优先级排序并截断
    const sorted = deduplicated.sort((a, b) => b.priority - a.priority);
    const truncated = this.truncateToTokenLimit(sorted, request.maxTotalTokens);
    
    // 4. 格式化输出
    return this.formatResult(truncated, config);
  }
  
  /**
   * Token 截断
   */
  private truncateToTokenLimit(
    candidates: ArchiveCandidate[],
    maxTokens?: number
  ): ArchiveCandidate[] {
    if (!maxTokens) return candidates;
    
    const result: ArchiveCandidate[] = [];
    let totalTokens = 0;
    
    for (const candidate of candidates) {
      const tokens = this.estimateTokens(candidate.archive);
      if (totalTokens + tokens <= maxTokens) {
        result.push(candidate);
        totalTokens += tokens;
      }
    }
    
    return result;
  }
  
  /**
   * 估算 token 数量
   */
  private estimateTokens(archive: ArchiveBase): number {
    // 简单估算：中文 ~1.5 token/字，英文 ~0.25 token/word
    const content = this.getArchiveContent(archive);
    return Math.ceil(content.length * 0.5);
  }
}
```

---

## 5. 注入格式

不同来源的档案使用不同的格式化方式：

### 5.1 核心知识格式（结构化）

```typescript
const CORE_KNOWLEDGE_FORMAT = `
【世界背景】
{{worldEntries}}

【主要角色】
{{characters}}

【重要规则】
{{rules}}
`;
```

**示例输出：**

```text
【世界背景】
这是一个魔法与科技并存的世界，魔法学院是最高学府...

【主要角色】
- 艾琳：神秘的大魔法师，学院最强的存在之一
- 导师：知识渊博，似乎知道主角的身世秘密

【重要规则】
- 禁忌魔法的代价是永久失去某种感知能力
- 契约一旦签订不可撤销
```

### 5.2 账号上下文格式（叙事）

```typescript
const ACCOUNT_CONTEXT_FORMAT = `
你正在扮演「{{accountName}}」，以下是该角色的背景：
{{characterDescription}}

该角色的特点：
{{traits}}

已知事实：
{{knownFacts}}
`;
```

**示例输出：**

```text
你正在扮演「观星者」，以下是该角色的背景：
热爱天文的大学生，经常在深夜观星空。

该角色的特点：
- 内向但对天文话题非常健谈
- 喜欢用星座比喻事物
- 作息不规律

已知事实：
- 在天文社担任副社长
- 拥有一台自己组装的望远镜
```

### 5.3 相关档案格式（要点）

```typescript
const RELEVANT_ARCHIVES_FORMAT = `
相关背景信息：
{{#each archives}}
- {{this.title}}: {{this.summary}}
{{/each}}
`;
```

**示例输出：**

```text
相关背景信息：
- 魔法学院：位于大陆中央的最高学府，培养顶尖魔法师
- 黑暗森林：学院北部的禁区，据说藏有远古秘密
- 神秘符文：主角在图书馆发现的未知文字
```

---

## 6. 使用示例

### 6.1 社交媒体内容生成

```typescript
// src/services/social/contentFactory.ts

async function generatePost(
  platformId: string, 
  topic: string, 
  account?: SocialAccount
): Promise<Post> {
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

### 6.2 系统提示词注入

```typescript
// src/services/systemPromptService.ts

async function buildSystemPrompt(context: PromptContext): Promise<string> {
  const parts: string[] = [];
  
  // 1. 基础系统提示词
  parts.push(this.getBasePrompt());
  
  // 2. 注入核心知识（always 级别的档案）
  const injection = await archiveInjectionService.getInjection({
    sessionId: context.sessionId,
    scene: 'system.core',
  });
  
  if (injection.coreKnowledge) {
    parts.push('\n--- 世界背景 ---\n');
    parts.push(injection.coreKnowledge);
  }
  
  // 3. App 级系统提示词
  parts.push(...this.getAppPrompts(context.appId));
  
  return parts.join('\n');
}
```

---

## 7. 配置项

注入系统支持以下配置：

```typescript
interface InjectionConfig {
  enabledScenes: string[];        // 启用注入的场景（如 'social.*'）
  
  // Token 预算控制
  coreKnowledgeMaxTokens: number;   // 核心知识最大 token（默认 500）
  accountContextMaxTokens: number;  // 账号上下文最大 token（默认 300）
  contextualMaxTokens: number;      // 关键词匹配最大 token（默认 400）
  
  // 数量限制
  maxPinnedArchives: number;      // 最大 always 级别档案数（默认 10）
  maxContextualMatches: number;   // 最大关键词匹配数（默认 5）
  
  // 高级选项
  enableSemanticMatch: boolean;   // 是否启用语义匹配（默认 false）
  deduplicationWindow: number;    // 去重窗口（最近 N 轮，默认 3）
}
```

---

## 8. 最佳实践

### ✅ 推荐做法

1. **精简核心知识**：always 级别档案应精简，控制在 500 token 以内
2. **合理设置优先级**：关键信息设置高优先级，确保不被截断
3. **使用关键词匹配**：充分利用 contextual 级别，按需注入
4. **监控 Token 使用**：定期检查注入内容的 token 占用

### ❌ 避免做法

1. **滥用 always 级别**：过多核心知识会挤占生成空间
2. **忽略去重**：同一档案可能通过多个途径匹配，必须去重
3. **硬编码注入**：注入逻辑应可配置，允许用户调整
