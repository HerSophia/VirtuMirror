import { TrendingTopic, SuperTopic } from '../../types/social';

/**
 * 热度等级定义
 */
export type HeatLevel = 'boil' | 'explode' | 'hot' | 'new' | 'normal';

/**
 * 热度显示信息
 */
export interface HeatDisplay {
  /** 原始热度值 */
  raw: number;
  /** 格式化后的显示文本 (如 "234.5万") */
  formatted: string;
  /** 热度等级 */
  level: HeatLevel;
  /** 热度标签文本 */
  tag: string;
  /** 是否为新话题 */
  isNew: boolean;
  /** 是否为热门 */
  isHot: boolean;
}

export class TrafficEngine {
  /**
   * 计算话题热度
   * Formula: Heat = (BaseScore * Magnitude) * TimeDecay(t) + Jitter
   * 
   * @param topic 话题对象
   * @param currentTime 当前时间戳
   * @returns 热度值
   */
  public static calculateTopicHeat(topic: TrendingTopic, currentTime: number): number {
    const timeDiff = currentTime - topic.createdAt;
    const durationToPeak = topic.peakTime - topic.createdAt;
    
    // 1. 基础量级映射 (S/A/B/C -> 分数)
    // 假设 baseScore 1-100。
    // 指数放大差异: 100^3 = 1,000,000; 50^3 = 125,000
    const baseMagnitude = Math.pow(topic.baseScore, 3) * 0.1; 
    
    // 2. 时间曲线因子 (发酵 -> 爆发 -> 衰退)
    let timeFactor;
    if (currentTime < topic.peakTime) {
      // 上升期：对数增长模拟发酵，使用正弦曲线的前1/4周期
      const progress = Math.max(0, Math.min(1, timeDiff / Math.max(1, durationToPeak)));
      timeFactor = 0.2 + (0.8 * Math.sin(progress * (Math.PI / 2)));
    } else {
      // 衰退期：指数衰减
      const decayDuration = 1000 * 60 * 60 * 24; // 24小时半衰期基准
      const timeSincePeak = currentTime - topic.peakTime;
      // 保证最小热度不为0 (长尾)
      timeFactor = Math.max(0.05, Math.exp(-timeSincePeak / decayDuration));
    }
    
    // 3. 波动因子 (微小跳动，让数字看起来是活的)
    // 周期为 20秒左右的波动
    const jitter = (Math.sin(currentTime / 20000) * 0.02) + 1; // +/- 2% 波动
    
    return Math.floor(baseMagnitude * timeFactor * jitter);
  }

  /**
   * 计算简化版热度（用于 LLM 生成的热搜）
   * 基于 baseScore 和创建时间计算，不需要完整的 TrendingTopic
   * 
   * @param baseScore 基础分数 (1-100)
   * @param createdAt 创建时间戳
   * @param currentTime 当前时间戳
   * @param peakHours 到达峰值的小时数 (默认 4-24 小时随机)
   * @returns 热度值
   */
  public static calculateSimpleHeat(
    baseScore: number,
    createdAt: number,
    currentTime: number,
    peakHours?: number
  ): number {
    const peakTime = createdAt + (1000 * 60 * 60 * (peakHours ?? (4 + Math.random() * 20)));
    
    const mockTopic: TrendingTopic = {
      id: '',
      keyword: '',
      summary: '',
      categories: [],
      isNew: true,
      isHot: false,
      baseScore,
      velocity: 0,
      createdAt,
      peakTime,
    };
    
    return this.calculateTopicHeat(mockTopic, currentTime);
  }

  /**
   * 格式化热度显示
   * @param heat 原始热度值
   * @returns 格式化后的字符串（如 "234.5万"、"1.2亿"）
   */
  public static formatHeat(heat: number): string {
    if (heat < 10000) {
      return heat.toString();
    } else if (heat < 100000000) {
      // 万级别
      const wan = heat / 10000;
      if (wan < 10) {
        return `${wan.toFixed(1)}万`;
      } else if (wan < 100) {
        return `${Math.floor(wan)}万`;
      } else {
        return `${Math.floor(wan)}万`;
      }
    } else {
      // 亿级别
      const yi = heat / 100000000;
      return `${yi.toFixed(1)}亿`;
    }
  }

  /**
   * 判断热度等级
   * @param heat 热度值
   * @param rank 排名（1-based）
   * @param ageMinutes 话题年龄（分钟）
   * @returns 热度等级
   */
  public static getHeatLevel(
    heat: number,
    rank: number,
    ageMinutes: number
  ): HeatLevel {
    // 沸：排名前3且热度超过100万
    if (rank <= 3 && heat >= 1000000) {
      return 'boil';
    }
    
    // 爆：热度超过50万
    if (heat >= 500000) {
      return 'explode';
    }
    
    // 新：创建时间在1小时内
    if (ageMinutes < 60) {
      return 'new';
    }
    
    // 热：热度超过10万
    if (heat >= 100000) {
      return 'hot';
    }
    
    return 'normal';
  }

  /**
   * 获取完整的热度显示信息
   * @param heat 热度值
   * @param rank 排名
   * @param createdAt 创建时间戳
   * @param currentTime 当前时间戳
   * @returns 热度显示信息
   */
  public static getHeatDisplay(
    heat: number,
    rank: number,
    createdAt: number,
    currentTime: number = Date.now()
  ): HeatDisplay {
    const ageMinutes = (currentTime - createdAt) / (1000 * 60);
    const level = this.getHeatLevel(heat, rank, ageMinutes);
    
    const tagMap: Record<HeatLevel, string> = {
      boil: '沸',
      explode: '爆',
      hot: '热',
      new: '新',
      normal: '',
    };
    
    return {
      raw: heat,
      formatted: this.formatHeat(heat),
      level,
      tag: tagMap[level],
      isNew: level === 'new' || ageMinutes < 60,
      isHot: level === 'hot' || level === 'explode' || level === 'boil',
    };
  }

  /**
   * 基于 baseScore 生成合理的初始热度
   * 用于 LLM 生成热搜时提供参考热度值
   * 
   * @param baseScore 基础分数 (1-100)
   * @returns 初始热度值
   */
  public static generateInitialHeat(baseScore: number): number {
    // 基础映射: baseScore 100 -> 约 100万, baseScore 50 -> 约 12.5万
    const baseMagnitude = Math.pow(baseScore, 3) * 0.1;
    
    // 添加随机波动 (±20%)
    const randomFactor = 0.8 + Math.random() * 0.4;
    
    // 初始阶段约为峰值的 20%-60%
    const initialFactor = 0.2 + Math.random() * 0.4;
    
    return Math.floor(baseMagnitude * randomFactor * initialFactor);
  }

  /**
   * 交互概率漏斗 - 计算该条博文理论上应该有多少互动
   */
  public static calculateInteractions(
    authorFollowers: number,
    topicHeat: number = 0,
    superTopicActiveUsers: number = 0,
    contentQualityScore: number = 0.5 // 0-1, LLM 自评或随机
  ): { likes: number; comments: number; reposts: number; views: number } {
    
    // 1. 基础曝光 (Impressions)
    // 粉丝转化率：通常 5% - 15% 的粉丝能看到
    let impressions = authorFollowers * (0.05 + Math.random() * 0.1);
    
    // 2. 流量池加成
    // 热搜加成
    if (topicHeat > 0) {
      // 假设热度 1,000,000 带来 10,000 额外曝光
      impressions += Math.sqrt(topicHeat) * 10;
    }
    
    // 超话加成
    if (superTopicActiveUsers > 0) {
      impressions += superTopicActiveUsers * 0.01;
    }
    
    // 质量加成 (0.5 - 1.5)
    const qualityMultiplier = 0.5 + contentQualityScore;
    impressions *= qualityMultiplier;
    
    impressions = Math.floor(impressions);
    
    // 3. 互动转化 (Engagements)
    // 点赞率: 1% - 5% of views
    const likeRate = 0.01 + (Math.random() * 0.04 * qualityMultiplier);
    const likes = Math.floor(impressions * likeRate);
    
    // 评论率: 10% - 30% of likes
    const commentRate = 0.1 + (Math.random() * 0.2);
    const comments = Math.floor(likes * commentRate);
    
    // 转发率: 5% - 20% of likes
    const repostRate = 0.05 + (Math.random() * 0.15);
    const reposts = Math.floor(likes * repostRate);

    return {
      views: impressions,
      likes,
      comments,
      reposts
    };
  }
}
