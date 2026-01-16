# 使用指南

> 本文档说明 App 如何订阅和处理叙事内容。

## 1. 基本使用流程

### 1.1 初始化服务

在应用入口文件中初始化服务（只需调用一次）：

```typescript
// src/main.ts 或 App.vue
import { narrativeService } from '@/services/narrativeService'
import { registerBuiltinNarrativePrompts } from '@/services/builtinNarrativePrompts'

// 1. 注册内置叙事理解提示词
registerBuiltinNarrativePrompts()

// 2. 设置桥接监听
narrativeService.setupBridgeListener()
```

### 1.2 在 Store 中订阅

```typescript
// src/apps/weibo/stores/weiboStore.ts
import { defineStore } from 'pinia'
import { narrativeService } from '@/services/narrativeService'
import type { NarrativeEvent } from '@/services/narrativeService'

export const useWeiboStore = defineStore('weibo', () => {
  // 订阅叙事内容
  function setupNarrativeListener() {
    return narrativeService.subscribe(handleNarrative)
  }

  async function handleNarrative(event: NarrativeEvent) {
    console.log('收到叙事:', event.content.slice(0, 100) + '...')
    
    if (event.isSwipeChange) {
      // Swipe 切换：处理数据可见性
      await handleSwipeChange(event)
    } else {
      // 新消息：分析叙事内容
      await analyzeNarrative(event)
    }
  }

  return {
    setupNarrativeListener,
    // ...
  }
})
```

### 1.3 在组件中使用

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useWeiboStore } from '../stores/weiboStore'

const weiboStore = useWeiboStore()

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = weiboStore.setupNarrativeListener()
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>
```

## 2. 处理叙事内容

### 2.1 配合 LLM 分析

```typescript
import { createNarrativeVariables } from '@/services/narrativeService'
import { AIGenerateService } from '@/services/aiGenerateService'

async function analyzeNarrative(event: NarrativeEvent) {
  // 1. 转换为标准变量
  const variables = createNarrativeVariables(event)
  
  // 2. 添加应用特定变量
  const allVariables = {
    ...variables,
    characterName: getCurrentCharacterName(),
    platform: 'weibo',
  }
  
  // 3. 调用 LLM 分析
  const result = await AIGenerateService.generateWithPrompt(
    'social.weibo.analyze',
    allVariables,
    { appId: 'weibo', scene: 'social.weibo.analyze' }
  )
  
  // 4. 处理分析结果
  if (result.shouldPost) {
    await createPost(result.postContent, event.messageId, event.swipeId)
  }
}
```

### 2.2 使用 LLM Task Service

更推荐的方式是通过 LLM Task Service 调度任务：

```typescript
import { useLLMTaskStore } from '@/stores/llmTaskStore'

async function analyzeNarrative(event: NarrativeEvent) {
  const llmTask = useLLMTaskStore()
  
  // 触发预定义的叙事分析任务
  await llmTask.executeTask('weibo.analyze-narrative', {
    narrative: event.content,
    messageId: event.messageId,
    swipeId: event.swipeId,
  })
}
```

## 3. 处理 Swipe 切换

### 3.1 核心原则：隐藏而不是清理

当用户在酒馆切换消息页（swipe）时，故事内容可能完全不同。关键原则是**隐藏而不是清理**。

```typescript
async function handleSwipeChange(event: NarrativeEvent) {
  const { messageId, swipeId, content } = event
  
  // 1. 隐藏其他 Swipe 产生的数据（不要删除！）
  hideDataFromOtherSwipes(messageId, swipeId)
  
  // 2. 显示当前 Swipe 对应的数据（如果有）
  const existingData = getDataForSwipe(messageId, swipeId)
  
  if (existingData.length > 0) {
    // 数据已存在，直接显示
    showData(existingData)
  } else {
    // 首次遇到这个 Swipe，需要分析叙事
    await analyzeNarrative(event)
  }
}
```

### 3.2 为什么隐藏而不是清理？

| 场景 | 清理策略 | 隐藏策略 |
|------|---------|----------|
| 用户切回之前的 Swipe | 需要重新调用 LLM | 数据还在，直接显示 |
| LLM 调用次数 | 每次切换都调用 | 只在首次遇到时调用 |
| 数据一致性 | 每次可能生成不同内容 | 内容稳定，与叙事对应 |

### 3.3 数据来源追踪

每条数据应该记录来源的 Swipe：

```typescript
interface WeiboPostData {
  id: string
  content: string
  // ... 其他字段
  
  // 来源追踪
  sourceMessageId: number  // 来自哪个楼层
  sourceSwipeId: number    // 来自哪个 Swipe
}

// 查询当前 Swipe 的可见数据
function getVisiblePosts(
  currentMessageId: number,
  currentSwipeId: number
): WeiboPostData[] {
  return allPosts.filter(post => {
    // 历史楼层的数据始终显示
    if (post.sourceMessageId < currentMessageId) return true
    
    // 当前楼层只显示当前 Swipe 的数据
    return post.sourceMessageId === currentMessageId && 
           post.sourceSwipeId === currentSwipeId
  })
}
```

## 4. 提示词模板示例

### 4.1 微博分析提示词

```typescript
const WEIBO_ANALYZE_PROMPT = `
分析以下故事内容，判断是否需要发布微博：

<故事>
{{narrative}}
</故事>

角色：{{characterName}}

请判断：
1. 故事中是否提到了发布微博/发帖/更新动态等行为？
2. 如果有，请提取以下信息：
   - 发帖内容
   - 配图描述（如有）
   - 发帖角色
   - 发帖时间（如有）

以 JSON 格式返回：
\`\`\`json
{
  "shouldPost": boolean,
  "postContent": string | null,
  "imageDescription": string | null,
  "author": string | null,
  "timestamp": string | null
}
\`\`\`
`
```

### 4.2 使用 availableVariables 声明

```typescript
import { NARRATIVE_VARIABLE_DEFINITIONS } from '@/services/narrativeService'

const promptDefinition = {
  scene: 'social.weibo.analyze',
  template: WEIBO_ANALYZE_PROMPT,
  availableVariables: [
    ...NARRATIVE_VARIABLE_DEFINITIONS,
    {
      name: 'characterName',
      type: 'string',
      description: '当前角色名称',
      required: true,
    },
  ],
}
```

## 5. 错误处理

### 5.1 订阅者错误隔离

每个订阅者独立处理，互不影响。建议在回调中做好错误处理：

```typescript
narrativeService.subscribe(async (event) => {
  try {
    await handleNarrative(event)
  } catch (error) {
    console.error('[WeiboStore] 处理叙事失败:', error)
    // 可以记录到错误日志或显示提示
    showErrorNotification('处理叙事内容时出错')
  }
})
```

### 5.2 LLM 调用失败处理

```typescript
async function analyzeNarrative(event: NarrativeEvent) {
  try {
    const result = await AIGenerateService.generateWithPrompt(...)
    // 处理结果...
  } catch (error) {
    if (error.message.includes('rate limit')) {
      // 速率限制，稍后重试
      await delay(5000)
      return analyzeNarrative(event)
    }
    
    console.error('[WeiboStore] LLM 分析失败:', error)
    // 可以选择跳过或使用默认行为
  }
}
```

## 6. 最佳实践

### 6.1 避免重复分析

```typescript
const analyzedSwipes = new Set<string>()

async function analyzeNarrative(event: NarrativeEvent) {
  const key = `${event.messageId}-${event.swipeId}`
  
  // 避免重复分析同一个 Swipe
  if (analyzedSwipes.has(key)) {
    console.log('[WeiboStore] 跳过已分析的 Swipe:', key)
    return
  }
  
  analyzedSwipes.add(key)
  // 执行分析..

### 6.2 节流处理

如果叙事内容频繁更新，可以添加节流：

```typescript
import { throttle } from 'lodash-es'

const throttledAnalyze = throttle(analyzeNarrative, 2000)

narrativeService.subscribe(throttledAnalyze)
```

### 6.3 清理订阅

确保在适当时机清理订阅，避免内存泄漏：

```typescript
// 组件级别
onUnmounted(() => {
  unsubscribe?.()
})

// Store 级别（如果需要）
function cleanup() {
  if (narrativeUnsubscribe) {
    narrativeUnsubscribe()
    narrativeUnsubscribe = null
  }
}
```

## 7. 调试技巧

### 7.1 查看日志

叙事服务在控制台输出详细日志：

```
[NarrativeService] 发布叙事: {
  messageId: 5,
  swipeId: 0,
  isSwipe: false,
  contentLength: 1234,
  subscriberCount: 3
}
```

### 7.2 手动发布测试

在开发时可以手动发布测试事件：

```typescript
import { narrativeService } from '@/services/narrativeService'

// 在浏览器控制台中测试
narrativeService.publish({
  sessionId: 'test-session',
  messageId: 1,
  swipeId: 0,
  content: '测试叙事内容：角色发了一条微博...',
  timestamp: Date.now(),
})
```

### 7.3 检查订阅者数量

```typescript
console.log('当前订阅者数量:', narrativeService.subscribers.size)
```
