# 档案服务 - 提取服务

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 概述

提取服务负责从聊天记录中自动提取关键信息，包括事件、角色信息、世界设定等，并将其结构化存储为档案。该服务使用 LLM 进行智能分析，支持手动触发和自动触发两种模式。

### 1.1 工作流程

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           输入：楼层数据                                  │
│  FloorData[] - 包含消息内容、角色、时间戳等                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           提取调度器                                      │
│  判断触发条件：手动触发 / 楼层间隔触发                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           LLM 提取链                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Step 1      │  │ Step 2      │  │ Step 3      │                   │
│  │ 提取事件    │──▶│ 提取角色    │──▶│ 提取设定    │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                           │                                             │
│                           ▼                                             │
│                    ┌──────────────┐                                     │
│                    │ Step 4      │                                     │
│                    │ 生成关键词   │                                     │
│                    └──────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           结果处理                                       │
│  解析 LLM 输出 → 结构化数据 → 用户确认 → 写入数据库                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 触发机制

### 2.1 手动触发

用户主动选择楼层范围进行提取。

```typescript
interface ManualExtractRequest {
  sessionId: string;
  startFloor: number;           // 起始楼层
  endFloor: number;             // 结束楼层
  context?: ExtractionContext;  // 补充上下文
}

// 使用示例
await archiveExtractor.extractManual({
  sessionId: 'session_abc',
  startFloor: 10,
  endFloor: 25,
  context: {
    worldSetting: '魔法与科技并存的世界',
    mainCharacters: ['艾琳', '主角'],
  },
});
```

### 2.2 自动触发

根据配置的楼层间隔自动触发提取建议。

```typescript
class ArchiveAutoScheduler {
  private static readonly DEFAULT_FLOOR_INTERVAL = 5;
  private static readonly MIN_FLOOR_INTERVAL = 1;
  private static readonly MAX_FLOOR_INTERVAL = 50;
  
  /**
   * 检查是否应该触发自动提取
   */
  checkAutoExtract(sessionId: string, currentFloor: number): void {
    const config = this.getConfig(sessionId);
    
    if (!config.autoExtract.enabled) return;
    
    const floorsSinceLastExtract = currentFloor - config.lastExtractFloor;
    
    if (floorsSinceLastExtract >= config.autoExtract.floorInterval) {
      // 触发自动提取通知
      this.triggerExtraction(sessionId, {
        startFloor: config.lastExtractFloor + 1,
        endFloor: currentFloor,
        requireConfirmation: config.autoExtract.requireConfirmation,
      });
    }
  }
  
  /**
   * 发送提取建议通知
   */
  private async triggerExtraction(
    sessionId: string, 
    range: FloorRange
  ): Promise<void> {
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

### 2.3 为什么需要确认？

酒馆的叙事可能尚未确定：

- 用户可能会切换最后一楼的 swipe
- 用户可能会删除/重新生成楼层
- AI 生成过程中内容不完整

通过通知确认机制，确保用户在叙事稳定后再进行归档。

---

## 3. 提取接口

### 3.1 提取请求

```typescript
interface ExtractRequest {
  sessionId: string;
  floors: FloorData[];            // 楼层数据
  context?: ExtractionContext;    // 补充上下文
  options?: ExtractOptions;       // 提取选项
}

interface FloorData {
  messageId: number;              // 楼层号
  swipeId: number;                // 消息页 ID
  role: 'user' | 'assistant' | 'system';
  content: string;                // 消息内容
  timestamp: number;              // 时间戳
}

interface ExtractionContext {
  worldSetting?: string;          // 世界观背景
  mainCharacters?: string[];      // 主要角色列表
  timeline?: string;              // 时间线说明
  customInstructions?: string;    // 自定义指令
}

interface ExtractOptions {
  extractEvents?: boolean;        // 提取事件（默认 true）
  extractCharacters?: boolean;    // 提取角色信息（默认 true）
  extractWorld?: boolean;         // 提取世界设定（默认 true）
  generateKeywords?: boolean;     // 生成关键词（默认 true）
}
```

### 3.2 提取结果

```typescript
interface ExtractResult {
  success: boolean;
  
  // 提取的内容
  events: ChatArchive[];          // 事件档案
  characterUpdates: CharacterUpdate[];  // 角色更新
  worldEntries: WorldEntry[];     // 世界设定
  keywords: Keyword[];            // 生成的关键词
  
  // 元数据
  metadata: {
    floorRange: { start: number; end: number };
    extractedAt: number;
    llmTokensUsed: number;
  };
  
  // 错误信息（如果有）
  error?: string;
}

interface CharacterUpdate {
  characterId?: string;           // 已存在角色的 ID（如有）
  name: string;
  updates: Partial<CharacterProfile>;
  isNew: boolean;                 // 是否是新发现的角色
}
```

---

## 4. 提取提示词

### 4.1 提示词注册

```typescript
// src/apps/archives/prompts.ts

export const ARCHIVE_PROMPTS = {
  // 事件提取
  'archive.extract.events': {
    scene: 'archive.extract.events',
    name: '提取事件',
    description: '从聊天记录中提取关键事件',
    systemPrompt: `你是一个专业的叙事分析师，负责从角色扮演聊天记录中提取关键事件。

请分析提供的聊天内容，提取所有重要事件，包括：
- 剧情转折点
- 重要决策
- 关键发现
- 重要对话

对于每个事件，请提供：
1. 事件标题（简洁明了）
2. 事件摘要（100字以内）
3. 事件类型（event/dialogue/discovery/decision）
4. 重要程度（critical/major/normal/minor）
5. 参与者
6. 发生地点（如有）
7. 世界观内的时间（如有）
8. 关键引用（原文片段）`,
    userPromptTemplate: `以下是聊天记录：

{{content}}

{{#if context}}
补充上下文：
{{context}}
{{/if}}

请提取关键事件，以 JSON 格式返回：
\`\`\`json
{
  "events": [
    {
      "title": "事件标题",
      "summary": "事件摘要",
      "type": "event|dialogue|discovery|decision",
      "importance": "critical|major|normal|minor",
      "participants": ["角色1", "角色2"],
      "location": "地点",
      "inWorldTime": "世界观内时间",
      "keyQuotes": ["关键引用1", "关键引用2"],
      "sourceFloors": [楼层号列表]
    }
  ]
}
\`\`\``,
  },
  
  // 角色信息提取
  'archive.extract.characters': {
    scene: 'archive.extract.characters',
    name: '提取角色信息',
    description: '从聊天记录中提取和更新角色信息',
    systemPrompt: `你是一个专业的角色分析师，负责从聊天记录中提取角色信息。

请分析提供的聊天内容，提取或更新角色信息，包括：
- 性格特点
- 能力/技能
- 新发现的事实
- 近期行为
- 角色关系变化`,
    userPromptTemplate: `以下是聊天记录：

{{content}}

{{#if existingProfile}}
已有角色档案：
{{existingProfile}}
{{/if}}

请提取角色信息更新，以 JSON 格式返回：
\`\`\`json
{
  "characters": [
    {
      "name": "角色名",
      "isNew": false,
      "updates": {
        "traits": ["新发现的性格特点"],
        "abilities": ["新发现的能力"],
        "newFacts": [
          { "fact": "新发现的事实", "confidence": "certain|likely|uncertain" }
        ],
        "recentActions": ["近期行为"]
      }
    }
  ]
}
\`\`\``,
  },
  
  // 世界设定提取
  'archive.extract.world': {
    scene: 'archive.extract.world',
    name: '提取世界设定',
    description: '从聊天记录中提取世界观相关设定',
    systemPrompt: `你是一个专业的世界观分析师，负责从聊天记录中提取世界设定。

请分析提供的聊天内容，提取新的世界设定条目，包括：
- 地点描述
- 组织/势力
- 重要物品
- 概念/术语
- 规则/法则
- 历史事件`,
    userPromptTemplate: `以下是聊天记录：

{{content}}

{{#if existingEntries}}
已有世界设定：
{{existingEntries}}
{{/if}}

请提取新的世界设定，以 JSON 格式返回：
\`\`\`json
{
  "entries": [
    {
      "name": "名称",
      "category": "location|organization|item|concept|rule|history",
      "description": "描述",
      "details": { "key": "value" },
      "relatedCharacters": ["相关角色"],
      "sourceFloors": [楼层号列表]
    }
  ]
}
\`\`\``,
  },
  
  // 关键词生成
  'archive.keywords.generate': {
    scene: 'archive.keywords.generate',
    name: '生成关键词',
    description: '从内容中提取关键词',
    systemPrompt: `你是一个关键词提取专家，负责从文本中提取重要的关键词和短语。`,
    userPromptTemplate: `以下是内容：

{{content}}

请提取关键词，以 JSON 格式返回：
\`\`\`json
{
  "keywords": [
    { "text": "关键词", "category": "人物|地点|事件|物品|概念" }
  ]
}
\`\`\``,
  },
};
```

---

## 5. 提取链

使用提示词链（Prompt Chain）实现多步骤提取：

```typescript
// src/apps/archives/chains.ts

import { PromptChain } from '@/types/promptChain';

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

## 6. 提取服务实现

```typescript
// src/services/archiveExtractor.ts

class ArchiveExtractor {
  /**
   * 执行档案提取
   */
  async extract(request: ExtractRequest): Promise<ExtractResult> {
    const { sessionId, floors, context, options } = request;
    
    // 1. 准备楼层内容
    const floorsContent = this.formatFloors(floors);
    
    // 2. 获取已有档案（用于增量更新）
    const existingArchives = await this.getExistingArchives(sessionId);
    
    // 3. 执行提取链
    const chainResult = await promptChainExecutor.execute(
      fullExtractionChain,
      {
        floors: floorsContent,
        context: {
          ...context,
          characters: this.formatCharacters(existingArchives.characters),
          worldEntries: this.formatWorldEntries(existingArchives.worldEntries),
        },
      }
    );
    
    if (!chainResult.success) {
      return {
        success: false,
        events: [],
        characterUpdates: [],
        worldEntries: [],
        keywords: [],
        metadata: this.createMetadata(floors),
        error: chainResult.error,
      };
    }
    
    // 4. 解析结果
    const parsed = this.parseChainResult(chainResult.outputs, floors);
    
    // 5. 生成档案 ID 和元数据
    const enriched = this.enrichResults(parsed, sessionId, floors);
    
    return {
      success: true,
      ...enriched,
      metadata: {
        floorRange: {
          start: Math.min(...floors.map(f => f.messageId)),
          end: Math.max(...floors.map(f => f.messageId)),
        },
        extractedAt: Date.now(),
        llmTokensUsed: chainResult.tokensUsed ?? 0,
      },
    };
  }
  
  /**
   * 格式化楼层内容
   */
  private formatFloors(floors: FloorData[]): string {
    return floors.map(floor => {
      const roleLabel = {
        user: '用户',
        assistant: 'AI',
        system: '系统',
      }[floor.role];
      
      return `[楼层 ${floor.messageId}] ${roleLabel}:\n${floor.content}`;
    }).join('\n\n---\n\n');
  }
  
  /**
   * 解析链执行结果
   */
  private parseChainResult(
    outputs: Record<string, any>,
    floors: FloorData[]
  ): ParsedResult {
    return {
      events: this.parseEvents(outputs.events, floors),
      characterUpdates: this.parseCharacterUpdates(outputs.characterUpdates),
      worldEntries: this.parseWorldEntries(outputs.worldEntries, floors),
      keywords: this.parseKeywords(outputs.keywords),
    };
  }
  
  /**
   * 解析事件数据
   */
  private parseEvents(raw: any, floors: FloorData[]): ChatArchive[] {
    if (!raw?.events) return [];
    
    return raw.events.map((event: any) => ({
      id: generateId('event'),
      type: 'event',
      subType: event.type ?? 'event',
      injectionLevel: 'contextual',
      
      title: event.title,
      summary: event.summary,
      importance: event.importance ?? 'normal',
      participants: event.participants ?? [],
      location: event.location,
      inWorldTime: event.inWorldTime,
      keyQuotes: event.keyQuotes ?? [],
      
      sourceFloors: this.mapSourceFloors(event.sourceFloors, floors),
      realTimestamp: Date.now(),
      status: 'pending',
      keywords: [],
    }));
  }
}

export const archiveExtractor = new ArchiveExtractor();
```

---

## 7. 结果确认流程

### 7.1 待确认状态

提取的档案默认为 `pending` 状态，需要用户确认后才会生效：

```typescript
type EventStatus = 'pending' | 'confirmed' | 'rejected';

interface ConfirmationAction {
  archiveId: string;
  action: 'confirm' | 'reject' | 'edit';
  editData?: Partial<ArchiveBase>;  // 如果需要修改
}

async function confirmExtraction(actions: ConfirmationAction[]): Promise<void> {
  for (const action of actions) {
    const archive = await archiveService.get(action.archiveId);
    if (!archive) continue;
    
    switch (action.action) {
      case 'confirm':
        archive.status = 'confirmed';
        archive.confirmedAt = Date.now();
        await archiveService.save(archive);
        break;
        
      case 'reject':
        archive.status = 'rejected';
        await archiveService.save(archive);
        break;
        
      case 'edit':
        Object.assign(archive, action.editData);
        archive.status = 'confirmed';
        archive.confirmedAt = Date.now();
        await archiveService.save(archive);
        break;
    }
  }
}
```

### 7.2 确认对话框

```text
┌─────────────────────────────────────────┐
│  档案提取结果                   [全部确认] │
├─────────────────────────────────────────┤
│                                         │
│  提取了 3 个事件、2 个角色更新、1 个设定  │
│                                         │
│  ─────────── 事件 ───────────           │
│                                         │
│  ☑ ⭐ 主角获得神秘宝物                   │
│      楼层 45-48 | 重要事件              │
│                           [编辑] [拒绝] │
│                                         │
│  ☑ 📝 发现隐藏通道                      │
│      楼层 32-35 | 普通事件              │
│                           [编辑] [拒绝] │
│                                         │
│  ─────────── 角色更新 ───────────       │
│                                         │
│  ☑ 👤 艾琳 - 新增特点: 知识渊博          │
│                           [编辑] [拒绝] │
│                                         │
│            [取消全部]     [确认选中]     │
└─────────────────────────────────────────┘
```

---

## 8. 语义匹配（高级）

除了基于关键词的精确匹配，还支持语义匹配：

```typescript
class ArchiveSemanticService {
  /**
   * 语义搜索档案
   */
  async semanticSearch(
    query: string, 
    options: SemanticSearchOptions
  ): Promise<ArchiveMatch[]> {
    // 方案 A: 使用 Embedding API（如果可用）
    if (this.embeddingAvailable) {
      return this.searchByEmbedding(query, options);
    }
    
    // 方案 B: LLM 辅助匹配（回退方案）
    return this.searchByLLM(query, options);
  }
  
  /**
   * LLM 辅助匹配
   */
  private async searchByLLM(
    query: string, 
    options: SemanticSearchOptions
  ): Promise<ArchiveMatch[]> {
    const summaries = await this.getArchiveSummaries(options.sessionId);
    
    const result = await aiGenerateService.generate({
      scene: 'archive.semantic.match',
      variables: {
        query,
        archives: JSON.stringify(summaries),
        maxResults: options.maxResults || 5,
      },
    });
    
    return this.parseMatchResult(result);
  }
}
```

---

## 9. 配置选项

```typescript
interface ExtractionConfig {
  // 自动提取设置
  autoExtract: {
    enabled: boolean;             // 是否启用（默认 false）
    floorInterval: number;        // 楼层间隔（默认 5）
    requireConfirmation: boolean; // 需要确认（默认 true）
  };
  
  // 提取选项
  extractOptions: {
    extractEvents: boolean;       // 提取事件（默认 true）
    extractCharacters: boolean;   // 提取角色（默认 true）
    extractWorld: boolean;        // 提取设定（默认 true）
    generateKeywords: boolean;    // 生成关键词（默认 true）
  };
  
  // LLM 设置
  llm: {
    model?: string;               // 使用的模型（默认系统配置）
    maxTokens?: number;           // 最大输出 token
  };
}
```

---

## 10. 最佳实践

### ✅ 推荐做法

1. **确认后归档**：始终让用户确认归档内容，避免归档不稳定的叙事
2. **增量更新**：角色档案采用增量更新，保留历史记录
3. **合理间隔**：自动提取间隔设为 5-10 楼，避免过于频繁
4. **提供上下文**：首次提取时提供世界观背景，提高提取质量

### ❌ 避免做法

1. **过度提取**：不是每个对话都值得归档，关注关键事件
2. **忽略来源**：始终追踪数据来源，便于回溯
3. **跳过确认**：自动确认可能归档错误信息
