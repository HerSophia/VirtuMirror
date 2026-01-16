# 画像系统 (Profile System)

> **模块**: Fans Service / Profile System  
> **版本**: 1.0  
> **状态**: 设计阶段

## 1. 概述

画像系统负责生成和管理粉丝的用户画像，为模拟社交环境提供真实感。它通过 LLM 生成符合博主特征的粉丝画像，包括昵称、简介、兴趣标签、活跃度等属性。

### 1.1 设计目标

- **真实感**: 粉丝画像应符合博主的内容领域和风格
- **多样性**: 不同来源的粉丝应有不同的画像特征
- **可控成本**: 批量生成优化 LLM 调用次数
- **可复用**: 生成的账号可在多个场景使用（评论、私信等）

---

## 2. 数据模型

### 2.1 粉丝画像 (FanProfile)

```typescript
interface FanProfile {
  // 基础信息
  accountId: string;             // 账号 ID（关联 Account Service）
  nickname: string;              // 昵称
  avatar?: string;               // 头像 URL
  bio?: string;                  // 简介
  
  // 人口统计
  gender: 'male' | 'female' | 'unknown';
  ageRange: '13-17' | '18-24' | '25-34' | '35-44' | '45+';
  region?: string;               // 地区
  
  // 兴趣与行为
  interests: string[];           // 兴趣标签
  activityLevel: 'high' | 'medium' | 'low';
  interactionStyle: InteractionStyle;
  
  // 关注原因
  followReason?: string;         // 为什么关注
  discoveryChannel?: string;     // 从哪里发现
  
  // 元数据
  generatedAt: number;           // 生成时间
  generatedBy: 'llm' | 'rule' | 'manual';  // 生成方式
  sourceContext?: SourceContext; // 生成时的上下文
}

// 互动风格
interface InteractionStyle {
  commentFrequency: 'often' | 'sometimes' | 'rarely';
  commentStyle: 'supportive' | 'analytical' | 'humorous' | 'questioning';
  likeFrequency: 'always' | 'often' | 'sometimes';
  shareFrequency: 'often' | 'sometimes' | 'rarely';
}

// 生成上下文
interface SourceContext {
  followeeId: string;            // 被关注者 ID
  followeeDomain: string[];      // 被关注者领域
  followeeStyle: string;         // 被关注者风格
  source: FollowerSource;        // 涨粉来源
  sourceDetail?: string;         // 详细来源信息
}
```

### 2.2 画像模板 (ProfileTemplate)

用于快速生成符合特定特征的粉丝画像：

```typescript
interface ProfileTemplate {
  id: string;
  name: string;
  description: string;
  
  // 约束条件
  constraints: {
    genderDistribution: Record<string, number>;  // { male: 0.4, female: 0.5, unknown: 0.1 }
    ageDistribution: Record<string, number>;
    activityDistribution: Record<string, number>;
    interestPool: string[];                      // 可选兴趣池
  };
  
  // 生成提示
  promptHint?: string;
}

// 预置模板
const PRESET_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'general',
    name: '通用粉丝',
    description: '适用于大多数场景的通用粉丝画像',
    constraints: {
      genderDistribution: { male: 0.45, female: 0.45, unknown: 0.1 },
      ageDistribution: { '18-24': 0.35, '25-34': 0.35, '35-44': 0.2, '45+': 0.1 },
      activityDistribution: { high: 0.2, medium: 0.5, low: 0.3 },
      interestPool: ['生活', '娱乐', '社会', '科技', '情感']
    }
  },
  {
    id: 'tech_enthusiast',
    name: '科技爱好者',
    description: '关注科技、数码内容的粉丝',
    constraints: {
      genderDistribution: { male: 0.7, female: 0.25, unknown: 0.05 },
      ageDistribution: { '18-24': 0.4, '25-34': 0.4, '35-44': 0.15, '45+': 0.05 },
      activityDistribution: { high: 0.3, medium: 0.5, low: 0.2 },
      interestPool: ['科技', '数码', '编程', '游戏', '硬件', 'AI', '互联网']
    },
    promptHint: '这是一个科技博主的粉丝，应该对科技话题有一定了解'
  },
  {
    id: 'entertainment_fan',
    name: '娱乐粉丝',
    description: '关注明星、影视、综艺的粉丝',
    constraints: {
      genderDistribution: { male: 0.3, female: 0.65, unknown: 0.05 },
      ageDistribution: { '13-17': 0.15, '18-24': 0.45, '25-34': 0.3, '35-44': 0.1 },
      activityDistribution: { high: 0.4, medium: 0.4, low: 0.2 },
      interestPool: ['明星', '追剧', '综艺', '音乐', '电影', '八卦']
    },
    promptHint: '这是一个娱乐博主的粉丝，可能比较活跃和情绪化'
  }
];
```

---

## 3. 服务接口

### 3.1 ProfileGenerator 类

```typescript
export class ProfileGenerator {
  private llmService: LLMTaskService;
  private dataStore: FansDataStore;
  
  // ===== 生成方法 =====
  
  /**
   * 生成单个粉丝画像
   */
  async generateProfile(
    context: SourceContext,
    options?: GenerateOptions
  ): Promise<FanProfile> {
    const template = this.selectTemplate(context);
    const constraints = this.applyDistribution(template.constraints);
    
    // 使用 LLM 生成详细画像
    const prompt = this.buildPrompt(context, constraints, template.promptHint);
    const result = await this.llmService.execute('fans.profile.generate', {
      context: prompt
    });
    
    const profile = this.parseProfile(result, context);
    
    // 创建对应的账号
    const account = await this.createAccount(profile);
    profile.accountId = account.id;
    
    // 保存画像
    await this.dataStore.saveProfile(profile);
    
    return profile;
  }
  
  /**
   * 批量生成粉丝画像（优化 LLM 调用）
   */
  async generateProfiles(
    context: SourceContext,
    count: number,
    options?: GenerateOptions
  ): Promise<FanProfile[]> {
    // 分批生成，每批最多 10 个
    const batchSize = options?.batchSize || 10;
    const batches = Math.ceil(count / batchSize);
    const profiles: FanProfile[] = [];
    
    for (let i = 0; i < batches; i++) {
      const batchCount = Math.min(batchSize, count - profiles.length);
      const batchProfiles = await this.generateBatch(context, batchCount, options);
      profiles.push(...batchProfiles);
    }
    
    return profiles;
  }
  
  /**
   * 单次 LLM 调用生成多个画像
   */
  private async generateBatch(
    context: SourceContext,
    count: number,
    options?: GenerateOptions
  ): Promise<FanProfile[]> {
    const template = this.selectTemplate(context);
    
    // 为每个画像预先确定约束
    const constraintsList = Array(count).fill(null).map(() => 
      this.applyDistribution(template.constraints)
    );
    
    // 构建批量生成提示
    const prompt = this.buildBatchPrompt(context, constraintsList, template.promptHint);
    
    const result = await this.llmService.execute('fans.profile.batch_generate', {
      context: prompt,
      count
    });
    
    const profiles = this.parseBatchProfiles(result, context, constraintsList);
    
    // 批量创建账号
    for (const profile of profiles) {
      const account = await this.createAccount(profile);
      profile.accountId = account.id;
      await this.dataStore.saveProfile(profile);
    }
    
    return profiles;
  }
  
  /**
   * 使用规则生成画像（不调用 LLM）
   */
  generateProfileByRule(
    context: SourceContext,
    options?: GenerateOptions
  ): FanProfile {
    const template = this.selectTemplate(context);
    const constraints = this.applyDistribution(template.constraints);
    
    // 使用规则生成
    const profile: FanProfile = {
      accountId: '', // 稍后填充
      nickname: this.generateNickname(constraints),
      gender: constraints.gender,
      ageRange: constraints.ageRange,
      interests: this.pickRandomInterests(template.constraints.interestPool, 3),
      activityLevel: constraints.activityLevel,
      interactionStyle: this.generateInteractionStyle(constraints.activityLevel),
      generatedAt: Date.now(),
      generatedBy: 'rule',
      sourceContext: context
    };
    
    return profile;
  }
  
  // ===== 查询方法 =====
  
  /**
   * 获取粉丝画像
   */
  async getProfile(accountId: string): Promise<FanProfile | null> {
    return this.dataStore.getProfile(accountId);
  }
  
  /**
   * 批量获取画像
   */
  async getProfiles(accountIds: string[]): Promise<FanProfile[]> {
    return this.dataStore.getProfiles(accountIds);
  }
  
  /**
   * 更新画像
   */
  async updateProfile(
    accountId: string,
    updates: Partial<FanProfile>
  ): Promise<void> {
    await this.dataStore.updateProfile(accountId, updates);
  }
  
  // ===== 私有方法 =====
  
  private selectTemplate(context: SourceContext): ProfileTemplate {
    // 根据被关注者的领域选择模板
    if (context.followeeDomain.some(d => ['科技', '数码', '编程'].includes(d))) {
      return PRESET_TEMPLATES.find(t => t.id === 'tech_enthusiast')!;
    }
    if (context.followeeDomain.some(d => ['明星', '娱乐', '综艺'].includes(d))) {
      return PRESET_TEMPLATES.find(t => t.id === 'entertainment_fan')!;
    }
    return PRESET_TEMPLATES.find(t => t.id === 'general')!;
  }
  
  private applyDistribution(constraints: ProfileTemplate['constraints']): {
    gender: string;
    ageRange: string;
    activityLevel: string;
  } {
    return {
      gender: this.weightedRandom(constraints.genderDistribution),
      ageRange: this.weightedRandom(constraints.ageDistribution),
      activityLevel: this.weightedRandom(constraints.activityDistribution)
    };
  }
  
  private weightedRandom(distribution: Record<string, number>): string {
    const rand = Math.random();
    let cumulative = 0;
    for (const [key, weight] of Object.entries(distribution)) {
      cumulative += weight;
      if (rand < cumulative) {
        return key;
      }
    }
    return Object.keys(distribution)[0];
  }
  
  private generateNickname(constraints: { gender: string }): string {
    // 简单的昵称生成规则
    const prefixes = ['小', '大', '阿', ''];
    const maleNames = ['明', '强', '伟', '鹏', '涛', '杰', '磊', '军'];
    const femaleNames = ['芳', '丽', '娜', '敏', '静', '婷', '雪', '倩'];
    const suffixes = ['', '儿', '子', '哥', '姐', 'er', '酱'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const names = constraints.gender === 'female' ? femaleNames : maleNames;
    const name = names[Math.floor(Math.random() * names.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    // 有时添加数字
    const number = Math.random() > 0.7 ? String(Math.floor(Math.random() * 100)) : '';
    
    return prefix + name + suffix + number;
  }
  
  private pickRandomInterests(pool: string[], count: number): string[] {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
  
  private generateInteractionStyle(activityLevel: string): InteractionStyle {
    switch (activityLevel) {
      case 'high':
        return {
          commentFrequency: 'often',
          commentStyle: 'supportive',
          likeFrequency: 'always',
          shareFrequency: 'sometimes'
        };
      case 'medium':
        return {
          commentFrequency: 'sometimes',
          commentStyle: 'supportive',
          likeFrequency: 'often',
          shareFrequency: 'rarely'
        };
      default:
        return {
          commentFrequency: 'rarely',
          commentStyle: 'supportive',
          likeFrequency: 'sometimes',
          shareFrequency: 'rarely'
        };
    }
  }
}
```

### 3.2 生成选项

```typescript
interface GenerateOptions {
  // 生成方式
  method?: 'llm' | 'rule' | 'hybrid';  // 默认 hybrid
  
  // 批量设置
  batchSize?: number;              // 每批大小，默认 10
  
  // 模板覆盖
  templateId?: string;             // 指定使用的模板
  templateOverrides?: Partial<ProfileTemplate['constraints']>;
  
  // LLM 设置
  llmModel?: string;               // 指定 LLM 模型
  llmTemperature?: number;         // 温度参数
}
```

---

## 4. LLM 任务定义

### 4.1 单个画像生成

```typescript
const PROFILE_GENERATE_TASK: LLMTaskDefinition = {
  id: 'fans.profile.generate',
  name: '生成粉丝画像',
  scene: 'fans.profile',
  
  promptTemplate: `
你是一个社交媒体用户画像生成器。根据博主特征和来源渠道，生成一个合理的粉丝画像。

## 博主信息
- 领域: {{followeeDomain}}
- 风格: {{followeeStyle}}

## 粉丝来源
{{source}}: {{sourceDetail}}

## 约束条件
- 性别: {{gender}}
- 年龄段: {{ageRange}}
- 活跃度: {{activityLevel}}

## 额外提示
{{promptHint}}

## 输出要求
生成一个 JSON 格式的粉丝画像：

\`\`\`json
{
  "nickname": "用户昵称 (2-10个字符)",
  "bio": "简介 (20字以内，可为空)",
  "interests": ["兴趣标签1", "兴趣标签2", "兴趣标签3"],
  "followReason": "关注原因 (10字以内)",
  "commentStyle": "supportive|analytical|humorous|questioning"
}
\`\`\`
`,
  
  outputHandler: 'json'
};
```

### 4.2 批量画像生成

```typescript
const PROFILE_BATCH_GENERATE_TASK: LLMTaskDefinition = {
  id: 'fans.profile.batch_generate',
  name: '批量生成粉丝画像',
  scene: 'fans.profile',
  
  promptTemplate: `
你是一个社交媒体用户画像生成器。批量生成符合博主特征的粉丝画像。

## 博主信息
- 领域: {{followeeDomain}}
- 风格: {{followeeStyle}}

## 粉丝来源
{{source}}: {{sourceDetail}}

## 生成要求
生成 {{count}} 个粉丝画像，每个画像需要满足以下约束：

{{#each constraints}}
粉丝 {{@index}}:
- 性别: {{this.gender}}
- 年龄段: {{this.ageRange}}
- 活跃度: {{this.activityLevel}}
{{/each}}

## 额外提示
{{promptHint}}

## 输出格式
输出 JSON 数组，每个元素包含：

\`\`\`json
[
  {
    "nickname": "昵称",
    "bio": "简介",
    "interests": ["兴趣1", "兴趣2"],
    "followReason": "关注原因",
    "commentStyle": "supportive"
  }
]
\`\`\`

确保生成 {{count}} 个不同的画像，昵称不要重复。
`,
  
  outputHandler: 'json'
};
```

---

## 5. 画像与账号集成

### 5.1 创建账号流程

画像生成后，需要在 Account Service 中创建对应的账号：

```typescript
async function createAccount(profile: FanProfile): Promise<SocialAccount> {
  const account = await accountService.createAccount({
    type: 'npc',
    displayName: profile.nickname,
    avatar: profile.avatar || generateDefaultAvatar(profile),
    bio: profile.bio,
    
    // 扩展数据
    metadata: {
      gender: profile.gender,
      ageRange: profile.ageRange,
      interests: profile.interests,
      generatedBy: profile.generatedBy
    }
  });
  
  return account;
}

function generateDefaultAvatar(profile: FanProfile): string {
  // 根据性别和年龄生成默认头像
  const avatarPool = getAvatarPool(profile.gender, profile.ageRange);
  return avatarPool[Math.floor(Math.random() * avatarPool.length)];
}
```

### 5.2 画像与账号同步

```typescript
// 监听账号更新事件
eventBus.on('account:updated', async (event) => {
  const profile = await profileGenerator.getProfile(event.accountId);
  if (profile) {
    // 同步更新画像中的信息
    await profileGenerator.updateProfile(event.accountId, {
      nickname: event.changes.displayName,
      avatar: event.changes.avatar,
      bio: event.changes.bio
    });
  }
});
```

---

## 6. 使用示例

### 6.1 涨粉事件后生成画像

```typescript
async function handleFollowerGainEvent(event: FollowerGainEvent) {
  const followee = await accountService.getAccount(event.accountId);
  
  // 构建生成上下文
  const context: SourceContext = {
    followeeId: event.accountId,
    followeeDomain: followee.tags || ['通用'],
    followeeStyle: followee.style || '普通用户',
    source: event.source,
    sourceDetail: event.sourceDetail?.postId
      ? `通过博文 ${event.sourceDetail.postId} 关注`
      : undefined
  };
  
  // 生成粉丝画像
  const profiles = await profileGenerator.generateProfiles(
    context,
    event.followerGain,
    {
      method: event.followerGain > 20 ? 'hybrid' : 'llm'
    }
  );
  
  // 添加关注关系
  await fansManager.addFollowersBatch(
    profiles.map(p => p.accountId),
    event.accountId,
    {
      source: event.source,
      sourceEventId: event.id
    }
  );
  
  return profiles;
}
```

### 6.2 获取粉丝画像展示

```typescript
async function getFollowerDetails(followerId: string) {
  // 获取画像
  const profile = await profileGenerator.getProfile(followerId);
  
  if (profile) {
    return {
      nickname: profile.nickname,
      bio: profile.bio,
      gender: profile.gender,
      interests: profile.interests,
      activityLevel: profile.activityLevel,
      followReason: profile.followReason
    };
  }
  
  // 如果没有画像，返回基础账号信息
  const account = await accountService.getAccount(followerId);
  return {
    nickname: account.displayName,
    bio: account.bio
  };
}
```

---

## 7. 优化策略

### 7.1 LLM 调用优化

| 策略 | 说明 | 适用场景 |
| ---- | ---- | ---- |
| **批量生成** | 单次调用生成多个画像 | 大量涨粉事件 |
| **规则回退** | 部分画像使用规则生成 | 低质量粉丝 |
| **缓存复用** | 相似场景复用已生成画像 | 重复性涨粉 |
| **异步生成** | 后台生成，先创建占位 | 非实时场景 |

### 7.2 混合生成策略

```typescript
async function hybridGenerate(
  context: SourceContext,
  count: number
): Promise<FanProfile[]> {
  // 高质量粉丝使用 LLM 生成
  const llmCount = Math.ceil(count * 0.3);
  const llmProfiles = await profileGenerator.generateProfiles(
    context,
    llmCount,
    { method: 'llm' }
  );
  
  // 普通粉丝使用规则生成
  const ruleCount = count - llmCount;
  const ruleProfiles = Array(ruleCount).fill(null).map(() =>
    profileGenerator.generateProfileByRule(context)
  );
  
  return [...llmProfiles, ...ruleProfiles];
}
```

---

## 8. 参考文档

- [粉丝服务概述](./README.md)
- [粉丝管理模块](./fans-management.md)
- [LLM 任务定义](./llm-tasks.md)
- [LLM 任务服务](../llm-task-service/README.md)
