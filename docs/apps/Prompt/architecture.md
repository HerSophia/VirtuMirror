# 架构设计

## 三层架构

```
┌─────────────────────────────────────────┐
│           Views（视图层）                 │
│  PromptsHome / PromptsList / ...        │
├─────────────────────────────────────────┤
│         Components（组件层）              │
│  PromptCard / PromptEditDialog / ...    │
├─────────────────────────────────────────┤
│         Composables（逻辑层）             │
│  usePromptActions                       │
├─────────────────────────────────────────┤
│          Services（服务层）               │
│  PromptService / PromptChainService     │
└─────────────────────────────────────────┘
```

## 目录结构

```text
src/apps/prompts/
├── PromptsApp.vue              # 主布局容器
├── index.ts                    # 模块导出
├── manifest.ts                 # 应用注册
├── composables/
│   └── usePromptActions.ts     # CRUD 逻辑
├── components/
│   ├── index.ts
│   ├── PromptCard.vue
│   ├── PromptAddDialog.vue
│   ├── PromptEditDialog.vue
│   └── VariableEditor.vue
└── views/
    ├── index.ts
    ├── PromptsHome.vue
    ├── PromptsList.vue
    ├── PromptDetail.vue
    ├── ChainsList.vue
    ├── ChainEditor.vue
    ├── ChainRunner.vue
    └── SystemPromptsList.vue
```

## 路由设计

采用嵌套路由结构，首页支持 `keepAlive` 缓存。

| 路径 | 组件 | 说明 |
|:-----|:-----|:-----|
| `/prompts` | `PromptsApp` | 根容器 |
| `/prompts/` | `PromptsHome` | 首页（Level 1） |
| `/prompts/list/:scope` | `PromptsList` | 列表页（Level 2） |
| `/prompts/detail/:id` | `PromptDetail` | 详情页（Level 3） |
| `/prompts/chains` | `ChainsList` | 链列表 |
| `/prompts/chains/:id` | `ChainEditor` | 链编辑器 |
| `/prompts/chains/:id/run` | `ChainRunner` | 链执行监控 |
| `/prompts/system` | `SystemPromptsList` | 系统提示词 |

### Scope 参数

`/prompts/list/:scope` 中的 `scope` 支持以下值：

| 值 | 说明 |
|:---|:-----|
| `all` | 显示所有提示词 |
| `user` | 仅用户创建的提示词 |
| `builtin` | 仅系统内置提示词 |
| `search` | 搜索结果（配合 `?q=关键词`） |
| `{appId}` | 特定 App 注册的提示词（如 `weibo`） |

### URL 查询参数

| 参数 | 说明 |
|:-----|:-----|
| `?action=add` | 在 `user` scope 下自动打开新建对话框 |
| `?q=keyword` | 在 `search` scope 下指定搜索关键词 |

## 主布局容器

`PromptsApp.vue` 仅作为路由容器，使用 `keep-alive` 缓存首页：

```vue
<template>
  <div class="prompts-app-layout">
    <router-view v-slot="{ Component }">
      <keep-alive include="PromptsHome">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>
```

## 应用注册

`manifest.ts` 将应用注册到全局注册表：

```typescript
import { registerApp } from '@/services/appRegistryService';

export function registerPromptsApp() {
  registerApp({
    id: 'prompts',
    name: '提示词',
    route: '/prompts',
    category: 'productivity',
    isBuiltin: true,
    desktop: {
      show: true,
      position: 'auto'
    },
    quickActions: [
      {
        id: 'prompts-create',
        label: '新建提示词',
        icon: 'fa-plus',
        route: '/prompts/list/user?action=create'
      },
      {
        id: 'prompts-search',
        label: '搜索提示词',
        icon: 'fa-search',
        route: '/prompts/list/search'
      },
    ],
  }, { override: true });
}
```

## 数据流

```
┌──────────────────────────────────────────────────────────┐
│                       用户操作                            │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                   Views / Components                      │
│  - 调用 usePromptActions hooks                           │
│  - 调用 PromptService / PromptChainService 方法          │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                       Services                            │
│  - PromptService: 管理提示词数据                          │
│  - PromptChainService: 管理链数据                         │
│  - PromptChainExecutor: 执行链                            │
│  - SystemPromptService: 管理系统提示词                     │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    IndexedDB / LocalStorage               │
│  - prompts 表: 用户创建的提示词                           │
│  - promptChains 表: 提示词链                              │
└──────────────────────────────────────────────────────────┘
```

## 相关类型定义

核心类型定义在 `src/types/prompts.ts` 和 `src/types/promptChain.ts`：

```typescript
// 提示词模板
interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: PromptCategory;
  scene: string;              // 唯一场景标识
  template: string;           // 用户提示词模板
  systemPrompt?: string;      // 可选的系统提示词
  availableVariables: PromptVariable[];
  enabled: boolean;
  priority: number;
  version: string;
  source: PromptSource;       // builtin / user / app
  createdAt: string;
  updatedAt: string;
}

// 提示词链
interface PromptChain {
  id: string;
  name: string;
  description: string;
  inputs: ChainVariableDefinition[];
  steps: ChainStep[];
  outputs: Record<string, string>;
  executionMode: 'multi-step' | 'single-shot';
  enabled: boolean;
  source: 'builtin' | 'user' | 'imported' | 'app';
  appId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```
