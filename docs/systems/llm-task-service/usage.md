# 使用示例

## App 注册任务扩展

每个 App 需要在初始化时注册自己的 LLM 任务扩展。

```typescript
// src/apps/weibo/llmTask/index.ts

import { getLLMTaskService } from '@/services/llmTask';
import { weiboTaskDefinitions } from './weiboTaskDefinitions';
import { weiboContextProviders } from './weiboContextProviders';
import { weiboOutputHandlers } from './weiboOutputHandlers';

/**
 * 注册微博 App 的 LLM 任务扩展
 * 在 WeiboApp.vue 的 onMounted 或 manifest.ts 的 onInit 中调用
 */
export function registerWeiboLLMExtensions() {
  const service = getLLMTaskService();
  
  // 1. 注册上下文提供器
  weiboContextProviders.forEach(provider => {
    service.registerContextProvider(provider);
  });
  
  // 2. 注册输出处理器
  weiboOutputHandlers.forEach(handler => {
    service.registerOutputHandler(handler);
  });
  
  // 3. 注册任务定义
  service.registerTaskDefinitions(weiboTaskDefinitions);
  
  console.log('[Weibo] LLM 任务扩展已注册', {
    tasks: weiboTaskDefinitions.length,
    providers: weiboContextProviders.length,
    handlers: weiboOutputHandlers.length,
  });
}

/**
 * 初始化内置任务实例
 * 将任务定义转换为可执行的任务实例
 */
export function initializeBuiltinTasks() {
  const service = getLLMTaskService();
  
  // 为每个 showByDefault=true 的定义创建任务实例
  const definitions = service.getTaskDefinitionsByApp('weibo');
  
  definitions
    .filter(def => def.showByDefault)
    .forEach(def => {
      // 检查是否已存在
      const existing = service.getAllTasks()
        .find(t => t.definitionId === def.id);
      
      if (!existing) {
        service.createTask(def.id);
      }
    });
}
```

---

## 定义任务

```typescript
// src/apps/weibo/llmTask/weiboTaskDefinitions.ts

import type { LLMTaskDefinition } from '@/services/llmTask/types';
import { RequestPriority } from '@/services/ai/types';

export const weiboTaskDefinitions: LLMTaskDefinition[] = [
  {
    id: 'weibo:generate-post',
    appId: 'weibo',
    name: '🔥 生成微博博文',
    description: '根据话题和风格生成单条微博',
    category: 'content',
    
    type: 'manual',
    executionMode: 'repeatable',
    
    promptTemplate: `你是一个微博用户，请根据以下信息生成一条微博：

话题：{{topic}}
风格：{{style}}
时间背景：{{timeContext}}

{{#if narrative}}
当前故事背景：
{{narrative}}
{{/if}}

{{#if existingPosts}}
请避免与以下现有内容重复：
{{existingPosts}}
{{/if}}

请生成一条真实、自然的微博，包含适当的表情和话题标签。`,
    
    inputSchema: [
      {
        name: 'topic',
        label: '话题',
        type: 'string',
        required: true,
        placeholder: '如：今天的天气',
      },
      {
        name: 'style',
        label: '风格',
        type: 'select',
        defaultValue: 'casual',
        options: [
          { value: 'casual', label: '日常' },
          { value: 'humorous', label: '幽默' },
          { value: 'professional', label: '专业' },
          { value: 'emotional', label: '感性' },
        ],
      },
      {
        name: 'timeContext',
        label: '时间背景',
        type: 'string',
        defaultValue: '当前时间',
        placeholder: '留空自动使用当前时间',
      },
    ],
    
    defaultInput: {
      topic: '',
      style: 'casual',
      timeContext: '',
    },
    
    config: {
      temperature: 0.8,
      maxTokens: 1024,
    },
    
    priority: RequestPriority.NORMAL,
    
    outputHandlerId: 'weibo:post-handler',
    contextProviders: ['system:time', 'weibo:narrative', 'weibo:existing-content'],
    
    showByDefault: true,
    tags: ['content', 'post', 'generate'],
  },
  
  // ... 更多任务定义
];
```

---

## 实现输出处理器

```typescript
// src/apps/weibo/llmTask/weiboOutputHandlers.ts

import type { OutputHandler, OutputHandlerResult } from '@/services/llmTask/types';
import { transformLLMOutputToUniversalPost } from '../stores/llm/postTransformer';
import { db } from '@/services/database';

export const weiboOutputHandlers: OutputHandler[] = [
  {
    id: 'weibo:post-handler',
    appId: 'weibo',
    name: '微博博文处理器',
    description: '解析 LLM 输出并保存为微博博文',
    
    async handle(output, task, context): Promise<OutputHandlerResult> {
      try {
        // 1. 清理和解析 JSON
        const cleanedOutput = cleanJsonOutput(output);
        const parsed = JSON.parse(cleanedOutput);
        
        // 2. 转换为 UniversalPost
        const post = transformLLMOutputToUniversalPost(parsed);
        
        // 3. 保存到数据库
        await db.socialPosts.add(post);
        
        context.addLog('info', `已创建博文: ${post.id}`);
        
        return {
          success: true,
          data: post,
          recordsCreated: 1,
        };
      } catch (error: any) {
        context.addLog('error', `解析失败: ${error.message}`);
        return {
          success: false,
          error: error.message,
        };
      }
    },
    
    supportsPreview: true,
    
    async preview(output, task) {
      const cleanedOutput = cleanJsonOutput(output);
      const parsed = JSON.parse(cleanedOutput);
      const post = transformLLMOutputToUniversalPost(parsed);
      
      return {
        data: post,
        summary: `将创建 ${post.primaryType} 类型的博文`,
      };
    },
  },
  
  // ... 更多处理器
];

function cleanJsonOutput(output: string): string {
  // 移除 markdown 代码块标记
  return output
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}
```

---

## 实现上下文提供器

```typescript
// src/apps/weibo/llmTask/weiboContextProviders.ts

import type { ContextProvider } from '@/services/llmTask/types';
import { narrativeCache } from '../stores/llm/narrativeIntegration';
import { db } from '@/services/database';

export const weiboContextProviders: ContextProvider[] = [
  {
    id: 'weibo:narrative',
    appId: 'weibo',
    name: '叙事内容提供器',
    description: '注入来自酒馆的聊天叙事内容',
    priority: 10, // 高优先级
    
    async getContext() {
      const cache = narrativeCache.value;
      
      if (!cache || !cache.messages.length) {
        return {
          narrative: '',
          narrativeAvailable: 'false',
        };
      }
      
      // 拼接多楼层叙事
      const content = cache.messages
        .map((m, i) => `[${i + 1}] ${m.content}`)
        .join('\n\n');
      
      return {
        narrative: content,
        narrativeAvailable: 'true',
        narrativeMessageId: cache.lastMessageId || '',
      };
    },
    
    getMetadata() {
      const cache = narrativeCache.value;
      return {
        available: !!cache?.messages.length,
        messageCount: cache?.messages.length || 0,
        lastMessageId: cache?.lastMessageId,
      };
    },
  },
  
  {
    id: 'weibo:existing-content',
    appId: 'weibo',
    name: '现有内容提供器',
    description: '注入现有博文和热搜，用于避免重复生成',
    priority: 20,
    
    async getContext() {
      // 获取最近的博文
      const recentPosts = await db.socialPosts
        .where('platformId')
        .equals('weibo')
        .reverse()
        .limit(20)
        .toArray();
      
      const existingPosts = recentPosts
        .map(p => p.payload?.text || '')
        .filter(Boolean)
        .join('\n');
      
      // 获取当前热搜
      const hotSearches = await db.socialTopics
        .where('platformId')
        .equals('weibo')
        .toArray();
      
      const existingHotSearches = hotSearches
        .map(h => h.title)
        .join('\n');
      
      return {
        existingPosts,
        existingHotSearches,
      };
    },
  },
];
```

---

## 在组件中使用

```vue
<!-- src/apps/weibo/views/LLMTaskManager.vue -->

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useLLMTaskStore } from '@/stores/llmTaskStore';
import { getLLMTaskService } from '@/services/llmTask';

const store = useLLMTaskStore();
const service = getLLMTaskService();

// 获取微博相关的任务
const weiboTasks = computed(() => 
  store.tasks.filter(t => t.appId === 'weibo')
);

// 执行任务
async function handleExecute(taskId: string) {
  const result = await service.executeTask(taskId);
  if (result.success) {
    console.log('任务执行成功', result);
  }
}

// 启动自动执行
function handleStartAuto(taskId: string) {
  service.startAutoExecution(taskId);
}

onMounted(() => {
  // Store 会自动同步 Service 的状态
});
</script>

<template>
  <div class="task-manager">
    <div v-for="task in weiboTasks" :key="task.id" class="task-item">
      <div class="task-name">{{ task.name }}</div>
      <div class="task-status">{{ task.status }}</div>
      <button @click="handleExecute(task.id)">执行</button>
      <button @click="handleStartAuto(task.id)">自动执行</button>
    </div>
  </div>
</template>
```
