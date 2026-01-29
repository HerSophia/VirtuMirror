# Context Sharing Service 集成设计

> **版本**: 1.0  
> **状态**: 📋 设计中  
> **最后更新**: 2025-01-08

本文档描述 Context Sharing Service 与 LLM Task Service、Prompt Service 的集成设计。

---

## 1. 概述

### 1.1 集成目标

| 服务 | 集成方式 | 目标 |
| --- | --- | --- |
| **LLM Task Service** | 扩展 ContextProvider 机制 | 支持从 Context Sharing 获取聚合上下文 |
| **Prompt Service** | 扩展变量系统 | 支持在提示词中使用共享上下文变量 |

### 1.2 设计原则

1. **向后兼容**：现有的 ContextProvider 和变量系统继续工作
2. **按需加载**：只有使用共享上下文的任务才会触发聚合
3. **类型安全**：提供完整的 TypeScript 类型定义
4. **灵活配置**：支持在任务定义中声明需要的上下文类型

---

## 2. LLM Task Service 集成

### 2.1 扩展 LLMTaskDefinition

在任务定义中新增 `sharedContextConfig` 字段：

```typescript
// src/services/llmTask/types.ts

/**
 * 共享上下文配置
 * 用于声明任务需要从 Context Sharing Service 获取的上下文
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
   * 优先级排序（优先保留的类型）
   */
  priority?: ContextType[];

  /**
   * 注入的变量名
   * @default 'sharedContext'
   */
  variableName?: string;
}

// 扩展 LLMTaskDefinition
export interface LLMTaskDefinition {
  // ... 现有字段 ...

  /**
   * 共享上下文配置
   * 如果配置了此字段，任务执行时会自动从 Context Sharing Service 聚合上下文
   */
  sharedContextConfig?: SharedContextConfig;
}
```

### 2.2 新增内置 ContextProvider

```typescript
// src/services/llmTask/builtinProviders.ts

import { contextSharingService } from '@/services/contextSharing';
import type { ContextProvider } from './types';

/**
 * 共享上下文提供器
 * 从 Context Sharing Service 获取聚合上下文
 */
export const sharedContextProvider: ContextProvider = {
  id: 'system:shared-context',
  appId: 'system',
  name: '共享上下文',
  description: '从 Context Sharing Service 聚合跨应用上下文',
  priority: 50, // 较高优先级，确保在其他提供器之前执行

  async getContext(options?: SharedContextProviderOptions): Promise<Record<string, string>> {
    // 如果没有配置，返回空对象
    if (!options?.config) {
      return {};
    }

    const { config, appId, taskId } = options;

    try {
      const aggregated = await contextSharingService.aggregate({
        requesterId: appId || 'llm-task',
        types: config.types,
        ids: config.ids,
        format: config.format || 'xml',
        maxTokens: config.maxTokens || 2000,
        priority: config.priority,
      });

      const variableName = config.variableName || 'sharedContext';

      return {
        [variableName]: aggregated.formatted || '',
        [`${variableName}Meta`]: JSON.stringify(aggregated.meta),
      };
    } catch (error) {
      console.error('[SharedContextProvider] 获取共享上下文失败:', error);
      return {
        [config.variableName || 'sharedContext']: '',
      };
    }
  },
};

export interface SharedContextProviderOptions {
  config: SharedContextConfig;
  appId?: string;
  taskId?: string;
}
```

### 2.3 扩展 TaskExecutor

在 `TaskExecutor` 中处理共享上下文配置：

```typescript
// src/services/llmTask/TaskExecutor.ts

// 在 collectContext 方法中添加共享上下文处理
private async collectContext(
  task: LLMTask,
  definition: LLMTaskDefinition
): Promise<Record<string, string>> {
  const context: Record<string, string> = {};

  // 1. 收集常规 ContextProvider 的变量
  const providerIds = definition.contextProviders || [];
  for (const providerId of providerIds) {
    const provider = this.providerRegistry.get(providerId);
    if (provider) {
      const providerContext = await provider.getContext();
      Object.assign(context, providerContext);
    }
  }

  // 2. 处理共享上下文配置（新增）
  if (definition.sharedContextConfig) {
    const sharedContext = await sharedContextProvider.getContext({
      config: definition.sharedContextConfig,
      appId: task.appId,
      taskId: task.id,
    });
    Object.assign(context, sharedContext);
  }

  // 3. 添加内置变量（时间等）
  const builtinContext = await this.getBuiltinContext();
  Object.assign(context, builtinContext);

  return context;
}
```

### 2.4 使用示例

```typescript
// 微博博文生成任务定义
const weiboPostTask: LLMTaskDefinition = {
  id: 'weibo:generate-post',
  appId: 'weibo',
  name: '生成微博帖子',
  type: 'manual',
  executionMode: 'repeatable',

  // 使用共享上下文
  sharedContextConfig: {
    types: ['narrative:content', 'social:trending'],
    format: 'xml',
    maxTokens: 1500,
    priority: ['narrative:content'], // 叙事内容优先
    variableName: 'crossAppContext',
  },

  // 提示词模板中使用共享上下文
  promptTemplate: `你是一个社交媒体内容生成助手。

以下是当前的上下文信息：
{{crossAppContext}}

请根据以上上下文，为角色 {{characterName}} 生成一条微博帖子。`,

  inputSchema: [
    { name: 'characterName', label: '角色名', type: 'string', required: true },
  ],
  defaultInput: { characterName: '' },
  outputHandlerId: 'weibo:post-handler',
};
```

---

## 3. Prompt Service 集成

### 3.1 扩展变量定义

新增共享上下文相关的变量类型：

```typescript
// src/types/prompts.ts

/**
 * 变量来源类型
 */
export type VariableSourceType =
  | 'input'           // 用户输入
  | 'global'          // 全局变量
  | 'context'         // ContextProvider
  | 'shared-context'; // Context Sharing Service

/**
 * 扩展变量定义
 */
export interface PromptVariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  defaultValue?: unknown;
  description?: string;

  /**
   * 变量来源
   */
  source?: VariableSourceType;

  /**
   * 共享上下文配置（source='shared-context' 时使用）
   */
  sharedContextConfig?: {
    /** 上下文类型 */
    contextType?: ContextType;
    /** 上下文 ID */
    contextId?: string;
    /** 格式化方式 */
    format?: 'raw' | 'text' | 'xml';
  };
}
```

### 3.2 扩展 PromptService

```typescript
// src/services/prompt/promptService.ts

import { contextSharingService } from '@/services/contextSharing';

export class PromptService {
  // ... 现有方法 ...

  /**
   * 渲染提示词（支持共享上下文变量）
   */
  async renderPromptAsync(
    template: PromptTemplate,
    variables: Record<string, unknown>,
    options?: RenderOptions
  ): Promise<RenderedPrompt> {
    // 1. 收集共享上下文变量
    const sharedVars = await this.resolveSharedContextVariables(
      template.availableVariables || []
    );

    // 2. 合并所有变量
    const allVariables = {
      ...this.getGlobalVariables(),
      ...sharedVars,
      ...variables,
    };

    // 3. 渲染模板
    return this.renderTemplate(template, allVariables);
  }

  /**
   * 解析共享上下文变量
   */
  private async resolveSharedContextVariables(
    variableDefs: PromptVariableDefinition[]
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const varDef of variableDefs) {
      if (varDef.source !== 'shared-context') continue;

      const config = varDef.sharedContextConfig;
      if (!config) continue;

      try {
        let value: unknown;

        if (config.contextId) {
          // 获取指定 ID 的上下文
          value = await contextSharingService.getAsync(config.contextId);
        } else if (config.contextType) {
          // 获取指定类型的所有上下文
          const contexts = contextSharingService.getByType(config.contextType);
          value = Array.from(contexts.values());
        }

        // 格式化
        result[varDef.name] = this.formatContextValue(value, config.format);
      } catch (error) {
        console.error(`[PromptService] 解析共享上下文变量 ${varDef.name} 失败:`, error);
        result[varDef.name] = varDef.defaultValue?.toString() || '';
      }
    }

    return result;
  }

  /**
   * 格式化上下文值
   */
  private formatContextValue(value: unknown, format?: 'raw' | 'text' | 'xml'): string {
    if (value === undefined || value === null) return '';

    switch (format) {
      case 'xml':
        return `<context>${JSON.stringify(value)}</context>`;
      case 'text':
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      case 'raw':
      default:
        return typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
}

export interface RenderOptions {
  /** 是否解析共享上下文 */
  resolveSharedContext?: boolean;
}
```

### 3.3 使用示例

```typescript
// 定义使用共享上下文的提示词
const forumPostPrompt: AppPromptDefinition = {
  scene: 'forum.generate-post',
  name: '生成论坛帖子',
  category: 'social',
  template: `请根据以下叙事内容生成论坛帖子：

{{narrativeContent}}

热门话题参考：
{{trendingTopics}}`,

  availableVariables: [
    {
      name: 'narrativeContent',
      type: 'string',
      description: '当前叙事内容',
      source: 'shared-context',
      sharedContextConfig: {
        contextId: 'narrative:current',
        format: 'text',
      },
    },
    {
      name: 'trendingTopics',
      type: 'string',
      description: '热门话题',
      source: 'shared-context',
      sharedContextConfig: {
        contextType: 'social:trending',
        format: 'xml',
      },
    },
  ],
};

// 使用异步渲染
const rendered = await promptService.renderPromptAsync(
  forumPostPrompt,
  {}, // 无需手动传入共享上下文变量
  { resolveSharedContext: true }
);
```

---

## 4. 类型定义汇总

### 4.1 Context Sharing Service 类型

```typescript
// src/services/contextSharing/types.ts

export type WellKnownContextType =
  | 'system:time'
  | 'narrative:content'
  | 'narrative:characters'
  | 'social:trending'
  | 'social:hotTopics'
  | 'chat:lastMessage'
  | 'chat:recentHistory'
  | 'user:currentAccount';

export type ContextType = WellKnownContextType | `custom:${string}`;

export interface ContextVisibility {
  level: 'public' | 'restricted' | 'private';
  allowedApps?: string[];
  excludedApps?: string[];
}

export interface CacheConfig {
  ttl: number;
  staleWhileRevalidate?: boolean;
}

export interface SharedContext<T = unknown> {
  id: string;
  type: ContextType;
  publisherId: string;
  description: string;
  value?: T;
  getter?: () => T | Promise<T>;
  visibility: ContextVisibility;
  cache?: CacheConfig;
  updatedAt: number;
}

export interface AggregationRequest {
  requesterId: string;
  types?: ContextType[];
  ids?: string[];
  format?: 'raw' | 'text' | 'xml' | 'markdown';
  maxTokens?: number;
  priority?: ContextType[];
}

export interface AggregatedContext {
  contexts: Map<ContextType, unknown[]>;
  formatted?: string;
  meta: {
    totalContexts: number;
    types: ContextType[];
    estimatedTokens?: number;
    truncated?: boolean;
  };
}
```

### 4.2 服务接口

```typescript
// src/services/contextSharing/IContextSharingService.ts

export interface IContextSharingService {
  // === 发布 ===
  publish<T>(options: PublishContextOptions<T>): string;
  unpublish(id: string): boolean;
  replace<T>(id: string, value: T): boolean;

  // === 获取 ===
  get<T>(id: string): T | undefined;
  getAsync<T>(id: string): Promise<T | undefined>;
  getByType<T>(type: ContextType): Map<string, T>;

  // === 订阅 ===
  subscribe<T>(id: string, callback: (value: T) => void): () => void;
  subscribeByType<T>(type: ContextType, callback: (contexts: Map<string, T>) => void): () => void;

  // === 聚合 ===
  aggregate(request: AggregationRequest): Promise<AggregatedContext>;

  // === 查询 ===
  getAllContexts(): SharedContext[];
  getContextsByPublisher(publisherId: string): SharedContext[];
  search(query: ContextSearchQuery): SharedContext[];
}
```

---

## 5. 实施计划

| 阶段 | 内容 | 依赖 | 预估工时 |
| --- | --- | --- | --- |
| **Phase 1** | Context Sharing Service 核心实现 | 无 | 4-5h |
| **Phase 2** | LLM Task Service 集成 | Phase 1 | 2-3h |
| **Phase 3** | Prompt Service 集成 | Phase 1 | 2h |
| **Phase 4** | 测试与文档 | Phase 2, 3 | 2h |

**总预估工时**: 10-12 小时

### 5.1 Phase 1 详细任务

1. 创建 `src/services/contextSharing/` 目录结构
2. 实现 `types.ts` 类型定义
3. 实现 `ContextSharingService.ts` 核心服务
4. 实现 `formatters.ts` 格式化工具
5. 实现 `Visibility.ts` 可见性工具
6. 创建 `index.ts` 导出入口

### 5.2 Phase 2 详细任务

1. 扩展 `LLMTaskDefinition` 类型，添加 `sharedContextConfig`
2. 实现 `sharedContextProvider` 内置提供器
3. 修改 `TaskExecutor` 支持共享上下文
4. 更新微博任务定义示例

### 5.3 Phase 3 详细任务

1. 扩展 `PromptVariableDefinition` 类型
2. 实现 `renderPromptAsync` 异步渲染方法
3. 实现共享上下文变量解析

---

## 6. 向后兼容性

### 6.1 LLM Task Service

- `contextProviders` 字段继续工作
- `sharedContextConfig` 是可选的新字段
- 两种机制可以同时使用

### 6.2 Prompt Service

- 同步 `renderPrompt` 方法保持不变
- 新增异步 `renderPromptAsync` 方法
- 现有提示词定义无需修改

---

## 7. 参考资料

- [Context Sharing Service README](./README.md)
- [LLM Task Service 文档](../llm-task-service/README.md)
- [Prompt Service 文档](../prompt-service/README.md)
