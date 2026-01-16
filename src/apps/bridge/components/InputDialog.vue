<script setup lang="ts">
/**
 * 输入对话框组件
 * 用于编辑服务器地址、API Key 等配置
 */
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 对话框标题 */
  title: string
  /** 输入框标签 */
  label?: string
  /** 输入框占位符 */
  placeholder?: string
  /** 当前值 */
  value?: string
  /** 输入类型 */
  type?: 'text' | 'password'
  /** 帮助文本 */
  helpText?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', value: string): void
  (e: 'cancel'): void
}>()

const inputValue = ref(props.value || '')
const inputRef = ref<HTMLInputElement | null>(null)

// 当对话框打开时，同步值并聚焦输入框
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      inputValue.value = props.value || ''
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  }
)

function handleConfirm() {
  emit('confirm', inputValue.value)
  emit('update:visible', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleCancel()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-backdrop" @click="handleBackdropClick">
        <div class="dialog-container">
          <div class="dialog-header">
            <h3 class="dialog-title">{{ title }}</h3>
            <button class="close-btn" @click="handleCancel">
              <i class="fas fa-times" />
            </button>
          </div>

          <div class="dialog-body">
            <label v-if="label" class="input-label">{{ label }}</label>
            <input
              ref="inputRef"
              v-model="inputValue"
              :type="type || 'text'"
              :placeholder="placeholder"
              class="dialog-input"
              @keyup.enter="handleConfirm"
              @keyup.esc="handleCancel"
            />
            <p v-if="helpText" class="help-text">{{ helpText }}</p>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-cancel" @click="handleCancel">取消</button>
            <button class="btn btn-confirm" @click="handleConfirm">确定</button>
          </div>
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
  z-index: 9999;
  padding: 20px;
}

.dialog-container {
  background-color: var(--color-surface, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.dialog-title {
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
}

.close-btn:hover {
  background-color: var(--color-surface-variant, #f3f4f6);
}

.dialog-body {
  padding: 20px;
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

.dialog-input::placeholder {
  color: var(--color-text-secondary, #9ca3af);
}

.help-text {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  background-color: var(--color-surface-variant, #f9fafb);
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

.btn-confirm {
  background-color: var(--color-primary, #3b82f6);
  color: white;
}

.btn-confirm:hover {
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
