# 集成指南

本文档介绍如何在 App 中集成和使用提示词服务。

## 1. App 注册提示词

### 1.1 定义提示词

在 App 目录下创建 `prompts.ts` 文件：

```typescript
// src/apps/myapp/prompts.ts
import type { AppPromptDefinition } from '@/types/prompts';

export const myAppPrompts: AppPromptDefinition[] = [
  {
    scene: 'myapp.greeting',
    name: '生成问候语',
    description: '根据用户信息生成个性化问候语',
    category: 'chat',
    template: `请为用户 {{userName}} 生成一句{{style}}风格的问候语。

用户背景：{{background}}

要求：
- 简洁友好
- 符合角色设定`,
    systemPrompt: '你是一个善于社交的 AI 助手。',
    availableVariables: [
      {
        name: 'userName',
        type: 'string',
        required: true,
        description: '用户名称'
      },
      {
        name: 'style',
        type: 'string',
        required: false,
        defaultValue: '友好',
        description: '问候风格',
        example: '幽默/正式/热情'
      },
      {
        name: 'background',
        type: 'string',
        required: false,
        defaultValue: '普通用户',
        description: '用户背景信息'
      }
    ],
    priority: 0
  },
  {
    scene: 'myapp.summary',
    name: '内容摘要',
    category: 'system',
    template: '请为以下内容生成一个简洁的摘要：\n\n{{content}}',
    availableVariables: [
      {
        name: 'content',
        type: 'string',
        required: true,
        description: '需要摘要的内容'
      }
    ]
  }
];
```

### 1.2 注册提示词

在 App 主组件中注册：

```vue
<!-- src/apps/myapp/MyApp.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { PromptService } from '@/services/promptService';
import { myAppPrompts } from './prompts';

const APP_ID = 'myapp';

onMounted(() => {
  // 注册提示词
  PromptService.registerAppPrompts(APP_ID, myAppPrompts);
});

onUnmounted(() => {
  // 可选：卸载时注销
  // PromptService.unregisterAppPrompts(APP_ID);
});
</script>
```

### 1.3 注册效果

注册后：

- 提示词会出现在 Prompts App 的「应用注册」分组中
- 可以通过 `PromptService.getPromptByScene('myapp.greeting')` 获取
- 用户可以在 Prompts App 中启用/禁用，但不能修改模板内容

## 2. 使用提示词生成内容

### 2.1 基本用法

```typescript
import { PromptService } from '@/services/promptService';
import { AIGenerateService } from '@/services/aiGenerateService';

async function generateGreeting(userName: string, style: string) {
  // 1. 获取提示词模板
  const template = PromptService.getPromptByScene('myapp.greeting');
  
  if (!template) {
    throw new Error('提示词模板不存在');
  }
  
  if (!template.enabled) {
    throw new Error('提示词已被禁用');
  }
  
  // 2. 渲染提示词（变量替换）
  const rendered = PromptService.renderPrompt(template, {
    userName,
    style,
    background: '新用户，首次登录'
  });
  
  // 3. 调用 AI 生成
  const result = await AIGenerateService.generate({
    userPrompt: rendered.userPrompt,
    systemPrompt: rendered.systemPrompt
  });
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return result.text;
}
```

### 2.2 使用 SystemPromptService 组装系统提示词

```typescript
import { PromptService } from '@/services/promptService';
import { SystemPromptService } from '@/services/systemPromptService';
import { AIGenerateService } from '@/services/aiGenerateService';

async function generateWithSystemPrompt(scene: string, variables: Record<string, unknown>) {
  const template = PromptService.getPromptByScene(scene);
  if (!template) return null;
  
  const rendered = PromptService.renderPrompt(template, variables);
  
  // 组装系统提示词（包含全局 + App 级）
  const assembled = SystemPromptService.assemble({
    appId: 'myapp',
    scene,
    baseSystemPrompt: rendered.systemPrompt
  });
  
  const result = await AIGenerateService.generate({
    userPrompt: rendered.userPrompt,
    systemPrompt: assembled.systemPrompt
  }, {
    disableSystemPrompt: true  // 已手动组装，禁用自动注入
  });
  
  return result;
}
```

### 2.3 批量获取提示词

```typescript
// 获取 App 的所有提示词
const myPrompts = PromptService.getPromptsByApp('myapp');

// 获取特定分类的提示词
const chatPrompts = PromptService.getPromptsByCategory('chat');

// 搜索提示词
const results = PromptService.searchPrompts('问候');
```

## 3. 注册提示词链

### 3.1 定义链

```typescript
// src/apps/myapp/chains.ts
import type { AppChainDefinition } from '@/services/promptChainService';

export const myAppChains: AppChainDefinition[] = [
  {
    name: '内容生成流水线',
    description: '先生成大纲，再逐段展开',
    executionMode: 'multi-step',
    inputs: [
      {
        name: 'topic',
        type: 'string',
        required: true,
        description: '主题'
      }
    ],
    steps: [
      {
        id: 'outline',
        name: '生成大纲',
        type: 'prompt',
        inlineTemplate: '请为主题「{{topic}}」生成一个包含3个要点的大纲，以 JSON 数组格式返回。',
        inputMapping: {
          topic: 'topic'
        },
        outputKey: 'outline',
        postProcess: {
          parseAs: 'json'
        }
      },
      {
        id: 'expand',
        name: '展开内容',
        type: 'prompt',
        inlineTemplate: '请根据大纲展开详细内容：\n{{outline}}',
        inputMapping: {
          outline: 'outline'
        },
        outputKey: 'content'
      }
    ],
    outputs: {
      outline: 'outline',
      content: 'content'
    },
    enabled: true,
    version: '1.0.0'
  }
];
```

### 3.2 注册链

```typescript
import { promptChainService } from '@/services/promptChainService';
import { myAppChains } from './chains';

// 注册
promptChainService.registerAppChains('myapp', myAppChains);

// 注销
promptChainService.unregisterAppChains('myapp');
```

### 3.3 执行链

```typescript
import { promptChainService, promptChainExecutor } from '@/services';

async function runChain() {
  // 获取链
  const chain = await promptChainService.getChainById('chain.myapp.content-pipeline.0');
  if (!chain) return;
  
  // 执行
  const result = await promptChainExecutor.execute(
    chain,
    { topic: '人工智能的发展趋势' },
    (event) => {
      switch (event.type) {
        case 'start':
          console.log('开始执行');
          break;
        case 'step-start':
          console.log(`步骤 ${event.stepIndex + 1} 开始`);
          break;
        case 'step-complete':
          console.log(`步骤 ${event.stepIndex + 1} 完成`);
          break;
        case 'complete':
          console.log('执行完成');
          break;
        case 'error':
          console.error('执行出错:', event.error);
          break;
      }
    }
  );
  
  console.log('输出:', result.outputs);
  console.log('Token 用量:', result.totalUsage);
  console.log('耗时:', result.totalDuration, 'ms');
}
```

## 4. 创建系统提示词

### 4.1 全局系统提示词

```typescript
import { SystemPromptService } from '@/services/systemPromptService';

// 创建全局系统提示词
SystemPromptService.create({
  name: '角色扮演约束',
  description: '确保 AI 始终保持角色扮演状态',
  content: `你正在进行角色扮演。
请始终以角色的身份回应，不要打破第四面墙。
保持角色的性格特点和说话方式一致。`,
  scope: 'global',
  mode: 'append',
  priority: 0
});
```

### 4.2 App 级系统提示词

```typescript
// 创建 App 级系统提示词
SystemPromptService.create({
  name: '微博风格约束',
  description: '生成内容符合微博平台特点',
  content: `生成的内容应符合微博平台特点：
- 简洁有力，适合碎片化阅读
- 可以使用表情符号增加趣味性
- 注意字数限制（140字以内为佳）`,
  scope: 'app',
  appId: 'weibo',
  mode: 'append',
  applicableScenes: ['weibo.*'],  // 仅适用于 weibo 开头的场景
  priority: 10
});
```

### 4.3 Override 模式

```typescript
// 使用 override 模式覆盖上层系统提示词
SystemPromptService.create({
  name: '专业翻译模式',
  content: '你是一个专业的翻译助手。请直接翻译内容，不要添加任何解释或评论。',
  scope: 'app',
  appId: 'translator',
  mode: 'override',  // 覆盖全局系统提示词
  priority: 0
});
```

## 5. 变量表达式

### 5.1 模板变量语法

提示词模板支持 `{{varName}}` 语法：

```text
请为 {{userName}} 生成一份 {{docType}} 文档。

要求：
- 风格：{{style}}
- 长度：{{length}} 字左右
```

### 5.2 链步骤表达式

链步骤的 `inputMapping` 支持更复杂的表达式：

```typescript
const step: ChainStep = {
  id: 'step2',
  name: '处理结果',
  type: 'prompt',
  inputMapping: {
    // 直接引用输入
    topic: 'topic',
    
    // 引用上一步输出
    outline: 'outline',
    
    // 访问嵌套属性
    title: 'step1.result.title',
    
    // 访问数组元素
    firstItem: 'items[0]',
    
    // 字面量
    prefix: '"[摘要]"',
    count: '5',
    enabled: 'true'
  },
  outputKey: 'result'
};
```

### 5.3 条件表达式

```typescript
const step: ChainStep = {
  id: 'optional',
  name: '可选步骤',
  type: 'prompt',
  // 条件表达式（返回 false 则跳过）
  condition: 'includeDetails',  // truthy 判断
  // condition: '!skipThis',    // 否定
  // condition: 'count > 0',    // 比较
  // condition: 'type === "full"',  // 相等
  inlineTemplate: '...',
  inputMapping: {},
  outputKey: 'details'
};
```

## 6. 错误处理

### 6.1 提示词不存在

```typescript
const template = PromptService.getPromptByScene('unknown.scene');
if (!template) {
  // 使用备用提示词或抛出错误
  console.warn('提示词不存在，使用默认模板');
}
```

### 6.2 链执行错误

```typescript
const result = await promptChainExecutor.execute(chain, inputs);

if (result.status === 'failed') {
  console.error('链执行失败:', result.error);
  
  // 检查具体哪个步骤失败
  for (const stepResult of result.stepResults) {
    if (stepResult.status === 'failed') {
      console.error(`步骤 ${stepResult.stepId} 失败:`, stepResult.error);
    }
  }
}
```

### 6.3 中止执行

```typescript
let currentExecutionId: string | null = null;

// 开始执行
const resultPromise = promptChainExecutor.execute(
  chain,
  inputs,
  (event) => {
    if (event.type === 'start') {
      currentExecutionId = event.executionId;
    }
  }
);

// 用户点击取消
function onCancel() {
  if (currentExecutionId) {
    promptChainExecutor.abort(currentExecutionId);
  }
}

// 检查结果
const result = await resultPromise;
if (result.status === 'aborted') {
  console.log('执行已被用户取消');
}
```

## 7. 最佳实践

### 7.1 提示词命名规范

```text
场景标识格式：{appId}.{module}.{action}

示例：
- weibo.post.generate      ✓ 清晰的层级结构
- weibo.comment.reply      ✓
- generatePost             ✗ 缺少 App 前缀
- weibo-post-gen           ✗ 使用了连字符
```

### 7.2 变量设计

```typescript
// ✓ 好的变量设计
{
  name: 'maxLength',
  type: 'number',
  required: false,
  defaultValue: 200,
  description: '生成内容的最大字数',
  example: 500
}

// ✗ 避免的设计
{
  name: 'x',           // 名称不清晰
  type: 'string',
  required: true,      // 应该提供默认值
  description: ''      // 缺少描述
}
```

### 7.3 提示词模板编写

```text
✓ 好的模板：
- 结构清晰，使用分隔线或标题
- 明确说明输出格式要求
- 提供示例（few-shot）
- 合理使用变量

✗ 避免：
- 过长的模板（考虑拆分为链）
- 硬编码可变内容
- 模糊的指令
```

### 7.4 链设计原则

1. **单一职责**: 每个步骤只做一件事
2. **明确输出**: 每个步骤都应有清晰的输出格式
3. **错误处理**: 为关键步骤设置 `onError` 策略
4. **循环限制**: 设置合理的 `maxIterations` 防止无限循环
5. **调试友好**: 使用有意义的步骤名称和描述
