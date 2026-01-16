/**
 * 任务定义注册表
 * 管理所有 App 注册的 LLM 任务定义
 */

import type { LLMTaskDefinition } from './types';

/**
 * 任务定义注册表
 * 单例模式，存储所有已注册的任务定义
 */
export class TaskRegistry {
  /** 任务定义映射：id -> definition */
  private definitions: Map<string, LLMTaskDefinition> = new Map();

  /** 按 App 分组的定义索引 */
  private byApp: Map<string, Set<string>> = new Map();

  /**
   * 注册任务定义
   * @param definition 任务定义
   * @throws 如果 ID 已存在
   */
  register(definition: LLMTaskDefinition): void {
    // 验证必填字段
    this.validateDefinition(definition);

    // 检查 ID 冲突
    if (this.definitions.has(definition.id)) {
      console.warn(
        `[TaskRegistry] 任务定义 "${definition.id}" 已存在，将被覆盖`
      );
    }

    // 存储定义
    this.definitions.set(definition.id, definition);

    // 更新 App 索引
    if (!this.byApp.has(definition.appId)) {
      this.byApp.set(definition.appId, new Set());
    }
    this.byApp.get(definition.appId)!.add(definition.id);

    console.log(
      `[TaskRegistry] 已注册任务定义: ${definition.id} (${definition.name})`
    );
  }

  /**
   * 批量注册任务定义
   */
  registerBatch(definitions: LLMTaskDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
    console.log(
      `[TaskRegistry] 批量注册完成，共 ${definitions.length} 个定义`
    );
  }

  /**
   * 注销任务定义
   * @param id 任务定义 ID
   * @returns 是否成功注销
   */
  unregister(id: string): boolean {
    const definition = this.definitions.get(id);
    if (!definition) {
      return false;
    }

    // 从主映射移除
    this.definitions.delete(id);

    // 从 App 索引移除
    const appSet = this.byApp.get(definition.appId);
    if (appSet) {
      appSet.delete(id);
      if (appSet.size === 0) {
        this.byApp.delete(definition.appId);
      }
    }

    console.log(`[TaskRegistry] 已注销任务定义: ${id}`);
    return true;
  }

  /**
   * 获取任务定义
   */
  get(id: string): LLMTaskDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * 检查任务定义是否存在
   */
  has(id: string): boolean {
    return this.definitions.has(id);
  }

  /**
   * 获取所有任务定义
   */
  getAll(): LLMTaskDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * 获取指定 App 的任务定义
   */
  getByApp(appId: string): LLMTaskDefinition[] {
    const ids = this.byApp.get(appId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.definitions.get(id)!)
      .filter(Boolean);
  }

  /**
   * 获取所有注册的 App ID
   */
  getRegisteredApps(): string[] {
    return Array.from(this.byApp.keys());
  }

  /**
   * 获取定义总数
   */
  get size(): number {
    return this.definitions.size;
  }

  /**
   * 按分类获取任务定义
   */
  getByCategory(category: string): LLMTaskDefinition[] {
    return this.getAll().filter((def) => def.category === category);
  }

  /**
   * 按标签搜索任务定义
   */
  searchByTags(tags: string[]): LLMTaskDefinition[] {
    return this.getAll().filter((def) =>
      tags.some((tag) => def.tags?.includes(tag))
    );
  }

  /**
   * 获取默认显示的任务定义
   */
  getDefaultVisible(): LLMTaskDefinition[] {
    return this.getAll().filter((def) => def.showByDefault !== false);
  }

  /**
   * 清空所有定义
   */
  clear(): void {
    this.definitions.clear();
    this.byApp.clear();
    console.log('[TaskRegistry] 已清空所有任务定义');
  }

  /**
   * 验证任务定义
   */
  private validateDefinition(definition: LLMTaskDefinition): void {
    if (!definition.id) {
      throw new Error('[TaskRegistry] 任务定义缺少 id');
    }
    if (!definition.appId) {
      throw new Error(`[TaskRegistry] 任务定义 "${definition.id}" 缺少 appId`);
    }
    if (!definition.name) {
      throw new Error(`[TaskRegistry] 任务定义 "${definition.id}" 缺少 name`);
    }
    if (!definition.type) {
      throw new Error(`[TaskRegistry] 任务定义 "${definition.id}" 缺少 type`);
    }
    if (!definition.outputHandlerId) {
      throw new Error(
        `[TaskRegistry] 任务定义 "${definition.id}" 缺少 outputHandlerId`
      );
    }

    // 验证提示词配置
    if (definition.type === 'prompt' && !definition.promptId) {
      throw new Error(
        `[TaskRegistry] 任务定义 "${definition.id}" 类型为 prompt 但缺少 promptId`
      );
    }
    if (definition.type === 'chain' && !definition.chainId) {
      throw new Error(
        `[TaskRegistry] 任务定义 "${definition.id}" 类型为 chain 但缺少 chainId`
      );
    }
    if (definition.type === 'manual' && !definition.promptTemplate) {
      throw new Error(
        `[TaskRegistry] 任务定义 "${definition.id}" 类型为 manual 但缺少 promptTemplate`
      );
    }
  }
}

// 导出单例获取函数
let taskRegistryInstance: TaskRegistry | null = null;

export function getTaskRegistry(): TaskRegistry {
  if (!taskRegistryInstance) {
    taskRegistryInstance = new TaskRegistry();
  }
  return taskRegistryInstance;
}

// 用于测试的重置函数
export function resetTaskRegistry(): void {
  taskRegistryInstance = null;
}
