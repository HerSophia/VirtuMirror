<script setup lang="ts">
/**
 * 全局对话框组件
 * 在 App.vue 中挂载，提供全局对话框能力
 */
import { computed, ref, watch, nextTick } from 'vue'
import { useDialogStore } from '@/stores/dialogStore'
import type {
  ConfirmDialogOptions,
  AlertDialogOptions,
  InputDialogOptions,
  CustomDialogOptions,
} from '@/stores/dialogStore'

const dialogStore = useDialogStore()

// 输入框相关
const inputValue = ref('')
const inputError = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// 计算属性：类型化的选项
const confirmOptions = computed(() => {
  if (dialogStore.type === 'confirm') {
    return dialogStore.options as ConfirmDialogOptions
  }
  return null
})

const alertOptions = computed(() => {
  if (dialogStore.type === 'alert') {
    return dialogStore.options as AlertDialogOptions
  }
  return null
})

const inputOptions = computed(() => {
  if (dialogStore.type === 'input') {
    return dialogStore.options as InputDialogOptions
  }
  return null
})

const customOptions = computed(() => {
  if (dialogStore.type === 'custom') {
    return dialogStore.options as CustomDialogOptions
  }
  return null
})

// 图标映射
const iconMap: Record<string, { class: string; color: string }> = {
  warning: { class: 'fas fa-exclamation-triangle', color: 'text-yellow-500' },
  danger: { class: 'fas fa-exclamation-circle', color: 'text-red-500' },
  info: { class: 'fas fa-info-circle', color: 'text-blue-500' },
  success: { class: 'fas fa-check-circle', color: 'text-green-500' },
  question: { class: 'fas fa-question-circle', color: 'text-blue-500' },
}

const currentIcon = computed(() => {
  const icon = (confirmOptions.value?.icon || alertOptions.value?.icon) as string | undefined
  return icon ? iconMap[icon] : null
})

// 监听对话框打开，初始化输入框
watch(
  () => dialogStore.visible,
  (visible) => {
    if (visible && dialogStore.type === 'input') {
      inputValue.value = inputOptions.value?.value || ''
      inputError.value = ''
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  }
)

// 处理确认
function handleConfirm() {
  if (dialogStore.type === 'input') {
    // 验证输入
    if (inputOptions.value?.validate) {
      const error = inputOptions.value.validate(inputValue.value)
      if (error) {
        inputError.value = error
        return
      }
    }
    dialogStore.handleConfirm(inputValue.value)
  } else {
    dialogStore.handleConfirm()
  }
}

// 处理取消
function handleCancel() {
  dialogStore.handleCancel()
}

// 处理背景点击
function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleCancel()
  }
}

// 处理自定义组件关闭
function handleCustomClose(result?: unknown) {
  dialogStore.handleConfirm(result)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="dialogStore.visible"
        class="dialog-backdrop"
        @click="handleBackdropClick"
      >
        <!-- 确认对话框 -->
        <div v-if="dialogStore.type === 'confirm' && confirmOptions" class="dialog-container">
          <div class="dialog-header">
            <div v-if="currentIcon" class="dialog-icon" :class="currentIcon.color">
              <i :class="currentIcon.class" />
            </div>
            <h3 class="dialog-title">{{ confirmOptions.title }}</h3>
            <button class="close-btn" @click="handleCancel">
              <i class="fas fa-times" />
            </button>
          </div>

          <div class="dialog-body">
            <p class="dialog-message">{{ confirmOptions.message }}</p>
            <p v-if="confirmOptions.detail" class="dialog-detail">{{ confirmOptions.detail }}</p>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-cancel" @click="handleCancel">
              {{ confirmOptions.cancelText || '取消' }}
            </button>
            <button
              class="btn"
              :class="confirmOptions.confirmType === 'danger' ? 'btn-danger' : 'btn-primary'"
              @click="handleConfirm"
            >
              {{ confirmOptions.confirmText || '确定' }}
            </button>
          </div>
        </div>

        <!-- Alert 对话框 -->
        <div v-else-if="dialogStore.type === 'alert' && alertOptions" class="dialog-container">
          <div class="dialog-header">
            <div v-if="currentIcon" class="dialog-icon" :class="currentIcon.color">
              <i :class="currentIcon.class" />
            </div>
            <h3 class="dialog-title">{{ alertOptions.title }}</h3>
          </div>

          <div class="dialog-body">
            <p class="dialog-message">{{ alertOptions.message }}</p>
          </div>

          <div class="dialog-footer dialog-footer-center">
            <button class="btn btn-primary" @click="handleConfirm">
              {{ alertOptions.buttonText || '确定' }}
            </button>
          </div>
        </div>

        <!-- 输入对话框 -->
        <div v-else-if="dialogStore.type === 'input' && inputOptions" class="dialog-container">
          <div class="dialog-header">
            <h3 class="dialog-title">{{ inputOptions.title }}</h3>
            <button class="close-btn" @click="handleCancel">
              <i class="fas fa-times" />
            </button>
          </div>

          <div class="dialog-body">
            <label v-if="inputOptions.label" class="input-label">{{ inputOptions.label }}</label>
            <input
              ref="inputRef"
              v-model="inputValue"
              :type="inputOptions.type || 'text'"
              :placeholder="inputOptions.placeholder"
              class="dialog-input"
              :class="{ 'input-error': inputError }"
              @keyup.enter="handleConfirm"
              @keyup.esc="handleCancel"
            />
            <p v-if="inputError" class="error-text">{{ inputError }}</p>
            <p v-else-if="inputOptions.helpText" class="help-text">{{ inputOptions.helpText }}</p>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-cancel" @click="handleCancel">
              {{ inputOptions.cancelText || '取消' }}
            </button>
            <button class="btn btn-primary" @click="handleConfirm">
              {{ inputOptions.confirmText || '确定' }}
            </button>
          </div>
        </div>

        <!-- 自定义对话框 -->
        <div
          v-else-if="dialogStore.type === 'custom' && customOptions"
          class="dialog-container dialog-custom"
          :style="customOptions.width ? { maxWidth: customOptions.width } : {}"
        >
          <component
            :is="customOptions.component"
            v-bind="customOptions.props"
            @close="handleCustomClose"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
}

.dialog-container {
  background-color: var(--color-surface, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.dialog-custom {
  max-width: 600px;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.dialog-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.dialog-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text, #1f2937);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #6b7280);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--color-surface-variant, #f3f4f6);
}

.dialog-body {
  padding: 20px;
}

.dialog-message {
  font-size: 14px;
  color: var(--color-text, #374151);
  margin: 0;
  line-height: 1.6;
}

.dialog-detail {
  margin-top: 12px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text, #1f2937);
  margin-bottom: 8px;
}

.dialog-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background-color: var(--color-background, #fff);
  color: var(--color-text, #1f2937);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.dialog-input:focus {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dialog-input.input-error {
  border-color: #ef4444;
}

.dialog-input.input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.dialog-input::placeholder {
  color: var(--color-text-secondary, #9ca3af);
}

.help-text {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.error-text {
  margin-top: 8px;
  font-size: 12px;
  color: #ef4444;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  background-color: var(--color-surface-variant, #f9fafb);
}

.dialog-footer-center {
  justify-content: center;
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
}

.btn-cancel {
  background-color: var(--color-surface-variant, #e5e7eb);
  color: var(--color-text, #374151);
}

.btn-cancel:hover {
  opacity: 0.8;
}

.btn-primary {
  background-color: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-danger:hover {
  opacity: 0.9;
}

/* 过渡动画 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-container,
.dialog-leave-to .dialog-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
