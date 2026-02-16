# 开发指南

## 为你的 App 注册提示词

### 步骤 1: 定义提示词

在你的 App 目录下创建 `prompts.ts`：

```typescript
// src/apps/myapp/prompts.ts
import type { AppPromptDefinition } from '@/types/prompts';

export const myAppPrompts: AppPromptDefinition[] = [
  {
    scene: 'myapp.greeting',           // 唯一场景标识
    name: '生成问候语',                  // 显示名称
    description: '为用户生成个性化问候',  // 可选描述
    category: 'chat',                   // 分类
    template: `请为 {{userName}} 生成一句 {{style}} 的问候语。

要求：
- 语气自然
- 不超过 50 字`,
    systemPrompt: '你是一个友好的助手。',  // 可选系统提示词
    availableVariables: [
      { 
        name: 'userName', 
        type: 'string', 
        required: true, 
        description: '用户名',
        example: '小明'
      },
      { 
        name: 'style', 
        type: 'string', 
        required: false,
        defaultValue: '友好',
        description: '问候风格'
      }
    ]
  }
];
```

### 步骤 2: 注册提示词

在 App 主组件的 `onMounted` 中注册：

```typescript
// src/apps/myapp/MyApp.vue
import { onMounted } from 'vue';
import { PromptService } from '@/services/promptService';
import { myAppPrompts } from './prompts';

onMounted(() => {
  // 注册时会自动覆盖旧版本，支持热更新
  PromptService.registerAppPrompts('myapp', myAppPrompts);
});
```

### 步骤 3: 使用提示词

```typescript
import { AIGenerateService } from '@/services/aiGenerateService';

const result = await AIGenerateService.generateWithPrompt(
  'myapp.greeting',  // 场景标识
  { userName: '小明', style: '活泼' },  // 变量值
  { appId: 'myapp', scene: 'myapp.greeting' }  // 上下文
);

console.log(result.text);  // AI 生成的问候语
```

## 注册提示词链

### 步骤 1: 定义链

```typescript
// src/apps/myapp/chains.ts
import type { PromptChain } from '@/types/promptChain';

export const myAppChains: Omit<PromptChain, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '内容创作流水线',
    description: '先构思大纲，再生成内容',
    executionMode: 'multi-step',
    enabled: true,
    source: 'app',
    appId: 'myapp',
    inputs: [
      { name: 'topic', type: 'string', required: true, description: '主题' }
    ],
    steps: [
      {
        id: 'step1',
        name: '生成大纲',
        type: 'prompt',
        promptId: 'myapp.outline',
        inputMapping: { topic: '{{topic}}' },
        outputKey: 'outline'
      },
      {
        id: 'step2',
        name: '生成内容',
        type: 'prompt',
        promptId: 'myapp.content',
        inputMapping: { 
          topic: '{{topic}}',
          outline: '{{step1.result}}'
        },
        outputKey: 'content'
      }
    ],
    outputs: {
      outline: 'step1.result',
      content: 'step2.result'
    }
  }
];
```

### 步骤 2: 注册链

```typescript
import { promptChainService } from '@/services/promptChainService';
import { myAppChains } from './chains';

onMounted(async () => {
  await promptChainService.registerAppChains('myapp', myAppChains);
});
```

## 使用叙事内容变量

当 App 需要处理来自酒馆等平台的叙事内容时：

### 标准变量

| 变量名 | 类型 | 说明 |
| :------- | :----- | :----- |
| `narrative` | string | 叙事内容（主要变量） |
| `narrativeMessageId` | number | 来源楼层号 |
| `narrativeSwipeId` | number | 来源 Swipe ID |
| `narrativeTimestamp` | number | 时间戳 |
| `isSwipeChange` | boolean | 是否由 Swipe 切换触发 |

### 使用方式

```typescript
import { narrativeService, createNarrativeVariables } from '@/services/narrativeService';
import { AIGenerateService } from '@/services/aiGenerateService';

// 订阅叙事内容
narrativeService.subscribe(async (event) => {
  // 转换为标准变量
  const variables = createNarrativeVariables(event);
  
  // 传递给提示词模板
  const result = await AIGenerateService.generateWithPrompt(
    'myapp.analyze',
    { ...variables, characterName: '角色名' },
    { appId: 'myapp', scene: 'myapp.analyze' }
  );
});
```

### 提示词模板示例

```typescript
{
  scene: 'myapp.analyze',
  template: `
分析以下故事内容：

<故事>
{{narrative}}
</故事>

请提取关键信息。
`,
  availableVariables: [
    { name: 'narrative', type: 'string', description: '叙事内容', required: true }
  ]
}
```

## 全局对话框

项目使用统一的全局对话框系统，替代浏览器原生弹窗。

### 使用方式

```typescript
import { useDialogStore } from '@/stores/dialogStore';

const dialog = useDialogStore();

// 确认对话框（替代 window.confirm）
const confirmed = await dialog.confirm({
  title: '确认删除',
  message: '确定要删除这条内容吗？',
  detail: '删除后无法恢复',
  confirmText: '删除',
  confirmType: 'danger',
  icon: 'warning'
});

// 提示对话框（替代 window.alert）
await dialog.alert({
  title: '操作成功',
  message: '数据已保存',
  icon: 'success'
});

// 输入对话框（替代 window.prompt）
const value = await dialog.input({
  title: '重命名',
  label: '新名称',
  value: oldName,
  validate: (v) => v.length < 2 ? '至少2个字符' : undefined
});
```

### 可用图标

| 图标 | 说明 | 颜色 |
| :----- | :----- | :----- |
| `warning` | 警告 | 黄色 |
| `danger` | 错误/危险 | 红色 |
| `info` | 信息 | 蓝色 |
| `success` | 成功 | 绿色 |
| `question` | 疑问 | 蓝色 |

## 最佳实践

### 1. 逻辑复用

所有涉及对提示词的增删改查操作，优先使用 `usePromptActions` hook：

```typescript
const { 
  handleToggle, 
  handleDelete, 
  handleReset, 
  handleDuplicate 
} = usePromptActions(() => loadData());
```

### 2. 状态管理

`PromptService` 是单一数据源，UI 组件不应持有提示词的副本（编辑状态除外）。操作完成后应重新拉取数据。

### 3. 权限控制

使用 `PromptService.isPromptEditable(prompt)` 检查权限：

```typescript
const permission = PromptService.isPromptEditable(prompt);

if (permission.canEdit) {
  // 显示编辑按钮
}

if (permission.editableFields.includes('template')) {
  // 模板字段可编辑
}
```

### 4. 场景命名规范

```
{app}.{功能}.{子功能}

示例:
- weibo.post.generate
- chat.reply.formal
- email.compose.business
```

### 5. 变量命名规范

- 使用 camelCase
- 描述性名称
- 提供有意义的默认值和示例

```typescript
{
  name: 'authorIdentity',
  type: 'string',
  required: false,
  defaultValue: '普通网友',
  description: '发帖人的身份设定',
  example: '知名美食博主'
}
```

### 6. 添加新的内置分类

修改 `src/types/prompts.ts` 中的 `PROMPT_CATEGORIES` 常量：

```typescript
export const PROMPT_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'chat', name: '聊天' },
  { id: 'social', name: '社交' },
  { id: 'email', name: '邮件' },
  // 添加新分类
  { id: 'creative', name: '创作' },
];
```

## 相关文档

- [Social Media Engine - 提示词链设计](../../systems/social-media-engine.md)
- [API Manager - 预设管理](../api-manager.md)
- [AI Service 文档](../../systems/ai-service.md)
