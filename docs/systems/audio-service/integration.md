# 音频服务集成指南

> 本文档介绍如何在 App 中集成和使用音频服务。

## 1. 基础集成

### 1.1 在组件中使用

#### 使用 Service（推荐用于播放控制）

```typescript
import { audioService } from '@/services/audioService'

// 播放音频
const playNotification = () => {
  audioService.play({
    source: '/sounds/notification.mp3',
    channel: 'notification'
  })
}

// 播放系统音效
const onClick = () => {
  audioService.playSystemSound('CLICK')
}
```

#### 使用 Store（推荐用于设置界面）

```vue
<script setup lang="ts">
import { useAudioStore } from '@/stores/audioStore'

const audioStore = useAudioStore()
</script>

<template>
  <!-- 音量滑块 -->
  <div class="volume-control">
    <label>媒体音量</label>
    <input 
      type="range" 
      min="0" 
      max="1" 
      step="0.1"
      :value="audioStore.volumes.media"
      @input="e => audioStore.setVolume('media', +e.target.value)"
    />
    <span>{{ Math.round(audioStore.volumes.media * 100) }}%</span>
  </div>

  <!-- 静音开关 -->
  <button @click="audioStore.toggleMute('notification')">
    {{ audioStore.muted.notification ? '🔇' : '🔔' }}
  </button>
</template>
```

### 1.2 在服务中使用

```typescript
import { audioService } from '@/services/audioService'

class NotificationService {
  async notify(message: string) {
    // 显示通知 UI
    this.showNotification(message)
    
    // 播放通知音
    audioService.playSystemSound('NOTIFICATION')
  }
}
```

## 2. 常见场景

### 2.1 音乐播放器

```typescript
class MusicPlayer {
  private currentTrack: PlaybackControl | null = null

  async play(trackUrl: string) {
    // 停止当前播放
    if (this.currentTrack) {
      this.currentTrack.stop()
    }

    // 开始新的播放
    this.currentTrack = audioService.play({
      source: trackUrl,
      channel: 'media',
      loop: false,
      onEnded: () => this.onTrackEnded()
    })
  }

  pause() {
    this.currentTrack?.pause()
  }

  resume() {
    this.currentTrack?.resume()
  }

  stop() {
    this.currentTrack?.stop()
    this.currentTrack = null
  }

  setVolume(volume: number) {
    this.currentTrack?.setVolume(volume)
  }

  private onTrackEnded() {
    // 播放下一首或处理结束逻辑
    this.playNext()
  }
}
```

### 2.2 游戏音效

```typescript
class GameSoundManager {
  private bgm: PlaybackControl | null = null

  init() {
    // 预加载音效
    audioService.preload([
      '/sounds/game/shoot.mp3',
      '/sounds/game/explosion.mp3',
      '/sounds/game/powerup.mp3',
      '/sounds/game/bgm.mp3'
    ])
  }

  startBGM() {
    this.bgm = audioService.play({
      source: '/sounds/game/bgm.mp3',
      channel: 'media',
      loop: true,
      volume: 0.5
    })
  }

  stopBGM() {
    this.bgm?.stop()
    this.bgm = null
  }

  // 射击音效（允许重叠）
  playShoot() {
    audioService.play({
      source: '/sounds/game/shoot.mp3',
      channel: 'system',
      overlap: true,
      volume: 0.7
    })
  }

  // 爆炸音效
  playExplosion() {
    audioService.play({
      source: '/sounds/game/explosion.mp3',
      channel: 'system',
      overlap: true
    })
  }
}
```

### 2.3 来电/闹钟

```typescript
class AlarmService {
  private alarmSound: PlaybackControl | null = null

  triggerAlarm() {
    // 使用 alarm 通道，会暂停其他媒体
    this.alarmSound = audioService.play({
      source: '/sounds/alarm.mp3',
      channel: 'alarm',
      loop: true,
      volume: 1.0
    })
  }

  dismissAlarm() {
    this.alarmSound?.stop()
    this.alarmSound = null
    // 其他被暂停的媒体会自动通过焦点机制恢复
  }
}

class CallService {
  private ringtone: PlaybackControl | null = null

  incomingCall() {
    this.ringtone = audioService.play({
      source: '/sounds/ringtone.mp3',
      channel: 'ringtone',
      loop: true
    })
  }

  answerCall() {
    this.ringtone?.stop()
    // 开始通话...
  }

  rejectCall() {
    this.ringtone?.stop()
  }
}
```

### 2.4 按键音

```vue
<script setup lang="ts">
import { audioService } from '@/services/audioService'

const onKeyPress = () => {
  audioService.playSystemSound('KEYPRESS')
}
</script>

<template>
  <div class="keyboard">
    <button 
      v-for="key in keys" 
      :key="key"
      @click="onKeyPress"
    >
      {{ key }}
    </button>
  </div>
</template>
```

## 3. 最佳实践

### 3.1 选择正确的通道

| 场景 | 推荐通道 | 原因 |
| ------ | ---------- | ------ |
| 音乐/视频 | `media` | 标准媒体播放 |
| 消息通知 | `notification` | 会触发 Ducking，不打断音乐 |
| 来电铃声 | `ringtone` | 高优先级，会暂停音乐 |
| 闹钟 | `alarm` | 最高优先级，即使静音也播放 |
| 按键音 | `system` | 随系统触感设置 |
| 游戏音效 | `system` 或 `media` | 短音效用 system，BGM 用 media |

### 3.2 使用 overlap 参数

```typescript
// ❌ 错误：快速连续点击时音效被打断
audioService.play({
  source: '/sounds/click.mp3',
  channel: 'system'
})

// ✅ 正确：每次点击都能完整播放
audioService.play({
  source: '/sounds/click.mp3',
  channel: 'system',
  overlap: true
})
```

**何时使用 `overlap: true`**：
- 按键音、点击音
- 游戏中的连续射击音
- 任何可能快速重复触发的短音效

**何时使用 `overlap: false`（默认）**：
- 背景音乐
- 通知音
- 铃声
- 不需要叠加的单次音效

### 3.3 预加载优化

```typescript
// 在 App 初始化时预加载常用音效
const initApp = () => {
  audioService.preload([
    '/sounds/notification.mp3',
    '/sounds/click.mp3',
    '/sounds/success.mp3'
  ])
}

// 在进入特定页面时预加载该页面音效
const onEnterGamePage = () => {
  audioService.preload([
    '/sounds/game/bgm.mp3',
    '/sounds/game/win.mp3',
    '/sounds/game/lose.mp3'
  ])
}
```

### 3.4 资源清理

```typescript
// 组件卸载时停止播放
onUnmounted(() => {
  currentPlayback?.stop()
})

// 切换页面时停止当前页面的音频
const onRouteLeave = () => {
  audioService.stopAll('media')  // 只停止媒体，保留通知等
}
```

### 3.5 错误处理

```typescript
const playWithFallback = async (source: string) => {
  try {
    const control = audioService.play({ source, channel: 'media' })
    await control.promise
  } catch (error) {
    console.warn('Audio playback failed:', error)
    // 可以尝试备用音源或静默失败
  }
}
```

## 4. 设置界面示例

### 4.1 完整的音量设置组件

```vue
<script setup lang="ts">
import { useAudioStore } from '@/stores/audioStore'
import { audioService } from '@/services/audioService'

const audioStore = useAudioStore()

const channels = [
  { key: 'master', label: '主音量', icon: '🔊' },
  { key: 'media', label: '媒体', icon: '🎵' },
  { key: 'ringtone', label: '铃声', icon: '📱' },
  { key: 'notification', label: '通知', icon: '🔔' },
  { key: 'alarm', label: '闹钟', icon: '⏰' },
  { key: 'system', label: '系统', icon: '⚙️' }
] as const

// 调整音量时播放测试音
const testVolume = (channel: string) => {
  if (channel === 'notification') {
    audioService.playSystemSound('NOTIFICATION')
  }
}
</script>

<template>
  <div class="audio-settings">
    <h3>音量设置</h3>
    
    <div 
      v-for="ch in channels" 
      :key="ch.key" 
      class="volume-row"
    >
      <span class="icon">{{ ch.icon }}</span>
      <span class="label">{{ ch.label }}</span>
      
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="audioStore.volumes[ch.key]"
        :disabled="audioStore.muted[ch.key]"
        @input="e => audioStore.setVolume(ch.key, +e.target.value)"
        @change="() => testVolume(ch.key)"
      />
      
      <span class="value">
        {{ Math.round(audioStore.volumes[ch.key] * 100) }}%
      </span>
      
      <button 
        class="mute-btn"
        @click="audioStore.toggleMute(ch.key)"
      >
        {{ audioStore.muted[ch.key] ? '🔇' : '🔈' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.audio-settings {
  padding: 16px;
}

.volume-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.icon {
  width: 24px;
  text-align: center;
}

.label {
  width: 60px;
}

input[type="range"] {
  flex: 1;
}

.value {
  width: 40px;
  text-align: right;
}

.mute-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
}
</style>
```

## 5. 调试技巧

### 5.1 检查活跃播放

```typescript
// 在开发者工具中
import { audioService } from '@/services/audioService'

// 查看当前活跃的播放（需要访问私有属性，仅用于调试）
console.log((audioService as any).activePlaybacks)
```

### 5.2 监控音量变化

```typescript
import { useAudioStore } from '@/stores/audioStore'
import { watch } from 'vue'

const audioStore = useAudioStore()

watch(
  () => audioStore.volumes,
  (newVolumes) => {
    console.log('Volume changed:', newVolumes)
  },
  { deep: true }
)
```

### 5.3 测试焦点机制

```typescript
// 1. 先播放媒体
const media = audioService.play({
  source: '/sounds/music.mp3',
  channel: 'media',
  loop: true
})

// 2. 播放通知，观察媒体是否被 Duck
audioService.play({
  source: '/sounds/notification.mp3',
  channel: 'notification'
})

// 3. 通知结束后，媒体音量应恢复
```

## 6. 常见问题

### Q1: 音频无法自动播放？

浏览器限制自动播放，需要用户交互后才能播放。

```typescript
// 在用户首次点击时解锁音频上下文
const unlockAudio = () => {
  audioService.play({
    source: '/sounds/silent.mp3',  // 播放一个静音文件
    channel: 'system',
    volume: 0
  })
  document.removeEventListener('click', unlockAudio)
}
document.addEventListener('click', unlockAudio)
```

### Q2: 音效延迟？

使用预加载减少延迟：

```typescript
// 启动时预加载
audioService.preload(['/sounds/click.mp3'])
```

### Q3: 快速点击时音效丢失？

使用 `overlap: true`：

```typescript
audioService.play({
  source: '/sounds/click.mp3',
  channel: 'system',
  overlap: true
})
```

### Q4: 切换页面后音乐还在播放？

在组件卸载时清理：

```typescript
onUnmounted(() => {
  bgmControl?.stop()
})
```

### Q5: 如何实现淡入淡出？

目前服务不内置淡入淡出，可以手动实现：

```typescript
const fadeOut = (control: PlaybackControl, duration = 1000) => {
  const steps = 20
  const interval = duration / steps
  let currentVolume = 1.0
  
  const timer = setInterval(() => {
    currentVolume -= 1 / steps
    if (currentVolume <= 0) {
      clearInterval(timer)
      control.stop()
    } else {
      control.setVolume(currentVolume)
    }
  }, interval)
}
```
