# Provider 管理

本文档说明 AI Service 的 Provider 管理机制，包括 Provider 工厂、管理器和切换逻辑。

## 1. 概述

AI Service 支持多种 LLM Provider，通过统一的抽象层管理：

- **ProviderFactory** - 根据配置创建 LanguageModel 实例
- **ProviderManager** - 管理 Provider 生命周期、缓存和切换

---

## 2. 支持的 Provider

| Provider | 类型 | 说明 |
| -------- | ---- | ---- |
| **OpenAI** | `openai` | OpenAI 官方 API，使用 `/chat/completions` 端点 |
| **OpenAI Compatible** | 自动检测 | 兼容 OpenAI API 的第三方服务（如中转站） |
| **Anthropic** | `anthropic` | Claude 系列模型 |
| **Google Gemini** | `google` | Gemini 系列模型 |
| **DeepSeek** | `deepseek` | 使用 OpenAI 兼容模式 |
| **Mock** | `mock` | 开发测试用，返回模拟响应 |
| **酒馆 API** | `tavern` | 通过 TavernHelper 调用宿主环境 |

---

## 3. ProviderFactory

### 3.1 职责

根据 `ApiConfig` 创建对应的 `LanguageModel` 实例。

### 3.2 核心方法

```typescript
class ProviderFactory {
  /**
   * 根据 API 配置创建 Provider
   */
  static createFromConfig(config: ApiConfig): LanguageModel;

  /**
   * 创建 OpenAI Provider
   * 使用 .chat() 方法确保使用 /chat/completions 端点
   */
  static createOpenAI(config: ApiConfig): LanguageModel;

  /**
   * 创建 OpenAI Compatible Provider
   * 用于 DeepSeek、Moonshot、Groq 等兼容 API
   */
  static createOpenAICompatible(config: ApiConfig): LanguageModel;

  /**
   * 创建 Anthropic Provider
   */
  static createAnthropic(config: ApiConfig): LanguageModel;

  /**
   * 创建 Google Gemini Provider
   */
  static createGoogle(config: ApiConfig): LanguageModel;

  /**
   * 创建 DeepSeek Provider（使用 OpenAI 兼容模式）
   */
  static createDeepSeek(config: ApiConfig): LanguageModel;

  /**
   * 创建 Mock Provider（开发用）
   */
  static createMock(): LanguageModel;

  /**
   * 获取支持的 Provider 列表
   */
  static getSupportedProviders(): { source: ProviderSource; name: string }[];
}
```

### 3.3 Provider 创建逻辑

```typescript
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
```

### 3.4 OpenAI 端点说明

使用 `.chat()` 方法确保使用传统的 `/chat/completions` 端点：

```typescript
static createOpenAI(config: ApiConfig): LanguageModel {
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiUrl || undefined,
  });
  // 使用 .chat() 而不是直接调用 openai()
  // 这确保使用 /chat/completions 端点，而不是新的 /responses 端点
  return openai.chat(config.model);
}
```

> **注意**：对于 OpenAI 兼容的第三方服务（如中转站），必须使用 `.chat()` 方法，否则会尝试访问不存在的 `/responses` 端点。

---

## 4. ProviderManager

### 4.1 职责

- 管理当前激活的 Provider
- 缓存已创建的 Provider 实例
- 支持 Provider 切换
- 从 GlobalConfigService 读取配置

### 4.2 核心方法

```typescript
class ProviderManager {
  /**
   * 初始化 Provider
   * 根据全局配置加载当前激活的 Provider
   */
  async initialize(): Promise<void>;

  /**
   * 获取当前激活的 Provider
   * 返回 null 表示使用酒馆 API
   */
  getActiveProvider(): LanguageModel | null;

  /**
   * 获取当前 Provider 信息
   */
  getProviderInfo(): ProviderInfo | null;

  /**
   * 切换到指定预设
   * @param presetId 预设 ID，null 表示使用酒馆 API
   */
  switchToPreset(presetId: string | null): void;

  /**
   * 刷新当前 Provider（配置变更后调用）
   */
  refresh(): void;

  /**
   * 清除所有缓存
   */
  clearCache(): void;
}
```

### 4.3 缓存机制

Provider 实例会被缓存，避免重复创建：

```typescript
private createOrGetCached(config: ApiConfig): LanguageModel {
  const cacheKey = this.getCacheKey(config);

  if (!this.providerCache.has(cacheKey)) {
    const provider = ProviderFactory.createFromConfig(config);
    this.providerCache.set(cacheKey, provider);
  }

  return this.providerCache.get(cacheKey)!;
}

private getCacheKey(config: ApiConfig): string {
  // 使用 source + apiUrl + model 作为缓存键
  return `${config.source}:${config.apiUrl}:${config.model}`;
}
```

### 4.4 初始化流程

```typescript
async initialize(): Promise<void> {
  const configService = getGlobalConfigService();
  const activeConfig = configService.getActiveApiConfig();

  if (activeConfig) {
    // 有激活的 API 配置，创建自定义 Provider
    this.currentConfig = this.convertToApiConfig(activeConfig);
    this.currentProvider = this.createOrGetCached(this.currentConfig);
  }
  // 否则 currentProvider 保持为 null，使用酒馆 API
}
```

---

## 5. 双模式运行

### 5.1 模式判断

```typescript
// 在 AIService.executeDirectly 中
const provider = this.providerManager.getActiveProvider();

if (provider) {
  // 自定义 API 模式：使用 Vercel AI SDK
  result = await this.executeWithProvider(provider, options, isStream, signal);
} else {
  // 酒馆 API 模式：使用 TavernAdapter
  result = await this.executeWithTavern(options, isStream);
}
```

### 5.2 自定义 API 模式

使用 Vercel AI SDK 直接调用配置的 API 端点：

```typescript
private async executeWithProvider(
  provider: LanguageModel,
  options: GenerateOptions,
  isStream: boolean,
  signal: AbortSignal
): Promise<GenerateResult> {
  const commonOptions = {
    model: options.model || provider,
    system: options.system,
    maxTokens: options.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    // ... 其他参数
    abortSignal: signal,
  };

  if (isStream) {
    const streamResult = await vercelStreamText(commonOptions);
    // 处理流式响应...
  } else {
    const result = await vercelGenerateText(commonOptions);
    // 处理非流式响应...
  }
}
```

### 5.3 酒馆 API 模式

使用 TavernAdapter 调用宿主环境的 TavernHelper：

```typescript
private async executeWithTavern(
  options: GenerateOptions,
  isStream: boolean
): Promise<GenerateResult> {
  if (isStream) {
    const handle = this.tavernAdapter.streamText(options as StreamOptions);
    const text = await handle.text;
    return {
      text,
      requestId: handle.requestId,
      finishReason: 'stop',
    };
  } else {
    return this.tavernAdapter.generateText(options);
  }
}
```

---

## 6. TavernAdapter

### 6.1 职责

封装 TavernHelper.generate() 调用，适配 AI Service 接口。

### 6.2 核心方法

```typescript
class TavernAdapter {
  /**
   * 检查 TavernHelper 是否可用
   */
  isAvailable(): boolean;

  /**
   * 非流式生成
   */
  async generateText(options: GenerateOptions): Promise<GenerateResult>;

  /**
   * 流式生成
   */
  streamText(options: StreamOptions): StreamHandle;
}
```

### 6.3 配置构建

```typescript
private buildConfig(
  options: GenerateOptions | StreamOptions,
  isStream: boolean
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    user_input: options.prompt || '',
    should_stream: isStream,
  };

  // 如果有系统提示词
  if (options.system) {
    config.ordered_prompts = [
      { role: 'system', content: options.system },
      'chat_history',
      'user_input',
    ];
  }

  // 如果启用了自定义 API（通过酒馆）
  const customApiConfig = configService.getActiveApiConfig();
  if (customApiConfig) {
    config.custom_api = {
      apiurl: customApiConfig.apiUrl,
      key: customApiConfig.apiKey,
      model: customApiConfig.model,
      // ... 其他参数
    };
  }

  return config;
}
```

---

## 7. Provider 默认端点

```typescript
// constants.ts
export const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
};

export const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  deepseek: 'DeepSeek',
  mock: 'Mock (Dev)',
  tavern: '酒馆 API',
};
```

---

## 8. 切换 Provider

### 8.1 通过 AIService

```typescript
const aiService = getAIService();

// 切换到指定预设
aiService.switchProvider('preset-1');

// 切换到酒馆 API 模式
aiService.switchProvider(null);

// 配置变更后刷新
aiService.refreshProvider();
```

### 8.2 通过 AIStore

```typescript
const aiStore = useAIStore();

// 切换 Provider
aiStore.switchProvider('preset-1');

// 查看当前 Provider 信息
console.log(aiStore.providerInfo);
// { source: 'openai', name: 'OpenAI', modelId: 'gpt-4', ready: true }

// 是否使用自定义 API
console.log(aiStore.isUsingCustomApi);
// true
```

---

## 9. 配置与 GlobalConfigService 集成

### 9.1 读取配置

```typescript
// ProviderManager.initialize()
const configService = getGlobalConfigService();
const activeConfig = configService.getActiveApiConfig();
```

### 9.2 切换预设

```typescript
// ProviderManager.switchToPreset()
const configService = getGlobalConfigService();
const presets = configService.getApiPresets();
const preset = presets.find(p => p.id === presetId);

if (preset) {
  this.currentConfig = this.convertToApiConfig(preset.config);
  this.currentProvider = this.createOrGetCached(this.currentConfig);
}
```

### 9.3 配置转换

```typescript
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
```
