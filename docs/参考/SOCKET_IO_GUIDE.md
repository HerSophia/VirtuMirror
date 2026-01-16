# Socket.IO 使用指南与常见问题

本文档记录了在小手机项目中使用 Socket.IO 时遇到的问题和解决方案。

## 概述

Socket.IO 是一个实时双向通信库，支持 WebSocket 和 HTTP 长轮询。本项目使用它在酒馆脚本（客户端）和 Bridge Server（服务端）之间同步数据。

## 版本信息

- 客户端：Socket.IO Client 4.7.2（CDN 加载）
- 服务端：Socket.IO 4.x（Node.js）

---

## 常见问题与解决方案

### 1. `transport close` / `transport_error` - 大数据量导致断开

**现象：**
- 连接成功后，发送数据时立即断开
- 服务器日志显示 `reason=transport_error`
- 客户端日志显示 `reason=transport close`

**原因：**
Socket.IO 默认 `maxHttpBufferSize` 为 **1MB**，超过此大小的消息会导致连接断开。

**解决方案：**

服务端增加 buffer 大小：
```typescript
const io = new Server(httpServer, {
  // 增加最大消息大小（默认 1MB，增加到 10MB）
  maxHttpBufferSize: 10 * 1024 * 1024,
  // 增加 ping 超时
  pingTimeout: 60000,
  pingInterval: 25000,
});
```

**预防措施：**
- 监控发送数据大小
- 考虑分批发送大数据
- 压缩或截断过长的消息内容

---

### 2. `xhr poll error` - CORS / 环境限制

**现象：**
- 使用 `polling` 传输时连接失败
- 错误信息：`xhr poll error`

**原因：**
酒馆助手脚本运行在特殊的沙箱环境中，XHR 请求受到 CORS 限制。

**解决方案：**

客户端只使用 WebSocket 传输：
```javascript
const socket = io(serverUrl, {
  transports: ['websocket'],  // 只用 websocket
  upgrade: false,             // 禁用升级
});
```

---

### 3. 连接被替换 / 重复连接

**现象：**
- 收到 `replaced` 事件
- 连接频繁断开重连

**原因：**
- 相同 sessionId 的新连接会替换旧连接
- 某些操作（如切换聊天）触发了重新连接

**解决方案：**

1. 使用 `forceNew: true` 确保每次创建新连接：
```javascript
const socket = io(serverUrl, {
  forceNew: true,
});
```

2. 断开前移除所有监听器：
```javascript
function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
```

3. 添加 `wasReplaced` 标记防止自动重连：
```javascript
socket.on('replaced', () => {
  wasReplaced = true;
});

socket.on('disconnect', () => {
  if (!wasReplaced) {
    scheduleReconnect();
  }
});
```

---

### 4. 心跳超时

**现象：**
- 连接一段时间后自动断开
- 日志显示 `heartbeat_timeout`

**原因：**
服务端配置的心跳超时时间过短，或客户端未正确响应 ping。

**解决方案：**

服务端配置：
```typescript
const io = new Server(httpServer, {
  pingTimeout: 60000,   // 60秒超时
  pingInterval: 25000,  // 25秒间隔
});
```

客户端响应 ping：
```javascript
socket.on('ping', (data) => {
  socket.emit('pong', { timestamp: Date.now() });
});
```

---

## 最佳实践

### 连接配置

```javascript
const socket = io(serverUrl, {
  // 查询参数（用于服务端识别客户端类型）
  query: {
    type: 'platform',
    platform: 'sillytavern',
    chatId: sessionId,
  },
  
  // 传输配置
  transports: ['websocket'],  // 优先或仅用 websocket
  upgrade: false,
  
  // 连接配置
  reconnection: false,  // 手动管理重连
  timeout: 30000,       // 连接超时
  forceNew: true,       // 强制新连接
  
  // 鉴权（可选）
  auth: {
    apiKey: 'your-api-key',
  },
});
```

### 事件监听

```javascript
// 连接成功
socket.on('connect', () => {
  console.log('已连接，socket.id:', socket.id);
});

// 断开连接（含原因）
socket.on('disconnect', (reason) => {
  console.log('断开原因:', reason);
  // reason 可能的值：
  // - 'io server disconnect': 服务器主动断开
  // - 'io client disconnect': 客户端主动断开
  // - 'transport close': 传输层关闭
  // - 'transport error': 传输层错误
  // - 'ping timeout': 心跳超时
});

// 连接错误
socket.on('connect_error', (err) => {
  console.log('连接错误:', err.message);
});
```

### 调试技巧

1. **打印数据大小**
```javascript
const data = { /* ... */ };
const size = JSON.stringify(data).length;
console.log('数据大小:', size, '字符');
```

2. **打印调用栈**
```javascript
socket.on('disconnect', (reason) => {
  console.log('断开原因:', reason);
  console.log('调用栈:', new Error().stack);
});
```

3. **检查 socket 状态**
```javascript
console.log('socket.connected:', socket?.connected);
console.log('socket.id:', socket?.id);
```

---

## 服务端配置参考

```typescript
import { Server } from 'socket.io';

const io = new Server(httpServer, {
  // CORS 配置
  cors: {
    origin: ['http://localhost:5173', '*'],
    methods: ['GET', 'POST'],
  },
  
  // Buffer 大小（重要！）
  maxHttpBufferSize: 10 * 1024 * 1024,  // 10MB
  
  // 心跳配置
  pingTimeout: 60000,
  pingInterval: 25000,
});

// 鉴权中间件
io.use((socket, next) => {
  const apiKey = socket.handshake.auth?.apiKey;
  if (validateApiKey(apiKey)) {
    next();
  } else {
    next(new Error('Authentication failed'));
  }
});

// 连接处理
io.on('connection', (socket) => {
  const clientType = socket.handshake.query.type;
  console.log('新连接:', clientType, socket.id);
  
  socket.on('disconnect', (reason) => {
    console.log('断开:', socket.id, reason);
  });
});
```

---

## 数据大小优化

当消息数据过大时，可以采取以下策略：

### 1. 截断消息内容

```javascript
function truncateMessage(msg, maxLength = 5000) {
  if (msg.message && msg.message.length > maxLength) {
    return {
      ...msg,
      message: msg.message.substring(0, maxLength) + '...[截断]',
      _truncated: true,
    };
  }
  return msg;
}

const messages = rawMessages.map(m => truncateMessage(m));
```

### 2. 分批发送

```javascript
function sendInBatches(messages, batchSize = 5) {
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    socket.emit('sync_batch', { batch, index: i / batchSize });
  }
  socket.emit('sync_complete');
}
```

### 3. 压缩数据

```javascript
// 使用 pako 库压缩
import pako from 'pako';

const compressed = pako.deflate(JSON.stringify(data));
socket.emit('sync_compressed', compressed);
```

---

## 参考资源

- [Socket.IO 官方文档](https://socket.io/docs/v4/)
- [Socket.IO 服务端 API](https://socket.io/docs/v4/server-api/)
- [Socket.IO 客户端 API](https://socket.io/docs/v4/client-api/)
- [连接问题排查](https://socket.io/docs/v4/troubleshooting-connection-issues/)
