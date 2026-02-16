# 系统提示词 (System Prompts)

系统提示词是自动注入到所有 LLM 调用中的全局性指令，用于约束 AI 的行为和输出风格。

## 概述

系统提示词会自动注入到 LLM 调用的 system 消息中，无需在每个提示词中重复编写。

### 典型用例

- "始终使用简体中文回复"
- "保持沉浸感，不要打破第四面墙"
- "避免使用真实公众人物姓名"
- "回复要简短、口语化，适合社交媒体"

## 作用域

| 作用域 | 说明 | 示例 |
| :------- | :----- | :----- |
| `global` | 全局生效，适用于所有 LLM 调用 | "始终使用简体中文回复" |
| `app` | 仅在指定应用中生效 | 微博 App 的特定约束 |

## 继承模式（App 级）

| 模式 | 说明 |
| :----- | :----- |
| `append` | 追加到全局提示词之后 |
| `override` | 替换全局提示词 |

## 组装顺序

```
1. 全局系统提示词（按 priority 排序）
        │
        ▼
2. App 级系统提示词（如果有 appId）
   - 如果 mode = 'override'，则跳过全局提示词
        │
        ▼
3. 单个 Prompt 自带的 systemPrompt
```

## 场景过滤

可以通过 `applicableScenes` 和 `excludeScenes` 控制系统提示词的适用场景：

```typescript
{
  name: '社交媒体专用',
  content: '...',
  scope: 'global',
  applicableScenes: ['social.*', 'chat.*'],  // 仅适用于社交和聊天场景
  excludeScenes: ['system.*'],  // 排除系统场景
}
```

支持通配符 `*` 匹配。

## 管理页面

路径：`/prompts/system`

### 功能

- 查看所有系统提示词（全局 + App 级）
- 创建新系统提示词
- 编辑现有系统提示词
- 启用/禁用系统提示词
- 删除系统提示词
- 按作用域分组展示

### 统计信息

- 总数
- 全局数量
- App 级数量
- 已启用数量

## 服务 API

### SystemPromptService

```typescript
import { SystemPromptService } from '@/services/systemPromptService';

// 获取所有系统提示词
const prompts = SystemPromptService.getAllSystemPrompts();

// 获取统计信息
const stats = SystemPromptService.getStats();
// { total: 5, global: 2, app: 3, enabled: 4 }

// 创建系统提示词
SystemPromptService.create({
  name: '中文回复',
  content: '请始终使用简体中文回复用户',
  scope: 'global',
  priority: 0,
});

// 创建 App 级系统提示词
SystemPromptService.create({
  name: '微博风格',
  content: '回复要简短、口语化，适合社交媒体',
  scope: 'app',
  appId: 'weibo',
  mode: 'append',
});

// 更新系统提示词
SystemPromptService.update(id, {
  content: '新内容',
  priority: 10,
});

// 切换启用状态
SystemPromptService.toggle(id);

// 删除系统提示词
SystemPromptService.delete(id);
```

### 组装系统提示词

```typescript
const result = SystemPromptService.assemble({
  appId: 'weibo',
  scene: 'social.weibo.reply',
  baseSystemPrompt: '这是额外的提示词',
});

console.log(result.systemPrompt);
// 输出: "请始终使用简体中文回复用户\n\n回复要简短...\n\n这是额外的提示词"
```

## 自动集成

系统提示词已自动集成到以下服务：

| 服务/Store | 方法 | 说明 |
| :----- | :----- | :----- |
| `aiStore` | `generate()` | **Pinia Store（推荐）** |
| `AIGenerateService` | `generate()` | 服务层普通生成 |
| `AIGenerateService` | `generateStream()` | 服务层流式生成 |
| `PromptChainExecutor` | `execute()` | 提示词链执行 |

### aiStore 扩展参数

`aiStore.generate()` 支持以下扩展参数用于系统提示词注入：

```typescript
const result = await aiStore.generate({
  prompt: '用户提示词',
  system: '任务自带的系统提示词（可选）',
  
  // 系统提示词注入参数
  appId: 'weibo',           // App ID，用于加载 App 级系统提示词
  scene: 'social.post',      // 场景标识，用于过滤适用的系统提示词
  disableSystemPrompt: false, // 设为 true 可禁用自动注入
});
```

**注入顺序**：
```
全局系统提示词 → App 级系统提示词 → 任务自带的 system
```

### 各 App 集成示例

**微博 App (taskExecutor.ts)**：
```typescript
const result = await aiStore.generate(
  {
    prompt: rendered.userPrompt,
    system: task.systemPrompt,
    appId: 'weibo',
    scene: task.promptId,
  },
  task.priority
);
```

### 禁用自动注入

可通过 `disableSystemPrompt: true` 选项禁用：

```typescript
// 使用 aiStore
await aiStore.generate({
  prompt: '...',
  disableSystemPrompt: true,
});

// 使用 AIGenerateService
await AIGenerateService.generate('...', {
  disableSystemPrompt: true,
});
```

## 内置叙事理解提示词

系统内置了一套叙事理解系统提示词，帮助 LLM 正确理解来自酒馆的内容：

| 提示词 | 作用域 | 说明 |
| :------- | :------- | :----- |
| 叙事内容理解（全局） | global | 通用指导，默认开启 |
| 叙事内容理解（微博） | app:weibo | 社交媒体信息提取 |
| 叙事内容理解（聊天） | app:chat | 对话内容提取 |
| 叙事内容理解（邮件） | app:email | 邮件信息提取 |
| 叙事内容理解（直播） | app:live | 直播互动信息提取 |

这些提示词：
- 默认开启，开箱即用
- 用户可在系统提示词页面查看、修改或禁用
- 按 App 细分，便于针对性调优

## 类型定义

系统提示词相关字段定义在 `PromptTemplate` 中：

```typescript
interface PromptTemplate {
  // ... 基础字段
  
  // 系统提示词专用字段
  isSystemPrompt?: boolean;           // 是否是系统提示词
  systemPromptScope?: 'global' | 'app';  // 作用域
  systemPromptMode?: 'append' | 'override';  // 继承模式
  applicableScenes?: string[];        // 适用场景
  excludeScenes?: string[];           // 排除场景
}
```
