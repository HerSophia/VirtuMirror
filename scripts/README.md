# 酒馆桥接脚本

## phone-bridge.js

用于在酒馆助手（TavernHelper）中运行的桥接脚本，将酒馆的消息事件同步到独立的小手机应用。

### 功能特性

- ✅ **可视化面板** - 在扩展设置中提供完整的配置界面
- ✅ **实时状态显示** - 连接状态、延迟、同步次数一目了然
- ✅ **配置持久化** - 自动保存配置，重启后恢复
- ✅ **日志查看** - 内置日志面板，方便调试
- ✅ **生成状态追踪** - 自动暂停/恢复同步，避免数据冲突

### 使用方法

1. 确保 Bridge Server 已启动（`server/` 目录）
2. 在酒馆助手中创建新脚本，将 `phone-bridge.js` 的内容粘贴进去
3. 打开酒馆的扩展面板，找到「📱 小手机桥接」
4. 配置服务器地址，点击「连接」按钮
5. 连接成功后，消息会自动同步

### 面板界面

面板位于酒馆的扩展设置区域（`#extensions_settings2`），提供以下功能：

#### 状态显示

- **连接状态** - 已连接（绿色）/ 未连接（红色），实时更新
- **Session ID** - 当前聊天的唯一标识（点击可复制）
- **延迟** - 与服务器的通信延迟（毫秒）
- **同步次数** - 累计同步次数
- **上次同步** - 最后一次同步的时间
- **AI 生成状态** - 显示是否正在生成（带动画图标）

#### 操作按钮

- **连接/断开** - 控制与服务器的连接，按钮文字会根据状态变化
- **同步** - 手动触发完整同步（强制模式，忽略生成状态）

#### 配置项

所有配置修改后会自动保存到脚本变量，下次启动时自动恢复。

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 服务器地址 | Bridge Server 的 URL | `http://localhost:3001` |
| API Key | 可选的鉴权密钥（留空禁用鉴权） | 空 |
| 同步楼层数 | 每次同步的消息数量 | 10 |
| 自动同步 | 是否定期自动同步 | 开启 |
| 同步间隔 | 自动同步的时间间隔（毫秒） | 5000 |
| 自动连接 | 脚本启动时是否自动连接 | 关闭 |
| 调试模式 | 是否输出详细日志 | 开启 |

#### 日志区域

- 显示最近 50 条日志
- 按类型着色：
  - 普通信息 - 默认颜色
  - 警告 - 黄色
  - 错误 - 红色
- 点击「清空」按钮可清除日志

### 脚本按钮

除了面板界面，脚本还提供快捷按钮（位于脚本管理区域）：

- **🔌 连接** - 连接/断开服务器
- **🔄 同步** - 手动触发同步

### 技术实现

#### jQuery 集成

脚本使用 jQuery 进行 DOM 操作，确保与酒馆的 UI 框架兼容：

- 面板注入使用 `$('#extensions_settings2').append()`
- 事件绑定使用 `$panel.find().on()`
- 状态更新使用 jQuery 选择器和方法

#### 初始化流程

```javascript
$(() => {
  // DOM 加载完成后初始化
  init();
});
```

### 同步的数据

- 聊天消息（最近 N 条）
- 联系人列表
- 朋友圈动态
- 邮件
- 其他小手机数据

### 事件监听

脚本会自动监听以下酒馆事件并同步：

| 事件 | 说明 |
|------|------|
| `MESSAGE_RECEIVED` | 新消息接收 |
| `MESSAGE_EDITED` | 消息被编辑 |
| `MESSAGE_DELETED` | 消息被删除 |
| `CHAT_CHANGED` | 聊天切换 |
| `GENERATION_STARTED` | AI 开始生成 |
| `GENERATION_ENDED` | AI 生成结束 |
| `GENERATION_STOPPED` | AI 生成被停止 |

### 生成状态管理

脚本会自动追踪酒馆的 LLM 生成状态：

- **生成中暂停同步**：当酒馆正在请求 LLM 生成响应时，脚本会暂停数据同步，避免同步不完整的数据
- **心跳保持**：即使在生成过程中，心跳检测仍然正常工作，并会在心跳响应中携带生成状态信息
- **自动恢复**：生成结束后会自动恢复同步，并立即同步一次最新数据
- **强制同步**：可以点击同步按钮进行强制同步，忽略生成状态

### Session ID

每个聊天会话都有一个唯一的 Session ID（UUID），存储在聊天变量中：

- 切换聊天时会自动获取或创建新的 Session ID
- Session ID 用于标识聊天会话，确保数据同步到正确的目标
- 可以在面板中查看当前 Session ID，点击可复制
- 切换聊天后会自动重新连接以更新 Session ID

### 配置持久化

配置保存在脚本变量中，路径为 `_phone_bridge.config`：

```javascript
// 保存配置
insertOrAssignVariables(
  { _phone_bridge: { config: { ...CONFIG } } },
  { type: 'script', script_id: getScriptId() }
);

// 加载配置
const vars = getVariables({ type: 'script', script_id: getScriptId() });
const savedConfig = _.get(vars, '_phone_bridge.config');
```

### 楼层数据 API

为支持档案 App 的楼层提取功能，脚本提供以下 API 供小手机端调用：

#### 请求楼层数据

小手机端通过 Socket 发送请求：

```typescript
// 请求指定范围的楼层
socket.emit('floors:request', {
  range: { start: 1, end: 10 },  // 楼层范围
  includeSwipes: false,           // 是否包含所有消息页
});

// 请求所有楼层
socket.emit('floors:request', {
  range: 'all',
});

// 请求最近 N 楼
socket.emit('floors:request', {
  range: { last: 20 },
});
```

#### 响应格式

```typescript
interface FloorData {
  messageId: number;             // 楼层号
  swipeId: number;               // 当前消息页 ID
  swipeCount: number;            // 消息页总数
  role: 'user' | 'assistant' | 'system';
  name: string;                  // 发言者名称
  content: string;               // 消息内容
  timestamp: number;             // 时间戳
}

// 脚本发送响应
socket.emit('floors:response', {
  success: true,
  floors: FloorData[],
  totalFloors: number,           // 总楼层数
  requestedRange: { start, end },
});
```

#### 实现示例

```javascript
// phone-bridge.js 中的处理逻辑
socket.on('floors:request', (request) => {
  try {
    let floors = [];
    const messages = getChatMessages(); // 酒馆助手 API
    const total = messages.length;
    
    // 解析范围
    let start, end;
    if (request.range === 'all') {
      start = 0;
      end = total - 1;
    } else if (request.range.last) {
      start = Math.max(0, total - request.range.last);
      end = total - 1;
    } else {
      start = request.range.start;
      end = Math.min(request.range.end, total - 1);
    }
    
    // 提取楼层数据
    for (let i = start; i <= end; i++) {
      const msg = messages[i];
      floors.push({
        messageId: i,
        swipeId: msg.swipe_id || 0,
        swipeCount: msg.swipes?.length || 1,
        role: msg.is_user ? 'user' : (msg.is_system ? 'system' : 'assistant'),
        name: msg.name || (msg.is_user ? '{{user}}' : '{{char}}'),
        content: msg.mes,
        timestamp: msg.send_date ? new Date(msg.send_date).getTime() : Date.now(),
      });
    }
    
    socket.emit('floors:response', {
      success: true,
      floors,
      totalFloors: total,
      requestedRange: { start, end },
    });
  } catch (error) {
    socket.emit('floors:response', {
      success: false,
      error: error.message,
    });
  }
});
```

#### 使用场景

| 场景 | 请求方式 | 说明 |
|------|----------|------|
| 档案提取 | `{ range: { start: 10, end: 20 } }` | 提取指定范围楼层 |
| 首次分析 | `{ range: 'all' }` | 获取全部历史 |
| 增量同步 | `{ range: { last: 5 } }` | 获取最新几楼 |
| 详情查看 | `{ range: { start: 15, end: 15 } }` | 获取单个楼层 |

---

### 故障排除

#### 面板不显示

- 确保脚本在 `$(() => {})` 中初始化
- 检查 `#extensions_settings2` 容器是否存在

#### 按钮无响应

- 确保使用 jQuery 绑定事件：`$panel.find().on('click', ...)`
- 检查控制台是否有错误

#### 连接状态不更新

- 确保 `updatePanelStatus()` 使用 jQuery 选择器
- 检查面板元素是否正确创建

#### 连接失败

- 确保 Bridge Server 已启动
- 检查服务器地址是否正确
- 检查是否需要 API Key
