# 增长引擎 (Growth Engine)

> **模块**: Fans Service / Growth Engine  
> **版本**: 1.0  
> **状态**: 设计阶段

## 1. 概述

增长引擎是粉丝服务的核心模块，负责科学地模拟账号粉丝增长。它通过数学模型计算各种场景下的涨粉数量，并在关键节点调用 LLM 生成丰富的涨粉故事。

### 1.1 设计目标

- **真实感**: 涨粉曲线符合真实社交媒体规律
- **可追溯**: 每次涨粉都有明确来源
- **可配置**: 算法参数支持平台差异化
- **高效**: 数值算法为主，LLM 仅用于关键节点

---

## 2. 涨粉来源模型

### 2.1 六大涨粉渠道

```typescript
enum FollowerSource {
  CONTENT_EXPOSURE = 'content_exposure',     // 内容曝光
  HOT_TOPIC_FLOW = 'hot_topic_flow',         // 热搜流量
  INTERACTION_CONVERT = 'interaction_convert', // 互动转化
  REPOST_SPREAD = 'repost_spread',           // 转发扩散
  BIG_V_REFERRAL = 'big_v_referral',         // 大V导流
  PLATFORM_RECOMMEND = 'platform_recommend'   // 平台推荐
}
```

### 2.2 渠道占比参考

基于真实社交媒体数据研究：

| 渠道 | 占比 | 特点 |
| ---- | ---- | ---- |
| 内容曝光 | 40-50% | 最稳定的涨粉来源 |
| 热搜流量 | 15-25% | 波动大，爆发性强 |
| 互动转化 | 10-15% | 需要主动运营 |
| 转发扩散 | 10-15% | 依赖内容质量 |
| 大V导流 | 5-10% | 偶发但效果显著 |
| 平台推荐 | 5-10% | 依赖算法命中 |

---

## 3. 算法详解

### 3.1 内容曝光 (Content Exposure)

最基础的涨粉方式，每发布一条博文都有机会获得新粉丝。

**触发条件**: 发布博文

**计算公式**:

```typescript
function calculateContentExposureGain(
  post: UniversalPost,
  account: SocialAccount
): number {
  // 基础曝光量 = 粉丝基数 × 曝光率 + 冷启动流量
  const baseExposure = account.followers * 0.1 + 100;
  
  // 内容质量评分 (0.1 - 3.0)
  const qualityScore = evaluateContentQuality(post);
  
  // 转化率 (新账号更高，老账号趋于稳定)
  // 使用对数衰减：粉丝越多，转化率越低
  const conversionRate = 0.01 * (1 + 1 / Math.log10(account.followers + 10));
  
  // 随机因子 (模拟真实波动)
  const randomFactor = 0.5 + Math.random();
  
  // 最终涨粉数
  return Math.floor(baseExposure * qualityScore * conversionRate * randomFactor);
}
```

**内容质量评分因素**:

| 因素 | 权重 | 评分规则 |
| ---- | ---- | ---- |
| 文字长度 | 0.2 | 100-500字最佳 (1.0)，过短/过长扣分 |
| 话题相关性 | 0.3 | 蹭热点加分，无关话题不加分 |
| 情感强度 | 0.2 | 情绪饱满更易传播 |
| 原创性 | 0.2 | 转发内容权重低 (0.3) |
| 发布时间 | 0.1 | 黄金时段 (12:00, 18:00, 21:00) 加成 |

```typescript
function evaluateContentQuality(post: UniversalPost): number {
  let score = 1.0;
  
  // 文字长度评分
  const textLength = post.payload.text?.length || 0;
  if (textLength >= 100 && textLength <= 500) {
    score += 0.2;
  } else if (textLength < 50) {
    score -= 0.1;
  }
  
  // 话题相关性
  if (post.topicTags?.length > 0) {
    const hotTopicBonus = post.topicTags.some(tag => isHotTopic(tag)) ? 0.5 : 0.1;
    score += hotTopicBonus;
  }
  
  // 原创性
  if (post.primaryType === 'repost') {
    score *= 0.3;
  }
  
  // 媒体加成
  if (post.media?.length > 0) {
    score += 0.1 * Math.min(post.media.length, 3);
  }
  
  // 时间段加成
  const hour = new Date(post.timestamp).getHours();
  if ([12, 18, 19, 20, 21, 22].includes(hour)) {
    score += 0.1;
  }
  
  return Math.max(0.1, Math.min(3.0, score));
}
```

---

### 3.2 热搜流量 (Hot Topic Flow)

参与热搜话题可获得额外曝光。

**触发条件**: 博文包含热搜话题标签

**计算公式**:

```typescript
function calculateHotTopicGain(
  post: UniversalPost,
  topic: TrendingTopic
): number {
  // 话题热度系数 (1-100 映射到 1-10)
  const topicHeatMultiplier = topic.score / 10;
  
  // 参与时机系数 (越早参与收益越高)
  const hoursSinceTopicStart = (Date.now() - topic.startTime) / 3600000;
  const participationTiming = 1 / (1 + hoursSinceTopicStart * 0.1);
  
  // 基础流量池
  const basePool = topicHeatMultiplier * 1000;
  
  // 竞争系数 (参与者越多，单人分得越少)
  const competitionFactor = 1 / Math.sqrt(topic.participantCount + 1);
  
  // 内容质量
  const qualityScore = evaluateContentQuality(post);
  
  // 涨粉数
  return Math.floor(
    basePool * participationTiming * competitionFactor * qualityScore * 0.005
  );
}
```

**示例计算**:

- 热度 80 的话题，1小时内参与，100人竞争，质量分 1.5
- `basePool = 8000`
- `timing = 1 / (1 + 1 * 0.1) = 0.91`
- `competition = 1 / √101 = 0.1`
- `gain = 8000 * 0.91 * 0.1 * 1.5 * 0.005 ≈ 5` 粉丝

---

### 3.3 互动转化 (Interaction Convert)

主动评论/回复他人博文，有概率转化对方粉丝。

**触发条件**: 发布评论

**计算公式**:

```typescript
function calculateInteractionConvertGain(
  comment: Comment,
  targetPost: UniversalPost,
  targetAccount: SocialAccount
): number {
  // 目标博主的粉丝基数影响
  const targetInfluence = Math.log10(targetAccount.followers + 100);
  
  // 评论质量 (点赞数反映)
  const commentQuality = Math.min(comment.likes / 10, 3);
  
  // 转化概率
  const conversionProb = 0.001 * targetInfluence * commentQuality;
  
  // 单次最大转化
  const maxConvert = Math.min(targetAccount.followers * 0.001, 100);
  
  // 随机因子
  const randomFactor = 0.5 + Math.random();
  
  // 涨粉数
  return Math.floor(maxConvert * conversionProb * randomFactor);
}
```

---

### 3.4 转发扩散 (Repost Spread)

被他人转发时，获得二次曝光。

**触发条件**: 博文被转发

**计算公式**:

```typescript
function calculateRepostSpreadGain(
  originalPost: UniversalPost,
  reposter: SocialAccount,
  repostDepth: number  // 转发层级：1=直接转发，2=转发的转发
): number {
  // 转发者粉丝基数
  const reposterReach = reposter.followers;
  
  // 转发深度衰减 (转发的转发收益递减)
  const depthDecay = 1 / Math.pow(2, repostDepth - 1);
  
  // 基础曝光
  const baseExposure = reposterReach * 0.05 * depthDecay;
  
  // 转化率
  const conversionRate = 0.01;
  
  // 随机因子
  const randomFactor = 0.5 + Math.random();
  
  // 涨粉数
  return Math.floor(baseExposure * conversionRate * randomFactor);
}
```

---

### 3.5 大V导流 (Big V Referral)

被大V（粉丝数 > 阈值）点赞/评论/转发，获得显著流量。

**触发条件**: 收到大V互动

**大V等级定义**:

| 等级 | 粉丝数要求 | 导流系数 |
| ---- | ---- | ---- |
| Tier 1 | 100万+ | 5.0 |
| Tier 2 | 50-100万 | 3.0 |
| Tier 3 | 10-50万 | 2.0 |

**互动类型权重**:

| 互动类型 | 权重 |
| ---- | ---- |
| like (点赞) | 0.5 |
| comment (评论) | 1.5 |
| repost (转发) | 3.0 |
| mention (@提及) | 2.0 |

**计算公式**:

```typescript
function calculateBigVReferralGain(
  bigV: SocialAccount,
  interactionType: 'like' | 'comment' | 'repost' | 'mention'
): number {
  // 获取大V等级系数
  const tierMultiplier = getBigVTier(bigV.followers);
  
  // 互动类型权重
  const interactionWeight = {
    'like': 0.5,
    'comment': 1.5,
    'repost': 3.0,
    'mention': 2.0
  }[interactionType];
  
  // 基础导流
  const baseReferral = tierMultiplier * 100 * interactionWeight;
  
  // 随机因子 (大V导流波动较小)
  const randomFactor = 0.7 + Math.random() * 0.6;
  
  // 涨粉数
  return Math.floor(baseReferral * randomFactor);
}

function getBigVTier(followers: number): number {
  if (followers >= 1000000) return 5;  // Tier 1
  if (followers >= 500000) return 3;   // Tier 2
  if (followers >= 100000) return 2;   // Tier 3
  return 0;  // 非大V
}
```

**特殊机制**: 大V导流事件会触发 LLM 生成「涨粉故事」。

---

### 3.6 平台推荐 (Platform Recommend)

内容进入平台推荐池（发现页/推荐流）。

**触发条件**: 随机触发（基于内容质量）

**计算公式**:

```typescript
function calculatePlatformRecommendGain(
  post: UniversalPost,
  config: PlatformConfig
): number | null {
  // 内容质量评分
  const qualityScore = evaluateContentQuality(post);
  
  // 推荐概率 (质量越高越容易被推)
  const recommendProb = qualityScore * 0.05;
  
  // 是否被推荐
  const isRecommended = Math.random() < recommendProb;
  
  if (!isRecommended) {
    return null;  // 未被推荐
  }
  
  // 推荐池大小 (模拟平台 DAU 的一部分)
  const recommendPool = config.recommendPoolSize * (0.5 + Math.random());
  
  // 转化率
  const conversionRate = 0.001 * qualityScore;
  
  // 涨粉数
  return Math.floor(recommendPool * conversionRate);
}
```

---

## 4. 时间维度模型

### 4.1 增长曲线阶段

```text
粉丝数 ↑
       │                                    ╭────── 平台期
       │                              ╭─────╯
       │                        ╭─────╯
       │                  ╭─────╯ 增长期
       │            ╭─────╯
       │      ╭─────╯
       │ ╭────╯ 冷启动期
       │─╯
       └──────────────────────────────────────────▶ 时间
```

### 4.2 阶段特征

| 阶段 | 粉丝数范围 | 日均涨粉 | 主要涨粉渠道 |
| ---- | ---- | ---- | ---- |
| 冷启动期 | 0 - 100 | 5-20 | 互动转化、初始种子 |
| 萌芽期 | 100 - 1,000 | 20-50 | 内容曝光开始生效 |
| 增长期 | 1,000 - 10,000 | 50-200 | 多渠道正循环 |
| 稳定期 | 10,000 - 100,000 | 100-500 | 内容曝光为主 |
| 平台期 | 100,000+ | 波动 | 爆款和事件驱动 |

### 4.3 时间衰减函数

博文的涨粉效应随时间衰减：

```typescript
function calculateTimeDecay(
  hoursSincePost: number,
  qualityScore: number
): number {
  // 指数衰减 (24小时半衰期)
  const exponentialDecay = Math.exp(-hoursSincePost / 24);
  
  // 长尾效应 (优质内容持续产生价值)
  const longTailBonus = qualityScore > 2 ? 0.1 : 0;
  
  return Math.max(exponentialDecay, longTailBonus);
}
```

---

## 5. 服务接口

### 5.1 GrowthEngine 类

```typescript
export class GrowthEngine {
  private config: GrowthEngineConfig;
  private dataStore: FansDataStore;
  
  constructor(config: GrowthEngineConfig) {
    this.config = config;
    this.dataStore = new FansDataStore();
  }
  
  // ===== 事件处理方法 =====
  
  /**
   * 处理博文发布事件
   */
  async processPostPublish(post: UniversalPost): Promise<FollowerGainEvent | null> {
    const gains: FollowerGainEvent[] = [];
    
    // 1. 内容曝光涨粉
    const exposureGain = this.calculateContentExposureGain(post);
    if (exposureGain > 0) {
      gains.push(this.createEvent(post.authorId, FollowerSource.CONTENT_EXPOSURE, exposureGain, { postId: post.id }));
    }
    
    // 2. 热搜流量涨粉
    const hotTopicGain = await this.calculateHotTopicGain(post);
    if (hotTopicGain > 0) {
      gains.push(this.createEvent(post.authorId, FollowerSource.HOT_TOPIC_FLOW, hotTopicGain, { postId: post.id }));
    }
    
    // 3. 平台推荐涨粉
    const recommendGain = this.calculatePlatformRecommendGain(post);
    if (recommendGain && recommendGain > 0) {
      gains.push(this.createEvent(post.authorId, FollowerSource.PLATFORM_RECOMMEND, recommendGain, { postId: post.id }));
    }
    
    // 合并事件
    return this.mergeGainEvents(gains);
  }
  
  /**
   * 处理互动事件
   */
  async processInteraction(
    interaction: SocialInteraction,
    targetPost: UniversalPost
  ): Promise<FollowerGainEvent | null> {
    if (interaction.type !== 'comment') {
      return null;  // 仅评论可触发互动转化
    }
    
    const gain = this.calculateInteractionConvertGain(interaction, targetPost);
    if (gain <= 0) return null;
    
    return this.createEvent(
      interaction.userId,
      FollowerSource.INTERACTION_CONVERT,
      gain,
      { interactionId: interaction.id, targetPostId: targetPost.id }
    );
  }
  
  /**
   * 处理被转发事件
   */
  async processRepost(
    originalPost: UniversalPost,
    reposter: SocialAccount,
    depth: number = 1
  ): Promise<FollowerGainEvent | null> {
    const gain = this.calculateRepostSpreadGain(originalPost, reposter, depth);
    if (gain <= 0) return null;
    
    return this.createEvent(
      originalPost.authorId,
      FollowerSource.REPOST_SPREAD,
      gain,
      { postId: originalPost.id, reposterId: reposter.accountId }
    );
  }
  
  /**
   * 处理大V互动事件
   */
  async processBigVInteraction(
    targetAccountId: string,
    bigV: SocialAccount,
    interactionType: 'like' | 'comment' | 'repost' | 'mention'
  ): Promise<FollowerGainEvent | null> {
    const gain = this.calculateBigVReferralGain(bigV, interactionType);
    if (gain <= 0) return null;
    
    const event = this.createEvent(
      targetAccountId,
      FollowerSource.BIG_V_REFERRAL,
      gain,
      { bigVId: bigV.accountId, interactionType }
    );
    
    // 大V导流触发故事生成
    if (this.config.enableLLMStories) {
      event.story = await this.generateFollowerStory(event);
    }
    
    return event;
  }
  
  // ===== 查询方法 =====
  
  /**
   * 获取账号成长数据
   */
  async getAccountGrowth(accountId: string): Promise<AccountGrowth> {
    return this.dataStore.getAccountGrowth(accountId);
  }
  
  /**
   * 获取涨粉历史
   */
  async getGainHistory(
    accountId: string,
    options?: { limit?: number; source?: FollowerSource }
  ): Promise<FollowerGainEvent[]> {
    return this.dataStore.queryGainEvents(accountId, options);
  }
}
```

### 5.2 配置接口

```typescript
interface GrowthEngineConfig {
  // 基础系数
  baseConversionRate: number;     // 基础转化率 (默认 0.01)
  qualityMultiplierRange: [number, number]; // 质量系数范围 [0.1, 3.0]
  randomFactorRange: [number, number];      // 随机系数范围 [0.5, 1.5]
  
  // 衰减参数
  timeDecayHalfLife: number;      // 半衰期 (小时, 默认 24)
  
  // 大V定义
  bigVThresholds: {
    tier1: number;  // 默认 1000000
    tier2: number;  // 默认 500000
    tier3: number;  // 默认 100000
  };
  
  // 平台推荐
  recommendProbBase: number;      // 基础推荐概率 (默认 0.05)
  recommendPoolSize: number;      // 推荐池大小 (默认 10000)
  
  // LLM 相关
  enableLLMStories: boolean;      // 是否生成涨粉故事
  minGainForStory: number;        // 触发故事生成的最小涨粉数 (默认 50)
}

// 默认配置
export const DEFAULT_GROWTH_CONFIG: GrowthEngineConfig = {
  baseConversionRate: 0.01,
  qualityMultiplierRange: [0.1, 3.0],
  randomFactorRange: [0.5, 1.5],
  
  timeDecayHalfLife: 24,
  
  bigVThresholds: {
    tier1: 1000000,
    tier2: 500000,
    tier3: 100000
  },
  
  recommendProbBase: 0.05,
  recommendPoolSize: 10000,
  
  enableLLMStories: true,
  minGainForStory: 50
};
```

---

## 6. 平台差异化配置

不同平台可以通过配置覆盖默认参数：

```typescript
const PLATFORM_CONFIGS: Record<string, Partial<GrowthEngineConfig>> = {
  weibo: {
    bigVThresholds: { tier1: 1000000, tier2: 500000, tier3: 100000 },
    recommendPoolSize: 10000
  },
  bilibili: {
    bigVThresholds: { tier1: 500000, tier2: 100000, tier3: 50000 },
    recommendPoolSize: 5000,
    // B站更注重内容质量
    baseConversionRate: 0.015
  },
  douyin: {
    bigVThresholds: { tier1: 5000000, tier2: 1000000, tier3: 500000 },
    recommendPoolSize: 50000,
    // 抖音推荐算法更强
    recommendProbBase: 0.1
  }
};
```

---

## 7. 集成示例

### 7.1 与微博 Store 集成

```typescript
// weibo/stores/feedStore.ts
import { GrowthEngine } from '@/services/fans';

const growthEngine = GrowthEngine.getInstance('weibo');

async function publishPost(post: UniversalPost) {
  // ... 发布博文逻辑 ...
  
  // 计算涨粉
  const gainEvent = await growthEngine.processPostPublish(post);
  
  if (gainEvent && gainEvent.followerGain > 0) {
    // 更新账号粉丝数
    await accountStore.incrementFollowers(
      post.authorId,
      gainEvent.followerGain
    );
    
    // 显示涨粉通知
    if (gainEvent.followerGain >= 10) {
      notificationStore.push({
        type: 'follower_gain',
        title: `+${gainEvent.followerGain} 新粉丝`,
        body: gainEvent.story || `来自${getSourceLabel(gainEvent.source)}`
      });
    }
  }
}
```

---

## 8. 附录：真实数据参考

基于公开的社交媒体研究数据：

| 账号类型 | 日均涨粉 | 互动转化率 | 内容曝光率 |
| ---- | ---- | ---- | ---- |
| 素人 (0-1k) | 5-20 | 0.5% | 10% |
| 小V (1k-10k) | 20-100 | 0.3% | 15% |
| 中V (10k-100k) | 50-300 | 0.2% | 20% |
| 大V (100k+) | 100-1000 | 0.1% | 25% |

---

## 9. 参考文档

- [粉丝服务概述](./README.md)
- [涨粉算法引擎（原始设计）](../follower-growth-engine.md)
- [LLM 任务定义](./llm-tasks.md)
