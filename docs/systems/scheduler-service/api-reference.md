# API 参考

> **版本**: 1.0  
> **最后更新**: 2026-01-16

本文档提供定时任务服务的完整 API 参考。

## 1. SchedulerService

定时任务服务的核心类，提供任务注册、管理和执行能力。

### 1.1 获取服务实例

```typescript
import { schedulerService } from '@/services/schedulerService'

// 或者通过依赖注入获取
const scheduler = useSchedulerService()
```

### 1.2 任务注册

#### `register(task: ScheduledTaskConfig): string`

注册一个定时任务，返回任务 ID。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task | `ScheduledTaskConfig` | 是 | 任务配置对象 |

**返回值：** `string` - 任务 ID

**示例：**

```typescript
const taskId = schedulerService.register({
  id: 'my-task',
  appId: 'my-app',
  name: '我的任务',
  schedule: {
    type: 'interval',
    ms: 60000
  },
  handler: async () => {
    console.log('任务执行')
  },
  enabled: true
})
```

#### `unregister(taskId: string): boolean`

注销一个定时任务。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | `string` | 是 | 任务 ID |

**返回值：** `boolean` - 是否成功注销

**示例：**

```typescript
const success = schedulerService.unregister('my-task')
if (success) {
  console.log('任务已注销')
}
```

### 1.3 任务控制

#### `pause(taskId: string): void`

暂停指定任务的调度。任务不会被执行，但定义保留。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | `string` | 是 | 任务 ID |

**示例：**

```typescript
schedulerService.pause('my-task')
```

#### `resume(taskId: string): void`

恢复已暂停任务的调度。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | `string` | 是 | 任务 ID |

**示例：**

```typescript
schedulerService.resume('my-task')
```

#### `trigger(taskId: string): Promise<ExecutionResult>`

立即触发任务执行，不等待调度时间。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | `string` | 是 | 任务 ID |

**返回值：** `Promise<ExecutionResult>` - 执行结果

**示例：**

```typescript
const result = await schedulerService.trigger('my-task')
if (result.success) {
  console.log('任务执行成功')
} else {
  console.error('任务执行失败:', result.error)
}
```

### 1.4 任务查询

#### `getTask(taskId: string): ScheduledTask | undefined`

获取指定任务的详细信息。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | `string` | 是 | 任务 ID |

**返回值：** `ScheduledTask | undefined` - 任务对象，不存在则返回 undefined

**示例：**

```typescript
const task = schedulerService.getTask('my-task')
if (task) {
  console.log('任务状态:', task.enabled ? '启用' : '禁用')
  console.log('上次执行:', task.lastRunAt)
  console.log('下次执行:', task.nextRunAt)
}
```

#### `getAllTasks(): ScheduledTask[]`

获取所有已注册的任务列表。

**返回值：** `ScheduledTask[]` - 任务数组

**示例：**

```typescript
const tasks = schedulerService.getAllTasks()
console.log(`共有 ${tasks.length} 个任务`)
```

#### `getTasksByApp(appId: string): ScheduledTask[]`

获取指定应用的所有任务。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| appId | `string` | 是 | 应用 ID |

**返回值：** `ScheduledTask[]` - 任务数组

**示例：**

```typescript
const weiboTasks = schedulerService.getTasksByApp('weibo')
weiboTasks.forEach(task => {
  console.log(`任务: ${task.name}, 状态: ${task.enabled ? '启用' : '禁用'}`)
})
```

### 1.5 生命周期

#### `start(): void`

启动调度器，开始执行所有已启用的任务调度。

**示例：**

```typescript
// 通常在应用启动时调用
schedulerService.start()
```

#### `stop(): void`

停止调度器，暂停所有任务的执行。任务定义保留，可通过 `start()` 恢复。

**示例：**

```typescript
// 应用关闭或后台时调用
schedulerService.stop()
```

### 1.6 统计与调试

#### `getStatistics(): SchedulerStatistics`

获取调度器的统计信息。

**返回值：** `SchedulerStatistics`

```typescript
interface SchedulerStatistics {
  totalTasks: number       // 总任务数
  enabledTasks: number     // 启用的任务数
  runningTasks: number     // 正在执行的任务数
  totalExecutions: number  // 总执行次数
  failedExecutions: number // 失败次数
}
```

**示例：**

```typescript
const stats = schedulerService.getStatistics()
console.log(`任务统计: ${stats.enabledTasks}/${stats.totalTasks} 启用`)
console.log(`执行成功率: ${((1 - stats.failedExecutions / stats.totalExecutions) * 100).toFixed(2)}%`)
```

#### `getExecutionHistory(taskId: string, limit?: number): TaskExecutionLog[]`

获取任务的执行历史记录。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | `string` | 是 | 任务 ID |
| limit | `number` | 否 | 返回记录数限制，默认 10 |

**返回值：** `TaskExecutionLog[]` - 执行日志数组

**示例：**

```typescript
const history = schedulerService.getExecutionHistory('my-task', 5)
history.forEach(log => {
  console.log(`${new Date(log.startTime).toLocaleString()}: ${log.result} (${log.duration}ms)`)
})
```

## 2. 类型定义

### 2.1 ScheduledTaskConfig

任务注册配置对象：

```typescript
interface ScheduledTaskConfig {
  /**
   * 任务唯一标识符
   * 建议格式: appId:taskName
   */
  id: string
  
  /**
   * 所属应用 ID
   */
  appId: string
  
  /**
   * 任务显示名称
   */
  name: string
  
  /**
   * 调度配置
   */
  schedule: ScheduleConfig
  
  /**
   * 任务执行函数
   * 必须是异步函数
   */
  handler: () => Promise<void>
  
  /**
   * 是否启用
   * @default true
   */
  enabled?: boolean
  
  /**
   * 失败重试次数
   * @default 0
   */
  retryOnFail?: number
  
  /**
   * 执行超时时间（毫秒）
   * @default 30000
   */
  timeout?: number
}
```

### 2.2 ScheduleConfig

调度配置，支持三种类型：

```typescript
type ScheduleConfig = 
  | IntervalSchedule
  | CronSchedule
  | EventSchedule
```

#### IntervalSchedule

固定间隔调度：

```typescript
interface IntervalSchedule {
  type: 'interval'
  
  /**
   * 执行间隔（毫秒）
   */
  ms: number
  
  /**
   * 是否在注册后立即执行一次
   * @default false
   */
  immediate?: boolean
}
```

**示例：**

```typescript
// 每 5 分钟执行
{
  type: 'interval',
  ms: 5 * 60 * 1000
}

// 每 30 秒执行，注册后立即执行一次
{
  type: 'interval',
  ms: 30 * 1000,
  immediate: true
}
```

#### CronSchedule

Cron 表达式调度：

```typescript
interface CronSchedule {
  type: 'cron'
  
  /**
   * Cron 表达式
   * 格式: 分 时 日 月 周
   */
  expression: string
}
```

**Cron 表达式格式：**

```text
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日期 (1 - 31)
│ │ │ ┌───────────── 月份 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 6, 0=周日)
│ │ │ │ │
* * * * *
```

**常用示例：**

```typescript
// 每天凌晨 3 点
{ type: 'cron', expression: '0 3 * * *' }

// 每小时整点
{ type: 'cron', expression: '0 * * * *' }

// 每周一上午 9 点
{ type: 'cron', expression: '0 9 * * 1' }

// 每月 1 日凌晨 0 点
{ type: 'cron', expression: '0 0 1 * *' }

// 每 5 分钟
{ type: 'cron', expression: '*/5 * * * *' }

// 工作日 9-18 点每小时
{ type: 'cron', expression: '0 9-18 * * 1-5' }
```

#### EventSchedule

事件触发调度：

```typescript
interface EventSchedule {
  type: 'event'
  
  /**
   * 触发事件名称
   */
  eventName: string
  
  /**
   * 防抖时间（毫秒）
   * 在此时间内的重件只触发一次
   * @default 0 (不防抖)
   */
  debounce?: number
}
```

**示例：**

```typescript
// 新消息时触发
{
  type: 'event',
  eventName: 'session:message:new'
}

// 内容变更时触发，500ms 防抖
{
  type: 'event',
  eventName: 'content:updated',
  debounce: 500
}
```

**常用事件名：**

| 事件名 | 说明 |
|--------|------|
| `session:changed` | 会话切换 |
| `session:message:new` | 新消息到达 |
| `session:swipe:changed` | Swipe 切换 |
| `content:post:created` | 新帖子创建 |
| `content:trending:updated` | 热搜更新 |
| `interaction:like` | 用户点赞 |
| `account:updated` | 账号信息更新 |

### 2.3 ScheduledTask

任务运行时对象（包含状态信息）：

```typescript
interface ScheduledTask extends ScheduledTaskConfig {
  /**
   * 上次执行时间戳
   */
  lastRunAt?: number
  
  /**
   * 上次执行结果
   */
  lastResult?: TaskResult
  
  /**
   * 下次计划执行时间戳
   */
  nextRunAt?: number
  
  /**
   * 总执行次数
   */
  runCount: number
  
  /**
   * 失败次数
   */
  failCount: number
}

type TaskResult = 'success' | 'failed' | 'timeout' | 'cancelled'
```

### 2.4 ExecutionResult

任务执行结果：

```typescript
interface ExecutionResult {
  /**
   * 是否执行成功
   */
  success: boolean
  
  /**
   * 执行耗时（毫秒）
   */
  duration: number
  
  /**
   * 错误信息（失败时）
   */
  error?: string
  
  /**
   * 执行尝试次数（含重试）
   */
  attempt: number
}
```

### 2.5 TaskExecutionLog

任务执行日志：

```typescript
interface TaskExecutionLog {
  /**
   * 日志 ID
   */
  id: string
  
  /**
   * 任务 ID
   */
  taskId: string
  
  /**
   * 开始时间戳
   */
  startTime: number
  
  /**
   * 结束时间戳
   */
  endTime: number
  
  /**
   * 执行耗时（毫秒）
   */
  duration: number
  
  /**
   * 执行结果
   */
  result: TaskResult
  
  /**
   * 错误信息
   */
  error?: string
  
  /**
   * 尝试次数
   */
  attempt: number
}
```

## 3. 事件

调度器会通过 EventBus 发送以下事件：

### 3.1 scheduler:task:started

任务开始执行时触发：

```typescript
interface TaskStartedEvent {
  taskId: string
  taskName: string
  appId: string
  startTime: number
}

eventBus.on('scheduler:task:started', (event: TaskStartedEvent) => {
  console.log(`任务 ${event.taskName} 开始执行`)
})
```

### 3.2 scheduler:task:completed

任务执行完成时触发：

```typescript
interface TaskCompletedEvent {
  taskId: string
  taskName: string
  appId: string
  result: ExecutionResult
}

eventBus.on('scheduler:task:completed', (event: TaskCompletedEvent) => {
  if (event.result.success) {
    console.log(`任务 ${event.taskName} 执行成功，耗时 ${event.result.duration}ms`)
  }
})
```

### 3.3 scheduler:task:failed

任务执行失败时触发：

```typescript
interface TaskFailedEvent {
  taskId: string
  taskName: string
  appId: string
  error: string
  attempt: number
}

eventBus.on('scheduler:task:failed', (event: TaskFailedEvent) => {
  console.error(`任务 ${event.taskName} 执行失败: ${event.error}`)
})
```

### 3.4 scheduler:task:registered

任务注册时触发：

```typescript
interface TaskRegisteredEvent {
  taskId: string
  taskName: string
  appId: string
  scheduleType: 'interval' | 'cron' | 'event'
}

eventBus.on('scheduler:task:registered', (event: TaskRegisteredEvent) => {
  console.log(`新任务注册: ${event.taskName} (${event.scheduleType})`)
})
```

### 3.5 scheduler:task:unregistered

任务注销时触发：

```typescript
interface TaskUnregisteredEvent {
  taskId: string
  taskName: string
  appId: string
}

eventBus.on('scheduler:task:unregistered', (event: TaskUnregisteredEvent) => {
  console.log(`任务注销: ${event.taskName}`)
})
```

## 4. 错误处理

### 4.1 常见错误

| 错误 | 说明 | 处理建议 |
|------|------|----------|
| `Task not found` | 任务不存在 | 检查任务 ID 是否正确 |
| `Task already exists` | 任务 ID 已被注册 | 使用唯一的任务 ID |
| `Invalid cron expression` | Cron 表达式格式错误 | 检查表达式语法 |
| `Task execution timeout` | 任务执行超时 | 增加 timeout 或优化任务逻辑 |
| `Already running` | 任务正在执行中 | 等待当前执行完成 |

### 4.2 错误捕获

```typescript
try {
  await schedulerService.trigger('my-task')
} catch (error) {
  if (error.message === 'Task not found') {
    console.error('任务不存在')
  } else if (error.message === 'Task execution timeout') {
    console.error('任务执行超时')
  } else {
    console.error('未知错误:', error)
  }
}
```

## 5. 最佳实践

### 5.1 任务 ID 命名规范

```typescript
// 推荐格式: appId:feature:action
const taskId = 'weibo:trending:refresh'     // ✓
const taskId = 'archives:extraction:check'  // ✓
const taskId = 'system:cleanup:daily'       // ✓

// 不推荐
const taskId = 'my-task'                    // ✗ 缺少 appId
const taskId = 'Task1'                      // ✗ 不够描述性
```

### 5.2 错误处理

```typescript
schedulerService.register({
  id: 'my-app:data:sync',
  appId: 'my-app',
  name: '数据同步',
  schedule: { type: 'interval', ms: 60000 },
  handler: async () => {
    try {
      await syncData()
    } catch (error) {
      // 记录错误但不抛出，避免影响重试逻辑
      console.error('数据同步失败:', error)
      throw error  // 重新抛出以触发重试
    }
  },
  retryOnFail: 3,
  timeout: 10000,
  enabled: true
})
```

### 5.3 资源清理

```typescript
// 在组件/应用卸载时注销任务
onUnmounted(() => {
  schedulerService.unregister('my-app:task1')
  schedulerService.unregister('my-app:task2')
})

// 或者批量注销应用的所有任务
onUnmounted(() => {
  const tasks = schedulerService.getTasksByApp('my-app')
  tasks.forEach(task => schedulerService.unregister(task.id))
})
```
