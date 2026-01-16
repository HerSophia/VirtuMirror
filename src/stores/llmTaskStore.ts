/**
 * 系统级 LLM 任务 Store
 * 
 * 提供响应式的任务状态管理，与 LLMTaskService 同步
 * 供所有 App 使用的统一任务管理接口
 */

import { defineStore } from 'pinia';
import { ref, computed, watch, onUnmounted } from 'vue';
import {
  getLLMTaskService,
  type LLMTask,
  type LLMTaskDefinition,
  type TaskStats,
  type TaskLog,
  type TaskFilter,
  type CreateTaskInput,
  type ExecutionResult,
  type AutoExecutionConfig,
  type ContextProvider,
  type OutputHandler,
} from '@/services/llmTask';

// ==================== Store 定义 ====================

export const useLLMTaskStore = defineStore('llmTask', () => {
  // ==================== 状态 ====================

  /** 是否已初始化 */
  const initialized = ref(false);

  /** 是否正在加载 */
  const isLoading = ref(false);

  /** 任务列表（响应式缓存） */
  const tasks = ref<LLMTask[]>([]);

  /** 当前选中的任务 ID */
  const selectedTaskId = ref<string | null>(null);

  /** 任务过滤器 */
  const filter = ref<TaskFilter>({});

  /** 任务日志缓存 */
  const logsCache = ref<Map<string, TaskLog[]>>(new Map());

  // ==================== 服务引用 ====================

  const service = getLLMTaskService();

  // ==================== 初始化 ====================

  /**
   * 初始化 Store
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      return;
    }

    isLoading.value = true;

    try {
      // 初始化服务
      await service.initialize();

      // 同步任务列表
      syncTasks();

      // 监听服务事件
      setupEventListeners();

      initialized.value = true;
      console.log('[LLMTaskStore] Store 初始化完成');
    } catch (error) {
      console.error('[LLMTaskStore] 初始化失败:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 同步服务中的任务到 Store
   */
  function syncTasks(): void {
    tasks.value = service.getAllTasks();
  }

  /**
   * 设置事件监听器
   */
  function setupEventListeners(): void {
    // 任务创建
    service.on('task-created', () => syncTasks());

    // 任务状态变更
    service.on('task-started', () => syncTasks());
    service.on('task-completed', () => syncTasks());
    service.on('task-failed', () => syncTasks());
    service.on('task-cancelled', () => syncTasks());
    service.on('task-paused', () => syncTasks());
    service.on('task-resumed', () => syncTasks());

    // 自动执行状态变更
    service.on('auto-execution-started', () => syncTasks());
    service.on('auto-execution-stopped', () => syncTasks());

    // 定义注册/注销
    service.on('definition-registered', () => syncTasks());
    service.on('definition-unregistered', () => syncTasks());
  }

  // ==================== 计算属性 ====================

  /** 当前选中的任务 */
  const selectedTask = computed(() => {
    if (!selectedTaskId.value) return null;
    return tasks.value.find((t) => t.id === selectedTaskId.value) || null;
  });

  /** 过滤后的任务列表 */
  const filteredTasks = computed(() => {
    let result = [...tasks.value];

    if (filter.value.status?.length) {
      result = result.filter((t) => filter.value.status!.includes(t.status));
    }
    if (filter.value.type?.length) {
      result = result.filter((t) => filter.value.type!.includes(t.type));
    }
    if (filter.value.executionMode?.length) {
      result = result.filter((t) =>
        filter.value.executionMode!.includes(t.executionMode)
      );
    }
    if (filter.value.appId) {
      result = result.filter((t) => t.appId === filter.value.appId);
    }
    if (filter.value.dateRange) {
      result = result.filter(
        (t) =>
          t.createdAt >= filter.value.dateRange!.start &&
          t.createdAt <= filter.value.dateRange!.end
      );
    }

    // 按创建时间倒序
    return result.sort((a, b) => b.createdAt - a.createdAt);
  });

  /** 运行中的任务 */
  const runningTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'running')
  );

  /** 待执行的任务 */
  const pendingTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'pending')
  );

  /** 自动执行中的任务 */
  const autoRunningTasks = computed(() =>
    tasks.value.filter(
      (t) => t.executionMode === 'auto' && t.autoConfig?.enabled
    )
  );

  /** 任务统计 */
  const stats = computed<TaskStats>(() => service.getStats());

  /** 所有任务定义 */
  const taskDefinitions = computed(() => service.getAllTaskDefinitions());

  /** 按 App 分组的任务定义 */
  const taskDefinitionsByApp = computed(() => {
    const grouped: Record<string, LLMTaskDefinition[]> = {};
    for (const def of service.getAllTaskDefinitions()) {
      if (!grouped[def.appId]) {
        grouped[def.appId] = [];
      }
      grouped[def.appId].push(def);
    }
    return grouped;
  });

  // ==================== 任务定义管理 ====================

  /**
   * 注册任务定义
   */
  function registerTaskDefinition(definition: LLMTaskDefinition): void {
    service.registerTaskDefinition(definition);
    syncTasks();
  }

  /**
   * 批量注册任务定义
   */
  function registerTaskDefinitions(definitions: LLMTaskDefinition[]): void {
    service.registerTaskDefinitions(definitions);
    syncTasks();
  }

  /**
   * 注销任务定义
   */
  function unregisterTaskDefinition(id: string): boolean {
    const result = service.unregisterTaskDefinition(id);
    syncTasks();
    return result;
  }

  /**
   * 获取任务定义
   */
  function getTaskDefinition(id: string): LLMTaskDefinition | undefined {
    return service.getTaskDefinition(id);
  }

  /**
   * 获取指定 App 的任务定义
   */
  function getTaskDefinitionsByApp(appId: string): LLMTaskDefinition[] {
    return service.getTaskDefinitionsByApp(appId);
  }

  // ==================== 扩展点管理 ====================

  /**
   * 注册上下文提供器
   */
  function registerContextProvider(provider: ContextProvider): void {
    service.registerContextProvider(provider);
  }

  /**
   * 注册输出处理器
   */
  function registerOutputHandler(handler: OutputHandler): void {
    service.registerOutputHandler(handler);
  }

  // ==================== 任务管理 ====================

  /**
   * 创建任务
   */
  function createTask(
    definitionId: string,
    overrides?: Partial<CreateTaskInput>
  ): LLMTask {
    const task = service.createTask(definitionId, overrides);
    syncTasks();
    return task;
  }

  /**
   * 更新任务
   */
  function updateTask(taskId: string, updates: Partial<LLMTask>): boolean {
    const result = service.updateTask(taskId, updates);
    if (result) {
      syncTasks();
    }
    return result;
  }

  /**
   * 删除任务
   */
  function deleteTask(taskId: string): boolean {
    const result = service.deleteTask(taskId);
    if (result) {
      syncTasks();
      // 如果删除的是当前选中的任务，清除选中
      if (selectedTaskId.value === taskId) {
        selectedTaskId.value = null;
      }
    }
    return result;
  }

  /**
   * 复制任务
   */
  function duplicateTask(taskId: string): LLMTask | null {
    const task = service.duplicateTask(taskId);
    if (task) {
      syncTasks();
    }
    return task;
  }

  /**
   * 获取任务
   */
  function getTask(taskId: string): LLMTask | undefined {
    return service.getTask(taskId);
  }

  /**
   * 获取指定 App 的任务
   */
  function getTasksByApp(appId: string): LLMTask[] {
    return tasks.value.filter((t) => t.appId === appId);
  }

  // ==================== 任务执行 ====================

  /**
   * 执行任务
   */
  async function executeTask(taskId: string): Promise<ExecutionResult> {
    const result = await service.executeTask(taskId);
    syncTasks();
    return result;
  }

  /**
   * 暂停任务
   */
  function pauseTask(taskId: string): boolean {
    const result = service.pauseTask(taskId);
    syncTasks();
    return result;
  }

  /**
   * 恢复任务
   */
  async function resumeTask(taskId: string): Promise<boolean> {
    const result = await service.resumeTask(taskId);
    syncTasks();
    return result;
  }

  /**
   * 取消任务
   */
  function cancelTask(taskId: string): boolean {
    const result = service.cancelTask(taskId);
    syncTasks();
    return result;
  }

  /**
   * 重试任务
   */
  async function retryTask(taskId: string): Promise<boolean> {
    const result = await service.retryTask(taskId);
    syncTasks();
    return result;
  }

  /**
   * 取消所有运行中的任务
   */
  function cancelAllRunning(): number {
    const count = service.cancelAllRunning();
    syncTasks();
    return count;
  }

  // ==================== 自动执行 ====================

  /**
   * 启动自动执行
   */
  function startAutoExecution(taskId: string): boolean {
    const result = service.startAutoExecution(taskId);
    syncTasks();
    return result;
  }

  /**
   * 停止自动执行
   */
  function stopAutoExecution(taskId: string): boolean {
    const result = service.stopAutoExecution(taskId);
    syncTasks();
    return result;
  }

  /**
   * 更新自动执行配置
   */
  function updateAutoConfig(
    taskId: string,
    config: Partial<AutoExecutionConfig>
  ): boolean {
    const result = service.updateAutoConfig(taskId, config);
    syncTasks();
    return result;
  }

  // ==================== 日志管理 ====================

  /**
   * 获取任务日志
   */
  function getTaskLogs(taskId: string): TaskLog[] {
    // 优先使用缓存
    if (logsCache.value.has(taskId)) {
      return logsCache.value.get(taskId)!;
    }
    const logs = service.getTaskLogs(taskId);
    logsCache.value.set(taskId, logs);
    return logs;
  }

  /**
   * 清空任务日志
   */
  function clearTaskLogs(taskId: string): void {
    service.clearTaskLogs(taskId);
    logsCache.value.delete(taskId);
  }

  /**
   * 刷新任务日志缓存
   */
  function refreshTaskLogs(taskId: string): TaskLog[] {
    logsCache.value.delete(taskId);
    return getTaskLogs(taskId);
  }

  // ==================== UI 状态 ====================

  /**
   * 选中任务
   */
  function selectTask(taskId: string | null): void {
    selectedTaskId.value = taskId;
  }

  /**
   * 设置过滤器
   */
  function setFilter(newFilter: TaskFilter): void {
    filter.value = newFilter;
  }

  /**
   * 清除过滤器
   */
  function clearFilter(): void {
    filter.value = {};
  }

  /**
   * 按 App 过滤
   */
  function filterByApp(appId: string | undefined): void {
    if (appId) {
      filter.value = { ...filter.value, appId };
    } else {
      const { appId: _, ...rest } = filter.value;
      filter.value = rest;
    }
  }

  // ==================== 返回 ====================

  return {
    // 状态
    initialized,
    isLoading,
    tasks,
    selectedTaskId,
    filter,

    // 计算属性
    selectedTask,
    filteredTasks,
    runningTasks,
    pendingTasks,
    autoRunningTasks,
    stats,
    taskDefinitions,
    taskDefinitionsByApp,

    // 初始化
    initialize,
    syncTasks,

    // 任务定义
    registerTaskDefinition,
    registerTaskDefinitions,
    unregisterTaskDefinition,
    getTaskDefinition,
    getTaskDefinitionsByApp,

    // 扩展点
    registerContextProvider,
    registerOutputHandler,

    // 任务管理
    createTask,
    updateTask,
    deleteTask,
    duplicateTask,
    getTask,
    getTasksByApp,

    // 任务执行
    executeTask,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    cancelAllRunning,

    // 自动执行
    startAutoExecution,
    stopAutoExecution,
    updateAutoConfig,

    // 日志
    getTaskLogs,
    clearTaskLogs,
    refreshTaskLogs,

    // UI 状态
    selectTask,
    setFilter,
    clearFilter,
    filterByApp,
  };
});
