<script setup lang="ts">
/**
 * 主题与外观分区
 * 包含主题设置、壁纸等外观相关设置
 */
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { SettingsGroup, SettingsItem } from '../components'

const router = useRouter()
const { currentTheme } = useTheme()

function goToThemeSettings() {
  router.push('/settings/theme')
}
</script>

<template>
  <SettingsGroup title="主题与外观">
    <SettingsItem
      label="主题设置"
      :subtitle="currentTheme.name"
      icon="fa-palette"
      :icon-bg="currentTheme.colors.primary"
      icon-color="white"
      arrow
      @click="goToThemeSettings"
    />
    <SettingsItem
      label="主屏幕壁纸"
      arrow
    />
    <SettingsItem
      label="聊天窗口壁纸"
      arrow
    />
  </SettingsGroup>
</template>