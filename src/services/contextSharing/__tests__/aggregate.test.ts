/**
 * Context Sharing Service 聚合功能测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextSharingService } from '../ContextSharingService';

describe('ContextSharingService - 聚合功能', () => {
  let service: ContextSharingService;

  beforeEach(() => {
    service = new ContextSharingService();
    service.setCurrentAppId('test-app');

    // 发布测试数据
    service.publish({
      id: 'weibo:trending',
      type: 'social:trending',
      description: '微博热搜榜',
      value: [
        { rank: 1, title: '热搜话题1' },
        { rank: 2, title: '热搜话题2' },
      ],
      visibility: { level: 'public' },
    });

    service.publish({
      id: 'system:time',
      type: 'system:time',
      description: '系统时间',
      value: '2025-01-08 15:30:00',
      visibility: { level: 'public' },
    });

    service.publish({
      id: 'narrative:content',
      type: 'narrative:content',
      description: '叙事内容',
      getter: async () => '角色正在咖啡店思考...',
      visibility: { level: 'public' },
    });

    service.publish({
      id: 'private:secret',
      type: 'system:session',
      description: '私有数据',
      value: 'secret-data',
      visibility: { level: 'private' },
    });
  });

  describe('aggregate', () => {
    it('应该聚合指定类型的上下文', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['social:trending', 'system:time'],
        format: 'text',
      });

      expect(result.contexts.size).toBe(2);
      expect(result.contexts.has('social:trending')).toBe(true);
      expect(result.contexts.has('system:time')).toBe(true);
      expect(result.meta.totalContexts).toBe(2);
    });

    it('应该聚合指定 ID 的上下文', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        ids: ['weibo:trending'],
        format: 'text',
      });

      expect(result.contexts.size).toBe(1);
      expect(result.contexts.has('social:trending')).toBe(true);
    });

    it('应该调用 getter 获取值', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['narrative:content'],
        format: 'text',
      });

      expect(result.contexts.has('narrative:content')).toBe(true);
      const items = result.contexts.get('narrative:content');
      expect(items?.[0].value).toBe('角色正在咖啡店思考...');
    });

    it('应该根据可见性过滤上下文', async () => {
      // 其他应用不能访问私有上下文
      const result = await service.aggregate({
        requesterId: 'other-app',
        format: 'text',
      });

      const types = result.meta.types;
      expect(types).not.toContain('system:session');
    });

    it('发布者应该能访问自己的私有上下文', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        format: 'text',
      });

      const types = result.meta.types;
      expect(types).toContain('system:session');
    });

    it('应该按优先级排序', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['social:trending', 'system:time', 'narrative:content'],
        priority: ['narrative:content', 'system:time', 'social:trending'],
        format: 'text',
      });

      const types = result.meta.types;
      // narrative:content 应该排在最前面
      expect(types[0]).toBe('narrative:content');
    });
  });

  describe('aggregate 格式化', () => {
    it('format=text 应该返回纯文本', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['social:trending'],
        format: 'text',
      });

      expect(result.formatted).toBeDefined();
      expect(result.formatted).toContain('微博热搜榜');
    });

    it('format=xml 应该返回 XML', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['social:trending'],
        format: 'xml',
      });

      expect(result.formatted).toBeDefined();
      expect(result.formatted).toContain('<context');
      expect(result.formatted).toContain('</context>');
    });

    it('format=markdown 应该返回 Markdown', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['social:trending'],
        format: 'markdown',
      });

      expect(result.formatted).toBeDefined();
      expect(result.formatted).toContain('##');
    });

    it('format=raw 应该不格式化', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['social:trending'],
        format: 'raw',
      });

      expect(result.formatted).toBeUndefined();
      expect(result.contexts.size).toBeGreaterThan(0);
    });
  });

  describe('aggregate maxTokens', () => {
    it('应该限制 token 数量', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        format: 'text',
        maxTokens: 10, // 非常小的限制
      });

      expect(result.meta.truncated).toBe(true);
    });

    it('足够的 token 限制不应该截断', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['system:time'],
        format: 'text',
        maxTokens: 10000,
      });

      expect(result.meta.truncated).toBe(false);
    });
  });

  describe('aggregate 元信息', () => {
    it('应该返回正确的元信息', async () => {
      const result = await service.aggregate({
        requesterId: 'test-app',
        types: ['social:trending', 'system:time'],
        format: 'text',
      });

      expect(result.meta.totalContexts).toBe(2);
      expect(result.meta.types).toHaveLength(2);
      expect(result.meta.estimatedTokens).toBeGreaterThan(0);
    });
  });
});
