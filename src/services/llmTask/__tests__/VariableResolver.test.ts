/**
 * VariableResolver 单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  VariableResolver,
  getVariableResolver,
  getTimeContextVariables,
} from '../VariableResolver';
import {
  getContextProviderRegistry,
  resetContextProviderRegistry,
} from '../ContextProviderRegistry';
import { createMockContextProvider } from './setup';

describe('VariableResolver', () => {
  let resolver: VariableResolver;

  beforeEach(() => {
    resolver = new VariableResolver();
    resetContextProviderRegistry();
  });

  describe('resolve', () => {
    describe('变量替换', () => {
      it('应该替换简单变量', () => {
        const template = 'Hello, {{name}}!';
        const variables = { name: 'World' };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Hello, World!');
      });

      it('应该替换多个变量', () => {
        const template = '{{greeting}}, {{name}}! Today is {{day}}.';
        const variables = {
          greeting: 'Hello',
          name: 'Alice',
          day: 'Monday',
        };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Hello, Alice! Today is Monday.');
      });

      it('应该处理变量名周围的空格', () => {
        const template = '{{ name }} and {{  value  }}';
        const variables = { name: 'test', value: '123' };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('test and 123');
      });

      it('应该将数字转换为字符串', () => {
        const template = 'Count: {{count}}';
        const variables = { count: 42 };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Count: 42');
      });

      it('应该将布尔值转换为字符串', () => {
        const template = 'Active: {{active}}';
        const variables = { active: true };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Active: true');
      });

      it('应该移除未定义的变量', () => {
        const template = 'Hello, {{name}}! Your role is {{role}}.';
        const variables = { name: 'User' };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Hello, User! Your role is .');
      });

      it('应该保留未解析变量当设置 keepUnresolved', () => {
        const template = 'Hello, {{name}}!';
        const variables = {};

        const result = resolver.resolve(template, variables, { keepUnresolved: true });

        expect(result).toBe('Hello, {{name}}!');
      });

      it('应该使用默认值替换未定义变量', () => {
        const template = 'Hello, {{name}}!';
        const variables = {};

        const result = resolver.resolve(template, variables, { defaultValue: 'Guest' });

        expect(result).toBe('Hello, Guest!');
      });
    });

    describe('条件块', () => {
      it('应该保留条件为真的内容', () => {
        const template = '{{#if showGreeting}}Hello!{{/if}}';
        const variables = { showGreeting: true };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Hello!');
      });

      it('应该移除条件为假的内容', () => {
        const template = '{{#if showGreeting}}Hello!{{/if}}';
        const variables = { showGreeting: false };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('');
      });

      it('应该将 undefined 视为假', () => {
        const template = '{{#if missing}}Content{{/if}}';
        const variables = {};

        const result = resolver.resolve(template, variables);

        expect(result).toBe('');
      });

      it('应该将 null 视为假', () => {
        const template = '{{#if nullValue}}Content{{/if}}';
        const variables = { nullValue: null };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('');
      });

      it('应该将空字符串视为假', () => {
        const template = '{{#if emptyString}}Content{{/if}}';
        const variables = { emptyString: '' };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('');
      });

      it('应该将字符串 "false" 视为假', () => {
        const template = '{{#if stringFalse}}Content{{/if}}';
        const variables = { stringFalse: 'false' };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('');
      });

      it('应该将非空字符串视为真', () => {
        const template = '{{#if text}}Has text{{/if}}';
        const variables = { text: 'some text' };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Has text');
      });

      it('应该处理条件块内的变量', () => {
        const template = '{{#if showName}}Name: {{name}}{{/if}}';
        const variables = { showName: true, name: 'Alice' };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('Name: Alice');
      });

      it('应该处理多个条件块', () => {
        const template = '{{#if a}}A{{/if}}{{#if b}}B{{/if}}{{#if c}}C{{/if}}';
        const variables = { a: true, b: false, c: true };

        const result = resolver.resolve(template, variables);

        expect(result).toBe('AC');
      });
    });

    describe('组合场景', () => {
      it('应该处理复杂模板', () => {
        const template = `
Hello, {{name}}!
{{#if showDetails}}
You are a {{role}}.
{{/if}}
Thank you!`;
        const variables = {
          name: 'Alice',
          showDetails: true,
          role: 'developer',
        };

        const result = resolver.resolve(template, variables);

        expect(result).toContain('Hello, Alice!');
        expect(result).toContain('You are a developer.');
        expect(result).toContain('Thank you!');
      });
    });
  });

  describe('resolveAsync', () => {
    it('应该从上下文提供器获取变量', async () => {
      const registry = getContextProviderRegistry();
      registry.register(
        createMockContextProvider({
          id: 'test:provider',
          getContext: async () => ({ contextVar: 'contextValue' }),
        })
      );

      const template = 'Value: {{contextVar}}';

      const result = await resolver.resolveAsync(
        template,
        {},
        ['test:provider']
      );

      expect(result).toBe('Value: contextValue');
    });

    it('应该合并用户变量和上下文变量', async () => {
      const registry = getContextProviderRegistry();
      registry.register(
        createMockContextProvider({
          id: 'test:provider',
          getContext: async () => ({ contextVar: 'fromContext' }),
        })
      );

      const template = '{{userVar}} and {{contextVar}}';
      const variables = { userVar: 'fromUser' };

      const result = await resolver.resolveAsync(
        template,
        variables,
        ['test:provider']
      );

      expect(result).toBe('fromUser and fromContext');
    });

    it('用户变量应该覆盖上下文变量', async () => {
      const registry = getContextProviderRegistry();
      registry.register(
        createMockContextProvider({
          id: 'test:provider',
          getContext: async () => ({ value: 'fromContext' }),
        })
      );

      const template = 'Value: {{value}}';
      const variables = { value: 'fromUser' };

      const result = await resolver.resolveAsync(
        template,
        variables,
        ['test:provider']
      );

      expect(result).toBe('Value: fromUser');
    });

    it('应该包含时间上下文变量', async () => {
      const template = 'Today: {{currentWeekday}}';

      const result = await resolver.resolveAsync(template, {}, []);

      // 应该包含周几的信息
      expect(result).toMatch(/Today: 周[一二三四五六日]/);
    });

    it('应该执行自定义解析器', async () => {
      const template = 'Custom: {{customVar}}';

      const result = await resolver.resolveAsync(
        template,
        {},
        [],
        {
          customResolvers: {
            customVar: async () => 'customValue',
          },
        }
      );

      expect(result).toBe('Custom: customValue');
    });

    it('应该处理自定义解析器执行失败', async () => {
      const template = 'Custom: {{customVar}}';

      const result = await resolver.resolveAsync(
        template,
        {},
        [],
        {
          customResolvers: {
            customVar: async () => {
              throw new Error('Resolver failed');
            },
          },
        }
      );

      // 失败的解析器变量被移除
      expect(result).toBe('Custom: ');
    });
  });

  describe('extractVariables', () => {
    it('应该提取模板中的所有变量名', () => {
      const template = 'Hello, {{name}}! Today is {{day}}.';

      const result = resolver.extractVariables(template);

      expect(result).toContain('name');
      expect(result).toContain('day');
      expect(result).toHaveLength(2);
    });

    it('应该提取条件块中的变量名', () => {
      const template = '{{#if showDetails}}{{/if}}';

      const result = resolver.extractVariables(template);

      expect(result).toContain('showDetails');
    });

    it('应该去重', () => {
      const template = '{{name}} {{name}} {{name}}';

      const result = resolver.extractVariables(template);

      expect(result).toHaveLength(1);
      expect(result).toContain('name');
    });

    it('应该处理空模板', () => {
      const template = 'No variables here';

      const result = resolver.extractVariables(template);

      expect(result).toEqual([]);
    });
  });

  describe('validateVariables', () => {
    it('应该返回 valid=true 当所有变量都已提供', () => {
      const template = '{{name}} {{age}}';
      const variables = { name: 'Alice', age: 30 };

      const result = resolver.validateVariables(template, variables);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('应该返回 valid=false 和缺失变量列表', () => {
      const template = '{{name}} {{age}} {{role}}';
      const variables = { name: 'Alice' };

      const result = resolver.validateVariables(template, variables);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('age');
      expect(result.missing).toContain('role');
    });

    it('应该将 null 视为未提供', () => {
      const template = '{{name}}';
      const variables = { name: null };

      const result = resolver.validateVariables(template, variables);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('name');
    });

    it('应该将 undefined 视为未提供', () => {
      const template = '{{name}}';
      const variables = { name: undefined };

      const result = resolver.validateVariables(template, variables);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('name');
    });

    it('应该接受空字符串作为有效值', () => {
      const template = '{{name}}';
      const variables = { name: '' };

      const result = resolver.validateVariables(template, variables);

      expect(result.valid).toBe(true);
    });
  });

  describe('getTimeContextVariables', () => {
    it('应该返回时间相关变量', () => {
      const result = getTimeContextVariables();

      expect(result).toHaveProperty('currentTime');
      expect(result).toHaveProperty('currentDate');
      expect(result).toHaveProperty('currentWeekday');
      expect(result).toHaveProperty('timePeriod');
      expect(result).toHaveProperty('dayType');
      expect(result).toHaveProperty('fullDateTime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('isoDate');
    });

    it('currentWeekday 应该是有效的星期', () => {
      const result = getTimeContextVariables();

      expect(result.currentWeekday).toMatch(/^周[一二三四五六日]$/);
    });

    it('timePeriod 应该是有效的时段', () => {
      const result = getTimeContextVariables();

      expect(['清晨', '上午', '中午', '下午', '晚上', '深夜']).toContain(
        result.timePeriod
      );
    });

    it('dayType 应该是工作日或周末', () => {
      const result = getTimeContextVariables();

      expect(['工作日', '周末']).toContain(result.dayType);
    });

    it('timestamp 应该是有效的时间戳', () => {
      const result = getTimeContextVariables();

      const timestamp = parseInt(result.timestamp, 10);
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('isoDate 应该是有效的 ISO 日期格式', () => {
      const result = getTimeContextVariables();

      expect(() => new Date(result.isoDate)).not.toThrow();
      expect(new Date(result.isoDate).toISOString()).toBe(result.isoDate);
    });
  });

  describe('getVariableResolver', () => {
    it('应该返回单例实例', () => {
      const instance1 = getVariableResolver();
      const instance2 = getVariableResolver();

      expect(instance1).toBe(instance2);
    });
  });
});
