# 系统提示词

系统提示词是一种特殊的提示词，用于在所有 LLM 调用中注入全局性的约束和指令。它与普通提示词的区别在于：**系统提示词会自动注入到 AI 调用中，无需显式引用**。

## 1. 概述

### 1.1 作用

- **全局约束**: 确保 AI 始终遵循某些规则（如角色扮演、安全约束）
- **风格统一**: 保持生成内容的一致性（如语气、格式）
- **App 定制**: 为特定 App 定制 AI 行为

### 1.2 与普通提示词的区别

| 特性 | 普通提示词 | 系统提示词 |
|------|------------|------------|
| 注入方式 | 需显式调用 | 自动注入 |
| 作用范围 | 单次调用 | 全局或 App 级 |
| 内容类型 | 用户指令 | 系统约束 |
| 变量支持 | 支持 | 不支持（静态内容） |

## 2. 作用域模型

### 2.1 三级作用域

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           全局作用域 (Global)                             │
│                                                                          │
│  "你是一个角色扮演助手，请始终保持角色设定..."                               │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           App 作用域 (App)                                │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   微博 App   │  │   聊天 App   │  │   邮件 App   │                      │
│  │             │  │             │  │             │                      │
│  │ "生成内容应  │  │ "对话要自然 │  │ "邮件格式要  │                      │
│  │  符合微博    │  │  流畅..."   │  │  正式..."    │                      │
│  │  平台特点"   │  │             │  │             │                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           场景作用域 (Scene)                              │
│                                                                          │
│  来自单个 Prompt 的 systemPrompt 字段                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 作用域类型

```typescript
type SystemPromptScope = 'global' | 'app';
```

| 作用域 | 说明 | 影响范围 |
|--------|------|----------|
| `global` | 全局作用域 | 所有 LLM 调用 |
| `app` | App 作用域 | 特定 App 的调用 |

## 3. 继承模式

### 3.1 模式类型

```typescript
type SystemPromptMode = 'append' | 'override';
```

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| `append` | 追加到上层提示词之后 | 大多数情况，增量约束 |
| `override` | 覆盖上层提示词 | 需要完全不同的系统设定 |

### 3.2 组装逻辑

```text
情况 1: 全部使用 append 模式
┌────────────────────────────────────────┐
│ 最终系统提示词 =                        │
│   全局提示词 1                          │
│   + 全局提示词 2                        │
│   + App 提示词 1 (append)              │
│   + App 提示词 2 (append)              │
│   + Prompt 自带 systemPrompt           │
└────────────────────────────────────────┘

情况 2: App 提示词使用 override 模式
┌────────────────────────────────────────┐
│ 最终系统提示词 =                        │
│   App 提示词 (override)     ← 覆盖全局  │
│   + Prompt 自带 systemPrompt           │
└────────────────────────────────────────┘
```

### 3.3 优先级规则

同一作用域内，按 `priority` 字段排序（数值小的先拼接）：

```typescript
// 排序后的顺序
const sorted = prompts.sort((a, b) => a.priority - b.priority);
```

## 4. 场景匹配

### 4.1 适用场景配置

```typescript
interface PromptTemplate {
  // ...
  
  /** 适用场景列表（为空表示适用所有场景） */
  applicableScenes?: string[];
  
  /** 排除场景列表（优先级高于 applicableScenes） */
  excludeScenes?: string[];
}
```

### 4.2 通配符支持

```typescript
// 精确匹配
applicableScenes: ['weibo.post.generate']

// 前缀匹配（以 .* 结尾）
applicableScenes: ['weibo.*']  // 匹配所有 weibo 开头的场景

// 前缀匹配（以 * 结尾）
applicableScenes: ['social*']  // 匹配 social、socialMedia 等
```

### 4.3 匹配逻辑

```typescript
// SystemPromptService.isApplicableToScene() 的逻辑
function isApplicableToScene(prompt: PromptTemplate, scene?: string): boolean {
  if (!scene) return true;
  
  // 1. 检查排除场景（优先级最高）
  if (prompt.excludeScenes?.length) {
    for (const pattern of prompt.excludeScenes) {
      if (matchScenePattern(scene, pattern)) {
        return false;  // 被排除
      }
    }
  }
  
  // 2. 检查适用场景（为空表示适用所有）
  if (!prompt.applicableScenes?.length) {
    return true;
  }
  
  // 3. 匹配适用场景
  for (const pattern of prompt.applicableScenes) {
    if (matchScenePattern(scene, pattern)) {
      return true;
    }
  }
  
  return false;
}
```

## 5. API 参考

### 5.1 组装系统提示词

```typescript
import { SystemPromptService } from '@/services/systemPromptService';

const result = SystemPromptService.assemble({
  appId: 'weibo',                    // 目标 App（可选）
  scene: 'weibo.post.generate',      // 目标场景（可选）
  baseSystemPrompt: '你是一个...'     // 基础系统提示词（可选）
});

console.log(result.systemPrompt);    // 组装后的完整系统提示词
console.log(result.appliedPrompts);  // 应用的提示词列表
// [{ id: 'xxx', name: '全局约束', scope: 'global' }, ...]
```

### 5.2 获取系统提示词

```typescript
// 获取所有系统提示词
const all = SystemPromptService.getAllSystemPrompts();

// 获取全局系统提示词
const global = SystemPromptService.getGlobalSystemPrompts();

// 获取特定 App 的系统提示词
const appPrompts = SystemPromptService.getAppSystemPrompts('weibo');
```

### 5.3 创建系统提示词

```typescript
const prompt = SystemPromptService.create({
  name: '角色扮演约束',
  description: '确保 AI 始终保持角色扮演状态',
  content: `你正在进行角色扮演。
请始终以角色的身份回应，不要打破第四面墙。`,
  scope: 'global',
  mode: 'append',
  applicableScenes: [],      // 空表示适用所有场景
  excludeScenes: [],
  priority: 0
});
```

### 5.4 更新系统提示词

```typescript
SystemPromptService.update('prompt-id', {
  name: '新名称',
  content: '新内容',
  enabled: false,
  priority: 10
});
```

### 5.5 删除和切换

```typescript
// 删除
SystemPromptService.delete('prompt-id');

// 切换启用状态
SystemPromptService.toggle('prompt-id');
```

### 5.6 获取统计信息

```typescript
const stats = SystemPromptService.getStats();
// {
//   total: 5,
//   global: 2,
//   app: 3,
//   enabled: 4,
//   byApp: { weibo: 2, chat: 1 }
// }
```

### 5.7 预览组装结果

```typescript
// 用于调试
const preview = SystemPromptService.preview({
  appId: 'weibo',
  scene: 'weibo.post.generate'
});

console.log(preview.result);     // 组装结果
console.log(preview.breakdown);  // 分解详情
// [
//   { source: '[全局] 角色约束', content: '...' },
//   { source: '[App: weibo] 微博风格', content: '...' }
// ]
```

## 6. 使用示例

### 6.1 全局角色扮演约束

```typescript
SystemPromptService.create({
  name: '角色扮演基础约束',
  content: `## 角色扮演规则

你正在进行沉浸式角色扮演。请遵循以下规则：

1. **保持角色一致性**: 始终以角色的身份、语气和性格回应
2. **不打破第四面墙**: 不要提及自己是 AI 或这是虚拟场景
3. **延续故事线**: 回应应与之前的对话和设定保持连贯
4. **丰富细节**: 适当添加环境描写、情绪表达等细节`,
  scope: 'global',
  mode: 'append',
  priority: 0
});
```

### 6.2 微博 App 专用约束

```typescript
SystemPromptService.create({
  name: '微博内容风格',
  content: `## 微博内容生成规则

生成的内容应符合微博平台特点：

- 简洁有力，适合碎片化阅读
- 单条博文建议 140 字以内
- 可以使用 emoji 增加趣味性
- 话题标签使用 #话题# 格式
- 提及用户使用 @用户名 格式`,
  scope: 'app',
  appId: 'weibo',
  mode: 'append',
  applicableScenes: ['weibo.*'],
  priority: 10
});
```

### 6.3 特定场景排除

```typescript
SystemPromptService.create({
  name: '创意写作模式',
  content: '请发挥创意，不受常规约束...',
  scope: 'global',
  mode: 'append',
  excludeScenes: [
    'system.*',           // 排除系统场景
    'email.*',            // 排除邮件场景（需要正式风格）
    '*.formal'            // 排除所有正式场景
  ],
  priority: 50
});
```

### 6.4 Override 模式 - 专业翻译

```typescript
SystemPromptService.create({
  name: '专业翻译模式',
  content: `你是一个专业的翻译助手。

规则：
- 直接输出翻译结果，不添加解释
- 保持原文的格式和结构
- 专业术语使用标准翻译
- 不进行任何角色扮演`,
  scope: 'app',
  appId: 'translator',
  mode: 'override',  // 覆盖全局的角色扮演约束
  priority: 0
});
```

## 7. 与其他服务的集成

### 7.1 AIGenerateService 自动注入

`AIGenerateService.generate()` 会自动调用 `SystemPromptService.assemble()`：

```typescript
// AIGenerateService 内部逻辑（简化）
async function generate(prompt, options) {
  let systemPrompt = prompt.systemPrompt;
  
  if (!options.disableSystemPrompt) {
    const assembled = SystemPromptService.assemble({
      appId: options.appId,
      scene: options.scene,
      baseSystemPrompt: systemPrompt
    });
    systemPrompt = assembled.systemPrompt;
  }
  
  // 调用 LLM...
}
```

### 7.2 PromptChainExecutor 集成

```typescript
// 执行器配置
const executor = new PromptChainExecutor({
  appId: 'weibo',              // 指定 App ID，用于加载 App 级系统提示词
  disableSystemPrompt: false   // 是否禁用系统提示词注入
});
```

### 7.3 手动组装（高级用法）

```typescript
import { PromptService } from '@/services/promptService';
import { SystemPromptService } from '@/services/systemPromptService';
import { AIGenerateService } from '@/services/aiGenerateService';

async function advancedGenerate() {
  // 1. 获取并渲染提示词
  const template = PromptService.getPromptByScene('weibo.post.generate');
  const rendered = PromptService.renderPrompt(template, { topic: '科技' });
  
  // 2. 手动组装系统提示词
  const assembled = SystemPromptService.assemble({
    appId: 'weibo',
    scene: 'weibo.post.generate',
    baseSystemPrompt: rendered.systemPrompt
  });
  
  // 3. 调用 AI（禁用自动注入）
  const result = await AIGenerateService.generate(
    {
      userPrompt: rendered.userPrompt,
      systemPrompt: assembled.systemPrompt
    },
    { disableSystemPrompt: true }
  );
  
  return result;
}
```

## 8. 数据结构

### 8.1 系统提示词存储

系统提示词存储在 `PromptSystemConfig.templates` 中，通过以下字段标识：

```typescript
interface PromptTemplate {
  // 标识为系统提示词
  isSystemPrompt: true;
  
  // 作用域
  systemPromptScope: 'global' | 'app';
  
  // 继承模式
  systemPromptMode: 'append' | 'override';
  
  // 场景匹配
  applicableScenes?: string[];
  excludeScenes?: string[];
  
  // 内容存储在 template 字段
  template: string;  // 系统提示词内容
}
```

### 8.2 场景标识命名

系统提示词的 `scene` 字段使用特殊前缀：

```text
system.global.{timestamp}   // 全局系统提示词
system.{appId}.{timestamp}  // App 级系统提示词
```
