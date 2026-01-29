/**
 * 交互服务测试设置
 * Mock 依赖的服务
 */

import { vi } from 'vitest'

// Mock loggerService
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

// Mock eventBus
vi.mock('@/services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
  },
}))
