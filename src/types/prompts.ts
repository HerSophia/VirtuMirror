import type { NotificationIcon } from './notification'
import type { ContextType } from '@/services/contextSharing/types'

/**
 * 提示词管理系统类型定义
 * @description 定义提示词模板、变量、配置等核心类型
 */

/**
 * 变量来源类型
 */
export type VariableSourceType =
  | 'input'           // 用户输入
  | 'global'          // 全局变量
  | 'context'         // ContextProvider
  | 'shared-context'; // Context Sharing Service

/**
 * 共享上下文变量配置
 * 当变量 source 为 'shared-context' 时使用
 */
export interface SharedContextVariableConfig {
  /** 上下文类型 */
  contextType?: ContextType;
  /** 上下文 ID */
  contextId?: string;
  /** 格式化方式 */
  format?: 'raw' | 'text' | 'xml';
}

/**
 * 提示词分类（按 App/场景）
 */
export type PromptCategory =
  | 'chat'       // 聊天 App - 消息生成
  | 'email'      // 邮件 - 邮件内容生成
  | 'browser'    // 浏览器 - 网页内容生成
  | 'live'       // 直播 - 弹幕/评论生成
  | 'social'     // 社交媒体 - 帖子/评论/热搜生成
  | 'system';    // 系统级提示词

/**
 * 系统提示词作用域
 */
export type SystemPromptScope = 'global' | 'app';

/**
 * 系统提示词继承模式
 */
export type SystemPromptMode = 'append' | 'override';

/**
 * 提示词来源类型
 */
export type PromptSource =
  | { type: 'builtin' }                    // 系统内置
  | { type: 'app'; appId: string }         // 来自安装的 App
  | { type: 'user' };                      // 用户自定义

/**
 * 提示词变量定义
 */
export interface PromptVariable {
  /** 变量名（如 {{characterName}}） */
  name: string;
  
  /** 变量描述 */
  description: string;
  
  /** 变量类型 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  
  /** 是否必填 */
  required: boolean;
  
  /** 默认值 */
  defaultValue?: unknown;
  
  /** 示例值 */
  example?: unknown;

  /**
   * 变量来源
   * @default 'input'
   */
  source?: VariableSourceType;

  /**
   * 共享上下文配置（source='shared-context' 时使用）
   */
  sharedContextConfig?: SharedContextVariableConfig;
}

/**
 * 单个提示词定义
 */
export interface PromptTemplate {
  /** 唯一标识符 */
  id: string;
  
  /** 提示词名称（用于显示） */
  name: string;
  
  /** 提示词描述 */
  description?: string;
  
  /** 所属分类 */
  category: PromptCategory;
  
  /** 场景标识（如 chat.reply, chat.new_conversation） */
  scene: string;

  /** 提示词图标（可选，支持 fontawesome/emoji/image/url） */
  icon?: NotificationIcon;
  
  /** 提示词模板内容（支持变量占位符） */
  template: string;
  
  /** 系统提示词（可选，用于设置 AI 角色） */
  systemPrompt?: string;
  
  /** 可用变量列表 */
  availableVariables: PromptVariable[];
  
  /** 提示词来源 */
  source: PromptSource;
  
  /** 是否为内置提示词（内置提示词不可删除）@deprecated 使用 source.type === 'builtin' 代替 */
  isBuiltin: boolean;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 优先级（同场景多个提示词时的选择顺序） */
  priority: number;
  
  /** 版本号 */
  version: string;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 更新时间 */
  updatedAt: string;
  
  // ========== 系统提示词专用字段 ==========
  
  /** 是否为系统提示词（系统提示词会自动注入到所有 LLM 调用中） */
  isSystemPrompt?: boolean;
  
  /** 系统提示词作用域：global-全局, app-特定应用 */
  systemPromptScope?: SystemPromptScope;
  
  /** 系统提示词继承模式：append-追加到上层, override-覆盖上层（仅 app 作用域有效） */
  systemPromptMode?: SystemPromptMode;
  
  /** 适用场景列表（为空则适用所有场景，支持通配符如 'social.*'） */
  applicableScenes?: string[];
  
  /** 排除场景列表（优先级高于 applicableScenes） */
  excludeScenes?: string[];
}

/**
 * 提示词管理系统配置
 */
export interface PromptSystemConfig {
  /** 所有提示词模板 */
  templates: PromptTemplate[];
  
  /** 全局变量（可在所有提示词中使用） */
  globalVariables: Record<string, unknown>;
  
  /** 元数据 */
  _meta: {
    version: string;
    lastUpdated: string;
  };
}

/**
 * App 提示词定义（不含 id 和 source，由系统自动生成）
 * 用于 App 插件声明自己的内置提示词
 */
export interface AppPromptDefinition {
  /** 场景标识（如 myapp.generate, myapp.reply） */
  scene: string;
  /** 提示词名称 */
  name: string;
  /** 提示词描述 */
  description?: string;
  /** 提示词图标 */
  icon?: NotificationIcon;
  /** 所属分类 */
  category: PromptCategory;
  /** 提示词模板 */
  template: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 可用变量 */
  availableVariables: PromptVariable[];
  /** 优先级 */
  priority?: number;
}

/**
 * 提示词渲染结果
 */
export interface RenderedPrompt {
  /** 系统提示词（如有） */
  systemPrompt?: string;
  /** 用户提示词 */
  userPrompt: string;
}

/**
 * 提示词编辑权限
 */
export interface PromptEditPermission {
  /** 是否可编辑 */
  canEdit: boolean;
  /** 可编辑的字段列表，'*' 表示所有字段 */
  editableFields: string[];
  /** 是否可删除 */
  canDelete: boolean;
}

/**
 * 分类信息
 */
export interface PromptCategoryInfo {
  id: PromptCategory | 'all';
  name: string;
  icon?: string;
  description?: string;
}

/**
 * 预定义的分类列表
 */
export const PROMPT_CATEGORIES: PromptCategoryInfo[] = [
  { id: 'all', name: '全部', icon: 'fas fa-th-large' },
  { id: 'chat', name: '聊天', icon: 'fas fa-comments', description: '聊天消息生成相关提示词' },
  { id: 'email', name: '邮件', icon: 'fas fa-envelope', description: '邮件内容生成相关提示词' },
  { id: 'browser', name: '浏览器', icon: 'fas fa-globe', description: '网页内容生成相关提示词' },
  { id: 'live', name: '直播', icon: 'fas fa-video', description: '直播弹幕/评论生成相关提示词' },
  { id: 'social', name: '社交', icon: 'fas fa-hashtag', description: '社交媒体相关提示词' },
  { id: 'system', name: '系统', icon: 'fas fa-cog', description: '系统级提示词' },
];

/**
 * 提示词存储键名
 */
export const PROMPT_STORAGE_KEY = '小手机_prompts';