/**
 * 请求管理器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestManager, getRequestManager } from '../requestManager';

describe('RequestManager', () => {
  let manager: RequestManager;

  beforeEach(() => {
    // 创建新实例用于测试（绕过单例）
    manager = new (RequestManager as any)();
    (manager as any).requests = new Map();
  });

  describe('create', () => {
    it('应该创建带有自动生成 ID 的请求', () => {
      const ctx = manager.create();

      expect(ctx.id).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(ctx.status).toBe('pending');
      expect(ctx.startTime).toBeLessThanOrEqual(Date.now());
      expect(ctx.controller).toBeInstanceOf(AbortController);
      expect(ctx.signal).toBe(ctx.controller.signal);
    });

    it('应该创建带有自定义 ID 的请求', () => {
      const ctx = manager.create({ id: 'custom-id' });
      expect(ctx.id).toBe('custom-id');
    });

    it('应该创建带有 source 的请求', () => {
      const ctx = manager.create({ source: 'test-source' });
      expect(ctx.source).toBe('test-source');
    });
  });

  describe('get', () => {
    it('应该获取已存在的请求', () => {
      const ctx = manager.create({ id: 'test-id' });
      expect(manager.get('test-id')).toBe(ctx);
    });

    it('应该对不存在的请求返回 undefined', () => {
      expect(manager.get('non-existent')).toBeUndefined();
    });
  });

  describe('start', () => {
    it('应该将状态更新为 running', () => {
      const ctx = manager.create({ id: 'test-id' });
      manager.start('test-id');
      expect(ctx.status).toBe('running');
    });

    it('应该对不存在的请求不抛错', () => {
      expect(() => manager.start('non-existent')).not.toThrow();
    });
  });

  describe('complete', () => {
    it('应该将状态更新为 completed 并设置 endTime', () => {
      const ctx = manager.create({ id: 'test-id' });
      manager.complete('test-id');

      expect(ctx.status).toBe('completed');
      expect(ctx.endTime).toBeDefined();
      expect(ctx.endTime).toBeGreaterThanOrEqual(ctx.startTime);
    });
  });

  describe('fail', () => {
    it('应该将状态更新为 failed 并设置 endTime', () => {
      const ctx = manager.create({ id: 'test-id' });
      manager.fail('test-id');

      expect(ctx.status).toBe('failed');
      expect(ctx.endTime).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('应该取消 pending 状态的请求', () => {
      const ctx = manager.create({ id: 'test-id' });
      const abortSpy = vi.spyOn(ctx.controller, 'abort');

      const result = manager.cancel('test-id');

      expect(result).toBe(true);
      expect(ctx.status).toBe('aborted');
      expect(ctx.endTime).toBeDefined();
      expect(abortSpy).toHaveBeenCalled();
    });

    it('应该取消 running 状态的请求', () => {
      const ctx = manager.create({ id: 'test-id' });
      manager.start('test-id');

      const result = manager.cancel('test-id');

      expect(result).toBe(true);
      expect(ctx.status).toBe('aborted');
    });

    it('应该不取消 completed 状态的请求', () => {
      manager.create({ id: 'test-id' });
      manager.complete('test-id');

      const result = manager.cancel('test-id');
      expect(result).toBe(false);
    });

    it('应该对不存在的请求返回 false', () => {
      expect(manager.cancel('non-existent')).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('应该取消所有活动请求', () => {
      const ctx1 = manager.create({ id: 'id-1' });
      const ctx2 = manager.create({ id: 'id-2' });
      manager.start('id-2');
      manager.create({ id: 'id-3' });
      manager.complete('id-3');

      manager.cancelAll();

      expect(ctx1.status).toBe('aborted');
      expect(ctx2.status).toBe('aborted');
      expect(manager.get('id-3')!.status).toBe('completed');
    });
  });

  describe('getActiveRequests', () => {
    it('应该返回所有活动请求', () => {
      manager.create({ id: 'id-1', source: 'source-1' });
      manager.create({ id: 'id-2' });
      manager.start('id-2');
      manager.create({ id: 'id-3' });
      manager.complete('id-3');

      const active = manager.getActiveRequests();

      expect(active).toHaveLength(2);
      expect(active.map((r) => r.id).sort()).toEqual(['id-1', 'id-2']);
      expect(active.find((r) => r.id === 'id-1')?.status).toBe('pending');
      expect(active.find((r) => r.id === 'id-2')?.status).toBe('running');
    });

    it('应该返回空数组当没有活动请求', () => {
      manager.create({ id: 'id-1' });
      manager.complete('id-1');

      expect(manager.getActiveRequests()).toEqual([]);
    });
  });

  describe('isGenerating', () => {
    it('应该在有活动请求时返回 true', () => {
      manager.create({ id: 'id-1' });
      expect(manager.isGenerating()).toBe(true);
    });

    it('应该在没有活动请求时返回 false', () => {
      manager.create({ id: 'id-1' });
      manager.complete('id-1');
      expect(manager.isGenerating()).toBe(false);
    });
  });

  describe('getLatestRequestId', () => {
    it('应该返回最新创建的请求 ID', async () => {
      manager.create({ id: 'id-1' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      manager.create({ id: 'id-2' });

      expect(manager.getLatestRequestId()).toBe('id-2');
    });

    it('应该在没有请求时返回 null', () => {
      expect(manager.getLatestRequestId()).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('应该清理超过 maxAge 的已完成请求', () => {
      const ctx = manager.create({ id: 'id-1' });
      manager.complete('id-1');
      // 手动设置 endTime 为过去
      ctx.endTime = Date.now() - 100000;

      manager.cleanup(50000);

      expect(manager.get('id-1')).toBeUndefined();
    });

    it('应该保留未完成的请求', () => {
      manager.create({ id: 'id-1' });
      manager.cleanup(0);
      expect(manager.get('id-1')).toBeDefined();
    });

    it('应该保留最近完成的请求', () => {
      manager.create({ id: 'id-1' });
      manager.complete('id-1');

      manager.cleanup(100000);

      expect(manager.get('id-1')).toBeDefined();
    });
  });

  describe('getRequestManager', () => {
    it('应该返回单例实例', () => {
      const instance1 = getRequestManager();
      const instance2 = getRequestManager();
      expect(instance1).toBe(instance2);
    });
  });
});
