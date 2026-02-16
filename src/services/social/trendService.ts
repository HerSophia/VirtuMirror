import type { TrendingTopic, UniversalPost, WorldEvent } from '../../types/social';
import type { TopicContentResult } from './topicContentLoader';
import { getTrendingService } from '@/services/trending';

export class TrendService {
  private static instance: TrendService;

  private constructor() {}

  private get service() {
    return getTrendingService();
  }

  public static getInstance(): TrendService {
    if (!TrendService.instance) {
      TrendService.instance = new TrendService();
    }
    return TrendService.instance;
  }

  /**
   * 创建新的热搜话题 (通常由 Director 或 User Action 触发)
   */
  public async createTopicFromEvent(event: WorldEvent): Promise<TrendingTopic[]> {
    return this.service.createFromEvent(event);
  }

  /**
   * 获取某平台的实时热搜榜
   */
  public async getTrendingList(platformId: string, limit: number = 20): Promise<TrendingTopic[]> {
    return this.service.getTrending(platformId, { limit });
  }

  /**
   * 惰性填充：确保话题下有内容
   * 当用户点击热搜时调用
   * 
   * 使用 LazyLoader 服务实现：
   * - 自动缓存已加载的内容
   * - 并发控制，避免同时生成过多内容
   * - 请求去重，避免重复生成
   */
  public async ensureTopicContent(topicId: string): Promise<UniversalPost[]> {
    return this.service.ensureTopicContent(topicId);
  }

  /**
   * 获取话题内容（带缓存状态）
   */
  public async getTopicContent(topicId: string): Promise<TopicContentResult | undefined> {
    return this.service.getTopicContent(topicId);
  }

  /**
   * 预加载热门话题内容
   * 在用户浏览热搜列表时调用，提前加载前几个话题
   */
  public async preloadTopics(topicIds: string[]): Promise<void> {
    await this.service.preloadTopicContent(topicIds);
  }

  /**
   * 检查话题内容是否已加载
   */
  public hasTopicContent(topicId: string): boolean {
    return this.service.hasTopicContent(topicId);
  }

  /**
   * 使话题内容缓存失效
   * 当需要刷新话题内容时调用
   */
  public invalidateTopicContent(topicId: string): void {
    this.service.invalidateTopicContent(topicId);
  }

  /**
   * 获取加载器统计信息
   */
  public getLoaderStats() {
    return this.service.getLoaderStats();
  }
}
