/**
 * LLM 任务管理类型定义
 */

import type { RequestPriority, TokenUsage } from '@/services/ai/types';

/**
 * LLM 任务状态
 */
export type LLMTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

/**
 * LLM 任务类型
 * - manual: 手动输入提示词
 * - prompt: 引用已注册的提示词（通过 promptId）
 * - chain: 引用提示词链（通过 chainId）
 */
export type LLMTaskType = 'prompt' | 'chain' | 'manual';

/**
 * LLM 配置来源
 */
export type LLMConfigSource = 'global' | 'preset' | 'custom';

/**
 * 任务执行模式
 */
export type TaskExecutionMode = 
  | 'once'       // 一次性：执行完成后变为 completed
  | 'repeatable' // 可重复：执行完成后可再次手动执行
  | 'auto'       // 自动循环：按设定间隔自动执行
;

/**
 * 自动执行配置
 */
export interface AutoExecutionConfig {
  /** 是否启用自动执行 */
  enabled: boolean;
  /** 执行间隔（分钟） */
  intervalMinutes: number;
  /** 最大执行次数（0 表示无限） */
  maxExecutions: number;
  /** 已执行次数 */
  executionCount: number;
  /** 下次执行时间 */
  nextExecutionAt?: number;
  /** 上次执行时间 */
  lastExecutionAt?: number;
}

/**
 * LLM 任务配置
 */
export interface LLMTaskConfig {
  /** 配置来源：全局、预设、自定义 */
  source: LLMConfigSource;
  /** LLM 预设 ID（source='preset' 时使用） */
  presetId?: string;
  /** 预设名称 */
  presetName?: string;
  /** 温度 */
  temperature?: number;
  /** 最大 Token */
  maxTokens?: number;
  /** Top P */
  topP?: number;
  /** 频率惩罚 */
  frequencyPenalty?: number;
  /** 存在惩罚 */
  presencePenalty?: number;
}

/**
 * LLM 任务
 */
export interface LLMTask {
  /** 任务 ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description?: string;
  /** 任务类型 */
  type: LLMTaskType;
  /** 任务状态 */
  status: LLMTaskStatus;
  /** 执行模式 */
  executionMode: TaskExecutionMode;
  /** 自动执行配置（executionMode='auto' 时使用） */
  autoConfig?: AutoExecutionConfig;
  
  // === 提示词/链配置 ===
  /** 使用的提示词 ID（type='prompt' 时使用） */
  promptId?: string;
  /** 提示词名称 */
  promptName?: string;
  /** 使用的提示词链 ID（type='chain' 时使用） */
  chainId?: string;
  /** 链名称 */
  chainName?: string;
  /** 手动输入的提示词（type='manual' 时使用） */
  manualPrompt?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  
  // === 输入输出 ===
  /** 任务输入变量 */
  input: Record<string, any>;
  /** 任务输出 */
  output?: string;
  /** 链执行结果（type='chain' 时使用） */
  chainResult?: {
    outputs: Record<string, unknown>;
    stepResults: Array<{
      stepId: string;
      status: string;
      output?: unknown;
      error?: string;
    }>;
  };
  /** 历史输出记录（可重复/自动任务） */
  outputHistory?: Array<{
    timestamp: number;
    output: string;
    usage?: TokenUsage;
    chainResult?: LLMTask['chainResult'];
  }>;
  /** 错误信息 */
  error?: string;
  
  // === LLM 配置 ===
  /** LLM 配置 */
  config: LLMTaskConfig;
  /** 请求优先级 */
  priority: RequestPriority;
  
  // === 时间戳 ===
  /** 创建时间 */
  createdAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 耗时（毫秒） */
  duration?: number;
  
  // === 统计 ===
  /** Token 使用量 */
  usage?: TokenUsage;
  /** 总执行次数 */
  totalExecutions: number;
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  
  // === 来源 ===
  /** 来源应用 */
  sourceApp?: string;
  /** 来源场景 */
  sourceScene?: string;
  /** 是否来自模板 */
  fromTemplate?: string;
  /** 是否为内置任务 */
  isBuiltin?: boolean;
  /** 内置任务 ID（用于识别） */
  builtinId?: string;
}

/**
 * 创建任务的输入
 */
export interface CreateTaskInput {
  name: string;
  description?: string;
  type: LLMTaskType;
  executionMode?: TaskExecutionMode;
  autoConfig?: Partial<AutoExecutionConfig>;
  promptId?: string;
  chainId?: string;
  manualPrompt?: string;
  systemPrompt?: string;
  input?: Record<string, any>;
  config?: Partial<LLMTaskConfig>;
  priority?: RequestPriority;
  maxRetries?: number;
  sourceApp?: string;
  sourceScene?: string;
  fromTemplate?: string;
  isBuiltin?: boolean;
  builtinId?: string;
}

/**
 * 任务过滤器
 */
export interface TaskFilter {
  status?: LLMTaskStatus[];
  type?: LLMTaskType[];
  executionMode?: TaskExecutionMode[];
  sourceApp?: string;
  isBuiltin?: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
}

/**
 * 任务统计
 */
export interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  paused: number;
  cancelled: number;
  totalTokens: number;
  avgDuration: number;
  builtinCount: number;
  autoRunningCount: number;
}

/**
 * 任务执行日志
 */
export interface TaskLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

/**
 * 内置任务模板
 */
export interface TaskTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 模板图标 */
  icon: string;
  /** 模板分类 */
  category: 'content' | 'comment' | 'user' | 'trending' | 'analysis' | 'other';
  /** 任务类型 */
  type: LLMTaskType;
  /** 执行模式 */
  executionMode: TaskExecutionMode;
  /** 自动执行默认配置 */
  defaultAutoConfig?: Partial<AutoExecutionConfig>;
  /** 提示词内容（type='manual' 时使用） */
  prompt?: string;
  /** 提示词 ID（type='prompt' 时使用） */
  promptId?: string;
  /** 链 ID（type='chain' 时使用） */
  chainId?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 默认输入变量 */
  defaultInput?: Record<string, any>;
  /** 输入变量定义 */
  inputSchema?: Array<{
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required?: boolean;
    defaultValue?: any;
    options?: Array<{ value: any; label: string }>;
    placeholder?: string;
  }>;
  /** 推荐配置 */
  recommendedConfig?: Partial<LLMTaskConfig>;
  /** 推荐优先级 */
  recommendedPriority?: RequestPriority;
  /** 是否默认启用（创建后自动添加到任务列表） */
  enabledByDefault?: boolean;
  /** 输出处理器 */
  outputHandler?: 'json' | 'text' | 'weibo-post' | 'hot-list' | 'comments' | 'chain-result' | 'batch-posts' | 'engagement' | 'composite';
}

/**
 * 内置任务定义（预创建的任务）
 */
export interface BuiltinTaskDefinition {
  /** 内置 ID */
  builtinId: string;
  /** 任务名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 分类 */
  category: 'content' | 'trending' | 'user' | 'system';
  /** 执行模式 */
  executionMode: TaskExecutionMode;
  /** 自动执行配置 */
  autoConfig?: Partial<AutoExecutionConfig>;
  /** 任务类型 */
  type: LLMTaskType;
  
  // === 提示词配置（三选一） ===
  /** 提示词 ID（type='prompt' 时使用，引用 PromptService 注册的提示词） */
  promptId?: string;
  /** 链 ID（type='chain' 时使用，引用 PromptChainService 注册的链） */
  chainId?: string;
  /** 手动提示词（type='manual' 时使用） */
  prompt?: string;
  
  /** 系统提示词（仅 type='manual' 时有效） */
  systemPrompt?: string;
  /** 默认输入 */
  defaultInput: Record<string, any>;
  /** 输入 Schema */
  inputSchema: Array<{
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required?: boolean;
    defaultValue?: any;
    options?: Array<{ value: any; label: string }>;
    placeholder?: string;
  }>;
  /** LLM 配置 */
  config: Partial<LLMTaskConfig>;
  /** 优先级 */
  priority: RequestPriority;
  /** 输出处理方式 */
  outputHandler: 'json' | 'text' | 'weibo-post' | 'hot-list' | 'comments' | 'chain-result' | 'batch-posts' | 'engagement' | 'composite';
}

/**
 * 全局 LLM 配置设置
 */
export interface GlobalLLMSettings {
  /** 是否使用全局配置作为默认 */
  useGlobalAsDefault: boolean;
  /** 默认预设 ID（当 useGlobalAsDefault=false 时使用） */
  defaultPresetId?: string;
  /** 任务默认配置覆盖 */
  defaultOverrides?: Partial<LLMTaskConfig>;
}
