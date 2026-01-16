# 类型定义

本文档详细描述提示词服务的所有 TypeScript 类型定义。

## 1. 提示词类型 (`src/types/prompts.ts`)

### 1.1 基础类型

#### PromptCategory

提示词分类枚举。

```typescript
type PromptCategory =
  | 'chat'       // 聊天 App - 消息生成
  | 'email'      // 邮件 - 邮件内容生成
  | 'browser'    // 浏览器 - 网页内容生成
  | 'live'       // 直播 - 弹幕/评论生成
  | 'social'     // 社交媒体 - 帖子/评论/热搜生成
  | 'system';    // 系统级提示词
```

#### SystemPromptScope

系统提示词作用域。

```typescript
type SystemPromptScope = 'global' | 'app';
```

| 值 | 说明 |
|----| ---- |
| `global` | 全局作用域，影响所有 LLM 调用 |
| `app` | App 级作用域，仅影响特定 App |

#### SystemPromptMode

系统提示词继承模式。

```typescript
type SystemPromptMode = 'append' | 'override';
```

| 值 | 说明 |
|----|------|
| `append` | 追加到上层系统提示词之后 |
| `override` | 覆盖上层系统提示词 |

#### PromptSource

提示词来源类型（联合类型）。

```typescript
type PromptSource =
  | { type: 'builtin' }            // 系统内置
  | { type: 'app'; appId: string } // 来自安装的 App
  | { type: 'user' };              // 用户自定义
```

### 1.2 核心接口

#### PromptVariable

提示词变量定义。

```typescript
interface PromptVariable {
  /** 变量名（如 {{characterName}}） */
  name: string;
  
  /** 变量描述 */
  description: string;
  
  /** 变量类型 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  
  /** 是否必填 */
  required: boolean;
  
  /** 默认值 */
  defaultValue?: unknown;
  
  /** 示例值 */
  example?: unknown;
}
```

**使用示例**:

```typescript
const variable: PromptVariable = {
  name: 'userName',
  description: '用户的名称',
  type: 'string',
  required: true,
  defaultValue: '访客',
  example: '小明'
};
```

#### PromptTemplate

单个提示词模板定义。

```typescript
interface PromptTemplate {
  /** 唯一标识符 */
  id: string;
  
  /** 提示词名称（用于显示） */
  name: string;
  
  /** 提示词描述 */
  description?: string;
  
  /** 所属分类 */
  category: PromptCategory;
  
  /** 场景标识（如 chat.reply, chat.new_conversation） */
  scene: string;

  /** 提示词图标 */
  icon?: NotificationIcon;
  
  /** 提示词模板内容（支持变量占位符） */
  template: string;
  
  /** 系统提示词（可选，用于设置 AI 角色） */
  systemPrompt?: string;
  
  /** 可用变量列表 */
  availableVariables: PromptVariable[];
  
  /** 提示词来源 */
  source: PromptSource;
  
  /** 是否为内置提示词 @deprecated 使用 source.type === 'builtin' */
  isBuiltin: boolean;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 优先级（同场景多个提示词时的选择顺序） */
  priority: number;
  
  /** 版本号 */
  version: string;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 更新时间 */
  updatedAt: string;
  
  // ========== 系统提示词专用字段 ==========
  
  /** 是否为系统提示词 */
  isSystemPrompt?: boolean;
  
  /** 系统提示词作用域 */
  systemPromptScope?: SystemPromptScope;
  
  /** 系统提示词继承模式（仅 app 作用域有效） */
  systemPromptMode?: SystemPromptMode;
  
  /** 适用场景列表（支持通配符如 'social.*'） */
  applicableScenes?: string[];
  
  /** 排除场景列表（优先级高于 applicableScenes） */
  excludeScenes?: string[];
}
```

#### AppPromptDefinition

App 提示词定义（用于 App 注册）。

```typescript
interface AppPromptDefinition {
  /** 场景标识 */
  scene: string;
  /** 提示词名称 */
  name: string;
  /** 提示词描述 */
  description?: string;
  /** 提示词图标 */
  icon?: NotificationIcon;
  /** 所属分类 */
  category: PromptCategory;
  /** 提示词模板 */
  template: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 可用变量 */
  availableVariables: PromptVariable[];
  /** 优先级 */
  priority?: number;
}
```

#### RenderedPrompt

提示词渲染结果。

```typescript
interface RenderedPrompt {
  /** 系统提示词（如有） */
  systemPrompt?: string;
  /** 用户提示词 */
  userPrompt: string;
}
```

#### PromptEditPermission

提示词编辑权限。

```typescript
interface PromptEditPermission {
  /** 是否可编辑 */
  canEdit: boolean;
  /** 可编辑的字段列表，'*' 表示所有字段 */
  editableFields: string[];
  /** 是否可删除 */
  canDelete: boolean;
}
```

#### PromptSystemConfig

提示词系统配置（存储结构）。

```typescript
interface PromptSystemConfig {
  /** 所有提示词模板 */
  templates: PromptTemplate[];
  
  /** 全局变量（可在所有提示词中使用） */
  globalVariables: Record<string, unknown>;
  
  /** 元数据 */
  _meta: {
    version: string;
    lastUpdated: string;
  };
}
```

### 1.3 常量

#### PROMPT_CATEGORIES

预定义的分类列表。

```typescript
const PROMPT_CATEGORIES: PromptCategoryInfo[] = [
  { id: 'all', name: '全部', icon: 'fas fa-th-large' },
  { id: 'chat', name: '聊天', icon: 'fas fa-comments' },
  { id: 'email', name: '邮件', icon: 'fas fa-envelope' },
  { id: 'browser', name: '浏览器', icon: 'fas fa-globe' },
  { id: 'live', name: '直播', icon: 'fas fa-video' },
  { id: 'social', name: '社交', icon: 'fas fa-hashtag' },
  { id: 'system', name: '系统', icon: 'fas fa-cog' },
];
```

---

## 2. 提示词链类型 (`src/types/promptChain.ts`)

### 2.1 基础类型

#### ChainExecutionMode

链执行模式。

```typescript
type ChainExecutionMode = 'multi-step' | 'single-shot';
```

| 值 | 说明 |
|----|------|
| `multi-step` | 多步模式，逐步执行每个步骤 |
| `single-shot` | 单次模式，组装为一个复合提示词一次调用 |

#### ChainStepType

链步骤类型。

```typescript
type ChainStepType = 'prompt' | 'transform' | 'condition' | 'loop';
```

| 值 | 说明 |
|----|------|
| `prompt` | 调用 LLM 生成 |
| `transform` | 数据转换（不调用 LLM） |
| `condition` | 条件分支（规划中） |
| `loop` | 循环步骤（规划中） |

### 2.2 配置接口

#### ChainVariableDefinition

链变量定义（扩展自 PromptVariable）。

```typescript
interface ChainVariableDefinition extends PromptVariable {
  /** 变量来源 */
  source?: 'input' | 'context' | 'previous_step';
  /** 来源路径 */
  sourcePath?: string;
}
```

#### StepPostProcess

步骤后处理配置。

```typescript
interface StepPostProcess {
  /** 解析格式 */
  parseAs: 'json' | 'text' | 'lines' | 'regex';
  /** 提取路径（JSONPath 或正则表达式） */
  extract?: string;
  /** 提取失败时的默认值 */
  defaultValue?: unknown;
}
```

#### LoopConfig

循环配置。

```typescript
interface LoopConfig {
  /** 循环类型 */
  type: 'over' | 'times';
  /** 遍历的数组变量路径（type='over' 时） */
  over?: string;
  /** 循环次数（type='times' 时） */
  times?: number;
  /** 当前项的变量名 */
  as?: string;
  /** 当前索引的变量名 */
  indexAs?: string;
  /** 最大迭代次数（防止无限循环） */
  maxIterations?: number;
}
```

#### StepProviderConfig

步骤级 Provider 配置。

```typescript
interface StepProviderConfig {
  /** 使用指定的 API 预设 ID */
  presetId?: string;
  /** 临时覆盖参数 */
  overrides?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}
```

#### SingleShotConfig

单次模式配置。

```typescript
interface SingleShotConfig {
  /** 组装模板 */
  compositeTemplate?: string;
  /** 响应解析映射：{ outputKey: JSONPath } */
  responseMapping: Record<string, string>;
  /** 最大 Token */
  maxTokens?: number;
  /** 是否生成 JSON Schema 约束 */
  useJsonSchema?: boolean;
}
```

### 2.3 核心接口

#### ChainStep

链步骤定义。

```typescript
interface ChainStep {
  /** 步骤 ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤类型 */
  type: ChainStepType;
  /** 步骤描述 */
  description?: string;
  
  // ========== Prompt 步骤 ==========
  /** 关联的提示词 ID */
  promptId?: string;
  /** 内联模板 */
  inlineTemplate?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  
  // ========== 变量映射 ==========
  /** 输入变量映射 */
  inputMapping: Record<string, string>;
  /** 输出键名 */
  outputKey: string;
  
  // ========== 后处理 ==========
  /** 后处理配置 */
  postProcess?: StepPostProcess;
  
  // ========== Provider 配置 ==========
  /** 步骤级 Provider 配置 */
  provider?: StepProviderConfig;
  
  // ========== 控制流 ==========
  /** 循环配置 */
  loop?: LoopConfig;
  /** 条件表达式 */
  condition?: string;
  /** 错误处理策略 */
  onError?: 'fail' | 'skip' | 'retry';
  /** 重试次数 */
  retryCount?: number;
}
```

#### PromptChain

提示词链定义。

```typescript
interface PromptChain {
  /** 链 ID */
  id: string;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 链图标 */
  icon?: string;
  /** 链分类标签 */
  tags?: string[];
  /** 所属应用 ID */
  appId?: string;
  
  // ========== 执行配置 ==========
  /** 执行模式 */
  executionMode: ChainExecutionMode;
  /** 链级默认 Provider */
  defaultPresetId?: string;
  /** 触发方式 */
  trigger?: ChainTrigger;
  
  // ========== 输入输出 ==========
  /** 链输入变量定义 */
  inputs: ChainVariableDefinition[];
  /** 链步骤列表 */
  steps: ChainStep[];
  /** 链输出映射 */
  outputs: Record<string, string>;
  
  // ========== 单次模式配置 ==========
  /** 单次模式专用配置 */
  singleShotConfig?: SingleShotConfig;
  
  // ========== 元数据 ==========
  /** 来源 */
  source: 'builtin' | 'user' | 'imported' | 'app';
  /** 版本 */
  version: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}
```

### 2.4 执行相关类型

#### StepExecutionStatus

步骤执行状态。

```typescript
type StepExecutionStatus = 
  | 'pending'    // 等待执行
  | 'running'    // 执行中
  | 'completed'  // 已完成
  | 'skipped'    // 已跳过
  | 'failed'     // 执行失败
  | 'aborted';   // 被中止
```

#### StepExecutionResult

步骤执行结果。

```typescript
interface StepExecutionResult {
  /** 步骤 ID */
  stepId: string;
  /** 执行状态 */
  status: StepExecutionStatus;
  /** 输出值 */
  output?: unknown;
  /** 原始 LLM 响应 */
  rawResponse?: string;
  /** 错误信息 */
  error?: string;
  /** Token 用量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 执行耗时（毫秒） */
  duration?: number;
  /** 循环迭代结果 */
  iterations?: StepExecutionResult[];
}
```

#### ChainExecutionContext

链执行上下文。

```typescript
interface ChainExecutionContext {
  /** 链 ID */
  chainId: string;
  /** 执行 ID */
  executionId: string;
  /** 输入变量 */
  inputs: Record<string, unknown>;
  /** 当前变量作用域 */
  variables: Record<string, unknown>;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 开始时间 */
  startTime: number;
  /** 是否已中止 */
  aborted: boolean;
}
```

#### ChainExecutionStatus

链执行状态。

```typescript
type ChainExecutionStatus = 
  | 'pending'    // 等待开始
  | 'running'    // 执行中
  | 'completed'  // 全部完成
  | 'failed'     // 执行失败
  | 'aborted';   // 被中止
```

#### ChainExecutionResult

链执行结果。

```typescript
interface ChainExecutionResult {
  /** 执行 ID */
  executionId: string;
  /** 链 ID */
  chainId: string;
  /** 执行状态 */
  status: ChainExecutionStatus;
  /** 最终输出 */
  outputs: Record<string, unknown>;
  /** 各步骤结果 */
  stepResults: StepExecutionResult[];
  /** 错误信息 */
  error?: string;
  /** 总 Token 用量 */
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 执行模式 */
  executionMode: ChainExecutionMode;
}
```

### 2.5 事件类型

#### ChainExecutionEvent

链执行事件。

```typescript
interface ChainExecutionEvent {
  type: 'start' | 'step-start' | 'step-complete' | 'step-error' | 'complete' | 'error' | 'abort';
  executionId: string;
  chainId: string;
  stepId?: string;
  stepIndex?: number;
  data?: unknown;
  error?: string;
  timestamp: number;
}
```

#### ChainExecutionCallback

执行事件回调函数类型。

```typescript
type ChainExecutionCallback = (event: ChainExecutionEvent) => void;
```

### 2.6 存储类型

#### ChainExecutionHistory

执行历史记录。

```typescript
interface ChainExecutionHistory {
  /** 执行 ID */
  executionId: string;
  /** 链 ID */
  chainId: string;
  /** 链名称快照 */
  chainName: string;
  /** 执行状态 */
  status: ChainExecutionStatus;
  /** 输入参数 */
  inputs: Record<string, unknown>;
  /** 输出结果 */
  outputs: Record<string, unknown>;
  /** Token 用量 */
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 耗时 */
  totalDuration: number;
  /** 执行时间 */
  executedAt: number;
  /** 错误信息 */
  error?: string;
}
```
