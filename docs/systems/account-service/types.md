# 类型定义

> 本文档与 `src/types/account.ts` 保持同步

## 目录

- [作用域类型](#作用域类型)
- [角色实体](#角色实体)
- [用户画像扩展](#用户画像扩展)
- [平台账号](#平台账号)
- [社交关系](#社交关系)
- [会话上下文](#会话上下文)
- [输入类型](#输入类型)
- [输出类型](#输出类型)

---

## 作用域类型

```typescript
/**
 * 实体作用域
 * 决定实体在哪些会话中可见
 */
export type EntityScope =
  | 'session'      // 仅在创建它的会话中可见（默认）
  | 'global'       // 所有会话共享
  | 'character';   // 相同角色卡的会话共享

/**
 * 账号作用域
 * 决定账号在哪些会话中可见
 * 不能比所属实体的作用域"更全局"
 */
export type AccountScope =
  | 'session'      // 仅在创建它的会话中可见
  | 'global'       // 所有会话共享
  | 'character';   // 相同角色卡的会话共享
```

### 作用域说明

| 作用域 | 说明 | 适用场景 |
| ----------- | ---------------------------- | ------------------------------ |
| `session` | 仅在创建它的会话中可见 | 普通 NPC、路人账号、临时角色 |
| `character` | 相同角色卡的会话共享 | 玩家的世界专属身份、主角关联 NPC |
| `global` | 所有会话共享 | 玩家实体、系统角色、跨世界 NPC |

---

## 基础枚举类型

```typescript
/**
 * 实体来源
 * 记录实体是如何创建的
 */
export type EntitySource =
  | 'character_card'   // 从角色卡导入
  | 'chat'             // 聊天中首次出现
  | 'social'           // 社交媒体生成
  | 'manual'           // 手动创建
  | 'system';          // 系统预置

/**
 * 实体类型
 */
export type EntityType = 'npc' | 'player';

/**
 * 性别类型
 */
export type Gender = 'male' | 'female' | 'other' | 'unknown';

/**
 * 关系类型
 */
export type RelationType =
  | 'follow'     // 关注（单向）
  | 'friend'     // 好友（双向，会自动创建两条记录）
  | 'block'      // 拉黑
  | 'family'     // 家人
  | 'colleague'; // 同事
```

---

## 角色实体

```typescript
/**
 * 角色实体
 * 系统中的"人"，是所有平台账号的源头
 * 无论是 NPC 还是玩家扮演的身份，都是一个 Entity
 *
 * 关于作用域：
 * - NPC 实体可以是任意作用域
 * - 玩家实体（type: 'player'）**必须**是 global
 *   （玩家这个"人"跨越所有世界，但在各平台的账号可以不同）
 */
export interface CharacterEntity {
  /** 唯一标识（UUID） */
  id: string;
  
  /** 实体类型：NPC 或玩家 */
  type: EntityType;
  
  // ========== 基础信息（作为各平台的默认值）==========
  
  /** 显示名 */
  displayName: string;
  
  /** 头像 URI (internal://... 或 https://...) */
  avatar?: string;
  
  /** 简介/签名 */
  bio?: string;
  
  /** 性别 */
  gender?: Gender;
  
  // ========== 扩展画像信息 ==========
  
  /** 一句话介绍/标语，如 "热爱生活的北漂程序员" */
  tagline?: string;
  
  /** 详细人设画像 */
  profile?: CharacterProfile;
  
  /** 角色背景故事（供 LLM 参考） */
  backstory?: string;
  
  // ========== 作用域控制 ==========
  
  /** 可见性作用域 */
  scope: EntityScope;
  
  /** scope='session' 时必填：会话 ID */
  scopeSessionId?: string;
  
  /** scope='character' 时使用：角色卡 ID */
  scopeCharacterCardId?: string;
  
  // ========== 元信息 ==========
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 更新时间戳 */
  updatedAt: number;
  
  /** 实体来源 */
  source: EntitySource;
  
  // ========== 关联信息 ==========
  
  /** 与 SillyTavern 角色卡关联（可选，用于同步） */
  linkedCharacterCardId?: string;
  
  /** 扩展属性（供各 App 自定义使用） */
  metadata?: Record<string, unknown>;
}
```

---

## 用户画像扩展

### 画像枚举类型

```typescript
/**
 * 年龄段
 */
export type AgeRange =
  | 'teen'       // 13-17
  | 'young'      // 18-24
  | 'adult'      // 25-34
  | 'middle'     // 35-44
  | 'mature'     // 45-54
  | 'senior'     // 55+
  | 'unknown';

/**
 * 活跃度等级
 */
export type ActivityLevel =
  | 'dormant'    // 休眠用户 (几乎不活跃)
  | 'low'        // 低活跃 (偶尔登录)
  | 'medium'     // 中等活跃 (日常使用)
  | 'high'       // 高活跃 (频繁互动)
  | 'super';     // 超级活跃 (重度用户)

/**
 * 账号等级/影响力
 */
export type InfluenceLevel =
  | 'nobody'     // 路人 (0-100 粉丝)
  | 'newbie'     // 新人 (100-1000)
  | 'rising'     // 潜力 (1000-10000)
  | 'small_v'    // 小V (1万-10万)
  | 'medium_v'   // 中V (10万-100万)
  | 'big_v'      // 大V (100万+)
  | 'super_v';   // 顶流 (1000万+)

/**
 * 性格类型 (简化版)
 */
export type PersonalityType =
  | 'enthusiast'    // 热情派 - 积极互动，常点赞评论
  | 'observer'      // 观察者 - 多看少说，偶尔互动
  | 'creator'       // 创作者 - 专注产出内容
  | 'debater'       // 辩论家 - 爱发表观点，常争论
  | 'supporter'     // 支持者 - 粉丝型，常支持他人
  | 'critic'        // 批评家 - 挑剔，爱找问题
  | 'neutral';      // 中立派 - 理性客观

/**
 * 兴趣领域
 */
export type InterestDomain =
  | 'tech'          // 科技数码
  | 'entertainment' // 娱乐明星
  | 'gaming'        // 游戏电竞
  | 'anime'         // 动漫二次元
  | 'food'          // 美食
  | 'travel'        // 旅行
  | 'fashion'       // 时尚穿搭
  | 'fitness'       // 健身运动
  | 'finance'       // 财经投资
  | 'education'     // 教育学习
  | 'news'          // 时事新闻
  | 'life'          // 生活日常
  | 'art'           // 艺术文化
  | 'pet'           // 宠物
  | 'parenting'     // 母婴育儿
  | 'car'           // 汽车
  | 'other';        // 其他

/**
 * 内容风格
 */
export type ContentStyle =
  | 'formal'        // 正式严肃
  | 'casual'        // 轻松随意
  | 'humorous'      // 幽默搞笑
  | 'emotional'     // 情感细腻
  | 'professional'  // 专业干货
  | 'controversial' // 争议性强
  | 'clickbait';    // 标题党
```

### 画像数据结构

```typescript
/**
 * 行为倾向配置
 */
export interface BehaviorTendencies {
  /** 点赞频率 (0-100) */
  likeFrequency: number;
  /** 评论频率 (0-100) */
  commentFrequency: number;
  /** 转发频率 (0-100) */
  repostFrequency: number;
  /** 原创内容比例 (0-100) */
  originalContentRatio: number;
  /** 争议容忍度 (0-100) */
  controversyTolerance: number;
}

/**
 * 角色详细画像
 * 用于丰富角色的人设信息
 */
export interface CharacterProfile {
  // === 人口统计学特征 ===
  /** 年龄段 */
  ageRange?: AgeRange;
  /** 职业，如 "程序员"、"学生"、"自由职业" */
  occupation?: string;
  /** 所在地，如 "北京"、"海外" */
  location?: string;

  // === 兴趣与风格 ===
  /** 兴趣领域列表 (最多5个) */
  interests: InterestDomain[];
  /** 内容风格 */
  contentStyle?: ContentStyle;
  /** 性格类型 */
  personality?: PersonalityType;

  // === 社交特征 ===
  /** 活跃度 */
  activityLevel: ActivityLevel;
  /** 影响力等级 */
  influenceLevel: InfluenceLevel;

  // === 标签系统 ===
  /** 自定义标签，如 ["追星族", "程序媛", "猫奴"] */
  tags: string[];

  // === 行为倾向 ===
  behaviorTendencies?: BehaviorTendencies;
}
```

---

## 平台账号

### 平台特定数据

```typescript
/**
 * 微博认证类型 (详细)
 */
export type WeiboVerifyType =
  | 'none'                  // 无认证
  | 'personal_celebrity'    // 个人认证-名人
  | 'personal_kol'          // 个人认证-KOL/网红/博主
  | 'personal_expert'       // 个人认证-专业人士
  | 'personal_writer'       // 个人认证-作家/自媒体人
  | 'personal_artist'       // 个人认证-艺术家/设计师
  | 'personal_other'        // 个人认证-其他
  | 'org_enterprise'        // 机构认证-企业
  | 'org_media'             // 机构认证-媒体
  | 'org_government'        // 机构认证-政府
  | 'org_school'            // 机构认证-学校/教育机构
  | 'org_ngo'               // 机构认证-公益组织
  | 'org_other'             // 机构认证-其他
  | 'super_topic_host';     // 特殊认证-超话主持人

/**
 * 发布频率
 */
export type PostFrequency = 'daily' | 'weekly' | 'monthly' | 'rarely';

/**
 * 增长趋势
 */
export type GrowthTrend = 'rising' | 'stable' | 'declining';

/**
 * 平台特定数据
 */
export interface PlatformSpecificData {
  // === 微博特有 ===
  followers?: number;
  following?: number;
  postsCount?: number;
  verified?: boolean;
  verifyType?: 'personal' | 'org' | 'media' | WeiboVerifyType;
  verifyDescription?: string;  // 认证描述
  vipLevel?: number;           // 会员等级 (0-7)
  isYearVip?: boolean;         // 是否年费会员

  // === B站特有 ===
  level?: number;
  coins?: number;
  isUploader?: boolean;
  totalViews?: number;
  isBigVip?: boolean;

  // === 通用统计数据 ===
  joinedAt?: number;           // 入驻时间
  isActive?: boolean;
  avgLikesPerPost?: number;
  avgCommentsPerPost?: number;
  avgRepostsPerPost?: number;
  engagementRate?: number;     // 互动率 (0-100)
  activeHours?: number[];      // 活跃时段 (0-23)
  postFrequency?: PostFrequency;

  // === 画像扩展 ===
  contentDomains?: InterestDomain[];
  hasOriginalContent?: boolean;
  accountTags?: string[];
  fansProfile?: FansProfileSummary;
  growthData?: AccountGrowthData;

  // === 扩展字段 ===
  [key: string]: unknown;
}
```

### 平台账号实体

```typescript
/**
 * 平台账号
 * 某个角色实体在某个具体平台上的身份
 * 一个 Entity 可以有多个 Platform Account
 *
 * 关于作用域：
 * - 账号有独立的作用域，可以与实体不同
 * - 但账号作用域不能比实体作用域"更全局"
 * - 例如：session 实体的账号只能是 session
 * - 例如：global 实体的账号可以是 session/character/global
 */
export interface PlatformAccount {
  /** 唯一标识（UUID） */
  id: string;
  
  /** 关联的 CharacterEntity ID */
  entityId: string;
  
  /** 平台标识: 'weibo' | 'bilibili' | 'chat' | ... */
  platformId: string;
  
  // ========== 平台特定身份信息（可覆盖 Entity 默认值）==========
  
  /** 平台唯一标识 @handle */
  handle?: string;
  
  /** 平台显示昵称 */
  nickname?: string;
  
  /** 平台专用头像（为空则使用 Entity 头像） */
  avatarOverride?: string;
  
  /** 平台专用简介 */
  bioOverride?: string;
  
  // ========== 作用域控制（独立于实体）==========
  
  /** 账号作用域 */
  scope: AccountScope;
  
  /** scope='session' 时必填 */
  scopeSessionId?: string;
  
  /** scope='character' 时必填 */
  scopeCharacterCardId?: string;
  
  // ========== 平台特定属性 ==========
  
  /** 平台特定数据 */
  platformData?: PlatformSpecificData;
  
  // ========== 档案绑定（与 Archives App 联动）==========
  
  /** 绑定的档案 ID 列表 */
  boundArchiveIds?: string[];
  
  /** 档案注入配置 */
  archiveInjection?: {
    /** 是否启用档案注入（生成内容时） */
    enabled: boolean;
    /** 最大注入 token 数 */
    maxTokens: number;
    /** 是否包含关联档案 */
    includeRelated: boolean;
  };
  
  // ========== 元信息 ==========
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 更新时间戳 */
  updatedAt: number;
}
```

---

## 社交关系

```typescript
/**
 * 社交关系
 * 描述两个平台账号之间的社交关系（而非实体之间）
 *
 * 注意：关系绑定在 PlatformAccount 之间，而非 Entity 之间
 * 这样可以实现：同一个人在不同世界有不同的社交圈
 */
export interface SocialRelation {
  /** 唯一标识（UUID） */
  id: string;
  
  /** 发起方 PlatformAccount ID */
  fromAccountId: string;
  
  /** 目标方 PlatformAccount ID */
  toAccountId: string;
  
  /** 关系类型 */
  type: RelationType;
  
  /** 关系强度/亲密度（用于智能排序）0-100 */
  strength?: number;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 扩展属性 */
  metadata?: Record<string, unknown>;
}
```

### 为什么关系绑定在账号而非实体？

因为同一个玩家在不同世界可能有不同的社交圈：

```text
在"霸道总裁"世界:
  玩家的微博粉丝 → 白领群体

在"剑仙传"世界:
  玩家的微博粉丝 → 修仙者群体
```

---

## 会话上下文

```typescript
/**
 * 会话上下文
 * 用于判断实体/账号可见性
 */
export interface SessionContext {
  /** 当前会话 ID */
  sessionId: string;
  
  /** 当前角色卡 ID（可选） */
  characterCardId?: string;
}
```

---

## 输入类型

```typescript
/**
 * 创建实体输入
 */
export interface CreateEntityInput {
  type: EntityType;
  displayName: string;
  avatar?: string;
  bio?: string;
  gender?: Gender;
  source: EntitySource;
  
  // 作用域（玩家实体会被强制设为 global）
  scope?: EntityScope;  // 不指定则自动推断
  scopeSessionId?: string;
  scopeCharacterCardId?: string;
  
  linkedCharacterCardId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 创建平台账号输入
 */
export interface CreatePlatformAccountInput {
  handle?: string;
  nickname?: string;
  avatarOverride?: string;
  bioOverride?: string;
  
  // 作用域
  scope: AccountScope;  // 必填，但会验证是否合法
  scopeSessionId?: string;
  scopeCharacterCardId?: string;
  
  platformData?: PlatformSpecificData;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * 搜索选项
 */
export interface SearchOptions extends QueryOptions {
  fields?: ('displayName' | 'bio' | 'handle')[];
}
```

---

## 输出类型

```typescript
/**
 * 缺失账号信息
 * 当玩家进入新世界但没有平台账号时返回
 */
export interface MissingAccountInfo {
  /** 平台 ID */
  platformId: string;
  
  /** 平台显示名 */
  platformName: string;
  
  /** 当前会话上下文 */
  context: SessionContext;
  
  /** 建议的作用域 */
  suggestedScope: AccountScope;
}

/**
 * 完整档案
 * 合并 Entity 和 Account 信息，用于展示
 */
export interface FullProfile {
  /** 实体信息 */
  entity: CharacterEntity;
  
  /** 账号信息 */
  account: PlatformAccount;
  
  /** 合并后的显示信息 */
  displayName: string;  // account.nickname || entity.displayName
  avatar: string;       // account.avatarOverride || entity.avatar
  bio: string;          // account.bioOverride || entity.bio
}

/**
 * 生成的用户档案（由 UserPool 生成器返回）
 */
export interface GeneratedProfile {
  displayName: string;
  nickname?: string;
  avatar?: string;
  bio?: string;
  handle?: string;
  gender?: Gender;
  /** 一句话标语 */
  tagline?: string;
  /** 详细画像 */
  profile?: CharacterProfile;
}

/**
 * 生成上下文（传给 UserPool）
 */
export interface GenerationContext {
  platform?: string;
  topic?: string;
  role?: string;
  [key: string]: unknown;
}
```

---

## 服务接口摘要

```typescript
/**
 * 账号服务接口（主要方法）
 */
export interface IAccountService {
  // 会话上下文
  setSessionContext(context: SessionContext): void;
  getSessionContext(): SessionContext | null;
  
  // 作用域验证
  validateAccountScope(entityScope: EntityScope, accountScope: AccountScope): boolean;
  isEntityVisible(entity: CharacterEntity, context?: SessionContext): boolean;
  isAccountVisible(account: PlatformAccount, entity: CharacterEntity, context?: SessionContext): boolean;
  
  // 实体管理
  createEntity(data: CreateEntityInput): Promise<CharacterEntity>;
  getEntity(id: string): Promise<CharacterEntity | null>;
  updateEntity(id: string, data: Partial<CharacterEntity>): Promise<CharacterEntity>;
  deleteEntity(id: string): Promise<void>;
  getVisibleEntities(context?: SessionContext): Promise<CharacterEntity[]>;
  searchEntities(query: string, options?: SearchOptions): Promise<CharacterEntity[]>;
  getPlayerEntity(): Promise<CharacterEntity | null>;
  getOrCreatePlayerEntity(playerName: string): Promise<CharacterEntity>;
  
  // 平台账号管理
  createPlatformAccount(entityId: string, platformId: string, data: CreatePlatformAccountInput): Promise<PlatformAccount>;
  getPlatformAccount(id: string): Promise<PlatformAccount | null>;
  findAccountByHandle(platformId: string, handle: string): Promise<PlatformAccount | null>;
  getVisibleAccounts(platformId: string, context?: SessionContext): Promise<PlatformAccount[]>;
  findPlayerAccountForContext(platformId: string, context?: SessionContext): Promise<PlatformAccount | null>;
  checkMissingPlayerAccount(platformId: string): Promise<MissingAccountInfo | null>;
  updatePlatformAccount(id: string, data: Partial<PlatformAccount>): Promise<PlatformAccount>;
  deletePlatformAccount(id: string): Promise<void>;
  
  // 社交关系管理
  followAccount(fromAccountId: string, toAccountId: string): Promise<SocialRelation>;
  unfollowAccount(fromAccountId: string, toAccountId: string): Promise<void>;
  addFriendAccounts(accountIdA: string, accountIdB: string): Promise<void>;
  removeFriendAccounts(accountIdA: string, accountIdB: string): Promise<void>;
  getFollowingAccounts(accountId: string): Promise<PlatformAccount[]>;
  getFollowerAccounts(accountId: string): Promise<PlatformAccount[]>;
  getFriendAccounts(accountId: string): Promise<PlatformAccount[]>;
  hasAccountRelation(fromAccountId: string, toAccountId: string, type: RelationType): Promise<boolean>;
  
  // 便捷方法
  getFullProfile(accountId: string): Promise<FullProfile | null>;
  syncFromCharacterCard(cardId: string, cardData: { name: string; avatar?: string; description?: string }): Promise<CharacterEntity>;
  getStats(): Promise<{ totalEntities: number; totalAccounts: number; totalRelations: number; ... }>;
}
```
