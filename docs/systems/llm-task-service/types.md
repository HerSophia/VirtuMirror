# 类型定义

## 基础枚举

```typescript
// src/services/llmTask/types.ts

export type LLMTaskStatus = 
  | 'pending'    // 待执行
  | 'running'    // 执行中
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'paused'     // 已暂停
  | 'cancelled'; // 已取消

export type LLMTaskType = 
  | 'manual'  // 手动提示词
  | 'prompt'  // 注册提示词
  | 'chain';  // 提示词链

export type LLMConfigSource = 
  | 'global'  // 使用全局配置
  | 'preset'  // 使用预设
  | 'custom'; // 自定义配置

export type TaskExecutionMode = 
  | 'once'       // 一次性执行
  | 'repeatable' // 可重复执行
  | 'auto';      // 自动循环执行
```

---

## 配置类型

```typescript
export interface AutoExecutionConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxExecutions: number;      // 0 = 无限
  executionCount: number;
  nextExecutionAt?: number;
  lastExecutionAt?: number;
}

export interface LLMTaskConfig {
  source: LLMConfigSource;
  presetId?: string;
  presetName?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}
```

---

## 共享上下文配置

用于声明任务需要从 Context Sharing Service 获取的上下文。

```typescript
import type { ContextType } from '@/services/contextSharing/types';

/**
 * 共享上下文配置
 * @see docs/systems/context-sharing-service/integration-design.md
 */
export interface SharedContextConfig {
  /**
   * 需要聚合的上下文类型
   * 例如：['narrative:content', 'social:trending']
   */
  types?: ContextType[];

  /**
   * 需要聚合的上下文 ID
   * 例如：['weibo:trending', 'narrative:current']
   */
  ids?: string[];

  /**
   * 输出格式
   * @default 'xml'
   */
  format?: 'xml' | 'text' | 'markdown' | 'raw';

  /**
   * 最大 token 数限制
   * @default 2000
   */
  maxTokens?: number;

  /**
   * 优先级排序（优先保留的类型，token 不足时按此顺序截断）
   */
  priority?: ContextType[];

  /**
   * 注入的变量名
   * @default 'sharedContext'
   */
  variableName?: string;
}
```

---

## 输入字段定义

```typescript
export interface InputFieldDefinition {
  /** 字段名（用于变量替换） */
  name: string;
  /** 显示标签 */
  label: string;
  /** 字段类型 */
  type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  defaultValue?: any;
  /** 下拉选项（type='select' 时使用） */
  options?: Array<{ value: any; label: string }>;
  /** 占位符 */
  placeholder?: string;
  /** 帮助文本 */
  helpText?: string;
}
```

---

## 任务定义

任务定义由 App 注册，描述一类任务的配置模板。

```typescript
export interface LLMTaskDefinition {
  /** 
   * 唯一标识
   * 格式建议：appId:taskId，如 "weibo:generate-post"
   */
  id: string;
  
  /** 归属 App ID */
  appId: string;
  
  /** 任务名称（用于 UI 显示） */
  name: string;
  
  /** 任务描述 */
  description?: string;
  
  /** 图标（emoji 或图标名） */
  icon?: string;
  
  /** 分类（用于 UI 分组） */
  category?: string;
  
  // === 执行配置 ===
  
  /** 任务类型 */
  type: LLMTaskType;
  
  /** 执行模式 */
  executionMode: TaskExecutionMode;
  
  /** 自动执行默认配置 */
  autoConfig?: Partial<AutoExecutionConfig>;
  
  // === 提示词配置（三选一） ===
  
  /** 提示词 ID（type='prompt'） */
  promptId?: string;
  
  /** 提示词链 ID（type='chain'） */
  chainId?: string;
  
  /** 手动提示词模板（type='manual'） */
  promptTemplate?: string;
  
  /** 系统提示词 */
  systemPrompt?: string;
  
  // === 输入配置 ===
  
  /** 输入字段定义 */
  inputSchema: InputFieldDefinition[];
  
  /** 默认输入值 */
  defaultInput: Record<string, any>;
  
  // === LLM 配置 ===
  
  /** 推荐的 LLM 配置 */
  config?: Partial<LLMTaskConfig>;
  
  /** 请求优先级 */
  priority?: RequestPriority;
  
  // === 扩展点 ===
  
  /** 
   * 输出处理器 ID
   * 格式：appId:handlerId，如 "weibo:post-handler"
   */
  outputHandlerId: string;
  
  /** 
   * 所需的上下文提供器 ID 列表
   * 格式：appId:providerId，如 ["weibo:narrative", "weibo:existing-content"]
   */
  contextProviders?: string[];
  
  /**
   * 共享上下文配置（来自 Context Sharing Service）
   * 如果配置了此字段，任务执行时会自动从 Context Sharing Service 聚合上下文
   * @see docs/systems/context-sharing-service/integration-design.md
   */
  sharedContextConfig?: SharedContextConfig;
  
  // === 元数据 ===
  
  /** 是否在任务列表中默认显示 */
  showByDefault?: boolean;
  
  /** 标签（用于搜索和过滤） */
  tags?: string[];
}
```

---

## 任务实例

任务实例是运行时状态，由任务定义创建。

```typescript
export interface LLMTask {
  /** 任务实例 ID（UUID） */
  id: string;
  
  /** 关联的任务定义 ID */
  definitionId: string;
  
  /** 归属 App ID（冗余存储，便于查询） */
  appId: string;
  
  /** 任务名称（可自定义，默认取自定义） */
  name: string;
  
  /** 任务描述 */
  description?: string;
  
  /** 任务状态 */
  status: LLMTaskStatus;
  
  /** 执行模式（可运行时修改） */
  executionMode: TaskExecutionMode;
  
  /** 自动执行配置 */
  autoConfig?: AutoExecutionConfig;
  
  // === 运行时配置 ===
  
  /** 任务类型（继承自定义） */
  type: LLMTaskType;
  
  /** 当前输入值 */
  input: Record<string, any>;
  
  /** LLM 配置 */
  config: LLMTaskConfig;
  
  /** 请求优先级 */
  priority: RequestPriority;
  
  // === 提示词（运行时解析） ===
  
  /** 解析后的用户提示词 */
  resolvedPrompt?: string;
  
  /** 系统提示词 */
  systemPrompt?: string;
  
  // === 执行结果 ===
  
  /** 最新输出 */
  output?: string;
  
  /** 链执行结果 */
  chainResult?: ChainExecutionResult;
  
  /** 历史输出（可重复/自动任务） */
  outputHistory?: OutputHistoryEntry[];
  
  /** 错误信息 */
  error?: string;
  
  /** Token 使用量 */
  usage?: TokenUsage;
  
  // === 时间戳 ===
  
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  
  // === 统计 ===
  
  totalExecutions: number;
  retryCount: number;
  maxRetries: number;
}

export interface OutputHistoryEntry {
  timestamp: number;
  output: string;
  usage?: TokenUsage;
  chainResult?: ChainExecutionResult;
}
```

---

## 上下文提供器

上下文提供器为任务执行提供动态变量。

```typescript
export interface ContextProvider {
  /** 
   * 提供器 ID
   * 格式：appId:providerId，如 "weibo:narrative"
   */
  id: string;
  
  /** 归属 App */
  appId: string;
  
  /** 提供器名称（用于日志） */
  name: string;
  
  /** 描述 */
  description?: string;
  
  /** 
   * 变量名前缀（可选）
   * 用于命名空间隔离，如 prefix="narrative" 则变量为 narrativeContent
   */
  variablePrefix?: string;
  
  /** 
   * 获取上下文变量
   * 返回的 key-value 将用于变量替换
   */
  getContext(): Promise<Record<string, string>>;
  
  /** 
   * 获取元数据（用于日志和调试）
   */
  getMetadata?(): Record<string, any>;
  
  /** 
   * 优先级（决定执行顺序）
   * 数值越小优先级越高，默认 100
   */
  priority?: number;
}
```

### 使用场景

* 注入叙事内容（来自酒馆的聊天记录）
* 注入现有内容（避免重复生成）
* 注入时间上下文（当前时间、时段等）
* 注入用户上下文（当前用户信息）

---

## 输出处理器

输出处理器处理 LLM 生成的结果。

```typescript
export interface OutputHandler {
  /** 
   * 处理器 ID
   * 格式：appId:handlerId，如 "weibo:post-handler"
   */
  id: string;
  
  /** 归属 App */
  appId: string;
  
  /** 处理器名称 */
  name: string;
  
  /** 描述 */
  description?: string;
  
  /** 
   * 处理 LLM 输出
   * @param output LLM 生成的原始文本
   * @param task 任务实例
   * @param context 执行上下文
   * @returns 处理结果
   */
  handle(
    output: string,
    task: LLMTask,
    context: TaskExecutionContext
  ): Promise<OutputHandlerResult>;
  
  /** 是否支持预览（用于 UI） */
  supportsPreview?: boolean;
  
  /** 预览处理结果（不实际保存） */
  preview?(
    output: string,
    task: LLMTask
  ): Promise<PreviewResult>;
}

export interface OutputHandlerResult {
  /** 是否处理成功 */
  success: boolean;
  /** 处理后的结构化数据 */
  data?: any;
  /** 创建的记录数 */
  recordsCreated?: number;
  /** 更新的记录数 */
  recordsUpdated?: number;
  /** 处理日志 */
  logs?: string[];
  /** 错误信息 */
  error?: string;
  /** 警告信息 */
  warnings?: string[];
}

export interface PreviewResult {
  /** 预览数据 */
  data: any;
  /** 预览说明 */
  summary: string;
}
```

### 使用场景

* 解析 JSON 并保存到数据库
* 转换格式（如 LLM 输出 → UniversalPost）
* 触发后续操作（如生成通知）

---

## 执行上下文

```typescript
export interface TaskExecutionContext {
  /** 任务 ID */
  taskId: string;
  
  /** App ID */
  appId: string;
  
  /** 当前变量值 */
  variables: Record<string, any>;
  
  /** 添加日志 */
  addLog: (level: 'info' | 'warn' | 'error', message: string, data?: any) => void;
  
  /** 获取其他服务（依赖注入） */
  getService: <T>(serviceId: string) => T | undefined;
}
```
