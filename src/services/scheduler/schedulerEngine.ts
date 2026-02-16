import { eventBus as globalEventBus } from '@/services/eventBus'
import { loggerService } from '@/services/logger'
import { timeService } from '@/services/time/timeService'
import type { IEventBus, Unsubscribe } from '@/types/eventBus'
import { getNextCronRun } from './cron'
import { Executor } from './executor'
import { TaskRegistry } from './taskRegistry'
import type {
  CronSchedule,
  EventSchedule,
  ExecutionResult,
  IntervalSchedule,
  ScheduleConfig,
  ScheduledTask,
} from './types'

const logger = loggerService.child('service:scheduler:engine')

function isIntervalTask(task: ScheduledTask): task is ScheduledTask & { schedule: IntervalSchedule } {
  return task.schedule.type === 'interval'
}

function isEventTask(task: ScheduledTask): task is ScheduledTask & { schedule: EventSchedule } {
  return task.schedule.type === 'event'
}

function isCronTask(task: ScheduledTask): task is ScheduledTask & { schedule: CronSchedule } {
  return task.schedule.type === 'cron'
}

function isCronSchedule(schedule: ScheduleConfig): schedule is CronSchedule {
  return schedule.type === 'cron'
}

export interface SchedulerEngineOptions {
  registry: TaskRegistry
  executor?: Executor
  eventBus?: Pick<IEventBus, 'on'>
  now?: () => number
  cronTickMs?: number
  hooks?: SchedulerEngineHooks
}

export interface SchedulerEngineHooks {
  onTaskExecutionStart?: (task: ScheduledTask) => void
  onTaskExecutionFinished?: (task: ScheduledTask, result: ExecutionResult) => void
}

export class SchedulerEngine {
  private readonly registry: TaskRegistry
  private readonly executor: Executor
  private readonly eventBus: Pick<IEventBus, 'on'>
  private readonly now: () => number
  private readonly cronTickMs: number
  private readonly hooks?: SchedulerEngineHooks

  private readonly intervalTimers = new Map<string, ReturnType<typeof setInterval>>()
  private readonly eventUnsubscribers = new Map<string, Unsubscribe>()
  private readonly eventDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly cronTaskIds = new Set<string>()

  private cronTickTimer: ReturnType<typeof setInterval> | null = null
  private started = false

  constructor(options: SchedulerEngineOptions) {
    this.registry = options.registry
    this.now = options.now ?? (() => timeService.getCurrentTime().getTime())
    this.executor = options.executor ?? new Executor({ now: this.now })
    this.eventBus = options.eventBus ?? globalEventBus
    this.cronTickMs = options.cronTickMs ?? 1_000
    this.hooks = options.hooks
  }

  start(): void {
    if (this.started) {
      return
    }

    this.started = true

    for (const task of this.registry.getAll()) {
      if (task.enabled) {
        this.schedule(task)
      }
    }

    logger.info('Scheduler engine started')
  }

  stop(): void {
    if (!this.started) {
      return
    }

    this.started = false
    this.clearAllSchedules()

    logger.info('Scheduler engine stopped')
  }

  isStarted(): boolean {
    return this.started
  }

  schedule(task: ScheduledTask): void {
    this.unschedule(task.id)

    if (!this.started || !task.enabled) {
      task.nextRunAt = undefined
      return
    }

    if (isIntervalTask(task)) {
      this.scheduleIntervalTask(task)
      return
    }
    if (isEventTask(task)) {
      this.scheduleEventTask(task)
      return
    }
    if (isCronTask(task)) {
      this.scheduleCronTask(task)
    }
  }

  unschedule(taskId: string): void {
    const intervalTimer = this.intervalTimers.get(taskId)
    if (intervalTimer) {
      clearInterval(intervalTimer)
      this.intervalTimers.delete(taskId)
    }

    const unsubscribe = this.eventUnsubscribers.get(taskId)
    if (unsubscribe) {
      unsubscribe()
      this.eventUnsubscribers.delete(taskId)
    }

    const debounceTimer = this.eventDebounceTimers.get(taskId)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      this.eventDebounceTimers.delete(taskId)
    }

    if (this.cronTaskIds.has(taskId)) {
      this.cronTaskIds.delete(taskId)
      this.ensureCronTickTimerState()
    }

    const task = this.registry.get(taskId)
    if (task) {
      task.nextRunAt = undefined
    }
  }

  reschedule(taskId: string): boolean {
    const task = this.registry.get(taskId)
    if (!task) {
      return false
    }

    this.schedule(task)
    return true
  }

  async executeTask(taskId: string, options: { force?: boolean } = {}): Promise<ExecutionResult | undefined> {
    const task = this.registry.get(taskId)
    if (!task || (!task.enabled && !options.force)) {
      return undefined
    }

    this.hooks?.onTaskExecutionStart?.(task)

    const result = await this.executor.execute(task)
    this.hooks?.onTaskExecutionFinished?.(task, result)

    if (result.outcome === 'skipped') {
      return result
    }

    if (!task.enabled) {
      task.nextRunAt = undefined
      return result
    }

    if (isCronTask(task)) {
      task.nextRunAt = getNextCronRun(task.schedule.expression, this.now())
    }

    return result
  }

  private scheduleIntervalTask(task: ScheduledTask & { schedule: IntervalSchedule }): void {
    const schedule = task.schedule
    task.nextRunAt = this.now() + schedule.ms

    const onTick = () => {
      const currentTask = this.registry.get(task.id)
      if (!currentTask || !currentTask.enabled || !this.started) {
        return
      }

      currentTask.nextRunAt = this.now() + schedule.ms
      void this.executeTask(task.id)
    }

    const timer = setInterval(onTick, schedule.ms)
    this.intervalTimers.set(task.id, timer)

    if (schedule.immediate) {
      void this.executeTask(task.id)
    }
  }

  private scheduleEventTask(task: ScheduledTask & { schedule: EventSchedule }): void {
    const schedule = task.schedule

    const trigger = () => {
      const currentTask = this.registry.get(task.id)
      if (!currentTask || !currentTask.enabled || !this.started) {
        return
      }

      void this.executeTask(task.id)
    }

    const handler = () => {
      if (schedule.debounce && schedule.debounce > 0) {
        const existingDebounceTimer = this.eventDebounceTimers.get(task.id)
        if (existingDebounceTimer) {
          clearTimeout(existingDebounceTimer)
        }

        const debounceTimer = setTimeout(() => {
          this.eventDebounceTimers.delete(task.id)
          trigger()
        }, schedule.debounce)

        this.eventDebounceTimers.set(task.id, debounceTimer)
        return
      }

      trigger()
    }

    const unsubscribe = this.eventBus.on(schedule.eventName, handler)
    this.eventUnsubscribers.set(task.id, unsubscribe)
    task.nextRunAt = undefined
  }

  private scheduleCronTask(task: ScheduledTask & { schedule: CronSchedule }): void {
    task.nextRunAt = getNextCronRun(task.schedule.expression, this.now())
    this.cronTaskIds.add(task.id)
    this.ensureCronTickTimerState()
  }

  private ensureCronTickTimerState(): void {
    if (!this.started || this.cronTaskIds.size === 0) {
      if (this.cronTickTimer) {
        clearInterval(this.cronTickTimer)
        this.cronTickTimer = null
      }
      return
    }

    if (this.cronTickTimer) {
      return
    }

    this.cronTickTimer = setInterval(() => {
      this.tickCronTasks()
    }, this.cronTickMs)
  }

  private tickCronTasks(): void {
    if (!this.started || this.cronTaskIds.size === 0) {
      return
    }

    const currentTime = this.now()

    for (const taskId of this.cronTaskIds) {
      const task = this.registry.get(taskId)
      if (!task || !task.enabled || !isCronSchedule(task.schedule)) {
        this.unschedule(taskId)
        continue
      }

      if (task.nextRunAt === undefined) {
        task.nextRunAt = getNextCronRun(task.schedule.expression, currentTime)
      }

      if (task.nextRunAt !== undefined && task.nextRunAt <= currentTime) {
        task.nextRunAt = getNextCronRun(task.schedule.expression, currentTime)
        void this.executeTask(task.id)
      }
    }
  }

  private clearAllSchedules(): void {
    for (const timer of this.intervalTimers.values()) {
      clearInterval(timer)
    }
    this.intervalTimers.clear()

    for (const unsubscribe of this.eventUnsubscribers.values()) {
      unsubscribe()
    }
    this.eventUnsubscribers.clear()

    for (const timer of this.eventDebounceTimers.values()) {
      clearTimeout(timer)
    }
    this.eventDebounceTimers.clear()

    if (this.cronTickTimer) {
      clearInterval(this.cronTickTimer)
      this.cronTickTimer = null
    }

    this.cronTaskIds.clear()

    for (const task of this.registry.getAll()) {
      task.nextRunAt = undefined
    }
  }
}
