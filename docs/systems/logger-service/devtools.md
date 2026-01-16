# Logger Service 开发者工具集成

> **版本**: 1.0  
> **最后更新**: 2026-01-16

## 1. 概述

日志服务提供开发者工具集成，在设置 App 中提供日志查看器界面，帮助开发者实时监控和调试应用。

## 2. 日志查看器设计

### 2.1 功能特性

- **实时日志流**: 实时显示新产生的日志
- **历史查询**: 搜索和过滤历史日志
- **级别过滤**: 按 debug/info/warn/error 过滤
- **命名空间过滤**: 按模块筛选日志
- **搜索功能**: 全文搜索日志内容
- **导出功能**: 导出日志为 JSON/CSV/TXT
- **统计面板**: 显示日志统计信息

### 2.2 界面布局

```text
┌─────────────────────────────────────────────────────────────────┐
│  日志查看器                                          [导出] [清空] │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 搜索日志...]                                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │ All     │ │ Debug   │ │ Info    │ │ Warn    │ │ Error     │ │
│  │  (156)  │ │  (42)   │ │  (80)   │ │  (24)   │ │   (10)    │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  命名空间: [全部 ▼]  [weibo:* [social:*] [service:*]           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  14:30:25 [ERROR] [api:generate]                                │
│  Request failed: Network error                                  │
│  ▼ Stack trace                                                  │
│                                                                 │
│  14:30:24 [WARN] [social:engine]                                │
│  Cache miss, regenerating content                               │
│                                                                 │
│  14:30:23 [INFO] [weibo:store]                                  │
│  Posts loaded { count: 10 }                                     │
│                                                                 │
│  14:30:22 [DEBUG] [weibo:store]                                 │
│  Loading posts for topic { topicId: "hot_001" }                 │
│                                                                 │
│  ... 更多日志 ...                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3. LogViewer 接口

### 3.1 接口定义

```typescript
interface LogViewer {
  /**
   * 订阅实时日志流
   * @param filter 可选的过滤条件
   * @returns 取消订阅函数
   */
  subscribe(filter?: LogFilter): () => void

  /**
   * 获取日志条目回调
   */
  onEntry(callback: (entry: LogEntry) => void): () => void

  /**
   * 查询历史日志
   */
  query(options: LogQueryOptions): Promise<LogEntry[]>

  /**
   * 导出日志
   * @param format 导出格式
   * @returns Blob 对象
   */
  export(format: 'json' | 'csv' | 'txt'): Promise<Blob>

  /**
   * 清理所有日志
   */
  clear(): Promise<void>

  /**
   * 获取统计信息
   */
  getStats(): LogStats
}
```

### 3.2 查询选项

```typescript
interface LogQueryOptions {
  /** 时间范围 */
  timeRange?: {
    start: number
    end: number
  }

  /** 日志级别过滤 */
  levels?: LogLevel[]

  /** 命名空间过滤 */
  namespaces?: string[]

  /** 消息内容搜索 */
  search?: string

  /** 分页 */
  offset?: number
  limit?: number

  /** 排序方向 */
  order?: 'asc' | 'desc'
}
```

### 3.3 统计信息

```typescript
interface LogStats {
  /** 总条数 */
  total: number

  /** 按级别统计 */
  byLevel: Record<LogLevel, number>

  /** 按命名空间统计（前10） */
  byNamespace: Array<{ namespace: string; count: number }>

  /** 最早日志时间 */
  earliest: number

  /** 最新日志时间 */
  latest: number
}
```

## 4. Vue 组件实现

### 4.1 LogViewerPanel.vue

```vue
<template>
  <div class="log-viewer">
    <!-- 工具栏 -->
    <div class="toolbar">
      <input 
        v-model="searchQuery"
        placeholder="搜索日志..."
        class="search-input"
      />
      <button @click="exportLogs">导出</button>
      <button @click="clearLogs">清空</button>
    </div>

    <!-- 级别过滤 -->
    <div class="level-filters">
      <button 
        v-for="level in levels" 
        :key="level"
        :class="{ active: selectedLevels.includes(level) }"
        @click="toggleLevel(level)"
      >
        {{ level }} ({{ stats.byLevel[level] }})
      </button>
    </div>

    <!-- 命名空间过滤 -->
    <div class="namespace-filter">
      <select v-model="selectedNamespace">
        <option value="">全部命名空间</option>
        <option 
          v-for="ns in topNamespaces" 
          :key="ns.namespace"
          :value="ns.namespace"
        >
          {{ ns.namespace }} ({{ ns.count }})
        </option>
      </select>
    </div>

    <!-- 日志列表 -->
    <div class="log-list" ref="logListRef">
      <div 
        v-for="entry in filteredEntries" 
        :key="entry.id"
        :class="['log-entry', `level-${entry.level}`]"
      >
        <span class="time">{{ formatTime(entry.timestamp) }}</span>
        <span class="level">{{ entry.level.toUpperCase() }}</span>
        <span class="namespace">[{{ entry.namespace }}]</span>
        <span class="message">{{ entry.message }}</span>
        <div v-if="entry.args.length" class="args">
          {{ formatArgs(entry.args) }}
        </div>
        <div v-if="entry.stack" class="stack">
          <details>
            <summary>Stack trace</summary>
            <pre>{{ entry.stack }}</pre>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { loggerService } from '@/services/logger'
import type { LogEntry, LogLevel, LogStats } from '@/types/logger'

const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']

// 状态
const entries = ref<LogEntry[]>([])
const stats = ref<LogStats>({ 
  total: 0, 
  byLevel: { debug: 0, info: 0, warn: 0, error: 0, silent: 0 },
  byNamespace: [],
  earliest: 0,
  latest: 0,
})
const searchQuery = ref('')
const selectedLevels = ref<LogLevel[]>([...levels])
const selectedNamespace = ref('')

// 计算属性
const topNamespaces = computed(() => stats.value.byNamespace.slice(0, 10))

const filteredEntries = computed(() => {
  return entries.value.filter(entry => {
    // 级别过滤
    if (!selectedLevels.value.includes(entry.level)) return false
    
    // 命名空间过滤
    if (selectedNamespace.value && !entry.namespace.startsWith(selectedNamespace.value)) {
      return false
    }
    
    // 搜索过滤
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      return (
        entry.message.toLowerCase().includes(query) ||
        entry.namespace.toLowerCase().includes(query)
      )
    }
    
    return true
  })
})

// 方法
function toggleLevel(level: LogLevel) {
  const index = selectedLevels.value.indexOf(level)
  if (index >= 0) {
    selectedLevels.value.splice(index, 1)
  } else {
    selectedLevels.value.push(level)
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

function formatArgs(args: any[]): string {
  return args.map(arg => JSON.stringify(arg, null, 2)).join(' ')
}

async function exportLogs() {
  const viewer = loggerService.getViewer()
  const blob = await viewer.export('json')
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function clearLogs() {
  if (confirm('确定要清空所有日志吗？')) {
    const viewer = loggerService.getViewer()
    await viewer.clear()
    entries.value = []
    updateStats()
  }
}

function updateStats() {
  const viewer = loggerService.getViewer()
  stats.value = viewer.getStats()
}

// 生命周期
let unsubscribe: (() => void) | null = null

onMounted(() => {
  const viewer = loggerService.getViewer()
  
  // 加载历史日志
  viewer.query({ limit: 500, order: 'desc' }).then(result => {
    entries.value = result
    updateStats()
  })
  
  // 订阅新日志
  unsubscribe = viewer.onEntry((entry) => {
    entries.value.unshift(entry)
    // 限制显示数量
    if (entries.value.length > 1000) {
      entries.value.pop()
    }
    updateStats()
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.search-input {
  flex: 1;
  padding: 4px 8px;
}

.level-filters {
  display: flex;
  gap: 4px;
  padding: 8px;
}

.level-filters button {
  padding: 4px 12px;
  border-radius: 4px;
}

.level-filters button.active {
  background: var(--primary-color);
  color: white;
}

.log-list {
  flex: 1;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
}

.log-entry {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color-light);
}

.log-entry.level-debug { background: #f5f5f5; }
.log-entry.level-info { background: #e3f2fd; }
.log-entry.level-warn { background: #fff3e0; }
.log-entry.level-error { background: #ffebee; }

.time { color: #666; margin-right: 8px; }
.level { font-weight: bold; margin-right: 8px; }
.namespace { color: #666; margin-right: 8px; }
.message { color: #333; }
.args { color: #666; margin-top: 4px; white-space: pre-wrap; }
.stack { margin-top: 4px; }
.stack pre { font-size: 11px; color: #c00; }
</style>
```

## 5. 与设置 App 集成

### 5.1 注册设置项

```typescript
// src/apps/settings/logger-settings.ts
import { settingsService } from '@/services/settings'

settingsService.registerSection({
  id: 'developer.logger',
  title: '日志设置',
  icon: 'fas fa-terminal',
  component: () => import('./LoggerSettingsPanel.vue'),
  order: 100,
  category: 'developer',
})
```

### 5.2 设置面板

```vue
<!-- LoggerSettingsPanel.vue -->
<template>
  <div class="logger-settings">
    <h3>日志配置</h3>
    
    <!-- 日志级别 -->
    <div class="setting-item">
      <label>日志级别</label>
      <select v-model="logLevel" @change="updateLevel">
        <option value="debug">Debug (全部)</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
        <option value="silent">Silent (关闭)</option>
      </select>
    </div>
    
    <!-- 持久化存储 -->
    <div class="setting-item">
      <label>持久化存储</label>
      <ToggleButton v-model="enablePersistence" @change="updatePersistence" />
    </div>
    
    <!-- 保留天数 -->
    <div class="setting-item" v-if="enablePersistence">
      <label>日志保留天数</label>
      <input type="number" v-model="retentionDays" min="1" max="30" />
    </div>
    
    <!-- 日志查看器入口 -->
    <div class="setting-item">
      <button @click="openLogViewer" class="primary">
        打开日志查看器
      </button>
    </div>
    
    <!-- 导出/清理 -->
    <div class="setting-item actions">
      <button @click="exportLogs">导出日志</button>
      <button @click="clearLogs" class="danger">清空日志</button>
    </div>
  </div>
</template>
```

## 6. 控制台增强

### 6.1 开发者快捷命令

在控制台中提供快捷命令：

```typescript
// 挂载到 window 供调试使用
if (import.meta.env.DEV) {
  (window as any).__logger = {
    // 设置日志级别
    setLevel: (level: LogLevel) => loggerService.setLevel(level),
    
    // 设置过滤器
    filter: (namespaces: string[]) => loggerService.setFilter({ namespaces }),
    
    // 清除过滤器
    clearFilter: () => loggerService.setFilter({}),
    
    // 查看统计
    stats: () => loggerService.getViewer().getStats(),
    
    // 导出日志
    export: async () => {
      const blob = await loggerService.getViewer().export('json')
      const url = URL.createObjectURL(blob)
      console.log('Download:', url)
    },
  }
  
  console.log('Logger debug commands available: window.__logger')
}
```

### 6.2 使用方式

```javascript
// 在浏览器控制台中
__logger.setLevel('debug')           // 显示所有日志
__logger.filter(['weibo:*'])         // 只显示微博日志
__logger.clearFilter()               // 清除过滤
__logger.stats()                     // 查看统计
await __logger.export()              // 导出日志
```

## 7. 最佳实践

### 7.1 开发环境配置

```typescript
// src/services/logger/init.ts
import { loggerService } from './loggerService'
import { ConsoleTransport, MemoryTransport } from './transports'

export function initLogger() {
  // 始终添加控制台输出
  loggerService.addTransport(new ConsoleTransport({ colorize: true }))
  
  // 开发环境添加内存存储（用于日志查看器）
  if (import.meta.env.DEV) {
    loggerService.addTransport(new MemoryTransport({ maxSize: 1000 }))
    loggerService.setLevel('debug')
  } else {
    loggerService.setLevel('warn')
  }
}
```

### 7.2 按需启高级功能

```typescript
// 用户开启开发者模式时
function enableDeveloperMode() {
  // 添加内存存储
  loggerService.addTransport(new MemoryTransport({ maxSize: 500 }))
  
  // 添加持久化存储
  loggerService.addTransport(new IndexedDBTransport({
    minLevel: 'error',
    retentionDays: 3,
  }))
  
  // 调低日志级别
  loggerService.setLevel('debug')
}

function disableDeveloperMode() {
  loggerService.removeTransport('memory')
  loggerService.removeTransport('indexeddb')
  loggerService.setLevel('warn')
}
```
