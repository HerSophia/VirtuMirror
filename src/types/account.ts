/**
 * 账号系统核心类型定义
 * 对应文档: docs/systems/account-service.md
 * 画像扩展: docs/systems/user-profile-extension.md
 */

// ==========================================
// 1. 作用域类型
// ==========================================

/**
 * 实体作用域 - 控制角色实体的可见性
 */
export type EntityScope =
  | 'session'      // 仅在创建它的会话中可见（默认）
  | 'global'       // 所有会话共享
  | 'character';   // 相同角色卡的会话共享

/**
 * 账号作用域 - 控制平台账号的可见性
 * 
 * 注意：账号作用域不能比实体作用域"更全局"
 * 例如：session 实体的账号不能是 global
 */
export type AccountScope =
  | 'session'      // 仅在创建它的会话中可见
  | 'global'       // 所有会话共享
  | 'character';   // 相同角色卡的会话共享

// ==========================================
// 2. 角色实体 (Character Entity)
// ==========================================

/**
 * 实体来源类型
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

// ==========================================
// 2.5 用户画像扩展类型
// ==========================================

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

/**
 * 角色实体 - 系统中的"人"，是所有平台账号的源头
 *
 * 关于作用域：
 * - NPC 实体可以是任意作用域
 * - 玩家实体（type: 'player'）**必须**是 global
 *   （玩家这个"人"跨越所有世界，但在各平台的账号可以不同）
 */
export interface CharacterEntity {
  /** UUID */
  id: string;
  /** NPC 或玩家扮演的身份 */
  type: EntityType;

  // === 基础信息（作为各平台的默认值）===
  /** 显示名 */
  displayName: string;
  /** 头像 URI (internal://... 或 https://...) */
  avatar?: string;
  /** 简介/签名 */
  bio?: string;
  /** 性别 */
  gender?: Gender;

  // === 扩展画像信息 ===
  /** 一句话介绍/标语，如 "热爱生活的北漂程序员" */
  tagline?: string;
  /** 详细人设画像 */
  profile?: CharacterProfile;
  /** 角色背景故事（供 LLM 参考） */
  backstory?: string;

  // === 作用域控制 ===
  /** 可见性作用域 */
  scope: EntityScope;
  /** scope='session' 时必填，关联的会话 ID */
  scopeSessionId?: string;
  /** scope='character' 时使用，关联的角色卡 ID */
  scopeCharacterCardId?: string;

  // === 元信息 ===
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 首次创建来源 */
  source: EntitySource;

  // === 与 SillyTavern 角色卡关联（可选，用于同步）===
  /** 关联的角色卡 ID（用于从角色卡导 */
  linkedCharacterCardId?: string;

  // === 扩展属性（供各 App 自定义使用）===
  metadata?: Record<string, unknown>;
}

// ==========================================
// 3. 平台账号 (Platform Account)
// ==========================================

/**
 * 微博认证类型 (详细)
 * @see src/apps/weibo/types.ts 保持同步
 */
export type WeiboVerifyType =
  | 'none'                  // 无认证
  | 'personal_celebrity'    // 个人认证-名人（演员、歌手、运动员等）
  | 'personal_kol'          // 个人认证-KOL/网红/博主
  | 'personal_expert'       // 个人认证-专业人士
  | 'personal_professional' // 个人认证-专业人士（别名）
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
 * 粉丝画像摘要
 */
export interface FansProfileSummary {
  /** 年龄分布 (%) */
  ageDistribution?: Partial<Record<AgeRange, number>>;
  /** 性别分布 (%) */
  genderDistribution?: Partial<Record<Gender, number>>;
  /** 粉丝主要兴趣 */
  topInterests?: InterestDomain[];
  /** 粉丝整体活跃度 */
  activeLevel?: ActivityLevel;
}

/**
 * 账号增长数据
 */
export interface AccountGrowthData {
  /** 日均涨粉 */
  dailyGain?: number;
  /** 周均涨粉 */
  weeklyGain?: number;
  /** 月均涨粉 */
  monthlyGain?: number;
  /** 增长趋势 */
  growthTrend?: GrowthTrend;
}

/**
 * 平台特定数据
 */
export interface PlatformSpecificData {
  // === 微博特有 ===
  followers?: number;
  following?: number;
  postsCount?: number;
  verified?: boolean;
  /**
   * 认证类型
   * - personal: 个人认证 (包含 personal_celebrity, personal_kol 等子类型)
   * - org: 机构认证 (包含 org_enterprise, org_media 等子类型)
   * - media: 媒体认证
   * - 或使用微博专用的 WeiboVerifyType
   */
  verifyType?: 'personal' | 'org' | 'media' | WeiboVerifyType;
  /** 认证描述，如"知名演员"、"XX公司官方账号" */
  verifyDescription?: string;
  /** 会员等级 (0-7) */
  vipLevel?: number;
  /** 是否年费会员 */
  isYearVip?: boolean;

  // === B站特有 ===
  level?: number;
  coins?: number;
  /** 是否是UP主 */
  isUploader?: boolean;
  /** 总播放量 */
  totalViews?: number;
  /** 是否大会员 */
  isBigVip?: boolean;

  // === 通用统计数据 ===
  /** 入驻时间 */
  joinedAt?: number;
  /** 是否活跃 */
  isActive?: boolean;
  /** 平均点赞数/帖 */
  avgLikesPerPost?: number;
  /** 平均评论数/帖 */
  avgCommentsPerPost?: number;
  /** 平均转发数/帖 */
  avgRepostsPerPost?: number;
  /** 互动率 (0-100) */
  engagementRate?: number;
  /** 活跃时段 (0-23) */
  activeHours?: number[];
  /** 发布频率 */
  postFrequency?: PostFrequency;

  // === 画像扩展 ===
  /** 内容领域 */
  contentDomains?: InterestDomain[];
  /** 是否有原创内容 */
  hasOriginalContent?: boolean;
  /** 账号标签 */
  accountTags?: string[];
  /** 粉丝画像摘要 */
  fansProfile?: FansProfileSummary;
  /** 增长数据 */
  growthData?: AccountGrowthData;

  // === 扩展字段 ===
  [key: string]: unknown;
}

/**
 * 平台账号 - 某个角色实体在某个具体平台上的身份
 * 
 * 关于作用域：
 * - 账号有独立的作用域，可以与实体不同
 * - 但账号作用域不能比实体作用域"更全局"
 * - 例如：session 实体的账号只能是 session
 * - 例如：global 实体的账号可以是 session/character/global
 * 
 * 典型场景：
 * - 玩家实体是 global，但在不同角色卡有不同的微博账号
 *   → 每个微博账号的 scope 是 'character'
 */
export interface PlatformAccount {
  /** UUID */
  id: string;
  /** 关联的 CharacterEntity ID */
  entityId: string;
  /** 平台标识: 'weibo' | 'bilibili' | 'chat' | ... */
  platformId: string;
  
  // === 平台特定身份信息（可覆盖 Entity 默认值）===
  /** 平台唯一标识 @handle */
  handle?: string;
  /** 平台显示昵称 */
  nickname?: string;
  /** 平台专用头像（为空则使用 Entity 头像）*/
  avatarOverride?: string;
  /** 平台专用简介 */
  bioOverride?: string;
  
  // === 作用域控制（独立于实体）===
  /** 账号可见性作用域 */
  scope: AccountScope;
  /** scope='session' 时必填 */
  scopeSessionId?: string;
  /** scope='character' 时必填 */
  scopeCharacterCardId?: string;
  
  // === 平台特定属性 ===
  platformData?: PlatformSpecificData;
  
  // === 档案绑定（与 Archives App 联动）===
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
  
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ==========================================
// 4. 社交关系 (Social Relation)
// ==========================================

/**
 * 关系类型
 */
export type RelationType =
  | 'follow'           // A 关注 B（单向）
  | 'friend'           // A 和 B 是好友（双向，会自动创建两条记录）
  | 'block'            // A 屏蔽 B
  | 'family'           // 家人关系
  | 'colleague';       // 同事关系

/**
 * 社交关系 - 描述两个角色实体之间的社交关系
 * 
 * 注意：关系也有作用域概念
 * - 关系绑定在 PlatformAccount 之间，而非 Entity 之间
 * - 这样可以实现：同一个人在不同世界有不同的社交圈
 */
export interface SocialRelation {
  /** UUID */
  id: string;
  /** 发起方 PlatformAccount ID */
  fromAccountId: string;
  /** 目标方 PlatformAccount ID */
  toAccountId: string;
  /** 关系类型 */
  type: RelationType;
  
  /** 关系强度/亲密度（用于智能排序）0-100 */
  strength?: number;
  
  /** 创建时间 */
  createdAt: number;
  /** 扩展元信息 */
  metadata?: Record<string, unknown>;
}

// ==========================================
// 5. 辅助类型
// ==========================================

/**
 * 创建实体的输入参数
 */
export interface CreateEntityInput {
  type: EntityType;
  displayName: string;
  avatar?: string;
  bio?: string;
  gender?: Gender;
  source: EntitySource;
  
  // 作用域（玩家实体会被强制设为 global）
  scope?: EntityScope;
  scopeSessionId?: string;
  scopeCharacterCardId?: string;
  
  linkedCharacterCardId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 创建平台账号的输入参数
 */
export interface CreatePlatformAccountInput {
  handle?: string;
  nickname?: string;
  avatarOverride?: string;
  bioOverride?: string;
  
  // 作用域
  scope: AccountScope;
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

/**
 * 完整用户档案（合并 Entity 和 Account）
 */
export interface FullProfile {
  entity: CharacterEntity;
  account: PlatformAccount;
  // 合并后的显示信息
  displayName: string;       // account.nickname || entity.displayName
  avatar: string;            // account.avatarOverride || entity.avatar
  bio: string;               // account.bioOverride || entity.bio
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
 * 生成上下文
 */
export interface GenerationContext {
  platform?: string;
  topic?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * 会话上下文 - 用于作用域判断
 */
export interface SessionContext {
  /** 当前会话 ID */
  sessionId: string;
  /** 当前角色卡 ID（可选） */
  characterCardId?: string;
}

/**
 * 账号缺失信息 - 用于弹窗提醒
 */
export interface MissingAccountInfo {
  /** 缺失账号的平台 */
  platformId: string;
  /** 平台显示名称 */
  platformName: string;
  /** 当前会话/角色卡信息 */
  context: SessionContext;
  /** 建议的账号类型 */
  suggestedScope: AccountScope;
}
