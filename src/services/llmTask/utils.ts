/**
 * LLM 任务服务工具函数
 */

import type {
  LLMTask,
  LLMTaskDefinition,
  LLMTaskStatus,
  TaskExecutionMode,
  LLMTaskConfig,
  AutoExecutionConfig,
} from './types';
import { RequestPriority } from '@/services/ai/types';
import { v4 as uuidv4 } from 'uuid';

// ==================== ID 生成 ====================

/**
 * 生成任务实例 ID
 */
export function generateTaskId(): string {
  return uuidv4();
}

/**
 * 生成任务定义 ID
 * @param appId App ID
 * @param taskName 任务名称
 */
export function generateDefinitionId(appId: string, taskName: string): string {
  const slug = taskName
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${appId}:${slug}`;
}

// ==================== 默认值 ====================

/**
 * 获取默认的 LLM 配置
 */
export function getDefaultLLMConfig(): LLMTaskConfig {
  return {
    source: 'global',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
  };
}

/**
 * 获取默认的自动执行配置
 */
export function getDefaultAutoConfig(): AutoExecutionConfig {
  return {
    enabled: false,
    intervalMinutes: 30,
    maxExecutions: 0,
    executionCount: 0,
  };
}

// ==================== 任务创建 ====================

/**
 * 从定义创建任务实例
 */
export function createTaskFromDefinition(
  definition: LLMTaskDefinition,
  overrides?: {
    name?: string;
    description?: string;
    input?: Record<string, unknown>;
    config?: Partial<LLMTaskConfig>;
    executionMode?: TaskExecutionMode;
    autoConfig?: Partial<AutoExecutionConfig>;
  }
): LLMTask {
  const defaultConfig = getDefaultLLMConfig();
  const definitionConfig = definition.config || {};

  // 合并配置
  const config: LLMTaskConfig = {
    ...defaultConfig,
    ...definitionConfig,
    ...overrides?.config,
  };

  // 执行模式
  const executionMode = overrides?.executionMode ?? definition.executionMode;

  // 自动执行配置
  let autoConfig: AutoExecutionConfig | undefined;
  if (executionMode === 'auto') {
    autoConfig = {
      ...getDefaultAutoConfig(),
      ...definition.autoConfig,
      ...overrides?.autoConfig,
    };
  }

  // 创建任务实例
  const task: LLMTask = {
    id: generateTaskId(),
    definitionId: definition.id,
    appId: definition.appId,
    name: overrides?.name ?? definition.name,
    description: overrides?.description ?? definition.description,
    status: 'pending',
    executionMode,
    autoConfig,
    type: definition.type,
    input: {
      ...definition.defaultInput,
      ...overrides?.input,
    },
    config,
    priority: definition.priority ?? RequestPriority.NORMAL,
    systemPrompt: definition.systemPrompt,
    createdAt: Date.now(),
    totalExecutions: 0,
    retryCount: 0,
    maxRetries: 3,
  };

  return task;
}

// ==================== 状态判断 ====================

/**
 * 检查任务是否可执行
 */
export function canExecute(task: LLMTask): boolean {
  return task.status === 'pending' || task.status === 'failed';
}

/**
 * 检查任务是否正在运行
 */
export function isRunning(task: LLMTask): boolean {
  return task.status === 'running';
}

/**
 * 检查任务是否已完成（包括成功、失败、取消）
 */
export function isFinished(task: LLMTask): boolean {
  return (
    task.status === 'completed' ||
    task.status === 'failed' ||
    task.status === 'cancelled'
  );
}

/**
 * 检查任务是否支持重复执行
 */
export function isRepeatable(task: LLMTask): boolean {
  return task.executionMode === 'repeatable' || task.executionMode === 'auto';
}

// ==================== 状态标签 ====================

/** 状态标签映射 */
const STATUS_LABELS: Record<LLMTaskStatus, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
  cancelled: '已取消',
};

/**
 * 获取状态的中文标签
 */
export function getStatusLabel(status: LLMTaskStatus): string {
  return STATUS_LABELS[status] || status;
}

/** 执行模式标签映射 */
const MODE_LABELS: Record<TaskExecutionMode, string> = {
  once: '一次性',
  repeatable: '可重复',
  auto: '自动循环',
};

/**
 * 获取执行模式的中文标签
 */
export function getModeLabel(mode: TaskExecutionMode): string {
  return MODE_LABELS[mode] || mode;
}

// ==================== 时间格式化 ====================

/**
 * 格式化持续时间
 * @param ms 毫秒数
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * 格式化相对时间
 * @param timestamp 时间戳
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return '刚刚';
  }
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} 分钟前`;
  }
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} 小时前`;
  }
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

// ==================== JSON 清理 ====================

/**
 * 清理 LLM 输出中的 JSON
 * 移除 markdown 代码块标记
 */
export function cleanJsonOutput(output: string): string {
  return output
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * 安全解析 JSON
 */
export function safeParseJson<T>(text: string): T | null {
  try {
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ==================== 任务同步 ====================

/**
 * 将任务实例与定义同步（更新定义变更）
 * 保留运行时状态，更新定义相关字段
 */
export function syncTaskWithDefinition(
  task: LLMTask,
  definition: LLMTaskDefinition
): LLMTask {
  return {
    ...task,
    // 更新定义相关字段
    name: definition.name,
    description: definition.description,
    type: definition.type,
    systemPrompt: definition.systemPrompt,
    // 合并输入（保留用户值，添加新的默认值）
    input: {
      ...definition.defaultInput,
      ...task.input,
    },
    // 保留运行时状态
    status: task.status,
    totalExecutions: task.totalExecutions,
    outputHistory: task.outputHistory,
    output: task.output,
  };
}
