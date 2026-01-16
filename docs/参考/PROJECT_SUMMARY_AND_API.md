# 小手机插件 (Mobile Phone Extension) 项目总结与 API 文档

## 1. 项目概述

**版本**: 3.0
**作者**: 沉淀/夜宵宵夜

该项目是一个为 SillyTavern 设计的沉浸式扩展插件，在聊天界面中模拟一个功能完整的智能手机。它不仅提供视觉上的手机 UI，还通过上下文监控（Context Monitor）和提示词注入（Prompt Injection），让 AI 角色能够感知并“使用”手机功能（如发短信、刷朋友圈、拍照等）。

### 核心功能
- **虚拟手机界面**：可拖拽、可缩放的 iOS 风格 UI，支持壁纸更换、深色模式。
- **应用生态系统**：
  - 💬 **信息 (Message)**：模拟短信和微信，支持私聊、群聊、发红包、发送语音/图片。
  - ⭕ **朋友圈 (Friends Circle)**：模拟社交动态，AI 可自动生成评论和点赞。
  - 🖼️ **相册 (Gallery)** & 📷 **相机**：支持图片上传和管理。
  - 📰 **论坛 & 微博**：模拟网络社区环境。
  - 🎒 **背包 & 任务**：扩展 RPG 玩法元素。
- **上下文感知**：手机内的状态（如收到新短信）会自动注入到 AI 的 Prompt 中，触发 AI 的相应回复。
- **数据持久化**：手机状态（安装的应用、聊天记录、壁纸等）绑定到具体的聊天或角色卡片中，支持导入导出。

---

## 2. 技术架构

项目采用模块化设计，主要由以下部分组成：

### 2.1 核心层
- **`index.js`**：插件入口。负责加载依赖、初始化核心模块，并注册控制台命令 `MobileContext`。
- **`mobile-phone.js`**：主控制器。管理手机的 DOM 结构、显示/隐藏逻辑、通知系统以及应用生命周期。
- **`app-loader.js`**：应用加载器。负责动态注册和异步加载 `app/` 目录下的各个子应用，优化首屏性能。
- **`context-monitor.js`**：上下文监视器。负责实时监听 SillyTavern 的事件，解析聊天记录，提取手机相关数据（如“[短信|...]”格式的内容）。

### 2.2 应用层 (`mobile/app/`)
每个功能被封装为一个独立的应用模块，通过 `AppLoader` 统一管理：
- `message-app.js`: 核心消息应用，处理聊天逻辑。
- `friends-circle.js`: 朋友圈逻辑，包含 AI 内容生成。
- `style-config-manager.js`: 样式和个性化配置管理。

---

## 3. SillyTavern API 与集成方法

本项目深度利用了 SillyTavern (ST) 的扩展 API。**注意：项目中未使用 `TavernHelper` 库，而是直接调用 ST 原生接口。**

### 3.1 全局上下文访问 (`SillyTavern.getContext()`)
这是插件获取当前环境信息的核心方法。插件通过 `window.SillyTavern.getContext()` 获取以下关键信息：

```javascript
const context = SillyTavern.getContext();

// 1. 基础信息
const chatId = context.chatId;           // 当前聊天文件的 ID (无后缀)
const characterId = context.characterId; // 当前角色的内部 ID
const groupId = context.groupId;         // 当前群组 ID (如果是群聊)

// 2. 角色数据
const charData = context.characters[characterId];
const charName = charData.name;          // 角色名称
const charAvatar = charData.avatar;      // 角色头像路径

// 3. 聊天记录
const chatMessages = context.chat;       // 当前聊天的完整消息数组
const lastMessage = chatMessages[chatMessages.length - 1];

// 4. 用户信息
const userName = context.name1;          // 用户名
const aiName = context.name2;            // AI 名
```

### 3.2 事件监听 (`eventSource`)
插件通过 ST 的事件总线监听生命周期事件，实现实时响应：

| 事件名称 | 对应常量 (event_types) | 用途 | 代码位置 |
| :--- | :--- | :--- | :--- |
| `CHAT_CHANGED` | `chat_id_changed` | 切换聊天/角色时触发。用于重置手机状态，加载新角色的手机数据。 | `mobile-init.js` |
| `MESSAGE_RECEIVED` | `message_received` | 收到 AI 消息时触发。用于解析 AI 回复中的特殊指令（如发朋友圈、回复短信）。 | `context-monitor.js` |
| `MESSAGE_SENT` | `message_sent` | 用户发送消息时触发。用于更新手机内的显示。 | `context-monitor.js` |
| `CHARACTER_EDITED` | `character_edited` | 角色卡被修改时触发。用于更新手机内的角色资料。 | `index.js` |
| `CHAT_COMPLETION_PROMPT_READY` | (无直接引用，通过 prompt manager 间接影响) | 在生成 Prompt 前触发。插件利用此机制注入手机状态到 Prompt。 | `context-monitor.js` |

**监听示例**：
```javascript
// 兼容多种获取 eventSource 的方式
const eventSource = SillyTavern.getContext().eventSource || window.eventSource;
const event_types = SillyTavern.getContext().event_types || window.event_types;

eventSource.on(event_types.MESSAGE_RECEIVED, (data) => {
    console.log('收到新消息:', data);
    // 触发手机通知逻辑
});
```

### 3.3 数据持久化 (`extension_settings`)
插件利用 ST 的 `extension_settings` 机制保存全局配置，利用 `localStorage` 或聊天元数据保存会话级数据。

- **全局设置**：`context.extensionSettings.mobile_context`
  - 保存开关状态、通用样式配置等。
  - 使用 `context.saveSettingsDebounced()` 防抖保存。

### 3.4 提示词注入与 Prompt 管理
为了让 AI 理解手机状态，插件会将特定的文本格式注入到聊天中，或者直接修改发送给 API 的消息数组。

- **格式协议**：插件定义了一套自然语言协议，AI 通过生成这些格式来操作手机。
  - 短信：`[短信|发送人|内容]`
  - 朋友圈：`[朋友圈|发布人|内容]`
  - 图片：`[图片|描述]`

---

## 4. 关键类与方法

### 4.1 `MobilePhone` (mobile-phone.js)
手机 UI 的总控制器。
- `init()`: 初始化 DOM，绑定拖拽事件。
- `toggle()`: 切换手机显示/隐藏。
- `openApp(appName)`: 打开指定应用（通过 `AppLoader` 加载）。
- `showNotification(data)`: 在手机顶部弹窗通知。

### 4.2 `ContextMonitor` (context-monitor.js)
数据解析核心。
- `getCurrentChatMessages()`: 获取当前聊天记录的标准化数组。
- `extractDataFromText(text, format)`: 从文本中提取符合特定正则（如短信格式）的数据。
- `smartExtract()`: 针对大文件的优化提取方法。

### 4.3 `MessageApp` (message-app.js)
消息应用逻辑。
- `renderMessageList()`: 渲染联系人列表。
- `renderMessageDetail(friendId)`: 渲染特定联系人的聊天记录。
- `sendMessage(content)`: 用户在手机里发消息，实际会调用 ST 的发送接口将内容插入到主聊天框。

---

## 5. 调试与开发

插件暴露了全局对象 `MobileContext` 和 `mobileDebug` 用于控制台调试：

- `MobileContext.debugModuleStatus()`: 检查各模块加载状态。
- `MobileContext.extractFromChat(format)`: 测试正则提取功能。
- `mobilePhone.toggle()`: 手动开关手机。
