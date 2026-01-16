<script setup lang="ts">
/**
 * 权限请求对话框
 */
import { computed } from 'vue'
import type { AppPermission } from '@/types/appPackage'
import { PERMISSION_DESCRIPTIONS } from '@/types/appPackage'
import { useAppStoreStore } from '@/stores/appStoreStore'

const props = defineProps<{
  visible: boolean
  appId: string | null
  permissions: AppPermission[]
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const appStore = useAppStoreStore()

// 获取应用信息
const app = computed(() => {
  if (!props.appId) return null
  return appStore.registry.apps.find(a => a.id === props.appId) || null
})

// 获取权限详情
function getPermissionInfo(permission: AppPermission) {
  return PERMISSION_DESCRIPTIONS[permission] || {
    name: permission,
    description: '未知权限',
    risk: 'medium' as const
  }
}

// 风险等级颜色
function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low': return 'var(--color-success)'
    case 'medium': return 'var(--color-warning)'
    case 'high': return 'var(--color-error)'
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click="emit('cancel')">
      <Transition name="scale">
        <div v-if="visible" class="dialog-content" @click.stop>
          <!-- 头部 -->
          <div class="dialog-header">
            <div v-if="app" class="app-info">
              <div
                class="app-icon"
                :style="{
                  background: app.icon.background,
                  color: app.icon.color || '#FFFFFF'
                }"
              >
                <i v-if="app.icon.type === 'font'" :class="app.icon.value"></i>
                <span v-else-if="app.icon.type === 'emoji'">{{ app.icon.value }}</span>
              </div>
              <span class="app-name">{{ app.name }}</span>
            </div>
            <h3 class="dialog-title">权限请求</h3>
            <p class="dialog-subtitle">此应用需要以下权限才能正常运行</p>
          </div>
          
          <!-- 权限列表 -->
          <div class="permission-list">
            <div
              v-for="permission in permissions"
              :key="permission"
              class="permission-item"
            >
              <div
                class="permission-icon"
                :style="{ color: getRiskColor(getPermissionInfo(permission).risk) }"
              >
                <i class="fas fa-shield-alt"></i>
              </div>
              <div class="permission-info">
                <span class="permission-name">{{ getPermissionInfo(permission).name }}</span>
                <span class="permission-desc">{{ getPermissionInfo(permission).description }}</span>
              </div>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="dialog-actions">
            <button class="btn-cancel" @click="emit('cancel')">
              拒绝
            </button>
            <button class="btn-confirm" @click="emit('confirm')">
              允许
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.dialog-overlay {
  @apply absolute inset-0 flex items-center justify-center p-6;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
}

.dialog-content {
  @apply w-full max-w-sm rounded-3xl p-6;
  background: var(--color-surface);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  @apply text-center mb-6;
}

.app-info {
  @apply flex flex-col items-center mb-4;
}

.app-icon {
  @apply w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-sm;
}

.app-name {
  @apply font-bold text-lg;
  color: var(--color-text);
}

.dialog-title {
  @apply text-xl font-bold mb-1;
  color: var(--color-text);
}

.dialog-subtitle {
  @apply text-sm;
  color: var(--color-text-secondary);
}

.permission-list {
  @apply space-y-3 mb-6 max-h-[40vh] overflow-y-auto -mx-2 px-2;
}

.permission-item {
  @apply flex items-center gap-4 p-3 rounded-2xl;
  background: var(--color-background);
}

.permission-icon {
  @apply w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0;
  background: var(--color-surface);
}

.permission-info {
  @apply flex flex-col gap-0.5;
}

.permission-name {
  @apply font-bold text-sm;
  color: var(--color-text);
}

.permission-desc {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.dialog-actions {
  @apply flex gap-3;
}

.btn-cancel,
.btn-confirm {
  @apply flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200;
}

.btn-cancel {
  background: var(--color-background);
  color: var(--color-text);
}

.btn-confirm {
  background: var(--color-primary);
  color: #FFFFFF;
  box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.3);
}

.btn-cancel:active,
.btn-confirm:active {
  transform: scale(0.96);
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>