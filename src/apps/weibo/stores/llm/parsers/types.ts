/**
 * 解析器类型定义
 * 
 * Phase 5: 总部-分部解析器架构
 * @see docs/systems/social-content-types.md Section 11
 */

import type { UniversalPost, UniversalComment, PrimaryContentType } from '@/types/social';

// ==================== 解析器接口 ====================

/**
 * 解析器接口 - 每个分部都需要实现
 */
export interface ContentParser<TInput = any, TOutput = any> {
  /** 解析器唯一标识 */
  readonly key: string;
  
  /** 支持的输入 key（如 'posts', 'post', 'weibos'） */
  readonly aliases: string[];
  
  /** 依赖的其他解析器（用于确定执行顺序） */
  readonly dependencies?: string[];
  
  /** 描述信息 */
  readonly description?: string;
  
  /** 验证输入数据 */
  validate(input: TInput): ValidationResult;
  
  /** 转换为标准格式 */
  transform(input: TInput, context: ParseContext): Promise<TOutput[]>;
  
  /** 持久化到数据库 */
  persist(items: TOutput[], context: ParseContext): Promise<PersistResult>;
}

// ==================== 解析上下文 ====================

/**
 * 解析上下文 - 在解析器之间共享
 */
export interface ParseContext {
  /** 任务 ID */
  taskId: string;
  
  /** 平台 ID */
  platformId: string;
  
  /** 数据命名空间（用于数据隔离） */
  namespace?: string;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 已解析的数据（用于依赖解析和 tempId 映射） */
  resolved: ResolvedData;
  
  /** 日志函数 */
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
}

/**
 * 已解析的数据映射
 */
export interface ResolvedData {
  /** 博文 tempId → realId 映射 */
  posts: Map<string, string>;
  
  /** 用户 nickname → accountId 映射 */
  users: Map<string, string>;
  
  /** 热搜 keyword → id 映射 */
  hotSearches: Map<string, string>;
  
  /** 评论 tempId → realId 映射 */
  comments: Map<string, string>;
}

// ==================== 验证结果 ====================

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  
  /** 错误信息列表 */
  errors: string[];
  
  /** 警告信息列表 */
  warnings?: string[];
}

// ==================== 持久化结果 ====================

/**
 * 持久化结果
 */
export interface PersistResult {
  /** 保存成功的 ID 列表 */
  ids: string[];
  
  /** 成功数量 */
  count: number;
  
  /** 失败数量 */
  failedCount?: number;
  
  /** 错误信息 */
  errors?: string[];
}

// ==================== 解析结果 ====================

/**
 * 解析错误
 */
export interface ParseError {
  /** 解析器 key */
  parser: string;
  
  /** 错误信息 */
  messages: string[];
  
  /** 原始输入（用于调试） */
  rawInput?: any;
}

/**
 * 完整解析结果
 */
export interface ParseResult {
  /** 是否成功 */
  success: boolean;
  
  /** 各类型的保存结果 */
  data: {
    posts?: string[];
    comments?: string[];
    hotSearches?: string[];
    reposts?: string[];
    users?: string[];
  };
  
  /** 错误列表 */
  errors: ParseError[];
  
  /** 统计信息 */
  stats: Record<string, number>;
}

// ==================== 解析任务 ====================

/**
 * 待处理的解析任务
 */
export interface ParseTask {
  /** 解析器 key */
  parserKey: string;
  
  /** 输入数据 */
  data: any;
  
  /** 原始字段名 */
  fieldName: string;
}

// ==================== 热搜相关类型 ====================

/**
 * 热搜输入格式
 */
export interface HotSearchInput {
  keyword: string;
  heat?: number;
  summary?: string;
  category?: string;
  isNew?: boolean;
  isHot?: boolean;
  isExplosive?: boolean;
}

/**
 * 热搜输出格式
 */
export interface HotSearchOutput {
  id: string;
  keyword: string;
  heat: number;
  summary: string;
  category: string;
  createdAt: number;
  platformId: string;
  isNew: boolean;
  isHot: boolean;
  isExplosive: boolean;
}

// ==================== 博文相关类型 ====================

/**
 * 博文输入格式（兼容新旧格式）
 */
export interface PostInput {
  tempId?: string;
  primaryType?: PrimaryContentType;
  type?: string;  // 旧格式
  payload?: {
    text?: string;
    poll?: any;
    video?: any;
  };
  text?: string;  // 旧格式
  media?: any[];
  images?: any[];  // 旧格式
  authorName?: string;
  authorType?: string;  // 旧格式
  poll?: any;  // 旧格式
  video?: any;  // 旧格式
}

// ==================== 评论相关类型 ====================

/**
 * 评论输入格式
 */
export interface CommentInput {
  postId?: string;  // 可以是 tempId
  content: string;
  nickname?: string;
  likes?: number;
  isHot?: boolean;
}

/**
 * 评论输出格式
 */
export interface CommentOutput extends UniversalComment {
  // 继承 UniversalComment
}

// ==================== 转发相关类型 ====================

/**
 * 转发输入格式
 */
export interface RepostInput {
  originalPostId: string;  // 可以是 tempId
  payload: {
    text: string;
  };
  authorName?: string;
}
