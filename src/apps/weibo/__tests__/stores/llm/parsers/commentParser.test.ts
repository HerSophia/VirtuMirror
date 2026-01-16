/**
 * CommentParser 单元测试
 * 测试评论解析器
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParseContext } from '../../../../stores/llm/parsers/types';

// 使用 vi.hoisted 确保 mock 对象在模块加载前定义
const { mockDb, mockAccountService } = vi.hoisted(() => {
  return {
    mockDb: {
      socialComments: {
        add: vi.fn().mockResolvedValue('comment_id'),
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

import { CommentParser } from '../../../../stores/llm/parsers/commentParser';

describe('CommentParser', () => {
  const createMockContext = (): ParseContext => ({
    taskId: 'test_task_id',
    platformId: 'weibo',
    timestamp: Date.now(),
    log: vi.fn(),
    resolved: {
      posts: new Map([['post_1', 'real_post_id']]),
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
      expect(CommentParser.key).toBe('comments');
      expect(CommentParser.aliases).toContain('comments');
      expect(CommentParser.aliases).toContain('comment');
    });

    it('应依赖 posts 解析器', () => {
      expect(CommentParser.dependencies).toContain('posts');
    });
  });

  describe('validate', () => {
    it('应验证有效的评论数组', () => {
      const input = [
        { content: '评论1', nickname: '用户1' },
        { content: '评论2' },
      ];

      const result = CommentParser.validate(input);

      expect(result.valid).toBe(true);
    });

    it('应拒绝空数组', () => {
      const result = CommentParser.validate([]);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('空'))).toBe(true);
    });

    it('应拒绝没有内容的评论', () => {
      const input = [{ nickname: '用户' }] as any; // 没有 content - 故意测试无效输入

      const result = CommentParser.validate(input);

      expect(result.valid).toBe(false);
    });
  });

  describe('transform', () => {
    it('应转换评论并解析 postId 映射', async () => {
      const input = [
        { postId: 'post_1', content: '评论内容', nickname: '用户' },
      ];

      const context = createMockContext();
      const result = await CommentParser.transform(input, context);

      expect(result).toHaveLength(1);
      expect(result[0].postId).toBe('real_post_id');
      expect(result[0].content).toBe('评论内容');
    });

    it('应为评论者创建账号', async () => {
      const input = [
        { content: '评论', nickname: '新用户' },
      ];

      await CommentParser.transform(input, createMockContext());

      expect(mockAccountService.createEntity).toHaveBeenCalled();
    });

    it('应复用已存在的账号', async () => {
      const context = createMockContext();
      context.resolved.users.set('已存在用户', 'existing_account_id');

      const input = [
        { content: '评论', nickname: '已存在用户' },
      ];

      const result = await CommentParser.transform(input, context);

      expect(result[0].authorId).toBe('existing_account_id');
      expect(mockAccountService.createEntity).not.toHaveBeenCalled();
    });

    it('应设置点赞数', async () => {
      const input = [
        { content: '热门评论', nickname: '用户', likes: 100, isHot: true },
      ];

      const result = await CommentParser.transform(input, createMockContext());

      expect(result[0].likes).toBe(100);
    });
  });

  describe('persist', () => {
    it('应保存评论到数据库', async () => {
      const comments = [
        { id: 'c1', postId: 'p1', content: '评论1' },
        { id: 'c2', postId: 'p1', content: '评论2' },
      ];

      const result = await CommentParser.persist(comments as any, createMockContext());

      expect(mockDb.socialComments.add).toHaveBeenCalledTimes(2);
      expect(result.count).toBe(2);
    });

    it('应处理保存错误', async () => {
      mockDb.socialComments.add
        .mockResolvedValueOnce('c1')
        .mockRejectedValueOnce(new Error('保存失败'));

      const comments = [
        { id: 'c1', content: '1' },
        { id: 'c2', content: '2' },
      ];

      const result = await CommentParser.persist(comments as any, createMockContext());

      expect(result.count).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });
});
