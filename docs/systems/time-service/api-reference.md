# 时间服务 API 参考

> 本文档提供时间服务的完整 API 接口说明。

## 1. TimeService API

`TimeService` 是核心服务类，采用单例模式。

### 1.1 获取实例

```typescript
import { timeService } from '@/services/timeService'

// timeService 已经是实例，可直接使用
const now = timeService.getCurrentTime()
```

### 1.2 初始化

#### `init()`

初始化服务，设置与 ChatStore 的监听关系。

```typescript
timeService.init()
```

**说明**：

- 在应用启动时调用一次
- 设置对 ChatStore 的 watch，以便在 `simulated` 模式下自动同步时间
- 如果不调用，服务仍可工作，但 `simulated` 模式下不会自动从聊天历史同步

### 1.3 时间获取

#### `getCurrentTime(): Date`

获取当前计算后的系统时间。

```typescript
const now: Date = timeService.getCurrentTime()
console.log(now.toLocaleString())
```

**返回值**：

- `Date` - 根据当前模式计算的时间对象

### 1.4 模式管理

#### `mode: Ref<TimeMode>`

当前时间模式的响应式引用。

```typescript
import type { TimeMode } from '@/services/timeService'

console.log(timeService.mode.value) // 'system' | 'offset' | 'virtual' | 'simulated' | 'frozen'
```

#### `setMode(mode: TimeMode)`

设置时间模式。

```typescript
timeService.setMode('simulated')
```

**参数**：

| 参数 | 类型 | 说明 |
| ------ | ------ | ------ |
| `mode` | `TimeMode` | 目标时间模式 |

**TimeMode 取值**：

| 值 | 说明 |
| ----- | ------ |
| `'system'` | 使用系统时间 |
| `'offset'` | 系统时间 + 偏移量 |
| `'virtual'` | 可加速的虚拟时间 |
| `'simulated'` | 从内容解析的模拟时间 |
| `'frozen'` | 固定时间 |

### 1.5 格式化

#### `is24Hour: Ref<boolean>`

是否使用 24 小时制的响应式引用。

```typescript
console.log(timeService.is24Hour.value) // true 或 false
```

#### `set24Hour(value: boolean)`

设置 1224 小时制。

```typescript
timeService.set24Hour(true)  // 使用 24 小时制
timeService.set24Hour(false) // 使用 12 小时制
```

#### `formatTime(date: Date, options?: FormatOptions): string`

格式化时间为字符串。

```typescript
const now = timeService.getCurrentTime()

// 基本用法
const time = timeService.formatTime(now)
// 24h: "14:30"
// 12h: "2:30 PM"

// 包含秒
const timeWithSeconds = timeService.formatTime(now, { includeSeconds: true })
// 24h: "14:30:45"
// 12h: "2:30:45 PM"
```

**参数**：

| 参数 | 类型 | 说明 |
| ------ | ------ | ------ |
| `date` | `Date` | 要格式化的日期对象 |
| `options` | `FormatOptions` | 可选配置 |

**FormatOptions**：

| 字段 | 类型 | 默认值 | 说明 |
| ------ | ------ | -------- | ------ |
| `includeSeconds` | `boolean` | `false` | 是否包含秒 |

**返回值**：

- `string` - 格式化后的时间字符串

### 1.6 订阅机制

#### `addTickListener(callback: (date: Date) => void): () => void`

订阅时间更新事件。

```typescript
// 订阅
const cleanup = timeService.addTickListener((date) => {
  console.log('当前时间:', date)
})

// 取消订阅
cleanup()
```

**参数**：

| 参数 | 类型 | 说明 |
| ------ | ------ | ------ |
| `callback` | `(date: Date) => void` | 时间更新时的回调函数 |

**返回值**：

- `() => void` - 取消订阅的函数

**调用频率**：每秒调用一次（1000ms 间隔）

### 1.7 时间同步

#### `syncFromContent(content: string)`

从文本内容中解析并同步时间。

```typescript
// 从消息内容同步时间
timeService.syncFromContent("现在是2028年6月1日 上午10点")

// 仅在 simulated 模式下生效
timeService.setMode('simulated')
timeService.syncFromContent("下午3点半")
```

**参数**：

| 参数 | 类型 | 说明 |
| ------ | ------ | ------ |
| `content` | `string` | 包含时间信息的文本 |

**行为**：

- 仅在 `mode === 'simulated'` 时生效
- 成功解析后会更新虚拟基准时间
- 解析失败时静默忽略（不影响当前时间）

### 1.8 心跳控制

#### `startTicking()`

启动心跳循环。

```typescript
timeService.startTicking()
```

**说明**：

- 服务实例化时自动调用
- 重复调用是安全的（幂等）

#### `stopTicking()`

停止心跳循环。

```typescript
timeService.stopTicking()
```

**说明**：

- 停止后时间将不再自动更新
- 可用于性能优化或调试

---

## 2. TimeStore API

`TimeStore` 是 Pinia Store，提供响应式状态供 Vue 组件使用。

### 2.1 获取 Store

```typescript
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()
```

### 2.2 状态

#### `currentTime: Ref<Date>`

当前时间（响应式）。

```vue
<template>
  <div>{{ timeStore.currentTime.toLocaleTimeString() }}</div>
</template>

<script setup>
import { useTimeStore } from '@/stores/timeStore'
const timeStore = useTimeStore()
</script>
```

#### `mode: Ref<TimeMode>`

当前时间模式（响应式、持久化）。

```typescript
console.log(timeStore.mode) // 'system' | 'simulated' | ...
```

#### `is24Hour: Ref<boolean>`

是否使用 24 小时制（响应式、持久化）。

```typescript
console.log(timeStore.is24Hour) // true 或 false
```

### 2.3 Actions

#### `setMode(newMode: TimeMode)`

设置时间模式。

```typescript
timeStore.setMode('simulated')
```

#### `set24Hour(value: boolean)`

设置 12/24 小时制。

```typescript
timeStore.set24Hour(true)
```

#### `formatTime(date: Date, options?: FormatOptions): string`

格式化时间（委托给 TimeService）。

```typescript
const formatted = timeStore.formatTime(timeStore.currentTime)
```

### 2.4 持久化

Store 自动持久化以下字段：

| 字段 | 存储键 | 说明 |
| ------ | -------- | ------ |
| `mode` | `phone-sim-time-settings.mode` | 时间模式 |
| `is24Hour` | `phone-sim-time-settings.is24Hour` | 小时制偏好 |

---

## 3. 类型定义

### 3.1 TimeMode

```typescript
export type TimeMode = 
  | 'system'    // 系统时间
  | 'offset'    // 偏移时间
  | 'virtual'   // 虚拟时间
  | 'simulated' // 模拟时间
  | 'frozen'    // 冻结时间
```

### 3.2 Alarm（闹钟，规划中）

```typescript
export interface Alarm {
  id: string
  enabled: boolean
  time: { hour: number; minute: number }
  repeat: number[]  // 0-6 代表周日到周六
  label: string
  soundId: string
  vibrate: boolean
  snoozeCount: number
  nextTriggerTime: number
}
```

### 3.3 FormatOptions

```typescript
interface FormatOptions {
  includeSeconds?: boolean
}
```

---

## 4. 使用示例

### 4.1 状态栏时钟

```vue
<template>
  <div class="status-bar-clock">
    {{ formattedTime }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()

const formattedTime = computed(() => {
  return timeStore.formatTime(timeStore.currentTime)
})
</script>
```

### 4.2 时间设置页面

```vue
<template>
  <div class="time-settings">
    <div class="setting-item">
      <label>时间模式</label>
      <select v-model="mode">
        <option value="system">系统时间</option>
        <option value="simulated">模拟时间</option>
        <option value="frozen">冻结时间</option>
      </select>
    </div>
    
    <div class="setting-item">
      <label>24小时制</label>
      <input type="checkbox" v-model="is24Hour" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()

const mode = computed({
  get: () => timeStore.mode,
  set: (val) => timeStore.setMode(val)
})

const is24Hour = computed({
  get: () => timeStore.is24Hour,
  set: (val) => timeStore.set24Hour(val)
})
</script>
```

### 4.3 在 Adapter 中同步时间

```typescript
import { timeService } from '@/services/timeService'

class BridgeAdapter {
  onMessageReceived(message: ChatMessage) {
    // 处理消息...
    
    // 尝试从消息内容同步时间
    if (message.content) {
      timeService.syncFromContent(message.content)
    }
  }
}
```

### 4.4 自定义时间监听

```typescript
import { timeService } from '@/services/timeService'

// 在组件挂载时订阅
onMounted(() => {
  cleanup = timeService.addTickListener((date) => {
    // 每秒执行
    checkAlarms(date)
    updateCountdown(date)
  })
})

// 在组件卸载时取消订阅
onUnmounted(() => {
  cleanup?.()
})
```
