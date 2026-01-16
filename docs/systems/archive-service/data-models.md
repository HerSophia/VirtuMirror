# 档案服务 - 数据模型

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 档案基础类型 (ArchiveBase)

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

/**
 * 档案类型
 */
type ArchiveType = 'event' | 'character' | 'world' | 'dialogue' | 'discovery';

/**
 * 档案基础接口
 */
interface ArchiveBase {
  id: string;
  sessionId: string;              // 关联 Bridge Session
  type: ArchiveType;              // 档案类型
  
  // 注入控制
  injectionLevel: InjectionLevel; // 注入级别
  injectionPriority?: number;     // 同级别内的优先级 (0-100，默认 50)
  
  // 账号绑定
  boundAccountIds?: string[];     // 绑定的社交账号 ID
  
  // 元数据
  keywords: string[];             // 关键词（用于 contextual 匹配）
  createdAt: number;              // 创建时间
  lastUpdated: number;            // 最后更新时间
  
  // 去重辅助
  contentHash?: string;           // 内容摘要的哈希，用于语义去重
}
```

---

## 2. 事件档案 (ChatArchive)

从聊天记录中提取的关键事件。

```typescript
/**
 * 事件档案子类型
 */
type EventSubType = 'event' | 'dialogue' | 'discovery' | 'decision';

/**
 * 事件重要性
 */
type EventImportance = 'critical' | 'major' | 'normal' | 'minor';

/**
 * 事件状态
 */
type EventStatus = 'pending' | 'confirmed' | 'rejected';

/**
 * 楼层引用
 */
interface FloorReference {
  messageId: number;              // 楼层号
  swipeId: number;                // 消息页 ID
  excerpt?: string;               // 摘录片段
}

/**
 * 事件档案
 */
interface ChatArchive extends ArchiveBase {
  type: 'event';
  subType: EventSubType;          // 事件子类型
  
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
  inWorldTime?: string;           // 世界观内的时间（如：「黄昏时分」）
  inWorldDate?: string;           // 世界观内的日期（如：「第三天」）
  realTimestamp: number;          // 真实时间戳
  
  // 元数据
  location?: string;              // 发生地点
  importance: EventImportance;    // 重要程度
  
  // 状态
  status: EventStatus;            // 确认状态
}
```

### 2.1 事件子类型说明

| 子类型 | 说明 | 示例 |
| ------ | ---- | ---- |
| `event` | 剧情事件 | 主角获得神秘宝物 |
| `dialogue` | 重要对话 | 与导师的关键谈话 |
| `discovery` | 发现/揭示 | 发现隐藏通道 |
| `decision` | 重要决策 | 主角决定离开学院 |

### 2.2 重要程度说明

| 级别 | 说明 | 注入优先级 |
| ---- | ---- | ---------- |
| `critical` | 关键剧情转折 | 最高 |
| `major` | 重要事件 | 高 |
| `normal` | 普通事件 | 中 |
| `minor` | 次要细节 | 低 |

---

## 3. 角色档案 (CharacterProfile)

动态维护的角色信息。

```typescript
/**
 * 角色类型
 */
type CharacterRole = 'protagonist' | 'main' | 'supporting' | 'npc';

/**
 * 事实可信度
 */
type FactConfidence = 'certain' | 'likely' | 'uncertain';

/**
 * 事实条目
 */
interface FactEntry {
  fact: string;                   // 事实内容
  sourceFloor?: number;           // 来源楼层
  learnedAt: number;              // 发现时间
  confidence: FactConfidence;     // 可信度
}

/**
 * 行为条目
 */
interface ActionEntry {
  action: string;                 // 行为描述
  sourceFloor: number;            // 来源楼层
  timestamp: number;              // 时间戳
}

/**
 * 更新记录
 */
interface UpdateRecord {
  field: string;                  // 更新的字段
  oldValue: unknown;              // 旧值
  newValue: unknown;              // 新值
  sourceFloor?: number;           // 来源楼层
  timestamp: number;              // 时间戳
}

/**
 * 角色档案
 */
interface CharacterProfile extends ArchiveBase {
  type: 'character';
  
  // 基础信息
  name: string;                   // 名称
  aliases: string[];              // 别名/昵称
  avatar?: string;                // 头像 URL
  role: CharacterRole;            // 角色类型
  
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
```

### 3.1 角色类型说明

| 类型 | 说明 | 注入优先级 |
| ---- | ---- | ---------- |
| `protagonist` | 主角（玩家角色） | 最高 |
| `main` | 主要角色 | 高 |
| `supporting` | 配角 | 中 |
| `npc` | 普通 NPC | 低 |

---

## 4. 世界设定 (WorldEntry)

世界观相关的设定条目。

```typescript
/**
 * 世界设定分类
 */
type WorldEntryCategory = 
  | 'location'      // 地点
  | 'organization'  // 组织
  | 'item'          // 物品
  | 'concept'       // 概念
  | 'rule'          // 规则
  | 'history';      // 历史

/**
 * 世界设定
 */
interface WorldEntry extends ArchiveBase {
  type: 'world';
  
  // 分类
  category: WorldEntryCategory;
  
  // 内容
  name: string;                   // 名称
  description: string;            // 描述
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

### 4.1 分类说明

| 分类 | 说明 | 示例 |
| ---- | ---- | ---- |
| `location` | 地点 | 魔法学院、黑暗森林 |
| `organization` | 组织 | 魔法师公会、暗影教团 |
| `item` | 物品 | 远古法杖、神秘卷轴 |
| `concept` | 概念 | 元素魔法、契约规则 |
| `rule` | 规则 | 禁忌魔法的代价 |
| `history` | 历史 | 千年前的大战 |

---

## 5. 关键词 (Keyword)

统一管理的关键词系统。

```typescript
/**
 * 关键词
 */
interface Keyword {
  id: string;
  sessionId: string;              // 关联会话
  
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

---

## 6. 归档配置 (ArchiveConfig)

会话级别的归档配置。

```typescript
/**
 * 归档配置
 */
interface ArchiveConfig {
  sessionId: string;
  
  // 自动化设置
  autoExtract: {
    enabled: boolean;             // 是否启用自动提取
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
  lastExtractTime: number;        // 上次提取时间
  totalExtractCount: number;      // 总提取次数
}
```

---

## 7. 数据库表设计

使用 IndexedDB (Dexie) 进行持久化存储。

```typescript
// src/services/database/archiveDatabase.ts

import Dexie, { Table } from 'dexie';

class ArchiveDatabase extends Dexie {
  // 表定义
  archives!: Table<ArchiveBase>;
  keywords!: Table<Keyword>;
  configs!: Table<ArchiveConfig>;
  
  constructor() {
    super('ArchiveDB');
    
    this.version(1).stores({
      // 档案表 - 统一存储所有类型
      archives: 'id, sessionId, type, [sessionId+type], injectionLevel, *keywords, *boundAccountIds',
      
      // 关键词表
      keywords: 'id, sessionId, text, [sessionId+text], source',
      
      // 配置表
      configs: 'sessionId',
    });
  }
}

export const archiveDB = new ArchiveDatabase();
```

### 7.1 索引说明

| 表 | 索引 | 用途 |
| -- | ---- | ---- |
| archives | `sessionId` | 按会话筛选 |
| archives | `type` | 按类型筛选 |
| archives | `[sessionId+type]` | 复合查询 |
| archives | `injectionLevel` | 查找 always 级别 |
| archives | `*keywords` | 关键词匹配（多值索引） |
| archives | `*boundAccountIds` | 账号绑定查询（多值索引） |
| keywords | `[sessionId+text]` | 防止重复关键词 |

---

## 8. 类型导出

```typescript
// src/types/archive.ts

export type {
  InjectionLevel,
  ArchiveType,
  ArchiveBase,
  
  EventSubType,
  EventImportance,
  EventStatus,
  FloorReference,
  ChatArchive,
  
  CharacterRole,
  FactConfidence,
  FactEntry,
  ActionEntry,
  UpdateRecord,
  CharacterProfile,
  
  WorldEntryCategory,
  WorldEntry,
  
  Keyword,
  ArchiveConfig,
};
```
