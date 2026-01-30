/**
 * Feed Service 测试设置
 * Mock 依赖的服务
 */

import { vi } from 'vitest'

// Mock loggerService (如果需要)
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

// Mock eventBus (如果需要)
vi.mock('@/services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
  },
}))
