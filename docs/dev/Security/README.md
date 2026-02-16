# 安全与数据隔离模块

> 小手机的安全机制设计与实现，包括数据隔离、写入队列、多设备同步

## 概述

本模块解决以下核心问题：

1. **数据隔离** - 不同来源的 App 数据互不干扰
2. **写入保护** - 防止并发写入导致的数据不一致
3. **多设备同步** - 支持多设备使用，检测并处理数据冲突

## 文档目录

| 文档 | 说明 |
| ------ | ------ |
| [data-isolation.md](./data-isolation.md) | 数据隔离与 AppRuntime 设计 |
| [write-queue.md](./write-queue.md) | 写入队列机制设计 |
| [multi-device-sync.md](./multi-device-sync.md) | 多设备同步与冲突检测 |

## 实现状态

### ✅ 已实现

#### 前端服务

| 模块 | 路径 | 说明 |
| ------ | ------ | ------ |
| WriteQueue | `src/services/database/writeQueue.ts` | 统一写入队列 |
| AppRuntime | `src/services/appRuntime/` | 应用运行时与隔离存储 |
| DeviceSync | `src/services/sync/deviceSync.ts` | 设备心跳管理 |
| ChangeTracker | `src/services/sync/changeTracker.ts` | 变更追踪 |

#### 后端服务

| 模块 | 路径 | 说明 |
| ------ | ------ | ------ |
| DeviceManager | `server/src/services/deviceManager.ts` | 多设备心跳管理 |
| ConflictDetector | `server/src/services/conflictDetector.ts` | 数据级冲突检测 |
| SessionWriteQueue | `server/src/services/sessionWriteQueue.ts` | 按 session 隔离的写入队列 |

#### UI 组件

| 组件 | 路径 | 说明 |
| ------ | ------ | ------ |
| WriteQueueIndicator | `src/components/common/WriteQueueIndicator.vue` | 写入状态指示器 |
| EditingBanner | `src/components/common/EditingBanner.vue` | 实时编辑提示 |
| MultiDeviceIndicator | `src/components/sync/MultiDeviceIndicator.vue` | 多设备在线指示 |
| ConflictDialog | `src/components/sync/ConflictDialog.vue` | 冲突解决对话框 |
| AppSourceBadge | `src/components/apps/AppSourceBadge.vue` | 应用来源标识 |
| InstallWarningDialog | `src/components/apps/InstallWarningDialog.vue` | 安装警告对话框 |
| WriteQueueDebug | `src/components/dev/WriteQueueDebug.vue` | 开发调试面板 |

### 🔲 待实现

- [ ] 服务端 API 路由集成
- [ ] 完整的同步管理器（SyncManager）
- [ ] 强制覆盖写入支持
- [ ] 冲突解决策略配置

## 快速开始

### 1. 使用写入队列

```typescript
import { writeQueue } from '@/services/database/writeQueue'

// 提交写入操作
await writeQueue.enqueue('app', 'my-app', async () => {
  await db.contacts.put(contact)
})

// 批量写入
await writeQueue.enqueueBatch('app', 'my-app', [
  async () => await db.contacts.put(contact1),
  async () => await db.contacts.put(contact2),
])

// 订阅状态
const unsubscribe = writeQueue.subscribe((state) => {
  console.log('Writing:', state.isWriting)
  console.log('Queue length:', state.queueLength)
})
```

### 2. 使用 AppRuntime

```typescript
import { 
  createBuiltinAppRuntime, 
  provideAppRuntime,
  useAppStorage 
} from '@/services/appRuntime'

// 创建运行时（在 App 容器中）
const runtime = createBuiltinAppRuntime('notes', '备忘录')
provideAppRuntime(runtime)

// 在子组件中使用存储
const storage = useAppStorage()
await storage.set('my-key', { data: 'value' })
const data = await storage.get<MyData>('my-key')
```

### 3. 使用多设备同步

```typescript
import { deviceSyncManager } from '@/services/sync'

// 配置并启动心跳
deviceSyncManager.configure('http://localhost:3001', sessionId)
deviceSyncManager.start()

// 订阅状态
const unsubscribe = deviceSyncManager.subscribe((status) => {
  if (status && !status.isOnlyDevice) {
    console.log('其他设备:', status.otherDevices)
  }
})

// 停止心跳
deviceSyncManager.stop()
```

### 4. 使用 UI 组件

```vue
<template>
  <!-- 写入状态指示器 -->
  <WriteQueueIndicator />

  <!-- 多设备指示器 -->
  <MultiDeviceIndicator @showDevices="onShowDevices" />

  <!-- 应用来源标识 -->
  <AppSourceBadge :source="app.sourceInfo" />

  <!-- 冲突对话框 -->
  <ConflictDialog 
    :conflicts="conflicts" 
    @resolve="onResolve" 
  />
</template>

<script setup>
import { WriteQueueIndicator } from '@/components/common'
import { MultiDeviceIndicator, ConflictDialog } from '@/components/sync'
import { AppSourceBadge } from '@/components/apps'
</script>
```

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                          前端 (Vue)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   App A     │    │   App B     │    │  云同步     │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   WriteQueue                             │   │
│  │  • 优先级排序 (system > app > sync)                      │   │
│  │  • 串行执行                                              │   │
│  │  • 状态订阅                                              │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    IndexedDB                             │   │
│  │  • appData 表 (按 namespace 隔离)                        │   │
│  │  • 其他业务表                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (心跳 + 同步)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         后端 (Node.js)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Device      │    │ Conflict    │    │ Session     │         │
│  │ Manager     │    │ Detector    │    │ WriteQueue  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                  │                  │                 │
│        │                  │                  │                 │
│        ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   文件存储 (JSON)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 数据隔离策略

| 来源 | 命名空间格式 | 示例 |
| ------ | ------------- | ------ |
| 内置应用 | `builtin/{appId}` | `builtin/calculator` |
| 商店应用 | `repo/{repoId}/{developerId}/{appId}` | `repo/official/dev1/notes` |
| URL 导入 | `url/{domain}/{hash}` | `url/example.com/a1b2c3d4` |
| 本地导入 | `local/{installationId}` | `local/inst_xyz12345` |

## 优先级说明

写入队列支持三个优先级：

| 来源 | 优先级值 | 说明 |
| ------ | --------- | ------ |
| system | 0 | 系统级操作，最高优先 |
| app | 10 | 应用写入操作 |
| sync | 20 | 云同步写入，最低优先 |

## 冲突处理流程

```
设备 A 编辑联系人 X
        │
        ▼
服务端锁定 X (30秒)
        │
        │    设备 B 也想编辑 X
        │            │
        │            ▼
        │    检测到冲突！
        │            │
        │            ▼
        │    显示 ConflictDialog
        │            │
        │            ▼
        │    用户选择:
        │    ├── 稍后再试 → 放弃本次操作
        │    ├── 放弃我的 → 拉取服务器数据
        │    └── 强制覆盖 → 覆盖服务端数据
        │
设备 A 完成编辑
        │
        ▼
释放锁定
```

## 开发调试

在开发模式下，可以使用 `WriteQueueDebug` 组件查看写入队列状态：

```vue
<template>
  <WriteQueueDebug />
</template>

<script setup>
import WriteQueueDebug from '@/components/dev/WriteQueueDebug.vue'
</script>
```

该组件会在屏幕右下角显示：
- 当前写入状态
- 队列长度
- 当前写入来源
- 上次写入时间

## 相关文档

- [应用身份识别设计](../app-identity-design.md)
- [应用沙箱设计](../app-sandbox-design.md)
- [云同步 V2 设计](../cloud-sync-v2-design.md)
