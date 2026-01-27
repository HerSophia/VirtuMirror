# 模型列表服务

> 模型列表服务用于从各种 AI API 获取可用的模型列表。

## 概述

`ModelListService` 提供了统一的接口来获取不同 AI 服务提供商的可用模型列表。支持的 Provider 包括：

- **OpenAI** - 官方 API 及兼容 API（DeepSeek、Moonshot、SiliconFlow、Ollama 等）
- **Anthropic** - Claude 系列模型（预定义列表）
- **Google** - Gemini 系列模型

## 快速开始

### 基本用法

```typescript
import { fetchModels, getModelListService } from '@/services/ai';

// 直接获取模型列表
const result = await fetchModels({
  apiUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  source: 'openai'
});

if (result.success) {
  console.log('可用模型:', result.models.map(m => m.id));
} else {
  console.error('获取失败:', result.error);
}

// 使用带缓存的服务（推荐）
const service = getModelListService();
const cachedResult = await service.getModels({
  apiUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  source: 'openai'
});
```

### 强制刷新缓存

```typescript
const service = getModelListService();

// 强制刷新，忽略缓存
const result = await service.getModels(config, { forceRefresh: true });

// 或者清除特定配置的缓存
service.clearCacheFor(config);

// 清除所有缓存
service.clearCache();
```

## API 参考

### fetchModels

根据 API 配置获取模型列表，自动选择合适的获取方法。

```typescript
function fetchModels(
  config: Partial<ApiConfig> | FetchModelsOptions,
  options?: Partial<FetchModelsOptions>
): Promise<FetchModelsResult>
```

#### FetchModelsOptions

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiUrl` | `string` | ✅ | API 地址 |
| `apiKey` | `string` | - | API 密钥 |
| `source` | `ProviderSource \| 'custom'` | - | API 来源类型，默认 `'openai'` |
| `timeout` | `number` | - | 超时时间（毫秒），默认 10000 |
| `chatModelsOnly` | `boolean` | - | 是否只返回聊天模型，默认 `false` |

#### FetchModelsResult

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | `boolean` | 是否成功 |
| `models` | `ModelInfo[]` | 模型列表 |
| `error` | `string?` | 错误信息（如果失败） |
| `responseTime` | `number?` | 响应时间（毫秒） |

#### ModelInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 模型 ID |
| `name` | `string?` | 模型名称（用于显示） |
| `description` | `string?` | 模型描述 |
| `ownedBy` | `string?` | 模型所有者/创建者 |
| `created` | `number?` | 创建时间戳 |
| `type` | `'chat' \| 'completion' \| 'embedding' \| 'image' \| 'audio' \| 'other'` | 模型类型 |
| `multimodal` | `boolean?` | 是否支持多模态 |
| `contextLength` | `number?` | 上下文长度 |
| `raw` | `Record<string, unknown>?` | 原始数据 |

### ModelListService

带缓存的模型列表服务类。

```typescript
class ModelListService {
  constructor(cacheTTL?: number);  // 缓存有效期，默认 5 分钟
  
  getModels(
    config: Partial<ApiConfig> | FetchModelsOptions,
    options?: Partial<FetchModelsOptions> & { forceRefresh?: boolean }
  ): Promise<FetchModelsResult>;
  
  clearCache(): void;
  clearCacheFor(config: Partial<ApiConfig> | FetchModelsOptions): void;
}
```

### 单例函数

```typescript
// 获取单例实例
function getModelListService(): ModelListService;

// 重置单例（用于测试）
function resetModelListService(): void;
```

## Provider 特定 API

### OpenAI 兼容 API

```typescript
import { fetchOpenAIModels } from '@/services/ai';

// OpenAI 官方
const result = await fetchOpenAIModels({
  apiUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx'
});

// DeepSeek
const result = await fetchOpenAIModels({
  apiUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-xxx'
});

// Ollama 本地（无需 API Key）
const result = await fetchOpenAIModels({
  apiUrl: 'http://localhost:11434/v1'
});
```

### Anthropic

Anthropic 没有公开的模型列表 API，返回预定义的模型列表。

```typescript
import { fetchAnthropicModels, ANTHROPIC_MODELS } from '@/services/ai';

// 获取预定义列表
const result = await fetchAnthropicModels();

// 直接使用常量
console.log(ANTHROPIC_MODELS);
// [
//   { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', ... },
//   { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', ... },
//   ...
// ]
```

### Google Gemini

```typescript
import { fetchGoogleModels } from '@/services/ai';

const result = await fetchGoogleModels({
  apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: 'AIzaSy...',
});
```

## 使用场景

### API 管理器中的模型选择

```typescript
// PresetEditor.vue
import { getModelListService, type ModelInfo } from '@/services/ai';

const modelListService = getModelListService();
const models = ref<ModelInfo[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

async function fetchModels() {
  isLoading.value = true;
  error.value = null;
  
  try {
    const result = await modelListService.getModels(
      {
        apiUrl: formData.value.apiUrl,
        apiKey: formData.value.apiKey,
        source: formData.value.source,
      },
      { forceRefresh: true }
    );
    
    if (result.success) {
      models.value = result.models;
    } else {
      error.value = result.error || '获取模型列表失败';
    }
  } finally {
    isLoading.value = false;
  }
}
```

### 模型类型过滤

```typescript
// 只获取聊天模型
const result = await fetchModels(config, { chatModelsOnly: true });

// 手动过滤
const chatModels = result.models.filter(m => m.type === 'chat');
const embeddingModels = result.models.filter(m => m.type === 'embedding');
```

## 错误处理

```typescript
const result = await fetchModels(config);

if (!result.success) {
  switch (true) {
    case result.error?.includes('超时'):
      console.error('请求超时，请检查网络连接');
      break;
    case result.error?.includes('401'):
    case result.error?.includes('Unauthorized'):
      console.error('API Key 无效');
      break;
    case result.error?.includes('403'):
      console.error('没有访问权限');
      break;
    case result.error?.includes('404'):
      console.error('API 端点不存在，该服务可能不支持 /models 接口');
      break;
    default:
      console.error('未知错误:', result.error);
  }
}
```

## 注意事项

1. **缓存策略**：默认缓存 5 分钟，避免频繁请求 API。

2. **Anthropic 模型**：返回的是预定义列表，不是实时从 API 获取。

3. **OpenAI 兼容 API**：部分 API（如某些代理服务）可能不支持 `/models` 端点，会返回空列表或错误。

4. **URL 规范化**：自动处理末尾斜杠和 `/chat/completions` 后缀，提取正确的 base URL。

5. **模型类型推断**：根据模型 ID 自动推断类型（chat、embedding、image 等），可能不完全准确。
