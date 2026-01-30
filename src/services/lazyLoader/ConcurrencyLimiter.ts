/**
 * 并发控制器
 * 限制同时进行的异步操作数量
 */
export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];
  private limit: number;

  constructor(limit: number = 5) {
    this.limit = limit;
  }

  /**
   * 获取当前正在运行的任务数
   */
  get runningCount(): number {
    return this.running;
  }

  /**
   * 获取等待队列长度
   */
  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * 获取并发限制
   */
  get concurrencyLimit(): number {
    return this.limit;
  }

  /**
   * 设置并发限制
   */
  setLimit(limit: number): void {
    this.limit = limit;
    // 如果新限制更大，尝试执行等待中的任务
    this.tryNext();
  }

  /**
   * 获取执行槽位
   * 如果当前运行数小于限制，立即返回
   * 否则等待有空位时返回
   */
  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return;
    }

    // 等待有空位
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * 释放执行槽位
   */
  release(): void {
    this.running--;
    this.tryNext();
  }

  /**
   * 尝试执行队列中的下一个任务
   */
  private tryNext(): void {
    while (this.running < this.limit && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.running++;
      next();
    }
  }

  /**
   * 使用并发限制执行异步函数
   * 自动管理 acquire 和 release
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * 批量执行任务，受并发限制
   */
  async runAll<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(tasks.map((task) => this.run(task)));
  }

  /**
   * 清空等待队列
   */
  clear(): void {
    this.queue = [];
  }
}
