# AI Service 系统设计文档

> 本文档定义了小手机模拟器中 AI 请求与响应的统一服务层架构。

## 实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
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
| 导出索引 (`index.ts`) | ✅ 已完成 | 统一导出 |

**最后更新**: 2026-01-02

## 目录

1. [概述](#概述)
2. [现状分析](#现状分析)
3. [设计目标](#设计目标)
4. [架构设计](#架构设计)
5. [核心接口](#核心接口)
6. [Provider 管理](#provider-管理)
7. [请求生命周期](#请求生命n8. [并发与队列管理](#并发与队列管理)
9. [错误处理](#错误处理)
10. [状态管理](#状态管理)
11. [使用示例](#使用示例)
12. [迁移指南](#迁移指南)

---

## 概述

AI Service 是小手机模拟器的核心系统服务，负责统一管理所有 AI 文本生成请求。它基于 **Vercel AI SDK** 构建，提供：

- **统一的 API 入口**：无论使用哪个 Provider，调用方式一致
- **多 Provider 支持**：OpenAI、Anthropic、Google、DeepSeek 等
- **双模式运行**：自定义 API 模式 / 酒馆 API 模式
- **完整的请求管理**：取消、超时、重试、状态追踪

### 技术栈

| 依赖 | 版本 | 用途 |
|------|------|------|
| `ai` | ^4.x | Vercel AI SDK Core |
| `@ai-sdk/openai` | ^1.x | OpenAI Provider |
| `@ai-sdk/anthropic` | ^1.x | Anthropic Provider |
| `@ai-sdk/google` | ^1.x | Google Gemini Provider |

---

## 现状分析

### 当前架构

```
┌─────────────────────────────────────────────────────────────┐
│                        App Layer                            │
│   Chat App / Prompts App / Email App / Live App / ...      │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────┐
│  AIGenerateService    │       │  直接调用 mockStreamText  │
│  (提示词系统集成)       │       │  (部分组件)               │
└───────────┬───────────┘       └───────────────────────────┘
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
┌────────┐    ┌──────────────┐
│ Mock   │    │ TavernHelper │
│Provider│    │ .generate()  │
└────────┘    └──────────────┘
```

### 存在的问题

| 问题 | 描述 | 影响 |
|------|------|------|
| **入口分散** | `AIGenerateService`、`mockStreamText`、直接调用 `TavernHelper` | 难以统一管理和监控 |
| **双轨制硬编码** | `isDev` 判断分散在多处 | 无法在生产环境测试自定义 API |
| **Provider 耦合** | Provider 创建逻辑在 `MockLanguageModelV1.getRealModel()` 中 | 难以扩展和维护 |
| **无请求管理** | 无法取消正在进行的请求 | 用户体验差，资源浪费 |
| **状态不透明** | UI 无法感知生成状态 | 无法显示 loading、无法处理错误 |

### 现有文件清单

```
src/
├── services/
│   ├── aiGenerateService.ts      # 主要生成服务（与提示词系统耦合）
│   ├── globalConfigService.ts    # 全局配置（含 API 配置）
│   └── modelListService.ts       # 模型列表获取
├── mock/
│   └── aiProvider.ts             # Mock Provider + 真实 API 回退
├── types/
│   └── ai.ts                     # AI 相关类型定义
└── adapters/
    └── types.ts                  # HostAdapter 接口定义
```

---

## 设计目标

### 核心目标

1. **统一入口**：所有 AI 生成请求通过单一服务入口
2. **Provider 解耦**：Provider 创建与业务逻辑分离
3. **模式透明**：自定义 API / 酒馆 API 对调用方透明
4. **可观测性**：请求状态、错误、性能可追踪
5. **向后兼容**：现有代码可渐进式迁移

### 非目标

- 不替代提示词系统（`PromptService` 继续存在）
- 不处理具体业务逻辑（如聊天消息格式化）
- 不管理 API 配置 UI（由 `api-manager` App 负责）

---

## 架构设计

### 新架构

```
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
│  │              RequestManager                         │   │
│  │  create() / cancel() / getActiveRequests()          │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────┐
│   Vercel AI SDK       │       │   TavernHelper            │
│   (自定义 API 模式)    │       │   (酒馆 API 模式)          │
└───────────────────────┘       └───────────────────────────┘
```

### 目录结构

```
src/services/ai/
├── index.ts                  # 统一导出
├── types.ts                  # 类型定义
├── constants.ts              # 常量定义
├── aiService.ts              # 核心服务（单例）
├── providerFactory.ts        # Provider 工厂
├── providerManager.ts        # Provider 管理器
├── requestManager.ts         # 请求管理器
├── tavernAdapter.ts          # 酒馆 API 适配器
└── utils.ts                  # 工具函数

src/stores/
└── aiStore.ts                # AI 状态管理

src/types/
└── ai.ts                     # 全局 AI 类型（增强）
```

### 模块职责

| 模块 | 职责 | 依赖 |
|------|------|------|
| `AIService` | 对外统一入口，协调各模块 | ProviderManager, RequestManager |
| `ProviderFactory` | 创建 LanguageModel 实例 | Vercel AI SDK Providers |
| `ProviderManager` | 管理当前 Provider、缓存、切换 | ProviderFactory, GlobalConfigService |
| `RequestManager` | 请求生命周期管理 | - |
| `TavernAdapter` | 酒馆 API 调用适配 | TavernHelper |
| `AIStore` | 响应式状态管理 | AIService |

---

## 核心接口

### AIService

```typescript
// src/services/ai/aiService.ts

import type { LanguageModel } from 'ai';
import type {
  GenerateOptions,
  GenerateResult,
  StreamOptions,
  StreamHandle,
  AIServiceConfig,
  ProviderInfo,
} from './types';

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
   * @returns 生成结果
   */
  generateText(options: GenerateOptions): Promise<GenerateResult>;
  
  /**
   * 流式生成文本
   * @param options 流式生成选项
   * @returns 流式句柄（含 textStream、abort 等）
   */
  streamText(options: StreamOptions): StreamHandle;
  
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

### 类型定义

```typescript
// src/services/ai/types.ts

import type { LanguageModel, CoreMessage } from 'ai';

// ==================== 生成选项 ====================

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
  /** 温度（0-2，默认 1） */
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

/**
 * 流式生成选项
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

// ==================== 生成结果 ====================

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

/**
 * Token 用量
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ==================== Provider 相关 ====================

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

// ==================== 错误 ====================

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
  | 'UNKNOWN';            // 未知错误

// ==================== 请求管理 ====================

/**
 * 请求状态
 */
export type RequestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';

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

// ==================== 服务配置 ====================

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

## Provider 管理

### ProviderFactory

```typescript
// src/services/ai/providerFactory.ts

import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ApiConfig, ProviderSource } from './types';

/**
 * Provider 工厂
 * 根据配置创建 LanguageModel 实例
 */
export class ProviderFactory {
  /**
   * 根据 API 配置创建 Provider
   */
  static createFromConfig(config: ApiConfig): LanguageModel {
    switch (config.source) {
      case 'openai':
        return this.createOpenAI(config);
      case 'anthropic':
        return this.createAnthropic(config);
      case 'google':
        return this.createGoogle(config);
      case 'deepseek':
        return this.createDeepSeek(config);
      case 'mock':
        return this.createMock();
      default:
        // 默认尝试 OpenAI Compatible
        return this.createOpenAICompatible(config);
    }
  }
  
  /**
   * 创建 OpenAI Provider
   */
  static createOpenAI(config: ApiConfig): LanguageModel {
    const openai = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl || undefined,
    });
    return openai(config.model);
  }
  
  /**
   * 创建 OpenAI Compatible Provider
   * 用于 DeepSeek、Moonshot、Groq 等兼容 API
   */
  static createOpenAICompatible(config: ApiConfig): LanguageModel {
    const openai = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl,
      compatibility: 'compatible',
    });
    return openai(config.model);
  }
  
  /**
   * 创建 Anthropic Provider
   */
  static createAnthropic(config: ApiConfig): LanguageModel {
    const anthropic = createAnthropic({
      apiKey: config.apiKey,
      baseURL: config.apiUrl || undefined,
    });
    return anthropic(config.model);
  }
  
  /**
   * 创建 Google Gemini Provider
   */
  static createGoogle(config: ApiConfig): LanguageModel {
    const google = createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl || undefined,
    });
    return google(config.model);
  }
  
  /**
   * 创建 DeepSeek Provider
   * 使用 OpenAI Compatible 模式
   */
  static createDeepSeek(config: ApiConfig): LanguageModel {
    return this.createOpenAICompatible({
      ...config,
      apiUrl: config.apiUrl || 'https://api.deepseek.com/v1',
    });
  }
  
  /**
   * 创建 Mock Provider（开发用）
   */
  static createMock(): LanguageModel {
    // 复用现有的 MockLanguageModelV1
    const { MockLanguageModelV1 } = require('@/mock/aiProvider');
    return new MockLanguageModelV1('mock', 'mock-model');
  }
  
  /**
   * 获取支持的 Provider 列表
   */
  static getSupportedProviders(): { source: ProviderSource; name: string }[] {
    return [
      { source: 'openai', name: 'OpenAI' },
      { source: 'anthropic', name: 'Anthropic' },
      { source: 'google', name: 'Google Gemini' },
      { source: 'deepseek', name: 'DeepSeek' },
      { source: 'mock', name: 'Mock (Dev)' },
      { source: 'tavern', name: '酒馆 API' },
    ];
  }
}
```

### ProviderManager

```typescript
// src/services/ai/providerManager.ts

import type { LanguageModel } from 'ai';
import { ProviderFactory } from './providerFactory';
import { getGlobalConfigService } from '../globalConfigService';
import type { ApiConfig, ProviderInfo, ProviderSource } from './types';

/**
 * Provider 管理器
 * 负责 Provider 的生命周期管理和切换
 */
export class ProviderManager {
  private static instance: ProviderManager;
  
  private currentProvider: LanguageModel | null = null;
  private currentConfig: ApiConfig | null = null;
  private providerCache = new Map<string, LanguageModel>();
  
  static getInstance(): ProviderManager {
    if (!this.instance) {
      this.instance = new ProviderManager();
    }
    return this.instance;
  }
  
  /**
   * 初始化 Provider
   * 根据全局配置加载当前激活的 Provider
   */
  async initialize(): Promise<void> {
    const configService = getGlobalConfigService();
    const activeConfig = configService.getActiveApiConfig();
    
    if (activeConfig) {
      this.currentConfig = this.convertToApiConfig(activeConfig);
      this.currentProvider = this.createOrGetCached(this.currentConfig);
    }
  }
  
  /**
   * 获取当前激活的 Provider
   */
  getActiveProvider(): LanguageModel | null {
    return this.currentProvider;
  }
  
  /**
   * 获取当前 Provider 信息
   */
  getProviderInfo(): ProviderInfo | null {
    if (!this.currentConfig) {
      return {
        source: 'tavern',
        name: '酒馆 API',
        modelId: 'default',
        ready: true,
      };
    }
    
    return {
      source: this.currentConfig.source,
      name: this.getProviderName(this.currentConfig.source),
      modelId: this.currentConfig.model,
      baseUrl: this.maskUrl(this.currentConfig.apiUrl),
      ready: this.currentProvider !== null,
    };
  }
  
  /**
   * 切换到指定预设
   */
  switchToPreset(presetId: string | null): void {
    if (presetId === null) {
      // 切换到酒馆 API 模式
      this.currentProvider = null;
      this.currentConfig = null;
      return;
    }
    
    const configService = getGlobalConfigService();
    const preset = configService.getPresetById(presetId);
    
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }
    
    this.currentConfig = this.convertToApiConfig(preset.config);
    this.currentProvider = this.createOrGetCached(this.currentConfig);
  }
  
  /**
   * 刷新当前 Provider（配置变更后调用）
   */
  refresh(): void {
    if (this.currentConfig) {
      // 清除缓存，强制重新创建
      const cacheKey = this.getCacheKey(this.currentConfig);
      this.providerCache.delete(cacheKey);
      this.currentProvider = this.createOrGetCached(this.currentConfig);
    }
  }
  
  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.providerCache.clear();
  }
  
  // ==================== 私有方法 ====================
  
  private createOrGetCached(config: ApiConfig): LanguageModel {
    const cacheKey = this.getCacheKey(config);
    
    if (!this.providerCache.has(cacheKey)) {
      const provider = ProviderFactory.createFromConfig(config);
      this.providerCache.set(cacheKey, provider);
    }
    
    return this.providerCache.get(cacheKey)!;
  }
  
  private getCacheKey(config: ApiConfig): string {
    return `${config.source}:${config.apiUrl}:${config.model}`;
  }
  
  private convertToApiConfig(rawConfig: any): ApiConfig {
    return {
      source: rawConfig.source || 'openai',
      apiUrl: rawConfig.apiUrl,
      apiKey: rawConfig.apiKey,
      model: rawConfig.model,
      defaultOptions: {
        maxTokens: rawConfig.maxTokens,
        temperature: rawConfig.temperature,
        topP: rawConfig.topP,
        frequencyPenalty: rawConfig.frequencyPenalty,
        presencePenalty: rawConfig.presencePenalty,
      },
    };
  }
  
  private getProviderName(source: ProviderSource): string {
    const names: Record<ProviderSource, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google Gemini',
      deepseek: 'DeepSeek',
      mock: 'Mock',
      tavern: '酒馆 API',
    };
    return names[source] || source;
  }
  
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}/...`;
    } catch {
      return '***';
    }
  }
}
```

---

## 请求生命周期

### RequestManager

```typescript
// src/services/ai/requestManager.ts

import type { RequestInfo, RequestStatus } from './types';

/**
 * 请求管理器
 * 跟踪所有进行中的请求，支持取消
 */
export class RequestManager {
  private static instance: RequestManager;
  private requests = new Map<string, RequestContext>();
  private requestCounter = 0;
  
  static getInstance(): RequestManager {
    if (!this.instance) {
      this.instance = new RequestManager();
    }
    return this.instance;
  }
  
  /**
   * 创建新请求
   */
  create(options?: { id?: string; source?: string }): RequestContext {
    const id = options?.id || this.generateId();
    const controller = new AbortController();
    
    const context: RequestContext = {
      id,
      status: 'pending',
      source: options?.source,
      startTime: Date.now(),
      controller,
      signal: controller.signal,
    };
    
    this.requests.set(id, context);
    return context;
  }
  
  /**
   * 标记请求开始
   */
  start(id: string): void {
    const ctx = this.requests.get(id);
    if (ctx) {
      ctx.status = 'running';
    }
  }
  
  /**
   * 标记请求完成
   */
  complete(id: string): void {
    const ctx = this.requests.get(id);
    if (ctx) {
      ctx.status = 'completed';
      ctx.endTime = Date.now();
    }
  }
  
  /**
   * 标记请求失败
   */
  fail(id: string): void {
    const ctx = this.requests.get(id);
    if (ctx) {
      ctx.status = 'failed';
      ctx.endTime = Date.now();
    }
  }
  
  /**
   * 取消请求
   */
  cancel(id: string): boolean {
    const ctx = this.requests.get(id);
    if (ctx && ctx.status === 'running') {
      ctx.controller.abort();
      ctx.status = 'aborted';
      ctx.endTime = Date.now();
      return true;
    }
    return false;
  }
  
  /**
   * 取消所有进行中的请求
   */
  cancelAll(): void {
    for (const [id, ctx] of this.requests) {
      if (ctx.status === 'running') {
        this.cancel(id);
      }
    }
  }
  
  /**
   * 获取活动请求列表
   */
  getActiveRequests(): RequestInfo[] {
    const active: RequestInfo[] = [];
    for (const ctx of this.requests.values()) {
      if (ctx.status === 'pending' || ctx.status === 'running') {
        active.push({
          id: ctx.id,
          status: ctx.status,
          source: ctx.source,
          startTime: ctx.startTime,
        });
      }
    }
    return active;
  }
  
  /**
   * 是否有正在进行的请求
   */
  isGenerating(): boolean {
    return this.getActiveRequests().length > 0;
  }
  
  /**
   * 获取最近的请求 ID
   */
  getLatestRequestId(): string | null {
    let latest: RequestContext | null = null;
    for (const ctx of this.requests.values()) {
      if (!latest || ctx.startTime > latest.startTime) {
        latest = ctx;
      }
    }
    return latest?.id || null;
  }
  
  /**
   * 清理已完成的请求（可选，避免内存泄漏）
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();
    for (const [id, ctx] of this.requests) {
      if (ctx.endTime && now - ctx.endTime > maxAge) {
        this.requests.delete(id);
      }
    }
  }
  
  private generateId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }
}

interface RequestContext {
  id: string;
  status: RequestStatus;
  source?: string;
  startTime: number;
  endTime?: number;
  controller: AbortController;
  signal: AbortSignal;
}
```

### 请求流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    streamText() 调用                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. RequestManager.create()                                 │
│     - 生成 requestId                                         │
│     - 创建 AbortController                                   │
│     - 状态: pending                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. ProviderManager.getActiveProvider()                     │
│     - 返回 LanguageModel 或 null (使用酒馆)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │ Provider?                     │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────┐
│  3a. Vercel AI SDK    │       │  3b. TavernAdapter        │
│  streamText()         │       │  streamGenerate()         │
│  状态: running        │       │  状态: running            │
└───────────┬───────────┘       └───────────┬───────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 流式输出                                                 │
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
└───────────────┘   └───────────┘   └───────────────┘
```

---

## 并发与队列管理

### 需求背景

根据 Social Media Engine 等系统的需求，AI Service 需要支持以下并发场景：

| 场景 | 来源 | 请求数量 | 优先级 | 说明 |
|------|------|-------|
| **用户聊天** | Chat App | 1 | 最高 | 用户等待中，需要快速响应 |
| **话题内容填充** | Social Media Engine | 3-5 条博文 | 高 | 用户点击话题时触发 |
| **评论区生成** | Social Media Engine | 5-10 条评论 | 中 | 可并行或批量 |
| **后台世界事件** | Director Service | 1 | 低 | 定时后台任务 |
| **多平台联动** | Social Media Engine | 2-3 平台 | 中 | 同一事件多平台生成 |

### 核心问题

1. **API 速率限制 (Rate Limit)**
   - OpenAI: 3-10000 RPM（根据 tier）
   - Anthropic: 60 RPM（免费）/ 1000 RPM（付费）
   - 并发过高会触发 429 错误

2. **优先级调度**
   - 用户主动操作 > 用户触发的惰性加载 > 后台任务
   - 需要抢占或插队机制

3. **资源优化**
   - 批量请求 vs 并行请求 的策略选择
   - 避免不必要的重复请求

### 架构设计

```
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
│  │  │  - 速率限制 (RPM/TPM)                               │││
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

### 类型定义

```typescript
// src/services/ai/types.ts (扩展)

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

/**
 * 排队的请求
 */
export interface QueuedRequest {
  id: string;
  priority: RequestPriority;
  options: GenerateOptions | StreamOptions;
  isStream: boolean;
  createdAt: number;
  /** 解析 Promise */
  resolve: (result: any) => void;
  reject: (error: AIError) => void;
  /** 取消令牌 */
  abortController: AbortController;
}

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

### RequestQueue 实现

```typescript
// src/services/ai/requestQueue.ts

import type { 
  QueueConfig, 
  QueuedRequest, 
  QueueStatus, 
  RequestPriority,
  GenerateOptions,
  StreamOptions,
  AIError,
} from './types';
import { createAIError } from './utils';

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 3,
  maxRPM: 0, // 不限制
  minInterval: 100, // 100ms 最小间隔
  maxQueueSize: 100,
  queueTimeout: 300000, // 5 分钟
};

/**
 * 请求队列
 * 支持优先级调度和并发控制
 */
export class RequestQueue {
  private static instance: RequestQueue;
  
  private config: QueueConfig;
  private queue: QueuedRequest[] = [];
  private running = new Map<string, QueuedRequest>();
  private rpmWindow: number[] = []; // 记录最近 1 分钟的请求时间戳
  private lastRequestTime = 0;
  private isProcessing = false;
  
  private constructor(config?: Partial<QueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  static getInstance(config?: Partial<QueueConfig>): RequestQueue {
    if (!this.instance) {
      this.instance = new RequestQueue(config);
    }
    return this.instance;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 入队请求
   */
  enqueue<T>(
    options: GenerateOptions | StreamOptions,
    isStream: boolean,
    priority: RequestPriority = RequestPriority.NORMAL
  ): Promise<T> {
    // 检查队列是否已满
    if (this.queue.length >= this.config.maxQueueSize) {
      return Promise.reject(
        createAIError('QUEUE_FULL', `队列已满（最大 ${this.config.maxQueueSize}）`)
      );
    }
    
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: options.requestId || this.generateId(),
        priority,
        options,
        isStream,
        createdAt: Date.now(),
        resolve,
        reject,
        abortController: new AbortController(),
      };
      
      // 按优先级插入（优先级数字越小越靠前）
      const insertIndex = this.queue.findIndex(r => r.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }
      
      // 设置队列超时
      setTimeout(() => {
        if (this.queue.find(r => r.id === request.id)) {
          this.cancel(request.id, '队列等待超时');
        }
      }, this.config.queueTimeout);
      
      // 触发处理
      this.process();
    });
  }
  
  /**
   * 取消请求（队列中或执行中）
   */
  cancel(requestId: string, reason = '用户取消'): boolean {
    // 先查队列
    const queueIndex = this.queue.findIndex(r => r.id === requestId);
    if (queueIndex !== -1) {
      const request = this.queue.splice(queueIndex, 1)[0];
      request.reject(createAIError('ABORTED', reason));
      return true;
    }
    
    // 再查执行中
    const runningRequest = this.running.get(requestId);
    if (runningRequest) {
      runningRequest.abortController.abort();
      return true;
    }
    
    return false;
  }
  
  /**
   * 取消指定优先级的所有请求
   */
  cancelByPriority(priority: RequestPriority): number {
    let count = 0;
    
    // 取消队列中的
    this.queue = this.queue.filter(r => {
      if (r.priority === priority) {
        r.reject(createAIError('ABORTED', '批量取消'));
        count++;
        return false;
      }
      return true;
    });
    
    // 取消执行中的
    for (const [id, request] of this.running) {
      if (request.priority === priority) {
        request.abortController.abort();
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * 获取队列状态
   */
  getStatus(): QueueStatus {
    const pendingByPriority = {
      [RequestPriority.CRITICAL]: 0,
      [RequestPriority.HIGH]: 0,
      [RequestPriority.NORMAL]: 0,
      [RequestPriority.LOW]: 0,
    };
    
    for (const request of this.queue) {
      pendingByPriority[request.priority]++;
    }
    
    return {
      pending: this.queue.length,
      running: this.running.size,
      pendingByPriority,
      currentRPM: this.getCurrentRPM(),
    };
  }
  
  /**
   * 清空队列（不影响执行中的）
   */
  clear(): void {
    for (const request of this.queue) {
      request.reject(createAIError('ABORTED', '队列已清空'));
    }
    this.queue = [];
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 处理队列
   */
  private async process(): Promise<voin    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      while (this.queue.length > 0 && this.canExecute()) {
        const request = this.queue.shift()!;
        this.execute(request);
        
        // 等待最小间隔
        if (this.config.minInterval > 0) {
          await this.sleep(this.config.minInterval);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * 检查是否可以执行新请求
   */
  private canExecute(): boolean {
    // 检查并发数
    if (this.running.size >= this.config.maxConcurrent) {
      return false;
    }
    
    // 检查 RPM
    if (this.config.maxRPM > 0 && this.getCurrentRPM() >= this.config.maxRPM) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 执行请求
   */
  private async execute(request: QueuedRequest): Promise<void> {
    this.running.set(request.id, request);
    this.recordRequest();
    
    try {
      // 注入 abort signal
      const options = {
        ...request.options,
        signal: request.abortController.signal,
      };
      
      // 调用实际的 AI 服务（由 AIService 注入）
      const result = await this.executeRequest(options, request.isStream);
      request.resolve(result);
    } catch (error) {
      request.reject(error as AIError);
    } finally {
      this.running.delete(request.id);
      // 继续处理队列
      this.process();
    }
  }
  
  /**
   * 实际执行请求（由 AIService 注入）
   */
  private executeRequest: (
    options: GenerateOptions | StreamOptions,
    isStream: boolean
) => Promise<any> = () => {
    throw new Error('executeRequest not injected');
  };
  
  /**
   * 注入执行器
   */
  setExecutor(
    executor: (options: GenerateOptions | StreamOptions, isStream: boolean) => Promise<any>
  ): void {
    this.executeRequest = executor;
  }
  
  /**
   * 获取当前 RPM
   */
  private getCurrentRPM(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.rpmWindow = this.rpmWindow.filter(t => t > oneMinuteAgo);
    return this.rpmWindow.length;
  }
  
  /**
   * 记录请求
   */
  private recordRequest(): void {
    this.rpmWindow.push(Date.now());
    this.lastRequestTime = Date.now();
  }
  
  private generateId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### AIService 集成

```typescript
// src/services/ai/aiService.ts (扩展)

import { RequestQueue } from './requestQueue';
import { RequestPriority } from './types';

class AIService implements IAIService {
  private queue: RequestQueue;
  
  constructor() {
    this.queue = RequestQueue.getInstance();
    // 注入执行器
    this.queue.setExecutor((options, isStream) => 
      this.executeDirectly(options, isStream)
    );
  }
  
  /**
   * 生成文本（通过队列）
   */
  async generateText(
    options: GenerateOptions,
    priority: RequestPriority = RequestPriority.NORMAL
  ): Promise<GenerateResult> {
    return this.queue.enqueue(options, false, priority);
  }
  
  /**
   * 流式生成（通过队列）
   */
  streamText(
    options: StreamOptions,
    priority: RequestPriority = RequestPriority.NORMAL
  ): StreamHandle {
    // 流式请求的特殊处理
    const handle = this.createStreamHandle(options);
    this.queue.enqueue(options, true, priority)
      .then(result => handle.resolve(result))
      .catch(error => handle.reject(error));
    return handle;
  }
  
  /**
   * 直接执行（跳过队列，仅内部使用）
   */
  private async executeDirectly(
    options: GenerateOptions | StreamOptions,
    isStream: boolean
  ): Promise<any> {
    // 原有的生成逻辑...
  }
  
  /**
   * 获取队列状态
   */
  getQueueStatus(): QueueStatus {
    return this.queue.getStatus();
  }
  
  /**
   * 更新队列配置
   */
  updateQueueConfig(config: Partial<QueueConfig>): void {
    this.queue.updateConfig(config);
  }
}
```

### 使用示例

```typescript
// 1. 用户聊天 - 最高优先级
const reply = await aiService.generateText(
  { prompt: userMessage },
  RequestPriority.CRITICAL
);

// 2. 惰性加载内容 - 高优先级
const posts = await Promise.all([
  aiService.generateText({ prompt: topic1 }, RequestPriority.HIGH),
  aiService.generateText({ prompt: topic2 }, RequestPriority.HIGH),
  aiService.generateText({ prompt: topic3 }, RequestPriority.HIGH),
]);

// 3. 后台世界事件 - 低优先级
aiService.generateText(
  { prompt: eventPrompt },
  RequestPriority.LOW
).then(event => {
  // 后台处理...
});

// 4. 批量取消后台任务
aiService.queue.cancelByPriority(RequestPriority.LOW);

// 5. 查看队列状态
const status = aiService.getQueueStatus();
console.log(`队列: ${status.pending} 等待, ${status.running} 执行中`);
console.log(`RPM: ${status.currentRPM}`);
```

### 配置建议

| Provider | 推荐 maxConcurrent | 推荐 maxRPM | 说明 |
|----------|-------------------|-------------|------|
| OpenAI (Free) | 1 | 3 | 免费层限制严格 |
| OpenAI (Tier 1) | 3 | 60 | 基础付费 |
| OpenAI (Tier 2+) | 5 | 500 | 高级付费 |
| Anthropic | 2 | 40 | 相对保守 |
| Google Gemini | 3 | 60 | 免费额度较多 |
| 本地 Ollama | 1 | 0 | 受限于本地算力 |
| Mock | 10 | 0 | 开发模式无限制 |

### 自动速率限制恢复

```typescript
// src/services/ai/rateLimiter.ts

/**
 * 自动处理 429 错误的重试逻辑
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 60000 } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // 检查是否为速率限制错误
      if (error.code !== 'RATE_LIMIT' && !error.message?.includes('429')) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 指数退避 + 随机抖动
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      console.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### 目录结构更新

```
src/services/ai/
├── index.ts
├── types.ts              # 扩展队列相关类型
├── constants.ts
├── aiService.ts          # 集成队列
├── providerFactory.ts
├── providerManager.ts
├── requestManager.ts
├── requestQueue.ts       # 🆕 请求队列
├── rateLimiter.ts        # 🆕 速率限制处理
├── tavernAdapter.ts
└── utils.ts
```

---

## 错误处理

### 错误分类

| 错误码 | 场景 | 可重试 | 处理建议 |
|--------|------|--------|----------|
| `PROVIDER_NOT_READY` | Provider 未初始化 | 是 | 等待初始化或切换 Provider |
| `AUTH_ERROR` | API Key 无效 | 否 | 提示用户检查配置 |
| `RATE_LIMIT` | 请求过于频繁 | 是 | 自动重试（带退避） |
| `NETWORK_ERROR` | 网络不可达 | 是 | 提示检查网络 |
| `TIMEOUT` | 请求超时 | 是 | 增加超时或重试 |
| `ABORTED` | 用户取消 | 否 | 正常流程，无需处理 |
| `CONTENT_FILTER` | 内容被过滤 | 否 | 提示修改输入 |
| `PROVIDER_ERROR` | Provider 返回错误 | 视情况 | 显示错误信息 |

### 错误处理工具

```typescript
// src/services/ai/utils.ts

import type { AIError, AIErrorCode } from './types';

/**
 * 创建 AI 错误
 */
export function createAIError(
  code: AIErrorCode,
  message: string,
  options?: {
    cause?: Error;
    requestId?: string;
    status?: number;
  }
): AIError {
  return {
    code,
    message,
    cause: options?.cause,
    requestId: options?.requestId,
    status: options?.status,
    retryable: isRetryable(code),
  };
}

/**
 * 判断错误是否可重试
 */
export function isRetryable(code: AIErrorCode): boolean {
  return ['RATE_LIMIT', 'NETWORK_ERROR', 'TIMEOUT', 'PROVIDER_NOT_READY'].includes(code);
}

/**
 * 从原生错误推断错误码
 */
export function inferErrorCode(error: Error): AIErrorCode {
  const message = error.message.toLowerCase();
  
  if (message.includes('abort') || error.name === 'AbortError') {
    return 'ABORTED';
  }
  if (message.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('api key')) {
    return 'AUTH_ERROR';
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return 'RATE_LIMIT';
  }
  if (message.includes('content') && message.includes('filter')) {
    return 'CONTENT_FILTER';
  }
  
  return 'UNKNOWN';
}

/**
 * 格式化错误消息（用于 UI 显示）
 */
export function formatErrorMessage(error: AIError): string {
  const messages: Record<AIErrorCode, string> = {
    PROVIDER_NOT_READY: '服务未就绪，请稍后重试',
    PROVIDER_ERROR: `生成失败: ${error.message}`,
    NETWORK_ERROR: '网络连接失败，请检查网络',
    TIMEOUT: '请求超时，请重试',
    ABORTED: '已取消',
    RATE_LIMIT: '请求过于频繁，请稍后重试',
    AUTH_ERROR: 'API 认证失败，请检查配置',
    INVALID_REQUEST: '请求参数错误',
    CONTENT_FILTER: '内容被安全策略拦截',
    UNKNOWN: '未知错误',
  };
  
  return messages[error.code] || error.message;
}
```

---

## 状态管理

### AIStore

```typescript
// src/stores/aiStore.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  GenerateOptions,
  StreamOptions,
  GenerateResult,
  StreamHandle,
  AIError,
  ProviderInfo,
  RequestInfo,
} from '@/services/ai/types';

// 假设 AIService 已实现
import { getAIService } from '@/services/ai';

export const useAIStore = defineStore('ai', () => {
  // ==================== 状态 ====================
  
  /** 是否正在生成 */
  const isGenerating = ref(false);
  
  /** 当前活动的请求 ID */
  const activeRequestId = ref<string | null>(null);
  
  /** 最后一次错误 */
  const lastError = ref<AIError | null>(null);
  
  /** 当前 Provider 信息 */
  const providerInfo = ref<ProviderInfo | null>(null);
  
  /** 活动请求列表 */
  const activeRequests = ref<RequestInfo[]>([]);
  
  /** 生成历史（可选，用于调试） */
  const generationHistory = ref<GenerationRecord[]>([]);
  
  // ==================== 计算属性 ====================
  
  /** 是否可以发起生成 */
  const canGenerate = computed(() => {
    return !isGenerating.value;
  });
  
  /** 是否使用自定义 API */
  const isUsingCustomApi = computed(() => {
    return providerInfo.value?.source !== 'tavern';
  });
  
  // ==================== Actions ====================
  
  /**
   * 初始化 Store
   */
  async function initialize() {
    const service = getAIService();
    await service.initialize();
    
    providerInfo.value = service.getProviderInfo();
    
    // 监听事件
    service.on('start', (requestId) => {
      isGenerating.value = true;
      activeRequestId.value = requestId;
      lastError.value = null;
    });
    
    service.on('finish', (requestId, result) => {
      isGenerating.value = false;
      if (activeRequestId.value === requestId) {
        activeRequestId.value = null;
      }
      // 记录历史
      addToHistory(requestId, result);
    });
    
    service.on('error', (requestId, error) => {
      isGenerating.value = false;
      lastError.value = error;
      if (activeRequestId.value === requestId) {
        activeRequestId.value = null;
      }
    });
    
    service.on('abort', (requestId) => {
      isGenerating.value = false;
      if (activeRequestId.value === requestId) {
        activeRequestId.value = null;
      }
    });
  }
  
  /**
   * 生成文本（非流式）
   */
  async function generate(options: GenerateOptions): Promise<GenerateResult> {
    const service = getAIService();
    return service.generateText(options);
  }
  
  /**
   * 流式生成文本
   */
  function streamGenerate(options: StreamOptions): StreamHandle {
    const service = getAIService();
    return service.streamText(options);
  }
  
  /**
   * 取消当前生成
   */
  function abort() {
    const service = getAIService();
    service.abort();
  }
  
  /**
   * 切换 Provider
   */
  function switchProvider(presetId: string | null) {
    const service = getAIService();
    service.switchProvider(presetId);
    providerInfo.value = service.getProviderInfo();
  }
  
  /**
   * 清除错误
   */
  function clearError() {
    lastError.value = null;
  }
  
  // ==================== 私有方法 ====================
  
  function addToHistory(requestId: string, result: GenerateResult) {
    generationHistory.value.unshift({
      requestId,
      text: result.text,
      usage: result.usage,
      timestamp: Date.now(),
    });
    
    // 保留最近 50 条
    if (generationHistory.value.length > 50) {
      generationHistory.value.pop();
    }
  }
  
  return {
    // 状态
    isGenerating,
    activeRequestId,
    lastError,
    providerInfo,
    activeRequests,
    generationHistory,
    
    // 计算属性
    canGenerate,
    isUsingCustomApi,
    
    // Actions
    initialize,
    generate,
    streamGenerate,
    abort,
    switchProvider,
    clearError,
  };
});

interface GenerationRecord {
  requestId: string;
  text: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  timestamp: number;
}
```

---

## 使用示例

### 基础用法

```typescript
// 在 Vue 组件中
import { useAIStore } from '@/stores/aiStore';

const aiStore = useAIStore();

// 1. 非流式生成
async function handleGenerate() {
  try {
    const result = await aiStore.generate({
      prompt: '写一首关于春天的诗',
      maxTokens: 500,
    });
    console.log(result.text);
  } catch (error) {
    console.error('生成失败:', aiStore.lastError);
  }
}

// 2. 流式生成
function handleStreamGenerate() {
  const handle = aiStore.streamGenerate({
    prompt: '讲一个故事',
    onChunk: (chunk) => {
      if (chunk.type === 'text-delta') {
        appendToDisplay(chunk.textDelta);
      }
    },
    onFinish: (result) => {
      console.log('完成:', result.text);
    },
    onError: (error) => {
      console.error('错误:', error);
    },
  });
  
  // 可以取消
  // handle.abort();
}

// 3. 取消生成
function handleCancel() {
  aiStore.abort();
}
```

### 直接使用 Service（不通过 Store）

```typescript
import { getAIService } from '@/services/ai';

const aiService = getAIService();

// 流式生成
const handle = aiService.streamText({
  messages: [
    { role: 'system', content: '你是一个友好的助手' },
    { role: 'user', content: '你好！' },
  ],
});

for await (const text of handle.textStream) {
  process.stdout.write(text);
}

console.log('最终文本:', await handle.text);
```

### 在现有 AIGenerateService 中使用

```typescript
// 迁移后的 AIGenerateService
import { getAIService } from '@/services/ai';

export class AIGenerateService {
  static async generate(
    prompt: RenderedPrompt,
    options?: Partial<GenerateConfig>
  ): Promise<GenerateResult> {
    const aiService = getAIService();
    
    const result = await aiService.generateText({
      system: prompt.systemPrompt,
      prompt: prompt.userPrompt,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });
    
    return {
      text: result.text,
      success: true,
    };
  }
}
```

---

## 迁移指南

### 阶段一：基础设施 (P0) ✅ 已完成

1. **创建目录结构** ✅
   ```
   src/services/ai/
   ├── index.ts
   ├── types.ts
   ├── constants.ts
   ├── providerFactory.ts
   ├── providerManager.ts
   └── requestManager.ts
   ```

2. **实现 ProviderFactory** ✅
   - 从 `mock/aiProvider.ts` 中抽离 Provider 创建逻辑
   - 支持所有现有 Provider 类型

3. **实现 ProviderManager** ✅
   - 集成 `GlobalConfigService`
   - 实现 Provider 缓存和切换

4. **实现 RequestManager** ✅
   - 请求 ID 生成
   - AbortController 管理

### 阶段二：核心服务 (P0) ✅ 已完成

1. **实现 AIService** ✅
   - 统一的 `generateText` 和 `streamText`
   - 集成 ProviderManager 和 RequestManager
   - 实现酒馆 API 回退

2. **实现 TavernAdapter** ✅
   - 封装 `TavernHelper.generate()` 调用
   - 适配 StreamHandle 接口

### 阶段三：状态管理 (P1) ✅ 已完成

1. **实现 AIStore** ✅
   - 响应式状态
   - 事件监听

2. **更新 UI 组件** ⏳ 待完成
   - 使用 `aiStore.isGenerating` 显示 loading
   - 使用 `aiStore.lastError` 显示错误

### 阶段四：迁移现有代码 (P2) ✅ 已完成

1. **重构 AIGenerateService** ✅ 已完成
   - 内部统一调用 AIService
   - 保持公共 API 不变
   - 添加 abort/abortAll 方法
   - 支持 RequestPriority 优先级

2. **清理 mock/aiProvider.ts** ✅ 已完成
   - Provider 创建逻辑已迁移到 ProviderFactory
   - 保留 Mock 响应模板和 MockLanguageModelV1
   - 添加微博等新场景的模拟响应

3. **更新各 App** ✅ 已完成
   - ✅ `PromptDetail.vue` - 已迁移到 AIStore
   - ✅ 其他 App
   
   **迁移示例** (PromptDetail.vue):
   ```typescript
   // 之前
   import { AIGenerateService } from '@/services/aiGenerateService';
   const result = await AIGenerateService.generate(rendered);
   
   // 之后
   import { useAIStore } from '@/stores/aiStore';
   import { RequestPriority } from '@/services/ai';
   const aiStore = useAIStore();
   const result = await aiStore.generate(
     { prompt: rendered.userPrompt, system: rendered.systemPrompt },
     RequestPriority.HIGH
   );
   ```
   
   **迁移收益**:
   - 响应式 `isGenerating` 状态
   - 统一错误处理 (`aiStore.lastError`)
   - 请求取消支持 (`aiStore.abort()`)
   - Provider 信息 (`aiStore.providerInfo`)

### 兼容性保证

在迁移期间，现有代码继续工作：

```typescript
// 旧代码（继续可用）
import { AIGenerateService } from '@/services/aiGenerateService';
await AIGenerateService.generateWithPrompt('chat.reply', { ... });

// 新代码
import { useAIStore } from '@/stores/aiStore';
const aiStore = useAIStore();
await aiStore.generate({ prompt: '...' });
```

---

## 附录

### A. 常量定义

```typescript
// src/services/ai/constants.ts

export const DEFAULT_TIMEOUT = 60000; // 60 秒
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_TEMPERATURE = 0.7;

export const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
};
```

### B. 事件列表

| 事件 | 触发时机 | 参数 |
|------|----------|------|
| `start` | 请求开始 | `requestId: string` |
| `chunk` | 收到流式数据 | `requestId: string, chunk: string` |
| `finish` | 请求完成 | `requestId: string, result: GenerateResult` |
| `error` | 请求失败 | `requestId: string, error: AIError` |
| `abort` | 请求取消 | `requestId: string` |

### C. 与现有系统的关系

```
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
