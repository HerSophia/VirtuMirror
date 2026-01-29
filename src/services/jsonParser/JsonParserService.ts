// src/services/jsonParser/JsonParserService.ts

import JSON5 from 'json5';
import type {
  JsonParserService,
  ParseOptions,
  ParseResult,
  RepairStrategy,
  ParserStats,
} from './types';
import { JsonParseError, DEFAULT_PARSE_OPTIONS } from './types';
import { BUILTIN_REPAIR_STRATEGIES } from './strategies';

export class JsonParserServiceImpl implements JsonParserService {
  private strategies: RepairStrategy[] = [];
  private stats: ParserStats = this.createEmptyStats();

  constructor() {
    // 注册内置修复策略
    BUILTIN_REPAIR_STRATEGIES.forEach((s) => this.registerRepairStrategy(s));
  }

  // ==================== 解析方法 ====================

  parse<T = unknown>(text: string, options?: ParseOptions): ParseResult<T> {
    const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };
    this.stats.totalParses++;

    const warnings: string[] = [];
    let processedText = text;

    try {
      // Step 1: 清理 Markdown 代码块
      if (opts.extractFromCodeBlock) {
        const extracted = this.extractFromCodeBlock(processedText);
        if (extracted !== processedText) {
          processedText = extracted;
          warnings.push('从 Markdown 代码块中提取');
        }
      }

      // Step 2: 尝试直接解析
      try {
        const data = this.doParse<T>(processedText, opts);
        this.stats.successCount++;
        return {
          success: true,
          data,
          repaired: warnings.length > 0,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      } catch {
        // 继续尝试修复
      }

      // Step 3: 从文本中提取 JSON
      if (opts.extractFromText) {
        const extracted = this.extractJson(processedText);
        if (extracted && extracted !== processedText) {
          processedText = extracted;
          warnings.push('从混合文本中提取 JSON');

          try {
            const data = this.doParse<T>(processedText, opts);
            this.stats.successCount++;
            return {
              success: true,
              data,
              repaired: true,
              repairStrategy: 'extract',
              warnings,
            };
          } catch {
            // 继续尝试修复
          }
        }
      }

      // Step 4: 应用修复策略
      if (opts.autoRepair) {
        for (const strategy of this.strategies) {
          if (!strategy.enabled) continue;

          const repairedText = strategy.repair(processedText);
          if (repairedText) {
            try {
              const data = this.doParse<T>(repairedText, opts);
              this.stats.successCount++;
              this.stats.repairCount++;
              this.stats.repairStrategyUsage[strategy.name] =
                (this.stats.repairStrategyUsage[strategy.name] || 0) + 1;

              return {
                success: true,
                data,
                repaired: true,
                repairStrategy: strategy.name,
                warnings: [...warnings, `使用策略 '${strategy.name}' 修复`],
              };
            } catch {
              // 该策略失败，尝试下一个
            }
          }
        }
      }

      // 所有尝试都失败
      throw new Error('无法解析 JSON');
    } catch (e) {
      this.stats.failureCount++;
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.recordError(errorMessage);

      // 如果设置了默认值，返回默认值
      if (options?.defaultValue !== undefined) {
        return {
          success: true,
          data: options.defaultValue as T,
          error: errorMessage,
          warnings: [...warnings, '使用默认值'],
        };
      }

      return {
        success: false,
        error: errorMessage,
        warnings,
        originalText: text,
        processedText,
      };
    }
  }

  parseStrict<T = unknown>(text: string, options?: ParseOptions): T {
    const result = this.parse<T>(text, options);
    if (!result.success) {
      throw new JsonParseError(result.error || '解析失败', text);
    }
    return result.data!;
  }

  parseWithValidator<T>(
    text: string,
    validator: (data: unknown) => data is T,
    options?: ParseOptions
  ): ParseResult<T> {
    const result = this.parse<unknown>(text, options);
    if (!result.success) {
      return result as ParseResult<T>;
    }

    if (!validator(result.data)) {
      return {
        success: false,
        error: '数据格式验证失败',
        originalText: text,
      };
    }

    return result as ParseResult<T>;
  }

  // ==================== 提取方法 ====================

  extractJson(text: string): string | null {
    // 尝试匹配对象（贪婪匹配最外层）
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return objectMatch[0];
    }

    // 尝试匹配数组
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return arrayMatch[0];
    }

    return null;
  }

  extractAllJson(text: string): string[] {
    const results: string[] = [];

    // 使用递归匹配来处理嵌套结构会很复杂
    // 这里使用简化版本，匹配顶层的 {} 和 []

    // 匹配对象
    let match;
    const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    while ((match = objectRegex.exec(text)) !== null) {
      results.push(match[0]);
    }

    // 匹配数组
    const arrayRegex = /\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g;
    while ((match = arrayRegex.exec(text)) !== null) {
      results.push(match[0]);
    }

    return results;
  }

  // ==================== 修复方法 ====================

  repair(text: string): string {
    let result = text;

    for (const strategy of this.strategies) {
      if (!strategy.enabled) continue;

      const repaired = strategy.repair(result);
      if (repaired) {
        result = repaired;
      }
    }

    return result;
  }

  cleanMarkdown(text: string): string {
    return this.extractFromCodeBlock(text);
  }

  // ==================== 配置方法 ====================

  registerRepairStrategy(strategy: RepairStrategy): void {
    // 移除同名策略（如果存在）
    this.strategies = this.strategies.filter((s) => s.name !== strategy.name);

    // 按优先级插入
    const newStrategy = { ...strategy, enabled: strategy.enabled ?? true };
    const index = this.strategies.findIndex((s) => s.priority > strategy.priority);

    if (index === -1) {
      this.strategies.push(newStrategy);
    } else {
      this.strategies.splice(index, 0, newStrategy);
    }
  }

  getStats(): ParserStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  // ==================== 私有方法 ====================

  private doParse<T>(text: string, opts: ParseOptions): T {
    if (opts.allowJson5) {
      return JSON5.parse(text) as T;
    }
    return JSON.parse(text) as T;
  }

  private extractFromCodeBlock(text: string): string {
    // 匹配 ```json ... ``` 或 ``` ... ```
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return text.trim();
  }

  private createEmptyStats(): ParserStats {
    return {
      totalParses: 0,
      successCount: 0,
      failureCount: 0,
      repairCount: 0,
      repairStrategyUsage: {},
      errorTypes: {},
    };
  }

  private recordError(message: string): void {
    // 简化错误消息用于统计
    const key = this.normalizeErrorMessage(message);
    this.stats.errorTypes[key] = (this.stats.errorTypes[key] || 0) + 1;
  }

  private normalizeErrorMessage(message: string): string {
    // 提取常见的 JSON 解析错误模式
    if (message.includes('Unexpected token')) {
      return 'Unexpected token';
    }
    if (message.includes('Unterminated string')) {
      return 'Unterminated string';
    }
    if (message.includes('Expected')) {
      return 'Syntax error';
    }
    return 'Unknown error';
  }
}
