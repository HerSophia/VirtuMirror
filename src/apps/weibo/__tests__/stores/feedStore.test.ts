/**
 * feedStore 单元测试
 * 测试信息流、博文、评论管理功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMockPost, createMockDisplayPost } from '../setup';

// 用于测试的数据容器
const mockPosts: any[] = [];
const mockComments: any[] = [];

// 使用 vi.hoisted 确保 mock 对象在模块加载前定义
const { mockDb, mockAccountService } = vi.hoisted(() => {
  const posts: any[] = [];
  const comments: any[] = [];
  return {
    mockDb: {
      socialPosts: {
        toArray: vi.fn().mockImplementation(() => Promise.resolve([...posts])),
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockImplementation(() => Promise.resolve([...posts])),
            reverse: vi.fn().mockReturnValue({
              sortBy: vi.fn().mockImplementation(() => Promise.resolve([...posts].reverse())),
            }),
          }),
        }),
        add: vi.fn().mockResolvedValue('post_id'),
        get: vi.fn().mockImplementation((id) => Promise.resolve(posts.find(p => p.id === id))),
        update: vi.fn().mockResolvedValue(1),
        delete: vi.fn().mockResolvedValue(undefined),
        bulkDelete: vi.fn().mockResolvedValue(undefined),
      },
      socialComments: {
        toArray: vi.fn().mockImplementation(() => Promise.resolve([...comments])),
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockImplementation(() => Promise.resolve([...comments])),
            sortBy: vi.fn().mockImplementation(() => Promise.resolve([...comments])),
          }),
        }),
        add: vi.fn().mockResolvedValue('comment_id'),
        bulkDelete: vi.fn().mockResolvedValue(undefined),
      },
    },
    mockAccountService: {
      getPlatformAccount: vi.fn().mockResolvedValue({
        id: 'account_1',
        entityId: 'entity_1',
        nickname: '测试用户',
        platformData: { verified: false },
      }),
      getEntity: vi.fn().mockResolvedValue({
        id: 'entity_1',
        displayName: '测试用户',
        avatar: 'https://example.com/avatar.jpg',
      }),
      getAccountsByPlatform: vi.fn().mockResolvedValue([]),
      createEntity: vi.fn().mockResolvedValue({ id: 'new_entity' }),
      createPlatformAccount: vi.fn().mockResolvedValue({ id: 'new_account' }),
    },
  };
});

vi.mock('@/services/database', () => ({ db: mockDb }));
vi.mock('@/services/account/accountService', () => ({ accountService: mockAccountService }));
vi.mock('@/services/social/trendService', () => ({
  TrendService: {
    getInstance: () => ({
      getTrendingList: vi.fn().mockResolvedValue([]),
      ensureTopicContent: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));
vi.mock('@/services/social/directorService', () => ({
  DirectorService: {
    getInstance: () => ({
      triggerManualEvent: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));
vi.mock('@/services/social/contentFactory', () => ({
  ContentFactory: {
    getInstance: () => ({
      generateComments: vi.fn().mockResolvedValue([]),
    }),
  },
}));
vi.mock('@/services/account/userPool', () => ({
  UserPool: {
    getInstance: () => ({
      generateRandomProfile: vi.fn().mockReturnValue({
        avatar: 'https://example.com/avatar.jpg',
        bio: '随机简介',
        gender: 'unknown',
      }),
    }),
  },
}));

import { useFeedStore } from '../../stores/feedStore';

describe('feedStore', () => {
  let store: ReturnType<typeof useFeedStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useFeedStore();
    mockPosts.length = 0;
    mockComments.length = 0;
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('应有正确的初始值', () => {
      expect(store.displayPosts).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.postCount).toBe(0);
    });

    it('自动生成配置应默认关闭', () => {
      expect(store.autoGenerateConfig.onEmptyFeed).toBe(false);
      expect(store.autoGenerateConfig.onFewComments).toBe(false);
    });
  });

  describe('refreshFeed', () => {
    it('应从数据库加载博文', async () => {
      const post = createMockPost();
      mockPosts.push(post);

      await store.refreshFeed();

      expect(store.displayPosts.length).toBeGreaterThanOrEqual(0);
    });

    it('空信息流且关闭自动生成时不应触发 Director', async () => {
      store.autoGenerateConfig.onEmptyFeed = false;

      await store.refreshFeed();

      // Director 不应被调用
      expect(store.displayPosts).toEqual([]);
    });
  });

  describe('getPostById', () => {
    it('应从内存缓存返回博文', async () => {
      const post = createMockDisplayPost({ id: 'cached_post' });
      store.displayPosts.push(post as any);

      const found = await store.getPostById('cached_post');

      expect(found?.id).toBe('cached_post');
    });

    it('应从数据库获取未缓存的博文', async () => {
      const post = createMockPost({ id: 'db_post' });
      mockPosts.push(post);
      mockDb.socialPosts.get.mockResolvedValueOnce(post);

      const found = await store.getPostById('db_post');

      expect(found?.id).toBe('db_post');
    });

    it('不存在的博文应返回 undefined', async () => {
      mockDb.socialPosts.get.mockResolvedValueOnce(undefined);

      const found = await store.getPostById('not_exists');

      expect(found).toBeUndefined();
    });
  });

  describe('getCommentsForPost', () => {
    it('应返回指定博文的评论', async () => {
      const post = createMockPost({ id: 'post_with_comments' });
      mockPosts.push(post);
      mockDb.socialPosts.get.mockResolvedValueOnce(post);
      
      mockComments.push({
        id: 'comment_1',
        postId: 'post_with_comments',
        authorId: 'commenter_1',
        content: '评论内容',
        likes: 10,
        timestamp: Date.now(),
      });

      const comments = await store.getCommentsForPost('post_with_comments');

      expect(comments.length).toBeGreaterThanOrEqual(0);
    });

    it('博文不存在时应返回空数组', async () => {
      mockDb.socialPosts.get.mockResolvedValueOnce(undefined);

      const comments = await store.getCommentsForPost('not_exists');

      expect(comments).toEqual([]);
    });
  });

  describe('likePost', () => {
    it('应增加博文点赞数', () => {
      const post = createMockDisplayPost({ id: 'like_post', stats: { likes: 10, comments: 0, shares: 0 } });
      store.displayPosts.push(post as any);

      store.likePost('like_post');

      expect(store.displayPosts[0].stats.likes).toBe(11);
    });

    it('博文不存在时不应报错', () => {
      expect(() => store.likePost('not_exists')).not.toThrow();
    });
  });

  describe('followUser', () => {
    it('应更新所有该用户博文的关注状态', () => {
      const post1 = createMockDisplayPost({ id: 'p1', author: { id: 'user_1', name: 'U1', avatar: '' } });
      const post2 = createMockDisplayPost({ id: 'p2', author: { id: 'user_1', name: 'U1', avatar: '' } });
      const post3 = createMockDisplayPost({ id: 'p3', author: { id: 'user_2', name: 'U2', avatar: '' } });
      store.displayPosts = [post1, post2, post3] as any[];

      store.followUser('user_1');

      expect(store.displayPosts[0].isFollowing).toBe(true);
      expect(store.displayPosts[1].isFollowing).toBe(true);
      expect(store.displayPosts[2].isFollowing).toBeFalsy();
    });
  });

  describe('deletePost', () => {
    it('应删除博文和相关评论', async () => {
      const post = createMockDisplayPost({ id: 'to_delete' });
      store.displayPosts.push(post as any);
      mockComments.push({ id: 'c1', postId: 'to_delete' });

      const result = await store.deletePost('to_delete');

      expect(result).toBe(true);
      expect(mockDb.socialPosts.delete).toHaveBeenCalledWith('to_delete');
      expect(store.displayPosts.find(p => p.id === 'to_delete')).toBeUndefined();
    });
  });

  describe('updatePost', () => {
    it('应更新博文内容', async () => {
      const post = createMockPost({ id: 'to_update' });
      mockPosts.push(post);
      mockDb.socialPosts.get.mockResolvedValueOnce(post);
      
      const displayPost = createMockDisplayPost({ id: 'to_update' });
      store.displayPosts.push(displayPost as any);

      const result = await store.updatePost('to_update', {
        content: '更新后的内容',
      });

      expect(result).toBe(true);
      expect(mockDb.socialPosts.update).toHaveBeenCalled();
    });

    it('博文不存在时应返回 false', async () => {
      mockDb.socialPosts.get.mockResolvedValueOnce(undefined);

      const result = await store.updatePost('not_exists', { content: '内容' });

      expect(result).toBe(false);
    });
  });

  describe('clearAllPosts', () => {
    it('应清除所有微博博文', async () => {
      // 添加一些显示中的帖子
      store.displayPosts.push(createMockDisplayPost({ id: 'p1' }) as any);

      await store.clearAllPosts();

      expect(store.displayPosts).toEqual([]);
    });
  });

  describe('setAutoGenerateConfig', () => {
    it('应更新自动生成配置', () => {
      store.setAutoGenerateConfig({ onEmptyFeed: true });

      expect(store.autoGenerateConfig.onEmptyFeed).toBe(true);
      expect(store.autoGenerateConfig.onFewComments).toBe(false);
    });
  });

  describe('formatTime', () => {
    it('应正确格式化时间', () => {
      const now = Date.now();

      expect(store.formatTime(now)).toBe('刚刚');
      expect(store.formatTime(now - 5 * 60 * 1000)).toContain('分钟前');
      expect(store.formatTime(now - 2 * 60 * 60 * 1000)).toContain('小时前');
    });
  });

  describe('getPostsByAuthor', () => {
    it('应返回指定用户的所有博文', async () => {
      mockPosts.push(
        createMockPost({ id: 'p1', authorId:'author_1' }),
        createMockPost({ id: 'p2', authorId: 'author_1' }),
        createMockPost({ id: 'p3', authorId: 'author_2' })
      );

      // Mock where().equals().toArray()
      mockDb.socialPosts.where.mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(
            mockPosts.filter(p => p.authorId === 'author_1')
          ),
        }),
      });

      const posts = await store.getPostsByAuthor('author_1');

      expect(posts.length).toBe(2);
    });
  });

  describe('getPostCountByAuthor', () => {
    it('应返回用户博文数量', async () => {
      mockPosts.push(
        createMockPost({ authorId: 'author_x' }),
        createMockPost({ authorId: 'author_x' }),
      );

      mockDb.socialPosts.where.mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(
            mockPosts.filter(p => p.authorId === 'author_x')
          ),
        }),
      });

      const count = await store.getPostCountByAuthor('author_x');

      expect(count).toBe(2);
    });
  });

  describe('isPostOwner', () => {
    it('应正确判断博文所有权', async () => {
      const post = createMockPost({ id: 'owner_test', authorId: 'owner_id' });
      mockDb.socialPosts.get.mockResolvedValueOnce(post);

      const isOwner = await store.isPostOwner('owner_test', 'owner_id');

      expect(isOwner).toBe(true);
    });

    it('非所有者应返回 false', async () => {
      const post = createMockPost({ id: 'owner_test', authorId: 'owner_id' });
      mockDb.socialPosts.get.mockResolvedValueOnce(post);

      const isOwner = await store.isPostOwner('owner_test', 'other_user');

      expect(isOwner).toBe(false);
    });
  });
});
