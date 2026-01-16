# 音频服务 API 参考

> 本文档提供音频服务的完整 API 参考。

## 1. AudioService API

`AudioService` 是核心服务类，采用单例模式。

### 1.1 获取实例

```typescript
import { audioService } from '@/services/audioService'

// 或获取单例
const service = AudioService.getInstance()
```

### 1.2 init

初始化服务，注入 Store 状态引用。

```typescript
init(refs: {
  volumes: Ref<Record<AudioChannelType, number>>
  muted: Ref<Record<AudioChannelType, boolean>>
}): void
```

**参数**：
- `refs.volumes` - 各通道音量的响应式引用
- `refs.muted` - 各通道静音状态的响应式引用

**说明**：
- 由 `AudioStore` 在初始化时自动调用
- 建立 Service 与 Store 之间的响应式连接

---

### 1.3 play

播放音频文件。

```typescript
play(options: SoundOption): PlaybackControl
```

**参数** `SoundOption`：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `source` | `string` | 必填 | 音频文件 URL |
| `channel` | `AudioChannelType` | `'media'` | 目标通道 |
| `volume` | `number` | `1.0` | 相对音量 (0.0-1.0) |
| `loop` | `boolean` | `false` | 是否循环播放 |
| `overlap` | `boolean` | `false` | 是否允许叠加播放 |
| `onEnded` | `() => void` | - | 播放结束回调 |

**返回值** `PlaybackControl`：

| 属性/方法 | 类型 | 说明 |
|-----------|------|------|
| `id` | `string` | 播放实例唯一标识 |
| `stop()` | `() => void` | 停止播放并释放资源 |
| `pause()` | `() => void` | 暂停播放 |
| `resume()` | `() => void` | 恢复播放 |
| `setVolume(vol)` | `(number) => void` | 动态调整该实例的音量 |
| `promise` | `Promise<void>` | 播放完成的 Promise |
| `isPlaying` | `boolean` (readonly) | 是否正在播放 |

**示例**：

```typescript
// 基本播放
const control = audioService.play({
  source: '/sounds/notification.mp3',
  channel: 'notification'
})

// 循环播放背景音乐
const bgm = audioService.play({
  source: '/sounds/bgm.mp3',
  channel: 'media',
  loop: true,
  volume: 0.6
})

// 等待播放完成
await audioService.play({
  source: '/sounds/alert.mp3',
  channel: 'alarm'
}).promise

// 叠加播放按键音
audioService.play({
  source: '/sounds/keypress.mp3',
  channel: 'system',
  overlap: true
})
```

---

### 1.4 playSystemSound

播放预设的系统音效。

```typescript
playSystemSound(key: SystemSoundKey): void
```

**参数**：

| 值 | 说明 | 配置状态 |
|----|------|----------|
| `'CLICK'` | 屏幕点击 | 🔇 未配置 |
| `'LOCK'` | 锁屏 | 🔇 未配置 |
| `'UNLOCK'` | 解锁 | 🔇 未配置 |
| `'KEYPRESS'` | 键盘按键 | 🔇 未配置 |
| `'NOTIFICATION'` | 通知提示 | ✅ 已配置 |
| `'SUCCESS'` | 成功 | 🔇 未配置 |
| `'ERROR'` | 错误 | 🔇 未配置 |
| `'CAMERA_SHUTTER'` | 相机快门 | ✅ 已配置 |

**说明**：
- 未配置的音效会静默跳过（仅输出 debug 日志）
- 系统音效默认使用 `system` 通道，允许 `overlap`

**示例**：

```typescript
audioService.playSystemSound('NOTIFICATION')
audioService.playSystemSound('CAMERA_SHUTTER')
```

---

### 1.5 stopAll

停止所有（或指定通道）的播放。

```typescript
stopAll(channel?: AudioChannelType): void
```

**参数**：
- `channel` - 可选，指定要停止的通道；不传则停止所有

**示例**：

```typescript
// 停止所有音频
audioService.stopAll()

// 只停止媒体通道
audioService.stopAll('media')
```

---

### 1.6 preload

预加载音频资源。

```typescript
preload(sources: string[]): void
```

**参数**：
- `sources` - 音频 URL 数组

**说明**：
- 预加载会创建 `HTMLAudioElement` 并触发 `load()`
- 预加载的资源会被缓存，后续播放时复用

**示例**：

```typescript
// 应用启动时预加载常用音效
audioService.preload([
  '/sounds/notification.mp3',
  '/sounds/message.mp3',
  '/sounds/ringtone.mp3'
])
```

---

### 1.7 setChannelVolume

设置指定通道的音量。

```typescript
setChannelVolume(channel: AudioChannelType, volume: number): void
```

**参数**：
- `channel` - 目标通道
- `volume` - 音量值 (0.0-1.0)，会自动限制在有效范围内

**说明**：
- 修改会立即应用到该通道的所有活跃播放
- 音量变化会同步到 Store（响应式）

**示例**：

```typescript
audioService.setChannelVolume('media', 0.5)
audioService.setChannelVolume('notification', 0.8)
audioService.setChannelVolume('master', 1.0)
```

---

### 1.8 setChannelMute

设置指定通道的静音状态。

```typescript
setChannelMute(channel: AudioChannelType, muted: boolean): void
```

**参数**：
- `channel` - 目标通道
- `muted` - 是否静音

**说明**：
- `master` 通道静音会使所有音频静音
- 静音状态会持久化（通过 Store）

**示例**：

```typescript
// 静音通知
audioService.setChannelMute('notification', true)

// 全局静音
audioService.setChannelMute('master', true)
```

---

## 2. AudioStore API

`AudioStore` 是 Pinia Store，提供响应式状态和便捷方法。

### 2.1 使用 Store

```typescript
import { useAudioStore } from '@/stores/audioStore'

const audioStore = useAudioStore()
```

### 2.2 State

| 状态 | 类型 | 说明 |
|------|------|------|
| `volumes` | `Record<AudioChannelType, number>` | 各通道音量 |
| `muted` | `Record<AudioChannelType, boolean>` | 各通道静音状态 |

**默认值**：

```typescript
volumes: {
  master: 1.0,
  alarm: 1.0,
  ringtone: 0.8,
  notification: 0.8,
  system: 0.5,
  media: 0.6
}

muted: {
  master: false,
  alarm: false,
  ringtone: false,
  notification: false,
  system: false,
  media: false
}
```

### 2.3 Actions

#### setVolume

```typescript
setVolume(channel: AudioChannelType, value: number): void
```

设置通道音量，等同于 `audioService.setChannelVolume`。

#### setMasterVolume

```typescript
setMasterVolume(value: number): void
```

设置主音量的便捷方法。

#### toggleMute

```typescript
toggleMute(channel: AudioChannelType): void
```

切换指定通道的静音状态。

#### playSystemSound

```typescript
playSystemSound(key: SystemSoundKey): void
```

播放系统音效的便捷方法。

### 2.4 持久化

Store 配置了自动持久化：

```typescript
{
  persist: {
    paths: ['volumes', 'muted']
  }
}
```

- 音量和静音设置会自动保存到 `localStorage`
- 页面刷新后自动恢复

---

## 3. 类型定义

### 3.1 AudioChannelType

音频通道类型。

```typescript
type AudioChannelType = 
  | 'master'       // 全局主音量
  | 'alarm'        // 闹钟
  | 'ringtone'     // 来电铃声
  | 'notification' // 通知
  | 'system'       // 系统音效
  | 'media'        // 媒体
```

### 3.2 SoundOption

播放选项。

```typescript
interface SoundOption {
  source: string              // 音频源 URL
  channel?: AudioChannelType  // 目标通道，默认 'media'
  volume?: number             // 相对音量 0.0-1.0，默认 1.0
  loop?: boolean              // 是否循环，默认 false
  overlap?: boolean           // 是否允许叠加播放，默认 false
  onEnded?: () => void        // 播放结束回调
}
```

### 3.3 PlaybackControl

播放控制器。

```typescript
interface PlaybackControl {
  id: string                      // 播放 ID
  stop: () => void                // 停止并销毁
  pause: () => void               // 暂停
  resume: () => void              // 恢复
  setVolume: (vol: number) => void // 设置音量
  promise: Promise<void>          // 播放完成 Promise
  readonly isPlaying: boolean     // 是否正在播放
}
```

### 3.4 SystemSoundKey

预设系统音效键值。

```typescript
type SystemSoundKey = 
  | 'CLICK' 
  | 'LOCK' 
  | 'UNLOCK' 
  | 'KEYPRESS' 
  | 'NOTIFICATION' 
  | 'SUCCESS' 
  | 'ERROR'
  | 'CAMERA_SHUTTER'
```

### 3.5 AudioFocusChange

焦点变化类型（内部使用）。

```typescript
type AudioFocusChange = 
  | 'GAIN'             // 获得焦点
  | 'LOSS'             // 永久失去焦点
  | 'LOSS_TRANSIENT'   // 暂时失去焦点（应暂停）
  | 'LOSS_DUCK'        // 暂时失去焦点（应降低音量）
```

### 3.6 AudioChannelConfig

通道配置（类型定义用）。

```typescript
interface AudioChannelConfig {
  type: AudioChannelType
  volume: number  // 0.0 - 1.0
  muted: boolean
}
```

---

## 4. 常量

### 4.1 通道优先级

```typescript
const CHANNEL_PRIORITY: Record<AudioChannelType, number> = {
  alarm: 50,       // 最高
  ringtone: 40,
  notification: 30,
  system: 20,
  media: 10,       // 最低
  master: 0        // 特殊
}
```

### 4.2 Ducking 系数

```typescript
const DUCKING_FACTOR = 0.3  // 被 Duck 时音量降至 30%
```

### 4.3 默认音量

```typescript
const DEFAULT_VOLUMES = {
  master: 1.0,
  alarm: 1.0,
  ringtone: 0.8,
  notification: 0.8,
  system: 0.5,
  media: 0.6
}
```
