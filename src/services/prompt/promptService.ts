/**
 * 提示词管理服务
 * @description 管理提示词模板的增删改查、渲染和持久化
 */

import type {
  PromptTemplate,
  PromptSystemConfig,
  PromptCategory,
  RenderedPrompt,
  PromptEditPermission,
  AppPromptDefinition,
  PromptVariable,
} from '@/types/prompts';
import { contextSharingService } from '@/services/contextSharing';

// 定义内置提示词数组
// 注意：2024-05 根据重构，内置提示词已被清空。
// 所有提示词应通过 App 自身注册 (PromptService.registerAppPrompts)
const builtinPrompts: PromptTemplate[] = [];

// 在开发模式下使用 localStorage，生产环境使用酒馆变量系统
const isDev = import.meta.env.DEV;

// 存储键名
const STORAGE_KEY = '小手机_prompts';

/**
 * 获取变量（兼容开发和生产环境）
 */
function getVariables(option: { type: string }): Record<string, unknown> {
  if (isDev) {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { [STORAGE_KEY]: JSON.parse(stored) } : {};
  }
  
  // 生产环境使用酒馆变量系统
  try {
    const parentWin = window.parent as Window & {
      getVariables?: (option: { type: string }) => Record<string, unknown>;
    };
    if (parentWin.getVariables) {
      return parentWin.getVariables(option);
    }
  } catch (e) {
    console.warn('[PromptService] 无法访问父窗口变量系统');
  }
  return {};
}

/**
 * 保存变量（兼容开发和生产环境）
 */
function insertOrAssignVariables(
  variables: Record<string, unknown>,
  option: { type: string }
): void {
  if (isDev) {
    const data = variables[STORAGE_KEY];
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    return;
  }
  
  // 生产环境使用酒馆变量系统
  try {
    const parentWin = window.parent as Window & {
      insertOrAssignVariables?: (
        variables: Record<string, unknown>,
        option: { type: string }
      ) => void;
    };
    if (parentWin.insertOrAssignVariables) {
      parentWin.insertOrAssignVariables(variables, option);
    }
  } catch (e) {
    console.warn('[PromptService] 无法访问父窗口变量系统');
  }
}

/**
 * 提示词管理服务
 */
export class PromptService {
  /**
   * 获取提示词系统配置
   */
  static getConfig(): PromptSystemConfig {
    try {
      const variables = getVariables({ type: 'global' });
      const saved = variables[STORAGE_KEY] as PromptSystemConfig | undefined;
      
      if (saved) {
        // 合并内置提示词（防止内置提示词被删除）
        return this.mergeWithBuiltin(saved);
      }
      
      return this.createDefaultConfig();
    } catch (error) {
      console.error('[小手机] 获取提示词配置失败:', error);
      return this.createDefaultConfig();
    }
  }
  
  /**
   * 保存提示词系统配置
   */
  static saveConfig(config: PromptSystemConfig): void {
    try {
      config._meta.lastUpdated = new Date().toISOString();
      insertOrAssignVariables(
        { [STORAGE_KEY]: config },
        { type: 'global' }
      );
      console.info('[小手机] 提示词配置已保存');
    } catch (error) {
      console.error('[小手机] 保存提示词配置失败:', error);
    }
  }
  
  /**
   * 获取指定场景的提示词模板
   */
  static getPromptByScene(scene: string): PromptTemplate | null {
    const config = this.getConfig();
    const templates = config.templates
      .filter(t => t.scene === scene && t.enabled)
      .sort((a, b) => a.priority - b.priority);
    
    return templates[0] ?? null;
  }
  
  /**
   * 根据 ID 获取提示词
   */
  static getPromptById(id: string): PromptTemplate | null {
    const config = this.getConfig();
    return config.templates.find(t => t.id === id) ?? null;
  }
  
  /**
   * 获取指定分类的所有提示词
   */
  static getPromptsByCategory(category: PromptCategory): PromptTemplate[] {
    const config = this.getConfig();
    return config.templates.filter(t => t.category === category);
  }
  
  /**
   * 获取所有提示词
   */
  static getAllPrompts(): PromptTemplate[] {
    const config = this.getConfig();
    return config.templates;
  }
  
  /**
   * 渲染提示词模板（变量替换）
   */
  static renderPrompt(
    template: PromptTemplate,
    variables: Record<string, unknown>
  ): RenderedPrompt {
    const config = this.getConfig();
    
    // 合并全局变量和传入变量
    const allVariables = {
      ...config.globalVariables,
      ...variables,
    };
    
    // 替换变量占位符
    const replaceVariables = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        if (varName in allVariables) {
          return String(allVariables[varName]);
        }
        // 查找默认值
        const varDef = template.availableVariables.find(v => v.name === varName);
        if (varDef?.defaultValue !== undefined) {
          return String(varDef.defaultValue);
        }
        return match; // 保留原占位符
      });
    };
    
    return {
      systemPrompt: template.systemPrompt ? replaceVariables(template.systemPrompt) : undefined,
      userPrompt: replaceVariables(template.template),
    };
  }

  /**
   * 渲染提示词模板（支持共享上下文变量）- 异步版本
   * @param template 提示词模板
   * @param variables 用户传入的变量
   * @param options 渲染选项
   */
  static async renderPromptAsync(
    template: PromptTemplate,
    variables: Record<string, unknown>,
    options?: RenderOptions
  ): Promise<RenderedPrompt> {
    const config = this.getConfig();
    
    // 1. 收集共享上下文变量（如果启用）
    let sharedVars: Record<string, string> = {};
    if (options?.resolveSharedContext !== false) {
      sharedVars = await this.resolveSharedContextVariables(
        template.availableVariables || []
      );
    }
    
    // 2. 合并所有变量（优先级：用户传入 > 共享上下文 > 全局变量）
    const allVariables = {
      ...config.globalVariables,
      ...sharedVars,
      ...variables,
    };
    
    // 3. 替换变量占位符
    const replaceVariables = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        if (varName in allVariables) {
          return String(allVariables[varName]);
        }
        // 查找默认值
        const varDef = template.availableVariables.find(v => v.name === varName);
        if (varDef?.defaultValue !== undefined) {
          return String(varDef.defaultValue);
        }
        return match; // 保留原占位符
      });
    };
    
    return {
      systemPrompt: template.systemPrompt ? replaceVariables(template.systemPrompt) : undefined,
      userPrompt: replaceVariables(template.template),
    };
  }

  /**
   * 解析共享上下文变量
   * @param variableDefs 变量定义列表
   */
  private static async resolveSharedContextVariables(
    variableDefs: PromptVariable[]
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const varDef of variableDefs) {
      // 只处理共享上下文来源的变量
      if (varDef.source !== 'shared-context') continue;

      const config = varDef.sharedContextConfig;
      if (!config) continue;

      try {
        let value: unknown;

        if (config.contextId) {
          // 获取指定 ID 的上下文
          value = await contextSharingService.getAsync(config.contextId);
        } else if (config.contextType) {
          // 获取指定类型的所有上下文
          const contexts = contextSharingService.getByType(config.contextType);
          value = Array.from(contexts.values());
        }

        // 格式化值
        result[varDef.name] = this.formatContextValue(value, config.format);
      } catch (error) {
        console.error(`[PromptService] 解析共享上下文变量 ${varDef.name} 失败:`, error);
        result[varDef.name] = varDef.defaultValue?.toString() || '';
      }
    }

    return result;
  }

  /**
   * 格式化上下文值
   * @param value 原始值
   * @param format 格式化方式
   */
  private static formatContextValue(
    value: unknown,
    format?: 'raw' | 'text' | 'xml'
  ): string {
    if (value === undefined || value === null) return '';

    switch (format) {
      case 'xml':
        return `<context>${JSON.stringify(value)}</context>`;
      case 'text':
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      case 'raw':
      default:
        return typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
  
  /**
   * 添加自定义提示词
   */
  static addPrompt(
    prompt: Omit<PromptTemplate, 'id' | 'isBuiltin' | 'source' | 'createdAt' | 'updatedAt'>
  ): PromptTemplate {
    const config = this.getConfig();
    
    const newPrompt: PromptTemplate = {
      ...prompt,
      id: `custom.${crypto.randomUUID()}`,
      source: { type: 'user' },
      isBuiltin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    config.templates.push(newPrompt);
    this.saveConfig(config);
    
    return newPrompt;
  }
  
  /**
   * 更新提示词
   */
  static updatePrompt(id: string, updates: Partial<PromptTemplate>): boolean {
    const config = this.getConfig();
    const index = config.templates.findIndex(t => t.id === id);
    
    if (index === -1) return false;
    
    const template = config.templates[index];
    const permission = this.isPromptEditable(template);
    
    // 根据权限过滤可更新的字段
    let filteredUpdates: Partial<PromptTemplate>;
    
    if (permission.editableFields.includes('*')) {
      // 用户提示词可以更新所有字段
      filteredUpdates = updates;
    } else {
      // 内置/App 提示词只能更新允许的字段
      filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => 
          permission.editableFields.includes(key)
        )
      );
    }
    
    config.templates[index] = {
      ...template,
      ...filteredUpdates,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveConfig(config);
    return true;
  }
  
  /**
   * 删除提示词（仅自定义提示词可删除）
   */
  static deletePrompt(id: string): boolean {
    const config = this.getConfig();
    const template = config.templates.find(t => t.id === id);
    
    if (!template) return false;
    
    const permission = this.isPromptEditable(template);
    if (!permission.canDelete) return false;
    
    config.templates = config.templates.filter(t => t.id !== id);
    this.saveConfig(config);
    return true;
  }
  
  /**
   * 重置提示词为默认值
   */
  static resetPrompt(id: string): boolean {
    // 移除内置提示词数组依赖，改为直接从 App 注册的原始数据恢复（如果需要）
    // 目前的实现依赖于 builtinPrompts 数组，如果已删除该数组，此功能需调整
    // 简单实现：如果是 App 注册的提示词，重新注册即可恢复
    // 但这里暂时返回 false，因为 builtinPrompts 已被清空
    return false;
  }
  
  /**
   * 切换提示词启用状态
   */
  static togglePrompt(id: string): boolean {
    const config = this.getConfig();
    const template = config.templates.find(t => t.id === id);
    
    if (!template) return false;
    
    template.enabled = !template.enabled;
    template.updatedAt = new Date().toISOString();
    
    this.saveConfig(config);
    return true;
  }
  
  /**
   * 设置全局变量
   */
  static setGlobalVariable(key: string, value: unknown): void {
    const config = this.getConfig();
    config.globalVariables[key] = value;
    this.saveConfig(config);
  }
  
  /**
   * 获取全局变量
   */
  static getGlobalVariables(): Record<string, unknown> {
    const config = this.getConfig();
    return config.globalVariables;
  }
  
  /**
   * 导出提示词配置
   */
  static exportConfig(): string {
    const config = this.getConfig();
    return JSON.stringify(config, null, 2);
  }
  
  /**
   * 导入提示词配置
   */
  static importConfig(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString) as PromptSystemConfig;
      // 验证格式
      if (!imported.templates || !Array.isArray(imported.templates)) {
        throw new Error('Invalid format');
      }
      
      // 合并内置提示词
      const merged = this.mergeWithBuiltin(imported);
      this.saveConfig(merged);
      return true;
    } catch (error) {
      console.error('[小手机] 导入提示词配置失败:', error);
      return false;
    }
  }
  
  /**
   * 检查提示词是否可编辑
   */
  static isPromptEditable(prompt: PromptTemplate): PromptEditPermission {
    if (prompt.source.type === 'builtin') {
      return {
        canEdit: true,
        editableFields: ['template', 'systemPrompt', 'enabled', 'priority'],
        canDelete: false,
      };
    }
    
    if (prompt.source.type === 'app') {
      return {
        canEdit: true,
        editableFields: ['enabled', 'priority'],
        canDelete: false,
      };
    }
    
    // 用户自定义
    return {
      canEdit: true,
      editableFields: ['*'],
      canDelete: true,
    };
  }
  
  /**
   * 获取提示词来源描述
   */
  static getSourceLabel(prompt: PromptTemplate): string {
    switch (prompt.source.type) {
      case 'builtin':
        return '内置';
      case 'app':
        return `App: ${prompt.source.appId}`;
      case 'user':
        return '自定义';
      default:
        return '未知';
    }
  }
  
  // ========== App 提示词管理 ==========
  
  /**
   * 注册 App 的内置提示词
   * 在 App 安装时调用
   */
  static registerAppPrompts(appId: string, prompts: AppPromptDefinition[]): void {
    const config = this.getConfig();
    
    // 先移除该 App 的旧提示词（如果存在）
    config.templates = config.templates.filter(
      t => !(t.source.type === 'app' && t.source.appId === appId)
    );
    
    // 添加新提示词
    const newPrompts: PromptTemplate[] = prompts.map((p, index) => ({
      id: `app.${appId}.${p.scene}`,
      name: p.name,
      description: p.description,
      category: p.category,
      scene: p.scene,
      template: p.template,
      systemPrompt: p.systemPrompt,
      availableVariables: p.availableVariables,
      source: { type: 'app' as const, appId },
      isBuiltin: false,
      enabled: true,
      priority: p.priority ?? index,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    
    config.templates.push(...newPrompts);
    this.saveConfig(config);
    
    console.info(`[小手机] 已注册 App "${appId}" 的 ${prompts.length} 个提示词`);
  }
  
  /**
   * 移除 App 的提示词
   * 在 App 卸载时调用
   */
  static unregisterAppPrompts(appId: string): void {
    const config = this.getConfig();
    
    const removedCount = config.templates.filter(
      t => t.source.type === 'app' && t.source.appId === appId
    ).length;
    
    config.templates = config.templates.filter(
      t => !(t.source.type === 'app' && t.source.appId === appId)
    );
    
    this.saveConfig(config);
    console.info(`[小手机] 已移除 App "${appId}" 的 ${removedCount} 个提示词`);
  }
  
  /**
   * 获取指定 App 的所有提示词
   */
  static getPromptsByApp(appId: string): PromptTemplate[] {
    const config = this.getConfig();
    return config.templates.filter(
      t => t.source.type === 'app' && t.source.appId === appId
    );
  }
  
  /**
   * 获取指定来源的提示词
   */
  static getPromptsBySource(sourceType: 'builtin' | 'user' | 'app', appId?: string): PromptTemplate[] {
    const config = this.getConfig();
    return config.templates.filter(t => {
      if (sourceType === 'app') {
        return t.source.type === 'app' && t.source.appId === appId;
      }
      return t.source.type === sourceType;
    });
  }

  /**
   * 获取所有包含提示词的 App ID 列表
   */
  static getAppIdsWithPrompts(): string[] {
    const config = this.getConfig();
    const appIds = new Set<string>();
    
    config.templates.forEach(t => {
      if (t.source.type === 'app') {
        appIds.add(t.source.appId);
      }
    });
    
    return Array.from(appIds);
  }
  
  // ========== 私有方法 ==========
  
  /**
   * 创建默认配置
   */
  private static createDefaultConfig(): PromptSystemConfig {
    return {
      templates: [...builtinPrompts],
      globalVariables: {
        appName: '小手机',
      },
      _meta: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
      },
    };
  }
  
  /**
   * 合并内置提示词
   */
  private static mergeWithBuiltin(config: PromptSystemConfig): PromptSystemConfig {
    // 过滤掉所有标记为 builtin 的提示词，因为现在系统应该没有内置提示词了
    // 只有当 builtinPrompts 数组不为空时，才应该尝试合并
    // 而现在我们不仅不合并，还要清理旧的内置提示词（如果是从旧缓存加载的）
    
    let mergedTemplates = [...config.templates];
    
    // 清理旧的内置提示词（如果它们不在 builtinPrompts 中）
    // 当前 builtinPrompts 为空，所以会清除所有 source.type === 'builtin' 的提示词
    const validBuiltinIds = new Set(builtinPrompts.map(p => p.id));
    
    mergedTemplates = mergedTemplates.filter(t => {
      if (t.source.type === 'builtin') {
        return validBuiltinIds.has(t.id);
      }
      return true;
    });
    
    // 如果将来 builtinPrompts 重新有了内容，下面的逻辑会负责添加缺失的
    for (const builtin of builtinPrompts) {
      const exists = mergedTemplates.some(t => t.id === builtin.id);
      if (!exists) {
        mergedTemplates.push({ ...builtin });
      }
    }
    
    return {
      ...config,
      templates: mergedTemplates,
    };
  }
  
  /**
   * 获取分类统计
   */
  static getCategoryStats(): Record<PromptCategory | 'all', number> {
    const config = this.getConfig();
    const stats: Record<string, number> = {
      all: config.templates.length,
      chat: 0,
      email: 0,
      browser: 0,
      live: 0,
      system: 0,
    };
    
    for (const template of config.templates) {
      if (template.category in stats) {
        stats[template.category]++;
      }
    }
    
    return stats as Record<PromptCategory | 'all', number>;
  }
  
  /**
   * 搜索提示词
   */
  static searchPrompts(query: string): PromptTemplate[] {
    const config = this.getConfig();
    const lowerQuery = query.toLowerCase();
    
    return config.templates.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery) ||
      t.scene.toLowerCase().includes(lowerQuery) ||
      t.category.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * 复制提示词
   */
  static duplicatePrompt(id: string): PromptTemplate | null {
    const original = this.getPromptById(id);
    if (!original) return null;
    
    const newPrompt = this.addPrompt({
      name: `${original.name} (副本)`,
      description: original.description,
      category: original.category,
      scene: `${original.scene}.copy.${Date.now()}`,
      template: original.template,
      systemPrompt: original.systemPrompt,
      availableVariables: [...original.availableVariables],
      enabled: true,
      priority: original.priority + 1,
      version: '1.0.0',
    });
    
    return newPrompt;
  }
}

/**
 * 渲染选项
 */
export interface RenderOptions {
  /** 是否解析共享上下文变量（默认 true） */
  resolveSharedContext?: boolean;
}

export default PromptService;