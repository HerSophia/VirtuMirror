/**
 * Archive 服务测试设置
 */

const originalBroadcastChannel = globalThis.BroadcastChannel

class MockBroadcastChannel {
  name: string
  onmessage: ((ev: MessageEvent) => void) | null = null
  onmessageerror: ((ev: MessageEvent) => void) | null = null

  constructor(name: string) {
    this.name = name
  }

  postMessage(_message: unknown): void {}

  close(): void {}

  addEventListener(_type: string, _listener: EventListener): void {}

  removeEventListener(_type: string, _listener: EventListener): void {}

  dispatchEvent(_event: Event): boolean {
    return true
  }
}

globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel

import 'fake-indexeddb/auto'

export function restoreBroadcastChannel(): void {
  globalThis.BroadcastChannel = originalBroadcastChannel
}
