/**
 * 提示词链类型定义
 * @description 用于多步骤 LLM 编排的数据结构
 */

import type { PromptVariable } from './prompts';

/**
 * 提示词链执行模式
 */
export type ChainExecutionMode = 'multi-step' | 'single-shot';

/**
 * 链步骤类型
 */
export type ChainStepType = 'prompt' | 'transform' | 'condition' | 'loop';

/**
 * 变量定义（用于链输入）
 */
export interface ChainVariableDefinition extends PromptVariable {
  /** 变量来源（可选，用于自动填充） */
  source?: 'input' | 'context' | 'previous_step';
  /** 来源路径（如 step1.result.title） */
  sourcePath?: string;
}

/**
 * 步骤后处理配置
 */
export interface StepPostProcess {
  /** 解析格式 */
  parseAs: 'json' | 'text' | 'lines' | 'regex';
  /** 提取路径（JSONPath 或正则表达式） */
  extract?: string;
  /** 提取失败时的默认值 */
  defaultValue?: unknown;
}

/**
 * 循环配置
 */
export interface LoopConfig {
  /** 循环类型 */
  type: 'over' | 'times';
  /** 遍历的数组变量路径（type='over' 时） */
  over?: string;
  /** 循环次数（type='times' 时） */
  times?: number;
  /** 当前项的变量名 */
  as?: string;
  /** 当前索引的变量名 */
  indexAs?: string;
  /** 最大迭代次数（防止无限循环） */
  maxIterations?: number;
}

/**
 * 步骤级 Provider 配置
 */
export interface StepProviderConfig {
  /** 使用指定的 API 预设 ID */
  presetId?: string;
  /** 临时覆盖参数 */
  overrides?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

/**
 * 链步骤定义
 */
export interface ChainStep {
  /** 步骤 ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤类型 */
  type: ChainStepType;
  /** 步骤描述 */
  description?: string;
  
  // ========== Prompt 步骤 ==========
  /** 关联的提示词 ID（type='prompt' 时） */
  promptId?: string;
  /** 或直接使用内联模板 */
  inlineTemplate?: string;
  /** 系统提示词（覆盖提示词模板的） */
  systemPrompt?: string;
  
  // ========== 变量映射 ==========
  /** 输入变量映射：{ 提示词变量名: 表达式 } */
  inputMapping: Record<string, string>;
  /** 输出键名（存储到上下文中） */
  outputKey: string;
  
  // ========== 后处理 ==========
  /** 后处理配置 */
  postProcess?: StepPostProcess;
  
  // ========== Provider 配置 ==========
  /** 步骤级 Provider 配置 */
  provider?: StepProviderConfig;
  
  // ========== 控制流 ==========
  /** 循环配置（type='loop' 或 type='prompt' 带循环时） */
  loop?: LoopConfig;
  /** 条件表达式（返回 false 则跳过） */
  condition?: string;
  /** 错误处理策略 */
  onError?: 'fail' | 'skip' | 'retry';
  /** 重试次数 */
  retryCount?: number;
}

/**
 * 单次模式配置
 */
export interface SingleShotConfig {
  /** 组装模板（如何将多个步骤合并） */
  compositeTemplate?: string;
  /** 响应解析映射：{ outputKey: JSONPath } */
  responseMapping: Record<string, string>;
  /** 最大 Token（单次请求通常需要更大） */
  maxTokens?: number;
  /** 是否生成 JSON Schema 约束 */
  useJsonSchema?: boolean;
}

/**
 * 链触发方式
 */
export interface ChainTrigger {
  /** 触发类型 */
  type: 'manual' | 'scheduled' | 'event';
  /** 定时配置（cron 表达式） */
  schedule?: string;
  /** 事件名称 */
  eventName?: string;
}

/**
 * 提示词链定义
 */
export interface PromptChain {
  /** 链 ID */
  id: string;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 链图标 */
  icon?: string;
  /** 链分类标签 */
  tags?: string[];
  /** 所属应用 ID（用于 App 注册的链） */
  appId?: string;
  
  // ========== 执行配置 ==========
  /** 执行模式 */
  executionMode: ChainExecutionMode;
  /** 链级默认 Provider */
  defaultPresetId?: string;
  /** 触发方式 */
  trigger?: ChainTrigger;
  
  // ========== 输入输出 ==========
  /** 链输入变量定义 */
  inputs: ChainVariableDefinition[];
  /** 链步骤列表 */
  steps: ChainStep[];
  /** 链输出映射：{ 输出名: 表达式 } */
  outputs: Record<string, string>;
  
  // ========== 单次模式配置 ==========
  /** 单次模式专用配置 */
  singleShotConfig?: SingleShotConfig;
  
  // ========== 元数据 ==========
  /** 来源 */
  source: 'builtin' | 'user' | 'imported' | 'app';
  /** 版本 */
  version: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

// ==================== 执行相关类型 ====================

/**
 * 步骤执行状态
 */
export type StepExecutionStatus = 
  | 'pending'    // 等待执行
  | 'running'    // 执行中
  | 'completed'  // 已完成
  | 'skipped'    // 已跳过（条件不满足）
  | 'failed'     // 执行失败
  | 'aborted';   // 被中止

/**
 * 步骤执行结果
 */
export interface StepExecutionResult {
  /** 步骤 ID */
  stepId: string;
  /** 执行状态 */
  status: StepExecutionStatus;
  /** 输出值 */
  output?: unknown;
  /** 原始 LLM 响应 */
  rawResponse?: string;
  /** 错误信息 */
  error?: string;
  /** Token 用量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 执行耗时（毫秒） */
  duration?: number;
  /** 循环迭代结果（如有） */
  iterations?: StepExecutionResult[];
}

/**
 * 链执行上下文
 */
export interface ChainExecutionContext {
  /** 链 ID */
  chainId: string;
  /** 执行 ID（唯一标识本次执行） */
  executionId: string;
  /** 输入变量 */
  inputs: Record<string, unknown>;
  /** 当前变量作用域（包含所有步骤输出） */
  variables: Record<string, unknown>;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 开始时间 */
  startTime: number;
  /** 是否已中止 */
  aborted: boolean;
}

/**
 * 链执行状态
 */
export type ChainExecutionStatus = 
  | 'pending'    // 等待开始
  | 'running'    // 执行中
  | 'completed'  // 全部完成
  | 'failed'     // 执行失败
  | 'aborted';   // 被中止

/**
 * 链执行结果
 */
export interface ChainExecutionResult {
  /** 执行 ID */
  executionId: string;
  /** 链 ID */
  chainId: string;
  /** 执行状态 */
  status: ChainExecutionStatus;
  /** 最终输出 */
  outputs: Record<string, unknown>;
  /** 各步骤结果 */
  stepResults: StepExecutionResult[];
  /** 错误信息 */
  error?: string;
  /** 总 Token 用量 */
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 执行模式 */
  executionMode: ChainExecutionMode;
}

// ==================== 事件类型 ====================

/**
 * 链执行事件
 */
export interface ChainExecutionEvent {
  type: 'start' | 'step-start' | 'step-complete' | 'step-error' | 'complete' | 'error' | 'abort';
  executionId: string;
  chainId: string;
  stepId?: string;
  stepIndex?: number;
  data?: unknown;
  error?: string;
  timestamp: number;
}

/**
 * 执行事件回调
 */
export type ChainExecutionCallback = (event: ChainExecutionEvent) => void;

// ==================== 存储类型 ====================

/**
 * 存储的链（用于 IndexedDB）
 */
export interface StoredPromptChain extends PromptChain {
  // 可能添加的存储元数据
}

/**
 * 执行历史记录
 */
export interface ChainExecutionHistory {
  /** 执行 ID */
  executionId: string;
  /** 链 ID */
  chainId: string;
  /** 链名称快照 */
  chainName: string;
  /** 执行状态 */
  status: ChainExecutionStatus;
  /** 输入参数 */
  inputs: Record<string, unknown>;
  /** 输出结果 */
  outputs: Record<string, unknown>;
  /** Token 用量 */
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 耗时 */
  totalDuration: number;
  /** 执行时间 */
  executedAt: number;
  /** 错误信息 */
  error?: string;
}
