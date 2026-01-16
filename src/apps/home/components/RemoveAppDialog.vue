<script setup lang="ts">
/**
 * 删除/卸载应用确认对话框
 * 在编辑模式下点击图标的"-"按钮时显示
 * 提供两个选项：删除图标（从桌面移除）或卸载应用
 */
import { computed } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import type { AppItem } from '../types'

const props = defineProps<{
  /** 是否显示对话框 */
  visible: boolean
  /** 要删除的应用信息 */
  app: AppItem | null
}>()

const emit = defineEmits<{
  /** 取消操作 */
  cancel: []
  /** 删除图标（只从桌面移除，不卸载） */
  removeIcon: [app: AppItem]
  /** 卸载应用 */
  uninstall: [app: AppItem]
}>()

const appName = computed(() => props.app?.name || '应用')
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click="emit('cancel')">
      <Transition name="scale">
        <div v-if="visible" class="dialog-content" @click.stop>
          <!-- 应用图标和名称 -->
          <div class="dialog-header">
            <div v-if="app" class="app-info">
              <AppIcon
                :app-id="app.iconId"
                size="lg"
              />
              <span class="app-name">{{ appName }}</span>
            </div>
          </div>
          
          <!-- 提示信息 -->
          <p class="dialog-message">
            请选择操作
          </p>
          
          <!-- 操作选项 -->
          <div class="dialog-options">
            <button
              class="option-btn option-remove"
              @click="app && emit('removeIcon', app)"
            >
              <i class="fas fa-minus-circle option-icon"></i>
              <div class="option-text">
                <span class="option-title">删除图标</span>
                <span class="option-desc">从桌面移除，保留应用</span>
              </div>
            </button>
            
            <button
              class="option-btn option-uninstall"
              @click="app && emit('uninstall', app)"
            >
              <i class="fas fa-trash-alt option-icon"></i>
              <div class="option-text">
                <span class="option-title">卸载应用</span>
                <span class="option-desc">彻底删除应用及数据</span>
              </div>
            </button>
          </div>
          
          <!-- 取消按钮 -->
          <button class="btn-cancel" @click="emit('cancel')">
            取消
          </button>
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
  z-index: 200;
}

.dialog-content {
  @apply w-full max-w-xs rounded-3xl p-5;
  background: var(--color-surface);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  @apply text-center mb-4;
}

.app-info {
  @apply flex flex-col items-center gap-2;
}

.app-name {
  @apply font-bold text-base;
  color: var(--color-text);
}

.dialog-message {
  @apply text-center text-sm mb-4;
  color: var(--color-text-secondary);
}

.dialog-options {
  @apply space-y-3 mb-4;
}

.option-btn {
  @apply w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200;
  background: var(--color-background);
}

.option-btn:active {
  transform: scale(0.98);
}

.option-icon {
  @apply text-xl w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0;
}

.option-remove .option-icon {
  @apply bg-amber-100 text-amber-600;
}

.option-uninstall .option-icon {
  @apply bg-red-100 text-red-600;
}

.option-text {
  @apply flex flex-col text-left gap-0.5;
}

.option-title {
  @apply font-bold text-sm;
  color: var(--color-text);
}

.option-desc {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.btn-cancel {
  @apply w-full py-3 rounded-xl font-bold text-sm transition-all duration-200;
  background: var(--color-background);
  color: var(--color-text-secondary);
}

.btn-cancel:active {
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