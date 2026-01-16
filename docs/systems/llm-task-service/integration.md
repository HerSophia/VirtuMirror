# 系统集成

## 依赖关系

```text
LLMTaskService
    ├── depends on → AIStore (LLM 调用)
    ├── depends on → PromptService (提示词管理)
    ├── depends on → PromptChainExecutor (链执行)
    ├── depends on → GlobalConfigService (配置管理)
    └── integrates with → SystemPromptService (系统提示词注入)
```

---

## 与 AIStore 的交互

TaskExecutor 通过 AIStore 执行 LLM 调用：

```typescript
// TaskExecutor.ts

async function executeLLMCall(
  task: LLMTask,
  prompt: string,
  systemPrompt: string
): Promise<GenerateResult> {
  const aiStore = useAIStore();
  
  return aiStore.generate(
    {
      prompt,
      system: systemPrompt,
      temperature: task.config.temperature,
      maxTokens: task.config.maxTokens,
      topP: task.config.topP,
      frequencyPenalty: task.config.frequencyPenalty,
      presencePenalty: task.config.presencePenalty,
      source: `llm-task-${task.id}`,
      appId: task.appId,
      scene: task.definitionId,
    },
    task.priority
  );
}
```

---

## 与 SystemPromptService 的交互

系统提示词将自动注入，服务无需额外处理：

```text
最终系统提示词 =
  1. 全局系统提示词 (scope: 'global')
  2. App 级系统提示词 (scope: 'app', appId: task.appId)
  3. 任务定义的 systemPrompt
```

---

## 与 PromptService 的交互

当任务类型为 `prompt` 时，TaskExecutor 从 PromptService 获取提示词：

```typescript
// TaskExecutor.ts

async function resolvePrompt(task: LLMTask): Promise<string> {
  const definition = getTaskDefinition(task.definitionId);
  
  switch (definition.type) {
    case 'manual':
      // 使用任务定义中的 promptTemplate
      return definition.promptTemplate || '';
      
    case 'prompt':
      // 从 PromptService 获取
      const promptService = getPromptService();
      const prompt = promptService.getPrompt(definition.promptId!);
      return prompt?.content || '';
      
    case 'chain':
      // 链执行由 PromptChainExecutor 处理
      return '';
  }
}
```

---

## 与 PromptChainExecutor 的交互

当任务类型为 `chain` 时，TaskExecutor 委托给 PromptChainExecutor：

```typescript
// TaskExecutor.ts

async function executeChainTask(task: LLMTask): Promise<ExecutionResult> {
  const definition = getTaskDefinition(task.definitionId);
  const chainExecutor = getPromptChainExecutor();
  
  const chainResult = await chainExecutor.execute(definition.chainId!, {
    variables: task.input,
    context: await collectContext(task),
  });
  
  return {
    success: chainResult.success,
    output: chainResult.finalOutput,
    chainResult,
    duration: chainResult.duration,
  };
}
```

---

## 内置上下文提供器

LLM 任务服务提供以下内置上下文提供器：

### system:time

提供时间相关变量：

```typescript
{
  id: 'system:time',
  appId: 'system',
  name: '时间上下文',
  
  async getContext() {
    const now = new Date();
    return {
      currentTime: now.toLocaleString(),
      currentDate: now.toLocaleDateString(),
      currentHour: now.getHours().toString(),
      timePeriod: getTimePeriod(now), // 早上/中午/下午/晚上
      dayOfWeek: getDayOfWeek(now),   // 周一/周二/...
    };
  },
}
```

### system:user

提供用户相关变量：

```typescript
{
  id: 'system:user',
  appId: 'system',
  name: '用户上下文',
  
  async getContext() {
    const accountStore = useAccountStore();
    const mainAccount = accountStore.mainAccount;
    
    return {
      userName: mainAccount?.name || '用户',
      userBio: mainAccount?.bio || '',
    };
  },
}
```

### system:environment

提供环境相关变量：

```typescript
{
  id: 'system:environment',
  appId: 'system',
  name: '环境上下文',
  
  async getContext() {
    return {
      platform: 'web',
      language: navigator.language,
    };
  },
}
```

---

## Store 与 Service 的关系

`useLLMTaskStore` 是 `LLMTaskService` 的响应式包装：

```typescript
// src/stores/llmTaskStore.ts

export const useLLMTaskStore = defineStore('llmTask', () => {
  const service = getLLMTaskService();
  
  // 响应式状态
  const tasks = ref<LLMTask[]>([]);
  const updateVersion = ref(0);
  
  // 同步 Service 状态
  function syncFromService() {
    tasks.value = service.getAllTasks();
    updateVersion.value++;
  }
  
  // 监听 Service 事件
  service.on('task-created', syncFromService);
  service.on('task-completed', syncFromService);
  service.on('task-failed', syncFromService);
  
  // 代理方法
  function executeTask(taskId: string) {
    return service.executeTask(taskId);
  }
  
  return {
    tasks,
    executeTask,
    // ...
  };
});
```

### 为什么需要 Store？

| 角色     | Service            | Store           |
| -------- | ------------------ | --------------- |
| 职责     | 业务逻辑、状态管理 | Vue 响应式绑定  |
| 适用场景 | 任何 JS 代码       | Vue 组件        |
| 响应式   | ❌                  | ✅               |
| 可测试性 | ✅ 高（纯 JS）      | ⚠️ 需要 Vue 环境 |
