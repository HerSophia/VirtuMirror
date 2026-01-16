import { defineStore } from 'pinia'
import { ref } from 'vue'
import { audioService } from '@/services/audioService'
import type { AudioChannelType } from '@/types/audio'

export const useAudioStore = defineStore('audio', () => {
  // ================= State =================
  
  // 各通道音量 (持久化)
  const volumes = ref<Record<AudioChannelType, number>>({
    master: 1.0,
    alarm: 1.0,
    ringtone: 0.8,
    notification: 0.8,
    system: 0.5,
    media: 0.6
  })

  // 各通道静音状态 (持久化)
  const muted = ref<Record<AudioChannelType, boolean>>({
    master: false,
    alarm: false,
    ringtone: false,
    notification: false,
    system: false,
    media: false
  })

  // ================= Init =================

  // 将响应式状态注入到 Service
  // 这样 Service 可以直接读取最新配置，且改动会自动响应
  audioService.init({
    volumes,
    muted
  })

  // ================= Actions =================

  /**
   * 设置通道音量
   * @param channel 通道类型
   * @param value 音量值 (0.0 - 1.0)
   */
  function setVolume(channel: AudioChannelType, value: number) {
    audioService.setChannelVolume(channel, value)
  }

  /**
   * 设置主音量
   */
  function setMasterVolume(value: number) {
    setVolume('master', value)
  }

  /**
   * 切换通道静音
   */
  function toggleMute(channel: AudioChannelType) {
    const newState = !muted.value[channel]
    audioService.setChannelMute(channel, newState)
  }

  /**
   * 播放系统音效 (便捷方法)
   */
  function playSystemSound(key: Parameters<typeof audioService.playSystemSound>[0]) {
    audioService.playSystemSound(key)
  }

  return {
    volumes,
    muted,
    setVolume,
    setMasterVolume,
    toggleMute,
    playSystemSound
  }
}, {
  persist: {
    paths: ['volumes', 'muted']
  }
})
