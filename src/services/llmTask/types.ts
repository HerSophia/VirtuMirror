/**
 * LLM 任务服务类型定义
 * 
 * 将微博 App 内嵌的 LLM 任务系统抽象为系统级服务的类型定义
 * @see docs/systems/llm-task-service.md
 */

import type { RequestPriority, TokenUsage } from '@/services/ai/types';
import type { ChainExecutionResult } from '@/types/promptChain';

// ==================== 基础枚举 ====================

/** 任务状态 */
export type LLMTaskStatus =
  | 'pending'    // 待执行
  | 'running'    // 执行中
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'paused'     // 已暂停
  | 'cancelled'; // 已取消

/** 任务类型 */
export type LLMTaskType =
  | 'manual'  // 手动提示词
  | 'prompt'  // 注册提示词
  | 'chain';  // 提示词链

/** LLM 配置来源 */
export type LLMConfigSource =
  | 'global'  // 使用全局配置
  | 'preset'  // 使用预设
  | 'custom'; // 自定义配置

/** 任务执行模式 */
export type TaskExecutionMode =
  | 'once'       // 一次性执行
  | 'repeatable' // 可重复执行
  | 'auto';      // 自动循环执行

// ==================== 配置类型 ====================

/** 自动执行配置 */
export interface AutoExecutionConfig {
  /** 是否启用自动执行 */
  enabled: boolean;
  /** 执行间隔（分钟） */
  intervalMinutes: number;
  /** 最大执行次数，0 表示无限 */
  maxExecutions: number;
  /** 已执行次数 */
  executionCount: number;
  /** 下次执行时间戳 */
  nextExecutionAt?: number;
  /** 上次执行时间戳 */
  lastExecutionAt?: number;
}

/** LLM 任务配置 */
export interface LLMTaskConfig {
  /** 配置来源 */
  source: LLMConfigSource;
  /** 预设 ID（source='preset' 时使用） */
  presetId?: string;
  /** 预设名称（用于显示） */
  presetName?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** Top P 参数 */
  topP?: number;
  /** 频率惩罚 */
  frequencyPenalty?: number;
  /** 存在惩罚 */
  presencePenalty?: number;
}

// ==================== 输入定义 ====================

/** 输入字段类型 */
export type InputFieldType = 'string' | 'number' | 'boolean' | 'select' | 'textarea';

/** 输入字段定义 */
export interface InputFieldDefinition {
  /** 字段名（用于变量替换） */
  name: string;
  /** 显示标签 */
  label: string;
  /** 字段类型 */
  type: InputFieldType;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  defaultValue?: unknown;
  /** 下拉选项（type='select' 时使用） */
  options?: Array<{ value: unknown; label: string }>;
  /** 占位符 */
  placeholder?: string;
  /** 帮助文本 */
  helpText?: string;
}

// ==================== 任务模板（用于创建自定义任务） ====================

/**
 * LLM 任务模板
 * 提供预设的任务配置，用户可基于模板创建自定义任务
 */
export interface LLMTaskTemplate {
  /** 模板 ID（格式：appId:templateId） */
  id: string;

  /** 归属 App ID */
  appId: string;

  /** 模板名称 */
  name: string;

  /** 模板描述 */
  description: string;

  /** 图标（emoji 或图标名） */
  icon?: string;

  /** 模板分类 */
  category: 'content' | 'comment' | 'user' | 'trending' | 'analysis' | 'other';

  /** 任务类型 */
  type: LLMTaskType;

  /** 执行模式 */
  executionMode: TaskExecutionMode;

  /** 自动执行默认配置 */
  defaultAutoConfig?: Partial<AutoExecutionConfig>;

  // === 提示词配置（三选一） ===

  /** 提示词 ID（type='prompt'） */
  promptId?: string;

  /** 提示词链 ID（type='chain'） */
  chainId?: string;

  /** 手动提示词模板（type='manual'） */
  promptTemplate?: string;

  /** 系统提示词 */
  systemPrompt?: string;

  // === 输入配置 ===

  /** 输入字段定义 */
  inputSchema?: InputFieldDefinition[];

  /** 默认输入值 */
  defaultInput?: Record<string, unknown>;

  // === 推荐配置 ===

  /** 推荐的 LLM 配置 */
  recommendedConfig?: Partial<LLMTaskConfig>;

  /** 推荐优先级 */
  recommendedPriority?: RequestPriority;

  /** 输出处理器 ID */
  outputHandlerId?: string;

  /** 标签（用于搜索） */
  tags?: string[];
}

// ==================== 任务定义（由 App 注册） ====================

/**
 * LLM 任务定义
 * 由各 App 注册，描述任务的元数据和配置
 */
export interface LLMTaskDefinition {
  /**
   * 唯一标识
   * 格式建议：appId:taskId，如 "weibo:generate-post"
   */
  id: string;

  /** 归属 App ID */
  appId: string;

  /** 任务名称（用于 UI 显示） */
  name: string;

  /** 任务描述 */
  description?: string;

  /** 图标（emoji 或图标名） */
  icon?: string;

  /** 分类（用于 UI 分组） */
  category?: string;

  // === 执行配置 ===

  /** 任务类型 */
  type: LLMTaskType;

  /** 执行模式 */
  executionMode: TaskExecutionMode;

  /** 自动执行默认配置 */
  autoConfig?: Partial<AutoExecutionConfig>;

  // === 提示词配置（三选一） ===

  /** 提示词 ID（type='prompt'） */
  promptId?: string;

  /** 提示词链 ID（type='chain'） */
  chainId?: string;

  /** 手动提示词模板（type='manual'） */
  promptTemplate?: string;

  /** 系统提示词 */
  systemPrompt?: string;

  // === 输入配置 ===

  /** 输入字段定义 */
  inputSchema: InputFieldDefinition[];

  /** 默认输入值 */
  defaultInput: Record<string, unknown>;

  // === LLM 配置 ===

  /** 推荐的 LLM 配置 */
  config?: Partial<LLMTaskConfig>;

  /** 请求优先级 */
  priority?: RequestPriority;

  // === 扩展点 ===

  /**
   * 输出处理器 ID
   * 格式：appId:handlerId，如 "weibo:post-handler"
   */
  outputHandlerId: string;

  /**
   * 所需的上下文提供器 ID 列表
   * 格式：appId:providerId，如 ["weibo:narrative", "weibo:existing-content"]
   */
  contextProviders?: string[];

  // === 元数据 ===

  /** 是否在任务列表中默认显示 */
  showByDefault?: boolean;

  /** 标签（用于搜索和过滤） */
  tags?: string[];
}

// ==================== 任务实例（运行时状态） ====================

/** 输出历史记录 */
export interface OutputHistoryEntry {
  /** 时间戳 */
  timestamp: number;
  /** 输出内容 */
  output: string;
  /** Token 使用量 */
  usage?: TokenUsage;
  /** 链执行结果（简化版） */
  chainResult?: {
    outputs: Record<string, unknown>;
    stepResults: Array<{
      stepId: string;
      status: string;
      output?: unknown;
      error?: string;
    }>;
  };
}

/**
 * LLM 任务实例
 * 基于任务定义创建的运行时实例，包含状态和执行结果
 */
export interface LLMTask {
  /** 任务实例 ID（UUID） */
  id: string;

  /** 关联的任务定义 ID */
  definitionId: string;

  /** 归属 App ID（冗余存储，便于查询） */
  appId: string;

  /** 任务名称（可自定义，默认取自定义） */
  name: string;

  /** 任务描述 */
  description?: string;

  /** 任务状态 */
  status: LLMTaskStatus;

  /** 执行模式（可运行时修改） */
  executionMode: TaskExecutionMode;

  /** 自动执行配置 */
  autoConfig?: AutoExecutionConfig;

  // === 运行时配置 ===

  /** 任务类型（继承自定义） */
  type: LLMTaskType;

  /** 当前输入值 */
  input: Record<string, unknown>;

  /** LLM 配置 */
  config: LLMTaskConfig;

  /** 请求优先级 */
  priority: RequestPriority;

  // === 提示词（运行时解析） ===

  /** 解析后的用户提示词 */
  resolvedPrompt?: string;

  /** 系统提示词 */
  systemPrompt?: string;

  // === 执行结果 ===

  /** 最新输出 */
  output?: string;

  /** 链执行结果 */
  chainResult?: {
    outputs: Record<string, unknown>;
    stepResults: Array<{
      stepId: string;
      status: string;
      output?: unknown;
      error?: string;
    }>;
  };

  /** 历史输出（可重复/自动任务） */
  outputHistory?: OutputHistoryEntry[];

  /** 错误信息 */
  error?: string;

  /** Token 使用量 */
  usage?: TokenUsage;

  // === 时间戳 ===

  /** 创建时间 */
  createdAt: number;
  /** 开始执行时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 执行耗时（毫秒） */
  duration?: number;

  // === 统计 ===

  /** 总执行次数 */
  totalExecutions: number;
  /** 当前重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
}

// ==================== 上下文提供器 ====================

/**
 * 上下文提供器：为任务执行提供动态变量
 *
 * 使用场景：
 * - 注入叙事内容（来自酒馆的聊天记录）
 * - 注入现有内容（避免重复生成）
 * - 注入时间上下文（当前时间、时段等）
 * - 注入用户上下文（当前用户信息）
 */
export interface ContextProvider {
  /**
   * 提供器 ID
   * 格式：appId:providerId，如 "weibo:narrative"
   */
  id: string;

  /** 归属 App */
  appId: string;

  /** 提供器名称（用于日志） */
  name: string;

  /** 描述 */
  description?: string;

  /**
   * 变量名前缀（可选）
   * 用于命名空间隔离，如 prefix="narrative" 则变量为 narrativeContent
   */
  variablePrefix?: string;

  /**
   * 获取上下文变量
   * 返回的 key-value 将用于变量替换
   */
  getContext(): Promise<Record<string, string>>;

  /**
   * 获取元数据（用于日志和调试）
   */
  getMetadata?(): Record<string, unknown>;

  /**
   * 优先级（决定执行顺序）
   * 数值越小优先级越高，默认 100
   */
  priority?: number;
}

// ==================== 输出处理器 ====================

/** 输出处理结果 */
export interface OutputHandlerResult {
  /** 是否处理成功 */
  success: boolean;

  /** 处理后的结构化数据 */
  data?: unknown;

  /** 创建的记录数 */
  recordsCreated?: number;

  /** 更新的记录数 */
  recordsUpdated?: number;

  /** 处理日志 */
  logs?: string[];

  /** 错误信息 */
  error?: string;

  /** 警告信息 */
  warnings?: string[];
}

/** 预览结果 */
export interface PreviewResult {
  /** 预览数据 */
  data: unknown;
  /** 预览说明 */
  summary: string;
}

/** 任务执行上下文 */
export interface TaskExecutionContext {
  /** 任务 ID */
  taskId: string;

  /** App ID */
  appId: string;

  /** 当前变量值 */
  variables: Record<string, unknown>;

  /** 添加日志 */
  addLog: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void;

  /** 获取其他服务（依赖注入） */
  getService: <T>(serviceId: string) => T | undefined;
}

/**
 * 输出处理器：处理 LLM 生成的结果
 *
 * 使用场景：
 * - 解析 JSON 并保存到数据库
 * - 转换格式（如 LLM 输出 → UniversalPost）
 * - 触发后续操作（如生成通知）
 */
export interface OutputHandler {
  /**
   * 处理器 ID
   * 格式：appId:handlerId，如 "weibo:post-handler"
   */
  id: string;

  /** 归属 App */
  appId: string;

  /** 处理器名称 */
  name: string;

  /** 描述 */
  description?: string;

  /**
   * 处理 LLM 输出
   * @param output LLM 生成的原始文本
   * @param task 任务实例
   * @param context 执行上下文
   * @returns 处理结果
   */
  handle(
    output: string,
    task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult>;

  /**
   * 是否支持预览（用于 UI）
   */
  supportsPreview?: boolean;

  /**
   * 预览处理结果（不实际保存）
   */
  preview?(
    output: string,
    task: LLMTask
  ): Promise<PreviewResult>;
}

// ==================== 服务接口 ====================

/** 创建任务的输入参数 */
export interface CreateTaskInput {
  /** 任务名称（可选，默认使用定义的名称） */
  name?: string;
  /** 任务描述 */
  description?: string;
  /** 输入值覆盖 */
  input?: Record<string, unknown>;
  /** 配置覆盖 */
  config?: Partial<LLMTaskConfig>;
  /** 执行模式覆盖 */
  executionMode?: TaskExecutionMode;
  /** 自动执行配置覆盖 */
  autoConfig?: Partial<AutoExecutionConfig>;
}

/** 执行结果 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 输出文本 */
  output?: string;
  /** Token 使用量 */
  usage?: TokenUsage;
  /** 链执行结果 */
  chainResult?: ChainExecutionResult;
  /** 处理器结果 */
  handlerResult?: OutputHandlerResult;
  /** 错误信息 */
  error?: string;
  /** 执行耗时（毫秒） */
  duration: number;
}

/** 任务统计 */
export interface TaskStats {
  /** 任务总数 */
  total: number;
  /** 待执行数 */
  pending: number;
  /** 执行中数 */
  running: number;
  /** 已完成数 */
  completed: number;
  /** 失败数 */
  failed: number;
  /** 已暂停数 */
  paused: number;
  /** 已取消数 */
  cancelled: number;
  /** 总 Token 使用量 */
  totalTokens: number;
  /** 平均执行时长（毫秒） */
  avgDuration: number;
  /** 自动执行中的任务数 */
  autoRunningCount: number;
  /** 按 App 分组的任务数 */
  byApp: Record<string, number>;
}

/** 任务日志 */
export interface TaskLog {
  /** 时间戳 */
  timestamp: number;
  /** 日志级别 */
  level: 'info' | 'warn' | 'error';
  /** 日志消息 */
  message: string;
  /** 附加数据 */
  data?: unknown;
}

/** 任务事件类型 */
export type TaskEvent =
  | 'task-created'
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'task-cancelled'
  | 'task-paused'
  | 'task-resumed'
  | 'auto-execution-started'
  | 'auto-execution-stopped'
  | 'definition-registered'
  | 'definition-unregistered';

/** 任务事件处理器 */
export type TaskEventHandler = (task: LLMTask, data?: unknown) => void;

/** 任务过滤器 */
export interface TaskFilter {
  /** 按状态过滤 */
  status?: LLMTaskStatus[];
  /** 按类型过滤 */
  type?: LLMTaskType[];
  /** 按执行模式过滤 */
  executionMode?: TaskExecutionMode[];
  /** 按 App 过滤 */
  appId?: string;
  /** 按标签过滤 */
  tags?: string[];
  /** 日期范围 */
  dateRange?: {
    start: number;
    end: number;
  };
}

// ==================== 服务接口定义 ====================

/**
 * LLM 任务服务接口
 * 提供任务定义注册、任务实例管理、任务执行等功能
 */
export interface ILLMTaskService {
  // ==================== 初始化 ====================

  /** 初始化服务 */
  initialize(): Promise<void>;

  /** 是否已初始化 */
  readonly initialized: boolean;

  // ==================== 任务定义注册 ====================

  /** 注册单个任务定义 */
  registerTaskDefinition(definition: LLMTaskDefinition): void;

  /** 批量注册任务定义 */
  registerTaskDefinitions(definitions: LLMTaskDefinition[]): void;

  /** 注销任务定义 */
  unregisterTaskDefinition(id: string): boolean;

  /** 获取任务定义 */
  getTaskDefinition(id: string): LLMTaskDefinition | undefined;

  /** 获取所有任务定义 */
  getAllTaskDefinitions(): LLMTaskDefinition[];

  /** 获取指定 App 的任务定义 */
  getTaskDefinitionsByApp(appId: string): LLMTaskDefinition[];

  // ==================== 任务模板注册 ====================

  /** 注册单个任务模板 */
  registerTaskTemplate(template: LLMTaskTemplate): void;

  /** 批量注册任务模板 */
  registerTaskTemplates(templates: LLMTaskTemplate[]): void;

  /** 注销任务模板 */
  unregisterTaskTemplate(id: string): boolean;

  /** 获取任务模板 */
  getTaskTemplate(id: string): LLMTaskTemplate | undefined;

  /** 获取所有任务模板 */
  getAllTaskTemplates(): LLMTaskTemplate[];

  /** 获取指定 App 的任务模板 */
  getTaskTemplatesByApp(appId: string): LLMTaskTemplate[];

  /** 按分类获取任务模板 */
  getTaskTemplatesByCategory(category: LLMTaskTemplate['category']): LLMTaskTemplate[];

  // ==================== 扩展点注册 ====================

  /** 注册上下文提供器 */
  registerContextProvider(provider: ContextProvider): void;

  /** 注销上下文提供器 */
  unregisterContextProvider(id: string): boolean;

  /** 获取上下文提供器 */
  getContextProvider(id: string): ContextProvider | undefined;

  /** 获取所有上下文提供器 */
  getAllContextProviders(): ContextProvider[];

  /** 注册输出处理器 */
  registerOutputHandler(handler: OutputHandler): void;

  /** 注销输出处理器 */
  unregisterOutputHandler(id: string): boolean;

  /** 获取输出处理器 */
  getOutputHandler(id: string): OutputHandler | undefined;

  /** 获取所有输出处理器 */
  getAllOutputHandlers(): OutputHandler[];

  // ==================== 任务实例管理 ====================

  /** 从定义创建任务实例 */
  createTask(
    definitionId: string,
    overrides?: Partial<CreateTaskInput>
  ): LLMTask;

  /** 更新任务 */
  updateTask(taskId: string, updates: Partial<LLMTask>): boolean;

  /** 删除任务 */
  deleteTask(taskId: string): boolean;

  /** 复制任务 */
  duplicateTask(taskId: string): LLMTask | null;

  /** 获取任务 */
  getTask(taskId: string): LLMTask | undefined;

  /** 获取所有任务 */
  getAllTasks(): LLMTask[];

  /** 获取指定 App 的任务 */
  getTasksByApp(appId: string): LLMTask[];

  /** 按条件过滤任务 */
  filterTasks(filter: TaskFilter): LLMTask[];

  // ==================== 任务执行 ====================

  /** 执行任务 */
  executeTask(taskId: string): Promise<ExecutionResult>;

  /** 暂停任务 */
  pauseTask(taskId: string): boolean;

  /** 恢复任务 */
  resumeTask(taskId: string): Promise<boolean>;

  /** 取消任务 */
  cancelTask(taskId: string): boolean;

  /** 重试任务 */
  retryTask(taskId: string): Promise<boolean>;

  /** 取消所有运行中的任务 */
  cancelAllRunning(): number;

  // ==================== 自动执行 ====================

  /** 启动自动执行 */
  startAutoExecution(taskId: string): boolean;

  /** 停止自动执行 */
  stopAutoExecution(taskId: string): boolean;

  /** 更新自动执行配置 */
  updateAutoConfig(
    taskId: string,
    config: Partial<AutoExecutionConfig>
  ): boolean;

  // ==================== 查询 ====================

  /** 获取运行中的任务 */
  getRunningTasks(): LLMTask[];

  /** 获取待执行的任务 */
  getPendingTasks(): LLMTask[];

  /** 获取任务统计 */
  getStats(): TaskStats;

  /** 获取任务日志 */
  getTaskLogs(taskId: string): TaskLog[];

  /** 清空任务日志 */
  clearTaskLogs(taskId: string): void;

  // ==================== 事件 ====================

  /** 监听任务事件 */
  on(event: TaskEvent, handler: TaskEventHandler): void;

  /** 取消监听 */
  off(event: TaskEvent, handler: TaskEventHandler): void;

  /** 触发事件（内部使用） */
  emit(event: TaskEvent, task: LLMTask, data?: unknown): void;
}

// ==================== 数据库记录类型 ====================

/** 任务持久化记录 */
export interface LLMTaskRecord {
  /** 任务实例 ID */
  id: string;
  /** 关联的任务定义 ID */
  definitionId: string;
  /** 归属 App ID */
  appId: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description?: string;
  /** 任务状态 */
  status: LLMTaskStatus;
  /** 执行模式 */
  executionMode: TaskExecutionMode;
  /** 任务类型 */
  type: LLMTaskType;
  /** 输入值 */
  input: Record<string, unknown>;
  /** LLM 配置 */
  config: LLMTaskConfig;
  /** 优先级 */
  priority: RequestPriority;
  /** 自动执行配置 */
  autoConfig?: AutoExecutionConfig;
  /** 最新输出 */
  output?: string;
  /** 输出历史 */
  outputHistory?: OutputHistoryEntry[];
  /** 总执行次数 */
  totalExecutions: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}
