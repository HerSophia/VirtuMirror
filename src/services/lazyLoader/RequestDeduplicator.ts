/**
 * 请求去重器
 * 相同 key 的并发请求只执行一次，多个调用者共享结果
 */

import type { PendingRequest } from './types';

export class RequestDeduplicator<T> {
  private pending = new Map<string, PendingRequest<T>>();

  /**
   * 获取正在进行的请求数
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * 检查 key 是否有正在进行的请求
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * 去重执行加载函数
   * - 如果有正在进行的相同请求，等待其完成
   * - 否则执行加载函数，并共享结果给所有等待者
   */
  async dedupe(
    key: string,
    loader: () => Promise<T | undefined>
  ): Promise<T | undefined> {
    // 检查是否有正在进行的请求
    const existing = this.pending.get(key);
    if (existing) {
      // 等待已有请求完成
      return new Promise((resolve, reject) => {
        existing.waiters.push({ resolve, reject });
      });
    }

    // 创建新请求
    const request: PendingRequest<T> = {
      promise: loader(),
      waiters: [],
    };

    this.pending.set(key, request);

    try {
      const result = await request.promise;

      // 通知所有等待者成功
      for (const waiter of request.waiters) {
        waiter.resolve(result);
      }

      return result;
    } catch (error) {
      // 通知所有等待者失败
      for (const waiter of request.waiters) {
        waiter.reject(error as Error);
      }
      throw error;
    } finally {
      this.pending.delete(key);
    }
  }

  /**
   * 取消所有正在进行的请求
   * 注意：这不会真正取消请求，只是清空等待列表
   */
  clear(): void {
    for (const request of this.pending.values()) {
      const error = new Error('Request cancelled');
      for (const waiter of request.waiters) {
        waiter.reject(error);
      }
    }
    this.pending.clear();
  }
}
