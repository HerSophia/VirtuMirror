import { db } from '@/services/database';
import { interactionService } from '@/services/interaction';
import { socialGraphService } from '@/services/socialGraph';
import { trendingService } from '@/services/trending';
import type { UniversalPost } from '@/types/social';

const FOLLOW_PAGE_LIMIT = 200;
const MAX_FOLLOW_SCAN = 2000;
const MAX_INTERACTION_SCAN = 200;

function normalizeTag(tag: string): string {
  return tag.replace(/^#+|#+$/g, '').trim().toLowerCase();
}

function hasTagIntersection(post: UniversalPost, tags: Set<string>): boolean {
  if (!post.topicTags || post.topicTags.length === 0) {
    return false;
  }

  return post.topicTags.some((tag) => tags.has(normalizeTag(tag)));
}

function calculatePostHeat(post: UniversalPost): number {
  const stats = post.stats;
  const engagement = (stats.likes ?? 0) + (stats.comments ?? 0) * 2 + (stats.shares ?? 0) * 3;
  const ageHours = (Date.now() - post.timestamp) / (60 * 60 * 1000);
  const recencyBoost = Math.max(0, 24 - ageHours) / 24;
  return engagement + recencyBoost * 100;
}

export class SystemContentProvider {
  async getFollowingPosts(userId: string, platformId: string, limit: number): Promise<UniversalPost[]> {
    const followingIds = await this.getFollowingIds(userId, platformId);
    if (followingIds.length === 0) {
      return [];
    }

    const authorSet = new Set(followingIds);
    const posts = await db.socialPosts.where('platformId').equals(platformId).toArray();

    return posts
      .filter((post) => authorSet.has(post.authorId))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getTrendingPosts(
    platformId: string,
    limit: number,
    category?: string
  ): Promise<UniversalPost[]> {
    const posts = await db.socialPosts.where('platformId').equals(platformId).toArray();
    if (posts.length === 0) {
      return [];
    }

    const topics = await trendingService.getTrending(platformId, {
      limit: Math.max(limit, 20),
      category,
      includeSponsored: false,
    });

    if (topics.length === 0) {
      return posts.sort((a, b) => calculatePostHeat(b) - calculatePostHeat(a)).slice(0, limit);
    }

    const topicTags = new Set(topics.map((topic) => normalizeTag(topic.keyword)));

    const matched = posts
      .filter((post) => hasTagIntersection(post, topicTags))
      .sort((a, b) => calculatePostHeat(b) - calculatePostHeat(a));

    if (matched.length >= limit) {
      return matched.slice(0, limit);
    }

    const selectedIds = new Set(matched.map((post) => post.id));
    const fallback = posts
      .filter((post) => !selectedIds.has(post.id))
      .sort((a, b) => calculatePostHeat(b) - calculatePostHeat(a));

    return [...matched, ...fallback].slice(0, limit);
  }

  async getTopicPosts(platformId: string, topicId: string, limit: number): Promise<UniversalPost[]> {
    const topic = await trendingService.getTopic(topicId);
    if (!topic || topic.platformId !== platformId) {
      return [];
    }

    const normalizedKeyword = normalizeTag(topic.keyword);
    const posts = await db.socialPosts.where('platformId').equals(platformId).toArray();

    return posts
      .filter((post) =>
        post.topicTags.some((tag) => normalizeTag(tag) === normalizedKeyword)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getCategoryPosts(platformId: string, category: string, limit: number): Promise<UniversalPost[]> {
    const topics = await trendingService.getTrending(platformId, {
      category,
      limit: Math.max(limit, 20),
      includeSponsored: false,
    });

    const topicTags = new Set(topics.map((topic) => normalizeTag(topic.keyword)));
    const posts = await db.socialPosts.where('platformId').equals(platformId).toArray();

    if (topicTags.size === 0) {
      const normalizedCategory = normalizeTag(category);
      return posts
        .filter((post) => post.topicTags.some((tag) => normalizeTag(tag) === normalizedCategory))
        .sort((a, b) => calculatePostHeat(b) - calculatePostHeat(a))
        .slice(0, limit);
    }

    return posts
      .filter((post) => hasTagIntersection(post, topicTags))
      .sort((a, b) => calculatePostHeat(b) - calculatePostHeat(a))
      .slice(0, limit);
  }

  async getFollowingIds(userId: string, platformId: string): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;

    while (ids.length < MAX_FOLLOW_SCAN) {
      const page = await socialGraphService.getFollowing(userId, {
        platformId,
        limit: FOLLOW_PAGE_LIMIT,
        cursor,
      });

      ids.push(...page.items.map((item) => item.accountId));

      if (!page.hasMore || !page.nextCursor) {
        break;
      }

      cursor = page.nextCursor;
    }

    return Array.from(new Set(ids)).slice(0, MAX_FOLLOW_SCAN);
  }

  async getInteractedIds(userId: string, platformId: string): Promise<string[]> {
    const [likes, favorites, views] = await Promise.all([
      interactionService.getUserLikes(userId, { platformId, limit: MAX_INTERACTION_SCAN }),
      interactionService.getUserFavorites(userId, { platformId, limit: MAX_INTERACTION_SCAN }),
      interactionService.getViewHistory(userId, { platformId, limit: MAX_INTERACTION_SCAN }),
    ]);

    const contentIds = Array.from(
      new Set([
        ...likes.map((item) => item.contentId),
        ...favorites.map((item) => item.contentId),
        ...views.map((item) => item.contentId),
      ])
    );

    if (contentIds.length === 0) {
      return [];
    }

    const posts = await db.socialPosts.where('id').anyOf(contentIds).toArray();
    return Array.from(new Set(posts.map((post) => post.authorId).filter((id) => id !== userId)));
  }

  async getInterestTags(userId: string, platformId: string): Promise<string[]> {
    const [likes, favorites] = await Promise.all([
      interactionService.getUserLikes(userId, { platformId, limit: MAX_INTERACTION_SCAN }),
      interactionService.getUserFavorites(userId, { platformId, limit: MAX_INTERACTION_SCAN }),
    ]);

    const contentIds = Array.from(
      new Set([...likes.map((item) => item.contentId), ...favorites.map((item) => item.contentId)])
    );

    if (contentIds.length === 0) {
      return [];
    }

    const posts = await db.socialPosts.where('id').anyOf(contentIds).toArray();
    const scoreByTag = new Map<string, number>();

    for (const post of posts) {
      for (const rawTag of post.topicTags) {
        const tag = normalizeTag(rawTag);
        if (!tag) {
          continue;
        }

        scoreByTag.set(tag, (scoreByTag.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(scoreByTag.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 20);
  }
}
