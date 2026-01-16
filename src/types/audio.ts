/**
 * 音频服务类型定义
 */

/**
 * 音频通道类型
 * - master: 全局主音量
 * - alarm: 闹钟 (最高优先级)
 * - ringtone: 来电
 * - notification: 通知
 * - system: 系统音效 (点击、锁屏)
 * - media: 媒体 (音乐、视频)
 */
export type AudioChannelType = 'master' | 'alarm' | 'ringtone' | 'notification' | 'system' | 'media'

/**
 * 通道配置
 */
export interface AudioChannelConfig {
  type: AudioChannelType
  volume: number // 0.0 - 1.0
  muted: boolean
}

/**
 * 播放选项
 */
export interface SoundOption {
  /** 音频源 URL */
  source: string
  /** 目标通道 (默认 media) */
  channel?: AudioChannelType
  /** 相对音量 0.0 - 1.0 (默认 1.0) */
  volume?: number
  /** 是否循环 (默认 false) */
  loop?: boolean
  /** 
   * 是否允许叠加播放 (默认 false)
   * - false: 如果该 source 正在播放，会重置进度
   * - true: 每次调用都会创建一个新的播放实例 (适合按键音)
   */
  overlap?: boolean
  /** 播放结束回调 */
  onEnded?: () => void
}

/**
 * 播放控制器
 */
export interface PlaybackControl {
  /** 播放 ID */
  id: string
  /** 停止播放并销毁 */
  stop: () => void
  /** 暂停 */
  pause: () => void
  /** 恢复 */
  resume: () => void
  /** 设置特定实例的音量 */
  setVolume: (vol: number) => void
  /** 播放完成的 Promise */
  promise: Promise<void>
  /** 是否正在播放 */
  readonly isPlaying: boolean
}

/**
 * 预设系统音效键值
 */
export type SystemSoundKey = 
  | 'CLICK' 
  | 'LOCK' 
  | 'UNLOCK' 
  | 'KEYPRESS' 
  | 'NOTIFICATION' 
  | 'SUCCESS' 
  | 'ERROR'
  | 'CAMERA_SHUTTER'

/**
 * 焦点变化类型
 */
export type AudioFocusChange = 
  | 'GAIN'             // 获得焦点
  | 'LOSS'             // 永久失去焦点
  | 'LOSS_TRANSIENT'   // 暂时失去焦点 (应暂停)
  | 'LOSS_DUCK'        // 暂时失去焦点 (应降低音量)
