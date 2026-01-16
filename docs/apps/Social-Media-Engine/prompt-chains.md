# 提示词链 (Prompt Chains)

## 1. 概述

提示词链是一种**声明式的多步骤 LLM 编排机制**，用于替代硬编码在服务中的调用逻辑。

### 1.1 对比优势

| 对比项 | 硬编码方式 | 提示词链 |
| ------ | ---------- | -------- |
| **可视化** | ❌ 需要读代码 | ✅ 表单编辑 + 实时监控 |
| **变量传递** | 手动拼接 | 声明式映射 |
| **调试** | console.log | 可查看每步中间结果 |
| **复用** | 复制代码 | 引用已有链 |
| **用户定制** | 不可能 | 可导出/导入/修改 |

### 1.2 实现状态

> **状态**: ✅ Phase 1-3 已完成

* [x] 类型定义 (`src/types/promptChain.ts`)
* [x] 数据存储 (IndexedDB `promptChains` 表)
* [x] 管理服务 (`PromptChainService`)
* [x] 执行引擎 (`PromptChainExecutor`)
* [x] 链列表页 (`ChainsList.vue`)
* [x] 链编辑器 (`ChainEditor.vue`)
* [x] 执行监控 (`ChainRunner.vue`)
* [x] 微博链集成 (`src/apps/weibo/chains.ts`)

## 2. 数据结构

### 2.1 PromptChain

```typescript
interface PromptChain {
  id: string;
  name: string;
  description: string;
  
  // 链输入变量定义
  inputs: ChainVariableDefinition[];
  
  // 执行步骤
  steps: ChainStep[];
  
  // 输出映射
  outputs: Record<string, string>;
  
  // 执行模式
  executionMode: 'multi-step' | 'single-shot';
  
  // 是否启用
  enabled: boolean;
  
  // 元数据
  appId?: string;           // 所属 App（App 链）
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 ChainStep

```typescript
interface ChainStep {
  id: string;
  name: string;
  
  // 步骤类型
  type: 'prompt' | 'transform' | 'condition' | 'loop';
  
  // Prompt 配置
  promptId?: string;         // 引用已有提示词
  inlineTemplate?: string;   // 或内联模板
  
  // 变量映射
  inputMapping: Record<string, string>;
  outputKey: string;
  
  // 条件（condition 类型）
  condition?: string;
  
  // 循环（loop 类型）
  loop?: {
    over?: string;          // 遍历的数组
    times?: number;         // 固定次数
    itemKey?: string;       // 当前项变量名
  };
  
  // Provider 配置（规划中）
  provider?: {
    presetId?: string;
    overrides?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  };
}
```

### 2.3 变量定义

```typescript
interface ChainVariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
}
```

## 3. 执行模式

### 3.1 多步模式 (Multi-Step Mode) ✅

**默认模式**，每个步骤独立调用 LLM：

```text
Step 1 → LLM Call → Result 1
                        ↓
Step 2 → LLM Call → Result 2
                        ↓
Step 3 → LLM Call → Result 3
```

**优势**：
* 步骤间可查看中间结果
* 单步失败可重试
* 不同步骤可使用不同 Provider

### 3.2 单次模式 (Single-Shot Mode) 📋

将整个链组装成一个复合提示词，一次性请求：

```text
所有步骤 → 组装成一个 Prompt → 单次 LLM Call → 解析所有结果
```

**优势**：
* API 调用次数少
* 延迟低
* 成本低

**劣势**：
* 无法查看中间结果
* 失败需全部重来

## 4. 示例：微博热点生成链

### 4.1 流程图

```text
┌─────────┐     ┌─────────┐     ┌─────────┐
│ 🌍 输入  │────▶│ Step 1  │────▶│ Step 2  │
│timeContext    │ 生成事件 │     │ 提取标签 │
└─────────┘     └─────────┘     └────┬────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │    Step 3       │
                            │   生成博文 ×3   │
                            │  [prompt+loop]  │
                            └────────┬────────┘
                                     │
                  ┌──────────────────┼──────────────────┐
                  ▼                  ▼                  ▼
            ┌──────────┐      ┌──────────┐      ┌──────────┐
            │ Step 4.1 │      │ Step 4.2 │      │ Step 4.3 │
            │ 评论×5   │      │ 评论×5   │      │ 评论×5   │
            └──────────┘      └──────────┘      └──────────┘
```

### 4.2 链定义

```typescript
const weiboHotTopicPipeline: PromptChain = {
  id: 'weibo-hot-topic-pipeline',
  name: '微博热点内容生成',
  description: '从时间背景生成完整的热点话题、博文和评论',
  appId: 'weibo',
  
  inputs: [
    { name: 'timeContext', type: 'string', required: true },
    { name: 'eventType', type: 'string', required: false, default: 'random' },
  ],
  
  steps: [
    {
      id: 'step1',
      name: '生成世界事件',
      type: 'prompt',
      promptId: 'social.event.generate',
      inputMapping: {
        timeContext: '{{inputs.timeContext}}',
        eventType: '{{inputs.eventType}}',
      },
      outputKey: 'event',
    },
    {
      id: 'step2',
      name: '提取话题标签',
      type: 'transform',
      inlineTemplate: '#{{event.keywords[0]}}#',
      outputKey: 'topic',
    },
    {
      id: 'step3',
      name: '生成博文',
      type: 'prompt',
      promptId: 'social.post.generate.weibo',
      inputMapping: {
        topic: '{{topic}}',
      },
      outputKey: 'posts',
      loop: {
        times: 3,
      },
    },
    {
      id: 'step4',
      name: '生成评论',
      type: 'prompt',
      promptId: 'social.comment.batch',
      inputMapping: {
        postContent: '{{item.payload.text}}',
        count: 5,
      },
      outputKey: 'comments',
      loop: {
        over: 'posts',
        itemKey: 'item',
      },
    },
  ],
  
  outputs: {
    event: '{{event}}',
    posts: '{{posts}}',
    comments: '{{comments}}',
  },
  
  executionMode: 'multi-step',
  enabled: true,
};
```

## 5. 执行引擎 API

### 5.1 PromptChainExecutor

```typescript
class PromptChainExecutor {
  /**
   * 执行提示词链
   */
  async execute(
    chain: PromptChain,
    inputs: Record<string, any>,
    options?: ExecuteOptions
  ): Promise<ChainExecutionResult>;
  
  /**
   * 执行单个步骤
   */
  async executeStep(
    step: ChainStep,
    context: ExecutionContext
  ): Promise<StepResult>;
}

interface ExecuteOptions {
  onStepStart?: (step: ChainStep) => void;
  onStepComplete?: (step: ChainStep, result: any) => void;
  onStepError?: (step: ChainStep, error: Error) => void;
}

interface ChainExecutionResult {
  success: boolean;
  outputs: Record<string, any>;
  stepResults: StepResult[];
  duration: number;
  errors?: string[];
}
```

### 5.2 使用示例

```typescript
import { promptChainExecutor, promptChainService } from '@/services';

// 获取链
const chain = await promptChainService.getChain('weibo-hot-topic-pipeline');

// 执行链
const result = await promptChainExecutor.execute(chain, {
  timeContext: '2026年1月5日，周日下午',
  eventType: 'entertainment',
}, {
  onStepComplete: (step, result) => {
    console.log(`步骤 ${step.name} 完成:`, result);
  },
});

// 处理结果
if (result.success) {
  const { event, posts, comments } = result.outputs;
  // 保存到数据库...
}
```

## 6. App 链注册

### 6.1 注册方式

```typescript
// src/apps/weibo/manifest.ts
export const weiboManifest: AppManifest = {
  id: 'weibo',
  
  // 提示词链
  chains: weiboChains,
  
  onMount() {
    promptChainService.registerAppChains('weibo', this.chains);
  },
};
```

### 6.2 查询 App 链

```typescript
// 获取所有 App 链
const allAppChains = promptChainService.getAllAppChains();

// 获取指定 App 的链
const weiboChains = promptChainService.getAppChains('weibo');
```

### 6.3 App 链特性

* **只读**：App 链在 UI 中只能查看，不能编辑
* **不持久化**：App 链不保存到数据库，由 App 代码定义
* **优先级**：用户创建的同名链会覆盖 App 链

## 7. LLM 任务集成

### 7.1 任务类型

```typescript
interface LLMTask {
  id: string;
  type: 'prompt' | 'chain';  // 单次调用 或 链执行
  
  // type: 'prompt' 时使用
  prompt?: string;
  systemPrompt?: string;
  
  // type: 'chain' 时使用
  chainId?: string;
  chainInputs?: Record<string, any>;
}
```

### 7.2 执行逻辑

```typescript
async function executeTask(task: LLMTask) {
  if (task.type === 'chain') {
    const chain = await promptChainService.getChain(task.chainId!);
    return promptChainExecutor.execute(chain, task.chainInputs || {});
  } else {
    // 单次 LLM 调用
    return aiService.generate({
      systemPrompt: task.systemPrompt,
      userPrompt: task.prompt,
    });
  }
}
```

## 8. 多 Provider 策略（规划中）

### 8.1 配置层级

| 层级 | 配置位置 | 说明 |
| ---- | -------- | ---- |
| **步骤级** | `step.provider.presetId` | 该步骤使用指定预设 |
| **链级** | `chain.defaultPresetId` | 链内所有步骤的默认预设 |
| **全局** | API Manager 激活的预设 | 系统全局默认 |
| **回退** | 酒馆 API | 无自定义配置时使用 |

### 8.2 成本优化示例

```typescript
const optimizedChain: PromptChain = {
  id: 'cost-optimized-pipeline',
  defaultPresetId: 'deepseek-chat',  // 默认用便宜模型
  
  steps: [
    {
      id: 'step1',
      name: '生成事件（简单任务）',
      // 使用默认 (DeepSeek)
    },
    {
      id: 'step2',
      name: '生成高质量博文（核心内容）',
      provider: {
        presetId: 'gpt-4-turbo',  // 核心内容用强模型
      },
    },
    {
      id: 'step3',
      name: '批量生成评论（高并发）',
      provider: {
        presetId: 'groq-llama',   // 评论用高速低成本模型
        overrides: {
          temperature: 0.9,       // 评论更随机
        },
      },
    },
  ],
};
```

### 8.3 推荐配置

| 任务类型 | 推荐模型 | 理由 |
| -------- | -------- | ---- |
| 事件生成 | DeepSeek / GPT-3.5 | 结构化输出，简单任务 |
| 博文创作 | GPT-4 / Claude 3 | 需要创意和文风把控 |
| 评论批量 | Groq (Llama) / Gemini Flash | 高并发，低延迟 |
| 用户画像 | 任意 | 格式化输出，要求不高 |
| JSON 提取 | GPT-3.5 / DeepSeek | 纯格式转换 |
