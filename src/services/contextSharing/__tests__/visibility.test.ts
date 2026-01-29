/**
 * Context Sharing Service 可见性控制测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContextSharingService } from '../ContextSharingService';
import { Visibility } from '../Visibility';

describe('可见性控制', () => {
  describe('Visibility 快捷构造器', () => {
    it('PUBLIC 应该是公开级别', () => {
      expect(Visibility.PUBLIC).toEqual({ level: 'public' });
    });

    it('PRIVATE 应该是私有级别', () => {
      expect(Visibility.PRIVATE).toEqual({ level: 'private' });
    });

    it('only 应该创建 restricted 可见性', () => {
      const visibility = Visibility.only('app-a', 'app-b');

      expect(visibility.level).toBe('restricted');
      expect(visibility.allowedApps).toEqual(['app-a', 'app-b']);
    });

    it('except 应该创建带排除列表的 public 可见性', () => {
      const visibility = Visibility.except('blocked-app');

      expect(visibility.level).toBe('public');
      expect(visibility.excludedApps).toEqual(['blocked-app']);
    });
  });

  describe('ContextSharingService 可见性过滤', () => {
    let service: ContextSharingService;

    beforeEach(() => {
      service = new ContextSharingService();
      service.setCurrentAppId('test-app');

      // 发布不同可见性的上下文
      service.publish({
        id: 'public-context',
        type: 'system:time',
        description: '公开上下文',
        value: 'public-data',
        visibility: { level: 'public' },
      });

      service.publish({
        id: 'private-context',
        type: 'system:time',
        description: '私有上下文',
        value: 'private-data',
        visibility: { level: 'private' },
      });

      service.publish({
        id: 'restricted-context',
        type: 'system:time',
        description: '受限上下文',
        value: 'restricted-data',
        visibility: {
          level: 'restricted',
          allowedApps: ['trusted-app'],
        },
      });

      service.publish({
        id: 'excluded-context',
        type: 'system:time',
        description: '排除某些应用',
        value: 'excluded-data',
        visibility: {
          level: 'public',
          excludedApps: ['blocked-app'],
        },
      });
    });

    it('public 上下文应该对所有应用可见', () => {
      service.setCurrentAppId('any-app');
      expect(service.get('public-context')).toBe('public-data');
    });

    it('private 上下文只对发布者可见', () => {
      // 发布者可以访问
      service.setCurrentAppId('test-app');
      expect(service.get('private-context')).toBe('private-data');

      // 其他应用不能访问
      service.setCurrentAppId('other-app');
      expect(service.get('private-context')).toBeUndefined();
    });

    it('system 应用可以访问 private 上下文', () => {
      service.setCurrentAppId('system');
      expect(service.get('private-context')).toBe('private-data');
    });

    it('restricted 上下文只对允许的应用可见', () => {
      service.setCurrentAppId('trusted-app');
      expect(service.get('restricted-context')).toBe('restricted-data');

      service.setCurrentAppId('untrusted-app');
      expect(service.get('restricted-context')).toBeUndefined();
    });

    it('发布者可以访问自己的 restricted 上下文', () => {
      service.setCurrentAppId('test-app');
      expect(service.get('restricted-context')).toBe('restricted-data');
    });

    it('excludedApps 中的应用不能访问上下文', () => {
      service.setCurrentAppId('blocked-app');
      expect(service.get('excluded-context')).toBeUndefined();

      service.setCurrentAppId('normal-app');
      expect(service.get('excluded-context')).toBe('excluded-data');
    });

    it('getAllContexts 应该根据当前应用过滤可见性', () => {
      service.setCurrentAppId('normal-app');
      const contexts = service.getAllContexts();
      const ids = contexts.map((c) => c.id);

      expect(ids).toContain('public-context');
      expect(ids).not.toContain('private-context');
      expect(ids).not.toContain('restricted-context');
      expect(ids).toContain('excluded-context');
    });

    it('getAllContexts 对 trusted-app 应该显示 restricted 上下文', () => {
      service.setCurrentAppId('trusted-app');
      const contexts = service.getAllContexts();
      const ids = contexts.map((c) => c.id);

      expect(ids).toContain('restricted-context');
    });

    it('getAllContexts 对 blocked-app 应该隐藏 excluded 上下文', () => {
      service.setCurrentAppId('blocked-app');
      const contexts = service.getAllContexts();
      const ids = contexts.map((c) => c.id);

      expect(ids).not.toContain('excluded-context');
    });
  });

  describe('使用 Visibility 快捷方法', () => {
    let service: ContextSharingService;

    beforeEach(() => {
      service = new ContextSharingService();
    });

    it('使用 Visibility.PUBLIC', () => {
      service.publish({
        id: 'test:public',
        type: 'system:time',
        description: '公开',
        value: 'data',
        visibility: Visibility.PUBLIC,
      });

      service.setCurrentAppId('any-app');
      expect(service.get('test:public')).toBe('data');
    });

    it('使用 Visibility.PRIVATE', () => {
      service.setCurrentAppId('publisher');
      service.publish({
        id: 'test:private',
        type: 'system:time',
        description: '私有',
        value: 'data',
        visibility: Visibility.PRIVATE,
      });

      expect(service.get('test:private')).toBe('data');

      service.setCurrentAppId('other');
      expect(service.get('test:private')).toBeUndefined();
    });

    it('使用 Visibility.only()', () => {
      service.publish({
        id: 'test:only',
        type: 'system:time',
        description: '仅限',
        value: 'data',
        visibility: Visibility.only('allowed-app'),
      });

      service.setCurrentAppId('allowed-app');
      expect(service.get('test:only')).toBe('data');

      service.setCurrentAppId('denied-app');
      expect(service.get('test:only')).toBeUndefined();
    });

    it('使用 Visibility.except()', () => {
      service.publish({
        id: 'test:except',
        type: 'system:time',
        description: '排除',
        value: 'data',
        visibility: Visibility.except('blocked'),
      });

      service.setCurrentAppId('normal');
      expect(service.get('test:except')).toBe('data');

      service.setCurrentAppId('blocked');
      expect(service.get('test:except')).toBeUndefined();
    });
  });
});
