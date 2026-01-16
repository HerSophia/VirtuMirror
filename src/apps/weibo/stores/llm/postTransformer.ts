/**
 * LLM 输出转换层
 * 
 * 将 LLM 生成的内容转换为符合新架构的 UniversalPost 格式
 * 支持新旧两种输出格式的兼容
 * 
 * @see docs/systems/social-content-types.md Phase 4
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  UniversalPost,
  PrimaryContentType,
  ContentFlags,
  MediaAsset,
  PostPayload,
  PollPayload,
  PollOption,
  VideoPayload,
  RepostSnapshot,
  UniversalStats,
} from '@/types/social';
import {
  createDefaultContentFlags,
  createDefaultStats,
  buildContentFlags,
  getWeiboPrimaryType,
} from '@/types/social';

// ==================== 类型定义 ====================

/**
 * LLM 输出的原始格式（旧格式）
 */
export interface LegacyLLMPostOutput {
  type?: 'text' | 'poll' | 'video' | 'repost';
  text?: string;
  authorName?: string;
  authorType?: string;
  images?: (string | { description: string; expandedDescription?: string })[];
  poll?: {
    question?: string;
    options?: (string | { text: string; votes?: number })[];
    duration?: number;
    multiSelect?: boolean;
  };
  video?: {
    description?: string;
    coverDescription?: string;
    duration?: number;
  };
  /** 转发相关（旧格式） */
  repost?: {
    originalPostId?: string;
    originalAuthorName?: string;
    originalText?: string;
    originalType?: string;
    thumbnail?: string;
  };
}

/**
 * LLM 输出的新格式
 */
export interface NewLLMPostOutput {
  primaryType?: PrimaryContentType;
  payload?: {
    text?: string;
    poll?: PollPayload;
    video?: VideoPayload;
    repost?: RepostSnapshot;
  };
  media?: MediaAsset[];
  authorName?: string;
  tempId?: string;
}

/**
 * 转换上下文
 */
export interface TransformContext {
  platformId: string;
  timestamp: number;
  authorId?: string;
}

/**
 * 转换结果
 */
export interface TransformResult {
  post: Partial<UniversalPost>;
  authorName: string;
  tempId?: string;
}

// ==================== 旧格式类型映射 ====================

const LEGACY_TYPE_MAPPING: Record<string, PrimaryContentType> = {
  'text': 'text',
  'poll': 'poll',
  'video': 'video',
  'repost': 'repost',
};

// ==================== 核心转换函数 ====================

/**
 * 将 LLM 输出转换为 UniversalPost 格式
 * 支持新旧两种输出格式的兼容
 * 
 * @param output LLM 输出的 JSON 对象
 * @param context 转换上下文
 * @returns 转换结果
 */
export function transformLLMOutputToUniversalPost(
  output: LegacyLLMPostOutput | NewLLMPostOutput | any,
  context: TransformContext
): TransformResult {
  // 1. 判断是新格式还是旧格式
  const isNewFormat = 'primaryType' in output || ('payload' in output && typeof output.payload === 'object');
  
  if (isNewFormat) {
    return transformNewFormat(output as NewLLMPostOutput, context);
  }
  
  return transformLegacyFormat(output as LegacyLLMPostOutput, context);
}

/**
 * 转换新格式 LLM 输出
 */
function transformNewFormat(
  output: NewLLMPostOutput,
  context: TransformContext
): TransformResult {
  const payload: PostPayload = output.payload || {};
  const media: MediaAsset[] = output.media || [];
  
  // 构建 contentFlags
  const contentFlags = buildContentFlags(payload, media);
  
  // 确定 primaryType
  let primaryType = output.primaryType;
  if (!primaryType) {
    primaryType = getWeiboPrimaryType(contentFlags, media);
  }
  
  // 提取话题标签
  const topicTags = extractTopicTags(payload.text || '');
  
  const post: Partial<UniversalPost> = {
    platformId: context.platformId,
    authorId: context.authorId,
    timestamp: context.timestamp,
    primaryType,
    contentFlags,
    media,
    payload,
    topicTags,
    stats: createDefaultStats(),
  };
  
  return {
    post,
    authorName: output.authorName || '匿名用户',
    tempId: output.tempId,
  };
}

/**
 * 转换旧格式 LLM 输出
 */
function transformLegacyFormat(
  output: LegacyLLMPostOutput,
  context: TransformContext
): TransformResult {
  const legacyType = output.type || 'text';
  const text = output.text || '';
  
  // 转换媒体资源
  const media = convertLegacyImages(output.images);
  
  // 构建 payload
  const payload: PostPayload = {
    text,
  };
  
  // 根据类型处理特定字段
  switch (legacyType) {
    case 'poll': {
      if (output.poll) {
        payload.poll = convertLegacyPoll(output.poll, context.timestamp);
      }
      break;
    }
    case 'video': {
      if (output.video) {
        payload.video = convertLegacyVideo(output.video);
        // 同时添加到 media
        media.push({
          id: 'video_0',
          type: 'video',
          description: output.video.description || '',
          coverDescription: output.video.coverDescription,
          duration: output.video.duration,
        });
      }
      break;
    }
    case 'repost': {
      if (output.repost) {
        payload.repost = convertLegacyRepost(output.repost, context.timestamp);
      }
      break;
    }
  }
  
  // 构建 contentFlags
  const contentFlags = buildContentFlags(payload, media);
  
  // 确定 primaryType
  let primaryType: PrimaryContentType = LEGACY_TYPE_MAPPING[legacyType] || 'text';
  
  // 如果是 text 类型但有很多图片，升级为 gallery
  if (primaryType === 'text') {
    const imageCount = media.filter(m => m.type === 'image').length;
    if (imageCount >= 4) {
      primaryType = 'gallery';
    }
  }
  
  // 提取话题标签
  const topicTags = extractTopicTags(text);
  
  const post: Partial<UniversalPost> = {
    platformId: context.platformId,
    authorId: context.authorId,
    timestamp: context.timestamp,
    primaryType,
    contentFlags,
    media,
    payload,
    topicTags,
    stats: createDefaultStats(),
  };
  
  return {
    post,
    authorName: output.authorName || output.authorType || '匿名用户',
  };
}

// ==================== 辅助转换函数 ====================

/**
 * 转换旧格式的图片数组为 MediaAsset[]
 */
export function convertLegacyImages(
  images: (string | { description: string; expandedDescription?: string })[] | undefined
): MediaAsset[] {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map((img, index) => {
    if (typeof img === 'string') {
      return {
        id: `img_${index}`,
        type: 'image' as const,
        description: img,
        order: index,
      };
    }
    return {
      id: `img_${index}`,
      type: 'image' as const,
      description: img.description || '',
      expandedDescription: img.expandedDescription,
      order: index,
    };
  });
}

/**
 * 转换旧格式的投票数据
 */
export function convertLegacyPoll(
  poll: LegacyLLMPostOutput['poll'],
  timestamp: number
): PollPayload {
  if (!poll) {
    return {
      question: '请投票',
      options: [],
      endTime: timestamp + 24 * 3600000,
      multiSelect: false,
    };
  }
  
  const options: PollOption[] = (poll.options || []).map((opt, idx) => {
    if (typeof opt === 'string') {
      return {
        id: `opt_${idx}`,
        text: opt,
        votes: Math.floor(Math.random() * 100),
      };
    }
    return {
      id: `opt_${idx}`,
      text: opt.text || `选项${idx + 1}`,
      votes: typeof opt.votes === 'number' ? opt.votes : Math.floor(Math.random() * 100),
    };
  });
  
  const duration = poll.duration || 24;
  
  return {
    question: poll.question || '请投票',
    options,
    endTime: timestamp + duration * 3600000,
    multiSelect: poll.multiSelect || false,
    duration,
    totalVotes: options.reduce((sum, opt) => sum + opt.votes, 0),
  };
}

/**
 * 转换旧格式的视频数据
 */
export function convertLegacyVideo(
  video: LegacyLLMPostOutput['video']
): VideoPayload {
  if (!video) {
    return {
      description: '',
    };
  }
  
  return {
    description: video.description || '',
    coverDescription: video.coverDescription,
    duration: video.duration,
  };
}

/**
 * 转换旧格式的转发数据
 */
export function convertLegacyRepost(
  repost: LegacyLLMPostOutput['repost'],
  timestamp: number
): RepostSnapshot {
  if (!repost) {
    return {
      originalPostId: '',
      originalAuthor: { name: '未知用户' },
      originalContent: {
        text: '',
        primaryType: 'text',
        timestamp: timestamp - 3600000,
      },
    };
  }
  
  return {
    originalPostId: repost.originalPostId || `legacy_${Date.now()}`,
    originalAuthor: {
      name: repost.originalAuthorName || '未知用户',
    },
    originalContent: {
      text: repost.originalText || '',
      primaryType: (repost.originalType as PrimaryContentType) || 'text',
      thumbnail: repost.thumbnail,
      timestamp: timestamp - 3600000, // 假设原帖早1小时
    },
  };
}

/**
 * 提取话题标签
 */
export function extractTopicTags(text: string): string[] {
  const tags: string[] = [];
  const matches = text.match(/#([^#]+)#/g);
  if (matches) {
    matches.forEach(tag => {
      tags.push(tag.replace(/#/g, ''));
    });
  }
  return tags;
}

/**
 * 生成随机统计数据
 */
export function generateRandomStats(followerCount?: number): UniversalStats {
  // 根据粉丝数估算互动量级
  let multiplier = 1;
  if (followerCount) {
    if (followerCount > 1000000) multiplier = 100;
    else if (followerCount > 100000) multiplier = 50;
    else if (followerCount > 10000) multiplier = 10;
    else if (followerCount > 1000) multiplier = 3;
  }
  
  return {
    likes: Math.floor(Math.random() * 200 * multiplier),
    comments: Math.floor(Math.random() * 50 * multiplier),
    shares: Math.floor(Math.random() * 20 * multiplier),
    views: Math.floor(Math.random() * 1000 * multiplier),
  };
}

// ==================== 批量转换 ====================

/**
 * 批量转换 LLM 输出
 */
export function transformBatchLLMOutput(
  outputs: (LegacyLLMPostOutput | NewLLMPostOutput | any)[],
  context: TransformContext
): TransformResult[] {
  return outputs.map((output, index) => {
    const result = transformLLMOutputToUniversalPost(output, {
      ...context,
      // 按顺序错开时间
      timestamp: context.timestamp - Math.floor(Math.random() * 3600000) - index * 60000,
    });
    return result;
  });
}

// ==================== 验证函数 ====================

/**
 * 验证 LLM 输出是否有效
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateLLMOutput(output: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!output || typeof output !== 'object') {
    errors.push('输出必须是对象');
    return { valid: false, errors, warnings };
  }
  
  // 检查必要字段
  const hasText = output.text || output.payload?.text;
  const hasPoll = output.poll || output.payload?.poll;
  const hasVideo = output.video || output.payload?.video;
  
  if (!hasText && !hasPoll && !hasVideo) {
    warnings.push('缺少内容字段（text/poll/video），将使用空内容');
  }
  
  // 检查投票有效性
  const poll = output.poll || output.payload?.poll;
  if (poll) {
    if (!poll.options || !Array.isArray(poll.options) || poll.options.length < 2) {
      warnings.push('投票选项少于2个，可能导致降级为文字帖');
    }
  }
  
  // 检查类型
  const postType = output.type || output.primaryType;
  if (postType && !['text', 'poll', 'video', 'gallery', 'repost','article', 'link', 'audio', 'live'].includes(postType)) {
    warnings.push(`未知的帖子类型: ${postType}，将默认为 text`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
