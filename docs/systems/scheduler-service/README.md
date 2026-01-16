# 定时任务服务 (Scheduler Service)

> **版本**: 1.0  
> **状态**: 🆕 建议开发  
> **优先级**: 🟡 中  
> **最后更新**: 2026-01-16

定时任务服务 (Scheduler Service) 是小手机模拟器的核心能力服务之一，负责管理和调度各类定时任务，包括周期性任务、Cron 表达式任务和事件触发任务。

## 文档索引

| 文档 | 说明 |
|------|------|
| [架构设计](./architecture.md) | 服务架构、调度策略、核心组件 |
| [API 参考](./api-reference.md) | 完整的 API 接口文档 |
| [集成指南](./integration.md) | 如何在应用中使用定时任务服务 |
| [使用场景](./use-cases.md) | 典型使用场景与最佳实践 |

## 核心特性

- **多种调度类型**：支持固定间隔、Cron 表达式、事件触发三种调度模式
- **应用隔离**：每个应用的任务独立管理，互不干扰
- **任务控制**：支持暂停、恢复、立即触发等操作
- **失败重试**：可配置失败重试次数和超时时间
- **状态追踪**：记录任务执行历史和状态

## 快速开始

### 基础用法

```typescript
import { schedulerService } from '@/services/schedulerService'

// 注册一个周期性任务
const taskId = schedulerService.register({
  id: 'refresh-trending',
  appId: 'weibo',
  name: '刷新热搜',
  schedule: {
    type: 'interval',
    ms: 10 * 60 * 1000  // 每 10 分钟
  },
  handler: async () => {
    await refreshTrending()
  },
  enabled: true
})

// 立即触发任务
await schedulerService.trigger(taskId)

// 暂停任务
schedulerService.pause(taskId)

// 恢复任务
schedulerService.resume(taskId)

// 注销任务
schedulerService.unregister(taskId)
```

### Cron 表达式调度

```typescript
// 每天凌晨 3 点执行清理任务
schedulerService.register({
  id: 'daily-cleanup',
  appId: 'system',
  name: '每日清理',
  schedule: {
    type: 'cron',
    expression: '0 3 * * *'  // 每天 03:00
  },
  handler: async () => {
    await cleanupExpiredContent()
  },
  enabled: true
})
```

### 事件触发调度

```typescript
// 新消息到达时检查档案
schedulerService.register({
  id: 'archive-check',
  appId: 'archives',
  name: '档案检查',
  schedule: {
    type: 'event',
    eventName: 'session:message:new'
  },
  handler: async () => {
    await checkArchiveExtraction()
  },
  enabled: true
})
```

## 调度类型概览

| 类型 | 描述 | 适用场景 |
|------|------|----------|
| `interval` | 固定时间间隔执行 | 热搜刷新、数据同步 |
| `cron` | Cron 表达式定时执行 | 每日清理、定时报告 |
| `event` | 事件触发执行 | 消息处理、数据变更响应 |

## 架构概览

```text
┌─────────────────────────────────────────────────────────────┐
│                        应用层                                │
│  ────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  微博 App   │  │  LLM Task   │  │  Archives   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │ 注册任务
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  SchedulerService (单例)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Task        │  │ Scheduler   │  │ Executor    │          │
│  │ Registry    │  │ Engine      │  │ Pool        │          │
│  │ (任务注册)   │  │ (调度引擎)   │  │ (执行池)    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ 事件订阅
┌─────────────────────────────────────────────────────────────┐
│                  EventBus Service                            │
│                    (事件总线)                                 │
└─────────────────────────────────────────────────────────────┘
```

## 典型使用场景

| 场景 | 调度类型 | 示例配置 |
|------|----------|----------|
| LLM Task 自动执行 | interval | 每 5 分钟检查待执行任务 |
| 热搜刷新 | interval | 每 10 分钟更新热搜榜 |
| 档案自动归档 | event | 新楼层事件触发检查 |
| 内容过期清理 | cron | 每天凌晨 3 点 |
| 粉丝增长结算 | interval | 每小时结算涨粉 |
| 数据备份 | cron | 每周日 02:00 |

## 相关服务

- **EventBus Service**: 提供事件订阅能力，支持事件触发调度
- **Time Service**: 提供时间服务，支持模拟时间模式
- **LLM Task Service**: 使用调度服务自动执行 LLM 任务

## 文件结构

```text
src/
├── services/
│   └── scheduler/
│       ├── schedulerService.ts    # 调度服务核心实现
│       ├── cronParser.ts          # Cron 表达式解析
│       └── types.ts               # 类型定义
└── stores/
    └── schedulerStore.ts          # Pinia Store 封装（可选）
```

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 2026-01-16 | 初始设计文档 |
