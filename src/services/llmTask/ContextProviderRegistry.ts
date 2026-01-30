/**
 * 上下文提供器注册表
 * 管理所有 App 注册的上下文提供器
 */

import type { ContextProvider } from './types';
import { loggerService } from '@/services/logger';

const logger = loggerService.child('service:contextProviderRegistry');

/**
 * 上下文提供器注册表
 * 管理为 LLM 任务提供动态变量的提供器
 */
export class ContextProviderRegistry {
  /** 提供器映射：id -> provider */
  private providers: Map<string, ContextProvider> = new Map();

  /** 按 App 分组的提供器索引 */
  private byApp: Map<string, Set<string>> = new Map();

  /**
   * 注册上下文提供器
   * @param provider 上下文提供器
   */
  register(provider: ContextProvider): void {
    // 验证必填字段
    this.validateProvider(provider);

    // 检查 ID 冲突
    if (this.providers.has(provider.id)) {
      logger.warn(`提供器 "${provider.id}" 已存在，将被覆盖`);
    }

    // 存储提供器
    this.providers.set(provider.id, provider);

    // 更新 App 索引
    if (!this.byApp.has(provider.appId)) {
      this.byApp.set(provider.appId, new Set());
    }
    this.byApp.get(provider.appId)!.add(provider.id);

    logger.debug(`已注册提供器: ${provider.id} (${provider.name})`);
  }

  /**
   * 批量注册提供器
   */
  registerBatch(providers: ContextProvider[]): void {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  /**
   * 注销上下文提供器
   * @param id 提供器 ID
   * @returns 是否成功注销
   */
  unregister(id: string): boolean {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }

    // 从主映射移除
    this.providers.delete(id);

    // 从 App 索引移除
    const appSet = this.byApp.get(provider.appId);
    if (appSet) {
      appSet.delete(id);
      if (appSet.size === 0) {
        this.byApp.delete(provider.appId);
      }
    }

    logger.debug(`已注销提供器: ${id}`);
    return true;
  }

  /**
   * 获取上下文提供器
   */
  get(id: string): ContextProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * 检查提供器是否存在
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * 获取所有提供器
   */
  getAll(): ContextProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取指定 App 的提供器
   */
  getByApp(appId: string): ContextProvider[] {
    const ids = this.byApp.get(appId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.providers.get(id)!)
      .filter(Boolean);
  }

  /**
   * 按优先级排序获取提供器
   * @param ids 提供器 ID 列表，如果为空则返回所有
   */
  getSortedByPriority(ids?: string[]): ContextProvider[] {
    let providers: ContextProvider[];

    if (ids && ids.length > 0) {
      providers = ids
        .map((id) => this.providers.get(id))
        .filter((p): p is ContextProvider => p !== undefined);
    } else {
      providers = this.getAll();
    }

    // 按优先级排序（数值越小优先级越高）
    return providers.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  /**
   * 执行多个提供器并合并结果
   * @param ids 提供器 ID 列表
   * @returns 合并后的上下文变量
   */
  async getContext(ids: string[]): Promise<Record<string, string>> {
    const providers = this.getSortedByPriority(ids);
    const result: Record<string, string> = {};

    for (const provider of providers) {
      try {
        const context = await provider.getContext();

        // 如果有变量前缀，添加前缀
        if (provider.variablePrefix) {
          for (const [key, value] of Object.entries(context)) {
            const prefixedKey = `${provider.variablePrefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            result[prefixedKey] = value;
          }
        } else {
          Object.assign(result, context);
        }
      } catch (error) {
        logger.error(`提供器 "${provider.id}" 执行失败:`, error);
      }
    }

    return result;
  }

  /**
   * 获取提供器总数
   */
  get size(): number {
    return this.providers.size;
  }

  /**
   * 清空所有提供器
   */
  clear(): void {
    this.providers.clear();
    this.byApp.clear();
    logger.debug('已清空所有提供器');
  }

  /**
   * 验证提供器
   */
  private validateProvider(provider: ContextProvider): void {
    if (!provider.id) {
      throw new Error('[ContextProviderRegistry] 提供器缺少 id');
    }
    if (!provider.appId) {
      throw new Error(
        `[ContextProviderRegistry] 提供器 "${provider.id}" 缺少 appId`
      );
    }
    if (!provider.name) {
      throw new Error(
        `[ContextProviderRegistry] 提供器 "${provider.id}" 缺少 name`
      );
    }
    if (typeof provider.getContext !== 'function') {
      throw new Error(
        `[ContextProviderRegistry] 提供器 "${provider.id}" 缺少 getContext 方法`
      );
    }
  }
}

// 导出单例获取函数
let contextProviderRegistryInstance: ContextProviderRegistry | null = null;

export function getContextProviderRegistry(): ContextProviderRegistry {
  if (!contextProviderRegistryInstance) {
    contextProviderRegistryInstance = new ContextProviderRegistry();
  }
  return contextProviderRegistryInstance;
}

// 用于测试的重置函数
export function resetContextProviderRegistry(): void {
  contextProviderRegistryInstance = null;
}
