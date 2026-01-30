/**
 * 任务调度器
 * 管理任务的自动执行和定时调度
 */

import type { LLMTask, AutoExecutionConfig, TaskExecutionMode } from './types';
import { loggerService } from '@/services/logger';

const logger = loggerService.child('service:taskScheduler');

// ==================== 类型定义 ====================

/** 调度上下文 */
export interface SchedulerContext {
  /** 获取任务 */
  getTask: (id: string) => LLMTask | undefined;
  /** 更新任务 */
  updateTask: (id: string, updates: Partial<LLMTask>) => boolean;
  /** 执行任务 */
  executeTask: (id: string) => Promise<boolean>;
  /** 添加日志 */
  addLog: (taskId: string, level: 'info' | 'warn' | 'error', message: string) => void;
}

// ==================== 调度器实现 ====================

/**
 * 任务调度器
 * 管理自动执行任务的定时器
 */
export class TaskScheduler {
  /** 定时器映射：taskId -> timer */
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** 调度上下文 */
  private context: SchedulerContext | null = null;

  /**
   * 初始化调度器
   * @param context 调度上下文
   */
  initialize(context: SchedulerContext): void {
    this.context = context;
    logger.info('调度器已初始化');
  }

  /**
   * 启动任务的自动执行
   * @param taskId 任务 ID
   * @param executeImmediately 是否立即执行一次（默认 true）
   */
  start(taskId: string, executeImmediately = true): boolean {
    if (!this.context) {
      logger.error('调度器未初始化');
      return false;
    }

    const task = this.context.getTask(taskId);
    if (!task) {
      logger.warn(`任务不存在: ${taskId}`);
      return false;
    }

    if (task.executionMode !== 'auto') {
      logger.warn(`任务 ${taskId} 不是自动执行模式`);
      return false;
    }

    // 确保有自动执行配置
    if (!task.autoConfig) {
      this.context.updateTask(taskId, {
        autoConfig: {
          enabled: true,
          intervalMinutes: 30,
          maxExecutions: 0,
          executionCount: 0,
        },
      });
    } else {
      this.context.updateTask(taskId, {
        autoConfig: { ...task.autoConfig, enabled: true },
      });
    }

    const config = task.autoConfig || { intervalMinutes: 30 };
    this.context.addLog(
      taskId,
      'info',
      `自动执行已启动，间隔 ${config.intervalMinutes} 分钟`
    );

    // 立即执行一次
    if (executeImmediately) {
      this.context.executeTask(taskId);
    } else {
      // 不立即执行，安排下次执行
      this.scheduleNext(taskId);
    }

    return true;
  }

  /**
   * 停止任务的自动执行
   * @param taskId 任务 ID
   */
  stop(taskId: string): boolean {
    if (!this.context) {
      return false;
    }

    const task = this.context.getTask(taskId);
    if (!task) {
      return false;
    }

    // 清除定时器
    this.clearTimer(taskId);

    // 更新配置
    if (task.autoConfig) {
      this.context.updateTask(taskId, {
        autoConfig: {
          ...task.autoConfig,
          enabled: false,
          nextExecutionAt: undefined,
        },
      });
    }

    this.context.addLog(taskId, 'info', '自动执行已停止');
    return true;
  }

  /**
   * 安排下次执行
   * @param taskId 任务 ID
   */
  scheduleNext(taskId: string): void {
    if (!this.context) {
      return;
    }

    const task = this.context.getTask(taskId);
    if (!task || !task.autoConfig?.enabled) {
      return;
    }

    // 检查是否达到最大执行次数
    if (
      task.autoConfig.maxExecutions > 0 &&
      task.autoConfig.executionCount >= task.autoConfig.maxExecutions
    ) {
      this.context.addLog(
        taskId,
        'info',
        `已达到最大执行次数 (${task.autoConfig.maxExecutions})，自动执行已停止`
      );
      this.stop(taskId);
      return;
    }

    // 计算下次执行时间
    const intervalMs = task.autoConfig.intervalMinutes * 60 * 1000;
    const nextTime = Date.now() + intervalMs;

    // 更新下次执行时间
    this.context.updateTask(taskId, {
      autoConfig: { ...task.autoConfig, nextExecutionAt: nextTime },
    });

    // 清除旧定时器
    this.clearTimer(taskId);

    // 设置新定时器
    const timer = setTimeout(() => {
      const currentTask = this.context?.getTask(taskId);
      if (currentTask?.autoConfig?.enabled) {
        this.context?.executeTask(taskId);
      }
    }, intervalMs);

    this.timers.set(taskId, timer);

    this.context.addLog(
      taskId,
      'info',
      `下次执行时间: ${new Date(nextTime).toLocaleTimeString()}`
    );
  }

  /**
   * 更新自动执行配置
   * @param taskId 任务 ID
   * @param config 配置更新
   */
  updateConfig(taskId: string, config: Partial<AutoExecutionConfig>): boolean {
    if (!this.context) {
      return false;
    }

    const task = this.context.getTask(taskId);
    if (!task || task.executionMode !== 'auto') {
      return false;
    }

    const currentConfig = task.autoConfig || {
      enabled: false,
      intervalMinutes: 30,
      maxExecutions: 0,
      executionCount: 0,
    };

    const wasEnabled = currentConfig.enabled;
    const newConfig = { ...currentConfig, ...config };

    this.context.updateTask(taskId, { autoConfig: newConfig });

    // 如果启用状态改变
    if (!wasEnabled && newConfig.enabled) {
      this.start(taskId);
    } else if (wasEnabled && !newConfig.enabled) {
      this.stop(taskId);
    } else if (wasEnabled && config.intervalMinutes !== undefined) {
      // 间隔改变，重新调度
      this.scheduleNext(taskId);
    }

    return true;
  }

  /**
   * 更新任务执行模式
   * @param taskId 任务 ID
   * @param newMode 新的执行模式
   */
  updateExecutionMode(taskId: string, newMode: TaskExecutionMode): boolean {
    if (!this.context) {
      return false;
    }

    const task = this.context.getTask(taskId);
    if (!task) {
      return false;
    }

    // 不能修改正在运行的任务
    if (task.status === 'running') {
      this.context.addLog(taskId, 'warn', '无法修改正在运行的任务的执行模式');
      return false;
    }

    const oldMode = task.executionMode;
    if (oldMode === newMode) {
      return true;
    }

    // 从 auto 模式切换出去时，停止自动执行
    if (oldMode === 'auto') {
      this.stop(taskId);
    }

    // 更新执行模式
    const updates: Partial<LLMTask> = { executionMode: newMode };

    // 切换到 auto 模式时，初始化 autoConfig
    if (newMode === 'auto' && !task.autoConfig) {
      updates.autoConfig = {
        enabled: false,
        intervalMinutes: 30,
        maxExecutions: 0,
        executionCount: 0,
      };
    }

    // 如果任务已完成且切换到可重复模式，重置为待执行状态
    if (
      task.status === 'completed' &&
      (newMode === 'repeatable' || newMode === 'auto')
    ) {
      updates.status = 'pending';
    }

    this.context.updateTask(taskId, updates);
    this.context.addLog(
      taskId,
      'info',
      `执行模式已从「${this.getModeLabel(oldMode)}」切换为「${this.getModeLabel(newMode)}」`
    );

    return true;
  }

  /**
   * 获取下次执行时间
   * @param taskId 任务 ID
   */
  getNextExecutionTime(taskId: string): number | undefined {
    const task = this.context?.getTask(taskId);
    return task?.autoConfig?.nextExecutionAt;
  }

  /**
   * 检查任务是否正在自动执行
   * @param taskId 任务 ID
   */
  isRunning(taskId: string): boolean {
    return this.timers.has(taskId);
  }

  /**
   * 获取所有正在自动执行的任务 ID
   */
  getRunningTaskIds(): string[] {
    return Array.from(this.timers.keys());
  }

  /**
   * 清除所有定时器
   */
  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    logger.debug('已清除所有定时器');
  }

  /**
   * 销毁调度器
   */
  destroy(): void {
    this.clearAll();
    this.context = null;
    logger.info('调度器已销毁');
  }

  /**
   * 清除单个任务的定时器
   */
  private clearTimer(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
  }

  /**
   * 获取执行模式的中文标签
   */
  private getModeLabel(mode: TaskExecutionMode): string {
    const labels: Record<TaskExecutionMode, string> = {
      once: '一次性',
      repeatable: '可重复',
      auto: '自动循环',
    };
    return labels[mode] || mode;
  }
}

// 导出单例
let taskSchedulerInstance: TaskScheduler | null = null;

export function getTaskScheduler(): TaskScheduler {
  if (!taskSchedulerInstance) {
    taskSchedulerInstance = new TaskScheduler();
  }
  return taskSchedulerInstance;
}

// 用于测试的重置函数
export function resetTaskScheduler(): void {
  if (taskSchedulerInstance) {
    taskSchedulerInstance.destroy();
  }
  taskSchedulerInstance = null;
}
