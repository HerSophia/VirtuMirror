/**
 * 算法注册表
 * 管理各平台的算法配置
 */

import type { AlgorithmConfig, AlgorithmWeights } from '@/types/feed';
import { loggerService } from '@/services/logger/loggerService';

/**
 * 默认算法配置
 */
export const DEFAULT_ALGORITHM_CONFIG: AlgorithmConfig = {
  weights: {
    recency: 0.3,
    engagement: 0.3,
    relevance: 0.2,
    social: 0.2,
  },
  decayHalfLife: 6, // 6 小时
  diversityRules: {
    maxSameAuthor: 3,
    maxSameCategory: 5,
    maxSameTopic: 4,
  },
  enablePersonalization: true,
  coldStartStrategy: 'trending',
};

/**
 * 算法注册表类
 */
export class AlgorithmRegistry {
  private configs: Map<string, AlgorithmConfig> = new Map();

  /**
   * 注册平台算法配置
   */
  register(platformId: string, config: AlgorithmConfig): void {
    // 验证权重总和为 1
    const normalizedConfig = this.normalizeWeights(config);
    this.configs.set(platformId, normalizedConfig);
  }

  /**
   * 获取算法配置
   */
  get(platformId: string): AlgorithmConfig {
    return this.configs.get(platformId) || { ...DEFAULT_ALGORITHM_CONFIG };
  }

  /**
   * 检查是否有平台配置
   */
  has(platformId: string): boolean {
    return this.configs.has(platformId);
  }

  /**
   * 更新权重
   */
  updateWeights(platformId: string, weights: Partial<AlgorithmWeights>): void {
    const config = this.get(platformId);
    config.weights = { ...config.weights, ...weights };
    this.register(platformId, config);
  }

  /**
   * 移除平台配置
   */
  remove(platformId: string): boolean {
    return this.configs.delete(platformId);
  }

  /**
   * 获取所有已注册的平台 ID
   */
  getPlatformIds(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * 清除所有配置
   */
  clear(): void {
    this.configs.clear();
  }

  /**
   * 归一化权重
   * 确保权重总和为 1
   */
  private normalizeWeights(config: AlgorithmConfig): AlgorithmConfig {
    const { recency, engagement, relevance, social } = config.weights;
    const sum = recency + engagement + relevance + social;

    if (Math.abs(sum - 1) > 0.001) {
      loggerService.warn(
        'AlgorithmRegistry',
        `Weights sum to ${sum.toFixed(3)}, normalizing...`
      );
      return {
        ...config,
        weights: {
          recency: recency / sum,
          engagement: engagement / sum,
          relevance: relevance / sum,
          social: social / sum,
        },
      };
    }

    return config;
  }
}

/**
 * 默认的算法注册表实例
 */
export const algorithmRegistry = new AlgorithmRegistry();
