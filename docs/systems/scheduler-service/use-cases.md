# 使用场景与最佳实践

> **版本**: 1.0  
> **最后更新**: 2026-01-16

本文档介绍定时任务服务的典型使用场景和最佳实践。

## 1. 典型使用场景

### 1.1 社交媒体模拟

#### 热搜定期刷新

模拟真实社交平台的热搜更新节奏：

```typescript
schedulerService.register({
  id: 'weibo:trending:refresh',
  appId: 'weibo',
  name: '热搜刷新',
  schedule: {
    type: 'interval',
    ms: 10 * 60 * 1000  // 每 10 分钟
  },
  handler: async () => {
    const trendingService = useTrendingService()
    
    // 判断是否需要刷新（可能有缓存策略）
    if (trendingService.shouldRefresh()) {
      await trendingService.refreshTrending()
      
      // 发送更新事件
      eventBus.emit('content:trending:updated', {
        platformId: 'weibo',
        timestamp: Date.now()
      })
    }
  },
  enabled: true
})
```

#### 粉丝增长结算

每小时结算玩家账号的粉丝增长：

```typescript
schedulerService.register({
  id: 'weibo:growth:hourly',
  appId: 'weibo',
  name: '粉丝增长结算',
  schedule: {
    type: 'interval',
    ms: 60 * 60 * 1000  // 每小时
  },
  handler: async () => {
    const growthEngine = useFollowerGrowthEngine()
    const playerAccounts = await getPlayerAccounts()
    
    for (const account of playerAccounts) {
      const growth = await growthEngine.calculateHourlyGrowth(account.id)
      await growthEngine.applyGrowth(account.id, growth)
      
      // 如果有显著增长，发送通知
      if (growth.newFollowers > 100) {
        notificationService.notify({
          title: '粉丝增长',
          body: `你新增了 ${growth.newFollowers} 位粉丝！`,
          appId: 'weibo'
        })
      }
    }
  },
  enabled: true
})
```

#### 定时博文生成

模拟 NPC 定时发布博文：

```typescript
schedulerService.register({
  id: 'weibo:npc:post',
  appId: 'weibo',
  name: 'NPC 定时发布',
  schedule: {
    type: 'interval',
    ms: 30 * 60 * 1000  // 每 30 分钟
  },
  handler: async () => {
    const contentFactory = useContentFactory()
    const npcAccounts = await getNpcAccounts()
    
    // 随机选择几个 NPC 发布内容
    const selectedNpcs = randomSelect(npcAccounts, 3)
    
    for (const npc of selectedNpcs) {
      // 根据 NPC 人设生成博文
      const post = await contentFactory.generatePost({
        authorId: npc.id,
        persona: npc.persona,
        topics: await getCurrentHotTopics()
      })
      
      await savePost(post)
    }
  },
  enabled: true
})
```

### 1.2 LLM 任务调度

#### 自动执行待处理任务

定期检查并执行 LLM 任务：

```typescript
schedulerService.register({
  id: 'llm-task:auto-execute',
  appId: 'llm-task-service',
  name: 'LLM 任务自动执行',
  schedule: {
    type: 'interval',
    ms: 5 * 60 * 1000  // 每 5 分钟
  },
  handler: async () => {
    const taskService = useLlmTaskService()
    const pendingTasks = await taskService.getPendingTasks()
    
    for (const task of pendingTasks) {
      // 检查任务是否满足执行条件
      if (await task.shouldExecute()) {
        try {
          await taskService.execute(task.id)
        } catch (error) {
          console.error(`Task ${task.id} failed:`, error)
        }
      }
    }
  },
  retryOnFail: 2,
  timeout: 60000,  // LLM 任务可能需要较长时间
  enabled: true
})
```

#### 新消息触发任务

收到新消息时触发相关 LLM 任务：

```typescript
schedulerService.register({
  id: 'llm-task:message-trigger',
  appId: 'llm-task-service',
  name: '消息触发任务',
  schedule: {
    type: 'event',
    eventName: 'session:message:new',
    debounce: 2000  // 2 秒防抖，等待消息稳定
  },
  handler: async () => {
    const taskService = useLlmTaskService()
    const triggeredTasks = await taskService.getMessageTriggeredTasks()
    
    for (const task of triggeredTasks) {
      await taskService.execute(task.id)
    }
  },
  enabled: true
})
```

### 1.3 档案管理

#### 自动档案提取

新对话内容时自动检查是否需要提取档案：

```typescript
schedulerService.register({
  id: 'archives:extraction:check',
  appId: 'archives',
  name: '档案提取检查',
  schedule: {
    type: 'event',
    eventName: 'session:message:new',
    debounce: 5000  // 5 秒防抖
  },
  handler: async () => {
    const archiveService = useArchiveService()
    const recentFloors = await getRecentFloors(10)
    
    // 检查是否有值得提取的内容
    const candidates = await archiveService.analyzeForExtraction(recentFloors)
    
    if (candidates.length > 0) {
      for (const candidate of candidates) {
        await archiveService.extractAndSave(candidate)
      }
    }
  },
  enabled: true
})
```

#### 档案去重维护

定期清理重复或过时的档案：

```typescript
schedulerService.register({
  id: 'archives:maintenance:dedup',
  appId: 'archives',
  name: '档案去重维护',
  schedule: {
    type: 'cron',
    expression: '0 2 * * *'  // 每天凌晨 2 点
  },
  handler: async () => {
    const archiveService = useArchiveService()
    
    // 查找重复档案
    const duplicates = await archiveService.findDuplicates()
    
    // 合并或删除重复项
    for (const group of duplicates) {
      await archiveService.mergeDuplicates(group)
    }
    
    console.log(`档案维护完成，处理了 ${duplicates.length} 组重复项`)
  },
  enabled: true
})
```

### 1.4 系统维护

#### 数据清理

定期清理过期数据：

```typescript
schedulerService.register({
  id: 'system:cleanup:daily',
  appId: 'system',
  name: '每日数据清理',
  schedule: {
    type: 'cron',
    expression: '0 3 * * *'  // 每天凌晨 3 点
  },
  handler: async () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    
    // 清理过期的帖子缓存
    const postsCleared = await clearExpiredPosts(thirtyDaysAgo)
    
    // 清理过期的执行日志
    const logsCleared = await clearExpiredLogs(thirtyDaysAgo)
    
    // 清理过期的通知
    const notificationsCleared = await clearExpiredNotifications(thirtyDaysAgo)
    
    console.log('每日清理完成:', {
      posts: postsCleared,
      logs: logsCleared,
      notifications: notificationsCleared
    })
  },
  enabled: true
})
```

#### 数据备份

定期备份重要数据：

```typescript
schedulerService.register({
  id: 'system:backup:weekly',
  appId: 'system',
  name: '每周数据备份',
  schedule: {
    type: 'cron',
    expression: '0 2 * * 0'  // 每周日凌晨 2 点
  },
  handler: async () => {
    const backupService = useBackupService()
    
    // 备份核心数据
    await backupService.backup({
      include: ['accounts', 'archives', 'settings'],
      format: 'json'
    })
    
    // 清理旧备份（保留最近 4 份）
    await backupService.cleanupOldBackups(4)
    
    notificationService.notify({
      title: '数据备份',
      body: '每周数据备份已完成',
      type: 'info',
      appId: 'system'
    })
  },
  enabled: true
})
```

#### 健康检查

定期检查系统健康状态：

```typescript
schedulerService.register({
  id: 'system:health:check',
  appId: 'system',
  name: '系统健康检查',
  schedule: {
    type: 'interval',
    ms: 5 * 60 * 1000  // 每 5 分钟
  },
  handler: async () => {
    const healthService = useHealthService()
    
    const status = await healthService.check()
    
    if (!status.healthy) {
      console.error('系统健康检查失败:', status.issues)
      
      // 尝试自动修复
      for (const issue of status.issues) {
        if (issue.autoFixable) {
          await healthService.fix(issue)
        }
      }
      
      // 严重问题通知用户
      if (status.issues.some(i => i.severity === 'critical')) {
        notificationService.notify({
          title: '系统警告',
          body: '检测到系统问题，请检查',
          type: 'error',
          appId: 'system'
        })
      }
    }
  },
  enabled: true
})
```

### 1.5 通知与提醒

#### 定时提醒

用户设置的定时提醒：

```typescript
function createReminder(reminder: Reminder) {
  schedulerService.register({
    id: `reminder:${reminder.id}`,
    appId: 'reminders',
    name: reminder.title,
    schedule: {
      type: 'cron',
      expression: toCronExpression(reminder.time)  // 转换为 Cron
    },
    handler: async () => {
      notificationService.notify({
        title: reminder.title,
        body: reminder.body,
        type: 'reminder',
        appId: 'reminders'
      })
      
      // 如果是一次性提醒，完成后注销
      if (!reminder.repeat) {
        schedulerService.unregister(`reminder:${reminder.id}`)
      }
    },
    enabled: true
  })
}
```

#### 活动通知

游戏或剧情中的定时活动：

```typescript
schedulerService.register({
  id: 'game:event:check',
  appId: 'game',
  name: '活动检查',
  schedule: {
    type: 'interval',
    ms: 60 * 1000  // 每分钟检查
  },
  handler: async () => {
    const timeService = useTimeService()
    const currentTime = timeService.getCurrentTime()
    const currentHour = currentTime.getHours()
    
    // 检查是否有活动开始
    const events = await getScheduledEvents()
    
    for (const event of events) {
      if (event.startHour === currentHour && !event.notified) {
        notificationService.notify({
          title: event.title,
          body: event.description,
          type: 'event',
          appId: 'game'
        })
        
        await markEventNotified(event.id)
      }
    }
  },
  enabled: true
})
```

## 2. 最佳实践

### 2.1 任务设计原则

#### 单一职责

每个任务只做一件事：

```typescript
// ❌ 不好：一个任务做太多事情
schedulerService.register({
  id: 'system:all-in-one',
  handler: async () => {
    await refreshTrending()
    await settleFollowerGrowth()
    await cleanupExpiredData()
    await checkArchives()
  }
})

// ✅ 好：拆分为独立任务
schedulerService.register({
  id: 'weibo:trending:refresh',
  handler: async () => { await refreshTrending() }
})

schedulerService.register({
  id: 'weibo:growth:settle',
  handler: async () => { await settleFollowerGrowth() }
})

schedulerService.register({
  id: 'system:cleanup',
  handler: async () => { await cleanupExpiredData() }
})
```

#### 幂等性

任务应该是幂等的，重复执行不会产生问题：

```typescript
// ❌ 不好：重复执行会产生重复数据
handler: async () => {
  const post = createPost()
  await savePost(post)  // 每次都创建新帖子
}

// ✅ 好：幂等设计
handler: async () => {
  // 先检查是否已经执行过
  const lastRun = await getLastRunTime('generate-daily-post')
  const today = new Date().toDateString()
  
  if (lastRun && new Date(lastRun).toDateString() === today) {
    return  // 今天已经执行过
  }
  
  const post = createPost()
  await savePost(post)
  await setLastRunTime('generate-daily-post', Date.now())
}
```

#### 优雅失败

任务失败时应该优雅处理：

```typescript
handler: async () => {
  const items = await getItemsToProcess()
  const results = { success: 0, failed: 0, errors: [] }
  
  for (const item of items) {
    try {
      await processItem(item)
      results.success++
    } catch (error) {
      results.failed++
      results.errors.push({ item: item.id, error: error.message })
      // 单个失败不影响其他
    }
  }
  
  // 记录结果
  console.log('任务执行结果:', results)
  
  // 如果失败率过高，抛出错误触发重试
  if (results.failed > results.success) {
    throw new Error(`失败率过高: ${results.failed}/${items.length}`)
  }
}
```

### 2.2 性能优化

#### 合理设置间隔

根据实际需求设置合适的执行间隔：

```typescript
// 实时性要求高
schedule: { type: 'interval', ms: 30 * 1000 }  // 30 秒

// 一般数据同步
schedule: { type: 'interval', ms: 5 * 60 * 1000 }  // 5 分钟

// 不紧急的清理任务
schedule: { type: 'cron', expression: '0 3 * * *' }  // 每天凌晨
```

#### 批量处理

避免在任务中处理大量数据：

```typescript
// ❌ 不好：一次处理所有数据
handler: async () => {
  const allItems = await getAllItems()  // 可能有 10000 条
  for (const item of allItems) {
    await process(item)  // 耗时操作
  }
}

// ✅ 好：分批处理
handler: async () => {
  const batchSize = 100
  const batch = await getNextBatch(batchSize)
  
  if (batch.length === 0) {
    return  // 没有待处理数据
  }
  
  for (const item of batch) {
    await process(item)
  }
  
  // 下次执行时会处理下一批
}
```

#### 避免阻塞

长时间任务应该设置超时：

```typescript
schedulerService.register({
  id: 'long-task',
  handler: async () => {
    // 可能耗时较长的操作
  },
  timeout: 120000,  // 2 分钟超时
  retryOnFail: 1    // 失败重试 1 次
})
```

### 2.3 错误处理

#### 分级错误处理

```typescript
handler: async () => {
  try {
    await criticalOperation()
  } catch (error) {
    // 关键错误：记录并通知
    console.error('关键操作失败:', error)
    notificationService.notify({
      title: '系统错误',
      body: '关键操作失败，请检查',
      type: 'error'
    })
    throw error  // 触发重试
  }
  
  try {
    await optionalOperation()
  } catch (error) {
    // 可选操作失败：仅记录
    console.warn('可选操作失败:', error)
    // 不抛出，不影响任务结果
  }
}
```

#### 监控和告警

```typescript
// 监听任务失败事件
eventBus.on('scheduler:task:failed', (event) => {
  // 记录到日志
  loggerService.error('Task failed', {
    taskId: event.taskId,
    error: event.error
  })
  
  // 连续失败告警
  const task = schedulerService.getTask(event.taskId)
  if (task && task.failCount >= 3) {
    notificationService.notify({
      title: '任务异常',
      body: `任务 "${task.name}" 已连续失败 ${task.failCount} 次`,
      type: 'error'
    })
  }
})
```

### 2.4 测试和调试

#### 开发环境配置

```typescript
const isDev = import.meta.env.DEV

// 开发环境使用更短间隔，方便测试
const refreshInterval = isDev 
  ? 30 * 1000      // 开发: 30 秒
  : 10 * 60 * 1000 // 生产: 10 分钟

schedulerService.register({
  id: 'my-task',
  schedule: { type: 'interval', ms: refreshInterval },
  // ...
})
```

#### 调试工具

```typescript
// 开发环境暴露调试接口
if (import.meta.env.DEV) {
  window.__scheduler__ = {
    // 列出所有任务
    list: () => schedulerService.getAllTasks(),
    
    // 获取任务详情
    get: (id: string) => schedulerService.getTask(id),
    
    // 手动触发
    trigger: (id: string) => schedulerService.trigger(id),
    
    // 暂停/恢复
    pause: (id: string) => schedulerService.pause(id),
    resume: (id: string) => schedulerService.resume(id),
    
    // 统计
    stats: () => schedulerService.getStatistics()
  }
}
```

## 3. 常见模式

### 3.1 领导者选举模式

当有多个实例时，确保只有一个执行任务：

```typescript
schedulerService.register({
  id: 'singleton-task',
  handler: async () => {
    // 尝试获取锁
    const lock = await acquireLock('singleton-task', 60000)
    if (!lock) {
      console.log('其他实例正在执行，跳过')
      return
    }
    
    try {
      await doWork()
    } finally {
      await releaseLock('singleton-task')
    }
  }
})
```

### 3.2 渐进式退避模式

失败后增加等待时间：

```typescript
const taskState = { consecutiveFailures: 0 }

schedulerService.register({
  id: 'backoff-task',
  schedule: {
    type: 'interval',
    ms: 60000  // 基础间隔 1 分钟
  },
  handler: async () => {
    // 根据失败次数计算额外等待
    if (taskState.consecutiveFailures > 0) {
      const backoffTime = Math.min(
        1000 * Math.pow(2, taskState.consecutiveFailures),
        300000  // 最多 5 分钟
      )
      await sleep(backoffTime)
    }
    
    try {
      await doWork()
      taskState.consecutiveFailures = 0  // 成功后重置
    } catch (error) {
      taskState.consecutiveFailures++
      throw error
    }
  }
})
```

### 3.3 优先级队列模式

高优先级任务优先执行：

```typescript
const taskQueue: Array<{ priority: number; task: () => Promise<void> }> = []

schedulerService.register({
  id: 'priority-queue-processor',
  schedule: { type: 'interval', ms: 1000 },
  handler: async () => {
    if (taskQueue.length === 0) return
    
    // 按优先级排序
    taskQueue.sort((a, b) => b.priority - a.priority)
    
    // 执行最高优先级任务
    const item = taskQueue.shift()!
    await item.task()
  }
})

// 添加任务到队列
function enqueue(task: () => Promise<void>, priority: number = 0) {
  taskQueue.push({ priority, task })
}
```

### 3.4 条件执行模式

只在特定条件下执行：

```typescript
schedulerService.register({
  id: 'conditional-task',
  schedule: { type: 'interval', ms: 60000 },
  handler: async () => {
    // 检查执行条件
    const conditions = {
      isOnline: navigator.onLine,
      hasPermission: await checkPermission(),
      isActiveSession: sessionStore.isActive,
      isWorkingHours: isWithinWorkingHours()
    }
    
    if (!Object.values(conditions).every(Boolean)) {
      console.log('条件不满足，跳过执行:', conditions)
      return
    }
    
    await doWork()
  }
})
```

## 4. 故障排除

### 4.1 任务不执行

**检查清单：**

1. 任务是否已注册？
   ```typescript
   console.log(schedulerService.getTask('task-id'))
   ```

2. 任务是否启用？
   ```typescript
   const task = schedulerService.getTask('task-id')
   console.log(task?.enabled)  // 应该是 true
   ```

3. 调度器是否启动？
   ```typescript
   // 确保调用了 start()
   schedulerService.start()
   ```

4. 对于事件触发任务，事件是否正确发送？
   ```typescript
   eventBus.emit('your:event:name', payload)
   ```

### 4.2 任务执行失败

**检查清单：**

1. 检查执行日志：
   ```typescript
   const history = schedulerService.getExecutionHistory('task-id', 10)
   history.forEach(log => console.log(log))
   ```

2. 检查超时设置是否合理

3. 检查 handler 是否正确返回 Promise

4. 检查依赖服务是否可用

### 4.3 内存泄漏

**检查清单：**

1. 确保任务在不需要时注销：
   ```typescript
   onUnmounted(() => {
     schedulerService.unregister('my-task')
   })
   ```

2. 避免在 handler 中创建闭包引用大对象

3. 定期清理执行历史
