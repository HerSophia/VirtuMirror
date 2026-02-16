# 架构设计

## 1. 分层架构

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           视图层 (Views)                                  │
│  PromptsHome / PromptsList / PromptDetail / ChainEditor / ChainRunner   │
├─────────────────────────────────────────────────────────────────────────┤
│                           组件层 (Components)                             │
│  PromptCard / PromptEditDialog / VariableEditor / ChainStepCard         │
├─────────────────────────────────────────────────────────────────────────┤
│                           逻辑层 (Composables)                            │
│  usePromptActions / useChainExecution                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                           服务层 (Services)                               │
│  PromptService / SystemPromptService / PromptChainService / Executor    │
├─────────────────────────────────────────────────────────────────────────┤
│                           存储层 (Storage)                                │
│  localStorage (prompts) / IndexedDB (chains, history)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. 数据流

### 2.1 提示词渲染流程

```text
                    ┌─────────────┐
                    │  App 调用   │
                    └──────┬──────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ PromptService       │
                │ .getPromptByScene() │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ PromptService       │
                │ .renderPrompt()     │
                │                     │
                │ 1. 合并全局变量      │
                │ 2. 替换 {{var}}     │
                │ 3. 返回渲染结果      │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ SystemPromptService │
                │ .assemble()         │
                │                     │
                │ 1. 收集全局系统提示词 │
                │ 2. 收集 App 级提示词  │
                │ 3. 处理 override    │
                │ 4. 拼接最终结果      │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ AIGenerateService   │
                │ .generate()         │
                └─────────────────────┘
```

### 2.2 提示词链执行流程

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                           执行开始                                         │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PromptChainExecutor.execute(chain, inputs, callback)                    │
│                                                                          │
│  1. 生成 executionId                                                     │
│  2. 初始化执行上下文 (ChainExecutionContext)                               │
│  3. 发送 'start' 事件                                                     │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│    多步模式 (multi-step) │         │   单次模式 (single-shot) │
│                         │         │                         │
│  for each step:         │         │  1. 组装复合提示词        │
│   1. 检查条件            │         │  2. 单次调用 LLM         │
│   2. 解析输入变量        │         │  3. 解析 JSON 响应        │
│   3. 渲染提示词          │         │  4. 映射到各输出键        │
│   4. 调用 AI 生成        │         │                         │
│   5. 后处理输出          │         │                         │
│   6. 存入上下文变量      │         │                         │
│   7. 发送步骤事件        │         │                         │
└────────────┬────────────┘         └────────────┬────────────┘
             │                                    │
             └─────────────────┬──────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  完成处理                                                                  │
│                                                                          │
│  1. 计算最终输出 (outputs mapping)                                         │
│  2. 保存执行历史                                                           │
│  3. 发送 'complete' 事件                                                   │
│  4. 返回 ChainExecutionResult                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. 核心数据结构

### 3.1 提示词模板 (PromptTemplate)

```typescript
interface PromptTemplate {
  // === 基本信息 ===
  id: string;                    // 唯一标识符
  name: string;                  // 显示名称
  description?: string;          // 描述
  category: PromptCategory;      // 分类
  scene: string;                 // 场景标识 (如 'weibo.post.generate')
  icon?: NotificationIcon;       // 图标
  
  // === 模板内容 ===
  template: string;              // 用户提示词模板，支持 {{var}} 语法
  systemPrompt?: string;         // 可选的系统提示词
  availableVariables: PromptVariable[];  // 可用变量定义
  
  // === 来源与权限 ===
  source: PromptSource;          // 来源：builtin | app | user
  isBuiltin: boolean;            // 是否内置 (deprecated)
  
  // === 状态 ===
  enabled: boolean;              // 是否启用
  priority: number;              // 优先级（同场景多模板时）
  version: string;               // 版本号
  
  // === 时间戳 ===
  createdAt: string;
  updatedAt: string;
  
  // === 系统提示词专用 ===
  isSystemPrompt?: boolean;      // 是否为系统提示词
  systemPromptScope?: 'global' | 'app';  // 作用域
  systemPromptMode?: 'append' | 'override';  // 继承模式
  applicableScenes?: string[];   // 适用场景（支持通配符）
  excludeScenes?: string[];      // 排除场景
}
```

### 3.2 提示词变量 (PromptVariable)

```typescript
interface PromptVariable {
  name: string;           // 变量名
  description: string;    // 描述
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;      // 是否必填
  defaultValue?: unknown; // 默认值
  example?: unknown;      // 示例值
}
```

### 3.3 提示词来源 (PromptSource)

```typescript
type PromptSource =
  | { type: 'builtin' }            // 系统内置
  | { type: 'app'; appId: string } // 来自 App
  | { type: 'user' };              // 用户自定义
```

### 3.4 提示词链 (PromptChain)

```typescript
interface PromptChain {
  // === 基本信息 ===
  id: string;
  name: string;
  description: string;
  icon?: string;
  tags?: string[];
  appId?: string;              // 所属 App
  
  // === 执行配置 ===
  executionMode: 'multi-step' | 'single-shot';
  defaultPresetId?: string;    // 默认 LLM Provider
  trigger?: ChainTrigger;      // 触发方式
  
  // === 输入输出 ===
  inputs: ChainVariableDefinition[];  // 输入变量定义
  steps: ChainStep[];                 // 步骤列表
  outputs: Record<string, string>;    // 输出映射
  
  // === 单次模式配置 ===
  singleShotConfig?: SingleShotConfig;
  
  // === 元数据 ===
  source: 'builtin' | 'user' | 'imported' | 'app';
  version: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 3.5 链步骤 (ChainStep)

```typescript
interface ChainStep {
  id: string;                    // 步骤 ID
  name: string;                  // 步骤名称
  type: 'prompt' | 'transform';  // 步骤类型
  description?: string;
  
  // === Prompt 步骤 ===
  promptId?: string;             // 关联的提示词 ID
  inlineTemplate?: string;       // 或使用内联模板
  systemPrompt?: string;         // 覆盖系统提示词
  
  // === 变量映射 ===
  inputMapping: Record<string, string>;  // { 变量名: 表达式 }
  outputKey: string;                     // 输出存储键
  
  // === 后处理 ===
  postProcess?: {
    parseAs: 'json' | 'text' | 'lines' | 'regex';
    extract?: string;            // JSONPath 或正则
    defaultValue?: unknown;
  };
  
  // === Provider 配置 ===
  provider?: {
    presetId?: string;
    overrides?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  };
  
  // === 控制流 ===
  loop?: LoopConfig;             // 循环配置
  condition?: string;            // 条件表达式
  onError?: 'fail' | 'skip' | 'retry';
  retryCount?: number;
}
```

## 4. 存储设计

### 4.1 提示词存储

**存储位置**: localStorage / 酒馆变量系统

**存储键**: `小手机_prompts`

**存储结构**:

```typescript
interface PromptSystemConfig {
  templates: PromptTemplate[];           // 所有提示词模板
  globalVariables: Record<string, unknown>;  // 全局变量
  _meta: {
    version: string;
    lastUpdated: string;
  };
}
```

**环境适配**:

| 环境 | 存储方式 |
| ------ | ---------- |
| 开发环境 | localStorage |
| 生产环境 | 酒馆变量系统 (`getVariables` / `insertOrAssignVariables`) |

### 4.2 提示词链存储

**存储位置**: IndexedDB (`promptChains` 表)

**表结构**:

```typescript
// Dexie schema
db.version(1).stores({
  promptChains: 'id, name, source, enabled, *tags',
  chainExecutionHistory: 'executionId, chainId, executedAt'
});
```

### 4.3 执行历史存储

**存储位置**: IndexedDB (`chainExecutionHistory` 表)

```typescript
interface ChainExecutionHistory {
  executionId: string;
  chainId: string;
  chainName: string;
  status: ChainExecutionStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  totalDuration: number;
  executedAt: number;
  error?: string;
}
```

## 5. 权限模型

### 5.1 来源与权限映射

| 来源 | 可编辑字段 | 可删除 | 说明 |
| ------ | ------------ | -------- | ------ |
| `builtin` | `enabled`, `priority` | ❌ | 系统内置，核心逻辑不可改 |
| `app` | `enabled`, `priority` | ❌ | App 注册，由 App 管理 |
| `user` | 全部 (`*`) | ✅ | 用户完全控制 |

### 5.2 权限检查

```typescript
const permission = PromptService.isPromptEditable(prompt);
// 返回:
interface PromptEditPermission {
  canEdit: boolean;
  editableFields: string[];  // ['enabled', 'priority'] 或 ['*']
  canDelete: boolean;
}
```

## 6. 分类体系

### 6.1 内置分类

| 分类 | ID | 说明 |
| ------ | ---- | ----- |
| 全部 | `all` | 所有提示词 |
| 聊天 | `chat` | 聊天消息生成 |
| 社交 | `social` | 社交媒体内容 |
| 邮件 | `email` | 邮件内容生成 |
| 浏览器 | `browser` | 网页内容生成 |
| 直播 | `live` | 直播弹幕/评论 |
| 系统 | `system` | 系统级提示词 |

### 6.2 场景标识命名规范

```text
{app}.{module}.{action}

示例:
- weibo.post.generate      // 微博博文生成
- weibo.comment.reply      // 微博评论回复
- chat.message.reply       // 聊天消息回复
- system.global.constraint // 全局约束
```

## 7. 文件结构

### 7.1 服务层

```text
src/services/
├── promptService.ts          # 提示词管理服务
├── systemPromptService.ts    # 系统提示词服务
├── promptChainService.ts     # 提示词链管理服务
├── promptChainExecutor.ts    # 链执行引擎
└── aiGenerateService.ts      # AI 生成服务
```

### 7.2 类型定义

```text
src/types/
├── prompts.ts                # 提示词类型定义
└── promptChain.ts            # 提示词链类型定义
```

### 7.3 Prompts App

```text
src/apps/prompts/
├── PromptsApp.vue            # 主应用入口
├── index.ts                  # 模块导出
├── manifest.ts               # 应用注册
├── composables/
│   └── usePromptActions.ts   # CRUD 逻辑复用
├── components/
│   ├── PromptCard.vue        # 提示词卡片
│   ├── PromptAddDialog.vue   # 新建对话框
│   ├── PromptEditDialog.vue  # 编辑对话框
│   └── VariableEditor.vue    # 变量编辑器
└── views/
    ├── PromptsHome.vue       # 首页
    ├── PromptsList.vue       # 列表页
    ├── PromptDetail.vue      # 详情页
    ├── ChainsList.vue        # 链列表
    ├── ChainEditor.vue       # 链编辑器
    ├── ChainRunner.vue       # 链执行器
    └── SystemPromptsList.vue # 系统提示词管理
```
