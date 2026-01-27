<script setup lang="ts">
import { audioService } from '@/services/audio/audioService'
import { useAudioStore } from '@/stores/audioStore'
import { SettingsGroup, SettingsItem, SliderControl, ToggleSwitch } from '../components'

const audioStore = useAudioStore()

// 滑动条变化处理
function handleVolumeChange(channel: Parameters<typeof audioStore.setVolume>[0], value: number) {
  audioStore.setVolume(channel, value)
}

// 播放测试音
function playTestSound(channel: 'ringtone' | 'notification' | 'alarm') {
  if (channel === 'ringtone') {
    // 模拟来电铃声
    audioService.play({
      source: 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3', // 示例铃声
      channel: 'ringtone',
      volume: 1.0,
    })
  } else if (channel === 'notification') {
    audioService.playSystemSound('NOTIFICATION')
  } else if (channel === 'alarm') {
    audioService.play({
      source: 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3', // 示例闹铃
      channel: 'alarm',
      volume: 1.0,
    })
  }
}
</script>

<template>
  <div class="sound-settings">
    <div class="header">
      <h3>声音与触感</h3>
    </div>

    <div class="content">
      <!-- 整体控制 -->
      <SettingsGroup title="全局控制">
        <SettingsItem label="静音模式">
          <template #right>
            <ToggleSwitch
              :model-value="audioStore.muted['master']"
              @update:model-value="audioStore.toggleMute('master')"
            />
          </template>
        </SettingsItem>
      </SettingsGroup>

      <!-- 音量调节 -->
      <SettingsGroup title="音量调节">
        <!-- 媒体音量 -->
        <SettingsItem label="媒体" :subtitle="`${Math.round(audioStore.volumes.media * 100)}%`">
          <template #bottom>
            <SliderControl
              :model-value="audioStore.volumes.media"
              :min="0"
              :max="1"
              :step="0.01"
              @update:model-value="(v) => handleVolumeChange('media', v)"
            />
          </template>
        </SettingsItem>

        <!-- 铃声音量 -->
        <SettingsItem
          label="铃声"
          :subtitle="`${Math.round(audioStore.volumes.ringtone * 100)}%`"
          @click="playTestSound('ringtone')"
        >
          <template #bottom>
            <SliderControl
              :model-value="audioStore.volumes.ringtone"
              :min="0"
              :max="1"
              :step="0.01"
              @update:model-value="(v) => handleVolumeChange('ringtone', v)"
            />
          </template>
        </SettingsItem>

        <!-- 通知音量 -->
        <SettingsItem
          label="通知"
          :subtitle="`${Math.round(audioStore.volumes.notification * 100)}%`"
          @click="playTestSound('notification')"
        >
          <template #bottom>
            <SliderControl
              :model-value="audioStore.volumes.notification"
              :min="0"
              :max="1"
              :step="0.01"
              @update:model-value="(v) => handleVolumeChange('notification', v)"
            />
          </template>
        </SettingsItem>

        <!-- 闹钟音量 -->
        <SettingsItem
          label="闹钟"
          :subtitle="`${Math.round(audioStore.volumes.alarm * 100)}%`"
          @click="playTestSound('alarm')"
        >
          <template #bottom>
            <SliderControl
              :model-value="audioStore.volumes.alarm"
              :min="0"
              :max="1"
              :step="0.01"
              @update:model-value="(v) => handleVolumeChange('alarm', v)"
            />
          </template>
        </SettingsItem>
      </SettingsGroup>

      <!-- 系统反馈 -->
      <SettingsGroup title="系统反馈">
        <SettingsItem label="系统提示音" subtitle="点击声、锁屏音等">
          <template #right>
            <ToggleSwitch
              :model-value="!audioStore.muted['system']"
              @update:model-value="audioStore.toggleMute('system')"
            />
          </template>
        </SettingsItem>
      </SettingsGroup>
    </div>
  </div>
</template>

<style scoped>
.sound-settings {
  @apply flex h-full flex-col;
  background-color: var(--color-background);
}

.header {
  @apply px-4 pb-2 pt-4;
}

.header h3 {
  @apply text-xl font-bold;
  color: var(--color-text);
}

.content {
  @apply flex-1 overflow-y-auto p-4 pt-0;
}
</style>
