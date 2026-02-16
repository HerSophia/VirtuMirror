# 集成指南

> **版本**: 1.1  
> **最后更新**: 2026-02-07

本文档给出 `Scheduler Service v1.0` 在现有代码结构中的真实接入方式。

## 1. 基础接入

### 1.1 导入路径

```ts
import { schedulerService } from '@/services/scheduler'
```

### 1.2 应用启动时启动调度器

```ts
import { schedulerService } from '@/services/scheduler'

schedulerService.start()
```

### 1.3 应用退出或销毁时停止（可选）

```ts
schedulerService.stop()
```

## 2. 注册任务

### 2.1 interval：固定间隔轮询

```ts
schedulerService.register({
  id: 'weibo:trending:refresh',
  appId: 'weibo',
  name: '热搜刷新',
  schedule: { type: 'interval', ms: 5 * 60 * 1000 },
  retryOnFail: 2,
  timeout: 15_000,
  handler: async () => {
    await refreshTrending()
  },
})
```

### 2.2 cron：规则时间执行

```ts
schedulerService.register({
  id: 'system:cleanup:daily',
  appId: 'system',
  name: '每日清理',
  schedule: { type: 'cron', expression: '0 3 * * *' },
  handler: async () => {
    await cleanupExpiredData()
  },
})
```

### 2.3 event：事件触发执行

```ts
schedulerService.register({
  id: 'archive:auto-check',
  appId: 'archive',
  name: '会话消息后档案检查',
  schedule: {
    type: 'event',
    eventName: 'session:message:new',
    debounce: 1_500,
  },
  handler: async () => {
    await checkArchiveExtraction()
  },
})
```

## 3. 任务生命周期控制

```ts
// 暂停 / 恢复
schedulerService.pause('weibo:trending:refresh')
schedulerService.resume('weibo:trending:refresh')

// 立即触发
await schedulerService.trigger('weibo:trending:refresh')

// 注销
schedulerService.unregister('weibo:trending:refresh')
```

## 4. 监听调度事件

```ts
import { eventBus } from '@/services/eventBus'
import { SCHEDULER_EVENTS } from '@/services/scheduler'

eventBus.on(SCHEDULER_EVENTS.TASK_FAILED, (payload) => {
  console.error('任务失败', payload.taskId, payload.result.error)
})

eventBus.on(SCHEDULER_EVENTS.TASK_TIMEOUT, (payload) => {
  console.warn('任务超时', payload.taskId, payload.result.duration)
})
```

## 5. 与 TimeService 的关系

- Scheduler 默认使用 `TimeService` 当前时间（用于 `cron nextRun` 计算与执行时间戳）
- 在测试中可通过依赖注入 `now` 覆盖时间源，配合 fake timers 做稳定验证
