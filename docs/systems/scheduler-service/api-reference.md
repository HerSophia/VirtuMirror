# API 参考

> **版本**: 1.1  
> **最后更新**: 2026-02-07

本文档描述当前 `Scheduler Service v1.0` 的实际对外 API（本地单进程实现）。

## 1. 导入

```ts
import { schedulerService, SCHEDULER_EVENTS } from '@/services/scheduler'
```

## 2. 核心 API

```ts
interface SchedulerService {
  register(task: ScheduledTaskInput): string
  unregister(taskId: string): boolean

  pause(taskId: string): boolean
  resume(taskId: string): boolean
  trigger(taskId: string): Promise<ExecutionResult | undefined>

  getTask(taskId: string): ScheduledTask | undefined
  getAllTasks(): ScheduledTask[]
  getTasksByApp(appId: string): ScheduledTask[]

  getStatistics(): SchedulerStatistics

  start(): void
  stop(): void
  isStarted(): boolean
}
```

### 2.1 `register(task)`

注册任务，返回任务 ID。注册时会校验：

- `id` 唯一
- `handler` 必须是 async 函数
- `schedule` 配置合法

当调度器已启动且任务 `enabled=true` 时，注册后会立即进入调度。

### 2.2 `unregister(taskId)`

注销任务并清理相关定时器/事件订阅，返回是否成功。

### 2.3 `pause(taskId)` / `resume(taskId)`

- `pause`：禁用任务并取消调度（保留任务定义）
- `resume`：重新启用任务；若调度器已启动则恢复调度

### 2.4 `trigger(taskId)`

立即触发一次执行（`force` 模式），即使任务当前被 `pause` 也可手动执行。

返回 `ExecutionResult`；任务不存在时返回 `undefined`。

### 2.5 查询 API

- `getTask(taskId)`：获取单任务状态
- `getAllTasks()`：获取全部任务
- `getTasksByApp(appId)`：按 app 分组查询

### 2.6 生命周期 API

- `start()`：启动调度引擎并调度所有已启用任务
- `stop()`：停止调度引擎并清理调度资源
- `isStarted()`：查看调度器是否在运行

### 2.7 统计 API

```ts
interface SchedulerStatistics {
  totalTasks: number
  enabledTasks: number
  runningTasks: number
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  timeoutExecutions: number
  skippedExecutions: number
}
```

## 3. 类型定义

### 3.1 `ScheduledTaskInput`

```ts
type ScheduleConfig =
  | { type: 'interval'; ms: number; immediate?: boolean }
  | { type: 'cron'; expression: string }
  | { type: 'event'; eventName: string; debounce?: number }

interface ScheduledTaskInput {
  id: string
  appId: string
  name: string
  schedule: ScheduleConfig
  handler: () => Promise<void>
  enabled?: boolean
  retryOnFail?: number
  timeout?: number
}
```

### 3.2 `ScheduledTask`

```ts
type TaskResult = 'success' | 'failed' | 'timeout'

interface ScheduledTask extends ScheduledTaskInput {
  enabled: boolean
  retryOnFail: number
  timeout: number

  running: boolean
  lastRunAt?: number
  lastResult?: TaskResult
  nextRunAt?: number
  lastDuration?: number
  lastError?: string

  runCount: number
  successCount: number
  failCount: number
  timeoutCount: number
  skipCount: number
}
```

### 3.3 `ExecutionResult`

```ts
type ExecutionOutcome = TaskResult | 'skipped'

interface ExecutionResult {
  taskId: string
  outcome: ExecutionOutcome
  success: boolean
  attempt: number
  startedAt: number
  finishedAt: number
  duration: number
  error?: string
  skipped?: boolean
  reason?: 'reentry'
}
```

## 4. 默认执行策略

- `timeout` 默认 `30_000ms`
- `retryOnFail` 默认 `0`
- 重试退避：`1s / 2s / 4s ...`（上限 `30s`）
- 同任务重入时默认跳过，`ExecutionResult.outcome = 'skipped'`

## 5. 事件广播

Scheduler 会通过 EventBus 广播以下事件（常量见 `SCHEDULER_EVENTS`）：

- `scheduler:task:registered`
- `scheduler:task:unregistered`
- `scheduler:task:paused`
- `scheduler:task:resumed`
- `scheduler:task:started`
- `scheduler:task:completed`
- `scheduler:task:failed`
- `scheduler:task:timeout`
- `scheduler:task:skipped`

其中执行结果事件 payload 会包含 `result: ExecutionResult`。
