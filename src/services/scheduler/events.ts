import type { ExecutionResult, ScheduleConfig } from './types'

export const SCHEDULER_EVENTS = {
  TASK_REGISTERED: 'scheduler:task:registered',
  TASK_UNREGISTERED: 'scheduler:task:unregistered',
  TASK_PAUSED: 'scheduler:task:paused',
  TASK_RESUMED: 'scheduler:task:resumed',
  TASK_STARTED: 'scheduler:task:started',
  TASK_COMPLETED: 'scheduler:task:completed',
  TASK_FAILED: 'scheduler:task:failed',
  TASK_TIMEOUT: 'scheduler:task:timeout',
  TASK_SKIPPED: 'scheduler:task:skipped',
} as const

export type SchedulerEventName = (typeof SCHEDULER_EVENTS)[keyof typeof SCHEDULER_EVENTS]

export interface SchedulerTaskBaseEvent {
  taskId: string
  taskName: string
  appId: string
  scheduleType: ScheduleConfig['type']
  timestamp: number
}

export interface SchedulerTaskRegisteredEvent extends SchedulerTaskBaseEvent {}

export interface SchedulerTaskUnregisteredEvent extends SchedulerTaskBaseEvent {}

export interface SchedulerTaskStateChangedEvent extends SchedulerTaskBaseEvent {
  enabled: boolean
}

export interface SchedulerTaskStartedEvent extends SchedulerTaskBaseEvent {
  attempt: number
}

export interface SchedulerTaskCompletedEvent extends SchedulerTaskBaseEvent {
  result: ExecutionResult
}

export interface SchedulerTaskFailedEvent extends SchedulerTaskBaseEvent {
  result: ExecutionResult
}

export interface SchedulerTaskTimeoutEvent extends SchedulerTaskBaseEvent {
  result: ExecutionResult
}

export interface SchedulerTaskSkippedEvent extends SchedulerTaskBaseEvent {
  result: ExecutionResult
}

export interface SchedulerEventMap {
  [SCHEDULER_EVENTS.TASK_REGISTERED]: SchedulerTaskRegisteredEvent
  [SCHEDULER_EVENTS.TASK_UNREGISTERED]: SchedulerTaskUnregisteredEvent
  [SCHEDULER_EVENTS.TASK_PAUSED]: SchedulerTaskStateChangedEvent
  [SCHEDULER_EVENTS.TASK_RESUMED]: SchedulerTaskStateChangedEvent
  [SCHEDULER_EVENTS.TASK_STARTED]: SchedulerTaskStartedEvent
  [SCHEDULER_EVENTS.TASK_COMPLETED]: SchedulerTaskCompletedEvent
  [SCHEDULER_EVENTS.TASK_FAILED]: SchedulerTaskFailedEvent
  [SCHEDULER_EVENTS.TASK_TIMEOUT]: SchedulerTaskTimeoutEvent
  [SCHEDULER_EVENTS.TASK_SKIPPED]: SchedulerTaskSkippedEvent
}
