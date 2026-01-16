/**
 * ContentDispatcher 单元测试
 * 测试解析器分发架构
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentDispatcher, getDispatcher } from '../../../../stores/llm/parsers/dispatcher';
import type { ContentParser, ParseContext } from '../../../../stores/llm/parsers/types';

describe('ContentDispatcher', () => {
  let dispatcher: ContentDispatcher;

  // 创建测试用的 mock 解析器
  const createMockParser = (key: string, aliases: string[] = [], dependencies: string[] = []): ContentParser => ({
    key,
    aliases: [key, ...aliases],
    dependencies,
    description: `Mock ${key} parser`,
    validate: vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
    transform: vi.fn().mockResolvedValue([{ id: `${key}_1` }]),
    persist: vi.fn().mockResolvedValue({ ids: [`${key}_1`], count: 1 }),
  });

  const createMockContext = (): Omit<ParseContext, 'resolved'> => ({
    taskId: 'test_task_id',
    platformId: 'weibo',
    timestamp: Date.now(),
    log: vi.fn(),
  });

  beforeEach(() => {
    dispatcher = ContentDispatcher.getInstance();
    dispatcher.reset();
  });

  describe('单例模式', () => {
    it('应返回同一实例', () => {
      const instance1 = ContentDispatcher.getInstance();
      const instance2 = ContentDispatcher.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('getDispatcher 应返回实例', () => {
      const instance = getDispatcher();

      expect(instance).toBeInstanceOf(ContentDispatcher);
    });
  });

  describe('register', () => {
    it('应注册解析器', () => {
      const parser = createMockParser('posts');

      dispatcher.register(parser);

      expect(dispatcher.getParser('posts')).toBe(parser);
    });

    it('应注册别名', () => {
      const parser = createMockParser('posts', ['weibos', 'post']);

      dispatcher.register(parser);

      expect(dispatcher.getParserKeyByAlias('weibos')).toBe('posts');
      expect(dispatcher.getParserKeyByAlias('post')).toBe('posts');
      expect(dispatcher.getParserKeyByAlias('POSTS')).toBe('posts'); // 不区分大小写
    });
  });

  describe('registerAll', () => {
    it('应批量注册解析器', () => {
      const parsers = [
        createMockParser('posts'),
        createMockParser('comments'),
        createMockParser('hotSearches'),
      ];

      dispatcher.registerAll(parsers);

      expect(dispatcher.getAllParsers()).toHaveLength(3);
    });
  });

  describe('dispatch', () => {
    beforeEach(() => {
      dispatcher.register(createMockParser('posts', ['weibos']));
      dispatcher.register(createMockParser('comments', [], ['posts']));
      dispatcher.register(createMockParser('hotSearches', ['trending']));
    });

    it('应正确解析 JSON 并分发', async () => {
      const json = JSON.stringify({
        posts: [{ text: '博文1' }],
        hotSearches: [{ keyword: '热搜1' }],
      });

      const result = await dispatcher.dispatch(json, createMockContext());

      expect(result.success).toBe(true);
      expect(result.data.posts).toBeDefined();
      expect(result.data.hotSearches).toBeDefined();
    });

    it('应处理 markdown 代码块', async () => {
      const json = '```json\n{"posts": [{"text": "内容"}]}\n```';

      const result = await dispatcher.dispatch(json, createMockContext());

      expect(result.success).toBe(true);
    });

    it('应处理别名', async () => {
      const json = JSON.stringify({
        weibos: [{ text: '博文' }],
        trending: [{ keyword: '话题' }],
      });

      const result = await dispatcher.dispatch(json, createMockContext());

      expect(result.success).toBe(true);
    });

    it('应按依赖顺序执行', async () => {
      const executionOrder: string[] = [];

      dispatcher.reset();
      dispatcher.register({
        ...createMockParser('posts'),
        transform: vi.fn().mockImplementation(async () => {
          executionOrder.push('posts');
          return [{ id: 'p1' }];
        }),
      });
      dispatcher.register({
        ...createMockParser('comments', [], ['posts']),
        transform: vi.fn().mockImplementation(async () => {
          executionOrder.push('comments');
          return [{ id: 'c1' }];
        }),
      });

      const json = JSON.stringify({
        comments: [{ content: '评论' }],
        posts: [{ text: '博文' }],
      });

      await dispatcher.dispatch(json, createMockContext());

      expect(executionOrder).toEqual(['posts', 'comments']);
    });

    it('应处理无效 JSON', async () => {
      const result = await dispatcher.dispatch('invalid json', createMockContext());

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].parser).toBe('dispatcher');
    });

    it('验证失败时应记录错误', async () => {
      dispatcher.reset();
      dispatcher.register({
        ...createMockParser('posts'),
        validate: vi.fn().mockReturnValue({
          valid: false,
          errors: ['验证错误'],
          warnings: [],
        }),
      });

      const json = JSON.stringify({ posts: [{}] });
      const result = await dispatcher.dispatch(json, createMockContext());

      expect(result.errors.some(e => e.parser === 'posts')).toBe(true);
    });

    it('应处理解析器执行错误', async () => {
      dispatcher.reset();
      dispatcher.register({
        ...createMockParser('posts'),
        transform: vi.fn().mockRejectedValue(new Error('转换错误')),
      });

      const json = JSON.stringify({ posts: [{ text: '内容' }] });
      const result = await dispatcher.dispatch(json, createMockContext());

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.messages.includes('转换错误'))).toBe(true);
    });

    it('应自动推断数组类型', async () => {
      dispatcher.reset();
      dispatcher.register(createMockParser('posts'));

      // 输入是数组而非对象
      const json = JSON.stringify([{ primaryType: 'text', text: '内容' }]);
      const result = await dispatcher.dispatch(json, createMockContext());

      expect(result.success).toBe(true);
    });

    it('应记录处理统计', async () => {
      const json = JSON.stringify({
        posts: [{ text: '1' }, { text: '2' }],
      });

      const mockParser = createMockParser('posts');
      (mockParser.persist as any).mockResolvedValue({ ids: ['p1', 'p2'], count: 2 });

      dispatcher.reset();
      dispatcher.register(mockParser);

      const result = await dispatcher.dispatch(json, createMockContext());

      expect(result.stats.posts).toBe(2);
    });
  });

  describe('reset', () => {
    it('应清除所有注册的解析器', () => {
      dispatcher.register(createMockParser('posts'));
      dispatcher.register(createMockParser('comments'));

      dispatcher.reset();

      expect(dispatcher.getAllParsers()).toHaveLength(0);
    });
  });

  describe('getAllParsers', () => {
    it('应返回所有注册的解析器', () => {
      dispatcher.register(createMockParser('posts'));
      dispatcher.register(createMockParser('comments'));

      const parsers = dispatcher.getAllParsers();

      expect(parsers).toHaveLength(2);
    });
  });
});
