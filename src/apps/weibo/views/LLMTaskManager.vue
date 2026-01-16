<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useLLMTaskStore } from '../stores';
import { getLLMTaskService, type LLMTaskDefinition } from '@/services/llmTask';
import { PromptService } from '@/services/promptService';
import { useAIStore } from '@/stores/aiStore';
import { useDialogStore } from '@/stores/dialogStore';
import { RequestPriority } from '@/services/ai/types';
import type { 
  LLMTask, 
  LLMTaskStatus, 
  LLMTaskType, 
  LLMConfigSource, 
  TaskTemplate,
  TaskExecutionMode,
  BuiltinTaskDefinition,
} from '../types/llmTask';

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const taskStore = useLLMTaskStore();
const aiStore = useAIStore();
const dialog = useDialogStore();

// ==================== 状态 ====================

// 当前视图：list | detail | create | templates | settings
const currentView = ref<'list' | 'detail' | 'create' | 'templates' | 'settings'>('list');

// 创建任务表单
const createForm = ref({
  name: '',
  description: '',
  type: 'manual' as LLMTaskType,
  executionMode: 'once' as TaskExecutionMode,
  promptId: '',
  chainId: '',
  manualPrompt: '',
  systemPrompt: '',
  configSource: 'global' as LLMConfigSource,
  presetId: '',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  priority: RequestPriority.NORMAL,
  autoIntervalMinutes: 30,
});

// 模板输入变量
const templateInputs = ref<Record<string, any>>({});
const selectedTemplateId = ref<string | null>(null);

// 配置编辑
const isEditingConfig = ref(false);
const editingConfig = ref({
  source: 'custom' as LLMConfigSource,
  presetId: '',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
});

// 执行模式编辑
const isEditingExecutionMode = ref(false);
const editingExecutionMode = ref<TaskExecutionMode>('once');
const editingAutoInterval = ref(30);

// 任务输入编辑
const isEditingInput = ref(false);
const editingInput = ref<Record<string, any>>({});

// 过滤器状态
const showFilter = ref(false);
const filterStatus = ref<LLMTaskStatus[]>([]);
const filterType = ref<LLMTaskType[]>([]);
const filterMode = ref<TaskExecutionMode[]>([]);

// 列表视图模式
const listViewMode = ref<'all' | 'builtin' | 'custom'>('all');

// 分类筛选
const categoryFilter = ref<string>('all');

// ==================== 计算属性 ====================

const stats = computed(() => taskStore.stats);

// 获取任务的分类
function getTaskCategory(task: LLMTask): string {
  if (task.isBuiltin && task.builtinId) {
    // 优先从系统服务获取任务定义
    const service = getLLMTaskService();
    const definitionId = `weibo:${task.builtinId}`;
    const systemDef = service.getTaskDefinition(definitionId);
    if (systemDef?.category) {
      return systemDef.category;
    }
    return 'other';
  }
  return 'other';
}

// 按分类统计任务数量
const categoryStats = computed(() => {
  const stats: Record<string, number> = { all: 0, content: 0, trending: 0, user: 0, system: 0 };
  
  let baseTasks = taskStore.filteredTasks;
  if (listViewMode.value === 'builtin') {
    baseTasks = baseTasks.filter(t => t.isBuiltin);
  } else if (listViewMode.value === 'custom') {
    baseTasks = baseTasks.filter(t => !t.isBuiltin);
  }
  
  baseTasks.forEach(task => {
    stats.all++;
    const cat = getTaskCategory(task);
    if (stats[cat] !== undefined) {
      stats[cat]++;
    }
  });
  
  return stats;
});

const filteredTasks = computed(() => {
  let result = taskStore.filteredTasks;
  
  // 按列表视图模式过滤
  if (listViewMode.value === 'builtin') {
    result = result.filter(t => t.isBuiltin);
  } else if (listViewMode.value === 'custom') {
    result = result.filter(t => !t.isBuiltin);
  }
  
  // 按分类过滤
  if (categoryFilter.value !== 'all') {
    result = result.filter(t => getTaskCategory(t) === categoryFilter.value);
  }
  
  return result;
});

// 按分类分组的任务
const groupedTasks = computed(() => {
  const groups: Record<string, LLMTask[]> = {};
  
  filteredTasks.value.forEach(task => {
    const cat = getTaskCategory(task);
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(task);
  });
  
  // 按固定顺序返回
  const order = ['content', 'trending', 'user', 'system', 'other'];
  const result: Array<{ category: string; tasks: LLMTask[] }> = [];
  
  order.forEach(cat => {
    if (groups[cat] && groups[cat].length > 0) {
      result.push({ category: cat, tasks: groups[cat] });
    }
  });
  
  return result;
});
const selectedTask = computed(() => taskStore.selectedTask);
const runningTasks = computed(() => taskStore.runningTasks);
const availablePresets = computed(() => taskStore.availablePresets);
const activeGlobalPreset = computed(() => taskStore.activeGlobalPreset);
const globalSettings = computed(() => taskStore.globalSettings);
const templates = computed(() => taskStore.getTemplates());
const builtinTasks = computed(() => taskStore.builtinTasks);

// 状态颜色映射
const statusColors: Record<LLMTaskStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-600',
  running: 'bg-blue-100 text-blue-600',
  completed: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
  paused: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

// 分类配置
const categoryConfig: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  all: { label: '全部', icon: 'fa-th-large', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  content: { label: '内容生成', icon: 'fa-pen-fancy', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  trending: { label: '热榜管理', icon: 'fa-fire-alt', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  user: { label: '用户生成', icon: 'fa-user-circle', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  system: { label: '系统', icon: 'fa-cog', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

// 状态标签映射
const statusLabels: Record<LLMTaskStatus, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
  cancelled: '已取消',
};

// 类型标签映射
const typeLabels: Record<LLMTaskType, string> = {
  prompt: '提示词',
  chain: '提示词链',
  manual: '手动输入',
};

// 执行模式标签
const executionModeLabels: Record<TaskExecutionMode, string> = {
  once: '一次性',
  repeatable: '可重复',
  auto: '自动循环',
};

const executionModeIcons: Record<TaskExecutionMode, string> = {
  once: 'fa-play-circle',
  repeatable: 'fa-redo',
  auto: 'fa-sync',
};

const executionModeColors: Record<TaskExecutionMode, string> = {
  once: 'text-gray-500',
  repeatable: 'text-blue-500',
  auto: 'text-green-500',
};

// 配置来源标签
const configSourceLabels: Record<LLMConfigSource, string> = {
  global: '全局配置',
  preset: 'API 预设',
  custom: '自定义',
};

// 优先级选项
const priorityOptions = [
  { value: RequestPriority.CRITICAL, label: '紧急', color: 'text-red-500' },
  { value: RequestPriority.HIGH, label: '高', color: 'text-orange-500' },
  { value: RequestPriority.NORMAL, label: '普通', color: 'text-blue-500' },
  { value: RequestPriority.LOW, label: '低', color: 'text-gray-500' },
];

// 选中的模板
const selectedTemplate = computed(() => {
  if (!selectedTemplateId.value) return null;
  return templates.value.find(t => t.id === selectedTemplateId.value);
});

// 当前任务的内置定义
const currentBuiltinDefinition = computed(() => {
  if (!selectedTask.value?.builtinId) return null;
  
  // 优先从系统服务获取
  const service = getLLMTaskService();
  const definitionId = `weibo:${selectedTask.value.builtinId}`;
  const systemDef = service.getTaskDefinition(definitionId);
  
  if (systemDef) {
    // 转换为旧格式以保持兼容
    return {
      builtinId: selectedTask.value.builtinId,
      name: systemDef.name,
      description: systemDef.description,
      icon: systemDef.icon,
      category: systemDef.category,
      type: systemDef.type,
      executionMode: systemDef.executionMode,
      prompt: systemDef.promptTemplate,
      promptId: systemDef.promptId,
      chainId: systemDef.chainId,
      systemPrompt: systemDef.systemPrompt,
      inputSchema: systemDef.inputSchema,
      defaultInput: systemDef.defaultInput,
      config: systemDef.config,
      priority: systemDef.priority,
    };
  }
  
  // 回退到旧的 BUILTIN_TASKS
  return taskStore.getBuiltinDefinition(selectedTask.value.builtinId);
});

// 获取上下文变量（时间、日期等）
function getContextVariables(): Record<string, string> {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const hour = now.getHours();
  
  // 时段描述
  let timePeriod = '';
  if (hour >= 5 && hour < 9) timePeriod = '清晨';
  else if (hour >= 9 && hour < 12) timePeriod = '上午';
  else if (hour >= 12 && hour < 14) timePeriod = '中午';
  else if (hour >= 14 && hour < 18) timePeriod = '下午';
  else if (hour >= 18 && hour < 22) timePeriod = '晚上';
  else timePeriod = '深夜';
  
  // 工作日/周末
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const dayType = isWeekend ? '周末' : '工作日';
  
  return {
    // 时间相关
    currentTime: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    currentDate: now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
    currentWeekday: weekdays[now.getDay()],
    timePeriod,
    dayType,
    fullDateTime: `${now.toLocaleDateString('zh-CN')} ${weekdays[now.getDay()]} ${timePeriod}`,
  };
}

// 渲染后的提示词预览
const renderedPromptPreview = computed(() => {
  if (!selectedTask.value) return null;
  
  const task = selectedTask.value;
  let userPrompt = '';
  let systemPrompt = task.systemPrompt || '';
  
  // 获取上下文变量
  const contextVars = getContextVariables();
  
  // 获取用户提示词
  if (task.type === 'manual') {
    if (task.isBuiltin && task.builtinId) {
      // 内置任务：从系统服务获取定义
      const service = getLLMTaskService();
      const definitionId = `weibo:${task.builtinId}`;
      const systemDef = service.getTaskDefinition(definitionId);
      
      if (systemDef && systemDef.type === 'manual' && systemDef.promptTemplate) {
        userPrompt = systemDef.promptTemplate;
        systemPrompt = systemDef.systemPrompt || systemPrompt;
        
        // 替换输入变量
        const input = task.input || {};
        for (const [key, value] of Object.entries(input)) {
          let finalValue = String(value);
          
          // 特殊处理时间上下文变量
          if (key === 'timeContext' && (value === '当前时间' || value === '')) {
            finalValue = contextVars.fullDateTime;
          }
          
          userPrompt = userPrompt.replace(new RegExp(`{{${key}}}`, 'g'), finalValue);
        }
      } else {
        // 回退到旧的方式
        const definition = taskStore.getBuiltinDefinition(task.builtinId) as LLMTaskDefinition | undefined;
        if (definition && definition.type === 'manual' && definition.promptTemplate) {
          userPrompt = definition.promptTemplate;
          systemPrompt = definition.systemPrompt || systemPrompt;
          
          const input = task.input || {};
          for (const [key, value] of Object.entries(input)) {
            let finalValue = String(value);
            if (key === 'timeContext' && (value === '当前时间' || value === '')) {
              finalValue = contextVars.fullDateTime;
            }
            userPrompt = userPrompt.replace(new RegExp(`{{${key}}}`, 'g'), finalValue);
          }
        } else {
          userPrompt = task.manualPrompt || '';
        }
      }
    } else {
      // 自定义任务：直接使用 manualPrompt
      userPrompt = task.manualPrompt || '';
    }
  } else if (task.type === 'prompt') {
    // prompt 类型：从任务定义获取 promptId，然后从 PromptService 获取模板
    let promptId = '';
    if (task.isBuiltin && task.builtinId) {
      const service = getLLMTaskService();
      const definitionId = `weibo:${task.builtinId}`;
      const systemDef = service.getTaskDefinition(definitionId);
      promptId = systemDef?.promptId || '';
    }
    
    if (promptId) {
      // 提示词 ID 格式：注册时变为 app.{appId}.{scene}
      // 尝试多种格式查找
      let promptTemplate = PromptService.getPromptById(promptId);
      if (!promptTemplate) {
        // 尝试 app.weibo.{promptId} 格式
        promptTemplate = PromptService.getPromptById(`app.weibo.${promptId}`);
      }
      if (!promptTemplate) {
        // 尝试通过 scene 查找
        promptTemplate = PromptService.getPromptByScene(promptId);
      }
      
      if (promptTemplate) {
        userPrompt = promptTemplate.template;
        systemPrompt = promptTemplate.systemPrompt || systemPrompt;
        
        // 替换输入变量
        const input = task.input || {};
        for (const [key, value] of Object.entries(input)) {
          let finalValue = String(value);
          if (key === 'timeContext' && (value === '当前时间' || value === '')) {
            finalValue = contextVars.fullDateTime;
          }
          userPrompt = userPrompt.replace(new RegExp(`{{${key}}}`, 'g'), finalValue);
        }
      } else {
        userPrompt = `[提示词模板未找到: ${promptId}]`;
      }
    } else {
      userPrompt = '[未配置提示词模板]';
    }
  } else if (task.type === 'chain' || task.chainId) {
    userPrompt = `[使用提示词链: ${task.chainId || '未指定'}]`;
  }
  
  // 计算上下文增强信息
  const contextEnhancements: string[] = [];
  if (userPrompt.includes(contextVars.fullDateTime)) {
    contextEnhancements.push(`时间: ${contextVars.fullDateTime}`);
  }
  
  return {
    systemPrompt,
    userPrompt,
    hasUnreplacedVars: userPrompt.includes('{{') && userPrompt.includes('}}'),
    contextEnhancements,
  };
});

// 是否展开提示词预览
const isPromptPreviewExpanded = ref(false);

// ==================== 生命周期 ====================

onMounted(async () => {
  // 初始化 AI Store
  if (!aiStore.initialized) {
    await aiStore.initialize();
  }
  
  // 初始化内置任务
  taskStore.initializeBuiltinTasks();
});

// 监听过滤器变化
watch([filterStatus, filterType, filterMode], () => {
  taskStore.setFilter({
    status: filterStatus.value.length > 0 ? filterStatus.value : undefined,
    type: filterType.value.length > 0 ? filterType.value : undefined,
    executionMode: filterMode.value.length > 0 ? filterMode.value : undefined,
  });
});

// ==================== 导航操作 ====================

function handleBack() {
  if (currentView.value === 'list') {
    emit('back');
  } else {
    handleBackToList();
  }
}

function handleBackToList() {
  taskStore.selectTask(null);
  selectedTemplateId.value = null;
  isEditingConfig.value = false;
  isEditingInput.value = false;
  isEditingExecutionMode.value = false;
  currentView.value = 'list';
}

// ==================== 任务操作 ====================

function handleSelectTask(task: LLMTask) {
  taskStore.selectTask(task.id);
  isEditingConfig.value = false;
  isEditingInput.value = false;
  isEditingExecutionMode.value = false;
  currentView.value = 'detail';
}

function handleCreateTask() {
  resetCreateForm();
  currentView.value = 'create';
}

function handleShowTemplates() {
  selectedTemplateId.value = null;
  templateInputs.value = {};
  currentView.value = 'templates';
}

function handleShowSettings() {
  currentView.value = 'settings';
}

function resetCreateForm() {
  const defaultConfig = taskStore.getDefaultTaskConfig();
  createForm.value = {
    name: '',
    description: '',
    type: 'manual',
    executionMode: 'once',
    promptId: '',
    chainId: '',
    manualPrompt: '',
    systemPrompt: '',
    configSource: defaultConfig.source,
    presetId: defaultConfig.presetId || '',
    temperature: defaultConfig.temperature ?? 0.7,
    maxTokens: defaultConfig.maxTokens ?? 2048,
    topP: defaultConfig.topP ?? 1,
    priority: RequestPriority.NORMAL,
    autoIntervalMinutes: 30,
  };
}

async function submitCreateTask() {
  if (!createForm.value.name.trim()) {
    await dialog.alert({ title: '提示', message: '请输入任务名称', icon: 'warning' });
    return;
  }
  
  if (createForm.value.type === 'manual' && !createForm.value.manualPrompt.trim()) {
    await dialog.alert({ title: '提示', message: '请输入提示词内容', icon: 'warning' });
    return;
  }
  
  const task = taskStore.createTask({
    name: createForm.value.name,
    description: createForm.value.description,
    type: createForm.value.type,
    executionMode: createForm.value.executionMode,
    autoConfig: createForm.value.executionMode === 'auto' ? {
      enabled: false,
      intervalMinutes: createForm.value.autoIntervalMinutes,
      maxExecutions: 0,
      executionCount: 0,
    } : undefined,
    promptId: createForm.value.type === 'prompt' ? createForm.value.promptId : undefined,
    chainId: createForm.value.type === 'chain' ? createForm.value.chainId : undefined,
    manualPrompt: createForm.value.type === 'manual' ? createForm.value.manualPrompt : undefined,
    systemPrompt: createForm.value.systemPrompt || undefined,
    config: {
      source: createForm.value.configSource,
      presetId: createForm.value.configSource === 'preset' ? createForm.value.presetId : undefined,
      temperature: createForm.value.temperature,
      maxTokens: createForm.value.maxTokens,
      topP: createForm.value.topP,
    },
    priority: createForm.value.priority,
    sourceApp: 'weibo',
  });
  
  taskStore.selectTask(task.id);
  currentView.value = 'detail';
}

// ==================== 模板操作 ====================

function handleSelectTemplate(template: TaskTemplate) {
  selectedTemplateId.value = template.id;
  templateInputs.value = { ...(template.defaultInput || {}) };
}

async function createFromTemplate() {
  if (!selectedTemplateId.value) return;
  
  const task = taskStore.createTaskFromTemplate(
    selectedTemplateId.value,
    templateInputs.value
  );
  
  if (task) {
    taskStore.selectTask(task.id);
    currentView.value = 'detail';
  }
}

async function createAndExecuteFromTemplate() {
  if (!selectedTemplateId.value) return;
  
  const task = taskStore.createTaskFromTemplate(
    selectedTemplateId.value,
    templateInputs.value
  );
  
  if (task) {
    taskStore.selectTask(task.id);
    currentView.value = 'detail';
    await taskStore.executeTask(task.id);
  }
}

// ==================== 任务控制 ====================

async function handleExecuteTask(taskId: string) {
  await taskStore.executeTask(taskId);
}

function handlePauseTask(taskId: string) {
  taskStore.pauseTask(taskId);
}

async function handleResumeTask(taskId: string) {
  await taskStore.resumeTask(taskId);
}

async function handleCancelTask(taskId: string) {
  const confirmed = await dialog.confirm({
    title: '确认取消',
    message: '确定要取消这个任务吗？',
    confirmType: 'danger',
  });
  if (confirmed) {
    taskStore.cancelTask(taskId);
  }
}

async function handleRetryTask(taskId: string) {
  await taskStore.retryTask(taskId);
}

async function handleDeleteTask(taskId: string) {
  const task = taskStore.tasks.find(t => t.id === taskId);
  if (task?.isBuiltin) {
    await dialog.alert({ 
      title: '无法删除', 
      message: '内置任务不能删除，但可以重置为默认配置', 
      icon: 'warning' 
    });
    return;
  }
  
  const confirmed = await dialog.confirm({
    title: '确认删除',
    message: '确定要删除这个任务吗？删除后无法恢复。',
    confirmType: 'danger',
  });
  if (confirmed) {
    taskStore.deleteTask(taskId);
    if (currentView.value === 'detail') {
      currentView.value = 'list';
    }
  }
}

function handleDuplicateTask(taskId: string) {
  const newTask = taskStore.duplicateTask(taskId);
  if (newTask) {
    taskStore.selectTask(newTask.id);
  }
}

async function handleResetBuiltinTask(taskId: string) {
  const confirmed = await dialog.confirm({
    title: '重置任务',
    message: '确定要将此任务重置为默认配置吗？当前的输入参数将被清空。',
  });
  if (confirmed) {
    taskStore.resetBuiltinTask(taskId);
  }
}

async function handleCancelAll() {
  const confirmed = await dialog.confirm({
    title: '确认取消全部',
    message: '确定要取消所有进行中的任务吗？',
    confirmType: 'danger',
  });
  if (confirmed) {
    const count = taskStore.cancelAllRunning();
    await dialog.alert({ title: '操作完成', message: `已取消 ${count} 个任务`, icon: 'success' });
  }
}

async function handleClearCompleted() {
  const confirmed = await dialog.confirm({
    title: '确认清除',
    message: '确定要清除所有已完成的用户任务吗？（内置任务不会被清除）',
  });
  if (confirmed) {
    taskStore.clearCompletedTasks();
  }
}

// ==================== 自动执行控制 ====================

async function toggleAutoExecution(taskId: string) {
  const task = taskStore.tasks.find(t => t.id === taskId);
  if (!task || task.executionMode !== 'auto') return;
  
  if (task.autoConfig?.enabled) {
    taskStore.stopAutoExecution(taskId);
  } else {
    const confirmed = await dialog.confirm({
      title: '启动自动执行',
      message: `将每 ${task.autoConfig?.intervalMinutes || 30} 分钟自动执行一次此任务。\n是否立即开始？`,
      confirmText: '启动',
    });
    if (confirmed) {
      taskStore.startAutoExecution(taskId);
    }
  }
}

function updateAutoInterval(taskId: string, minutes: number) {
  // 限制范围：1-1440 分钟（1分钟到24小时）
  const clampedMinutes = Math.max(1, Math.min(1440, minutes));
  taskStore.updateAutoConfig(taskId, { intervalMinutes: clampedMinutes });
}

// 数字增减辅助函数
function adjustNumber(currentValue: number, delta: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, currentValue + delta));
}

// 调整自动执行间隔
function adjustAutoInterval(taskId: string, delta: number) {
  const task = taskStore.tasks.find(t => t.id === taskId);
  if (!task?.autoConfig) return;
  const newValue = adjustNumber(task.autoConfig.intervalMinutes, delta, 1, 1440);
  updateAutoInterval(taskId, newValue);
}

// 调整输入参数中的数字
function adjustInputNumber(fieldName: string, delta: number, min: number = 1, max: number = 100) {
  const currentValue = Number(editingInput.value[fieldName]) || min;
  editingInput.value[fieldName] = adjustNumber(currentValue, delta, min, max);
}

// 调整创建表单中的数字
function adjustFormNumber(field: 'autoIntervalMinutes' | 'temperature' | 'maxTokens', delta: number) {
  switch (field) {
    case 'autoIntervalMinutes':
      createForm.value.autoIntervalMinutes = adjustNumber(
        createForm.value.autoIntervalMinutes, delta, 1, 1440
      );
      break;
    case 'temperature':
      createForm.value.temperature = Math.round(
        adjustNumber(createForm.value.temperature * 10, delta, 0, 20)
      ) / 10;
      break;
    case 'maxTokens':
      createForm.value.maxTokens = adjustNumber(
        createForm.value.maxTokens, delta, 100, 32000
      );
      break;
  }
}

// 调整模板输入参数
function adjustTemplateInput(fieldName: string, delta: number, min: number = 1, max: number = 100) {
  const currentValue = Number(templateInputs.value[fieldName]) || min;
  templateInputs.value[fieldName] = adjustNumber(currentValue, delta, min, max);
}

// ==================== 输入编辑 ====================

function startEditInput() {
  if (!selectedTask.value) return;
  editingInput.value = { ...selectedTask.value.input };
  isEditingInput.value = true;
}

function saveInput() {
  if (!selectedTask.value) return;
  taskStore.updateTaskInput(selectedTask.value.id, editingInput.value);
  isEditingInput.value = false;
}

function cancelEditInput() {
  isEditingInput.value = false;
}

// ==================== 配置编辑 ====================

function startEditConfig() {
  if (!selectedTask.value) return;
  
  editingConfig.value = {
    source: selectedTask.value.config.source,
    presetId: selectedTask.value.config.presetId ?? '',
    temperature: selectedTask.value.config.temperature ?? 0.7,
    maxTokens: selectedTask.value.config.maxTokens ?? 2048,
    topP: selectedTask.value.config.topP ?? 1,
    frequencyPenalty: selectedTask.value.config.frequencyPenalty ?? 0,
    presencePenalty: selectedTask.value.config.presencePenalty ?? 0,
  };
  isEditingConfig.value = true;
}

function saveConfig() {
  if (!selectedTask.value) return;
  
  if (editingConfig.value.source === 'preset') {
    taskStore.setConfigSource(
      selectedTask.value.id,
      'preset',
      editingConfig.value.presetId
    );
  } else {
    taskStore.updateTaskConfig(selectedTask.value.id, {
      source: editingConfig.value.source,
      temperature: editingConfig.value.temperature,
      maxTokens: editingConfig.value.maxTokens,
      topP: editingConfig.value.topP,
      frequencyPenalty: editingConfig.value.frequencyPenalty,
      presencePenalty: editingConfig.value.presencePenalty,
    });
  }
  isEditingConfig.value = false;
}

function cancelEditConfig() {
  isEditingConfig.value = false;
}

// ==================== 执行模式编辑 ====================

function startEditExecutionMode() {
  if (!selectedTask.value) return;
  editingExecutionMode.value = selectedTask.value.executionMode;
  editingAutoInterval.value = selectedTask.value.autoConfig?.intervalMinutes || 30;
  isEditingExecutionMode.value = true;
}

function saveExecutionMode() {
  if (!selectedTask.value) return;
  
  // 更新执行模式
  const success = taskStore.updateExecutionMode(selectedTask.value.id, editingExecutionMode.value);
  
  if (success && editingExecutionMode.value === 'auto') {
    // 如果切换到自动模式，同时更新间隔配置
    taskStore.updateAutoConfig(selectedTask.value.id, {
      intervalMinutes: editingAutoInterval.value,
    });
  }
  
  isEditingExecutionMode.value = false;
}

function cancelEditExecutionMode() {
  isEditingExecutionMode.value = false;
}

// 调整编辑中的自动执行间隔
function adjustEditingAutoInterval(delta: number) {
  editingAutoInterval.value = adjustNumber(editingAutoInterval.value, delta, 1, 1440);
}

// ==================== 全局设置 ====================

function updateGlobalSettingSource(useGlobal: boolean) {
  taskStore.updateGlobalSettings({
    useGlobalAsDefault: useGlobal,
  });
}

function updateDefaultPreset(presetId: string) {
  taskStore.updateGlobalSettings({
    useGlobalAsDefault: false,
    defaultPresetId: presetId || undefined,
  });
}

// ==================== 辅助方法 ====================

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatNextExecution(timestamp?: number): string {
  if (!timestamp) return '-';
  const now =Date.now();
  const diff = timestamp - now;
  if (diff < 0) return '即将执行';
  if (diff < 60000) return `${Math.ceil(diff / 1000)}秒后`;
  if (diff < 3600000) return `${Math.ceil(diff / 60000)}分钟后`;
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getPriorityLabel(priority: RequestPriority): string {
  return priorityOptions.find(p => p.value === priority)?.label || '普通';
}

function getPriorityColor(priority: RequestPriority): string {
  return priorityOptions.find(p => p.value === priority)?.color || 'text-gray-500';
}

function getConfigSourceLabel(source: LLMConfigSource): string {
  return configSourceLabels[source] || source;
}

function toggleFilterStatus(status: LLMTaskStatus) {
  const index = filterStatus.value.indexOf(status);
  if (index === -1) {
    filterStatus.value.push(status);
  } else {
    filterStatus.value.splice(index, 1);
  }
}

function toggleFilterType(type: LLMTaskType) {
  const index = filterType.value.indexOf(type);
  if (index === -1) {
    filterType.value.push(type);
  } else {
    filterType.value.splice(index, 1);
  }
}

function toggleFilterMode(mode: TaskExecutionMode) {
  const index = filterMode.value.indexOf(mode);
  if (index === -1) {
    filterMode.value.push(mode);
  } else {
    filterMode.value.splice(index, 1);
  }
}

function clearFilters() {
  filterStatus.value = [];
  filterType.value = [];
  filterMode.value = [];
  taskStore.clearFilter();
}

function getViewTitle(): string {
  switch (currentView.value) {
    case 'list': return 'LLM 任务管理';
    case 'detail': return '任务详情';
    case 'create': return '创建任务';
    case 'templates': return '任务模板';
    case 'settings': return 'LLM 设置';
    default: return 'LLM 任务管理';
  }
}

function getTaskIcon(task: LLMTask): string {
  if (task.isBuiltin && task.builtinId) {
    // 优先从系统服务获取任务定义
    const service = getLLMTaskService();
    const definitionId = `weibo:${task.builtinId}`;
    const systemDef = service.getTaskDefinition(definitionId);
    if (systemDef?.icon) {
      return systemDef.icon;
    }
    return 'fa-tasks';
  }
  return 'fa-tasks';
}

function getCategoryLabel(category: string): string {
  return categoryConfig[category]?.label || category;
}

function getCategoryIcon(category: string): string {
  return categoryConfig[category]?.icon || 'fa-folder';
}

function getCategoryColor(category: string): string {
  return categoryConfig[category]?.color || 'text-gray-600';
}

function getCategoryBgColor(category: string): string {
  return categoryConfig[category]?.bgColor || 'bg-gray-100';
}

// 复制到剪贴板
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 备用方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
</script>

<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center z-10">
      <button @click="handleBack" class="mr-3">
        <i class="fas fa-arrow-left text-gray-600"></i>
      </button>
      <h1 class="text-lg font-medium text-gray-800 flex-1">{{ getViewTitle() }}</h1>
      
      <!-- 列表视图操作按钮 -->
      <template v-if="currentView === 'list'">
        <button
          @click="handleShowSettings"
          class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 mr-2"
          title="LLM 设置"
        >
          <i class="fas fa-cog"></i>
        </button>
        <button
          @click="showFilter = !showFilter"
          :class="[
            'w-8 h-8 items-center justify-center mr-2',
            (filterStatus.length > 0 || filterType.length > 0 || filterMode.length > 0) ? 'bg-orange-100 text-orange-500' : 'text-gray-500'
          ]"
        >
          <i class="fas fa-filter"></i>
        </button>
        <button
          @click="handleShowTemplates"
          class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mr-2"
          title="任务模板"
        >
          <i class="fas fa-magic"></i>
        </button>
        <button
          @click="handleCreateTask"
          class="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center"
        >
          <i class="fas fa-plus"></i>
        </button>
      </template>
    </div>

    <!-- ==================== 列表视图 ==================== -->
    <div v-if="currentView === 'list'" class="flex-1 overflow-y-auto">
      <!-- 统计卡片 -->
      <div class="bg-white p-4 border-b border-gray-100">
        <div class="grid grid-cols-4 gap-4 text-center">
          <div>
            <div class="text-2xl font-bold text-gray-800">{{ stats.total }}</div>
            <div class="text-xs text-gray-400">总任务</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-blue-500">{{ stats.running }}</div>
            <div class="text-xs text-gray-400">运行中</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-green-500">{{ stats.autoRunningCount }}</div>
            <div class="text-xs text-gray-400">自动执行</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-orange-500">{{ stats.builtinCount }}</div>
            <div class="text-xs text-gray-400">内置任务</div>
          </div>
        </div>
        
        <!-- 视图切换 -->
        <div class="flex gap-2 mt-4">
          <button
            v-for="mode in (['all', 'builtin', 'custom'] as const)"
            :key="mode"
            @click="listViewMode = mode; categoryFilter = 'all'"
            :class="[
              'flex-1 py-2 rounded-lg text-sm transition-colors',
              listViewMode === mode
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600'
            ]"
          >
            {{ mode === 'all' ? '全部' : mode === 'builtin' ? '内置任务' : '自定义' }}
          </button>
        </div>
        
        <!-- 分类筛选（仅在内置任务模式下显示） -->
        <div v-if="listViewMode === 'builtin' || listViewMode === 'all'" class="mt-3">
          <div class="flex gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="cat in ['all', 'content', 'trending', 'user', 'system']"
              :key="cat"
              @click="categoryFilter = cat"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors',
                categoryFilter === cat
                  ? getCategoryBgColor(cat) + ' ' + getCategoryColor(cat) + ' font-medium'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              ]"
            >
              <i :class="['fas', getCategoryIcon(cat), 'text-[10px]']"></i>
              <span>{{ getCategoryLabel(cat) }}</span>
              <span v-if="categoryStats[cat] > 0" class="ml-0.5 opacity-70">
                ({{ categoryStats[cat] }})
              </span>
            </button>
          </div>
        </div>
        
        <!-- 快捷操作 -->
        <div class="flex gap-2 mt-3">
          <button
            @click="handleCancelAll"
            :disabled="runningTasks.length === 0"
            :class="[
              'flex-1 py-2 rounded-lg text-sm transition-colors',
              runningTasks.length > 0
                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            ]"
          >
            <i class="fas fa-stop-circle mr-1"></i>
            取消全部
          </button>
          <button
            @click="handleClearCompleted"
            :disabled="stats.completed === 0 && stats.cancelled === 0"
            :class="[
              'flex-1 py-2 rounded-lg text-sm transition-colors',
              (stats.completed > 0 || stats.cancelled > 0)
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            ]"
          >
            <i class="fas fa-trash-alt mr-1"></i>
            清除完成
          </button>
        </div>
      </div>

      <!-- 过滤器面板 -->
      <div v-if="showFilter" class="bg-white border-b border-gray-100 p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium text-gray-700">过滤器</span>
          <button @click="clearFilters" class="text-xs text-orange-500">
            清除全部
          </button>
        </div>
        
        <!-- 状态过滤 -->
        <div class="mb-3">
          <div class="text-xs text-gray-400 mb-2">状态</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(label, status) in statusLabels"
              :key="status"
              @click="toggleFilterStatus(status as LLMTaskStatus)"
              :class="[
                'px-3 py-1 rounded-full text-xs transition-colors',
                filterStatus.includes(status as LLMTaskStatus)
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              ]"
            >
              {{ label }}
            </button>
          </div>
        </div>
        
        <!-- 执行模式过滤 -->
        <div>
          <div class="text-xs text-gray-400 mb-2">执行模式</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(label, mode) in executionModeLabels"
              :key="mode"
              @click="toggleFilterMode(mode as TaskExecutionMode)"
              :class="[
                'px-3 py-1 rounded-full text-xs transition-colors',
                filterMode.includes(mode as TaskExecutionMode)
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              ]"
            >
              <i :class="['fas', executionModeIcons[mode as TaskExecutionMode], 'mr-1']"></i>
              {{ label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 任务列表 -->
      <div class="divide-y divide-gray-100">
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          @click="handleSelectTask(task)"
          class="bg-white px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <!-- 任务图标 -->
                <i :class="['fas', getTaskIcon(task), 'text-gray-400']"></i>
                
                <!-- 任务名称 -->
                <span class="text-sm font-medium text-gray-800 truncate">{{ task.name }}</span>
                
                <!-- 分类标签 -->
                <span 
                  v-if="task.isBuiltin" 
                  :class="['px-1.5 py-0.5 rounded text-[10px]', getCategoryBgColor(getTaskCategory(task)), getCategoryColor(getTaskCategory(task))]"
                >
                  {{ getCategoryLabel(getTaskCategory(task)) }}
                </span>
                
                <!-- 自定义任务标签 -->
                <span v-else class="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">
                  自定义
                </span>
                
                <!-- 状态标签 -->
                <span :class="['px-1.5 py-0.5 rounded text-[10px]', statusColors[task.status]]">
                  {{ statusLabels[task.status] }}
                </span>
                
                <!-- 自动执行标记 -->
                <span v-if="task.executionMode === 'auto' && task.autoConfig?.enabled" 
                  class="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-600 flex items-center gap-1"
                >
                  <i class="fas fa-sync fa-spin text-[8px]"></i>
                  自动
                </span>
              </div>
              
              <div class="flex items-center gap-3 text-xs text-gray-400">
                <!-- 执行模式 -->
                <span :class="executionModeColors[task.executionMode]">
                  <i :class="['fas', executionModeIcons[task.executionMode], 'mr-1']"></i>
                  {{ executionModeLabels[task.executionMode] }}
                </span>
                
                <!-- 执行次数 -->
                <span v-if="task.totalExecutions > 0">
                  执行 {{ task.totalExecutions }} 次
                </span>
                
                <!-- 下次执行时间 -->
                <span v-if="task.executionMode === 'auto' && task.autoConfig?.enabled && task.autoConfig?.nextExecutionAt"
                  class="text-green-500"
                >
                  {{ formatNextExecution(task.autoConfig.nextExecutionAt) }}
                </span>
                
                <span v-else>{{ formatTime(task.createdAt) }}</span>
              </div>
            </div>
            
            <!-- 快捷操作 -->
            <div class="flex items-center gap-2 ml-2">
              <!-- 自动任务：开关 -->
              <button
                v-if="task.executionMode === 'auto'"
                @click.stop="toggleAutoExecution(task.id)"
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  task.autoConfig?.enabled
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'
                ]"
                :title="task.autoConfig?.enabled ? '停止自动执行' : '启动自动执行'"
              >
                <i :class="['fas', task.autoConfig?.enabled ? 'fa-pause' : 'fa-play', 'text-xs']"></i>
              </button>
              
              <!-- 普通任务：执行按钮 -->
              <template v-else>
                <button
                  v-if="task.status === 'pending' || task.status === 'completed' && task.executionMode === 'repeatable'"
                  @click.stop="handleExecuteTask(task.id)"
                  class="w-8 h-8 rounded-full bg-green-50 text-green-500 flex items-center justify-center hover:bg-green-100"
                >
                  <i class="fas fa-play text-xs"></i>
                </button>
                <button
                  v-else-if="task.status === 'running'"
                  @click.stop="handlePauseTask(task.id)"
                  class="w-8 h-8 rounded-full bg-yellow-50 text-yellow-500 flex items-center justify-center hover:bg-yellow-100"
                >
                  <i class="fas fa-pause text-xs"></i>
                </button>
                <button
                  v-else-if="task.status === 'paused'"
                  @click.stop="handleResumeTask(task.id)"
                  class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100"
                >
                  <i class="fas fa-play text-xs"></i>
                </button>
                <button
                  v-else-if="task.status === 'failed'"
                  @click.stop="handleRetryTask(task.id)"
                  class="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center hover:bg-orange-100"
                >
                  <i class="fas fa-redo text-xs"></i>
                </button>
              </template>
              
              <i class="fas fa-chevron-right text-gray-300 text-xs"></i>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="filteredTasks.length === 0" class="py-12 text-center">
          <i class="fas fa-tasks text-4xl text-gray-300 mb-3"></i>
          <p class="text-sm text-gray-400">
            {{ listViewMode === 'builtin' ? '内置任务加载中...' : '暂无任务' }}
          </p>
          <div v-if="listViewMode !== 'builtin'" class="flex gap-2 justify-center mt-4">
            <button
              @click="handleShowTemplates"
              class="px-4 py-2 bg-blue-50 text-blue-500 rounded-lg text-sm"
            >
              <i class="fas fa-magic mr-1"></i>
              使用模板
            </button>
            <button
              @click="handleCreateTask"
              class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm"
            >
              <i class="fas fa-plus mr-1"></i>
              自定义创建
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 详情视图 ==================== -->
    <div v-else-if="currentView === 'detail' && selectedTask" class="flex-1 overflow-y-auto">
      <!-- 基本信息 -->
      <div class="bg-white p-4 border-b border-gray-100">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i :class="['fas', getTaskIcon(selectedTask), 'text-orange-500']"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-lg font-medium text-gray-800">{{ selectedTask.name }}</h2>
                <!-- 分类标签 -->
                <span 
                  v-if="selectedTask.isBuiltin" 
                  :class="['px-1.5 py-0.5 rounded text-[10px]', getCategoryBgColor(getTaskCategory(selectedTask)), getCategoryColor(getTaskCategory(selectedTask))]"
                >
                  {{ getCategoryLabel(getTaskCategory(selectedTask)) }}
                </span>
                <span v-else class="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">
                  自定义
                </span>
              </div>
              <p v-if="selectedTask.description" class="text-sm text-gray-500 mt-1">
                {{ selectedTask.description }}
              </p>
            </div>
          </div>
          <span :class="['px-2 py-1 rounded text-xs', statusColors[selectedTask.status]]">
            {{ statusLabels[selectedTask.status] }}
          </span>
        </div>
        
        <!-- 任务信息 -->
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="col-span-2">
            <div class="flex items-center justify-between">
              <span class="text-gray-400">执行模式：</span>
              <button
                v-if="!isEditingExecutionMode && selectedTask.status !== 'running'"
                @click="startEditExecutionMode"
                class="text-xs text-orange-500 hover:text-orange-600"
              >
                <i class="fas fa-edit mr-1"></i>修改
              </button>
            </div>
            
            <!-- 查看模式 -->
            <div v-if="!isEditingExecutionMode" class="mt-1">
              <span :class="executionModeColors[selectedTask.executionMode]">
                <i :class="['fas', executionModeIcons[selectedTask.executionMode], 'mr-1']"></i>
                {{ executionModeLabels[selectedTask.executionMode] }}
              </span>
              <span class="text-xs text-gray-400 ml-2">
                {{ selectedTask.executionMode === 'once' ? '执行一次后完成' : 
                   selectedTask.executionMode === 'repeatable' ? '可多次手动执行' : 
                   '按设定间隔自动执行' }}
              </span>
            </div>
            
            <!-- 编辑模式 -->
            <div v-else class="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div class="grid grid-cols-3 gap-2 mb-3">
                <button
                  v-for="(label, mode) in executionModeLabels"
                  :key="mode"
                  @click="editingExecutionMode = mode as TaskExecutionMode"
                  :class="[
                    'py-2 rounded-lg text-xs border transition-colors flex flex-col items-center gap-1',
                    editingExecutionMode === mode
                      ? 'border-orange-500 bg-orange-100 text-orange-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300'
                  ]"
                >
                  <i :class="['fas', executionModeIcons[mode as TaskExecutionMode]]"></i>
                  <span>{{ label }}</span>
                </button>
              </div>
              
              <!-- 自动模式间隔配置 -->
              <div v-if="editingExecutionMode === 'auto'" class="mb-3">
                <label class="block text-xs text-orange-600 mb-1">执行间隔</label>
                <div class="flex items-center gap-2">
                  <button
                    @click="adjustEditingAutoInterval(-5)"
                    class="w-8 h-8 rounded-lg bg-white border border-orange-300 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"
                    :disabled="editingAutoInterval <= 1"
                  >
                    <i class="fas fa-minus text-xs"></i>
                  </button>
                  <div class="flex-1 text-center">
                    <span class="text-lg font-bold text-orange-700">{{ editingAutoInterval }}</span>
                    <span class="text-xs text-orange-600 ml-1">分钟</span>
                  </div>
                  <button
                    @click="adjustEditingAutoInterval(5)"
                    class="w-8 h-8 rounded-lg bg-white border border-orange-300 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"
                    :disabled="editingAutoInterval >= 1440"
                  >
                    <i class="fas fa-plus text-xs"></i>
                  </button>
                </div>
                <!-- 快捷选项 -->
                <div class="flex gap-1 mt-2">
                  <button
                    v-for="mins in [5, 10, 30, 60, 120]"
                    :key="mins"
                    @click="editingAutoInterval = mins"
                    :class="[
                      'flex-1 py-1 rounded text-xs transition-colors',
                      editingAutoInterval === mins
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-100'
                    ]"
                  >
                    {{ mins >= 60 ? `${mins / 60}h` : `${mins}m` }}
                  </button>
                </div>
              </div>
              
              <div class="flex gap-2">
                <button
                  @click="saveExecutionMode"
                  class="flex-1 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600"
                >
                  保存
                </button>
                <button
                  @click="cancelEditExecutionMode"
                  class="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
          <div>
            <span class="text-gray-400">执行次数：</span>
            <span class="text-gray-700">{{ selectedTask.totalExecutions || 0 }} 次</span>
          </div>
          <div>
            <span class="text-gray-400">优先级：</span>
            <span :class="getPriorityColor(selectedTask.priority)">
              {{ getPriorityLabel(selectedTask.priority) }}
            </span>
          </div>
          <div v-if="selectedTask.duration">
            <span class="text-gray-400">耗时：</span>
            <span class="text-gray-700">{{ formatDuration(selectedTask.duration) }}</span>
          </div>
          <div v-if="selectedTask.usage">
            <span class="text-gray-400">Token：</span>
            <span class="text-gray-700">{{ selectedTask.usage.totalTokens }}</span>
          </div>
        </div>
        
        <!-- 自动执行配置 -->
        <div v-if="selectedTask.executionMode === 'auto' && selectedTask.autoConfig" class="mt-4 p-3 bg-green-50 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-green-700">自动执行配置</span>
            <button
              @click="toggleAutoExecution(selectedTask.id)"
              :class="[
                'px-3 py-1 rounded-full text-xs transition-colors',
                selectedTask.autoConfig.enabled
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-green-600 border border-green-300'
              ]"
            >
              {{ selectedTask.autoConfig.enabled ? '运行中' : '已停止' }}
            </button>
          </div>
          
          <!-- 执行间隔调整 -->
          <div class="mb-3">
            <label class="block text-xs text-green-600 mb-1">执行间隔</label>
            <div class="flex items-center gap-2">
              <button
                @click="adjustAutoInterval(selectedTask.id, -5)"
                class="w-8 h-8 rounded-lg bg-white border border-green-300 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors"
                :disabled="selectedTask.autoConfig.intervalMinutes <= 1"
              >
                <i class="fas fa-minus text-xs"></i>
              </button>
              <div class="flex-1 text-center">
                <span class="text-lg font-bold text-green-700">{{ selectedTask.autoConfig.intervalMinutes }}</span>
                <span class="text-xs text-green-600 ml-1">分钟</span>
              </div>
              <button
                @click="adjustAutoInterval(selectedTask.id, 5)"
                class="w-8 h-8 rounded-lg bg-white border border-green-300 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors"
                :disabled="selectedTask.autoConfig.intervalMinutes >= 1440"
              >
                <i class="fas fa-plus text-xs"></i>
              </button>
            </div>
            <!-- 快捷选项 -->
            <div class="flex gap-1 mt-2">
              <button
                v-for="mins in [5, 10, 30, 60, 120]"
                :key="mins"
                @click="updateAutoInterval(selectedTask.id, mins)"
                :class="[
                  'flex-1 py-1 rounded text-xs transition-colors',
                  selectedTask.autoConfig.intervalMinutes === mins
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-green-600 border border-green-200 hover:bg-green-100'
                ]"
              >
                {{ mins >= 60 ? `${mins / 60}h` : `${mins}m` }}
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-2 text-xs text-green-700">
            <div>
              <span>已执行：</span>
              <span class="font-medium">{{ selectedTask.autoConfig.executionCount || 0 }} 次</span>
            </div>
            <div v-if="selectedTask.autoConfig.nextExecutionAt && selectedTask.autoConfig.enabled">
              <span>下次执行：</span>
              <span class="font-medium">{{ formatNextExecution(selectedTask.autoConfig.nextExecutionAt) }}</span>
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="flex gap-2 mt-4">
          <!-- 自动任务：开关 -->
          <button
            v-if="selectedTask.executionMode === 'auto'"
            @click="toggleAutoExecution(selectedTask.id)"
            :class="[
              'flex-1 py-2 rounded-lg text-sm',
              selectedTask.autoConfig?.enabled
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            ]"
          >
            <i :class="['fas', selectedTask.autoConfig?.enabled ? 'fa-pause' : 'fa-play', 'mr-1']"></i>
            {{ selectedTask.autoConfig?.enabled ? '停止自动执行' : '启动自动执行' }}
          </button>
          
          <!-- 普通任务：执行按钮 -->
          <template v-else>
            <button
              v-if="selectedTask.status === 'pending' || (selectedTask.status === 'completed' && selectedTask.executionMode === 'repeatable')"
              @click="handleExecuteTask(selectedTask.id)"
              class="flex-1 py-2 rounded-lg text-sm bg-green-500 text-white hover:bg-green-600"
            >
              <i class="fas fa-play mr-1"></i> 执行
            </button>
            <button
              v-else-if="selectedTask.status === 'running'"
              @click="handlePauseTask(selectedTask.id)"
              class="flex-1 py-2 rounded-lg text-sm bg-yellow-500 text-white hover:bg-yellow-600"
            >
              <i class="fas fa-pause mr-1"></i> 暂停
            </button>
            <button
              v-else-if="selectedTask.status === 'paused'"
              @click="handleResumeTask(selectedTask.id)"
              class="flex-1 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600"
            >
              <i class="fas fa-play mr-1"></i> 恢复
            </button>
            <button
              v-else-if="selectedTask.status === 'failed' || selectedTask.status === 'cancelled'"
              @click="handleRetryTask(selectedTask.id)"
              class="flex-1 py-2 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600"
            >
              <i class="fas fa-redo mr-1"></i> 重试
            </button>
          </template>
          
          <button
            v-if="selectedTask.status === 'running' || selectedTask.status === 'pending'"
            @click="handleCancelTask(selectedTask.id)"
            class="py-2 px-4 rounded-lg text-sm bg-red-50 text-red-500 hover:bg-red-100"
          >
            <i class="fas fa-stop"></i>
          </button>
          
          <button
            @click="handleDuplicateTask(selectedTask.id)"
            class="py-2 px-4 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="复制任务"
          >
            <i class="fas fa-copy"></i>
          </button>
          
          <button
            v-if="selectedTask.isBuiltin"
            @click="handleResetBuiltinTask(selectedTask.id)"
            class="py-2 px-4 rounded-lg text-sm bg-purple-50 text-purple-500 hover:bg-purple-100"
            title="重置为默认"
          >
            <i class="fas fa-undo"></i>
          </button>
          
          <button
            v-else
            @click="handleDeleteTask(selectedTask.id)"
            class="py-2 px-4 rounded-lg text-sm bg-red-50 text-red-500 hover:bg-red-100"
            title="删除任务"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>

      <!-- 输入参数（内置任务） -->
      <div v-if="currentBuiltinDefinition" class="bg-white mt-2 p-4 border-b border-gray-100">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700">输入参数</h3>
          <button
            v-if="!isEditingInput && selectedTask.status !== 'running'"
            @click="startEditInput"
            class="text-xs text-orange-500"
          >
            <i class="fas fa-edit mr-1"></i> 编辑
          </button>
        </div>
        
        <!-- 查看模式 -->
        <div v-if="!isEditingInput" class="space-y-2">
          <div v-for="field in currentBuiltinDefinition.inputSchema" :key="field.name" class="flex justify-between text-sm">
            <span class="text-gray-400">{{ field.label }}：</span>
            <span class="text-gray-700">{{ selectedTask.input[field.name] || field.defaultValue || '-' }}</span>
          </div>
        </div>
        
        <!-- 编辑模式 -->
        <div v-else class="space-y-3">
          <div v-for="field in currentBuiltinDefinition.inputSchema" :key="field.name">
            <label class="block text-xs text-gray-400 mb-1">{{ field.label }}</label>
            
            <select
              v-if="field.type === 'select'"
              v-model="editingInput[field.name]"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option v-for="opt in field.options" :key="String(opt.value)" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            
            <!-- 数字输入：使用加减按钮 -->
            <div v-else-if="field.type === 'number'" class="flex items-center gap-2">
              <button
                @click="adjustInputNumber(field.name, -1, 1, 100)"
                class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
                :disabled="(editingInput[field.name] || field.defaultValue || 1) <= 1"
              >
                <i class="fas fa-minus"></i>
              </button>
              <input
                v-model.number="editingInput[field.name]"
                type="number"
                min="1"
                max="100"
                class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center"
                :placeholder="field.placeholder"
              />
              <button
                @click="adjustInputNumber(field.name, 1, 1, 100)"
                class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
                :disabled="(editingInput[field.name] || field.defaultValue || 1) >= 100"
              >
                <i class="fas fa-plus"></i>
              </button>
            </div>
            
            <textarea
              v-else-if="String(field.defaultValue || '').length > 50"
              v-model="editingInput[field.name]"
              rows="3"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              :placeholder="field.placeholder"
            ></textarea>
            
            <input
              v-else
              v-model="editingInput[field.name]"
              type="text"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              :placeholder="field.placeholder"
            />
          </div>
          
          <div class="flex gap-2">
            <button
              @click="saveInput"
              class="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm"
            >
              保存
            </button>
            <button
              @click="cancelEditInput"
              class="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm"
            >
              取消
            </button>
          </div>
        </div>
      </div>

      <!-- 提示词预览 -->
      <div v-if="renderedPromptPreview" class="bg-white mt-2 p-4 border-b border-gray-100">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700 flex items-center gap">
            <i class="fas fa-file-alt text-gray-400"></i>
            最新提示词
          </h3>
          <button
            @click="isPromptPreviewExpanded = !isPromptPreviewExpanded"
            class="text-xs text-orange-500 flex items-center gap-1"
          >
            <i :class="['fas', isPromptPreviewExpanded ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
            {{ isPromptPreviewExpanded ? '收起' : '展开' }}
          </button>
        </div>
        
        <!-- 未替换变量警告 -->
        <div v-if="renderedPromptPreview.hasUnreplacedVars" 
          class="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-center gap-2"
        >
          <i class="fas fa-exclamation-triangle"></i>
          存在未替换的变量，请在上方编辑输入参数
        </div>
        
        <!-- 收起状态：显示摘要 -->
        <div v-if="!isPromptPreviewExpanded" class="space-y-2">
          <div v-if="renderedPromptPreview.systemPrompt" class="text-sm">
            <span class="text-gray-400">系统提示词：</span>
            <span class="text-gray-600 line-clamp-1">{{ renderedPromptPreview.systemPrompt }}</span>
          </div>
          <div class="text-sm">
            <span class="text-gray-400">用户提示词：</span>
            <span class="text-gray-600 line-clamp-2">{{ renderedPromptPreview.userPrompt }}</span>
          </div>
        </div>
        
        <!-- 展开状态：显示完整内容 -->
        <div v-else class="space-y-4">
          <!-- 系统提示词 -->
          <div v-if="renderedPromptPreview.systemPrompt">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">System</span>
              <button
                @click="copyToClipboard(renderedPromptPreview.systemPrompt)"
                class="text-xs text-gray-400 hover:text-gray-600"
                title="复制"
              >
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <div class="p-3 bg-purple-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono text-xs leading-relaxed">
              {{ renderedPromptPreview.systemPrompt }}
            </div>
          </div>
          
          <!-- 用户提示词 -->
          <div>
            <div class="flex items-center gap-2 mb-2">
    <span class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">User</span>
              <button
                @click="copyToClipboard(renderedPromptPreview.userPrompt)"
                class="text-xs text-gray-400 hover:text-gray-600"
                title="复制"
              >
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <div class="p-3 bg-blue-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
              {{ renderedPromptPreview.userPrompt }}
            </div>
          </div>
          
          <!-- 字数统计 -->
          <div class="flex justify-end gap-4 text-xs text-gray-400">
            <span v-if="renderedPromptPreview.systemPrompt">
              系统: {{ renderedPromptPreview.systemPrompt.length }} 字符
            </span>
            <span>
              用户: {{ renderedPromptPreview.userPrompt.length }} 字符
            </span>
            <span>
              总计: {{ (renderedPromptPreview.systemPrompt?.length || 0) + renderedPromptPreview.userPrompt.length }} 字符
            </span>
          </div>
        </div>
      </div>

      <!-- LLM 配置 -->
      <div class="bg-white mt-2 p-4 border-b border-gray-100">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700">LLM 配置</h3>
          <button
            v-if="!isEditingConfig && selectedTask.status !== 'running'"
            @click="startEditConfig"
            class="text-xs text-orange-500"
          >
            <i class="fas fa-edit mr-1"></i> 编辑
          </button>
        </div>
        
        <div v-if="!isEditingConfig" class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">配置来源</span>
            <span :class="[
              selectedTask.config.source === 'global' ? 'text-blue-500' :
              selectedTask.config.source === 'preset' ? 'text-purple-500' :
              'text-gray-700'
            ]">
              {{ getConfigSourceLabel(selectedTask.config.source) }}
              <span v-if="selectedTask.config.presetName" class="text-gray-400">
                ({{ selectedTask.config.presetName }})
              </span>
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Temperature</span>
            <span class="text-gray-700">{{ selectedTask.config.temperature }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Max Tokens</span>
            <span class="text-gray-700">{{ selectedTask.config.maxTokens }}</span>
          </div>
        </div>
        
        <!-- 编辑模式 -->
        <div v-else class="space-y-4">
          <div>
            <label class="block text-xs text-gray-400 mb-2">配置来源</label>
            <div class="flex gap-2">
              <button
                v-for="(label, source) in configSourceLabels"
                :key="source"
                @click="editingConfig.source = source as LLMConfigSource"
                :class="[
                  'flex-1 py-2 rounded-lg text-xs border transition-colors',
                  editingConfig.source === source
                    ? 'border-orange-500 bg-orange-50 text-orange-600'
                    : 'border-gray-200 text-gray-600'
                ]"
              >
                {{ label }}
              </button>
            </div>
          </div>
          
          <div v-if="editingConfig.source === 'preset'">
            <label class="block text-xs text-gray-400 mb-1">选择预设</label>
            <select
              v-model="editingConfig.presetId"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">请选择预设</option>
              <option v-for="preset in availablePresets" :key="preset.id" :value="preset.id">
                {{ preset.name }}
              </option>
            </select>
          </div>
          
          <template v-if="editingConfig.source !== 'preset'">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Temperature (0-2)</label>
              <input
                v-model.number="editingConfig.temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Max Tokens</label>
              <input
                v-model.number="editingConfig.maxTokens"
                type="number"
                min="1"
                max="32000"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </template>
          
          <div class="flex gap-2">
            <button
              @click="saveConfig"
              class="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm"
            >
              保存
            </button>
            <button
              @click="cancelEditConfig"
              class="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm"
            >
              取消
            </button>
          </div>
        </div>
      </div>

      <!-- 输出结果 -->
      <div v-if="selectedTask.output || selectedTask.error" class="bg-white mt-2 p-4 border-b border-gray-100">
        <h3 class="text-sm font-medium text-gray-700 mb-3">
          {{ selectedTask.error ? '错误信息' : '输出结果' }}
        </h3>
        
        <div
          v-if="selectedTask.error"
          class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          {{ selectedTask.error }}
        </div>
        
        <div
          v-else
          class="p-3 bg-green-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto"
        >
          {{ selectedTask.output }}
        </div>
      </div>

      <!-- 历史输出（可重复/自动任务） -->
      <div v-if="selectedTask.outputHistory && selectedTask.outputHistory.length > 0" class="bg-white mt-2 p-4 border-b border-gray-100">
        <h3 class="text-sm font-medium text-gray-700 mb-3">
          历史输出 ({{ selectedTask.outputHistory.length }})
        </h3>
        
        <div class="space-y-3 max-h-64 overflow-y-auto">
          <div
            v-for="(history, index) in selectedTask.outputHistory.slice(0, 5)"
            :key="history.timestamp"
            class="p-3 bg-gray-50 rounded-lg"
          >
            <div class="flex justify-between text-xs text-gray-400 mb-2">
              <span>{{ formatTime(history.timestamp) }}</span>
              <span v-if="history.usage">{{ history.usage.totalTokens }} tokens</span>
            </div>
            <div class="text-sm text-gray-700 line-clamp-3">
              {{ history.output }}
            </div>
          </div>
        </div>
      </div>

      <!-- 任务日志 -->
      <div class="bg-white mt-2 p-4">
        <h3 class="text-sm font-medium text-gray-700 mb-3">执行日志</h3>
        
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div
            v-for="log in taskStore.getTaskLogs(selectedTask.id).slice(-20).reverse()"
            :key="log.timestamp"
            class="flex items-start gap-2 text-xs"
          >
            <span class="text-gray-400 whitespace-nowrap">
              {{ new Date(log.timestamp).toLocaleTimeString() }}
            </span>
            <span
              :class="{
                'text-gray-600': log.level === 'info',
                'text-yellow-600': log.level === 'warn',
                'text-red-600': log.level === 'error',
              }"
            >
              {{ log.message }}
            </span>
          </div>
          
          <div v-if="taskStore.getTaskLogs(selectedTask.id).length === 0" class="text-xs text-gray-400">
            暂无日志
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 模板视图 ==================== -->
    <div v-else-if="currentView === 'templates'" class="flex-1 overflow-y-auto p-4">
      <!-- 模板列表 -->
      <template v-if="!selectedTemplateId">
        <p class="text-sm text-gray-500 mb-4">选择一个模板快速创建任务</p>
        
        <div class="space-y-3">
          <div
            v-for="template in templates"
            :key="template.id"
            @click="handleSelectTemplate(template)"
            class="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
          >
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i :class="['fas', template.icon, 'text-orange-500']"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-800">{{ template.name }}</span>
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded', executionModeColors[template.executionMode]]">
                    {{ executionModeLabels[template.executionMode] }}
                  </span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">{{ template.description }}</div>
              </div>
              <i class="fas fa-chevron-right text-gray-300 text-xs mt-3"></i>
            </div>
          </div>
        </div>
      </template>
      
      <!-- 模板详情/输入表单 -->
      <template v-else-if="selectedTemplate">
        <div class="bg-white rounded-lg p-4 mb-4">
          <div class="flex items-start gap-3 mb-4">
            <div class="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i :class="['fas', selectedTemplate.icon, 'text-orange-500 text-xl']"></i>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-medium text-gray-800">{{ selectedTemplate.name }}</h3>
              <p class="text-sm text-gray-500 mt-1">{{ selectedTemplate.description }}</p>
            </div>
          </div>
          
          <!-- 输入参数 -->
          <div v-if="selectedTemplate.inputSchema && selectedTemplate.inputSchema.length > 0" class="space-y-4">
            <h4 class="text-sm font-medium text-gray-700 border-b pb-2">输入参数</h4>
            
            <div v-for="field in selectedTemplate.inputSchema" :key="field.name" class="space-y-1">
              <label class="block text-xs text-gray-500">
                {{ field.label }}
                <span v-if="field.required" class="text-red-500">*</span>
              </label>
              
              <!-- 下拉选择 -->
              <select
                v-if="field.type === 'select'"
                v-model="templateInputs[field.name]"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              
              <!-- 数字输入：使用加减按钮 -->
              <div v-else-if="field.type === 'number'" class="flex items-center gap-2">
                <button
                  @click="adjustTemplateInput(field.name, -1, 1, 100)"
                  class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  :disabled="(templateInputs[field.name] || field.defaultValue || 1) <= 1"
                >
                  <i class="fas fa-minus"></i>
                </button>
                <input
                  v-model.number="templateInputs[field.name]"
                  type="number"
                  min="1"
                  max="100"
                  class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-medium"
                  :placeholder="field.placeholder"
                />
                <button
                  @click="adjustTemplateInput(field.name, 1, 1, 100)"
                  class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  :disabled="(templateInputs[field.name] || field.defaultValue || 1) >= 100"
                >
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              
              <!-- 文本输入 -->
              <input
                v-else
                v-model="templateInputs[field.name]"
                type="text"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                :placeholder="field.placeholder"
              />
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="flex gap-2">
          <button
            @click="selectedTemplateId = null"
            class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <i class="fas fa-arrow-left mr-1"></i>
            返回
          </button>
          <button
            @click="createFromTemplate"
            class="flex-1 py-3 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <i class="fas fa-plus mr-1"></i>
            创建任务
          </button>
          <button
            @click="createAndExecuteFromTemplate"
            class="flex-1 py-3 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            <i class="fas fa-play mr-1"></i>
            创建并执行
          </button>
        </div>
      </template>
    </div>

    <!-- ==================== 设置视图 ==================== -->
    <div v-else-if="currentView === 'settings'" class="flex-1 overflow-y-auto">
      <div class="p-4 space-y-4">
        <!-- 默认配置来源 -->
        <div class="bg-white rounded-lg p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-3">默认配置来源</h3>
          <p class="text-xs text-gray-400 mb-3">新建任务时使用的默认 LLM 配置</p>
          
          <div class="space-y-2">
            <label class="flex items-center p-3 rounded-lg border cursor-pointer"
              :class="globalSettings.useGlobalAsDefault ? 'border-orange-300 bg-orange-50' : 'border-gray-200'"
            >
              <input
                type="radio"
                :checked="globalSettings.useGlobalAsDefault"
                @change="updateGlobalSettingSource(true)"
                class="mr-3"
              />
              <div>
                <div class="text-sm font-medium text-gray-700">使用全局配置</div>
                <div class="text-xs text-gray-400">
                  跟随 API Manager 中的全局设置
                  <span v-if="activeGlobalPreset" class="text-blue-500">
                    (当前: {{ activeGlobalPreset.name }})
                  </span>
                  <span v-else class="text-gray-500">
                    (当前: 酒馆 API)
                  </span>
                </div>
              </div>
            </label>
            
            <label class="flex items-center p-3 rounded-lg border cursor-pointer"
              :class="!globalSettings.useGlobalAsDefault ? 'border-orange-300 bg-orange-50' : 'border-gray-200'"
            >
              <input
                type="radio"
                :checked="!globalSettings.useGlobalAsDefault"
                @change="updateGlobalSettingSource(false)"
                class="mr-3"
              />
              <div>
                <div class="text-sm font-medium text-gray-700">使用指定预设</div>
                <div class="text-xs text-gray-400">固定使用某个 API 预设</div>
              </div>
            </label>
          </div>
          
          <div v-if="!globalSettings.useGlobalAsDefault" class="mt-4">
            <label class="block text-xs text-gray-400 mb-2">选择预设</label>
            <select
              :value="globalSettings.defaultPresetId || ''"
              @change="updateDefaultPreset(($event.target as HTMLSelectElement).value)"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">自定义配置</option>
              <option v-for="preset in availablePresets" :key="preset.id" :value="preset.id">
                {{ preset.name }}
              </option>
            </select>
          </div>
        </div>
        
        <!-- API 预设列表 -->
        <div class="bg-white rounded-lg p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-3">可用 API 预设</h3>
          <p class="text-xs text-gray-400 mb-3">
            在 API Manager 中管理预设配置
          </p>
          
          <div v-if="availablePresets.length > 0" class="space-y-2">
            <div
              v-for="preset in availablePresets"
              :key="preset.id"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <div class="text-sm font-medium text-gray-700">{{ preset.name }}</div>
                <div class="text-xs text-gray-400">
                  {{ preset.config.source || 'openai' }} · {{ preset.config.model || '未指定模型' }}
                </div>
              </div>
              <div v-if="activeGlobalPreset?.id === preset.id" class="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                当前激活
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6">
            <i class="fas fa-plug text-2xl text-gray-300 mb-2"></i>
            <p class="text-sm text-gray-400">暂无 API 预设</p>
            <p class="text-xs text-gray-400 mt-1">请在 API Manager 中添加</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 创建视图 ==================== -->
    <div v-else-if="currentView === 'create'" class="flex-1 overflow-y-auto">
      <div class="bg-white p-4 space-y-4">
        <!-- 任务名称 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">任务名称 *</label>
          <input
            v-model="createForm.name"
            type="text"
            placeholder="输入任务名称"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        
        <!-- 执行模式 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">执行模式</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="(label, mode) in executionModeLabels"
              :key="mode"
              @click="createForm.executionMode = mode as TaskExecutionMode"
              :class="[
                'py-3 rounded-lg text-sm border transition-colors flex flex-col items-center gap-1',
                createForm.executionMode === mode
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-gray-200 text-gray-600'
              ]"
            >
              <i :class="['fas', executionModeIcons[mode as TaskExecutionMode]]"></i>
              <span>{{ label }}</span>
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            {{ createForm.executionMode === 'once' ? '执行一次后完成' : 
               createForm.executionMode === 'repeatable' ? '可多次手动执行' : 
               '按设定间隔自动执行' }}
          </p>
        </div>
        
        <!-- 自动执行间隔 -->
        <div v-if="createForm.executionMode === 'auto'">
          <label class="block text-sm font-medium text-gray-700 mb-2">执行间隔</label>
          <div class="flex items-center gap-2">
            <button
              @click="adjustFormNumber('autoIntervalMinutes', -5)"
              class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
              :disabled="createForm.autoIntervalMinutes <= 1"
            >
              <i class="fas fa-minus"></i>
            </button>
            <div class="flex-1 text-center">
              <span class="text-xl font-bold text-gray-800">{{ createForm.autoIntervalMinutes }}</span>
              <span class="text-sm text-gray-500 ml-1">分钟</span>
            </div>
            <button
              @click="adjustFormNumber('autoIntervalMinutes', 5)"
              class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
              :disabled="createForm.autoIntervalMinutes >= 1440"
            >
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <!-- 快捷选项 -->
          <div class="flex gap-1 mt-2">
            <button
              v-for="mins in [5, 10, 30, 60, 120, 360]"
              :key="mins"
              @click="createForm.autoIntervalMinutes = mins"
              :class="[
                'flex-1 py-1.5 rounded text-xs transition-colors',
                createForm.autoIntervalMinutes === mins
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              ]"
            >
              {{ mins >= 60 ? `${mins / 60}小时` : `${mins}分钟` }}
            </button>
          </div>
        </div>
        
        <!-- 提示词内容 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">提示词内容 *</label>
          <textarea
            v-model="createForm.manualPrompt"
            placeholder="输入提示词内容..."
            rows="6"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
          ></textarea>
        </div>
        
        <!-- 系统提示词 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">系统提示词</label>
          <textarea
            v-model="createForm.systemPrompt"
            placeholder="可选，系统提示词"
            rows="3"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
          ></textarea>
        </div>
        
        <!-- 优先级 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">优先级</label>
          <div class="flex gap-2">
            <button
              v-for="option in priorityOptions"
              :key="option.value"
              @click="createForm.priority = option.value"
              :class="[
                'flex-1 py-2 rounded-lg text-sm border transition-colors',
                createForm.priority === option.value
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-gray-200 text-gray-600'
              ]"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        
        <!-- 提交按钮 -->
        <div class="pt-4">
          <button
            @click="submitCreateTask"
            class="w-full py-3 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            创建任务
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
