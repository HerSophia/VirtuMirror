<script setup lang="ts">
/**
 * 账号编辑弹窗
 */
import { ref, computed, onMounted } from 'vue'
import type { PlatformAccount } from '@/types/account'

const props = defineProps<{
  account: PlatformAccount
}>()

const emit = defineEmits<{
  close: []
  save: [data: Partial<PlatformAccount>]
}>()

// 表单数据
const nickname = ref('')
const handle = ref('')
const bioOverride = ref('')

// 初始化表单
onMounted(() => {
  nickname.value = props.account.nickname || ''
  handle.value = props.account.handle || ''
  bioOverride.value = props.account.bioOverride || ''
})

// 保存
function handleSave() {
  emit('save', {
    nickname: nickname.value || undefined,
    handle: handle.value || undefined,
    bioOverride: bioOverride.value || undefined,
  })
}

// 关闭
function handleClose() {
  emit('close')
}

// 点击遮罩关闭
function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <div class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container">
      <!-- 头部 -->
      <div class="dialog-header">
        <h2 class="dialog-title">编辑账号</h2>
        <button class="close-btn" @click="handleClose">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <!-- 内容 -->
      <div class="dialog-content">
        <div class="form-group">
          <label class="form-label">昵称</label>
          <input
            v-model="nickname"
            type="text"
            class="form-input"
            placeholder="输入昵称"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">用户名 (@handle)</label>
          <div class="input-with-prefix">
            <span class="input-prefix">@</span>
            <input
              v-model="handle"
              type="text"
              class="form-input with-prefix"
              placeholder="username"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">简介</label>
          <textarea
            v-model="bioOverride"
            class="form-textarea"
            placeholder="输入个人简介"
            rows="3"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">作用域</label>
          <div class="scope-info">
            <span v-if="account.scope === 'global'" class="scope-badge global">
              🌐 全局 - 所有会话可见
            </span>
            <span v-else-if="account.scope === 'character'" class="scope-badge character">
              🏷️ 角色卡级 - 相同角色卡的会话共享
            </span>
            <span v-else class="scope-badge session">
              📍 会话级 - 仅当前会话可见
            </span>
            <p class="scope-hint">账号作用域创建后不可更改</p>
          </div>
        </div>
      </div>
      
      <!-- 底部 -->
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="handleClose">
          取消
        </button>
        <button class="btn btn-primary" @click="handleSave">
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.dialog-container {
  @apply w-full max-w-md mx-4 rounded-2xl overflow-hidden;
  background-color: var(--color-surface);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  @apply flex items-center justify-between px-5 py-4;
  border-bottom: 1px solid var(--color-border);
}

.dialog-title {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.close-btn {
  @apply w-8 h-8 flex items-center justify-center rounded-full;
  color: var(--color-text-secondary);
  background: transparent;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
  color: var(--color-text);
}

.dialog-content {
  @apply px-5 py-4 space-y-4;
  max-height: 60vh;
  overflow-y: auto;
}

.form-group {
  @apply space-y-2;
}

.form-label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.form-input {
  @apply w-full px-4 py-2.5 rounded-xl text-base;
  @apply border outline-none;
  background-color: var(--color-background);
  border-color: var(--color-border);
  color: var(--color-text);
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: var(--color-primary);
}

.form-input.with-prefix {
  @apply pl-8;
}

.input-with-prefix {
  @apply relative;
}

.input-prefix {
  @apply absolute left-4 top-1/2 -translate-y-1/2;
  color: var(--color-text-secondary);
}

.form-textarea {
  @apply w-full px-4 py-2.5 rounded-xl text-base resize-none;
  @apply border outline-none;
  background-color: var(--color-background);
  border-color: var(--color-border);
  color: var(--color-text);
  transition: border-color 0.2s;
}

.form-textarea:focus {
  border-color: var(--color-primary);
}

.scope-info {
  @apply space-y-2;
}

.scope-badge {
  @apply inline-block px-3 py-1.5 rounded-lg text-sm;
}

.scope-badge.global {
  background-color: rgba(102, 126, 234, 0.15);
  color: #667eea;
}

.scope-badge.character {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.scope-badge.session {
  background-color: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.scope-hint {
  @apply text-xs;
  color: var(--color-text-secondary);
}

.dialog-footer {
  @apply flex items-center justify-end gap-3 px-5 py-4;
  border-top: 1px solid var(--color-border);
}

.btn {
  @apply px-5 py-2 rounded-xl text-sm font-medium;
  transition: all 0.2s;
}

.btn-secondary {
  background-color: var(--color-surface-variant);
  color: var(--color-text);
}

.btn-secondary:hover {
  background-color: var(--color-border);
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}
</style>
