/**
 * LLM 任务管理 Store
 *
 * 直接代理系统级 LLM 任务服务，不维护本地状态
 * @see docs/systems/llm-task-service.md
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  LLMTask,
  LLMConfigSource,
  TaskFilter,
  TaskStats,
  TaskLog,
  LLMTaskConfig,
  TaskTemplate,
  GlobalLLMSettings,
  TaskExecutionMode,
  AutoExecutionConfig,
} from '../types/llmTask';
import { RequestPriority } from '@/services/ai/types';
import { getGlobalConfigService } from '@/services/globalConfigService';
import {
  getLLMTaskService,
  type LLMTask as SystemLLMTask,
  type LLMTaskDefinition,
} from '@/services/llmTask';

// 导入新的任务模板
import {
  weiboTaskTemplates,
  getAllWeiboTaskTemplates,
  WEIBO_APP_ID,
} from '../llmTask/weiboTaskDefinitions';

import {
  narrativeCache,
  initializeNarrativeSubscription,
  getNarrativeContext as getNarrativeContextFn,
} from './llm/narrativeIntegration';

// ==================== 类型转换 ====================

/**
 * 系统任务转换为微博任务格式
 */
function systemTaskToWeiboTask(task: SystemLLMTask): LLMTask {
  // 从 definitionId 提取 builtinId
  const builtinId = task.definitionId.startsWith(`${WEIBO_APP_ID}:`)
    ? task.definitionId.replace(`${WEIBO_APP_ID}:`, '')
    : undefined;

  return {
    id: task.id,
    name: task.name,
    description: task.description,
    type: task.type,
    status: task.status,
    executionMode: task.executionMode,
    autoConfig: task.autoConfig,
    manualPrompt: task.resolvedPrompt,
    systemPrompt: task.systemPrompt,
    input: task.input as Record<string, any>,
    output: task.output,
    chainResult: task.chainResult,
    outputHistory: task.outputHistory,
    error: task.error,
    config: task.config as LLMTaskConfig,
    priority: task.priority,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    duration: task.duration,
    usage: task.usage,
    totalExecutions: task.totalExecutions,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    sourceApp: task.appId,
    isBuiltin: !!builtinId,
    builtinId,
  };
}

// ==================== Store 定义 ====================

export const useLLMTaskStore = defineStore('weiboLLMTask', () => {
  // ==================== 状态 ====================

  /** 用于触发响应式更新的版本号 */
  const updateVersion = ref(0);

  /** 当前选中的任务 ID */
  const selectedTaskId = ref<string | null>(null);

  /** 是否正在加载 */
  const isLoading = ref(false);

  /** 过滤器 */
  const filter = ref<TaskFilter>({});

  /** 全局 LLM 设置 */
  const globalSettings = ref<GlobalLLMSettings>({
    useGlobalAsDefault: true,
    defaultPresetId: undefined,
    defaultOverrides: undefined,
  });

  /**
   * 自动叙事分析开关
   * @deprecated 请使用 useSettingsStore().autoNarrativeAnalysisEnabled
   * 保留此属性以保持向后兼容，实际值从 settingsStore 获取
   */
  const autoNarrativeAnalysisEnabled = computed({
    get: () => {
      try {
        // 动态导入避免循环依赖
        const { useSettingsStore } = require('./settingsStore');
        return useSettingsStore().autoNarrativeAnalysisEnabled;
      } catch {
        return false;
      }
    },
    set: (value: boolean) => {
      try {
        const { useSettingsStore } = require('./settingsStore');
        useSettingsStore().toggleAutoNarrativeAnalysis(value);
      } catch {
        console.warn('[LLMTaskStore] settingsStore not available');
      }
    }
  });

  /** 是否已初始化 */
  const builtinTasksInitialized = ref(false);

  // ==================== 系统服务 ====================

  const getService = () => getLLMTaskService();

  // ==================== 计算属性 ====================

  /** 所有任务（从系统服务获取） */
  const tasks = computed<LLMTask[]>(() => {
    // 触发响应式依赖
    void updateVersion.value;

    const service = getService();
    const systemTasks = service.getTasksByApp(WEIBO_APP_ID);
    return systemTasks.map(systemTaskToWeiboTask);
  });

  /** 当前选中的任务 */
  const selectedTask = computed(() => {
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
      result = result.filter((t) => filter.value.executionMode!.includes(t.executionMode));
    }
    if (filter.value.isBuiltin !== undefined) {
      result = result.filter((t) => t.isBuiltin === filter.value.isBuiltin);
    }

    // 按创建时间倒序，内置任务置顶
    return result.sort((a, b) => {
      if (a.isBuiltin && !b.isBuiltin) return -1;
      if (!a.isBuiltin && b.isBuiltin) return 1;
      return b.createdAt - a.createdAt;
    });
  });

  /** 内置任务列表 */
  const builtinTasks = computed(() => tasks.value.filter((t) => t.isBuiltin));

  /** 用户创建的任务列表 */
  const userTasks = computed(() => tasks.value.filter((t) => !t.isBuiltin));

  /** 任务统计 */
  const stats = computed<TaskStats>(() => {
    const all = tasks.value;
    const completed = all.filter((t) => t.status === 'completed');
    const autoRunning = all.filter((t) => t.executionMode === 'auto' && t.autoConfig?.enabled);

    return {
      total: all.length,
      pending: all.filter((t) => t.status === 'pending').length,
      running: all.filter((t) => t.status === 'running').length,
      completed: completed.length,
      failed: all.filter((t) => t.status === 'failed').length,
      paused: all.filter((t) => t.status === 'paused').length,
      cancelled: all.filter((t) => t.status === 'cancelled').length,
      totalTokens: all.reduce((sum, t) => sum + (t.usage?.totalTokens || 0), 0),
      avgDuration:
        completed.length > 0
          ? completed.reduce((sum, t) => sum + (t.duration || 0), 0) / completed.length
          : 0,
      builtinCount: builtinTasks.value.length,
      autoRunningCount: autoRunning.length,
    };
  });

  /** 进行中的任务 */
  const runningTasks = computed(() => tasks.value.filter((t) => t.status === 'running'));

  /** 待处理的任务 */
  const pendingTasks = computed(() => tasks.value.filter((t) => t.status === 'pending'));

  /** 可用的 API 预设列表 */
  const availablePresets = computed(() => {
    try {
      return getGlobalConfigService().getApiPresets();
    } catch {
      return [];
    }
  });

  /** 当前全局激活的预设 */
  const activeGlobalPreset = computed(() => {
    try {
      return getGlobalConfigService().getActivePreset();
    } catch {
      return null;
    }
  });

  // ==================== 触发更新 ====================

  function triggerUpdate() {
    updateVersion.value++;
  }

  // ==================== 日志管理 ====================

  function addLog(taskId: string, level: TaskLog['level'], message: string, data?: any) {
    console.log(`[LLMTask:${taskId}] ${level}: ${message}`, data || '');
  }

  function getTaskLogs(taskId: string): TaskLog[] {
    return getService().getTaskLogs(taskId);
  }

  function clearTaskLogs(taskId: string) {
    getService().clearTaskLogs(taskId);
  }

  // ==================== 辅助方法 ====================

  function getTask(id: string): LLMTask | undefined {
    return tasks.value.find((t) => t.id === id);
  }

  function getNarrativeContext() {
    return getNarrativeContextFn();
  }

  /**
   * 获取内置任务定义
   */
  function getBuiltinDefinition(builtinId: string): LLMTaskDefinition | undefined {
    const service = getService();
    const definitionId = `${WEIBO_APP_ID}:${builtinId}`;
    return service.getTaskDefinition(definitionId);
  }

  // ==================== 初始化 ====================

  async function initializeBuiltinTasks() {
    if (builtinTasksInitialized.value) return;

    const service = getService();

    // 确保服务已初始化
    if (!service.initialized) {
      await service.initialize();
    }

    // 清理旧格式的任务（definitionId 不是 weibo:xxx 格式的微博任务）
    const allTasks = service.getTasksByApp(WEIBO_APP_ID);
    const oldFormatTasks = allTasks.filter(
      (t) => !t.definitionId.startsWith(`${WEIBO_APP_ID}:`)
    );
    if (oldFormatTasks.length > 0) {
      console.log(`[LLMTaskStore] 清理 ${oldFormatTasks.length} 个旧格式任务`);
      oldFormatTasks.forEach((t) => service.deleteTask(t.id));
    }

    // 获取微博任务定义
    const definitions = service.getTaskDefinitionsByApp(WEIBO_APP_ID);

    if (definitions.length === 0) {
      console.warn('[LLMTaskStore] 没有找到微博任务定义，请确保先调用 registerWeiboLLMExtensions()');
      return;
    }

    // 为默认显示的定义创建任务实例
    definitions
      .filter((def) => def.showByDefault)
      .forEach((def) => {
        const existingTasks = service.getAllTasks().filter((t) => t.definitionId === def.id);

        if (existingTasks.length === 0) {
          try {
            service.createTask(def.id);
            console.log(`[LLMTaskStore] 已创建内置任务: ${def.name}`);
          } catch (e) {
            console.error(`[LLMTaskStore] 创建任务失败: ${def.name}`, e);
          }
        }
      });

    // 初始化叙事订阅
    initializeNarrativeSubscription((level, msg) => {
      console.log(`[LLMTaskStore] ${level}: ${msg}`);
    });

    builtinTasksInitialized.value = true;
    triggerUpdate();
    console.log('[LLMTaskStore] 内置任务初始化完成');
  }

  function resetBuiltinTask(taskId: string): boolean {
    const task = getTask(taskId);
    if (!task || !task.isBuiltin || !task.builtinId) return false;

    const service = getService();
    const definitionId = `${WEIBO_APP_ID}:${task.builtinId}`;
    const systemDef = service.getTaskDefinition(definitionId);

    if (!systemDef) {
      console.warn(`[LLMTaskStore] 找不到任务定义: ${definitionId}`);
      return false;
    }

    service.updateTask(taskId, {
      input: { ...systemDef.defaultInput },
      config: {
        source: systemDef.config?.source ?? 'custom',
        temperature: systemDef.config?.temperature ?? 0.7,
        maxTokens: systemDef.config?.maxTokens ?? 2048,
        topP: systemDef.config?.topP ?? 1,
      },
      status: 'pending',
      output: undefined,
      error: undefined,
    });

    triggerUpdate();
    return true;
  }

  // ==================== 配置管理 ====================

  function getDefaultTaskConfig(): LLMTaskConfig {
    const configService = getGlobalConfigService();
    const defaultOptions = configService.getDefaultGenerateOptions();

    if (globalSettings.value.useGlobalAsDefault) {
      return {
        source: 'global',
        temperature: defaultOptions.temperature ?? 0.7,
        maxTokens: defaultOptions.maxTokens ?? 2048,
        topP: defaultOptions.topP ?? 1,
        frequencyPenalty: defaultOptions.frequencyPenalty,
        presencePenalty: defaultOptions.presencePenalty,
      };
    }

    return {
      source: 'custom',
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1,
      ...(globalSettings.value.defaultOverrides || {}),
    };
  }

  function updateGlobalSettings(settings: Partial<GlobalLLMSettings>) {
    globalSettings.value = { ...globalSettings.value, ...settings };
  }

  function setConfigSource(taskId: string, source: LLMConfigSource, presetId?: string): boolean {
    const task = getTask(taskId);
    if (!task || task.status === 'running') return false;

    let newConfig: LLMTaskConfig;

    switch (source) {
      case 'global': {
        const configService = getGlobalConfigService();
        const defaultOptions = configService.getDefaultGenerateOptions();
        newConfig = {
          source: 'global',
          temperature: defaultOptions.temperature ?? 0.7,
          maxTokens: defaultOptions.maxTokens ?? 2048,
          topP: defaultOptions.topP ?? 1,
        };
        break;
      }
      case 'preset': {
        if (!presetId) return false;
        const preset = availablePresets.value.find((p) => p.id === presetId);
        if (!preset) return false;
        newConfig = {
          source: 'preset',
          presetId: preset.id,
          presetName: preset.name,
          temperature: preset.config.temperature ?? 0.7,
          maxTokens: preset.config.maxTokens ?? 2048,
          topP: preset.config.topP ?? 1,
        };
        break;
      }
      case 'custom': {
        newConfig = {
          source: 'custom',
          temperature: task.config.temperature ?? 0.7,
          maxTokens: task.config.maxTokens ?? 2048,
          topP: task.config.topP ?? 1,
        };
        break;
      }
      default:
        return false;
    }

    getService().updateTask(taskId, { config: newConfig });
    triggerUpdate();
    return true;
  }

  // ==================== 任务模板 ====================

  function getTemplates(): TaskTemplate[] {
    const service = getService();
    const systemTemplates = service.getTaskTemplatesByApp(WEIBO_APP_ID);

    if (systemTemplates.length > 0) {
      // 转换为旧的 TaskTemplate 格式以保持兼容性
      return systemTemplates.map((t) => ({
        id: t.id.replace(`${WEIBO_APP_ID}:`, ''),
        name: t.name,
        description: t.description,
        icon: t.icon || 'fa-file',
        category: t.category,
        type: t.type,
        executionMode: t.executionMode,
        prompt: t.promptTemplate,
        promptId: t.promptId,
        chainId: t.chainId,
        systemPrompt: t.systemPrompt,
        defaultInput: t.defaultInput as Record<string, any>,
        inputSchema: t.inputSchema?.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type as 'string' | 'number' | 'boolean' | 'select',
          required: f.required,
          defaultValue: f.defaultValue,
          options: f.options as Array<{ value: any; label: string }>,
          placeholder: f.placeholder,
        })),
        recommendedConfig: t.recommendedConfig,
        recommendedPriority: t.recommendedPriority,
        outputHandler: t.outputHandlerId?.replace(`${WEIBO_APP_ID}:`, '').replace('-handler', '') as any,
      }));
    }

    // 回退到本地模板
    return getAllWeiboTaskTemplates().map((t) => ({
      id: t.id.replace(`${WEIBO_APP_ID}:`, ''),
      name: t.name,
      description: t.description,
      icon: t.icon || 'fa-file',
      category: t.category,
      type: t.type,
      executionMode: t.executionMode,
      prompt: t.promptTemplate,
      promptId: t.promptId,
      chainId: t.chainId,
      systemPrompt: t.systemPrompt,
      defaultInput: t.defaultInput as Record<string, any>,
      inputSchema: t.inputSchema?.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type as 'string' | 'number' | 'boolean' | 'select',
        required: f.required,
        defaultValue: f.defaultValue,
        options: f.options as Array<{ value: any; label: string }>,
        placeholder: f.placeholder,
      })),
      recommendedConfig: t.recommendedConfig,
      recommendedPriority: t.recommendedPriority,
      outputHandler: t.outputHandlerId?.replace(`${WEIBO_APP_ID}:`, '').replace('-handler', '') as any,
    }));
  }

  function getTemplatesByCategory(category: TaskTemplate['category']): TaskTemplate[] {
    return getTemplates().filter((t) => t.category === category);
  }

  function createTaskFromTemplate(
    templateId: string,
    input?: Record<string, any>
  ): LLMTask | null {
    const service = getService();
    const fullTemplateId = templateId.startsWith(`${WEIBO_APP_ID}:`)
      ? templateId
      : `${WEIBO_APP_ID}:${templateId}`;

    let template = service.getTaskTemplate(fullTemplateId);

    // 回退到本地查找
    if (!template) {
      template = weiboTaskTemplates.find((t) => t.id === fullTemplateId || t.id === templateId);
    }

    if (!template) {
      console.warn(`[LLMTaskStore] 找不到模板: ${templateId}`);
      return null;
    }

    // 查找合适的任务定义作为基础
    const definitions = service.getTaskDefinitionsByApp(WEIBO_APP_ID);
    const suitableDefinition = definitions.find(
      (d) => d.type === template!.type && d.executionMode === template!.executionMode
    );

    if (!suitableDefinition) {
      console.warn(`[LLMTaskStore] 找不到模板对应的任务定义类型: ${template.type}`);
      return null;
    }

    try {
      const systemTask = service.createTask(suitableDefinition.id, {
        name: template.name,
        description: template.description,
        input: { ...template.defaultInput, ...input },
        config: template.recommendedConfig,
      });
      triggerUpdate();
      return systemTaskToWeiboTask(systemTask);
    } catch (e) {
      console.error('[LLMTaskStore] 从模板创建任务失败:', e);
      return null;
    }
  }

  // ==================== 任务 CRUD ====================

  function createTask(input: {
    name: string;
    description?: string;
    type: 'manual' | 'prompt' | 'chain';
    executionMode?: TaskExecutionMode;
    autoConfig?: AutoExecutionConfig;
    promptId?: string;
    chainId?: string;
    manualPrompt?: string;
    systemPrompt?: string;
    input?: Record<string, any>;
    config?: Partial<LLMTaskConfig>;
    priority?: RequestPriority;
    sourceApp?: string;
  }): LLMTask {
    const service = getService();
    const definitions = service.getTaskDefinitionsByApp(WEIBO_APP_ID);
    const suitableDefinition = definitions.find(
      (d) => d.type === input.type && d.executionMode === (input.executionMode || 'once')
    );

    if (!suitableDefinition) {
      throw new Error('找不到合适的任务定义');
    }

    const systemTask = service.createTask(suitableDefinition.id, {
      name: input.name,
      description: input.description,
      input: input.input,
      config: input.config,
      executionMode: input.executionMode,
      autoConfig: input.autoConfig,
    });

    triggerUpdate();
    return systemTaskToWeiboTask(systemTask);
  }

  function updateTask(id: string, updates: Partial<LLMTask>): boolean {
    const result = getService().updateTask(id, updates);
    if (result) triggerUpdate();
    return result;
  }

  function updateTaskInput(id: string, input: Record<string, any>): boolean {
    const task = getTask(id);
    if (!task) return false;

    const newInput = { ...task.input, ...input };
    const result = getService().updateTask(id, { input: newInput });
    if (result) triggerUpdate();
    return result;
  }

  function deleteTask(id: string): boolean {
    const result = getService().deleteTask(id);
    if (result) {
      if (selectedTaskId.value === id) {
        selectedTaskId.value = null;
      }
      triggerUpdate();
    }
    return result;
  }

  function duplicateTask(id: string): LLMTask | null {
    const newTask = getService().duplicateTask(id);
    if (newTask) {
      triggerUpdate();
      return systemTaskToWeiboTask(newTask);
    }
    return null;
  }

  // ==================== 自动执行管理 ====================

  function startAutoExecution(taskId: string): boolean {
    const result = getService().startAutoExecution(taskId);
    if (result) triggerUpdate();
    return result;
  }

  function stopAutoExecution(taskId: string): boolean {
    const result = getService().stopAutoExecution(taskId);
    if (result) triggerUpdate();
    return result;
  }

  function updateAutoConfig(taskId: string, config: Partial<AutoExecutionConfig>): boolean {
    const result = getService().updateAutoConfig(taskId, config);
    if (result) triggerUpdate();
    return result;
  }

  function updateExecutionMode(taskId: string, newMode: TaskExecutionMode): boolean {
    const task = getTask(taskId);
    if (!task || task.status === 'running') return false;

    // 如果从 auto 切换到其他模式，停止自动执行
    if (task.executionMode === 'auto' && newMode !== 'auto') {
      stopAutoExecution(taskId);
    }

    const updates: Partial<LLMTask> = {
      executionMode: newMode,
    };

    // 如果切换到 auto 模式，初始化 autoConfig
    if (newMode === 'auto' && !task.autoConfig) {
      updates.autoConfig = {
        enabled: false,
        intervalMinutes: 30,
        maxExecutions: 0,
        executionCount: 0,
      };
    }

    const result = getService().updateTask(taskId, updates);
    if (result) triggerUpdate();
    return result;
  }

  // ==================== 任务控制 ====================

  async function executeTask(id: string): Promise<boolean> {
    const result = await getService().executeTask(id);
    triggerUpdate();
    return result.success;
  }

  function pauseTask(id: string): boolean {
    const result = getService().pauseTask(id);
    if (result) triggerUpdate();
    return result;
  }

  async function resumeTask(id: string): Promise<boolean> {
    const result = await getService().resumeTask(id);
    triggerUpdate();
    return result;
  }

  function cancelTask(id: string): boolean {
    const result = getService().cancelTask(id);
    if (result) triggerUpdate();
    return result;
  }

  async function retryTask(id: string): Promise<boolean> {
    const result = await getService().retryTask(id);
    triggerUpdate();
    return result;
  }

  function cancelAllRunning(): number {
    const count = getService().cancelAllRunning();
    if (count > 0) triggerUpdate();
    return count;
  }

  // ==================== 配置更新 ====================

  function updateTaskConfig(id: string, config: Partial<LLMTaskConfig>): boolean {
    const task = getTask(id);
    if (!task) return false;

    const newConfig: LLMTaskConfig = {
      ...task.config,
      ...config,
      source: config.source ?? task.config.source,
    };

    const result = getService().updateTask(id, { config: newConfig });
    if (result) triggerUpdate();
    return result;
  }

  function updateTaskPriority(id: string, priority: RequestPriority): boolean {
    const result = getService().updateTask(id, { priority });
    if (result) triggerUpdate();
    return result;
  }

  // ==================== 过滤与选择 ====================

  function setFilter(newFilter: TaskFilter) {
    filter.value = newFilter;
  }

  function clearFilter() {
    filter.value = {};
  }

  function selectTask(id: string | null) {
    selectedTaskId.value = id;
  }

  function clearCompletedTasks() {
    const service = getService();
    const tasksToDelete = tasks.value.filter(
      (t) => !t.isBuiltin && (t.status === 'completed' || t.status === 'cancelled')
    );
    tasksToDelete.forEach((t) => service.deleteTask(t.id));
    triggerUpdate();
  }

  return {
    // 状态
    tasks,
    selectedTaskId,
    isLoading,
    filter,
    globalSettings,
    builtinTasksInitialized,
    narrativeCache,
    autoNarrativeAnalysisEnabled,

    // 计算属性
    selectedTask,
    filteredTasks,
    builtinTasks,
    userTasks,
    stats,
    runningTasks,
    pendingTasks,
    availablePresets,
    activeGlobalPreset,

    // 初始化
    initializeBuiltinTasks,
    getBuiltinDefinition,
    resetBuiltinTask,
    getNarrativeContext,

    // 配置管理
    getDefaultTaskConfig,
    updateGlobalSettings,
    setConfigSource,

    // 任务模板
    getTemplates,
    getTemplatesByCategory,
    createTaskFromTemplate,

    // 任务管理
    createTask,
    updateTask,
    updateTaskInput,
    deleteTask,
    duplicateTask,

    // 自动执行
    startAutoExecution,
    stopAutoExecution,
    updateAutoConfig,
    updateExecutionMode,

    // 任务控制
    executeTask,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    cancelAllRunning,

    // 配置更新
    updateTaskConfig,
    updateTaskPriority,

    // 日志管理
    addLog,
    getTaskLogs,
    clearTaskLogs,

    // 辅助方法
    setFilter,
    clearFilter,
    selectTask,
    clearCompletedTasks,
  };
});
