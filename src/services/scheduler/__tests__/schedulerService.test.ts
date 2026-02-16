import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '@/services/eventBus'
import { SchedulerService } from '../schedulerService'

describe('SchedulerService', () => {
  let eventBus: EventBus
  let scheduler: SchedulerService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0, 0))

    eventBus = new EventBus()
    scheduler = new SchedulerService({
      eventBus,
      now: () => Date.now(),
      cronTickMs: 1_000,
    })
  })

  afterEach(() => {
    scheduler.stop()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('interval 任务可执行', async () => {
    const executeSpy = vi.fn()
    const handler = async () => {
      executeSpy()
    }

    scheduler.register({
      id: 'test:interval',
      appId: 'test-app',
      name: 'interval task',
      schedule: {
        type: 'interval',
        ms: 1_000,
      },
      handler,
    })

    scheduler.start()

    await vi.advanceTimersByTimeAsync(2_100)

    expect(executeSpy).toHaveBeenCalledTimes(2)
  })

  it('cron 任务能正确计算 nextRun', async () => {
    const executeSpy = vi.fn()
    const handler = async () => {
      executeSpy()
    }

    scheduler.register({
      id: 'test:cron',
      appId: 'test-app',
      name: 'cron task',
      schedule: {
        type: 'cron',
        expression: '*/5 * * * *',
      },
      handler,
    })

    scheduler.start()

    const task = scheduler.getTask('test:cron')
    expect(task?.nextRunAt).toBe(Date.now() + 5 * 60 * 1000)

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('event 任务可被事件触发', async () => {
    const executeSpy = vi.fn()
    const handler = async () => {
      executeSpy()
    }

    scheduler.register({
      id: 'test:event',
      appId: 'test-app',
      name: 'event task',
      schedule: {
        type: 'event',
        eventName: 'test:event:trigger',
      },
      handler,
    })

    scheduler.start()
    eventBus.emit('test:event:trigger', { source: 'test' })

    await Promise.resolve()

    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('pause/resume 生效', async () => {
    const executeSpy = vi.fn()
    const handler = async () => {
      executeSpy()
    }

    scheduler.register({
      id: 'test:pause-resume',
      appId: 'test-app',
      name: 'pause resume task',
      schedule: {
        type: 'interval',
        ms: 1_000,
      },
      handler,
    })

    scheduler.start()
    scheduler.pause('test:pause-resume')

    await vi.advanceTimersByTimeAsync(3_000)
    expect(executeSpy).toHaveBeenCalledTimes(0)

    scheduler.resume('test:pause-resume')

    await vi.advanceTimersByTimeAsync(1_000)
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('trigger 可立即执行', async () => {
    const executeSpy = vi.fn()
    const startedSpy = vi.fn()
    const completedSpy = vi.fn()

    const handler = async () => {
      executeSpy()
    }

    scheduler.register({
      id: 'test:trigger',
      appId: 'test-app',
      name: 'trigger task',
      schedule: {
        type: 'interval',
        ms: 60_000,
      },
      handler,
    })

    scheduler.start()
    scheduler.pause('test:trigger')

    eventBus.on('scheduler:task:started', startedSpy)
    eventBus.on('scheduler:task:completed', completedSpy)

    const result = await scheduler.trigger('test:trigger')

    expect(result?.outcome).toBe('success')
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(startedSpy).toHaveBeenCalledTimes(1)
    expect(completedSpy).toHaveBeenCalledTimes(1)
  })

  it('timeout 会中断并标记结果', async () => {
    const handler = async () => {
      await new Promise<void>(() => {})
    }

    scheduler.register({
      id: 'test:timeout',
      appId: 'test-app',
      name: 'timeout task',
      schedule: {
        type: 'event',
        eventName: 'test:timeout',
      },
      timeout: 1_000,
      handler,
    })

    const executionPromise = scheduler.trigger('test:timeout')

    await vi.advanceTimersByTimeAsync(1_000)

    const result = await executionPromise
    const task = scheduler.getTask('test:timeout')

    expect(result?.outcome).toBe('timeout')
    expect(task?.lastResult).toBe('timeout')
    expect(task?.timeoutCount).toBe(1)
  })

  it('retryOnFail 按次数重试', async () => {
    let attempts = 0
    const handler = async () => {
      attempts += 1
      if (attempts < 3) {
        throw new Error(`fail-${attempts}`)
      }
    }

    scheduler.register({
      id: 'test:retry',
      appId: 'test-app',
      name: 'retry task',
      schedule: {
        type: 'event',
        eventName: 'test:retry',
      },
      retryOnFail: 2,
      handler,
    })

    const executionPromise = scheduler.trigger('test:retry')

    await vi.advanceTimersByTimeAsync(3_000)

    const result = await executionPromise

    expect(result?.outcome).toBe('success')
    expect(result?.attempt).toBe(3)
    expect(attempts).toBe(3)
  })

  it('unregister 后不再触发', async () => {
    const executeSpy = vi.fn()
    const handler = async () => {
      executeSpy()
    }

    scheduler.register({
      id: 'test:unregister',
      appId: 'test-app',
      name: 'unregister task',
      schedule: {
        type: 'interval',
        ms: 1_000,
      },
      handler,
    })

    scheduler.start()
    scheduler.unregister('test:unregister')

    await vi.advanceTimersByTimeAsync(3_000)

    expect(executeSpy).toHaveBeenCalledTimes(0)
    expect(scheduler.getTask('test:unregister')).toBeUndefined()
  })
})
