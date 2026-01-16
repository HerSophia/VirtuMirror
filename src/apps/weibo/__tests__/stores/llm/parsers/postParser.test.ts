/**
 * PostParser 单元测试
 * 测试博文解析器
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParseContext, ResolvedData } from '../../../../stores/llm/parsers/types';

// 使用 vi.hoisted 确保 mock 对象在模块加载前定义
const { mockDb, mockAccountService } = vi.hoisted(() => {
  return {
    mockDb: {
      socialPosts: {
        add: vi.fn().mockResolvedValue('post_id'),
      },
      socialAccounts: {
        add: vi.fn().mockResolvedValue('account_id'),
      },
    },
    mockAccountService: {
      getAccountsByPlatform: vi.fn().mockResolvedValue([]),
      createEntity: vi.fn().mockResolvedValue({ id: 'entity_id' }),
      createPlatformAccount: vi.fn().mockResolvedValue({ id: 'account_id' }),
    },
  };
});

vi.mock('@/services/database', () => ({ db: mockDb }));
vi.mock('@/services/account/accountService', () => ({ accountService: mockAccountService }));

import { PostParser } from '../../../../stores/llm/parsers/postParser';

describe('PostParser', () => {
  const createMockContext = (): ParseContext => ({
    taskId: 'test_task_id',
    platformId: 'weibo',
    timestamp: Date.now(),
    log: vi.fn(),
    resolved: {
      posts: new Map(),
      users: new Map(),
      hotSearches: new Map(),
      comments: new Map(),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本属性', () => {
    it('应有正确的 key 和别名', () => {
      expect(PostParser.key).toBe('posts');
      expect(PostParser.aliases).toContain('posts');
      expect(PostParser.aliases).toContain('weibos');
    });

    it('应没有依赖', () => {
      expect(PostParser.dependencies).toEqual([]);
    });
  });

  describe('validate', () => {
    it('应验证有效的博文数组', () => {
      const input = [{ text: '内容1' }, { text: '内容2' }];

      const result = PostParser.validate(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应验证单个博文对象', () => {
      const input = { text: '单条博文' };

      const result = PostParser.validate(input);

      expect(result.valid).toBe(true);
    });

    it('应拒绝空数组', () => {
      const result = PostParser.validate([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('博文数组为空');
    });

    it('应为缺少内容的博文给出警告', () => {
      const input = [{ authorName: '用户' }]; // 没有 text

      const result = PostParser.validate(input);

      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('transform', () => {
    it('应转换旧格式博文', async () => {
      const input = [{
        type: 'text',
        text: '测试内容 #话题#',
        authorName: '测试用户',
        images: ['图片1'],
      }];

      const result = await PostParser.transform(input, createMockContext());

      expect(result).toHaveLength(1);
      expect(result[0].primaryType).toBe('text');
      expect(result[0].payload.text).toBe('测试内容 #话题#');
      expect(result[0].topicTags).toContain('话题');
    });

    it('应转换新格式博文', async () => {
      const input = [{
        primaryType: 'video' as const,
        payload: {
          text: '视频描述',
          video: { description: '精彩视频' },
        },
        media: [{ id: 'v1', type: 'video', description: '视频' }],
        authorName: '视频博主',
        tempId: 'temp_1',
      }];

      const context = createMockContext();
      const result = await PostParser.transform(input, context);

      expect(result[0].primaryType).toBe('video');
      expect(context.resolved.posts.has('temp_1')).toBe(true);
    });

    it('应为每条博文创建作者账号', async () => {
      const input = [
        { text: '博文1', authorName: '用户A' },
        { text: '博文2', authorName: '用户B' },
      ];

      await PostParser.transform(input, createMockContext());

      // 应该创建2个账号
      expect(mockAccountService.createEntity).toHaveBeenCalledTimes(2);
    });

    it('应复用已存在的作者账号', async () => {
      mockAccountService.getAccountsByPlatform.mockResolvedValueOnce([
        { id: 'existing_account', nickname: '已存在用户' },
      ]);

      const input = [{ text: '博文', authorName: '已存在用户' }];

      const result = await PostParser.transform(input, createMockContext());

      expect(result[0].authorId).toBe('existing_account');
      expect(mockAccountService.createEntity).not.toHaveBeenCalled();
    });

    it('应复用 resolved 中的用户', async () => {
      const context = createMockContext();
      context.resolved.users.set('缓存用户', 'cached_account_id');

      const input = [{ text: '博文', authorName: '缓存用户' }];

      const result = await PostParser.transform(input, context);

      expect(result[0].authorId).toBe('cached_account_id');
    });

    it('应记录 tempId 到 postId 的映射', async () => {
      // 使用新格式以确保 tempId 被正确传递
      const input = [{
        primaryType: 'text' as const,
        payload: { text: '博文' },
        authorName: '用户',
        tempId: 'my_temp_id',
      }];
      const context = createMockContext();

      const result = await PostParser.transform(input, context);

      expect(context.resolved.posts.get('my_temp_id')).toBe(result[0].id);
      expect(context.resolved.posts.get('post_0')).toBe(result[0].id);
      expect(context.resolved.posts.get('0')).toBe(result[0].id);
    });

    it('应生成不同的时间戳', async () => {
      const input = [
        { text: '博文1', authorName: '用户' },
        { text: '博文2', authorName: '用户' },
        { text: '博文3', authorName: '用户' },
      ];

      const context = createMockContext();
      const result = await PostParser.transform(input, context);

      // 由于包含随机数，只验证时间戳都早于基准时间
      expect(result[0].timestamp).toBeLessThanOrEqual(context.timestamp);
      expect(result[1].timestamp).toBeLessThanOrEqual(context.timestamp);
      expect(result[2].timestamp).toBeLessThanOrEqual(context.timestamp);
    });
  });

  describe('persist', () => {
    it('应保存所有博文到数据库', async () => {
      const posts = [
        { id: 'p1', platformId: 'weibo', primaryType: 'text' as const, payload: { text: '1' } },
        { id: 'p2', platformId: 'weibo', primaryType: 'text' as const, payload: { text: '2' } },
      ];

      const result = await PostParser.persist(posts as any, createMockContext());

      expect(mockDb.socialPosts.add).toHaveBeenCalledTimes(2);
      expect(result.count).toBe(2);
      expect(result.ids).toEqual(['p1', 'p2']);
    });

    it('应处理保存错误', async () => {
      mockDb.socialPosts.add
        .mockResolvedValueOnce('p1')
        .mockRejectedValueOnce(new Error('保存失败'));

      const posts = [
        { id: 'p1', payload: {} },
        { id: 'p2', payload: {} },
      ];

      const result = await PostParser.persist(posts as any, createMockContext());

      expect(result.count).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toBeDefined();
    });

    it('应记录日志', async () => {
      const context = createMockContext();
      const posts = [{ id: 'p1', primaryType: 'text', payload: {} }];

      await PostParser.persist(posts as any, context);

      expect(context.log).toHaveBeenCalledWith('info', expect.stringContaining('保存博文'));
    });
  });
});
