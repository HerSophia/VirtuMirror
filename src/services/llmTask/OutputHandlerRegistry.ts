/**
 * 输出处理器注册表
 * 管理所有 App 注册的 LLM 输出处理器
 */

import type { OutputHandler } from './types';

/**
 * 输出处理器注册表
 * 管理处理 LLM 生成结果的处理器
 */
export class OutputHandlerRegistry {
  /** 处理器映射：id -> handler */
  private handlers: Map<string, OutputHandler> = new Map();

  /** 按 App 分组的处理器索引 */
  private byApp: Map<string, Set<string>> = new Map();

  /**
   * 注册输出处理器
   * @param handler 输出处理器
   */
  register(handler: OutputHandler): void {
    // 验证必填字段
    this.validateHandler(handler);

    // 检查 ID 冲突
    if (this.handlers.has(handler.id)) {
      console.warn(
        `[OutputHandlerRegistry] 处理器 "${handler.id}" 已存在，将被覆盖`
      );
    }

    // 存储处理器
    this.handlers.set(handler.id, handler);

    // 更新 App 索引
    if (!this.byApp.has(handler.appId)) {
      this.byApp.set(handler.appId, new Set());
    }
    this.byApp.get(handler.appId)!.add(handler.id);

    console.log(
      `[OutputHandlerRegistry] 已注册处理器: ${handler.id} (${handler.name})`
    );
  }

  /**
   * 批量注册处理器
   */
  registerBatch(handlers: OutputHandler[]): void {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  /**
   * 注销输出处理器
   * @param id 处理器 ID
   * @returns 是否成功注销
   */
  unregister(id: string): boolean {
    const handler = this.handlers.get(id);
    if (!handler) {
      return false;
    }

    // 从主映射移除
    this.handlers.delete(id);

    // 从 App 索引移除
    const appSet = this.byApp.get(handler.appId);
    if (appSet) {
      appSet.delete(id);
      if (appSet.size === 0) {
        this.byApp.delete(handler.appId);
      }
    }

    console.log(`[OutputHandlerRegistry] 已注销处理器: ${id}`);
    return true;
  }

  /**
   * 获取输出处理器
   */
  get(id: string): OutputHandler | undefined {
    return this.handlers.get(id);
  }

  /**
   * 检查处理器是否存在
   */
  has(id: string): boolean {
    return this.handlers.has(id);
  }

  /**
   * 获取所有处理器
   */
  getAll(): OutputHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * 获取指定 App 的处理器
   */
  getByApp(appId: string): OutputHandler[] {
    const ids = this.byApp.get(appId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.handlers.get(id)!)
      .filter(Boolean);
  }

  /**
   * 获取支持预览的处理器
   */
  getPreviewable(): OutputHandler[] {
    return this.getAll().filter((h) => h.supportsPreview);
  }

  /**
   * 获取处理器总数
   */
  get size(): number {
    return this.handlers.size;
  }

  /**
   * 清空所有处理器
   */
  clear(): void {
    this.handlers.clear();
    this.byApp.clear();
    console.log('[OutputHandlerRegistry] 已清空所有处理器');
  }

  /**
   * 验证处理器
   */
  private validateHandler(handler: OutputHandler): void {
    if (!handler.id) {
      throw new Error('[OutputHandlerRegistry] 处理器缺少 id');
    }
    if (!handler.appId) {
      throw new Error(
        `[OutputHandlerRegistry] 处理器 "${handler.id}" 缺少 appId`
      );
    }
    if (!handler.name) {
      throw new Error(
        `[OutputHandlerRegistry] 处理器 "${handler.id}" 缺少 name`
      );
    }
    if (typeof handler.handle !== 'function') {
      throw new Error(
        `[OutputHandlerRegistry] 处理器 "${handler.id}" 缺少 handle 方法`
      );
    }
  }
}

// 导出单例获取函数
let outputHandlerRegistryInstance: OutputHandlerRegistry | null = null;

export function getOutputHandlerRegistry(): OutputHandlerRegistry {
  if (!outputHandlerRegistryInstance) {
    outputHandlerRegistryInstance = new OutputHandlerRegistry();
  }
  return outputHandlerRegistryInstance;
}

// 用于测试的重置函数
export function resetOutputHandlerRegistry(): void {
  outputHandlerRegistryInstance = null;
}
