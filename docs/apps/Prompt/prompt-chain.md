# 提示词链 (Prompt Chain)

提示词链是 Prompts App 的重大功能扩展，用于支持**多步骤 LLM 编排**。

## 概述

提示词链将多个提示词按顺序串联，实现复杂的多步骤 AI 任务。每一步的输出可以作为下一步的输入。

### 适用场景

- **内容创作**: 先构思大纲，再分章节写作
- **数据处理**: 提取 → 分类 → 总结
- **翻译润色**: 直译 → 意译 → 本地化
- **角色扮演**: 多角色依次发言

## 功能状态

| 功能 | 状态 | 说明 |
| :----- | :----- | :----- |
| 链编辑器 | ✅ 已完成 | 表单模式创建和编辑多步骤提示词链 |
| 执行引擎 | ✅ 已完成 | 顺序执行、变量传递、JSON 解析 |
| 执行监控 | ✅ 已完成 | 实时查看执行进度、中间结果 |
| 可视化预览 | ✅ 已完成 | 流程图式展示链结构和提示词预览 |
| 步骤复制 | ✅ 已完成 | 一键复制步骤，快速构建相似流程 |
| 提示词跳转 | ✅ 已完成 | 从步骤直接跳转到提示词编辑页面 |
| App 链编辑 | ✅ 已完成 | App 注册的链也可编辑和保存 |
| 步骤循环 | ✅ 已完成 | 设置步骤执行次数（1-100），结果自动合并为数组 |
| 全局对话框 | ✅ 已完成 | 使用统一对话框系统替代浏览器原生弹窗 |
| 多 Provider | 📋 待实现 | 每个步骤可使用不同的 LLM |
| 可视化编辑 | 📋 待实现 | 拖拽式流程图编辑 |
| 模板库 | 📋 待实现 | 预置常用链模板 |

## 路由

| 路径 | 组件 | 说明 |
| :----- | :----- | :----- |
| `/prompts/chains` | `ChainsList` | 链列表页（支持 App 链筛选） |
| `/prompts/chains/:id` | `ChainEditor` | 链编辑器（支持 App 链编辑） |
| `/prompts/chains/:id/run` | `ChainRunner` | 链执行与监控 |

## 核心类型

```typescript
// src/types/promptChain.ts

interface PromptChain {
  id: string;
  name: string;
  description: string;
  inputs: ChainVariableDefinition[];   // 输入变量定义
  steps: ChainStep[];                   // 执行步骤
  outputs: Record<string, string>;      // 输出映射
  executionMode: 'multi-step' | 'single-shot';
  enabled: boolean;
  source: 'builtin' | 'user' | 'imported' | 'app';
  appId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ChainStep {
  id: string;
  name: string;
  type: 'prompt' | 'transform' | 'condition' | 'loop';
  promptId?: string;          // 引用已注册的提示词
  inlineTemplate?: string;    // 或使用内联模板
  inputMapping: Record<string, string>;  // 变量映射
  outputKey: string;          // 输出存储的键名
  condition?: string;         // 条件表达式
  loop?: LoopConfig;          // 循环配置
}

interface LoopConfig {
  type: 'over' | 'times';
  times?: number;             // 固定次数循环
  over?: string;              // 遍历数组变量（待实现）
  maxIterations?: number;     // 最大迭代次数
}
```

## 执行模式

### 多步模式 (multi-step)

每个步骤独立调用 LLM，支持中间结果查看。

```
步骤 1 → 结果 1 → 步骤 2 → 结果 2 → 步骤 3 → 最终结果
```

### 单次模式 (single-shot)

合并为一个请求，速度快、成本低。

## 变量系统

### 输入变量

执行链时需要提供的参数：

```typescript
inputs: [
  { name: 'topic', type: 'string', required: true },
  { name: 'count', type: 'number', defaultValue: 3 }
]
```

### 变量引用

使用 `{{变量名}}` 语法引用变量：

| 语法 | 说明 |
| :----- | :----- |
| `{{topic}}` | 引用输入变量 |
| `{{step1.result}}` | 引用步骤 1 的输出 |
| `{{step1.result.items}}` | 引用嵌套属性（JSON 解析后） |

### 输出映射

定义链执行完成后返回的结果：

```typescript
outputs: {
  finalContent: 'step3.result',
  summary: 'step2.result.summary'
}
```

## 循环执行

步骤可以设置循环次数（1-100），结果自动合并为数组：

```typescript
{
  id: 'step2',
  name: '生成多条内容',
  loop: {
    type: 'times',
    times: 5,
    maxIterations: 10
  },
  outputKey: 'contents'  // 结果为数组
}
```

在可视化视图中，带循环的步骤会显示循环标记 `×N`。

## 链编辑器 (ChainEditor)

### 四个标签页

1. **基本**: 名称、描述、执行模式、标签、启用状态
2. **步骤**: 添加、删除、排序、编辑步骤
3. **IO**: 输入变量定义、输出映射配置
4. **可视化**: 流程图式预览链结构

### 步骤编辑

- **步骤名称**: 自定义名称
- **步骤类型**: Prompt（调用 LLM）或 Transform（数据转换）
- **提示词来源**: 选择已注册的提示词或使用内联模板
- **输出键名**: 步骤结果存储的变量名
- **输入映射**: 将变量映射到提示词模板
- **循环次数**: 设置执行次数
- **条件表达式**: 可选的执行条件

## 链执行器 (ChainRunner)

### 执行流程

```
1. 填写输入参数
       │
       ▼
2. 点击「执行链」
       │
       ▼
3. 实时显示进度条
       │
       ▼
4. 每个步骤完成后更新状态
       │
       ▼
5. 显示最终结果和执行日志
```

### 执行状态

| 状态 | 说明 |
| :----- | :----- |
| `pending` | 等待执行 |
| `running` | 正在执行 |
| `completed` | 执行完成 |
| `failed` | 执行失败 |

### 中止执行

支持中途取消正在进行的链执行。

## 与 LLM 任务系统集成

提示词链可以被 LLM 任务系统引用：

```typescript
// 在 llmTaskStore 中定义任务
{
  builtinId: 'weibo-hot-topic-pipeline',
  name: '🔗 热点内容流水线',
  type: 'chain',  // 使用提示词链
  chainId: 'chain.weibo.微博热点内容生成.0',
  defaultInput: {
    timeContext: '当前时间',
    postCount: 3,
  },
  outputHandler: 'chain-result',
}
```

## 服务 API

### PromptChainService

```typescript
import { promptChainService } from '@/services/promptChainService';

// 获取所有链
const chains = await promptChainService.getAllChains();

// 获取单个链
const chain = await promptChainService.getChainById(id);

// 创建链
const newChain = await promptChainService.createChain(chainData);

// 更新链
await promptChainService.updateChain(id, updates);

// 删除链
await promptChainService.deleteChain(id);

// 复制链
const copy = await promptChainService.duplicateChain(id);

// 切换启用状态
await promptChainService.toggleChain(id);

// 验证链配置
const { valid, errors } = promptChainService.validateChain(chain);
```

### PromptChainExecutor

```typescript
import { promptChainExecutor } from '@/services/promptChainExecutor';

// 执行链
const result = await promptChainExecutor.execute(
  chain,
  inputValues,
  (event) => {
    // 处理执行事件
    switch (event.type) {
      case 'start': // 开始执行
      case 'step-start': // 步骤开始
      case 'step-complete': // 步骤完成
      case 'step-error': // 步骤错误
      case 'error': // 全局错误
      case 'abort': // 执行中止
    }
  }
);

// 中止执行
promptChainExecutor.abort(executionId);
```
