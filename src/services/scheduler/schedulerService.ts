import { eventBus as globalEventBus } from '@/services/eventBus'
import { loggerService } from '@/services/logger'
import { timeService } from '@/services/time/timeService'
import type { IEventBus } from '@/types/eventBus'
import {
  SCHEDULER_EVENTS,
  type SchedulerEventMap,
  type SchedulerTaskBaseEvent,
  type SchedulerTaskCompletedEvent,
  type SchedulerTaskFailedEvent,
  type SchedulerTaskSkippedEvent,
  type SchedulerTaskStartedEvent,
  type SchedulerTaskStateChangedEvent,
  type SchedulerTaskTimeoutEvent,
  type SchedulerTaskUnregisteredEvent,
} from './events'
import { Executor } from './executor'
import { SchedulerEngine } from './schedulerEngine'
import { TaskRegistry } from './taskRegistry'
import type {
  ExecutionResult,
  ScheduledTask,
  ScheduledTaskInput,
  SchedulerStatistics,
} from './types'

const logger = loggerService.child('service:scheduler')

type SchedulerEventBus = Pick<IEventBus, 'emit' | 'on'>

export interface SchedulerServiceOptions {
  eventBus?: SchedulerEventBus
  executor?: Executor
  now?: () => number
  cronTickMs?: number
}

export class SchedulerService {
  private readonly registry: TaskRegistry
  private readonly engine: SchedulerEngine
  private readonly eventBus: SchedulerEventBus
  private readonly now: () => number

  constructor(options: SchedulerServiceOptions = {}) {
    this.registry = new TaskRegistry()
    this.eventBus = options.eventBus ?? globalEventBus
    this.now = options.now ?? (() => timeService.getCurrentTime().getTime())

    this.engine = new SchedulerEngine({
      registry: this.registry,
      executor: options.executor,
      eventBus: this.eventBus,
      now: this.now,
      cronTickMs: options.cronTickMs,
      hooks: {
        onTaskExecutionStart: (task) => this.onTaskExecutionStart(task),
        onTaskExecutionFinished: (task, result) => this.onTaskExecutionFinished(task, result),
      },
    })
  }

  register(taskInput: ScheduledTaskInput): string {
    const task = this.registry.register(taskInput)

    if (this.engine.isStarted() && task.enabled) {
      this.engine.schedule(task)
    }

    this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_REGISTERED, this.createBaseEvent(task))
    logger.info(`Task registered: ${task.id}`, {
      appId: task.appId,
      schedule: task.schedule.type,
    })

    return task.id
  }

  unregister(taskId: string): boolean {
    const task = this.registry.get(taskId)
    if (!task) {
      return false
    }

    this.engine.unschedule(taskId)
    const success = this.registry.unregister(taskId)

    if (success) {
      const payload: SchedulerTaskUnregisteredEvent = this.createBaseEvent(task)
      this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_UNREGISTERED, payload)
      logger.info(`Task unregistered: ${taskId}`)
    }

    return success
  }

  pause(taskId: string): boolean {
    const task = this.registry.get(taskId)
    if (!task) {
      return false
    }

    if (!task.enabled) {
      return true
    }

    task.enabled = false
    this.engine.unschedule(taskId)

    const payload: SchedulerTaskStateChangedEvent = {
      ...this.createBaseEvent(task),
      enabled: false,
    }
    this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_PAUSED, payload)

    logger.info(`Task paused: ${taskId}`)
    return true
  }

  resume(taskId: string): boolean {
    const task = this.registry.get(taskId)
    if (!task) {
      return false
    }

    if (task.enabled) {
      return true
    }

    task.enabled = true

    if (this.engine.isStarted()) {
      this.engine.schedule(task)
    }

    const payload: SchedulerTaskStateChangedEvent = {
      ...this.createBaseEvent(task),
      enabled: true,
    }
    this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_RESUMED, payload)

    logger.info(`Task resumed: ${taskId}`)
    return true
  }

  async trigger(taskId: string): Promise<ExecutionResult | undefined> {
    const task = this.registry.get(taskId)
    if (!task) {
      return undefined
    }

    logger.info(`Task triggered manually: ${taskId}`)
    return this.engine.executeTask(taskId, { force: true })
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.registry.get(taskId)
  }

  getAllTasks(): ScheduledTask[] {
    return this.registry.getAll()
  }

  getTasksByApp(appId: string): ScheduledTask[] {
    return this.registry.getByApp(appId)
  }

  getStatistics(): SchedulerStatistics {
    const tasks = this.registry.getAll()

    const successfulExecutions = tasks.reduce((sum, task) => sum + task.successCount, 0)
    const timeoutExecutions = tasks.reduce((sum, task) => sum + task.timeoutCount, 0)
    const failedExecutions = tasks.reduce(
      (sum, task) => sum + Math.max(0, task.failCount - task.timeoutCount),
      0
    )
    const skippedExecutions = tasks.reduce((sum, task) => sum + task.skipCount, 0)

    return {
      totalTasks: tasks.length,
      enabledTasks: tasks.filter((task) => task.enabled).length,
      runningTasks: tasks.filter((task) => task.running).length,
      totalExecutions: successfulExecutions + failedExecutions + timeoutExecutions + skippedExecutions,
      successfulExecutions,
      failedExecutions,
      timeoutExecutions,
      skippedExecutions,
    }
  }

  start(): void {
    this.engine.start()
    logger.info('Scheduler service started')
  }

  stop(): void {
    this.engine.stop()
    logger.info('Scheduler service stopped')
  }

  isStarted(): boolean {
    return this.engine.isStarted()
  }

  private onTaskExecutionStart(task: ScheduledTask): void {
    const payload: SchedulerTaskStartedEvent = {
      ...this.createBaseEvent(task),
      attempt: 1,
    }

    this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_STARTED, payload)
    logger.debug(`Task started: ${task.id}`)
  }

  private onTaskExecutionFinished(task: ScheduledTask, result: ExecutionResult): void {
    switch (result.outcome) {
      case 'success': {
        const payload: SchedulerTaskCompletedEvent = {
          ...this.createBaseEvent(task),
          result,
        }
        this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_COMPLETED, payload)
        logger.info(`Task completed: ${task.id}`, {
          duration: result.duration,
          attempt: result.attempt,
        })
        return
      }
      case 'timeout': {
        const payload: SchedulerTaskTimeoutEvent = {
          ...this.createBaseEvent(task),
          result,
        }
        this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_TIMEOUT, payload)
        logger.warn(`Task timeout: ${task.id}`, {
          duration: result.duration,
          attempt: result.attempt,
          error: result.error,
        })
        return
      }
      case 'failed': {
        const payload: SchedulerTaskFailedEvent = {
          ...this.createBaseEvent(task),
          result,
        }
        this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_FAILED, payload)
        logger.error(`Task failed: ${task.id}`, {
          duration: result.duration,
          attempt: result.attempt,
          error: result.error,
        })
        return
      }
      case 'skipped': {
        const payload: SchedulerTaskSkippedEvent = {
          ...this.createBaseEvent(task),
          result,
        }
        this.emitSchedulerEvent(SCHEDULER_EVENTS.TASK_SKIPPED, payload)
        logger.warn(`Task skipped: ${task.id}`, {
          reason: result.reason,
        })
      }
    }
  }

  private createBaseEvent(task: ScheduledTask): SchedulerTaskBaseEvent {
    return {
      taskId: task.id,
      taskName: task.name,
      appId: task.appId,
      scheduleType: task.schedule.type,
      timestamp: this.now(),
    }
  }

  private emitSchedulerEvent<T extends keyof SchedulerEventMap>(
    eventName: T,
    payload: SchedulerEventMap[T]
  ): void {
    this.eventBus.emit(eventName, payload)
  }
}

let schedulerServiceInstance: SchedulerService | null = null

export function getSchedulerService(): SchedulerService {
  if (!schedulerServiceInstance) {
    schedulerServiceInstance = new SchedulerService()
  }
  return schedulerServiceInstance
}

export function resetSchedulerService(): void {
  if (schedulerServiceInstance) {
    schedulerServiceInstance.stop()
    schedulerServiceInstance = null
  }
}

export const schedulerService = getSchedulerService()
