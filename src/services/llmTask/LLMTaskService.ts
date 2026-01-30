/**
 * LLM 任务服务
 * 系统级单例服务，协调任务注册、执行、调度等功能
 */

import type {
  ILLMTaskService,
  LLMTask,
  LLMTaskDefinition,
  LLMTaskTemplate,
  ContextProvider,
  OutputHandler,
  CreateTaskInput,
  ExecutionResult,
  TaskStats,
  TaskLog,
  TaskEvent,
  TaskEventHandler,
  TaskFilter,
  AutoExecutionConfig,
} from './types';

import { getTaskRegistry, resetTaskRegistry } from './TaskRegistry';
import {
  getContextProviderRegistry,
  resetContextProviderRegistry,
} from './ContextProviderRegistry';
import {
  getOutputHandlerRegistry,
  resetOutputHandlerRegistry,
} from './OutputHandlerRegistry';
import { getTaskExecutor, resetTaskExecutor } from './TaskExecutor';
import { getTaskScheduler, resetTaskScheduler } from './TaskScheduler';
import { registerBuiltinProviders } from './builtinProviders';
import { createTaskFromDefinition, syncTaskWithDefinition } from './utils';
import { useAIStore } from '@/stores/aiStore';
import { loggerService } from '@/services/logger';

const logger = loggerService.child('service:llmTask');

// ==================== 服务实现 ====================

/**
 * LLM 任务服务
 * 单例模式，提供任务管理的统一入口
 */
export class LLMTaskService implements ILLMTaskService {
  private _initialized = false;

  /** 任务实例存储 */
  private tasks: Map<string, LLMTask> = new Map();

  /** 任务模板存储 */
  private templates: Map<string, LLMTaskTemplate> = new Map();

  /** 任务日志存储 */
  private logs: Map<string, TaskLog[]> = new Map();

  /** 事件处理器 */
  private eventHandlers: Map<TaskEvent, Set<TaskEventHandler>> = new Map();

  // ==================== 初始化 ====================

  get initialized(): boolean {
    return this._initialized;
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      logger.debug('服务已初始化，跳过');
      return;
    }

    logger.info('开始初始化服务...');

    // 1. 注册内置上下文提供器
    registerBuiltinProviders();

    // 2. 初始化任务调度器
    const scheduler = getTaskScheduler();
    scheduler.initialize({
      getTask: (id) => this.getTask(id),
      updateTask: (id, updates) => this.updateTask(id, updates),
      executeTask: (id) => this.executeTask(id).then((r) => r.success),
      addLog: (taskId, level, message) => this.addLog(taskId, level, message),
    });

    // 3. 初始化任务执行器
    const executor = getTaskExecutor();
    executor.initialize({
      getTask: (id) => this.getTask(id),
      updateTask: (id, updates) => this.updateTask(id, updates),
      addLog: (taskId, level, message, data) =>
        this.addLog(taskId, level, message, data),
      getTaskLogs: (taskId) => this.getTaskLogs(taskId),
      scheduleNextExecution: (taskId) => scheduler.scheduleNext(taskId),
      getService: (serviceId) => this.getServiceInstance(serviceId),
    });

    // 4. 确保 AIStore 已初始化
    const aiStore = useAIStore();
    if (!aiStore.initialized) {
      await aiStore.initialize();
    }

    this._initialized = true;
    logger.info('服务初始化完成');
  }

  // ==================== 任务定义注册 ====================

  registerTaskDefinition(definition: LLMTaskDefinition): void {
    const registry = getTaskRegistry();
    registry.register(definition);
    this.emit('definition-registered', definition as unknown as LLMTask);
  }

  registerTaskDefinitions(definitions: LLMTaskDefinition[]): void {
    const registry = getTaskRegistry();
    registry.registerBatch(definitions);
    logger.info(`批量注册 ${definitions.length} 个任务定义`);
  }

  unregisterTaskDefinition(id: string): boolean {
    const registry = getTaskRegistry();
    const definition = registry.get(id);
    const result = registry.unregister(id);
    if (result && definition) {
      this.emit('definition-unregistered', definition as unknown as LLMTask);
    }
    return result;
  }

  getTaskDefinition(id: string): LLMTaskDefinition | undefined {
    return getTaskRegistry().get(id);
  }

  getAllTaskDefinitions(): LLMTaskDefinition[] {
    return getTaskRegistry().getAll();
  }

  getTaskDefinitionsByApp(appId: string): LLMTaskDefinition[] {
    return getTaskRegistry().getByApp(appId);
  }

  // ==================== 任务模板注册 ====================

  registerTaskTemplate(template: LLMTaskTemplate): void {
    if (this.templates.has(template.id)) {
      logger.warn(`模板已存在，将覆盖: ${template.id}`);
    }
    this.templates.set(template.id, template);
    logger.debug(`已注册模板: ${template.id} (${template.name})`);
  }

  registerTaskTemplates(templates: LLMTaskTemplate[]): void {
    for (const template of templates) {
      this.templates.set(template.id, template);
    }
    logger.info(`批量注册 ${templates.length} 个任务模板`);
  }

  unregisterTaskTemplate(id: string): boolean {
    const result = this.templates.delete(id);
    if (result) {
      logger.debug(`已注销模板: ${id}`);
    }
    return result;
  }

  getTaskTemplate(id: string): LLMTaskTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTaskTemplates(): LLMTaskTemplate[] {
    return Array.from(this.templates.values());
  }

  getTaskTemplatesByApp(appId: string): LLMTaskTemplate[] {
    return this.getAllTaskTemplates().filter((t) => t.appId === appId);
  }

  getTaskTemplatesByCategory(category: LLMTaskTemplate['category']): LLMTaskTemplate[] {
    return this.getAllTaskTemplates().filter((t) => t.category === category);
  }

  // ==================== 扩展点注册 ====================

  registerContextProvider(provider: ContextProvider): void {
    getContextProviderRegistry().register(provider);
  }

  unregisterContextProvider(id: string): boolean {
    return getContextProviderRegistry().unregister(id);
  }

  getContextProvider(id: string): ContextProvider | undefined {
    return getContextProviderRegistry().get(id);
  }

  getAllContextProviders(): ContextProvider[] {
    return getContextProviderRegistry().getAll();
  }

  registerOutputHandler(handler: OutputHandler): void {
    getOutputHandlerRegistry().register(handler);
  }

  unregisterOutputHandler(id: string): boolean {
    return getOutputHandlerRegistry().unregister(id);
  }

  getOutputHandler(id: string): OutputHandler | undefined {
    return getOutputHandlerRegistry().get(id);
  }

  getAllOutputHandlers(): OutputHandler[] {
    return getOutputHandlerRegistry().getAll();
  }

  // ==================== 任务实例管理 ====================

  createTask(
    definitionId: string,
    overrides?: Partial<CreateTaskInput>
  ): LLMTask {
    const definition = getTaskRegistry().get(definitionId);
    if (!definition) {
      throw new Error(`[LLMTaskService] 找不到任务定义: ${definitionId}`);
    }

    const task = createTaskFromDefinition(definition, overrides);
    this.tasks.set(task.id, task);

    this.addLog(task.id, 'info', '任务已创建');
    this.emit('task-created', task);

    logger.debug(`已创建任务: ${task.id} (${task.name})`);

    return task;
  }

  updateTask(taskId: string, updates: Partial<LLMTask>): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    const updatedTask = { ...task, ...updates };
    this.tasks.set(taskId, updatedTask);
    return true;
  }

  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // 如果正在运行，先取消
    if (task.status === 'running') {
      this.cancelTask(taskId);
    }

    // 停止自动执行
    if (task.executionMode === 'auto') {
      getTaskScheduler().stop(taskId);
    }

    // 删除任务和日志
    this.tasks.delete(taskId);
    this.logs.delete(taskId);

    logger.debug(`已删除任务: ${taskId}`);
    return true;
  }

  duplicateTask(taskId: string): LLMTask | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    // 创建新任务（从相同定义）
    const newTask = this.createTask(task.definitionId, {
      name: `${task.name} (副本)`,
      description: task.description,
      input: { ...task.input },
      config: { ...task.config },
      executionMode:
        task.executionMode === 'auto' ? 'repeatable' : task.executionMode,
    });

    return newTask;
  }

  getTask(taskId: string): LLMTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): LLMTask[] {
    return Array.from(this.tasks.values());
  }

  getTasksByApp(appId: string): LLMTask[] {
    return this.getAllTasks().filter((t) => t.appId === appId);
  }

  filterTasks(filter: TaskFilter): LLMTask[] {
    let result = this.getAllTasks();

    if (filter.status?.length) {
      result = result.filter((t) => filter.status!.includes(t.status));
    }
    if (filter.type?.length) {
      result = result.filter((t) => filter.type!.includes(t.type));
    }
    if (filter.executionMode?.length) {
      result = result.filter((t) =>
        filter.executionMode!.includes(t.executionMode)
      );
    }
    if (filter.appId) {
      result = result.filter((t) => t.appId === filter.appId);
    }
    if (filter.dateRange) {
      result = result.filter(
        (t) =>
          t.createdAt >= filter.dateRange!.start &&
          t.createdAt <= filter.dateRange!.end
      );
    }

    return result;
  }

  // ==================== 任务执行 ====================

  async executeTask(taskId: string): Promise<ExecutionResult> {
    if (!this._initialized) {
      await this.initialize();
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        success: false,
        error: '任务不存在',
        duration: 0,
      };
    }

    this.emit('task-started', task);

    const executor = getTaskExecutor();
    const result = await executor.execute(taskId);

    // 获取更新后的任务状态
    const updatedTask = this.tasks.get(taskId);
    if (updatedTask) {
      if (result.success) {
        this.emit('task-completed', updatedTask);
      } else {
        this.emit('task-failed', updatedTask, result.error);
      }
    }

    return result;
  }

  pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 如果正在运行，中止 AI 请求
    if (task.status === 'running') {
      const aiStore = useAIStore();
      aiStore.abort();
    }

    // 停止自动执行
    if (task.executionMode === 'auto') {
      getTaskScheduler().stop(taskId);
    }

    this.updateTask(taskId, { status: 'paused' });
    this.addLog(taskId, 'info', '任务已暂停');
    this.emit('task-paused', task);

    return true;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;

    this.updateTask(taskId, { status: 'pending' });
    this.addLog(taskId, 'info', '任务已恢复');
    this.emit('task-resumed', task);

    // 如果是自动任务，重新启动
    if (task.executionMode === 'auto' && task.autoConfig?.enabled) {
      return getTaskScheduler().start(taskId);
    }

    // 否则执行任务
    const result = await this.executeTask(taskId);
    return result.success;
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 如果正在运行，中止 AI 请求
    if (task.status === 'running') {
      const aiStore = useAIStore();
      aiStore.abort();
    }

    // 停止自动执行
    getTaskScheduler().stop(taskId);

    this.updateTask(taskId, {
      status: 'cancelled',
      completedAt: Date.now(),
    });
    this.addLog(taskId, 'info', '任务已取消');
    this.emit('task-cancelled', task);

    return true;
  }

  async retryTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || (task.status !== 'failed' && task.status !== 'cancelled')) {
      return false;
    }

    this.updateTask(taskId, {
      status: 'pending',
      error: undefined,
      retryCount: 0,
    });
    this.addLog(taskId, 'info', '准备重试任务');

    const result = await this.executeTask(taskId);
    return result.success;
  }

  cancelAllRunning(): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.status === 'running' || task.status === 'pending') {
        this.cancelTask(task.id);
        count++;
      }
    }
    return count;
  }

  // ==================== 自动执行 ====================

  startAutoExecution(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 确保任务是自动模式
    if (task.executionMode !== 'auto') {
      getTaskScheduler().updateExecutionMode(taskId, 'auto');
    }

    const result = getTaskScheduler().start(taskId);
    if (result) {
      this.emit('auto-execution-started', task);
    }
    return result;
  }

  stopAutoExecution(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const result = getTaskScheduler().stop(taskId);
    if (result) {
      this.emit('auto-execution-stopped', task);
    }
    return result;
  }

  updateAutoConfig(
    taskId: string,
    config: Partial<AutoExecutionConfig>
  ): boolean {
    return getTaskScheduler().updateConfig(taskId, config);
  }

  // ==================== 查询 ====================

  getRunningTasks(): LLMTask[] {
    return this.getAllTasks().filter((t) => t.status === 'running');
  }

  getPendingTasks(): LLMTask[] {
    return this.getAllTasks().filter((t) => t.status === 'pending');
  }

  getStats(): TaskStats {
    const all = this.getAllTasks();
    const completed = all.filter((t) => t.status === 'completed');
    const autoRunning = all.filter(
      (t) => t.executionMode === 'auto' && t.autoConfig?.enabled
    );

    // 按 App 分组统计
    const byApp: Record<string, number> = {};
    for (const task of all) {
      byApp[task.appId] = (byApp[task.appId] || 0) + 1;
    }

    return {
      total: all.length,
      pending: all.filter((t) => t.status === 'pending').length,
      running: all.filter((t) => t.status === 'running').length,
      completed: completed.length,
      failed: all.filter((t) => t.status === 'failed').length,
      paused: all.filter((t) => t.status === 'paused').length,
      cancelled: all.filter((t) => t.status === 'cancelled').length,
      totalTokens: all.reduce(
        (sum, t) => sum + (t.usage?.totalTokens || 0),
        0
      ),
      avgDuration:
        completed.length > 0
          ? completed.reduce((sum, t) => sum + (t.duration || 0), 0) /
            completed.length
          : 0,
      autoRunningCount: autoRunning.length,
      byApp,
    };
  }

  // ==================== 日志管理 ====================

  getTaskLogs(taskId: string): TaskLog[] {
    return this.logs.get(taskId) || [];
  }

  clearTaskLogs(taskId: string): void {
    this.logs.delete(taskId);
  }

  private addLog(
    taskId: string,
    level: TaskLog['level'],
    message: string,
    data?: unknown
  ): void {
    if (!this.logs.has(taskId)) {
      this.logs.set(taskId, []);
    }

    const taskLogs = this.logs.get(taskId)!;
    taskLogs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });

    // 限制日志数量
    if (taskLogs.length > 100) {
      taskLogs.shift();
    }
  }

  // ==================== 事件 ====================

  on(event: TaskEvent, handler: TaskEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: TaskEvent, handler: TaskEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  emit(event: TaskEvent, task: LLMTask, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(task, data);
        } catch (error) {
          logger.error(`事件处理器错误 (${event}):`, error);
        }
      }
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 获取服务实例（用于依赖注入）
   */
  private getServiceInstance<T>(serviceId: string): T | undefined {
    // 可以在这里添加服务查找逻辑
    // 目前返回 undefined
    return undefined;
  }

  /**
   * 同步任务定义更新
   * 当任务定义变更时，更新现有任务实例
   */
  syncTasksWithDefinitions(): void {
    const registry = getTaskRegistry();

    for (const task of this.tasks.values()) {
      const definition = registry.get(task.definitionId);
      if (definition) {
        const syncedTask = syncTaskWithDefinition(task, definition);
        this.tasks.set(task.id, syncedTask);
      }
    }

    logger.debug('已同步任务定义');
  }

  /**
   * 创建默认显示的任务
   * 根据 showByDefault 为 true 的定义创建任务实例
   */
  createDefaultTasks(): void {
    const definitions = getTaskRegistry().getDefaultVisible();

    for (const def of definitions) {
      // 检查是否已存在
      const existing = this.getAllTasks().find(
        (t) => t.definitionId === def.id
      );
      if (!existing) {
        this.createTask(def.id);
      }
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 取消所有任务
    this.cancelAllRunning();

    // 清除调度器
    getTaskScheduler().clearAll();

    // 清除数据
    this.tasks.clear();
    this.templates.clear();
    this.logs.clear();
    this.eventHandlers.clear();

    this._initialized = false;
    logger.info('服务已销毁');
  }
}

// ==================== 单例管理 ====================

let llmTaskServiceInstance: LLMTaskService | null = null;

/**
 * 获取 LLM 任务服务单例
 */
export function getLLMTaskService(): LLMTaskService {
  if (!llmTaskServiceInstance) {
    llmTaskServiceInstance = new LLMTaskService();
  }
  return llmTaskServiceInstance;
}

/**
 * 重置服务（用于测试）
 */
export function resetLLMTaskService(): void {
  if (llmTaskServiceInstance) {
    llmTaskServiceInstance.destroy();
  }
  llmTaskServiceInstance = null;

  // 重置所有子组件
  resetTaskRegistry();
  resetContextProviderRegistry();
  resetOutputHandlerRegistry();
  resetTaskExecutor();
  resetTaskScheduler();
}
