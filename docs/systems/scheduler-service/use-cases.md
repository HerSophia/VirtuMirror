# 使用场景

> **版本**: 1.1  
> **最后更新**: 2026-02-07

以下示例均基于当前实现：`import { schedulerService } from '@/services/scheduler'`。

## 1. 场景一：微博热搜周期刷新（interval）

```ts
schedulerService.register({
  id: 'weibo:trending:refresh',
  appId: 'weibo',
  name: '微博热搜刷新',
  schedule: {
    type: 'interval',
    ms: 10 * 60 * 1000,
    immediate: true,
  },
  retryOnFail: 2,
  timeout: 20_000,
  handler: async () => {
    await trendingService.refreshTrending()
  },
})
```

适用点：

- 需要持续轮询
- 允许失败重试
- 允许冷启动时立即执行一次

## 2. 场景二：新消息触发档案检查（event）

```ts
schedulerService.register({
  id: 'archive:check:on-message',
  appId: 'archive',
  name: '新消息档案检查',
  schedule: {
    type: 'event',
    eventName: 'session:message:new',
    debounce: 2_000,
  },
  handler: async () => {
    await archiveService.scanRecentMessages()
  },
})
```

适用点：

- 事件驱动
- 需要防抖避免高频重复执行

## 3. 场景三：每日系统维护（cron）

```ts
schedulerService.register({
  id: 'system:daily:maintenance',
  appId: 'system',
  name: '每日系统维护',
  schedule: {
    type: 'cron',
    expression: '0 3 * * *',
  },
  handler: async () => {
    await cleanupExpiredSessions()
    await cleanupOldLogs()
  },
})
```

适用点：

- 固定时间窗口任务
- 需要与系统统一时间源保持一致

## 4. 建议实践

- 任务 ID 建议使用 `app:domain:action` 命名（如 `weibo:trending:refresh`）
- 业务逻辑错误要 `throw`，让调度器能够触发重试策略
- 订阅 `scheduler:task:failed/timeout` 做告警与可视化
- 长耗时任务请显式配置 `timeout` 与 `retryOnFail`
