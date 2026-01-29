/**
 * LLM 任务服务工具函数单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateTaskId,
  generateDefinitionId,
  getDefaultLLMConfig,
  getDefaultAutoConfig,
  createTaskFromDefinition,
  canExecute,
  isRunning,
  isFinished,
  isRepeatable,
  getStatusLabel,
  getModeLabel,
  formatDuration,
  formatRelativeTime,
  cleanJsonOutput,
  safeParseJson,
  syncTaskWithDefinition,
} from '../utils';
import { createMockTaskDefinition } from './setup';
import type { LLMTask, LLMTaskDefinition } from '../types';
import { RequestPriority } from '@/services/ai/types';

describe('utils', () => {
  describe('generateTaskId', () => {
    it('应该生成有效的 UUID', () => {
      const id = generateTaskId();

      // UUID v4 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('应该每次生成不同的 ID', () => {
      const id1 = generateTaskId();
      const id2 = generateTaskId();
      const id3 = generateTaskId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('generateDefinitionId', () => {
    it('应该生成正确格式的定义 ID', () => {
      const id = generateDefinitionId('weibo', 'Generate Post');

      expect(id).toBe('weibo:generate-post');
    });

    it('应该处理特殊字符', () => {
      const id = generateDefinitionId('app', 'Task@#$%Name');

      expect(id).toBe('app:task-name');
    });

    it('应该处理中文', () => {
      const id = generateDefinitionId('weibo', '生成博文');

      expect(id).toBe('weibo:生成博文');
    });

    it('应该移除首尾的连字符', () => {
      const id = generateDefinitionId('app', '--test--');

      expect(id).toBe('app:test');
    });

    it('应该将多个连字符合并为一个', () => {
      const id = generateDefinitionId('app', 'test   name');

      expect(id).toBe('app:test-name');
    });
  });

  describe('getDefaultLLMConfig', () => {
    it('应该返回默认配置', () => {
      const config = getDefaultLLMConfig();

      expect(config).toEqual({
        source: 'global',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1,
      });
    });
  });

  describe('getDefaultAutoConfig', () => {
    it('应该返回默认自动执行配置', () => {
      const config = getDefaultAutoConfig();

      expect(config).toEqual({
        enabled: false,
        intervalMinutes: 30,
        maxExecutions: 0,
        executionCount: 0,
      });
    });
  });

  describe('createTaskFromDefinition', () => {
    it('应该从定义创建任务实例', () => {
      const definition = createMockTaskDefinition();

      const task = createTaskFromDefinition(definition);

      expect(task.definitionId).toBe(definition.id);
      expect(task.appId).toBe(definition.appId);
      expect(task.name).toBe(definition.name);
      expect(task.type).toBe(definition.type);
      expect(task.status).toBe('pending');
      expect(task.totalExecutions).toBe(0);
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
    });

    it('应该应用默认输入', () => {
      const definition = createMockTaskDefinition({
        defaultInput: { key1: 'value1', key2: 'value2' },
      });

      const task = createTaskFromDefinition(definition);

      expect(task.input).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('应该允许覆盖名称', () => {
      const definition = createMockTaskDefinition({ name: 'Original' });

      const task = createTaskFromDefinition(definition, { name: 'Custom Name' });

      expect(task.name).toBe('Custom Name');
    });

    it('应该允许覆盖输入', () => {
      const definition = createMockTaskDefinition({
        defaultInput: { key1: 'default1' },
      });

      const task = createTaskFromDefinition(definition, {
        input: { key1: 'custom1', key2: 'custom2' },
      });

      expect(task.input).toEqual({ key1: 'custom1', key2: 'custom2' });
    });

    it('应该允许覆盖配置', () => {
      const definition = createMockTaskDefinition({
        config: { temperature: 0.5 },
      });

      const task = createTaskFromDefinition(definition, {
        config: { temperature: 0.9, maxTokens: 4096 },
      });

      expect(task.config.temperature).toBe(0.9);
      expect(task.config.maxTokens).toBe(4096);
    });

    it('应该为 auto 模式创建 autoConfig', () => {
      const definition = createMockTaskDefinition({
        executionMode: 'auto',
        autoConfig: { intervalMinutes: 60 },
      });

      const task = createTaskFromDefinition(definition);

      expect(task.autoConfig).toBeDefined();
      expect(task.autoConfig?.intervalMinutes).toBe(60);
    });

    it('应该使用定义的优先级', () => {
      const definition = createMockTaskDefinition({
        priority: RequestPriority.HIGH,
      });

      const task = createTaskFromDefinition(definition);

      expect(task.priority).toBe(RequestPriority.HIGH);
    });

    it('应该使用默认优先级当未指定', () => {
      const definition = createMockTaskDefinition({ priority: undefined });

      const task = createTaskFromDefinition(definition);

      expect(task.priority).toBe(RequestPriority.NORMAL);
    });
  });

  describe('状态判断函数', () => {
    const createTask = (status: LLMTask['status']): LLMTask => ({
      id: 'test-id',
      definitionId: 'test:def',
      appId: 'test',
      name: 'Test',
      status,
      executionMode: 'once',
      type: 'manual',
      input: {},
      config: getDefaultLLMConfig(),
      priority: RequestPriority.NORMAL,
      createdAt: Date.now(),
      totalExecutions: 0,
      retryCount: 0,
      maxRetries: 3,
    });

    describe('canExecute', () => {
      it('应该返回 true 当状态为 pending', () => {
        expect(canExecute(createTask('pending'))).toBe(true);
      });

      it('应该返回 true 当状态为 failed', () => {
        expect(canExecute(createTask('failed'))).toBe(true);
      });

      it('应该返回 false 当状态为 running', () => {
        expect(canExecute(createTask('running'))).toBe(false);
      });

      it('应该返回 false 当状态为 completed', () => {
        expect(canExecute(createTask('completed'))).toBe(false);
      });

      it('应该返回 false 当状态为 paused', () => {
        expect(canExecute(createTask('paused'))).toBe(false);
      });

      it('应该返回 false 当状态为 cancelled', () => {
        expect(canExecute(createTask('cancelled'))).toBe(false);
      });
    });

    describe('isRunning', () => {
      it('应该返回 true 当状态为 running', () => {
        expect(isRunning(createTask('running'))).toBe(true);
      });

      it('应该返回 false 当状态不是 running', () => {
        expect(isRunning(createTask('pending'))).toBe(false);
        expect(isRunning(createTask('completed'))).toBe(false);
        expect(isRunning(createTask('failed'))).toBe(false);
      });
    });

    describe('isFinished', () => {
      it('应该返回 true 当状态为 completed', () => {
        expect(isFinished(createTask('completed'))).toBe(true);
      });

      it('应该返回 true 当状态为 failed', () => {
        expect(isFinished(createTask('failed'))).toBe(true);
      });

      it('应该返回 true 当状态为 cancelled', () => {
        expect(isFinished(createTask('cancelled'))).toBe(true);
      });

      it('应该返回 false 当状态为 pending', () => {
        expect(isFinished(createTask('pending'))).toBe(false);
      });

      it('应该返回 false 当状态为 running', () => {
        expect(isFinished(createTask('running'))).toBe(false);
      });

      it('应该返回 false 当状态为 paused', () => {
        expect(isFinished(createTask('paused'))).toBe(false);
      });
    });

    describe('isRepeatable', () => {
      it('应该返回 true 当执行模式为 repeatable', () => {
        const task = { ...createTask('pending'), executionMode: 'repeatable' as const };
        expect(isRepeatable(task)).toBe(true);
      });

      it('应该返回 true 当执行模式为 auto', () => {
        const task = { ...createTask('pending'), executionMode: 'auto' as const };
        expect(isRepeatable(task)).toBe(true);
      });

      it('应该返回 false 当执行模式为 once', () => {
        const task = { ...createTask('pending'), executionMode: 'once' as const };
        expect(isRepeatable(task)).toBe(false);
      });
    });
  });

  describe('getStatusLabel', () => {
    it('应该返回正确的中文标签', () => {
      expect(getStatusLabel('pending')).toBe('待执行');
      expect(getStatusLabel('running')).toBe('执行中');
      expect(getStatusLabel('completed')).toBe('已完成');
      expect(getStatusLabel('failed')).toBe('失败');
      expect(getStatusLabel('paused')).toBe('已暂停');
      expect(getStatusLabel('cancelled')).toBe('已取消');
    });

    it('应该返回原状态当未知', () => {
      expect(getStatusLabel('unknown' as any)).toBe('unknown');
    });
  });

  describe('getModeLabel', () => {
    it('应该返回正确的中文标签', () => {
      expect(getModeLabel('once')).toBe('一次性');
      expect(getModeLabel('repeatable')).toBe('可重复');
      expect(getModeLabel('auto')).toBe('自动循环');
    });

    it('应该返回原模式当未知', () => {
      expect(getModeLabel('unknown' as any)).toBe('unknown');
    });
  });

  describe('formatDuration', () => {
    it('应该格式化毫秒级时长', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('应该格式化秒级时长', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(2500)).toBe('2.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('应该格式化分钟级时长', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该返回 "刚刚" 当不到1分钟', () => {
      const now = Date.now();
      expect(formatRelativeTime(now)).toBe('刚刚');
      expect(formatRelativeTime(now - 30000)).toBe('刚刚');
      expect(formatRelativeTime(now - 59999)).toBe('刚刚');
    });

    it('应该返回分钟数', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 60000)).toBe('1 分钟前');
      expect(formatRelativeTime(now - 1800000)).toBe('30 分钟前');
      expect(formatRelativeTime(now - 3599999)).toBe('59 分钟前');
    });

    it('应该返回小时数', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 3600000)).toBe('1 小时前');
      expect(formatRelativeTime(now - 7200000)).toBe('2 小时前');
      expect(formatRelativeTime(now - 86399999)).toBe('23 小时前');
    });

    it('应该返回日期当超过24小时', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 86400000);
      // 返回日期格式
      expect(result).toMatch(/\d/);
    });
  });

  describe('cleanJsonOutput', () => {
    it('应该移除 markdown json 代码块标记', () => {
      const input = '```json\n{"key": "value"}\n```';
      expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
    });

    it('应该移除通用代码块标记', () => {
      const input = '```\n{"key": "value"}\n```';
      expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
    });

    it('应该保留正常的 JSON', () => {
      const input = '{"key": "value"}';
      expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
    });

    it('应该处理大小写不敏感的标记', () => {
      const input = '```JSON\n{"key": "value"}\n```';
      expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
    });

    it('应该去除首尾空白', () => {
      const input = '  \n{"key": "value"}\n  ';
      expect(cleanJsonOutput(input)).toBe('{"key": "value"}');
    });
  });

  describe('safeParseJson', () => {
    it('应该解析有效的 JSON', () => {
      const result = safeParseJson<{ key: string }>('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('应该解析带代码块的 JSON', () => {
      const result = safeParseJson<{ key: string }>('```json\n{"key": "value"}\n```');
      expect(result).toEqual({ key: 'value' });
    });

    it('应该返回 null 当 JSON 无效', () => {
      const result = safeParseJson('invalid json');
      expect(result).toBeNull();
    });

    it('应该返回 null 当输入为空', () => {
      const result = safeParseJson('');
      expect(result).toBeNull();
    });
  });

  describe('syncTaskWithDefinition', () => {
    it('应该更新定义相关字段', () => {
      const definition = createMockTaskDefinition({
        name: 'New Name',
        description: 'New Description',
        systemPrompt: 'New System Prompt',
      });

      const task: LLMTask = {
        id: 'task-id',
        definitionId: definition.id,
        appId: 'test',
        name: 'Old Name',
        description: 'Old Description',
        status: 'completed',
        executionMode: 'once',
        type: 'manual',
        input: { oldKey: 'oldValue' },
        config: getDefaultLLMConfig(),
        priority: RequestPriority.NORMAL,
        createdAt: Date.now(),
        totalExecutions: 5,
        retryCount: 0,
        maxRetries: 3,
        output: 'Some output',
        outputHistory: [{ timestamp: Date.now(), output: 'History' }],
      };

      const synced = syncTaskWithDefinition(task, definition);

      expect(synced.name).toBe('New Name');
      expect(synced.description).toBe('New Description');
      expect(synced.systemPrompt).toBe('New System Prompt');
    });

    it('应该保留运行时状态', () => {
      const definition = createMockTaskDefinition();
      const task: LLMTask = {
        id: 'task-id',
        definitionId: definition.id,
        appId: 'test',
        name: 'Task',
        status: 'completed',
        executionMode: 'once',
        type: 'manual',
        input: {},
        config: getDefaultLLMConfig(),
        priority: RequestPriority.NORMAL,
        createdAt: Date.now(),
        totalExecutions: 10,
        retryCount: 0,
        maxRetries: 3,
        output: 'Important output',
        outputHistory: [{ timestamp: Date.now(), output: 'History' }],
      };

      const synced = syncTaskWithDefinition(task, definition);

      expect(synced.status).toBe('completed');
      expect(synced.totalExecutions).toBe(10);
      expect(synced.output).toBe('Important output');
      expect(synced.outputHistory).toHaveLength(1);
    });

    it('应该合并输入（保留用户值，添加新默认值）', () => {
      const definition = createMockTaskDefinition({
        defaultInput: { key1: 'default1', key2: 'default2', key3: 'default3' },
      });

      const task: LLMTask = {
        id: 'task-id',
        definitionId: definition.id,
        appId: 'test',
        name: 'Task',
        status: 'pending',
        executionMode: 'once',
        type: 'manual',
        input: { key1: 'user1', key2: 'user2' },
        config: getDefaultLLMConfig(),
        priority: RequestPriority.NORMAL,
        createdAt: Date.now(),
        totalExecutions: 0,
        retryCount: 0,
        maxRetries: 3,
      };

      const synced = syncTaskWithDefinition(task, definition);

      expect(synced.input).toEqual({
        key1: 'user1',  // 保留用户值
        key2: 'user2',  // 保留用户值
        key3: 'default3',  // 新增默认值
      });
    });
  });
});
