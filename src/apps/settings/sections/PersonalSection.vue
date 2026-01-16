<script setup lang="ts">
/**
 * 个人设置分区
 * 包含昵称、头像等个人信息设置
 */
import { useUIStore } from '@/stores/uiStore'
import { SettingsGroup, SettingsItem } from '../components'

const uiStore = useUIStore()
</script>

<template>
  <SettingsGroup>
    <SettingsItem
      label="我的昵称"
      :value="uiStore.customization.playerNickname"
      arrow
    />
    <SettingsItem
      label="更换我的头像"
      arrow
    />
  </SettingsGroup>
</template>