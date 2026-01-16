# 架构设计

> **版本**: 1.0  
> **最后更新**: 2026-01-16

本文档详细描述定时任务服务的架构设计，包括核心组件、调度策略和数据模型。

## 1. 设计目标

### 1.1 核心目标

1. **统一调度**：为所有应用提供统一的定时任务管理能力
2. **应用隔离**：每个应用的任务独立管理，互不干扰
3. **可靠执行**：支持失败重试、超时控制
4. **灵活配置**：支持多种调度类型和执行策略

### 1.2 设计原则

- **单例模式**：全局唯一的调度器实例
- **事件驱动**：与 EventBus 深度集成
- **时间感知**：与 TimeService 集成，支持模拟时间
- **低资源占用**：智能合并调度，避免不必要的唤醒

## 2. 核心架构

### 2.1 整体架构图

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              应用层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  微博 App   │  │  LLM Task   │  │  Archives   │  │  Settings   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          │ register()     │ register()     │ register()     │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SchedulerService                                  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         Task Registry                              │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │ Map<taskId, ScheduledTask>                                   │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                         ┌──────────┴──────────┐                          │
│                         ▼                     ▼                          │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐     │
│  │      Scheduler Engine        │  │      Event Listener          │     │
│  │  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │     │
│  │  │ Interval Scheduler     │  │  │  │ EventBus Subscription  │  │     │
│  │  │ (setInterval based)    │  │  │  │ (事件触发调度)          │  │     │
│  │  ├────────────────────────┤  │  │  └────────────────────────┘  │     │
│  │  │ Cron Scheduler         │  │  └──────────────────────────────┘     │
│  │  │ (表达式解析 + 计算)     │  │                                       │
│  │  └────────────────────────┘  │                                       │
│  └──────────────────────────────┘                                       │
│                         │                                                │
│                         ▼                                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      Executor Pool                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │ Execute     │  │ Retry       │  │ Timeout     │               │  │
│  │  │ Handler     │  │ Handler     │  │ Handler     │               │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                         │                     ▲
                         │ 时间查询             │ 事件订阅
                         ▼                     │
┌─────────────────────────────┐  ┌─────────────────────────────┐
│       TimeService           │  │       EventBus Service      │
│       (时间服务)             │  │       (事件总线)             │
└─────────────────────────────┘  └─────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 Task Registry（任务注册表）

负责管理所有已注册的任务：

```typescript
class TaskRegistry {
  private tasks: Map<string, ScheduledTask> = new Map()
  private tasksByApp: Map<string, Set<string>> = new Map()
  
  register(task: ScheduledTask): void
  unregister(taskId: string): void
  get(taskId: string): ScheduledTask | undefined
  getByApp(appId: string): ScheduledTask[]
  getAll(): ScheduledTask[]
}
```

#### 2.2.2 Scheduler Engine（调度引擎）

负责计算和触发任务执行时机：

```typescript
class SchedulerEngine {
  private timers: Map<string, NodeJS.Timer> = new Map()
  
  // 启动任务调度
  schedule(task: ScheduledTask): void
  
  // 停止任务调度
  unschedule(taskId: string): void
  
  // 计算下次执行时间
  calculateNextRun(task: ScheduledTask): number | null
  
  // 主循环（针对 Cron 任务）
  private tick(): void
}
```

#### 2.2.3 Executor Pool（执行池）

负责执行任务并处理结果：

```typescript
class ExecutorPool {
  // 执行任务
  async execute(task: ScheduledTask): Promise<ExecutionResult>
  
  // 带超时执行
  private async executeWithTimeout(
    handler: () => Promise<void>,
    timeout: number
  ): Promise<void>
  
  // 重试逻辑
  private async executeWithRetry(
    task: ScheduledTask,
    attempt: number
  ): Promise<ExecutionResult>
}

interface ExecutionResult {
  success: boolean
  duration: number
  error?: string
  attempt: number
}
```

## 3. 数据模型

### 3.1 ScheduledTask（定时任务）

```typescript
interface ScheduledTask {
  // === 标识 ===
  id: string              // 任务唯一 ID
  appId: string           // 所属应用 ID
  name: string            // 任务名称（用于显示）
  
  // === 调度配置 ===
  schedule: ScheduleConfig
  
  // === 执行配置 ===
  handler: () => Promise<void>  // 执行函数
  retryOnFail?: number          // 失败重试次数，默认 0
  timeout?: number              // 超时时间（ms），默认 30000
  
  // === 状态 ===
  enabled: boolean              // 是否启用
  lastRunAt?: number            // 上次执行时间
  lastResult?: TaskResult       // 上次执行结果
  nextRunAt?: number            // 下次计划执行时间
  runCount: number              // 总执行次数
  failCount: number             // 失败次数
}

// 调度配置（三选一）
type ScheduleConfig = 
  | IntervalSchedule
  | CronSchedule
  | EventSchedule

interface IntervalSchedule {
  type: 'interval'
  ms: number              // 间隔毫秒数
  immediate?: boolean     // 是否立即执行一次
}

interface CronSchedule {
  type: 'cron'
  expression: string      // Cron 表达式
}

interface EventSchedule {
  type: 'event'
  eventName: string       // 触发事件名
  debounce?: number       // 防抖时间（ms）
}

type TaskResult = 'success' | 'failed' | 'timeout' | 'cancelled'
```

### 3.2 TaskExecutionLog（执行日志）

```typescript
interface TaskExecutionLog {
  id: string              // 日志 ID
  taskId: string          // 任务 ID
  startTime: number       // 开始时间
  endTime: number         // 结束时间
  duration: number        // 执行时长（ms）
  result: TaskResult      // 执行结果
  error?: string          // 错误信息
  attempt: number         // 第几次尝试
}
```

## 4. 调度策略

### 4.1 Interval 调度

基于 `setInterval` 实现，最简单高效：

```typescript
class IntervalScheduler {
  schedule(task: ScheduledTask): void {
    const config = task.schedule as IntervalSchedule
    
    // 可选：立即执行一次
    if (config.immediate) {
      this.execute(task)
    }
    
    // 设置定时器
    const timer = setInterval(() => {
      if (task.enabled) {
        this.execute(task)
      }
    }, config.ms)
    
    this.timers.set(task.id, timer)
  }
}
```

### 4.2 Cron 调度

基于 Cron 表达式计算下次执行时间：

```typescript
class CronScheduler {
  // 每分钟检查一次是否有任务需要执行
  private tickInterval = 60 * 1000
  
  schedule(task: ScheduledTask): void {
    const config = task.schedule as CronSchedule
    
    // 计算下次执行时间
    task.nextRunAt = this.calculateNextRun(config.expression)
  }
  
  // 主循环
  tick(): void {
    const now = Date.now()
    
    for (const task of this.cronTasks) {
      if (task.enabled && task.nextRunAt && task.nextRunAt <= now) {
        this.execute(task)
        // 计算下次执行时间
        task.nextRunAt = this.calculateNextRun(task.schedule.expression)
      }
    }
  }
  
  // Cron 表达式解析
  calculateNextRun(expression: string): number {
    // 使用 cron-parser 或自行实现
    return cronParser.parseExpression(expression).next().getTime()
  }
}
```

**支持的 Cron 格式**：

```text
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日期 (1 - 31)
│ │ │ ┌───────────── 月份 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 6, 0=周日)
│ │ │ │ │
* * * * *

示例：
"0 3 * * *"     每天 03:00
"*/5 * * * *"   每 5 分钟
"0 0 * * 0"     每周日 00:00
"0 0 1 * *"     每月 1 日 00:00
```

### 4.3 Event 调度

基于 EventBus 事件触发：

```typescript
class EventScheduler {
  private subscriptions: Map<string, () => void> = new Map()
  
  schedule(task: ScheduledTask): void {
    const config = task.schedule as EventSchedule
    
    // 创建处理函数
    let handler: () => void
    
    if (config.debounce) {
      // 带防抖
      handler = debounce(() => {
        if (task.enabled) {
          this.execute(task)
        }
      }, config.debounce)
    } else {
      handler = () => {
        if (task.enabled) {
          this.execute(task)
        }
      }
    }
    
    // 订阅事件
    const unsubscribe = eventBus.on(config.eventName, handler)
    this.subscriptions.set(task.id, unsubscribe)
  }
  
  unschedule(taskId: string): void {
    const unsubscribe = this.subscriptions.get(taskId)
    if (unsubscribe) {
      unsubscribe()
      this.subscriptions.delete(taskId)
    }
  }
}
```

## 5. 执行控制

### 5.1 超时控制

```typescript
async function executeWithTimeout(
  handler: () => Promise<void>,
  timeout: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Task execution timeout'))
    }, timeout)
    
    handler()
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer))
  })
}
```

### 5.2 失败重试

```typescript
async function executeWithRetry(
  task: ScheduledTask,
  maxRetries: number
): Promise<ExecutionResult> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      await executeWithTimeout(task.handler, task.timeout ?? 30000)
      return { success: true, attempt, duration: 0 }
    } catch (error) {
      lastError = error as Error
      
      if (attempt <= maxRetries) {
        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000)
        await sleep(delay)
      }
    }
  }
  
  return {
    success: false,
    attempt: maxRetries + 1,
    duration: 0,
    error: lastError?.message
  }
}
```

### 5.3 并发控制

```typescript
class ExecutorPool {
  private running: Set<string> = new Set()
  private maxConcurrent: number = 5
  
  async execute(task: ScheduledTask): Promise<ExecutionResult> {
    // 检查是否已在执行
    if (this.running.has(task.id)) {
      console.warn(`Task ${task.id} is already running, skipping`)
      return { success: false, error: 'Already running' }
    }
    
    // 检查并发数
    if (this.running.size >= this.maxConcurrent) {
      console.warn('Max concurrent tasks reached, queueing')
      // 可选：加入队列等待
    }
    
    this.running.add(task.id)
    try {
      return await this.doExecute(task)
    } finally {
      this.running.delete(task.id)
    }
  }
}
```

## 6. 与 TimeService 集成

定时任务服务需要与 TimeService 集成，以支持模拟时间模式：

```typescript
class SchedulerService {
  constructor(private timeService: TimeService) {
    // 使用 TimeService 的时间源
  }
  
  private getCurrentTime(): number {
    return this.timeService.getCurrentTime().getTime()
  }
  
  // Cron 任务的 tick 需要考虑时间模式
  private tick(): void {
    const now = this.getCurrentTime()
    // ...
  }
}
```

## 7. 持久化策略

### 7.1 任务定义不持久化

任务定义由应用在启动时注册，不需要持久化：

```typescript
// 应用启动时注册任务
onMounted(() => {
  schedulerService.register({
    id: 'weibo:refresh-trending',
    // ...
  })
})

// 应用卸载时注销任务
onUnmounted(() => {
  schedulerService.unregister('weibo:refresh-trending')
})
```

### 7.2 执行状态可选持久化

执行历史可以选择性持久化到 IndexedDB：

```typescript
interface SchedulerPersistence {
  // 保存执行日志
  saveExecutionLog(log: TaskExecutionLog): Promise<void>
  
  // 查询执行历史
  getExecutionHistory(
    taskId: string,
    limit?: number
  ): Promise<TaskExecutionLog[]>
  
  // 清理旧日志
  cleanup(olderThan: number): Promise<void>
}
```

## 8. 错误处理

### 8.1 任务执行错误

```typescript
try {
  await task.handler()
  task.lastResult = 'success'
} catch (error) {
  task.lastResult = 'failed'
  task.failCount++
  
  // 发送错误事件
  eventBus.emit('scheduler:task:failed', {
    taskId: task.id,
    error: error.message
  })
  
  // 记录日志
  logger.error(`Task ${task.id} failed:`, error)
}
```

### 8.2 系统级错误

```typescript
class SchedulerService {
  // 全局错误处理
  private handleError(error: Error, context: string): void {
    logger.error(`Scheduler error [${context}]:`, error)
    
    // 可选：通知用户
    if (this.notifyOnError) {
      notificationService.notify({
        title: '定时任务错误',
        body: `${context}: ${error.message}`,
        type: 'error'
      })
    }
  }
}
```

## 9. 性能优化

### 9.1 定时器合并

对于相同间隔的任务，可以合并定时器：

```typescript
class IntervalScheduler {
  // 按间隔分组的任务
  private tasksByInterval: Map<number, Set<string>> = new Map()
  private intervalTimers: Map<number, NodeJS.Timer> = new Map()
  
  schedule(task: ScheduledTask): void {
    const config = task.schedule as IntervalSchedule
    const interval = config.ms
    
    // 添加到分组
    if (!this.tasksByInterval.has(interval)) {
      this.tasksByInterval.set(interval, new Set())
      
      // 创建共享定时器
      const timer = setInterval(() => {
        this.tickInterval(interval)
      }, interval)
      this.intervalTimers.set(interval, timer)
    }
    
    this.tasksByInterval.get(interval)!.add(task.id)
  }
  
  private tickInterval(interval: number): void {
    const taskIds = this.tasksByInterval.get(interval)
    if (!taskIds) return
    
    for (const taskId of taskIds) {
      const task = this.registry.get(taskId)
      if (task?.enabled) {
        this.execute(task)
      }
    }
  }
}
```

### 9.2 惰性启动

只有在有任务时才启动调度循环：

```typescript
class SchedulerService {
  private cronTickTimer: NodeJS.Timer | null = null
  
  register(task: ScheduledTask): void {
    // ... 注册逻辑
    
    // 惰性启动 Cron 调度
    if (task.schedule.type === 'cron' && !this.cronTickTimer) {
      this.startCronTick()
    }
  }
  
  unregister(taskId: string): void {
    // ... 注销逻辑
    
    // 没有 Cron 任务时停止
    if (this.getCronTasks().length === 0 && this.cronTickTimer) {
      clearInterval(this.cronTickTimer)
      this.cronTickTimer = null
    }
  }
}
```

## 10. 调试支持

### 10.1 任务状态查询

```typescript
interface SchedulerDebug {
  // 获取所有任务状态
  getAllTaskStatus(): TaskStatus[]
  
  // 获取执行统计
  getStatistics(): SchedulerStatistics
}

interface TaskStatus {
  id: string
  name: string
  appId: string
  enabled: boolean
  scheduleType: 'interval' | 'cron' | 'event'
  lastRunAt?: number
  nextRunAt?: number
  runCount: number
  failCount: number
}

interface SchedulerStatistics {
  totalTasks: number
  enabledTasks: number
  runningTasks: number
  totalExecutions: number
  failedExecutions: number
}
```

### 10.2 开发者工具集成

```typescript
// 在 Settings App 中提供调度器状态查看
const SchedulerDebugPanel = {
  // 显示所有任务
  tasks: computed(() => schedulerService.getAllTaskStatus()),
  
  // 手动触发任务
  triggerTask: (taskId: string) => schedulerService.trigger(taskId),
  
  // 暂停/恢复任务
  toggleTask: (taskId: string) => {
    const task = schedulerService.getTask(taskId)
    if (task?.enabled) {
      schedulerService.pause(taskId)
    } else {
      schedulerService.resume(taskId)
    }
  }
}
```
