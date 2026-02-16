import { loggerService } from '@/services/logger'
import { isValidCronExpression } from './cron'
import {
  DEFAULT_RETRY_ON_FAIL,
  DEFAULT_TASK_TIMEOUT_MS,
  type ScheduleConfig,
  type ScheduledTask,
  type ScheduledTaskInput,
} from './types'

const logger = loggerService.child('service:scheduler:registry')

export class TaskRegistry {
  private tasks = new Map<string, ScheduledTask>()
  private tasksByApp = new Map<string, Set<string>>()

  register(task: ScheduledTaskInput): ScheduledTask {
    this.validateTask(task)

    const normalizedTask: ScheduledTask = {
      ...task,
      schedule: this.cloneSchedule(task.schedule),
      enabled: task.enabled ?? true,
      retryOnFail: task.retryOnFail ?? DEFAULT_RETRY_ON_FAIL,
      timeout: task.timeout ?? DEFAULT_TASK_TIMEOUT_MS,
      running: false,
      runCount: 0,
      successCount: 0,
      failCount: 0,
      timeoutCount: 0,
      skipCount: 0,
      lastRunAt: undefined,
      lastResult: undefined,
      nextRunAt: undefined,
      lastDuration: undefined,
      lastError: undefined,
    }

    this.tasks.set(task.id, normalizedTask)
    this.addTaskToAppIndex(task.appId, task.id)

    logger.debug(`Task registered: ${task.id}`)
    return normalizedTask
  }

  unregister(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) {
      return false
    }

    this.tasks.delete(taskId)
    this.removeTaskFromAppIndex(task.appId, taskId)

    logger.debug(`Task unregistered: ${taskId}`)
    return true
  }

  get(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId)
  }

  getAll(): ScheduledTask[] {
    return Array.from(this.tasks.values())
  }

  getByApp(appId: string): ScheduledTask[] {
    const taskIds = this.tasksByApp.get(appId)
    if (!taskIds) {
      return []
    }

    const result: ScheduledTask[] = []
    for (const taskId of taskIds) {
      const task = this.tasks.get(taskId)
      if (task) {
        result.push(task)
      }
    }

    return result
  }

  has(taskId: string): boolean {
    return this.tasks.has(taskId)
  }

  clear(): void {
    this.tasks.clear()
    this.tasksByApp.clear()
  }

  private addTaskToAppIndex(appId: string, taskId: string): void {
    if (!this.tasksByApp.has(appId)) {
      this.tasksByApp.set(appId, new Set())
    }
    this.tasksByApp.get(appId)!.add(taskId)
  }

  private removeTaskFromAppIndex(appId: string, taskId: string): void {
    const appTaskIds = this.tasksByApp.get(appId)
    if (!appTaskIds) {
      return
    }

    appTaskIds.delete(taskId)
    if (appTaskIds.size === 0) {
      this.tasksByApp.delete(appId)
    }
  }

  private validateTask(task: ScheduledTaskInput): void {
    if (!task.id.trim()) {
      throw new Error('[TaskRegistry] Task id is required')
    }

    if (this.tasks.has(task.id)) {
      throw new Error(`[TaskRegistry] Task id already exists: ${task.id}`)
    }

    if (!task.appId.trim()) {
      throw new Error(`[TaskRegistry] Task appId is required: ${task.id}`)
    }

    if (!task.name.trim()) {
      throw new Error(`[TaskRegistry] Task name is required: ${task.id}`)
    }

    if (typeof task.handler !== 'function') {
      throw new Error(`[TaskRegistry] Task handler must be a function: ${task.id}`)
    }

    const isAsyncFunction = task.handler.constructor.name === 'AsyncFunction'
    if (!isAsyncFunction) {
      throw new Error(`[TaskRegistry] Task handler must be async: ${task.id}`)
    }

    if (task.retryOnFail !== undefined && (!Number.isInteger(task.retryOnFail) || task.retryOnFail < 0)) {
      throw new Error(`[TaskRegistry] retryOnFail must be a non-negative integer: ${task.id}`)
    }

    if (task.timeout !== undefined && (!Number.isFinite(task.timeout) || task.timeout <= 0)) {
      throw new Error(`[TaskRegistry] timeout must be a positive number: ${task.id}`)
    }

    this.validateSchedule(task.id, task.schedule)
  }

  private validateSchedule(taskId: string, schedule: ScheduleConfig): void {
    switch (schedule.type) {
      case 'interval':
        if (!Number.isFinite(schedule.ms) || schedule.ms <= 0) {
          throw new Error(`[TaskRegistry] interval ms must be a positive number: ${taskId}`)
        }
        break
      case 'cron':
        if (!schedule.expression.trim()) {
          throw new Error(`[TaskRegistry] cron expression is required: ${taskId}`)
        }
        if (!isValidCronExpression(schedule.expression)) {
          throw new Error(`[TaskRegistry] invalid cron expression: ${taskId}`)
        }
        break
      case 'event':
        if (!schedule.eventName.trim()) {
          throw new Error(`[TaskRegistry] eventName is required for event schedule: ${taskId}`)
        }
        if (
          schedule.debounce !== undefined &&
          (!Number.isFinite(schedule.debounce) || schedule.debounce < 0)
        ) {
          throw new Error(`[TaskRegistry] debounce must be a non-negative number: ${taskId}`)
        }
        break
      default:
        throw new Error(`[TaskRegistry] unsupported schedule type: ${(schedule as ScheduleConfig).type}`)
    }
  }

  private cloneSchedule(schedule: ScheduleConfig): ScheduleConfig {
    switch (schedule.type) {
      case 'interval':
        return { ...schedule }
      case 'cron':
        return { ...schedule }
      case 'event':
        return { ...schedule }
    }
  }
}
