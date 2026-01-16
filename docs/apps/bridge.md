# Bridge App 文档

> 用于管理与酒馆等平台的 Socket 桥接连接

## 概述

Bridge App 是一个管理界面，用于控制小手机与 Bridge Server 的连接，以及与酒馆等平台的数据同步。

## 目录结构

```
src/apps/bridge/
├── BridgeApp.vue           # 主入口组件
├── index.ts                # 导出入口
├── components/             # 共享组件
│   ├── index.ts
│   ├── PlatformCard.vue    # 平台卡片
│   └── StatusBadge.vue     # 状态徽章
├── composables/            # 组合式函数
│   ├── index.ts
│   └── useBridge.ts        # Bridge 连接管理
└── sections/               # 分区组件
    ├── index.ts
    ├── StatusSection.vue   # 状态概览
    ├── ConnectionSection.vue # 连接设置
    └── PlatformsSection.vue  # 已连接平台
```

## 功能

### 1. 连接状态显示

- 显示与 Bridge Server 的连接状态
- 显示服务器地址
- 显示已连接的平台数量
- 显示最后同步时间
- 显示心跳状态和延迟

### 2. 连接管理

- **自动连接**：应用启动时尝试自动连接
- 连接/断开 Bridge Server
- 配置服务器地址
- 手动触发数据同步
- 配置同步楼层数

### 3. 平台管理

- 查看已连接的平台列表
- 切换当前活动平台
- 对特定平台请求同步

## 组件说明

### StatusBadge

显示连接状态的小标签。

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| connected | boolean | - | 是否已连接 |
| connectedText | string | '已连接' | 已连接时显示的文本 |
| disconnectedText | string | '未连接' | 未连接时显示的文本 |

### PlatformCard

显示单个已连接平台的信息卡片。

**Props:**

| 属性 | 类型 | 说明 |
|------|------|------|
| platform | PlatformInfo | 平台信息对象 |
| active | boolean | 是否为当前选中的平台 |

**Events:**

| 事件 | 参数 | 说明 |
|------|------|------|
| select | - | 选中此平台 |
| sync | - | 请求同步此平台的数据 |

## Composables

### useBridge

提供 Bridge 连接管理的响应式状态和方法。

```typescript
const {
  status,          // Readonly<Ref<BridgeStatus>> - 连接状态
  isInitialized,   // Readonly<Ref<boolean>> - 是否已初始化
  connect,         // (serverUrl?: string) => void - 连接
  autoConnect,     // () => void - 自动连接（带重试机制）
  disconnect,      // () => void - 断开
  switchPlatform,  // (platform: string, chatId: string) => void - 切换平台
  requestSync,     // (floorRange?: number) => void - 请求同步
  getAdapter,      // () => BridgeAdapter | null - 获取适配器实例
} = useBridge()
```

### BridgeStatus 接口

```typescript
interface BridgeStatus {
  connected: boolean           // 是否已连接
  serverUrl: string            // 服务器地址
  currentPlatform: string | null  // 当前平台
  currentChatId: string | null    // 当前聊天 ID
  platforms: PlatformInfo[]    // 已连接的平台列表
  lastSyncTime: number | null  // 最后同步时间戳
  lastPingTime: number | null  // 最后收到 ping 的时间
  lastPongTime: number | null  // 最后发送 pong 的时间
  latency: number | null       // 网络延迟 (ms)
}
```

### 心跳相关事件

```typescript
// 监听心跳事件
adapter.on('bridge:heartbeat', ({ pingTime, pongTime, latency }) => {
  console.log(`心跳延迟: ${latency}ms`)
})

// 监听心跳超时
adapter.on('bridge:heartbeat_timeout', ({ elapsed, timeout }) => {
  console.log(`心跳超时: ${elapsed}ms > ${timeout}ms`)
})
```

## Store 依赖

此 App 不直接依赖 Pinia Store，而是通过 `BridgeAdapter` 管理状态。

## 路由

```typescript
{
  path: '/bridge',
  name: 'BridgeApp',
  component: BridgeApp,
  meta: { title: '桥接管理', keepAlive: true }
}
```

## 使用流程

1. 确保 Bridge Server 已启动（`server/` 目录）
2. 打开 Bridge App
3. 点击「连接」按钮连接到服务器
4. 在酒馆中启用桥接脚本（`scripts/phone-bridge.js`）
5. 酒馆连接后会自动出现在「已连接平台」列表中
6. 点击平台卡片上的「同步数据」获取最新数据

## 自动化与通知

### 自动连接机制

手机启动时会自动调用 `autoConnect()`：
1. 尝试连接上次保存的服务器地址（默认 `http://localhost:3001`）
2. 如果连接失败，会进行重试（最多 3 次）
3. 每次重试失败会在控制台输出警告

### 紧急通知

如果自动连接尝试 3 次均失败，系统会发送一条紧急通知：
- **标题**：桥接连接失败
- **优先级**：Urgent (紧急)
- **行为**：点击通知或通知中的"重试"按钮可手动触发重新连接

## 心跳机制

为确保连接的可靠性，Bridge 系统实现了心跳机制：

1. **服务端**：每 30 秒发送 `ping` 事件给所有客户端
2. **客户端**：收到 `ping` 后立即响应 `pong`
3. **超时检测**：如果 90 秒内未收到响应，断开连接

### 配置

服务端可通过环境变量配置：

- `HEARTBEAT_INTERVAL`: 心跳间隔（默认 30000ms）
- `HEARTBEAT_TIMEOUT`: 心跳超时（默认 90000ms）

客户端可通过 `BridgeAdapterOptions` 配置：

```typescript
const adapter = new BridgeAdapter({
  heartbeatTimeout: 90000  // 客户端超时检测
})
```

## 相关文件

- `src/adapters/bridgeAdapter.ts` - Bridge 适配器实现
- `server/index.ts` - Bridge Server 实现
- `scripts/phone-bridge.js` - 酒馆桥接脚本
- `docs/dev/socket-bridge-design.md` - 详细设计文档
