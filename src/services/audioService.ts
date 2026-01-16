import { ref, type Ref } from 'vue'
import type { 
  AudioChannelType, 
  SoundOption, 
  PlaybackControl, 
  SystemSoundKey,
  AudioFocusChange
} from '@/types/audio'

/**
 * 内置音效映射表 (示例 URL)
 * 实际生产中建议替换为本地 assets 或稳定的 CDN
 */
const BUILTIN_SOUNDS: Record<SystemSoundKey, string> = {
  // 注意：以下链接仅作为示例。在生产环境或无外网环境下，请替换为本地资源或 Base64 编码。
  // 如果为空字符串，则不会播放。
  CLICK: '', // 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  LOCK: '', // 'https://assets.mixkit.co/active_storage/sfx/2865/2865-preview.mp3',
  UNLOCK: '', // 'https://assets.mixkit.co/active_storage/sfx/2865/2865-preview.mp3',
  KEYPRESS: '', // 'https://assets.mixkit.co/active_storage/sfx/1362/1362-preview.mp3',
  NOTIFICATION: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3', // 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  SUCCESS: '', // 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  ERROR: '', // 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
  CAMERA_SHUTTER: 'https://assets.mixkit.co/active_storage/sfx/1430/1430-preview.mp3', // 'https://assets.mixkit.co/active_storage/sfx/2045/2045-preview.mp3'
}

/**
 * 通道优先级定义 (数值越高优先级越高)
 */
const CHANNEL_PRIORITY: Record<AudioChannelType, number> = {
  alarm: 50,
  ringtone: 40,
  notification: 30,
  system: 20,
  media: 10,
  master: 0 // 特殊通道
}

interface ActivePlaybackItem {
  id: string
  audio: HTMLAudioElement
  channel: AudioChannelType
  baseVolume: number // 播放时设定的基础音量
  ducked: boolean // 是否被压低音量
}

export class AudioService {
  private static instance: AudioService
  
  // State Refs (Injected from Store)
  private _volumes: Ref<Record<AudioChannelType, number>> = ref({
    master: 1.0,
    alarm: 1.0,
    ringtone: 0.8,
    notification: 0.8,
    system: 0.5,
    media: 0.6
  })
  
  private _muted: Ref<Record<AudioChannelType, boolean>> = ref({
    master: false,
    alarm: false,
    ringtone: false,
    notification: false,
    system: false,
    media: false
  })
  
  // 活跃的播放列表
  private activePlaybacks: Map<string, ActivePlaybackItem> = new Map()
  
  // 缓存的 Audio 对象 (非 overlap 模式下复用)
  private audioCache: Map<string, HTMLAudioElement> = new Map()

  static getInstance(): AudioService {
    if (!this.instance) {
      this.instance = new AudioService()
    }
    return this.instance
  }

  /**
   * 初始化：注入 Store 状态
   */
  init(refs: {
    volumes: Ref<Record<AudioChannelType, number>>
    muted: Ref<Record<AudioChannelType, boolean>>
  }) {
    this._volumes = refs.volumes
    this._muted = refs.muted
  }

  /**
   * 播放音频
   */
  play(options: SoundOption): PlaybackControl {
    const { 
      source, 
      channel = 'media', 
      volume = 1.0, 
      loop = false, 
      overlap = false,
      onEnded 
    } = options

    const id = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 1. 获取或创建 Audio 实例
    let audio: HTMLAudioElement
    
    if (overlap) {
      // 允许重叠：总是创建新实例
      audio = new Audio(source)
    } else {
      // 不允许重叠：尝试复用缓存
      if (!this.audioCache.has(source)) {
        this.audioCache.set(source, new Audio(source))
      }
      audio = this.audioCache.get(source)!
      // 如果正在播放，重置进度
      audio.currentTime = 0
    }

    // 2. 配置 Audio
    audio.loop = loop
    audio.crossOrigin = 'anonymous' // 允许跨域
    
    // 3. 注册到活跃列表
    const playbackItem: ActivePlaybackItem = {
      id,
      audio,
      channel,
      baseVolume: volume,
      ducked: false
    }
    this.activePlaybacks.set(id, playbackItem)

    // 4. 计算并应用初始音量
    this.updateItemVolume(playbackItem)

    // 5. 事件处理
    const cleanup = () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      this.activePlaybacks.delete(id)
      
      // 如果不是缓存的实例，需要手动销毁引用帮助 GC（虽然 JS 中不需要显式销毁）
      if (overlap) {
        audio.src = ''
        audio.load()
      }
      
      // 检查是否需要恢复其他被 Duck 的音频
      this.checkAudioFocus()
    }

    const handleEnded = () => {
      if (onEnded) onEnded()
      // 如果不循环，播放结束自动清理
      if (!loop) {
        cleanup()
      }
    }

    const handleError = (e: Event) => {
      console.error('[AudioService] Playback error:', source, e)
      cleanup()
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // 6. 申请音频焦点 (Focus)
    this.requestAudioFocus(channel)

    // 7. 开始播放
    const playPromise = audio.play().catch(err => {
      // 只有非用户中断的错误才打印，避免 "The play() request was interrupted" 刷屏
      if (err.name !== 'AbortError') {
        console.warn('[AudioService] Play failed:', err)
      }
      cleanup()
    })

    // 8. 返回控制器
    return {
      id,
      stop: () => {
        audio.pause()
        audio.currentTime = 0
        cleanup()
      },
      pause: () => audio.pause(),
      resume: () => audio.play().catch(console.warn),
      setVolume: (v: number) => {
        playbackItem.baseVolume = v
        this.updateItemVolume(playbackItem)
      },
      promise: playPromise || Promise.resolve(),
      get isPlaying() { return !audio.paused && !audio.ended }
    }
  }

  /**
   * 播放预设系统音效
   */
  playSystemSound(key: SystemSoundKey) {
    const url = BUILTIN_SOUNDS[key]
    if (url) {
      this.play({
        source: url,
        channel: 'system',
        volume: 1.0,
        overlap: true // 系统音效通常允许重叠（如连续打字）
      })
    } else {
      // 避免在开发环境刷屏，仅在首次调用时提示或使用 debug 级别
      console.debug(`[AudioService] System sound not configured for key: ${key}`)
    }
  }

  /**
   * 停止指定通道的所有播放
   */
  stopAll(channel?: AudioChannelType) {
    this.activePlaybacks.forEach((item, id) => {
      if (!channel || item.channel === channel) {
        item.audio.pause()
        item.audio.currentTime = 0
        this.activePlaybacks.delete(id)
      }
    })
  }

  /**
   * 预加载音频
   */
  preload(sources: string[]) {
    sources.forEach(src => {
      if (!this.audioCache.has(src)) {
        const audio = new Audio(src)
        audio.load() // 触发加载
        this.audioCache.set(src, audio)
      }
    })
  }

  /**
   * 设置通道音量
   */
  setChannelVolume(channel: AudioChannelType, volume: number) {
    const safeVolume = Math.max(0, Math.min(1, volume))
    this._volumes.value[channel] = safeVolume
    this.applyVolumeToActiveItems()
  }

  /**
   * 设置通道静音状态
   */
  setChannelMute(channel: AudioChannelType, muted: boolean) {
    this._muted.value[channel] = muted
    this.applyVolumeToActiveItems()
  }

  // ================= 私有辅助方法 =================

  /**
   * 计算某个播放项的实际音量
   * 公式：最终音量 = 主音量 * 通道音量 * 基础音量 * (Ducking ? 0.3 : 1.0)
   * 且如果主通道或该通道静音，则为 0
   */
  private updateItemVolume(item: ActivePlaybackItem) {
    const masterMuted = this._muted.value['master']
    const channelMuted = this._muted.value[item.channel]
    
    if (masterMuted || channelMuted) {
      item.audio.volume = 0
      return
    }

    const masterVol = this._volumes.value['master']
    const channelVol = this._volumes.value[item.channel]
    const duckingFactor = item.ducked ? 0.3 : 1.0

    // 计算最终音量
    let finalVol = masterVol * channelVol * item.baseVolume * duckingFactor
    
    // 确保在 0-1 之间
    finalVol = Math.max(0, Math.min(1, finalVol))
    
    // 赋值
    item.audio.volume = finalVol
  }

  /**
   * 将音量设置应用到所有活跃播放项
   */
  private applyVolumeToActiveItems() {
    this.activePlaybacks.forEach(item => {
      this.updateItemVolume(item)
    })
  }

  /**
   * 请求音频焦点
   * 简单策略：
   * 1. 只有 Notification/Ringtone/Alarm 会触发其他通道 Ducking/Pause
   * 2. High Priority -> Low Priority
   */
  private requestAudioFocus(newChannel: AudioChannelType) {
    const newPriority = CHANNEL_PRIORITY[newChannel]
    
    // 遍历正在播放的项目
    this.activePlaybacks.forEach(item => {
      // 忽略自己和同优先级的
      if (item.channel === newChannel) return

      const currentPriority = CHANNEL_PRIORITY[item.channel]

      // 如果新音频优先级更高
      if (newPriority > currentPriority) {
        // 如果是 Alarm 或 Ringtone，暂停 Media
        if (newChannel === 'alarm' || newChannel === 'ringtone') {
           if (item.channel === 'media') {
             // 暂停媒体
             item.audio.pause()
             // 标记一下，可以在 focus release 时恢复（此处暂简化，不自动恢复暂停的，只恢复 Ducking 的）
           }
        } 
        // 如果是 Notification，压低 Media 音量 (Ducking)
        else if (newChannel === 'notification') {
          if (item.channel === 'media') {
            item.ducked = true
            this.updateItemVolume(item)
          }
        }
      }
    })
  }

  /**
   * 检查焦点恢复
   * 当一个高优先级音频结束时调用
   */
  private checkAudioFocus() {
    // 检查是否还有任何高优先级音频在播放
    let hasHighPriority = false
    this.activePlaybacks.forEach(item => {
      if (['alarm', 'ringtone', 'notification'].includes(item.channel)) {
        hasHighPriority = true
      }
    })

    if (!hasHighPriority) {
      // 恢复所有被 Duck 的音频
      this.activePlaybacks.forEach(item => {
        if (item.ducked) {
          item.ducked = false
          // 淡入恢复（可选优化，这里直接恢复）
          this.updateItemVolume(item)
        }
      })
    }
  }
}

export const audioService = AudioService.getInstance()
