/**
 * 社交类型系统单元测试
 * 测试 src/types/social.ts 中的工具函数
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultContentFlags,
  createDefaultStats,
  getWeiboPrimaryType,
  getBilibiliPrimaryType,
  getZhihuPrimaryType,
  buildContentFlags,
  convertImagesToMediaAssets,
  formatRelativeTime,
  getImageUrlsFromMedia,
  normalizeImagesFromPayload,
  getPrimaryTypeFromPost,
  getImagesFromPost,
  type ContentFlags,
  type MediaAsset,
  type PostPayload,
  type UniversalPost,
} from '@/types/social';

describe('Social Types', () => {
  describe('createDefaultContentFlags', () => {
    it('应返回全 false 的默认值', () => {
      const flags = createDefaultContentFlags();

      expect(flags.hasText).toBe(false);
      expect(flags.hasImages).toBe(false);
      expect(flags.hasVideo).toBe(false);
      expect(flags.hasAudio).toBe(false);
      expect(flags.hasPoll).toBe(false);
      expect(flags.hasLink).toBe(false);
      expect(flags.hasRepost).toBe(false);
      expect(flags.hasArticle).toBe(false);
    });
  });

  describe('createDefaultStats', () => {
    it('应返回零值统计', () => {
      const stats = createDefaultStats();

      expect(stats.likes).toBe(0);
      expect(stats.comments).toBe(0);
      expect(stats.shares).toBe(0);
      expect(stats.views).toBe(0);
    });
  });

  describe('getWeiboPrimaryType', () => {
    it('投票优先级最高', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasPoll: true,
        hasImages: true,
      };

      expect(getWeiboPrimaryType(flags, [])).toBe('poll');
    });

    it('转发次优先', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasRepost: true,
        hasVideo: true,
      };

      expect(getWeiboPrimaryType(flags, [])).toBe('repost');
    });

    it('长文次之', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasArticle: true,
        hasImages: true,
      };

      expect(getWeiboPrimaryType(flags, [])).toBe('article');
    });

    it('视频次之', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasVideo: true,
        hasImages: true,
      };

      expect(getWeiboPrimaryType(flags, [])).toBe('video');
    });

    it('4张图片以上为图集', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasImages: true,
      };
      const media: MediaAsset[] = [
        { id: '1', type: 'image', description: '' },
        { id: '2', type: 'image', description: '' },
        { id: '3', type: 'image', description: '' },
        { id: '4', type: 'image', description: '' },
      ];

      expect(getWeiboPrimaryType(flags, media)).toBe('gallery');
    });

    it('少于4张图片为文字帖', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasImages: true,
      };
      const media: MediaAsset[] = [
        { id: '1', type: 'image', description: '' },
        { id: '2', type: 'image', description: '' },
      ];

      expect(getWeiboPrimaryType(flags, media)).toBe('text');
    });

    it('默认为文字帖', () => {
      const flags = createDefaultContentFlags();

      expect(getWeiboPrimaryType(flags, [])).toBe('text');
    });
  });

  describe('getBilibiliPrimaryType', () => {
    it('视频优先级最高', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasVideo: true,
        hasArticle: true,
      };

      expect(getBilibiliPrimaryType(flags)).toBe('video');
    });

    it('专栏次之', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasArticle: true,
        hasImages: true,
      };

      expect(getBilibiliPrimaryType(flags)).toBe('article');
    });
  });

  describe('getZhihuPrimaryType', () => {
    it('回答应返回 answer', () => {
      const flags = createDefaultContentFlags();

      expect(getZhihuPrimaryType(flags, true)).toBe('answer');
    });

    it('回答带视频和图片应返回 mixed', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasVideo: true,
        hasImages: true,
      };

      expect(getZhihuPrimaryType(flags, true)).toBe('mixed');
    });

    it('非回答的长文应返回 article', () => {
      const flags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasArticle: true,
      };

      expect(getZhihuPrimaryType(flags, false)).toBe('article');
    });
  });

  describe('buildContentFlags', () => {
    it('应检测文字内容', () => {
      const payload: PostPayload = { text: '有内容' };

      const flags = buildContentFlags(payload, []);

      expect(flags.hasText).toBe(true);
    });

    it('应检测空文字', () => {
      const payload: PostPayload = { text: '   ' };

      const flags = buildContentFlags(payload, []);

      expect(flags.hasText).toBe(false);
    });

    it('应检测图片', () => {
      const media: MediaAsset[] = [{ id: '1', type: 'image', description: '' }];

      const flags = buildContentFlags({}, media);

      expect(flags.hasImages).toBe(true);
    });

    it('应检测视频', () => {
      const payload: PostPayload = { video: { description: '视频' } };

      const flags = buildContentFlags(payload, []);

      expect(flags.hasVideo).toBe(true);
    });

    it('应检测投票', () => {
      const payload: PostPayload = {
        poll: {
          question: '问题',
          options: [],
          endTime: Date.now(),
          multiSelect: false,
        },
      };

      const flags = buildContentFlags(payload, []);

      expect(flags.hasPoll).toBe(true);
    });

    it('应检测转发', () => {
      const payload: PostPayload = {
        repost: {
          originalPostId: 'id',
          originalAuthor: { name: '作者' },
          originalContent: { text: '', primaryType: 'text', timestamp: 0 },
        },
      };

      const flags = buildContentFlags(payload, []);

      expect(flags.hasRepost).toBe(true);
    });
  });

  describe('convertImagesToMediaAssets', () => {
    it('应转换字符串数组', () => {
      const images = ['图片1', '图片2'];

      const media = convertImagesToMediaAssets(images);

      expect(media).toHaveLength(2);
      expect(media[0].type).toBe('image');
      expect(media[0].description).toBe('图片1');
      expect(media[0].order).toBe(0);
    });

    it('应转换对象数组', () => {
      const images = [{ description: '描述', expandedDescription: '详细描述' }];

      const media = convertImagesToMediaAssets(images);

      expect(media[0].description).toBe('描述');
      expect(media[0].expandedDescription).toBe('详细描述');
    });

    it('应处理空输入', () => {
      expect(convertImagesToMediaAssets(undefined)).toEqual([]);
      expect(convertImagesToMediaAssets([])).toEqual([]);
    });
  });

  describe('formatRelativeTime', () => {
    it('应返回「刚刚」', () => {
      const now = Date.now();
      expect(formatRelativeTime(now)).toBe('刚刚');
      expect(formatRelativeTime(now - 30000)).toBe('刚刚');
    });

    it('应返回分钟', () => {
      const time = Date.now() - 5 * 60 * 1000;
      expect(formatRelativeTime(time)).toBe('5分钟前');
    });

    it('应返回小时', () => {
      const time = Date.now() - 3 * 60 * 60 * 1000;
      expect(formatRelativeTime(time)).toBe('3小时前');
    });

    it('应返回天数', () => {
      const time = Date.now() - 2 * 24 * 60 * 60 * 1000;
      expect(formatRelativeTime(time)).toBe('2天前');
    });

    it('超过一周应返回日期', () => {
      const time = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const result = formatRelativeTime(time);
      expect(result).toMatch(/\d{2}\/\d{2}/);
    });
  });

  describe('getImageUrlsFromMedia', () => {
    it('应从 media 提取图片 URL', () => {
      const media: MediaAsset[] = [
        { id: '1', type: 'image', description: '', url: 'https://example.com/1.jpg' },
        { id: '2', type: 'video', description: '' },
        { id: '3', type: 'image', description: '', url: 'https://example.com/2.jpg' },
      ];

      const urls = getImageUrlsFromMedia(media);

      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe('https://example.com/1.jpg');
    });

    it('无 URL 时应生成占位图', () => {
      const media: MediaAsset[] = [
        { id: '1', type: 'image', description: '美丽风景' },
      ];

      const urls = getImageUrlsFromMedia(media);

      expect(urls[0]).toContain('placeholder');
      expect(urls[0]).toContain(encodeURIComponent('美丽风景'));
    });

    it('应按 order 排序', () => {
      const media: MediaAsset[] = [
        { id: '1', type: 'image', description: '', url: 'url2', order: 2 },
        { id: '2', type: 'image', description: '', url: 'url1', order: 1 },
      ];

      const urls = getImageUrlsFromMedia(media);

      expect(urls[0]).toBe('url1');
      expect(urls[1]).toBe('url2');
    });

    it('应处理空输入', () => {
      expect(getImageUrlsFromMedia(undefined)).toEqual([]);
      expect(getImageUrlsFromMedia([])).toEqual([]);
    });
  });

  describe('normalizeImagesFromPayload', () => {
    it('应处理 URL 字符串', () => {
      const images = ['https://example.com/img.jpg'];

      const urls = normalizeImagesFromPayload(images);

      expect(urls[0]).toBe('https://example.com/img.jpg');
    });

    it('应为非 URL 字符串生成占位图', () => {
      const images = ['图片描述'];

      const urls = normalizeImagesFromPayload(images);

      expect(urls[0]).toContain('placeholder');
    });

    it('应处理对象格式', () => {
      const images = [{ description: '描述', expandedDescription: '详细描述' }];

      const urls = normalizeImagesFromPayload(images);

      expect(urls[0]).toContain(encodeURIComponent('详细描述'));
    });
  });

  describe('getPrimaryTypeFromPost', () => {
    const createPost = (overrides: Partial<UniversalPost> = {}): UniversalPost => ({
      id: 'test',
      platformId: 'weibo',
      authorId: 'author',
      timestamp: Date.now(),
      topicTags: [],
      payload: { text: '' },
      stats: createDefaultStats(),
      ...overrides,
    });

    it('应优先使用 primaryType', () => {
      const post = createPost({ primaryType: 'video' });

      expect(getPrimaryTypeFromPost(post)).toBe('video');
    });

    it('应兼容旧的 payload.type', () => {
      const post = createPost({
        payload: { type: 'poll' } as any,
      });

      expect(getPrimaryTypeFromPost(post)).toBe('poll');
    });

    it('应根据 payload 内容推断', () => {
      const post = createPost({
        payload: {
          poll: { question: '', options: [], endTime: 0, multiSelect: false },
        },
      });

      expect(getPrimaryTypeFromPost(post)).toBe('poll');
    });

    it('默认返回 text', () => {
      const post = createPost();

      expect(getPrimaryTypeFromPost(post)).toBe('text');
    });
  });

  describe('getImagesFromPost', () => {
    const createPost = (overrides: Partial<UniversalPost> = {}): UniversalPost => ({
      id: 'test',
      platformId: 'weibo',
      authorId: 'author',
      timestamp: Date.now(),
      topicTags: [],
      payload: { text: '' },
      stats: createDefaultStats(),
      ...overrides,
    });

    it('应优先使用 media', () => {
      const post = createPost({
        media: [{ id: '1', type: 'image', description: '', url: 'https://example.com/img.jpg' }],
        payload: { images: ['旧格式图片'] },
      });

      const images = getImagesFromPost(post);

      expect(images[0]).toBe('https://example.com/img.jpg');
    });

    it('应回退到 payload.images', () => {
      const post = createPost({
        payload: { images: ['https://example.com/old.jpg'] },
      });

      const images = getImagesFromPost(post);

      expect(images[0]).toBe('https://example.com/old.jpg');
    });
  });
});
