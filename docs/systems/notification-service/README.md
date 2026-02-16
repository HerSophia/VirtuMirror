# 通知服务 (Notification Service)

> **版本**: 1.0  
> **状态**: ✅ 已实现  
> **最后更新**: 2026-01-10

## 1. 概述

通知服务是小手机模拟器的核心系统服务之一，负责统一管理来自各个 App 的消息推送、排队、展示和交互。它模拟了真实手机的通知系统，包括 Toast 横幅、状态栏图标、通知中心等完整功能。

### 1.1 核心特性

- **统一推送接口**: 所有 App 通过标准 API 发送通知
- **优先级管理**: 支持 4 级优先级，高优先级通知可抢占显示
- **Toast 队列**: 智能管理 Toast 显示顺序和时机
- **勿扰模式**: 支持全局勿扰和应用级静音
- **状态栏图标**: 自动管理未读通知的状态栏图标显示
- **声音反馈**: 集成音频服务，支持自定义提示音
- **数据持久化**: 通知列表自动持久化到本地存储

### 1.2 设计原则

1. **Service + Store 分离**: Service 处理业务逻辑，Store 管理响应式状态
2. **State Injection**: Service 通过依赖注入获取 Store 的状态引用
3. **单例模式**: NotificationService 采用单例，全局唯一入口
4. **响应式驱动**: UI 组件通过订阅 Store 状态自动更新

## 2. 快速开始

### 2.1 发送通知

```typescript
import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()

// 发送一条普通通知
notificationStore.createNotification({
  appId: 'com.example.myapp',
  appName: '我的应用',
  appIcon: { type: 'fontawesome', value: 'fas fa-bell' },
  title: '新消息',
  body: '你收到了一条新消息',
  priority: 'normal',
  sound: true,  // 播放系统默认提示音
})
```

### 2.2 发送高优先级通知

```typescript
// 高优先级通知会抢占当前显示的 Toast
notificationStore.createNotification({
  appId: 'com.example.chat',
  appName: '即时通讯',
  appIcon: { type: 'fontawesome', value: 'fas fa-comment' },
  title: '新消息',
  body: '张三: 你好，在吗？',
  priority: 'high',
  sound: '/sounds/message.mp3',  // 自定义提示音
  actions: [
    { id: 'reply', label: '回复' },
    { id: 'mark-read', label: '标记已读' }
  ],
  route: '/chat/conversation/123',  // 点击跳转路由
})
```

### 2.3 管理勿扰模式

```typescript
const notificationStore = useNotificationStore()

// 开启勿扰模式
notificationStore.setDoNotDisturb(true)

// 静音特定应用
notificationStore.muteApp('com.example.ads')

// 取消静音
notificationStore.unmuteApp('com.example.ads')
```

## 3. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                          应用层 (Apps)                           │
│    微博 │ 聊天 │ 邮件 │ 系统设置 │ ...                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ createNotification()
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NotificationStore (Pinia)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 状态: notifications, activeToast, doNotDisturb, ...      │    │
│  │ 计算: unreadCount, groupedNotifications, ...             │    │
│  │ 操作: createNotification(), markAsRead(), clearAll()     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │ 代理调用                            │
└────────────────────────────┼────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NotificationService (单例)                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ • push(): 推送新通知                                      │    │
│  │ • showToast(): Toast 显示逻辑                             │    │
│  │ • dismissToast(): 关闭 Toast                              │    │
│  │ • 优先级抢占逻辑                                           │    │
│  │ • 声音播放集成                                             │    │
│  │ • 状态栏图标管理                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         UI 组件层                                │
│    NotificationToast │ StatusBar │ NotificationCenter            │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 文件结构

```
src/
├── services/
│   └── notification/
│       └── notificationService.ts   # 核心服务类
├── stores/
│   └── notificationStore.ts         # Pinia 状态管理
└── types/
    └── notification.ts              # 类型定义
```

## 5. 相关文档

- [架构设计](./architecture.md) - 详细的架构说明和设计模式
- [类型定义](./types.md) - 完整的 TypeScript 类型参考
- [API 参考](./api.md) - 完整的 API 文档
- [设置集成](./settings.md) - 与系统设置的集成说明

## 6. 与其他服务的关系

| 服务 | 关系 | 说明 |
| ------ | ------ | ------ |
| **AudioService** | 依赖 | 播放通知提示音 |
| **AppRegistry** | 集成 | 获取应用元数据（图标、名称） |
| **Router** | 集成 | 处理通知点击跳转 |
| **Settings** | 集成 | 通知设置界面注册到系统设置 |

## 7. 版本历史

| 版本 | 日期 | 变更内容 |
| ------ | ------ | ---------- |
| 1.0 | 2026-01-10 | 初始版本，完整功能实现 |
