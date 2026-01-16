# 时间服务 (Time Service)

> **版本**: 1.0  
> **状态**: ✅ 已实现  
> **最后更新**: 2026-01-10  

时间服务 (Time Service) 是小手机模拟器的核心基础服务之一，负责管理系统时间源、提供全局时间同步脉冲，以及支持从角色扮演内容中自动解析时间。

## 文档索引

| 文档 | 说明 |
|------|------|
| [架构设计](./architecture.md) | 服务架构、时间模式、核心组件 |
| [API 参考](./api-reference.md) | 完整的 API 接口文档 |
| [时间解析](./time-parsing.md) | 模拟时间解析规则与支持格式 |
| [集成指南](./integration.md) | 如何在应用中使用时间服务 |

## 核心特性

- **多时间源支持**：支持系统时间、偏移时间、虚拟时间、模拟时间、冻结时间五种模式
- **全局时钟脉冲**：提供统一的秒级事件广播，供 UI 组件订阅
- **模拟时间同步**：自动从聊天消息中提取时间信息，与角色扮演剧情保持同步
- **格式化服务**：提供统一的日期时间格式化接口，支持 12/24 小时制切换
- **响应式状态**：通过 Pinia Store 提供响应式时间状态

## 快速开始

### 基础用法

```typescript
import { timeService } from '@/services/timeService'
import { useTimeStore } from '@/stores/timeStore'

// 方式一：直接使用 Service
const now = timeService.getCurrentTime()
const formatted = timeService.formatTime(now)

// 方式二：在组件中使用 Store（推荐）
const timeStore = useTimeStore()
console.log(timeStore.currentTime) // 响应式时间
console.log(timeStore.formatTime(timeStore.currentTime))
```

### 订阅时间更新

```typescript
// 订阅时钟脉冲
const cleanup = timeService.addTickListener((date) => {
  console.log('时间更新:', date)
})

// 取消订阅
cleanup()
```

### 切换时间模式

```typescript
import { useTimeStore } from '@/stores/timeStore'

const timeStore = useTimeStore()

// 切换到模拟时间模式（跟随 RP 剧情）
timeStore.setMode('simulated')

// 切换回系统时间
timeStore.setMode('system')
```

## 时间模式概览

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| `system` | 跟随设备系统时间 | 默认模式，一般使用 |
| `simulated` | 从聊天内容自动解析时间 | 跟随 RP 剧情时间 |
| `offset` | 系统时间 + 固定偏移量 | 模拟时区差异 |
| `virtual` | 可加速的虚拟时间 | 需要时间加速的场景 |
| `frozen` | 固定在某一时刻 | 剧情定格或调试 |

## 架构概览

```text
┌─────────────────────────────────────────────────────────────┐
│                        UI 层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  状态栏时钟  │  │  时钟 App   │  │  其他组件   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │ 订阅
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  TimeStore (Pinia)                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ currentTime | mode | is24Hour | formatTime()        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │ 双向同步
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  TimeService (单例)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Tick Loop   │  │ Time Parser │  │ Mode Manager │          │
│  │  (心跳循环)  │  │  (时间解析)  │  │  (模式管理)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ syncFromContent
┌─────────────────────────────────────────────────────────────┐
│                  BridgeAdapter                              │
│                 (酒馆消息接入)                               │
└─────────────────────────────────────────────────────────────┘
```

## 相关服务

- **BridgeAdapter**: 接收酒馆消息，触发时间同步
- **ChatStore**: 存储聊天历史，提供消息内容
- **NotificationService**: 使用时间服务显示通知时间

## 文件结构

```text
src/
├── services/
│   └── timeService.ts      # 时间服务核心实现
└── stores/
    └── timeStore.ts         # Pinia Store 封装
```

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 2026-01-10 | 初始版本，完整文档 |
