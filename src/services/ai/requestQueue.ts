/**
 * 请求队列
 * 支持优先级调度和并发控制
 */

import type {
  QueueConfig,
  QueuedRequest,
  QueueStatus,
  RequestPriority,
  GenerateOptions,
  StreamOptions,
  AIError,
} from './types';
import { DEFAULT_QUEUE_CONFIG } from './constants';
import { createAIError, generateRequestId, sleep } from './utils';

/**
 * 请求队列
 * 支持优先级调度和并发控制
 */
export class RequestQueue {
  private static instance: RequestQueue;

  private config: QueueConfig;
  private queue: QueuedRequest[] = [];
  private running = new Map<string, QueuedRequest>();
  private rpmWindow: number[] = []; // 记录最近 1 分钟的请求时间戳
  private lastRequestTime = 0;
  private isProcessing = false;

  private constructor(config?: Partial<QueueConfig>) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  static getInstance(config?: Partial<QueueConfig>): RequestQueue {
    if (!this.instance) {
      this.instance = new RequestQueue(config);
    }
    return this.instance;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 入队请求
   */
  enqueue<T>(
    options: GenerateOptions | StreamOptions,
    isStream: boolean,
    priority: RequestPriority = 2 // NORMAL
  ): Promise<T> {
    // 检查队列是否已满
    if (this.queue.length >= this.config.maxQueueSize) {
      return Promise.reject(
        createAIError('QUEUE_FULL', `队列已满（最大 ${this.config.maxQueueSize}）`)
      );
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: options.requestId || generateRequestId(),
        priority,
        options,
        isStream,
        createdAt: Date.now(),
        resolve,
        reject,
        abortController: new AbortController(),
      };

      // 按优先级插入（优先级数字越小越靠前）
      const insertIndex = this.queue.findIndex(r => r.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      // 设置队列超时
      setTimeout(() => {
        if (this.queue.find(r => r.id === request.id)) {
          this.cancel(request.id, '队列等待超时');
        }
      }, this.config.queueTimeout);

      // 触发处理
      this.process();
    });
  }

  /**
   * 取消请求（队列中或执行中）
   */
  cancel(requestId: string, reason = '用户取消'): boolean {
    // 先查队列
    const queueIndex = this.queue.findIndex(r => r.id === requestId);
    if (queueIndex !== -1) {
      const request = this.queue.splice(queueIndex, 1)[0];
      request.reject(createAIError('ABORTED', reason));
      return true;
    }

    // 再查执行中
    const runningRequest = this.running.get(requestId);
    if (runningRequest) {
      runningRequest.abortController.abort();
      return true;
    }

    return false;
  }

  /**
   * 取消指定优先级的所有请求
   */
  cancelByPriority(priority: RequestPriority): number {
    let count = 0;

    // 取消队列中的
    this.queue = this.queue.filter(r => {
      if (r.priority === priority) {
        r.reject(createAIError('ABORTED', '批量取消'));
        count++;
        return false;
      }
      return true;
    });

    // 取消执行中的
    for (const [id, request] of this.running) {
      if (request.priority === priority) {
        request.abortController.abort();
        count++;
      }
    }

    return count;
  }

  /**
   * 获取队列状态
   */
  getStatus(): QueueStatus {
    const pendingByPriority = {
      0: 0, // CRITICAL
      1: 0, // HIGH
      2: 0, // NORMAL
      3: 0, // LOW
    };

    for (const request of this.queue) {
      pendingByPriority[request.priority]++;
    }

    return {
      pending: this.queue.length,
      running: this.running.size,
      pendingByPriority,
      currentRPM: this.getCurrentRPM(),
    };
  }

  /**
   * 清空队列（不影响执行中的）
   */
  clear(): void {
    for (const request of this.queue) {
      request.reject(createAIError('ABORTED', '队列已清空'));
    }
    this.queue = [];
  }

  /**
   * 注入执行器
   */
  setExecutor(
    executor: (options: GenerateOptions | StreamOptions, isStream: boolean, signal: AbortSignal) => Promise<any>
  ): void {
    this.executeRequest = executor;
  }

  // ==================== 私有方法 ====================

  /**
   * 处理队列
   */
  private async process(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.canExecute()) {
        const request = this.queue.shift()!;
        this.execute(request);

        // 等待最小间隔
        if (this.config.minInterval > 0) {
          await sleep(this.config.minInterval);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 检查是否可以执行新请求
   */
  private canExecute(): boolean {
    // 检查并发数
    if (this.running.size >= this.config.maxConcurrent) {
      return false;
    }

    // 检查 RPM
    if (this.config.maxRPM > 0 && this.getCurrentRPM() >= this.config.maxRPM) {
      return false;
    }

    return true;
  }

  /**
   * 执行请求
   */
  private async execute(request: QueuedRequest): Promise<void> {
    this.running.set(request.id, request);
    this.recordRequest();

    try {
      // 注入 abort signal
      const options = {
        ...request.options,
        signal: request.abortController.signal,
      };

      // 调用实际的 AI 服务
      const result = await this.executeRequest(options, request.isStream, request.abortController.signal);
      request.resolve(result);
    } catch (error) {
      request.reject(error as AIError);
    } finally {
      this.running.delete(request.id);
      // 继续处理队列
      this.process();
    }
  }

  /**
   * 实际执行请求（由 AIService 注入）
   */
  private executeRequest: (
    options: GenerateOptions | StreamOptions,
    isStream: boolean,
    signal: AbortSignal
  ) => Promise<any> = () => {
    throw new Error('executeRequest not injected');
  };

  /**
   * 获取当前 RPM
   */
  private getCurrentRPM(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.rpmWindow = this.rpmWindow.filter(t => t > oneMinuteAgo);
    return this.rpmWindow.length;
  }

  /**
   * 记录请求
   */
  private recordRequest(): void {
    this.rpmWindow.push(Date.now());
    this.lastRequestTime = Date.now();
  }
}

/**
 * 获取 RequestQueue 单例
 */
export function getRequestQueue(): RequestQueue {
  return RequestQueue.getInstance();
}
