# 提示词服务 (Prompt Service)

> **版本**: 1.0  
> **状态**: ✅ 已实现  
> **最后更新**: 2026-01-08

## 1. 概述

提示词服务是小手机模拟器的核心 AI 能力基础设施，负责管理所有与 LLM 交互的提示词模板。它提供了一套完整的提示词生命周期管理方案，包括模板定义、变量替换、权限控制、系统提示词注入以及多步骤链式编排。

### 1.1 核心能力

| 能力 | 说明 | 服务 |
|------|------|------|
| **提示词管理** | 模板 CRUD、变量定义、渲染引擎 | `PromptService` |
| **系统提示词** | 全局/App 级约束注入、作用域继承 | `SystemPromptService` |
| **提示词链** | 多步骤编排、变量传递、循环执行 | `PromptChainService` |
| **链执行引擎** | 多步/单次模式、事件回调、历史记录 | `PromptChainExecutor` |

### 1.2 设计原则

1. **模板与数据分离**: 提示词模板定义结构，运行时通过变量注入数据
2. **来源隔离**: 区分内置、用户自定义、App 注册三种来源，权限不同
3. **层级继承**: 系统提示词支持全局 → App → 场景三级作用域
4. **可观测性**: 链执行提供完整的事件流和历史记录

## 2. 架构概览

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           应用层 (App)                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │  微博   │  │  聊天   │  │  邮件   │  │ Prompts │ ...                │
│  │   App   │  │   App   │  │   App   │  │   App   │                    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                    │
└───────┼────────────┼────────────┼────────────┼─────────────────────────┘
        │            │            │            │
        │  注册提示词  │   调用生成   │  管理界面   │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         提示词服务层                                      │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  PromptService   │  │SystemPromptService│ │PromptChainService│       │
│  │  (模板管理)       │  │  (系统提示词)      │  │  (链管理)         │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           │                     │                     │                  │
│           └─────────────────────┼─────────────────────┘                  │
│                                 │                                        │
│                                 ▼                                        │
│                    ┌──────────────────────┐                              │
│                    │PromptChainExecutor   │                              │
│                    │  (链执行引擎)          │                              │
│                    └──────────┬───────────┘                              │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI 服务层                                       │
│  ┌──────────────────┐                                                    │
│  │ AIGenerateService│ ──────────────────▶  LLM Provider                  │
│  └──────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. 服务组成

### 3.1 PromptService

**职责**: 提示词模板的核心管理服务

| 功能 | 方法 | 说明 |
|------|------|------|
| 获取模板 | `getPromptByScene(scene)` | 按场景标识获取 |
| | `getPromptById(id)` | 按 ID 获取 |
| | `getAllPrompts()` | 获取全部 |
| | `getPromptsByCategory(category)` | 按分类获取 |
| 渲染 | `renderPrompt(template, variables)` | 变量替换 |
| CRUD | `addPrompt()` / `updatePrompt()` / `deletePrompt()` | 增删改 |
| App 注册 | `registerAppPrompts(appId, prompts)` | 注册 App 提示词 |
| | `unregisterAppPrompts(appId)` | 注销 App 提示词 |

**详见**: [architecture.md](./architecture.md)

### 3.2 SystemPromptService

**职责**: 管理全局和 App 级系统提示词

| 功能 | 方法 | 说明 |
|------|------|------|
| 组装 | `assemble(options)` | 组装最终系统提示词 |
| 获取 | `getGlobalSystemPrompts()` | 获取全局系统提示词 |
| | `getAppSystemPrompts(appId)` | 获取 App 级系统提示词 |
| CRUD | `create()` / `update()` / `delete()` | 增删改 |

**详见**: [system-prompts.md](./system-prompts.md)

### 3.3 PromptChainService

**职责**: 提示词链的 CRUD 和持久化

| 功能 | 方法 | 说明 |
|------|------|------|
| 获取 | `getAllChains()` | 获取所有链 |
| | `getChainById(id)` | 按 ID 获取 |
| CRUD | `createChain()` / `updateChain()` / `deleteChain()` | 增删改 |
| 步骤管理 | `addStep()` / `updateStep()` / `deleteStep()` | 步骤操作 |
| 历史 | `getExecutionHistory(chainId)` | 获取执行历史 |
| 导入导出 | `exportChain()` / `importChain()` | JSON 格式 |

**详见**: [prompt-chain.md](./prompt-chain.md)

### 3.4 PromptChainExecutor

**职责**: 链的执行引擎

| 功能 | 方法 | 说明 |
|------|------|------|
| 执行 | `execute(chain, inputs, callback)` | 执行链 |
| 控制 | `abort(executionId)` | 中止执行 |
| | `abortAll()` | 中止所有执行 |

**详见**: [executor.md](./executor.md)

## 4. 文档导航

| 文档 | 说明 |
|------|------|
| [架构设计](./architecture.md) | 服务架构、数据流、类型定义 |
| [系统提示词](./system-prompts.md) | 全局/App 级系统提示词管理 |
| [提示词链](./prompt-chain.md) | 多步骤编排、执行模式 |
| [执行引擎](./executor.md) | 链执行、事件、错误处理 |
| [类型定义](./types.md) | 完整的 TypeScript 类型 |
| [集成指南](./integration.md) | App 如何注册和使用提示词 |

## 5. 快速开始

### 5.1 注册 App 提示词

```typescript
import { PromptService } from '@/services/promptService';
import type { AppPromptDefinition } from '@/types/prompts';

// 定义提示词
const myPrompts: AppPromptDefinition[] = [
  {
    scene: 'myapp.greeting',
    name: '生成问候语',
    category: 'chat',
    template: '请为 {{userName}} 生成一句 {{style}} 的问候语。',
    availableVariables: [
      { name: 'userName', type: 'string', required: true, description: '用户名' },
      { name: 'style', type: 'string', defaultValue: '友好', description: '风格' }
    ]
  }
];

// 注册
PromptService.registerAppPrompts('myapp', myPrompts);
```

### 5.2 使用提示词生成内容

```typescript
import { PromptService } from '@/services/promptService';
import { AIGenerateService } from '@/services/aiGenerateService';

// 获取并渲染提示词
const template = PromptService.getPromptByScene('myapp.greeting');
if (template) {
  const rendered = PromptService.renderPrompt(template, {
    userName: '小明',
    style: '幽默'
  });
  
  // 调用 AI 生成
  const result = await AIGenerateService.generate({
    userPrompt: rendered.userPrompt,
    systemPrompt: rendered.systemPrompt
  });
  
  console.log(result.text);
}
```

### 5.3 执行提示词链

```typescript
import { promptChainService, promptChainExecutor } from '@/services';

// 获取链
const chain = await promptChainService.getChainById('chain.xxx');

// 执行
const result = await promptChainExecutor.execute(
  chain,
  { topic: '人工智能' },
  (event) => {
    console.log(`[${event.type}]`, event);
  }
);

console.log('输出:', result.outputs);
```

## 6. 相关服务

| 服务 | 路径 | 说明 |
|------|------|------|
| `AIGenerateService` | `@/services/aiGenerateService` | AI 生成服务 |
| `LLMTaskService` | `@/services/llmTask` | LLM 任务调度服务 |
| `NarrativeService` | `@/services/narrativeService` | 酒馆叙事获取服务 |

## 7. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 2026-01-08 | 初始版本，包含完整的提示词管理能力 |
