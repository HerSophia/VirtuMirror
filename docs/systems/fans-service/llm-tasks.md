# LLM 任务定义 (LLM Tasks)

> **模块**: Fans Service / LLM Tasks  
> **版本**: 1.0  
> **状态**: 设计阶段

## 1. 概述

本文档定义粉丝服务中所有需要 LLM 参与的任务，包括粉丝画像生成、涨粉故事生成、里程碑庆祝等场景。

### 1.1 任务列表

| 任务 ID | 名称 | 触发条件 | 优先级 |
| ------- | ---- | -------- | ------ |
| `fans.profile.generate` | 生成粉丝画像 | 涨粉事件 | 中 |
| `fans.profile.batch` | 批量生成画像 | 大量涨粉 | 中 |
| `fans.story.gain` | 涨粉故事 | 显著涨粉 | 低 |
| `fans.story.milestone` | 里程碑庆祝 | 达成里程碑 | 高 |
| `fans.analyze.growth` | 分析涨粉数据 | 手动触发 | 低 |
| `fans.quality.evaluate` | 评估内容质量 | 发布博文 | 中 |

---

## 2. 任务定义

### 2.1 生成粉丝画像 (fans.profile.generate)

**场景**: 涨粉事件发生后，为新粉丝生成画像

```typescript
const PROFILE_GENERATE_TASK: LLMTaskDefinition = {
  id: 'fans.profile.generate',
  name: '生成粉丝画像',
  description: '根据博主特征生成一个合理的粉丝画像',
  category: 'fans',
  type: 'prompt',
  
  // 提示词模板
  promptTemplate: `
你是一个社交媒体用户画像生成器。根据博主特征和来源渠道，生成一个合理的粉丝画像。

## 博主信息
- 昵称: {{followeeName}}
- 领域: {{followeeDomain}}
- 风格: {{followeeStyle}}
- 现有粉丝特征: {{existingFansProfile}}

## 粉丝来源
来源渠道: {{source}}
来源详情: {{sourceDetail}}

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
  "nickname": "用户昵称 (2-10个字符，可使用中英文、数字、特殊符号)",
  "bio": "简介 (20字以内，可为空)",
  "interests": ["兴趣标签1", "兴趣标签2", "兴趣标签3"],
  "followReason": "关注原因 (10字以内)",
  "commentStyle": "supportive|analytical|humorous|questioning"
}
\`\`\`

注意：
1. 昵称要多样化，可以是网名风格、真实姓名风格、英文名等
2. 兴趣标签要与博主领域相关但不完全相同
3. 关注原因要简洁且合理
`,
  
  // 变量定义
  variables: [
    { key: 'followeeName', label: '博主昵称', type: 'text', required: true },
    { key: 'followeeDomain', label: '博主领域', type: 'text', required: true },
    { key: 'followeeStyle', label: '博主风格', type: 'text', defaultValue: '普通用户' },
    { key: 'existingFansProfile', label: '现有粉丝特征', type: 'text', defaultValue: '无' },
    { key: 'source', label: '来源渠道', type: 'select', options: Object.values(FollowerSource) },
    { key: 'sourceDetail', label: '来源详情', type: 'text', defaultValue: '' },
    { key: 'gender', label: '性别', type: 'select', options: ['male', 'female', 'unknown'] },
    { key: 'ageRange', label: '年龄段', type: 'select', options: ['18-24', '25-34', '35-44', '45+'] },
    { key: 'activityLevel', label: '活跃度', type: 'select', options: ['high', 'medium', 'low'] },
    { key: 'promptHint', label: '额外提示', type: 'text', defaultValue: '' }
  ],
  
  // 输出处理
  outputHandler: 'json',
  
  // 自动执行配置
  autoExecution: {
    enabled: false  // 由增长引擎手动触发
  }
};
```

---

### 2.2 批量生成画像 (fans.profile.batch)

**场景**: 大量涨粉时，单次 LLM 调用生成多个画像

```typescript
const PROFILE_BATCH_TASK: LLMTaskDefinition = {
  id: 'fans.profile.batch',
  name: '批量生成粉丝画像',
  description: '一次生成多个粉丝画像，优化 LLM 调用次数',
  category: 'fans',
  type: 'prompt',
  
  promptTemplate: `
你是一个社交媒体用户画像生成器。批量生成符合博主特征的粉丝画像。

## 博主信息
- 昵称: {{followeeName}}
- 领域: {{followeeDomain}}
- 风格: {{followeeStyle}}

## 粉丝来源
来源渠道: {{source}}
来源详情: {{sourceDetail}}

## 生成要求
生成 {{count}} 个粉丝画像。每个画像的约束如下：

{{constraintsList}}

## 额外提示
{{promptHint}}

## 输出格式
输出 JSON 数组，每个元素包含：

\`\`\`json
[
  {
    "nickname": "昵称 (2-10字符)",
    "bio": "简介 (可为空)",
    "interests": ["兴趣1", "兴趣2"],
    "followReason": "关注原因",
    "commentStyle": "supportive|analytical|humorous|questioning"
  }
]
\`\`\`

要求：
1. 必须生成 {{count}} 个不同的画像
2. 昵称不要重复
3. 画像要多样化，体现不同类型的用户
`,
  
  variables: [
    { key: 'followeeName', label: '博主昵称', type: 'text', required: true },
    { key: 'followeeDomain', label: '博主领域', type: 'text', required: true },
    { key: 'followeeStyle', label: '博主风格', type: 'text', defaultValue: '普通用户' },
    { key: 'source', label: '来源渠道', type: 'text' },
    { key: 'sourceDetail', label: '来源详情', type: 'text', defaultValue: '' },
    { key: 'count', label: '生成数量', type: 'number', defaultValue: '5' },
    { key: 'constraintsList', label: '约束列表', type: 'text', required: true },
    { key: 'promptHint', label: '额外提示', type: 'text', defaultValue: '' }
  ],
  
  outputHandler: 'json'
};
```

---

### 2.3 涨粉故事 (fans.story.gain)

**场景**: 显著涨粉事件（如大 V 导流、爆款博文）时生成故事

```typescript
const FOLLOWER_STORY_TASK: LLMTaskDefinition = {
  id: 'fans.story.gain',
  name: '生成涨粉故事',
  description: '为涨粉事件生成一条简短的动态描述',
  category: 'fans',
  type: 'prompt',
  
  promptTemplate: `
你是一个社交媒体数据分析师。根据以下涨粉事件，生成一条简短的涨粉动态描述。

## 事件信息
- 博主昵称: {{authorName}}
- 涨粉数量: {{followerGain}}
- 涨粉来源: {{source}}
- 来源详情: {{sourceDetail}}
- 相关内容: {{relatedContent}}
- 时间: {{time}}

## 输出要求
生成一条 50 字以内的涨粉动态，模拟微博后台的涨粉提醒风格。

参考示例：
- "恭喜！你的微博「关于xxx的想法」被 @某某大V 转发，为你带来了 156 位新粉丝 🎉"
- "你参与 #热搜话题# 的讨论获得广泛关注，新增 89 位粉丝"
- "你的优质内容获得平台推荐，吸引了 234 位新粉丝关注"
- "通过与其他用户的积极互动，你收获了 45 位新粉丝"

直接输出故事文本，不要包含其他内容。
`,
  
  variables: [
    { key: 'authorName', label: '博主昵称', type: 'text', required: true },
    { key: 'followerGain', label: '涨粉数量', type: 'number', required: true },
    { key: 'source', label: '涨粉来源', type: 'text', required: true },
    { key: 'sourceDetail', label: '来源详情', type: 'text', defaultValue: '' },
    { key: 'relatedContent', label: '相关内容', type: 'text', defaultValue: '' },
    { key: 'time', label: '时间', type: 'text', defaultValue: '刚刚' }
  ],
  
  outputHandler: 'text'
};
```

---

### 2.4 里程碑庆祝 (fans.story.milestone)

**场景**: 粉丝数达到里程碑（100/1000/10000...）时生成庆祝文案

```typescript
const MILESTONE_CELEBRATION_TASK: LLMTaskDefinition = {
  id: 'fans.story.milestone',
  name: '生成里程碑庆祝',
  description: '为粉丝数突破生成庆祝动态',
  category: 'fans',
  type: 'prompt',
  
  promptTemplate: `
你是一个社交媒体运营助手。为用户的粉丝里程碑生成一条庆祝动态。

## 里程碑信息
- 博主昵称: {{authorName}}
- 突破粉丝数: {{milestone}}
- 账号风格: {{accountStyle}}
- 主要内容领域: {{contentDomain}}

## 输出要求
生成一条 80 字以内的庆祝动态，可以包含：
1. 对达成里程碑的感谢
2. 对粉丝的感激
3. 对未来的展望

风格要求：
- 符合博主的账号风格
- 真诚且有感染力
- 可以适当使用 emoji

参考示例：
- "100粉啦！虽然是个小数字，但每一个关注都是对我的认可，会继续努力分享好内容的 ❤️"
- "一万粉了！感谢大家一路的陪伴，这个小小的里程碑是我们一起创造的 🎉"

直接输出庆祝文本。
`,
  
  variables: [
    { key: 'authorName', label: '博主昵称', type: 'text', required: true },
    { key: 'milestone', label: '里程碑', type: 'select', 
      options: ['100', '500', '1000', '5000', '10000', '50000', '100000', '1000000'] },
    { key: 'accountStyle', label: '账号风格', type: 'text', defaultValue: '普通用户' },
    { key: 'contentDomain', label: '内容领域', type: 'text', defaultValue: '生活分享' }
  ],
  
  outputHandler: 'text'
};
```

---

### 2.5 分析涨粉数据 (fans.analyze.growth)

**场景**: 用户手动触发，分析账号的涨粉数据并给出建议

```typescript
const ANALYZE_GROWTH_TASK: LLMTaskDefinition = {
  id: 'fans.analyze.growth',
  name: '分析涨粉数据',
  description: '分析账号的涨粉数据并给出运营建议',
  category: 'fans',
  type: 'prompt',
  
  promptTemplate: `
你是一个社交媒体运营顾问。分析以下涨粉数据，给出专业的运营建议。

## 账号信息
- 昵称: {{accountName}}
- 当前粉丝数: {{currentFollowers}}
- 领域: {{domain}}

## 涨粉数据 (过去 {{period}} 天)
- 新增粉丝: {{totalGain}}
- 取关人数: {{totalLoss}}
- 净增长: {{netGrowth}}
- 日均涨粉: {{avgDailyGain}}

## 来源分布
{{sourceDistribution}}

## 最近涨粉事件
{{recentEvents}}

## 输出要求
请从以下方面进行分析：

1. **数据解读** (50字)
   - 当前增长态势如何
   - 与同类账号对比

2. **来源分析** (50字)
   - 主要涨粉渠道
   - 哪些渠道有提升空间

3. **运营建议** (100字)
   - 3条具体可操作的建议
   - 优先级排序

输出格式：
\`\`\`json
{
  "dataInterpretation": "数据解读",
  "sourceAnalysis": "来源分析",
  "suggestions": [
    { "priority": 1, "suggestion": "建议内容" },
    { "priority": 2, "suggestion": "建议内容" },
    { "priority": 3, "suggestion": "建议内容" }
  ]
}
\`\`\`
`,
  
  variables: [
    { key: 'accountName', label: '账号昵称', type: 'text', required: true },
    { key: 'currentFollowers', label: '当前粉丝数', type: 'number', required: true },
    { key: 'domain', label: '领域', type: 'text', defaultValue: '综合' },
    { key: 'period', label: '统计周期', type: 'number', defaultValue: '7' },
    { key: 'totalGain', label: '新增粉丝', type: 'number', required: true },
    { key: 'totalLoss', label: '取关人数', type: 'number', defaultValue: '0' },
    { key: 'netGrowth', label: '净增长', type: 'number', required: true },
    { key: 'avgDailyGain', label: '日均涨粉', type: 'number', required: true },
    { key: 'sourceDistribution', label: '来源分布', type: 'text', required: true },
    { key: 'recentEvents', label: '最近事件', type: 'text', defaultValue: '无' }
  ],
  
  outputHandler: 'json'
};
```

---

### 2.6 评估内容质量 (fans.quality.evaluate)

**场景**: 发布博文时，评估内容质量以计算涨粉系数

```typescript
const CONTENT_QUALITY_TASK: LLMTaskDefinition = {
  id: 'fans.quality.evaluate',
  name: '评估内容质量',
  description: '评估博文内容质量，返回质量分数',
  category: 'fans',
  type: 'prompt',
  
  promptTemplate: `
你是一个内容质量评估专家。评估以下博文的质量。

## 博文内容
{{content}}

## 博文信息
- 作者: {{authorName}}
- 作者领域: {{authorDomain}}
- 话题标签: {{topics}}
- 媒体: {{mediaCount}} 张图片/视频
- 发布时间: {{publishTime}}

## 评估维度
请从以下维度评估，每个维度 0-1 分：

1. **内容质量** - 文字是否有价值、有深度
2. **情感吸引力** - 是否能引发情感共鸣
3. **话题相关性** - 是否与热门话题相关
4. **原创性** - 是否有独特观点
5. **传播潜力** - 是否容易被转发

## 输出格式
\`\`\`json
{
  "scores": {
    "contentQuality": 0.8,
    "emotionalAppeal": 0.6,
    "topicRelevance": 0.9,
    "originality": 0.7,
    "viralPotential": 0.5
  },
  "overallScore": 0.7,
  "brief": "简短评价 (20字以内)"
}
\`\`\`

overallScore 范围：0.1 - 3.0，其中：
- 0.1-0.5: 低质量内容
- 0.5-1.0: 普通内容
- 1.0-2.0: 优质内容
- 2.0-3.0: 爆款潜力
`,
  
  variables: [
    { key: 'content', label: '博文内容', type: 'text', required: true },
    { key: 'authorName', label: '作者', type: 'text', required: true },
    { key: 'authorDomain', label: '作者领域', type: 'text', defaultValue: '综合' },
    { key: 'topics', label: '话题标签', type: 'text', defaultValue: '无' },
    { key: 'mediaCount', label: '媒体数量', type: 'number', defaultValue: '0' },
    { key: 'publishTime', label: '发布时间', type: 'text', defaultValue: '' }
  ],
  
  outputHandler: 'json'
};
```

---

## 3. 任务注册

### 3.1 注册到 LLM Task Service

```typescript
// src/services/fans/llmTasks.ts

import { llmTaskStore } from '@/stores/llmTaskStore';

export const FANS_LLM_TASKS = [
  PROFILE_GENERATE_TASK,
  PROFILE_BATCH_TASK,
  FOLLOWER_STORY_TASK,
  MILESTONE_CELEBRATION_TASK,
  ANALYZE_GROWTH_TASK,
  CONTENT_QUALITY_TASK
];

export function registerFansLLMTasks(): void {
  for (const task of FANS_LLM_TASKS) {
    llmTaskStore.registerTask(task);
  }
  
  console.log(`[FansService] Registered ${FANS_LLM_TASKS.length} LLM tasks`);
}
```

### 3.2 任务执行示例

```typescript
// 生成粉丝画像
async function generateProfile(context: SourceContext): Promise<FanProfile> {
  const result = await llmTaskStore.executeTask('fans.profile.generate', {
    followeeName: context.followeeName,
    followeeDomain: context.followeeDomain.join(', '),
    followeeStyle: context.followeeStyle,
    source: context.source,
    sourceDetail: context.sourceDetail || '',
    gender: 'unknown',
    ageRange: '25-34',
    activityLevel: 'medium'
  });
  
  return parseProfileResult(result);
}

// 生成涨粉故事
async function generateStory(event: FollowerGainEvent): Promise<string> {
  const result = await llmTaskStore.executeTask('fans.story.gain', {
    authorName: await getAccountName(event.accountId),
    followerGain: event.followerGain,
    source: getSourceLabel(event.source),
    sourceDetail: formatSourceDetail(event.sourceDetail),
    relatedContent: await getRelatedContent(event),
    time: formatTime(event.timestamp)
  });
  
  return result as string;
}
```

---

## 4. 调用优化

### 4.1 调用频率控制

```typescript
interface LLMCallConfig {
  // 每小时最大调用次数
  maxCallsPerHour: number;  // 默认 20
  
  // 最小涨粉数才触发故事生成
  minGainForStory: number;  // 默认 50
  
  // 最小涨粉数才使用 LLM 生成画像
  minGainForLLMProfile: number;  // 默认 10
  
  // 批量生成阈值
  batchThreshold: number;  // 默认 5
}

const DEFAULT_LLM_CONFIG: LLMCallConfig = {
  maxCallsPerHour: 20,
  minGainForStory: 50,
  minGainForLLMProfile: 10,
  batchThreshold: 5
};
```

### 4.2 降级策略

```typescript
async function generateProfileWithFallback(
  context: SourceContext,
  config: LLMCallConfig
): Promise<FanProfile> {
  // 检查是否达到调用上限
  if (await isRateLimited()) {
    console.log('[FansService] LLM rate limited, using rule-based generation');
    return generateProfileByRule(context);
  }
  
  try {
    return await generateProfile(context);
  } catch (error) {
    console.error('[FansService] LLM generation failed, fallback to rule', error);
    return generateProfileByRule(context);
  }
}
```

---

## 5. 参考文档

- [粉丝服务概述](./README.md)
- [画像系统](./profile-system.md)
- [增长引擎](./growth-engine.md)
- [LLM 任务服务](../llm-task-service/README.md)
