<template>
  <div v-if="warning" class="install-warning-dialog">
    <div class="overlay" @click="onCancel" />
    <div class="dialog" :class="warning.level">
      <div class="icon-container">
        <span v-if="warning.level === 'warning'" class="warning-icon">⚠️</span>
        <span v-else-if="warning.level === 'danger'" class="danger-icon">🔴</span>
        <span v-else class="info-icon">ℹ️</span>
      </div>

      <h3>{{ warning.title }}</h3>
      <p>{{ warning.message }}</p>

      <div class="source-info">
        <span class="label">应用名称:</span>
        <span class="value">{{ appName }}</span>
      </div>

      <div class="actions">
        <button class="cancel" @click="onCancel">取消</button>
        <button class="confirm" :class="warning.level" @click="onConfirm">
          {{ warning.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AppSourceInfo } from '@/types/appIdentity'
import { computed } from 'vue'

interface InstallWarning {
  level: 'info' | 'warning' | 'danger'
  title: string
  message: string
  confirmText: string
}

const props = defineProps<{
  appName: string
  source: AppSourceInfo
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const warning = computed<InstallWarning | null>(() => {
  switch (props.source.type) {
    case 'builtin':
    case 'repository':
      // 内置和商店应用无需警告
      return null

    case 'url': {
      const url = (props.source as { url: string }).url
      let hostname = 'unknown'
      try {
        hostname = new URL(url).hostname
      } catch {
        // ignore
      }
      return {
        level: 'warning',
        title: '安装外部应用',
        message: `该应用来自 ${hostname}，请确认您信任该来源。`,
        confirmText: '我信任此来源，继续安装',
      }
    }

    case 'local':
      return {
        level: 'danger',
        title: '安装本地应用',
        message:
          '该应用来自本地文件，无法验证其来源和安全性。请确保您了解该应用的内容。',
        confirmText: '我了解风险，继续安装',
      }

    default:
      return null
  }
})

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.install-warning-dialog {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.dialog {
  position: relative;
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 360px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.icon-container {
  margin-bottom: 12px;
}

.warning-icon,
.danger-icon,
.info-icon {
  font-size: 48px;
}

h3 {
  margin: 0 0 12px;
  font-size: 18px;
  color: #333;
}

p {
  margin: 0 0 16px;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

.source-info {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
  text-align: left;
}

.source-info .label {
  color: #999;
  font-size: 12px;
}

.source-info .value {
  display: block;
  font-weight: 500;
  margin-top: 4px;
}

.actions {
  display: flex;
  gap: 12px;
}

button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel {
  background: #f0f0f0;
  color: #333;
}

.cancel:hover {
  background: #e0e0e0;
}

.confirm.warning {
  background: #ff9800;
  color: white;
}

.confirm.warning:hover {
  background: #f57c00;
}

.confirm.danger {
  background: #f44336;
  color: white;
}

.confirm.danger:hover {
  background: #d32f2f;
}
</style>
