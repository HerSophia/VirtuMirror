# API 管理器 (API Manager)

> 专门管理 AI API 配置的应用，支持多配置存储、快速切换和连接测试。

## 概述

API 管理器允许用户创建、编辑和管理多个 API 配置预设。用户可以快速切换不同的 AI 服务（如 OpenAI、Google Gemini、Anthropic、DeepSeek 等），而无需每次手动输入配置。

**注意：本项目基于 Vercel AI SDK Core 构建，支持标准化的 API 调用流程。**

## 功能特性

- **多预设管理**：创建和管理多个 API 配置
- **快速切换**：一的 API 配置
- **模板快速创建**：内置常用 AI 服务模板（OpenAI, Google Gemini, Anthropic 等）
- **模型列表获取**：自动获取 API 支持的模型列表
- **连接测试**：验证 API 配置是否可用
- **配置导入/导出**：分享和备份配置（不含敏感信息）
- **状态指示**：清晰显示当前使用的 API 状态

## 目录结构

```text
src/apps/api-manager/
├── ApiManagerApp.vue          # 主应用入口
├── index.ts                   # 统一导出入口
├── types.ts                   # 类型定义
├── components/
│   ├── PresetCard.vue         # 预设卡片组件
│   ├── PresetEditor.vue       # 预设编辑器组件
│   ├── TemplateSelector.vue   # 模板选择器组件
│   └── index.ts               # 组件导出
└── composables/
    ├── useApiManager.ts       # 核心业务逻辑
    └── index.ts               # Composables 导出
```

## 组件说明

### ApiManagerApp.vue

主应用入口组件，负责整体布局和视图切换。

**功能**：

- 显示预设列表或空状态
- 管理模板选择器和编辑器的显示
- 处理删除确认和导入弹窗
- 状态栏显示当前 API 使用状态

### PresetCard.vue

显示单个 API 预设的卡片组件。

**Props**：

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `preset` | `ApiPreset` | 预设数据 |
| `isActive` | `boolean` | 是否为当前激活的预设 |

**Events**：

| 事件 | 说明 |
| --- | --- |
| `activate` | 激活此预设 |
| `edit` | 编辑此预设 |
| `duplicate` | 复制此预设 |
| `delete` | 删除此预设 |

### PresetEditor.vue

预设编辑器组件，用于创建和编辑 API 配置。

**Props**：

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `formData` | `ApiConfigFormData` | 表单数据 |
| `testResult` | `TestResult` | 测试结果 |
| `isEditing` | `boolean` | 是否为编辑模式 |
| `isSaving` | `boolean` | 是否正在保存 |

**Events**：

| 事件 | 说明 |
| --- | --- |
| `update:formData` | 更新表单数据 |
| `save` | 保存配置 |
| `cancel` | 取消编辑 |
| `test` | 测试连接 |

**内置功能**：

- 模型列表自动获取（通过 `ModelListService`）
- 模型下拉选择器（ComboBox 模式，支持搜索过滤）
- 生成参数滑块调节（Temperature, Top P, Frequency Penalty）
- 连接测试与调试信息显示

### TemplateSelector.vue

模板选择器组件，提供预设模板快速创建。

**Events**：

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `select` | `PresetTemplate` | 选择模板 |
| `cancel` | - | 取消选择 |

## Composables

### useApiManager()

核心业务逻辑 Composable，封装所有 API 管理操作。

```typescript
const {
  // 状态
  presets,              // 预设列表
  activePresetId,       // 当前激活的预设ID
  isCustomApiEnabled,   // 是否启用自定义API
  formData,             // 编辑表单数据
  editingPresetId,      // 当前编辑的预设ID（null表示新建）
  showEditor,           // 是否显示编辑器
  testResult,           // 测试结果
  isSaving,             // 是否正在保存
  modelList,            // 模型列表
  isLoadingModels,      // 是否正在加载模型列表
  modelListError,       // 模型列表错误信息
  
  // 计算属性
  activePreset,         // 当前激活的预设
  hasPresets,           // 是否有预设
  isEditing,            // 是否在编辑模式
  presetTemplates,      // 预设模板列表
  
  // 方法
  loadConfig,           // 加载配置
  refreshPresets,       // 刷新预设列表
  startNewPreset,       // 开始新建
  startEditPreset,      // 开始编辑
  cancelEdit,           // 取消编辑
  savePreset,           // 保存预设
  deletePreset,         // 删除预设
  activatePreset,       // 激活预设
  deactivatePreset,     // 停用预设
  fetchModels,          // 获取模型列表
  testConnection,       // 测试连接
  duplicatePreset,      // 复制预设
  exportPreset,         // 导出预设
  importPreset,         // 导入预设
} = useApiManager()
```

## 类型定义

### ApiConfigFormData

```typescript
interface ApiConfigFormData {
  /** 配置名称 */
  name: string
  /** 配置描述 */
  description: string
  /** API 地址 */
  apiUrl: string
  /** API 密钥 */
  apiKey: string
  /** 模型名称 */
  model: string
  /** API 来源类型 */
  source: 'openai' | 'anthropic' | 'google' | 'custom'
  /** 最大 token 数 */
  maxTokens: number
  /** 温度参数 */
  temperature: number
  /** 频率惩罚 */
  frequencyPenalty: number
  /** 存在惩罚 */
  presencePenalty: number
  /** Top P 采样 */
  topP: number
}
```

### TestResult

```typescript
type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TestResult {
  status: TestStatus
  message?: string
  responseTime?: number
}
```

### PresetTemplate

```typescript
interface PresetTemplate {
  id: string
  name: string
  description: string
  icon: string
  config: Partial<ApiConfigFormData>
}
```

### API_SOURCE_OPTIONS

```typescript
const API_SOURCE_OPTIONS = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'custom', label: '自定义' },
] as const
```

## 内置模板

| 模板 | 图标 | 说明 | API 类型 |
| --- | --- | --- | --- |
| OpenAI | 🤖 | GPT-4, GPT-3.5-Turbo 等 | openai |
| Anthropic | 🎭 | Claude 3 系列 | anthropic |
| Google Gemini | 💎 | Gemini Pro/Flash (Native) | google |
| DeepSeek | 🔍 | DeepSeek Chat & Coder | openai |
| Moonshot | 🌙 | Kimi 系列模型 | openai |
| Ollama (本地) | 🦙 | 本地部署的模型 | openai |
| SiliconFlow | 🌊 | 硅基流动 (Qwen, Yi, GLM) | openai |
| OpenRouter | 🌐 | 聚合所有主流模型 | openai |
| Groq | ⚡ | 超极速推理 | openai |
| Mistral | 🌪️ | Mistral AI 官方 API | openai |
| 自定义 | ⚙️ | 自定义 API 配置 | custom |

## 数据存储

所有配置存储在 `GlobalConfigService` 管理的全局配置中：

```typescript
interface PhoneGlobalConfig {
  customApi: {
    enabled: boolean
    config: CustomApiConfig | null
  }
  apiPresets: ApiPreset[]
  activePresetId: string | null
  // ...
}
```

## 服务依赖

### GlobalConfigService

用于配置持久化，提供以下方法：

- `getOrCreateConfig()` - 获取或创建配置
- `getApiPresets()` - 获取预设列表
- `addPreset()` - 添加预设
- `updatePreset()` - 更新预设
- `removePreset()` - 删除预设
- `setActivePreset()` - 设置激活的预设
- `enableCustomApi()` - 启用自定义 API
- `disableCustomApi()` - 禁用自定义 API

### ModelListService

用于获取 API 支持的模型列表：

```typescript
const modelListService = getModelListService()

const result = await modelListService.getModels(
  {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-...',
    source: 'openai',
  },
  {
    forceRefresh: true,
    chatModelsOnly: false,
  }
)

if (result.success) {
  console.log(result.models) // ModelInfo[]
}
```

## 路由配置

```typescript
{
  path: '/api-manager',
  name: 'ApiManagerApp',
  component: ApiManagerApp,
  meta: { title: 'API 管理', keepAlive: true }
}
```

## 使用示例

### 从设置页面跳转

```vue
<template>
  <SettingsItem
    icon="🔌"
    title="API 管理"
    subtitle="配置自定义 AI API"
    @click="router.push('/api-manager')"
  />
</template>
```

### 程序化操作

```typescript
import { useApiManager } from '@/apps/api-manager'

const { activatePreset, deactivatePreset, presets } = useApiManager()

// 激活特定预设
activatePreset(presets.value[0].id)

// 恢复默认（使用酒馆 API）
deactivatePreset()
```

### 获取模型列表

```typescript
import { useApiManager } from '@/apps/api-manager'

const { fetchModels, modelList, isLoadingModels } = useApiManager()

// 获取当前表单配置的模型列表
await fetchModels(true) // forceRefresh = true

// 使用自定义配置获取
await fetchModels(false, {
  apiUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-...',
  source: 'openai'
})
```

## 注意事项

1. **API Key 安全**：导出配置时不包含 API Key
2. **连接测试**：测试功能会发送实际请求，可能产生少量费用
3. **配置同步**：切换预设会自动更新全局 API 配置并启用自定义 API
4. **Provider 支持**：
   - 直接支持 OpenAI, Google, Anthropic 官方 API 格式
   - 其他服务（DeepSeek, Moonshot, Groq 等）通过 OpenAI Compatible 模式支持
5. **模型列表**：
   - 某些第三方代理服务可能不支持 `/models` 端点
   - Anthropic 使用预定义模型列表，无需 API Key 即可获取
   - 获取失败时可手动输入模型名称
