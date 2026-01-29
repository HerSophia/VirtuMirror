/**
 * TaskScheduler 单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  TaskScheduler,
  getTaskScheduler,
  resetTaskScheduler,
} from '../TaskScheduler';
import type { SchedulerContext } from '../TaskScheduler';
import type { LLMTask, AutoExecutionConfig } from '../types';
import { getDefaultLLMConfig, getDefaultAutoConfig } from '../utils';
import { RequestPriority } from '@/services/ai/types';

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;
  let mockContext: SchedulerContext;
  let tasks: Map<string, LLMTask>;
  let logs: Array<{ taskId: string; level: string; message: string }>;
  let executedTasks: string[];

  const createTask = (
    id: string,
    overrides: Partial<LLMTask> = {}
  ): LLMTask => ({
    id,
    definitionId: 'test:def',
    appId: 'test',
    name: 'Test Task',
    status: 'pending',
    executionMode: 'auto',
    type: 'manual',
    input: {},
    config: getDefaultLLMConfig(),
    priority: RequestPriority.NORMAL,
    autoConfig: {
      enabled: true,
      intervalMinutes: 30,
      maxExecutions: 0,
      executionCount: 0,
    },
    createdAt: Date.now(),
    totalExecutions: 0,
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    resetTaskScheduler();
    scheduler = getTaskScheduler();

    tasks = new Map();
    logs = [];
    executedTasks = [];

    mockContext = {
      getTask: (id) => tasks.get(id),
      updateTask: (id, updates) => {
        const task = tasks.get(id);
        if (!task) return false;
        tasks.set(id, { ...task, ...updates });
        return true;
      },
      executeTask: async (id) => {
        executedTasks.push(id);
        return true;
      },
      addLog: (taskId, level, message) => {
        logs.push({ taskId, level, message });
      },
    };

    scheduler.initialize(mockContext);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialize', () => {
    it('应该初始化调度器', () => {
      const newScheduler = new TaskScheduler();
      expect(() => newScheduler.start('test')).not.toThrow();

      newScheduler.initialize(mockContext);
      // 初始化后应该能正常工作
    });
  });

  describe('start', () => {
    it('应该启动自动执行任务', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);

      const result = scheduler.start('task-1');

      expect(result).toBe(true);
      // start 会立即执行任务，执行完成后才会调用 scheduleNext 设置定时器
      // 所以在这里检查是否执行过
      expect(executedTasks).toContain('task-1');
    });

    it('应该立即执行一次任务', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);

      scheduler.start('task-1');

      expect(executedTasks).toContain('task-1');
    });

    it('应该可以跳过立即执行', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);

      scheduler.start('task-1', false);

      expect(executedTasks).not.toContain('task-1');
    });

    it('应该返回 false 当调度器未初始化', () => {
      const newScheduler = new TaskScheduler();
      const result = newScheduler.start('task-1');

      expect(result).toBe(false);
    });

    it('应该返回 false 当任务不存在', () => {
      const result = scheduler.start('non-existent');

      expect(result).toBe(false);
    });

    it('应该返回 false 当任务不是自动执行模式', () => {
      const task = createTask('task-1', { executionMode: 'once' });
      tasks.set('task-1', task);

      const result = scheduler.start('task-1');

      expect(result).toBe(false);
    });

    it('应该创建默认的 autoConfig 当不存在', () => {
      const task = createTask('task-1', { autoConfig: undefined });
      tasks.set('task-1', task);

      scheduler.start('task-1');

      const updatedTask = tasks.get('task-1');
      expect(updatedTask?.autoConfig).toBeDefined();
      expect(updatedTask?.autoConfig?.enabled).toBe(true);
    });

    it('应该添加日志', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);

      scheduler.start('task-1');

      expect(logs.some((l) => l.message.includes('自动执行已启动'))).toBe(true);
    });
  });

  describe('stop', () => {
    it('应该停止自动执行任务', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1');

      const result = scheduler.stop('task-1');

      expect(result).toBe(true);
      expect(scheduler.isRunning('task-1')).toBe(false);
    });

    it('应该更新 autoConfig.enabled 为 false', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1');

      scheduler.stop('task-1');

      const updatedTask = tasks.get('task-1');
      expect(updatedTask?.autoConfig?.enabled).toBe(false);
    });

    it('应该清除下次执行时间', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1', false);

      // 应该设置了下次执行时间
      expect(tasks.get('task-1')?.autoConfig?.nextExecutionAt).toBeDefined();

      scheduler.stop('task-1');

      expect(tasks.get('task-1')?.autoConfig?.nextExecutionAt).toBeUndefined();
    });

    it('应该返回 false 当任务不存在', () => {
      const result = scheduler.stop('non-existent');

      expect(result).toBe(false);
    });

    it('应该添加日志', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1');
      logs = [];

      scheduler.stop('task-1');

      expect(logs.some((l) => l.message.includes('自动执行已停止'))).toBe(true);
    });
  });

  describe('scheduleNext', () => {
    it('应该安排下次执行', () => {
      const task = createTask('task-1', {
        autoConfig: {
          enabled: true,
          intervalMinutes: 10,
          maxExecutions: 0,
          executionCount: 0,
        },
      });
      tasks.set('task-1', task);

      scheduler.scheduleNext('task-1');

      expect(scheduler.isRunning('task-1')).toBe(true);
      expect(scheduler.getNextExecutionTime('task-1')).toBeDefined();
    });

    it('应该在间隔后执行任务', () => {
      const task = createTask('task-1', {
        autoConfig: {
          enabled: true,
          intervalMinutes: 10,
          maxExecutions: 0,
          executionCount: 0,
        },
      });
      tasks.set('task-1', task);

      scheduler.scheduleNext('task-1');
      executedTasks = [];

      // 前进 10 分钟
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(executedTasks).toContain('task-1');
    });

    it('应该在达到最大执行次数后停止', () => {
      const task = createTask('task-1', {
        autoConfig: {
          enabled: true,
          intervalMinutes: 10,
          maxExecutions: 3,
          executionCount: 3,
        },
      });
      tasks.set('task-1', task);

      scheduler.scheduleNext('task-1');

      const updatedTask = tasks.get('task-1');
      expect(updatedTask?.autoConfig?.enabled).toBe(false);
      expect(logs.some((l) => l.message.includes('最大执行次数'))).toBe(true);
    });

    it('应该不执行当任务未启用', () => {
      const task = createTask('task-1', {
        autoConfig: {
          enabled: false,
          intervalMinutes: 10,
          maxExecutions: 0,
          executionCount: 0,
        },
      });
      tasks.set('task-1', task);

      scheduler.scheduleNext('task-1');

      expect(scheduler.isRunning('task-1')).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);

      scheduler.updateConfig('task-1', { intervalMinutes: 60 });

      const updatedTask = tasks.get('task-1');
      expect(updatedTask?.autoConfig?.intervalMinutes).toBe(60);
    });

    it('应该启动任务当 enabled 从 false 变为 true', () => {
      const task = createTask('task-1', {
        autoConfig: {
          enabled: false,
          intervalMinutes: 30,
          maxExecutions: 0,
          executionCount: 0,
        },
      });
      tasks.set('task-1', task);

      scheduler.updateConfig('task-1', { enabled: true });

      // updateConfig 调用 start，start 会立即执行任务
      expect(executedTasks).toContain('task-1');
    });

    it('应该停止任务当 enabled 从 true 变为 false', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1', false);

      scheduler.updateConfig('task-1', { enabled: false });

      expect(scheduler.isRunning('task-1')).toBe(false);
    });

    it('应该重新调度当间隔改变', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1', false);

      const oldNextTime = scheduler.getNextExecutionTime('task-1');

      scheduler.updateConfig('task-1', { intervalMinutes: 60 });

      const newNextTime = scheduler.getNextExecutionTime('task-1');
      expect(newNextTime).not.toBe(oldNextTime);
    });

    it('应该返回 false 当任务不是自动执行模式', () => {
      const task = createTask('task-1', { executionMode: 'once' });
      tasks.set('task-1', task);

      const result = scheduler.updateConfig('task-1', { intervalMinutes: 60 });

      expect(result).toBe(false);
    });
  });

  describe('updateExecutionMode', () => {
    it('应该更新执行模式', () => {
      const task = createTask('task-1', { executionMode: 'once', status: 'pending' });
      tasks.set('task-1', task);

      const result = scheduler.updateExecutionMode('task-1', 'auto');

      expect(result).toBe(true);
      expect(tasks.get('task-1')?.executionMode).toBe('auto');
    });

    it('应该停止自动执行当从 auto 模式切换', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1', false);

      scheduler.updateExecutionMode('task-1', 'once');

      expect(scheduler.isRunning('task-1')).toBe(false);
    });

    it('应该创建 autoConfig 当切换到 auto 模式', () => {
      const task = createTask('task-1', {
        executionMode: 'once',
        autoConfig: undefined,
      });
      tasks.set('task-1', task);

      scheduler.updateExecutionMode('task-1', 'auto');

      expect(tasks.get('task-1')?.autoConfig).toBeDefined();
    });

    it('应该重置状态为 pending 当任务已完成且切换到可重复模式', () => {
      const task = createTask('task-1', {
        executionMode: 'once',
        status: 'completed',
      });
      tasks.set('task-1', task);

      scheduler.updateExecutionMode('task-1', 'repeatable');

      expect(tasks.get('task-1')?.status).toBe('pending');
    });

    it('应该返回 false 当任务正在运行', () => {
      const task = createTask('task-1', { status: 'running' });
      tasks.set('task-1', task);

      const result = scheduler.updateExecutionMode('task-1', 'once');

      expect(result).toBe(false);
      expect(logs.some((l) => l.message.includes('无法修改正在运行'))).toBe(true);
    });

    it('应该返回 true 当模式相同', () => {
      const task = createTask('task-1', { executionMode: 'auto' });
      tasks.set('task-1', task);

      const result = scheduler.updateExecutionMode('task-1', 'auto');

      expect(result).toBe(true);
    });

    it('应该添加日志', () => {
      const task = createTask('task-1', { executionMode: 'once', status: 'pending' });
      tasks.set('task-1', task);

      scheduler.updateExecutionMode('task-1', 'auto');

      expect(logs.some((l) => l.message.includes('执行模式已从'))).toBe(true);
    });
  });

  describe('getNextExecutionTime', () => {
    it('应该返回下次执行时间', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1', false);

      const nextTime = scheduler.getNextExecutionTime('task-1');

      expect(nextTime).toBeDefined();
      expect(nextTime).toBeGreaterThan(Date.now());
    });

    it('应该返回 undefined 当任务不存在', () => {
      const result = scheduler.getNextExecutionTime('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('isRunning', () => {
    it('应该返回 true 当任务有定时器', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1', false);

      expect(scheduler.isRunning('task-1')).toBe(true);
    });

    it('应该返回 false 当任务没有定时器', () => {
      expect(scheduler.isRunning('task-1')).toBe(false);
    });
  });

  describe('getRunningTaskIds', () => {
    it('应该返回所有正在运行的任务 ID', () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');
      const task3 = createTask('task-3');
      tasks.set('task-1', task1);
      tasks.set('task-2', task2);
      tasks.set('task-3', task3);

      scheduler.start('task-1', false);
      scheduler.start('task-2', false);

      const running = scheduler.getRunningTaskIds();

      expect(running).toContain('task-1');
      expect(running).toContain('task-2');
      expect(running).not.toContain('task-3');
    });
  });

  describe('clearAll', () => {
    it('应该清除所有定时器', () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');
      tasks.set('task-1', task1);
      tasks.set('task-2', task2);
      scheduler.start('task-1', false);
      scheduler.start('task-2', false);

      scheduler.clearAll();

      expect(scheduler.isRunning('task-1')).toBe(false);
      expect(scheduler.isRunning('task-2')).toBe(false);
    });
  });

  describe('destroy', () => {
    it('应该清除所有定时器并重置上下文', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      scheduler.start('task-1', false);

      scheduler.destroy();

      expect(scheduler.isRunning('task-1')).toBe(false);
      // 销毁后操作应该返回 false
      expect(scheduler.start('task-1')).toBe(false);
    });
  });

  describe('单例模式', () => {
    it('getTaskScheduler 应该返回同一个实例', () => {
      const instance1 = getTaskScheduler();
      const instance2 = getTaskScheduler();

      expect(instance1).toBe(instance2);
    });

    it('resetTaskScheduler 应该重置实例', () => {
      const task = createTask('task-1');
      tasks.set('task-1', task);
      const instance1 = getTaskScheduler();
      instance1.initialize(mockContext);
      instance1.start('task-1', false);

      resetTaskScheduler();

      const instance2 = getTaskScheduler();
      expect(instance2.isRunning('task-1')).toBe(false);
    });
  });
});
