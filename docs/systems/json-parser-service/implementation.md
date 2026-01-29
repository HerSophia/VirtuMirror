# JSON Parser Service - 实现设计

## 1. 目录结构

```text
src/services/jsonParser/
├── index.ts              # 导出入口
├── types.ts              # 类型定义
├── JsonParserService.ts  # 服务实现
├── strategies.ts         # 内置修复策略
├── utils.ts              # 工具函数
└── __tests__/
    ├── JsonParserService.test.ts
    ├── strategies.test.ts
    └── fixtures/         # 测试用例数据
```

---

## 2. 服务实现

### 2.1 主服务类

```typescript
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
    BUILTIN_REPAIR_STRATEGIES.forEach(s => this.registerRepairStrategy(s));
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
      throw new JsonParseError(
        result.error || '解析失败',
        text
      );
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
    this.strategies = this.strategies.filter(s => s.name !== strategy.name);
    
    // 按优先级插入
    const newStrategy = { ...strategy, enabled: strategy.enabled ?? true };
    const index = this.strategies.findIndex(s => s.priority > strategy.priority);
    
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
```

---

## 3. 单例管理

```typescript
// src/services/jsonParser/index.ts

import { JsonParserServiceImpl } from './JsonParserService';
import type { JsonParserService } from './types';

export * from './types';
export { BUILTIN_REPAIR_STRATEGIES } from './strategies';

let instance: JsonParserService | null = null;

/**
 * 获取 JSON 解析服务实例
 */
export function getJsonParserService(): JsonParserService {
  if (!instance) {
    instance = new JsonParserServiceImpl();
  }
  return instance;
}

/**
 * 重置服务实例（用于测试）
 */
export function resetJsonParserService(): void {
  instance = null;
}

// 便捷方法导出
export const jsonParser = {
  parse: <T>(text: string, options?: Parameters<JsonParserService['parse']>[1]) =>
    getJsonParserService().parse<T>(text, options),
  
  parseStrict: <T>(text: string, options?: Parameters<JsonParserService['parseStrict']>[1]) =>
    getJsonParserService().parseStrict<T>(text, options),
  
  extractJson: (text: string) =>
    getJsonParserService().extractJson(text),
  
  cleanMarkdown: (text: string) =>
    getJsonParserService().cleanMarkdown(text),
};
```

---

## 4. 解析流程

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        parse(text, options)                          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: 提取代码块 (extractFromCodeBlock)                            │
│ 匹配: ```json ... ``` 或 ``` ... ```                                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 2: 尝试直接解析                                                  │
│ 使用 JSON5.parse() 或 JSON.parse()                                  │
│ 成功 ────────────────────────────────────────────────────▶ 返回结果  │
└─────────────────────────────────────────────────────────────────────┘
                                   │ 失败
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 3: 从文本提取 (extractFromText)                                  │
│ 匹配: {...} 或 [...]                                                 │
│ 成功解析 ─────────────────────────────────────────────────▶ 返回结果  │
└─────────────────────────────────────────────────────────────────────┘
                                   │ 失败
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Step 4: 应用修复策略 (autoRepair)                                     │
│ 按优先级依次尝试：                                                    │
│   1. extract-boundaries (10)                                        │
│   2. remove-trailing-commas (20)                                    │
│   3. single-to-double-quotes (30)                                   │
│   4. quote-unquoted-keys (40)                                       │
│   5. remove-comments (50)                                           │
│   6. fix-escape-sequences (60)                                      │
│ 任一成功 ─────────────────────────────────────────────────▶ 返回结果  │
└─────────────────────────────────────────────────────────────────────┘
                                   │ 全部失败
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 返回失败结果 (或使用 defaultValue)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. 与现有代码的对比

### 5.1 现有实现

**llmTask/utils.ts**:
```typescript
export function cleanJsonOutput(output: string): string {
  return output
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function safeParseJson<T>(text: string): T | null {
  try {
    const cleaned = cleanJsonOutput(text);
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
```

**prompt/chainExecutor/utils.ts**:
```typescript
export function parseJSON(text: string): unknown {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    text = jsonBlockMatch[1];
  }
  
  const objectMatch = text.match(/\{[\s\S]*\}/);
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  const jsonText = objectMatch?.[0] || arrayMatch?.[0] || text;
  
  return JSON.parse(jsonText);
}
```

**social/contentFactory.ts**:
```typescript
private async parseAndRepairJSON(text: string): Promise<any> {
  let cleanText = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
  
  try {
    return JSON5.parse(cleanText);
  } catch (e) {
    // 简单修复: 找边界
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    // ...
  }
}
```

### 5.2 新实现优势

| 方面 | 现有实现 | 新服务 |
|------|----------|--------|
| 代码复用 | ❌ 多处重复 | ✅ 统一入口 |
| 修复能力 | 🟡 各不相同 | ✅ 完整策略链 |
| 类型安全 | 🟡 部分支持 | ✅ 完整泛型 |
| 错误处理 | ❌ 不一致 | ✅ 统一处理 |
| 可观测性 | ❌ 无 | ✅ 统计信息 |
| 可扩展性 | ❌ 无 | ✅ 策略注册 |

---

## 6. 测试用例

```typescript
// src/services/jsonParser/__tests__/JsonParserService.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { getJsonParserService, resetJsonParserService } from '../index';

describe('JsonParserService', () => {
  beforeEach(() => {
    resetJsonParserService();
  });
  
  describe('parse', () => {
    it('应该解析标准 JSON', () => {
      const parser = getJsonParserService();
      const result = parser.parse('{"name": "test"}');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test' });
    });
    
    it('应该从代码块中提取 JSON', () => {
      const parser = getJsonParserService();
      const result = parser.parse('```json\n{"key": "value"}\n```');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.repaired).toBe(true);
    });
    
    it('应该从混合文本中提取 JSON', () => {
      const parser = getJsonParserService();
      const result = parser.parse('Here is the result: {"data": 123}');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 123 });
    });
    
    it('应该处理尾部逗号', () => {
      const parser = getJsonParserService();
      const result = parser.parse('{"a": 1, "b": 2,}');
      
      expect(result.success).toBe(true);
      expect(result.repaired).toBe(true);
    });
    
    it('应该在失败时返回默认值', () => {
      const parser = getJsonParserService();
      const result = parser.parse('not json', { defaultValue: {} });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });
    
    it('应该在失败时返回错误信息', () => {
      const parser = getJsonParserService();
      const result = parser.parse('not json');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('parseStrict', () => {
    it('应该在失败时抛出异常', () => {
      const parser = getJsonParserService();
      
      expect(() => parser.parseStrict('not json')).toThrow();
    });
  });
  
  describe('extractJson', () => {
    it('应该提取对象', () => {
      const parser = getJsonParserService();
      const result = parser.extractJson('prefix {"key": "value"} suffix');
      
      expect(result).toBe('{"key": "value"}');
    });
    
    it('应该提取数组', () => {
      const parser = getJsonParserService();
      const result = parser.extractJson('data: [1, 2, 3]');
      
      expect(result).toBe('[1, 2, 3]');
    });
  });
  
  describe('getStats', () => {
    it('应该记录解析统计', () => {
      const parser = getJsonParserService();
      
      parser.parse('{"a": 1}');
      parser.parse('not json');
      
      const stats = parser.getStats();
      expect(stats.totalParses).toBe(2);
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(1);
    });
  });
});
```

---

## 7. 性能考虑

### 7.1 优化策略

1. **快速路径**：先尝试直接解析，大多数情况下无需修复
2. **懒加载策略**：策略按需执行，失败才尝试下一个
3. **缓存正则**：预编译正则表达式

### 7.2 性能基准

| 场景 | 预期耗时 |
|------|----------|
| 标准 JSON | < 1ms |
| 代码块提取 | < 2ms |
| 单策略修复 | < 5ms |
| 多策略修复 | < 10ms |
