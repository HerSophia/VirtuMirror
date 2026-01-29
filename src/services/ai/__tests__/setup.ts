/**
 * AI Service 测试设置
 */

import { vi, beforeEach, afterEach } from 'vitest';

// 重置所有 mock
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock console.warn 和 console.error 以保持测试输出干净
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
