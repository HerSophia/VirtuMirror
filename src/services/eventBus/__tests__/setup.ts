/**
 * 事件总线服务测试设置
 */

import { vi } from 'vitest'

// Mock logger service
vi.mock('@/services/logger', () => ({
  loggerService: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))
