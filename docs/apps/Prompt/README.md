# Prompts App 文档

## 概述

提示词管理 App 是一个用于管理系统中所有 AI 提示词的集中式应用。它采用标准的三层架构设计，提供清晰的导航、高效的管理以及深度的编辑与测试能力。

目前版本已完成的核心功能：

- **提示词管理**: 创建、编辑、复制、启用/禁用提示词，支持导入/导出配置
- **提示词链**: 编排多步骤 LLM 任务流程，支持变量传递和循环执行
- **系统提示词**: 全局约束 AI 行为的提示词，支持全局和 App 级作用域
- **实时测试**: 变量替换预览和 AI 生成测试
- **App 注册**: 支持其他 App 注册自己的提示词模板

## 文档导航

- [架构设计](architecture.md): 目录结构、路由设计、三层架构
- [核心功能](features.md): 首页、列表页、详情页功能详解
- [组件说明](components.md): 共享组件 API 与用法
- [提示词链](prompt-chain.md): 多步骤 LLM 编排详解
- [系统提示词](system-prompts.md): 全局提示词管理
- [开发指南](development-guide.md): 扩展、集成与最佳实践

## 快速开始

### 目录结构

```text
src/apps/prompts/
├── PromptsApp.vue              # 主应用入口（路由容器）
├── index.ts                    # 模块导出入口
├── manifest.ts                 # 应用清单（App 注册）
├── composables/
│   └── usePromptActions.ts     # CRUD 操作逻辑复用
├── components/
│   ├── index.ts
│   ├── PromptCard.vue          # 提示词展示卡片
│   ├── PromptAddDialog.vue     # 新建对话框
│   ├── PromptEditDialog.vue    # 编辑对话框
│   └── VariableEditor.vue      # 变量定义编辑器
└── views/
    ├── index.ts
    ├── PromptsHome.vue         # 首页：导航入口
    ├── PromptsList.vue         # 列表页：提示词列表
    ├── PromptDetail.vue        # 详情页：测试与预览
    ├── ChainsList.vue          # 提示词链列表
    ├── ChainEditor.vue         # 提示词链编辑器
    ├── ChainRunner.vue         # 提示词链执行器
    └── SystemPromptsList.vue   # 系统提示词管理
```

### 开发计划

#### 已完成

- [x] **首页重构**: 统计入口 + 快捷操作 + 帮助对话框
- [x] **列表页**: Scope 机制筛选，支持 all/user/builtin/search/appId
- [x] **详情页**: 模板预览 + 变量表单 + 实时测试
- [x] **提示词链**: 表单模式编辑、执行引擎、执行监控
- [x] **可视化预览**: 流程图式展示链结构
- [x] **步骤复制**: 一键复制步骤，快速构建相似流程
- [x] **步骤循环**: 设置步骤执行次数（1-100），结果自动合并为数组
- [x] **系统提示词**: 全局和 App 级系统提示词管理
- [x] **全局对话框**: 使用统一对话框系统替代浏览器原生弹窗
- [x] **导入/导出**: JSON 格式配置导入导出

#### 待开发

- [ ] **多 Provider 支持**: 每个步骤可使用不同的 LLM
- [ ] **可视化编辑器**: 拖拽式流程图编辑
- [ ] **循环遍历**: `loop.over` 遍历数组变量
- [ ] **条件分支**: `condition` 表达式求值
- [ ] **预置模板库**: 内置常用链模板
- [ ] **版本管理**: 链的历史版本对比
- [ ] **社区分享**: 链模板市场（远期）

## 路由一览

| 路径 | 组件 | 说明 |
| :----- | :----- | :----- |
| `/prompts` | `PromptsApp` | 根容器 |
| `/prompts/` | `PromptsHome` | 首页 |
| `/prompts/list/:scope` | `PromptsList` | 列表页 |
| `/prompts/detail/:id` | `PromptDetail` | 详情页 |
| `/prompts/chains` | `ChainsList` | 链列表 |
| `/prompts/chains/:id` | `ChainEditor` | 链编辑 |
| `/prompts/chains/:id/run` | `ChainRunner` | 链执行 |
| `/prompts/system` | `SystemPromptsList` | 系统提示词 |

## 为你的 App 注册提示词

无需修改 Prompts App 的代码。只需在你的 App 中定义并注册即可：

```typescript
// src/apps/myapp/prompts.ts
import type { AppPromptDefinition } from '@/types/prompts';

export const myAppPrompts: AppPromptDefinition[] = [
  {
    scene: 'myapp.greeting',
    name: '生成问候语',
    category: 'chat',
    template: '请为 {{userName}} 生成一句 {{style}} 的问候语。',
    availableVariables: [
      { name: 'userName', type: 'string', required: true, description: '用户名' },
      { name: 'style', type: 'string', defaultValue: '友好', description: '风格' }
    ]
  }
];
```

```typescript
// src/apps/myapp/MyApp.vue
import { onMounted } from 'vue';
import { PromptService } from '@/services/promptService';
import { myAppPrompts } from './prompts';

onMounted(() => {
  PromptService.registerAppPrompts('myapp', myAppPrompts);
});
```

注册后，提示词会自动出现在 Prompts App 的「应用注册」分组中。

## 相关服务

| 服务 | 路径 | 说明 |
| :----- | :----- | :----- |
| `PromptService` | `@/services/promptService` | 提示词 CRUD 操作 |
| `PromptChainService` | `@/services/promptChainService` | 链管理服务 |
| `PromptChainExecutor` | `@/services/promptChainExecutor` | 链执行引擎 |
| `SystemPromptService` | `@/services/systemPromptService` | 系统提示词管理 |
| `AIGenerateService` | `@/services/aiGenerateService` | AI 生成服务 |
