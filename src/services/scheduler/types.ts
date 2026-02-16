export const DEFAULT_TASK_TIMEOUT_MS = 30_000
export const DEFAULT_RETRY_ON_FAIL = 0
export const RETRY_BASE_DELAY_MS = 1_000
export const MAX_RETRY_BACKOFF_MS = 30_000

export type TaskResult = 'success' | 'failed' | 'timeout'
export type ExecutionOutcome = TaskResult | 'skipped'

export interface IntervalSchedule {
  type: 'interval'
  ms: number
  immediate?: boolean
}

export interface CronSchedule {
  type: 'cron'
  expression: string
}

export interface EventSchedule {
  type: 'event'
  eventName: string
  debounce?: number
}

export type ScheduleConfig = IntervalSchedule | CronSchedule | EventSchedule

export interface ScheduledTaskInput {
  id: string
  appId: string
  name: string
  schedule: ScheduleConfig
  handler: () => Promise<void>
  enabled?: boolean
  retryOnFail?: number
  timeout?: number
}

export interface ScheduledTask extends ScheduledTaskInput {
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

export interface ExecutionResult {
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

export interface SchedulerStatistics {
  totalTasks: number
  enabledTasks: number
  runningTasks: number
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  timeoutExecutions: number
  skippedExecutions: number
}
