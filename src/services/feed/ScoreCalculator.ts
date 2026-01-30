/**
 * 分数计算器
 * 根据算法配置计算内容排序分数
 */

import type { UniversalPost } from '@/types/social';
import type {
  AlgorithmConfig,
  ScoreComponents,
  ScoreContext,
} from '@/types/feed';

/**
 * 分数计算器类
 */
export class ScoreCalculator {
  /**
   * 计算帖子的排序分数
   */
  calculate(
    post: UniversalPost,
    config: AlgorithmConfig,
    context: ScoreContext
  ): ScoreComponents {
    const { weights, decayHalfLife } = config;

    // 时效性分数
    const recency = this.calculateRecencyScore(post.timestamp, context.now, decayHalfLife);

    // 互动量分数
    const engagement = this.calculateEngagementScore(post, context.normalization.maxEngagement);

    // 相关性分数
    const relevance = this.calculateRelevanceScore(post.topicTags, context.interestTags);

    // 社交分数
    const social = this.calculateSocialScore(
      post.authorId,
      context.followingIds,
      context.interactedIds
    );

    // 加权总分
    const total =
      weights.recency * recency +
      weights.engagement * engagement +
      weights.relevance * relevance +
      weights.social * social;

    return { recency, engagement, relevance, social, total };
  }

  /**
   * 批量计算分数
   */
  calculateBatch(
    posts: UniversalPost[],
    config: AlgorithmConfig,
    context: ScoreContext
  ): Map<string, ScoreComponents> {
    const results = new Map<string, ScoreComponents>();

    for (const post of posts) {
      results.set(post.id, this.calculate(post, config, context));
    }

    return results;
  }

  /**
   * 计算时效性分数（指数衰减）
   * @param timestamp 帖子时间戳
   * @param now 当前时间戳
   * @param halfLife 半衰期（小时）
   * @returns 0-1 的分数
   */
  private calculateRecencyScore(timestamp: number, now: number, halfLife: number): number {
    const ageInHours = (now - timestamp) / (1000 * 60 * 60);
    
    // 未来的帖子（可能是时区问题）给满分
    if (ageInHours < 0) return 1;
    
    // 指数衰减: score = 0.5^(age/halfLife) = e^(-age * ln(2) / halfLife)
    return Math.exp(-ageInHours * Math.LN2 / halfLife);
  }

  /**
   * 计算互动量分数
   * 使用对数归一化避免极端值影响
   */
  private calculateEngagementScore(post: UniversalPost, maxEngagement: number): number {
    const { likes, comments, shares, views = 0 } = post.stats;
    
    // 加权互动量
    // 点赞 1 分，评论 2 分，转发 3 分，浏览 0.01 分
    const engagementRaw = likes + comments * 2 + shares * 3 + views * 0.01;
    
    // 对数归一化
    // 使用 log(1 + x) 避免 log(0) 的问题
    if (maxEngagement <= 0) return 0.5; // 无参考值时返回中性分数
    
    const score = Math.log(1 + engagementRaw) / Math.log(1 + maxEngagement);
    return Math.min(1, Math.max(0, score));
  }

  /**
   * 计算相关性分数
   * 基于标签匹配
   */
  private calculateRelevanceScore(postTags: string[], userTags: string[]): number {
    // 无偏好时返回中性分数
    if (userTags.length === 0) return 0.5;
    if (postTags.length === 0) return 0.3;

    // 计算匹配的标签数量
    const normalizedPostTags = postTags.map(t => t.toLowerCase());
    const normalizedUserTags = userTags.map(t => t.toLowerCase());
    
    const matchCount = normalizedPostTags.filter(t => normalizedUserTags.includes(t)).length;
    
    // 使用 Jaccard 相似度的变体
    // 侧重于用户标签的覆盖率
    return matchCount / Math.max(userTags.length, 1);
  }

  /**
   * 计算社交分数
   * 基于关注关系和互动历史
   */
  private calculateSocialScore(
    authorId: string,
    followingIds: string[],
    interactedIds: string[]
  ): number {
    let score = 0;

    // 关注的人 +0.5
    if (followingIds.includes(authorId)) {
      score += 0.5;
    }

    // 互动过的人 +0.5
    if (interactedIds.includes(authorId)) {
      score += 0.5;
    }

    return score;
  }

  /**
   * 创建评分上下文
   * 便于外部使用
   */
  static createContext(params: {
    userId: string;
    followingIds?: string[];
    interactedIds?: string[];
    interestTags?: string[];
    now?: number;
    maxEngagement?: number;
    maxHeat?: number;
  }): ScoreContext {
    return {
      userId: params.userId,
      followingIds: params.followingIds || [],
      interactedIds: params.interactedIds || [],
      interestTags: params.interestTags || [],
      now: params.now || Date.now(),
      normalization: {
        maxEngagement: params.maxEngagement || 10000,
        maxHeat: params.maxHeat || 100,
      },
    };
  }
}

/**
 * 默认的分数计算器实例
 */
export const scoreCalculator = new ScoreCalculator();
