# AI Service 架构概述

## 1. 设计目标

### 核心目标

1. **统一入口** - 所有 AI 生成请求通过单一服务入口
2. **Provider 解耦** - Provider 创建与业务逻辑分离
3. **模式透明** - 自定义 API / 酒馆 API 对调用方透明
4. **可观测性** - 请求状态、错误、性能可追踪
5. **向后兼容** - 现有代码可渐进式迁移

### 非目标

- 不替代提示词系统（`PromptService` 继续存在）
- 不处理具体业务逻辑（如聊天消息格式化）
- 不管理 API 配置 UI（由 `api-manager` App 负责）

---

## 2. 架构图

```text
┌─────────────────────────────────────────────────────────────┐
│                        App Layer                            │
│         Chat / Prompts / Email / Live / Browser            │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      AIStore (Pinia)                        │
│    isGenerating / activeRequest / error / providerInfo     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                       AIService                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Public API                          │   │
│  │  generateText() / streamText() / abort()           │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              ProviderManager                        │   │
│  │  getActiveProvider() / switchProvider()             │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              ProviderFactory                        │   │
│  │  createFromConfig() / createOpenAI() / ...          │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              RequestQueue                           │   │
│  │  enqueue() / cancel() / getStatus()                 │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              RequestManager                         │   │
│  │  create() / cancel() / getActiveRequests()          │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────┐
│   Vercel AI SDK       │       │   TavernAdapter           │
│   (自定义 API 模式)    │       │   (酒馆 API 模式)          │
└───────────────────────┘       └───────────────────────────┘
```

---

## 3. 模块职责

| 模块 | 文件 | 职责 | 依赖 |
| ---- | ---- | ---- | ---- |
| **AIService** | `aiService.ts` | 对外统一入口，协调各模块 | ProviderManager, RequestManager, RequestQueue |
| **ProviderFactory** | `providerFactory.ts` | 创建 LanguageModel 实例 | Vercel AI SDK Providers |
| **ProviderManager** | `providerManager.ts` | 管理当前 Provider、缓存、切换 | ProviderFactory, GlobalConfigService |
| **RequestQueue** | `requestQueue.ts` | 优先级调度和并发控制 | - |
| **RequestManager** | `requestManager.ts` | 请求生命周期管理 | - |
| **TavernAdapter** | `tavernAdapter.ts` | 酒馆 API 调用适配 | TavernHelper |
| **AIStore** | `aiStore.ts` | 响应式状态管理 | AIService |

---

## 4. 技术栈

| 依赖 | 版本 | 用途 |
| ---- | ---- | ---- |
| `ai` | ^4.x | Vercel AI SDK Core |
| `@ai-sdk/openai` | ^1.x | OpenAI Provider |
| `@ai-sdk/anthropic` | ^1.x | Anthropic Provider |
| `@ai-sdk/google` | ^1.x | Google Gemini Provider |

---

## 5. 请求流程

### 5.1 生成请求流程

```text
┌─────────────────────────────────────────────────────────────┐
│                    streamText() 调用                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. RequestQueue.enqueue()                                  │
│     - 生成 requestId                                         │
│     - 按优先级插入队列                                        │
│     - 状态: pending                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. RequestQueue.process()                                  │
│     - 检查并发数和 RPM 限制                                   │
│     - 从队列取出请求执行                                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. AIService.executeDirectly()                             │
│     - RequestManager.create() 创建上下文                     │
│     - 状态: running            │
│     - 触发 'start' 事件                                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. ProviderManager.getActiveProvider()                     │
│     - 返回 LanguageModel 或 null (使用酒馆)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │ Provider?                     │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────┐
│  5a. Vercel AI SDK    │       │  5b. TavernAdapter        │
│  streamText()         │       │  streamText()             │
└───────────┬───────────┘       └───────────┬───────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. 流式输出                                                 │
│     - 每个 chunk 触发 onChunk 回调                            │
│     - 同时触发 'chunk' 事件                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────┐   ┌───────────┐   ┌───────────────┐
│  完成         │   │  错误     │   │  取消         │
│  status:      │   │  status:  │   │  status:      │
│  completed    │   │  failed   │   │  aborted      │
│  'finish'事件 │   │  'error'  │   │  'abort'      │
└───────────────┘   └───────────┘   └───────────────┘
```

### 5.2 Provider 选择逻辑

```typescript
// 在 executeDirectly 中的逻辑
const provider = this.providerManager.getActiveProvider();

if (provider) {
  // 使用自定义 API Provider（Vercel AI SDK）
  result = await this.executeWithProvider(provider, options, isStream, signal);
} else {
  // 回退到酒馆 API（TavernHelper）
  result = await this.executeWithTavern(options, isStream);
}
```

---

## 6. 与其他系统的关系

```text
┌─────────────────────────────────────────────────────────────┐
│                     GlobalConfigService                     │
│  (配置存储: API 预设、当前激活预设、默认参数)                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ 读取配置
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      ProviderManager                        │
│  (根据配置创建和管理 Provider)                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        AIService                            │
│  (统一入口)                                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────┐
│   AIGenerateService   │       │   Chat App / Other Apps   │
│   (提示词系统集成)     │       │   (直接使用 AIStore)       │
└───────────────────────┘       └───────────────────────────┘
```

### 关键集成点

| 系统 | 集成方式 | 说明 |
| ---- | -------- | ---- |
| **GlobalConfigService** | ProviderManager 读取配置 | 获取 API 预设、激活的预设 |
| **AIGenerateService** | 内部调用 AIService | 提示词渲染后调用生成 |
| **LLM Task Service** | 通过 AIGenerateService | 任务执行时调用 |
| **TavernHelper** | TavernAdapter 封装 | 酒馆 API 回退模式 |

---

## 7. 事件系统

AIService 提供事件订阅机制：

| 事件 | 触发时机 | 参数 |
| ---- | -------- | ---- |
| `start` | 请求开始执行 | `requestId: string` |
| `chunk` | 收到流式数据 | `requestId: string, chunk: string` |
| `finish` | 请求成功完成 | `requestId: string, result: GenerateResult` |
| `error` | 请求失败 | `requestId: string, error: AIError` |
| `abort` | 请求被取消 | `requestId: string` |

```typescript
// 订阅事件
const unsubscribe = aiService.on('chunk', (requestId, chunk) => {
  console.log(`[${requestId}] Received: ${chunk}`);
});

// 取消订阅
unsubscribe();
```

---

## 8. 默认配置

```typescript
// constants.ts

/** 默认超时时间（毫秒） */
export const DEFAULT_TIMEOUT = 60000;  // 60 秒

/** 默认最大 token 数 */
export const DEFAULT_MAX_TOKENS = 2048;

/** 默认温度 */
export const DEFAULT_TEMPERATURE = 0.7;

/** 默认队列配置 */
export const DEFAULT_QUEUE_CONFIG = {
  maxConcurrent: 3,      // 最大并发数
  maxRPM: 0,             // 每分钟最大请求数（0 表示不限制）
  minInterval: 100,      // 请求间最小间隔（毫秒）
  maxQueueSize: 100,     // 队列最大长度
  queueTimeout: 300000,  // 队列等待超时（5 分钟）
};
```
