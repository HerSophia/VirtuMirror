# 集成指南

> **版本**: 1.0  
> **最后更新**: 2026-01-16

本文档介绍如何在应用中集成和使用定时任务服务。

## 1. 基础集成

### 1.1 导入服务

```typescript
import { schedulerService } from '@/services/schedulerService'
```

### 1.2 在应用中注册任务

推荐在应用的 `onMounted` 或初始化阶段注册任务：

```typescript
// 在 Vue 组件中
import { onMounted, onUnmounted } from 'vue'
import { schedulerService } from '@/services/schedulerService'

const APP_ID = 'my-app'
const taskIds: string[] = []

onMounted(() => {
  // 注册定时任务
  const taskId = schedulerService.register({
    id: `${APP_ID}:data:refresh`,
    appId: APP_ID,
    name: '数据刷新',
    schedule: {
      type: 'interval',
      ms: 5 * 60 * 1000  // 每 5 分钟
    },
    handler: async () => {
      await refreshData()
    },
    enabled: true
  })
  
  taskIds.push(taskId)
})

onUnmounted(() => {
  // 清理任务
  taskIds.forEach(id => schedulerService.unregister(id))
})
```

### 1.3 在 Store 中注册任务

对于需要在 Store 中管理的任务，可以在 Store 初始化时注册：

```typescript
// stores/myAppStore.ts
import { defineStore } from 'pinia'
import { schedulerService } from '@/services/schedulerService'

export const useMyAppStore = defineStore('my-app', {
  state: () => ({
    data: [],
    taskRegistered: false
  }),
  
  actions: {
    init() {
      if (this.taskRegistered) return
      
      schedulerService.register({
        id: 'my-app:sync',
        appId: 'my-app',
        name: '数据同步',
        schedule: { type: 'interval', ms: 60000 },
        handler: async () => {
          await this.syncData()
        },
        enabled: true
      })
      
      this.taskRegistered = true
    },
    
    async syncData() {
      // 同步逻辑
    },
    
    cleanup() {
      schedulerService.unregister('my-app:sync')
      this.taskRegistered = false
    }
  }
})
```

## 2. 与其他服务集成

### 2.1 与 LLM Task Service 集成

定时任务服务可以用于调度 LLM 任务的自动执行：

```typescript
import { schedulerService } from '@/services/schedulerService'
import { llmTaskService } from '@/services/llmTaskService'

// 注册 LLM 任务自动执行调度
schedulerService.register({
  id: 'llm-task:auto-execute',
  appId: 'system',
  name: 'LLM 任务自动执行',
  schedule: {
    type: 'interval',
    ms: 5 * 60 * 1000  // 每 5 分钟检查
  },
  handler: async () => {
    const pendingTasks = llmTaskService.getPendingTasks()
    for (const task of pendingTasks) {
      if (task.shouldAutoExecute()) {
        await llmTaskService.execute(task.id)
      }
    }
  },
  enabled: true
})
```

### 2.2 与 EventBus 集成

使用事件触发调度响应系统事件：

```typescript
import { schedulerService } from '@/services/schedulerService'

// 新消息时检查档案
schedulerService.register({
  id: 'archives:check',
  appId: 'archives',
  name: '档案检查',
  schedule: {
    type: 'event',
    eventName: 'session:message:new',
    debounce: 1000  // 1 秒防抖
  },
  handler: async () => {
    await checkForArchiveExtraction()
  },
  enabled: true
})

// 会话切换时刷新数据
schedulerService.register({
  id: 'my-app:session-refresh',
  appId: 'my-app',
  name: '会话切换刷新',
  schedule: {
    type: 'event',
    eventName: 'session:changed'
  },
  handler: async () => {
    await refreshForNewSession()
  },
  enabled: true
})
```

### 2.3 与 TimeService 集成

在模拟时间模式下，定时任务会使用模拟时间：

```typescript
import { schedulerService } from '@/services/schedulerService'
import { timeService } from '@/services/timeService'

// Cron 任务会尊重模拟时间
schedulerService.register({
  id: 'game:daily-reset',
  appId: 'game',
  name: '每日重置',
  schedule: {
    type: 'cron',
    expression: '0 0 * * *'  // 每天 0 点（按模拟时间）
  },
  handler: async () => {
    await resetDailyData()
  },
  enabled: true
})

// 在 RP 模式下，可能需要根据模拟时间来判断
schedulerService.register({
  id: 'rp:time-based-event',
  appId: 'rp-system',
  name: '时间触发事件',
  schedule: {
    type: 'interval',
    ms: 60000
  },
  handler: async () => {
    const currentHour = timeService.getCurrentTime().getHours()
    if (currentHour >= 6 && currentHour < 12) {
      await triggerMorningEvents()
    } else if (currentHour >= 18 && currentHour < 22) {
      await triggerEveningEvents()
    }
  },
  enabled: true
})
```

### 2.4 与 Notification Service 集成

任务执行结果可以通过通知服务告知用户：

```typescript
import { schedulerService } from '@/services/schedulerService'
import { notificationService } from '@/services/notificationService'
import { eventBus } from '@/services/eventBus'

// 监听任务失败事件
eventBus.on('scheduler:task:failed', (event) => {
  notificationService.notify({
    title: '定时任务失败',
    body: `任务 "${event.taskName}" 执行失败: ${event.error}`,
    type: 'error',
    appId: event.appId
  })
})

// 监听重要任务完成
eventBus.on('scheduler:task:completed', (event) => {
  if (event.taskId.includes('important')) {
    notificationService.notify({
      title: '任务完成',
      body: `${event.taskName} 已完成`,
      type: 'success',
      appId: event.appId
    })
  }
})
```

## 3. 使用模式

### 3.1 后台数据同步

```typescript
// 定期从服务器同步数据
schedulerService.register({
  id: 'app:sync:server',
  appId: 'my-app',
  name: '服务器同步',
  schedule: {
    type: 'interval',
    ms: 30 * 60 * 1000  // 每 30 分钟
  },
  handler: async () => {
    try {
      const data = await fetchFromServer()
      await updateLocalData(data)
      console.log('同步成功')
    } catch (error) {
      console.error('同步失败:', error)
      throw error  // 抛出以触发重试
    }
  },
  retryOnFail: 3,
  timeout: 30000,
  enabled: true
})
```

### 3.2 定期清理

```typescript
// 每天凌晨清理过期数据
schedulerService.register({
  id: 'system:cleanup:daily',
  appId: 'system',
  name: '每日清理',
  schedule: {
    type: 'cron',
    expression: '0 3 * * *'  // 每天 03:00
  },
  handler: async () => {
    const expiredBefore = Date.now() - 30 * 24 * 60 * 60 * 1000  // 30 天前
    
    await cleanupExpiredPosts(expiredBefore)
    await cleanupExpiredLogs(expiredBefore)
    await cleanupExpiredCache()
    
    console.log('每日清理完成')
  },
  enabled: true
})
```

### 3.3 内容自动生成

```typescript
// 热搜定期刷新
schedulerService.register({
  id: 'weibo:trending:refresh',
  appId: 'weibo',
  name: '热搜刷新',
  schedule: {
    type: 'interval',
    ms: 10 * 60 * 1000  // 每 10 分钟
  },
  handler: async () => {
    await trendingService.refreshTrending()
  },
  enabled: true
})

// 粉丝增长结算
schedulerService.register({
  id: 'weibo:growth:settle',
  appId: 'weibo',
  name: '粉丝增长结算',
  schedule: {
    type: 'interval',
    ms: 60 * 60 * 1000  // 每小时
  },
  handler: async () => {
    await followerGrowthEngine.settleHourlyGrowth()
  },
  enabled: true
})
```

### 3.4 响应式任务

```typescript
// 新帖子时触发评论生成
schedulerService.register({
  id: 'weibo:comments:generate',
  appId: 'weibo',
  name: '评论生成',
  schedule: {
    type: 'event',
    eventName: 'content:post:created',
    debounce: 2000  // 2 秒防抖，等待批量帖子创建完成
  },
  handler: async () => {
    const recentPosts = await getRecentPostsWithoutComments()
    for (const post of recentPosts) {
      await generateCommentsForPost(post.id)
    }
  },
  enabled: true
})
```

## 4. 任务管理 UI

### 4.1 在设置中显示任务列表

```vue
<template>
  <div class="task-manager">
    <h3>定时任务管理</h3>
    
    <div v-for="task in tasks" :key="task.id" class="task-item">
      <div class="task-info">
        <span class="task-name">{{ task.name }}</span>
        <span class="task-app">({{ task.appId }})</span>
        <span class="task-status" :class="{ enabled: task.enabled }">
          {{ task.enabled ? '运行中' : '已暂停' }}
        </span>
      </div>
      
      <div class="task-meta">
        <span v-if="task.lastRunAt">
          上次执行: {{ formatTime(task.lastRunAt) }}
        </span>
        <span v-if="task.nextRunAt">
          下次执行: {{ formatTime(task.nextRunAt) }}
        </span>
      </div>
      
      <div class="task-actions">
        <button @click="toggleTask(task.id)">
          {{ task.enabled ? '暂停' : '恢复' }}
        </button>
        <button @click="triggerTask(task.id)">立即执行</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { schedulerService } from '@/services/schedulerService'

const tasks = computed(() => schedulerService.getAllTasks())

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function toggleTask(taskId: string) {
  const task = schedulerService.getTask(taskId)
  if (task?.enabled) {
    schedulerService.pause(taskId)
  } else {
    schedulerService.resume(taskId)
  }
}

async function triggerTask(taskId: string) {
  const result = await schedulerService.trigger(taskId)
  if (result.success) {
    alert('执行成功')
  } else {
    alert(`执行失败: ${result.error}`)
  }
}
</script>
```

### 4.2 任务执行历史

```vue
<template>
  <div class="execution-history">
    <h4>执行历史</h4>
    
    <div v-for="log in history" :key="log.id" class="log-item">
      <span class="log-time">{{ formatTime(log.startTime) }}</span>
      <span class="log-result" :class="log.result">
        {{ resultText(log.result) }}
      </span>
      <span class="log-duration">{{ log.duration }}ms</span>
      <span v-if="log.error" class="log-error">{{ log.error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { schedulerService } from '@/services/schedulerService'

const props = defineProps<{
  taskId: string
}>()

const history = ref<TaskExecutionLog[]>([])

onMounted(async () => {
  history.value = await schedulerService.getExecutionHistory(props.taskId, 20)
})

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function resultText(result: string) {
  const map = {
    success: '成功',
    failed: '失败',
    timeout: '超时',
    cancelled: '取消'
  }
  return map[result] || result
}
</script>
```

## 5. 调试技巧

### 5.1 开发环境快速测试

```typescript
// 开发时使用更短的间隔
const isDev = import.meta.env.DEV

schedulerService.register({
  id: 'my-app:task',
  appId: 'my-app',
  name: '测试任务',
  schedule: {
    type: 'interval',
    ms: isDev ? 10000 : 300000  // 开发环境 10 秒，生产环境 5 分钟
  },
  handler: async () => {
    console.log('任务执行')
  },
  enabled: true
})
```

### 5.2 手动触发测试

```typescript
// 在控制台中测试任务
window.__debug__ = {
  scheduler: schedulerService,
  
  // 列出所有任务
  listTasks() {
    return schedulerService.getAllTasks().map(t => ({
      id: t.id,
      name: t.name,
      enabled: t.enabled,
      lastRunAt: t.lastRunAt ? new Date(t.lastRunAt).toLocaleString() : 'never'
    }))
  },
  
  // 触发指定任务
  async trigger(taskId: string) {
    return await schedulerService.trigger(taskId)
  }
}
```

### 5.3 日志输出

```typescript
import { eventBus } from '@/services/eventBus'

// 开发环境启用详细日志
if (import.meta.env.DEV) {
  eventBus.on('scheduler:task:started', (e) => {
    console.log(`[Scheduler] 开始: ${e.taskName}`)
  })
  
  eventBus.on('scheduler:task:completed', (e) => {
    console.log(`[Scheduler] 完成: ${e.taskName} (${e.result.duration}ms)`)
  })
  
  eventBus.on('scheduler:task:failed', (e) => {
    console.error(`[Scheduler] 失败: ${e.taskName}`, e.error)
  })
}
```

## 6. 注意事项

### 6.1 避免重复注册

```typescript
// ❌ 错误：可能导致重复注册
onMounted(() => {
  schedulerService.register({ id: 'my-task', ... })
})

// ✅ 正确：检查是否已注册
onMounted(() => {
  if (!schedulerService.getTask('my-task')) {
    schedulerService.register({ id: 'my-task', ... })
  }
})

// ✅ 更好：使用唯一 ID 或在 Store 中管理
const store = useMyStore()
store.initScheduledTasks()  // Store 内部管理注册状态
```

### 6.2 正确处理任务错误

```typescript
// ❌ 错误：吞掉错误，无法触发重试
handler: async () => {
  try {
    await doSomething()
  } catch (error) {
    console.error(error)
    // 错误被吞掉，不会重试
  }
}

// ✅ 正确：记录后重新抛出
handler: async () => {
  try {
    await doSomething()
  } catch (error) {
    console.error('任务执行失败:', error)
    throw error  // 重新抛出以触发重试
  }
}
```

### 6.3 避免长时间任务

```typescript
// ❌ 错误：任务可能执行很长时间
handler: async () => {
  const allItems = await getAllItems()  // 可能有 10000 个
  for (const item of allItems) {
    await processItem(item)  // 每个 100ms
  }
}

// ✅ 正确：分批处理
handler: async () => {
  const batch = await getNextBatch(100)  // 每次处理 100 个
  for (const item of batch) {
    await processItem(item)
  }
}
```

### 6.4 资源清理

```typescript
// 应用卸载时务必清理任务
onUnmounted(() => {
  // 方式 1：逐个注销
  schedulerService.unregister('my-app:task1')
  schedulerService.unregister('my-app:task2')
  
  // 方式 2：批量注销应用的所有任务
  const tasks = schedulerService.getTasksByApp('my-app')
  tasks.forEach(t => schedulerService.unregister(t.id))
})
```

## 7. 常见问题

### Q: 任务不执行怎么办？

1. 检查任务是否已注册：`schedulerService.getTask('task-id')`
2. 检查任务是否启用：`task.enabled` 应为 `true`
3. 检查调度器是否启动：`schedulerService.start()`
4. 对于事件触发任务，检查事件是否正确发送

### Q: 任务执行失败后不重试？

确保：
1. 设置了 `retryOnFail` 参数
2. handler 函数正确抛出了错误（不要吞掉错误）

### Q: 如何在任务之间共享状态？

使用 Pinia Store 或其他状态管理：

```typescript
handler: async () => {
  const store = useMyStore()
  await store.doSomething()
}
```

### Q: Cron 表达式不工作？

检查表达式格式是否正确，可以使用在线工具验证：
- https://crontab.guru/
