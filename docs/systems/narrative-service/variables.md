# 变量与注入工具

> 本文档说明叙事服务提供的标准变量定义和注入工具函数。

## 1. 标准叙事变量

### 1.1 NarrativeVariables 接口

```typescript
interface NarrativeVariables {
  /** 叙事内容（主要变量） */
  narrative: string
  /** 来源楼层号 */
  narrativeMessageId: number
  /** 来源 Swipe ID */
  narrativeSwipeId: number
  /** 时间戳 */
  narrativeTimestamp: number
  /** 是否是 Swipe 切换触发 */
  isSwipeChange: boolean
  /** 会话 ID */
  narrativeSessionId: string
}
```

### 1.2 变量说明

| 变量名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `narrative` | string | ✅ | 叙事内容（主要变量） |
| `narrativeMessageId` | number | - | 来源楼层号 |
| `narrativeSwipeId` | number | - | 来源 Swipe ID |
| `narrativeTimestamp` | number | - | 时间戳 |
| `isSwipeChange` | boolean | - | 是否由 Swipe 切换触发 |
| `narrativeSessionId` | string | - | 会话 ID |

### 1.3 变量定义常量

```typescript
export const NARRATIVE_VARIABLE_DEFINITIONS = [
  {
    name: 'narrative',
    type: 'string',
    description: '来自酒馆的叙事内容（故事文本）',
    required: true,
  },
  {
    name: 'narrativeMessageId',
    type: 'number',
    description: '叙事来源的楼层号',
    required: false,
  },
  {
    name: 'narrativeSwipeId',
    type: 'number',
    description: '叙事来源的 Swipe ID',
    required: false,
  },
  {
    name: 'isSwipeChange',
    type: 'boolean',
    description: '是否由 Swipe 切换触发',
    required: false,
    defaultValue: false,
  },
]
```

## 2. 变量转换函数

### createNarrativeVariables

将 `NarrativeEvent` 转换为标准化的提示词变量。

```typescript
import { createNarrativeVariables } from '@/services/narrativeService'

narrativeService.subscribe(async (event) => {
  // 将事件转换为标准变量
  const variables = createNarrativeVariables(event)
  
  // 传递给提示词系统
  const result = await AIGenerateService.generateWithPrompt(
    'social.weibo.analyze',
    { ...variables, characterName: '角色名' },
    { appId: 'weibo', scene: 'social.weibo.analyze' }
  )
})
```

**实现**：

```typescript
export function createNarrativeVariables(event: NarrativeEvent): NarrativeVariables {
  return {
    narrative: event.content,
    narrativeMessageId: event.messageId,
    narrativeSwipeId: event.swipeId,
    narrativeTimestamp: event.timestamp,
    isSwipeChange: event.isSwipeChange ?? false,
    narrativeSessionId: event.sessionId,
  }
}
```

## 3. 叙事注入工具

### 3.1 系统保留变量名

```typescript
export const NARRATIVE_VAR_NAME = 'narrative'
```

所有需要叙事内容的提示词都应使用此变量名，便于统一管理和防重复注入。

### 3.2 检测占位符

#### hasNarrativePlaceholder

检测文本中是否包含 `{{narrative}}` 占位符。

```typescript
import { hasNarrativePlaceholder } from '@/services/narrativeService'

hasNarrativePlaceholder('请分析 {{narrative}} 中的内容')  // true
hasNarrativePlaceholder('这是普通文本')  // false
```

### 3.3 检测重复内容

#### containsNarrativeContent

检测文本中是否已经包含叙事内容（通过特征片段比对）。

```typescript
import { containsNarrativeContent } from '@/services/narrativeService'

const narrative = '六月五日的阳光透过酒店厚重的遮光窗帘缝隙...'
const text = '分析内容：六月五日的阳光透过酒店厚重的遮光窗帘缝隙...'

containsNarrativeContent(text, narrative)  // true
```

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | string | 要检测的文本 |
| `narrativeContent` | string | 叙事内容 |
| `sampleLength` | number | 用于比对的样本长度（默认 100） |

**逻辑**：

1. 叙事内容少于 30 字符，返回 false（无法可靠检测）
2. 取叙事内容前 N 个字符作为特征样本
3. 检查目标文本是否包含该样本

### 3.4 安全注入叙事内容

#### injectNarrativeSafely

安全地将叙事内容注入模板，防止重复注入。

```typescript
import { injectNarrativeSafely } from '@/services/narrativeService'

const result = injectNarrativeSafely(
  '请分析以下内容：{{narrative}}',
  '这是叙事内容...'
)

console.log(result.text)      // '请分析以下内容：这是叙事内容...'
console.log(result.injected)  // true
```

**参数**：

```typescript
function injectNarrativeSafely(
  template: string,
  narrativeContent: string,
  options?: {
    /** 如果没有占位符，是否追加到末尾 */
    appendIfMissing?: boolean
    /** 已经注入叙事的其他文本列表（用于检测重复） */
    otherTexts?: string[]
    /** 追加时使用的格式 */
    appendFormat?: 'xml' | 'markdown' | 'plain'
  }
): NarrativeInjectionResult
```

**返回值**：

```typescript
interface NarrativeInjectionResult {
  /** 处理后的文本 */
  text: string
  /** 是否成功注入 */
  injected: boolean
  /** 是否因重复而跳过 */
  skippedDuplicate: boolean
  /** 跳过原因 */
  skipReason?: string
}
```

**注入策略**：

1. 如果叙事内容为空 → 不注入，返回原模板
2. 如果叙事内容已存在于其他文本中 → 跳过（防重复）
3. 如果模板自身已包含叙事内容 → 跳过（防重复）
4. 如果模板有 `{{narrative}}` 占位符 → 替换占位符
5. 如果没有占位符且 `appendIfMissing=true` → 追加到末尾
6. 否则 → 不注入

**追加格式示例**：

```typescript
// xml 格式（默认）
injectNarrativeSafely(template, content, { appendIfMissing: true, appendFormat: 'xml' })
// 结果：template + "\n\n<叙事内容>\ncontent\n</叙事内容>"

// markdown 格式
injectNarrativeSafely(template, content, { appendIfMissing: true, appendFormat: 'markdown' })
// 结果：template + "\n\n## 叙事内容\n\ncontent"

// plain 格式
injectNarrativeSafely(template, content, { appendIfMissing: true, appendFormat: 'plain' })
// 结果：template + "\n\n【叙事内容】\ncontent"
```

### 3.5 准备变量集合

#### prepareVariablesWithNarrative

自动将叙事内容添加到变量集合中（如果不存在）。

```typescript
import { prepareVariablesWithNarrative } from '@/services/narrativeService'

const variables = { characterName: '角色名' }
const enriched = prepareVariablesWithNarrative(
  variables,
  '叙事内容...',
  {
    messageId: 5,
    swipeId: 0,
    sessionId: 'session-123',
    timestamp: Date.now()
  }
)

// 结果：
// {
//   characterName: '角色名',
//   narrative: '叙事内容...',
//   narrativeMessageId: 5,
//   narrativeSwipeId: 0,
//   narrativeSessionId: 'session-123',
//   narrativeTimestamp: ...
// }
```

**特点**：

- 只有当变量不存在或为空时才注入
- 不会覆盖已有值
- 支持可选的元数据注入

## 4. 使用场景

### 4.1 提示词模板中使用

```typescript
// 提示词模板
const template = `
分析以下故事内容，判断是否需要发布微博：

<故事>
{{narrative}}
</故事>

角色：{{characterName}}
`

// 使用注入工具
narrativeService.subscribe(async (event) => {
  const variables = prepareVariablesWithNarrative(
    { characterName: 'Artemis' },
    event.content,
    { messageId: event.messageId, swipeId: event.swipeId }
  )
  
  const result = injectNarrativeSafely(template, event.content)
  // 或直接使用变量替换系统
})
```

### 4.2 防止重复注入

```typescript
// 场景：系统提示词和用户提示词都可能包含叙事内容
const systemPrompt = buildSystemPrompt()  // 可能已包含叙事
const userPrompt = '请分析 {{narrative}}'

// 安全注入到用户提示词
const result = injectNarrativeSafely(
  userPrompt,
  narrativeContent,
  { otherTexts: [systemPrompt] }  // 检查系统提示词是否已包含
)

if (result.skippedDuplicate) {
  console.log('叙事内容已在系统提示词中，跳过注入')
}
```
