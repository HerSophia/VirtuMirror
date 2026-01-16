/**
 * LLM 任务服务
 * 
 * 将 LLM 任务管理抽象为系统级服务
 * - 通用性：任何 App 都可以注册和使用 LLM 任务
 * - 可扩展：通过插件机制支持不同 App 的特定需求
 * - 统一管理：提供全局视角的任务管理界面
 * 
 * @see docs/systems/llm-task-service.md
 */

// ==================== 类型导出 ====================

export type {
  // 基础类型
  LLMTaskStatus,
  LLMTaskType,
  LLMConfigSource,
  TaskExecutionMode,
  InputFieldType,

  // 配置类型
  AutoExecutionConfig,
  LLMTaskConfig,
  InputFieldDefinition,

  // 任务类型
  LLMTaskDefinition,
  LLMTaskTemplate,
  LLMTask,
  OutputHistoryEntry,

  // 扩展点类型
  ContextProvider,
  OutputHandler,
  OutputHandlerResult,
  PreviewResult,
  TaskExecutionContext,

  // 服务类型
  CreateTaskInput,
  ExecutionResult,
  TaskStats,
  TaskLog,
  TaskEvent,
  TaskEventHandler,
  TaskFilter,
  ILLMTaskService,

  // 数据库类型
  LLMTaskRecord,
} from './types';

// ==================== 服务导出 ====================

// 主服务
export { LLMTaskService, getLLMTaskService, resetLLMTaskService } from './LLMTaskService';

// 注册表
export { TaskRegistry, getTaskRegistry, resetTaskRegistry } from './TaskRegistry';
export {
  ContextProviderRegistry,
  getContextProviderRegistry,
  resetContextProviderRegistry,
} from './ContextProviderRegistry';
export {
  OutputHandlerRegistry,
  getOutputHandlerRegistry,
  resetOutputHandlerRegistry,
} from './OutputHandlerRegistry';

// 执行器和调度器
export { TaskExecutor, getTaskExecutor, resetTaskExecutor } from './TaskExecutor';
export type { ExecutorContext } from './TaskExecutor';
export { TaskScheduler, getTaskScheduler, resetTaskScheduler } from './TaskScheduler';
export type { SchedulerContext } from './TaskScheduler';

// 变量解析器
export {
  VariableResolver,
  getVariableResolver,
  getTimeContextVariables,
} from './VariableResolver';
export type { ResolveOptions } from './VariableResolver';

// 内置提供器
export {
  timeContextProvider,
  userContextProvider,
  environmentContextProvider,
  BUILTIN_CONTEXT_PROVIDERS,
  registerBuiltinProviders,
} from './builtinProviders';

// 工具函数
export {
  generateTaskId,
  generateDefinitionId,
  getDefaultLLMConfig,
  getDefaultAutoConfig,
  createTaskFromDefinition,
  canExecute,
  isRunning,
  isFinished,
  isRepeatable,
  getStatusLabel,
  getModeLabel,
  formatDuration,
  formatRelativeTime,
  cleanJsonOutput,
  safeParseJson,
  syncTaskWithDefinition,
} from './utils';
