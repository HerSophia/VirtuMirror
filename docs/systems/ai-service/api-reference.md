# AI Service API 参考

本文档详细说明 AI Service 的类型定义和接口。

## 1. 核心接口

### IAIService

```typescript
/**
 * AI Service 主接口
 * 提供统一的 AI 生成能力
 */
export interface IAIService {
  // ==================== 初始化 ====================

  /**
   * 初始化服务
   * 加载配置，准备默认 Provider
   */
  initialize(): Promise<void>;

  /**
   * 服务是否就绪
   */
  readonly isReady: boolean;

  // ==================== 生成 API ====================

  /**
   * 生成文本（非流式）
   * @param options 生成选项
   * @param priority 优先级（可选）
   * @returns 生成结果
   */
  generateText(options: GenerateOptions, priority?: RequestPriority): Promise<GenerateResult>;

  /**
   * 流式生成文本
   * @param options 流式生成选项
   * @param priority 优先级（可选）
   * @returns 流式句柄（含 textStream、abort 等）
   */
  streamText(options: StreamOptions, priority?: RequestPriority): StreamHandle;

  // ==================== 请求控制 ====================

  /**
   * 取消指定请求
   * @param requestId 请求 ID（不传则取消最近一个）
   */
  abort(requestId?: string): void;

  /**
   * 取消所有进行中的请求
   */
  abortAll(): void;

  /**
   * 是否有请求正在进行
   */
  readonly isGenerating: boolean;

  // ==================== Provider 管理 ====================

  /**
   * 获取当前激活的 Provider
   */
  getActiveProvider(): LanguageModel | null;

  /**
   * 获取当前 Provider 信息
   */
  getProviderInfo(): ProviderInfo | null;

  /**
   * 切换到指定预设
   * @param presetId 预设 ID（null 表示使用酒馆 API）
   */
  switchProvider(presetId: string | null): void;

  /**
   * 刷新 Provider（配置变更后调用）
   */
  refreshProvider(): void;

  // ==================== 队列管理 ====================

  /**
   * 获取队列状态
   */
  getQueueStatus(): QueueStatus;

  /**
   * 更新队列配置
   */
  updateQueueConfig(config: Partial<QueueConfig>): void;

  // ==================== 事件 ====================

  /**
   * 监听生成事件
   */
  on(event: 'start', handler: (requestId: string) => void): () => void;
  on(event: 'chunk', handler: (requestId: string, chunk: string) => void): () => void;
  on(event: 'finish', handler: (requestId: string, result: GenerateResult) => void): () => void;
  on(event: 'error', handler: (requestId: string, error: AIError) => void): () => void;
  on(event: 'abort', handler: (requestId: string) => void): () => void;
}
```

---

## 2. 生成选项

### GenerateOptions

```typescript
/**
 * 基础生成选项
 */
export interface GenerateOptions {
  // ---------- 内容 ----------
  /** 简单文本提示 */
  prompt?: string;
  /** 消息数组（聊天模式） */
  messages?: CoreMessage[];
  /** 系统提示词 */
  system?: string;

  // ---------- 模型配置（可选，默认使用当前激活的） ----------
  /** 指定模型（覆盖当前激活的 Provider） */
  model?: LanguageModel;

  // ---------- 生成参数 ----------
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 温度（0-2，默认 0.7） */
  temperature?: number;
  /** Top-P 采样 */
  topP?: number;
  /** 频率惩罚 */
  frequencyPenalty?: number;
  /** 存在惩罚 */
  presencePenalty?: number;
  /** 停止序列 */
  stopSequences?: string[];

  // ---------- 请求控制 ----------
  /** 自定义请求 ID（用于取消） */
  requestId?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 外部 AbortSignal */
  signal?: AbortSignal;

  // ---------- 元数据 ----------
  /** 调用来源（用于日志） */
  source?: string;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
}
```

### StreamOptions

```typescript
/**
 * 流式生成选项
 * 继承自 GenerateOptions，增加回调函数
 */
export interface StreamOptions extends GenerateOptions {
  /** 每个 chunk 的回调 */
  onChunk?: (chunk: StreamChunk) => void;
  /** 完成回调 */
  onFinish?: (result: GenerateResult) => void;
  /** 错误回调 */
  onError?: (error: AIError) => void;
  /** 中止回调 */
  onAbort?: () => void;
}
```

### CoreMessage

```typescript
/**
 * 消息类型（兼容 Vercel AI SDK）
 */
export interface CoreMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}
```

---

## 3. 生成结果

### GenerateResult

```typescript
/**
 * 生成结果
 */
export interface GenerateResult {
  /** 生成的文本 */
  text: string;
  /** 请求 ID */
  requestId: string;
  /** 完成原因 */
  finishReason: FinishReason;
  /** Token 用量 */
  usage?: TokenUsage;
  /** Provider 元数据 */
  providerMetadata?: Record<string, unknown>;
  /** 耗时（毫秒） */
  duration?: number;
}
```

### StreamHandle

```typescript
/**
 * 流式句柄
 */
export interface StreamHandle {
  /** 请求 ID */
  requestId: string;
  /** 文本流（AsyncIterable） */
  textStream: AsyncIterable<string>;
  /** 完整事件流 */
  fullStream: AsyncIterable<StreamChunk>;
  /** 最终文本（Promise） */
  text: Promise<string>;
  /** 取消生成 */
  abort(): void;
  /** 是否已完成 */
  readonly done: boolean;
}
```

### StreamChunk

```typescript
/**
 * 流式 chunk
 */
export interface StreamChunk {
  /** chunk 类型 */
  type: 'text-delta' | 'reasoning' | 'source' | 'tool-call' | 'finish';
  /** 文本增量（type='text-delta' 时） */
  textDelta?: string;
  /** 完成原因（type='finish' 时） */
  finishReason?: FinishReason;
  /** Token 用量（type='finish' 时） */
  usage?: TokenUsage;
}
```

### FinishReason

```typescript
/**
 * 完成原因
 */
export type FinishReason =
  | 'stop'           // 正常完成
  | 'length'         // 达到 max_tokens
  | 'content-filter' // 内容过滤
  | 'tool-calls'     // 工具调用
  | 'error'          // 错误
  | 'other'          // 其他
  | 'unknown';       // 未知
```

### TokenUsage

```typescript
/**
 * Token 用量
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

---

## 4. Provider 类型

### ProviderSource

```typescript
/**
 * Provider 来源类型
 */
export type ProviderSource =
  | 'openai'      // OpenAI 官方 / 兼容
  | 'anthropic'   // Anthropic
  | 'google'      // Google Gemini
  | 'deepseek'    // DeepSeek
  | 'mock'        // Mock（开发用）
  | 'tavern';     // 酒馆 API
```

### ProviderInfo

```typescript
/**
 * Provider 信息
 */
export interface ProviderInfo {
  /** 来源类型 */
  source: ProviderSource;
  /** 显示名称 */
  name: string;
  /** 模型 ID */
  modelId: string;
  /** API 地址（脱敏） */
  baseUrl?: string;
  /** 是否就绪 */
  ready: boolean;
}
```

### ApiConfig

```typescript
/**
 * API 配置（用于创建 Provider）
 */
export interface ApiConfig {
  /** API 来源 */
  source: ProviderSource;
  /** API 地址 */
  apiUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 默认生成参数 */
  defaultOptions?: Partial<GenerateOptions>;
}
```

---

## 5. 错误类型

### AIError

```typescript
/**
 * AI 错误
 */
export interface AIError {
  /** 错误码 */
  code: AIErrorCode;
  /** 错误消息 */
  message: string;
  /** 原始错误 */
  cause?: Error;
  /** 请求 ID */
  requestId?: string;
  /** 是否可重试 */
  retryable: boolean;
  /** HTTP 状态码（如有） */
  status?: number;
}
```

### AIErrorCode

```typescript
/**
 * 错误码
 */
export type AIErrorCode =
  | 'PROVIDER_NOT_READY'  // Provider 未就绪
  | 'PROVIDER_ERROR'      // Provider 返回错误
  | 'NETWORK_ERROR'       // 网络错误
  | 'TIMEOUT'             // 超时
  | 'ABORTED'             // 用户取消
  | 'RATE_LIMIT'          // 速率限制
  | 'AUTH_ERROR'          // 认证错误
  | 'INVALID_REQUEST'     // 请求参数错误
  | 'CONTENT_FILTER'      // 内容被过滤
  | 'QUEUE_FULL'          // 队列已满
  | 'UNKNOWN';            // 未知错误
```

### 错误分类

| 错误码 | 场景 | 可重试 | 处理建议 |
| ------ | ---- | ------ | -------- |
| `PROVIDER_NOT_READY` | Provider 未初始化 | 是 | 等待初始化或切换 Provider |
| `AUTH_ERROR` | API Key 无效 | 否 | 提示用户检查配置 |
| `RATE_LIMIT` | 请求过于频繁 | 是 | 自动重试（带退避） |
| `NETWORK_ERROR` | 网络不可达 | 是 | 提示检查网络 |
| `TIMEOUT` | 请求超时 | 是 | 增加超时或重试 |
| `ABORTED` | 用户取消 | 否 | 正常流程，无需处理 |
| `CONTENT_FILTER` | 内容被过滤 | 否 | 提示修改输入 |
| `QUEUE_FULL` | 队列已满 | 是 | 稍后重试 |
| `PROVIDER_ERROR` | Provider 返回错误 | 视情况 | 显示错误信息 |

---

## 6. 请求管理类型

### RequestPriority

```typescript
/**
 * 请求优先级
 */
export enum RequestPriority {
  /** 关键 - 用户直接交互，立即执行 */
  CRITICAL = 0,
  /** 高 - 用户触发的惰性加载 */
  HIGH = 1,
  /** 普通 - 批量任务 */
  NORMAL = 2,
  /** 低 - 后台任务 */
  LOW = 3,
}
```

### RequestStatus

```typescript
/**
 * 请求状态
 */
export type RequestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
```

### RequestInfo

```typescript
/**
 * 请求信息
 */
export interface RequestInfo {
  id: string;
  status: RequestStatus;
  source?: string;
  startTime: number;
  endTime?: number;
}
```

---

## 7. 队列配置

### QueueConfig

```typescript
/**
 * 队列配置
 */
export interface QueueConfig {
  /** 最大并发数（默认 3） */
  maxConcurrent: number;
  /** 每分钟最大请求数（RPM，0 表示不限制） */
  maxRPM: number;
  /** 请求间最小间隔（毫秒） */
  minInterval: number;
  /** 队列最大长度（防止内存溢出） */
  maxQueueSize: number;
  /** 请求超时自动取消（毫秒） */
  queueTimeout: number;
}
```

### QueueStatus

```typescript
/**
 * 队列状态
 */
export interface QueueStatus {
  /** 队列中等待的请求数 */
  pending: number;
  /** 正在执行的请求数 */
  running: number;
  /** 各优先级的等待数 */
  pendingByPriority: Record<RequestPriority, number>;
  /** 当前 RPM 使用量 */
  currentRPM: number;
}
```

---

## 8. 服务配置

### AIServiceConfig

```typescript
/**
 * AI Service 配置
 */
export interface AIServiceConfig {
  /** 默认超时（毫秒） */
  defaultTimeout?: number;
  /** 最大并发请求数 */
  maxConcurrent?: number;
  /** 是否启用请求日志 */
  enableLogging?: boolean;
  /** 开发模式下是否使用 Mock */
  useMockInDev?: boolean;
}
```

---

## 9. 工具函数

### createAIError

创建格式化的 AI 错误对象。

```typescript
function createAIError(
  code: AIErrorCode,
  message: string,
  options?: {
    cause?: Error;
    requestId?: string;
    status?: number;
  }
): AIError;
```

### isRetryable

判断错误是否可重试。

```typescript
function isRetryable(code: AIErrorCode): boolean;
// 可重试的错误码：RATE_LIMIT, NETWORK_ERROR, TIMEOUT, PROVIDER_NOT_READY
```

### inferErrorCode

从原生 Error 推断错误码。

```typescript
function inferErrorCode(error: Error): AIErrorCode;
```

### formatErrorMessage

格式化错误消息用于 UI 显示。

```typescript
function formatErrorMessage(error: AIError): string;
```

### generateRequestId

生成唯一的请求 ID。

```typescript
function generateRequestId(): string;
// 格式：req_{timestamp}_{randomString}
```

### normalizeFinishReason

标准化完成原因。

```typescript
function normalizeFinishReason(reason: string | undefined | null): FinishReason;
```

### maskUrl

URL 脱敏处理。

```typescript
function maskUrl(url: string): string;
// 示例：https://api.openai.com/v1 -> https://api.openai.com/...
```

### estimateTokens

估算文本的 token 数量。

```typescript
function estimateTokens(text: string): number;
// 使用简单规则：中文字符 / 1.5 + 其他字符 / 4
```

### sleep

延迟函数。

```typescript
function sleep(ms: number): Promise<void>;
```
