/**
 * Weibo App 测试配置
 * 提供测试用的 mock 数据和工具函数
 */

import { setActivePinia, createPinia } from 'pinia';
import { vi } from 'vitest';

// ==================== Mock 数据工厂 ====================

/**
 * 创建模拟的 UniversalPost
 */
export function createMockPost(overrides: Partial<any> = {}) {
  const now = Date.now();
  return {
    id: `post_${Math.random().toString(36).substr(2, 9)}`,
    platformId: 'weibo',
    authorId: 'test_author_id',
    timestamp: now - Math.floor(Math.random() * 86400000),
    primaryType: 'text',
    contentFlags: {
      hasText: true,
      hasImages: false,
      hasVideo: false,
      hasAudio: false,
      hasPoll: false,
      hasLink: false,
      hasRepost: false,
      hasArticle: false,
    },
    media: [],
    topicTags: [],
    payload: {
      text: '这是一条测试微博 #测试话题#',
    },
    stats: {
      likes: Math.floor(Math.random() * 1000),
      comments: Math.floor(Math.random() * 100),
      shares: Math.floor(Math.random() * 50),
      views: Math.floor(Math.random() * 10000),
    },
    meta: {
      source: 'test',
      visibility: 'public',
    },
    ...overrides,
  };
}

/**
 * 创建模拟的 DisplayPost
 */
export function createMockDisplayPost(overrides: Partial<any> = {}) {
  const post = createMockPost(overrides);
  return {
    ...post,
    author: {
      id: post.authorId,
      name: '测试用户',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
      verified: false,
      verifiedType: 'personal',
      vipLevel: 0,
    },
    displayTime: '刚刚',
    imageUrls: [],
    isFollowing: false,
    ...overrides,
  };
}

/**
 * 创建模拟的热搜项
 */
export function createMockHotSearchItem(overrides: Partial<any> = {}) {
  return {
    rank: 1,
    title: '测试热搜话题',
    heat: 1000000,
    heatFormatted: '100万',
    tag: 'hot' as const,
    tagType: 'icon' as const,
    isTop: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * 创建模拟的草稿
 */
export function createMockDraft(overrides: Partial<any> = {}) {
  const now = Date.now();
  return {
    id: `draft_${Math.random().toString(36).substr(2, 9)}`,
    type: 'text' as const,
    content: '这是一条草稿',
    topics: ['测试'],
    images: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * 创建模拟的 LLM 输出（旧格式）
 */
export function createMockLegacyLLMOutput(overrides: Partial<any> = {}) {
  return {
    type: 'text',
    text: '这是 LLM 生成的内容 #测试话题#',
    authorName: 'AI用户',
    images: ['图片描述1', '图片描述2'],
    ...overrides,
  };
}

/**
 * 创建模拟的 LLM 输出（新格式）
 */
export function createMockNewLLMOutput(overrides: Partial<any> = {}) {
  return {
    primaryType: 'text',
    payload: {
      text: '这是新格式 LLM 生成的内容 #新话题#',
    },
    media: [
      { id: 'img_0', type: 'image', description: '图片描述', order: 0 },
    ],
    authorName: 'AI用户',
    tempId: 'post_0',
    ...overrides,
  };
}

// ==================== Mock 服务 ====================

/**
 * 创建模拟的 IndexedDB
 */
export function createMockDB() {
  const posts: any[] = [];
  const comments: any[] = [];
  const topics: any[] = [];
  const accounts: any[] = [];

  return {
    socialPosts: {
      toArray: vi.fn().mockImplementation(() => Promise.resolve([...posts])),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockImplementation(() => Promise.resolve([...posts])),
          reverse: vi.fn().mockReturnValue({
            sortBy: vi.fn().mockImplementation(() => Promise.resolve([...posts])),
          }),
        }),
      }),
      add: vi.fn().mockImplementation((post) => {
        posts.push(post);
        return Promise.resolve(post.id);
      }),
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
      add: vi.fn().mockImplementation((comment) => {
        comments.push(comment);
        return Promise.resolve(comment.id);
      }),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
    socialTopics: {
      toArray: vi.fn().mockImplementation(() => Promise.resolve([...topics])),
      add: vi.fn().mockImplementation((topic) => {
        topics.push(topic);
        return Promise.resolve(topic.id);
      }),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
    socialAccounts: {
      toArray: vi.fn().mockImplementation(() => Promise.resolve([...accounts])),
      add: vi.fn().mockImplementation((account) => {
        accounts.push(account);
        return Promise.resolve(account.id);
      }),
      get: vi.fn().mockImplementation((id) => Promise.resolve(accounts.find(a => a.id === id))),
    },
    _data: { posts, comments, topics, accounts },
  };
}

/**
 * 创建模拟的 AccountService
 */
export function createMockAccountService(){
  return {
    getPlatformAccount: vi.fn().mockResolvedValue({
      id: 'test_account_id',
      entityId: 'test_entity_id',
      platformId: 'weibo',
      handle: 'test_user',
      nickname: '测试用户',
      platformData: { verified: false, vipLevel: 0 },
    }),
    getEntity: vi.fn().mockResolvedValue({
      id: 'test_entity_id',
      displayName: '测试用户',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
    }),
    getAccountsByPlatform: vi.fn().mockResolvedValue([]),
    createEntity: vi.fn().mockResolvedValue({ id: 'new_entity_id' }),
    createPlatformAccount: vi.fn().mockResolvedValue({ id: 'new_account_id' }),
  };
}

// ==================== 测试工具函数 ====================

/**
 * 初始化测试环境的 Pinia
 */
export function setupTestPinia() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

/**
 * 等待异步操作完成
 */
export function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * 创建模拟的 localStorage
 */
export function createMockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    _store: store,
  };
}
