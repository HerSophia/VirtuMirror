/**
 * 多样性控制器
 * 避免信息流内容同质化
 */

import type { FeedItem, DiversityRules } from '@/types/feed';

/**
 * 默认多样性规则
 */
export const DEFAULT_DIVERSITY_RULES: DiversityRules = {
  maxSameAuthor: 3,
  maxSameCategory: 5,
  maxSameTopic: 4,
  maxConsecutiveSameType: 3,
};

/**
 * 多样性控制器类
 */
export class DiversityController {
  /**
   * 应用多样性规则
   * 过滤掉超过限制的重复内容
   */
  apply(items: FeedItem[], rules: DiversityRules = DEFAULT_DIVERSITY_RULES): FeedItem[] {
    const result: FeedItem[] = [];
    const counters = {
      author: new Map<string, number>(),
      category: new Map<string, number>(),
      topic: new Map<string, number>(),
    };
    
    // 用于跟踪连续相同类型
    let lastType: string | null = null;
    let consecutiveCount = 0;

    for (const item of items) {
      const authorId = item.post.authorId;
      const category = (item.post.platformData?.category as string) || 'unknown';
      const primaryType = item.post.primaryType || 'text';

      // 检查作者限制
      const authorCount = counters.author.get(authorId) || 0;
      if (rules.maxSameAuthor !== undefined && authorCount >= rules.maxSameAuthor) {
        continue;
      }

      // 检查分类限制
      const categoryCount = counters.category.get(category) || 0;
      if (rules.maxSameCategory !== undefined && categoryCount >= rules.maxSameCategory) {
        continue;
      }

      // 检查话题限制
      let skipByTopic = false;
      if (rules.maxSameTopic !== undefined) {
        for (const topic of item.post.topicTags) {
          const topicCount = counters.topic.get(topic) || 0;
          if (topicCount >= rules.maxSameTopic) {
            skipByTopic = true;
            break;
          }
        }
      }
      if (skipByTopic) continue;

      // 检查连续相同类型限制
      if (rules.maxConsecutiveSameType !== undefined) {
        if (primaryType === lastType) {
          consecutiveCount++;
          if (consecutiveCount >= rules.maxConsecutiveSameType) {
            continue;
          }
        } else {
          lastType = primaryType;
          consecutiveCount = 1;
        }
      }

      // 通过所有检查，加入结果
      result.push(item);

      // 更新计数器
      counters.author.set(authorId, authorCount + 1);
      counters.category.set(category, categoryCount + 1);
      for (const topic of item.post.topicTags) {
        const count = counters.topic.get(topic) || 0;
        counters.topic.set(topic, count + 1);
      }
    }

    return result;
  }

  /**
   * 交错排列不同类型的内容
   * 使信息流更加多样化
   */
  interleave(items: FeedItem[], groupBy: 'author' | 'category' | 'type' = 'author'): FeedItem[] {
    // 按分组键分组
    const groups = new Map<string, FeedItem[]>();

    for (const item of items) {
      let key: string;
      switch (groupBy) {
        case 'author':
          key = item.post.authorId;
          break;
        case 'category':
          key = (item.post.platformData?.category as string) || 'unknown';
          break;
        case 'type':
          key = item.post.primaryType || 'text';
          break;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    // 交错合并
    const result: FeedItem[] = [];
    const groupArrays = Array.from(groups.values());
    const indices = groupArrays.map(() => 0);

    let hasMore = true;
    while (hasMore) {
      hasMore = false;
      for (let i = 0; i < groupArrays.length; i++) {
        if (indices[i] < groupArrays[i].length) {
          result.push(groupArrays[i][indices[i]]);
          indices[i]++;
          hasMore = true;
        }
      }
    }

    return result;
  }

  /**
   * 智能排序
   * 在保持分数排序的同时，尽量避免连续相同类型
   */
  smartSort(
    items: FeedItem[],
    rules: DiversityRules = DEFAULT_DIVERSITY_RULES
  ): FeedItem[] {
    if (items.length <= 1) return items;

    // 先按分数排序
    const sorted = [...items].sort((a, b) => b.score - a.score);

    // 然后应用多样性规则
    const result: FeedItem[] = [];
    const remaining = [...sorted];
    const counters = {
      author: new Map<string, number>(),
      category: new Map<string, number>(),
      topic: new Map<string, number>(),
    };
    let lastType: string | null = null;
    let consecutiveCount = 0;

    while (remaining.length > 0) {
      // 找到第一个满足多样性规则的内容
      let foundIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const authorId = item.post.authorId;
        const category = (item.post.platformData?.category as string) || 'unknown';
        const primaryType = item.post.primaryType || 'text';

        // 检查作者限制
        const authorCount = counters.author.get(authorId) || 0;
        if (rules.maxSameAuthor !== undefined && authorCount >= rules.maxSameAuthor) {
          continue;
        }

        // 检查连续相同类型
        if (
          rules.maxConsecutiveSameType !== undefined &&
          primaryType === lastType &&
          consecutiveCount >= rules.maxConsecutiveSameType
        ) {
          continue;
        }

        // 找到合适的内容
        foundIndex = i;
        break;
      }

      // 如果找不到满足规则的，就取第一个
      if (foundIndex === -1) {
        foundIndex = 0;
      }

      const item = remaining[foundIndex];
      result.push(item);
      remaining.splice(foundIndex, 1);

      // 更新计数器
      const authorId = item.post.authorId;
      const category = (item.post.platformData?.category as string) || 'unknown';
      const primaryType = item.post.primaryType || 'text';

      counters.author.set(authorId, (counters.author.get(authorId) || 0) + 1);
      counters.category.set(category, (counters.category.get(category) || 0) + 1);
      for (const topic of item.post.topicTags) {
        counters.topic.set(topic, (counters.topic.get(topic) || 0) + 1);
      }

      if (primaryType === lastType) {
        consecutiveCount++;
      } else {
        lastType = primaryType;
        consecutiveCount = 1;
      }
    }

    return result;
  }
}

/**
 * 默认的多样性控制器实例
 */
export const diversityController = new DiversityController();
