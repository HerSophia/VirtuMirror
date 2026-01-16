# AI Service 使用指南

本文档提供 AI Service 的使用示例和最佳实践。

## 1. 基础用法

### 1.1 初始化服务

```typescript
import { getAIService } from '@/services/ai';

// 获取单例实例
const aiService = getAIService();

// 初始化（加载配置，准备 Provider）
await aiService.initialize();

// 检查是否就绪
if (aiService.isReady) {
  console.log('AI Service 已就绪');
}
```

### 1.2 非流式生成

```typescript
import { getAIService } from '@/services/ai';

const aiService = getAIService();

// 简单生成
const result = await aiService.generateText({
  prompt: '写一首关于春天的诗',
});

console.log(result.text);           // 生成的文本
console.log(result.finishReason);   // 'stop' | 'length' | ...
console.log(result.usage);          // { promptTokens, completionTokens, totalTokens }
console.log(result.duration);       // 耗时（毫秒）
```

### 1.3 带系统提示词

```typescript
const result = await aiService.generateText({
  system: '你是一个专业的诗人，擅长写古体诗。',
  prompt: '写一首关于春天的诗',
  temperature: 0.8,
  maxTokens: 500,
});
```

### 1.4 聊天模式

```typescript
const result = await aiService.generateText({
  messages: [
    { role: 'system', content: '你是一个友好的助手' },
    { role: 'user', content: '你好！' },
    { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
    { role: 'user', content: '请帮我写一首诗' },
  ],
});
```

---

## 2. 流式生成

### 2.1 基础用法

```typescript
const handle = aiService.streamText({
  prompt: '讲一个故事',
  onChunk: (chunk) => {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.textDelta);
    }
  },
  onFinish: (result) => {
    console.log('\n完成:', result.text.length, '字符');
  },
  onError: (error) => {
    console.error('错误:', error.message);
  },
});

// 等待完成
const finalText = await handle.text;
```

### 2.2 使用 AsyncIterable

```typescript
const handle = aiService.streamText({
  prompt: '讲一个故事',
});

// 使用 for-await-of 遍历文本流
for await (const text of handle.textStream) {
  process.stdout.write(text);
}

console.log('\n最终文本:', await handle.text);
```

### 2.3 取消流式生成

```typescript
const handle = aiService.streamText({
  prompt: '讲一个很长的故事',
  onAbort: () => {
    console.log('生成已取消');
  },
});

// 5 秒后取消
setTimeout(() => {
  handle.abort();
}, 5000);
```

---

## 3. 使用 AIStore（推荐）

在 Vue 组件中，推荐使用 AIStore：

### 3.1 基础用法

```vue
<template>
  <div>
    <button @click="generate" :disabled="aiStore.isGenerating">
      {{ aiStore.isGenerating ? '生成中...' : '生成' }}
    </button>
    <button @click="aiStore.abort" v-if="aiStore.isGenerating">
      取消
    </button>
    <div v-if="aiStore.lastError" class="error">
      {{ formatErrorMessage(aiStore.lastError) }}
    </div>
    <pre>{{ result }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAIStore } from '@/stores/aiStore';
import { formatErrorMessage } from '@/services/ai';

const aiStore = useAIStore();
const result = ref('');

async function generate() {
  try {
    const res = await aiStore.generate({
      prompt: '写一首诗',
    });
    result.value = res.text;
  } catch (error) {
    // 错误已在 aiStore.lastError 中
  }
}
</script>
```

### 3.2 流式生成

```vue
<template>
  <div>
    <button @click="streamGenerate" :disabled="aiStore.isGenerating">
      流式生成
    </button>
    <pre>{{ streamText }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAIStore } from '@/stores/aiStore';

const aiStore = useAIStore();
const streamText = ref('');

function streamGenerate() {
  streamText.value = '';
  
  const handle = aiStore.streamGenerate({
    prompt: '讲一个故事',
    onChunk: (chunk) => {
      if (chunk.type === 'text-delta' && chunk.textDelta) {
        streamText.value += chunk.textDelta;
      }
    },
  });
}
</script>
```

### 3.3 查看 Provider 信息

```vue
<template>
  <div class="provider-info">
    <span>{{ providerInfo?.name }}</span>
    <span>{{ providerInfo?.modelId }}</span>
    <span :class="{ ready: providerInfo?.ready }">
      {{ providerInfo?.ready ? '就绪' : '未就绪' }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAIStore } from '@/stores/aiStore';

const aiStore = useAIStore();
const providerInfo = computed(() => aiStore.providerInfo);
</script>
```

---

## 4. 优先级调度

### 4.1 指定优先级

```typescript
import { getAIService, RequestPriority } from '@/services/ai';

const aiService = getAIService();

// 用户聊天 - 最高优先级
const reply = await aiService.generateText(
  { prompt: userMessage },
  RequestPriority.CRITICAL
);

// 惰性加载 - 高优先级
const posts = await aiService.generateText(
  { prompt: topicPrompt },
  RequestPriority.HIGH
);

// 后台任务 - 低优先级
aiService.generateText(
  { prompt: backgroundTask },
  RequestPriority.LOW
).then(handleResult);
```

### 4.2 批量取消

```typescript
import { getRequestQueue, RequestPriority } from '@/services/ai';

const queue = getRequestQueue();

// 用户切换页面时，取消所有后台任务
const cancelled = queue.cancelByPriority(RequestPriority.LOW);
console.log(`取消了 ${cancelled} 个后台任务`);
```

---

## 5. 错误处理

### 5.1 捕获错误

```typescript
import { getAIService, formatErrorMessage, isRetryable } from '@/services/ai';
import type { AIError } from '@/services/ai';

const aiService = getAIService();

try {
  const result = await aiService.generateText({ prompt: '...' });
} catch (error) {
  const aiError = error as AIError;
  
  console.log('错误码:', aiError.code);       // 'RATE_LIMIT' | 'TIMEOUT' | ...
  console.log('错误消息:', aiError.message);
  console.log('可重试:', aiError.retryable);
  
  // 格式化为用户友好消息
  const userMessage = formatErrorMessage(aiError);
  showToast(userMessage);
  
  // 判断是否可重试
  if (isRetryable(aiError.code)) {
    // 显示重试按钮
  }
}
```

### 5.2 错误码处理

```typescript
switch (aiError.code) {
  case 'RATE_LIMIT':
    showToast('请求过于频繁，请稍后重试');
    break;
  case 'AUTH_ERROR':
    showToast('API 认证失败，请检查配置');
    router.push('/settings/api');
    break;
  case 'NETWORK_ERROR':
    showToast('网络连接失败，请检查网络');
    break;
  case 'TIMEOUT':
    showToast('请求超时，请重试');
    break;
  case 'ABORTED':
    // 用户取消，不需要提示
    break;
  case 'CONTENT_FILTER':
    showToast('内容被安全策略拦截');
    break;
  default:
    showToast(`生成失败: ${aiError.message}`);
}
```

---

## 6. 事件监听

### 6.1 监听生成事件

```typescript
const aiService = getAIService();

// 监听请求开始
const unsubStart = aiService.on('start', (requestId) => {
  console.log(`[${requestId}] 开始生成`);
  showLoading();
});

// 监听流式数据
const unsubChunk = aiService.on('chunk', (requestId, chunk) => {
  appendToOutput(chunk);
});

// 监听完成
const unsubFinish = aiService.on('finish', (requestId, result) => {
  console.log(`[${requestId}] 完成，耗时 ${result.duration}ms`);
  hideLoading();
});

// 监听错误
const unsubError = aiService.on('error', (requestId, error) => {
  console.error(`[${requestId}] 错误:`, error);
  showError(error);
});

// 组件卸载时取消订阅
onUnmounted(() => {
  unsubStart();
  unsubChunk();
  unsubFinish();
  unsubError();
});
```

---

## 7. 高级配置

### 7.1 更新队列配置

```typescript
const aiService = getAIService();

// 根据 Provider 调整配置
aiService.updateQueueConfig({
  maxConcurrent: 5,   // 增加并发数
  maxRPM: 100,        // 限制每分钟请求数
  minInterval: 50,    // 减少请求间隔
});
```

### 7.2 切换 Provider

```typescript
const aiService = getAIService();

// 切换到指定预设
aiService.switchProvider('preset-openai');

// 切换到酒馆 API 模式
aiService.switchProvider(null);

// 配置变更后刷新
aiService.refreshProvider();
```

### 7.3 自定义超时

```typescript
const result = await aiService.generateText({
  prompt: '生成长文本...',
  timeout: 120000,  // 2 分钟超时
});
```

---

## 8. 与 AIGenerateService 集成

如果你正在使用提示词系统，可以通过 `AIGenerateService`：

```typescript
import { AIGenerateService } from '@/services/aiGenerateService';

// 使用提示词模板生成
const result = await AIGenerateService.generateWithPrompt(
  'weibo.post',
  {
    topic: '春天',
    style: '文艺',
  }
);

// 内部会调用 AIService
```

---

## 9. 最佳实践

### 9.1 请求 ID 管理

对于需要取消的请求，建议指定 requestId：

```typescript
const requestId = `chat-${Date.now()}`;

const promise = aiService.generateText({
  prompt: userMessage,
  requestId,
});

// 用户点击取消按钮时
cancelButton.onclick = () => {
  aiService.abort(requestId);
};
```

### 9.2 合理使用优先级

```typescript
// ✅ 好的做法：区分优先级
await aiService.generateText({ ... }, RequestPriority.CRITICAL);  // 用户交互
await aiService.generateText({ ... }, RequestPriority.LOW);       // 后台预加载

// ❌ 避免：所有请求都用最高优先级
await aiService.generateText({ ... }, RequestPriority.CRITICAL);  // 后台任务不应该用 CRITICAL
```

### 9.3 错误恢复

```typescript
async function generateWithRetry(options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await aiService.generateText(options);
    } catch (error) {
      const aiError = error as AIError;
      
      if (!aiError.retryable || i === maxRetries - 1) {
        throw error;
      }
      
      // 等待后重试
      await sleep(1000 * (i + 1));
    }
  }
}
```

### 9.4 资源清理

```typescript
// Vue 组件中
onUnmounted(() => {
  // 取消该组件发起的所有请求
  aiService.abort();
});

// 或使用 AIStore
onUnmounted(() => {
  if (aiStore.isGenerating) {
    aiStore.abort();
  }
});
```

### 9.5 监控队列状态

```typescript
// 在发起大量请求前检查队列
const status = aiService.getQueueStatus();

if (status.pending > 50) {
  console.warn('队列积压较多，考虑降低请求频率');
}

if (status.currentRPM > 50) {
  console.warn('RPM 较高，可能触发速率限制');
}
```

---

## 10. 调试技巧

### 10.1 启用日志

```typescript
const aiService = getAIService({
  enableLogging: true,
});

// 控制台会输出：
// [AIService] 初始化完成 { source: 'openai', name: 'OpenAI', modelId: 'gpt-4', ready: true }
```

### 10.2 查看请求状态

```typescript
import { getRequestManager } from '@/services/ai';

const requestManager = getRequestManager();

// 查看所有活动请求
const activeRequests = requestManager.getActiveRequests();
console.log('活动请求:', activeRequests);

// 查看特定请求
const ctx = requestManager.get('request-id');
console.log('请求状态:', ctx?.status);
```

### 10.3 Mock 模式

开发时可以使用 Mock Provider：

```typescript
import { ProviderFactory } from '@/services/ai';

// 创建 Mock Provider
const mockProvider = ProviderFactory.createMock();

// 使用 Mock Provider 生成
const result = await aiService.generateText({
  model: mockProvider,
  prompt: '测试提示词',
});
```
