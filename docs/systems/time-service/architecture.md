# 时间服务架构设计

> 本文档详细介绍时间服务的内部架构、时间模式和核心组件设计。

## 1. 设计原则

1. **单一时间源**：全局唯一的时间服务实例，避免多个 `setInterval` 分散消耗资源
2. **响应式状态**：通过 Vue 响应式系统和 Pinia 实现状态同步
3. **可扩展的时间模式**：支持多种时间计算策略，适应不同场景
4. **智能时间解析**：支持从自然语言中提取时间信息

## 2. 系统架构

### 2.1 分层架构

```text
┌─────────────────────────────────────────────────────────────┐
│                        UI 组件层                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ StatusBar | ClockApp | NotificationCenter | ...      │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │ 订阅 / 调用
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     TimeStore (Pinia)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ State: currentTime, mode, is24Hour                   │    │
│  │ Actions: setMode(), set24Hour(), formatTime()       │    │
│  │ Persist: mode, is24Hour                              │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │ 双向同步
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   TimeService (单例)                        │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│  │  Tick Loop    │ │  Mode Manager │ │  Time Parser  │      │
│  │  心跳循环      │ │  模式管理      │ │  时间解析      │      │
│  └───────────────┘ └───────────────┘ └───────────────┘      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Internal State: _currentTime, _mode, _offset, ...   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ 事件触发
┌─────────────────────────────────────────────────────────────┐
│                   External Sources                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ BridgeAdapter│ │ ChatStore   │ │ User Actions │            │
│  │ (酒馆消息)   │ │ (聊天历史)  │ │ (用户操作)   │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流向

```text
时间更新流程：
┌────────────┐    每秒触发    ┌────────────┐    广播    ┌────────────┐
│ Tick Loop  │ ───────────► │ updateTime │ ────────► │ Listeners  │
└────────────┘               └────────────┘            └────────────┘
                                   │
                                   ▼
                            ┌────────────┐
                            │  Store 更新 │
                            └────────────┘

模拟时间同步流程：
┌────────────┐   消息内容   ┌────────────┐   解析成功   ┌────────────┐
│ Bridge     │ ──────────► │ syncFrom   │ ──────────► │ 更新基准   │
│ Adapter    │             │ Content    │             │ 时间       │
└────────────┘             └────────────┘             └────────────┘
```

## 3. 时间模式详解

### 3.1 模式定义

```typescript
export type TimeMode = 
  | 'system'    // 系统时间
  | 'offset'    // 偏移时间
  | 'virtual'   // 虚拟时间
  | 'simulated' // 模拟时间
  | 'frozen'    // 冻结时间
```

### 3.2 各模式计算公式

| 模式 | 计算公式 | 说明 |
|------|----------|------|
| `system` | `Date.now()` | 直接使用系统时间 |
| `offset` | `Date.now() + offset` | 系统时间加固定偏移量 |
| `virtual` | `virtualBase + (realElapsed × multiplier)` | 可加速的虚拟时间 |
| `simulated` | 同 `virtual`，但基准时间从内容解析 | 跟随剧情的模拟时间 |
| `frozen` | `fixedTimestamp` | 固定不变 |

### 3.3 模式切换逻辑

```typescript
public setMode(mode: TimeMode) {
  this._mode.value = mode
  
  switch (mode) {
    case 'system':
      // 重置偏移量
      this._offset.value = 0
      break
      
    case 'simulated':
      // 尝试从聊天记录同步时间
      this.syncTimeFromChatStore()
      break
      
    case 'virtual':
      // 记录当前时刻作为基准
      this._realBaseTime.value = Date.now()
      this._virtualBaseTime.value = this._currentTime.value.getTime()
      break
  }
  
  this.updateTime()
}
```

### 3.4 虚拟/模拟时间计算

虚拟时间和模拟时间使用相同的计算逻辑：

```typescript
// 计算实际流逝的时间
const elapsed = Date.now() - this._realBaseTime.value

// 乘以时间倍率得到虚拟流逝时间
const virtualElapsed = elapsed * this._timeMultiplier.value

// 虚拟基准时间 + 虚拟流逝时间 = 当前虚拟时间
this._currentTime.value = new Date(
  this._virtualBaseTime.value + virtualElapsed
)
```

**示例**：
- 虚拟基准时间：2028-06-01 09:00（从聊天内容解析）
- 真实基准时间：2026-01-10 16:00（解析时的系统时间）
- 时间倍率：1（默认，与现实同步流逝）
- 当现实过了 2 小时后，虚拟时间变为 2028-06-01 11:00

## 4. 核心组件

### 4.1 Tick Loop（心跳循环）

为了节省性能，服务内部维护单一的 `setInterval` 循环：

```typescript
private _tickInterval: any = null
private _listeners: Array<(date: Date) => void> = []

public startTicking() {
  if (this._tickInterval) return
  
  this._tickInterval = setInterval(() => {
    this.updateTime()
  }, 1000) // 每秒更新
}

public stopTicking() {
  if (this._tickInterval) {
    clearInterval(this._tickInterval)
    this._tickInterval = null
  }
}
```

**设计考虑**：
- 使用单一定时器，而非每个组件各自 `setInterval`
- 1 秒间隔足够满足时钟显示需求
- 可通过 `stopTicking()` 完全停止（用于性能优化或调试）

### 4.2 Listener 机制

外部组件可以订阅时间更新事件：

```typescript
public addTickListener(callback: (date: Date) => void) {
  this._listeners.push(callback)
  
  // 返回取消订阅函数
  return () => {
    this._listeners = this._listeners.filter(l => l !== callback)
  }
}

private updateTime() {
  // ... 计算新时间 ...
  
  // 通知所有监听者
  this._listeners.forEach(l => l(this._currentTime.value))
}
```

### 4.3 Time Parser（时间解析器）

负责从文本内容中提取时间信息，详见 [时间解析文档](./time-parsing.md)。

## 5. TimeStore 设计

### 5.1 Store 职责

`TimeStore` 是 `TimeService` 的 Pinia 封装，提供：

1. **响应式状态**：供 Vue 组件直接绑定
2. **持久化**：自动保存用户偏好设置
3. **双向同步**：与 Service 保持状态一致

### 5.2 状态定义

```typescript
const currentTime = ref(timeService.getCurrentTime())
const mode = ref<TimeMode>(timeService.mode.value)
const is24Hour = ref(timeService.is24Hour.value)
```

### 5.3 双向同步机制

```typescript
// 从 Service 到 Store（通过 Listener）
timeService.addTickListener((date) => {
  currentTime.value = date
})

// 从 Store 到 Service（通过 Watch）
watch(mode, (newMode) => {
  if (timeService.mode.value !== newMode) {
    timeService.setMode(newMode)
  }
})

watch(is24Hour, (newVal) => {
  if (timeService.is24Hour.value !== newVal) {
    timeService.set24Hour(newVal)
  }
})
```

### 5.4 持久化配置

```typescript
export const useTimeStore = defineStore('time', () => {
  // ... store 定义 ...
}, {
  persist: {
    key: 'phone-sim-time-settings',
    paths: ['mode', 'is24Hour']
  }
})
```

**持久化字段**：
- `mode`：用户选择的时间模式
- `is24Hour`：12/24 小时制偏好

**不持久化**：
- `currentTime`：每次启动重新计算

## 6. 与其他服务的交互

### 6.1 BridgeAdapter 集成

```typescript
// 在 BridgeAdapter 中
onMessageReceived(message: ChatMessage) {
  // 通知时间服务尝试同步
  timeService.syncFromContent(message.content)
}
```

### 6.2 ChatStore 集成

```typescript
// 在 TimeService.init() 中
const chatStore = useChatStore()

watch(() => chatStore.history, () => {
  if (this._mode.value === 'simulated') {
    this.syncTimeFromChatStore()
  }
}, { deep: true })
```

## 7. 性能优化

### 7.1 已实现的优化

1. **单一定时器**：避免多个 `setInterval`
2. **条件日志**：仅在开发模式输出解析日志
3. **惰性同步**：仅在 `simulated` 模式下尝试解析时间

### 7.2 未来优化方向

1. **可变更新频率**：状态栏可见时 1 秒，不可见时降低频率
2. **requestAnimationFrame**：对于需要更精确计时的场景
3. **Web Worker**：将时间解析移至后台线程

## 8. 内部状态一览

| 状态 | 类型 | 说明 |
|------|------|------|
| `_currentTime` | `Ref<Date>` | 当前计算后的时间 |
| `_mode` | `Ref<TimeMode>` | 当前时间模式 |
| `_offset` | `Ref<number>` | 偏移量（毫秒） |
| `_virtualBaseTime` | `Ref<number>` | 虚拟时间基准（时间戳） |
| `_realBaseTime` | `Ref<number>` | 真实时间基准（时间戳） |
| `_timeMultiplier` | `Ref<number>` | 时间流逝倍率 |
| `_is24Hour` | `Ref<boolean>` | 是否使用 24 小时制 |
| `_tickInterval` | `any` | 定时器句柄 |
| `_listeners` | `Array<Function>` | 监听器列表 |
