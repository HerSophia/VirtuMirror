# AI Service 系统文档

> AI Service 是小手机模拟器的核心系统服务，提供统一的 AI 文本生成能力。

## 文档目录

| 文档 | 说明 |
| ---- | ---- |
| [概述](./overview.md) | 架构概述、设计目标、技术栈 |
| [核心接口](./api-reference.md) | 类型定义、接口说明 |
| [Provider 管理](./provider.md) | Provider 工厂、管理器、切换机制 |
| [请求管理](./request.md) | 请求队列、优先级调度、并发控制 |
| [使用指南](./usage.md) | 使用示例、最佳实践 |

## 快速开始

### 安装依赖

AI Service 基于 [Vercel AI SDK](https://sdk.vercel.ai/) 构建：

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

### 基本用法

```typescript
import { getAIService, RequestPriority } from '@/services/ai';

// 获取服务实例
const aiService = getAIService();
await aiService.initialize();

// 非流式生成
const result = await aiService.generateText({
  prompt: '写一首关于春天的诗',
  maxTokens: 500,
});
console.log(result.text);

// 流式生成
const handle = aiService.streamText({
  prompt: '讲一个故事',
  onChunk: (chunk) => {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.textDelta);
    }
  },
});

await handle.text;
```

### 通过 Store 使用（推荐）

```typescript
import { useAIStore } from '@/stores/aiStore';

const aiStore = useAIStore();

// 生成文本
const result = await aiStore.generate({
  prompt: '你好！',
  system: '你是一个友好的助手',
});

// 取消生成
aiStore.abort();

// 查看状态
console.log(aiStore.isGenerating);  // 是否正在生成
console.log(aiStore.lastError);     // 最后一次错误
console.log(aiStore.providerInfo);  // 当前 Provider 信息
```

## 实现状态

| 模块 | 状态 | 说明 |
| ---- | ---- | ---- |
| 类型定义 (`types.ts`) | ✅ 已完成 | 所有核心类型已定义 |
| 常量定义 (`constants.ts`) | ✅ 已完成 | 默认配置、Provider 端点等 |
| 工具函数 (`utils.ts`) | ✅ 已完成 | 错误处理、ID生成等 |
| Provider 工厂 (`providerFactory.ts`) | ✅ 已完成 | 支持多种 Provider 创建 |
| Provider 管理器 (`providerManager.ts`) | ✅ 已完成 | Provider 生命周期管理 |
| 请求管理器 (`requestManager.ts`) | ✅ 已完成 | 请求追踪和取消 |
| 请求队列 (`requestQueue.ts`) | ✅ 已完成 | 优先级调度和并发控制 |
| 速率限制 (`rateLimiter.ts`) | ✅ 已完成 | 429 错误自动重试 |
| 酒馆适配器 (`tavernAdapter.ts`) | ✅ 已完成 | TavernHelper API 封装 |
| AI Service (`aiService.ts`) | ✅ 已完成 | 核心服务实现 |
| AI Store (`aiStore.ts`) | ✅ 已完成 | Pinia 状态管理 |

## 目录结构

```
src/services/ai/
├── index.ts              # 统一导出
├── types.ts              # 类型定义
├── constants.ts          # 常量定义
├── aiService.ts          # 核心服务（单例）
├── providerFactory.ts    # Provider 工厂
├── providerManager.ts    # Provider 管理器
├── requestManager.ts     # 请求管理器
├── requestQueue.ts       # 请求队列
├── rateLimiter.ts        # 速率限制处理
├── tavernAdapter.ts      # 酒馆 API 适配器
└── utils.ts              # 工具函数

src/stores/
└── aiStore.ts            # AI 状态管理
```

## 核心特性

### 1. 统一入口

所有 AI 生成请求通过 `AIService` 单一入口，无论使用哪个 Provider，调用方式一致。

### 2. 多 Provider 支持

- **OpenAI** - 官方 API 和兼容 API
- **Anthropic** - Claude 系列模型
- **Google** - Gemini 系列模型
- **DeepSeek** - 使用 OpenAI 兼容模式
- **酒馆 API** - 通过 TavernHelper 调用宿主环境

### 3. 双模式运行

- **自定义 API 模式** - 使用配置的 API 端点和密钥
- **酒馆 API 模式** - 作为回退，使用宿主环境的 LLM

### 4.求管理

- **优先级调度** - CRITICAL / HIGH / NORMAL / LOW
- **并发控制** - 限制同时执行的请求数
- **速率限制** - RPM 控制和 429 自动重试
- **请求取消** - 支持取消单个或全部请求

### 5. 状态可观测

- 请求状态实时追踪
- 错误分类和格式化
- 生成历史记录

## 相关文档

- [全局配置服务](../globalConfigService.md) - API 预设管理
- [提示词服务](../prompt-service/) - 提示词模板系统
- [LLM 任务服务](../llm-task-service/) - 任务调度系统
