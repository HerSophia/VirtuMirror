/**
 * 变量替换引擎
 * 处理提示词模板中的变量替换
 */

import type { ContextProvider } from './types';
import { getContextProviderRegistry } from './ContextProviderRegistry';
import { loggerService } from '@/services/logger';

const logger = loggerService.child('service:variableResolver');

// ==================== 类型定义 ====================

/** 变量解析选项 */
export interface ResolveOptions {
  /** 是否保留未解析的变量（默认 false，移除未解析变量） */
  keepUnresolved?: boolean;
  /** 未解析变量的默认值 */
  defaultValue?: string;
  /** 自定义变量解析器 */
  customResolvers?: Record<string, () => string | Promise<string>>;
}

/** 条件块信息 */
interface ConditionalBlock {
  fullMatch: string;
  condition: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

// ==================== 时间上下文 ====================

/**
 * 获取时间相关的上下文变量
 * 这些变量会在执行时自动替换
 */
export function getTimeContextVariables(): Record<string, string> {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const hour = now.getHours();

  // 时段描述
  let timePeriod = '';
  if (hour >= 5 && hour < 9) timePeriod = '清晨';
  else if (hour >= 9 && hour < 12) timePeriod = '上午';
  else if (hour >= 12 && hour < 14) timePeriod = '中午';
  else if (hour >= 14 && hour < 18) timePeriod = '下午';
  else if (hour >= 18 && hour < 22) timePeriod = '晚上';
  else timePeriod = '深夜';

  // 工作日/周末
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const dayType = isWeekend ? '周末' : '工作日';

  return {
    currentTime: now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    currentDate: now.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
    }),
    currentWeekday: weekdays[now.getDay()],
    timePeriod,
    dayType,
    fullDateTime: `${now.toLocaleDateString('zh-CN')} ${weekdays[now.getDay()]} ${timePeriod}`,
    timestamp: String(now.getTime()),
    isoDate: now.toISOString(),
  };
}

// ==================== 变量解析器 ====================

/**
 * 变量解析器
 * 支持 {{variable}} 格式的变量替换
 * 支持 {{#if condition}}...{{/if}} 条件块
 */
export class VariableResolver {
  /** 变量匹配正则 */
  private static VARIABLE_PATTERN = /\{\{([^#/}][^}]*)\}\}/g;

  /** 条件块匹配正则 */
  private static CONDITIONAL_PATTERN =
    /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  /**
   * 解析模板中的变量
   * @param template 模板字符串
   * @param variables 变量值映射
   * @param options 解析选项
   */
  resolve(
    template: string,
    variables: Record<string, unknown>,
    options: ResolveOptions = {}
  ): string {
    let result = template;

    // 1. 处理条件块
    result = this.resolveConditionals(result, variables);

    // 2. 替换变量
    result = this.resolveVariables(result, variables, options);

    return result;
  }

  /**
   * 异步解析模板（支持异步变量提供器）
   * @param template 模板字符串
   * @param variables 基础变量
   * @param contextProviderIds 上下文提供器 ID 列表
   * @param options 解析选项
   */
  async resolveAsync(
    template: string,
    variables: Record<string, unknown>,
    contextProviderIds: string[] = [],
    options: ResolveOptions = {}
  ): Promise<string> {
    // 1. 获取上下文变量
    const contextRegistry = getContextProviderRegistry();
    const contextVariables = await contextRegistry.getContext(
      contextProviderIds
    );

    // 2. 获取时间上下文
    const timeVariables = getTimeContextVariables();

    // 3. 执行自定义解析器
    const customVariables: Record<string, string> = {};
    if (options.customResolvers) {
      for (const [key, resolver] of Object.entries(options.customResolvers)) {
        try {
          customVariables[key] = await resolver();
        } catch (error) {
          logger.warn(`自定义解析器 "${key}" 执行失败:`, error);
        }
      }
    }

    // 4. 合并所有变量（优先级：用户变量 > 自定义 > 上下文 > 时间）
    const allVariables: Record<string, unknown> = {
      ...timeVariables,
      ...contextVariables,
      ...customVariables,
      ...variables,
    };

    // 5. 解析模板
    return this.resolve(template, allVariables, options);
  }

  /**
   * 处理条件块 {{#if condition}}...{{/if}}
   */
  private resolveConditionals(
    template: string,
    variables: Record<string, unknown>
  ): string {
    let result = template;

    // 使用循环处理，因为可能有嵌套
    let match: RegExpExecArray | null;
    let safetyCounter = 0;
    const maxIterations = 100;

    while (
      (match = VariableResolver.CONDITIONAL_PATTERN.exec(result)) !== null &&
      safetyCounter < maxIterations
    ) {
      safetyCounter++;
      const [fullMatch, condition, content] = match;

      // 解析条件
      const conditionValue = this.evaluateCondition(condition.trim(), variables);

      if (conditionValue) {
        // 条件为真，保留内容
        result = result.replace(fullMatch, content);
      } else {
        // 条件为假，移除整个块
        result = result.replace(fullMatch, '');
      }

      // 重置正则
      VariableResolver.CONDITIONAL_PATTERN.lastIndex = 0;
    }

    return result;
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(
    condition: string,
    variables: Record<string, unknown>
  ): boolean {
    // 简单的变量存在性检查
    const value = variables[condition];

    // null、undefined、空字符串、false 都视为假
    if (value === null || value === undefined) return false;
    if (value === '') return false;
    if (value === false) return false;
    if (value === 'false') return false;

    return true;
  }

  /**
   * 替换变量 {{variable}}
   */
  private resolveVariables(
    template: string,
    variables: Record<string, unknown>,
    options: ResolveOptions
  ): string {
    return template.replace(
      VariableResolver.VARIABLE_PATTERN,
      (match, varName) => {
        const trimmedName = varName.trim();
        const value = variables[trimmedName];

        if (value !== undefined && value !== null) {
          return String(value);
        }

        // 处理未解析的变量
        if (options.keepUnresolved) {
          return match;
        }

        if (options.defaultValue !== undefined) {
          return options.defaultValue;
        }

        // 默认移除未解析的变量
        return '';
      }
    );
  }

  /**
   * 提取模板中的所有变量名
   */
  extractVariables(template: string): string[] {
    const variables = new Set<string>();

    // 提取普通变量
    let match: RegExpExecArray | null;
    const varPattern = new RegExp(VariableResolver.VARIABLE_PATTERN.source, 'g');
    while ((match = varPattern.exec(template)) !== null) {
      variables.add(match[1].trim());
    }

    // 提取条件变量
    const condPattern = new RegExp(
      VariableResolver.CONDITIONAL_PATTERN.source,
      'g'
    );
    while ((match = condPattern.exec(template)) !== null) {
      variables.add(match[1].trim());
    }

    return Array.from(variables);
  }

  /**
   * 检查变量是否都已提供
   */
  validateVariables(
    template: string,
    variables: Record<string, unknown>
  ): { valid: boolean; missing: string[] } {
    const required = this.extractVariables(template);
    const missing = required.filter(
      (name) => variables[name] === undefined || variables[name] === null
    );

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

// 导出单例
let variableResolverInstance: VariableResolver | null = null;

export function getVariableResolver(): VariableResolver {
  if (!variableResolverInstance) {
    variableResolverInstance = new VariableResolver();
  }
  return variableResolverInstance;
}
