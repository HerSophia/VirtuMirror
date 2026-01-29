/**
 * Context Sharing Service 格式化器测试
 */
import { describe, it, expect } from 'vitest';
import { formatContexts } from '../formatters';
import type { ContextType, ContextItem } from '../types';

describe('格式化器', () => {
  // 创建测试用的上下文 Map
  const createTestContexts = (): Map<ContextType, ContextItem[]> => {
    const contexts = new Map<ContextType, ContextItem[]>();

    contexts.set('social:trending', [
      {
        id: 'weibo:trending',
        description: '微博热搜榜',
        value: [
          { rank: 1, title: '热搜话题1', hot: 1000000 },
          { rank: 2, title: '热搜话题2', hot: 800000 },
        ],
      },
    ]);

    contexts.set('system:time', [
      {
        id: 'system:time',
        description: '当前系统时间',
        value: '2025-01-08 15:30:00',
      },
    ]);

    contexts.set('narrative:content', [
      {
        id: 'narrative:content',
        description: '当前叙事内容',
        value: '角色正在咖啡店里思考人生...',
      },
    ]);

    return contexts;
  };

  describe('formatContexts - text 格式', () => {
    it('应该将上下文格式化为纯文本', () => {
      const contexts = createTestContexts();
      const result = formatContexts(contexts, 'text');

      expect(result.text).toContain('微博热搜榜');
      expect(result.text).toContain('当前系统时间');
      expect(result.text).toContain('2025-01-08 15:30:00');
      expect(result.truncated).toBe(false);
    });

    it('空 Map 应该返回空字符串', () => {
      const contexts = new Map<ContextType, ContextItem[]>();
      const result = formatContexts(contexts, 'text');
      expect(result.text).toBe('');
    });
  });

  describe('formatContexts - xml 格式', () => {
    it('应该将上下文格式化为 XML', () => {
      const contexts = createTestContexts();
      const result = formatContexts(contexts, 'xml');

      expect(result.text).toContain('<context');
      expect(result.text).toContain('</context>');
      expect(result.text).toContain('type="social:trending"');
    });

    it('应该正确转义 XML 特殊字符', () => {
      const contexts = new Map<ContextType, ContextItem[]>();
      contexts.set('system:time', [
        {
          id: 'test:special',
          description: '包含 <特殊> & "字符"',
          value: 'value with <tags> & "quotes"',
        },
      ]);

      const result = formatContexts(contexts, 'xml');

      // XML 特殊字符应该被转义
      expect(result.text).not.toContain('<特殊>');
      expect(result.text).toContain('&lt;');
      expect(result.text).toContain('&gt;');
      expect(result.text).toContain('&amp;');
    });
  });

  describe('formatContexts - markdown 格式', () => {
    it('应该将上下文格式化为 Markdown', () => {
      const contexts = createTestContexts();
      const result = formatContexts(contexts, 'markdown');

      // 应该包含标题
      expect(result.text).toContain('##');
      // 应该包含描述
      expect(result.text).toContain('微博热搜榜');
    });

    it('应该为对象值生成代码块', () => {
      const contexts = createTestContexts();
      const result = formatContexts(contexts, 'markdown');

      // 对于对象类型的值，应该使用代码块
      expect(result.text).toContain('```');
    });
  });

  describe('formatContexts - raw 格式', () => {
    it('应该返回 JSON 字符串', () => {
      const contexts = createTestContexts();
      const result = formatContexts(contexts, 'raw');

      // 应该是有效的 JSON
      expect(() => JSON.parse(result.text)).not.toThrow();

      const parsed = JSON.parse(result.text);
      expect(parsed).toHaveProperty('social:trending');
      expect(parsed).toHaveProperty('system:time');
    });
  });

  describe('Token 限制', () => {
    it('超过 maxTokens 应该截断', () => {
      const contexts = createTestContexts();
      // 设置一个很小的 token 限制
      const result = formatContexts(contexts, 'text', 10);

      expect(result.truncated).toBe(true);
      expect(result.text).toContain('截断');
    });

    it('未超过 maxTokens 不应该截断', () => {
      const contexts = createTestContexts();
      // 设置一个足够大的 token 限制
      const result = formatContexts(contexts, 'text', 10000);

      expect(result.truncated).toBe(false);
    });
  });

  describe('estimatedTokens', () => {
    it('应该返回估算的 token 数', () => {
      const contexts = createTestContexts();
      const result = formatContexts(contexts, 'text');

      expect(result.estimatedTokens).toBeGreaterThan(0);
      // 估算大约是字符数 / 4
      expect(result.estimatedTokens).toBeLessThanOrEqual(result.text.length);
    });
  });

  describe('边界情况', () => {
    it('处理 null 值', () => {
      const contexts = new Map<ContextType, ContextItem[]>();
      contexts.set('system:time', [
        {
          id: 'test:null',
          description: '空值测试',
          value: null,
        },
      ]);

      expect(() => formatContexts(contexts, 'text')).not.toThrow();
      expect(() => formatContexts(contexts, 'xml')).not.toThrow();
      expect(() => formatContexts(contexts, 'raw')).not.toThrow();
      expect(() => formatContexts(contexts, 'markdown')).not.toThrow();
    });

    it('处理 undefined 值', () => {
      const contexts = new Map<ContextType, ContextItem[]>();
      contexts.set('system:time', [
        {
          id: 'test:undefined',
          description: '未定义值测试',
          value: undefined,
        },
      ]);

      expect(() => formatContexts(contexts, 'text')).not.toThrow();
      expect(() => formatContexts(contexts, 'xml')).not.toThrow();
      expect(() => formatContexts(contexts, 'raw')).not.toThrow();
      expect(() => formatContexts(contexts, 'markdown')).not.toThrow();
    });

    it('处理深层嵌套对象', () => {
      const contexts = new Map<ContextType, ContextItem[]>();
      contexts.set('system:time', [
        {
          id: 'test:nested',
          description: '嵌套对象测试',
          value: {
            level1: {
              level2: {
                level3: {
                  data: 'deep',
                },
              },
            },
          },
        },
      ]);

      const textResult = formatContexts(contexts, 'text');
      const rawResult = formatContexts(contexts, 'raw');

      expect(textResult.text).toContain('deep');
      const parsed = JSON.parse(rawResult.text);
      expect(parsed['system:time'][0].value.level1.level2.level3.data).toBe('deep');
    });

    it('处理数组值', () => {
      const contexts = new Map<ContextType, ContextItem[]>();
      contexts.set('system:time', [
        {
          id: 'test:array',
          description: '数组测试',
          value: [1, 2, 3, 4, 5],
        },
      ]);

      const rawResult = formatContexts(contexts, 'raw');
      const parsed = JSON.parse(rawResult.text);

      expect(parsed['system:time'][0].value).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
