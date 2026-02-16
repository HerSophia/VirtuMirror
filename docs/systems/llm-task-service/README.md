# LLM 任务服务

> **状态**: ✅ 已完成  
> **版本**: v1.0  
> **最后更新**: 2026-01-06

## 概述

LLM 任务服务是一个**系统级服务**，提供统一的 LLM 任务管理能力，任何 App 都可以注册和使用。

### 核心能力

* **任务定义与注册**：App 声明式定义任务，服务统一管理
* **任务执行**：支持手动提示词、注册提示词、提示词链
* **自动执行调度**：支持定时循环执行
* **变量替换引擎**：动态注入上下文变量
* **输出处理**：可扩展的输出解析和处理机制

### 设计目标

| 维度 | 说明 |
| ---------- | ----------------------------------- |
| 通用性 | 任何 App 都可以注册和使用 LLM 任务 |
| 可扩展 | 通过插件机制支持不同 App 的特定需求 |
| 统一管理 | 提供全局视角的任务管理界面 |
| 低接入成本 | App 接入仅需 < 200 行配置代码 |

---

## 文档导航

| 文档 | 说明 |
| -------------------------------------- | ------------------------------------------ |
| [架构设计](./architecture.md) | 分层架构、核心组件、目录结构 |
| [类型定义](./types.md) | 基础类型、任务定义、任务实例、扩展点接口 |
| [服务接口](./api.md) | LLMTaskService 完整 API |
| [使用示例](./usage.md) | App 注册任务、定义任务、实现处理器和提供器 |
| [系统集成](./integration.md) | 与 AIStore、PromptService 等的交互 |
| [设计决策](./design-decisions.md) | 持久化、动态更新、跨 App 共享等决策 |
| [上下文共享服务](./context-sharing.md) | 跨 App 上下文共享的未来设计（TODO） |

---

## 快速开始

### 1. App 注册 LLM 任务扩展

```typescript
import { getLLMTaskService } from '@/services/llmTask';
import { myTaskDefinitions, myContextProviders, myOutputHandlers } from './llmTask';

export function registerMyAppLLMExtensions() {
  const service = getLLMTaskService();
  
  // 注册上下文提供器
  myContextProviders.forEach(p => service.registerContextProvider(p));
  
  // 注册输出处理器
  myOutputHandlers.forEach(h => service.registerOutputHandler(h));
  
  // 注册任务定义
  service.registerTaskDefinitions(myTaskDefinitions);
}
```

### 2. 创建并执行任务

```typescript
const service = getLLMTaskService();

// 创建任务实例
const task = service.createTask('myapp:generate-content', {
  input: { topic: '今天的天气' }
});

// 执行任务
const result = await service.executeTask(task.id);
if (result.success) {
  console.log('生成内容:', result.output);
}
```

### 3. 在组件中使用

```vue
<script setup lang="ts">
import { useLLMTaskStore } from '@/stores/llmTaskStore';

const store = useLLMTaskStore();

// 获取任务列表
const tasks = computed(() => store.tasks.filter(t => t.appId === 'myapp'));
</script>
```

---

## 已接入的 App

| App | 任务数 | 说明 |
| ---- | ------ | ------------------------------ |
| 微博 | 8 | 博文生成、评论生成、热搜生成等 |

---

## 参考资料

* [服务开发指南](../service-development-guide.md)
* [微博 App 文档](../../apps/Weibo/README.md)
* [AI 服务](../ai-service.md)
