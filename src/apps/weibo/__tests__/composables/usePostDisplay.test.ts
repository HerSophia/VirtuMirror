/**
 * usePostDisplay Composable 单元测试
 * 测试帖子展示逻辑
 */

import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import type { DisplayPost } from '@/types/social';
import {
  usePostDisplay,
  isDisplayPost,
  normalizePollOptions,
} from '../../composables/usePostDisplay';
import { createMockDisplayPost } from '../setup';

describe('usePostDisplay', () => {
  describe('usePostDisplay composable', () => {
    it('应正确解析文字帖', () => {
      const post = ref(createMockDisplayPost({
        primaryType: 'text',
        payload: { text: '测试内容 #话题#' },
      }) as DisplayPost);

      const { primaryType, content, formattedContent, isPoll, isVideo, isRepost } = usePostDisplay(post);

      expect(primaryType.value).toBe('text');
      expect(content.value).toBe('测试内容 #话题#');
      expect(formattedContent.value).toContain('text-[#4c7aab]');
      expect(isPoll.value).toBe(false);
      expect(isVideo.value).toBe(false);
      expect(isRepost.value).toBe(false);
    });

    it('应正确解析投票帖', () => {
      const post = ref(createMockDisplayPost({
        primaryType: 'poll',
        payload: {
          text: '投票问题',
          poll: {
            question: '你喜欢什么？',
            options: [{ id: '1', text: 'A', votes: 10 }],
            endTime: Date.now() + 86400000,
            multiSelect: false,
          },
        },
      }) as DisplayPost);

      const { primaryType, poll, isPoll } = usePostDisplay(post);

      expect(primaryType.value).toBe('poll');
      expect(isPoll.value).toBe(true);
      expect(poll.value?.question).toBe('你喜欢什么？');
    });

    it('应正确解析视频帖', () => {
      const post = ref(createMockDisplayPost({
        primaryType: 'video',
        payload: {
          text: '视频描述',
          video: {
            description: '精彩视频',
            duration: 120,
          },
        },
      }) as DisplayPost);

      const { primaryType, video, isVideo } = usePostDisplay(post);

      expect(primaryType.value).toBe('video');
      expect(isVideo.value).toBe(true);
      expect(video.value?.description).toBe('精彩视频');
      expect(video.value?.duration).toBe(120);
    });

    it('应正确解析转发帖', () => {
      const post = ref(createMockDisplayPost({
        primaryType: 'repost',
        payload: {
          text: '转发评论',
          repost: {
            originalPostId: 'orig_123',
            originalAuthor: { name: '原作者' },
            originalContent: {
              text: '原文内容',
              primaryType: 'text',
              timestamp: Date.now() - 3600000,
            },
          },
        },
      }) as DisplayPost);

      const { primaryType, repost, isRepost } = usePostDisplay(post);

      expect(primaryType.value).toBe('repost');
      expect(isRepost.value).toBe(true);
      expect(repost.value?.originalAuthor.name).toBe('原作者');
    });

    it('应正确格式化话题高亮', () => {
      const post = ref(createMockDisplayPost({
        payload: { text: '今天 #天气# 很好 #心情# 不错' },
      }) as DisplayPost);

      const { formattedContent } = usePostDisplay(post);

      expect(formattedContent.value).toContain('<span class="text-[#4c7aab]">#天气#</span>');
      expect(formattedContent.value).toContain('<span class="text-[#4c7aab]">#心情#</span>');
    });

    it('应处理空 payload', () => {
      const post = ref(createMockDisplayPost({
        payload: {},
      }) as DisplayPost);

      const { content, primaryType } = usePostDisplay(post);

      expect(content.value).toBe('');
      expect(primaryType.value).toBe('text');
    });
  });

  describe('isDisplayPost', () => {
    it('应正确识别 Post', () => {
      const validPost = createMockDisplayPost();

      expect(isDisplayPost(validPost)).toBe(true);
    });

    it('应拒绝非 DisplayPost 对象', () => {
      expect(isDisplayPost(null)).toBe(false);
      expect(isDisplayPost(undefined)).toBe(false);
      expect(isDisplayPost({})).toBe(false);
      expect(isDisplayPost({ id: '123' })).toBe(false);
      expect(isDisplayPost({ author: null })).toBe(false);
    });

    it('应拒绝缺少必要字段的对象', () => {
      const partialPost = {
        id: '123',
        author: { id: 'a', name: 'test', avatar: 'url' },
        // 缺少 payload 和 platformId
      };

      expect(isDisplayPost(partialPost)).toBe(false);
    });
  });

  describe('normalizePollOptions', () => {
    it('应将字符串数组转换为选项对象', () => {
      const options = ['选项A', '选项B', '选项C'];
      const result = normalizePollOptions(options);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'opt_0',
        text: '选项A',
      }));
      expect(typeof result[0].votes).toBe('number');
    });

    it('应保留已有的选项对象', () => {
      const options = [
        { id: 'custom_1', text: '自定义选项', votes: 100 },
      ];
      const result = normalizePollOptions(options);

      expect(result[0].id).toBe('custom_1');
      expect(result[0].votes).toBe(100);
    });

    it('应处理混合格式', () => {
      const options = [
        '文字选项',
        { text: '对象选项' },
        { id: 'full', text: '完整选项', votes: 50 },
      ];
      const result = normalizePollOptions(options);

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('文字选项');
      expect(result[1].text).toBe('对象选项');
      expect(result[2].id).toBe('full');
    });

    it('应处理空输入', () => {
      expect(normalizePollOptions(undefined)).toEqual([]);
      expect(normalizePollOptions([])).toEqual([]);
    });

    it('应为缺少 text 的对象提供默认值', () => {
      const options = [{ votes: 10 }];
      const result = normalizePollOptions(options);

      expect(result[0].text).toBe('选项1');
    });
  });
});
