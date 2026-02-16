# 提示词链

提示词链（Prompt Chain）是一种多步骤 LLM 编排机制，允许将复杂任务拆分为多个步骤，每个步骤的输出可以作为后续步骤的输入。

## 1. 概述

### 1.1 使用场景

- **复杂任务分解**: 将一个复杂任务拆分为多个简单步骤
- **渐进式生成**: 先生成大纲，再逐段展开
- **多轮处理**: 生成 → 评审 → 修改
- **批量处理**: 对数组中的每个元素执行相同操作

### 1.2 核心概念

| 概念 | 说明 |
| ------ | ------ |
| **Chain** | 提示词链，包含多个步骤 |
| **Step** | 单个步骤，可以是 LLM 调用或数据转换 |
| **Input** | 链的输入变量 |
| **Output** | 链的输出结果 |
| **Context** | 执行上下文，存储所有步骤的输出 |

## 2. 执行模式

### 2.1 多步模式 (multi-step)

逐步执行每个步骤，每步调用一次 LLM：

```text
┌─────────┐    ┌─────────┐    ┌─────────┐
│  Step 1 │───▶│  Step 2 │───▶│  Step 3 │
│  LLM    │    │  LLM    │    │  LLM    │
└─────────┘    └─────────┘    └─────────┘
     │              │              │
     ▼              ▼              ▼
   输出1          输出2          输出3
     │              │              │
     └──────────────┴──────────────┘
                    │
                    ▼
              最终输出映射
```

**优点**:
- 每步可独立调试
- 支持条件分支和循环
- 中间结果可观测

**缺点**:
- 多次 API 调用，延迟较高
- Token 消耗可能更多

### 2.2 单次模式 (single-shot)

将所有步骤组装为一个复合提示词，单次调用 LLM：

```text
┌─────────────────────────────────────────┐
│           复合提示词                      │
│                                         │
│  任务 1: ...                            │
│  任务 2: ...                            │
│  任务 3: ...                            │
│                                         │
│  请以 JSON 格式返回所有结果              │
└─────────────────────────────────────────┘
                    │
                    ▼
              单次 LLM 调用
                    │
                    ▼
┌─────────────────────────────────────────┐
│  {                                      │
│    "task1": "...",                      │
│    "task2": "...",                      │
│    "task3": "..."                       │
│  }                                      │
└─────────────────────────────────────────┘
                    │
                    ▼
              解析并映射输出
```

**优点**:
- 单次调用，延迟低
- Token 效率可能更高

**缺点**:
- 不支持步骤间依赖
- 不支持条件和循环
- 调试困难

## 3. 步骤类型

### 3.1 Prompt 步骤

调用 LLM 生成内容：

```typescript
const step: ChainStep = {
  id: 'generate',
  name: '生成内容',
  type: 'prompt',
  
  // 方式一：引用已注册的提示词
  promptId: 'weibo.post.generate',
  
  // 方式二：使用内联模板
  // inlineTemplate: '请生成关于 {{topic}} 的内容',
  
  // 可选：覆盖系统提示词
  systemPrompt: '你是一个专业的内容创作者',
  
  // 输入变量映射
  inputMapping: {
    topic: 'topic',           // 从链输入获取
    style: 'previousStep.style'  // 从上一步输出获取
  },
  
  // 输出键名
  outputKey: 'content',
  
  // 后处理
  postProcess: {
    parseAs: 'json',
    extract: 'data.title'
  }
};
```

### 3.2 Transform 步骤

数据转换，不调用 LLM：

```typescript
const step: ChainStep = {
  id: 'transform',
  name: '合并结果',
  type: 'transform',
  
  inputMapping: {
    // 可以执行简单的表达式
    combined: 'step1.result',
    count: '5',
    enabled: 'true'
  },
  
  outputKey: 'transformed'
};
```

## 4. 变量与表达式

### 4.1 输入映射语法

`inputMapping` 支持以下表达式语法：

| 语法 | 说明 | 示例 |
| ------ | ------ | ------ |
| `varName` | 直接引用变量 | `topic` |
| `step.output` | 引用步骤输出 | `step1.result` |
| `a.b.c` | 嵌套属性访问 | `outline.sections.title` |
| `arr[0]` | 数组索引 | `items[0]` |
| `"string"` | 字符串字面量 | `"默认值"` |
| `123` | 数字字面量 | `100` |
| `true/false` | 布尔字面量 | `true` |

### 4.2 条件表达式

`condition` 字段支持条件判断：

```typescript
// Truthy 判断
condition: 'includeDetails'

// 否定判断
condition: '!skipThis'

// 比较运算
condition: 'count > 0'
condition: 'type === "full"'
condition: 'score >= 80'
```

### 4.3 输出映射

链的 `outputs` 字段定义最终输出：

```typescript
const chain: PromptChain = {
  // ...
  steps: [
    { id: 'step1', outputKey: 'outline', /* ... */ },
    { id: 'step2', outputKey: 'content', /* ... */ }
  ],
  outputs: {
    // 输出名: 表达式
    finalOutline: 'outline',
    finalContent: 'content',
    title: 'outline.title',
    wordCount: 'content.length'
  }
};
```

## 5. 后处理配置

### 5.1 解析格式

```typescript
interface StepPostProcess {
  parseAs: 'json' | 'text' | 'lines' | 'regex';
  extract?: string;      // 提取路径或正则
  defaultValue?: unknown; // 提取失败时的默认值
}
```

### 5.2 JSON 解析

```typescript
postProcess: {
  parseAs: 'json',
  extract: 'data.items'  // JSONPath 风格
}

// LLM 输出: {"data": {"items": [1, 2, 3]}}
// 步骤输出: [1, 2, 3]
```

### 5.3 按行分割

```typescript
postProcess: {
  parseAs: 'lines'
}

// LLM 输出:
// "第一行
// 第二行
// 第三行"
// 步骤输出: ["第一行", "第二行", "第三行"]
```

### 5.4 正则提取

```typescript
postProcess: {
  parseAs: 'regex',
  extract: '\\d+',  // 提取第一个数字
  defaultValue: '0'
}
```

## 6. 循环执行

### 6.1 固定次数循环

```typescript
const step: ChainStep = {
  id: 'batch',
  name: '批量生成',
  type: 'prompt',
  inlineTemplate: '生成第 {{index}} 个创意',
  inputMapping: {},
  outputKey: 'ideas',
  
  loop: {
    type: 'times',
    times: 5,           // 执行 5 次
    indexAs: 'index',   // 当前索引变量名
    maxIterations: 10   // 安全限制
  }
};

// 输出: ideas = ["创意1", "创意2", "创意3", "创意4", "创意5"]
```

### 6.2 遍历数组

```typescript
const step: ChainStep = {
  id: 'expand',
  name: '展开每个章节',
  type: 'prompt',
  inlineTemplate: '请展开以下章节：\n\n{{section}}',
  inputMapping: {
    section: 'item'  // 当前遍历项
  },
  outputKey: 'expandedSections',
  
  loop: {
    type: 'over',
    over: 'outline.sections',  // 要遍历的数组
    as: 'item',                // 当前项变量名
    indexAs: 'idx',            // 索引变量名
    maxIterations: 20
  }
};
```

### 6.3 循环输出

循环步骤的输出会自动合并为数组：

```typescript
// 5 次循环后
context.variables['ideas'] = [
  "第1次的输出",
  "第2次的输出",
  "第3次的输出",
  "第4次的输出",
  "第5次的输出"
];
```

## 7. 错误处理

### 7.1 错误处理策略

```typescript
const step: ChainStep = {
  // ...
  onError: 'fail' | 'skip' | 'retry',
  retryCount: 3  // 仅 onError='retry' 时有效
};
```

| 策略 | 说明 |
| ------ | ------ |
| `fail` | 终止整个链执行（默认） |
| `skip` | 跳过此步骤，继续执行后续步骤 |
| `retry` | 重试指定次数后再决定 |

### 7.2 步骤状态

```typescript
type StepExecutionStatus = 
  | 'pending'    // 等待执行
  | 'running'    // 执行中
  | 'completed'  // 成功完成
  | 'skipped'    // 被跳过（条件不满足或 onError='skip'）
  | 'failed'     // 执行失败
  | 'aborted';   // 被用户中止
```

## 8. 执行引擎 API

### 8.1 创建执行器

```typescript
import { PromptChainExecutor } from '@/services/promptChainExecutor';

const executor = new PromptChainExecutor({
  defaultTimeout: 60000,      // 默认超时（毫秒）
  maxSteps: 100,              // 最大步骤数（防止无限循环）
  saveHistory: true,          // 是否保存执行历史
  debug: false,               // 调试模式
  appId: 'myapp',             // App ID（用于系统提示词）
  disableSystemPrompt: false  // 是否禁用系统提示词注入
});
```

### 8.2 执行链

```typescript
const result = await executor.execute(
  chain,                      // PromptChain
  { topic: '人工智能' },       // 输入变量
  (event) => {                // 事件回调（可选）
    console.log(event);
  }
);
```

### 8.3 事件类型

```typescript
type ChainExecutionEvent = {
  type: 'start' | 'step-start' | 'step-complete' | 'step-error' | 'complete' | 'error' | 'abort';
  executionId: string;
  chainId: string;
  stepId?: string;
  stepIndex?: number;
  data?: unknown;     // 步骤结果或最终结果
  error?: string;
  timestamp: number;
};
```

### 8.4 中止执行

```typescript
// 中止特定执行
executor.abort(executionId);

// 中止所有执行
executor.abortAll();
```

### 8.5 执行结果

```typescript
interface ChainExecutionResult {
  executionId: string;
  chainId: string;
  status: 'completed' | 'failed' | 'aborted';
  outputs: Record<string, unknown>;  // 最终输出
  stepResults: StepExecutionResult[];
  error?: string;
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  totalDuration: number;  // 毫秒
  executionMode: 'multi-step' | 'single-shot';
}
```

## 9. 链管理 API

### 9.1 CRUD 操作

```typescript
import { promptChainService } from '@/services/promptChainService';

// 获取所有链
const chains = await promptChainService.getAllChains();

// 获取单个链
const chain = await promptChainService.getChainById('chain.xxx');

// 创建链
const newChain = await promptChainService.createChain({
  name: '我的链',
  description: '描述',
  executionMode: 'multi-step',
  inputs: [],
  steps: [],
  outputs: {},
  source: 'user',
  version: '1.0.0',
  enabled: true
});

// 更新链
await promptChainService.updateChain('chain.xxx', { name: '新名称' });

// 删除链
await promptChainService.deleteChain('chain.xxx');

// 复制链
const copied = await promptChainService.duplicateChain('chain.xxx');
```

### 9.2 步骤管理

```typescript
// 添加步骤
await promptChainService.addStep('chain.xxx', newStep, 2);  // 插入到索引 2

// 更新步骤
await promptChainService.updateStep('chain.xxx', 'step.yyy', { name: '新名称' });

// 删除步骤
await promptChainService.deleteStep('chain.xxx', 'step.yyy');

// 重新排序
await promptChainService.reorderSteps('chain.xxx', ['step3', 'step1', 'step2']);
```

### 9.3 导入导出

```typescript
// 导出为 JSON
const json = await promptChainService.exportChain('chain.xxx');

// 从 JSON 导入
const imported = await promptChainService.importChain(jsonString);
```

### 9.4 执行历史

```typescript
// 获取链的执行历史
const history = await promptChainService.getExecutionHistory('chain.xxx', 20);

// 获取单次执行详情
const execution = await promptChainService.getExecutionById('exec.xxx');

// 清理旧历史
const deleted = await promptChainService.cleanupOldHistory(30);  // 30 天前
```

## 10. 完整示例

### 10.1 内容生成流水线

```typescript
const contentPipeline: PromptChain = {
  id: 'chain.content-pipeline',
  name: '内容生成流水线',
  description: '先生成大纲，再逐段展开，最后生成摘要',
  executionMode: 'multi-step',
  
  inputs: [
    {
      name: 'topic',
      type: 'string',
      required: true,
      description: '文章主题'
    },
    {
      name: 'style',
      type: 'string',
      required: false,
      defaultValue: '专业',
      description: '写作风格'
    }
  ],
  
  steps: [
    {
      id: 'outline',
      name: '生成大纲',
      type: 'prompt',
      inlineTemplate: `请为主题「{{topic}}」生成一个文章大纲。

要求：
- 包含 3-5 个主要章节
- 每个章节有简短描述
- 以 JSON 格式返回

格式：
{
  "title": "文章标题",
  "sections": [
    { "heading": "章节标题", "description": "简述" }
  ]
}`,
      inputMapping: {
        topic: 'topic'
      },
      outputKey: 'outline',
      postProcess: {
        parseAs: 'json'
      }
    },
    {
      id: 'expand',
      name: '展开章节',
      type: 'prompt',
      inlineTemplate: `请为以下章节撰写详细内容（约 200 字）：

章节：{{section.heading}}
描述：{{section.description}}

写作风格：{{style}}`,
      inputMapping: {
        section: 'item',
        style: 'style'
      },
      outputKey: 'sections',
      loop: {
        type: 'over',
        over: 'outline.sections',
        as: 'item',
        maxIterations: 10
      }
    },
    {
      id: 'summary',
      name: '生成摘要',
      type: 'prompt',
      inlineTemplate: `请为以下文章生成一个 100 字以内的摘要：

标题：{{title}}

内容：
{{content}}`,
      inputMapping: {
        title: 'outline.title',
        content: 'sections'
      },
      outputKey: 'summary'
    }
  ],
  
  outputs: {
    title: 'outline.title',
    outline: 'outline',
    content: 'sections',
    summary: 'summary'
  },
  
  source: 'user',
  version: '1.0.0',
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
```

### 10.2 执行流水线

```typescript
import { promptChainExecutor } from '@/services/promptChainExecutor';

async function runPipeline() {
  const result = await promptChainExecutor.execute(
    contentPipeline,
    {
      topic: '人工智能的未来发展',
      style: '通俗易懂'
    },
    (event) => {
      switch (event.type) {
        case 'start':
          console.log('🚀 开始执行');
          break;
        case 'step-start':
          console.log(`📝 步骤 ${event.stepIndex! + 1}: ${event.stepId}`);
          break;
        case 'step-complete':
          console.log(`✅ 步骤完成`);
          break;
        case 'complete':
          console.log('🎉 全部完成');
          break;
        case 'error':
          console.error('❌ 错误:', event.error);
          break;
      }
    }
  );
  
  if (result.status === 'completed') {
    console.log('标题:', result.outputs.title);
    console.log('摘要:', result.outputs.summary);
    console.log('总耗时:', result.totalDuration, 'ms');
    console.log('Token 用量:', result.totalUsage);
  }
}
```
