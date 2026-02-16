# 档案服务 - 集成指南

> **版本**: 1.0  
> **最后更新**: 2026-02-08

## 1. 概述

本文档介绍如何将档案服务与其他系统服务集成，包括 Socket Bridge、社交引擎、系统提示词服务、通知系统等。

---

## 2. 与 Socket Bridge 集成

通过 Bridge 获取酒馆的楼层数据，是档案提取的主要数据来源。

### 2.1 事件定义

```typescript
// Archive 侧消费的 Bridge 事件（现网口径）
// src/adapters/bridgeAdapter.ts + src/adapters/types.ts

interface BridgeEvents {
  'message_received': (payload: SyncPayload) => void;
  'message_edited': (payload: SyncPayload) => void;
  'message_deleted': (payload: MessageDeletedEvent) => void;
  'swipe_changed': (payload: SwipeChangedEvent) => void;
  'chat_changed': (chatId: string) => void;
}
```

### 2.2 Archive 事件映射表

文档历史上使用过 `floors:request/response/updated` 口径。当前实现统一映射到 Bridge 现有事件：

| 旧口径（设计） | 当前事件（实现） | 触发来源 | Archive 使用方式 |
| ------------- | ---------------- | -------- | ---------------- |
| `floors:request` | `request_sync`（socket emit） | Phone -> Bridge | 主动拉取最近楼层窗口 |
| `floors:response` | `sync(type='full_sync')` | Bridge -> Phone | 获取完整楼层窗口并转换为 `ArchiveFloorData[]` |
| `floors:updated` | `message_received` / `message_edited` / `swipe_changed` | Bridge -> Phone | 增量更新后触发提取窗口检查 |
| `session:changed`（隐式） | `chat_changed` | Bridge -> Phone | 切会话后重置提取游标与上下文 |

### 2.3 ArchiveFloorData 统一结构

```typescript
interface ArchiveFloorData {
  messageId: number;              // 楼层号（message_id）
  swipeId: number;                // 消息页 ID（swipe_id）
  role: 'user' | 'assistant' | 'system';
  content: string;                // 消息文本
  timestamp: number;              // 时间戳
}
```

### 2.4 获取楼层数据

```typescript
// 通过 request_sync + full_sync 拉取窗口楼层

class ArchiveService {
  async fetchFloors(range: { start: number; end: number }): Promise<ArchiveFloorData[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Bridge sync timeout'));
      }, 10000);

      const off = bridgeAdapter.on('bridge:full_sync', (payload: SyncPayload) => {
        clearTimeout(timeout);
        off();

        const floors = (payload.messages ?? []).map((item) => ({
          messageId: item.message_id,
          swipeId: item.swipe_id ?? 0,
          role: item.role,
          content: item.message,
          timestamp: Date.now(),
        }));

        resolve(floors.slice(range.start - 1, range.end));
      });

      bridgeAdapter.requestSync(range.end - range.start + 1);
    });
  }
}
```

### 2.5 监听楼层更新

```typescript
// 初始化时注册监听
function initArchiveService(): void {
  bridgeAdapter.on('message_received', () => archiveAutoScheduler.checkAutoExtract());
  bridgeAdapter.on('message_edited', () => archiveAutoScheduler.checkAutoExtract());
  bridgeAdapter.on('swipe_changed', () => archiveAutoScheduler.checkAutoExtract());

  bridgeAdapter.on('chat_changed', (chatId) => {
    archiveAutoScheduler.resetSessionCursor(chatId);
  });
}
```

---

## 3. 与社交引擎集成

档案内容自动注入到社交引擎的生成提示词中，确保 NPC 发布的内容与角色设定一致。

### 3.1 Content Factory 集成

```typescript
// src/services/social/contentFactory.ts

import { archiveInjectionService } from '@/services';

class ContentFactory {
  /**
   * 生成帖子（带档案注入）
   */
  async generatePost(
    platformId: string,
    topic: string,
    account?: SocialAccount
  ): Promise<Post> {
    // 获取档案注入内容
    const injection = await archiveInjectionService.getInjection({
      sessionId: this.currentId,
      scene: `social.post.generate.${platformId}`,
      accountId: account?.id,
      keywords: this.extractKeywords(topic),
      maxTotalTokens: 800,
    });
    
    // 构建提示词
    const prompt = await promptService.renderPrompt('social.post.generate', {
      platformName: this.getPlatformName(platformId),
      topic,
      // 注入档案上下文
      coreKnowledge: injection.coreKnowledge,
      accountContext: injection.accountContext,
      relevantArchives: injection.relevantArchives,
    });
    
    // 调用 LLM 生成
    return this.generateWithLLM(prompt);
  }
  
  /**
   * 生成评论（带档案注入）
   */
  async generateComment(
    post: Post,
    account: SocialAccount
  ): Promise<Comment> {
    const injection = await archiveInjectionService.getInjection({
      sessionId: this.currentSessionId,
      scene: 'social.comment.generate',
      accountId: account.id,
      keywords: this.extractKeywords(post.content),
      maxTotalTokens: 400,
    });
    
    // ... 生成评论
  }
}
```

### 3.2 账号编辑集成

在账号编辑界面添绑定功能：

```vue
<!-- src/apps/weibo/components/AccountEditor.vue -->

<template>
  <div class="account-editor">
    <!-- 基本信息 -->
    <div class="form-section">
      <label>昵称</label>
      <input v-model="account.nickname" />
      
      <label>简介</label>
      <textarea v-model="account.bio" />
    </div>
    
    <!-- 档案绑定 -->
    <div class="form-section">
      <h3>档案绑定</h3>
      
      <div class="bound-archives">
        <div 
          v-for="archive in boundArchives" 
          :key="archive.id"
          class="archive-item"
        >
          <span>{{ getArchiveIcon(archive.type) }} {{ archive.name }}</span>
          <button @click="unbindArchive(archive.id)">解绑</button>
        </div>
      </div>
      
      <button @click="showArchiveSelector = true">
        + 绑定更多档案
      </button>
      
      <div class="injection-settings">
        <label>
          <input type="checkbox" v-model="account.archiveInjection.enabled" />
          生成内容时注入绑定档案
        </label>
        
        <label v-if="account.archiveInjection.enabled">
          最大 Token:
          <input type="number" v-model="account.archiveInjection.maxTokens" />
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { archiveBindingService } from '@/services';

const props = defineProps<{ accountId: string }>();

const boundArchives = ref([]);

onMounted(async () => {
  boundArchives.value = await archiveBindingService.getAccountArchives(props.accountId);
});

async function unbindArchive(archiveId: string) {
  await archiveBindingService.unbind(archiveId, props.accountId);
  boundArchives.value = boundArchives.value.filter(a => a.id !== archiveId);
}
</script>
```

---

## 4. 与系统提示词服务集成

核心知识（always 级别档案）自动注入到系统提示词中。

### 4.1 系统提示词构建

```typescript
// src/services/systemPromptService.ts

import { archiveInjectionService } from '@/services';

class SystemPromptService {
  /**
   * 构建完整的系统提示词
   */
  async buildSystemPrompt(context: PromptContext): Promise<string> {
    const parts: string[] = [];
    
    // 1. 基础系统提示词
    parts.push(this.getBasePrompt());
    
    // 2. 注入核心知识（always 级别的档案）
    if (context.sessionId) {
      const injection = await archiveInjectionService.getInjection({
        sessionId: context.sessionId,
        scene: 'system.core',
      });
      
      if (injection.coreKnowledge) {
        parts.push('');
        parts.push('--- 世界背景 ---');
        parts.push(injection.coreKnowledge);
      }
    }
    
    // 3. App 级系统提示词
    if (context.appId) {
      const appPrompt = this.getAppPrompt(context.appId);
      if (appPrompt) {
        parts.push('');
        parts.push(appPrompt);
      }
    }
    
    return parts.join('\n');
  }
}
```

### 4.2 变量注册

当前实现不再使用独立 PromptVariableRegistry，直接使用 `shared-context`：

```typescript
// 1) 注入服务发布上下文
contextSharingService.publish({
  id: 'archive:pinned',
  type: 'archive:pinned',
  description: 'Archive 核心知识（always）',
  value: coreKnowledge,
})

contextSharingService.publish({
  id: 'archive:relevant',
  type: 'archive:relevant',
  description: 'Archive 上下文匹配结果',
  value: relevantArchives,
})

// 2) Prompt 模板变量声明 shared-context 来源
const variable = {
  name: 'coreKnowledge',
  source: 'shared-context',
  sharedContextConfig: {
    contextId: 'archive:pinned',
    format: 'text',
  },
}
```

参考实现：

- `src/services/archive/injectionService.ts`
- `src/services/social/prompts.ts`
- `src/apps/weibo/prompts.ts`

---

## 5. 与通知系统集成

档案服务使用通知系统推送归档建议和完成通知。

### 5.1 通知类型

| 通知类型 | 优先级 | 场景 |
| -------- | ------ | ---- |
| `archive-suggestion` | `normal` | 自动归档建议 |
| `archive-complete` | `low` | 归档完成通知 |
| `archive-error` | `high` | 归档失败警告 |
| `archive-conflict` | `normal` | 档案冲突（同一内容多次归档） |

### 5.2 发送通知

```typescript
// src/services/archiveNotificationService.ts

import { notificationService } from '@/services';

class ArchiveNotificationService {
  /**
   * 发送归档建议通知
   */
  async sendSuggestion(
    sessionId: string,
    floorRange: { start: number; end: number }
  ): Promise<void> {
    const count = floorRange.end - floorRange.start + 1;
    
    await notificationService.push({
      appId: 'archives',
      title: '档案归档建议',
      body: `检测到 ${count} 层新内容，是否进行归档分析？`,
      priority: 'normal',
      category: 'archive-suggestion',
      actions: [
        { id: 'confirm', label: '开始归档' },
        { id: 'later', label: '稍后提醒' },
        { id: 'skip', label: '跳过' },
      ],
      route: `/archives?action=extract&start=${floorRange.start}&end=${floorRange.end}`,
      data: { sessionId, floorRange },
    });
  }
  
  /**
   * 发送归档完成通知
   */
  async sendComplete(
    sessionId: string,
    result: ExtractResult
  ): Promise<void> {
    const summary = [
      result.events.length > 0 && `${result.events.length} 个事件`,
      result.characterUpdates.length > 0 && `${result.characterUpdates.length} 个角色更新`,
      result.worldEntries.length > 0 && `${result.worldEntries.length} 个设定`,
    ].filter(Boolean).join('、');
    
    await notificationService.push({
      appId: 'archives',
      title: '归档完成',
      body: `已提取 ${summary}`,
      priority: 'low',
      category: 'archive-complete',
      route: '/archives',
    });
  }
  
  /**
   * 发送归档失败通知
   */
  async sendError(
    sessionId: string,
    error: string
  ): Promise<void> {
    await notificationService.push({
      appId: 'archives',
      title: '归档失败',
      body: error,
      priority: 'high',
      category: 'archive-error',
    });
  }
}

export const archiveNotificationService = new ArchiveNotificationService();
```

---

## 6. 与时间服务集成

档案的时间戳使用时间服务获取，支持模拟时间。

```typescript
import { timeService } from '@/services';

class ArchiveService {
  /**
   * 创建档案时使用时间服务
   */
  async createArchive(data: Partial<ArchiveBase>): Promise<ArchiveBase> {
    const now = timeService.now();
    
    const archive: ArchiveBase = {
      id: generateId(data.type ?? 'archive'),
      createdAt: now,
      lastUpdated: now,
      ...data,
    };
    
    await this.save(archive);
    return archive;
  }
  
  /**
   * 获取近期档案（支持模拟时间）
   */
  async getRecentArchives(
    sessionId: string,
    days: number = 7
  ): Promise<ArchiveBase[]> {
    const now = timeService.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    
    return archiveDB.archives
      .where('sessionId')
      .equals(sessionId)
      .filter(a => a.lastUpdated >= cutoff)
      .toArray();
  }
}
```

---

## 7. 与 LLM 任务服务集成

档案提取任务可以注册为 LLM 任务，支持自动执行。

### 7.1 任务定义

```typescript
// src/services/llmTask/tasks/archiveExtractTask.ts

import { TaskDefinition } from '@/types/llmTask';

export const archiveExtractTask: TaskDefinition = {
  id: 'archive.extract',
  name: '档案提取',
  description: '从聊天记录中提取档案信息',
  appId: 'archives',
  
  // 输入定义
  inputs: [
    {
      name: 'sessionId',
      type: 'string',
      required: true,
    },
    {
      name: 'floorRange',
      type: 'object',
      required: true,
    },
  ],
  
  // 执行函数
  execute: async (inputs, context) => {
    const { sessionId, floorRange } = inputs;
    
    // 获取楼层数据
    const floors = await archiveService.fetchFloors(floorRange);
    
    // 执行提取
    const result = await archiveExtractor.extract({
      sessionId,
      floors,
      context: context.archiveContext,
    });
    
    return {
      success: result.success,
      data: result,
    };
  },
  
  // 自动执行配置
  autoExecution: {
    enabled: false,  // 默认禁用，需要用户确认
    trigger: 'event',
    eventName: 'floors:updated',
  },
};
```

### 7.2 注册任务

```typescript
// src/services/llmTask/taskRegistry.ts

import { archiveExtractTask } from './tasks/archiveExtractTask';

class TaskRegistry {
  constructor() {
    // 注册档案相关任务
    this.register(archiveExtractTask);
  }
}
```

---

## 8. 与账号服务集成

档案绑定需要与账号服务协同工作。

### 8.1 账号类型扩展

```typescript
// src/types/account.ts

// 扩展 SocialAccount 类型
interface SocialAccount {
  // ... 现有字段 ...
  
  // 档案绑定（新增）
  boundArchiveIds?: string[];
  
  // 档案注入配置（新增）
  archiveInjection?: {
    enabled: boolean;
    maxTokens: number;
    includeRelated: boolean;
  };
}
```

### 8.2 账号服务扩展

```typescript
// src/services/account/accountService.ts

class AccountService {
  /**
   * 删除账号时清理档案绑定
   */
  async deleteAccount(accountId: string): Promise<void> {
    const account = await this.get(accountId);
    if (!account) return;
    
    // 清理档案绑定
    if (account.boundArchiveIds?.length) {
      for (const archiveId of account.boundArchiveIds) {
        await archiveBindingService.unbind(archiveId, accountId);
      }
    }
    
    // 删除账号
    await super.delete(accountId);
  }
}
```

---

## 9. 服务初始化

档案服务的初始化顺序和依赖关系：

```typescript
// src/services/index.ts

export async function initServices(): Promise<void> {
  // 1. 基础服务（无依赖）
  await timeService.init();
  await notificationService.init();
  
  // 2. 数据库初始化
  await archiveDB.init();
  
  // 3. 档案服务初始化
  await archiveService.init();
  await archiveInjectionService.init();
  await archiveDeduplicationService.init();
  
  // 4. 注册 Bridge 事件监听
  archiveService.registerBridgeListeners();
  
  // 5. 注册提示词变量
  promptVariableRegistry.registerArchiveVariables();
}
```

---

## 10. 完整使用示例

### 10.1 社交内容生成流程

```typescript
async function generateWeiboPost(topic: string, accountId: string): Promise<Post> {
  // 1. 获取账号信息
  const account = await accountService.get(accountId);
  
  // 2. 获取档案注入（自动处理绑定档案 + 关键词匹配 + 去重）
  const injection = await archiveInjectionService.getInjection({
    sessionId: currentSessionId,
    scene: 'social.post.generate.weibo',
    accountId,
    keywords: extractKeywords(topic),
    maxTotalTokens: 800,
  });
  
  // 3. 构建提示词
  const prompt = `
${injection.coreKnowledge}

${injection.accountContext}

相关背景：
${injection.relevantArchives}

请为账号「${account.nickname}」生成一条关于「${topic}」的微博：
  `;
  
  // 4. 调用 LLM
  const response = await aiGenerateService.generate(prompt);
  
  // 5. 记录本次注入（用于去重）
  archiveDeduplicationService.recordInjection(
    currentSessionId,
    injection.metadata.injectedArchiveIds
  );
  
  return parsePostFromResponse(response);
}
```

### 10.2 档案提取流程

```typescript
async function extractArchivesFromChat(
  sessionId: string,
  startFloor: number,
  endFloor: number
): Promise<ExtractResult> {
  // 1. 获取楼层数据
  const floors = await archiveService.fetchFloors({ start: startFloor, end: endFloor });
  
  // 2. 获取已有档案（用于增量更新）
  const existingArchives = await archiveService.getSessionArchives(sessionId);
  
  // 3. 执行提取
  const result = await archiveExtractor.extract({
    sessionId,
    floors,
    context: {
      worldSetting: existingArchives.worldSettings[0]?.description,
      mainCharacters: existingArchives.characters.map(c => c.name),
    },
  });
  
  // 4. 发送通知
  if (result.success) {
    await archiveNotificationService.sendComplete(sessionId, result);
  } else {
    await archiveNotificationService.sendError(sessionId, result.error!);
  }
  
  return result;
}
```

---

## 11. 最佳实践

### ✅ 推荐做法

1. **按需注入**：根据场景选择合适的注入内容，避免注入无关档案
2. **监控 Token 使用**：定期检查注入内容的 Token 占用
3. **及时更新绑定**：账号角色变化时更新档案绑定
4. **处理错误**：集成时妥善处理服务不可用的情况

### ❌ 避免做法

1. **忽略初始化顺序**：档案服务依赖其他服务，需按顺序初始化
2. **硬编码 Token 限制**：使用配置而非硬编码
3. **忽略去重记录**：每次注入后应记录，供后续去重使用
