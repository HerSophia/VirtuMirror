# Phone Bridge Server

小手机项目的后端服务器，负责：

- 🔗 作为 SillyTavern 与手机 UI 之间的桥梁
- 💾 数据存储与云同步
- 📱 多设备同步与冲突检测
- 🔐 API 鉴权

## 快速开始

```bash
cd server
npm install
npm run dev
```

服务默认运行在 `http://localhost:3001`

## 目录结构

```
server/
├── data/
│   ├── api.key                 # API 密钥文件
│   └── storage/                # 数据存储目录
│       └── {sessionId}/        # 按会话分目录
           ├── meta.json       # 会话元信息
│           ├── apps/           # 小手机应用数据 (V2.1)
│           │   ├── contacts/   # 通讯录（小手机内的联系人）
│           │   │   └── data.json
│           │   ├── messages/   # 短信/微信（小手机内的聊天）
│           │   │   └── data.json
│           │   ├── moments/    # 朋友圈
│           │   │   └── data.json
│           │   ├── phone/      # 电话（通话记录）
│           │   │   └── data.json
│           │   ├── email/      # 邮件
│           │   │   └── data.json
│           │   ├── weibo/      # 微博
│           │   │   └── data.json
│           │   └── {appId}/    # 其他应用
│           │       └── data.json
│           ├── tavern-cache/   # 酒馆消息缓存（非小手机数据！）
│           │   └── messages.json  # 酒馆 RP 楼层缓存
│           ├── global/         # 全局数据
│           │   ├── settings.json
│           │   └── desktop.json
│           ├── accounts/       # 账号系统
│           │   ├── entities.json
│           │   ├── platform-accounts.json
│           │   └── relations.json
│           ├── prompt-chains/  # 提示词链
│           │   ├── chains.json
│           │   └── history.json
│           ├── changelog/      # 变更日志（增量同步）
│           │   └── 2026-01-07.jsonl
│           └── backup/         # 完整备份
│               └── latest.json
├── src/
│   ├── auth.ts                 # 鉴权管理
│   ├── types.ts                # 类型定义
│   ├── services/               # 服务模块
│   │   ├── deviceManager.ts    # 设备管理
│   │   ├── conflictDetector.ts # 冲突检测
│   │   └── sessionWriteQueue.ts# 写入队列
│   └── storage/                # 存储模块 V2
│       ├── types.ts            # 存储类型
│       ├── appStorage.ts       # 按应用分类存储 (V2.1)
│       ├── tableStorage.ts     # 分表存储（兼容层）
│       └── storageV2.ts        # 存储管理器
└── index.ts                    # 服务入口
```

## 存储架构 V2.1

### 重要概念区分

⚠️ **酒馆消息 vs 小手机消息**

| 类型 | 存储位置 | 说明 |
|------|----------|------|
| 酒馆 RP 楼层 | `tavern-cache/messages.json` | 酒馆用户/AI 对话内容，用于桥接缓存 |
| 小手机短信 | `apps/messages/data.json` | 从 RP 中解析出的模拟手机短信 |

```
酒馆 RP 内容                          小手机数据
┌─────────────────────────┐         ┌─────────────────────────┐
│ Phoenix 给你发了条微信：   │  解析   │ contactId: "phoenix"    │
│ "今晚要加训吗？"          │ ────→  │ content: "今晚要加训吗？" │
│                         │         │ type: "text"            │
└─────────────────────────┘         └─────────────────────────┘
```

### 按应用分类存储

新版存储将数据按「应用」进行组织，每个应用有独立的数据目录：

| 应用ID | 包含的数据表 | 说明 |
|--------|-------------|------|
| contacts | contacts | 通讯录（小手机内的联系人） |
| messages | messages | 短信/微信（小手机内的聊天，不是酒馆楼层！） |
| moments | moments | 朋友圈 |
| phone | calls | 通话记录 |
| email | emails | 邮件 |
| forum | forumBoards, forumPosts | 论坛 |
| browser | bookmarks, browsingHistory | 浏览器 |
| live | liveStreams | 直播 |
| weibo | socialPosts, socialComments, ... | 微博 |

### 应用数据格式

每个应用的 `data.json` 格式：

```json
{
  "appId": "contacts",
  "sessionId": "sillytavern__xxx",
  "version": 1,
  "updatedAt": 1704499200000,
  "tables": {
    "contacts": [
      { "id": "c1", "name": "张三", ... }
    ]
  }
}
```

### 酒馆缓存

酒馆 RP 楼层缓存存储在 `tavern-cache/` 目录，用于桥接和调试：

```json
// tavern-cache/messages.json
{
  "sessionId": "71783df1-...",
  "messages": [
    {
      "message_id": 135,
      "name": "白默笙",
      "role": "user",
      "message": "早餐时间。\nValkyrie全队...",
      "cachedAt": 1767798901758
    }
  ],
  "messageRange": { "start": 135, "end": 144 },
  "syncedAt": 1767798901759
}
```

⚠️ 这些是酒馆的 RP 对话内容，不是小手机短信！小手机短信存储在 `apps/messages/`。

### 全局数据

不属于特定应用的全局数据存储在 `global/` 目录：

- `settings.json` - 应用设置
- `desktop.json` - 桌面布局

### 增量同步

启用增量同步后，所有变更会记录到 `changelog/` 目录：

```jsonl
{"appId":"contacts","table":"contacts","key":"c1","operation":"update","timestamp":1704499200000,"deviceId":"device_123"}
{"appId":"messages","table":"messages","key":101,"operation":"insert","timestamp":1704499201000,"deviceId":"device_456"}
```

客户端可以通过 `getChangesSince(timestamp)` 获取增量变更。

### 完整备份

用于云同步恢复的完整备份存储在 `backup/` 目录：

- `latest.json` - 最新备份
- `full_2026-01-07.json` - 按日期命名的历史备份

## API 路由

### 公开路由

| 路径 | 说明 |
|------|------|
| `GET /` | 状态页面 (HTML) |
| `GET /health` | 健康检查 |
| `GET /status` | 详细状态 (JSON) |

### 需要鉴权的路由

需要在请求头中添加 `X-API-Key`。

#### 设备  (V2)

| 路径 | 说明 |
|------|------|
| `POST /api/v2/devices/heartbeat` | 设备心跳 |

#### 存储 API

| 路径 | 说明 |
|------|------|
| `GET /api/v1/storage/:sessionId` | 获取备份数据 |
| `POST /api/v1/storage/:sessionId` | 上传备份数据 |
| `GET /api/v1/storage/:sessionId/meta` | 获取备份元信息 |

#### 会话 API

| 路径 | 说明 |
|------|------|
| `GET /api/sessions` | 获取会话列表 |
| `GET /api/sessions/:sessionId` | 获取会话详情 |
| `DELETE /api/sessions/:sessionId` | 删除会话 |
| `GET /api/sessions/:sessionId/messages` | 获取会话消息 |

#### 鉴权 API

| 路径 | 说明 |
|------|------|
| `GET /api/auth/key` | 获取 API Key |
| `POST /api/auth/regenerate` | 重新生成 Key |

## Socket.IO 事件

### 平台端 → 服务器

| 事件 | 说明 |
|------|------|
| `sync` | 同步消息/联系人等数据 |
| `config_update` | 配置更新 |
| `generation_status` | LLM 生成状态 |
| `swipe_changed` | Swipe 切换 |
| `pong` | 心跳响应 |

### 服务器 → 平台端

| 事件 | 说明 |
|------|------|
| `request_sync` | 请求同步 |
| `config_sync` | 配置同步 |
| `command` | 手机端命令 |
| `ping` | 心跳请求 |
| `replaced` | 被新连接替换 |

### 手机端 ↔ 服务器

| 事件 | 说明 |
|------|------|
| `connected_platforms` | 已连接的平台列表 |
| `platform_connected` | 平台已连接 |
| `platform_disconnected` | 平台已断开 |
| `sync` | 同步数据（转发） |
| `request_sync` | 请求同步 |
| `request_cached_data` | 请求缓存数据 |
| `cached_data` | 返回缓存数据 |

## 多设备同步

### 设备心跳

客户端每 30 秒发送一次心跳：

```typescript
POST /api/v2/devices/heartbeat
{
  "sessionId": "sillytavern__xxx",
  "deviceId": "device_123",
  "deviceName": "Windows PC"
}
```

响应：

```json
{
  "activeDeviceCount": 2,
  "otherDevices": [
    { "name": "iPhone", "lastActive": "刚刚" }
  ],
  "canWrite": true
}
```

### 冲突检测

当多设备同时编辑同一条数据时，使用短期锁定机制：

1. 设备 A 编辑联系人 X → 锁定 30 秒
2. 设备 B 也想编辑 X → 检测到冲突
3. 设备 B 显示冲突对话框
4. 用户选择：稍后再试 / 放弃我的 / 强制覆盖

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 服务端口 |
| `HEARTBEAT_INTERVAL` | 30000 | 心跳间隔 (ms) |
| `HEARTBEAT_TIMEOUT` | 90000 | 心跳超时 (ms) |

## 开发

```bash
# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 生产模式
npm start
```
