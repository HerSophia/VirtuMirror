/**
 * LLM 任务服务测试设置
 * 配置测试环境和 mock
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Mock BroadcastChannel for Dexie compatibility
class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onmessageerror: ((ev: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(_message: unknown): void {
    // No-op in test environment
  }

  close(): void {
    // No-op
  }

  addEventListener(_type: string, _listener: EventListener): void {
    // No-op
  }

  removeEventListener(_type: string, _listener: EventListener): void {
    // No-op
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }
}

globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: true,
    },
  },
});

// Mock navigator
if (typeof navigator === 'undefined') {
  vi.stubGlobal('navigator', {
    language: 'zh-CN',
  });
}

// Mock Intl.DateTimeFormat for timezone
const originalDateTimeFormat = Intl.DateTimeFormat;
vi.stubGlobal('Intl', {
  ...Intl,
  DateTimeFormat: function (...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
    const instance = new originalDateTimeFormat(...args);
    return {
      ...instance,
      resolvedOptions: () => ({
        ...instance.resolvedOptions(),
        timeZone: 'Asia/Shanghai',
      }),
    };
  },
});

// Reset all mocks and singletons before each test
export function setupTestEnvironment() {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}

// Helper to create mock task definitions
export function createMockTaskDefinition(overrides: Partial<import('../types').LLMTaskDefinition> = {}): import('../types').LLMTaskDefinition {
  return {
    id: 'test:mock-task',
    appId: 'test',
    name: 'Mock Task',
    description: 'A mock task for testing',
    type: 'manual',
    executionMode: 'once',
    promptTemplate: 'Test prompt with {{variable}}',
    inputSchema: [
      {
        name: 'variable',
        label: 'Variable',
        type: 'string',
        required: true,
      },
    ],
    defaultInput: {
      variable: 'default value',
    },
    outputHandlerId: 'test:mock-handler',
    ...overrides,
  };
}

// Helper to create mock context providers
export function createMockContextProvider(overrides: Partial<import('../types').ContextProvider> = {}): import('../types').ContextProvider {
  return {
    id: 'test:mock-provider',
    appId: 'test',
    name: 'Mock Provider',
    description: 'A mock provider for testing',
    priority: 100,
    getContext: async () => ({
      testVar: 'testValue',
    }),
    ...overrides,
  };
}

// Helper to create mock output handlers
export function createMockOutputHandler(overrides: Partial<import('../types').OutputHandler> = {}): import('../types').OutputHandler {
  return {
    id: 'test:mock-handler',
    appId: 'test',
    name: 'Mock Handler',
    description: 'A mock handler for testing',
    handle: async () => ({
      success: true,
      data: { processed: true },
    }),
    ...overrides,
  };
}
