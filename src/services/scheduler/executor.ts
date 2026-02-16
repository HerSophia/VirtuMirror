import { loggerService } from '@/services/logger'
import { getNextCronRun } from './cron'
import {
  DEFAULT_TASK_TIMEOUT_MS,
  MAX_RETRY_BACKOFF_MS,
  RETRY_BASE_DELAY_MS,
  type ExecutionResult,
  type ScheduledTask,
  type TaskResult,
} from './types'

const logger = loggerService.child('service:scheduler:executor')

export class TaskTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskTimeoutError'
  }
}

export interface ExecutorOptions {
  defaultTimeout?: number
  now?: () => number
  resolveNextRunAt?: (task: ScheduledTask, completedAt: number) => number | undefined
}

export class Executor {
  private readonly runningTasks = new Set<string>()
  private readonly defaultTimeout: number
  private readonly now: () => number
  private readonly resolveNextRunAt?: (task: ScheduledTask, completedAt: number) => number | undefined

  constructor(options: ExecutorOptions = {}) {
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_TASK_TIMEOUT_MS
    this.now = options.now ?? (() => Date.now())
    this.resolveNextRunAt = options.resolveNextRunAt
  }

  isRunning(taskId: string): boolean {
    return this.runningTasks.has(taskId)
  }

  getRunningTaskIds(): string[] {
    return Array.from(this.runningTasks)
  }

  async execute(task: ScheduledTask): Promise<ExecutionResult> {
    const startedAt = this.now()

    if (this.runningTasks.has(task.id)) {
      task.skipCount += 1

      const skippedResult: ExecutionResult = {
        taskId: task.id,
        outcome: 'skipped',
        success: false,
        attempt: 0,
        startedAt,
        finishedAt: startedAt,
        duration: 0,
        skipped: true,
        reason: 'reentry',
      }

      logger.warn(`Task is already running, skipped: ${task.id}`)
      return skippedResult
    }

    this.runningTasks.add(task.id)
    task.running = true
    task.runCount += 1
    task.lastRunAt = startedAt

    const maxRetries = Math.max(0, task.retryOnFail)
    const timeoutMs = task.timeout ?? this.defaultTimeout

    let finalResult: ExecutionResult | undefined

    try {
      for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
        try {
          await this.executeWithTimeout(task.handler, timeoutMs)

          finalResult = this.createResult({
            task,
            startedAt,
            attempt,
            outcome: 'success',
          })

          task.successCount += 1
          task.lastResult = 'success'
          task.lastError = undefined
          break
        } catch (error) {
          const isTimeout = error instanceof TaskTimeoutError

          if (attempt <= maxRetries) {
            const delay = this.getRetryDelay(attempt)
            logger.warn(
              `Task execution failed, retrying (${attempt}/${maxRetries}) after ${delay}ms: ${task.id}`,
              error
            )
            await this.sleep(delay)
            continue
          }

          const outcome: TaskResult = isTimeout ? 'timeout' : 'failed'

          finalResult = this.createResult({
            task,
            startedAt,
            attempt,
            outcome,
            error,
          })

          task.lastResult = outcome
          task.lastError = finalResult.error
          if (isTimeout) {
            task.timeoutCount += 1
          }
          task.failCount += 1
          break
        }
      }

      if (!finalResult) {
        finalResult = this.createResult({
          task,
          startedAt,
          attempt: maxRetries + 1,
          outcome: 'failed',
          error: new Error('Task execution failed without result'),
        })
        task.lastResult = 'failed'
        task.lastError = finalResult.error
        task.failCount += 1
      }

      task.lastDuration = finalResult.duration
      this.updateNextRunAt(task, finalResult.finishedAt)

      return finalResult
    } finally {
      task.running = false
      this.runningTasks.delete(task.id)
    }
  }

  private async executeWithTimeout(handler: () => Promise<void>, timeoutMs: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined

    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new TaskTimeoutError(`Task execution timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      Promise.resolve()
        .then(() => handler())
        .then(resolve)
        .catch(reject)
        .finally(() => {
          if (timer) {
            clearTimeout(timer)
          }
        })
    })
  }

  private updateNextRunAt(task: ScheduledTask, completedAt: number): void {
    const computedNextRunAt = this.resolveNextRunAt?.(task, completedAt)

    if (computedNextRunAt !== undefined) {
      task.nextRunAt = computedNextRunAt
      return
    }

    switch (task.schedule.type) {
      case 'interval':
        task.nextRunAt = completedAt + task.schedule.ms
        break
      case 'cron':
        task.nextRunAt = getNextCronRun(task.schedule.expression, completedAt)
        break
      case 'event':
        task.nextRunAt = undefined
        break
    }
  }

  private createResult(params: {
    task: ScheduledTask
    startedAt: number
    attempt: number
    outcome: TaskResult
    error?: unknown
  }): ExecutionResult {
    const finishedAt = this.now()
    return {
      taskId: params.task.id,
      outcome: params.outcome,
      success: params.outcome === 'success',
      attempt: params.attempt,
      startedAt: params.startedAt,
      finishedAt,
      duration: Math.max(0, finishedAt - params.startedAt),
      error: params.error ? this.normalizeError(params.error) : undefined,
    }
  }

  private getRetryDelay(attempt: number): number {
    return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_BACKOFF_MS)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  private normalizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}
