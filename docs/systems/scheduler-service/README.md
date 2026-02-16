# 定时任务服务 (Scheduler Service)

> **状态**: ✅ v1.0 已实现  
> **版本**: v1.1  
> **优先级**: 🟡 中（基础能力服务）  
> **最后更新**: 2026-02-07

## 1. 概述

Scheduler Service 是系统级任务调度中心，负责统一管理周期任务、Cron 任务和事件触发任务，为各 App/服务提供可观测、可控制、可复用的执行能力。

它的定位不是替代业务逻辑，而是把「何时执行」与「执行什么」解耦：

- 业务服务专注 `handler`
- 调度服务专注执行时机、并发控制、重试、超时和状态追踪

## 2. 目标与边界

### 2.1 设计目标

| 维度 | 目标 |
| ---- | ---- |
| 跨服务复用 | 微博、LLM Task、Archive、Feed 等统一使用一套调度 API |
| 解耦 | 业务模块不再自行维护 `setInterval` / `setTimeout` |
| 可控性 | 支持暂停、恢复、立即触发、按 App 查询 |
| 可靠性 | 支持超时、失败重试、执行状态记录 |
| 可观测性 | 提供事件广播与日志，便于排查任务行为 |

### 2.2 服务边界

- **Scheduler Service 负责**
  - 任务注册与生命周期管理
  - 触发时机计算（interval / cron / event）
  - 执行包装（超时、重试、状态更新）
  - 运行时查询（任务列表、任务状态、执行结果）
- **Scheduler Service 不负责**
  - 业务数据处理细节（由各业务服务实现）
  - 复杂工作流编排（交由 LLM Task / Prompt Chain 等）
  - 分布式任务一致性（当前为本地单进程场景）

## 3. 核心能力

- 三种调度类型：`interval`、`cron`、`event`
- 统一控制接口：`pause` / `resume` / `trigger` / `unregister`
- 执行保护：`timeout` + `retryOnFail`
- 任务隔离：按 `appId` 维度管理，支持批量查询
- 状态追踪：`lastRunAt`、`lastResult`、`nextRunAt`
- 事件联动：通过 Event Bus 对外广播任务执行结果

## 4. 核心 API 概览

```typescript
interface SchedulerService {
  register(task: ScheduledTask): string;
  unregister(taskId: string): boolean;

  pause(taskId: string): boolean;
  resume(taskId: string): boolean;
  trigger(taskId: string): Promise<ExecutionResult | undefined>;

  getTask(taskId: string): ScheduledTask | undefined;
  getAllTasks(): ScheduledTask[];
  getTasksByApp(appId: string): ScheduledTask[];

  start(): void;
  stop(): void;
}

interface ScheduledTask {
  id: string;
  appId: string;
  name: string;
  schedule:
    | { type: 'interval'; ms: number }
    | { type: 'cron'; expression: string }
    | { type: 'event'; eventName: string };
  handler: () => Promise<void>;
  retryOnFail?: number;
  timeout?: number;
  enabled: boolean;
  lastRunAt?: number;
  lastResult?: 'success' | 'failed' | 'timeout';
  nextRunAt?: number;
}
```

## 5. 调度与执行语义

### 5.1 interval

- 适合固定频率任务（热搜刷新、LLM 自动检查）
- 基于统一心跳或定时器池，不建议每任务独立粗放轮询

### 5.2 cron

- 适合规则性计划任务（每日清理、每周备份）
- 需统一使用 Time Service 时间源，支持模拟时间

### 5.3 event

- 适合事件驱动任务（`session:message:new` 触发归档检查）
- 依赖 Event Bus 订阅，建议支持可选防抖/节流

### 5.4 执行策略（建议默认值）

- `timeout`: 默认 `30_000ms`
- `retryOnFail`: 默认 `0`
- 失败重试建议指数退避（如 1s / 2s / 4s，上限 30s）
- 同一任务执行中再次触发时，默认跳过并记录（避免重入）

## 6. 与现有服务的集成

| 依赖服务 | 作用 | 集成点 |
| ---- | ---- | ---- |
| Event Bus Service | 事件触发调度、执行结果广播 | 订阅 `schedule.type=event`，发出 `scheduler:*` 事件 |
| Time Service | 统一时间源 | Cron/interval 的当前时间与推进策略 |
| Logger Service | 可观测性 | 记录注册、触发、失败、重试、耗时 |
| Notification Service | 用户可见反馈（可选） | 关键任务失败时提醒 |
| LLM Task Service | 典型调用方 | 周期检查并触发自动执行任务 |

## 7. 推荐目录结构

```text
src/services/scheduler/
├── schedulerService.ts      # 服务入口（单例）
├── taskRegistry.ts          # 任务存储与索引
├── schedulerEngine.ts       # 调度核心（interval/cron/event）
├── executor.ts              # 执行器（timeout/retry/结果）
├── cron.ts                  # cron 解析与 nextRun 计算
├── events.ts                # 事件常量与 payload 类型
├── types.ts                 # 调度类型定义
└── index.ts                 # 模块导出
```

## 8. 实施路线图

| Phase | 内容 | 预估 |
| ---- | ---- | ---- |
| Phase 1 | 基础骨架：类型、注册表、生命周期（start/stop） | 1-2d |
| Phase 2 | interval + event 调度、执行器、超时/重试 | 1-2d |
| Phase 3 | cron 调度与 Time Service 集成 | 1d |
| Phase 4 | 事件广播、日志、统计接口、单测补齐 | 1d |

> 与架构总览保持一致：Scheduler Service 为中优先级，建议在 Search/Archive 并行期落地。

## 9. 验收标准

- 能注册并稳定运行三类调度任务
- 支持任务暂停/恢复/立即触发
- 失败重试与超时控制行为可验证
- 任务状态字段可查询且更新正确
- 关键路径具备单元测试（调度计算、重试、超时、事件触发）

## 10. 文档导航

| 文档 | 说明 |
| ---- | ---- |
| [架构设计](./architecture.md) | 组件划分、数据流、调度策略 |
| [API 参考](./api-reference.md) | 完整接口定义与参数说明 |
| [集成指南](./integration.md) | 与 EventBus/Time/LLM Task 的接入示例 |
| [使用场景](./use-cases.md) | 热搜刷新、自动归档、定时清理等案例 |

## 11. 相关文档

- [社交内容平台系统服务架构](../architecture/Service-for-social-media-platform.md)
- [事件总线服务](../eventBus-service/README.md)
- [时间服务](../time-service/README.md)
- [LLM 任务服务](../llm-task-service/README.md)
- [服务开发指南](../service-development-guide.md)

## 12. 版本历史

| 版本 | 日期 | 变更 |
| ---- | ---- | ---- |
| v1.0 | 2026-01-16 | 初始文档 |
| v1.1 | 2026-02-07 | 按系统服务架构文档重构：明确边界、实现路线、验收标准与集成依赖 |
