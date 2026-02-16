import '../../socialGraph/__tests__/setup';
import './setup';

import { beforeEach, describe, expect, it } from 'vitest';
import { accountService } from '@/services/account';
import { db } from '@/services/database';
import { interactionService } from '@/services/interaction';
import { resetSocialGraphService, socialGraphService } from '@/services/socialGraph';
import { SystemContentProvider } from '../SystemContentProvider';

const platformId = 'weibo';

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createAccount(name: string, handle: string): Promise<string> {
  const entity = await accountService.createEntity({
    type: 'npc',
    displayName: name,
    source: 'system',
    scope: 'global',
  });

  const account = await accountService.createPlatformAccount(entity.id, platformId, {
    handle,
    scope: 'global',
  });

  return account.id;
}

async function createPost(authorId: string, tags: string[], likes = 0): Promise<string> {
  const id = uid('post');
  await db.socialPosts.add({
    id,
    platformId,
    authorId,
    timestamp: Date.now(),
    topicTags: tags,
    payload: {
      text: id,
    },
    stats: {
      likes,
      comments: 0,
      shares: 0,
      views: 0,
    },
  });

  return id;
}

describe('SystemContentProvider', () => {
  beforeEach(async () => {
    await db.socialRelations.clear();
    await db.platformAccounts.clear();
    await db.characterEntities.clear();
    await db.socialPosts.clear();
    await db.socialTopics.clear();
    resetSocialGraphService();
  });

  it('loads following ids and following posts from social graph', async () => {
    const provider = new SystemContentProvider();
    const alice = await createAccount('Alice', uid('alice'));
    const bob = await createAccount('Bob', uid('bob'));
    const carol = await createAccount('Carol', uid('carol'));

    await socialGraphService.follow(alice, bob, { platformId });

    const bobPost = await createPost(bob, ['tech'], 10);
    await createPost(carol, ['tech'], 999);

    const followingIds = await provider.getFollowingIds(alice, platformId);
    const followingPosts = await provider.getFollowingPosts(alice, platformId, 20);

    expect(followingIds).toContain(bob);
    expect(followingIds).not.toContain(carol);
    expect(followingPosts.map((post) => post.id)).toContain(bobPost);
    expect(followingPosts.every((post) => post.authorId === bob)).toBe(true);
  });

  it('loads topic/category/trending posts from trending topics', async () => {
    const provider = new SystemContentProvider();
    const author = await createAccount('Author', uid('author'));

    const techPost = await createPost(author, ['#ai#', 'tech'], 20);
    await createPost(author, ['sports'], 10);

    const topicId = uid('topic');
    await db.socialTopics.add({
      id: topicId,
      platformId,
      keyword: '#ai#',
      summary: 'AI topic',
      categories: ['tech'],
      isNew: true,
      isHot: true,
      baseScore: 90,
      velocity: 1,
      createdAt: Date.now(),
      peakTime: Date.now() + 3600_000,
    });

    const topicPosts = await provider.getTopicPosts(platformId, topicId, 10);
    const categoryPosts = await provider.getCategoryPosts(platformId, 'tech', 10);
    const trendingPosts = await provider.getTrendingPosts(platformId, 10, 'tech');

    expect(topicPosts.map((post) => post.id)).toContain(techPost);
    expect(categoryPosts.map((post) => post.id)).toContain(techPost);
    expect(trendingPosts.map((post) => post.id)).toContain(techPost);
  });

  it('builds interacted authors and interest tags from interaction service', async () => {
    const provider = new SystemContentProvider();
    const user = await createAccount('User', uid('user'));
    const authorA = await createAccount('AuthorA', uid('authorA'));
    const authorB = await createAccount('AuthorB', uid('authorB'));

    const postA = await createPost(authorA, ['ai', 'ml'], 5);
    const postB = await createPost(authorB, ['game'], 2);

    await interactionService.like(postA, user, { platformId });
    await interactionService.favorite(postB, user, undefined, { platformId });

    const interactedIds = await provider.getInteractedIds(user, platformId);
    const tags = await provider.getInterestTags(user, platformId);

    expect(interactedIds).toContain(authorA);
    expect(interactedIds).toContain(authorB);
    expect(tags).toContain('ai');
    expect(tags).toContain('game');
  });
});
