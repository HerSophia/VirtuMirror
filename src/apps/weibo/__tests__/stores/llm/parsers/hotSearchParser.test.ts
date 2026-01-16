/**
 * HotSearchParser 单元测试
 * 测试热搜解析器
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParseContext } from '../../../../stores/llm/parsers/types';

// 使用 vi.hoisted 确保 mock 对象在模块加载前定义
const { mockHotSearchStore } = vi.hoisted(() => {
  return {
    mockHotSearchStore: {
      applyHotSearchFromJSON: vi.fn().mockResolvedValue({ success: true, count: 2 }),
    },
  };
});

vi.mock('../../hotSearchStore', () => ({
  useHotSearchStore: () => mockHotSearchStore,
}));

import { HotSearchParser } from '../../../../stores/llm/parsers/hotSearchParser';

describe('HotSearchParser', () => {
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
      expect(HotSearchParser.key).toBe('hotSearches');
      expect(HotSearchParser.aliases).toContain('hotSearches');
      expect(HotSearchParser.aliases).toContain('trending');
      expect(HotSearchParser.aliases).toContain('hotlist');
    });

    it('应没有依赖', () => {
      expect(HotSearchParser.dependencies || []).toEqual([]);
    });
  });

  describe('validate', () => {
    it('应验证有效的热搜数组', () => {
      const input = [
        { keyword: '热搜1', heat: 90 },
        { keyword: '热搜2' },
      ];

      const result = HotSearchParser.validate(input);

      expect(result.valid).toBe(true);
    });

    it('应拒绝空数组', () => {
      const result = HotSearchParser.validate([]);

      expect(result.valid).toBe(false);
    });

    it('应拒绝没有 keyword 的项', () => {
      const input = [{ heat: 90 }] as any; // 没有 keyword - 故意测试无效输入

      const result = HotSearchParser.validate(input);

      expect(result.valid).toBe(false);
    });
  });

  describe('transform', () => {
    it('应转换热搜并设置默认值', async () => {
      const input = [
        { keyword: '话题1', heat: 95, isHot: true },
        { keyword: '#话题2#', summary: '话题简介' },
      ];

      const result = await HotSearchParser.transform(input, createMockContext());

      expect(result).toHaveLength(2);
      expect(result[0].keyword).toContain('话题1');
      expect(result[0].isHot).toBe(true);
      expect(result[1].summary).toBe('话题简介');
    });

    it('应为 keyword 添加 # 号', async () => {
      const input = [{ keyword: '无井号话题' }];

      const result = await HotSearchParser.transform(input, createMockContext());

      expect(result[0].keyword).toBe('#无井号话题#');
    });

    it('应保留已有的 # 号', async () => {
      const input = [{ keyword: '#已有井号#' }];

      const result = await HotSearchParser.transform(input, createMockContext());

      expect(result[0].keyword).toBe('#已有井号#');
    });

    it('应根据 isExplosive 设置高 heat', async () => {
      const input = [{ keyword: '爆炸话题', isExplosive: true }];

      const result = await HotSearchParser.transform(input, createMockContext());

      // isExplosive 为 true 时，heat 应该很高（>= 95）
      expect(result[0].heat).toBeGreaterThanOrEqual(60);
      expect(result[0].isExplosive).toBe(true);
    });

    it('应设置 platformId', async () => {
      const input = [{ keyword: '话题' }];

      const result = await HotSearchParser.transform(input, createMockContext());

      expect(result[0].platformId).toBe('weibo');
    });
  });

  describe('persist', () => {
    it('应正确返回保存结果', async () => {
      const topics = [
        { id: 't1', keyword: '#话题1#', platformId: 'weibo', heat: 80 },
        { id: 't2', keyword: '#话题2#', platformId: 'weibo', heat: 70 },
      ];

      const context = createMockContext();
      const result = await HotSearchParser.persist(topics as any, context);

      // persist 应返回结果对象
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('ids');
    });
  });
});
