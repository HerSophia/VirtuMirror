/**
 * hotSearchStore 单元测试
 * 测试热搜榜管理功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// 使用 vi.hoisted 确保 mock 对象在模块加载前定义
const { mockDb, mockTrendService, mockTrafficEngine } = vi.hoisted(() => {
  return {
    mockDb: {
      socialTopics: {
        toArray: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue('topic_id'),
        bulkDelete: vi.fn().mockResolvedValue(undefined),
      },
    },
    mockTrendService: {
      getInstance: vi.fn().mockReturnValue({
        getTrendingList: vi.fn().mockResolvedValue([]),
      }),
    },
    mockTrafficEngine: {
      calculateTopicHeat: vi.fn().mockReturnValue(100000),
      calculateSimpleHeat: vi.fn().mockReturnValue(100000),
      getHeatDisplay: vi.fn().mockReturnValue({
        level: 'hot',
        formatted: '10万',
      }),
    },
  };
});

vi.mock('@/services/database', () => ({ db: mockDb }));
vi.mock('@/services/social/trendService', () => ({ TrendService: mockTrendService }));
vi.mock('@/services/social/algorithm', () => ({ TrafficEngine: mockTrafficEngine }));

import { useHotSearchStore } from '../../stores/hotSearchStore';

describe('hotSearchStore', () => {
  let store: ReturnType<typeof useHotSearchStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useHotSearchStore();
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('应有正确的初始值', () => {
      expect(store.currentCategory).toBe('热搜');
      expect(store.isLoading).toBe(false);
      expect(store.totalCount).toBe(0);
    });

    it('currentHotSearch 应返回当前分类的热搜', () => {
      store.hotSearches['热搜'] = [
        { rank: 1, title: '测试话题', heat: 100000, heatFormatted: '10万' },
      ];

      expect(store.currentHotSearch).toHaveLength(1);
      expect(store.currentHotSearch[0].title).toBe('测试话题');
    });
  });

  describe('setCategory', () => {
    it('应切换分类', () => {
      store.setCategory('文娱');

      expect(store.currentCategory).toBe('文娱');
    });
  });

  describe('refreshHotSearch', () => {
    it('应从 TrendService 获取热搜', async () => {
      const mockTopics = [
        {
          id: 'topic_1',
          keyword: '#测试话题#',
          baseScore: 80,
          createdAt: Date.now() - 3600000,
        },
      ];
      mockTrendService.getInstance().getTrendingList.mockResolvedValueOnce(mockTopics);

      await store.refreshHotSearch();

      expect(mockTrendService.getInstance().getTrendingList).toHaveBeenCalledWith('weibo');
      expect(store.currentHotSearch).toHaveLength(1);
    });

    it('应正确映射热度标签', async () => {
      const mockTopics = [
        { id: '1', keyword: '#沸点#', baseScore: 100, createdAt: Date.now() },
        { id: '2', keyword: '#热门#', baseScore: 70, createdAt: Date.now() },
        { id: '3', keyword: '#新话题#', baseScore: 30, createdAt: Date.now() },
      ];
      mockTrendService.getInstance().getTrendingList.mockResolvedValueOnce(mockTopics);

      // Mock 不同级别的热度
      mockTrafficEngine.getHeatDisplay
        .mockReturnValueOnce({ level: 'boil', formatted: '沸' })
        .mockReturnValueOnce({ level: 'hot', formatted: '100万' })
        .mockReturnValueOnce({ level: 'new', formatted: '1万' });

      await store.refreshHotSearch();

      expect(store.currentHotSearch[0].tag).toBe('boil');
      expect(store.currentHotSearch[1].tag).toBe('hot');
      expect(store.currentHotSearch[2].tag).toBe('new');
    });
  });

  describe('applyGeneratedHotSearch', () => {
    const mockGeneratedItems = [
      { keyword: '生成话题1', heat: 90, isHot: true },
      { keyword: '#生成话题2#', heat: 80, isNew: true },
    ];

    it('应保存热搜到数据库', async () => {
      await store.applyGeneratedHotSearch(mockGeneratedItems, 'replace');

      expect(mockDb.socialTopics.add).toHaveBeenCalledTimes(2);
    });

    it('replace 模式应替换所有热搜', async () => {
      store.hotSearches['热搜'] = [
        { rank: 1, title: '旧话题', heat: 50000 },
      ];

      await store.applyGeneratedHotSearch(mockGeneratedItems, 'replace');

      expect(store.currentHotSearch.every(h => h.title !== '旧话题')).toBe(true);
    });

    it('prepend 模式应将新热搜置顶', async () => {
      store.hotSearches['热搜'] = [
        { rank: 1, title: '旧话题', heat: 50000, createdAt: Date.now() },
      ];

      await store.applyGeneratedHotSearch(mockGeneratedItems, 'prepend');

      // 新话题应在前面
      expect(store.currentHotSearch.length).toBeGreaterThan(1);
    });

    it('append 模式应追加新热搜', async () => {
      store.hotSearches['热搜'] = [
        { rank: 1, title: '旧话题', heat: 500000, createdAt: Date.now() },
      ];

      await store.applyGeneratedHotSearch(mockGeneratedItems, 'append');

      expect(store.currentHotSearch.some(h => h.title === '旧话题')).toBe(true);
    });

    it('应根据 isExplosive 设置高基础分', async () => {
      // 不设置 heat，让 isExplosive 决定 baseScore
      const explosiveItem = [{ keyword: '爆炸话题', isExplosive: true }];

      await store.applyGeneratedHotSearch(explosiveItem, 'replace');

      // 验证 add 被调用时 baseScore 在高范围内 (90-100)
      const addCall = mockDb.socialTopics.add.mock.calls[0][0];
      expect(addCall.baseScore).toBeGreaterThanOrEqual(90);
    });

    it('应限制热搜数量为 50', async () => {
      const manyItems = Array.from({ length: 60 }, (_, i) => ({
        keyword: `话题${i}`,
        heat: 60 - i,
      }));

      await store.applyGeneratedHotSearch(manyItems, 'replace');

      expect(store.currentHotSearch.length).toBeLessThanOrEqual(50);
    });
  });

  describe('applyHotSearchFromJSON', () => {
    it('应正确解析 JSON 数组', async () => {
      const json = JSON.stringify([
        { keyword: '话题1', heat: 90 },
        { keyword: '话题2', heat: 80 },
      ]);

      const result = await store.applyHotSearchFromJSON(json);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('应处理 markdown 代码块', async () => {
      const json = '```json\n[{"keyword": "话题", "heat": 90}]\n```';

      const result = await store.applyHotSearchFromJSON(json);

      expect(result.success).toBe(true);
    });

    it('应处理单个对象', async () => {
      const json = JSON.stringify({ keyword: '单个话题', heat: 85 });

      const result = await store.applyHotSearchFromJSON(json);

      expect(result.success).toBe(true);
    });

    it('应拒绝无效 JSON', async () => {
      const invalidJson = 'not valid json';

      const result = await store.applyHotSearchFromJSON(invalidJson);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应过滤掉无效项', async () => {
      const json = JSON.stringify([
        { keyword: '有效话题', heat: 90 },
        { invalid: 'no keyword' },
        null,
      ]);

      const result = await store.applyHotSearchFromJSON(json);

      expect(result.success).toBe(true);
    });

    it('应在无有效数据时返回失败', async () => {
      const json = JSON.stringify([{ noKeyword: 'invalid' }]);

      const result = await store.applyHotSearchFromJSON(json);

      expect(result.success).toBe(false);
      expect(result.error).toContain('没有有效');
    });
  });

  describe('clearHotSearches', () => {
    it('应清除数据库中的微博热搜', async () => {
      mockDb.socialTopics.toArray.mockResolvedValueOnce([
        { id: '1', platformId: 'weibo' },
        { id: '2', platformId: 'weibo' },
        { id: '3', platformId: 'other' },
      ]);

      const count = await store.clearHotSearches();

      expect(mockDb.socialTopics.bulkDelete).toHaveBeenCalledWith(['1', '2']);
      expect(count).toBe(2);
    });

    it('应清空内存中的热搜', async () => {
      store.hotSearches['热搜'] = [{ rank: 1, title: '话题', heat: 1000 }];

      await store.clearHotSearches();

      expect(store.hotSearches).toEqual({});
    });
  });

  describe('getHotSearchCount', () => {
    it('应返回微博平台的热搜数量', async () => {
      mockDb.socialTopics.toArray.mockResolvedValueOnce([
        { platformId: 'weibo' },
        { platformId: 'weibo' },
        { platformId: 'bilibili' },
      ]);

      const count = await store.getHotSearchCount();

      expect(count).toBe(2);
    });
  });

  describe('计算属性', () => {
    it('totalCount 应计算所有分类的热搜总数', () => {
      store.hotSearches = {
        '热搜': [{ rank: 1, title: '1', heat: 100 }, { rank: 2, title: '2', heat: 90 }],
        '文娱': [{ rank: 1, title: '3', heat: 80 }],
      };

      expect(store.totalCount).toBe(3);
    });

    it('currentHotSearch 应返回空数组当分类不存在', () => {
      store.currentCategory = '不存在的分类';

      expect(store.currentHotSearch).toEqual([]);
    });
  });
});
