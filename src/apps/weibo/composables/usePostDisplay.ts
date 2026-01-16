/**
 * 帖子展示 Composable
 * Phase 3 重构：提供从 DisplayPost 到 UI 展示的转换函数
 * 
 * 统一使用 DisplayPost 类型，无中间层类型转换
 */

import { computed, type Ref, type ComputedRef } from 'vue';
import type {
  DisplayPost,
  PrimaryContentType,
  PollPayload,
  VideoPayload,
  RepostSnapshot,
} from '@/types/social';
import {
  getPrimaryTypeFromPost,
} from '@/types/social';

/**
 * 帖子展示属性（用于组件 computed）
 */
export interface PostDisplayProps {
  /** 主类型 */
  primaryType: ComputedRef<PrimaryContentType>;
  /** 正文内容 */
  content: ComputedRef<string>;
  /** 带高亮的 HTML 内容（话题高亮） */
  formattedContent: ComputedRef<string>;
  /** 投票数据 */
  poll: ComputedRef<PollPayload | undefined>;
  /** 视频数据 */
  video: ComputedRef<VideoPayload | undefined>;
  /** 转发快照数据 */
  repost: ComputedRef<RepostSnapshot | undefined>;
  /** 是否是投票帖 */
  isPoll: ComputedRef<boolean>;
  /** 是否是视频帖 */
  isVideo: ComputedRef<boolean>;
  /** 是否是转发帖 */
  isRepost: ComputedRef<boolean>;
}

/**
 * 使用帖子展示属性
 * 从 DisplayPost 提取 UI 展示所需的 computed 属性
 * 
 * @example
 * ```ts
 * const props = defineProps<{ post: DisplayPost }>();
 * const { formattedContent, primaryType, poll, video } = usePostDisplay(toRef(props, 'post'));
 * ```
 */
export function usePostDisplay(post: Ref<DisplayPost>): PostDisplayProps {
  const primaryType = computed((): PrimaryContentType => {
    return getPrimaryTypeFromPost(post.value);
  });

  const content = computed(() => {
    return post.value.payload?.text || '';
  });

  const formattedContent = computed(() => {
    const text = content.value;
    // 高亮话题 #...#
    return text.replace(/#([^#]+)#/g, '<span class="text-[#4c7aab]">#$1#</span>');
  });

  const poll = computed(() => {
    return post.value.payload?.poll;
  });

  const video = computed(() => {
    return post.value.payload?.video;
  });

  const repost = computed(() => {
    return post.value.payload?.repost;
  });

  const isPoll = computed(() => {
    return primaryType.value === 'poll' && !!poll.value;
  });

  const isVideo = computed(() => {
    return primaryType.value === 'video' && !!video.value;
  });

  const isRepost = computed(() => {
    return primaryType.value === 'repost';
  });

  return {
    primaryType,
    content,
    formattedContent,
    poll,
    video,
    repost,
    isPoll,
    isVideo,
    isRepost,
  };
}

/**
 * 检查帖子是否是 DisplayPost 类型
 */
export function isDisplayPost(post: unknown): post is DisplayPost {
  return (
    typeof post === 'object' &&
    post !== null &&
    'author' in post &&
    'payload' in post &&
    'platformId' in post &&
    (post as DisplayPost).author !== undefined
  );
}

/**
 * 投票选项归一化
 * 确保 options 是对象数组格式
 */
export function normalizePollOptions(
  options: any[] | undefined
): { id: string; text: string; votes: number }[] {
  if (!options || !Array.isArray(options) || options.length === 0) {
    return [];
  }

  return options.map((opt, idx) => {
    if (typeof opt === 'string') {
      return {
        id: `opt_${idx}`,
        text: opt,
        votes: Math.floor(Math.random() * 100),
      };
    }
    if (typeof opt === 'object' && opt !== null) {
      return {
        id: opt.id || `opt_${idx}`,
        text: opt.text || `选项${idx + 1}`,
        votes: typeof opt.votes === 'number' ? opt.votes : Math.floor(Math.random() * 100),
      };
    }
    return {
      id: `opt_${idx}`,
      text: `选项${idx + 1}`,
      votes: 0,
    };
  });
}
