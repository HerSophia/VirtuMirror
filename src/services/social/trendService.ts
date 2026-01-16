import { db } from '../database/schema';
import { TrendingTopic, PlatformConfig, WorldEvent } from '../../types/social';
import { TrafficEngine } from './algorithm';
import { ContentFactory } from './contentFactory';
import { PlatformRegistry } from './registry';
import { v4 as uuidv4 } from 'uuid';
import { accountService } from '../account/accountService';
import { UserPool } from '../account/userPool';
import type { PlatformAccount } from '../../types/account';

export class TrendService {
  private static instance: TrendService;

  private constructor() {}

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
    const topics: TrendingTopic[] = [];
    
    // 如果事件指定了平台，就为每个平台创建话题
    // 如果没指定，默认生成全平台话题 (这里简化策略: 既然 DB schema 有 platformId，我们为 affectedPlatforms 每个都生成一条记录，方便独立计算热度)
    // 或者，如果 platformId 为空，代表全网通用。但为了榜单查询方便，我们还是拆分比较好，因为不同平台的热度曲线可能不同。
    
    const platforms = event.affectedPlatforms.length > 0 
      ? event.affectedPlatforms 
      : PlatformRegistry.getInstance().getAllPlatforms().map(p => p.id);

    for (const platformId of platforms) {
      const topic: TrendingTopic = {
        id: uuidv4(),
        platformId,
        keyword: event.topic.startsWith('#') ? event.topic : `#${event.topic}#`,
        summary: event.summary,
        categories: ['general'], // TODO: 从 event 推断分类
        isNew: true,
        isHot: event.priority === 'breaking',
        baseScore: event.priority === 'breaking' ? 90 : (event.priority === 'normal' ? 60 : 30),
        velocity: 0,
        createdAt: Date.now(),
        peakTime: Date.now() + (1000 * 60 * 60 * (4 + Math.random() * 20)), // 4-24小时后到达峰值
      };

      await db.socialTopics.add(topic);
      topics.push(topic);
    }

    return topics;
  }

  /**
   * 获取某平台的实时热搜榜
   */
  public async getTrendingList(platformId: string, limit: number = 20): Promise<TrendingTopic[]> {
    const now = Date.now();
    
    // 1. 获取该平台所有活跃话题 (比如最近 3 天内的)
    const threeDaysAgo = now - (1000 * 60 * 60 * 24 * 3);
    
    // 使用 toArray() 获取所有数据后在内存中过滤
    // 这样更可靠，避免 Dexie 索引问题
    const allTopics = await db.socialTopics.toArray();
    
    // 过滤出指定平台且在时间范围内的话题
    const topics = allTopics.filter(t => 
      t.platformId === platformId && t.createdAt > threeDaysAgo
    );
    
    console.log(`[TrendService] 数据库中共有 ${allTopics.length} 条热搜，其中 ${topics.length} 条属于 ${platformId} 平台`);

    // 2. 实时计算热度并排序
    const rankedTopics = topics.map(topic => {
      const heat = TrafficEngine.calculateTopicHeat(topic, now);
      return { topic, heat };
    }).sort((a, b) => b.heat - a.heat);

    // 3. 更新 isHot / isNew 状态 (纯内存计算，不一定非要写回 DB，或者批量写回)
    // 这里为了简单，只返回对象，不写回 DB
    return rankedTopics.slice(0, limit).map((item, index) => {
      const t = item.topic;
      // 注入实时热度
      t.currentHeat = item.heat;
      
      // 前 3 名且热度高 -> Hot
      t.isHot = index < 3 && item.heat > 10000;
      // 1 小时内创建 -> New
      t.isNew = (now - t.createdAt) < 1000 * 60 * 60;
      return t;
    });
  }

  /**
   * 惰性填充：确保话题下有内容
   * 当用户点击热搜时调用
   */
  public async ensureTopicContent(topicId: string): Promise<void> {
    const topic = await db.socialTopics.get(topicId);
    if (!topic || !topic.platformId) return;

    // 检查该话题下是否有博文
    // 注意：socialPosts 表的 topicTags 是数组，Dexie 支持数组包含查询
    const postCount = await db.socialPosts
      .where('topicTags').equals(topic.keyword)
      .and(p => p.platformId === topic.platformId!)
      .count();

    if (postCount > 0) return; // 已经有内容了

    // 生成初始内容 (Topic Filler)
    console.log(`Generating filler content for topic: ${topic.keyword}`);
    
    // 生成 3-5 条
    const generateCount = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < generateCount; i++) {
      try {
        // 使用新账号系统获取或创建发帖账号
        let account: PlatformAccount | undefined;
        
        // 尝试获取随机的 NPC 账号
        const existingAccounts = await accountService.getAccountsByPlatform(topic.platformId);
        const npcAccounts = existingAccounts.filter(acc => acc.scope === 'session');
        
        if (npcAccounts.length > 0) {
          // 随机选择一个已有账号
          account = npcAccounts[Math.floor(Math.random() * npcAccounts.length)];
        } else {
          // 创建一个新的 NPC 账号
          const userPool = UserPool.getInstance();
          const profile = userPool.generateRandomProfile({ platform: topic.platformId });
          
          const entity = await accountService.createEntity({
            type: 'npc',
            displayName: profile.nickname || '热心网友',
            avatar: profile.avatar,
            bio: profile.bio,
            gender: profile.gender,
            source: 'social',
            scope: 'session',
          });
          
          const handle = `user_${Math.random().toString(36).substr(2, 9)}`;
          account = await accountService.createPlatformAccount(
            entity.id,
            topic.platformId,
            {
              handle,
              nickname: profile.nickname || '热心网友',
              scope: 'session',
            }
          );
        }

        const postData = await ContentFactory.getInstance().generatePost(topic.platformId, topic, account);
        
        // 保存到 DB
        await db.socialPosts.add({
          id: uuidv4(),
          platformId: topic.platformId,
          authorId: account.id,
          timestamp: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60), // 过去1小时内随机时间
          topicTags: [topic.keyword],
          stats: {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0
          },
          payload: postData
        });
      } catch (err) {
        console.error('Failed to generate filler post', err);
      }
    }
  }
}
