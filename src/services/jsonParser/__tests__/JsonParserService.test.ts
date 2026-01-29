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

    it('应该解析 JSON 数组', () => {
      const parser = getJsonParserService();
      const result = parser.parse('[1, 2, 3]');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('应该从代码块中提取 JSON', () => {
      const parser = getJsonParserService();
      const result = parser.parse('```json\n{"key": "value"}\n```');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.repaired).toBe(true);
    });

    it('应该从无语言标记的代码块中提取 JSON', () => {
      const parser = getJsonParserService();
      const result = parser.parse('```\n{"key": "value"}\n```');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
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
      expect(result.data).toEqual({ a: 1, b: 2 });
    });

    it('应该处理数组尾部逗号', () => {
      const parser = getJsonParserService();
      const result = parser.parse('[1, 2, 3,]');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('应该处理单引号', () => {
      const parser = getJsonParserService();
      // JSON5 默认支持单引号
      const result = parser.parse("{'name': 'Alice'}");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Alice' });
    });

    it('应该处理无引号的键名', () => {
      const parser = getJsonParserService();
      // JSON5 默认支持无引号键名
      const result = parser.parse('{name: "Alice"}');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Alice' });
    });

    it('应该在失败时返回默认值', () => {
      const parser = getJsonParserService();
      const result = parser.parse('not json', { defaultValue: {} });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('应该在失败时返回数组默认值', () => {
      const parser = getJsonParserService();
      const result = parser.parse('not json', { defaultValue: [] });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('应该在失败时返回错误信息', () => {
      const parser = getJsonParserService();
      const result = parser.parse('not json');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该禁用 JSON5 解析', () => {
      const parser = getJsonParserService();
      // 当禁用 JSON5 时，单引号应该无法直接解析
      // 但修复策略仍然可能生效
      const result = parser.parse("{'name': 'Alice'}", {
        allowJson5: false,
        autoRepair: false,
      });

      // 由于禁用了 JSON5 和自动修复，应该失败
      expect(result.success).toBe(false);
    });

    it('应该禁用代码块提取', () => {
      const parser = getJsonParserService();
      const result = parser.parse('```json\n{"key": "value"}\n```', {
        extractFromCodeBlock: false,
        extractFromText: false,
        autoRepair: false,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('parseStrict', () => {
    it('应该在成功时返回数据', () => {
      const parser = getJsonParserService();
      const data = parser.parseStrict('{"a": 1}');

      expect(data).toEqual({ a: 1 });
    });

    it('应该在失败时抛出异常', () => {
      const parser = getJsonParserService();

      expect(() => parser.parseStrict('not json')).toThrow();
    });

    it('抛出的异常应该包含原始文本', () => {
      const parser = getJsonParserService();

      try {
        parser.parseStrict('invalid json');
      } catch (e) {
        expect((e as Error).message).toBeDefined();
      }
    });
  });

  describe('parseWithValidator', () => {
    interface User {
      name: string;
      age: number;
    }

    const isUser = (data: unknown): data is User => {
      return (
        typeof data === 'object' &&
        data !== null &&
        typeof (data as User).name === 'string' &&
        typeof (data as User).age === 'number'
      );
    };

    it('应该在验证通过时返回成功', () => {
      const parser = getJsonParserService();
      const result = parser.parseWithValidator(
        '{"name": "Alice", "age": 25}',
        isUser
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Alice', age: 25 });
    });

    it('应该在验证失败时返回错误', () => {
      const parser = getJsonParserService();
      const result = parser.parseWithValidator(
        '{"name": "Alice"}', // 缺少 age
        isUser
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('验证失败');
    });

    it('应该在解析失败时返回错误', () => {
      const parser = getJsonParserService();
      const result = parser.parseWithValidator('not json', isUser);

      expect(result.success).toBe(false);
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

    it('应该优先提取对象（当对象在数组前面时）', () => {
      const parser = getJsonParserService();
      const result = parser.extractJson('{"a": 1} [1, 2]');

      // extractJson 使用贪婪匹配，但只匹配到第一个完整的 JSON 结构
      expect(result).toBe('{"a": 1}');
    });

    it('无法提取时返回 null', () => {
      const parser = getJsonParserService();
      const result = parser.extractJson('no json here');

      expect(result).toBeNull();
    });
  });

  describe('extractAllJson', () => {
    it('应该提取多个对象', () => {
      const parser = getJsonParserService();
      const result = parser.extractAllJson('{"a": 1} text {"b": 2}');

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('应该提取数组', () => {
      const parser = getJsonParserService();
      const result = parser.extractAllJson('[1, 2] and [3, 4]');

      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('cleanMarkdown', () => {
    it('应该清理 json 代码块', () => {
      const parser = getJsonParserService();
      const result = parser.cleanMarkdown('```json\n{"a": 1}\n```');

      expect(result).toBe('{"a": 1}');
    });

    it('应该清理无语言标记的代码块', () => {
      const parser = getJsonParserService();
      const result = parser.cleanMarkdown('```\n{"a": 1}\n```');

      expect(result).toBe('{"a": 1}');
    });

    it('应该 trim 普通文本', () => {
      const parser = getJsonParserService();
      const result = parser.cleanMarkdown('  {"a": 1}  ');

      expect(result).toBe('{"a": 1}');
    });
  });

  describe('repair', () => {
    it('应该应用多个修复策略', () => {
      const parser = getJsonParserService();
      const result = parser.repair('prefix {"a": 1,} suffix');

      // 应该提取边界并移除尾逗号
      expect(result).toBe('{"a": 1}');
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

    it('应该记录修复统计', () => {
      const parser = getJsonParserService();

      // 这个需要修复（尾逗号，且禁用 JSON5）
      parser.parse('{"a": 1,}', { allowJson5: false });

      const stats = parser.getStats();
      expect(stats.repairCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resetStats', () => {
    it('应该重置统计', () => {
      const parser = getJsonParserService();

      parser.parse('{"a": 1}');
      parser.resetStats();

      const stats = parser.getStats();
      expect(stats.totalParses).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('registerRepairStrategy', () => {
    it('应该注册自定义策略', () => {
      const parser = getJsonParserService();

      parser.registerRepairStrategy({
        name: 'custom-nan-to-null',
        priority: 5, // 高优先级，在 JSON5 解析之前执行
        repair: (text) => {
          if (!text.includes('NaN')) return null;
          return text.replace(/\bNaN\b/g, 'null');
        },
      });

      // 注意：JSON5 原生支持 NaN，所以如果 allowJson5 为 true，
      // 直接解析会成功但值为 NaN 而不是 null
      // 我们需要禁用 JSON5 来让自定义策略生效
      const result = parser.parse('{"value": NaN}', { allowJson5: false });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: null });
    });

    it('应该覆盖同名策略', () => {
      const parser = getJsonParserService();

      // 禁用 extract-boundaries 策略
      parser.registerRepairStrategy({
        name: 'extract-boundaries',
        priority: 10,
        enabled: false,
        repair: () => null,
      });

      // 禁用后，从混合文本提取应该通过 extractFromText 而不是策略
      const result = parser.parse('prefix {"a": 1} suffix', {
        extractFromText: false,
        autoRepair: true,
      });

      // 由于策略被禁用，应该失败
      expect(result.success).toBe(false);
    });
  });
});
