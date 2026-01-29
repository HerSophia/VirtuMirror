/**
 * 社交媒体服务测试设置
 * 配置 fake-indexeddb 以在 Node.js 环境中模拟 IndexedDB
 */

// 在导入任何使用 Dexie 的模块之前，先 mock BroadcastChannel
// 这是因为 Dexie 在多标签页同步时使用 BroadcastChannel，
// 但 jsdom 的 BroadcastChannel 实现与 Node.js 的不完全兼容
const originalBroadcastChannel = globalThis.BroadcastChannel

// 创建一个无操作的 BroadcastChannel mock
class MockBroadcastChannel {
  name: string
  onmessage: ((ev: MessageEvent) => void) | null = null
  onmessageerror: ((ev: MessageEvent) => void) | null = null

  constructor(name: string) {
    this.name = name
  }

  postMessage(_message: unknown): void {
    // 在测试环境中不需要实际广播
  }

  close(): void {
    // 无操作
  }

  addEventListener(_type: string, _listener: EventListener): void {
    // 无操作
  }

  removeEventListener(_type: string, _listener: EventListener): void {
    // 无操作
  }

  dispatchEvent(_event: Event): boolean {
    return true
  }
}

// 替换全局 BroadcastChannel
globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel

// 现在安全地导入 fake-indexeddb
import 'fake-indexeddb/auto'

// Mock uuid
import { vi } from 'vitest'
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}))
