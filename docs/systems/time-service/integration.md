# 时间服务集成指南

> 本文档介绍如何在应用中集成和使用时间服务。

## 1. 基础集成

### 1.1 在 Vue 组件中使用

**推荐方式：使用 TimeStore**

```vue
<template>
  <div class="clock">
    <span class="time">{{ formattedTime }}</span>
    <span class="date">{{ formattedDate }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()

const formattedTime = computed(() => {
  return timeStore.formatTime(timeStore.currentTime)
})

const formattedDate = computed(() => {
  return timeStore.currentTime.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})
</script>
```

### 1.2 直接使用 Service

适用于非组件代码（如其他服务、工具函数）：

```typescript
import { timeService } from '@/services/timeService'

// 获取当前时间
const now = timeService.getCurrentTime()

// 格式化
const timeStr = timeService.formatTime(now)

// 检查模式
if (timeService.mode.value === 'simulated') {
  console.log('当前使用模拟时间')
}
```

## 2. 时间订阅

### 2.1 组件内订阅

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { timeService } from '@/services/timeService'

const displayTime = ref('')
let cleanup: (() => void) | null = null

onMounted(() => {
  cleanup = timeService.addTickListener((date) => {
    displayTime.value = date.toLocaleTimeString()
  })
})

onUnmounted(() => {
  cleanup?.()
})
</script>
```

### 2.2 在 Service 中订阅

```typescript
class MyService {
  private cleanupTimeListener: (() => void) | null = null
  
  init() {
    this.cleanupTimeListener = timeService.addTickListener((date) => {
      this.checkScheduledTasks(date)
    })
  }
  
  destroy() {
    this.cleanupTimeListener?.()
  }
  
  private checkScheduledTasks(date: Date) {
    // 检查定时任务...
  }
}
```

## 3. 模拟时间集成

### 3.1 Adapter 集成

在消息接收 Adapter 中同步时间：

```typescript
import { timeService } from '@/services/timeService'

class BridgeAdapter {
  /**
   * 处理从酒馆接收的消息
   */
  onMessageReceived(message: ChatMessage) {
    // 其他处理逻辑...
    
    // 尝试从消息内容同步时间
    if (message.content) {
      timeService.syncFromContent(message.content)
    }
  }
  
  /**
   * 处理叙事内容更新
   */
  onNarrativeUpdate(narrative: string) {
    // 叙事内容可能包含时间信息
    timeService.syncFromContent(narrative)
  }
}
```

### 3.2 与 ChatStore 集成

时间服务在初始化时会自动监听 ChatStore 的变化：

```typescript
// TimeService.init() 内部实现
public init() {
  const chatStore = useChatStore()
  
  watch(() => chatStore.history, () => {
    if (this._mode.value === 'simulated') {
      this.syncTimeFromChatStore()
    }
  }, { deep: true })
}
```

### 3.3 手动同步时间

用于测试或特殊场景：

```typescript
import { timeService } from '@/services/timeService'

// 确保处于模拟模式
timeService.setMode('simulated')

// 手动同步时间
timeService.syncFromContent('现在是2028年6月5日 下午3点')

// 验证结果
console.log(timeService.getCurrentTime())
// 输出: Thu Jun 05 2028 15:00:00
```

## 4. 设置页面集成

### 4.1 时间模式切换 UI

```vue
<template>
  <div class="time-settings">
    <h3>时间设置</h3>
    
    <!-- 时间模式选择 -->
    <div class="setting-row">
      <label>时间模式</label>
      <select v-model="selectedMode">
        <option value="system">系统时间</option>
        <option value="simulated">模拟时间（跟随剧情）</option>
        <option value="frozen">冻结时间</option>
      </select>
    </div>
    
    <!-- 12/24小时制 -->
    <div class="setting-row">
      <label>使用24小时制</label>
      <input type="checkbox" v-model="use24Hour" />
    </div>
    
    <!-- 当前时间预览 -->
    <div class="preview">
      <span>当前时间：{{ formattedTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()

const selectedMode = computed({
  get: () => timeStore.mode,
  set: (val) => timeStore.setMode(val)
})

const use24Hour = computed({
  get: () => timeStore.is24Hour,
  set: (val) => timeStore.set24Hour(val)
})

const formattedTime = computed(() => {
  return timeStore.formatTime(timeStore.currentTime)
})
</script>
```

### 4.2 模式说明文案

建议在设置页面提供模式说明：

```vue
<template>
  <div class="mode-description">
    <template v-if="selectedMode === 'system'">
      <p>使用设备系统时间，与现实世界同步。</p>
    </template>
    <template v-else-if="selectedMode === 'simulated'">
      <p>自动从聊天内容中解析时间，与角色扮演剧情保持同步。</p>
      <p class="hint">提示：确保消息中包含明确的时间描述，如"现在是下午3点"。</p>
    </template>
    <template v-else-if="selectedMode === 'frozen'">
      <p>时间固定不变，适用于剧情定格或调试场景。</p>
    </template>
  </div>
</template>
```

## 5. 状态栏集成

### 5.1 StatusBar 时钟组件

```vue
<template>
  <div class="status-bar-clock" @click="toggleFormat">
    {{ displayTime }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()
const showSeconds = ref(false)

const displayTime = computed(() => {
  return timeStore.formatTime(timeStore.currentTime, {
    includeSeconds: showSeconds.value
  })
})

function toggleFormat() {
  showSeconds.value = !showSeconds.value
}
</script>

<style scoped>
.status-bar-clock {
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
</style>
```

### 5.2 时间模式指示器

在状态栏显示当前时间模式：

```vue
<template>
  <div class="time-mode-indicator" v-if="showModeIndicator">
    <span class="icon">{{ modeIcon }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()

const showModeIndicator = computed(() => {
  return timeStore.mode !== 'system'
})

const modeIcon = computed(() => {
  switch (timeStore.mode) {
    case 'simulated': return '🎭'  // 模拟时间
    case 'frozen': return '❄️'     // 冻结时间
    case 'virtual': return '⏩'    // 加速时间
    default: return ''
  }
})
</script>
```

## 6. 与其他服务集成

### 6.1 通知服务集成

使用时间服务格式化通知时间：

```typescript
import { timeService } from '@/services/timeService'

class NotificationService {
  formatNotificationTime(timestamp: number): string {
    const date = new Date(timestamp)
    const now = timeService.getCurrentTime()
    
    // 今天的通知只显示时间
    if (this.isSameDay(date, now)) {
      return timeService.formatTime(date)
    }
    
    // 其他日期显示完整日期
    return date.toLocaleDateString('zh-CN')
  }
  
  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.toDateString() === d2.toDateString()
  }
}
```

### 6.2 LLM 任务调度集成

```typescript
import { timeService } from '@/services/timeService'

class LLMTaskScheduler {
  private lastRunTime: Map<string, number> = new Map()
  
  init() {
    timeService.addTickListener((date) => {
      this.checkPendingTasks(date)
    })
  }
  
  private checkPendingTasks(currentTime: Date) {
    // 使用当前时间检查待执行的任务
    for (const task of this.pendingTasks) {
      if (this.shouldRun(task, currentTime)) {
        this.executeTask(task)
      }
    }
  }
}
```

### 6.3 社交内容时间戳

```typescript
import { timeService } from '@/services/timeService'

function formatPostTime(postTimestamp: number): string {
  const now = timeService.getCurrentTime().getTime()
  const diff = now - postTimestamp
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return new Date(postTimestamp).toLocaleDateString('zh-CN')
}
```

## 7. 最佳实践

### 7.1 组件中优先使用 Store

```typescript
// ✅ 推荐：使用 Store
import { useTimeStore } from '@/stores/timeStore'
const timeStore = useTimeStore()

// ❌ 不推荐：直接使用 Service（除非有特殊需求）
import { timeService } from '@/services/timeService'
```

**原因**：
- Store 提供更好的响应式支持
- Store 会自动持久化用户设置
- 符合 Vue/Pinia 的最佳实践

### 7.2 正确清理订阅

```typescript
// ✅ 正确：在组件卸载时清理
onUnmounted(() => {
  cleanup?.()
})

// ❌ 错误：忘记清理，导致内存泄漏
onMounted(() => {
  timeService.addTickListener((date) => {
    // 即使组件卸载，回调仍会执行
  })
})
```

### 7.3 避免高频计算

```typescript
// ✅ 使用 computed 缓存结果
const formattedTime = computed(() => {
  return timeStore.formatTime(timeStore.currentTime)
})

// ❌ 每次渲染都重新格式化
<template>
  {{ formatTime(timeStore.currentTime) }}
</template>
```

### 7.4 模式切换的用户提示

```typescript
function setTimeMode(mode: TimeMode) {
  const oldMode = timeStore.mode
  timeStore.setMode(mode)
  
  // 提供用户反馈
  if (mode === 'simulated' && oldMode !== 'simulated') {
    showToast('已切换到模拟时间，将跟随剧情内容')
  }
}
```

## 8. 调试技巧

### 8.1 开发模式日志

开发环境下，时间解析会输出详细日志：

```text
[TimeService] Parsing Message Content
  Original Content: 现在是2028年6月5日...
  Matched: Full Date Time (Numeric) 2028年6月5日 09:30
  Result: 2028/6/5 09:30:00
```

### 8.2 手动测试时间解析

```typescript
// 在浏览器控制台测试
import { timeService } from '@/services/timeService'

timeService.setMode('simulated')
timeService.syncFromContent('下午3点半')
console.log(timeService.getCurrentTime())
```

### 8.3 使用冻结模式调试

```typescript
// 冻结时间用于 UI 截图或特定场景调试
timeService.setMode('frozen')
// 时间将停止在当前值
```

## 9. 常见问题

### Q1: 为什么模拟时间没有更新？

**检查项**：
1. 确认模式是否为 `simulated`：`console.log(timeService.mode.value)`
2. 检查消息内容是否包含可识别的时间格式
3. 查看开发控制台是否有解析日志

### Q2: 时间格式不符合预期？

**解决方案**：
```typescript
// 检查 is24Hour 设置
console.log(timeService.is24Hour.value)

// 手动设置
timeService.set24Hour(true)  // 强制 24 小时制
```

### Q3: 多个组件时间不同步？

**原因**：可能有组件使用了自己的时间源

**解决方案**：统一使用 TimeStore
```typescript
// 所有组件都从 Store 获取时间
const timeStore = useTimeStore()
const time = timeStore.currentTime
```
