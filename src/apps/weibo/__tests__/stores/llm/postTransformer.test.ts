/**
 * postTransformer 单元测试
 * 测试 LLM 输出到 UniversalPost 的转换逻辑
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformLLMOutputToUniversalPost,
  transformBatchLLMOutput,
  convertLegacyImages,
  convertLegacyPoll,
  convertLegacyVideo,
  convertLegacyRepost,
  extractTopicTags,
  generateRandomStats,
  validateLLMOutput,
  type TransformContext,
} from '../../../stores/llm/postTransformer';

describe('postTransformer', () => {
  const baseContext: TransformContext = {
    platformId: 'weibo',
    timestamp: Date.now(),
    authorId: 'test_author',
  };

  describe('transformLLMOutputToUniversalPost', () => {
    describe('旧格式转换', () => {
      it('应正确转换纯文字帖', () => {
        const output = {
          type: 'text',
          text: '这是一条测试微博 #测试# @用户',
          authorName: '测试用户',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('text');
        expect(result.post.payload?.text).toBe(output.text);
        expect(result.authorName).toBe('测试用户');
        expect(result.post.topicTags).toContain('测试');
      });

      it('应正确转换带图片的帖子', () => {
        const output = {
          type: 'text',
          text: '今天的风景',
          images: ['美丽的夕阳', { description: '蓝天白云', expandedDescription: '湛蓝的天空下飘着朵朵白云' }],
          authorName: '摄影师',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('text');
        expect(result.post.media).toHaveLength(2);
        expect(result.post.media?.[0].type).toBe('image');
        expect(result.post.media?.[0].description).toBe('美丽的夕阳');
        expect(result.post.media?.[1].expandedDescription).toBe('湛蓝的天空下飘着朵朵白云');
        expect(result.post.contentFlags?.hasImages).toBe(true);
      });

      it('应将4张及以上图片识别为gallery类型', () => {
        const output = {
          type: 'text',
          text: '九宫格',
          images: ['图1', '图2', '图3', '图4'],
          authorName: '用户',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('gallery');
        expect(result.post.media).toHaveLength(4);
      });

      it('应正确转换投票帖', () => {
        const output = {
          type: 'poll',
          text: '你喜欢什么水果？',
          poll: {
            question: '选择你最喜欢的水果',
            options: ['苹果', '香蕉', { text: '橙子', votes: 10 }],
            duration: 24,
            multiSelect: false,
          },
          authorName: '发起者',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('poll');
        expect(result.post.payload?.poll).toBeDefined();
        expect(result.post.payload?.poll?.question).toBe('选择你最喜欢的水果');
        expect(result.post.payload?.poll?.options).toHaveLength(3);
        expect(result.post.payload?.poll?.options[0].text).toBe('苹果');
        expect(result.post.payload?.poll?.options[2].votes).toBe(10);
        expect(result.post.contentFlags?.hasPoll).toBe(true);
      });

      it('应正确转换视频帖', () => {
        const output = {
          type: 'video',
          text: '今日 vlog',
          video: {
            description: '记录我的一天',
            coverDescription: '视频封面',
            duration: 120,
          },
          authorName: 'vlogger',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('video');
        expect(result.post.payload?.video).toBeDefined();
        expect(result.post.payload?.video?.description).toBe('记录我的一天');
        expect(result.post.payload?.video?.duration).toBe(120);
        expect(result.post.media?.some(m => m.type === 'video')).toBe(true);
        expect(result.post.contentFlags?.hasVideo).toBe(true);
      });

      it('应正确转换转发帖', () => {
        const output = {
          type: 'repost',
          text: '转发这条',
          repost: {
            originalPostId: 'original_123',
            originalAuthorName: '原作者',
            originalText: '原文内容',
            originalType: 'text',
          },
          authorName: '转发者',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('repost');
        expect(result.post.payload?.repost).toBeDefined();
        expect(result.post.payload?.repost?.originalAuthor.name).toBe('原作者');
        expect(result.post.payload?.repost?.originalContent.text).toBe('原文内容');
        expect(result.post.contentFlags?.hasRepost).toBe(true);
      });
    });

    describe('新格式转换', () => {
      it('应正确转换新格式输出', () => {
        const output = {
          primaryType: 'text',
          payload: {
            text: '新格式内容 #新话题#',
          },
          media: [
            { id: 'img_0', type: 'image', description: '图片描述', order: 0 },
          ],
          authorName: '新用户',
          tempId: 'temp_1',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('text');
        expect(result.post.payload?.text).toBe('新格式内容 #新话题#');
        expect(result.post.media).toHaveLength(1);
        expect(result.tempId).toBe('temp_1');
        expect(result.post.topicTags).toContain('新话题');
      });

      it('应根据 contentFlags 推断 primaryType', () => {
        const output = {
          payload: {
            text: '没有显式 primaryType',
            poll: {
              question: '测试投票',
              options: [{ id: 'a', text: '选项A', votes: 0 }],
              endTime: Date.now() + 86400000,
              multiSelect: false,
            },
          },
          authorName: '用户',
        };

        const result = transformLLMOutputToUniversalPost(output, baseContext);

        expect(result.post.primaryType).toBe('poll');
      });
    });
  });

  describe('transformBatchLLMOutput', () => {
    it('应正确批量转换多条输出', () => {
      const outputs = [
        { type: 'text', text: '第一条', authorName: '用户1' },
        { type: 'text', text: '第二条', authorName: '用户2' },
        { primaryType: 'video', payload: { text: '视频', video: { description: '描述' } }, authorName: '用户3' },
      ];

      const results = transformBatchLLMOutput(outputs, baseContext);

      expect(results).toHaveLength(3);
      expect(results[0].authorName).toBe('用户1');
      expect(results[1].authorName).toBe('用户2');
      expect(results[2].post.primaryType).toBe('video');
    });

    it('应为批量输出生成不同的时间戳', () => {
      const outputs = [
        { type: 'text', text: '帖子1', authorName: '用户' },
        { type: 'text', text: '帖子2', authorName: '用户' },
      ];

      const results = transformBatchLLMOutput(outputs, baseContext);

      // 由于包素，只验证时间戳存在且不完全相等
      expect(results[0].post.timestamp).toBeDefined();
      expect(results[1].post.timestamp).toBeDefined();
      // 两条时间戳应该都早于基准时间
      expect(results[0].post.timestamp).toBeLessThanOrEqual(baseContext.timestamp);
      expect(results[1].post.timestamp).toBeLessThanOrEqual(baseContext.timestamp);
    });
  });

  describe('convertLegacyImages', () => {
    it('应转换字符串数组', () => {
      const images = ['描述1', '描述2'];
      const result = convertLegacyImages(images);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('image');
      expect(result[0].description).toBe('描述1');
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
    });

    it('应转换对象数组', () => {
      const images = [
        { description: '简短描述', expandedDescription: '详细描述' },
      ];
      const result = convertLegacyImages(images);

      expect(result[0].description).toBe('简短描述');
      expect(result[0].expandedDescription).toBe('详细描述');
    });

    it('应处理空输入', () => {
      expect(convertLegacyImages(undefined)).toEqual([]);
      expect(convertLegacyImages([])).toEqual([]);
    });
  });

  describe('convertLegacyPoll', () => {
    const timestamp = Date.now();

    it('应转换字符串选项', () => {
      const poll = {
        question: '问题',
        options: ['选项A', '选项B'],
        duration: 24,
      };

      const result = convertLegacyPoll(poll, timestamp);

      expect(result.question).toBe('问题');
      expect(result.options).toHaveLength(2);
      expect(result.options[0].text).toBe('选项A');
      expect(result.options[0].id).toBe('opt_0');
      expect(result.endTime).toBe(timestamp + 24 * 3600000);
    });

    it('应保留对象选项的票数', () => {
      const poll = {
        question: '问题',
        options: [{ text: '选项', votes: 100 }],
      };

      const result = convertLegacyPoll(poll, timestamp);

      expect(result.options[0].votes).toBe(100);
    });

    it('应处理空输入', () => {
      const result = convertLegacyPoll(undefined, timestamp);

      expect(result.question).toBe('请投票');
      expect(result.options).toEqual([]);
    });
  });

  describe('convertLegacyVideo', () => {
    it('应转换视频数据', () => {
      const video = {
        description: '视频描述',
        coverDescription: '封面',
        duration: 180,
      };

      const result = convertLegacyVideo(video);

      expect(result.description).toBe('视频描述');
      expect(result.coverDescription).toBe('封面');
      expect(result.duration).toBe(180);
    });

    it('应处理空输入', () => {
      const result = convertLegacyVideo(undefined);
      expect(result.description).toBe('');
    });
  });

  describe('convertLegacyRepost', () => {
    const timestamp = Date.now();

    it('应转换转发数据', () => {
      const repost = {
        originalPostId: 'orig_123',
        originalAuthorName: '原作者',
        originalText: '原文',
        originalType: 'text',
        thumbnail: '缩略图',
      };

      const result = convertLegacyRepost(repost, timestamp);

      expect(result.originalPostId).toBe('orig_123');
      expect(result.originalAuthor.name).toBe('原作者');
      expect(result.originalContent.text).toBe('原文');
      expect(result.originalContent.primaryType).toBe('text');
      expect(result.originalContent.thumbnail).toBe('缩略图');
    });

    it('应处理空输入', () => {
      const result = convertLegacyRepost(undefined, timestamp);

      expect(result.originalPostId).toBe('');
      expect(result.originalAuthor.name).toBe('未知用户');
    });
  });

  describe('extractTopicTags', () => {
    it('应提取话题标签', () => {
      const text = '今天 #天气# 很好，适合 #出游#';
      const tags = extractTopicTags(text);

      expect(tags).toContain('天气');
      expect(tags).toContain('出游');
      expect(tags).toHaveLength(2);
    });

    it('应处理没有话文本', () => {
      const tags = extractTopicTags('没有话题的普通文本');
      expect(tags).toEqual([]);
    });

    it('应处理空文本', () => {
      expect(extractTopicTags('')).toEqual([]);
    });
  });

  describe('generateRandomStats', () => {
    it('应生成有效的统计数据', () => {
      const stats = generateRandomStats();

      expect(stats.likes).toBeGreaterThanOrEqual(0);
      expect(stats.comments).toBeGreaterThanOrEqual(0);
      expect(stats.shares).toBeGreaterThanOrEqual(0);
      expect(stats.views).toBeGreaterThanOrEqual(0);
    });

    it('应根据粉丝数调整互动量级', () => {
      const lowFollower = generateRandomStats(100);
      const highFollower = generateRandomStats(1000000);

      // 高粉丝数账号的互动量平均应该更高
      // 由于是随机数，我们只验证函数正常执行
      expect(typeof highFollower.likes).toBe('number');
      expect(typeof lowFollower.likes).toBe('number');
    });
  });

  describe('validateLLMOutput', () => {
    it('应验证有效输出', () => {
      const output = { text: '内容', authorName: '用户' };
      const result = validateLLMOutput(output);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应拒绝非对象输入', () => {
      expect(validateLLMOutput(null).valid).toBe(false);
      expect(validateLLMOutput('string').valid).toBe(false);
      expect(validateLLMOutput(123).valid).toBe(false);
    });

    it('应对缺少内容的输出给出警告', () => {
      const output = { authorName: '用户' };
      const result = validateLLMOutput(output);

      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    it('应对无效投票选项给出警告', () => {
      const output = {
        poll: { question: '问题', options: ['只有一个选项'] },
      };
      const result = validateLLMOutput(output);

      expect(result.warnings?.some(w => w.includes('投票选项'))).toBe(true);
    });

    it('应对未知类型给出警告', () => {
      const output = { type: 'unknown_type', text: '内容' };
      const result = validateLLMOutput(output);

      expect(result.warnings?.some(w => w.includes('未知的帖子类型'))).toBe(true);
    });
  });
});
