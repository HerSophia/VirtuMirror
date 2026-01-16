# 内置叙事理解提示词

> 本文档说明系统内置的叙事理解提示词及其管理方式。

## 1. 概述

叙事服务提供了一套内置的系统提示词，帮助 LLM 正确理解来自酒馆等平台的叙事内容。

**设计原则**：

1. **默认开启**：开箱即用
2. **提供通用指导**：不过度约束
3. **按 App 细分**：便于针对性调优
4. **可定制**：用户/开发者可覆盖或扩展

## 2. 内置提示词列表

| 提示词名称 | 作用域 | 优先级 | 说明 |
|------------|--------|--------|------|
| 叙事内容理解（全局） | global | 10 | 通用指导，适用于所有场景 |
| 叙事内容理解（微博） | app:weibo | 20 | 社交媒体信息提取 |
| 叙事内容理解（聊天） | app:chat | 20 | 对话内容提取 |
| 叙事内容理解（邮件） | app:email | 20 | 邮件信息提取 |
| 叙事内容理解（直播） | app:live | 20 | 直播互动信息提取 |

## 3. 提示词内容

### 3.1 全局叙事理解提示词

```typescript
{
  name: '叙事内容理解（全局）',
  description: '帮助 AI 理解来自角色扮演/互动小说的叙事内容',
  content: `你正在处理一段来自角色扮演/互动小说的叙事内容。请注意：

1. 这些内容描述的是虚构故事中的事件，需要从故事视角去理解
2. 对于以下叙事内容仅做参考，需结合实际情境和过往内容去分析并给出合理结果
3. 提取信息时要保持与故事风格和角色设定一致
4. 如果叙事中没有明确提及某些信息，应基于合理推断而非凭空捏造`,
  scope: 'global',
  applicableScenes: ['social.*', 'chat.*', 'email.*', 'live.*'],
  priority: 10,
}
```

**作用**：

- 让 LLM 理解这是虚构故事内容
- 引导 LLM 从故事视角分析
- 强调保持角色设定一致性
- 避免凭空捏造信息

### 3.2 微博 App 提示词

```typescript
{
  name: '叙事内容理解（微博）',
  description: '帮助 AI 从叙事内容中提取社交媒体相关信息',
  content: `在处理叙事内容时，请特别关注以下社交媒体相关的信息：

1. 角色是否发布了微博/动态/帖子
2. 发布的内容、配图描述、发布时间
3. 角色的情绪状态和发帖动机
4. 与其他角色的互动（评论、转发、点赞）

提取信息时：
- 保持角色的说话风格和人设
- 如果叙事中提到"发了微博"但没有具体内容，需要根据情境合理推断
- 注意区分角色的公开发言和私下想法`,
  scope: 'app',
  appId: 'weibo',
  mode: 'append',
  applicableScenes: ['social.weibo.*'],
  priority: 20,
}
```

**关注点**：

- 社交媒体发布行为
- 发布内容和配图
- 角色情绪和动机
- 互动行为（评论、转发、点赞）

### 3.3 聊天 App 提示词

```typescript
{
  name: '叙事内容理解（聊天）',
  description: '帮助 AI 从叙事内容中提取私聊/群聊相关信息',
  content: `在处理叙事内容时，请特别关注以下聊天相关的信息：

1. 角色之间的对话内容
2. 消息的发送者、接收者、时间
3. 对话的语气和情感色彩
4. 是否有未读消息或等待回复的情况

生成聊天内容时：
- 保持角色的说话习惯和口癖
- 聊天消息应该简短、口语化
- 注意上下文的连贯性`,
  scope: 'app',
  appId: 'chat',
  mode: 'append',
  applicableScenes: ['chat.*'],
  priority: 20,
}
```

### 3.4 邮件 App 提示词

```typescript
{
  name: '叙事内容理解（邮件）',
  description: '帮助 AI 从叙事内容中提取邮件相关信息',
  content: `在处理叙事内容时，请特别关注以下邮件相关的信息：

1. 是否提到收发邮件
2. 邮件的发件人、收件人、主题
3. 邮件的正式程度和语气
4. 是否有附件或需要回复的事项

生成邮件内容时：
- 根据发件人身份调整正式程度
- 邮件格式应规范（称呼、正文、落款）
- 注意邮件与叙事时间线的一致性`,
  scope: 'app',
  appId: 'email',
  mode: 'append',
  applicableScenes: ['email.*'],
  priority: 20,
}
```

### 3.5 直播 App 提示词

```typescript
{
  name: '叙事内容理解（直播）',
  description: '帮助 AI 从叙事内容中提取直播相关信息',
  content: `在处理叙事内容时，请特别关注以下直播相关的信息：

1. 是否提到直播活动
2. 直播的内容、主播、观众互动
3. 弹幕和礼物的情况
4. 直播间的氛围和热度

生成直播相关内容时：
- 弹幕应该简短、即时
- 保持直播间的热闹氛围
- 注意不同观众的发言风格差异`,
  scope: 'app',
  appId: 'live',
  mode: 'append',
  applicableScenes: ['live.*'],
  priority: 20,
}
```

## 4. 管理 API

### 4.1 注册内置提示词

```typescript
import { registerBuiltinNarrativePrompts } from '@/services/builtinNarrativePrompts'

// 在应用启动时调用一次
registerBuiltinNarrativePrompts()
```

**行为**：

- 检查是否已存在同名的系统提示词
- 如果已存在，跳过（保留用户的修改）
- 如果不存在，创建新的系统提示词

### 4.2 获取内置提示词 ID

```typescript
import { getBuiltinNarrativePromptIds } from '@/services/builtinNarrativePrompts'

const ids = getBuiltinNarrativePromptIds()
// ['prompt-1', 'prompt-2', ...]
```

### 4.3 检查是否是内置提示词

```typescript
import { isBuiltinNarrativePrompt } from '@/services/builtinNarrativePrompts'

if (isBuiltinNarrativePrompt(promptId)) {
  console.log('这是内置叙事理解提示词')
}
```

### 4.4 重置为默认值

```typescript
import { resetBuiltinNarrativePrompts } from '@/services/builtinNarrativePrompts'

// 重置所有内置叙事理解提示词为默认值
// 注意：这会删除用户对内置提示词的修改
resetBuiltinNarrativePrompts()
```

### 4.5 获取定义（用于 UI）

```typescript
import { getBuiltinNarrativePromptDefinitions } from '@/services/builtinNarrativePrompts'

// 获取所有内置提示词的原始定义
const definitions = getBuiltinNarrativePromptDefinitions()
```

## 5. 用户定制

### 5.1 在 Prompts App 中管理

用户可以在 Prompts App 中：

1. **查看**：查看内置提示词的内容
2. **编辑**：修改提示词内容以适应特定需求
3. **禁用**：通过设置 `enabled: false` 禁用特定提示词
4. **重置**：恢复为默认内容

### 5.2 添加自定义提示词

开发者可以添加新的叙事理解提示词：

```typescript
import { SystemPromptService } from '@/services/systemPromptService'

SystemPromptService.create({
  name: '叙事内容理解（自定义 App）',
  description: '为自定义 App 提供叙事理解指导',
  content: `你的自定义指导内容...`,
  scope: 'app',
  appId: 'custom-app',
  mode: 'append',
  applicableScenes: ['custom.*'],
  priority: 20,
})
```

## 6. 优先级与组合

### 6.1 优先级规则

| 优先级 | 说明 |
|--------|------|
| 10 | 全局提示词（最低优先级） |
| 20 | App 专用提示词 |
| 更高值 | 用户自定义提示词可设置更高优先级 |

### 6.2 组合方式

当多个提示词同时适用时：

1. 按优先级排序（低到高）
2. 根据 `mode` 决定组合方式：
   - `replace`：替换之前的内容
   - `append`：追加到之前内容后
   - `prepend`：插入到之前内容前

**示例**：微博场景的提示词组合

```
[优先级 10] 全局叙事理解提示词
    ↓ append
[优先级 20] 微博叙事理解提示词
    ↓
最终系统提示词
```
