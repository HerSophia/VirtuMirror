/**
 * 请求管理器
 * 跟踪所有进行中的请求，支持取消
 */

import type { RequestInfo, RequestStatus } from './types';
import { generateRequestId } from './utils';

/**
 * 请求上下文
 */
interface RequestContext {
  id: string;
  status: RequestStatus;
  source?: string;
  startTime: number;
  endTime?: number;
  controller: AbortController;
  signal: AbortSignal;
}

/**
 * 请求管理器
 * 跟踪所有进行中的请求，支持取消
 */
export class RequestManager {
  private static instance: RequestManager;
  private requests = new Map<string, RequestContext>();

  static getInstance(): RequestManager {
    if (!this.instance) {
      this.instance = new RequestManager();
    }
    return this.instance;
  }

  /**
   * 创建新请求
   */
  create(options?: { id?: string; source?: string }): RequestContext {
    const id = options?.id || generateRequestId();
    const controller = new AbortController();

    const context: RequestContext = {
      id,
      status: 'pending',
      source: options?.source,
      startTime: Date.now(),
      controller,
      signal: controller.signal,
    };

    this.requests.set(id, context);
    return context;
  }

  /**
   * 获取请求上下文
   */
  get(id: string): RequestContext | undefined {
    return this.requests.get(id);
  }

  /**
   * 标记请求开始
   */
  start(id: string): void {
    const ctx = this.requests.get(id);
    if (ctx) {
      ctx.status = 'running';
    }
  }

  /**
   * 标记请求完成
   */
  complete(id: string): void {
    const ctx = this.requests.get(id);
    if (ctx) {
      ctx.status = 'completed';
      ctx.endTime = Date.now();
    }
  }

  /**
   * 标记请求失败
   */
  fail(id: string): void {
    const ctx = this.requests.get(id);
    if (ctx) {
      ctx.status = 'failed';
      ctx.endTime = Date.now();
    }
  }

  /**
   * 取消请求
   */
  cancel(id: string): boolean {
    const ctx = this.requests.get(id);
    if (ctx && (ctx.status === 'running' || ctx.status === 'pending')) {
      ctx.controller.abort();
      ctx.status = 'aborted';
      ctx.endTime = Date.now();
      return true;
    }
    return false;
  }

  /**
   * 取消所有进行中的请求
   */
  cancelAll(): void {
    for (const [id, ctx] of this.requests) {
      if (ctx.status === 'running' || ctx.status === 'pending') {
        this.cancel(id);
      }
    }
  }

  /**
   * 获取活动请求列表
   */
  getActiveRequests(): RequestInfo[] {
    const active: RequestInfo[] = [];
    for (const ctx of this.requests.values()) {
      if (ctx.status === 'pending' || ctx.status === 'running') {
        active.push({
          id: ctx.id,
          status: ctx.status,
          source: ctx.source,
          startTime: ctx.startTime,
        });
      }
    }
    return active;
  }

  /**
   * 是否有正在进行的请求
   */
  isGenerating(): boolean {
    return this.getActiveRequests().length > 0;
  }

  /**
   * 获取最近的请求 ID
   */
  getLatestRequestId(): string | null {
    let latest: RequestContext | null = null;
    for (const ctx of this.requests.values()) {
      if (!latest || ctx.startTime > latest.startTime) {
        latest = ctx;
      }
    }
    return latest?.id || null;
  }

  /**
   * 清理已完成的请求（可选，避免内存泄漏）
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();
    for (const [id, ctx] of this.requests) {
      if (ctx.endTime && now - ctx.endTime > maxAge) {
        this.requests.delete(id);
      }
    }
  }
}

/**
 * 获取 RequestManager 单例
 */
export function getRequestManager(): RequestManager {
  return RequestManager.getInstance();
}
