# 用户画像扩展设计

> **版本**: 1.0
> **状态**: 设计阶段
> **依赖**: AccountService, UserPool, FollowerGrowthEngine

## 1. 概述

本文档描述用户账号画像的扩展设计，用于支持更丰富的社交媒体模拟体验。扩展后的画像系统将支持：

- **多维度人设**: 年龄、职业、兴趣、性格等
- **社交特征**: 活跃度、影响力等级、互动风格
- **平台差异化**: 不同平台的账号人设可以不同
- **动态演化**: 画像随时间和互动而变化

---

## 2. 类型定义扩展

### 2.1 基础画像扩展 (CharacterProfile)

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
  | 'super'      // 超级活跃 (重度用户);

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
 * 性格类型 (简化版 MBTI 风格)
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
 * 角色实体扩展画像
 */
export interface CharacterProfile {
  // === 人口统计学特征 ===
  ageRange?: AgeRange;
  occupation?: string;           // 职业，如 "程序员"、"学生"、"自由职业"
  location?: string;             // 所在地，如 "北京"、"海外"
  
  // === 兴趣与风格 ===
  interests: InterestDomain[];   // 兴趣领域列表 (最多5个)
  contentStyle?: ContentStyle;   // 内容风格
  personality?: PersonalityType; // 性格类型
  
  // === 社交特征 ===
  activityLevel: ActivityLevel;  // 活跃度
  influenceLevel: InfluenceLevel; // 影响力等级
  
  // === 标签系统 ===
  tags: string[];                // 自定义标签，如 ["追星族", "程序媛", "猫奴"]
  
  // === 行为倾向 (0-100) ===
  behaviorTendencies?: {
    likeFrequency: number;       // 点赞频率
    commentFrequency: number;    // 评论频率
    repostFrequency: number;     // 转发频率
    originalContentRatio: number; // 原创内容比例
    controversyTolerance: number; // 争议容忍度
  };
}
```

### 2.2 平台账号画像扩展 (PlatformProfile)

```typescript
/**
 * 微博认证类型 (详细)
 */
export type WeiboVerifyType = 
  | 'none'              // 无认证
  | 'personal_celebrity' // 个人认证-明星
  | 'personal_kol'       // 个人认证-知名博主
  | 'personal_expert'    // 个人认证-专业人士
  | 'personal_other'     // 个人认证-其他
  | 'org_enterprise'     // 机构认证-企业
  | 'org_media'          // 机构认证-媒体
  | 'org_government'     // 机构认证-政府
  | 'org_other';         // 机构认证-其他

/**
 * 平台专用画像 - 微博
 */
export interface WeiboPlatformProfile {
  // === 基础数据 ===
  followers: number;         // 粉丝数
  following: number;         // 关注数
  postsCount: number;        // 微博数
  
  // === 认证信息 ===
  verified: boolean;
  verifyType?: WeiboVerifyType;
  verifyDescription?: string; // 认证描述，如 "知名演员"、"XX公司官方账号"
  
  // === 会员信息 ===
  vipLevel?: number;         // 会员等级 (0-7)
  isYearVip?: boolean;       // 是否年费会员
  
  // === 互动数据 ===
  avgLikesPerPost?: number;  // 平均点赞数
  avgCommentsPerPost?: number; // 平均评论数
  avgRepostsPerPost?: number;  // 平均转发数
  engagementRate?: number;   // 互动率 (0-100)
  
  // === 活跃时间 ===
  activeHours?: number[];    // 活跃时段 (0-23)
  postFrequency?: 'daily' | 'weekly' | 'monthly' | 'rarely';
  
  // === 内容特征 ===
  contentDomains?: InterestDomain[]; // 内容领域
  hasOriginalContent?: boolean;      // 是否有原创内容
  
  // === 标签 ===
  weiboTags?: string[];      // 微博标签
}

/**
 * 平台专用画像 - B站
 */
export interface BilibiliPlatformProfile {
  // === 基础数据 ===
  followers: number;
  following: number;
  
  // === 等级系统 ===
  level: number;             // 用户等级 (0-6)
  coins: number;             // 硬币数
  
  // === UP主数据 (如果是UP主) ===
  isUploader?: boolean;
  totalViews?: number;
  totalLikes?: number;
  avgViewsPerVideo?: number;
  
  // === 会员信息 ===
  isBigVip?: boolean;        // 大会员
  isYearVip?: boolean;       // 年度大会员
  
  // === 内容分区 ===
  mainPartitions?: string[]; // 主要活跃分区
}

/**
 * 聚合的平台画像类型
 */
export type PlatformProfileData = 
  | WeiboPlatformProfile 
  | BilibiliPlatformProfile 
  | Record<string, unknown>; // 其他平台的扩展
```

### 2.3 扩展 CharacterEntity

```typescript
// 在 src/types/account.ts 中扩展

export interface CharacterEntity {
  // ... 现有字段保持不变 ...
  
  // === 新增：详细画像 ===
  profile?: CharacterProfile;
  
  // === 新增：简短标语 ===
  tagline?: string;           // 一句话介绍，如 "热爱生活的北漂程序员"
  
  // === 新增：背景故事 ===
  backstory?: string;         // 角色背景（供 LLM 参考）
}
```

### 2.4 扩展 PlatformSpecificData

```typescript
// 在 src/types/account.ts 中扩展

export interface PlatformSpecificData {
  // ... 现有字段保持不变 ...
  
  // === 新增：详细平台画像 ===
  profile?: PlatformProfileData;
  
  // === 新增：粉丝画像摘要 ===
  fansProfile?: {
    ageDistribution?: Record<AgeRange, number>;     // 年龄分布 (%)
    genderDistribution?: Record<Gender, number>;    // 性别分布 (%)
    topInterests?: InterestDomain[];                // 粉丝主要兴趣
    activeLevel?: ActivityLevel;                    // 粉丝整体活跃度
  };
  
  // === 新增：账号标签 ===
  accountTags?: string[];     // 账号标签，如 ["美妆博主", "带货达人"]
  
  // === 新增：增长数据 ===
  growthData?: {
    dailyGain?: number;       // 日均涨粉
    weeklyGain?: number;      // 周均涨粉
    monthlyGain?: number;     // 月均涨粉
    growthTrend?: 'rising' | 'stable' | 'declining';
  };
}
```

---

## 3. UserPool 扩展

### 3.1 新增画像生成方法

```typescript
// 在 src/services/account/userPool.ts 中扩展

// === 新增预置数据 ===

const OCCUPATIONS = {
  tech: ['程序员', '产品经理', '设计师', 'AI工程师', '运维工程师', '测试工程师'],
  business: ['销售', '市场营销', '人力资源', '财务', '运营'],
  creative: ['作家', '画师', '摄影师', '视频创作者', '音乐人'],
  service: ['医生', '护士', '老师', '律师', '公务员'],
  student: ['大学生', '研究生', '高中生', '留学生'],
  other: ['自由职业', '创业者', '全职妈妈', '退休人员'],
};

const LOCATIONS = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安',
  '南京', '重庆', '天津', '苏州', '长沙', '郑州', '青岛', '海外',
];

const TAGLINE_TEMPLATES = {
  tech: [
    '代码改变世界的{{occupation}}',
    '热爱开源的{{occupation}}一枚',
    '{{location}}互联网人',
  ],
  life: [
    '热爱生活的{{location}}人',
    '美食探店中...',
    '旅行是最好的投资',
  ],
  entertainment: [
    '追星女孩的日常',
    '二次元浓度超标',
    '游戏宅的快乐生活',
  ],
};

// === 扩展 UserPool 类 ===

export class UserPool {
  // ... 现有方法保持不变 ...
  
  /**
   * 生成完整的角色画像
   */
  generateFullProfile(context?: GenerationContext): CharacterProfile {
    const ageRange = this.randomAgeRange();
    const occupation = this.randomOccupation(context);
    const interests = this.randomInterests(3);
    const personality = this.randomPersonality();
    const activityLevel = this.randomActivityLevel();
    const influenceLevel = this.randomInfluenceLevel();
    const tags = this.generateTags(interests, occupation);
    const contentStyle = this.randomContentStyle();
    
    return {
      ageRange,
      occupation,
      location: this.randomLocation(),
      interests,
      contentStyle,
      personality,
      activityLevel,
      influenceLevel,
      tags,
      behaviorTendencies: this.generateBehaviorTendencies(personality, activityLevel),
    };
  }
  
  /**
   * 生成微博平台专用画像
   */
  generateWeiboPlatformProfile(
    influenceLevel: InfluenceLevel,
    context?: GenerationContext
  ): WeiboPlatformProfile {
    const followers = this.getFollowersByLevel(influenceLevel);
    const following = this.generateFollowing(followers);
    const postsCount = this.generatePostsCount(influenceLevel);
    
    return {
      followers,
      following,
      postsCount,
      verified: influenceLevel !== 'nobody' && influenceLevel !== 'newbie' && Math.random() > 0.7,
      verifyType: this.randomVerifyType(influenceLevel),
      vipLevel: Math.floor(Math.random() * 8),
      avgLikesPerPost: this.estimateAvgLikes(followers),
      avgCommentsPerPost: this.estimateAvgComments(followers),
      avgRepostsPerPost: this.estimateAvgReposts(followers),
      engagementRate: this.calculateEngagementRate(influenceLevel),
      activeHours: this.generateActiveHours(),
      postFrequency: this.randomPostFrequency(),
      contentDomains: context?.interests as InterestDomain[] || this.randomInterests(2),
    };
  }
  
  /**
   * 生成标语
   */
  generateTagline(profile: CharacterProfile): string {
    // 根据画像生成个性化标语
    const templates = this.getTaglineTemplates(profile.interests[0]);
    const template = this.pickRandom(templates);
    
    return template
      .replace('{{occupation}}', profile.occupation || '打工人')
      .replace('{{location}}', profile.location || '某城市');
  }
  
  /**
   * 根据影响力等级获取粉丝数范围
   */
  private getFollowersByLevel(level: InfluenceLevel): number {
    const ranges: Record<InfluenceLevel, [number, number]> = {
      nobody: [0, 100],
      newbie: [100, 1000],
      rising: [1000, 10000],
      small_v: [10000, 100000],
      medium_v: [100000, 1000000],
      big_v: [1000000, 10000000],
      super_v: [10000000, 100000000],
    };
    const [min, max] = ranges[level];
    return Math.floor(min + Math.random() * (max - min));
  }
  
  /**
   * 生成行为倾向
   */
  private generateBehaviorTendencies(
    personality: PersonalityType,
    activity: ActivityLevel
  ): CharacterProfile['behaviorTendencies'] {
    const base = this.getActivityBase(activity);
    const modifier = this.getPersonalityModifier(personality);
    
    return {
      likeFrequency: Math.min(100, base.like * modifier.like),
      commentFrequency: Math.min(100, base.comment * modifier.comment),
      repostFrequency: Math.min(100, base.repost * modifier.repost),
      originalContentRatio: modifier.original,
      controversyTolerance: modifier.controversy,
    };
  }
  
  // ... 其他辅助方法 ...
}
```

---

## 4. 数据库扩展

### 4.1 新增索引

```typescript
// 在 Dexie 数据库定义中添加

db.version(X).stores({
  // 现有表...
  
  // 为画像查询添加索引
  characterEntities: '++id, type, scope, [scope+scopeSessionId], displayName, *profile.interests, profile.influenceLevel',
  platformAccounts: '++id, entityId, platformId, [platformId+scope], nickname, *platformData.accountTags',
});
```

---

## 5. LLM 集成

### 5.1 画像生成提示词

```typescript
const USER_PROFILE_PROMPT = {
  id: 'social.user.profile.generate',
  scene: 'social.user.profile.generate',
  appId: 'social-engine',
  name: '生成用户详细画像',
  template: `
你是一个社交媒体用户画像生成专家。请根据以下上下文，生成一个真实、立体的用户画像。

## 上下文
- 平台: {{platformName}}
- 场景: {{scenario}}
- 参考内容: {{referenceContent}}
- 叙事背景: {{narrative}}

## 输出格式 (JSON)
{
  "displayName": "用户昵称 (2-8字，符合中国网民习惯)",
  "tagline": "一句话介绍 (15字以内)",
  "bio": "个人简介 (50字以内)",
  "profile": {
    "ageRange": "young|adult|middle|...",
    "occupation": "职业",
    "location": "城市",
    "interests": ["兴趣1", "兴趣2"],
    "personality": "enthusiast|observer|creator|...",
    "activityLevel": "low|medium|high|...",
    "contentStyle": "casual|professional|humorous|...",
    "tags": ["标签1", "标签2", "标签3"]
  },
  "platformProfile": {
    "followers": 1234,
    "verified": false,
    "postFrequency": "daily|weekly|monthly"
  }
}

## 要求
1. 画像要符合中国互联网用户特征
2. 不同属性之间要有逻辑一致性（如学生不应有资深职业）
3. 昵称要有创意，避免过于平淡
4. 标签要具体、有辨识度

## 输出
`,
};
```

### 5.2 画像分析提示词

```typescript
const ANALYZE_PROFILE_PROMPT = {
  id: 'social.user.profile.analyze',
  scene: 'social.user.profile.analyze',
  appId: 'social-engine',
  name: '分析用户画像',
  template: `
分析以下用户的社交媒体行为，推断其画像特征。

## 用户数据
- 昵称: {{nickname}}
- 简介: {{bio}}
- 发布内容示例:
{{recentPosts}}
- 互动行为:
  - 点赞数: {{totalLikes}}
  - 评论数: {{totalComments}}
  - 转发数: {{totalReposts}}

## 输出画像 (JSON)
{
  "inferredProfile": {
    "ageRange": "...",
    "interests": [...],
    "personality": "...",
    "contentStyle": "...",
    "activityLevel": "...",
    "influenceLevel": "..."
  },
  "confidence": 0.8,
  "reasoning": "分析推理过程"
}
`,
};
```

---

## 6. 使用示例

### 6.1 创建带完整画像的用户

```typescript
import { userPool } from '@/services/account/userPool';
import { accountService } from '@/services/account/accountService';

async function createRichUser() {
  // 1. 生成基础档案
  const basicProfile = userPool.generateRandomProfile({ platform: 'weibo' });
  
  // 2. 生成详细画像
  const characterProfile = userPool.generateFullProfile({
    topic: '科技',
    platform: 'weibo',
  });
  
  // 3. 创建实体
  const entity = await accountService.createEntity({
    type: 'npc',
    source: 'social',
    displayName: basicProfile.displayName,
    avatar: basicProfile.avatar,
    bio: basicProfile.bio,
    gender: basicProfile.gender,
    // 新增：详细画像
    profile: characterProfile,
    tagline: userPool.generateTagline(characterProfile),
  });
  
  // 4. 创建微博账号
  const weiboProfile = userPool.generateWeiboPlatformProfile(
    characterProfile.influenceLevel,
    { interests: characterProfile.interests }
  );
  
  const account = await accountService.createPlatformAccount(entity.id, 'weibo', {
    handle: basicProfile.handle,
    nickname: basicProfile.nickname,
    scope: 'session',
    platformData: {
      ...weiboProfile,
      profile: weiboProfile,
    },
  });
  
  return { entity, account };
}
```

### 6.2 在涨粉引擎中使用画像

```typescript
// 根据博主画像生成匹配的粉丝
async function generateMatchingFollowers(
  authorProfile: CharacterProfile,
  count: number
): Promise<CharacterEntity[]> {
  const followers: CharacterEntity[] = [];
  
  for (let i = 0; i < count; i++) {
    // 粉丝兴趣与博主有重叠
    const followerInterests = [
      ...authorProfile.interests.slice(0, 2),
      ...userPool.randomInterests(1),
    ];
    
    const followerProfile = userPool.generateFullProfile({
      interests: followerInterests,
    });
    
    // 调整粉丝的影响力等级（粉丝通常比博主低）
    followerProfile.influenceLevel = adjustInfluenceLevel(
      followerProfile.influenceLevel,
      authorProfile.influenceLevel
    );
    
    followers.push(await createEntityWithProfile(followerProfile));
  }
  
  return followers;
}
```

---

## 7. 迁移计划

### 7.1 Phase 1: 类型扩展

- [ ] 在 `src/types/account.ts` 中添加新类型定义
- [ ] 扩展 `CharacterEntity` 接口
- [ ] 扩展 `PlatformSpecificData` 接口
- [ ] 更新相关的 Input 类型

### 7.2 Phase 2: UserPool 扩展

- [ ] 添加预置数据（职业、地点、标签模板等）
- [ ] 实现 `generateFullProfile()` 方法
- [ ] 实现 `generateWeiboPlatformProfile()` 方法
- [ ] 实现 `generateTagline()` 方法

### 7.3 Phase 3: LLM 集成

- [ ] 注册画像生成提示词
- [ ] 注册画像分析提示词
- [ ] 实现 AI 增强的画像生成

### 7.4 Phase 4: UI 展示

- [ ] 在用户主页展示画像标签
- [ ] 在账号编辑页面支持画像编辑
- [ ] 在涨粉面板展示粉丝画像分布

---

## 8. 兼容性说明

### 8.1 向后兼容

- 所有新增字段都是可选的 (`?`)
- 现有代码无需修改即可继续运行
- `profile` 字段为空时，使用默认值或跳过相关逻辑

### 8.2 渐进式采用

```typescript
// 安全地访问画像数据
function getProfileInterests(entity: CharacterEntity): InterestDomain[] {
  return entity.profile?.interests || [];
}

function getInfluenceLevel(entity: CharacterEntity): InfluenceLevel {
  return entity.profile?.influenceLevel || 'nobody';
}
```
