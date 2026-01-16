# 音频服务 (Audio Service)

> **版本**: 1.0  
> **状态**: ✅ 已实现  
> **最后更新**: 2026-01-10

## 1. 概述

音频服务 (Audio Service) 是负责管理系统内所有声音播放、音量控制和音频焦点调度的核心基础设施。在模拟器环境中，音频不仅是简单的播放文件，还需要模拟真实手机复杂的音频管理逻辑。

### 1.1 核心职责

| 职责 | 说明 |
|------|------|
| **统一播放接口** | 提供简单易用的 API 供 App 播放声音 |
| **通道管理** | 区分铃声、媒体、通知、闹钟等不同音频通道，支持独立音量控制 |
| **焦点管理** | 管理多个音频源的并发播放规则（如混音、暂停、压低音量） |
| **资源管理** | 音频文件的预加载、缓存和释放 |
| **系统音效** | 内置点击、锁屏、充电、发送成功等常用系统音效 |

### 1.2 文档结构

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 本文档，服务概述与快速入门 |
| [architecture.md](./architecture.md) | 架构设计与核心概念 |
| [api-reference.md](./api-reference.md) | API 完整参考 |
| [integration.md](./integration.md) | 集成指南与最佳实践 |

## 2. 快速开始

### 2.1 基本播放

```typescript
import { audioService } from '@/services/audioService'

// 播放一个音频文件
const control = audioService.play({
  source: '/assets/sounds/notification.mp3',
  channel: 'notification',
  volume: 0.8
})

// 控制播放
control.pause()    // 暂停
control.resume()   // 恢复
control.stop()     // 停止并释放
```

### 2.2 播放系统音效

```typescript
// 使用预设的系统音效
audioService.playSystemSound('NOTIFICATION')
audioService.playSystemSound('CAMERA_SHUTTER')
audioService.playSystemSound('CLICK')
```

### 2.3 通过 Store 使用

```typescript
import { useAudioStore } from '@/stores/audioStore'

const audioStore = useAudioStore()

// 播放系统音效
audioStore.playSystemSound('NOTIFICATION')

// 调整音量
audioStore.setVolume('media', 0.5)
audioStore.setMasterVolume(0.8)

// 切换静音
audioStore.toggleMute('notification')
```

## 3. 核心特性

### 3.1 音频通道系统

系统将音频划分为不同的逻辑通道，每个通道有独立的音量设置和优先级：

| 通道 | 标识符 | 优先级 | 用途 | 默认音量 |
|------|--------|--------|------|----------|
| **Master** | ` | 全局主音量 | 1.0 |
| **Alarm** | `alarm` | 50 (最高) | 闹钟、倒计时 | 1.0 |
| **Ringtone** | `ringtone` | 40 | 来电铃声 | 0.8 |
| **Notification** | `notification` | 30 | 短信、推送提示音 | 0.8 |
| **System** | `system` | 20 | 键盘声、锁屏声 | 0.5 |
| **Media** | `media` | 10 | 音乐、视频、游戏 | 0.6 |

### 3.2 音量计算公式

终播放音量通过以下公式计算：

```
最终音量 = 主音量 × 通道音量 × 实例音量 × (Ducking ? 0.3 : 1.0)
```

- **主音量** (`master`): 全局音量上限
- **通道音量**: 各通道独立音量
- **实例音量**: 播放时指定的相对音量
- **Ducking**: 当高优先级音频播放时，低优先级音频的压低系数

### 3.3 音频焦点机制

当多个应用尝试同时播放音频时，音频焦点机制决定处理方式：

| 场景 | 新音频通道 | 现有媒体处理 |
|------|-----------|-------------|
| 来电铃声 | `ringtone` | 暂停 |
| 闹钟响起 | `alarm` | 暂停 |
| 收到通知 | `notification` | 音量压低至 30% (Ducking) |
| 系统音效 | `system` | 不影响 |

## 4. 预设系统音效

| 音效键 | 说明 | 状态 |
|--------|------|------|
| `CLICK` | 点击屏幕 | 🔇 未配置 |
| `LOCK` | 锁屏 | 🔇 未配置 |
| `UNLOCK` | 解锁 | 🔇 未配置 |
| `KEYPRESS` | 键盘打字 | 🔇 未配置 |
| `NOTIFICATION` | 默认通知音 | ✅ 已配置 |
| `SUCCESS` | 成功提示 | 🔇 未配置 |
| `ERROR` | 错误提示 | 🔇 未配置 |
| `CAMERA_SHUTTER` | 相机快门 | ✅ 已配置 |

> **注意**: 未配置的音效在调用时会静默跳过（仅在控制台输出 debug 日志）。

## 5. 文件结构

```
src/
├── services/
│   └── audioService.ts      # 核心服务实现
├── stores/
│   └── audioStore.ts        # Pinia Store（UI 状态管理）
└── types/
    └── audio.ts             # 类型定义
```

## 6. 相关文档

- [架构设计](./architecture.md) - 详细的架构与实现原理
- [API 参考](./api-reference.md) - 完整的 API 文档
- [集成指南](./integration.md) - 在 App 中集成音频服务
