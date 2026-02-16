# Mock AI Provider 文档

本文档描述了小手机模拟器中 Mock AI Provider 的设计和使用方法。Mock AI Provider 用于开发环境模拟 AI 生成功能，**基于 Vercel AI SDK Core 实现**，并支持回退到真实 API 调用。

## 概述

Mock AI Provider 位于 `src/mock/aiProvider.ts`，提供以下核心功能：

- **基于 Vercel AI SDK**：实现了 `LanguageModelV1` 接口，使用 SDK 标准流处理。
- **混合模式**：优先尝试调用真实 API（OpenAI/Google/Anthropic），失败或未配置则使用 Mock 数据。
- **场景化响应模板**：内置多种场景（聊天、弹幕、邮件等）的 Mock 数据。
- **流式支持**：完整支持流式文本生成 (SSE) 和非流式生成。

## 类型定义

类型定义位于 `src/types/ai.ts`，直接导出自 `ai` 包并进行了扩展：

### 核心类型

```typescript
import type { 
  LanguageModel,
  GenerateTextResult,
  StreamTextResult,
  CoreMessage 
} from 'ai';

// AI 消息
type AIMessage = CoreMessage;

// AI Provider 接口
interface AIProvider {
  name: string;
  createModel: (modelId: string) => LanguageModel;
  listModels?: () => Promise<string[]>;
}
```

## 使用方法

### 基础文本生成

```typescript
import { generateText, getMockModel } from '@/mock/aiProvider'

const result = await generateText({
  model: getMockModel(),
  system: '你是一个友好的聊天助手',
  prompt: '你好！',
  maxTokens: 1000,
  temperature: 0.7,
})

console.log(result.text) // 生成的文本
console.log(result.usage) // token 使用统计
```

### 流式文本生成

```typescript
import { streamText, getMockModel } from '@/mock/aiProvider'

const result = await streamText({
  model: getMockModel(),
  prompt: '讲一个故事',
  // 可选回调（兼容层）
  onChunk: (chunk) => {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.textDelta!)
    }
  },
})

// 或者使用 SDK 原生方式
for await (const textPart of result.textStream) {
  process.stdout.write(textPart)
}
```

## 真实 API 调用（混合模式）

Mock Provider 会自动检查全局配置（`localStorage` 中的 `phone_global_config`），如果发现了有效的 API 配置，它会尝试发起真实的网络请求。

**支持的 API 类型**：
1.  **OpenAI Compatible**：标准的 `/chat/completions` 接口。
2.  **Google Native**：Google Gemini 原生 REST API (`:generateContent`)。
3.  **Anthropic**：Anthropic 原生 `/messages` 接口。

**工作流程**：
1.  检查是否存在 API 配置且已启用。
2.  如果有，使用 `fetch` 发起请求（支持流式 SSE 解析）。
3.  如果请求成功，返回真实数据。
4.  如果请求失败（网络错误、401 等）或未配置，自动降级使用内置的 Mock 响应模板。

## 场景响应模板

当回退到 Mock 模式时，Provider 会分析提示词中的关键词，选择合适的场景模板：

| 场景 ID | 描述 | 触发关键词 |
| --------- | ------ | ------------ |
| `chat.reply` | 聊天回复 | reply, 回复 |
| `chat.new_conversation` | 新对话开场 | conversation, 开场 |
| `live.danmaku` | 直播弹幕 | danmaku, 弹幕 |
| `email.compose` | 邮件撰写 | email, 邮件 |
| `browser.article` | 网页文章 | article, 文章 |
| `moments.post` | 朋友圈动态 | moments, 朋友圈 |
| `forum.post` | 论坛帖子 | forum, 论坛 |
| `default` | 默认响应 | - |

## 开发与调试

- **开发模式** (`npm run dev`)：`AIGenerateService` 会自动使用 Mock Provider。你可以在 API 管理器中配置真实的 Key 来测试真实效果，或者清空配置来测试 Mock 效果。
- **生产模式**：打包后（作为插件运行），`AIGenerateService` 会切换为调用酒馆 (SillyTavern) 的 API，Mock Provider 代码会被 Tree-shaking 优化或不被调用。

## 注意事项

1.  **Vercel AI SDK**：项目引入了 `ai` 包作为 Dev Dependency（或生产依赖，视打包策略而定），Mock Provider 实际上是在运行 Vercel SDK 的 Core 逻辑。
2.  **安全性**：在 Mock 模式下使用真实 API Key 时，Key 存储在本地 localStorage 中，不会上传到任何服务器（除了目标 API 端点）。
