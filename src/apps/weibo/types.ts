/**
 * 微博用户信息（UI 展示层）
 * @deprecated Phase 3 重构后，请使用 PostAuthor from '@/types/social'
 */
export interface WeiboUser {
  id: string;
  name: string;
  avatar: string;
  verified?: boolean;
  /** 简化的认证类型：personal（个人认证）或 org（机构认证） */
  verifiedType?: 'personal' | 'org';
  vipLevel?: number;
}

/**
 * 微博博文 UI 类型
 * @deprecated Phase 3 重构后，请使用 DisplayPost from '@/types/social'
 * 此类型将在 v2.0 移除
 */
export interface WeiboPostUI {
  id: string;
  user: WeiboUser;
  time: string; // Display string like "5 mins ago" or "21-12-31"
  source?: string;
  content: string;
  images: string[];
  likes: number;
  comments: number;
  shares: number; // shares
  isFollowing?: boolean;
  /** 博文类型 */
  type?: WeiboPostType;
  /** 投票数据 */
  poll?: WeiboPollConfig;
  /** 视频数据 */
  video?: WeiboVideoConfig;
}

export interface HotSearchItem {
  rank: number;
  title: string;
  tag?: 'hot' | 'new' | 'entertainment' | 'recommend' | 'boil';
  tagType?: 'text' | 'icon';
  tagText?: string;
  /** 原始热度值 */
  heat: number;
  /** 格式化后的热度显示（如 "234.5万"） */
  heatFormatted?: string;
  /** 是否置顶 */
  isTop?: boolean;
  /** 创建时间戳（用于热度计算） */
  createdAt?: number;
  /** 关联的数据库话题 ID */
  topicId?: string;
}

export interface MessageItem {
  id: string;
  type: 'mention' | 'comment' | 'like' | 'notification' | 'chat';
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  time?: string;
  badge?: number;
  avatar?: string;
}

export interface WeiboCommentUI {
  id: string;
  user: WeiboUser;
  content: string;
  time: string;
  likes: number;
  replies?: WeiboCommentUI[];
}

/**
 * Story 条目（顶部故事栏）
 */
export interface StoryItem {
  id: string;
  name: string;
  avatar: string;
  isLive?: boolean;
  hasNew?: boolean;
}

/**
 * 微博账号统计数据
 */
export interface WeiboStats {
  posts: number;
  following: number;
  followers: number;
  likes?: number;
}

/**
 * 微博认证类型
 */
export type WeiboVerifyType =
  | 'personal_celebrity'    // 名人（演员、歌手、运动员等）
  | 'personal_kol'          // KOL/网红/博主
  | 'personal_professional' // 专业人士（医生、律师、教授等）
  | 'personal_writer'       // 作家/自媒体人
  | 'personal_artist'       // 艺术家/设计师
  | 'org_enterprise'        // 企业官方
  | 'org_media'             // 媒体机构
  | 'org_government'        // 政府机关
  | 'org_school'            // 学校/教育机构
  | 'org_ngo'               // 公益组织
  | 'super_topic_host';     // 超话主持人

/**
 * 认证类型配置
 */
export interface VerifyTypeConfig {
  value: WeiboVerifyType;
  label: string;
  category: 'personal' | 'org' | 'special';
  icon: string;
  color: string;
  description: string;
}

/**
 * 所有认证类型配置
 */
export const VERIFY_TYPE_CONFIGS: VerifyTypeConfig[] = [
  // 个人认证
  {
    value: 'personal_celebrity',
    label: '名人认证',
    category: 'personal',
    icon: 'fa-star',
    color: 'text-yellow-500',
    description: '演员、歌手、运动员等公众人物',
  },
  {
    value: 'personal_kol',
    label: '博主认证',
    category: 'personal',
    icon: 'fa-fire',
    color: 'text-orange-500',
    description: 'KOL、网红、知名博主',
  },
  {
    value: 'personal_professional',
    label: '专业认证',
    category: 'personal',
    icon: 'fa-user-tie',
    color: 'text-blue-500',
    description: '医生、律师、教授等专业人士',
  },
  {
    value: 'personal_writer',
    label: '作家认证',
    category: 'personal',
    icon: 'fa-pen-fancy',
    color: 'text-purple-500',
    description: '作家、编剧、自媒体人',
  },
  {
    value: 'personal_artist',
    label: '艺术家认证',
    category: 'personal',
    icon: 'fa-palette',
    color: 'text-pink-500',
    description: '画家、设计师、摄影师等',
  },
  // 机构认证
  {
    value: 'org_enterprise',
    label: '企业认证',
    category: 'org',
    icon: 'fa-building',
    color: 'text-blue-600',
    description: '企业、品牌官方账号',
  },
  {
    value: 'org_media',
    label: '媒体认证',
    category: 'org',
    icon: 'fa-newspaper',
    color: 'text-blue-600',
    description: '新闻媒体、杂志、电视台',
  },
  {
    value: 'org_government',
    label: '政务认证',
    category: 'org',
    icon: 'fa-landmark',
    color: 'text-blue-600',
    description: '政府机关、事业单位',
  },
  {
    value: 'org_school',
    label: '校园认证',
    category: 'org',
    icon: 'fa-graduation-cap',
    color: 'text-blue-600',
    description: '学校、教育培训机构',
  },
  {
    value: 'org_ngo',
    label: '公益认证',
    category: 'org',
    icon: 'fa-hand-holding-heart',
    color: 'text-green-600',
    description: '公益组织、慈善机构',
  },
  // 特殊认证
  {
    value: 'super_topic_host',
    label: '超话主持人',
    category: 'special',
    icon: 'fa-crown',
    color: 'text-orange-500',
    description: '超级话题主持人',
  },
];

/**
 * 获取认证类型配置
 */
export function getVerifyTypeConfig(type: WeiboVerifyType): VerifyTypeConfig | undefined {
  return VERIFY_TYPE_CONFIGS.find(c => c.value === type);
}

/**
 * 微博账号配置（扩展 PlatformData）
 */
export interface WeiboPlatformData {
  followers: number;
  following: number;
  posts: number;
  verified?: boolean;
  verifyType?: WeiboVerifyType;
  verifyDescription?: string; // 认证描述，如"知名演员"、"XX公司官方账号"
  vipLevel?: number;
  location?: string;
  createdAt?: number;
}

/**
 * 博文类型
 */
export type WeiboPostType = 'text' | 'poll' | 'video';

/**
 * 投票选项
 */
export interface WeiboPollOption {
  id: string;
  text: string;
  votes: number;
}

/**
 * 投票配置
 */
export interface WeiboPollConfig {
  question: string;
  options: WeiboPollOption[];
  /** 投票持续时间（小时） */
  duration: number;
  /** 是否多选 */
  multiSelect: boolean;
  /** 结束时间戳 */
  endTime?: number;
}

/**
 * 视频配置
 */
export interface WeiboVideoConfig {
  /** 用户描述的视频内容 */
  description: string;
  /** LLM 扩展后的详细描述 */
  expandedDescription?: string;
  /** 视频时长（秒） */
  duration?: number;
  /** 封面图描述 */
  coverDescription?: string;
}

/**
 * 图片配置
 */
export interface WeiboImageConfig {
  /** 用户描述的图片内容 */
  description: string;
  /** LLM 扩展后的详细描述 */
  expandedDescription?: string;
}

/**
 * 发布博文的数据
 */
export interface ComposePostData {
  /** 博文类型 */
  type: WeiboPostType;
  /** 正文内容 */
  content: string;
  /** 话题标签 */
  topics: string[];
  /** 图片列表（描述） */
  images: WeiboImageConfig[];
  /** 投票配置 */
  poll?: WeiboPollConfig;
  /** 视频配置 */
  video?: WeiboVideoConfig;
  /** 是否使用 LLM 扩展内容 */
  useAIExpand?: boolean;
  /** 来源设备 */
  source?: string;
}

/**
 * 草稿
 */
export interface WeiboDraft {
  /** 草稿 ID */
  id: string;
  /** 博文类型 */
  type: WeiboPostType;
  /** 正文内容 */
  content: string;
  /** 话题标签 */
  topics: string[];
  /** 图片列表（描述） */
  images: WeiboImageConfig[];
  /** 投票配置 */
  poll?: WeiboPollConfig;
  /** 视频配置 */
  video?: WeiboVideoConfig;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 用户行为类型
 */
export type UserActionType = 'like' | 'favorite' | 'view';

/**
 * 用户行为记录
 */
export interface UserAction {
  /** 记录 ID */
  id: string;
  /** 用户账号 ID */
  userId: string;
  /** 平台 ID */
  platformId: string;
  /** 目标类型 */
  targetType: 'post' | 'comment';
  /** 目标 ID（博文或评论 ID） */
  targetId: string;
  /** 行为类型 */
  actionType: UserActionType;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 浏览历史记录
 */
export interface ViewHistory {
  /** 记录 ID */
  id: string;
  /** 用户账号 ID */
  userId: string;
  /** 平台 ID */
  platformId: string;
  /** 博文 ID */
  postId: string;
  /** 浏览时间 */
  viewedAt: number;
  /** 浏览时长（秒） */
  duration?: number;
}
