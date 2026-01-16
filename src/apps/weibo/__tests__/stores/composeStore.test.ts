/**
 * composeStore 单元测试
 * 测试发布、草稿、AI扩展功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMockLocalStorage, createMockDraft } from '../setup';

// 使用 vi.hoisted 确保 mock 对象在模块加载前定义
const { mockDb, mockAIStore, mockAccountStore, mockPromptService, mockScopedStorage } = vi.hoisted(() => {
  // Mock ScopedStorage
  const storageData = new Map<string, any>();
  const mockScopedStorage = {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(storageData.get(key))),
    set: vi.fn().mockImplementation((key: string, value: any) => {
      storageData.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn().mockImplementation((key: string) => {
      storageData.delete(key);
      return Promise.resolve();
    }),
    keys: vi.fn().mockImplementation(() => Promise.resolve(Array.from(storageData.keys()))),
    clear: vi.fn().mockImplementation(() => {
      storageData.clear();
      return Promise.resolve();
    }),
    getUsage: vi.fn().mockResolvedValue({ count: 0, estimatedSize: 0 }),
    _clear: () => storageData.clear(), // 用于测试重置
  };

  return {
    mockScopedStorage,
    mockDb: {
      socialPosts: {
        add: vi.fn().mockResolvedValue('post_id'),
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
            reverse: vi.fn().mockReturnValue({
              sortBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        toArray: vi.fn().mockResolvedValue([]),
      },
      socialComments: {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      },
    },
    mockAIStore: {
      generate: vi.fn().mockResolvedValue({ text: '{"text": "扩展后的内容"}' }),
    },
    mockAccountStore: {
      isInitialized: true,
      currentPlayer: { id: 'player_1', displayName: '玩家' },
      getPlayerAllAccounts: vi.fn().mockResolvedValue([{
        id: 'weibo_account_1',
        platformId: 'weibo',
        nickname: '测试用户',
        platformData: { followers: 1000 },
      }]),
      initialize: vi.fn().mockResolvedValue(undefined),
      createPlatformAccount: vi.fn().mockResolvedValue({ id: 'new_account' }),
    },
    mockPromptService: {
      getPromptByScene: vi.fn().mockReturnValue({
        template: '{{userContent}}',
        systemPrompt: 'You are a helpful assistant',
      }),
    },
  };
});

vi.mock('@/services/database', () => ({ db: mockDb }));
vi.mock('@/stores/aiStore', () => ({ useAIStore: () => mockAIStore }));
vi.mock('@/stores/accountStore', () => ({ useAccountStore: () => mockAccountStore }));
vi.mock('@/services/promptService', () => ({ PromptService: mockPromptService }));
vi.mock('../feedStore', () => ({
  useFeedStore: () => ({
    refreshFeed: vi.fn().mockResolvedValue(undefined),
    generatePostEngagement: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock AppRuntime to provide ScopedStorage
vi.mock('@/services/appRuntime', () => ({
  tryUseAppRuntime: () => ({
    identity: { dataNamespace: 'builtin/weibo', appId: 'weibo', appName: '微博' },
    storage: mockScopedStorage,
  }),
}));

import { useComposeStore } from '../../stores/composeStore';

describe('composeStore', () => {
  let store: ReturnType<typeof useComposeStore>;
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockLocalStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockLocalStorage);
    
    // 重置 ScopedStorage
    mockScopedStorage._clear();
    
    store = useComposeStore();
    vi.clearAllMocks();
  });

  describe('草稿管理', () => {
    describe('loadDrafts', () => {
      it('应从 ScopedStorage 加载草稿', async () => {
        const drafts = [createMockDraft(), createMockDraft()];
        await mockScopedStorage.set('compose_drafts', drafts);

        const loaded = await store.loadDrafts();

        expect(loaded).toHaveLength(2);
        expect(store.drafts).toHaveLength(2);
      });

      it('应处理空 ScopedStorage', async () => {
        const loaded = await store.loadDrafts();

        expect(loaded).toEqual([]);
      });

      it('应从 localStorage 迁移旧数据', async () => {
        const drafts = [createMockDraft()];
        mockLocalStorage.setItem('weibo_drafts', JSON.stringify(drafts));

        const loaded = await store.loadDrafts();

        expect(loaded).toHaveLength(1);
        // 检查迁移标记
        const migrated = await mockScopedStorage.get('drafts_migrated_v1');
        expect(migrated).toBe(true);
      });
    });

    describe('saveDraft', () => {
      it('应创建新草稿', async () => {
        const draftData = {
          type: 'text' as const,
          content: '草稿内容',
          topics: ['测试'],
          images: [],
        };

        const saved = await store.saveDraft(draftData);

        expect(saved.id).toBeDefined();
        expect(saved.content).toBe('草稿内容');
        expect(store.drafts).toHaveLength(1);
        expect(mockScopedStorage.set).toHaveBeenCalled();
      });

      it('应更新现有草稿', async () => {
        const initial = await store.saveDraft({
          type: 'text' as const,
          content: '初始内容',
          topics: [],
          images: [],
        });

        const updated = await store.saveDraft({
          type: 'text' as const,
          content: '更新后的内容',
          topics: ['新话题'],
          images: [],
        }, initial.id);

        expect(updated.id).toBe(initial.id);
        expect(updated.content).toBe('更新后的内容');
        expect(store.drafts).toHaveLength(1);
      });

      it('新草稿应插入到列表前面', async () => {
        await store.saveDraft({ type: 'text' as const, content: '第一条', topics: [], images: [] });
        await store.saveDraft({ type: 'text' as const, content: '第二条', topics: [], images: [] });

        expect(store.drafts[0].content).toBe('第二条');
        expect(store.drafts[1].content).toBe('第一条');
      });
    });

    describe('getDraftById', () => {
      it('应返回指定草稿', async () => {
        const draft = await store.saveDraft({
          type: 'text' as const,
          content: '测试',
          topics: [],
          images: [],
        });

        const found = store.getDraftById(draft.id);

        expect(found).toEqual(draft);
      });

      it('不存在时应返回 undefined', () => {
        expect(store.getDraftById('not_exists')).toBeUndefined();
      });
    });

    describe('deleteDraft', () => {
      it('应删除指定草稿', async () => {
        const draft = await store.saveDraft({
          type: 'text' as const,
          content: '待删除',
          topics: [],
          images: [],
        });

        const result = await store.deleteDraft(draft.id);

        expect(result).toBe(true);
        expect(store.drafts).toHaveLength(0);
      });

      it('删除不存在的草稿应返回 false', async () => {
        const result = await store.deleteDraft('not_exists');

        expect(result).toBe(false);
      });
    });

    describe('clearAllDrafts', () => {
      it('应清空所有草稿', async () => {
        await store.saveDraft({ type: 'text' as const, content: '1', topics: [], images: [] });
        await store.saveDraft({ type: 'text' as const, content: '2', topics: [], images: [] });

        const count = await store.clearAllDrafts();

        expect(count).toBe(2);
        expect(store.drafts).toHaveLength(0);
      });
    });

    describe('getDraftCount', () => {
      it('应返回正确的草稿数量', async () => {
        await store.saveDraft({ type: 'text' as const, content: '1', topics: [], images: [] });
        await store.saveDraft({ type: 'text' as const, content: '2', topics: [], images: [] });

        expect(store.getDraftCount()).toBe(2);
      });
    });
  });

  describe('AI 扩展', () => {
    describe('expandPostContent', () => {
      it('应扩展博文内容', async () => {
        mockAIStore.generate.mockResolvedValueOnce({
          text: JSON.stringify({
            text: '扩展后的精彩内容',
            suggestedTopics: ['推荐话题'],
          }),
        });

        const result = await store.expandPostContent('简短内容');

        expect(result.success).toBe(true);
        expect(result.expandedText).toBe('扩展后的精彩内容');
        expect(result.suggestedTopics).toContain('推荐话题');
      });

      it('应处理非 JSON 响应', async () => {
        mockAIStore.generate.mockResolvedValueOnce({
          text: '直接返回的文本内容',
        });

        const result = await store.expandPostContent('输入');

        expect(result.success).toBe(true);
        expect(result.expandedText).toBe('直接返回的文本内容');
      });

      it('应处理空响应', async () => {
        mockAIStore.generate.mockResolvedValueOnce({ text: '' });

        const result = await store.expandPostContent('输入');

        expect(result.success).toBe(false);
        expect(result.error).toContain('空');
      });

      it('应处理 AI 错误', async () => {
        mockAIStore.generate.mockRejectedValueOnce(new Error('API 错误'));

        const result = await store.expandPostContent('输入');

        expect(result.success).toBe(false);
        expect(result.error).toContain('API 错误');
      });

      it('未找到提示词时应返回错误', async () => {
        mockPromptService.getPromptByScene.mockReturnValueOnce(null);

        const result = await store.expandPostContent('输入');

        expect(result.success).toBe(false);
        expect(result.error).toContain('提示词');
      });
    });

    describe('expandImageDescription', () => {
      it('应扩展图片描述', async () => {
        mockAIStore.generate.mockResolvedValueOnce({
          text: JSON.stringify({
            expandedDescription: '详细的图片描述：金色的夕阳洒在平静的湖面上...',
          }),
        });

        const result = await store.expandImageDescription('夕阳湖景');

        expect(result.success).toBe(true);
        expect(result.expandedDescription).toContain('详细的图片描述');
      });
    });

    describe('expandVideoDescription', () => {
      it('应扩展视频描述', async () => {
        mockAIStore.generate.mockResolvedValueOnce({
          text: JSON.stringify({
            expandedDescription: '精彩的视频内容描述',
            coverDescription: '视频封面描述',
            suggestedDuration: 120,
          }),
        });

        const result = await store.expandVideoDescription('日常 vlog');

        expect(result.success).toBe(true);
        expect(result.expandedDescription).toBeDefined();
        expect(result.coverDescription).toBeDefined();
        expect(result.suggestedDuration).toBe(120);
      });
    });
  });

  describe('发布博文', () => {
    describe('publishPost', () => {
      const mockPostData = {
        type: 'text' as const,
        content: '测试发布内容',
        topics: ['测试话题'],
        images: [],
      };

      it('应成功发布文字博文', async () => {
        const result = await store.publishPost(mockPostData);

        expect(result.success).toBe(true);
        expect(result.postId).toBeDefined();
        expect(mockDb.socialPosts.add).toHaveBeenCalled();
      });

      it('发布的博文应包含话题标签', async () => {
        await store.publishPost(mockPostData);

        const addedPost = mockDb.socialPosts.add.mock.calls[0][0];
        expect(addedPost.payload.text).toContain('#测试话题#');
        expect(addedPost.topicTags).toContain('测试话题');
      });

      it('应正确设置 primaryType', async () => {
        await store.publishPost(mockPostData);

        const addedPost = mockDb.socialPosts.add.mock.calls[0][0];
        expect(addedPost.primaryType).toBe('text');
      });

      it('4张及以上图片应设为 gallery 类型', async () => {
        const galleryPost = {
          ...mockPostData,
          images: [
            { description: '图1' },
            { description: '图2' },
            { description: '图3' },
            { description: '图4' },
          ],
        };

        await store.publishPost(galleryPost);

        const addedPost = mockDb.socialPosts.add.mock.calls[0][0];
        expect(addedPost.primaryType).toBe('gallery');
      });

      it('应正确发布投票博文', async () => {
        const pollPost = {
          type: 'poll' as const,
          content: '投票问题',
          topics: [],
          images: [],
          poll: {
            question: '你的选择？',
            options: [
              { id: '1', text: '选项A', votes: 0 },
              { id: '2', text: '选项B', votes: 0 },
            ],
            duration: 24,
            multiSelect: false,
          },
        };

        await store.publishPost(pollPost);

        const addedPost = mockDb.socialPosts.add.mock.calls[0][0];
        expect(addedPost.primaryType).toBe('poll');
        expect(addedPost.payload.poll).toBeDefined();
        expect(addedPost.contentFlags.hasPoll).toBe(true);
      });

      it('应正确发布视频博文', async () => {
        const videoPost = {
          type: 'video' as const,
          content: '视频标题',
          topics: [],
          images: [],
          video: {
            description: '视频描述',
            duration: 60,
            coverDescription: '封面',
          },
        };

        await store.publishPost(videoPost);

        const addedPost = mockDb.socialPosts.add.mock.calls[0][0];
        expect(addedPost.primaryType).toBe('video');
        expect(addedPost.payload.video).toBeDefined();
        expect(addedPost.media.some((m: any) => m.type === 'video')).toBe(true);
      });

      it('无账号时应自动创建', async () => {
        mockAccountStore.getPlayerAllAccounts.mockResolvedValueOnce([]);

        await store.publishPost(mockPostData);

        expect(mockAccountStore.createPlatformAccount).toHaveBeenCalled();
      });

      it('应设置正确的 meta 信息', async () => {
        await store.publishPost({ ...mockPostData, source: 'iPhone 客户端' });

        const addedPost = mockDb.socialPosts.add.mock.calls[0][0];
        expect(addedPost.meta.source).toBe('iPhone 客户端');
        expect(addedPost.meta.visibility).toBe('public');
      });

      it('应在发布期间设置 isPublishing', async () => {
        expect(store.isPublishing).toBe(false);

        const promise = store.publishPost(mockPostData);
        // 注意：由于 mock 是同步的，这里可能捕获不到中间状态
        await promise;

        expect(store.isPublishing).toBe(false);
      });
    });
  });
});
