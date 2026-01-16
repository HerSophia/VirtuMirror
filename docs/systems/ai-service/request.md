# 请求管理

本文档说明 AI Service 的请求管理机制，包括请求队列、优先级调度、并发控制和速率限制。

## 1. 概述

AI Service 提供完整的请求管理能力：

- **RequestQueue** - 优先级调度和并发控制
- **RequestManager** - 请求生命周期追踪
- **RateLimiter** - 速率限制和自动重试

---

## 2. 请求队列 (RequestQueue)

### 2.1 职责

- 按优先级排序请求
- 控制并发数量
- 限制每分钟请求数 (RPM)
- 支持请求取消

### 2.2 架构

```text
┌─────────────────────────────────────────────────────────────┐
│                      RequestQueue                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Priority Lanes (优先级通道)                            ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │  │CRITICAL │ │  HIGH   │ │ NORMAL  │ │  LOW    │       ││
│  │  │ (用户)  │ │(惰性加载)│ │ (批量)  │ │ (后台)  │       ││
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       ││
│  │       │           │           │           │             ││
│  │       └─────────┬─┴───────────┴───────────┘             ││
│  │                 │                                        ││
│  │                 ▼                                        ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              Scheduler (调度器)                     │││
│  │  │  - 并发控制 (maxConcurrent)                         │││
│  │  │  - 速率限制 (RPM)                                   │││
│  │  │  - 优先级排序                                       │││
│  │  └────────────────────────┬────────────────────────────┘││
│  │                           │                              ││
│  └───────────────────────────┼──────────────────────────────┘│
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────────┐│
│  │                  Executor Pool                           ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐                       ││
│  │  │ Slot 1 │ │ Slot 2 │ │ Slot 3 │  (可配置槽位数)        ││
│  │  │running │ │running │ │ idle   │                       ││
│  │  └────────┘ └────────┘ └────────┘                       ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.3 核心方法

```typescript
class RequestQueue {
  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueueConfig>): void;

  /**
   * 入队请求
   */
  enqueue<T>(
    options: GenerateOptions | StreamOptions,
    isStream: boolean,
    priority?: RequestPriority
  ): Promise<T>;

  /**
   * 取消请求（队列中或执行中）
   */
  cancel(requestId: string, reason?: string): boolean;

  /**
   * 取消指定优先级的所有请求
   */
  cancelByPriority(priority: RequestPriority): number;

  /**
   * 获取队列状态
   */
  getStatus(): QueueStatus;

  /**
   * 清空队列（不影响执行中的）
   */
  clear(): void;

  /**
   * 注入执行器（由 AIService 调用）
   */
  setExecutor(
    executor: (options, isStream, signal) => Promise<any>
  ): void;
}
```

### 2.4 入队逻辑

```typescript
enqueue<T>(
  options: GenerateOptions | StreamOptions,
  isStream: boolean,
  priority: RequestPriority = RequestPriority.NORMAL
): Promise<T> {
  // 1. 检查队列是否已满
  if (this.queue.length >= this.config.maxQueueSize) {
    return Promise.reject(
      createAIError('QUEUE_FULL', `队列已满（最大 ${this.config.maxQueueSize}）`)
    );
  }

  return new Promise((resolve, reject) => {
    const request: QueuedRequest = {
      id: options.requestId || generateRequestId(),
      priority,
      options,
      isStream,
      createdAt: Date.now(),
      resolve,
      reject,
      abortController: new AbortController(),
    };

    // 2. 按优先级插入（优先级数字越小越靠前）
    const insertIndex = this.queue.findIndex(r => r.priority > priority);
    if (insertIndex === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(insertIndex, 0, request);
    }

    // 3. 设置队列超时
    setTimeout(() => {
      if (this.queue.find(r => r.id === request.id)) {
        this.cancel(request.id, '队列等待超时');
      }
    }, this.config.queueTimeout);

    // 4. 触发处理
    this.process();
  });
}
```

### 2.5 调度逻辑

```typescript
private async process(): Promise<void> {
  if (this.isProcessing) return;
  this.isProcessing = true;

  try {
    while (this.queue.length > 0 && this.canExecute()) {
      const request = this.queue.shift()!;
      this.execute(request);

      // 等待最小间隔
      if (this.config.minInterval > 0) {
        await sleep(this.config.minInterval);
      }
    }
  } finally {
    this.isProcessing = false;
  }
}

private canExecute(): boolean {
  // 检查并发数
  .size >= this.config.maxConcurrent) {
    return false;
  }

  // 检查 RPM
  if (this.config.maxRPM > 0 && this.getCurrentRPM() >= this.config.maxRPM) {
    return false;
  }

  return true;
}
```

---

## 3. 请求优先级

### 3.1 优先级定义

```typescript
enum RequestPriority {
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

### 3.2 使用场景

| 优先级 | 场景 | 示例 |
| ------ | ---- | ---- |
| **CRITICAL** | 用户直接交互 | 聊天回复、实时对话 |
| **HIGH** | 用户触发的惰性加载 | 点击话题加载内容、评论区展开 |
| **NORMAL** | 批量任务 | 多平台内容生成 |
| **LOW** | 后台任务 | 定时世界事件、预生成内容 |

### 3.3 使用示例

```typescript
import { getAIService, RequestPriority } from '@/services/ai';

const aiService = getAIService();

// 用户聊天 - 最高优先级
const reply = await aiService.generateText(
  { prompt: userMessage },
  RequestPriority.CRITICAL
);

// 惰性加载内容 - 高优先级
const posts = await Promise.all([
  aiService.generateText({ prompt: topic1 }, RequestPriority.HIGH),
  aiService.generateText({ prompt: topic2 }, RequestPriority.HIGH),
  aiService.generateText({ prompt: topic3 }, RequestPriority.HIGH),
]);

// 后台世界事件 - 低优先级
aiService.generateText(
  { prompt: eventPrompt },
  RequestPriority.LOW
).then(event => {
  // 后台处理...
});
```

---

## 4. 请求管理器 (RequestManager)

### 4.1 职责

- 创建请求上下文
- 追踪请求状态
- 管理 AbortController
- 支持请求取消

### 4.2 核心方法

```typescript
class RequestManager {
  /**
   * 创建新请求
   */
  create(options?: { id?: string; source?: string }): RequestContext;

  /**
   * 获取请求上下文
   */
  get(id: string): RequestContext | undefined;

  /**
   * 标记请求开始
   */
  start(id: string): void;

  /**
   * 标记请求完成
   */
  complete(id: string): void;

  /**
   * 标记请求失败
   */
  fail(id: string): void;

  /**
   * 取消请求
   */
  cancel(id: string): boolean;

  /**
   * 取消所有进行中的请求
   */
  cancelAll(): void;

  /**
   * 获取活动请求列表
   */
  getActiveRequests(): RequestInfo[];

  /**
   * 是否有正在进行的请求
   */
  isGenerating(): boolean;

  /**
   * 获取最近的请求 ID
   */
  getLatestRequestId(): string | null;

  /**
   * 清理已完成的请求（避免内存泄漏）
   */
  cleanup(maxAge?: number): void;
}
```

### 4.3 请求上下文

```typescript
interface RequestContext {
  id: string;
  status: RequestStatus;  // 'pending' | 'running' | 'completed' | 'failed' | 'aborted'
  source?: string;        // 调用来源标识
  startTime: number;
  endTime?: number;
  controller: AbortController;
  signal: AbortSignal;
}
```

### 4.4 状态流转

```text
                    ┌──────────────┐
                    │   pending    │
                    └──────┬───────┘
                           │ start()
                           ▼
                    ┌──────────────┐
     cancel()       │   running    │
    ┌───────────────┤              ├───────────────┐
    │               └──────┬───────┘               │
    ▼                      │                       ▼
┌──────────────┐     complete()              ┌──────────────┐
│   aborted    │           │     fail()      │   failed     │
└──────────────┘           ▼                 └──────────────┘
                    ┌──────────────┐
                    │  completed   │
                    └──────────────┘
```

---

## 5. 队列配置

### 5.1 默认配置

```typescript
const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrent: 3,      // 最大并发数
  maxRPM: 0,             // 每分钟最大请求数（0 表示不限制）
  minInterval: 100,      // 请求间最小间隔（毫秒）
  maxQueueSize: 100,     // 队列最大长度
  queueTimeout: 300000,  // 队列等待超时（5 分钟）
};
```

### 5.2 推荐配置

| Provider | maxConcurrent | maxRPM | 说明 |
| -------- | ------------- | ------ | ---- |
| OpenAI (Free) | 1 | 3 | 免费层限制严格 |
| OpenAI (Tier 1) | 3 | 60 | 基础付费 |
| OpenAI (Tier 2+) | 5 | 500 | 高级付费 |
| Anthropic | 2 | 40 | 相对保守 |
| Google Gemini | 3 | 60 | 免费额度较多 |
| 本地 Ollama | 1 | 0 | 受限于本地算力 |
| Mock | 10 | 0 | 开发模式无限制 |

### 5.3 动态更新配置

```typescript
const aiService = getAIService();

// 更新队列配置
aiService.updateQueueConfig({
  maxConcurrent: 5,
  maxRPM: 100,
});

// 查看队列状态
const status = aiService.getQueueStatus();
console.log(`队列: ${status.pending} 等待, ${status.running} 执行中`);
console.log(`RPM: ${status.currentRPM}`);
```

---

## 6. 速率限制 (RateLimiter)

### 6.1 自动重试机制

当遇到 429 (Rate Limit) 错误时，自动使用指数退避重试：

```typescript
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;   // 最大重试次数，默认 3
    baseDelay?: number;    // 基础延迟，默认 1000ms
    maxDelay?: number;     // 最大延迟，默认 60000ms
  } = {}
): Promise<T>;
```

### 6.2 重试逻辑

```typescript
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await fn();
  } catch (error) {
    // 检查是否为速率限制错误
    if (error.code !== 'RATE_LIMIT' && !error.message?.includes('429')) {
      throw error;  // 非速率限制错误，直接抛出
    }

    if (attempt === maxRetries) {
      throw error;  // 达到最大重试次数
    }

    // 指数退避 + 随机抖动
    const delay = Math.min(
      baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
      maxDelay
    );

    console.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
    await sleep(delay);
  }
}
```

### 6.3 超时控制

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T>;
```

在 AIService 中的使用：

```typescript
const result = await withRateLimitRetry(() =>
  withTimeout(
    vercelGenerateText(inputOptions),
    options.timeout || this.config.defaultTimeout || DEFAULT_TIMEOUT
  )
);
```

---

## 7. 取消请求

### 7.1 取消单个请求

```typescript
const aiService = getAIService();

// 生成时指定 requestId
const promise = aiService.generateText({
  prompt: '长文本生成...',
  requestId: 'my-request-1',
});

// 稍后取消
aiService.abort('my-request-1');

// 或取消最近一个请求
aiService.abort();
```

### 7.2 取消流式请求

```typescript
const handle = aiService.streamText({
  prompt: '讲一个很长的故事',
});

// 使用返回的 handle 取消
handle.abort();

// 或通过 requestId 取消
aiService.abort(handle.requestId);
```

### 7.3 批量取消

```typescript
// 取消所有请求
aiService.abortAll();

// 取消指定优先级的请求
const queue = getRequestQueue();
const cancelledCount = queue.cancelByPriority(RequestPriority.LOW);
console.log(`取消了 ${cancelledCount} 个后台任务`);
```

---

## 8. 队列状态监控

### 8.1 获取状态

```typescript
const status = aiService.getQueueStatus();

console.log(status);
// {
//   pending: 5,           // 队列中等待的请求数
//   running: 3,           // 正在执行的请求数
//   pendingByPriority: {
//     0: 1,  // CRITICAL
//     1: 2,  // HIGH
//     2: 2,  // NORMAL
//     3: 0,  // LOW
//   },
//   currentRPM: 45,       // 当前每分钟请求数
// }
```

### 8.2 在 UI 中使用

```vue
<template>
  <div class="queue-status">
    <span>队列: {{ queueStatus.pending }} 等待</span>
    <span>执行中: {{ queueStatus.running }}</span>
    <span>RPM: {{ queueStatus.currentRPM }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getAIService } from '@/services/ai';

const aiService = getAIService();
const queueStatus = computed(() => aiService.getQueueStatus());
</script>
```

---

## 9. 与事件系统集成

请求管理与事件系统协同工作：

```typescript
const aiService = getAIService();

// 监听请求开始
aiService.on('start', (requestId) => {
  console.log(`[${requestId}] 开始执行`);
});

// 监听流式数据
aiService.on('chunk', (requestId, chunk) => {
  console.log(`[${requestId}] 收到: ${chunk}`);
});

// 监听完成
aiService.on('finish', (requestId, result) => {
  console.log(`[${requestId}] 完成，耗时: ${result.duration}ms`);
});

// 监听错误
aiService.on('error', (requestId, error) => {
  console.error(`[${requestId}] 错误: ${error.message}`);
});

// 监听取消
aiService.on('abort', (requestId) => {
  console.log(`[${requestId}] 已取消`);
});
```
