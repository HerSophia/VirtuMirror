# 档案服务 - 去重机制

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 概述

去重机制防止同一档案在不同来源中重复注入，确保 LLM 提示词中不会出现冗余信息，同时优化 Token 使用效率。

### 1.1 为什么需要去重？

同一档案可能通过多个途径被匹配到：

```text
档案「艾琳的角色设定」可能同时被：
├── 核心知识（always 级别）匹配
├── 账号绑定（绑定到 @archmage_eileen）匹配
└── 关键词匹配（关键词：艾琳、导师、大魔法师）匹配
```

如果不进行去重，同一档案可能被注入 3 次，浪费大量 Token。

---

## 2. 去重规则

### 2.1 三层去重策略

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         候选档案列表                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌──────────┐   ┌──────────┐   ┌──────────┐
             │ 规则 1   │   │ 规则 2   │   │ 规则 3   │
             │ ID 去重  │   │ 语义去重 │   │ 时效去重 │
             └──────────┘   └──────────┘   └──────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         去重后的档案列表                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

| 规则 | 说明 | 作用 |
| ---- | ---- | ---- |
| **ID 去重** | 同一批次内相同 ID 不重复 | 防止同一档案多次注入 |
| **语义去重** | 内容实质相同的跳过 | 防止内容相似但 ID 不同的档案重复 |
| **时效去重** | 最近 N 轮已注入的跳过 | 防止连续对话中重复注入（always 级别豁免） |

---

## 3. 去重服务实现

### 3.1 接口定义

```typescript
// src/services/archiveDeduplication.ts

interface DeduplicationContext {
  sessionId: string;
  recentlyInjectedIds: string[];  // 最近 N 轮已注入的 ID
}

interface ArchiveCandidate {
  archive: ArchiveBase;
  source: 'core' | 'account' | 'contextual';
  priority: number;
}

interface DeduplicationResult {
  candidates: ArchiveCandidate[];  // 去重后的候选
  deduplicatedCount: number;        // 被去重的数量
  details: DeduplicationDetail[];   // 去重详情（用于调试）
}

interface DeduplicationDetail {
  archiveId: string;
  reason: 'id_duplicate' | 'semantic_duplicate' | 'recently_injected';
}
```

### 3.2 服务实现

```typescript
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
    const details: DeduplicationDetail[] = [];
    
    const result = candidates.filter(candidate => {
      const archive = candidate.archive;
      
      // 规则 1: ID 去重 - 同一批次内不重复
      if (seen.has(archive.id)) {
        details.push({ archiveId: archive.id, reason: 'id_duplicate' });
        return false;
      }
      seen.add(archive.id);
      
      // 规则 2: 语义去重 - 内容实质相同的跳过
      if (archive.contentHash) {
        if (seenHashes.has(archive.contentHash)) {
          details.push({ archiveId: archive.id, reason: 'semantic_duplicate' });
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
        details.push({ archiveId: archive.id, reason: 'recently_injected' });
        return false;
      }
      
      return true;
    });
    
    return result;
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
  
  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.sessionInjectedIds.clear();
    this.contentHashes.clear();
    this.injectionHistory.clear();
  }
}

export const archiveDeduplicationService = new ArchiveDeduplicationService();
```

---

## 4. 详细规则说明

### 4.1 规则 1: ID 去重

**目的**：防止同一档案在同一批次中被多次注入。

**场景**：

```typescript
// 同一档案通过多个途径匹配
const candidates = [
  { archive: { id: 'char_001' }, source: 'core', priority: 150 },
  { archive: { id: 'char_001' }, source: 'account', priority: 130 },
  { archive: { id: 'char_001' }, source: 'contextual', priority: 110 },
];

// 去重后只保留优先级最高的
const deduplicated = [
  { archive: { id: 'char_001' }, source: 'core', priority: 150 },
];
```

**实现要点**：
- 使用 Set 记录已见 ID
- 先按优先级排序，确保保留优先级最高的

### 4.2 规则 2: 语义去重

**目的**：防止内容实质相同但 ID 不同的档案重复注入。

**场景**：

```typescript
// 两个档案内容相似
const archive1 = {
  id: 'event_001',
  title: '主角发现神秘符文',
  summary: '主角在图书馆发现了未知的神秘符文...',
  contentHash: 'abc123',  // 相同的哈希
};

const archive2 = {
  id: 'event_002',
  title: '图书馆的发现',
  summary: '在图书馆中，主角发现了神秘的符文...',
  contentHash: 'abc123',  // 相同的哈希
};
```

**哈希计算**：

```typescript
function computeContentHash(archive: ArchiveBase): string {
  // 提取核心内容
  const content = getArchiveCoreContent(archive);
  
  // 标准化处理
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  // 计算哈希（使用简单的字符串哈希）
  return simpleHash(normalized);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
```

### 4.3 规则 3: 时效去重

**目的**：防止在连续对话中重复注入相同的上下文档案。

**场景**：

```text
轮次 1: 注入了 [event_001, char_001]
轮次 2: 注入了 [event_002, char_001]
轮次 3: 关键词匹配到 event_001
         → 跳过（最近 3 轮内已注入）
```

**配置**：

```typescript
interface InjectionConfig {
  // 去重窗口大小（最近 N 轮）
  deduplicationWindow: number;  // 默认 3
}
```

**豁免规则**：
- `always` 级别档案豁免时效去重
- 核心知识每次都需要注入，不受历史影响

---

## 5. 滚动窗口机制

### 5.1 数据结构

```typescript
// 每个会话维护一个滚动窗口
interface InjectionWindow {
  sessionId: string;
  history: string[][];  // 每轮注入的档案 ID 列表
  maxSize: number;      // 窗口大小
}

// 示例
const window: InjectionWindow = {
  sessionId: 'session_abc',
  history: [
    ['event_001', 'char_001'],  // 轮次 1
    ['event_002', 'char_001'],  // 轮次 2
    ['world_001'],              // 轮次 3
  ],
  maxSize: 3,
};
```

### 5.2 窗口操作

```typescript
class InjectionWindowManager {
  private windows: Map<string, InjectionWindow> = new Map();
  
  /**
   * 添加新一轮的注入记录
   */
  push(sessionId: string, archiveIds: string[]): void {
    const window = this.getOrCreate(sessionId);
    window.history.push(archiveIds);
    
    // 超出窗口大小时移除最旧的
    while (window.history.length > window.maxSize) {
      window.history.shift();
    }
  }
  
  /**
   * 获取窗口内所有档案 ID
   */
  getAll(sessionId: string): string[] {
    const window = this.windows.get(sessionId);
    if (!window) return [];
    return window.history.flat();
  }
  
  /**
   * 清除会话窗口
   */
  clear(sessionId: string): void {
    this.windows.delete(sessionId);
  }
  
  private getOrCreate(sessionId: string): InjectionWindow {
    if (!this.windows.has(sessionId)) {
      this.windows.set(sessionId, {
        sessionId,
        history: [],
        maxSize: 3,  // 可配置
      });
    }
    return this.windows.get(sessionId)!;
  }
}
```

---

## 6. 去重统计

为调试和监控提供去重统计信息：

```typescript
interface DeduplicationStats {
  totalCandidates: number;      // 原始候选数量
  afterDedup: number;           // 去重后数量
  removedByIdDupe: number;      // ID 去重移除数
  removedBySemantic: number;    // 语义去重移除数
  removedByRecent: number;      // 时效去重移除数
}

// 使用示例
const stats = archiveDeduplicationService.getStats(sessionId);
console.log(`去重率: ${((stats.totalCandidates - stats.afterDedup) / stats.totalCandidates * 100).toFixed(1)}%`);
```

---

## 7. 配置选项

```typescript
interface DeduplicationConfig {
  // 启用/禁用各规则
  enableIdDedup: boolean;         // ID 去重（默认 true）
  enableSemanticDedup: boolean;   // 语义去重（默认 true）
  enableRecentDedup: boolean;     // 时效去重（默认 true）
  
  // 时效去重参数
  deduplicationWindow: number;    // 窗口大小（默认 3）
  
  // 豁免规则
  exemptAlwaysLevel: boolean;     // always 级别豁免时效去重（默认 true）
}
```

---

## 8. 最佳实践

### ✅ 推荐做法

1. **保持哈希更新**：档案内容变更时更新 contentHash
2. **合理设置窗口大小**：根据对话频率调整，建议 3-5 轮
3. **监控去重率**：过高的去重率可能表示档案组织不合理

### ❌ 避免做法

1. **禁用所有去重**：会导致严重的 Token 浪费
2. **窗口过大**：会导致有用信息被过度去重
3. **忽略语义去重**：可能导致同义内容重复注入
