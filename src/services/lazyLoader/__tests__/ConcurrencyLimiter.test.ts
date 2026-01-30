/**
 * 并发控制器测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConcurrencyLimiter } from '../ConcurrencyLimiter';

describe('ConcurrencyLimiter', () => {
  describe('基础属性', () => {
    it('应该正确初始化并发限制', () => {
      const limiter = new ConcurrencyLimiter(5);

      expect(limiter.concurrencyLimit).toBe(5);
      expect(limiter.runningCount).toBe(0);
      expect(limiter.queueLength).toBe(0);
    });

    it('应该使用默认并发限制 5', () => {
      const limiter = new ConcurrencyLimiter();

      expect(limiter.concurrencyLimit).toBe(5);
    });
  });

  describe('acquire 和 release', () => {
    it('应该在限制内立即获取槽位', async () => {
      const limiter = new ConcurrencyLimiter(3);

      await limiter.acquire();
      expect(limiter.runningCount).toBe(1);

      await limiter.acquire();
      expect(limiter.runningCount).toBe(2);

      await limiter.acquire();
      expect(limiter.runningCount).toBe(3);
    });

    it('应该在达到限制时排队等待', async () => {
      const limiter = new ConcurrencyLimiter(2);

      await limiter.acquire();
      await limiter.acquire();
      expect(limiter.runningCount).toBe(2);

      // 第三个应该被加入队列
      const thirdPromise = limiter.acquire();
      expect(limiter.queueLength).toBe(1);

      // 释放一个槽位
      limiter.release();
      await thirdPromise;

      expect(limiter.runningCount).toBe(2);
      expect(limiter.queueLength).toBe(0);
    });

    it('release 应该减少运行计数', () => {
      const limiter = new ConcurrencyLimiter(3);

      // 手动增加运行计数（模拟 acquire）
      limiter.acquire();
      limiter.acquire();
      expect(limiter.runningCount).toBe(2);

      limiter.release();
      expect(limiter.runningCount).toBe(1);

      limiter.release();
      expect(limiter.runningCount).toBe(0);
    });
  });

  describe('run 方法', () => {
    it('应该执行异步函数并返回结果', async () => {
      const limiter = new ConcurrencyLimiter(3);

      const result = await limiter.run(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('应该在函数完成后自动释放槽位', async () => {
      const limiter = new ConcurrencyLimiter(1);

      await limiter.run(async () => 'first');
      expect(limiter.runningCount).toBe(0);

      await limiter.run(async () => 'second');
      expect(limiter.runningCount).toBe(0);
    });

    it('应该在函数抛出错误时也释放槽位', async () => {
      const limiter = new ConcurrencyLimiter(1);

      try {
        await limiter.run(async () => {
          throw new Error('test error');
        });
      } catch {
        // 忽略错误
      }

      expect(limiter.runningCount).toBe(0);
    });

    it('应该正确传递错误', async () => {
      const limiter = new ConcurrencyLimiter(1);

      await expect(
        limiter.run(async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });

    it('应该限制并发执行', async () => {
      const limiter = new ConcurrencyLimiter(2);
      const executionOrder: number[] = [];
      const startTimes: number[] = [];

      const createTask = (id: number, delay: number) => async () => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, delay));
        executionOrder.push(id);
        return id;
      };

      // 启动 4 个任务，并发限制为 2
      const promises = [
        limiter.run(createTask(1, 50)),
        limiter.run(createTask(2, 50)),
        limiter.run(createTask(3, 50)),
        limiter.run(createTask(4, 50)),
      ];

      // 等待所有任务完成
      const results = await Promise.all(promises);

      expect(results).toEqual([1, 2, 3, 4]);
      expect(executionOrder).toHaveLength(4);
    });
  });

  describe('runAll 方法', () => {
    it('应该执行所有任务并返回结果', async () => {
      const limiter = new ConcurrencyLimiter(3);

      const tasks = [
        async () => 1,
        async () => 2,
        async () => 3,
      ];

      const results = await limiter.runAll(tasks);

      expect(results).toEqual([1, 2, 3]);
    });

    it('应该限制并发数', async () => {
      const limiter = new ConcurrencyLimiter(2);
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const tasks = Array(5).fill(null).map(() => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return true;
      });

      await limiter.runAll(tasks);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('setLimit 方法', () => {
    it('应该能够更改并发限制', () => {
      const limiter = new ConcurrencyLimiter(3);

      limiter.setLimit(5);
      expect(limiter.concurrencyLimit).toBe(5);
    });

    it('增加限制时应该触发等待中的任务', async () => {
      const limiter = new ConcurrencyLimiter(1);

      // 占用唯一的槽位
      await limiter.acquire();
      expect(limiter.runningCount).toBe(1);

      // 添加等待任务
      let secondAcquired = false;
      const secondPromise = limiter.acquire().then(() => {
        secondAcquired = true;
      });

      expect(limiter.queueLength).toBe(1);
      expect(secondAcquired).toBe(false);

      // 增加限制
      limiter.setLimit(2);

      // 等待第二个任务获取槽位
      await secondPromise;

      expect(secondAcquired).toBe(true);
      expect(limiter.runningCount).toBe(2);
    });
  });

  describe('clear 方法', () => {
    it('应该清空等待队列', async () => {
      const limiter = new ConcurrencyLimiter(1);

      await limiter.acquire();

      // 添加等待任务
      limiter.acquire();
      limiter.acquire();
      expect(limiter.queueLength).toBe(2);

      limiter.clear();
      expect(limiter.queueLength).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('并发限制为 1 时应该串行执行', async () => {
      const limiter = new ConcurrencyLimiter(1);
      const executionLog: string[] = [];

      const task = (name: string) => async () => {
        executionLog.push(`${name} start`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionLog.push(`${name} end`);
      };

      await Promise.all([
        limiter.run(task('A')),
        limiter.run(task('B')),
      ]);

      // 应该是 A start, A end, B start, B end 的顺序
      expect(executionLog[0]).toBe('A start');
      expect(executionLog[1]).toBe('A end');
      expect(executionLog[2]).toBe('B start');
      expect(executionLog[3]).toBe('B end');
    });

    it('高并发限制时应该允许并行执行', async () => {
      const limiter = new ConcurrencyLimiter(100);
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const tasks = Array(10).fill(null).map(() => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
      });

      await limiter.runAll(tasks);

      // 所有任务应该同时开始
      expect(maxConcurrent).toBe(10);
    });
  });
});
